# One80 – Die All-in-One Dart-App

Stand: 2026-07-05 · Spezifikation besprochen und festgelegt, dient als Grundlage für die Implementierung.

## Technik

- **PWA (Progressive Web App)**: eine installierbare Web-App, läuft auf jedem aktuellen Android-Handy/-Tablet (Chrome → „Zum Startbildschirm hinzufügen"), Vollbild mit eigenem Icon, komplett offline-fähig (Service Worker).
- Keine Build-Toolchain nötig: Vanilla HTML/CSS/JS, alles lokal im Projektordner, direkt per Browser testbar.
- Optimiert für Touch (Handy hochkant primär, Tablet/quer funktioniert ebenfalls).
- Wake-Lock: Bildschirm bleibt während eines Spiels an.

## Design

- **Umschaltbar hell/dunkel** (Einstellung, Standard: dunkel).
- Dunkles Theme: dunkler Hintergrund, kräftige Akzente in Board-Farben (Rot/Grün), große, klar lesbare Zahlen.
- Helles Theme: clean, weiß/hellgrau mit denselben Akzenten.
- **Sprache umschaltbar Deutsch/Englisch** (Standard: Deutsch; Dart-Fachbegriffe wie Double, Checkout, Leg bleiben englisch).

## Spielmodi (Match)

- **X01**: 101 / 201 / 301 / 501 / 701 / 1001, konfigurierbar:
  - Sets & Legs (Best-of), Double-Out / Master-Out / Straight-Out, Double-In optional
  - 1–8 Spieler (Profile oder Gastspieler), Anwurf-Wechsel (Bull-out optional einfach als Reihenfolge)
- **Cricket**: Standard & Cut-Throat, 2–4 Spieler
- **Around the Clock**: 1–20 (+ optional Bull), Varianten: nur Singles / Doubles / Triples
- **Shanghai**: 7 oder 20 Runden, Shanghai-Finish gewinnt sofort
- **Killer**: 3–8 Spieler, Lebensanzahl einstellbar
- **Halve It (Halbieren)**: konfigurierbare Zielfelder, Fehlrunde halbiert den Score
- **Bot-Gegner** für X01: einstellbarer Average (ca. 40–105), realistisch streuende Scores, checkt Finishes mit plausibler Quote – Matchdruck beim Alleine-Üben.

## Trainingsmodi

- **Doppel-Training**: alle Doubles der Reihe nach (D1–D20 + Bull) oder gezielt einzelne Doubles; Trefferquote pro Double wird erfasst.
- **Checkout-Training / 121**: zufällige oder aufsteigende Finish-Aufgaben (61–170), begrenzte Dartanzahl, Erfolgsquote wird getrackt.
- **Scoring-Training**: X Runden auf T20 (oder wählbares Feld), Auswertung Treffer/Streuung, PPR (Points per Round).
- **Bob's 27**: der Klassiker fürs Doppel-Training mit Punktabzug.
- **JDC Challenge**: das bekannte Trainingsformat (Shanghai-Runden, Doubles, 501-Legs) mit Gesamtpunktzahl.
- **Catch 40**: Checkouts 61–100 nacheinander.
- **170-Leiter**: Finishes von 61 aufwärts, bei Erfolg eine Stufe hoch, bei Misserfolg runter – Level wird gespeichert (Progress sichtbar).
- Jeder Trainingsmodus speichert Ergebnisse ins Profil → Verlaufskurven.

## Eingabemethoden (alle umschaltbar, auch während des Spiels)

1. **Dartboard zum Antippen**: grafisches Board (SVG), jedes Segment einzeln treffbar (Single außen/innen, Double, Triple, Bull/Bullseye), Zoom-/Lupenverhalten für präzises Tippen.
2. **Zahlenfeld pro Dart**: Tasten 1–20 + 25/Bull + Miss, Modifikatoren Single/Double/Triple.
3. **Rundensumme**: Gesamtpunkte der 3 Darts als Zahl eintippen (klassisches Kreidezählen), Schnellwahl-Buttons für häufige Scores (26, 41, 45, 60, 81, 85, 100, 140, 180).
- Immer verfügbar: **Undo** (Dart- und Runden-weise), Anzeige „Darts geworfen" im Leg.

## Spielerprofile & Statistiken

- Beliebig viele **Profile** anlegbar: Name, Avatar (Emoji/Farbe), bevorzugte Eingabemethode.
- Pro Profil dauerhaft erfasst:
  - 3-Dart-Average (gesamt, pro Spiel, First 9)
  - Checkout-Quote, höchstes Finish, bevorzugte Doppel + Trefferquote je Double
  - Anzahl 180er, 140+, 100+, 60+, Ton-Verteilung
  - Leg-/Set-/Match-Bilanz, Siegquote
  - Trainingsverläufe je Modus (z. B. Bob's-27-Bestwert, JDC-Punkte, 170-Leiter-Level)
- **Auswertung / Progress**:
  - Formkurven (Average, Checkout-Quote, Trainings-Scores über Zeit; Woche/Monat/Gesamt)
  - **Treffer-Heatmap** auf dem Board (bei Dart-genauer Eingabe): wo landen deine Darts wirklich?
  - **Head-to-Head**: zwei Profile vergleichen – direkte Bilanz, Averages, Formkurven übereinander.
- **Trainings-Empfehlungen**: die App analysiert Schwächen (z. B. Doppel-Quote unter Benchmark, schwaches Scoring) und schlägt konkret passende Trainingsmodi vor – mit Begründung.
- **Erfolge & Abzeichen**: z. B. „Erste 180", „High Finish 100+", „Shanghai!", „9-Darter" (man darf träumen), „Bob's 27 überlebt", Trainings-Streaks („7 Tage in Folge trainiert") u. v. m., mit Fortschrittsanzeige.

## Eigene Turniere

- Turniere mit Freunden direkt in der App anlegen (Teilnehmer aus Profilen + Gastspieler):
  - **KO-System** (Einfach-KO mit automatischem Baum, Freilose bei ungerader Zahl)
  - **Liga / Jeder gegen jeden** (Round Robin mit Tabelle: Punkte, Leg-Differenz)
  - **Gruppenphase + KO** (Gruppen konfigurierbar, Beste kommen weiter)
- Spielmodus pro Turnier konfigurierbar (z. B. 501 Double-Out, Best of 3 Legs).
- Turnierbaum/Tabelle live in der App, Ergebnisse fließen in die Profil-Statistiken,
  Turnier-Historie wird gespeichert (inkl. Sieger-Abzeichen).

## Freunde & Vergleich (Share-Code, ohne Server)

- Eigenes Profil als **kompakten Share-Code** exportieren (Text, Kopieren oder Android-Teilen-Menü, z. B. WhatsApp; QR-Code später nachrüstbar).
- Code eines Freundes importieren → Freund erscheint dauerhaft in der **Freundesliste** mit allen Vergleichs-Stats
  (Averages, Checkout-Quote, 180er, Formkurven, Trainings-Bestwerte).
- Vergleichsansicht: eigene Werte vs. Freund, Ranglisten über alle importierten Freunde.
- Aktualisierung durch erneuten Code-Austausch; Datenmodell so gebaut, dass später ein echtes Online-System nachrüstbar wäre.

## Live-Spielhilfen

- **Checkout-Vorschläge** ab 170 Rest (berücksichtigt verbleibende Darts, Double-Out-Regel).
- **Sound & Caller**: Ansage der Rundenscores per Sprachsynthese („One hundred and eighty!"), Treffer-/Bust-Sounds, an/aus schaltbar.
- Bust-Erkennung, automatische Spielerwechsel, Leg-/Set-Stand immer sichtbar.
- Match-Zusammenfassung nach Spielende (alle Stats, Verlauf, Speichern ins Profil).

## Online-Bereich (integrierter Web-Bereich)

- Eigener Tab „Dart-Welt" mit eingebetteten/verlinkten Bereichen:
  - **News** (z. B. PDC, dartn.de)
  - **Ergebnisse/Live-Scores**
  - **Turnier-Anmeldung über 2k-dart-software.com** (Login läuft auf deren Seite)
- Öffnet die Seiten in der App (eingebettet, wo die Seiten es erlauben; sonst sauberer Absprung in den Browser).

## Datenhaltung

- Alles **lokal auf dem Gerät** (localStorage/IndexedDB), kein Konto, keine Cloud.
- **Backup**: JSON-Export aller Profile/Statistiken als Datei; Import auf neuem Gerät.

## Einstellungen

- Theme (dunkel/hell), Sprache (DE/EN), Sounds/Caller an/aus, Standard-Eingabemethode,
  Standard-Spielvarianten (z. B. 501 Double-Out, Best of 5 Legs), Vibration an/aus.
