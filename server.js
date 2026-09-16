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
const KEEP      = 40;                       // so viele Versionen bleiben liegen

const MIME = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json"};

fs.mkdirSync(VERSIONS, {recursive:true});

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
