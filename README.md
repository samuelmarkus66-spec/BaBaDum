# BaBaDum lokal · Spanisch mit FSRS

Eine private lokale Lernanwendung mit einem Wort, vier Bildern und automatischer Aussprache. Der mitgelieferte Wortschatz enthält **1.500 spanische Vokabeln: 1.000 Nomen, 300 Verben und 200 Adjektive**. Zu jedem Eintrag gehören eine eigene KI-Illustration, eine spanische Sprachdatei und eine deutsche Bedeutung. Die Illustrationen sind als 60 Bildtafeln mit jeweils 25 einzeln zugeordneten Ausschnitten gespeichert.

Das Vier-Felder-Layout orientiert sich am bereitgestellten BaBaDum-Screenshot. Bilder, Wortschatz und Aussprache dieser Ausgabe wurden eigenständig erstellt; es sind keine BaBaDum-Originalressourcen. Die Audioaufnahmen sind neuronale **synthetische Sprache**, erzeugt mit Kokoro-82M und der spanischen Stimme `ef_dora`.

## Unter Windows starten

1. **Node.js 24 LTS** von https://nodejs.org/ installieren.
2. Das Windows-Paket vollständig entpacken.
3. **`Start-Windows.cmd` doppelklicken.** Der Browser öffnet die lokale Anwendung. Das Konsolenfenster geöffnet lassen.
4. Beim ersten Aufruf werden die mitgelieferten Dateien automatisch geprüft und in den lokalen Browserspeicher übernommen. Danach beginnt das Spiel; ein manueller Wortschatzimport ist nicht erforderlich.

Das fertige Windows-Paket enthält den Build und alle Medien. Nach der Node-Installation ist keine Internetverbindung zum Spielen erforderlich. Beenden mit **Strg+C** im Konsolenfenster. Bei einem erneuten Start bleiben Wortschatz und Lernstand erhalten.

Immer denselben Browser, dasselbe Browserprofil und die vom Startskript verwendete Adresse `127.0.0.1` mit Port `5173` verwenden. `localhost`, ein anderer Port oder ein anderes Profil besitzen einen anderen lokalen Speicher. Ein bereits vorhandener eigener Wortschatz und dessen Fortschritt werden durch die automatische Einrichtung nicht überschrieben.

Die Windows-Batchdatei wurde hier nicht auf Windows ausgeführt. Der portable Node-Server, der Build und die Browserabläufe werden unter Linux/Chromium geprüft.

## Lernen

- Bild anklicken oder **1–4** drücken. Richtig = **FSRS Good**, falsch = **FSRS Again**. Die richtige Antwort wird markiert; die nächste Frage folgt automatisch.
- Das Wort anklicken, um die Aussprache erneut abzuspielen. Bei blockiertem Browser-Autoplay erscheint ein Hinweis. Nach der Antwort wird kurz die deutsche Bedeutung eingeblendet.
- Standard: **20 neue Wörter pro Sprache und lokalem Kalendertag**, **90 % Zielbehaltensrate**.
- Fällige Wiederholungen haben Vorrang. Nicht fällige Karten werden im regulären Modus vermieden. Lernschritte: **1 und 10 Minuten**, Wiederlernschritt: **10 Minuten**. Langfristige Abstände berechnet `ts-fsrs 5.4.2`.
- Nach dem Tagesziel bleibt die Abschlussmeldung erhalten. Mit **Weiterlernen** lernst du beliebig viele zusätzliche neue Wörter: Jede Antwort wird gezählt und regulär in FSRS gespeichert. Fällige Wiederholungen haben weiterhin Vorrang. Das eingestellte Tagesziel bleibt unverändert; nach einem Neustart oder am nächsten Tag gilt es wieder. Sind alle Wörter eingeführt und keine Wiederholungen fällig, zeigt die App den nächsten Wiederholungstermin.
- Über das kleine Einstellungsmenü: Tageslimit, Zielbehaltensrate, Statistik und Sicherungen. Geänderte Behaltensraten wirken ab der nächsten Bewertung.

Gegenantworten stammen aus derselben Wortart; Farbwörter erhalten andere Farbkarten, Adjektive passende Vergleichsgruppen. Bekannte Bedeutungsüberschneidungen werden ausgeschlossen. Bei abstrakten oder verwandten Tätigkeiten erläutert die deutsche Bedeutung die beabsichtigte Lesart. KI-Bilder und synthetische Aussprache wurden technisch vollständig und inhaltlich stichprobenartig geprüft, nicht durch eine vollständige sprachdidaktische Einzelabnahme aller 1.500 Einträge.

## Fortschritt sichern

**Einstellungen → Lernstand exportieren** speichert Karten, vollständige FSRS-Zustände, Fälligkeiten, richtige/falsche Antworten, Zeitpunkte und Verlauf als JSON. Medien sind nicht in der Fortschrittssicherung enthalten; sie liegen bereits im Anwendungspaket.

Ein Import wird geprüft und ersetzt den bisherigen Lernstand erst nach Bestätigung. Für dieselben Karten muss derselbe Wortschatz installiert sein. Das Löschen von Browser-Websitedaten entfernt auch den lokalen Lernstand; regelmäßige Exporte sind deshalb sinnvoll. Es gibt keine Benutzerkonten, Cloud-Datenbank oder laufende API-Kosten beim Spielen.

## Aus dem Quellcode arbeiten

Im vollständigen Repository liegen auch `src/`, `tests/`, `content/` und `public/`:

```sh
npm ci
npm run build
npm start
```

Entwicklung: `npm run dev`. Nach Änderungen den Build mit `npm run build` aktualisieren. Das Windows-Startskript verwendet einen vorhandenen Build direkt. Das kompakte Windows-Paket ist zum Ausführen vorgesehen; der vollständige Quellcode liegt separat im Repository bzw. Quellcode-Archiv.

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

In dieser Cloud-Umgebung:

```sh
npm ci --cache /tmp/babadum-npm-cache --no-audit --no-fund
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Die Bild- und Sprachgenerierung ist ein einmaliger Aufbereitungsschritt und wird beim Starten oder Lernen nicht wiederholt. Das fertige Spiel benötigt weder Python noch die Sprachmodelle. Quellen, Aufbereitung und Medienzuordnung stehen in [content/README.md](content/README.md); zusätzliche Wortschatzordner sind weiterhin über das [Importformat](docs/WORTSCHATZ.md) möglich.

Das private GitHub-Repository enthält auch den fertigen Build in `dist/`. Über **Code → Download ZIP** herunterladen, vollständig entpacken und `Start-Windows.cmd` starten. Nach Quellcodeänderungen `npm run build` ausführen und den aktualisierten Build mit übernehmen. Es wurde keine öffentliche Website bereitgestellt.
