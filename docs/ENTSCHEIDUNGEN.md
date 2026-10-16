# Entscheidungen

Was beim Bauen entschieden wurde, wo die Anforderungen Spielraum ließen – jeweils mit Grund.

## Technik

| Thema           | Entscheidung                                           | Grund                                                                                                           |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| UI-Bibliothek   | Preact (statt React)                                   | Gleiche Schreibweise, deutlich kleiner – weniger Daten beim ersten Laden und im Offline-Cache.                  |
| Routing         | Hash-Adressen (`#/lernen/<deck>`), ohne Bibliothek     | Braucht keine Server-Konfiguration, läuft auf GitHub Pages in einem Unterordner und offline aus dem Cache.      |
| Pfade           | `base: './'` (relative Pfade)                          | Derselbe Build läuft im Wurzelverzeichnis und in jedem Unterordner.                                             |
| Service Worker  | `registerType: 'autoUpdate'`                           | Eine neue Version wird beim nächsten Online-Start still übernommen; kein Update-Dialog nötig.                   |
| Offline-Cache   | Von den KaTeX-Schriften nur `.woff2`                   | KaTeX liefert jede Schrift in drei Formaten. Jeder Browser mit Service Worker kann woff2 – das spart rund 1 MB. |
| Schrift der App | Systemschrift                                          | Nichts zu laden, sieht auf jedem Gerät heimisch aus.                                                            |
| Einstellungen   | `localStorage`, Lerndaten in IndexedDB                 | Einstellungen sind winzig und müssen vor dem ersten Zeichnen bereitstehen (Dark Mode ohne Aufblitzen).          |
| Sicherheit      | Kartentext läuft durch DOMPurify                       | Deck-Dateien können aus fremder Quelle stammen; eingebettetes HTML/Skript wird entfernt.                        |
| Icons           | `npm run icons` erzeugt die PNGs aus `public/icon.svg` | Icon ändern = eine SVG-Datei ändern.                                                                            |

## Lernlogik

- **SM-2 mit vier Stufen.** „Schwer / Gut / Leicht“ entsprechen den SM-2-Qualitäten 3 / 4 / 5 mit der Original-Formel für den Leichtigkeitsfaktor (−0,14 / ±0 / +0,10, Minimum 1,3). „Nochmal“ senkt den Faktor um 0,20 (wie Anki) und setzt die Wiederholungen zurück.
- **Abstände:** erste erfolgreiche Wiederholung 1 Tag („Leicht“: 4 Tage), zweite 6 Tage, danach Abstand × Faktor. Jede bestandene Wiederholung verlängert um mindestens einen Tag; es gilt immer Schwer ≤ Gut < Leicht.
- **„Nochmal“ bleibt in der Sitzung:** Die Karte kommt drei Karten später wieder und ist erst erledigt, wenn sie mindestens „Schwer“ bekommt. Lernschritte in Minuten (wie bei Anki) gibt es bewusst nicht – das wäre für den Zug zu kleinteilig.
- **Verspätete Wiederholungen** bekommen keinen Bonus; gerechnet wird ab dem Tag der Bewertung.
- **Ein Lerntag** wechselt um Mitternacht Ortszeit.
- **Tageslimits** (Standard 20 neue, 100 Wiederholungen) gelten pro Deck. Karten, die in der laufenden Sitzung „Nochmal“ bekamen, zählen nicht gegen das Limit. Ist das Limit für neue Karten erreicht, lassen sich am Sitzungsende je 10 weitere freischalten.
- **Trefferquote** = Anteil der Bewertungen, die nicht „Nochmal“ waren. **Streak** = Lerntage in Folge im jeweiligen Deck; solange heute noch nicht gelernt wurde, zählt der Stand bis gestern.
- **Lückentext mit mehreren Lücken** (`c1`, `c2`) ist eine Karte: alle Lücken sind gleichzeitig verdeckt. Anki würde je Lücke eine Karte erzeugen; das verdoppelt Karten und Lernstände ohne klaren Nutzen.

## Import

