#!/usr/bin/env python3
"""Wartungsplan eines Fahrzeugs als Text ausgeben.

Nuetzlich, wenn man den Plan nicht durchklicken, sondern vergleichen will —
etwa gegen einen Herstellerplan. Gibt nichts preis, was ueber die Positionen
hinausgeht: keine Historie, keine Papiere, keine Fotos.

    python3 plan_zeigen.py --benutzer <name> [--fahrzeug <name>] [--csv]
"""
import argparse
import getpass
import sys

from import_server import Client


def intervall(t):
    """Die eine Spalte, um die es geht: wonach faellt die Position an?"""
    km, mo = t.get("km"), t.get("mo")
    teile = []
    if km: teile.append(f"{km:,}".replace(",", ".") + " km")
    if mo: teile.append(f"{mo} Mon.")
    if not teile: return "— kein Intervall"
    return " / ".join(teile)


def main():
    p = argparse.ArgumentParser(description="Wartungsplan als Text ausgeben.")
    p.add_argument("--server", default="https://service.villalife.de")
    p.add_argument("--benutzer", required=True, help="Anmeldename in der App")
    p.add_argument("--fahrzeug", help="Name des Fahrzeugs (sonst das aktive)")
    p.add_argument("--csv", action="store_true",
                   help="als CSV ausgeben statt als Tabelle")
    a = p.parse_args()

    c = Client(a.server)
    c.anmelden(a.benutzer, getpass.getpass(f"Passwort für {a.benutzer}: "))

    db = c.daten()
    fahrzeuge = db.get("vehicles", [])
    if not fahrzeuge:
        sys.exit("Kein Fahrzeug vorhanden.")
    if a.fahrzeug:
        fz = next((v for v in fahrzeuge if a.fahrzeug.lower() in
                   (v.get("brand", "") + " " + v.get("name", "")).lower()), None)
        if not fz:
            sys.exit(f"Kein Fahrzeug passt auf „{a.fahrzeug}“: "
                     + ", ".join(v.get("name", "?") for v in fahrzeuge))
    else:
        fz = next((v for v in fahrzeuge if v["id"] == db.get("activeId")), fahrzeuge[0])

    aufgaben = fz.get("tasks", [])
    titel = " ".join(x for x in [fz.get("brand"), fz.get("name")] if x)

    if a.csv:
        print("Kategorie;Position;Intervall km;Intervall Monate;aktiv")
        for t in aufgaben:
            print(";".join([t.get("cat", ""), t.get("name", ""),
                            str(t.get("km") or ""), str(t.get("mo") or ""),
                            "ja" if t.get("active") else "nein"]))
        return

    print(f"\n{titel} — {len(aufgaben)} Positionen\n")
    nach_kategorie = {}
    for t in aufgaben:
        nach_kategorie.setdefault(t.get("cat", "Ohne Kategorie"), []).append(t)

    breite = max((len(t.get("name", "")) for t in aufgaben), default=20)
    for kat in sorted(nach_kategorie):
        print(f"  {kat}")
        for t in sorted(nach_kategorie[kat], key=lambda x: x.get("name", "")):
            ruht = "" if t.get("active") else "   (inaktiv)"
            print(f"    {t.get('name',''):<{breite}}  {intervall(t)}{ruht}")
        print()

    ohne = [t for t in aufgaben if not t.get("km") and not t.get("mo")]
    if ohne:
        print(f"  {len(ohne)} Position(en) ohne Intervall — werden nie faellig.")


if __name__ == "__main__":
    main()
