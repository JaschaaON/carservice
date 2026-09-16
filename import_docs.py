#!/usr/bin/env python3
"""Werkstattunterlagen (PDF) einlesen und Wartungspositionen zuordnen.

    python3 import_docs.py "Toyota Anleitungen"

Kopiert die PDFs nach data/docs/, ermittelt Seitenzahlen und schlaegt
anhand der Dateinamen eine Zuordnung zu den vorhandenen Positionen vor.
Die Dokumente selbst gehoeren nicht ins Repository — sie sind
urheberrechtlich geschuetzt und per .gitignore ausgeschlossen.
"""
import json, os, re, shutil, sys, hashlib, unicodedata

DATA = "data/data.json"
ZIEL = "data/docs"

# ── Zuordnung: Stichwort im Dateinamen -> Positionsname ──────────────
# Erster Treffer gewinnt; mehrere Positionen je Dokument sind moeglich.
REGELN = [
    (r"motoröl|motoroel|ölwechsel|oelwechsel",      ["Motoröl + Ölfilter"]),
    (r"hinterachsdiff|differential.*hinten",         ["Differentialöl hinten"]),
    (r"differ?ntial|differential",                   ["Differentialöl vorne", "Differentialöl hinten"]),
    (r"schmierung",                                  ["Kardanwelle abschmieren"]),
    (r"bremse.*vorne|drehmoment bremse vorne",       ["Bremsen prüfen (Beläge/Backen)"]),
    (r"bremse.*hinten",                              ["Bremsen prüfen (Beläge/Backen)"]),
    (r"feststellbremse",                             ["Bremsen prüfen (Beläge/Backen)"]),
    (r"bremse|bremssystem",                          ["Bremsflüssigkeit wechseln", "Bremsen prüfen (Beläge/Backen)"]),
    (r"reifen|\brad\b|radnabe",                      ["Räder tauschen / Reifen prüfen"]),
    (r"batterie",                                    ["Batterie prüfen"]),
    (r"stossdämpfer|stoßdämpfer|blattfeder|fahrwerk",["Fahrwerk + Achsmanschetten prüfen"]),
    (r"luftfilter",                                  ["Sportluftfilter reinigen + ölen"]),
    (r"karosserie",                                  ["Unterboden / Rostvorsorge"]),
    (r"fahrzeugwartung motorraum|motor allgemeine",  ["Motoröl + Ölfilter"]),
    (r"achse und differential",                      ["Differentialöl vorne", "Differentialöl hinten"]),
]

def seitenzahl(pfad):
    roh = open(pfad, "rb").read()
    n = len(re.findall(rb"/Type\s*/Page[^s]", roh))
    if n == 0:
        treffer = re.findall(rb"/Count\s+(\d+)", roh)
        n = max((int(x) for x in treffer), default=0)
    return n

def nfc(text):
    """macOS legt Dateinamen zerlegt ab ("o" + Umlautpunkte). Ohne
    Normalisierung trifft kein Suchmuster mit echtem Umlaut."""
    return unicodedata.normalize("NFC", text)

def doc_id(name):
    return "d_" + hashlib.sha1(nfc(name).encode()).hexdigest()[:12]

def passende_positionen(dateiname, positionen):
    klein = nfc(dateiname).lower()
    namen = []
    for muster, ziele in REGELN:
        if re.search(muster, klein):
            namen = ziele
            break
    treffer = []
    for n in namen:
        t = next((t for t in positionen if t["name"] == n), None)
        if t and t["id"] not in treffer:
            treffer.append(t["id"])
    return treffer

def main():
    quelle = sys.argv[1] if len(sys.argv) > 1 else "Toyota Anleitungen"
    if not os.path.isdir(quelle):
        sys.exit(f"Verzeichnis nicht gefunden: {quelle}")
    if not os.path.exists(DATA):
        sys.exit(f"{DATA} fehlt — zuerst die Fahrzeugdaten anlegen.")

    db = json.load(open(DATA))
    fahrzeug = next((v for v in db["vehicles"] if v["id"] == db.get("activeId")), db["vehicles"][0])
    fahrzeug.setdefault("docs", [])
    for t in fahrzeug["tasks"]:
        t.setdefault("docs", [])
    os.makedirs(ZIEL, exist_ok=True)

    vorhanden = {d["id"] for d in fahrzeug["docs"]}
    neu = zugeordnet = 0

    for datei in sorted(os.listdir(quelle)):
        if not datei.lower().endswith(".pdf"):
            continue
        pfad = os.path.join(quelle, datei)
        name = nfc(os.path.splitext(datei)[0])
        did  = doc_id(datei)

        shutil.copy2(pfad, os.path.join(ZIEL, did + ".pdf"))
        if did in vorhanden:
            eintrag = next(d for d in fahrzeug["docs"] if d["id"] == did)
        else:
            eintrag = {"id": did, "name": name, "seiten": seitenzahl(pfad),
                       "bytes": os.path.getsize(pfad), "note": ""}
            fahrzeug["docs"].append(eintrag)
            neu += 1

        for tid in passende_positionen(name, fahrzeug["tasks"]):
            t = next(t for t in fahrzeug["tasks"] if t["id"] == tid)
            if not any(x.get("d") == did for x in t["docs"]):
                t["docs"].append({"d": did})
                zugeordnet += 1

    db["version"] = max(db.get("version", 3), 4)
    json.dump(db, open(DATA, "w"), ensure_ascii=False, indent=1)

    gesamt = sum(d["bytes"] for d in fahrzeug["docs"])
    print(f"{neu} Anleitungen neu, {len(fahrzeug['docs'])} insgesamt "
          f"({gesamt/1048576:.1f} MB, {sum(d['seiten'] for d in fahrzeug['docs'])} Seiten)")
    print(f"{zugeordnet} Zuordnungen zu Wartungspositionen angelegt\n")
    for t in fahrzeug["tasks"]:
        if t["docs"]:
            titel = [next(d["name"] for d in fahrzeug["docs"] if d["id"] == x["d"]) for x in t["docs"]]
            print(f"  {t['name']}")
            for n in titel:
                print(f"      · {n}")
    ohne = [d["name"] for d in fahrzeug["docs"]
            if not any(any(x.get("d") == d["id"] for x in t["docs"]) for t in fahrzeug["tasks"])]
    if ohne:
        print(f"\n  {len(ohne)} ohne Zuordnung (in der App nachtragbar):")
        for n in ohne[:8]:
            print(f"      · {n}")
        if len(ohne) > 8:
            print(f"      … und {len(ohne)-8} weitere")

main()
