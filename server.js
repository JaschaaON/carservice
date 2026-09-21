/* carservice — Mini-Server ohne Abhängigkeiten.
   Liefert die App aus und verwaltet eine einzige data.json.
   Jeder Schreibvorgang legt vorher eine Version ab, damit nichts
   verloren geht — auch ohne externes Backup.                      */
"use strict";
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const PORT      = process.env.PORT      || 8080;
const DATA_DIR  = path.resolve(process.env.DATA_DIR  || "/data");
const PUBLIC    = path.resolve(process.env.PUBLIC_DIR|| path.join(__dirname, "public"));
const AUTH_DIR  = path.join(DATA_DIR, "auth");
const USERS_FILE= path.join(AUTH_DIR, "users.json");
const SECRET_F  = path.join(AUTH_DIR, "secret");
const USERS_DIR = path.join(DATA_DIR, "users");

/* Jedes Konto hat dieselbe Struktur wie frueher das Gesamtverzeichnis.
   Getrennte Ordner statt einer gemeinsamen Datei: ein Fehler in der
   Zugriffspruefung kann so keine fremden Daten ausliefern, weil der
   Pfad gar nicht erst auf sie zeigt. */
function pfade(userId){
  const wurzel = path.join(USERS_DIR, userId);
  return {
    wurzel,
    datei:     path.join(wurzel, "data.json"),
    versionen: path.join(wurzel, "versions"),
    fotos:     path.join(wurzel, "photos"),
    docs:      path.join(wurzel, "docs"),
  };
}
const KEEP      = 40;                       // so viele Versionen bleiben liegen
const MAX_PHOTO = 8   * 1024 * 1024;        // 8 MB je Bild
const MAX_VIDEO = 150 * 1024 * 1024;        // 150 MB je Video
const MAX_DOC   = 100 * 1024 * 1024;        // 100 MB je Anleitung

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

const KOPF_BYTES = 32;   // mehr braucht keine der geprueften Signaturen

/** Nimmt den Koerper einer PUT-Anfrage entgegen und schreibt ihn laufend nach
 *  `tmp`, statt ihn im Speicher zu sammeln. Vorher belegte ein 150-MB-Video
 *  beim abschliessenden Buffer.concat kurzzeitig das Doppelte. Gepuffert
 *  werden nur die ersten Bytes — genug fuer die Signaturpruefung, bevor die
 *  temporaere Datei an ihren Platz rueckt.
 *
 *  fertig(fehler, {kopf, groesse}) — fehler ist {code, text} oder null.
 *  Im Fehlerfall ist die temporaere Datei bereits weggeraeumt. */
function koerperInDatei(req, tmp, grenze, fertig){
  const strom = fs.createWriteStream(tmp);
  const kopfTeile = [];
  let groesse = 0, kopfLaenge = 0, zuGross = false, erledigt = false;

  const schluss = (fehler, wert)=>{
    if(erledigt) return;
    erledigt = true;
    if(fehler){ try{ fs.unlinkSync(tmp); }catch(e){} }
    fertig(fehler, wert);
  };
  const zuGrossFehler = ()=>
    ({code:413, text:`zu groß — höchstens ${Math.round(grenze/1048576)} MB`});

  strom.on("error", e=>{ console.error(e); schluss({code:500, text:"Schreibfehler"}); });

  req.on("data", c=>{
    groesse += c.length;
    if(zuGross){
      /* Weiterlesen und wegwerfen. Nur so erreicht die 413 den Client —
         bricht man die Verbindung ab, sieht er bloss einen Broken Pipe.
         Weit jenseits der Grenze lohnt der harte Abbruch dann doch. */
      if(groesse > grenze * 2) req.destroy();
      return;
    }
    if(groesse > grenze){ zuGross = true; strom.destroy(); return; }
    if(kopfLaenge < KOPF_BYTES){
      const teil = c.subarray(0, KOPF_BYTES - kopfLaenge);
      kopfTeile.push(teil); kopfLaenge += teil.length;
    }
    if(!strom.write(c)){ req.pause(); strom.once("drain", ()=>req.resume()); }
  });

  const abbruch = ()=> schluss(zuGross ? zuGrossFehler()
                                       : {code:400, text:"Übertragung abgebrochen"});
  req.on("error", abbruch);
  req.on("aborted", abbruch);

  req.on("end", ()=>{
    if(zuGross) return schluss(zuGrossFehler());
    strom.end(()=> schluss(null, {kopf:Buffer.concat(kopfTeile), groesse}));
  });
}

