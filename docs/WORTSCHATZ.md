# Lokalen Originalwortschatz importieren

Die App enthält jetzt eine eigene Sammlung mit 1.500 spanischen Vokabeln und neu erzeugten Medien. Der folgende Importweg ist optional für weitere eigene oder zulässig verwendbare Sammlungen. Es ist kein Originalwortschatz enthalten. Der Zugriff auf die Originalwebsite war in der Cloud blockiert; siehe [ORIGINAL-ANALYSE.md](ORIGINAL-ANALYSE.md). Die Anwendung lädt keine zufälligen Ersatzbilder und erzeugt keine vermeintlichen Originalaufnahmen.

Der Import ist für eine lokale Sammlung bestimmt, deren Bilder, Audioaufnahmen, Vokabelzuordnungen und Nutzungsgrundlage bereits geprüft sind. Ein Dateiname oder eine öffentlich erreichbare URL allein bestätigt weder die Bedeutung eines Bildes noch Nutzungsrechte.

## Ordnerstruktur

```text
mein-originalwortschatz/
  manifest.json
  images/
    ORIGINAL-ID-1.svg
    ORIGINAL-ID-2.png
    ...
  audio/
    es/
      ORIGINAL-ID-1.mp3
      ORIGINAL-ID-2.mp3
      ...
  fonts/                  # optional
    ORIGINALSCHRIFT.woff2
```

In der App **Wortschatzordner auswählen**, dann den gesamten Ordner auswählen. In Chromium/Edge erscheint gegebenenfalls ein Dialog zum Freigeben des lokalen Ordners. Die App überträgt die ausgewählten Dateien nicht an einen Server; sie liest sie im Browser und speichert sie lokal in IndexedDB.

## manifest.json

Das folgende Beispiel erklärt die Felder. Die großgeschriebenen Werte sind ausdrücklich **Schema-Beispiele**, keine ermittelten BaBaDum-Daten. Für einen tatsächlich importierbaren Wortschatz muss `vocabulary` mindestens vier verschiedene, nicht mehrdeutige Bedeutungen je Sprache enthalten.

```json
{
  "format": "babadum-local-pack",
  "version": 1,
  "id": "mein-babadum-originalbestand",
  "title": "Mein lokaler Originalwortschatz",
  "source": {
    "url": "https://babadum.com/",
    "rights": "HIER DIE TATSAECHLICH GEPRUEFTE NUTZUNGSGRUNDLAGE EINTRAGEN",
    "note": "HIER HERKUNFT UND DATUM DER ZUORDNUNGSPRUEFUNG EINTRAGEN"
  },
  "languages": [
    { "id": "es", "name": "Español", "flag": "🇪🇸" }
  ],
  "vocabulary": [
    {
      "id": "ORIGINAL-ID-1",
      "language": "es",
      "conceptId": "EINDEUTIGE-BEDEUTUNGS-ID",
      "word": "VERIFIZIERTES ORIGINALWORT",
      "image": "images/ORIGINAL-ID-1.svg",
      "audio": "audio/es/ORIGINAL-ID-1.mp3",
      "background": "#bf8824",
      "ambiguityGroups": []
    }
  ]
}
```

Optional kann auf oberster Ebene `"font": "fonts/ORIGINALSCHRIFT.woff2"` ergänzt werden, wenn die betreffende Originalschrift verfügbar ist und verwendet werden darf. Ohne diese Datei nutzt die Anwendung eine Systemschrift; die Abweichung vom Original bleibt sichtbar.

### Stabile Identitäten

- `id` des Pakets bleibt bei Erweiterungen gleich.
- Eine Vokabel wird über **Paket-ID + Sprach-ID + Vokabel-ID** identifiziert. Dieselbe Original-ID darf in mehreren Sprachen vorkommen; jede Sprachversion hat einen eigenen FSRS-Zustand.
- `conceptId` bezeichnet die Bedeutung. Übersetzungen und Synonyme desselben Konzepts teilen diese ID.
- Die Sprach-ID ist hier ein stabiler Bezeichner wie `es`; sie muss nicht der numerischen Kennung der Originalwebsite entsprechen. Die Zuordnung zu Original-Sprachkennungen muss beim Erstellen des Pakets verifiziert werden.
- Paket-, Sprach-, Vokabel-, Konzept- und Gruppen-IDs dürfen Buchstaben, Ziffern, Bindestriche und Unterstriche enthalten.
- IDs nicht nachträglich für andere Wörter wiederverwenden. Beim Aktualisieren eines bereits verwendeten Wortschatzes lehnt die App das Entfernen oder Ändern vorhandener Wörter/Bedeutungs-IDs ab, damit Lernstände nicht unbemerkt auf andere Bedeutungen übertragen werden.
- Weitere Wörter oder Sprachen können unter derselben Paket-ID hinzugefügt werden. Für einen unabhängigen anderen Wortschatz ein separates Browserprofil verwenden. Originalordner und Fortschritts-JSON zusammen aufbewahren.

