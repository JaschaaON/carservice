# Overlandvibe Carservice

Wartungsplan, Teilekatalog und Historie für **beliebig viele Fahrzeuge**.
Ein Projekt von [overlandvibe.com](https://overlandvibe.com).
Ersetzt die Excel-Liste durch eine Übersicht, die selbst ausrechnet, was als Nächstes ansteht.
Angelegt ist der Toyota Hilux Extra Cab (2023, 2.8 D-4D, Automatik, 4x4).

## Was sie kann

| Bereich | Zweck |
|---|---|
| **Fahrzeuge** | Alle Fahrzeuge mit Statuszeichen, Halter und nächster Fälligkeit |
| **Übersicht** | Statusring, Zeitstrahl der nächsten zwölf Monate, Einkaufsliste |
| **Wartungsplan** | Positionen mit Intervall nach km *und* Zeit, Teilebedarf, Verlauf, „erledigt"-Eintrag |
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

`service.example.com` in Safari oeffnen (NetBird aktiv), dann Teilen →
**Zum Home-Bildschirm**.

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

## Markenprofile

Beim Anlegen eines Fahrzeugs laesst sich ein Markenprofil waehlen: VW-Konzern
(LongLife oder Festintervall), BMW/Mini, Mercedes-Benz, Ford, Stellantis
(Opel, Peugeot, Citroën, Fiat), Toyota/Lexus, Hyundai/Kia/Mazda/Suzuki/Honda,
Renault/Dacia/Nissan und Volvo. Tippt man die Marke ein, schlaegt die App das
passende Profil selbst vor.

Ein Profil erzeugt einen Plan aus einem gemeinsamen Sockel (Oel, Filter,
Bremsen, Fahrwerk …) plus antriebs- und markenspezifischen Positionen. Es
richtet sich dabei nach den Fahrzeugmerkmalen: DSG-Oelwechsel erscheint nur bei
Doppelkupplungsgetriebe, Haldex nur bei Allrad, Zuendkerzen nur bei Benzinern.

> **"Den" Inspektionsplan einer Marke gibt es nicht.** Innerhalb eines
> Herstellers unterscheiden sich die Vorgaben nach Motor, Baujahr und
> Serviceart — ein VW mit LongLife-Service hat andere Intervalle als derselbe
> Wagen mit Festintervall, und Zahnriemenintervalle schwanken je Motorcode um
> zehntausende Kilometer. Die Profile bilden die typische **Struktur** einer
> Marke ab und tragen Groessenordnungen ein, die jede erzeugte Position als
> Vorschlag kennzeichnet. Verbindlich ist das Serviceheft des Fahrzeugs.

Zwei Punkte, die in den Profilen bewusst hervorgehoben sind, weil sie teuer
werden koennen: der **Nassriemen** bei Ford EcoBoost/EcoBlue und Stellantis
PureTech — die Werksangabe von bis zu 240.000 km gilt als zu optimistisch —
sowie die Bindung des VW-LongLife-Intervalls an freigegebenes Longlife-Oel.

## Bausteinbibliothek

Statt fertiger Herstellerplaene bietet die App **einzelne Wartungspositionen zum
Auswaehlen** — im Wartungsplan ueber *Aus Bibliothek*. Gegliedert nach Technik
statt nach Marke, denn ein DSG sitzt in VW, Audi, Škoda und Seat gleichermassen.

Das ist Absicht: Belastbare Werksintervalle fuer jeden Hersteller liegen mir
nicht vor, und ein falsch hinterlegter Zahnriemenwechsel kostet einen Motor.
Die Bibliothek liefert deshalb **Vorschlagswerte aus der Praxis**, die beim
Uebernehmen sichtbar als solche gekennzeichnet sind. Was gilt, steht im
Serviceheft.

Nach den Fahrzeugmerkmalen (Kraftstoff, Antrieb, Getriebe) sortiert die App
passende Gruppen nach oben. Benoetigte Teile werden beim Uebernehmen automatisch
im Katalog angelegt, sofern sie fehlen.

## Anleitungen

Werkstattunterlagen liegen als PDF unter `data/docs/`, je Fahrzeug getrennt, und
lassen sich einzelnen Wartungspositionen zuordnen — inklusive Startseite, damit
ein dickes Nachschlagewerk direkt an der richtigen Stelle aufgeht. In der Position
erscheinen sie als anklickbare Schaltflaechen.

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
