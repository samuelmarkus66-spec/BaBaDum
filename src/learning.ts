import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import { localDay, normalizeWord, wordKey, type AnswerLog, type LearnedWord, type Settings, type Vocabulary } from './model';

export type Random = () => number;
export function shuffled<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function imageIdentity(word: Vocabulary, source = word.image) {
  const r = word.imageRegion;
  return r ? `${source}#${r.x},${r.y},${r.width},${r.height},${r.sourceWidth},${r.sourceHeight}` : source;
}
export function isDistinct(a: Vocabulary, b: Vocabulary, hashes: Record<string, string> = {}) {
  return a.id !== b.id && a.conceptId !== b.conceptId && imageIdentity(a) !== imageIdentity(b) &&
    (!hashes[a.image] || !hashes[b.image] || imageIdentity(a, hashes[a.image]) !== imageIdentity(b, hashes[b.image])) &&
    normalizeWord(a.word) !== normalizeWord(b.word) &&
    !a.ambiguityGroups.some(group => b.ambiguityGroups.includes(group));
}
// Backtracking avoids rejecting a valid quartet merely because the first distractor conflicts.
export function answerOptions(target: Vocabulary, vocabulary: Vocabulary[], random: Random = Math.random,
  hashes: Record<string, string> = {}): Vocabulary[] {
  const candidates = shuffled(vocabulary.filter(w => w.language === target.language && (!target.answerFamily || w.answerFamily === target.answerFamily) && isDistinct(target, w, hashes)), random);
  const chosen = [target];
  function search(start: number): boolean {
    if (chosen.length === 4) return true;
    for (let i = start; i < candidates.length; i++) {
      if (!chosen.every(word => isDistinct(word, candidates[i], hashes))) continue;
      chosen.push(candidates[i]);
      if (search(i + 1)) return true;
      chosen.pop();
    }
    return false;
  }
  if (!search(0)) throw new Error(`Für „${target.word}“ fehlen drei eindeutig verschiedene Antwortbilder.`);
  return shuffled(chosen, random);
}
export interface Selection {
  word?: Vocabulary; reason: 'due' | 'new' | 'complete' | 'practice'; nextDue?: Date;
}
export function selectNext(args: {
  packId: string; vocabulary: Vocabulary[]; cards: LearnedWord[]; settings: Settings;
  now: Date; previousId?: string; practice?: boolean; random?: Random;
}): Selection {
  const { packId, cards, settings, now, previousId, practice, random = Math.random } = args;
  const words = args.vocabulary.filter(w => w.language === settings.language);
  const records = new Map(cards.filter(c => c.packId === packId && c.language === settings.language).map(c => [c.key, c]));
  if (practice) return { word: shuffled(words.filter(w => w.id !== previousId || words.length === 1), random)[0], reason: 'practice' };
  const due = shuffled(words.filter(w => {
    const record = records.get(wordKey(packId, w));
    return record && record.card.due.getTime() <= now.getTime();
  }), random).sort((a, b) => records.get(wordKey(packId, a))!.card.due.getTime() - records.get(wordKey(packId, b))!.card.due.getTime());
  if (due.length) return { word: due.find(w => w.id !== previousId) ?? due[0], reason: 'due' };
  const newToday = [...records.values()].filter(c => c.introducedDay === localDay(now)).length;
  if (newToday < settings.newPerDay) {
    const next = shuffled(words.filter(w => !records.has(wordKey(packId, w))), random)[0];
    if (next) return { word: next, reason: 'new' };
  }
  const future = [...records.values()].map(c => c.card.due).filter(d => d > now).sort((a, b) => +a - +b);
  return { reason: 'complete', nextDue: future[0] };
}
export function reviewWord(args: {
  packId: string; word: Vocabulary; answerId: string; correct: boolean;
  previous?: LearnedWord; settings: Settings; now: Date; reviewId: string;
}): { record: LearnedWord; review: AnswerLog } {
  const { packId, word, answerId, correct, previous, settings, now, reviewId } = args;
  const scheduler = fsrs({ request_retention: settings.retention, enable_fuzz: true,
    enable_short_term: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
  const before = previous?.card ?? createEmptyCard<Card>(now);
  const result = scheduler.next(before, now, correct ? Rating.Good : Rating.Again);
  const key = wordKey(packId, word);
  return {
    record: { key, packId, vocabularyId: word.id, language: word.language, card: result.card,
      introducedDay: previous?.introducedDay ?? localDay(now),
      correct: (previous?.correct ?? 0) + Number(correct), wrong: (previous?.wrong ?? 0) + Number(!correct) },
    review: { id: reviewId, key, answerId, correct, at: now, before, after: result.card, log: result.log },
  };
}
export function statistics(packId: string, cards: LearnedWord[], language: string, now: Date) {
  const selected = cards.filter(c => c.packId === packId && c.language === language);
  return {
    learned: selected.length, newToday: selected.filter(c => c.introducedDay === localDay(now)).length,
    due: selected.filter(c => c.card.due <= now).length,
    correct: selected.reduce((n, c) => n + c.correct, 0), wrong: selected.reduce((n, c) => n + c.wrong, 0),
    reviews: selected.reduce((n, c) => n + c.card.reps, 0),
  };
}
