#!/usr/bin/env python3
"""Excel-Inspektionstabelle -> data/data.json

Werkzeug fuer den Umstieg von einer gewachsenen Excel-Liste. Die Tabelle
selbst gehoert nicht ins Repository (sie enthaelt Fahrzeugdaten) - lege
sie neben dieses Skript oder gib den Pfad als erstes Argument an.

Liest die gewachsene Excel-Liste ein und verteilt ihren Inhalt auf das
Datenmodell der App: Historie, Teilekatalog (inkl. der bereits in der
Notizspalte gesammelten Produkte und Kauflinks) und Umbauten.
Idempotent: kann nach Ergaenzungen in der Excel erneut laufen.
"""
import zipfile, re, datetime, json, os, sys
from xml.etree import ElementTree as ET

M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS = {'m': M}
_args = [a for a in sys.argv[1:] if not a.startswith('--')]
SRC = _args[0] if len(_args) > 0 else 'Inspektionstabelle.xlsx'
OUT = _args[1] if len(_args) > 1 else 'data/data.json'

def read_rows(path):
    z = zipfile.ZipFile(path)
    ss = [''.join(t.text or '' for t in si.iter('{%s}t' % M))
          for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    def colnum(ref):
        n = 0
        for ch in re.match(r'[A-Z]+', ref).group(0): n = n*26 + ord(ch)-64
        return n-1
    rows = []
    for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).iter('{%s}row' % M):
        cells = {}
        for c in row.findall('m:c', NS):
            t, v = c.get('t'), c.find('m:v', NS)
            if t == 'inlineStr':
                isn = c.find('m:is', NS)
                val = ''.join(x.text or '' for x in isn.iter('{%s}t' % M)) if isn is not None else ''
            elif v is None: continue
            elif t == 's': val = ss[int(v.text)]
            elif t == 'str': val = v.text
            else:
                try:
                    f = float(v.text); val = int(f) if f == int(f) else f
                except Exception: val = v.text
            cells[colnum(c.get('r'))] = val
        if cells: rows.append([cells.get(i, '') for i in range(7)])
    return rows[1:]                      # Kopfzeile weg

def serial(n):
    """Excel-Serienzahl (Spalte A) -> ISO-Datum."""
    return (datetime.date(1899,12,30) + datetime.timedelta(days=int(n))).isoformat()

# ── Wartungsarbeit aus der Excel -> Position im Wartungsplan ─────────
MAP = [
    (r'motoröl',                     't1'),
    (r'pollenfilter|innenraum|aktivkohle', 't2'),
    (r'luftfilter',                  't3'),
    (r'inline',                      't23'),   # nachgeruesteter Vorfilter
    (r'kraftstoff|dieselfilter',     't4'),
    (r'bremsflüssigkeit',            't5'),
    (r'differentialöl.*vorne',       't9'),
    (r'differentialöl.*hinten',      't10'),
    (r'kardan|kreuzgelenk|abschmier','t13'),
]
def map_task(text):
    t = (text or '').lower()
    for pat, tid in MAP:
        if re.search(pat, t): return tid
    return None

URL = re.compile(r'https?://\S+')

def build():
    rows = read_rows(SRC)
    events, mods, links_by_task = {}, [], {}

    for date_s, km, work, note, colE, colF, partno in rows:
        if not date_s and not km: continue
        date = serial(date_s) if isinstance(date_s, (int, float)) and date_s > 1000 else str(date_s)
        km   = int(km) if isinstance(km, (int, float)) else None
        work, note, partno = str(work).strip(), str(note).strip(), str(partno).strip()

        # Links stehen mal in der Notiz-, mal in der Folgespalte
        found = URL.findall(note) + URL.findall(str(colE))
        clean_note = URL.sub('', note).strip(' |–-')

        # Umbauten sind keine Wartung
        if re.search(r'verbaut|schnorchel|eingebaut', work, re.I):
            mods.append({"id": "m_" + date.replace('-', ''), "name": work.replace(' verbaut', ''),
                         "cat": "Aufbau", "brand": "", "date": date, "km": km,
                         "cost": None, "links": [{"label": "Quelle", "url": u} for u in found],
                         "note": clean_note, "photos": []})
            continue

        tid = map_task(work)
        ev = events.setdefault(date, {"id": "h_" + date.replace('-', ''), "date": date, "km": km,
                                      "taskIds": [], "title": [], "cost": None, "note": [],
                                      "photos": []})
        if km and not ev["km"]: ev["km"] = km
        if tid and tid not in ev["taskIds"]: ev["taskIds"].append(tid)
        if not tid: ev["title"].append(work)
        detail = ' · '.join(x for x in (work if tid else '', clean_note, partno) if x)
        if detail: ev["note"].append(detail)
        if tid:
            links_by_task.setdefault(tid, []).extend(found)

    history = []
    for ev in sorted(events.values(), key=lambda e: e["date"]):
        ev["title"] = ', '.join(ev["title"])
        ev["note"]  = '\n'.join(ev["note"])
        history.append(ev)
    return history, mods, links_by_task

# ── Zusammenbauen ───────────────────────────────────────────────────
import seed_catalog as cat

hist, mods, links = build()
cur_km   = max([h["km"] for h in hist if h["km"]] + [0])
cur_date = max(h["date"] for h in hist)

tasks = [dict(t) for t in cat.TASKS]
parts = [dict(p) for p in cat.PARTS]

# In der Excel gefundene Kauflinks den Teilen der jeweiligen Position zuordnen
by_id = {p["id"]: p for p in parts}
for tid, urls in links.items():
    tk = next((t for t in tasks if t["id"] == tid), None)
    if not tk: continue
    for u in set(urls):
        for ref in tk["parts"]:
            p = by_id.get(ref["p"])
            if p is not None and not any(l["url"] == u for l in p["links"]):
                p["links"].append({"label": "eBay", "url": u})
                break

vehicle = {
    "id": "v_hilux",
    "brand": "Toyota", "name": "Hilux Extra Cab",
    "model": "2.8 D-4D, Automatik, 4x4", "year": 2023,
    "vin": "", "plate": "", "built": "", "firstReg": "2023-01-01",
    "km": cur_km, "kmDate": cur_date, "note": "", "owner": "",
    "fuel": "diesel", "gearbox": "automatik", "drive": "4x4",
    "tasks": tasks, "parts": parts, "history": hist, "mods": mods,
}
db = {"version": 3, "rev": 0, "activeId": vehicle["id"], "vehicles": [vehicle]}

if os.path.exists(OUT) and "--force" not in sys.argv:
    sys.exit("%s existiert bereits. Mit --force ueberschreiben (loescht Aenderungen aus der App!)." % OUT)
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
json.dump(db, open(OUT, "w"), ensure_ascii=False, indent=1)

span_km = cur_km - min(h["km"] for h in hist if h["km"])
span_d  = (datetime.date.fromisoformat(cur_date) - datetime.date.fromisoformat(min(h["date"] for h in hist))).days
print("geschrieben: %s" % OUT)
print("  %d Service-Termine, %d Wartungspositionen, %d Teile, %d Umbauten"
      % (len(hist), len(tasks), len(parts), len(mods)))
print("  Stand %s km am %s — Fahrleistung %.0f km/Tag (~%.0f km/Jahr)"
      % (format(cur_km, ',d').replace(',', '.'), cur_date, span_km/span_d, span_km/span_d*365))
