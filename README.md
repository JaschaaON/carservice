# Overlandvibe Carservice

Wartungsplan, Teilekatalog und Historie für **beliebig viele Fahrzeuge**.
Ein Projekt von [overlandvibe.com](https://overlandvibe.com).
Ersetzt die Excel-Liste durch eine Übersicht, die selbst ausrechnet, was als Nächstes ansteht.
Angelegt ist der Toyota Hilux Extra Cab (2023, 2.8 D-4D, Automatik, 4x4).

## Was sie kann

| Bereich | Zweck |
|---|---|
| **Fahrzeuge** | Alle Fahrzeuge mit Statuszeichen, Halter und nächster Fälligkeit |
| **Wartung** | Statusring, Zeitstrahl, Einkaufsliste — und darunter alle Positionen nach Dringlichkeit, mit Intervall nach km *und* Zeit, Teilebedarf, Verlauf, „erledigt"-Eintrag |
| **Teilekatalog** | Teilenummern, Preise, Vorrat und **eigene Kauflinks** pro Teil |
| **Historie** | Zeitachse nach Jahren, mit Abstand zum Vortermin und Nachweisfotos |
| **Fotos und Videos** | Belege an jedem Historieneintrag, Referenzmaterial an jeder Wartungsposition |
| **Bibliothek** | 60 Wartungsbausteine zum Auswählen — Diesel, Benzin, Hybrid, DSG, Haldex, Zahnriemen … |
| **Anleitungen** | Werkstattunterlagen als PDF, direkt an der Wartungsposition abrufbar |
| **Umbauten** | Anbauteile mit Einbaudatum, Kosten, Bezugsquelle |
| **Tour** | Was vor einer Reise fällig wird und welche Teile mitgehören |
| **Kosten** | Summen pro Jahr, Kosten je Kilometer |

Die **Übersicht** zeigt als Erstes einen Ring mit der Restreichweite bis zum
naechsten Service, darunter einen Zeitstrahl der kommenden zwoelf Monate und die
**Einkaufsliste**: alle Teile fuer Faelliges, zusammengefasst und mit den eigenen
Kauflinks. Gezeichnet wird das als Inline-SVG, ohne Diagrammbibliothek von einem
CDN — sonst zerbraeche die Offline-Faehigkeit.

Oben links steht das **Fahrzeug-Auswahlfeld**. Die Ansicht *Fahrzeuge* zeigt
alle nebeneinander; ein Klick auf eine Karte wechselt das aktive Fahrzeug, das
Stiftsymbol oben rechts auf der Karte oeffnet die Fahrzeugdaten samt
**Loeschen**. Das letzte verbliebene Fahrzeug laesst sich nicht loeschen. Jedes Fahrzeug hat einen eigenen
Wartungsplan, einen eigenen Teilekatalog, eine eigene Historie und eigene Umbauten —
nichts wird zwischen Fahrzeugen vermischt. Über *+ Neues Fahrzeug …* legst du eins an
(Marke, Bezeichnung, Motor, Baujahr, Kennzeichen, FIN, Erstzulassung, Kilometerstand).
Für den Wartungsplan wählst du dabei zwischen der mitgelieferten Vorlage für
Diesel-Geländewagen, einer **Kopie des Plans eines vorhandenen Fahrzeugs**
(Positionen und Teile ohne fremde Wartungsstände) oder einem leeren Start.

Fahrzeugdaten änderst du über das Zahnrad rechts oben; dort liegen auch Sichern,
Laden und Löschen.

## Serviceheft nachtragen

Wer aus einem gefuehrten Serviceheft kommt, hat zwanzig Stempel zu erfassen —
und die meisten betreffen dieselben Positionen. Ein Fenster pro Eintrag waere
die falsche Form, deshalb gibt es **Serviceheft nachtragen** in der
Historie-Ansicht: eine Strecke statt vieler Fenster.

Datum, Kilometerstand, Werkstatt, Positionen, Kosten — dann **„Eintragen und
naechster"**. Der Eintrag wird sofort gespeichert, Datum und Stand werden
geleert, **Positionsauswahl und Werkstatt bleiben stehen**. Darunter waechst
die Liste des in dieser Sitzung Erfassten, jede Zeile mit ✕ zum Zuruecknehmen.

**Pakete** machen aus einem pauschalen Stempel einen Klick: Haken fuer eine
typische Inspektion setzen, „Auswahl als Paket merken", ab dem naechsten Mal
reicht der Paketknopf. Bewusst **keine vorgefertigten Pakete** — was zu einer
Inspektion gehoert, unterscheidet sich je Fahrzeug und Werkstatt.

Plausibilitaet erscheint als **Hinweis, nie als Sperre**: Stand kleiner als bei
einem frueheren Datum, Datum in der Zukunft, Dopplung. Im Heft steht manchmal
Krummes, und wer es abtippt, weiss besser was dort steht. Ein nachgetragener
alter Stand senkt den aktuellen Kilometerstand nie.

**Einzelnen Termin nachtragen:** Im Wartungsplan steht im aufgeklappten
Verlauf jeder Position ein **＋**. Der traegt genau einen alten Termin fuer
diese Position nach — Datum und Kilometerstand bleiben leer, damit nicht
versehentlich „heute" erfasst wird, und die Position ist schon angehakt. Der
Weg fuer ein gekauftes Fahrzeug, dessen Serviceheft ein paar Oelwechsel
auffuehrt. Steht auch im leeren Verlauf, denn genau dort sucht man ihn.

**Startwerte** (Knopf im Wartungsplan, und aus der Gruppe „Noch nie erfasst"
auf der Uebersicht) ist der zweite Weg: eine kompakte Liste aller Positionen
mit je einem km- und einem Datumsfeld. Fuer alles, wozu im Heft nichts steht —
Reifen, Batterie, Unterboden. Ein Wert je Position genuegt, damit die
Faelligkeit rechnet; Positionen ohne Angabe stehen oben, Positionen mit
Historieneintrag zeigen diesen statt der Felder.

> Nebenbei gewinnt die Prognose: `kmPerDay()` nimmt pauschal 40 km/Tag an,
> solange keine zwei Datenpunkte ueber mindestens 14 Tage vorliegen. Alte
> Serviceheft-Eintraege sind genau solche Punkte.

### Import ordnet jetzt zu

Der Excel-Import schrieb bisher `taskIds: []` — die Zeilen standen in der
Zeitleiste und setzten trotzdem keine Faelligkeit zurueck, weil `lastDone()`
ueber `taskIds` sucht. Der Verlauf sah richtig aus und rechnete falsch.

Jetzt wird der Text jeder Zeile gegen die Positionsnamen gehalten: erst direkt,
dann wortweise an Wortgrenzen, zuletzt ueber eine kleine Tabelle `HEFT_REGELN`
fuer die Faelle, in denen Heft und Plan verschiedene Woerter benutzen —
„Ölwechsel" findet so „Motoröl + Ölfilter". Die Vorschau zeigt die erkannten
Positionen vor dem Import; Zeilen ohne Treffer bleiben reine
Zeitleisteneintraege.

Der Vergleich laeuft bewusst an **Wortgrenzen**: ein reiner
Teilzeichenkettenvergleich hat „Ölservice" auf „Klimaanlage Service" gezogen,
weil das Wort „service" in beidem steckt.

## Die Reiterzeile

Acht Eintraege, nicht elf. Was selten gebraucht wird — **Umbauten, Tour,
Kosten** — haengt hinter einem letzten Eintrag **„Mehr ▾"**. Ist eine dieser
Ansichten offen, nennt der Knopf sie: `Mehr · Kosten`. Sonst weiss man nicht,
wo man ist.

```
Fahrzeuge · Wartung · Reparaturen · Teile · Historie · Dokumente · Anleitungen · Mehr ▾
```

**Uebersicht und Wartungsplan sind ein Reiter.** Vorher zeigten beide dieselben
Positionskarten, die Uebersicht aber als `taskCard(s, false)` — das schaltet
den aufklappbaren Teil ab. Dieselbe Komponente zweimal verschieden aufzurufen
war der Fehler; wer auf der Uebersicht eine faellige Position antippte, bekam
nichts. Jetzt gibt es die Karte nur noch in einer Fassung.

Beim Zusammenlegen durfte nichts verlorengehen: Die Uebersicht zeigte nur die
ersten vier unkritischen Positionen (`.slice(0,4)`) und liess solche **ohne
Intervall** ganz weg — sichtbar waren die nur im Plan. Dafuer gibt es jetzt die
Gruppen *Nicht faellig* und *Ohne Intervall*, und der Haken „inaktive zeigen"
wirkt endlich auch hier (`allStatus(inc)` statt `allStatus(false)`).

> **Eine Funktion fuer den Ansichtswechsel.** Vorher schalteten drei Stellen
> die Ansicht von Hand um, jede mit eigener Kopie von
> `$$(".view").forEach(...)`. Mit dem Mehr-Menue muesste jede zusaetzlich
> wissen, wann der Menueknopf als aktiv gilt — das geht nur an einem Ort,
> deshalb `zeigeAnsicht(name)`. Wichtig dabei: Die Markierung greift auf
> `#nav > button` zu, denn die Menueeintraege liegen ebenfalls in `#nav`.

**Ehrlich zur Breite:** Das Band ist von 1015 auf 592 px geschrumpft, passt auf
einem 375-px-Telefon aber immer noch nicht am Stueck. Es scrollt weiter
waagerecht — dafuer holt `zeigeAnsicht` den aktiven Reiter ins Bild, sodass die
Markierung nie ausserhalb liegt. Wer es ganz ohne Schieben will, muesste auf
kleinen Bildschirmen weitere Reiter ins Menue schieben.

## Verlauf je Position

Jede aufgeklappte Wartungsposition zeigt, wann sie durchgefuehrt wurde — und
vor allem **in welchen Abstaenden**. Daran laesst sich ablesen, ob das gesetzte
Intervall zur gelebten Praxis passt: „4× erfasst · im Schnitt alle 13.572 km",
darunter die einzelnen Termine mit „nach 10.918 km", „nach 14.761 km".

Ein manuell gesetzter Startwert erscheint mit darin, gekennzeichnet als solcher.
Ueber das Stiftsymbol laesst sich jeder Eintrag direkt bearbeiten.

Teilenamen in der Einkaufsliste und in der Teileliste einer Position sind
verlinkt und oeffnen den Teiledialog — fuer Teilenummer, Preis und Kauflinks.

## Benutzer und Anmeldung

Mehrere Personen koennen eigene Konten haben — jedes mit eigenen Fahrzeugen,
Teilen, Anleitungen und Historie, strikt getrennt. Gemeinsam sind nur die
Markenprofile und die Bausteinbibliothek, die im Programmcode stecken.

```
data/
├── auth/
│   ├── secret            HMAC-Schluessel fuer Sitzungen, 0600
│   └── users.json        Konten mit scrypt-Hash, 0600
└── users/<id>/           je Konto data.json, photos/, docs/, versions/
```

**Ersteinrichtung:** Beim ersten Aufruf von `/admin` legst du dein
Administrator-Konto an; vorhandene Daten aus dem Datenverzeichnis wandern dabei
in dieses Konto. Danach ist dieser Weg dauerhaft geschlossen.

In der App sitzt oben rechts ein **Benutzermenue** — der Knopf zeigt die
Initialen des Angemeldeten. Darin: Fahrzeugdaten, Kontenverwaltung (nur fuer
Admins) und **Abmelden**. Auf beiden Bildschirmgroessen an derselben Stelle;
im lokalen Dateimodus ohne Server entfaellt der Abmelden-Punkt.

**Verwaltung** unter `/admin`: Konten anlegen, umbenennen, Rolle aendern,
Passwort zuruecksetzen, sperren, loeschen. Ueber *Ansehen* oeffnet ein Admin
die App im Kontext eines fremden Kontos — mit deutlichem Hinweisbalken, und
jeder solche Zugriff landet im Log. Der letzte Administrator laesst sich weder
herabstufen noch sperren oder loeschen.

### Wie der Schutz funktioniert

Ohne Fremdbibliotheken, alles mit Node-Bordmitteln:

* **Passwoerter** als `scrypt`-Hash mit eigenem Salt je Konto, verglichen mit
  `timingSafeEqual`. Mindestlaenge zwoelf Zeichen.
* **Sitzungen** im signierten Cookie (HMAC-SHA256) statt in einer Tabelle —
  ueberlebt Neustarts. `HttpOnly`, `SameSite=Strict`, `Secure` sobald die
  Anfrage ueber HTTPS kommt.
* **Sofort aussperren**: Jedes Konto traegt eine `sessionVersion`. Passwort
  aendern oder sperren zaehlt sie hoch, womit alle bestehenden Cookies verfallen.
* **Durchprobieren**: ab fuenf Fehlversuchen ansteigende Sperre. Auch ohne
  passendes Konto laeuft dieselbe Rechenarbeit, damit die Antwortdauer nicht
  verraet, welche Anmeldenamen existieren.
* **CSRF**: `SameSite=Strict` plus Pflicht auf `Content-Type: application/json`
  bei schreibenden Aufrufen.

> Betrieben wird weiterhin **hinter NetBird**. Die Anmeldung trennt Daten und
> Zustaendigkeiten; das Netz haelt Fremde fern. Vor einem Gang ins offene
> Internet waeren zusaetzlich noetig: dauerhaftes Zugriffsprotokoll,
> persistenter Sperrzaehler, Zwei-Faktor-Anmeldung und eine unabhaengige
> Durchsicht der Anmeldelogik.

**Passwort vergessen** setzt der Admin zurueck — es gibt bewusst keinen
Mailversand, das waere eigene Infrastruktur.

## Marke

Auf breiten Bildschirmen (ab 1000 px) steht die Marke mittig in der Kopfzeile,
absolut positioniert — sonst saesse sie in der Mitte des *verbleibenden* Platzes
und damit sichtbar schief, weil links ein langer Fahrzeugname und rechts ein
schmales Zahlenfeld stehen. Darunter wird sie ausgeblendet, dort traegt die
Fussleiste das Zeichen.

Die Fussleiste traegt das Zeichen von overlandvibe.com und den Schriftzug
„overlandvibe carservice", verlinkt auf die Website. Das SVG ist **inline in
`app/index.html` eingebettet**, nicht als Datei verlinkt: bei rund 400 Byte
lohnt kein eigener Request, und so bleibt es auch ohne Netz sichtbar, ohne dass
der Service Worker eine weitere Datei vorhalten muss. Quelle des Zeichens ist
`overlandvibe/public/logo/mark-trail.svg` im Schwesterprojekt.

Sein dunkler Kreis (`#111413`) liegt dicht an der Hintergrundfarbe der App
(`#08090a`), wodurch es wie ein Abzeichen ohne harte Kante wirkt.

Der Name auf dem Homescreen kommt aus `apple-mobile-web-app-title` — dieses
Meta-Tag hat auf iOS **Vorrang vor dem Manifest**. Es steht auf „Carservice",
weil iOS unter dem Icon nach etwa zwoelf Zeichen abschneidet; der vollstaendige
Name „Overlandvibe Carservice" steht im Manifest und erscheint beim
Installieren.

Die **App-Icons sind noch das blaue Zahnrad**. Sie auf die Overlandvibe-Marke
umzustellen hiesse, die drei PNG (192, 512 und 180 px) aus dem SVG neu zu
erzeugen — bislang bewusst offen gelassen.

## Gestaltung

Silber auf Schwarz. Der Verlauf liegt nicht als Hintergrundbild hinter der
Oberflaeche, sondern steckt **in den Flaechen selbst** — jede Karte, jeder Knopf
traegt oben eine helle und unten eine dunkle Kante, wie gebuerstetes Metall im
Streiflicht. Dadurch bleibt der Bildschirmhintergrund ruhig schwarz
(`#08090a`), und trotzdem wirkt nichts flach.

Die Materialien stehen als Variablen in `:root` und werden nur ueber diese
benutzt — wer den Ton aendern will, aendert eine Zeile statt hundert Regeln:

```
--mat-flaeche    ruhige Flaeche (Karten, Listen)
--mat-erhaben    herausgehobene Flaeche (Statuskarte)
--mat-kopf       Kopfzeile
--mat-vertieft   eingelassen (Eingabefelder, Kilometerfeld)
--mat-silber     Silberverlauf fuer den wichtigsten Knopf je Ansicht
--mat-knopf      normale Knoepfe
--kante          heller Lichtsaum oben
--kante-stark    Lichtsaum oben, Schattenkante unten
```

Geschrieben ist die App in **Geist**, Zahlen in **Geist Mono** mit
Tabellenziffern — damit springen Kilometerstaende in Listen nicht, wenn sich
eine Ziffer aendert. Beide Schriften liegen als variable woff2 unter
`app/fonts/` (zusammen 81 KB, SIL OFL 1.1) und werden **selbst ausgeliefert**:
hinter einem VPN ist ein Google-Fonts-Aufruf entweder langsam oder gar nicht
moeglich, und der Service Worker kann nur vorhalten, was vom eigenen Server
kommt.

Die Farben fuer den Zustand bleiben die einzigen bunten Punkte: gruen in
Ordnung, gelb demnaechst, rot ueberfaellig, violett noch nie erfasst.

## Zahlenfelder und das Mausrad

Ein `<input type="number">` aendert beim Scrollen seinen Wert, solange es den
Fokus hat. Wer „Preis je Einheit" antippt und dann die Seite herunterrollt,
verstellt den Preis unbemerkt — und sieht es erst, wenn im Katalog eine falsche
Zahl steht. Das betrifft alle Zahlenfelder: Kilometerstand, Intervalle,
Startseite einer Anleitung, Baujahr, Kosten, Vorrat.

Ein Zuhoerer am Dokument nimmt dem Rad den Zugriff, indem er dem Feld den Fokus
entzieht — bewusst so und nicht mit `preventDefault()`: Letzteres braeuchte
einen nicht passiven Zuhoerer, wuerde das Scrollen ueber dem Feld blockieren und
die Seite auf dem Telefon klebrig machen. Tastatur und die kleinen Pfeilchen am
Feldrand bleiben unveraendert.

## Kilometerstand

Ein veralteter Kilometerstand macht jede Faelligkeitsangabe falsch — bei
95 km/Tag ist er nach einer Woche schon 670 km daneben. Statt bei jedem Start
zu fragen, rechnet die App die Abweichung aus der tatsaechlichen Fahrleistung
aus und meldet sich erst, wenn sie ins Gewicht faellt: ab etwa 400 geschaetzten
Kilometern oder spaetestens nach 30 Tagen.

Der Dialog kommt dann mit einem **vorausgefuellten Schaetzwert**, den man meist
nur bestaetigen muss, dazu Schnellwahl (+100/+250/+500). Wer ueberspringt, wird
am selben Tag nicht erneut gefragt; stattdessen bleibt oben ein Hinweisstreifen
stehen, und das Feld in der Kopfzeile ist markiert. Beim allerersten Start
erscheint der Dialog ohne Schaetzung, weil es noch keine Datenbasis gibt.

## Faelligkeit

Eine Position gilt als fällig, sobald **entweder** die Kilometer **oder** die Zeit abgelaufen ist.
Um beides vergleichbar zu machen, rechnet die App die Restzeit über die tatsächliche
Fahrleistung (aus der Historie ermittelt) in Rest-Kilometer um. Daher die Prognose
„≈ 10. Feb. 2027" — die sagt, wann du Teile bestellt haben solltest.

## Aufbau

```
server.js        Mini-Server, keine Abhängigkeiten: liefert die App aus,
                 liest und schreibt data.json, sichert jede Vorversion
app/index.html   die komplette App in einer Datei
app/sw.js        Service Worker — App bleibt ohne Netz lesbar
app/fonts/       Geist und Geist Mono, selbst gehostet (SIL OFL 1.1)
app/icon.svg     Quelle der App-Symbole, erzeugt von symbole.py
data/data.json   sämtliche Daten, alle Fahrzeuge in einer Datei
data/versions/   die letzten 40 Fassungen, automatisch
data/photos/     Fotos als JPEG, je Bild eine Voll- und eine Vorschaufassung
```

## Auf dem Netcup-Server einrichten

Das Image baut GitHub Actions bei jedem Push und legt es unter
`ghcr.io/jaschaaon/carservice:latest` ab. Der Server baut nichts selbst —
er zieht das fertige Image. Dadurch erkennt Dockhand Updates und spielt sie
per Klick ein.

### 1. Registry-Zugang (nur bei privatem Paket)

Ist das Paket oeffentlich, entfaellt dieser Schritt. Andernfalls in GitHub unter
*Settings → Developer settings → Personal access tokens (classic)* einen Token
mit dem einzigen Scope **`read:packages`** erzeugen und auf dem Server:

```bash
echo "<TOKEN>" | docker login ghcr.io -u <github-benutzer> --password-stdin
```

### 2. Stack in Dockhand anlegen

Neuen Stack anlegen und den Inhalt von `docker-compose.yml` in die `compose.yaml`
uebernehmen. Dockhand legt dabei ein Verzeichnis an, etwa:

```
/opt/dockhand/stacks/<HOST>/carservice/
```

### 3. Datenverzeichnis anlegen

`data/` liegt bewusst weder im Repository noch im Image — dort stehen
Fahrzeugdaten, und sie wachsen auf dem Server weiter. Das Verzeichnis muss
neben der `compose.yaml` liegen, weil die Compose-Datei es relativ einhaengt.

```bash
mkdir -p /opt/dockhand/stacks/<HOST>/carservice/data
```

Der Server legt darin beim ersten Start eine leere Datenbasis an; Fahrzeuge
legst du dann in der App an. Hast du bereits Daten, spiel sie in der App unter
⚙ → *JSON laden* ein oder kopiere die `data.json` vorab hierher.

Kommst du von einer Excel-Liste, hilft `convert_excel.py` beim Umstieg —
siehe unten.

### 4. Schreibrechte setzen

Der Container laeuft ohne Root als UID 1000. Fehlt dieser Schritt, startet er
zwar, kann aber nichts speichern und meldet sich als `unhealthy`:

```bash
chown -R 1000:1000 /opt/dockhand/stacks/<HOST>/carservice/data
```

### 5. Starten und pruefen

**Save & redeploy** in Dockhand, danach:

```bash
curl -s http://127.0.0.1:8099/api/health
```

### 6. NetBird davorschalten

Der Container ist an `127.0.0.1:8099` gebunden und vom offenen Internet aus
nicht erreichbar — auch nicht ueber die oeffentliche IP des Servers.

Im NetBird-Reverse-Proxy als Ziel eintragen:

```
service.example.com  →  http://127.0.0.1:8099
```

Die Anmeldung uebernimmt NetBirds Login-Feature; die App hat bewusst keine
eigene Benutzerverwaltung. HTTPS sollte aktiv sein, sonst laesst der Browser
keinen Service Worker zu und die App verhaelt sich auf dem iPhone wie ein
Lesezeichen statt wie eine App.

> Erreicht NetBird `127.0.0.1` nicht, weil der Proxy nicht auf dem Peer selbst
> ausliefert, stattdessen zusaetzlich an die NetBird-Adresse binden:
> `- "<vpn-adresse>:8099:8080"`. Das bleibt sicher, weil VPN-Adressen aus
> `100.64.0.0/10` nicht aus dem Internet routbar sind.

### 7. Auf dem iPhone

Siehe [Auf den Startbildschirm](#auf-den-startbildschirm).

## Auf den Startbildschirm

Carservice ist eine PWA — sie laesst sich wie eine App auf den Startbildschirm
legen und startet dann im Vollbild, ohne Adressleiste.

**Voraussetzung:** Die Adresse laeuft ueber NetBird. Auf dem Telefon muss also
die NetBird-App verbunden sein, sonst startet die App im Offline-Modus.

**iPhone und iPad** — geht nur in **Safari**; Chrome und Firefox legen auf iOS
nur eine Verknuepfung an:

1. `service.example.com` in Safari oeffnen
2. Unten auf **Teilen** (Quadrat mit Pfeil nach oben)
3. **Zum Home-Bildschirm** → **Hinzufuegen**

**Android** — in Chrome ueber ⋮ → **App installieren**, oder im Zahnradmenue
der App auf **Zum Startbildschirm**; dort erscheint der Punkt, sobald Chrome
das Installieren anbietet.

Der Menuepunkt ist auch der iOS-Weg: dort zeigt er die drei Schritte, weil iOS
keinen programmgesteuerten Installdialog kennt. Sobald die App installiert
laeuft, verschwindet er.

**Ohne Netz** bleibt die Oberflaeche stehen, samt Schriften, Symbolen und den
zuletzt geladenen Daten; Fotos kommen aus dem Cache. Was fehlt, ist der
Abgleich — Aenderungen landen dann erst beim naechsten Start mit Verbindung
auf dem Server.

**Angemeldet bleiben:** Die Sitzung laeuft nach 30 Tagen ab, verlaengert sich
aber bei jedem Start wieder auf 30, solange mehr als die Haelfte verbraucht
ist. Wer die App benutzt, meldet sich also nicht staendig neu an.

> Die installierte App fuehrt **eigene Cookies**, getrennt von Safari. Nach dem
> Installieren meldet man sich einmalig darin an.

### Symbole neu erzeugen

`app/icon.svg` ist die Quelle — ein Zahnrad in Silber auf Schwarz, in derselben
Sprache wie die Oberflaeche. Erzeugt wird es von `symbole.py`, zusammen mit den
beiden randlosen Fassungen fuer Android (`maskable`, wird auf einen Kreis
beschnitten) und iOS:

```bash
python3 symbole.py
```

Aus den SVG werden die PNG gerastert — auf dem Mac ist weder ImageMagick noch
rsvg-convert vorausgesetzt, es genuegt ein Browser: die SVG auf ein `<canvas>`
zeichnen und ueber `toDataURL("image/png")` sichern, in 192, 512 (aus
`icon.svg`), 512 (`icon-maskable.svg`) und 180 (`icon-apple.svg`). Danach
verkleinert

```bash
python3 symbole.py --nachbearbeiten app/icon-*.png app/apple-touch-icon.png
```

die Dateien verlustfrei: Alphakanal weg, wo nichts durchsichtig ist, je Zeile
der guenstigste Filter, volle Kompression — aus 322 KB werden so 105 KB.

## Aktualisieren

Aenderungen pushen — GitHub Actions baut das Image — in Dockhand erscheint ein
Update und wird per Klick eingespielt. Kein SSH, kein `git pull`, kein Build
auf dem Server.

Den Build-Status siehst du mit `gh run list` oder unter *Actions* im
Repository. Reine Aenderungen an README, Konverter oder `docker-compose.yml`
loesen bewusst keinen Build aus, da sie nicht im Image landen.

## Benutzer und Anmeldung

Mehrere Personen koennen eigene Konten haben — jedes mit eigenen Fahrzeugen,
Teilen, Anleitungen und Historie, strikt getrennt. Gemeinsam sind nur die
Markenprofile und die Bausteinbibliothek, die im Programmcode stecken.

```
data/
├── auth/
│   ├── secret            HMAC-Schluessel fuer Sitzungen, 0600
│   └── users.json        Konten mit scrypt-Hash, 0600
└── users/<id>/           je Konto data.json, photos/, docs/, versions/
```

**Ersteinrichtung:** Beim ersten Aufruf von `/admin` legst du dein
Administrator-Konto an; vorhandene Daten aus dem Datenverzeichnis wandern dabei
in dieses Konto. Danach ist dieser Weg dauerhaft geschlossen.

In der App sitzt oben rechts ein **Benutzermenue** — der Knopf zeigt die
Initialen des Angemeldeten. Darin: Fahrzeugdaten, Kontenverwaltung (nur fuer
Admins) und **Abmelden**. Auf beiden Bildschirmgroessen an derselben Stelle;
im lokalen Dateimodus ohne Server entfaellt der Abmelden-Punkt.

**Verwaltung** unter `/admin`: Konten anlegen, umbenennen, Rolle aendern,
Passwort zuruecksetzen, sperren, loeschen. Ueber *Ansehen* oeffnet ein Admin
die App im Kontext eines fremden Kontos — mit deutlichem Hinweisbalken, und
jeder solche Zugriff landet im Log. Der letzte Administrator laesst sich weder
herabstufen noch sperren oder loeschen.

### Wie der Schutz funktioniert

Ohne Fremdbibliotheken, alles mit Node-Bordmitteln:

* **Passwoerter** als `scrypt`-Hash mit eigenem Salt je Konto, verglichen mit
  `timingSafeEqual`. Mindestlaenge zwoelf Zeichen.
* **Sitzungen** im signierten Cookie (HMAC-SHA256) statt in einer Tabelle —
  ueberlebt Neustarts. `HttpOnly`, `SameSite=Strict`, `Secure` sobald die
  Anfrage ueber HTTPS kommt.
* **Sofort aussperren**: Jedes Konto traegt eine `sessionVersion`. Passwort
  aendern oder sperren zaehlt sie hoch, womit alle bestehenden Cookies verfallen.
* **Durchprobieren**: ab fuenf Fehlversuchen ansteigende Sperre. Auch ohne
  passendes Konto laeuft dieselbe Rechenarbeit, damit die Antwortdauer nicht
  verraet, welche Anmeldenamen existieren.
* **CSRF**: `SameSite=Strict` plus Pflicht auf `Content-Type: application/json`
  bei schreibenden Aufrufen.

> Betrieben wird weiterhin **hinter NetBird**. Die Anmeldung trennt Daten und
> Zustaendigkeiten; das Netz haelt Fremde fern. Vor einem Gang ins offene
> Internet waeren zusaetzlich noetig: dauerhaftes Zugriffsprotokoll,
> persistenter Sperrzaehler, Zwei-Faktor-Anmeldung und eine unabhaengige
> Durchsicht der Anmeldelogik.

**Passwort vergessen** setzt der Admin zurueck — es gibt bewusst keinen
Mailversand, das waere eigene Infrastruktur.

## Fahrzeug bestimmen

Beim Anlegen eines Fahrzeugs steht oben ein Auswahlblock: **Marke → Baujahr →
Modell → Motorisierung**. Das Baujahr grenzt die Modelle ein (ein Golf VI
verschwindet, sobald 2016 dasteht), das Modell die Motoren. Danach traegt die
App Marke, Bezeichnung, Motor, Kraftstoff und Antrieb selbst in die Felder ein
— sichtbar, damit man es korrigieren kann.

Abgedeckt sind **24 Marken, 116 Modellreihen, 324 Motorisierungen** — die in
Deutschland gaengigen Fahrzeuge, nicht der Weltmarkt.

### Was der Katalog weiss und was nicht

Der Katalog traegt **keine Wartungsintervalle**. Die kommen aus dem
Markenprofil. Er traegt die paar technischen Tatsachen, an denen sich der Plan
tatsaechlich entscheidet:

| Merkmal | Wirkung im Plan |
|---|---|
| `steuer: riemen` | Zahnriemenposition mit Wechseltermin |
| `steuer: nassriemen` | Riemen im Oelbad — Pruefen **und** Wechseln, frueher |
| `steuer: kette` | nur „Steuerkette pruefen", kein Termin |
| `steuer: unklar` | Position „Steuertrieb feststellen" statt einer Behauptung |
| `abgas: kat` | kein Partikelfilter, kein AdBlue |
| `abgas: dpf` | Partikelfilter, kein AdBlue |
| `abgas: dpf+adblue` | beides |

Das ist der Punkt der ganzen Uebung: Ein Markenprofil kennt die Marke, nicht
den Motor. Der **Pajero** bekommt aus dem Markenprofil eine Zahnriemenposition
— beim 4M41 ist das falsch, der hat eine Kette. Waehlt man die Motorisierung,
raeumt die App die Steuertriebspositionen aus dem Plan und setzt genau die
richtige hinein. Dasselbe gilt fuer AdBlue bei einem Euro-5-Diesel, den es dort
nicht gibt.

Motoren stehen **einmal je Konzern** und werden von den Modellen nur
referenziert. Ein EA288 sitzt in Golf, Passat, Octavia und Leon gleichermassen
— dreimal abgeschrieben waere er dreimal falsch.

> **Grenze, die bleibt.** Verbindliche Werksintervalle fuer jeden Motor liegen
> nicht frei vor; sie stehen im Serviceheft und in kostenpflichtigen
> Werkstattdatenbanken. Die Intervalle hier sind praxisnahe Groessenordnungen,
> absichtlich kuerzer als die laengste Werksangabe, und jede erzeugte Position
> sagt das auch. Wo eine Motorenreihe je nach Motorcode Riemen **oder** Kette
> hat, behauptet die App nichts, sondern legt eine Position an, die zum
> Nachsehen auffordert.

### Wenn das Fahrzeug nicht dabei ist

Drei Wege, alle gleichwertig:

1. **Grundplan · Diesel** oder **Grundplan · Benziner** — was jedes Fahrzeug
   braucht (Oel, Filter, Bremsen, Reifen, Fahrwerk) plus das, was am Kraftstoff
   haengt. Bewusst **ohne** Zahnriemen: den traegt man nach, wenn man weiss, ob
   der Motor einen hat. Alles Weitere ueber *Aus Bibliothek*.
2. **Nach Marke** — das Markenprofil wie bisher.
3. **Leer beginnen** und jede Position selbst anlegen.

### HSN und TSN

Zwei Felder im Fahrzeugformular, aus der Zulassungsbescheinigung Teil I (2.1
und 2.2). Sie stehen auf der Fahrzeugkarte, damit man sie im Teileshop zur Hand
hat — **eine Suche daraus gibt es bewusst nicht.**

Warum nicht: Das KBA veroeffentlicht zwar eine Liste der Hersteller- und
Typschluesselnummern, die fuehrt aber zu Herstellername und Handelsbezeichnung
— nicht zum Motorcode. Genau die Verknuepfung HSN/TSN → Motor ist das, was
kommerzielle Werkstattdatenbanken verkaufen. Eine Suche haette also entweder
geraten oder waere bei „VW Golf" stehen geblieben, und das sind dieselben drei
Klicks wie im Auswahlblock — bei mehreren Megabyte Zusatzdaten in einer App,
die offline funktionieren soll.

## Markenprofile

Beim Anlegen eines Fahrzeugs laesst sich ein Markenprofil waehlen.

**Autos:** VW-Konzern (LongLife oder Festintervall), BMW/Mini, Mercedes-Benz,
Ford, Stellantis (Opel, Peugeot, Citroën, Fiat), Toyota/Lexus,
**Mitsubishi Pajero und Gelaendewagen**, Hyundai/Kia/Mazda/Suzuki/Honda,
Renault/Dacia/Nissan und Volvo.

**Motorraeder:** Suzuki (Bandit, GSF, SV, V-Strom), Honda/Yamaha/Kawasaki,
BMW Motorrad, KTM/Husqvarna/GasGas, Harley-Davidson und
Ducati/Triumph/Moto Guzzi/Aprilia.

Ein Profil erzeugt einen Plan aus einem gemeinsamen Sockel plus antriebs- und
markenspezifischen Positionen. Es richtet sich dabei nach den
Fahrzeugmerkmalen: DSG-Oelwechsel erscheint nur bei Doppelkupplungsgetriebe,
Haldex nur bei Allrad, Zuendkerzen nur bei Benzinern.

**Zwei Sockel.** Ein Motorrad teilt mit dem Auto fast nichts ausser dem
Motoroel — kein Innenraumfilter, keine Wischerblaetter, keine Klimaanlage,
dafuer Ventilspiel, Kette, Gabeloel und Lenkkopflager. Profile mit
`art: "motorrad"` schalten deshalb auf einen eigenen Sockel um und lassen die
Antriebszusaetze der Autos weg. Der **Endantrieb** steht im Formular unter
*Antrieb* (Kette, Kardan, Zahnriemen) und entscheidet, welche Positionen
aufgenommen werden; ohne Angabe kommen alle drei hinein, und das Formular
sagt das auch.

**Markenerkennung:** Getippt wird Marke *und* Bezeichnung, ausgewertet wird
beides zusammen — „Suzuki" allein ist zweideutig, erst „Suzuki Bandit" verraet
das Motorrad. Es gewinnt der laengste gefundene Markenname, nicht der erste.
Deshalb tragen die Zweiradprofile bei Herstellern, die auch Autos bauen,
qualifizierte Stichworte (`Honda CB`, `BMW R`, `Suzuki GSX`) statt der blossen
Marke.

> **"Den" Inspektionsplan einer Marke gibt es nicht.** Innerhalb eines
> Herstellers unterscheiden sich die Vorgaben nach Motor, Baujahr und
> Serviceart — ein VW mit LongLife-Service hat andere Intervalle als derselbe
> Wagen mit Festintervall, und Zahnriemenintervalle schwanken je Motorcode um
> zehntausende Kilometer. Die Profile bilden die typische **Struktur** einer
> Marke ab und tragen Groessenordnungen ein, die jede erzeugte Position als
> Vorschlag kennzeichnet. Verbindlich ist das Serviceheft des Fahrzeugs.

Punkte, die in den Profilen bewusst hervorgehoben sind, weil sie teuer werden
koennen: der **Nassriemen** bei Ford EcoBoost/EcoBlue und Stellantis PureTech
— die Werksangabe von bis zu 240.000 km gilt als zu optimistisch — die Bindung
des VW-LongLife-Intervalls an freigegebenes Longlife-Oel, der **Zahnriemen im
Steuertrieb** riemengetriebener Ducati, und beim **Pajero** die Frage, ob der
Motor Riemen oder Kette hat: 2.5 DI-D (4D56) und die V6-Benziner laufen mit
Riemen, der 3.2 DI-D (4M41) mit Kette. Das Profil legt die Riemenposition an
und sagt dazu, wann sie zu loeschen ist.

## Bausteinbibliothek

Statt fertiger Herstellerplaene bietet die App **einzelne Wartungspositionen zum
Auswaehlen** — im Wartungsplan ueber *Aus Bibliothek*. Gegliedert nach Technik
statt nach Marke, denn ein DSG sitzt in VW, Audi, Škoda und Seat gleichermassen.

Das ist Absicht: Belastbare Werksintervalle fuer jeden Hersteller liegen mir
nicht vor, und ein falsch hinterlegter Zahnriemenwechsel kostet einen Motor.
Die Bibliothek liefert deshalb **Vorschlagswerte aus der Praxis**, die beim
Uebernehmen sichtbar als solche gekennzeichnet sind. Was gilt, steht im
Serviceheft.

Nach den Fahrzeugmerkmalen (Fahrzeugart, Kraftstoff, Antrieb, Getriebe)
sortiert die App in drei Stufen: was ausdruecklich zu diesem Fahrzeug gehoert,
dann das Allgemeine, zuletzt die andere Bauart. Sonst saehe der
Motorradfahrer zuerst Innenraumfilter und Klimaanlage.

Fuer Zweiraeder gibt es zwei eigene Gruppen — *Motor und Fahrwerk*
(Ventilspiel, Gabeloel, Lenkkopf- und Schwingenlager, Synchronisieren) und
*Endantrieb* (Kette, Kardan, Zahnriemen). Das Feld **Fahrzeugart** im
Fahrzeugformular steuert das und laesst sich auch nachtraeglich setzen, wenn
ein Motorrad noch aus der Zeit vor den Zweiradprofilen stammt.

Benoetigte Teile werden beim Uebernehmen automatisch im Katalog angelegt,
sofern sie fehlen.

## Reparaturen

Der Wartungsplan kennt das Wiederkehrende, die Umbauten kennen den Zugewinn —
das Ungeplante hatte keinen Platz. Der Reiter **Reparaturen** schliesst die
Luecke: Anlasser getauscht, Rost an der Heckklappe, Steinschlag.

**Zwei Zustaende**, weil beides vorkommt. „Ist mir aufgefallen" steht mit Datum
und Kilometerstand als **offen** oben im Reiter und auf der Uebersicht; „ist
gemacht" bekommt Datum, Stand, Kosten und Werkstatt und wandert in die
Zeitleiste. Beim Umschalten auf erledigt werden Datum und Stand vorbelegt —
der haeufigste Fall ist „ist jetzt gemacht".

**Optional mit Wartungspositionen verknuepft.** Wer die Bremsscheiben erneuert
hat, muss sie nicht auch noch pruefen: Eine erledigte Reparatur zaehlt in
`lastDone()` wie ein Historieneintrag und setzt die Faelligkeit zurueck.
Offene Reparaturen tun das nicht — sie sind ja nicht gemacht.

**Eine Datenquelle, zwei Ansichten.** Der Reiter zeigt nur Reparaturen, die
Historie zeigt Wartung und Reparatur gemeinsam nach Datum, letztere mit einem
Kennzeichen. Nichts wird doppelt eingetragen. In der Kostenauswertung sind
Reparaturen die dritte Kategorie neben Wartung und Umbauten.

Bilder, Videos, PDF und Teile aus dem Katalog haengen an der Reparatur wie
ueberall sonst — es sind dieselben Bausteine.

## Historie: ein Werkstatttag, eine Karte

Wer am selben Tag Oel wechselt und die Batterie prueft, legt zwei Eintraege an
(oder einen je „Eintragen und naechster"). In der Historie erscheint das als
**eine Karte je Kalendertag**: Kopf mit Datum, Stand, Abstand zum vorigen Termin,
Werkstatt und Kostensumme, darunter eine Zeile je Arbeit — jede mit eigenem
Stiftsymbol, eigener Notiz und eigenen Fotos.

Das ist **nur die Darstellung** (`gruppiereTermine()` in `index.html`). Die
Eintraege selbst bleiben einzeln, ebenso `lastDone()` und der Wartungsplan; es
gibt keine Migration. Weichen die Staende innerhalb eines Tages ab, steht
„von–bis km" im Kopf. Eintraege ohne Datum bleiben einzeln.

## Servicebericht als PDF

Der Knopf **Bericht (PDF)** in der Historie fasst Fahrzeugdaten und alle
erledigten Arbeiten auf wenigen Seiten zusammen — fuer Kaeufer, Werkstatt oder
Versicherung: Kopf mit Fahrzeugfoto, Fahrzeugdaten, Kennzahlen, eine Tabelle
„zuletzt erledigt je Position" mit naechster Faelligkeit, offene Reparaturen,
die Chronik (dieselbe Gruppierung wie die Historie), Umbauten.

**Die Kennzahl „dokumentierte Strecke" ist eine Spanne, keine Laufleistung.**
Gemessen wird `max(km) − min(km)` ueber alle Eintraege — also vom ersten bis
zum letzten Termin. Wer den Wert gegen den Tachostand haelt, findet eine
Differenz und haelt den Bericht fuer falsch; deshalb nennt die Beschriftung
die Spanne selbst („dokumentiert · 20.398 → 77.196 km"), und darunter steht,
was **nicht** belegt ist: die Kilometer vor dem ersten und seit dem letzten
Eintrag. Erst ab 500 km, sonst waere es Rauschen. Ein Nachweis, der seine
Luecken benennt, ist glaubwuerdiger als einer, bei dem der Leser rechnen muss.

**Kein PDF-Generator.** Die App bleibt ohne Bibliotheken und offlinefaehig; der
Bericht ist eine Seite im Vollbild (zugleich die Vorschau), die ueber den
Druckdialog des Browsers als PDF gesichert wird. Schrift und Text bleiben
Vektor, die Datei klein. Der Dateiname wird als
`Servicehistorie_<Fahrzeug>_<Datum>` vorgeschlagen. Seitenzahlen stehen im
Seitenrand, den nur Chromium/Brave kennt — Safari laesst sie weg.

**Am iPhone** laeuft der Weg ueber Teilen → Drucken → mit zwei Fingern auf die
Vorschau aufziehen → PDF sichern; die Vorschau nennt das ausdruecklich.

Vor dem Erzeugen laesst sich waehlen: Kosten, Belegfotos, Umbauten, Offenes und
Faelligkeiten, Kennzeichen und FIN (bei Weitergabe im Netz abschalten). Die
Auswahl merkt sich der Browser. **Nie enthalten:** Fahrzeugpapiere und
Anleitungen. Fotos erscheinen nur mit Server, Videos gar nicht.

`…/#bericht` oeffnet die Vorschau direkt — praktisch fuer automatische Tests
(Headless-Browser, `Page.printToPDF`).

## Dokumente

Fahrzeugpapiere sind etwas anderes als Werkstattanleitungen: Sie haengen an
keiner Wartungsposition, sie laufen ab, und man braucht sie bei einer
Kontrolle. Deshalb ein eigener Reiter und ein eigener Bestand — sonst stuende
die Zulassungsbescheinigung mitten in der Anleitungsliste.

Beim ersten Aufruf stehen die sechs wichtigsten als leere Faecher bereit:
Zulassungsbescheinigung **Teil I** und **Teil II**, **HU-Bericht**,
**Versicherungsschein**, **Schutzbrief** und die **Internationale
Versicherungskarte**. Eigene kommen ueber „+ Eigenes Dokument" dazu.

Je Dokument: Bezeichnung, Nummer, **Gueltig bis**, Notiz, beliebig viele Fotos
und PDF. Laeuft eines in weniger als 60 Tagen ab oder ist es abgelaufen, meldet
sich die **Uebersicht** — ein abgelaufener HU-Bericht kostet mehr als ein
uebersprungener Oelwechsel.

> **Das sind die empfindlichsten Daten der App.** Die Zulassungsbescheinigung
> Teil II ist das Eigentumsdokument, Teil I traegt Name und Anschrift. Sie
> liegen unter `data/`, das nie ins Repository wandert, und sind nur hinter
> Anmeldung und NetBird erreichbar. In die Sicherung gehoeren sie unbedingt —
> in einen Screenshot nie.

## Referenz und Beleg — welche Fotos wohin

Fotos an einer Wartungsposition (`t.photos`) sind **Referenz**: Sie gelten
dauerhaft und fuer jeden kuenftigen Termin — wo sitzt was, welches Werkzeug,
welche Menge. Fotos an einem Historieneintrag (`h.photos`) sind **Beleg**: Sie
gehoeren zu genau diesem Termin.

Beides gab es von Anfang an, nur sah man den Unterschied nicht: Der
Referenzstreifen stand gross ueber dem Verlauf, waehrend die Belege im Verlauf
nur als Zahl „▣ 3" auftauchten. Wer an „Unterboden / Rostvorsorge"
fotografierte, legte die Bilder dorthin, wo sie fuer jede kuenftige Wartung
gelten — und genau das stoerte.

Jetzt traegt der Referenzstreifen eine Ueberschrift, die sagt was er ist, und
der Verlauf zeigt die Belege als **Miniaturen beim jeweiligen Termin**.

**Falsch abgelegte Bilder lassen sich nachtraeglich umziehen:** Im Dialog
„Wartung eintragen" und im Reparaturdialog erscheint „Fotos von der Position
uebernehmen" mit den Referenzbildern der angehakten Positionen. Angeklickte
wandern zu diesem Termin und verschwinden aus der dauerhaften Referenz —
dieselbe Datei, andere Zuordnung.

## Anleitungen

Werkstattunterlagen liegen als PDF unter `data/docs/`, je Fahrzeug getrennt, und
lassen sich einzelnen Wartungspositionen zuordnen — inklusive Startseite, damit
ein dickes Nachschlagewerk direkt an der richtigen Stelle aufgeht. In der Position
erscheinen sie als anklickbare Schaltflaechen.

Verknuepfen laesst sich eine Anleitung an **Wartungspositionen und an Teilen im
Katalog** — das Datenblatt gehoert ans Teil, die Einbauanleitung an die
Position. Beide Dialoge teilen sich denselben Baustein `anleitungFeld()`.

Hochladen geht an drei Stellen: unter *Anleitungen* fuer den ganzen Bestand, und
**direkt im Positions- wie im Teiledialog** im Feld *Anleitungen* — dort laedt
„＋ PDF hochladen" vom Telefon oder Rechner und verknuepft das Dokument in einem
Zug mit dem offenen Eintrag. Sonst muesste man den Dialog verlassen, hochladen und
wiederkommen, nur um dieselbe Verknuepfung von Hand zu setzen.

Angezeigt wird mit den Bordmitteln des Browsers; eine PDF-Bibliothek einzubetten
haette die App um rund ein Megabyte wachsen lassen. Auf iPhone und iPad ist das
Einbetten unzuverlaessig, deshalb gibt es immer auch den Weg ins Vollbild, wo
Safari PDFs sauber mit Zoom und Suche darstellt.

Ausgeliefert wird mit Bereichsabfragen, damit Betrachter einzelne Seiten
nachladen koennen statt ein 10-MB-Dokument am Stueck zu ziehen. Beim Hochladen
prueft der Server die PDF-Signatur, nicht den mitgeschickten Dateityp.

**Vorhandene Unterlagen einlesen:**

```bash
python3 import_docs.py "Toyota Anleitungen"
```

Das Skript kopiert die PDFs, ermittelt Seitenzahlen und schlaegt anhand der
Dateinamen Zuordnungen zu den Wartungspositionen vor (Tabelle `REGELN`).
Einzelne PDFs lassen sich jederzeit ueber die App nachtragen.

> **Werkstattunterlagen sind urheberrechtlich geschuetzt** und gehoeren nicht in
> ein oeffentliches Repository. `.gitignore` schliesst `*.pdf` und die
> Anleitungsordner deshalb grundsaetzlich aus.

## Fotos und Videos

Fotos haengen an vier Stellen: am **Fahrzeug** (das erste Bild steht als Kopf
auf der Fahrzeugkarte), an der **Wartungsposition** (zum Nachschlagen — wo
sitzt was, welches Werkzeug), am **Historieneintrag** (Beleg der Durchfuehrung)
und am **Teil im Katalog** (zum Wiedererkennen — das Teil selbst, die Nummer
auf der Verpackung, die Einbaustelle).

Teilefotos erscheinen als Streifen unter dem Namen, im Teilekatalog **und in
der Einkaufsliste** — beim Bestellen ist das Wiedererkennen am wichtigsten.
Ein Klick oeffnet die grosse Ansicht.

> **Regel, die schon dreimal gebissen hat:** Wer Fotos an einer neuen Stelle
> anhaengt, muss `/api/storage` mitziehen. Das Aufraeumen haelt jede Datei fuer
> verwaist, die es in keinem Eintrag findet. Durchsucht werden inzwischen
> `tasks`, `history`, `parts`, `repairs`, `papiere` und das Fahrzeug selbst —
> fehlt eine Sammlung, loescht „verwaiste Dateien entfernen" genau deren
> Bilder.

Der Browser verkleinert jedes Bild vor dem Hochladen auf 1600 px und wandelt es
in JPEG — aus einem 4-MB-Handyfoto werden rund 300 KB. Zusaetzlich entsteht ein
Vorschaubild. Hochgeladen wird die Datei als reiner Body per `PUT`, damit der
Server ohne multipart-Bibliothek auskommt.

Serverseitig werden Bild-IDs streng geprueft (`f_` plus Hex, optional `_t`),
die JPEG-Signatur kontrolliert und die Groesse begrenzt. Ausgeliefert wird mit
`X-Content-Type-Options: nosniff`.

Unter ⚙ steht der Speicherverbrauch; verwaiste Dateien — also Bilder ohne
zugehoerigen Eintrag — lassen sich dort mit einem Klick entfernen.

**Videos** bis 150 MB werden unveraendert uebernommen — verlustfreies
Umkodieren im Browser waere ohne schwere Bibliothek nicht machbar. Ein
Standbild aus der ersten Sekunde dient als Vorschau. Ausgeliefert wird mit
Bereichsabfragen, sonst laesst Safari weder Abspielen noch Vorspulen zu.

Auswaehlen lassen sich Dateien aus Galerie und Dateisystem oder direkt
ueber die Kamera.

`data/photos/` gehoert in die Sicherung.

## Health-Check

`/api/health` beantwortet nicht nur die Frage, ob der Prozess lebt:

```jsonc
{ "ok": true, "status": "gesund",
  "lesbar": true,        // data.json vorhanden und gültig
  "schreibbar": true,    // Datenverzeichnis beschreibbar
  "fahrzeuge": 1, "revision": 12, "versionen": 8, "laufzeit": "3612s" }
```

Ist eines von beidem nicht erfüllt, liefert der Endpoint **HTTP 503** und der
Container erscheint in Dockhand als `unhealthy`. Damit fällt der häufigste
Betriebsfehler sofort auf: falsche Verzeichnisrechte nach dem ersten Deploy.

```bash
docker inspect --format '{{.State.Health.Status}}' carservice
docker logs carservice --tail 20
```

## Datensicherung

Jeder Schreibvorgang legt die vorherige Fassung in `data/versions/` ab (die letzten 40).
Nimm zusätzlich `data/` in Nextcloud oder Synology Drive auf — dann liegt alles doppelt.
Unabhängig davon exportiert die App unter ⚙ → *JSON sichern* jederzeit eine Kopie.

## Datenformat

```jsonc
{ "version": 2, "rev": 12, "activeId": "v_hilux",
  "vehicles": [ { "id": "v_hilux", "brand": "Toyota", "name": "Hilux Extra Cab",
                  "model": "…", "year": 2023, "vin": "", "plate": "", "firstReg": "…",
                  "km": 77196, "kmDate": "…",
                  "tasks": [], "parts": [], "history": [], "mods": [] } ] }
```

Version 1 kannte nur ein Fahrzeug und legte dessen Daten direkt in die Wurzel.
Solche Dateien werden beim Laden automatisch und verlustfrei umgeschrieben —
sowohl aus `data.json` als auch beim Import einer alten Sicherung.

## Umstieg von einer Excel-Liste

`convert_excel.py` liest eine gewachsene Inspektionstabelle ein und verteilt sie
auf das Datenmodell. Die Tabelle selbst gehoert **nicht** ins Repository —
sie enthaelt Fahrzeugdaten. Leg sie neben das Skript oder gib den Pfad an.

Erwartet werden die Spalten Datum, Kilometerstand, Wartungsarbeit, Notizen und
Teilenummer. **Überschreibt alle Änderungen aus der App:**

```bash
python3 convert_excel.py [tabelle.xlsx] --force
```

Der Konverter erkennt Datum, Kilometerstand und Arbeit, ordnet die Arbeit über
Stichwörter der passenden Wartungsposition zu (Tabelle `MAP` in `convert_excel.py`),
zieht Links aus der Notizspalte und trennt Umbauten von Wartung.

## Lokal ausprobieren

```bash
DATA_DIR=./data PUBLIC_DIR=./app PORT=8099 node server.js
```

## Wenn zwei Geräte gleichzeitig schreiben

Der Server zählt bei jedem Speichern eine Revisionsnummer hoch. Schickt ein Gerät
einen veralteten Stand, lehnt er ab (HTTP 409) und die App meldet den Konflikt,
statt die neueren Daten stillschweigend zu überschreiben.
