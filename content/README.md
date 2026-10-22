# Herkunft und Aufbau des spanischen Wortschatzes

Stand: 23. Oktober 2026. Der Nutzer hat eine eigenständige Sammlung mit etwa 1.500 Vokabeln und neu erzeugten Illustrationen/Audios ausdrücklich beauftragt.

## Wortauswahl

- Quelle zur Häufigkeitsprüfung: [Hermit Dave / FrequencyWords, Spanisch 2018, 50.000 Wörter](https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/es/es_50k.txt).
- Grundlage der Liste: OpenSubtitles2018 / OPUS. Lizenz der **Inhalte: CC BY-SA 4.0**, des Generatorcodes: MIT. Der entsprechende Hinweis ist in `sources/FrequencyWords-README.md` erhalten.
- Auswahl: 1.000 Nomen, 300 Verben, 200 Adjektive aus 60 Themenfeldern. Die Sammlung wurde für Bebilderbarkeit und Alltagsbreite kuratiert. Sie ist **keine Behauptung der 1.500 häufigsten spanischen Wörter**. 1.326 Einträge stimmen nach Entfernen des Artikels direkt mit einem Eintrag der Frequenzliste überein; Mehrwortausdrücke werden nicht künstlich auf einen angeblichen Rang abgebildet.
- `vocabulary.tsv` und `sections/*.tsv`: spanischer Ausdruck, deutsche Bedeutung, englische Bildbeschreibung. Nomen enthalten den Artikel, Adjektive überwiegend die maskuline Grundform, Verben den Infinitiv; einige sinnvolle Ausdrücke bestehen aus mehreren Wörtern.
- `catalog.json`: kompilierte, stabile IDs, Themen, Wortarten, Übersetzungen, Bildbeschreibungen, vorhandene Häufigkeitsränge sowie Quellen-URL und SHA-256 der abgerufenen Liste.
- Deutsche Glossen und Bildbeschreibungen wurden für diese Sammlung formuliert. Wortlisten/Glossen dieser Sammlung werden mit Quellenhinweis unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) bereitgestellt. Es wurden keine Bilder oder Aufnahmen aus dem Originalspiel entnommen.

## Eigene Illustrationen

Die Bildtafeln wurden mit dem in ChatGPT/Codex verfügbaren OpenAI-Bildgenerator erstellt. Jede enthält 25 anhand einer expliziten Liste erzeugte Illustrationen in einem 5×5-Raster. Stil: kräftige dunkle Konturen, vereinfachte farbige Cartoonformen, transparenter Hintergrund. Die ersten Themenbilder dienten als Stilreferenz für weitere Tafeln.

`public/content/spanish-1500/atlases/01.png` bis `60.png` sind die unveränderten generierten Dateien. `regions.json` und die `imageRegion`-Felder im Manifest beschreiben den konkreten Ausschnitt jeder Vokabel. Die Anwendung stellt jeweils diesen Ausschnitt per SVG-Viewport dar. Die Aufbereitung misst Transparenz und zusammenhängende Formen, damit möglichst keine Gliedmaßen oder Pfeile an einem ungenauen Rasterrand abgeschnitten werden. Es wurden keine zufälligen Internetbilder oder Testgrafiken in den produktiven Wortschatz übernommen.

Bildbeschreibungen und feste IDs ermöglichen die gezielte Nachbearbeitung einer konkreten Karte. Die Bilder sind neue Lernillustrationen mit ähnlichen allgemeinen Gestaltungsmerkmalen; eine Übereinstimmung mit BaBaDum-Originalillustrationen wird nicht behauptet.

## Aussprache

- Lokal erzeugte neuronale TTS, **Kokoro-82M v1.0**, ONNX-Ausführung über `kokoro-onnx 0.6.1`.
- Stimme **`ef_dora`**, Sprache `es`, Sprechtempo `0.9`; jeder Ausdruck wird einschließlich Artikel gesprochen.
- Modelldateien aus dem dokumentierten [kokoro-onnx-Release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1). Modell laut Projekt: Apache 2.0; ONNX-Wrapper: MIT. Kein ChatGPT-Audiogenerator und keine Originalsprecheraufnahmen.
- Ausgabe: 1.500 lokale Ogg/Opus-Dateien. `audio-report-*.json` dokumentiert Text, Stimme, Dauer, Signalpegel und Hash jedes erzeugten Audios.
- `scripts/generate-audio.py` erzeugt die Dateien mit lokalem ONNX-Modell und FFmpeg. Bereits passende Dateien werden über einen Fingerprint wiederverwendet. Modell, Python und Generator werden zum Spielen nicht benötigt.

## Erneut aufbereiten

Die nötigen Python-Pakete sind in `requirements-generation.txt` festgehalten. Modelle werden nicht mit dem Windows-Spielpaket verteilt. Die Bilder liegen fertig vor; deren Neuerzeugung erfolgt über den Bildgenerator mit den gespeicherten Beschreibungen und der ersten Bildtafel als Stilreferenz.

```sh
python scripts/build-catalog.py
python scripts/generate-audio.py --shard 0 --shards 2
python scripts/generate-audio.py --shard 1 --shards 2
python scripts/build-pack.py
npm run build
```

Für `build-catalog.py` die verlinkte 50.000-Wörter-Datei als `content/sources/es_50k.txt` bereitstellen. Die beiden Audio-Shards können parallel laufen; hier wurden insgesamt vier CPU-Threads verwendet. Benötigt werden die Modell- und Stimmdateien unter `local-tools/kokoro/`, Python-Pakete und FFmpeg. Diese Werkzeuge sind nicht Teil des regulären App-Starts.

## Grenzen der Qualitätsprüfung

Vollständig geprüft werden Dateivollständigkeit, eindeutige IDs, Bildausschnitte, Bilddekodierung, Audiodekodierung, positive Audiodauer/Signalpegel, Hashes und mögliche Antwortkombinationen. Die visuelle und sprachliche Prüfung erfolgt stichprobenartig. Gerade verwandte Handlungen und abstrakte Eigenschaften können trotz Ausschlussregeln bildlich mehrdeutig sein; eine vollständige Einzelprüfung durch eine Spanischlehrkraft oder Muttersprachlerin ist nicht erfolgt.
