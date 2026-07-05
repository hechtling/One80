# 🎯 One80 – Die All-in-One Dart-App

Dart-Zähler, Training, Statistiken, Turniere und mehr – komplett offline, alle Daten bleiben auf dem Gerät.

## 📱 App nutzen

**Variante 1 – Web-App (empfohlen, aktualisiert sich selbst):**

➡️ App im Handy-Browser öffnen, dann im Chrome-Menü **„Zum Startbildschirm hinzufügen"** wählen.
Die App läuft danach im Vollbild mit eigenem Icon – auch offline.

**Variante 2 – Android-APK:**

➡️ Unter [Releases](../../releases) die Datei `One80.apk` herunterladen und installieren.

## ✨ Funktionen

- **Spielmodi:** X01 (101–1001, Sets & Legs, Double-/Master-/Straight-Out, Double-In), Cricket (Standard & Cut-Throat), Around the Clock, Shanghai, Killer, Halve It
- **Bot-Gegner** mit einstellbarem Average (40–105)
- **Training:** Doppel-Training, Checkout-Training, Scoring-Training, Bob's 27, JDC Challenge, Catch 40, 170-Leiter
- **3 Eingabemethoden:** Dartboard antippen, Zahlenfeld pro Dart, Rundensumme
- **Profile & Statistiken:** Averages, Checkout-Quote, Formkurven, Treffer-Heatmap, Erfolge & Abzeichen, Trainings-Empfehlungen
- **Turniere:** KO, Liga (Round Robin), Gruppen + KO
- **Freunde-Vergleich** per Share-Code (ohne Server, ohne Konto)
- **Checkout-Vorschläge**, Sound & Caller, Theme hell/dunkel, Deutsch/Englisch

## 🔧 Technik

Vanilla HTML/CSS/JS als PWA (offline-fähig per Service Worker), keine Build-Toolchain.
Die Android-APK wird per [Capacitor](https://capacitorjs.com) automatisch von GitHub Actions gebaut.

Alle Details zur Spezifikation: [SPEC.md](SPEC.md)
