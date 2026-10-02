import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextLocal } from '../../services/localParser.ts';
import { checkpointPercent, makeFrames } from '../../services/readerModel.ts';
import { addViewedRange, allWordsViewed, decodeDraft, decodeSettings, decodeSession, defaultSettings } from '../../services/readingState.ts';
import { decodeQuestProgress, emptyQuestProgress, finishQuest } from '../../services/quest.ts';

test('safe boundaries keep near the school entrance together and retain every word', () => {
  const text = 'Young students really enjoyed reading several interesting science books yesterday near the school entrance.';
  const chunks = parseTextLocal(text);
  assert.equal(chunks.map(c => c.en).join(' '), text);
  assert.equal(chunks.at(-1)?.en, 'near the school entrance.');
  for (const ending of ['the', 'my', 'will', 'to']) {
    const words = `One two three four five six seven eight nine ten eleven ${ending} school entrance.`;
    const result = parseTextLocal(words);
    assert.equal(result.map(c => c.en).join(' '), words);
    assert.ok(result.every(c => !c.en.endsWith(` ${ending}`)));
  }
});

test('draft, settings and session round trip; unsupported records are rejected', () => {
  assert.equal(decodeDraft('unfinished input\n'), 'unfinished input\n');
  const settings = { ...defaultSettings(), wpm: 160, wordGroupSize: 1, showTranslation: true, translationDelay: 7, revealMode: 'zoom' as const };
  assert.deepEqual(decodeSettings(JSON.parse(JSON.stringify(settings))), settings);
  const session = { version: 1, text: 'one two', chunks: [{ en: 'one two', jp: '' }], wordOffset: 1, viewed: [[0, 1]], experience: 'quest' };
  assert.deepEqual(decodeSession(JSON.parse(JSON.stringify(session))), session);
  for (const bad of [{}, { ...settings, wpm: NaN }, { ...settings, translationDelay: '7' }, { ...settings, wordGroupSize: 9 }]) assert.throws(() => decodeSettings(bad));
  assert.throws(() => decodeSession({ ...session, wordOffset: 2 }));
  assert.throws(() => decodeSession({ ...session, viewed: [[0, 9]] }));
});

test('last range alone is not completion; disjoint ranges merge across grouping changes', () => {
  let viewed = addViewedRange([], 20, 2);
  assert.equal(allWordsViewed(viewed, 22), false);
  viewed = addViewedRange(viewed, 0, 10);
  viewed = addViewedRange(viewed, 5, 10);
  assert.equal(allWordsViewed(viewed, 22), false);
  viewed = addViewedRange(viewed, 15, 5);
  assert.equal(allWordsViewed(viewed, 22), true);
  assert.equal(allWordsViewed([], 0), false);
});

test('checkpoint and runner share display positions for unequal chunk lengths', () => {
  const chunks = Array.from({ length: 12 }, (_, i) => ({ en: i < 6 ? 'one two three four five six seven eight nine ten' : 'one', jp: '' }));
  assert.equal(checkpointPercent(makeFrames(chunks, 0), 5), 50);
  assert.equal(checkpointPercent(makeFrames(chunks, 1), 5), 60 / 66 * 100);
  assert.equal(checkpointPercent(makeFrames(chunks, 5), 5), 12 / 18 * 100);
});

test('legacy completion ledger survives 500 and 1000 completions without renewed first reward', () => {
  let progress = emptyQuestProgress();
  for (let i = 0; i < 1001; i++) progress = finishQuest(progress, `${i}-a`).progress;
  assert.equal(progress.completed.length, 1001);
  assert.equal(progress.sparks, 30030);
  progress = decodeQuestProgress(JSON.stringify(progress));
  assert.equal(finishQuest(progress, '0-a').earned, 0);
  const legacy = decodeQuestProgress(JSON.stringify({ version: 1, sparks: 15000, completed: Array.from({ length: 500 }, (_, i) => `${i}-b`) }));
  const next = finishQuest(legacy, '500-b');
  assert.equal(next.progress.completed.length, 501);
  assert.equal(finishQuest(next.progress, '0-b').earned, 0);
});
