# One80 – Projekt-Kontext (CLAUDE.md)

> Diese Datei ist das zentrale Gedächtnis für die Arbeit an One80. Sie wird bei jeder
> Session in diesem Ordner automatisch als Kontext geladen. **Bitte aktuell halten**,
> wenn sich Architektur, Datenmodell oder Konventionen ändern.

Stand dieser Datei: 2026-07-18

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
- Eigene Schriftart **Manrope** (`fonts/manrope-latin.woff2`).
- Keine externen Runtime-Dependencies im Web-Teil (alles selbst gehostet, offline-fähig).

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
│  ├─ games.js             Games: Play-Tab + alle Match-Spielmodi (inkl. Bot)
│  ├─ training.js          Training: alle Trainingsmodi (TRAIN_DEFS)
│  ├─ stats.js             Stats: Statistik-Tab, Erfolge/Abzeichen (ACH), Aufzeichnung
│  ├─ tournament.js        Tour: Turniere (KO / Liga / Gruppen+KO)
│  ├─ friends.js           Friends: Share-Code Export/Import, Vergleich
│  └─ app.js               App: Navigation, Profile, Einstellungen, Backup, Dart-Welt; boot()
├─ fonts/                  Manrope woff2  ⚠️ aktuell NICHT in Git (siehe Abschnitt 10)
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
| `Games`     | games.js      | Play-Tab, Match-Logik aller Spielmodi |
| `Training`  | training.js   | Trainings-Tab und -Modi |
| `Stats`     | stats.js      | Statistik-Tab, Erfolge, Ergebnis-Aufzeichnung |
| `Tour`      | tournament.js | Turnier-Tab |
| `Friends`   | friends.js    | Freunde-Tab (Share-Codes) |
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

1. **Service Worker aktualisieren:** Bei jeder Änderung an Dateien im Cache **`VERSION` in
   `sw.js` hochzählen** (aktuell `one80-v2`) und **neue Dateien in die `ASSETS`-Liste** aufnehmen.
   Sonst sehen installierte Nutzer alte Stände (Cache-First!).
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
   hell/dunkel). Board-Farben: Rot `--red`, Grün `--green`, Akzent `--accent`, Gold `--gold`.
8. **Persistenz:** Nach jeder State-Mutation `Store.save()` aufrufen.

---

## 8. Aktueller Feature-Stand (implementiert)

**Match-Spielmodi** (`games.js`, `GAME_DEFS`):
- **X01** – voll konfigurierbar (Start 101–1001, Sets/Legs, Double/Master/Straight-Out,
  Double-In), 1–8 Spieler, **Bot-Gegner** mit einstellbarem Average, Resume laufender Matches.
- **Cricket** – Standard & Cut-Throat.
- **Around the Clock**, **Shanghai**, **Killer**, **Halve It**.

**Eingabemethoden** (`input.js`) – im Spiel umschaltbar:
- **Board** (SVG-Dartboard zum Antippen, `UI.boardSVG`), **Keys** (Zahlenfeld pro Dart),
  **Sum** (Rundensumme). Undo unterstützt.

**Trainingsmodi** (`training.js`, `TRAIN_DEFS`):
- `doubles` (Doppel-Training), `double_single`, `checkout`, `ladder` (170-Leiter),
  `scoring`, `bobs27` (Bob's 27), `jdc` (JDC Challenge), `catch40`.
- Ergebnisse fließen ins Profil (Bestwerte + Verlaufskurven).

**Statistiken & Profile** (`stats.js`, `app.js`):
- Beliebig viele Profile (Name + Emoji-Avatar).
- Averages, Checkout-Quote, 180er/140+/100+, bestes Leg, Formkurven (`UI.lineChart`),
  **Treffer-Heatmap** aufs Board.
- **Erfolge/Abzeichen** (`ACH`, ~20 Stück) mit Fortschrittsanzeige.

**Turniere** (`tournament.js`): KO-Baum, Liga/Round-Robin (Tabelle), Gruppen + KO.

**Freunde** (`friends.js`): Profil als **Share-Code** exportieren/importieren, Vergleichsansicht
– serverlos.

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

- ⚠️ **`fonts/` ist nicht in Git** (`git status` zeigt es als untracked) **und** wird im
  APK-Workflow **nicht** nach `www/` kopiert. `index.html` preloaded aber
  `fonts/manrope-latin.woff2` und `sw.js` cached sie. Folge: In der APK (und ggf. auf einem
  frisch geklonten Deploy) fehlt die Schrift → Fallback-Font / 404.
  **Fix:** `fonts/` committen und im `cp`-Schritt von `build-apk.yml` `fonts` ergänzen
  (in `sw.js`-ASSETS ist die Datei bereits gelistet).
- **Uncommittete Änderungen:** Beim Start dieser Doku waren viele Dateien modifiziert, aber
  nicht committet (`css/style.css`, `index.html`, `js/*`, `manifest.json`, `sw.js`). Vor
  größeren Umbauten Stand sichern/committen.
- `SPEC.md` beschreibt noch nicht Umgesetztes (z. B. QR-Codes für Freunde, echtes Online-System,
  eingebettete Web-Bereiche statt Absprung). Vor „ist das schon da?" den Code prüfen, nicht die Spec.

---

## 11. Git

- Branch: `main` (Push löst APK-Build aus).
- Bisherige Commits: „One80: All-in-One Dart Counter & Training PWA", „APK-Build-Workflow".
- `.gitignore` vorhanden; `www/`, `android/`, `node_modules/` gehören nicht ins Repo.
