#!/usr/bin/env python3
"""Erzeugt die App-Symbole als SVG — ein Zahnrad in Silber auf Schwarz.

Warum ein Skript und nicht drei von Hand gepflegte Dateien: die drei
Fassungen unterscheiden sich nur in zwei Zahlen (Eckenradius und Groesse
des Zahnrads), und Android beschneidet die maskable-Fassung auf einen
Kreis von 80 % Kantenlaenge. Das von Hand konsistent zu halten geht
schief, sobald man einmal am Zahnrad etwas aendert.

    python3 symbole.py

schreibt app/icon.svg (Platte mit runden Ecken, dient auch als Favicon)
sowie build/icon-maskable.svg und build/icon-apple.svg (beide randlos).
Aus diesen SVG entstehen die PNG — siehe README, Abschnitt
"Auf den Startbildschirm".
"""
import math, os

MITTE = 256.0

def zahnrad(r_kopf, zaehne=8, stollen=0.83, bohrung=0.34):
    """Umriss eines Zahnrads als SVG-Pfad, Mittelpunkt (256,256).

    r_kopf   Radius bis zur Zahnspitze
    stollen  Fussradius als Anteil von r_kopf
    bohrung  Radius der Mittelbohrung als Anteil von r_kopf
    """
    r_fuss  = r_kopf * stollen
    schritt = 360.0 / zaehne
    # Zahnbreite: an der Spitze schmaler als am Fuss — sonst sieht das
    # Rad aus wie ein Zackenstern statt wie ein Maschinenteil.
    halb_spitze = schritt * 0.20
    halb_fuss   = schritt * 0.30

    def punkt(r, grad):
        b = math.radians(grad - 90)          # -90: erster Zahn zeigt nach oben
        return f"{MITTE + r*math.cos(b):.2f} {MITTE + r*math.sin(b):.2f}"

    teile = []
    for i in range(zaehne):
        a = i * schritt
        if i == 0:
            teile.append(f"M {punkt(r_fuss, a - halb_fuss)}")
        else:
            teile.append(f"A {r_fuss:.2f} {r_fuss:.2f} 0 0 1 {punkt(r_fuss, a - halb_fuss)}")
        teile.append(f"L {punkt(r_kopf, a - halb_spitze)}")
        teile.append(f"A {r_kopf:.2f} {r_kopf:.2f} 0 0 1 {punkt(r_kopf, a + halb_spitze)}")
        teile.append(f"L {punkt(r_fuss, a + halb_fuss)}")
    teile.append(f"A {r_fuss:.2f} {r_fuss:.2f} 0 0 1 {punkt(r_fuss, -halb_fuss)}")
    teile.append("Z")

    # Bohrung als zweiter Teilpfad; fill-rule=evenodd stanzt sie aus.
    rb = r_kopf * bohrung
    teile.append(f"M {MITTE - rb:.2f} {MITTE:.2f}")
    teile.append(f"a {rb:.2f} {rb:.2f} 0 1 0 {2*rb:.2f} 0")
    teile.append(f"a {rb:.2f} {rb:.2f} 0 1 0 {-2*rb:.2f} 0")
    teile.append("Z")
    return " ".join(teile)


