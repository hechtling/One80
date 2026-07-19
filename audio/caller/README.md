# Caller-Sprachclips

Hier kommen die Aufnahmen für den Ansager rein. **Nichts einstellen** — die App
erkennt beim Start selbst, was da liegt, und benutzt es.

Drei Stufen, in dieser Reihenfolge:

1. **Komplette Aufnahme des Scores** — `180.mp3` wird als Ganzes abgespielt
2. **Aus Bausteinen zusammengesetzt** — `hundred_and` + `n80`
3. **System-Stimme** — wenn gar nichts da ist

Fehlt eine Datei, rutscht die App eine Stufe tiefer. Ohne diesen Ordner läuft
sie wie vorher.

---

## Der einfache Weg: Autodarts-Voice-Pack

Die Dateinamen folgen der Konvention von
[darts-caller](https://github.com/lbormann/darts-caller). Ein Voice-Pack aus dem
Autodarts-Umfeld kommt also **unverändert** hier rein — entpacken, Inhalt nach
`audio/caller/` kopieren, fertig.

Ein solches Pack enthält:

| Datei | Inhalt |
|---|---|
| `0.mp3` … `180.mp3` | jeder Score als eigene, komplett gesprochene Aufnahme |
| `gameshot.mp3` | Leg gewonnen |
| `matchshot.mp3` | Match gewonnen |
| `busted.mp3` | Bust |
| `ambient_gameshot.mp3` | Publikum (wird unter der 180 mitgespielt) |

Alles andere im Pack (`c_2` … `c_170`, `leg_1`, `yr_*`, Spielernamen …) wird
ignoriert — One80 braucht es nicht, es stört aber auch nicht.

Woher die Packs kommen, entscheidest du. Der
[autodarts-caller-generator](https://github.com/lbormann/autodarts-caller-generator)
erzeugt welche per TTS; die sind sauber weiterzugeben. Mitschnitte aus
TV-Übertragungen sind für dich privat unproblematisch, gehören aber **nicht** in
ein öffentliches Repo — siehe unten.

Nach dem Kopieren: **`VERSION` in `sw.js` hochzählen** (aktuell `one80-v9`),
sonst sieht eine installierte PWA den alten Stand.

---

## Der andere Weg: selbst einsprechen

Statt 181 Aufnahmen reichen **32 Bausteine**, aus denen die App jede Zahl
zusammensetzt. Die tragen ein `n` vorweg, damit sie nicht mit den Score-Dateien
eines Packs kollidieren.

### Einer und Teens

| Datei | gesprochen | | Datei | gesprochen |
|---|---|---|---|---|
| `n1.mp3` | one | | `n11.mp3` | eleven |
| `n2.mp3` | two | | `n12.mp3` | twelve |
| `n3.mp3` | three | | `n13.mp3` | thirteen |
| `n4.mp3` | four | | `n14.mp3` | fourteen |
| `n5.mp3` | five | | `n15.mp3` | fifteen |
| `n6.mp3` | six | | `n16.mp3` | sixteen |
| `n7.mp3` | seven | | `n17.mp3` | seventeen |
| `n8.mp3` | eight | | `n18.mp3` | eighteen |
| `n9.mp3` | nine | | `n19.mp3` | nineteen |
| `n10.mp3` | ten | | | |

### Zehner

| Datei | gesprochen | | Datei | gesprochen |
|---|---|---|---|---|
| `n20.mp3` | twenty | | `n60.mp3` | sixty |
| `n30.mp3` | thirty | | `n70.mp3` | seventy |
| `n40.mp3` | forty | | `n80.mp3` | eighty |
| `n50.mp3` | fifty | | `n90.mp3` | ninety |

### Hunderter und Ansagen

| Datei | gesprochen |
|---|---|
| `hundred.mp3` | one hundred |
| `hundred_and.mp3` | one hundred and |
| `no_score.mp3` | no score |
| `game_shot.mp3` | game shot |
| `game_shot_match.mp3` | game shot, and the match |
| `bust.mp3` | bust |

> `hundred_and` ist bewusst ein Stück und nicht `hundred` + `and` — am Stück
> gesprochen klingt der Übergang natürlicher.

Einzelne Scores kannst du zusätzlich komplett aufnehmen und nach `full/` legen
(`full/180.mp3`). Die haben dann Vorrang vor der Zusammensetzung. Genau dahin
gehört die Euphorie: Die Bausteine sollten neutral bleiben, weil ein gebrülltes
„EIGHTY" in „eighty one" unpassend klingt.

### Format

MP3, Mono reicht, 44.1 oder 48 kHz, 96–128 kbps.

Sauber schneiden musst du **nicht**: Die App misst beim Laden selbst, wo der Ton
anfängt und aufhört, und blendet an den Nahtstellen 30 ms über. Stille am Rand
stört also nicht. Wichtig sind nur **gleiche Lautstärke** und **gleicher
Sprecher/Raum/Mikro** über alle Clips — sonst hört man die Schnitte.

---

## Prüfen, was erkannt wurde

Einstellungen → **Eingabe & Checkout** → **Caller anhören**.

Dort stehen Probetasten für 180, 140, 100, 81, 60, 26, No score und Game shot,
darüber eine Zeile mit dem erkannten Zustand — etwa „Sprachpaket komplett: alle
181 Scores als eigene Aufnahme."

---

## Rechtliches

Mitschnitte echter Übertragungen (Russ Bray, John McDonald & Co.) sind
urheberrechtlich geschützt und als Stimme einer realen Person zusätzlich heikel.
Privat auf dem eigenen Handy interessiert das niemanden. Sobald One80 aber auf
GitHub Pages liegt und die APK in den Releases, würdest du fremde
Broadcast-Aufnahmen öffentlich verteilen — und genau dafür gibt es Takedowns.

Deshalb steht in `.gitignore`, dass Audio-Dateien aus diesem Ordner nicht
mitcommittet werden. Wer das Repo klont, hört die System-Stimme und legt sein
eigenes Pack rein.
