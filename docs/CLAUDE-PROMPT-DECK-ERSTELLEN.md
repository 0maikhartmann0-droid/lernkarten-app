# Prompt: Deck aus einer Lernzusammenfassung erstellen

So geht's:

1. Den Prompt unten in einen neuen Claude-Chat kopieren.
2. Die drei Angaben in der ersten Zeile anpassen (Fach, Deck-Titel, Deck-ID).
3. Die Lernzusammenfassung (Markdown) darunter einfügen oder als Datei anhängen.
4. Die Antwort als `.json`-Datei speichern und in der App über **Deck importieren** laden.

Tipp: Für **Nachträge** zum selben Thema dieselbe Deck-ID verwenden und Claude die bisherige JSON-Datei mitgeben („Ergänze dieses Deck, behalte alle vorhandenen IDs“). So bleibt der Lernfortschritt erhalten.

## Der Prompt

```text
Fach: Bauphysik | Deck-Titel: Bauphysik – Schallschutz | Deck-ID: bauphysik-schallschutz

Du erstellst aus meiner Lernzusammenfassung (unten) Karteikarten und Quizfragen für meine Lernkarten-App. Ich lerne für die Weiterbildung zum Holzbautechniker.

## Ausgabe
Gib ausschließlich eine einzige JSON-Datei im Format "lernkarten-deck/v1" aus – als ein Codeblock, ohne Text davor oder danach:

{
  "schema": "lernkarten-deck/v1",
  "deck": { "id": "<Deck-ID>", "title": "<Deck-Titel>", "subject": "<Fach>", "created": "<heutiges Datum JJJJ-MM-TT>", "source": "<Dateiname/Abschnitt der Zusammenfassung>" },
  "cards": [ ... ]
}

## Kartentypen (Feld "type")
- "basic": { "id", "type", "front", "back" } – Frage und Antwort.
- "mc": { "id", "type", "front", "choices": [4 Antworten], "answer": Index der richtigen Antwort ab 0, "explain" }
- "tf": { "id", "type", "front": Aussage, "answer": true oder false, "explain" }
- "cloze": { "id", "type", "front": "Satz mit {{c1::Lücke}}" } – höchstens zwei Lücken pro Karte.
- "typed": { "id", "type", "front", "back" } – nur wenn die Antwort ein einzelnes Wort, eine Zahl mit Einheit oder ein Formelzeichen ist.
Optional bei jeder Karte: "tags": ["kleinbuchstaben-ohne-leerzeichen"], "source": "Folie/Abschnitt", "explain": "kurze Begründung".

## Regeln für den Inhalt
1. Pro Karte genau EIN Fakt. Aufzählungen in mehrere Karten zerlegen.
2. Nichts erfinden. Verwende nur, was in meiner Zusammenfassung steht. Wenn etwas unklar oder widersprüchlich ist, lass die Karte weg und nenne die Stelle NICHT im JSON – ich frage danach.
3. Jede Karte bekommt "source" mit der Stelle in meiner Zusammenfassung (Überschrift, Folie oder Seitenzahl, so wie sie dort steht).
4. Fragen so stellen, dass sie ohne die Zusammenfassung verständlich sind (kein "wie oben", kein "siehe Tabelle").
5. Antworten kurz: höchstens zwei Sätze oder eine Formel mit Legende.
6. Multiple Choice: genau 4 Antworten, genau eine richtig. Falsche Antworten müssen plausibel sein (gleiche Art von Größe, typische Verwechslungen wie ähnliche Einheiten oder vertauschte Formeln), keine Scherzantworten, kein "alle genannten". Die richtige Antwort steht an wechselnder Position.
7. Richtig/Falsch: ungefähr gleich viele wahre und falsche Aussagen; bei falschen Aussagen in "explain" richtigstellen.
8. Formeln immer in LaTeX: im Text $...$, abgesetzt $$...$$. Einheiten als normaler Text, z. B. W/(m²·K).
9. Mischung: etwa 50 % basic, 20 % mc, 10 % tf, 10 % cloze, 10 % typed. Wichtige Fakten dürfen in zwei verschiedenen Typen vorkommen.
10. Sprache: Deutsch, Fachbegriffe wie in meiner Zusammenfassung.

## Regeln für gültiges JSON
- IDs fortlaufend: "c001", "c002", … – jede ID nur einmal.
- Backslashes in LaTeX doppelt schreiben: "\\frac{d}{\\lambda}", "\\cdot", "\\mu".
- Anführungszeichen im Text als \" schreiben, Zeilenumbrüche als \n.
- Kein Komma nach dem letzten Eintrag einer Liste oder eines Objekts.
- "answer" bei mc ist eine Zahl (0–3), bei tf true/false ohne Anführungszeichen.
- Lücken nie innerhalb einer Formel setzen; eine Formel darf aber komplett in der Lücke stehen: {{c1::$\\mu \\cdot d$}}.

Prüfe vor der Ausgabe: gültiges JSON, alle IDs eindeutig, jede mc-Karte hat 4 Antworten und einen passenden Index, jede Aussage ist durch meine Zusammenfassung belegt.

## Meine Lernzusammenfassung
<hier einfügen>
```

## Wenn der Import einen Fehler meldet

Die Fehlermeldung der App kopieren und im selben Chat einfügen: „Die App meldet: … Bitte korrigiere das JSON und gib die ganze Datei neu aus.“ Die Meldungen nennen Kartennummer, `id` und das betroffene Feld.

Das Format ist in [SCHEMA.md](SCHEMA.md) beschrieben.
