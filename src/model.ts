import { z } from 'zod';
import type { Card, ReviewLog } from 'ts-fsrs';

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const assetPath = z.string().max(250).refine(value =>
  !value.startsWith('/') && !value.includes('\\') && !value.includes(':') &&
  value.split('/').every(part => !!part && part !== '.' && part !== '..'),
  'Dateipfade müssen relativ zum Wortschatzordner sein.');
const imageRegionSchema = z.object({
  x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
  width: z.number().int().positive(), height: z.number().int().positive(),
  sourceWidth: z.number().int().positive().max(16384), sourceHeight: z.number().int().positive().max(16384),
}).strict().refine(r => r.x + r.width <= r.sourceWidth && r.y + r.height <= r.sourceHeight,
  'Der Bildausschnitt liegt außerhalb der Bilddatei.');
export const vocabularySchema = z.object({
  id, language: id, conceptId: id, word: z.string().trim().min(1).max(150),
  image: assetPath, audio: assetPath, imageRegion: imageRegionSchema.optional(),
  translation: z.string().min(1).max(200).optional(),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb']).optional(),
  category: z.string().max(100).optional(), answerFamily: id.optional(),
  frequencyRank: z.number().int().positive().nullable().optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ambiguityGroups: z.array(id).max(100).default([]),
}).strict();
export const packSchema = z.object({
  format: z.literal('babadum-local-pack'), version: z.literal(1), id,
  title: z.string().min(1).max(150),
  source: z.object({
    url: z.url(), rights: z.string().trim().min(1).max(2000),
    note: z.string().max(2000).optional(),
  }).strict(),
  languages: z.array(z.object({ id, name: z.string().min(1).max(80), flag: z.string().max(12).optional() }).strict()).min(1).max(100),
  font: assetPath.optional(),
  vocabulary: z.array(vocabularySchema).min(4).max(100_000),
}).strict().superRefine((pack, ctx) => {
  const languages = new Set(pack.languages.map(l => l.id));
  if (languages.size !== pack.languages.length) ctx.addIssue({ code: 'custom', message: 'Doppelte Sprach-ID.' });
  const keys = new Set<string>();
  for (const word of pack.vocabulary) {
    const key = `${word.language}:${word.id}`;
    if (keys.has(key)) ctx.addIssue({ code: 'custom', message: `Doppelte Vokabel-ID: ${key}` });
    keys.add(key);
    if (!languages.has(word.language)) ctx.addIssue({ code: 'custom', message: `Unbekannte Sprache: ${word.language}` });
  }
  for (const language of languages) {
    if (new Set(pack.vocabulary.filter(w => w.language === language).map(w => w.conceptId)).size < 4)
      ctx.addIssue({ code: 'custom', message: `Für ${language} sind mindestens vier verschiedene Bedeutungen nötig.` });
  }
});
export type Vocabulary = z.infer<typeof vocabularySchema>;
export type VocabularyPack = z.infer<typeof packSchema>;
export const settingsSchema = z.object({
  language: id, newPerDay: z.number().int().min(0).max(1000), retention: z.number().min(0.7).max(0.99),
}).strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { language: 'es', newPerDay: 20, retention: 0.9 };
export interface LearnedWord {
  key: string; packId: string; vocabularyId: string; language: string;
  card: Card; introducedDay: string; correct: number; wrong: number;
}
export interface AnswerLog {
  id: string; key: string; answerId: string; correct: boolean; at: Date;
  before: Card; after: Card; log: ReviewLog;
}
export interface Progress { cards: LearnedWord[]; reviews: AnswerLog[]; settings: Settings }
export interface Asset { path: string; blob: Blob; sha256: string }
export function wordKey(packId: string, word: Pick<Vocabulary, 'id' | 'language'>) {
  return `${packId}:${word.language}:${word.id}`;
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function normalizeWord(word: string) { return word.normalize('NFKC').trim().toLocaleLowerCase(); }
