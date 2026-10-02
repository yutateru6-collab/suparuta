import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { questSections } from '../../services/quest';

const sample = JSON.parse(readFileSync('public/libraries-of-things.reviewed.json', 'utf8'));
const sections = questSections(sample);
const input = (page: Page) => page.getByLabel('英文テキスト');

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
});

test('quest sample, checkpoints, finish and one-time cosmetic reward', async ({ page }, info) => {
  test.slow(); // Two full traversals plus screenshots on mobile WebKit.
  await expect(page.getByRole('heading', { name: /ことばの冒険へ/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('quest-home.png'), fullPage: true });
  await page.getByRole('button', { name: '校閲済みサンプルを入れる' }).click();
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await expect(page.getByTestId('quest-reader-text')).toHaveText(sample[0].en);
  await page.screenshot({ path: info.outputPath('quest-reader.png'), fullPage: true });
  await page.getByRole('button', { name: '日本語訳 OFF' }).click();
  await expect(page.getByTestId('quest-translation')).toHaveText(sample[0].jp);
  for (let i = 0; i < sample.length; i++) {
    await expect(page.getByTestId('quest-reader-text')).toHaveText(sample[i].en);
    await page.getByRole('button', { name: '次のチャンク' }).click();
    if (sections.slice(0, -1).includes(i)) {
      await expect(page.getByTestId('quest-checkpoint')).toBeVisible();
      await page.screenshot({ path: info.outputPath(`checkpoint-${i}.png`), fullPage: true });
      await page.getByRole('button', { name: 'つづきを読む' }).click();
    }
  }
  await expect(page.getByRole('heading', { name: '読書の冒険、クリア！' })).toBeVisible();
  await expect(page.getByText('きらめき +30')).toBeVisible();
  await page.screenshot({ path: info.outputPath('quest-finish.png'), fullPage: true });
  await page.getByRole('button', { name: '別の英文へ' }).click();
  await expect(page.getByText('30', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  for (let i = 0; i < sample.length; i++) {
    await page.getByRole('button', { name: '次のチャンク' }).click();
    if (sections.slice(0, -1).includes(i)) await page.getByRole('button', { name: 'つづきを読む' }).click();
  }
  await expect(page.getByText('この英文はクリア済み。')).toBeVisible();
});

test('plain English starts without translation, and classic remains selectable', async ({ page }) => {
  const source = 'The small robot reads a story. It rests when the story is done.';
  await input(page).fill(source);
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await expect(page.getByTestId('quest-reader-text')).toBeVisible();
  await expect(page.getByRole('button', { name: /日本語訳/ })).toHaveCount(0);
  await page.getByRole('button', { name: '入力に戻る' }).click();
  await expect(input(page)).toHaveValue(source);
  await page.getByRole('button', { name: 'クラシック表示に切り替える' }).click();
  await expect(input(page)).toHaveValue(source);
  await page.getByRole('button', { name: 'チャンク読みを開始' }).click();
  await expect(page.getByTestId('reader-text')).toBeVisible();
});

test('mobile quest keeps English, controls and checkpoint within viewport', async ({ page }) => {
  await page.getByRole('button', { name: '校閲済みサンプルを入れる' }).click();
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  const box = await page.getByTestId('quest-reader-text').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(page.getByRole('button', { name: 'スタート' })).toBeVisible();
});