- **`id` ist optional**, wie in den Anforderungen (Teil B) verlangt; der Coding-Plan nannte sie als Pflichtfeld. Fehlt sie, leitet die App eine stabile ID aus Typ und Fragetext ab und weist beim Import darauf hin.
- **Re-Import: Die Datei ist die Wahrheit.** Karten, die in der neuen Datei fehlen, werden samt Lernstand entfernt – sonst blieben gelöschte oder korrigierte Karten für immer im Stapel. Weil dabei Fortschritt verloren geht, fragt die App vorher nach.
- **Umbenannte Decks** behalten ihren Titel beim Re-Import.
- **Tolerant beim Einlesen:** Ein BOM oder ein ` ```json `-Zaun aus dem Chat wird stillschweigend entfernt.
- **Bilder:** Gespeichert wird jedes Bild als `data:`-URI direkt an der Karte – so steckt es auch im Backup. Relative Pfade in einer Deck-Datei werden beim Import über den **Dateinamen** (ohne Ordner, Groß-/Kleinschreibung egal) den mit ausgewählten Bilddateien zugeordnet; fehlende Bilder meldet der Import. Webadressen werden nicht geladen (offline nutzlos, außerdem ein Datenabfluss).
- **Bildgröße:** Bilder bis 300 KB bleiben unverändert, größere werden auf höchstens 1600 px verkleinert (JPEG, bei PNG WebP wegen möglicher Transparenz). Ein Handyfoto mit 4–8 MB würde sonst Speicher und Backup aufblähen.

## Vorgezogen aus späteren Phasen

- **Markdown und KaTeX** (Phase 3): Ohne sie stünden Formeln im MVP als Rohtext auf den Karten.
- **Dark Mode** (Phase 3): steht bei „Technik (verbindlich)“ und kostet mit CSS-Variablen fast nichts.
- **`navigator.storage.persist()`** (Phase 3): wird nach jedem Import still angefragt, damit der Browser die Lerndaten nicht bei Speicherknappheit löscht. In den Einstellungen steht, ob das gewährt ist, mit Button zum erneuten Anfragen.

Im Lernmodus werden alle fünf Kartentypen als Karteikarte gelernt (Frage → aufdecken → selbst bewerten). Abgefragt mit Auswertung werden sie im Quiz.

## Quiz (Phase 2)

- **Quiz und Lernplanung:** Falsch → „Nochmal“ (die Karte kommt heute beim Lernen wieder). Richtig → „Gut“, aber nur bei neuen oder heute fälligen Karten. Richtige Antworten auf nicht fällige Karten ändern nichts und werden nicht protokolliert – sonst würde jedes Quiz zwischendurch die Abstände aufblähen und die Trefferquote in der Statistik verwässern.
- **Neue Karten aus dem Quiz** zählen gegen das Tageslimit für neue Karten, weil sie danach im Lernplan stehen.
- **Gespeichert wird beim Weiterschalten,** nicht erst am Ende. Wer ein Quiz mittendrin beendet, verliert nur die offene Frage. So bleibt außerdem Zeit für „Doch richtig“.
- **Multiple Choice aus Karteikarten:** Falsche Antworten sind Rückseiten anderer Karten **gleichen Typs aus demselben Deck**, bevorzugt mit gemeinsamen Tags (gleiches Thema = plausibler). Gemischt mit kurzen Freitext-Antworten würde die lange richtige Antwort sofort auffallen. Unter zwei falschen Antworten wird die Karte im gemischten Modus selbst bewertet und im MC-Modus ausgelassen.
- **MC-Antworten werden gemischt,** auch bei Karten vom Typ `mc`: Man soll den Inhalt lernen, nicht die Position.
- **Lückentext:** Alle Lücken einer Karte werden zusammen abgefragt, jede in einem eigenen Feld. Richtig ist die Karte nur, wenn alle Lücken stimmen. Lücken mit Formeln (`$` oder `\`) lassen sich nicht sinnvoll eintippen; solche Karten werden aufgedeckt und selbst bewertet.
- **Freitext-Toleranz:** Groß-/Kleinschreibung, Leerzeichen, Markdown-Zeichen, ein Schlusspunkt sowie ae/oe/ue/ss statt ä/ö/ü/ß zählen nie als Fehler. Dazu wird ein Tippfehler (Levenshtein-Abstand 1) toleriert, aber erst ab 4 Zeichen – bei „dB“ wäre jeder Fehler ein anderes Wort. In den Einstellungen abschaltbar. Nach einer falschen Freitext-Antwort gibt es „Doch richtig“ für Fälle, die die Toleranz nicht erkennt (Synonyme).
- **Zeitmodus** gilt pro Frage; läuft die Zeit ab, ist die Frage falsch. Zeit für die ganze Runde wäre im Zug unpraktisch, weil man öfter unterbrochen wird.
- **Richtig/Falsch-Fragen werden nicht aus anderen Karten erzeugt** (z. B. „Antwort X gehört zu Frage Y“) – das ergibt zu oft holprige oder irreführende Aussagen.

## Komfort (Phase 3)

- **Suche:** Alle Suchwörter müssen vorkommen, in beliebiger Reihenfolge und in einem beliebigen Feld (Frage, Antwort, Antwortmöglichkeiten, Erklärung, Tags, Quelle). Umlaute werden wie bei der Freitext-Prüfung gefaltet („waerme“ findet „Wärme“). Mehrere Tags filtern mit UND – so lässt sich eingrenzen, statt die Liste zu vergrößern.
- **Bearbeiten in der App** nutzt dieselbe Prüfung wie der Import (`checkCard`), damit eine in der App gespeicherte Karte immer auch als Deck-Datei gültig ist. Der Lernstand bleibt beim Bearbeiten erhalten, auch wenn sich der Typ ändert.
- **App-Änderungen und Re-Import:** In der App geänderte oder angelegte Karten werden markiert (`editedAt`). Ein Re-Import der Deck-Datei bleibt „Die Datei ist die Wahrheit“, fragt aber vorher nach, wenn er solche Karten ersetzen oder entfernen würde. Wer dauerhaft in der App pflegt, exportiert das Deck als JSON und arbeitet mit dieser Datei weiter. Gewarnt wird nur, wenn die Datei wirklich etwas anderes enthält: Der Re-Import des eigenen Exports läuft ohne Rückfrage durch.
- **Neue Karten-IDs** aus der App heißen `app-<Zeit>-<Zufall>`; das kollidiert nicht mit `c001`-IDs aus Claude-Decks.
- **Gelöschte Karten:** Karte und Lernstand werden entfernt, das Protokoll bleibt – sonst würden Streak und Trefferquote rückwirkend falsch.
- **Zugmodus** ist eine Einstellung (bleibt nach dem Neustart), umschaltbar über das Zug-Symbol beim Lernen und im Quiz. Er vergrößert Schrift und Buttons und legt die Bewertung als 2×2-Raster an (größere Ziele für den Daumen). Die Wake-Lock-Sperre gilt nur, solange die Lern- oder Quiz-Ansicht offen ist, und wird nach dem Zurückkehren in die App neu angefordert. Antippen der Karte deckt in jedem Modus auf.
- **Zoom:** Pinch-Zoom bleibt erlaubt (Barrierefreiheit). Gegen versehentliches Doppeltipp-Zoomen haben Buttons und Karte `touch-action: manipulation`; Eingabefelder haben mindestens 16 px Schrift, damit iOS beim Antippen nicht hineinzoomt.
- **Backup = vollständiger Gerätestand** (Decks, Karten samt Bildern, Lernstände, Protokoll, Einstellungen) als eine JSON-Datei `lernkarten-backup/v1`. Wiederherstellen **ersetzt** alles nach Rückfrage; ein Zusammenführen zweier Geräte wäre fehleranfällig (welcher Lernstand gewinnt?) und ist bewusst nicht eingebaut. Verwaiste Einträge im Backup werden übersprungen statt den ganzen Vorgang abzubrechen.
- **Backup-Erinnerung** in der Deckliste, wenn noch nie oder seit mehr als 14 Tagen kein Backup gezogen wurde. Wo der Browser Dateien teilen kann (Android), gibt es zusätzlich „Backup teilen …“, z. B. direkt nach OneDrive.

## Export und Interop (Phase 4)

- **Deck-JSON-Export** schreibt pro Karte nur die Felder ihres Typs (ein früheres `back` einer jetzt `tf`-Karte fällt weg) und behält alle IDs. Damit ist Export → Import verlustfrei und aktualisiert statt zu duplizieren. Lernstände gehören nicht hinein – sie sind gerätebezogen und stehen im Backup.
- **Anki-Export** als „Notizen als Klartext“ mit den Kopfzeilen `#separator:tab`, `#html:true`, `#tags column:3`, die Anki seit 2.1.55 auswertet. Alle Typen werden zu „Einfach“-Notizen: Multiple Choice mit Antwortliste vorn, Richtig/Falsch mit Hinweis, Lückentext mit `[…]` vorn und hervorgehobener Lösung hinten. Echte Anki-Lückentext-Notizen wären nur in einem eigenen Notiztyp importierbar – zwei Dateien für einen Export wären umständlicher. Erklärung und Quelle hängen an der Rückseite. Formeln werden zu MathJax (`\(…\)`, `\[…\]`), das Anki ohne Zusatz darstellt. **Bilder werden nicht exportiert:** Anki erwartet Bilder als Dateien in seiner Mediensammlung, nicht in der Textdatei.
- **Import aus Anki/Quizlet** erzeugt ein normales v1-Deck und läuft durch dieselbe Prüfung wie Deck-Dateien. Die Deck-ID kommt aus dem Titel (Dateiname bzw. eingegebener Titel), Karten-IDs aus Anki-GUIDs, sonst stabil aus dem Begriff. So aktualisiert ein erneuter Import desselben Exports, statt zu verdoppeln. Gleicher Begriff mit anderer Definition wird eine zweite Karte; exakt doppelte Zeilen werden übersprungen.
- **Spalten ohne Kopfzeilen:** 1 = Vorderseite, 2 = Rückseite, 3 = Tags (so steht es in den Anforderungen). Mit Anki-Kopfzeilen werden GUID-, Notiztyp-, Deck- und Tag-Spalten erkannt, weitere Felder ignoriert. Felder in Anführungszeichen dürfen Tabs und Zeilenumbrüche enthalten.
- **Trennzeichen** wird erkannt: Tab, sonst Semikolon, sonst Komma (nur wenn fast jede Zeile eins hat – Kommas stehen auch in Definitionen).
- **HTML aus Anki** wird zu Markdown: Umbrüche, fett/kursiv, Entities, MathJax und `[$]…[/$]` zu `$…$`; das erste Bild wird als Bildpfad übernommen (zuordenbar, wenn die Bilddatei mit ausgewählt wird).
- **Quizlet** bietet keinen Datei-Download, sondern Text zum Kopieren – deshalb gibt es „Text einfügen“.
- **Druckansicht** statt PDF-Bibliothek: Der Druckdialog jedes Browsers kann als PDF speichern, Formeln (KaTeX) werden dabei sauber gesetzt, und die App bleibt klein. Gedruckt wird immer hell, ohne Kopfzeile und Bedienelemente; Karten werden nicht über Seitenumbrüche geteilt. Ein Doppelseiten-Layout zum Ausschneiden (Rückseiten gespiegelt) ist bewusst nicht eingebaut – das hängt zu stark von Drucker und Duplex-Einstellung ab.

