/* carservice — Mini-Server ohne Abhängigkeiten.
   Liefert die App aus und verwaltet eine einzige data.json.
   Jeder Schreibvorgang legt vorher eine Version ab, damit nichts
   verloren geht — auch ohne externes Backup.                      */
"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT      = process.env.PORT      || 8080;
const DATA_DIR  = path.resolve(process.env.DATA_DIR  || "/data");
const PUBLIC    = path.resolve(process.env.PUBLIC_DIR|| path.join(__dirname, "public"));
const DATA_FILE = path.join(DATA_DIR, "data.json");
const VERSIONS  = path.join(DATA_DIR, "versions");
const PHOTOS    = path.join(DATA_DIR, "photos");
const DOCS      = path.join(DATA_DIR, "docs");
const KEEP      = 40;                       // so viele Versionen bleiben liegen
const MAX_PHOTO = 8   * 1024 * 1024;        // 8 MB je Bild
const MAX_VIDEO = 150 * 1024 * 1024;        // 150 MB je Video
const MAX_DOC   = 60  * 1024 * 1024;        // 60 MB je Anleitung

/* Medien-IDs kommen aus dem Browser und landen als Dateiname auf der
   Platte — deshalb streng pruefen, sonst ist Pfad-Traversal moeglich.
   f_ = Foto, v_ = Video, Endung _t = Vorschaubild (immer JPEG). */
const MEDIA_ID = /^[fv]_[a-z0-9]{6,32}(_t)?$/;
const DOC_ID   = /^d_[a-z0-9]{6,32}$/;

/* Dateityp aus den ersten Bytes bestimmen, statt dem Content-Type der
   Anfrage zu glauben. */
function erkenneTyp(buf){
  if(buf.length > 3 && buf[0]===0xFF && buf[1]===0xD8 && buf[2]===0xFF)
    return {ext:"jpg", mime:"image/jpeg"};
  if(buf.length > 11 && buf.toString("ascii",4,8)==="ftyp"){
    const marke = buf.toString("ascii",8,12);
    return marke.startsWith("qt") ? {ext:"mov", mime:"video/quicktime"}
                                  : {ext:"mp4", mime:"video/mp4"};
  }
  if(buf.length > 3 && buf[0]===0x1A && buf[1]===0x45 && buf[2]===0xDF && buf[3]===0xA3)
    return {ext:"webm", mime:"video/webm"};
  return null;
}
const EXTS = {jpg:"image/jpeg", mp4:"video/mp4", mov:"video/quicktime", webm:"video/webm"};

/** Liefert den tatsaechlich abgelegten Dateinamen zu einer ID. */
function findeDatei(id){
  for(const ext of Object.keys(EXTS)){
    const f = path.join(PHOTOS, id + "." + ext);
    if(fs.existsSync(f)) return {pfad:f, mime:EXTS[ext]};
  }
  return null;
}

const MIME = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json"};

fs.mkdirSync(VERSIONS, {recursive:true});
fs.mkdirSync(PHOTOS,  {recursive:true});
fs.mkdirSync(DOCS,    {recursive:true});

/* Schreibrechte pruefen. Das ist der haeufigste Betriebsfehler:
   Der Container laeuft, aber das gemountete Verzeichnis gehoert
   einem anderen Benutzer — dann schlaegt erst das Speichern fehl. */
function canWrite(){
  try{ fs.accessSync(DATA_DIR, fs.constants.W_OK); return true; }
  catch(e){ return false; }
}

/* Frischer Container ohne Daten: gueltiges Grundgeruest anlegen,
   damit die App nicht faelschlich in den Offline-Modus faellt. */
if(!fs.existsSync(DATA_FILE) && canWrite()){
  fs.writeFileSync(DATA_FILE, JSON.stringify({version:2, rev:0, activeId:null, vehicles:[]}, null, 1));
  console.log("Keine data.json gefunden — leere Datenbasis angelegt.");
}
if(!canWrite())
  console.error(`WARNUNG: ${DATA_DIR} ist nicht beschreibbar. Speichern wird fehlschlagen.\n` +
                `         Auf dem Host: sudo chown -R 1000:1000 <datenverzeichnis>`);

function readDB(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch(e){ return null; }
}

function writeDB(db){
  const prev = readDB();
  if(prev){                                  // alte Fassung wegsichern
    const stamp = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    try{
      fs.writeFileSync(path.join(VERSIONS, `data-${stamp}.json`), JSON.stringify(prev));
      const old = fs.readdirSync(VERSIONS).filter(f=>f.endsWith(".json")).sort();
      for(const f of old.slice(0, Math.max(0, old.length - KEEP)))
        fs.unlinkSync(path.join(VERSIONS, f));
    }catch(e){ console.error("Version konnte nicht gesichert werden:", e.message); }
  }
  const tmp = DATA_FILE + ".tmp";            // atomar schreiben
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DATA_FILE);
}

