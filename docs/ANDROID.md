# Lernkarten auf dem Android-Handy

Die App wird **nicht** über den Play Store installiert, sondern als Web-App (PWA) direkt aus Chrome. Danach liegt sie mit eigenem Symbol auf dem Startbildschirm, öffnet sich ohne Browserleiste und läuft **komplett offline**. Eine APK ist dafür nicht nötig.

Ablauf in Kürze:

1. App einmal ins Internet stellen (https) – siehe Schritt 1.
2. Adresse auf dem Handy in Chrome öffnen und **App installieren** – Schritt 2.
3. Einmal offline testen – Schritt 3.
4. Decks aufs Handy holen – Schritt 4.

---

## Schritt 1: App bereitstellen (einmalig, am Laptop)

Chrome speichert eine Web-App nur dann offline, wenn sie über **https** kommt. Eine Adresse wie `http://192.168.x.x:4173` aus dem WLAN reicht dafür nicht. Zwei kostenlose Wege:

### Variante A: Netlify (am schnellsten)

1. Im Projektordner den Build erzeugen:

   ```bash
   npm run build
   ```

2. https://app.netlify.com/drop im Browser öffnen.
3. Den Ordner `dist` aus dem Projektordner auf die Seite ziehen.
4. Netlify zeigt eine Adresse wie `https://irgendwas-123.netlify.app` – das ist die App.

Ohne Konto ist eine Drop-Seite nur vorübergehend online. Mit einem kostenlosen Netlify-Konto bleibt sie bestehen; unter **Site configuration → Change site name** lässt sich ein lesbarer Name vergeben (z. B. `lernkarten-maik.netlify.app`).

**Neue Version hochladen:** `npm run build`, dann im Netlify-Projekt unter **Deploys** den neuen `dist`-Ordner hineinziehen.

### Variante B: GitHub Pages

Voraussetzung: ein GitHub-Konto und das Projekt als Repository auf GitHub.

