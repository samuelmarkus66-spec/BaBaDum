import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { defaultSettings, settingsSchema, type AnswerLog, type Asset, type LearnedWord, type Progress,
  type Settings, type Vocabulary, type VocabularyPack } from './model';
import { reviewWord } from './learning';

interface LocalDatabase extends DBSchema {
  config: { key: string; value: Settings | number };
  packs: { key: string; value: VocabularyPack };
  assets: { key: string; value: Asset };
  cards: { key: string; value: LearnedWord };
  reviews: { key: string; value: AnswerLog };
}
export class StaleProgressError extends Error {
  constructor() { super('Der Lernstand wurde in einem anderen Fenster geändert. Die Ansicht wird neu geladen.'); }
}
export interface Snapshot extends Progress { pack?: VocabularyPack; revision: number }
export class Repository {
  private db: Promise<IDBPDatabase<LocalDatabase>>;
  constructor(name = 'babadum-local-v1') {
    this.db = openDB<LocalDatabase>(name, 1, { upgrade(db) {
      db.createObjectStore('config'); db.createObjectStore('packs');
      db.createObjectStore('assets', { keyPath: 'path' });
      db.createObjectStore('cards', { keyPath: 'key' });
      db.createObjectStore('reviews', { keyPath: 'id' });
    } });
  }
  async snapshot(includeReviews = true): Promise<Snapshot> {
    const tx = (await this.db).transaction(['config', 'packs', 'cards', 'reviews']);
    const [settings, revision, pack, cards, reviews] = await Promise.all([
      tx.objectStore('config').get('settings'), tx.objectStore('config').get('revision'),
      tx.objectStore('packs').get('active'), tx.objectStore('cards').getAll(), includeReviews ? tx.objectStore('reviews').getAll() : Promise.resolve([]),
    ]);
    await tx.done;
    return { settings: (settings as Settings | undefined) ?? { ...defaultSettings }, revision: (revision as number) ?? 0, pack, cards, reviews };
  }
  async assets() { return (await this.db).getAll('assets'); }
  async saveSettings(settings: Settings, revision: number) {
    settingsSchema.parse(settings);
    const tx = (await this.db).transaction('config', 'readwrite');
    void tx.done.catch(() => {}); // Individual operations and final completion are still awaited below.
    if (((await tx.store.get('revision')) ?? 0) !== revision) { await tx.done; throw new StaleProgressError(); }
    await tx.store.put(settings, 'settings');
    await tx.store.put(revision + 1, 'revision');
    await tx.done;
  }
  async installPack(pack: VocabularyPack, assets: Asset[], revision: number) {
    const tx = (await this.db).transaction(['config', 'packs', 'assets', 'cards'], 'readwrite');
    void tx.done.catch(() => {}); // Prevent an unobserved completion rejection if a request aborts the transaction.
    if (((await tx.objectStore('config').get('revision')) ?? 0) !== revision) { await tx.done; throw new StaleProgressError(); }
    const cards = await tx.objectStore('cards').getAll();
    const oldPack = await tx.objectStore('packs').get('active');
    if (cards.length && oldPack) {
      const newWords = new Map(pack.vocabulary.map(w => [`${w.language}:${w.id}`, w]));
      const changed = pack.id !== oldPack.id || oldPack.vocabulary.some(old => {
        const next = newWords.get(`${old.language}:${old.id}`);
        return !next || old.word !== next.word || old.conceptId !== next.conceptId;
      });
      if (changed) { await tx.done; throw new Error('Dieser Wortschatz würde bestehende Karten anders zuordnen. Verwende denselben Wortschatz oder ein separates Browserprofil.'); }
    }
    await tx.objectStore('assets').clear();
    for (const asset of assets) await tx.objectStore('assets').put(asset);
    await tx.objectStore('packs').put(pack, 'active');
    const current = (await tx.objectStore('config').get('settings')) as Settings | undefined;
    const settings = current ?? { ...defaultSettings };
    if (!pack.languages.some(l => l.id === settings.language)) settings.language = pack.languages[0].id;
    await tx.objectStore('config').put(settings, 'settings');
    await tx.objectStore('config').put(revision + 1, 'revision');
    await tx.done;
  }
  async answer(args: { packId: string; word: Vocabulary; answerId: string; now: Date; revision: number; reviewId: string }) {
    const tx = (await this.db).transaction(['cards', 'reviews', 'config', 'packs'], 'readwrite');
    void tx.done.catch(() => {});
    const revision = (await tx.objectStore('config').get('revision')) ?? 0;
    if (revision !== args.revision) { await tx.done; throw new StaleProgressError(); }
    const pack = await tx.objectStore('packs').get('active');
    if (!pack || pack.id !== args.packId) { await tx.done; throw new StaleProgressError(); }
    const settings = ((await tx.objectStore('config').get('settings')) as Settings | undefined) ?? defaultSettings;
    const key = `${args.packId}:${args.word.language}:${args.word.id}`;
    const previous = await tx.objectStore('cards').get(key);
    const result = reviewWord({ ...args, previous, settings, correct: args.word.id === args.answerId });
    await tx.objectStore('cards').put(result.record);
    await tx.objectStore('reviews').add(result.review);
    await tx.objectStore('config').put(args.revision + 1, 'revision');
    await tx.done;
    return result;
  }
  async restore(progress: Progress, revision: number) {
    const tx = (await this.db).transaction(['config', 'cards', 'reviews'], 'readwrite');
    void tx.done.catch(() => {}); // Prevent an unobserved completion rejection if a request aborts the transaction.
    if (((await tx.objectStore('config').get('revision')) ?? 0) !== revision) { await tx.done; throw new StaleProgressError(); }
    await tx.objectStore('cards').clear();
    await tx.objectStore('reviews').clear();
    for (const card of progress.cards) await tx.objectStore('cards').put(card);
    for (const review of progress.reviews) await tx.objectStore('reviews').put(review);
    await tx.objectStore('config').put(progress.settings, 'settings');
    await tx.objectStore('config').put(revision + 1, 'revision');
    await tx.done;
  }
  async close() { (await this.db).close(); }
}
