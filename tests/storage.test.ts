import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { Repository, StaleProgressError } from '../src/storage';
import { exportProgress, parseProgress } from '../src/backup';
import { pack, settings, time } from './fixtures';
import { packSchema } from '../src/model';
const databases: Repository[] = [];
function createRepository(name: string = crypto.randomUUID()) { const db = new Repository(name); databases.push(db); return db; }
async function prepared(name?: string) {
  const db = createRepository(name);
  await db.installPack(pack, [{ path: 'images/0.svg', blob: new Blob(['test']), sha256: 'test' }], 0);
  return db;
}
async function answer(db: Repository, correct = true) {
  const state = await db.snapshot();
  return db.answer({ packId: pack.id, word: pack.vocabulary[0], answerId: pack.vocabulary[correct ? 0 : 1].id,
    now: time, revision: state.revision, reviewId: crypto.randomUUID() });
}
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.close())); });
describe('IndexedDB', () => {
  it('speichert Karten, Historie, Einstellungen und Medien nach dem erneuten Öffnen', async () => {
    const name = crypto.randomUUID(); const db = await prepared(name);
    await answer(db, false);
    const state = await db.snapshot();
    await db.saveSettings({ ...settings, newPerDay: 9, retention: 0.95 }, state.revision);
    await db.close();
    const reopened = createRepository(name);
    const saved = await reopened.snapshot();
    expect(saved.cards[0].wrong).toBe(1); expect(saved.reviews).toHaveLength(1);
    expect(saved.cards[0].card.due).toBeInstanceOf(Date);
    expect(saved.settings.retention).toBe(0.95); expect(saved.settings.newPerDay).toBe(9);
    expect(saved.pack?.id).toBe(pack.id); expect((await reopened.assets())[0].blob.size).toBe(4);
  });
  it('verhindert doppelte Bewertung durch parallele Tabs', async () => {
    const name = crypto.randomUUID(); const a = await prepared(name); const b = createRepository(name);
    const args = { packId: pack.id, word: pack.vocabulary[0], answerId: pack.vocabulary[0].id, now: time, revision: 1 };
    const results = await Promise.allSettled([
      a.answer({ ...args, reviewId: 'a' }), b.answer({ ...args, reviewId: 'b' }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(r => r.status === 'rejected');
    expect(failure && failure.status === 'rejected' && failure.reason).toBeInstanceOf(StaleProgressError);
    expect((await a.snapshot()).reviews).toHaveLength(1);
  });
  it('rollt einen fehlgeschlagenen Schreibvorgang vollständig zurück', async () => {
    const db = await prepared();
    await db.answer({ packId: pack.id, word: pack.vocabulary[0], answerId: pack.vocabulary[0].id,
      now: time, revision: 1, reviewId: 'duplicate-id' });
    const before = await db.snapshot();
    await expect(db.answer({ packId: pack.id, word: pack.vocabulary[0], answerId: pack.vocabulary[1].id,
      now: time, revision: before.revision, reviewId: 'duplicate-id' })).rejects.toThrow();
    expect(await db.snapshot()).toEqual(before);
  });
  it('verhindert unbemerkten Austausch der Bedeutung bestehender Karten', async () => {
    const db = await prepared(); await answer(db);
    const before = await db.snapshot(); const changed = structuredClone(pack); changed.vocabulary[0].word = 'andere Bedeutung';
    await expect(db.installPack(changed, [], before.revision)).rejects.toThrow('anders zuordnen');
    expect((await db.snapshot()).pack).toEqual(pack);
    expect(await db.assets()).toHaveLength(1);
  });
  it('exportiert und importiert sämtliche FSRS-Daten verlustfrei', async () => {
    const db = await prepared(); await answer(db);
    const saved = await db.snapshot();
    const encoded = exportProgress(pack.id, saved, time);
    const decoded = parseProgress(encoded, pack);
    expect(decoded.cards).toEqual(saved.cards); expect(decoded.reviews).toEqual(saved.reviews);
    expect(decoded.settings).toEqual(saved.settings);
    const second = await prepared(); await second.restore(decoded, 1);
    expect((await second.snapshot()).cards).toEqual(saved.cards);
    expect((await second.snapshot()).reviews).toEqual(saved.reviews);
  });
  it('stale Restore überschreibt keine neueren Antworten', async () => {
    const db = await prepared(); const before = await db.snapshot(); await answer(db);
    await expect(db.restore(before, before.revision)).rejects.toBeInstanceOf(StaleProgressError);
    expect((await db.snapshot()).reviews).toHaveLength(1);
  });
});
describe('Sicherungen prüfen', () => {
  async function fixture() { const db = await prepared(); await answer(db); return JSON.parse(exportProgress(pack.id, await db.snapshot())); }
  it('weist falsche Version, fremden Wortschatz und kaputte Datumsfelder zurück', async () => {
    const data = await fixture();
    expect(() => parseProgress(JSON.stringify({ ...data, version: 2 }), pack)).toThrow();
    expect(() => parseProgress(JSON.stringify({ ...data, packId: 'other' }), pack)).toThrow('anderen Wortschatz');
    data.cards[0].card.due = 'invalid';
    expect(() => parseProgress(JSON.stringify(data), pack)).toThrow();
  });
  it('weist unvollständige Historien und doppelte Karten zurück', async () => {
    const data = await fixture();
    expect(() => parseProgress(JSON.stringify({ ...data, reviews: [] }), pack)).toThrow('stimmen nicht');
    expect(() => parseProgress(JSON.stringify({ ...data, cards: [...data.cards, ...data.cards] }), pack)).toThrow('doppelte Karte');
  });
  it('weist falsche Bewertungen und negative Wiederholungen zurück', async () => {
    const data = await fixture(); data.reviews[0].log.rating = 1;
    expect(() => parseProgress(JSON.stringify(data), pack)).toThrow('Bewertung');
    const second = await fixture(); second.cards[0].card.reps = -1;
    expect(() => parseProgress(JSON.stringify(second), pack)).toThrow();
  });
  it('weist überzählige Wiederholungen ohne Karte zurück', async () => {
    const data = await fixture(); data.cards = [];
    expect(() => parseProgress(JSON.stringify(data), pack)).toThrow('ohne Karte');
  });
});
describe('Wortschatzschema', () => {
  it('akzeptiert explizit zugeordnete lokale Dateien', () => expect(packSchema.parse(pack)).toEqual(pack));
  it('weist Netzwerkpfade, Traversal, unbekannte Sprachen und doppelte IDs zurück', () => {
    for (const path of ['https://example.org/image.svg', '../secret', '/etc/passwd', 'C:\\file.png']) {
      const broken = structuredClone(pack); broken.vocabulary[0].image = path;
      expect(() => packSchema.parse(broken)).toThrow();
    }
    const duplicate = structuredClone(pack); duplicate.vocabulary.push(duplicate.vocabulary[0]);
    expect(() => packSchema.parse(duplicate)).toThrow('Doppelte Vokabel-ID');
    const unknown = structuredClone(pack); unknown.vocabulary[0].language = 'unknown';
    expect(() => packSchema.parse(unknown)).toThrow('Unbekannte Sprache');
  });
});
