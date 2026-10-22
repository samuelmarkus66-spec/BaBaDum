import { describe, it, expect } from 'vitest';
import { Rating, State } from 'ts-fsrs';
import { answerOptions, reviewWord, selectNext, statistics } from '../src/learning';
import { localDay, wordKey } from '../src/model';
import { learned, pack, settings, time } from './fixtures';
const words = pack.vocabulary.filter(w => w.language === 'es');
const select = (overrides: Partial<Parameters<typeof selectNext>[0]> = {}) => selectNext({
  packId: pack.id, vocabulary: pack.vocabulary, cards: [], settings, now: time, random: () => 0.5, ...overrides,
});
const review = (correct: boolean, overrides: Partial<Parameters<typeof reviewWord>[0]> = {}) => reviewWord({
  packId: pack.id, word: words[0], answerId: correct ? words[0].id : words[1].id, correct,
  now: time, settings, reviewId: 'review-1', ...overrides,
});
describe('FSRS-Bewertung', () => {
  it('ordnet eine richtige Antwort Good zu und speichert den kompletten Verlauf', () => {
    const { record, review: log } = review(true);
    expect(log.log.rating).toBe(Rating.Good);
    expect(record.card.state).toBe(State.Learning);
    expect(record.card.due.getTime() - time.getTime()).toBe(10 * 60_000);
    expect(record.correct).toBe(1); expect(record.wrong).toBe(0); expect(record.card.reps).toBe(1);
    expect(log.before.reps).toBe(0); expect(log.after).toEqual(record.card);
    expect(record.introducedDay).toBe(localDay(time));
  });
  it('ordnet eine falsche Antwort Again zu und plant sie in einer Minute', () => {
    const result = review(false);
    expect(result.review.log.rating).toBe(Rating.Again);
    expect(result.record.card.due.getTime() - time.getTime()).toBe(60_000);
    expect(result.record.wrong).toBe(1); expect(result.record.correct).toBe(0);
  });
  it('übernimmt das bisherige Gedächtnismodell und ändert den Eingangsdatensatz nicht', () => {
    const first = review(true).record;
    const copy = structuredClone(first);
    const second = review(true, { previous: first, now: first.card.due, reviewId: 'review-2' });
    expect(first).toEqual(copy);
    expect(second.record.card.reps).toBe(2);
    expect(second.record.card.state).toBe(State.Review);
    expect(second.record.card.due > first.card.due).toBe(true);
    expect(second.record.introducedDay).toBe(first.introducedDay);
    expect(second.record.correct).toBe(2);
  });
  it('höhere Zielbehaltensrate ergibt langfristig kürzere Intervalle', () => {
    let record = review(true).record;
    for (let i = 0; i < 8; i++) record = review(true, { previous: record, now: record.card.due }).record;
    const low = review(true, { previous: record, now: record.card.due, settings: { ...settings, retention: 0.8 } });
    const high = review(true, { previous: record, now: record.card.due, settings: { ...settings, retention: 0.97 } });
    expect(high.record.card.scheduled_days).toBeLessThan(low.record.card.scheduled_days);
  });
});
describe('Auswahl und Tageslimit', () => {
  it('bevorzugt eine fällige Karte vor neuen Vokabeln', () => {
    expect(select({ cards: [learned(2)] }).word?.id).toBe('word-2');
    expect(select({ cards: [learned(2)] }).reason).toBe('due');
  });
  it('fragt Zukunftskarten nicht vorzeitig ab', () => {
    const cards = words.map((_, i) => learned(i, new Date(+time + 60_000)));
    expect(select({ cards })).toEqual({ reason: 'complete', nextDue: new Date(+time + 60_000) });
  });
  it('fragt Again-Karten erst beim Erreichen des Lernschritts erneut ab', () => {
    const card = review(false).record;
    const limit = { ...settings, newPerDay: 1 };
    expect(select({ cards: [card], settings: limit, now: new Date(+time + 59_999) }).reason).toBe('complete');
    expect(select({ cards: [card], settings: limit, now: new Date(+time + 60_000) }).word?.id).toBe(words[0].id);
  });
  it('beachtet das Tageslimit und gibt nächste Fälligkeit zurück', () => {
    const cards = [review(true).record];
    expect(select({ cards, settings: { ...settings, newPerDay: 1 } }).reason).toBe('complete');
    expect(select({ cards, settings: { ...settings, newPerDay: 2 } }).reason).toBe('new');
    expect(select({ settings: { ...settings, newPerDay: 0 } }).word).toBeUndefined();
  });
  it('zählt nur neue Wörter des lokalen Tages und derselben Sprache', () => {
    const card = learned(0, new Date(+time + 86_400_000));
    expect(select({ cards: [card], settings: { ...settings, newPerDay: 1 } }).reason).toBe('new');
    const german = { ...learned(0, new Date(+time + 86_400_000), 'de'), introducedDay: localDay(time) };
    expect(select({ cards: [german], settings: { ...settings, newPerDay: 1 } }).reason).toBe('new');
  });
  it('bevorzugt überfällige Karten und vermeidet unnötige direkte Wiederholungen', () => {
    const oldest = learned(1, new Date(+time - 100_000));
    expect(select({ cards: [learned(2), oldest] }).word?.id).toBe('word-1');
    expect(select({ cards: [learned(2), oldest], previousId: 'word-1' }).word?.id).toBe('word-2');
  });
  it('Freies Üben darf Zukunftskarten wählen und mutiert keinen Zustand', () => {
    const cards = words.map((_, i) => learned(i, new Date(+time + 86_400_000)));
    const before = structuredClone(cards);
    const result = select({ cards, practice: true, previousId: 'word-1' });
    expect(result.reason).toBe('practice'); expect(result.word).toBeDefined();
    expect(result.word?.id).not.toBe('word-1'); expect(cards).toEqual(before);
  });
  it('hält Vokabeln verschiedener Sprachen getrennt', () => {
    expect(wordKey(pack.id, pack.vocabulary[0])).not.toBe(wordKey(pack.id, pack.vocabulary[6]));
    expect(select({ settings: { ...settings, language: 'de' } }).word?.language).toBe('de');
  });
});
describe('Vier eindeutige Antwortbilder', () => {
  it('liefert exakt vier Bilder, genau eine richtige Antwort und wechselnde Positionen', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 80; i++) {
      const options = answerOptions(words[0], pack.vocabulary);
      expect(options).toHaveLength(4);
      expect(options.filter(w => w.id === words[0].id)).toHaveLength(1);
      expect(new Set(options.map(w => w.image)).size).toBe(4);
      expect(options.every(w => w.language === 'es')).toBe(true);
      positions.add(options.findIndex(w => w.id === words[0].id));
    }
    expect(positions.size).toBe(4);
  });
  it('schließt Synonyme, gleiche Bilder, gleiche Bedeutung und mehrdeutige Gruppen aus', () => {
    const invalid = [
      { ...words[0], id: 'same-concept', image: 'other.svg' },
      { ...words[1], id: 'same-image', image: words[0].image },
      { ...words[1], id: 'same-word', word: words[0].word.toUpperCase() },
      { ...words[1], id: 'ambiguous', ambiguityGroups: ['confusing'] },
    ];
    const target = { ...words[0], ambiguityGroups: ['confusing'] };
    const options = answerOptions(target, [...invalid, target, ...words.slice(2)]);
    expect(options.every(w => !invalid.some(i => i.id === w.id))).toBe(true);
  });
  it('erkennt identische Dateien mit verschiedenen Dateinamen über SHA-256', () => {
    const options = answerOptions(words[0], words, () => 0.5, { [words[0].image]: 'same', [words[1].image]: 'same' });
    expect(options.some(w => w.id === words[1].id)).toBe(false);
  });
  it('meldet unzureichende eindeutige Bilder statt falsche Alternativen zu erzeugen', () => {
    expect(() => answerOptions(words[0], words.slice(0, 3))).toThrow('fehlen drei');
  });
});
it('berechnet Lernstatistiken sprachbezogen und mit richtigen/falschen Antworten', () => {
  const record = review(false).record;
  const result = statistics(pack.id, [record, learned(1, time, 'de')], 'es', new Date(+time + 60_000));
  expect(result).toEqual({ learned: 1, newToday: 1, due: 1, correct: 0, wrong: 1, reviews: 1 });
});

