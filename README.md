# Lernkarten

Offline-Lernkarten mit Spaced Repetition (SM-2) als installierbare Web-App. Decks kommen als JSON-Datei ins Gerät, gelernt wird ohne Internet, ohne Konto und ohne Server – auf dem Windows-Laptop und dem Android-Handy.

**App online:** https://0maikhartmann0-droid.github.io/lernkarten-app/ – einmal öffnen, „Offline bereit“ abwarten, installieren (siehe [docs/ANDROID.md](docs/ANDROID.md)). Jeder Push auf `main` prüft und veröffentlicht automatisch.

**Stand: alle Phasen umgesetzt.** Deck-Import, Deckliste, Karteikarten-Lernmodus, Statistik, Offline-Betrieb, Quiz-Modi, Suche und Tag-Filter, Karten bearbeiten, Bilder, Zugmodus, Backup und Wiederherstellen, Export (Deck-JSON, Anki-TSV, Druckansicht/PDF) sowie Import aus Anki und Quizlet. Für Android gibt es eine Installationsanleitung ([docs/ANDROID.md](docs/ANDROID.md)); eine APK ist bewusst nicht gebaut.

## Start

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.

```bash
npm install
```

```bash
npm run dev
```

Die App läuft dann unter http://localhost:5173. Im Entwicklungsmodus ist der Offline-Speicher (Service Worker) absichtlich aus.

## Befehle

