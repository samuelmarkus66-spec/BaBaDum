> Historische Analyse des ersten Auftrags. Der Nutzer hat anschließend einen eigenen Wortschatz und neu erzeugte Medien beauftragt. Diese Alternative ist jetzt mitgeliefert; der frühere Originalzugriff blockiert das Spielen nicht mehr.

# Analyse des Originals und offene Arbeit

Stand: 20. Oktober 2026.

## Nachweislich verfügbar

Der vom Nutzer bereitgestellte Screenshot zeigt den Modus `play/?lang=4&game=1` mit:

- vier bildschirmfüllenden, gleich großen Farbflächen ohne Zwischenraum;
- je einer zentrierten Illustration, Wort mittig über dem Schnittpunkt;
- heller, kräftiger, gerundeter Wortschrift mit dunkler Kontur;
- Modussymbol links oben, Gesamt- und Sprachzähler rechts oben;
- Einstellungen links unten, Sprachauswahl rechts unten.

Die Browserleisten gehören nicht zur Anwendung. Die Spielfläche im Screenshot beginnt unterhalb davon. Rekonstruiert wurde die relative 2×2-Geometrie der Spielfläche. Als sichtbare Ausgangsfarben dienen ungefähr `#bf8824`, `#faf082`, `#d9ddbc`, `#9ccbd0`. Im tatsächlichen Spiel übernimmt jede Antwort die im Wortschatz hinterlegte Farbe.

## Zugriffsergebnis

Ein regulärer HTTPS-Zugriff auf `https://babadum.com/play/?lang=4&game=1` scheiterte bereits beim Proxy-Tunnel mit `HTTP/1.1 403 Forbidden` / `CONNECT tunnel failed`. Das ist eine Einschränkung der Cloud-Netzwerkfreigabe, kein Beleg, dass die Originalwebsite selbst diese Ressource verweigert.

`babadum.com` und `www.babadum.com` wurden zur benutzerdefinierten Freigabeliste im Konfigurationsentwurf hinzugefügt. Das Speichern des Entwurfs ist keine Anwendung dieser Freigabe in der laufenden Maschine. Der Nutzer muss die Änderungen in den Umgebungseinstellungen speichern. Es wurden keine alternativen Proxys, Zugriffsumgehungen oder Authentifizierungsversuche verwendet.

Deshalb konnten HTML/CSS/JavaScript, Bild- und Audioformate, Dateinamen, Sprachlisten, Vokabel-IDs, semantische Zuordnungen, Schriftlizenz und Nutzungsbedingungen **nicht** verifiziert werden. Es wurde keine Zulässigkeit einer vollständigen Übernahme behauptet. Der technische Medienimport sagt nichts über die Nutzungsrechte eines konkreten Datensatzes aus.

## Was implementiert ist und was noch fehlt

| Bereich | Stand |
| --- | --- |
| 2×2-Anordnung, mittiges Wort, Eckbedienung | nach Screenshot rekonstruiert; Desktop- und Mobile-Browser geprüft |
| Originalillustrationen und Audio | fehlen; lokaler Import ist implementiert |
| Gesamter Originalwortschatz und exakte Zuordnungen | fehlen; keine erfundenen Original-IDs oder Wörter ausgeliefert |
| Originalschrift | nicht verfügbar; Systemschrift als offen dokumentierte Abweichung, Import einer erlaubten Originalschrift möglich |
| Richtige/falsche Antwort | automatische Auswertung, Markierung und Übergang implementiert; Originalanimation nicht verifiziert |
| Feedback-Timing | vorläufig 850 ms richtig / 1700 ms falsch; nach Originalanalyse abzugleichen |
| Aussprache | automatische lokale Wiedergabe und Wiederholung per Wortklick; Browser-Autoplay berücksichtigt |
| FSRS, Fortschritt, Sicherungen, Spracheinstellungen | implementiert und automatisiert geprüft |
| Vollständige spielbare Originalerfahrung | noch durch fehlende Originalressourcen blockiert |

## Weiterarbeiten bei verfügbarem Zugriff

1. In den Umgebungseinstellungen die Freigabe für `babadum.com` und `www.babadum.com` speichern. Falls später Originaldateien von weiteren Hosts geladen werden, die tatsächlich beobachteten Hosts gezielt ergänzen.
2. `npm run inspect:original` ausführen. Das Skript liest die öffentliche Spielseite mit normalen HTTPS-/Proxy-/TLS-Einstellungen und speichert HTML und referenzierte URLs im ignorierten Ordner `local-originals/inspection`. Bei einer Zugriffssperre stoppt es. Es sammelt keine Medien massenhaft.
3. Öffentliche HTML-, CSS- und JavaScript-Quellen sowie relevante Nutzungsbedingungen untersuchen. Dateipfade, Sprachen, IDs und Bild-/Audiozuordnungen aus belegten Daten ableiten; keine Zuordnung erraten.
4. Zunächst einen kleinen, erlaubten Originaldatensatz mit mindestens vier eindeutigen Bedeutungen und zugehörigen Bildern/Audio erstellen. Quellen, Rechtebasis und semantische Mehrdeutigkeiten dokumentieren.
5. Eine `manifest.json` nach `WORTSCHATZ.md` erzeugen und den Ordner importieren. Erst anhand des Originals prüfen, ob jedes Wort tatsächlich zum Bild und zur Aufnahme passt.
6. Screenshots derselben vier Originalbilder und desselben Wortes vergleichen. Schrift, Skalierung, Farben, Hover-/Fehler-/Erfolgsanimationen und Zeitablauf angleichen.
7. Auf den gesamten erlaubten, technisch zugänglichen Wortschatz erweitern. Pro Sprache Medienvollständigkeit und Zuordnungen prüfen.

Ein erfolgreicher Test mit synthetischen Testdateien ersetzt die Schritte 3–7 ausdrücklich nicht.