function send(res, code, body, type){
  res.writeHead(code, {"Content-Type": type||"application/json; charset=utf-8",
                       "Cache-Control":"no-store"});
  res.end(body);
}

const server = http.createServer((req,res)=>{
  const url = new URL(req.url, "http://x");
  const p   = decodeURIComponent(url.pathname);

  /* ---- API ---- */
  if(p === "/api/data"){
    if(req.method === "GET"){
      const db = readDB();
      if(!db) return send(res, 404, JSON.stringify({error:"keine Daten"}));
      return send(res, 200, JSON.stringify(db));
    }
    if(req.method === "PUT"){
      let raw = "";
      req.on("data", c=>{ raw += c; if(raw.length > 12e6) req.destroy(); });
      req.on("end", ()=>{
        let incoming;
        try{ incoming = JSON.parse(raw); }
        catch(e){ return send(res, 400, JSON.stringify({error:"ungültiges JSON"})); }
        // Ab Version 2 liegen die Daten unter vehicles[]; Version 1
        // (ein Fahrzeug in der Wurzel) wird weiterhin angenommen.
        const looksValid = incoming && (Array.isArray(incoming.vehicles) || Array.isArray(incoming.tasks));
        if(!looksValid)
          return send(res, 400, JSON.stringify({error:"unerwartetes Format"}));

        const cur  = readDB();
        const curRev = cur ? (cur.rev||0) : 0;
        const sent   = parseInt(req.headers["if-match"] ?? curRev, 10);
        if(cur && sent !== curRev)            // anderes Gerät war schneller
          return send(res, 409, JSON.stringify({error:"Konflikt", rev:curRev}));

        incoming.rev = curRev + 1;
        try{ writeDB(incoming); }
        catch(e){ console.error(e); return send(res, 500, JSON.stringify({error:"Schreibfehler"})); }
        return send(res, 200, JSON.stringify({ok:true, rev:incoming.rev}));
      });
      return;
    }
    return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
  }

  /* Health-Endpoint fuer Docker bzw. Dockhand. Meldet 503, sobald
     die App zwar laeuft, aber nicht arbeiten kann — ein Container,
     der nicht speichern kann, gilt ausdruecklich als ungesund. */
  /* ---- Fotos ----
     Der Browser verkleinert und konvertiert bereits zu JPEG und laedt
     die Datei als reinen Body hoch. Damit entfaellt multipart-Parsing
     und der Server bleibt ohne Abhaengigkeiten.                     */
  if(p.startsWith("/api/photos/")){
    const id = p.slice("/api/photos/".length);
    if(!MEDIA_ID.test(id)) return send(res, 400, JSON.stringify({error:"ungültige Medien-ID"}));
    const istVideo = id.startsWith("v_") && !id.endsWith("_t");

    if(req.method === "GET"){
      const treffer = findeDatei(id);
      if(!treffer) return send(res, 404, JSON.stringify({error:"nicht gefunden"}));
      let stat; try{ stat = fs.statSync(treffer.pfad); }
      catch(e){ return send(res, 404, JSON.stringify({error:"nicht gefunden"})); }

      const kopf = {
        "Content-Type": treffer.mime,
        // Medien aendern sich nie — unter derselben ID liegt immer dasselbe.
        "Cache-Control":"public, max-age=31536000, immutable",
        "X-Content-Type-Options":"nosniff",
        "Accept-Ranges":"bytes"
      };

      /* Videos brauchen Bereichsabfragen, sonst laesst Safari das
         Abspielen und Vorspulen nicht zu. */
      const range = req.headers.range;
      if(range && /^bytes=\d*-\d*$/.test(range)){
        const [a,b] = range.replace("bytes=","").split("-");
        const start = a ? parseInt(a,10) : 0;
        const end   = b ? parseInt(b,10) : stat.size - 1;
        if(start >= stat.size || end >= stat.size || start > end){
          res.writeHead(416, {"Content-Range":`bytes */${stat.size}`});
          return res.end();
        }
        kopf["Content-Range"]   = `bytes ${start}-${end}/${stat.size}`;
        kopf["Content-Length"]  = end - start + 1;
        res.writeHead(206, kopf);
        return fs.createReadStream(treffer.pfad,{start,end}).pipe(res);
      }
      kopf["Content-Length"] = stat.size;
      res.writeHead(200, kopf);
      return fs.createReadStream(treffer.pfad).pipe(res);
    }

    if(req.method === "PUT"){
      if(!canWrite()) return send(res, 507, JSON.stringify({error:"Datenverzeichnis nicht beschreibbar"}));
      const grenze = istVideo ? MAX_VIDEO : MAX_PHOTO;
      const chunks = []; let size = 0, zuGross = false;
      req.on("data", c=>{
        size += c.length;
        if(size > grenze){ zuGross = true; req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", ()=>{
        if(zuGross) return;
        const buf = Buffer.concat(chunks);
        const typ = erkenneTyp(buf);
        if(!typ) return send(res, 415, JSON.stringify({error:"unbekanntes Dateiformat"}));
        // Vorschaubilder und Fotos muessen JPEG sein, v_ muss Video sein
        const willVideo = istVideo;
        const istVideoDatei = typ.mime.startsWith("video/");
        if(willVideo !== istVideoDatei)
          return send(res, 415, JSON.stringify({error:"Dateityp passt nicht zur ID"}));
        try{
          const ziel = path.join(PHOTOS, id + "." + typ.ext);
          const tmp  = ziel + ".tmp";
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, ziel);
        }catch(e){
          console.error(e);
          return send(res, 500, JSON.stringify({error:"Schreibfehler"}));
        }
        send(res, 200, JSON.stringify({ok:true, id, bytes:buf.length, typ:typ.mime}));
      });
      req.on("aborted", ()=>{});
      req.on("close", ()=>{
        if(zuGross && !res.headersSent)
          send(res, 413, JSON.stringify({error:`zu groß — höchstens ${Math.round(grenze/1048576)} MB`}));
      });
      return;
    }

    if(req.method === "DELETE"){
      let weg = 0;
      for(const basis of [id, id + "_t"])
        for(const ext of Object.keys(EXTS)){
          try{ fs.unlinkSync(path.join(PHOTOS, basis + "." + ext)); weg++; }catch(e){}
        }
      return send(res, 200, JSON.stringify({ok:true, geloescht:weg}));
    }
    return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
  }

  /* ---- Anleitungen (PDF) ----
     Getrennt von den Fotos, weil es Dokumente sind und nicht Medien:
     eigenes Verzeichnis, eigenes Groessenlimit, andere Auslieferung. */
  if(p.startsWith("/api/docs/")){
    const id = p.slice("/api/docs/".length);
    if(!DOC_ID.test(id)) return send(res, 400, JSON.stringify({error:"ungültige Dokument-ID"}));
    const datei = path.join(DOCS, id + ".pdf");

    if(req.method === "GET"){
      let stat; try{ stat = fs.statSync(datei); }
      catch(e){ return send(res, 404, JSON.stringify({error:"nicht gefunden"})); }
      const kopf = {
        "Content-Type":"application/pdf",
        // inline, damit der Browser es anzeigt statt herunterzuladen
        "Content-Disposition":"inline",
        "Cache-Control":"public, max-age=31536000, immutable",
        "X-Content-Type-Options":"nosniff",
        "Accept-Ranges":"bytes"
      };
      /* Bereichsabfragen: PDF-Betrachter laden gern nur einzelne
         Seiten nach, statt ein 10-MB-Dokument am Stueck zu ziehen. */
      const range = req.headers.range;
      if(range && /^bytes=\d*-\d*$/.test(range)){
        const [a,b] = range.replace("bytes=","").split("-");
        const start = a ? parseInt(a,10) : 0;
        const end   = b ? parseInt(b,10) : stat.size - 1;
        if(start >= stat.size || end >= stat.size || start > end){
          res.writeHead(416, {"Content-Range":`bytes */${stat.size}`});
          return res.end();
        }
        kopf["Content-Range"]  = `bytes ${start}-${end}/${stat.size}`;
        kopf["Content-Length"] = end - start + 1;
        res.writeHead(206, kopf);
        return fs.createReadStream(datei,{start,end}).pipe(res);
      }
      kopf["Content-Length"] = stat.size;
      res.writeHead(200, kopf);
      return fs.createReadStream(datei).pipe(res);
    }

    if(req.method === "PUT"){
      if(!canWrite()) return send(res, 507, JSON.stringify({error:"Datenverzeichnis nicht beschreibbar"}));
      const brocken = []; let groesse = 0, zuGross = false;
      req.on("data", c=>{
        groesse += c.length;
        if(groesse > MAX_DOC){ zuGross = true; req.destroy(); return; }
        brocken.push(c);
      });
      req.on("end", ()=>{
        if(zuGross) return;
        const buf = Buffer.concat(brocken);
        // PDF-Signatur pruefen statt dem Content-Type zu glauben
        if(buf.length < 5 || buf.toString("ascii",0,5) !== "%PDF-")
          return send(res, 415, JSON.stringify({error:"kein PDF"}));
        try{
          const tmp = datei + ".tmp";
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, datei);
        }catch(e){
          console.error(e);
          return send(res, 500, JSON.stringify({error:"Schreibfehler"}));
        }
        send(res, 200, JSON.stringify({ok:true, id, bytes:buf.length}));
      });
      req.on("close", ()=>{
        if(zuGross && !res.headersSent)
          send(res, 413, JSON.stringify({error:`zu groß — höchstens ${MAX_DOC/1048576} MB`}));
      });
      return;
    }

    if(req.method === "DELETE"){
      try{ fs.unlinkSync(datei); }catch(e){}
      return send(res, 200, JSON.stringify({ok:true}));
    }
    return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
  }

  /* ---- Speicherverbrauch und verwaiste Bilder ----
     Verwaist heisst: die Datei liegt auf der Platte, wird aber von
     keinem Fahrzeug mehr referenziert. */
  if(p === "/api/storage"){
    const db = readDB();
    const benutzt = new Set();
    for(const v of (db && db.vehicles) || [])
      for(const liste of [v.tasks||[], v.history||[]])
        for(const eintrag of liste)
          for(const id of eintrag.photos || []){ benutzt.add(id); benutzt.add(id + "_t"); }

    let bytes = 0, verwaistBytes = 0;
    const verwaist = [];
    let dateien = [];
    try{ dateien = fs.readdirSync(PHOTOS).filter(f=>/\.(jpg|mp4|mov|webm)$/.test(f)); }catch(e){}
    for(const f of dateien){
      const id = f.replace(/\.(jpg|mp4|mov|webm)$/, "");
      let gr = 0;
      try{ gr = fs.statSync(path.join(PHOTOS, f)).size; }catch(e){}
      bytes += gr;
      if(!benutzt.has(id)){ verwaist.push(id); verwaistBytes += gr; }
    }

    if(req.method === "DELETE"){            // aufraeumen
      let weg = 0;
      for(const id of verwaist){
        for(const ext of Object.keys(EXTS)){
          try{ fs.unlinkSync(path.join(PHOTOS, id + "." + ext)); weg++; break; }catch(e){}
        }
      }
      return send(res, 200, JSON.stringify({ok:true, geloescht:weg, bytes:verwaistBytes}));
    }
    let docDateien = [], docBytes = 0;
    try{
      docDateien = fs.readdirSync(DOCS).filter(f=>f.endsWith(".pdf"));
      for(const f of docDateien){
        try{ docBytes += fs.statSync(path.join(DOCS,f)).size; }catch(e){}
      }
    }catch(e){}
    return send(res, 200, JSON.stringify({
      dateien: dateien.length, bytes,
      verwaist: verwaist.length, verwaistBytes,
      anleitungen: docDateien.length, anleitungenBytes: docBytes
    }));
  }

  if(p === "/api/health"){
    const db = readDB();
    const dataOk     = !!db && (Array.isArray(db.vehicles) || Array.isArray(db.tasks));
    const writableOk = canWrite();
    const ok = dataOk && writableOk;
    return send(res, ok ? 200 : 503, JSON.stringify({
      ok,
      status:    ok ? "gesund" : !writableOk ? "Datenverzeichnis nicht beschreibbar" : "Daten fehlen oder unlesbar",
      lesbar:    dataOk,
      schreibbar:writableOk,
      fahrzeuge: db && Array.isArray(db.vehicles) ? db.vehicles.length : 0,
      revision:  db ? (db.rev||0) : null,
      versionen: (()=>{ try{ return fs.readdirSync(VERSIONS).filter(f=>f.endsWith(".json")).length; }catch(e){ return 0; } })(),
      medien:      (()=>{ try{ return fs.readdirSync(PHOTOS).filter(f=>/\.(jpg|mp4|mov|webm)$/.test(f)).length; }catch(e){ return 0; } })(),
      anleitungen: (()=>{ try{ return fs.readdirSync(DOCS).filter(f=>f.endsWith(".pdf")).length; }catch(e){ return 0; } })(),
      laufzeit:  Math.round(process.uptime()) + "s"
    }));
  }

  /* ---- statische Dateien ---- */
  const file = path.resolve(PUBLIC, "." + (p === "/" ? "/index.html" : p));
  if(file !== PUBLIC && !file.startsWith(PUBLIC + path.sep))
    return send(res, 403, "verboten", "text/plain");
  fs.readFile(file, (err, buf)=>{
    if(err) return send(res, 404, "nicht gefunden", "text/plain");
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {"Content-Type":type, "Cache-Control": p==="/"||p.endsWith(".html") ? "no-cache" : "max-age=3600"});
    res.end(buf);
  });
});

server.listen(PORT, ()=>console.log(`carservice läuft auf Port ${PORT}, Daten in ${DATA_DIR}`));
