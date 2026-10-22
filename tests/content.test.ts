import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { packSchema } from '../src/model';
import { answerOptions, imageIdentity } from '../src/learning';
const root = resolve('public/content/spanish-1500');
const pack = packSchema.parse(JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')));
const checksums = JSON.parse(readFileSync(resolve(root, 'checksums.json'), 'utf8')) as Record<string, string>;
describe('Mitgelieferter spanischer Wortschatz', () => {
  it('enthält 1500 stabile IDs und die vereinbarte Wortartenmischung', () => {
    expect(pack.vocabulary).toHaveLength(1500);
    expect(new Set(pack.vocabulary.map(w => w.id)).size).toBe(1500);
    expect(new Set(pack.vocabulary.map(w => w.word)).size).toBe(1500);
    expect(new Set(pack.vocabulary.map(w => imageIdentity(w))).size).toBe(1500);
    expect(pack.vocabulary.filter(w => w.partOfSpeech === 'noun')).toHaveLength(1000);
    expect(pack.vocabulary.filter(w => w.partOfSpeech === 'verb')).toHaveLength(300);
    expect(pack.vocabulary.filter(w => w.partOfSpeech === 'adjective')).toHaveLength(200);
    expect(pack.vocabulary.every(w => w.translation && w.imageRegion && w.language === 'es')).toBe(true);
  });
  it('liefert jede Medienreferenz mit korrekter SHA-256-Prüfsumme', () => {
    const paths = [...new Set([...pack.vocabulary.flatMap(w => [w.image, w.audio]), pack.font!])];
    expect(paths).toHaveLength(1561);
    for (const path of paths) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
      const data = readFileSync(resolve(root, path));
      expect(data.byteLength, path).toBeGreaterThan(100);
      expect(createHash('sha256').update(data).digest('hex'), path).toBe(checksums[path]);
      if (path.endsWith('.ogg')) expect(data.subarray(0, 4).toString(), path).toBe('OggS');
    }
  });
  it('findet für jedes der 1500 Wörter genau vier eindeutige passende Antwortoptionen', () => {
    for (const word of pack.vocabulary) {
      const options = answerOptions(word, pack.vocabulary, () => 0.37, checksums);
      expect(options, word.id).toHaveLength(4);
      expect(options.filter(option => option.id === word.id), word.id).toHaveLength(1);
      expect(options.every(option => option.answerFamily === word.answerFamily), word.id).toBe(true);
    }
  });
  it('verwirft Bildkoordinaten außerhalb der Quelldatei', () => {
    const invalid = structuredClone(pack);
    invalid.vocabulary[0].imageRegion!.x = 999999;
    expect(() => packSchema.parse(invalid)).toThrow('außerhalb');
  });
});
