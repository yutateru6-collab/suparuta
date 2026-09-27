import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeQuestProgress, emptyQuestProgress, finishQuest, questId, questSections, sectionAtChunk } from '../../services/quest.ts';
import type { Chunk } from '../../types.ts';

const sample = JSON.parse(readFileSync(new URL('../../public/libraries-of-things.reviewed.json', import.meta.url), 'utf8')) as Chunk[];

test('checkpoint sections cover the text in order and prefer sentence endings', () => {
  const ends = questSections(sample);
  assert.equal(ends.length, 4); assert.equal(ends.at(-1), sample.length - 1);
  assert.ok(ends.every((end, index) => index === 0 || end > ends[index - 1]));
  assert.ok(ends.slice(0, -1).every(end => /[.!?]["'”’)]?$/.test(sample[end].en)));
  assert.equal(sectionAtChunk(ends, ends[0]), 0);
  assert.equal(sectionAtChunk(ends, ends[0] + 1), 1);
  assert.deepEqual(questSections([{ en: 'One short line.', jp: '' }]), [0]);
});

test('one text earns a cosmetic reward only on its first completion', () => {
  const id = questId(sample);
  assert.equal(id, questId(sample));
  const first = finishQuest(emptyQuestProgress(), id);
  assert.equal(first.earned, 30); assert.equal(first.progress.sparks, 30);
  const repeat = finishQuest(first.progress, id);
  assert.equal(repeat.earned, 0); assert.deepEqual(repeat.progress, first.progress);
  assert.deepEqual(decodeQuestProgress(JSON.stringify(first.progress)), first.progress);
});

test('corrupt quest storage is rejected rather than silently normalized', () => {
  for (const raw of ['{}', '{"version":1,"sparks":-2,"completed":[]}', '{"version":1,"sparks":0,"completed":[1]}']) {
    assert.throws(() => decodeQuestProgress(raw));
  }
  assert.deepEqual(decodeQuestProgress(null), emptyQuestProgress());
});
