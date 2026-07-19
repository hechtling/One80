# One80 – Projekt-Kontext (CLAUDE.md)

> Diese Datei ist das zentrale Gedächtnis für die Arbeit an One80. Sie wird bei jeder
> Session in diesem Ordner automatisch als Kontext geladen. **Bitte aktuell halten**,
> wenn sich Architektur, Datenmodell oder Konventionen ändern.

Stand dieser Datei: 2026-07-19 (nach dem „Club"-Redesign)

---

## 1. Was ist One80?

Eine **All-in-One-Dart-App** fürs Handy: Zähler (X01, Cricket u. a.), Trainingsmodi,
Statistiken/Profile, Turniere und Freunde-Vergleich. Komplett **offline**, alle Daten
bleiben lokal auf dem Gerät (kein Konto, keine Cloud).

Ausgeliefert wird sie auf zwei Wegen:
- **PWA** (installierbare Web-App, „Zum Startbildschirm hinzufügen") – der Hauptweg.
- **Android-APK**, automatisch per Capacitor + GitHub Actions gebaut.

Die vollständige Feature-Spezifikation steht in [`SPEC.md`](SPEC.md); der Nutzertext in
[`README.md`](README.md). **Wichtig:** Nicht alles aus `SPEC.md` ist schon umgesetzt –
der reale Stand steht unten in Abschnitt 8.

---

## 2. Schnellstart (lokal testen)

Keine Build-Toolchain nötig – reines HTML/CSS/JS.

```bash
# im Projektordner einen kleinen Webserver starten (irgendeiner reicht), z. B.:
python -m http.server 8080
#   → http://localhost:8080 im Browser öffnen
```

> Direkt per `file://` öffnen funktioniert eingeschränkt: Der **Service Worker**
> registriert sich nur unter `https:`, `localhost` oder `127.0.0.1` (siehe `app.js` → `boot()`).
> Zum Testen also immer über einen lokalen Server gehen.

Mobile-Ansicht im Browser-DevTools aktivieren (die App ist primär für Hochkant-Handy gebaut).

---

## 3. Tech-Stack

- **Vanilla JS** (ES-Module-Pattern über IIFEs, keine Frameworks, keine Bundler).
- **CSS** in einer Datei (`css/style.css`), Theming über CSS-Variablen + `data-theme` am `<html>`.
- **PWA**: `manifest.json` + Service Worker (`sw.js`, Cache-First).
- **Capacitor 7** für die Android-APK (`capacitor.config.json`, `package.json`).
- Eigene Schriftart **DM Sans** (Variable Font, `fonts/dmsans-latin.woff2`, selbst gehostet).
- Keine externen Runtime-Dependencies im Web-Teil (alles selbst gehostet, offline-fähig).

### Design „Club" (seit 2026-07)

Das UI folgt der Design-Referenz aus dem Handoff (`README[1].md` + `One80 Prototyp.dc.html`,
im Claude-Projekt „Dartapp" abgelegt): dunkelgrün, weiche Radien, cremefarbene Typo, **keine Emojis**.

- **Tokens** (CSS-Variablen in `style.css`, je Theme dunkel/hell): `--bg`, `--s1` (Karten),
  `--s2` (erhöhte Fläche), `--ln` (Hairlines), `--tx`, `--mut`, `--mut2`, `--dim`,
  `--red`, `--grn`/`--grnT` (Akzent), `--onGrn`, `--btn`/`--onBtn` (invertierter Primär-Button),
  `--nav`, `--dash`, `--scrim`, `--gold` (nur Erfolge/Toast).
- **Avatare**: Initialen-Kreise (`UI.avatar(name, size)` / `UI.initials`), keine Emoji-Avatare mehr
  (`profile.emoji` existiert in Alt-Daten noch, wird aber nirgends mehr angezeigt).
- **Icons**: geometrische Stroke-SVGs (`UI.ic`, 22×22, stroke 1.8) bzw. Text-Badges
  (Kreis 44 px mit Kürzel: `01`, `CR`, `CO`, `T20` …). Keine Emojis im UI.
- Wichtige Klassen: `.mrow`/`.rrow` (Listenzeilen), `.badge`, `.chip`(+`.avc`), `.seg`,
  `.resume`, `.mcard`/`.slots`/`.copill`/`.kgrid`/`.key` (Match), `.tiles`/`.tile`/`.fbars` (Statistik),
  `.wincard`/`.winback` (Match-Ende-Overlay), `.shead`/`.cbtn` (Unterseiten-Header), `.mlabel` (Abschnitts-Label).
- Zahlenformat: Deutsch mit Komma (`UI.f1` ist sprachabhängig).

---

## 4. Projektstruktur

```
One80/
├─ index.html              App-Shell: <main id="view">, Bottom-Nav, lädt alle JS-Dateien
├─ manifest.json           PWA-Manifest (Icons, Farben, standalone/portrait)
├─ sw.js                   Service Worker – Offline-Cache (VERSION + ASSETS-Liste!)
├─ capacitor.config.json   Capacitor: appId com.one80.app, webDir "www"
├─ package.json            Capacitor-Dependencies (nur für den APK-Build)
├─ css/
│  └─ style.css            komplettes Styling + Theming (CSS-Variablen)
├─ js/                     Reihenfolge = Ladereihenfolge in index.html
│  ├─ i18n.js              t()-Übersetzungen (DE + EN)
│  ├─ store.js             Store: zentrale Datenhaltung (localStorage)
│  ├─ ui.js                h()-Helper, UI (Modal/Toast/Charts), Dartboard-SVG, DartMath
│  ├─ input.js             Input: umschaltbare Eingabe (Board / Zahlen / Rundensumme)
│  ├─ games.js             Games: Play-Tab, X01 + Basis-Spielmodi, Casual-Shell (runCasual)
│  ├─ games-extra.js       weitere Match-Modi, meldet sich per Games.register() an
│  ├─ training.js          Training: Trainings-Tab, trainShell + Basis-Modi (TRAIN_DEFS)
│  ├─ training-extra.js    weitere Trainingsmodi, meldet sich per Training.register() an
│  ├─ stats.js             Stats: Statistik-Tab, Erfolge/Abzeichen (ACH), Aufzeichnung
│  ├─ tournament.js        Tour: Turniere (KO / Liga / Gruppen+KO)
│  ├─ qr.js                QR: Encoder (Byte-Modus, V1–40) + SVG-Ausgabe + Kamera-Scanner
│  ├─ friends.js           Friends: Share-Code/QR Export/Import, Vergleich
│  └─ app.js               App: Navigation, Profile, Einstellungen, Backup, Dart-Welt; boot()
├─ fonts/                  DM Sans woff2 (dmsans-latin.woff2)
├─ assets/                 Quell-Icons/Splash für @capacitor/assets (Icon-Generierung)
├─ icons/                  fertige PWA-Icons (192/512)
└─ .github/workflows/
   └─ build-apk.yml        CI: baut & released die Android-APK
```

---

## 5. Architektur

**Ein globaler Namespace pro Modul**, jeweils als IIFE, das ein Objekt zurückgibt.
Kommunikation läuft über diese Globals (keine Imports):

| Global      | Datei         | Rolle |
|-------------|---------------|-------|
| `App`       | app.js        | Navigation, Profile, Settings, Backup, Boot |
| `Games`     | games.js (+ games-extra.js)       | Play-Tab, Match-Logik aller Spielmodi |
| `Training`  | training.js (+ training-extra.js) | Trainings-Tab und -Modi |
| `Stats`     | stats.js      | Statistik-Tab, Erfolge, Ergebnis-Aufzeichnung |
| `Tour`      | tournament.js | Turnier-Tab |
| `Friends`   | friends.js    | Freunde-Tab (Share-Codes, QR-Links) |
| `QR`        | qr.js         | QR-Code erzeugen (`matrix`/`svgString`) und scannen (`scan`) |
| `Store`     | store.js      | State + localStorage-Persistenz |
| `UI`        | ui.js         | Modal, Toast, Confirm, Charts, Dartboard, Sound/Caller, Icons |
| `Input`     | input.js      | Eingabe-Widget (Board/Keys/Sum) |
| `DartMath`  | ui.js         | Dart-Mathematik: Keys, Checkout-Berechnung, Validierung |
| `h(...)`    | ui.js         | Hyperscript-Helper zum DOM-Bauen |
| `t(...)`    | i18n.js       | Übersetzung |

**Rendering-Modell** (in `app.js`):
- Ein einziger Container `#view`. Fünf Tabs: `play`, `training`, `stats`, `tour`, `more`.
- Jeder Tab hat eine `renderTab(view)`-Funktion; „mehr"-Tab wird in app.js gerendert.
- **Navigation per Stack**: `App.show(fn)` pusht eine Render-Funktion (Unterseite),
  `App.back(n)` poppt, `App.root(tab)` setzt zurück auf einen Tab, `App.rerender()` zeichnet neu.
- Kein Router, keine URL-Änderung – alles im Speicher.
- `App.gameMode(true/false)` schaltet Vollbild-Spielmodus (Bottom-Nav aus) via Body-Klasse.

**DOM bauen** mit `h(tag, attrs, ...kids)`:
- `class`, `style` (als `cssText`), `html` (innerHTML), `on<Event>` (Listener), sonst Attribut.
- Kinder werden geflacht; `null`/`false`/`undefined` werden übersprungen.
- Beispiel: `h('div', { class: 'card', onClick: fn }, h('span', null, 'Text'))`.

---

## 6. Datenmodell (Store)

Persistiert unter **localStorage-Key `one80.state.v1`** (siehe `store.js`).
`Store.save()` ist entprellt (120 ms); `Store.saveNow()` schreibt sofort (z. B. bei Export).

```js
state = {
  settings: {
    theme: 'dark'|'light', lang: 'de'|'en',
    caller: bool, sfx: bool, vibrate: bool,
    input: 'board'|'keys'|'sum',
    x01: { start, out:'double'|'master'|'straight', din:bool, legs, sets }
  },
  profiles: [ Profile ],
  matches:  [ ... ],   // Match-Zusammenfassungen (Historie)
  friends:  [ ... ],   // importierte Freunde-Snapshots
  tournaments: [ ... ],
  active: null | { kind:'x01', st, ... }   // laufendes Spiel zum Fortsetzen
}
```

**Profile** (`Store.newProfile`):
```js
{
  id, name, emoji, color, created,
  agg: {                       // Aggregat-Statistiken
    matches, wins, legs, legsWon,
    darts, points, f9darts, f9points,
    coHits, coAtt, hiFinish,
    n180, n140, n100, n60,
    bestLeg, tourWins,
    doubles: { 'D20': { a: att, h: hits }, ... },
    heat:    { 'T20': count, ... }          // Treffer-Heatmap
  },
  trainings:   { <mode>: { best, series:[{d,v}] } },
  achievements:{ <id>: dateEarned },
  trainDays:   [ 'YYYY-MM-DD', ... ],        // für Streaks
  history:     [ { d, mode, avg, co, win } ]
}
```

Hilfsfunktionen: `Store.avgOf(agg)` (3-Dart-Ø), `Store.coPct(agg)` (Checkout-Quote),
`Store.trainStreak(p)`, `Store.addTraining(p, mode, value, higherIsBetter)`.

> Hinweis: `stats.js` liest teils Felder, die nicht in `emptyAgg()` vorinitialisiert sind
> (`agg.bestAvg`, `p.ladderLevel`). Werte werden dort per `|| 0` abgefangen – beim Erweitern
> der Statistik hier konsistent bleiben und Felder ggf. in `emptyAgg()` ergänzen.

---

## 7. Konventionen & Fallstricke (WICHTIG beim Ändern)

1. **Service Worker:** Strategie ist **Network-First mit 3 s Timeout** (seit `one80-v5`):
   online kommt immer der aktuelle Stand, offline der Cache. Bei neuen Dateien trotzdem
   **`VERSION` hochzählen** (aktuell `one80-v9`) und die Datei in die `ASSETS`-Liste aufnehmen,
   damit sie beim Install vorgecacht wird (Offline-Fähigkeit).
   > Vorher war es Cache-First – dadurch sahen installierte Nutzer nach Änderungen noch
   > tagelang alte Stände. Falls doch mal etwas hängt: PWA-Cache leeren bzw. App-Daten löschen.
2. **Neue JS-Datei?** An drei Stellen eintragen: `<script>` in `index.html` (richtige
   Reihenfolge!), `ASSETS` in `sw.js`, und ggf. der `cp`-Befehl in `build-apk.yml`.
3. **i18n:** Jeder neue sichtbare Text braucht einen Key in **beiden** Sprachen (`de` und `en`)
   in `i18n.js`. Zugriff über `t('key')`, Platzhalter über `t('key', { n: 5 })`.
   Dart-Fachbegriffe (Double, Checkout, Leg …) bleiben bewusst englisch.
4. **Dart-Keys** (DartMath): Segmente heißen `S<n>`, `D<n>`, `T<n>` (1–20), Bull `SB` (25),
   Bullseye `DB` (50), Fehlwurf `MISS`. `DartMath.fromKey(key)` → `{v, m, score, ring, key}`.
5. **Checkout-Rechner:** `DartMath.checkout(rest, dartsLeft, out)` liefert Wegvorschlag oder `null`.
6. **Kein `innerHTML` für Nutzereingaben** – DOM über `h()` bauen (XSS-Schutz, Konsistenz).
7. **Styling** nur über bestehende CSS-Variablen/Klassen in `style.css` (Theme-Kompatibilität
   hell/dunkel). Akzent ist Grün `--grn`; `--red` nur für Bull-Taste/Warnungen; `--gold` nur Erfolge.
   **Keine Emojis** in UI-Texten – Stroke-Icons (`UI.ic`) oder Text-Badges verwenden.
8. **Persistenz:** Nach jeder State-Mutation `Store.save()` aufrufen.
9. **X01-Ablauf:** `Games`-Engine trennt Aufnahme-Ende und Weiterschalten: `endVisit()` liefert
   das Event, das UI zeigt ~0,9–1,15 s den Endstand (Eingabe gesperrt), erst `advance(st, ev)`
   räumt die Aufnahme ab / baut das nächste Leg auf. Undo (`⌫`, Header & Keypad) stellt über
   Snapshots auch über Spielerwechsel/Bust/Leg-Ende hinweg zurück und bricht den Pending-Timer ab.
10. **Match verlassen:** ✕ im Match beendet NICHT, sondern geht zurück zur Übersicht –
    das Match bleibt in `state.active` und erscheint auf der Home-Resume-Karte.
    (Nur Turnier-Matches fragen nach und verwerfen.)
11. **Neuen Spielmodus ergänzen** → in `games-extra.js`, nicht in `games.js`:
    `new<X>(cfg)` (State mit `players`, `cur`, `visitDarts`, `over`, `winnerIdx`),
    `<x>Dart(st, d)` → `{toast?, say?}`, `render<X>(st, el)`, dann Eintrag mit
    `cat`/`badge`/`name`/`desc`/`go` an `Games.register`. Bausteine kommen aus `Games`
    (`runCasual`, `nextTurn`, `visitRow`, `pRow`, `targetCard`, `simpleConfig`, `segPick`).
    ⚠️ `runCasual` rendert **nach** dem letzten Dart und **vor** dem Sieger-Overlay – Render-Funktionen
    müssen Rundenindizes deshalb klemmen (`Math.min(st.ridx, SEQ.length - 1)`), sonst crasht das Spielende.
12. **Neuen Trainingsmodus ergänzen** → in `training-extra.js`:
    `Training.trainShell(profile, mode, session, restart)` mit
    `session = { st, title, label(), status(), progress(), dart(d), summary(), extra?, timeLimit? }`,
    dann Eintrag an `Training.register`. `timeLimit` (Sekunden) blendet einen Countdown ein, der
    mit dem ersten Dart startet. `summary().value` muss eine **Zahl** sein;
    `higherBetter: false` setzen, wenn kleinere Werte besser sind.
    `st` muss JSON-serialisierbar bleiben – das Undo arbeitet mit Snapshots.

---

## 8. Aktueller Feature-Stand (implementiert)

**Match-Spielmodi** (`games.js`, `GAME_DEFS`):
- **X01** – Setup nach Design (301/501/701, Best of 3/5/7 Legs, Double-Out-Switch;
  unter „Erweitert": Out-Modus Double/Master/Straight, Sets, Double-In), 1–6 Spieler,
  **Bot-Gegner** mit einstellbarem Average, Resume laufender Matches (Home-Resume-Karte).
  Match-Screen nach Prototyp: aktive Spieler-Karte (Rest groß, Ø, Darts, Leg-Punkte),
  Gegner-Zeilen, Aufnahme-Slots, Checkout-Pill, Kreis-Keypad mit Single/Double/Triple-Segmenten,
  Match-Ende-Overlay (Revanche/Fertig + Match-Statistik).
- **Cricket** – Standard & Cut-Throat.
- **Around the Clock**, **Shanghai**, **Killer**, **Halve It**.
- Aus `games-extra.js` (registriert über `Games.register`): **Gotcha**, **Nine Dart Shootout**,
  **Sudden Death**, **Mickey Mouse**, **Bermuda**, **Baseball**, **Golf**, **High-Low**,
  **Tic-Tac-Toe**. Zusammen 15 Modi, im Play-Tab in drei aufklappbare Kategorien gruppiert
  (`GAME_CATS`: `count` / `classic` / `fun`; Zustand in `settings.gameOpen`).
- Spieler-Auswahl überall über Chips (`Games.playerPicker`): Profile antippen,
  „+ Neu" legt inline ein Profil an; das frühere Gast-Konzept ist entfallen
  (Profile übernehmen das), Bots nur bei X01.

**Eingabemethoden** (`input.js`) – im Spiel umschaltbar:
- **Board** (SVG-Dartboard zum Antippen, `UI.boardSVG`), **Keys** (Zahlenfeld pro Dart),
  **Sum** (Rundensumme). Undo unterstützt.

**Trainingsmodi** (`training.js` + `training-extra.js`, `TRAIN_DEFS`) – 26 Modi, im Trainings-Tab
in fünf aufklappbare Kategorien gruppiert (`TRAIN_CATS`, Zustand in `settings.trainOpen`):
- **Checkout & Doppel** (`co`): `checkout`, `doubles`, `double_single`, `bobs27`,
  `c121` (121-Challenge), `dkiller` (Doppel-Killer), `co_speed` (Speed-Checkout, auf Zeit).
- **Scoring & Präzision** (`score`): `scoring`, `highscore`, `t20streak` (Treble Hunter),
  `five_in_five` (51 in 5), `splitscore`, `bull_tr`, `tictactoe`.
- **Klassiker** (`classic`): `atc_solo`, `shanghai_tr`, `cricket_solo`, `halve_solo`,
  `dragon` (Chase the Dragon), `nine_lives`.
- **Warm-up & Routinen** (`warm`): `warmup`, `rundlauf` (auf Zeit), `mulligan`.
- **Challenges** (`challenge`): `ladder` (170-Leiter), `jdc`, `catch40`.
- Ergebnisse fließen ins Profil (Bestwerte + Verlaufskurven). Modi mit
  `summary().higherBetter: false` (z. B. alle „möglichst wenige Darts"-Modi) werten kleinere
  Werte als Bestleistung.

**Statistiken & Profile** (`stats.js`, `app.js`):
- Beliebig viele Profile (Name + Emoji-Avatar).
- Averages, Checkout-Quote, 180er/140+/100+, bestes Leg, Formkurven (`UI.lineChart`),
  **Treffer-Heatmap** aufs Board.
- **Erfolge/Abzeichen** (`ACH`, ~20 Stück) mit Fortschrittsanzeige.

**Turniere** (`tournament.js`): KO-Baum, Liga/Round-Robin (Tabelle), Gruppen + KO.

**Freunde** (`friends.js`, `qr.js`): Profil als **Share-Code** exportieren/importieren,
Vergleichsansicht – serverlos. Drei Wege, sich zu adden:

1. **QR-Code** – der Freunde-Tab zeigt den eigenen Code als QR. Inhalt ist ein Link
   `https://hechtling.github.io/One80/#f=<base64url>` (Konstante `HOME` in `friends.js`;
   läuft die App unter `http(s)`, wird die Basis stattdessen aus `location` abgeleitet).
   Dadurch funktioniert auch jede fremde Kamera-App: Scan → App öffnet sich → Rückfrage → Import.
2. **In-App-Scanner** – Button „QR-Code scannen" öffnet `QR.scan()` (getUserMedia +
   `BarcodeDetector`). Ohne Unterstützung wird der Button ausgeblendet und nur das
   Einfügefeld gezeigt. Funktioniert offline, also auch ohne erreichbare Website.
3. **Textcode / Link teilen** – wie bisher, per WhatsApp o. Ä.

`Friends.handleLink()` wird in `App.boot()` und bei `hashchange` aufgerufen und wertet
`#f=…` aus. `normalize()` akzeptiert alle Formen: Link (base64url **und** prozent-kodiert),
rohen `ONE80.`-Code und Codes mitten im Fließtext.

**QR-Encoder** (`qr.js`): eigenständig, keine Dependencies. Byte-Modus, Versionen 1–40,
alle vier Fehlerkorrekturstufen, Reed-Solomon, automatische Maskenwahl nach ISO 18004.
Gegen `segno` verifiziert (alle 40 Versionen × 4 Stufen modul-identisch). `QR.svgString()`
liefert fertiges SVG; die Ausgabe braucht wegen des Kontrasts eine weiße Fläche (`.qrbox`).

**Drumherum** (`app.js`, `ui.js`):
- Theme hell/dunkel, Sprache DE/EN, Sound-Effekte + **Sprach-Caller** („One hundred and eighty!"),
  Vibration, **Wake-Lock** (Bildschirm bleibt an), **JSON-Backup** Export/Import,
  Tab **„Dart-Welt"** (externe Links: PDC, dartn.de, Flashscore, 2k-dart-software).

---

## 9. Build & Deploy

**PWA (Hauptweg):** Dateien werden direkt gehostet (z. B. GitHub Pages – `.nojekyll` ist vorhanden).
Nutzer öffnen die Seite und wählen „Zum Startbildschirm hinzufügen".

**Android-APK** (`.github/workflows/build-apk.yml`, Trigger: Push auf `main` oder manuell):
1. Web-Dateien werden nach `www/` kopiert: `index.html manifest.json sw.js css js icons`.
2. `npx cap add android`, Icons/Splash via `@capacitor/assets` (Quellen aus `assets/`).
3. `npx cap sync android`, dann `./gradlew assembleDebug`.
4. Ergebnis `One80.apk` wird als Artifact **und** als GitHub-Release (Tag `apk`) veröffentlicht.

> `capacitor.config.json` → `webDir: "www"`. Der `www`-Ordner existiert nur im CI (wird dort
> erzeugt) – **nicht** ins Repo committen. Beim lokalen Kapazitor-Build denselben Copy-Schritt
> manuell ausführen.

---

## 10. Offene Punkte / bekannte Baustellen

- `fonts/` ist committet und wird im APK-Workflow nach `www/` kopiert (erledigt 2026-07-19).
- Alt-Daten: `profile.emoji`/`color` können in bestehenden States noch vorkommen,
  werden aber nirgends mehr angezeigt (Initialen-Avatare). Beim Datenmodell-Aufräumen ignorieren.
- Beim X01-Setup sind die Startpunkte aufs Design reduziert (301/501/701; 201 entfiel).
- `SPEC.md` beschreibt noch nicht Umgesetztes (z. B. echtes Online-System, eingebettete
  Web-Bereiche statt Absprung). Vor „ist das schon da?" den Code prüfen, nicht die Spec.
- **QR-Link hängt an `HOME`** in `friends.js`. Zieht die App auf eine andere Domain um,
  muss diese Konstante mit – sonst zeigen alte QR-Codes ins Leere. Der In-App-Scanner ist
  davon nicht betroffen.
- Der Scanner braucht `BarcodeDetector` (Android/Chrome vorhanden, iOS-Safari nicht) und
  im APK die Kamera-Berechtigung – die trägt ein eigener Schritt in `build-apk.yml` nach,
  weil `npx cap add android` das Manifest in der CI jedes Mal neu erzeugt.
- Design-Referenzen (maßgeblich bei UI-Fragen): `README[1].md` und `One80 Prototyp.dc.html`
  im Claude-Projekt „Dartapp".

---

## 11. Git

- Branch: `main` (Push löst APK-Build aus).
- Bisherige Commits: „One80: All-in-One Dart Counter & Training PWA", „APK-Build-Workflow".
- `.gitignore` vorhanden; `www/`, `android/`, `node_modules/` gehören nicht ins Repo.
