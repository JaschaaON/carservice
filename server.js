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
const KEEP      = 40;                       // so viele Versionen bleiben liegen
const MAX_PHOTO = 8 * 1024 * 1024;          // 8 MB pro Bild

/* Bild-IDs kommen aus dem Browser und landen als Dateiname auf der
   Platte — deshalb streng pruefen, sonst ist Pfad-Traversal moeglich. */
const PHOTO_ID = /^f_[a-z0-9]{6,32}(_t)?$/;

const MIME = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json"};

fs.mkdirSync(VERSIONS, {recursive:true});
fs.mkdirSync(PHOTOS,  {recursive:true});

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
    if(!PHOTO_ID.test(id)) return send(res, 400, JSON.stringify({error:"ungültige Bild-ID"}));
    const file = path.join(PHOTOS, id + ".jpg");

    if(req.method === "GET"){
      fs.readFile(file, (err, buf)=>{
        if(err) return send(res, 404, JSON.stringify({error:"Bild nicht gefunden"}));
        res.writeHead(200, {
          "Content-Type":"image/jpeg",
          "Content-Length": buf.length,
          // Bilder aendern sich nie — unter derselben ID liegt immer dasselbe.
          "Cache-Control":"public, max-age=31536000, immutable",
          "X-Content-Type-Options":"nosniff"
        });
        res.end(buf);
      });
      return;
    }

    if(req.method === "PUT"){
      if(!canWrite()) return send(res, 507, JSON.stringify({error:"Datenverzeichnis nicht beschreibbar"}));
      const chunks = []; let size = 0;
      req.on("data", c=>{
        size += c.length;
        if(size > MAX_PHOTO){ req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", ()=>{
        const buf = Buffer.concat(chunks);
        // JPEG-Signatur pruefen, statt dem Content-Type zu vertrauen
        if(buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF)
          return send(res, 415, JSON.stringify({error:"kein JPEG"}));
        try{
          const tmp = file + ".tmp";
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, file);
        }catch(e){
          console.error(e);
          return send(res, 500, JSON.stringify({error:"Schreibfehler"}));
        }
        send(res, 200, JSON.stringify({ok:true, id, bytes:buf.length}));
      });
      req.on("aborted", ()=>{});
      return;
    }

    if(req.method === "DELETE"){
      let weg = 0;
      for(const f of [id + ".jpg", id + "_t.jpg"]){
        try{ fs.unlinkSync(path.join(PHOTOS, f)); weg++; }catch(e){}
      }
      return send(res, 200, JSON.stringify({ok:true, geloescht:weg}));
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
    try{ dateien = fs.readdirSync(PHOTOS).filter(f=>f.endsWith(".jpg")); }catch(e){}
    for(const f of dateien){
      const id = f.slice(0, -4);
      let gr = 0;
      try{ gr = fs.statSync(path.join(PHOTOS, f)).size; }catch(e){}
      bytes += gr;
      if(!benutzt.has(id)){ verwaist.push(id); verwaistBytes += gr; }
    }

    if(req.method === "DELETE"){            // aufraeumen
      let weg = 0;
      for(const id of verwaist){
        try{ fs.unlinkSync(path.join(PHOTOS, id + ".jpg")); weg++; }catch(e){}
      }
      return send(res, 200, JSON.stringify({ok:true, geloescht:weg, bytes:verwaistBytes}));
    }
    return send(res, 200, JSON.stringify({
      dateien: dateien.length, bytes,
      verwaist: verwaist.length, verwaistBytes
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
      fotos:     (()=>{ try{ return fs.readdirSync(PHOTOS).filter(f=>f.endsWith(".jpg")).length; }catch(e){ return 0; } })(),
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