/** Liefert den tatsaechlich abgelegten Dateinamen zu einer ID. */
function findeDatei(pf, id){
  for(const ext of Object.keys(EXTS)){
    const f = path.join(pf.fotos, id + "." + ext);
    if(fs.existsSync(f)) return {pfad:f, mime:EXTS[ext]};
  }
  return null;
}

const MIME = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json",
  ".woff2":"font/woff2"};



/* Schreibrechte pruefen. Das ist der haeufigste Betriebsfehler:
   Der Container laeuft, aber das gemountete Verzeichnis gehoert
   einem anderen Benutzer — dann schlaegt erst das Speichern fehl. */
function canWrite(){
  try{ fs.accessSync(DATA_DIR, fs.constants.W_OK); return true; }
  catch(e){ return false; }
}

if(!canWrite())
  console.error(`WARNUNG: ${DATA_DIR} ist nicht beschreibbar. Speichern wird fehlschlagen.\n` +
                `         Auf dem Host: sudo chown -R 1000:1000 <datenverzeichnis>`);

/* ═══════════ Anmeldung ═════════════════════════════════════════
   Ohne Fremdbibliotheken: Node bringt mit scrypt und HMAC alles mit,
   was gebraucht wird. Sitzungen liegen nicht auf dem Server, sondern
   im signierten Cookie — das ueberlebt Neustarts, ohne dass eine
   Sitzungstabelle gepflegt werden muss. Damit Abmelden und Sperren
   trotzdem sofort wirken, traegt jeder Benutzer eine sessionVersion,
   die bei solchen Aenderungen hochgezaehlt wird. */

const SESSION_TAGE = 30;
const MIN_PASSWORT = 12;
const MAX_FEHL     = 5;      // danach greift die Sperre

fs.mkdirSync(AUTH_DIR,  {recursive:true});
fs.mkdirSync(USERS_DIR, {recursive:true});

/** Signierschluessel; entsteht beim ersten Start. */
function schluessel(){
  try{ return fs.readFileSync(SECRET_F); }
  catch(e){
    const neu = crypto.randomBytes(32);
    fs.writeFileSync(SECRET_F, neu, {mode:0o600});
    console.log("Signierschlüssel für Sitzungen erzeugt.");
    return neu;
  }
}
const SECRET = schluessel();

function ladeBenutzer(){
  try{ return JSON.parse(fs.readFileSync(USERS_FILE,"utf8")); }
  catch(e){ return []; }
}
function speichereBenutzer(liste){
  const tmp = USERS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(liste, null, 1), {mode:0o600});
  fs.renameSync(tmp, USERS_FILE);
}