def symbol(eckenradius, anteil):
    """Ein vollstaendiges 512er-SVG.

    eckenradius  Rundung der Platte in px (0 = randlos)
    anteil       Breite des Zahnrads als Anteil der Kantenlaenge
    """
    r_kopf = 512 * anteil / 2
    pfad   = zahnrad(r_kopf)
    ecke   = f' rx="{eckenradius}" ry="{eckenradius}"' if eckenradius else ""
    # Der Lichtsaum oben sitzt auf derselben Kurve wie die Platte, damit er
    # bei runden Ecken mitlaeuft. Bei randlosen Fassungen ist es eine Gerade.
    saum = (f'<rect x="1" y="1" width="510" height="510"{ecke} fill="none" '
            f'stroke="url(#saum)" stroke-width="2"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Carservice</title>
  <defs>
    <linearGradient id="grund" x1="0" y1="0" x2="0.45" y2="1">
      <stop offset="0" stop-color="#1d1f23"/>
      <stop offset="0.45" stop-color="#141619"/>
      <stop offset="1" stop-color="#0f1113"/>
    </linearGradient>
    <linearGradient id="silber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4f6f8"/>
      <stop offset="0.42" stop-color="#dfe3e7"/>
      <stop offset="1" stop-color="#a8aeb5"/>
    </linearGradient>
    <linearGradient id="saum" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512"{ecke} fill="url(#grund)"/>
  {saum}
  <path d="{pfad}" fill-rule="evenodd" fill="url(#silber)"
        stroke="url(#silber)" stroke-width="7" stroke-linejoin="round"/>
  <circle cx="256" cy="256" r="{r_kopf*0.48:.2f}" fill="none"
          stroke="#0f1113" stroke-opacity="0.30" stroke-width="{r_kopf*0.055:.2f}"/>
</svg>
'''


# ---------------------------------------------------------------------------
# PNG nachbearbeiten
#
# Was der Browser auf die Leinwand zeichnet, kommt als RGBA heraus und mit
# der Filterwahl, die die Leinwand fuer richtig haelt — ein 512er Symbol wiegt
# so schnell 130 KB. Das Folgende dekodiert das PNG, wirft den Alphakanal weg,
# wenn kein Pixel durchsichtig ist (iOS fuellt Transparenz ohnehin schwarz),
# waehlt je Zeile den guenstigsten Filter und packt mit voller Kompression.
# Verlustfrei: dieselben Pixel, nur kleiner.
# ---------------------------------------------------------------------------
import struct, zlib

_SIG = b"\x89PNG\r\n\x1a\n"

def _chunks(roh):
    i = 8
    while i < len(roh):
        laenge, typ = struct.unpack(">I4s", roh[i:i+8])
        yield typ, roh[i+8:i+8+laenge]
        i += 8 + laenge + 4

def _chunk(typ, daten):
    return (struct.pack(">I", len(daten)) + typ + daten
            + struct.pack(">I", zlib.crc32(typ + daten) & 0xffffffff))

def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
    return a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)

def _entfiltern(roh, breite, hoehe, bpp):
    schritt = breite * bpp
    aus, vorher, i = bytearray(), bytearray(schritt), 0
    for _ in range(hoehe):
        f = roh[i]; i += 1
        zeile = bytearray(roh[i:i+schritt]); i += schritt
        if f == 1:
            for k in range(bpp, schritt): zeile[k] = (zeile[k] + zeile[k-bpp]) & 255
        elif f == 2:
            for k in range(schritt):       zeile[k] = (zeile[k] + vorher[k]) & 255
        elif f == 3:
            for k in range(schritt):
                links = zeile[k-bpp] if k >= bpp else 0
                zeile[k] = (zeile[k] + ((links + vorher[k]) >> 1)) & 255
        elif f == 4:
            for k in range(schritt):
                links = zeile[k-bpp] if k >= bpp else 0
                oben_links = vorher[k-bpp] if k >= bpp else 0
                zeile[k] = (zeile[k] + _paeth(links, vorher[k], oben_links)) & 255
        elif f != 0:
            raise ValueError("unbekannter Filter %d" % f)
        aus += zeile; vorher = zeile
    return bytes(aus)

def _filtern(pixel, breite, hoehe, bpp):
    """Je Zeile den Filter mit der kleinsten Betragssumme — die uebliche
    Heuristik, und fuer Flaechen mit Verlauf gut genug."""
    schritt = breite * bpp
    aus, vorher = bytearray(), bytearray(schritt)
    for y in range(hoehe):
        zeile = pixel[y*schritt:(y+1)*schritt]
        beste, bester_wert = None, None
        for f in range(5):
            k_aus = bytearray(schritt)
            for k in range(schritt):
                a = zeile[k-bpp] if k >= bpp else 0
                b = vorher[k]
                c = vorher[k-bpp] if k >= bpp else 0
                x = zeile[k]
                if   f == 0: v = x
                elif f == 1: v = x - a
                elif f == 2: v = x - b
                elif f == 3: v = x - ((a + b) >> 1)
                else:        v = x - _paeth(a, b, c)
                k_aus[k] = v & 255
            wert = sum(z if z < 128 else 256 - z for z in k_aus)
            if bester_wert is None or wert < bester_wert:
                beste, bester_wert = (f, k_aus), wert
        aus.append(beste[0]); aus += beste[1]
        vorher = zeile
    return bytes(aus)

def nachbearbeiten(pfad):
    roh = open(pfad, "rb").read()
    assert roh[:8] == _SIG, pfad + " ist kein PNG"
    idat = b""
    for typ, daten in _chunks(roh):
        if typ == b"IHDR":
            breite, hoehe, tiefe, farbtyp, komp, filt, interlace = struct.unpack(">IIBBBBB", daten)
        elif typ == b"IDAT":
            idat += daten
    if (tiefe, komp, filt, interlace) != (8, 0, 0, 0) or farbtyp not in (2, 6):
        print("uebersprungen (ungewohntes Format):", pfad); return
    bpp = 4 if farbtyp == 6 else 3
    pixel = _entfiltern(zlib.decompress(idat), breite, hoehe, bpp)

    if farbtyp == 6 and all(pixel[k] == 255 for k in range(3, len(pixel), 4)):
        pixel = bytes(b for k in range(0, len(pixel), 4) for b in pixel[k:k+3])
        farbtyp, bpp = 2, 3

    neu = (_SIG
           + _chunk(b"IHDR", struct.pack(">IIBBBBB", breite, hoehe, 8, farbtyp, 0, 0, 0))
           + _chunk(b"IDAT", zlib.compress(_filtern(pixel, breite, hoehe, bpp), 9))
           + _chunk(b"IEND", b""))
    alt = len(roh)
    if len(neu) < alt:
        open(pfad, "wb").write(neu)
        print(f"{os.path.basename(pfad):<24} {alt:>7} → {len(neu):>7} Byte"
              f"  ({'RGB' if farbtyp == 2 else 'RGBA'})")
    else:
        print(f"{os.path.basename(pfad):<24} bleibt wie es ist")


if __name__ == "__main__":
    import sys as _sys
    if len(_sys.argv) > 1 and _sys.argv[1] == "--nachbearbeiten":
        for pfad in _sys.argv[2:]:
            nachbearbeiten(pfad)
        raise SystemExit(0)

    hier = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(hier, "build"), exist_ok=True)
    ziele = [
        ("app/icon.svg",            112, 0.58),  # Platte, runde Ecken
        ("build/icon-maskable.svg",   0, 0.50),  # randlos, klein genug fuer Androids Beschnitt
        ("build/icon-apple.svg",      0, 0.56),  # randlos, iOS rundet selbst
    ]
    for name, ecke, anteil in ziele:
        pfad = os.path.join(hier, name)
        with open(pfad, "w", encoding="utf-8") as f:
            f.write(symbol(ecke, anteil))
        print("geschrieben:", name)