| Befehl             | Zweck                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| `npm run dev`      | Entwicklungsserver mit sofortigem Neuladen                                            |
| `npm run build`    | Typprüfung und fertiger Build nach `dist/`                                            |
| `npm run preview`  | Den Build lokal ausliefern (http://localhost:4173) – hier ist die App offline-fähig   |
| `npm test`         | Unit-Tests (Vitest)                                                                   |
| `npm run test:e2e` | Browser-Tests gegen den Build: Offline-Betrieb und Lernablauf. Vorher `npm run build` |
| `npm run lint`     | ESLint                                                                                |
| `npm run format`   | Prettier                                                                              |
| `npm run icons`    | App-Icons aus `public/icon.svg` neu erzeugen                                          |

Die Browser-Tests brauchen einmalig einen Browser für Playwright: entweder `npx playwright install chromium`, oder den vorhandenen Edge benutzen, indem vor dem Test die Umgebungsvariable `PW_CHANNEL` auf `msedge` gesetzt wird (PowerShell: `$env:PW_CHANNEL = 'msedge'`).

## So lerne ich offline im Zug

Ausführlich fürs Handy, mit Bereitstellung, Offline-Test, Decks übertragen und Problemlösungen: **[docs/ANDROID.md](docs/ANDROID.md)**.

1. **Einmal mit Internet öffnen.** Die App-Adresse im Browser aufrufen (siehe „Bereitstellen“) und kurz warten, bis unten „Offline bereit“ erscheint. Ab dann liegt alles im Gerät.
2. **Installieren (empfohlen).**
   - Android (Chrome): Menü ⋮ → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.
   - Windows (Chrome/Edge): Symbol **App installieren** rechts in der Adressleiste.
3. **Decks importieren.** In der Deckliste **Deck importieren** antippen und die `.json`-Datei wählen – am Laptop geht auch Hineinziehen ins Fenster. Aufs Handy kommt die Datei z. B. per OneDrive, E-Mail an sich selbst oder USB.
4. **Flugmodus an, lernen.** Deck öffnen → **Lernen** → Karte aufdecken → bewerten:

   | Bewertung | Bedeutung                           | Taste |
   | --------- | ----------------------------------- | ----- |
   | Nochmal   | Nicht gewusst – kommt gleich wieder | 1     |
   | Schwer    | Gewusst, aber mühsam                | 2     |
   | Gut       | Gewusst                             | 3     |
   | Leicht    | Sofort gewusst                      | 4     |

   Die Leertaste deckt auf und bewertet danach mit „Gut“. Unter jedem Button steht, wann die Karte wiederkommt.

Wichtig: Decks und Lernfortschritt liegen **nur in diesem Browser auf diesem Gerät**. Laptop und Handy lernen getrennt. Wer die Browserdaten der Seite löscht, löscht auch die Karten – die Deck-Dateien also aufbewahren und regelmäßig unter **Einstellungen → Sicherung** ein Backup ziehen (die Deckliste erinnert nach 14 Tagen).

**Zugmodus** (Zug-Symbol oben beim Lernen und im Quiz, oder in den Einstellungen): größere Schrift und Buttons, Bewertung im 2×2-Raster für den Daumen, und der Bildschirm bleibt an, solange gelernt wird. Unabhängig davon deckt Antippen der Karte die Antwort auf.

## Quiz

Über **Quiz** in der Kopfzeile (alle Decks, ein Fach oder ein Tag) oder den Button **Quiz** an einem Deck.

| Modus           | Was passiert                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Gemischt        | Jede Karte in ihrer passenden Form                                                                                            |
| Multiple Choice | MC-Karten mit gemischten Antworten; Karteikarten bekommen falsche Antworten von anderen Karten desselben Decks                |
| Richtig/Falsch  | Aussagen beurteilen                                                                                                           |
| Lückentext      | Lücken eintippen; Lücken mit Formeln werden aufgedeckt und selbst bewertet                                                    |
| Freitext        | Antwort eintippen – Groß-/Kleinschreibung, Leerzeichen und ae/oe/ue zählen nicht, ein Tippfehler wird toleriert (abschaltbar) |

Optional mit Zeitlimit pro Frage (15, 30 oder 60 s). Am Ende gibt es eine Auswertung mit allen Fragen und **Falsche nochmal üben**.

Das Quiz fließt in die Lernplanung ein: Falsche Antworten zählen als „Nochmal“ und kommen heute beim Lernen wieder. Richtige zählen als „Gut“ – aber nur bei neuen oder heute fälligen Karten, damit ein Quiz zwischendurch die Abstände nicht künstlich verlängert.

Tastatur: 1–4 wählt eine Antwort, R/F bei Richtig/Falsch, Enter prüft bzw. schaltet weiter.

## Karten suchen und bearbeiten

- **Karten** an einem Deck oder **Karten durchsuchen** in der Deckliste (über alle Decks): Suchfeld (findet „Wärme“ auch als „waerme“, alle Wörter müssen vorkommen), Filter nach Tags (mehrere = alle müssen passen) und Kartentyp.
- Karte antippen → bearbeiten: Typ, Text, Antworten, Erklärung, Tags, Quelle, Bild – mit Live-Vorschau inkl. Formeln. Bei Lückentext macht **Markierung zur Lücke machen** aus dem markierten Text `{{c1::…}}`.
- **Neues Deck** in der Deckliste legt ein leeres Deck an, um Karten direkt in der App zu schreiben.
- **Bilder:** im Editor per Datei oder Handykamera. Große Bilder werden automatisch verkleinert. In Deck-Dateien mit relativen Pfaden (`"image": "bilder/abb1.png"`) die Bilddateien beim Import **zusammen mit der JSON-Datei** auswählen oder hineinziehen.

Achtung: Ein erneuter Import derselben Deck-Datei ersetzt in der App geänderte oder angelegte Karten. Die App fragt vorher nach. Wer in der App pflegt, exportiert danach das Deck als JSON (siehe unten) und arbeitet mit dieser Datei weiter.

## Exportieren, drucken, aus Anki/Quizlet holen

Unter **Karten** → **Exportieren und drucken** an einem Deck:

| Button            | Ergebnis                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Deck-Datei (JSON) | `lernkarten-deck/v1` mit allen Änderungen aus der App – zum Weitergeben, für ein anderes Gerät, als Vorlage für Claude. Ohne Lernstände. |
| Für Anki (TSV)    | `.txt` für Anki: Datei → Importieren, Notiztyp „Einfach“. Formeln erscheinen in Anki als MathJax. Bilder werden nicht mit exportiert.    |
| Druckansicht      | Fragen und Antworten nebeneinander, optional nur Fragen als Übungsblatt. „Als PDF speichern“ im Druckdialog ergibt ein PDF.              |

**Import aus Anki oder Quizlet:**

- **Datei:** `.txt`, `.tsv` oder `.csv` über **Deck importieren** (Anki: Datei → Exportieren → „Notizen als Klartext“). Der Dateiname wird zum Deck-Titel. Anki-Kopfzeilen, HTML-Formatierung, MathJax-Formeln und Lückentext-Notizen werden übernommen.
- **Quizlet:** Set öffnen → ··· → Exportieren, Voreinstellungen (Tab, neue Zeile) lassen, Text kopieren → in der Deckliste **Text einfügen (Quizlet/Anki)**.
- Erwartet wird eine Karte pro Zeile: `Vorderseite<TAB>Rückseite<TAB>Tags` (Tags optional, Semikolon statt Tab geht auch). Ein erneuter Import mit gleichem Titel aktualisiert das Deck und behält den Lernfortschritt.

## Karten erstellen

- Format der Deck-Dateien: [docs/SCHEMA.md](docs/SCHEMA.md)
- Fertiger Prompt, mit dem Claude aus einer Lernzusammenfassung ein Deck erzeugt: [docs/CLAUDE-PROMPT-DECK-ERSTELLEN.md](docs/CLAUDE-PROMPT-DECK-ERSTELLEN.md)
- Beispiel mit allen fünf Kartentypen: [examples/beispiel-bauphysik.json](examples/beispiel-bauphysik.json) – in der leeren App auch über **Beispieldeck laden**

Wird ein Deck mit gleicher `deck.id` erneut importiert, aktualisiert die App die Karten und behält den Lernfortschritt.

## Bereitstellen

`npm run build` erzeugt in `dist/` eine rein statische Seite. Sie läuft auf jedem Webspace und in jedem Unterordner. Der Offline-Speicher funktioniert nur über **https** (oder `localhost`).

**Netlify:** Ordner `dist/` auf https://app.netlify.com/drop ziehen – fertig. Oder Repository verbinden mit Build-Befehl `npm run build` und Veröffentlichungsordner `dist`.

**GitHub Pages:** Inhalt von `dist/` veröffentlichen, z. B. mit einer GitHub-Action, die `npm ci && npm run build` ausführt und `dist/` als Pages-Artefakt hochlädt. Eine Anpassung der Pfade ist nicht nötig.

**Nur lokal am Laptop:** `npm run build`, dann `npm run preview` und http://localhost:4173 öffnen. Nach dem ersten Laden läuft die App dort auch ohne den Server weiter. Fürs Handy reicht das nicht: Über die IP-Adresse des Laptops fehlt https, und ohne https speichert der Browser die App nicht offline. Fürs Handy also Netlify oder GitHub Pages nehmen.

## Aufbau

```
src/
  srs/      SM-2, Tages-Queue, Streak und Trefferquote – reine Funktionen
  import/   Prüfung des Deck-Formats mit deutschen Fehlermeldungen, Bilder zuordnen, Anki/Quizlet-Text
  modes/    Lückentext-Parser, Karteikarten-Darstellung, Quiz-Fragen, Freitext-Toleranz
  export/   Deck-JSON und Anki-TSV
  db/       IndexedDB (Dexie): Decks, Karten, Lernstände, Protokoll; Suche; Backup
  ui/       Deckliste, Lernen, Quiz, Karten & Editor, Statistik, Einstellungen
e2e/        Browser-Tests (Playwright)
examples/   Beispieldeck
docs/       Schema, Claude-Prompt, Entscheidungen
```

Die Unit-Tests liegen jeweils neben dem Code (`*.test.ts`). Warum etwas so gebaut ist, steht in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

## Datenschutz

Kein Server, kein Login, keine Tracker, keine Abrufe von fremden Adressen – auch Formelsatz (KaTeX) und Schriften sind im Build enthalten.