/* ---- Passwoerter ---- */
function hashe(passwort, salt){
  return crypto.scryptSync(passwort, salt, 64, {N:16384, r:8, p:1}).toString("hex");
}
function passwortSetzen(benutzer, passwort){
  benutzer.salt = crypto.randomBytes(16).toString("hex");
  benutzer.hash = hashe(passwort, benutzer.salt);
  benutzer.sessionVersion = (benutzer.sessionVersion||0) + 1;   // alte Cookies verfallen
}
function passwortStimmt(benutzer, passwort){
  if(!benutzer || !benutzer.hash) return false;
  const a = Buffer.from(benutzer.hash, "hex");
  const b = Buffer.from(hashe(passwort, benutzer.salt), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---- Sitzungscookie ---- */
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
function signiere(text){
  return crypto.createHmac("sha256", SECRET).update(text).digest("base64url");
}
function baueCookie(benutzer){
  const nutzlast = b64({u:benutzer.id, v:benutzer.sessionVersion||0,
                        exp: Date.now() + SESSION_TAGE*864e5});
  return nutzlast + "." + signiere(nutzlast);
}
function leseCookie(wert){
  if(!wert || wert.indexOf(".") < 0) return null;
  const [nutzlast, sig] = wert.split(".");
  const erwartet = signiere(nutzlast);
  if(sig.length !== erwartet.length) return null;    // sonst wirft timingSafeEqual
  if(!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(erwartet))) return null;
  try{
    const daten = JSON.parse(Buffer.from(nutzlast, "base64url").toString());
    return daten.exp > Date.now() ? daten : null;
  }catch(e){ return null; }
}
function cookieAusKopf(req){
  const roh = req.headers.cookie;
  if(!roh) return null;
  for(const teil of roh.split(";")){
    const [k, ...rest] = teil.trim().split("=");
    if(k === "sid") return rest.join("=");
  }
  return null;
}
function setzeCookie(res, req, wert, tage){
  const sicher = (req.headers["x-forwarded-proto"] === "https") ? "; Secure" : "";
  const alter  = tage > 0 ? `; Max-Age=${Math.round(tage*86400)}` : "; Max-Age=0";
  res.setHeader("Set-Cookie",
    `sid=${wert}; HttpOnly; SameSite=Strict; Path=/${alter}${sicher}`);
}

/** Angemeldeten Benutzer zur Anfrage ermitteln. */
function sitzung(req){
  const daten = leseCookie(cookieAusKopf(req));
  if(!daten) return null;
  const benutzer = ladeBenutzer().find(b => b.id === daten.u);
  if(!benutzer || !benutzer.aktiv) return null;
  if((benutzer.sessionVersion||0) !== daten.v) return null;   // gesperrt oder Passwort geaendert
  return benutzer;
}

/* ---- Schutz gegen Durchprobieren ----
   Zaehler nur im Speicher: ein Neustart setzt ihn zurueck. Hinter dem
   VPN vertretbar; vor einem Gang ins offene Internet waere er zu
   verstetigen. */
const fehlversuche = new Map();
function gesperrtBis(login){
  const e = fehlversuche.get((login||"").toLowerCase());
  return e && e.bis > Date.now() ? e.bis : 0;
}
function merkeFehlversuch(login){
  const k = (login||"").toLowerCase();
  const e = fehlversuche.get(k) || {n:0, bis:0};
  e.n++;
  if(e.n >= MAX_FEHL){
    const minuten = Math.min(60, Math.pow(2, e.n - MAX_FEHL));   // 1, 2, 4 … bis 60
    e.bis = Date.now() + minuten*60000;
  }
  fehlversuche.set(k, e);
}
const vergissFehlversuche = login => fehlversuche.delete((login||"").toLowerCase());

const neueId = praefix => praefix + crypto.randomBytes(6).toString("hex");
const LOGIN_MUSTER = /^[a-z0-9._-]{3,32}$/;

/** Legt ein Konto samt Datenverzeichnis an. */
function benutzerAnlegen({login, name, passwort, rolle}){
  const liste = ladeBenutzer();
  login = (login||"").trim().toLowerCase();
  if(!LOGIN_MUSTER.test(login))
    throw new Error("Anmeldename: 3 bis 32 Zeichen, nur a–z, 0–9, Punkt, Strich");
  if(liste.some(b => b.login === login))
    throw new Error("Diesen Anmeldenamen gibt es bereits");
  if(!passwort || passwort.length < MIN_PASSWORT)
    throw new Error(`Passwort: mindestens ${MIN_PASSWORT} Zeichen`);

  const benutzer = {
    id: neueId("u_"), login, name: (name||login).trim(),
    rolle: rolle === "admin" ? "admin" : "user",
    aktiv: true, sessionVersion: 0,
    angelegt: new Date().toISOString(), letzterZugriff: null
  };
  passwortSetzen(benutzer, passwort);

  const pf = pfade(benutzer.id);
  fs.mkdirSync(pf.versionen, {recursive:true});
  fs.mkdirSync(pf.fotos,     {recursive:true});
  fs.mkdirSync(pf.docs,      {recursive:true});
  if(!fs.existsSync(pf.datei))
    fs.writeFileSync(pf.datei, JSON.stringify({version:4, rev:0, activeId:null, vehicles:[]}, null, 1));

  liste.push(benutzer);
  speichereBenutzer(liste);
  return benutzer;
}

/** Beim Einrichten des ersten Kontos: alles, was bisher direkt im
 *  Datenverzeichnis lag, in dieses Konto verschieben. Verschieben statt
 *  kopieren — die Anleitungen belegen zwanzig Megabyte, die muessen
 *  nicht doppelt liegen. Laeuft nur einmal, weil danach kein data.json
 *  mehr in der Wurzel liegt. */
function bestandUebernehmen(adminId){
  const alt = {
    datei:     path.join(DATA_DIR, "data.json"),
    versionen: path.join(DATA_DIR, "versions"),
    fotos:     path.join(DATA_DIR, "photos"),
    docs:      path.join(DATA_DIR, "docs"),
  };
  if(!fs.existsSync(alt.datei)) return null;

  const ziel = pfade(adminId);
  const bericht = {fahrzeuge:0, anleitungen:0, medien:0, termine:0};
  try{
    // Sicherheitskopie der Stammdaten, bevor irgendetwas bewegt wird
    fs.copyFileSync(alt.datei, path.join(DATA_DIR, "data.json.vor-benutzerverwaltung"));

    for(const [schluessel, quelle] of Object.entries(alt)){
      if(!fs.existsSync(quelle)) continue;
      const nach = ziel[schluessel];
      try{ fs.rmSync(nach, {recursive:true, force:true}); }catch(e){}
      fs.renameSync(quelle, nach);
    }

    const db = readDB(ziel);
    if(db){
      bericht.fahrzeuge = (db.vehicles||[]).length;
      for(const v of db.vehicles||[]){
        bericht.anleitungen += (v.docs||[]).length;
        bericht.termine     += (v.history||[]).length;
      }
    }
    try{ bericht.medien = fs.readdirSync(ziel.fotos).length; }catch(e){}
    console.log(`Bestand übernommen: ${bericht.fahrzeuge} Fahrzeuge, `+
                `${bericht.anleitungen} Anleitungen, ${bericht.termine} Termine.`);
  }catch(e){
    console.error("Übernahme des Bestands fehlgeschlagen:", e.message);
    return null;
  }
  return bericht;
}

/** Normalerweise das eigene Konto. Admins duerfen mit ?as= in ein
 *  fremdes schauen; geprueft wird serverseitig, nicht ueber ein Cookie,
 *  damit sich die Rolle nicht uebernehmen laesst. */
function betrachtetesKonto(req, ich){
  const fremd = new URL(req.url, "http://x").searchParams.get("as");
  if(!fremd || fremd === ich.id) return {id:ich.id, name:ich.name, fremd:false};
  if(ich.rolle !== "admin")      return {id:ich.id, name:ich.name, fremd:false};
  const ziel = ladeBenutzer().find(b => b.id === fremd);
  if(!ziel)                      return {id:ich.id, name:ich.name, fremd:false};
  console.log(`Einblick: ${ich.login} sieht Daten von ${ziel.login}`);
  return {id:ziel.id, name:ziel.name, login:ziel.login, fremd:true};
}

/** Dateien eines Typs über alle Konten zählen — für den Health-Check. */
function zaehleUeberAlle(ordner, muster){
  let n = 0;
  for(const b of ladeBenutzer()){
    try{ n += fs.readdirSync(pfade(b.id)[ordner]).filter(f=>muster.test(f)).length; }
    catch(e){}
  }
  return n;
}

/** Nach aussen sichtbare Felder — Hash und Salt bleiben hier. */
function oeffentlich(b){
  let fahrzeuge = 0, bytes = 0;
  const pf = pfade(b.id);
  try{
    const db = JSON.parse(fs.readFileSync(pf.datei, "utf8"));
    fahrzeuge = (db.vehicles||[]).length;
  }catch(e){}
  for(const ordner of ["fotos","docs"]){
    try{
      for(const f of fs.readdirSync(pf[ordner]))
        bytes += fs.statSync(path.join(pf[ordner], f)).size;
    }catch(e){}
  }
  return {id:b.id, login:b.login, name:b.name, rolle:b.rolle, aktiv:b.aktiv,
          angelegt:b.angelegt, letzterZugriff:b.letzterZugriff, fahrzeuge, bytes};
}

function readDB(pf){
  try { return JSON.parse(fs.readFileSync(pf.datei, "utf8")); }
  catch(e){ return null; }
}

function writeDB(pf, db){
  const prev = readDB(pf);
  if(prev){                                  // alte Fassung wegsichern
    const stamp = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    try{
      fs.mkdirSync(pf.versionen, {recursive:true});
      fs.writeFileSync(path.join(pf.versionen, `data-${stamp}.json`), JSON.stringify(prev));
      const old = fs.readdirSync(pf.versionen).filter(f=>f.endsWith(".json")).sort();
      for(const f of old.slice(0, Math.max(0, old.length - KEEP)))
        fs.unlinkSync(path.join(pf.versionen, f));
    }catch(e){ console.error("Version konnte nicht gesichert werden:", e.message); }
  }
  const tmp = pf.datei + ".tmp";            // atomar schreiben
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, pf.datei);
}