### Mehrdeutige Antworten vermeiden

Die App schließt gleiche IDs, gleiche Bedeutungs-IDs, gleiche Bildpfade, bytegleiche Bilddateien (SHA-256), gleich geschriebene Wörter und gemeinsame `ambiguityGroups` innerhalb einer Frage aus. Alle vier Antworten stammen aus derselben Sprache.

Wenn zum Beispiel zwei unterschiedliche Bilder beide zur Bedeutung eines Zielwortes passen könnten, müssen die betreffenden Vokabeln mindestens dieselbe explizite Gruppe in `ambiguityGroups` erhalten. Synonyme teilen zusätzlich eine `conceptId`. Dasselbe gilt für bildlich kaum unterscheidbare Begriffe. Unterschiedliche Dateihashes beweisen keine unterschiedliche Bedeutung; diese semantische Prüfung bleibt Teil der Originaldatenaufbereitung.

Der Import prüft, ob für jede Vokabel eine Kombination aus vier eindeutig unterscheidbaren Antworten möglich ist. Sind dafür zu wenige Bilder übrig, wird der Import mit einer Meldung abgelehnt.

### Dateien und Farben

- Alle Pfade sind relativ zur `manifest.json`. Keine Netzwerk-URLs, absoluten Pfade, `..` oder Windows-Laufwerksbuchstaben.
- Bilder: SVG, PNG, JPEG, WebP, GIF oder AVIF, soweit der Browser das Format dekodiert. Animationen innerhalb zulässiger Bilddateien werden durch das Bildformat bestimmt.
- Audio: MP3, OGG, WAV oder M4A, soweit Chromium/Edge das konkrete Format unterstützt. Jede Datei muss eine positive, endliche Dauer haben.
- Schriften: WOFF, WOFF2, TTF oder OTF.
- Original-SVGs mit Skripten, externen Verweisen oder eingebetteten aktiven Inhalten werden abgelehnt. Es wird nichts aus dem Internet nachgeladen.
- `background` ist eine sechsstellige Hexfarbe inklusive `#`. Sie gehört zur betreffenden Illustration und muss aus den Originaldaten abgeleitet werden.
- Pro Datei maximal 50 MB, Manifest maximal 20 MB, Sammlung maximal 2 GB. Der verfügbare Browserspeicher kann geringer sein. Zum Einstieg eine einzelne Sprache importieren.

Alle referenzierten Bilder und Audiodateien werden vor dem Speichern vom Browser gelesen/dekodiert. Es werden Hashes berechnet und die Bildkombinationen geprüft. Erst danach wird der gesamte Import atomar gespeichert. Bei einem fehlgeschlagenen Import bleibt die bisherige Sammlung erhalten.

Diese Prüfung bestätigt die technische Lesbarkeit und strukturelle Zuordnung. Ob eine Aufnahme tatsächlich das richtige Wort spricht und ein Bild dessen Bedeutung zeigt, muss anhand des Originalbestands kontrolliert werden.

## Zusätzliche Felder der mitgelieferten Sammlung

`translation`, `partOfSpeech`, `category`, `frequencyRank` und `answerFamily` sind optionale Metadaten. `answerFamily` beschränkt Gegenantworten auf dieselbe Vergleichsgruppe. `imageRegion` beschreibt bei Bildtafeln den einzelnen Ausschnitt: `x`, `y`, `width`, `height`, `sourceWidth`, `sourceHeight`, jeweils ganzzahlige Pixelwerte. Ausschnitte müssen vollständig innerhalb der Quelldatei liegen. Verschiedene Ausschnitte derselben Datei gelten als verschiedene Bilder; derselbe Ausschnitt wird niemals doppelt in einer Frage verwendet.

Der integrierte Wortschatz besitzt zusätzlich `checksums.json`. Beim ersten Start werden sämtliche mitgelieferten Dateien anhand dieser SHA-256-Werte geprüft und atomar in IndexedDB installiert. Eine bereits vorhandene Sammlung wird nicht überschrieben.