## Android (Phase 5)

- **Nur Anleitung, keine APK** (Entscheidung vom 16.10.2026): Die als PWA installierte App läuft auf Android offline wie eine native App. Eine Capacitor-APK hätte Android Studio und das SDK vorausgesetzt, ohne fürs Lernen im Zug etwas zu verbessern. Die Anleitung steht in `docs/ANDROID.md`; die APK lässt sich später nachrüsten, weil der Build rein statisch ist.
- **GitHub Pages** (eingerichtet am 16.10.2026): `.github/workflows/pages.yml` prüft bei jedem Push auf `main` Lint und Unit-Tests und veröffentlicht erst danach den Build. Eine fehlerhafte Version geht so nicht online. Die Browser-Tests laufen nicht in GitHub Actions, weil sie einen installierten Browser brauchen; sie bleiben lokal (`npm run test:e2e`).

## Abweichungen

- **Lighthouse-PWA-Check:** Lighthouse hat die PWA-Kategorie in Version 12 entfernt; ein „grüner PWA-Check“ lässt sich dort nicht mehr ablesen. Stattdessen prüft `npm run test:e2e` das, worauf es ankommt: Service Worker aktiv, Neuladen ohne Netz funktioniert, Lernfortschritt bleibt erhalten. Installierbarkeit zeigt Chrome unter DevTools → Application → Manifest.
- **Git-Repository** öffentlich auf GitHub (seit 16.10.2026), damit GitHub Pages kostenlos nutzbar ist. Enthalten sind nur Code, Doku und das Beispieldeck – keine eigenen Decks oder Lernstände.
- **Projektordner** `C:\KI-Bot\lernkarten-app` statt im OneDrive-Ordner der Technikerschule: `node_modules` (zehntausende Dateien) gehört nicht in die Cloud-Synchronisation.