describe('Generierte Bildersammlung', () => {
  it('kann verschiedene Ausschnitte derselben Bilddatei als Antworten verwenden', () => {
    const sprites = words.map((w, i) => ({ ...w, image: 'atlas.png',
      imageRegion: { x: i * 100, y: 0, width: 100, height: 100, sourceWidth: 600, sourceHeight: 100 } }));
    const options = answerOptions(sprites[0], sprites, () => 0.5, { 'atlas.png': 'same-file-hash' });
    expect(options).toHaveLength(4);
    expect(new Set(options.map(w => w.imageRegion?.x)).size).toBe(4);
  });
  it('verhindert dieselben Ausschnitte unter verschiedenen Dateinamen', () => {
    const region = { x: 0, y: 0, width: 100, height: 100, sourceWidth: 600, sourceHeight: 100 };
    const target = { ...words[0], imageRegion: region };
    const duplicate = { ...words[1], imageRegion: region };
    const options = answerOptions(target, [target, duplicate, ...words.slice(2)], () => 0.5,
      { [target.image]: 'same-file-hash', [duplicate.image]: 'same-file-hash' });
    expect(options.some(w => w.id === duplicate.id)).toBe(false);
  });
  it('wählt bei Farben nur andere Farbkarten als Gegenantworten', () => {
    const colors = words.slice(0, 4).map(w => ({ ...w, answerFamily: 'colors' }));
    const other = words.slice(4).map(w => ({ ...w, answerFamily: 'noun' }));
    const options = answerOptions(colors[0], [...colors, ...other]);
    expect(options.every(w => w.answerFamily === 'colors')).toBe(true);
  });
});
