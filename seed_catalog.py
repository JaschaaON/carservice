# -*- coding: utf-8 -*-
"""Wartungsplan und Teilekatalog als Startvorlage.

Ausgelegt auf einen Toyota Hilux mit 1GD-FTV (2.8 D-4D). Die Intervalle
folgen dem ueblichen Serviceplan und sind in der App jederzeit aenderbar.
Teilenummern sind als Beispiel hinterlegt und unbedingt gegen die eigene
Fahrgestellnummer zu pruefen; Kauflinks traegt jeder selbst ein.
"""
PRUEF = "Intervall gegen dein Serviceheft pruefen."

def part(id, name, unit="Stück", oem="", note="", price=None, spare=False, links=None):
    return {"id": id, "name": name, "oem": oem, "unit": unit, "price": price,
            "qty": 0, "spare": spare, "links": links or [], "note": note}

PARTS = [
    part("p1", "Motoröl LIQUI MOLY Top Tec 4300 5W-30", "Liter", "3741",
         "Füllmenge ca. 7,5 l inkl. Filter — ein 5-l-Gebinde reicht nicht ganz.", spare=False),
    part("p2", "Ölfilter Toyota Original", oem="",
         note="Teilenummer beim ersten Kauf eintragen — dann passt sie zur eigenen FIN.", spare=True),
    part("p3", "Dichtring Ölablassschraube", note="Immer mit erneuern.", spare=True),
    part("p4", "Innenraumfilter Aktivkohle", oem="87139YZZ34",
         note="Aktivkohle-Variante empfehlenswert.", spare=True),
    part("p5", "Sportluftfilter Pipercross", oem="17801YZZAD (Original-Papierfilter)",
         note="Waschbar — wird gereinigt und geölt statt ersetzt. Reinigungsset separat vorhalten."),
    part("p5b", "Luftfilter-Reinigungsset", "Set", note="Reiniger und Filteröl für den Pipercross.", spare=False),
    part("p6", "Kraftstofffilter (Hauptfilter)", spare=True),
    part("p6b", "Diesel-Inline-Vorfilter BOSCH", oem="F 026 402 401",
         note="Zusätzlicher Vorfilter — sinnvoll bei unsicherer Dieselqualität.", spare=True),
    part("p7", "Bremsflüssigkeit LIQUI MOLY DOT 4", "Liter", note="1-l-Gebinde genügt für einen Komplettwechsel."),
    part("p8", "Kühlmittel Toyota SLLC (pink)", "Liter", note="Nur Toyota Super Long Life — nicht mischen."),
    part("p9", "Automatikgetriebeöl ATF", "Liter", note="Spezifikation gegen Handbuch prüfen."),
    part("p10", "Differentialöl TRIAX DTF-2 75W-85 GL-5", "Liter", oem="888581110",
         note="Vollsynthetisch, für Sperrdifferentiale geeignet."),
    part("p11", "Verteilergetriebeöl", "Liter"),
    part("p12", "Bremsbeläge vorne", spare=False),
    part("p13", "Bremsbacken hinten", note="Hinten Trommelbremse."),
    part("p14", "Bremsscheiben vorne"),
    part("p15", "Wischerblätter (Satz)"),
    part("p16", "Starterbatterie"),
    part("p17", "LIQUI MOLY Mehrzweckfett Lithium", "Kartusche", oem="3552",
         note="400 g, farblos. Für die Kreuzgelenke der Kardanwelle.", spare=True),
    part("p18", "AdBlue / DEF", "Liter"),
]

def task(id, name, cat, km=None, mo=None, parts=None, note="", active=True):
    return {"id": id, "name": name, "cat": cat, "km": km, "mo": mo,
            "parts": [{"p": p, "q": q} for p, q in (parts or [])],
            "note": note, "active": active, "lastKm": None, "lastDate": None}

TASKS = [
    task("t1", "Motoröl + Ölfilter", "Motor", 15000, 12,
         [("p1", 7.5), ("p2", 1), ("p3", 1)], "Der wichtigste Service."),
    task("t2", "Innenraumfilter", "Komfort", 15000, 12, [("p4", 1)]),
    task("t3", "Sportluftfilter reinigen + ölen", "Motor", 15000, 12, [("p5b", 1)],
         "Pipercross ist waschbar. Nach staubigen Etappen sofort prüfen, nicht nach Kilometern."),
    task("t4", "Kraftstofffilter (Hauptfilter)", "Motor", 30000, 24, [("p6", 1)],
         "Nach dem Wechsel entlüften. " + PRUEF),
    task("t23", "Diesel-Inline-Vorfilter", "Motor", 30000, 24, [("p6b", 1)],
         "Nachgerüsteter Vorfilter. Bei schlechtem Diesel unterwegs deutlich früher."),
    task("t5", "Bremsflüssigkeit wechseln", "Bremsen", None, 12, [("p7", 1)],
         "Hier jährlich statt der ab Werk vorgesehenen 3 Jahre — konservativ, aber bei Wasserdurchfahrten sinnvoll."),
    task("t6", "Kühlmittel wechseln", "Motor", 160000, 120, [("p8", 8)],
         "Erstbefüllung hält sehr lange, danach kürzer. " + PRUEF),
    task("t7", "Automatikgetriebeöl", "Antrieb", 60000, None, [("p9", 4)],
         "Toyota gibt es als Lifetime-Füllung an. Bei Anhängelast, Hitze und Offroad trotzdem sinnvoll."),
    task("t8", "Verteilergetriebeöl", "Antrieb", 40000, 48, [("p11", 1.5)]),
    task("t9", "Differentialöl vorne", "Antrieb", 40000, 48, [("p10", 1.5)]),
    task("t10", "Differentialöl hinten", "Antrieb", 40000, 48, [("p10", 2.5)],
         "Nach Wasserdurchfahrten auf milchiges Öl prüfen."),
    task("t11", "Bremsen prüfen (Beläge/Backen)", "Bremsen", 15000, 12, [],
         "Sichtprüfung. Verschleißteile bei Bedarf als eigenen Eintrag erfassen."),
    task("t12", "Räder tauschen / Reifen prüfen", "Reifen", 10000, None, [],
         "Profiltiefe, Luftdruck, ungleichmäßiger Verschleiß."),
    task("t13", "Kardanwelle abschmieren", "Antrieb", 10000, 6, [("p17", 1)],
         "5 Schmiernippel. Nach Wasser und Staub deutlich früher."),
    task("t14", "Wischerblätter", "Komfort", None, 12, [("p15", 1)]),
    task("t15", "Batterie prüfen", "Elektrik", None, 12, [], "Ruhespannung und Pole."),
    task("t16", "Klimaanlage Service", "Komfort", None, 24, []),
    task("t17", "Keilrippenriemen prüfen", "Motor", 30000, 24, [], "Risse und Spannung."),
    task("t18", "Unterboden / Rostvorsorge", "Karosserie", None, 12, [],
         "Nach Salz oder Salzwasser gründlich spülen und konservieren."),
    task("t19", "Fahrwerk + Achsmanschetten prüfen", "Fahrwerk", 15000, 12, [],
         "Manschetten, Buchsen, Stoßdämpfer, Schraubenanzug."),
    task("t20", "Radlager prüfen", "Fahrwerk", 40000, None, []),
    task("t21", "Ventilspiel prüfen", "Motor", 150000, None, [], "Langfristposition. " + PRUEF),
    task("t22", "AdBlue nachfüllen", "Motor", 10000, None, [("p18", 10)],
         "Verbrauchsabhängig — die Warnmeldung im Display zählt."),
]
