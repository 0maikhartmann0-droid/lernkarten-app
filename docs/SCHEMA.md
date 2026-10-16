# Deck-Format `lernkarten-deck/v1`

Ein Deck ist eine einzelne JSON-Datei (UTF-8, Endung `.json`). Eine vollständige Beispieldatei liegt unter [`examples/beispiel-bauphysik.json`](../examples/beispiel-bauphysik.json).

## Aufbau

```json
{
  "schema": "lernkarten-deck/v1",
  "deck": {
    "id": "bauphysik-schallschutz",
    "title": "Bauphysik – Schallschutz",
    "subject": "Bauphysik",
    "created": "2026-10-13",
    "source": "Lernfortschritt - Bauphysik.md, Abschnitt 2026-10-13"
  },
  "cards": [{ "id": "c001", "type": "basic", "front": "Frage?", "back": "Antwort." }]
}
```

| Feld           | Pflicht | Bedeutung                                                                                |
| -------------- | ------- | ---------------------------------------------------------------------------------------- |
| `schema`       | ja      | Immer genau `"lernkarten-deck/v1"`.                                                      |
| `deck.id`      | ja      | Eindeutiger, dauerhafter Name des Decks. Gleiche `id` = dasselbe Deck (siehe Re-Import). |
| `deck.title`   | ja      | Anzeigename.                                                                             |
| `deck.subject` | nein    | Fach, z. B. `"Bauphysik"`. Sortiert die Deckliste.                                       |
| `deck.created` | nein    | Datum `JJJJ-MM-TT`. Fehlt es, wird das Importdatum eingetragen.                          |
| `deck.source`  | nein    | Woher die Inhalte stammen.                                                               |
| `cards`        | ja      | Liste mit mindestens einer Karte.                                                        |

## Kartentypen

Jede Karte braucht `type` und `front`. Was dazukommt, hängt vom Typ ab:

| `type`  | Pflichtfelder                        | Beschreibung                                                                       |
| ------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `basic` | `front`, `back`                      | Klassische Karteikarte: Frage vorn, Antwort hinten.                                |
| `mc`    | `front`, `choices` (≥ 2), `answer`   | Multiple Choice. `answer` ist der **Index** der richtigen Antwort, gezählt ab `0`. |
| `tf`    | `front`, `answer` (`true` / `false`) | Richtig/Falsch-Aussage. `answer` ohne Anführungszeichen.                           |
| `cloze` | `front` mit mindestens einer Lücke   | Lückentext: `{{c1::Antwort}}` oder mit Hinweis `{{c1::Antwort::Hinweis}}`.         |
| `typed` | `front`, `back`                      | Freitext: `back` ist die einzutippende Antwort (kurz halten).                      |

### Optionale Felder für alle Typen

| Feld      | Bedeutung                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`      | Eindeutig innerhalb des Decks, z. B. `"c001"`. **Dringend empfohlen** – daran hängt der Lernfortschritt.                                                                                   |
| `tags`    | Liste von Schlagwörtern, z. B. `["schallschutz", "luftschall"]`.                                                                                                                           |
| `source`  | Quelle der einzelnen Karte, z. B. `"Folie 12"`. Wird unter der Antwort angezeigt.                                                                                                          |
| `explain` | Erklärung, die nach dem Aufdecken unter der Antwort steht.                                                                                                                                 |
| `image`   | Bild als `data:image/…`-URI oder relativer Pfad (`"bilder/abb1.png"`). Bei Pfaden die Bilddateien beim Import zusammen mit der JSON-Datei auswählen – zugeordnet wird über den Dateinamen. |

Unbekannte Felder werden ignoriert.

## Text, Markdown und Formeln

`front`, `back`, `explain` und die `choices` dürfen Markdown enthalten (fett, Listen, Tabellen, Zeilenumbrüche mit `\n`).

Formeln stehen in LaTeX und werden mit KaTeX gesetzt:

- im Fließtext: `$R = \\frac{d}{\\lambda}$`
- abgesetzt: `$$U = \\frac{1}{R_T}$$`

Wichtig in JSON: Jeder Backslash muss **doppelt** geschrieben werden (`\\frac`, `\\lambda`, `\\cdot`). Ein einzelnes Dollarzeichen als Währung schreibt man `\\$`.

Bei Lückentext darf eine Formel **in** der Lücke stehen (`{{c1::$\\mu \\cdot d$}}`), aber eine Lücke nicht mitten in einer Formel. Im Quiz lassen sich solche Lücken nicht eintippen – die Karte wird dort aufgedeckt und selbst bewertet.

## Freitext im Quiz

Bei `typed`-Karten und Lücken vergleicht die App tolerant: Groß-/Kleinschreibung, Leerzeichen, `**` und `_`, ein Schlusspunkt sowie ae/oe/ue/ss statt ä/ö/ü/ß spielen keine Rolle; ein Tippfehler wird ab 4 Zeichen toleriert. `back` sollte deshalb **nur die Antwort** enthalten – ein Wort, ein Formelzeichen oder eine Zahl mit Einheit, ohne Erklärung in Klammern. Erklärungen gehören in `explain`.

## IDs und Re-Import

Wird eine Datei mit einer `deck.id` importiert, die es schon gibt, **aktualisiert** die App das Deck:

- Karten mit bekannter `id`: Inhalt wird ersetzt, der **Lernfortschritt bleibt erhalten**.
- Karten mit neuer `id`: kommen als neue Karten dazu.
- Karten, die in der neuen Datei **fehlen**: werden samt Lernfortschritt entfernt. Die App fragt vorher nach.

Daraus folgt: Eine einmal vergebene `id` nicht mehr ändern und nicht für eine andere Frage wiederverwenden.

Karten ohne `id` bekommen eine ID, die aus Typ und Fragetext abgeleitet wird. Das funktioniert, solange die Frage unverändert bleibt; nach einer Änderung am Fragetext gilt die Karte als neu.

## Andere Formate

Neben `lernkarten-deck/v1` liest die App Textdateien aus Anki und Quizlet (siehe README, „Import aus Anki oder Quizlet“): eine Karte pro Zeile, `Vorderseite<TAB>Rückseite<TAB>Tags`. Daraus entsteht ein normales Deck in diesem Format, das sich anschließend als JSON exportieren lässt.

## Fehlermeldungen beim Import

Die App prüft die ganze Datei und listet alle Fehler auf einmal, jeweils mit Kartennummer (Position in `cards`, ab 1) und `id`:

```
Karte 2 (id "c002"): Feld "back" (Antwort) fehlt oder ist leer – Pflicht bei Typ "basic".
Karte 5 (id "c005"): Feld "answer" muss der Index der richtigen Antwort sein (0 = erste Antwort, höchstens 3). Gefunden: 4.
```

Ist die Datei kein gültiges JSON, nennt die Meldung Zeile und Spalte. Solange ein Fehler besteht, wird nichts importiert.
