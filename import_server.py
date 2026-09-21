#!/usr/bin/env python3
"""Werkstattunterlagen (PDF) in die laufende App importieren.

    python3 import_server.py ~/Downloads/Hilux_GUN126_1GD-FTV_Werkstatthandbuch \
        --server https://service.villalife.de --benutzer jaschaaon --probe

Warum nicht import_docs.py? Das schreibt in ein lokales data/data.json.
Seit es Benutzerkonten gibt, liegen die echten Daten auf dem Server unter
data/users/<id>/ — ein lokaler Lauf schriebe in eine Datei, die niemand
liest. Dieses Skript geht deshalb ueber die API: anmelden, jede PDF
hochladen, Anleitungen eintragen, Zuordnungen vorschlagen.

Die PDF bleiben, wo sie sind. Sie wandern nie ins Repository.

Nur Bordmittel — urllib und json, keine Abhaengigkeiten.
"""
import argparse, getpass, json, os, sys, hashlib
import urllib.request, urllib.error, http.cookiejar

from import_docs import REGELN, seitenzahl, nfc, passende_positionen   # dieselben Regeln


def doc_id(rel_pfad):
    """Aus dem Pfad, nicht nur dem Dateinamen — sonst kollidieren zwei
    gleichnamige Dateien aus verschiedenen Unterordnern."""
    return "d_" + hashlib.sha1(nfc(rel_pfad).encode()).hexdigest()[:12]


def anzeigename(rel_pfad):
    ohne = os.path.splitext(rel_pfad)[0]
    return nfc(ohne.replace(os.sep, " · "))


class Client:
    def __init__(self, basis):
        self.basis = basis.rstrip("/")
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def _ruf(self, pfad, daten=None, typ=None, methode=None, kopf=None):
        req = urllib.request.Request(self.basis + pfad, data=daten, method=methode)
        if typ: req.add_header("Content-Type", typ)
        for k, v in (kopf or {}).items():
            req.add_header(k, v)
        try:
            with self.opener.open(req, timeout=120) as antwort:
                roh = antwort.read()
                return antwort.status, (json.loads(roh) if roh[:1] in (b"{", b"[") else roh)
        except urllib.error.HTTPError as e:
            roh = e.read()
            try:    return e.code, json.loads(roh)
            except Exception: return e.code, roh.decode("utf-8", "replace")

    def anmelden(self, login, passwort):
        code, antwort = self._ruf("/api/login",
            json.dumps({"login": login, "passwort": passwort}).encode(),
            "application/json", "POST")
        if code != 200:
            sys.exit(f"Anmeldung fehlgeschlagen ({code}): {antwort}")

    def daten(self):
        code, db = self._ruf("/api/data")
        if code != 200: sys.exit(f"Daten nicht lesbar ({code}): {db}")
        return db

    def pdf_hoch(self, did, pfad):
        with open(pfad, "rb") as f:
            code, antwort = self._ruf("/api/docs/" + did, f.read(), "application/pdf", "PUT")
        return code, antwort

    def daten_schreiben(self, db, rev):
        return self._ruf("/api/data", json.dumps(db, ensure_ascii=False).encode(),
                         "application/json", "PUT", {"If-Match": str(rev)})


def pdfs(ordner):
    """Auch Unterordner — ein Werkstatthandbuch ist selten flach."""
    raus = []
    for wurzel, _, dateien in os.walk(ordner):
        for d in sorted(dateien):
            if d.lower().endswith(".pdf") and not d.startswith("."):
                voll = os.path.join(wurzel, d)
                raus.append((os.path.relpath(voll, ordner), voll))
    return sorted(raus)


