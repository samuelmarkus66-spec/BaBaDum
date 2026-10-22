import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const port = 5173;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('Der Build fehlt. Bitte zuerst npm run build ausführen.'); process.exit(1); }
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; font-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const file = await stat(path);
    if (!file.isFile()) throw new Error('not a file');
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.writeHead(200);
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Datei nicht gefunden.'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port 5173 ist belegt. Beende den bereits laufenden BaBaDum-Server. Der feste Port erhält den Zugriff auf deinen lokalen Lernstand.'
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const address = `http://127.0.0.1:${port}`;
  console.log(`BaBaDum lokal läuft unter ${address}. Beenden mit Strg+C.`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '', address], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => console.log('Bitte die angezeigte Adresse im Browser öffnen.'));
  }
});
