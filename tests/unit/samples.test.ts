import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReadingInput, getPromptSource } from '../../services/localParser.ts';
import type { ReadingSample } from '../../types.ts';

const samples: ReadingSample[] = JSON.parse(readFileSync(new URL('../../public/trivia-samples.json', import.meta.url), 'utf8'));

test('ten distinct trivia samples contain usable English, Japanese and source links', () => {
  assert.equal(samples.length, 10);
  assert.equal(new Set(samples.map(sample => sample.id)).size, 10);
  for (const sample of samples) {
    assert.match(sample.id, /^[a-z0-9-]+$/);
    assert.ok(sample.title.trim() && sample.description.trim());
    assert.ok(sample.chunks.length > 1);
    for (const chunk of sample.chunks) {
      assert.ok(chunk.en.trim() && chunk.jp.trim());
      assert.match(chunk.jp, /[ぁ-んァ-ヶ一-龯]/);
      assert.equal(chunk.speaker, null);
    }
    const words = sample.chunks.map(chunk => chunk.en).join(' ').trim().split(/\s+/).length;
    assert.ok(words >= 90 && words <= 130, `${sample.id}: ${words} words`);
    assert.equal(words, sample.wordCount);
    assert.equal(sample.chunks.map(chunk => chunk.en).join(' '), sample.sourceText);
    assert.deepEqual(sample.chunks, JSON.parse(readFileSync(new URL(`../../public/samples/${sample.id}.json`, import.meta.url), 'utf8')));
    assert.ok(sample.sources.length > 0);
    for (const source of sample.sources) {
      assert.ok(source.title.trim());
      assert.equal(new URL(source.url).protocol, 'https:');
    }
  }
});

test('every copied sample imports without corrections, dropped chunks or changed translations', () => {
  assert.equal(samples.length, 10);
  for (const sample of samples) {
    const json = JSON.stringify(sample.chunks, null, 2);
    const parsed = parseReadingInput(json);
    assert.deepEqual(parsed.warnings, []);
    assert.deepEqual(parsed.chunks, sample.chunks, sample.id);
    assert.equal(getPromptSource(json), sample.chunks.map(chunk => chunk.en).join(' '));
  }
});
