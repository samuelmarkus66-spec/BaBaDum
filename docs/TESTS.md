# Validierung – 23. Oktober 2026

Geprüft unter Linux mit Node.js 24 und Chromium.

- `npm run build`: TypeScript-Prüfung und Produktionsbuild erfolgreich.
- `npm test`: **36 Tests bestanden**.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: **6 Browser-Tests bestanden**, gegen den fertigen Node-Produktionsserver einschließlich Content-Security-Policy.
- Alle **60 PNG-Tafeln** vollständig als RGBA dekodiert; alle **1500 OGG-Dateien** vollständig als endliches, nicht stummes PCM dekodiert. Dauer 0,81 bis 1,94 Sekunden. Bericht: `content/media-validation.json`.
- Manifest: 1500 eindeutige Wörter und IDs, 1000 Nomen / 300 Verben / 200 Adjektive, 1561 Medienreferenzen einschließlich Schrift. SHA-256-Prüfsummen stimmen. Für jedes Wort wurden vier passende, eindeutige Antwortoptionen geprüft.

## Lernlogik und Speicher

Die Tests prüfen Good/Again, FSRS-Lernschritte, Review-Zustand, Zielbehaltensrate, fällige vor neuen Karten, Tageslimits und Sprachtrennung. Hinzu kommen unterschiedliche Ausschnitte gemeinsamer Bildtafeln, Antwortgruppen, Synonyme und identische Bilddateien.

IndexedDB wird auf erneutes Öffnen, Datumswerte, Historie, atomare Wiederherstellung, Rollback bei Schreibfehlern und parallele Tabs geprüft. Sicherungstests weisen ungültige Versionen, widersprüchliche Bewertungen, doppelte Karten und unvollständige Historien zurück.

## Browserabläufe

1. Automatische Einrichtung des echten 1500er-Pakets, echte Audiowiedergabe, SVG-Antwortbilder, Good-Bewertung, Tageslimit, Neuladen, erhaltener Lernstand und freies Üben. Keine externen Netzwerkanfragen.
2. Ohne mitgeliefertes Paket erscheint der manuelle Import.
3. Ordnerimport, Again-Bewertung, richtige Markierung, Schutz vor Doppelbewertung, Neustart und freies Üben ohne Änderung des Lernplans.
4. Good-Bewertung, Wiederholung nach Fälligkeit, Sicherungsimport, Abweisung ungültiger Sicherungen und getrennte Sprachen.
5. Lokale Medien nach Neuladen, tatsächliche Audiowiedergabe, Vier-Felder-Geometrie, mobile Ansicht ohne horizontalen Überlauf und Tastaturbedienung des Dialogs.
6. Ungültiger Medienimport erhält den vorherigen Wortschatz.

`test-results/spanish-1500-desktop.png` und `spanish-1500-mobile.png` zeigen den tatsächlichen mitgelieferten Wortschatz. Die weiteren Browser-Tests nutzen eindeutig künstliche geometrische SVG-/WAV-Testdaten, die nicht ausgeliefert werden.

## Visuelle Prüfung und Grenzen

Desktop- und Mobilansichten sowie eine Auswahl der problematischsten Rasterausschnitte wurden visuell geprüft. Die SVG-Anzeige begrenzt die Bildtafel ausdrücklich auf den vorgesehenen Ausschnitt. Der Paketgenerator verhindert, dass ein über eine Rastergrenze verbundenes Motiv auf isolierte Glanzsterne oder Pfeile reduziert wird.

Bild- und Bedeutungszuordnungen sowie Aussprache sind nur stichprobenartig inhaltlich geprüft. Generierte Bilder können kleine Randartefakte enthalten; abstrakte Eigenschaften und verwandte Handlungen bleiben teilweise mehrdeutig. Eine vollständige sprachdidaktische Prüfung aller 1500 Einträge steht nicht hinter diesem Testbericht.

Kein Windows-System verfügbar: Node-Server und Browserabläufe wurden unter Linux geprüft, die Windows-Batchdatei nicht auf Windows ausgeführt. Keine Originalressourcen verwendet und keine pixelgenaue Übereinstimmung behauptet. Kein GitHub-Push, keine öffentliche Website und kein Restore der Cloud-Umgebung in einer neuen Aufgabe getestet.
