import { packSchema, type Asset } from './model';
import { Repository, StaleProgressError } from './storage';
const root = '/content/spanish-1500/';
let install: Promise<void> | undefined;
/** Install bundled content once; never overwrite an existing personal corpus or progress. */
export function ensureBundledPack(repository: Repository, report: (message: string) => void) {
  if (install) return install;
  install = (async () => {
    const state = await repository.snapshot(false);
    if (state.pack) return;
    const response = await fetch(`${root}manifest.json`);
    if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) return;
    if (!response.ok) throw new Error('Der mitgelieferte Wortschatz konnte nicht geladen werden.');
    const pack = packSchema.parse(await response.json());
    const hashResponse = await fetch(`${root}checksums.json`);
    if (!hashResponse.ok) throw new Error('Die Prüfsummen des Wortschatzes fehlen.');
    const checksums = await hashResponse.json() as Record<string, string>;
    const paths = [...new Set([...pack.vocabulary.flatMap(w => [w.image, w.audio]), ...(pack.font ? [pack.font] : [])])];
    const assets: Asset[] = [];
    let cursor = 0;
    report(`Spanischen Wortschatz vorbereiten · 0 / ${paths.length} Dateien`);
    async function load() {
      while (cursor < paths.length) {
        const path = paths[cursor++];
        if (!/^[0-9a-f]{64}$/.test(checksums[path] ?? '')) throw new Error(`Prüfsumme fehlt: ${path}`);
        const result = await fetch(root + path);
        if (!result.ok) throw new Error(`Mitgelieferte Datei fehlt: ${path}`);
        const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.ogg') ? 'audio/ogg' : 'font/ttf';
        const blob = new Blob([await result.arrayBuffer()], { type: mime });
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        const sha256 = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
        if (sha256 !== checksums[path]) throw new Error(`Beschädigte Datei: ${path}. Bitte das vollständige Paket erneut entpacken.`);
        assets.push({ path, blob, sha256 });
        if (assets.length % 25 === 0 || assets.length === paths.length)
          report(`Spanischen Wortschatz vorbereiten · ${assets.length} / ${paths.length} Dateien`);
      }
    }
    await Promise.all(Array.from({ length: 8 }, load));
    try { await repository.installPack(pack, assets, state.revision); }
    catch (error) {
      if (!(error instanceof StaleProgressError) || !(await repository.snapshot(false)).pack) throw error;
    }
    void navigator.storage?.persist().catch(() => false);
  })().catch(error => { install = undefined; throw error; });
  return install;
}