1. Im Repository unter **Settings → Pages** bei **Source** „GitHub Actions“ wählen.
2. Die Datei `.github/workflows/pages.yml` liegt im Projekt bereits bei (zusätzlich mit Lint und Unit-Tests vor dem Build). In einem neuen Repository sieht sie im Kern so aus:

   ```yaml
   name: Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v5
           with:
             path: dist
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

3. Nach etwa einer Minute ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar. Jeder weitere Push veröffentlicht automatisch die neue Version.

Die App verwendet relative Pfade, deshalb funktioniert sie auch in diesem Unterordner ohne Anpassung.

> **Datenschutz:** Auf dem Server liegt nur die App selbst. Decks, Lernstände und Backups bleiben auf dem Gerät – die Seite überträgt nichts zurück.

---

## Schritt 2: Auf dem Handy installieren

1. **Chrome** öffnen (nicht die Google-App und nicht den Browser in WhatsApp oder E-Mail).
2. Die Adresse aus Schritt 1 eingeben.
3. Warten, bis unten kurz **„Offline bereit“** erscheint. Erst dann ist alles im Gerät gespeichert.
4. Oben rechts das Menü **⋮** öffnen → **App installieren** (bei manchen Geräten: **Zum Startbildschirm hinzufügen** → **Installieren**).
5. Bestätigen. Das Lernkarten-Symbol liegt jetzt auf dem Startbildschirm bzw. in der App-Übersicht.

Ab jetzt die App **immer über das Symbol** starten, nicht über einen Chrome-Tab.

Samsung Internet funktioniert ähnlich (Menü → **Seite hinzufügen zu** → **Startbildschirm**). Für die beste Unterstützung (Bildschirm bleibt an, dauerhafter Speicher) ist Chrome die sichere Wahl.

---

## Schritt 3: Offline testen (einmalig, vor der ersten Zugfahrt)

1. App über das Symbol öffnen und in der leeren Deckliste **Beispieldeck laden** antippen (später wieder löschbar).
2. **Flugmodus** einschalten.
3. App komplett schließen (aus der Übersicht der offenen Apps wischen) und über das Symbol neu öffnen.
4. Das Deck muss da sein; **Lernen** und **Quiz** müssen funktionieren.
5. Flugmodus aus. Unter **Einstellungen → Offline** steht: „Die App ist auf diesem Gerät gespeichert und läuft ohne Internet.“

Klappt etwas nicht: siehe „Probleme“ unten.

---

## Schritt 4: Decks aufs Handy bringen

Die App liest Deck-Dateien (`.json`), Anki-/Quizlet-Textdateien (`.txt`, `.tsv`, `.csv`) und Bilder direkt aus dem Handyspeicher.

**Über OneDrive** (passt zum Schul-Ordner):

1. In der OneDrive-App die Deck-Datei antippen → **⋮** → **Herunterladen**. Sie landet im Ordner **Downloads**.
2. In der Lernkarten-App **Deck importieren** → Datei aus **Downloads** wählen.

Gehören Bilder zum Deck (`"image": "bilder/…"`), die Bilder ebenfalls herunterladen und im Dateidialog **zusammen mit der JSON-Datei** markieren.

**Andere Wege:** E-Mail an sich selbst, USB-Kabel, „Teilen“ aus einer anderen App. Für Quizlet in der App **Text einfügen (Quizlet/Anki)** verwenden.

**Dauerhaften Speicher anfragen:** Nach der Installation unter **Einstellungen → Speicher → Dauerhaft speichern anfragen** antippen. Dann löscht Android die Lerndaten nicht von sich aus, wenn der Speicher knapp wird.

---

## Im Zug

- **Zugmodus** (Zug-Symbol oben beim Lernen und im Quiz): größere Buttons im 2×2-Raster für den Daumen, und der Bildschirm bleibt an, solange gelernt wird. Im Energiesparmodus kann Android das verweigern; dann geht der Bildschirm wie gewohnt aus.
- Die Karte **antippen** deckt die Antwort auf.
- Alles wird sofort gespeichert. Die App darf jederzeit geschlossen werden, auch mitten in einer Lernsitzung.

---

## Laptop und Handy

Beide Geräte lernen **getrennt**. Jedes hat seine eigenen Decks und Lernstände; es gibt keinen Server, der abgleicht.

- **Gleiche Decks auf beiden:** Die Deck-Datei auf beiden Geräten importieren.
- **Lernstand umziehen** (z. B. ab jetzt nur noch am Handy): am Laptop **Einstellungen → Sicherung → Backup herunterladen**, die Datei aufs Handy bringen, dort **Backup wiederherstellen**. Achtung: Wiederherstellen **ersetzt** alles auf dem Handy, es führt nichts zusammen.
- Am Handy gibt es zusätzlich **Backup teilen …** – damit lässt sich das Backup direkt in OneDrive ablegen.

---

## Updates

Nach einer neuen Version (Schritt 1 erneut) holt sich die App die Änderungen beim nächsten Start **mit Internet** selbst. Manchmal ist sie erst nach dem zweiten Öffnen aktuell: App schließen, wieder öffnen. Decks und Lernstände bleiben bei Updates erhalten.

---

## Probleme

| Problem                                          | Lösung                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| „App installieren“ fehlt im Menü                 | Seite über **https** geöffnet? Normale Chrome-App statt eingebettetem Browser (WhatsApp, Google-App)? Seite einmal neu laden.                                                        |
| Offline erscheint nur „Keine Internetverbindung“ | Die App war beim ersten Öffnen nicht lange genug online. Mit Internet öffnen, auf „Offline bereit“ warten, erneut testen.                                                            |
| Decks sind plötzlich weg                         | Passiert, wenn die App deinstalliert oder in Android die **Website-Daten von Chrome gelöscht** werden. Deshalb regelmäßig ein Backup anlegen – die Deckliste erinnert nach 14 Tagen. |
| Bildschirm geht trotz Zugmodus aus               | Energiesparmodus aus, oder Android-Bildschirmzeit hochsetzen.                                                                                                                        |
| Text ist zu klein                                | Zugmodus einschalten; außerdem folgt die App der Schriftgröße von Android.                                                                                                           |
| Datei lässt sich nicht auswählen                 | In der Dateiauswahl über **☰ → Downloads** oder **OneDrive** navigieren; manche Dateimanager zeigen `.json` erst bei „Alle Dateien“.                                                |

---

## iPhone (falls nötig)

Safari öffnen → Adresse eingeben → **Teilen** → **Zum Home-Bildschirm**. Offline-Lernen funktioniert genauso. Auf dem iPhone kann der Browser Daten einer Web-App löschen, wenn sie mehrere Wochen nicht geöffnet wurde – dort ist das Backup besonders wichtig.

---

## Und eine echte APK?

Für das Lernen im Zug bringt eine APK keinen Vorteil: Die installierte Web-App läuft genauso offline. Eine APK über **Capacitor** wäre nur sinnvoll, wenn die App ganz ohne Webadresse aufs Handy soll. Dafür bräuchte es Android Studio und das Android-SDK am Laptop. Das Projekt ist darauf vorbereitet (statischer Build in `dist/`), umgesetzt ist es bewusst nicht – siehe `docs/ENTSCHEIDUNGEN.md`.