function send(res, code, body, type){
  res.writeHead(code, {"Content-Type": type||"application/json; charset=utf-8",
                       "Cache-Control":"no-store"});
  res.end(body);
}

const server = http.createServer((req,res)=>{
  const url = new URL(req.url, "http://x");
  const p   = decodeURIComponent(url.pathname);

  /* ══════ Anmeldung, Konten, Zugriffsschutz ══════ */

  const koerperLesen = ()=> new Promise((ok, fehler)=>{
    let roh = "";
    req.on("data", c=>{ roh += c; if(roh.length > 1e6) req.destroy(); });
    req.on("end", ()=>{ try{ ok(JSON.parse(roh || "{}")); }catch(e){ fehler(e); } });
    req.on("error", fehler);
  });

  /* Schreibende Aufrufe muessen JSON senden. Ein Formular von fremder
     Seite kann diesen Content-Type nicht setzen, ohne dass der Browser
     vorher um Erlaubnis fragt — zusammen mit SameSite=Strict genuegt
     das gegen untergeschobene Anfragen. */
  const istJson = ()=> (req.headers["content-type"]||"").startsWith("application/json");

  if(p === "/api/login"){
    if(req.method !== "POST") return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
    if(!istJson()) return send(res, 415, JSON.stringify({error:"JSON erwartet"}));
    return koerperLesen().then(async körper=>{
      const login = (körper.login||"").trim().toLowerCase();
      const sperre = gesperrtBis(login);
      if(sperre)
        return send(res, 429, JSON.stringify({
          error:`Zu viele Fehlversuche. Erneut möglich in ${Math.ceil((sperre-Date.now())/60000)} Minuten.`}));

      const benutzer = ladeBenutzer().find(b => b.login === login);
      /* Auch ohne passendes Konto dieselbe Rechenarbeit leisten: sonst
         antwortet der Server bei unbekannten Namen messbar schneller
         und verraet damit, welche Anmeldenamen es gibt. Eine feste
         Wartezeit taugt dafuer nicht — sie trifft die Dauer von scrypt
         nie genau. */
      const gueltig = benutzer
        ? benutzer.aktiv && passwortStimmt(benutzer, körper.passwort||"")
        : (hashe(körper.passwort||"", "00000000000000000000000000000000"), false);

      if(!gueltig){
        merkeFehlversuch(login);
        console.warn(`Fehlgeschlagene Anmeldung: ${login}`);
        return send(res, 401, JSON.stringify({error:"Anmeldename oder Passwort stimmt nicht"}));
      }
      vergissFehlversuche(login);
      const liste = ladeBenutzer();
      const eintrag = liste.find(b => b.id === benutzer.id);
      eintrag.letzterZugriff = new Date().toISOString();
      speichereBenutzer(liste);
      setzeCookie(res, req, baueCookie(benutzer), SESSION_TAGE);
      return send(res, 200, JSON.stringify({ok:true, name:benutzer.name, rolle:benutzer.rolle}));
    }).catch(()=> send(res, 400, JSON.stringify({error:"ungültige Anfrage"})));
  }

  if(p === "/api/logout"){
    setzeCookie(res, req, "", 0);
    return send(res, 200, JSON.stringify({ok:true}));
  }

  /* Ersteinrichtung — nur solange es kein einziges Konto gibt. */
  if(p === "/api/admin/setup"){
    if(ladeBenutzer().length)
      return send(res, 409, JSON.stringify({error:"Es gibt bereits Konten"}));
    if(req.method !== "POST") return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
    if(!istJson()) return send(res, 415, JSON.stringify({error:"JSON erwartet"}));
    return koerperLesen().then(körper=>{
      let admin;
      try{
        admin = benutzerAnlegen({login:körper.login, name:körper.name,
                                 passwort:körper.passwort, rolle:"admin"});
      }catch(e){ return send(res, 400, JSON.stringify({error:e.message})); }
      const uebernommen = bestandUebernehmen(admin.id);
      setzeCookie(res, req, baueCookie(admin), SESSION_TAGE);
      return send(res, 200, JSON.stringify({ok:true, uebernommen}));
    }).catch(()=> send(res, 400, JSON.stringify({error:"ungültige Anfrage"})));
  }

  if(p === "/api/setup-noetig")
    return send(res, 200, JSON.stringify({noetig: ladeBenutzer().length === 0}));

  /* Ab hier ist eine gueltige Sitzung Pflicht. */
  const ich = sitzung(req);
  if(p.startsWith("/api/") && p !== "/api/health"){
    if(!ich) return send(res, 401, JSON.stringify({error:"nicht angemeldet"}));
  }

  if(p === "/api/me"){
    /* Sitzung mitlaufen lassen. Eine App auf dem Startbildschirm, die alle
       30 Tage grundlos zum Anmeldeformular springt, fuehlt sich nicht wie
       eine App an. Diesen Aufruf macht die App bei jedem Start ohnehin —
       ist weniger als die Haelfte der Laufzeit uebrig, bekommt das Cookie
       eine neue Frist. Geprueft wird weiterhin bei jeder Anfrage, und
       sessionVersion sperrt nach wie vor sofort. */
    const daten = leseCookie(cookieAusKopf(req));
    if(daten && daten.exp - Date.now() < SESSION_TAGE*864e5/2)
      setzeCookie(res, req, baueCookie(ich), SESSION_TAGE);

    return send(res, 200, JSON.stringify({
      id:ich.id, name:ich.name, login:ich.login, rolle:ich.rolle,
      betrachtet: betrachtetesKonto(req, ich)
    }));
  }

  /* ---- Kontenverwaltung, nur fuer Admins ---- */
  if(p.startsWith("/api/admin/")){
    if(ich.rolle !== "admin") return send(res, 403, JSON.stringify({error:"nur für Administratoren"}));

    if(p === "/api/admin/users"){
      if(req.method === "GET")
        return send(res, 200, JSON.stringify(ladeBenutzer().map(oeffentlich)));
      if(req.method === "POST"){
        if(!istJson()) return send(res, 415, JSON.stringify({error:"JSON erwartet"}));
        return koerperLesen().then(körper=>{
          try{
            const neu = benutzerAnlegen(körper);
            console.log(`Konto angelegt: ${neu.login} durch ${ich.login}`);
            return send(res, 200, JSON.stringify(oeffentlich(neu)));
          }catch(e){ return send(res, 400, JSON.stringify({error:e.message})); }
        }).catch(()=> send(res, 400, JSON.stringify({error:"ungültige Anfrage"})));
      }
      return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
    }

    const treffer = p.match(/^\/api\/admin\/users\/(u_[a-f0-9]{12})$/);
    if(treffer){
      const zielId = treffer[1];
      const liste  = ladeBenutzer();
      const ziel   = liste.find(b => b.id === zielId);
      if(!ziel) return send(res, 404, JSON.stringify({error:"Konto nicht gefunden"}));

      if(req.method === "PATCH"){
        if(!istJson()) return send(res, 415, JSON.stringify({error:"JSON erwartet"}));
        return koerperLesen().then(körper=>{
          if(körper.name)  ziel.name = String(körper.name).trim();
          if(körper.rolle && ["admin","user"].includes(körper.rolle)){
            // Der letzte Administrator darf sich die Rechte nicht nehmen
            const admins = liste.filter(b => b.rolle === "admin" && b.aktiv);
            if(ziel.rolle === "admin" && körper.rolle !== "admin" && admins.length <= 1)
              return send(res, 400, JSON.stringify({error:"Das ist der letzte Administrator"}));
            ziel.rolle = körper.rolle;
          }
          if(typeof körper.aktiv === "boolean"){
            const admins = liste.filter(b => b.rolle === "admin" && b.aktiv);
            if(!körper.aktiv && ziel.rolle === "admin" && admins.length <= 1)
              return send(res, 400, JSON.stringify({error:"Das ist der letzte Administrator"}));
            ziel.aktiv = körper.aktiv;
            if(!körper.aktiv) ziel.sessionVersion = (ziel.sessionVersion||0)+1;  // sofort aussperren
          }
          if(körper.passwort){
            if(körper.passwort.length < MIN_PASSWORT)
              return send(res, 400, JSON.stringify({error:`Passwort: mindestens ${MIN_PASSWORT} Zeichen`}));
            passwortSetzen(ziel, körper.passwort);
          }
          speichereBenutzer(liste);
          console.log(`Konto geändert: ${ziel.login} durch ${ich.login}`);
          return send(res, 200, JSON.stringify(oeffentlich(ziel)));
        }).catch(()=> send(res, 400, JSON.stringify({error:"ungültige Anfrage"})));
      }

      if(req.method === "DELETE"){
        if(ziel.id === ich.id)
          return send(res, 400, JSON.stringify({error:"Das eigene Konto lässt sich nicht löschen"}));
        const admins = liste.filter(b => b.rolle === "admin" && b.aktiv);
        if(ziel.rolle === "admin" && admins.length <= 1)
          return send(res, 400, JSON.stringify({error:"Das ist der letzte Administrator"}));
        try{ fs.rmSync(pfade(ziel.id).wurzel, {recursive:true, force:true}); }catch(e){}
        speichereBenutzer(liste.filter(b => b.id !== ziel.id));
        console.log(`Konto gelöscht: ${ziel.login} durch ${ich.login}`);
        return send(res, 200, JSON.stringify({ok:true}));
      }
      return send(res, 405, JSON.stringify({error:"Methode nicht erlaubt"}));
    }
    return send(res, 404, JSON.stringify({error:"unbekannt"}));
  }

  /* Welches Konto zeigen die Datenrouten? Normalerweise das eigene;
     ein Admin darf mit ?as= in ein fremdes schauen. */
  const pf = ich ? pfade(betrachtetesKonto(req, ich).id) : null;
  if(p.startsWith("/api/") && p !== "/api/health" && !pf)
    return send(res, 403, JSON.stringify({error:"kein Zugriff"}));

  /* ---- API ---- */
  if(p === "/api/data"){
    if(req.method === "GET"){
      const db = readDB(pf);
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

        const cur  = readDB(pf);
        const curRev = cur ? (cur.rev||0) : 0;
        const sent   = parseInt(req.headers["if-match"] ?? curRev, 10);
        if(cur && sent !== curRev)            // anderes Gerät war schneller
          return send(res, 409, JSON.stringify({error:"Konflikt", rev:curRev}));

        incoming.rev = curRev + 1;
        try{ writeDB(pf, incoming); }
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
      const treffer = findeDatei(pf, id);
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
      const tmp = path.join(pf.fotos, id + ".tmp");
      const weg = ()=>{ try{ fs.unlinkSync(tmp); }catch(e){} };
      return koerperInDatei(req, tmp, grenze, (fehler, wert)=>{
        if(fehler) return send(res, fehler.code, JSON.stringify({error:fehler.text}));
        const typ = erkenneTyp(wert.kopf);
        if(!typ){ weg(); return send(res, 415, JSON.stringify({error:"unbekanntes Dateiformat"})); }
        // Vorschaubilder und Fotos muessen JPEG sein, v_ muss Video sein
        if(istVideo !== typ.mime.startsWith("video/")){
          weg();
          return send(res, 415, JSON.stringify({error:"Dateityp passt nicht zur ID"}));
        }
        try{
          fs.renameSync(tmp, path.join(pf.fotos, id + "." + typ.ext));
        }catch(e){
          console.error(e); weg();
          return send(res, 500, JSON.stringify({error:"Schreibfehler"}));
        }
        send(res, 200, JSON.stringify({ok:true, id, bytes:wert.groesse, typ:typ.mime}));
      });
    }

    if(req.method === "DELETE"){
      let weg = 0;
      for(const basis of [id, id + "_t"])
        for(const ext of Object.keys(EXTS)){
          try{ fs.unlinkSync(path.join(pf.fotos, basis + "." + ext)); weg++; }catch(e){}
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
    const datei = path.join(pf.docs, id + ".pdf");

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
      const tmp = datei + ".tmp";
      const weg = ()=>{ try{ fs.unlinkSync(tmp); }catch(e){} };
      return koerperInDatei(req, tmp, MAX_DOC, (fehler, wert)=>{
        if(fehler) return send(res, fehler.code, JSON.stringify({error:fehler.text}));
        // PDF-Signatur pruefen statt dem Content-Type zu glauben
        if(wert.kopf.length < 5 || wert.kopf.toString("ascii",0,5) !== "%PDF-"){
          weg();
          return send(res, 415, JSON.stringify({error:"kein PDF"}));
        }
        try{ fs.renameSync(tmp, datei); }
        catch(e){
          console.error(e); weg();
          return send(res, 500, JSON.stringify({error:"Schreibfehler"}));
        }
        send(res, 200, JSON.stringify({ok:true, id, bytes:wert.groesse}));
      });
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
    const db = readDB(pf);
    const benutzt = new Set();
    for(const v of (db && db.vehicles) || [])
      // Fotos haengen inzwischen an vielen Stellen — Teile, Reparaturen,
      // Fahrzeugpapiere und das Fahrzeug selbst. Fehlt eine Sammlung hier,
      // loescht das Aufraeumen genau deren Bilder als vermeintlich verwaist.
      for(const liste of [v.tasks||[], v.history||[], v.parts||[],
                          v.repairs||[], v.papiere||[], [v]])
        for(const eintrag of liste)
          for(const id of eintrag.photos || []){ benutzt.add(id); benutzt.add(id + "_t"); }

    let bytes = 0, verwaistBytes = 0;
    const verwaist = [];
    let dateien = [];
    try{ dateien = fs.readdirSync(pf.fotos).filter(f=>/\.(jpg|mp4|mov|webm)$/.test(f)); }catch(e){}
    for(const f of dateien){
      const id = f.replace(/\.(jpg|mp4|mov|webm)$/, "");
      let gr = 0;
      try{ gr = fs.statSync(path.join(pf.fotos, f)).size; }catch(e){}
      bytes += gr;
      if(!benutzt.has(id)){ verwaist.push(id); verwaistBytes += gr; }
    }

    if(req.method === "DELETE"){            // aufraeumen
      let weg = 0;
      for(const id of verwaist){
        for(const ext of Object.keys(EXTS)){
          try{ fs.unlinkSync(path.join(pf.fotos, id + "." + ext)); weg++; break; }catch(e){}
        }
      }
      return send(res, 200, JSON.stringify({ok:true, geloescht:weg, bytes:verwaistBytes}));
    }
    let docDateien = [], docBytes = 0;
    try{
      docDateien = fs.readdirSync(pf.docs).filter(f=>f.endsWith(".pdf"));
      for(const f of docDateien){
        try{ docBytes += fs.statSync(path.join(pf.docs,f)).size; }catch(e){}
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
      benutzer:    ladeBenutzer().length,
      medien:      zaehleUeberAlle("fotos", /\.(jpg|mp4|mov|webm)$/),
      anleitungen: zaehleUeberAlle("docs",  /\.pdf$/),
      laufzeit:  Math.round(process.uptime()) + "s"
    }));
  }

  /* ---- statische Dateien ----
     Anmeldeseite, Symbole und Manifest sind frei; die App selbst und
     die Verwaltung setzen eine Sitzung voraus. */
  const frei = ["/login", "/login.html", "/manifest.json", "/sw.js",
                "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
  const istSeite = p === "/" || p === "/index.html" || p === "/admin" || p === "/admin.html";

  if(istSeite && !frei.includes(p)){
    const keineKonten = ladeBenutzer().length === 0;
    const adminSeite  = p === "/admin" || p === "/admin.html";

    // Ohne jedes Konto fuehrt jeder Weg zur Ersteinrichtung
    if(keineKonten && !adminSeite){
      res.writeHead(302, {"Location":"/admin"});
      return res.end();
    }
    if(!keineKonten && !ich){
      res.writeHead(302, {"Location":"/login"});
      return res.end();
    }
    if(adminSeite && !keineKonten && ich.rolle !== "admin")
      return send(res, 403, "Nur für Administratoren.", "text/plain; charset=utf-8");
  }

  const datei = p === "/"      ? "/index.html"
              : p === "/login" ? "/login.html"
              : p === "/admin" ? "/admin.html"
              : p;
  const file = path.resolve(PUBLIC, "." + datei);
  if(file !== PUBLIC && !file.startsWith(PUBLIC + path.sep))
    return send(res, 403, "verboten", "text/plain");
  fs.readFile(file, (err, buf)=>{
    if(err) return send(res, 404, "nicht gefunden", "text/plain");
    // Das Manifest heisst .json, gehoert aber als application/manifest+json
    // ausgeliefert — sonst meckert Chrome beim Installieren.
    const type = datei === "/manifest.json" ? "application/manifest+json"
               : MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {"Content-Type":type, "Cache-Control": p==="/"||p.endsWith(".html") ? "no-cache" : "max-age=3600"});
    res.end(buf);
  });
});

server.listen(PORT, ()=>{
  console.log(`carservice läuft auf Port ${PORT}, Daten in ${DATA_DIR}`);
  const konten = ladeBenutzer();
  if(!konten.length)
    console.log("Noch kein Konto vorhanden — Ersteinrichtung unter /admin aufrufen.");
  else
    console.log(`${konten.length} Konto/Konten, davon ${konten.filter(b=>b.rolle==="admin").length} mit Verwaltungsrechten.`);
});
