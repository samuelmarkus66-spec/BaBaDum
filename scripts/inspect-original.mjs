// Read-only source inspection. Uses curl's standard proxy/TLS settings and stops on access denials.
// It does not acquire media in bulk, use accounts, or bypass robots/access restrictions.
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const directory = resolve('local-originals/inspection');
await mkdir(directory, { recursive: true });
const origin = 'https://babadum.com';
function read(url) {
  const response = spawnSync('curl', ['--silent', '--show-error', '--fail-with-body', '--location',
    '--max-redirs', '4', '--max-time', '30', '--proto', '=https', '--proto-redir', '=https', url],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (response.error) throw response.error;
  if (response.status !== 0) throw new Error(`Zugriff fehlgeschlagen: ${url}\n${response.stderr.trim()}\n${response.stdout.slice(0, 300)}`);
  return response.stdout;
}
try {
  const html = read(`${origin}/play/?lang=4&game=1`);
  await writeFile(resolve(directory, 'play.html'), html);
  const urls = [...new Set([...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map(match => { try { return new URL(match[1].replaceAll('&amp;', '&'), origin).href; } catch { return null; } })
    .filter(Boolean))];
  const index = { inspectedAt: new Date().toISOString(), url: `${origin}/play/?lang=4&game=1`,
    references: urls, note: 'Öffentliche Erreichbarkeit allein bestätigt keine Erlaubnis zur Weiterverbreitung. Nutzungsbedingungen und Zuordnungen vor einem Medienimport prüfen.' };
  await writeFile(resolve(directory, 'references.json'), JSON.stringify(index, null, 2));
  console.log(`HTML und ${urls.length} Dateiverweise wurden in ${directory} gesichert.`);
  console.log('Prüfe die Verweise, Nutzungsbedingungen und den JavaScript-Datenfluss vor dem Erstellen einer manifest.json. Es wurden keine Medien gesammelt.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
