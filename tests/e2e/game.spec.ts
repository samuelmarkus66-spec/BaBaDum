import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pack } from '../fixtures';

let folder: string;
test.beforeEach(async ({ page }) => {
  await page.route('**/content/spanish-1500/manifest.json', route => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    const urls = window as unknown as { testBlobs: Record<string, Blob> };
    urls.testBlobs = {};
    const original = URL.createObjectURL;
    URL.createObjectURL = function (object) {
      const url = original.call(URL, object);
      if (object instanceof Blob) urls.testBlobs[url] = object;
      return url;
    };
  });
});
// Synthetic assets are test fixtures only. They are never included in public/ or the application build.
function wave(frequency: number) {
  const length = 2205; const buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24); buffer.writeUInt32LE(44100, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * frequency * 2 * Math.PI / 22050) * 1200), 44 + i * 2);
  return buffer;
}
test.beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'babadum-test-pack-'));
  await mkdir(join(folder, 'images')); await mkdir(join(folder, 'audio'));
  await writeFile(join(folder, 'manifest.json'), JSON.stringify(pack));
  for (let i = 0; i < 6; i++) {
    const shape = ['<circle cx="150" cy="150" r="85"/>', '<rect x="70" y="70" width="160" height="160" rx="15"/>',
      '<path d="M150 50L250 230H50Z"/>', '<path d="M150 45L255 150L150 255L45 150Z"/>',
      '<ellipse cx="150" cy="150" rx="110" ry="65"/>', '<path d="M100 50H200V100H250V200H200V250H100V200H50V100H100Z"/>'][i];
    await writeFile(join(folder, `images/${i}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" data-test-shape="${i}"><g fill="#f7ead2" stroke="#293a4d" stroke-width="8">${shape}</g></svg>`);
    await writeFile(join(folder, `audio/${i}.wav`), wave(220 + i * 55));
  }
});
async function install(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Wortschatzordner auswählen' })).toBeEnabled();
  await page.getByLabel('Wortschatzordner', { exact: true }).setInputFiles(folder);
  await expect(page.locator('.word')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.tile img')).toHaveCount(4);
}
async function configure(page: Page, newPerDay: number, language = 'es') {
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByLabel('Neue Wörter pro Tag', { exact: true }).fill(String(newPerDay));
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption(language);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function correctIndex(page: Page) {
  const target = (await page.locator('.word').innerText()).split('-').at(-1);
  const shapes = await page.locator('.tile img').evaluateAll(async images => Promise.all(images.map(async image => {
    const blobs = (window as unknown as { testBlobs: Record<string, Blob> }).testBlobs;
    const text = await blobs[(image as HTMLImageElement).src].text();
    return text.match(/data-test-shape="(\d+)"/)?.[1];
  })));
  return shapes.indexOf(target);
}
async function backup(page: Page) {
  if (!(await page.getByRole('dialog').count())) await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Lernstand exportieren' }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}
async function closeSettings(page: Page) { await page.getByRole('button', { name: 'Schließen', exact: true }).click(); }

test('zeigt ohne mitgeliefertes Paket den Import an und nimmt keine externen Anfragen vor', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173/')) external.push(r.url()); });
  await page.goto('/');
  await expect(page.getByText('Wortschatz noch nicht vorhanden')).toBeVisible();
  await expect(page.locator('.tile img')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('prüft alle Dateien, speichert Again, verhindert Doppelklicks und übt ohne FSRS-Änderung frei', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await install(page); await configure(page, 1);
  const index = await correctIndex(page); expect(index).toBeGreaterThanOrEqual(0);
  const wrong = (index + 1) % 4;
  await page.locator('.tile').nth(wrong).click();
  await expect(page.getByLabel('Falsche Antwort', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Richtige Antwort', { exact: true })).toBeVisible();
  await page.locator('.tile').nth(wrong).dispatchEvent('click');
  await expect(page.getByRole('heading', { name: 'Für jetzt geschafft.' })).toBeVisible();
  const saved = await backup(page);
  expect(saved.cards).toHaveLength(1); expect(saved.reviews).toHaveLength(1);
  expect(saved.reviews[0].log.rating).toBe(1);
  expect(Date.parse(saved.cards[0].card.due) - Date.parse(saved.reviews[0].at)).toBe(60_000);
  await closeSettings(page); await page.reload();
  await expect(page.getByRole('heading', { name: 'Für jetzt geschafft.' })).toBeVisible();
  await page.getByRole('button', { name: 'Frei weiterüben' }).click();
  await expect(page.getByRole('button', { name: 'Freies Üben beenden' })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const oldWord = await page.locator('.word').innerText();
    const index = await correctIndex(page);
    await page.locator('.tile').nth(index).click();
    await expect(page.locator('.word')).not.toHaveText(oldWord);
  }
  const after = await backup(page);
  expect(after.cards).toEqual(saved.cards); expect(after.reviews).toEqual(saved.reviews);
  expect(errors).toEqual([]);
});

test('Good, fällige Wiederholungen, Sprachwechsel und Wiederherstellung funktionieren', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await install(page); await configure(page, 1);
  const word = await page.locator('.word').innerText();
  await page.locator('.tile').nth(await correctIndex(page)).click();
  await expect(page.getByRole('heading', { name: 'Für jetzt geschafft.' })).toBeVisible();
  const saved = await backup(page);
  expect(saved.reviews[0].log.rating).toBe(3);
  expect(Date.parse(saved.cards[0].card.due) - Date.parse(saved.reviews[0].at)).toBe(600_000);
  await closeSettings(page);
  await page.clock.fastForward(601_000);
  await expect(page.locator('.word')).toHaveText(word);
  await page.locator('.tile').nth(await correctIndex(page)).click();
  await expect(page.getByRole('heading', { name: 'Für jetzt geschafft.' })).toBeVisible();
  const second = await backup(page); expect(second.cards[0].card.reps).toBe(2);
  await page.getByLabel('Lernstand importieren', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.getByRole('group', { name: 'Import bestätigen' })).toBeVisible();
  await page.getByRole('button', { name: 'Lernstand ersetzen' }).click();
  // Restored due date is now in the past, so the restored card is immediately eligible.
  await expect(page.locator('.word')).toHaveText(word);
  const restored = await backup(page); expect(restored.cards).toEqual(saved.cards); expect(restored.reviews).toEqual(saved.reviews);
  await page.getByLabel('Lernstand importieren', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"invalid"}') });
  await expect(page.getByRole('alert')).toContainText('Format');
  const unchanged = await backup(page); expect(unchanged.cards).toEqual(saved.cards);
  await closeSettings(page); await configure(page, 1, 'de');
  await expect(page.locator('.word')).toContainText('de-Testwort');
  await page.locator('.tile').nth(await correctIndex(page)).click();
  await expect(page.getByRole('heading', { name: 'Für jetzt geschafft.' })).toBeVisible();
  const bilingual = await backup(page);
  expect(bilingual.cards.map((c: { language: string }) => c.language).sort()).toEqual(['de', 'es']);
});

test('importierte Medien sind offline lokal, Audio ist abspielbar und das Layout passt auf kleine Bildschirme', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:5173/')) { external.push(url); await route.abort(); }
    else await route.fallback();
  });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    (window as unknown as { audioPlays: number }).audioPlays = 0;
    HTMLMediaElement.prototype.play = function () {
      return original.call(this).then(() => { (window as unknown as { audioPlays: number }).audioPlays++; });
    };
  });
  await install(page);
  await page.locator('.word').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioPlays: number }).audioPlays)).toBeGreaterThan(0);
  await page.reload(); await expect(page.locator('.tile img')).toHaveCount(4);
  expect(await page.locator('.tile img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const tiles = await page.locator('.tile').evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
  }));
  expect(tiles).toEqual([{ x: 0, y: 0, width: 720, height: 450 }, { x: 720, y: 0, width: 720, height: 450 }, { x: 0, y: 450, width: 720, height: 450 }, { x: 720, y: 450, width: 720, height: 450 }]);
  await page.screenshot({ path: 'test-results/game-test-fixtures-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/game-test-fixtures-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('ein ungültiger Ressourcenimport verändert den bisherigen Wortschatz nicht', async ({ page }) => {
  await install(page);
  const invalidFolder = await mkdtemp(join(tmpdir(), 'babadum-invalid-'));
  await writeFile(join(invalidFolder, 'manifest.json'), JSON.stringify(pack));
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByLabel('Wortschatzordner', { exact: true }).setInputFiles(invalidFolder);
  await expect(page.getByRole('alert')).toContainText('Datei fehlt');
  await closeSettings(page); await page.reload();
  await expect(page.locator('.tile img')).toHaveCount(4);
});