def main():
    p = argparse.ArgumentParser(description="PDF als Anleitungen in die App importieren.")
    p.add_argument("ordner", help="Verzeichnis mit den PDF")
    p.add_argument("--server", default="https://service.villalife.de")
    p.add_argument("--benutzer", required=True, help="Anmeldename in der App")
    p.add_argument("--fahrzeug", help="Name des Fahrzeugs (sonst das aktive)")
    p.add_argument("--probe", action="store_true",
                   help="nur zeigen, was passieren wuerde — nichts aendern")
    a = p.parse_args()

    if not os.path.isdir(a.ordner):
        sys.exit(f"Verzeichnis nicht gefunden: {a.ordner}")
    dateien = pdfs(a.ordner)
    if not dateien:
        sys.exit(f"Keine PDF in {a.ordner}")

    c = Client(a.server)
    c.anmelden(a.benutzer, getpass.getpass(f"Passwort für {a.benutzer}: "))

    db = c.daten()
    rev = db.get("rev", 0)
    fahrzeuge = db.get("vehicles", [])
    if a.fahrzeug:
        fz = next((v for v in fahrzeuge if a.fahrzeug.lower() in
                   (v.get("brand","") + " " + v.get("name","")).lower()), None)
        if not fz: sys.exit(f"Kein Fahrzeug passt auf „{a.fahrzeug}“: "
                            + ", ".join(v.get("name","?") for v in fahrzeuge))
    else:
        fz = next((v for v in fahrzeuge if v["id"] == db.get("activeId")), fahrzeuge[0])

    fz.setdefault("docs", [])
    for t in fz.get("tasks", []): t.setdefault("docs", [])
    vorhanden = {d["id"] for d in fz["docs"]}

    titel = " ".join(x for x in [fz.get("brand"), fz.get("name")] if x)
    print(f"Fahrzeug: {titel} — {len(fz['docs'])} Anleitungen bisher")
    print(f"Gefunden: {len(dateien)} PDF in {a.ordner}\n")

    neu = uebersprungen = zugeordnet = 0
    fehler = []

    for rel, voll in dateien:
        did  = doc_id(rel)
        name = anzeigename(rel)
        if did in vorhanden:
            uebersprungen += 1
            continue

        groesse = os.path.getsize(voll)
        ziele   = passende_positionen(name, fz["tasks"])
        zunamen = [next(t["name"] for t in fz["tasks"] if t["id"] == z) for z in ziele]

        if a.probe:
            print(f"  + {name}  ({groesse/1048576:.1f} MB)"
                  + (f"  →  {', '.join(zunamen)}" if zunamen else "  →  ohne Zuordnung"))
            neu += 1; zugeordnet += len(ziele)
            continue

        code, antwort = c.pdf_hoch(did, voll)
        if code != 200:
            fehler.append(f"{rel}: HTTP {code} {antwort}")
            continue

        fz["docs"].append({"id": did, "name": name, "seiten": seitenzahl(voll),
                           "bytes": groesse, "note": ""})
        neu += 1
        for tid in ziele:
            t = next(t for t in fz["tasks"] if t["id"] == tid)
            if not any(x.get("d") == did for x in t["docs"]):
                t["docs"].append({"d": did}); zugeordnet += 1
        print(f"  + {name}" + (f"  →  {', '.join(zunamen)}" if zunamen else ""))

    if a.probe:
        print(f"\nProbelauf: {neu} neu, {uebersprungen} schon vorhanden, "
              f"{zugeordnet} Zuordnungen. Nichts geaendert.")
        return

    if neu:
        code, antwort = c.daten_schreiben(db, rev)
        if code == 409:
            sys.exit("\nKonflikt: Jemand hat die Daten waehrend des Imports geaendert. "
                     "Die PDF liegen bereits auf dem Server — einfach neu starten, "
                     "schon vorhandene werden uebersprungen.")
        if code != 200:
            sys.exit(f"\nSchreiben fehlgeschlagen ({code}): {antwort}")

    print(f"\n{neu} Anleitungen neu, {uebersprungen} schon vorhanden, "
          f"{zugeordnet} Zuordnungen, {len(fz['docs'])} insgesamt.")
    for f in fehler:
        print("  ! " + f, file=sys.stderr)


if __name__ == "__main__":
    main()
