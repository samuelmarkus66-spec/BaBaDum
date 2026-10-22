import { z } from 'zod';
import { Rating } from 'ts-fsrs';
import { settingsSchema, wordKey, type Progress, type VocabularyPack } from './model';
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const finite = z.number().finite().nonnegative();
const date = z.iso.datetime().transform(value => new Date(value));
const state = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const cardSchema = z.object({
  due: date, stability: finite, difficulty: z.number().min(0).max(10), elapsed_days: finite,
  scheduled_days: finite, learning_steps: count, reps: count, lapses: count, state,
  last_review: date.optional(),
}).strict();
const reviewSchema = z.object({
  rating: z.union([z.literal(Rating.Again), z.literal(Rating.Good)]), state, due: date,
  stability: finite, difficulty: z.number().min(0).max(10), elapsed_days: finite,
  last_elapsed_days: finite, scheduled_days: finite, learning_steps: count, review: date,
}).strict();
const backupSchema = z.object({
  format: z.literal('babadum-local-progress'), version: z.literal(1),
  packId: z.string(), exportedAt: date, settings: settingsSchema,
  cards: z.array(z.object({
    key: z.string(), packId: z.string(), vocabularyId: z.string(), language: z.string(), card: cardSchema,
    introducedDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), correct: count, wrong: count,
  }).strict()).max(100_000),
  reviews: z.array(z.object({
    id: z.string().min(1).max(100), key: z.string(), answerId: z.string(), correct: z.boolean(),
    at: date, before: cardSchema, after: cardSchema, log: reviewSchema,
  }).strict()).max(1_000_000),
}).strict();
export function exportProgress(packId: string, progress: Progress, now = new Date()): string {
  return JSON.stringify({ format: 'babadum-local-progress', version: 1, packId, exportedAt: now,
    settings: progress.settings, cards: progress.cards, reviews: progress.reviews }, null, 2);
}
function equalCard(a: object, b: object) { return JSON.stringify(a) === JSON.stringify(b); }
export function parseProgress(text: string, pack: VocabularyPack): Progress {
  const backup = backupSchema.parse(JSON.parse(text));
  if (backup.packId !== pack.id) throw new Error('Die Sicherung gehört zu einem anderen Wortschatz.');
  if (!pack.languages.some(l => l.id === backup.settings.language)) throw new Error('Die Sprache der Sicherung fehlt im Wortschatz.');
  const words = new Map(pack.vocabulary.map(w => [wordKey(pack.id, w), w]));
  const keys = new Set<string>();
  const logs = new Map<string, typeof backup.reviews>();
  const reviewIds = new Set<string>();
  for (const review of backup.reviews) {
    if (reviewIds.has(review.id)) throw new Error('Doppelte Wiederholungs-ID in der Sicherung.');
    reviewIds.add(review.id);
    const word = words.get(review.key);
    if (!word || !pack.vocabulary.some(w => w.language === word.language && w.id === review.answerId))
      throw new Error('Die Sicherung enthält unbekannte Vokabeln.');
    if (review.correct !== (review.answerId === word.id) ||
      review.log.rating !== (review.correct ? Rating.Good : Rating.Again) ||
      +review.at !== +review.log.review || +review.at !== +(review.after.last_review ?? NaN) ||
      review.after.reps !== review.before.reps + 1 || review.after.due < review.at)
      throw new Error('Widersprüchliche Bewertung in der Sicherung.');
    const list = logs.get(review.key) ?? [];
    list.push(review);
    logs.set(review.key, list);
  }
  for (const record of backup.cards) {
    if (keys.has(record.key) || record.packId !== pack.id ||
      record.key !== wordKey(pack.id, { id: record.vocabularyId, language: record.language }) || !words.has(record.key))
      throw new Error('Ungültige oder doppelte Karte in der Sicherung.');
    keys.add(record.key);
    const history = (logs.get(record.key) ?? []).sort((a, b) => a.after.reps - b.after.reps);
    if (history.length === 0 || history.length !== record.card.reps ||
      history.filter(r => r.correct).length !== record.correct || history.filter(r => !r.correct).length !== record.wrong ||
      !equalCard(history.at(-1)!.after, record.card) || record.card.state === 0)
      throw new Error('Kartenstand und Wiederholungsverlauf stimmen nicht überein.');
    for (let i = 0; i < history.length; i++) {
      if (history[i].before.reps !== i || (i > 0 &&
        (!equalCard(history[i - 1].after, history[i].before) || history[i].at < history[i - 1].at)))
        throw new Error('Der Wiederholungsverlauf ist unvollständig.');
    }
  }
  if ([...logs.keys()].some(key => !keys.has(key))) throw new Error('Wiederholungen ohne Karte in der Sicherung.');
  return { cards: backup.cards, reviews: backup.reviews, settings: backup.settings };
}
