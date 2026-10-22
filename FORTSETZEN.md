# Projektstand – 23. Oktober 2026

Die lokale spanische Ausgabe ist gebaut und geprüft. Alle 1500 Vokabeln, 1500 Audiodateien und 60 Bildtafeln mit jeweils 25 Motiven sind eingebunden. Die zwei zuvor fehlenden Tafeln waren bereits generiert und wurden aus den vorhandenen Originalausgaben zugeordnet.

## Ergebnis
- `public/content/spanish-1500/manifest.json` und `checksums.json` vorhanden.
- Produktionsbuild in `dist/` vollständig; automatischer Erstimport ohne manuelle Medienauswahl.
- Build, 38 Unit-/Datentests und 6 Browser-Tests gegen den Produktionsserver erfolgreich.
- Alle Medien technisch dekodiert; inhaltliche und visuelle Prüfung stichprobenartig. Details: `docs/TESTS.md`.
- Windows-Paket: `/workspace/BaBaDum-Spanisch-1500.zip`.
- Quellcode-Paket: `/workspace/BaBaDum-Quellcode.zip`.
- Das alte `/workspace/BaBaDum-local.zip` enthält nicht den vollständigen aktuellen Wortschatz und soll nicht verwendet werden.

## Weiterarbeiten
`README.md` lesen. Das Repository liegt unter `/workspace/BaBaDum`. Mit `npm run dev` entwickeln, nach Änderungen `npm run build` ausführen. Produktiv mit `npm start` starten, feste Adresse 127.0.0.1:5173. Bestehende Browserprofile und Lernstände erhalten.

Tests: `npm test` und `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. Ein laufender Produktionsserver muss den aktuellen Build bedienen. Paketierung: `python3 scripts/package.py` nach erfolgreichem Build.

Keine erneute Bild- oder Audiogenerierung nötig. Quellen, Modelle und Aufbereitung stehen in `content/README.md`. Der Windows-Starter ist nicht auf einem Windows-Rechner getestet. Verbesserungen an mehrdeutigen Illustrationen können bei konkreten Rückmeldungen gezielt über die stabilen Wort-IDs erfolgen.

Der Nutzer hat den Upload in sein privates GitHub-Repository ausdrücklich autorisiert. Der Branch main enthält Quellcode, Medien und den fertigen Build für Code → Download ZIP. Keine öffentliche Website und kein automatischer Folgeauftrag eingerichtet.

## Änderung: Weiterlernen nach dem Tagesziel
„Frei weiterüben“ wurde durch „Weiterlernen“ ersetzt. Jede weitere Antwort wird regulär gespeichert und mit FSRS bewertet; zusätzliche neue Wörter zählen zum Tagesfortschritt. Das Tagesziel bleibt unverändert. Fällige Wiederholungen haben Vorrang. Die Freigabe zusätzlicher neuer Wörter gilt für die aktuelle Sitzung und den aktuellen Kalendertag.
