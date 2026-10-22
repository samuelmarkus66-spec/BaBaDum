import { createEmptyCard, type Card } from 'ts-fsrs';
import { defaultSettings, wordKey, type LearnedWord, type VocabularyPack } from '../src/model';
export const pack: VocabularyPack = {
  format: 'babadum-local-pack', version: 1, id: 'test-shapes', title: 'TESTDATEN – keine BaBaDum-Originalressourcen',
  source: { url: 'https://example.invalid/test-fixtures', rights: 'Eigene geometrische Testgrafiken und synthetische Töne, ausschließlich für automatisierte Tests.' },
  languages: [{ id: 'es', name: 'Español', flag: '🇪🇸' }, { id: 'de', name: 'Deutsch', flag: '🇩🇪' }],
  vocabulary: ['es', 'de'].flatMap(language => Array.from({ length: 6 }, (_, index) => ({
    id: `word-${index}`, language, conceptId: `shape-${index}`, word: `${language}-Testwort-${index}`,
    image: `images/${index}.svg`, audio: `audio/${index}.wav`, ambiguityGroups: [],
    background: ['#bf8824', '#faf082', '#d9ddbc', '#9ccbd0', '#e9a591', '#c1d4ae'][index],
  }))),
};
export const time = new Date('2026-10-20T12:00:00Z');
export const settings = { ...defaultSettings };
export function learned(index: number, due = time, language = 'es'): LearnedWord {
  const word = pack.vocabulary.find(w => w.id === `word-${index}` && w.language === language)!;
  return { key: wordKey(pack.id, word), packId: pack.id, vocabularyId: word.id, language,
    card: { ...createEmptyCard<Card>(time), due, reps: 1, state: 1, last_review: time },
    introducedDay: '2026-10-19', correct: 1, wrong: 0 };
}
