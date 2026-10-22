import { answerOptions } from './learning';
import { packSchema, type Asset, type VocabularyPack } from './model';

const types: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
  gif: 'image/gif', avif: 'image/avif', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  m4a: 'audio/mp4', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
};
function validateSvg(text: string) {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg' ||
    /<!DOCTYPE|<!ENTITY|@import/i.test(text)) throw new Error('Ungültige oder extern verknüpfte SVG-Datei.');
  for (const element of document.querySelectorAll('*')) {
    if (['script', 'foreignobject', 'iframe', 'audio', 'video'].includes(element.localName.toLowerCase()))
      throw new Error('Aktive Inhalte sind in Bilddateien nicht erlaubt.');
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name) || (/href$/i.test(attribute.name) && !attribute.value.startsWith('#')))
        throw new Error('Die SVG-Datei enthält aktive oder externe Verweise.');
    }
  }
  for (const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)/gi)) {
    if (!match[1].startsWith('#')) throw new Error('Die SVG-Datei enthält externe Ressourcen.');
  }
}
async function verifyMedia(blob: Blob, path: string) {
  const url = URL.createObjectURL(blob);
  try {
    if (blob.type.startsWith('image/')) {
      const image = new Image(); image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Leeres Bild.');
    } else if (blob.type.startsWith('audio/')) {
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio();
        const timer = setTimeout(() => finish(new Error('Zeitüberschreitung beim Prüfen der Audiodatei.')), 15_000);
        function finish(error?: Error) {
          clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null;
          audio.removeAttribute('src'); audio.load();
          if (error) reject(error); else resolve();
        }
        audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? undefined : new Error('Leere Audiodatei.'));
        audio.onerror = () => finish(new Error('Audioformat kann nicht gelesen werden.'));
        audio.preload = 'metadata'; audio.src = url;
      });
    } else {
      const face = new FontFace('PackValidation', await blob.arrayBuffer());
      await face.load();
    }
  } catch { throw new Error(`Die Datei „${path}“ kann im Browser nicht als Bild, Audio oder Schrift gelesen werden.`); }
  finally { URL.revokeObjectURL(url); }
}
export async function importFolder(files: File[], report: (text: string) => void): Promise<{ pack: VocabularyPack; assets: Asset[] }> {
  const manifests = files.filter(f => f.name === 'manifest.json');
  if (manifests.length !== 1) throw new Error('Der Ordner muss genau eine manifest.json enthalten. Das Format steht in docs/WORTSCHATZ.md.');
  const manifestFile = manifests[0];
  if (manifestFile.size > 20 * 1024 * 1024) throw new Error('Die manifest.json ist zu groß (maximal 20 MB).');
  const manifestPath = manifestFile.webkitRelativePath || manifestFile.name;
  const prefix = manifestPath.slice(0, -'manifest.json'.length);
  const pack = packSchema.parse(JSON.parse(await manifestFile.text()));
  const lookup = new Map(files.map(f => [(f.webkitRelativePath || f.name).slice(prefix.length), f]));
  const paths = [...new Set([...pack.vocabulary.flatMap(w => [w.image, w.audio]), ...(pack.font ? [pack.font] : [])])];
  let total = 0;
  for (const path of paths) {
    const file = lookup.get(path);
    if (!file) throw new Error(`Datei fehlt: ${path}`);
    if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error(`Ungültige Dateigröße: ${path}`);
    total += file.size;
  }
  if (total > 2 * 1024 ** 3) throw new Error('Der Wortschatz ist größer als 2 GB. Bitte zunächst einzelne Sprachen importieren.');
  const estimate = await navigator.storage?.estimate();
  if (estimate?.quota && total > estimate.quota - (estimate.usage ?? 0))
    throw new Error('Zu wenig Browserspeicher für den Wortschatz.');
  const assets: Asset[] = [];
  for (let start = 0; start < paths.length; start += 4) {
    await Promise.all(paths.slice(start, start + 4).map(async path => {
      const file = lookup.get(path)!;
      const extension = path.split('.').at(-1)!.toLowerCase();
      const mime = types[extension];
      if (!mime) throw new Error(`Nicht unterstütztes Dateiformat: ${path}`);
      const blob = new Blob([file], { type: mime });
      if (extension === 'svg') validateSvg(await blob.text());
      await verifyMedia(blob, path);
      const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const sha256 = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      assets.push({ path, blob, sha256 });
    }));
    report(`Bild- und Audiodateien prüfen · ${Math.min(start + 4, paths.length)} / ${paths.length}`);
  }
  const byPath = new Map(assets.map(a => [a.path, a]));
  const hashes = Object.fromEntries(assets.map(a => [a.path, a.sha256]));
  const byLanguage = new Map(pack.languages.map(language => [language.id, pack.vocabulary.filter(word => word.language === language.id)]));
  for (let i = 0; i < pack.vocabulary.length; i++) {
    const word = pack.vocabulary[i];
    if (!byPath.get(word.image)!.blob.type.startsWith('image/') || !byPath.get(word.audio)!.blob.type.startsWith('audio/'))
      throw new Error(`Bild und Audio sind falsch zugeordnet: ${word.id}`);
    answerOptions(word, byLanguage.get(word.language)!, () => 0.5, hashes);
    if (i % 100 === 0) { report(`Bildzuordnungen prüfen · ${i + 1} / ${pack.vocabulary.length}`); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  if (pack.font && !byPath.get(pack.font)!.blob.type.startsWith('font/')) throw new Error('Die Schriftdatei hat das falsche Format.');
  return { pack, assets };
}
export async function createAssetUrls(assets: Asset[]) {
  return Object.fromEntries(assets.map(asset => [asset.path, URL.createObjectURL(asset.blob)]));
}
