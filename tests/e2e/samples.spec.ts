import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ReadingSample } from '../../types';
import { buildChunkPrompt } from '../../services/chunkPrompt';
const samples: ReadingSample[] = JSON.parse(readFileSync('public/trivia-samples.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
});

for (const sample of samples) {
  test(`sample ${sample.id}: copy, paste, read every English/Japanese chunk`, async ({ page }, info) => {
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as any).__sampleClipboard = value; },
    } }));
    await page.getByLabel('英文テキスト').fill('Keep my existing draft until I paste.');
    await page.getByLabel('読んでみたい雑学').selectOption(sample.id);
    await expect(page.getByLabel('英文と和訳のプレビュー')).toContainText(sample.chunks[0].en);
    await expect(page.getByLabel('英文と和訳のプレビュー')).toContainText(sample.chunks[0].jp);
    if (sample.id === samples[0].id) await page.locator('.quest-reading-routes').screenshot({ path: info.outputPath('sample-chooser.png') });
    await page.getByRole('button', { name: 'サンプルJSONをコピー', exact: true }).click();
    const copied = await page.evaluate(() => (window as any).__sampleClipboard);
    expect(JSON.parse(copied)).toEqual(sample.chunks);
    await expect(page.getByLabel('英文テキスト')).toHaveValue('Keep my existing draft until I paste.');
    await page.getByLabel('英文テキスト').fill(copied);
    await page.getByRole('button', { name: '冒険をはじめる' }).click();
    await page.getByRole('button', { name: '日本語訳 OFF', exact: true }).click();
    for (let index = 0; index < sample.chunks.length; index++) {
      await expect(page.getByTestId('quest-reader-text')).toHaveText(sample.chunks[index].en);
      await expect(page.getByTestId('quest-translation')).toHaveText(sample.chunks[index].jp);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (index === 0 && sample.id === samples[0].id) await page.screenshot({ path: info.outputPath('sample-reading.png'), fullPage: true });
      await page.getByRole('button', { name: '次のチャンク', exact: true }).click();
      if (await page.getByTestId('quest-checkpoint').isVisible()) await page.getByRole('button', { name: 'つづきを読む' }).click();
    }
    await expect(page.getByRole('heading', { name: '読書の冒険、クリア！' })).toBeVisible();
  });
}

test('sample chooser, clipboard fallback and switching routes leave draft/settings untouched', async ({ page }, info) => {
  await page.getByLabel('英文テキスト').fill('My unfinished draft.');
  await page.getByRole('button', { name: '高速 (160)', exact: true }).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }));
  await page.getByLabel('読んでみたい雑学').selectOption(samples[1].id);
  await page.getByRole('button', { name: 'サンプルJSONをコピー', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('手動でコピー');
  await expect(page.getByLabel('サンプルJSON')).toHaveValue(JSON.stringify(samples[1].chunks, null, 2));
  await expect(page.getByRole('button', { name: 'JSONをコピーしました' })).toHaveCount(0);
  await page.getByLabel('サンプルJSON').focus();
  expect(await page.getByLabel('サンプルJSON').evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe(JSON.stringify(samples[1].chunks, null, 2).length);
  await page.screenshot({ path: info.outputPath('manual-copy-fallback.png'), fullPage: true });
  await page.getByRole('button', { name: '自分の英文で作る' }).click();
  await page.getByRole('button', { name: 'サンプルを試す' }).click();
  await expect(page.getByLabel('英文テキスト')).toHaveValue('My unfinished draft.');
  await expect(page.getByRole('slider', { name: '表示速度（WPM）' })).toHaveValue('160');
  await page.reload();
  await expect(page.getByLabel('英文テキスト')).toHaveValue('My unfinished draft.');
  await expect(page.getByRole('slider', { name: '表示速度（WPM）' })).toHaveValue('160');
});

test('own-English route copies current source prompt and offers manual fallback', async ({ page }, info) => {
  await page.getByRole('button', { name: '自分の英文で作る' }).click();
  await page.getByLabel('英文テキスト').fill('Young students read books near the school entrance.');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as any).__promptClipboard = value; } } }));
  await page.getByRole('button', { name: 'プロンプトコピー', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__promptClipboard)).toBe(buildChunkPrompt('Young students read books near the school entrance.'));
  await page.getByLabel('英文テキスト').fill('A different source.');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }));
  await page.getByRole('button', { name: /^(プロンプトコピー|コピー完了！ ✓)$/ }).click();
  await expect(page.getByLabel('手動コピー用プロンプト')).toHaveValue(buildChunkPrompt('A different source.'));
  await expect(page.getByRole('alert')).toContainText('コピーが許可されません');
  await page.screenshot({ path: info.outputPath('create-own-english.png'), fullPage: true });
});

test('desktop clipboard performs a real copy and keyboard paste', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Real clipboard permission is supported by the desktop Chromium project; all projects test the clipboard contract and fallback.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('読んでみたい雑学').selectOption(samples[0].id);
  await page.getByRole('button', { name: 'サンプルJSONをコピー', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(copied)).toEqual(samples[0].chunks);
  await page.getByLabel('英文テキスト').focus();
  await page.keyboard.press('ControlOrMeta+V');
  // Windows clipboard uses CRLF; textarea values normalize line endings to LF.
  await expect(page.getByLabel('英文テキスト')).toHaveValue(copied.replace(/\r\n/g, '\n'));
  expect(JSON.parse(await page.getByLabel('英文テキスト').inputValue())).toEqual(samples[0].chunks);
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await expect(page.getByTestId('quest-reader-text')).toHaveText(samples[0].chunks[0].en);
});
