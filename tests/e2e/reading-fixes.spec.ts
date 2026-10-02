import { test, expect, type Page } from '@playwright/test';

const text = JSON.stringify([
  { en: 'First small sentence.', jp: '最初の短文。', speaker: 'A' },
  { en: 'Second clear sentence.', jp: '二つ目の短文。', speaker: null },
  { en: 'Last little sentence.', jp: '最後の短文。', speaker: null },
]);
const next = (page: Page) => page.getByRole('button', { name: '次のチャンク', exact: true });
const home = (page: Page) => page.getByRole('button', { name: '入力に戻る' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
});

for (const mode of ['quest', 'classic'] as const) {
  test(`${mode}: draft reload, interrupted position, all learning preferences and reset`, async ({ page }, info) => {
    if (mode === 'classic') await page.getByRole('button', { name: 'クラシック表示に切り替える' }).click();
    const start = () => page.getByRole('button', { name: mode === 'quest' ? '冒険をはじめる' : 'チャンク読みを開始', exact: true });
    const settings = () => page.getByRole('button', { name: mode === 'quest' ? '表示設定' : '表示・動作設定', exact: true });
    const reader = () => page.getByTestId(mode === 'quest' ? 'quest-reader-text' : 'reader-text');
    await page.getByLabel('英文テキスト').fill(text);
    await page.reload();
    await expect(page.getByLabel('英文テキスト')).toHaveValue(text);
    await start().click();
    await next(page).click();
    await settings().click();
    await page.getByRole('button', { name: '高速 (160)', exact: true }).click();
    await page.getByRole('button', { name: '1語', exact: true }).click();
    await page.getByRole('button', { name: '2秒', exact: true }).click();
    await page.getByRole('button', { name: 'zoom', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(reader()).toHaveText('Second');
    await next(page).click();
    await expect(reader()).toHaveText('clear');
    await page.reload();
    await expect(page.getByLabel('英文テキスト')).toHaveValue(text);
    await expect(page.getByRole('slider', { name: '表示速度（WPM）' })).toHaveValue('160');
    await page.getByRole('button', { name: '前回の続きから読む' }).click();
    await expect(reader()).toHaveText('clear');
    await expect(page.getByRole('button', { name: '再開', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: mode === 'quest' ? '日本語訳 ON' : '日本語訳: ON', exact: true })).toBeVisible();
    await settings().click();
    for (const name of ['高速 (160)', '1語', '2秒', 'zoom']) await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: info.outputPath(`${mode}-saved-settings.png`), fullPage: true });
    await page.keyboard.press('Escape');
    // A focused playback button still supports keyboard navigation after restoring.
    await page.getByRole('button', { name: '再開', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(reader()).toHaveText('sentence.');
    await page.keyboard.press('ArrowLeft');
    await expect(reader()).toHaveText('clear');
    await settings().click();
    await page.getByRole('button', { name: '学習設定をリセット' }).click();
    await expect(page.getByRole('button', { name: '標準 (110)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'チャンク', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'fade', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(reader()).toHaveText('Second clear sentence.');
    await home(page).click();
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spartan_reader_settings_v1')!))).toEqual({ wpm: 110, wordGroupSize: 0, showTranslation: false, translationDelay: 0, revealMode: 'fade' });
    await expect(page.getByLabel('英文テキスト')).toHaveValue(text);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spartan_reader_history')!).length)).toBe(1);
  });
}

test('preview repairs boundaries without losing words, and keeps translated JSON intact', async ({ page }, info) => {
  const source = 'Young students really enjoyed reading several interesting science books yesterday near the school entrance.';
  await page.getByLabel('英文テキスト').fill(source);
  await page.getByRole('button', { name: '分割プレビュー・調整' }).click();
  await expect(page.getByLabel('分割を調整')).toHaveValue('Young students really enjoyed reading several interesting science books yesterday\nnear the school entrance.');
  await page.getByLabel('分割を調整').fill('Young students really enjoyed reading\nseveral interesting science books yesterday\nnear the school entrance.');
  await page.screenshot({ path: info.outputPath('chunk-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'この分割を入力に反映' }).click();
  const chunks = JSON.parse(await page.getByLabel('英文テキスト').inputValue());
  expect(chunks.map((c: { en: string }) => c.en).join(' ')).toBe(source);
  await page.reload();
  expect(JSON.parse(await page.getByLabel('英文テキスト').inputValue())).toEqual(chunks);
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await expect(page.getByTestId('quest-frame-counter')).toHaveText('1 / 3');
  await home(page).click();
  await page.getByLabel('英文テキスト').fill(text);
  await page.getByRole('button', { name: '分割プレビュー・調整' }).click();
  expect(JSON.parse(await page.getByLabel('分割を調整').inputValue())).toEqual(JSON.parse(text));
  await page.getByRole('button', { name: 'この分割を入力に反映' }).click();
  expect(JSON.parse(await page.getByLabel('英文テキスト').inputValue())).toEqual(JSON.parse(text));
});

test('review skip and reload cannot earn reward; visiting missing ranges then ending earns once', async ({ page }, info) => {
  await page.getByLabel('英文テキスト').fill(text);
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await page.getByRole('button', { name: '復習リスト', exact: true }).click();
  await page.getByRole('dialog').getByText('Last little sentence.', { exact: true }).click();
  await next(page).click();
  await expect(page.getByRole('heading', { name: '英文の末尾に到達しました' })).toBeVisible();
  await expect(page.getByText(/きらめき \+30/)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('spartan_quest_progress_v1'))).toBeNull();
  await page.screenshot({ path: info.outputPath('skipped-end-no-reward.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: '前回の続きから読む' }).click();
  await next(page).click();
  await expect(page.getByRole('heading', { name: '英文の末尾に到達しました' })).toBeVisible();
  await page.getByRole('button', { name: 'もう一度読む' }).click();
  await next(page).click();
  await page.reload();
  await page.getByRole('button', { name: '前回の続きから読む' }).click();
  await expect(page.getByTestId('quest-reader-text')).toHaveText('Second clear sentence.');
  await next(page).click(); await next(page).click();
  await expect(page.getByText(/きらめき \+30/)).toBeVisible();
  await expect(page.getByText(/理解度を測定・採点したものではありません/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '前回の続きから読む' }).click();
  await next(page).click();
  await expect(page.getByText(/この英文はクリア済み/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spartan_quest_progress_v1')!).sparks)).toBe(30);
});

test('one-word checkpoint aligns runner and star at 60/66 with unequal chunks', async ({ page }, info) => {
  const chunks = Array.from({ length: 12 }, (_, i) => ({ en: i < 6 ? 'one two three four five six seven eight nine ten' : 'one', jp: '' }));
  await page.getByLabel('英文テキスト').fill(JSON.stringify(chunks));
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await page.getByRole('button', { name: '表示設定', exact: true }).click();
  await page.getByRole('button', { name: '1語', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '復習リスト', exact: true }).click();
  await page.locator('.quest-review-list button').nth(59).click();
  await next(page).click();
  await expect(page.getByTestId('quest-checkpoint')).toBeVisible();
  const positions = await page.evaluate(() => [document.querySelector<HTMLElement>('.quest-route-runner')!.style.left, document.querySelector<HTMLElement>('.quest-route-stop')!.style.left].map(parseFloat));
  expect(positions[0]).toBeCloseTo(60 / 66 * 100, 3);
  expect(positions[1]).toBeCloseTo(positions[0], 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('aligned-checkpoint.png'), fullPage: true });
});

test('unsupported saved draft, settings and session stay intact while reading remains usable', async ({ page }) => {
  const keys = ['spartan_reader_draft_v1', 'spartan_reader_settings_v1', 'spartan_reader_session_v1'];
  await page.evaluate(keys => { for (const key of keys) localStorage.setItem(key, '{"future":true}'); }, keys);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('既存データは上書きせず');
  await page.getByLabel('英文テキスト').fill(text);
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await next(page).click();
  await expect(page.getByTestId('quest-reader-text')).toHaveText('Second clear sentence.');
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), keys)).toEqual(keys.map(() => '{"future":true}'));
});

test('quota failure cannot award the same text twice in one reader session', async ({ page }) => {
  await page.getByLabel('英文テキスト').fill('["One short sentence."]');
  await page.getByRole('button', { name: '冒険をはじめる' }).click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); }; });
  await next(page).click();
  await expect(page.getByText(/きらめき \+30/)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '今回の冒険の記録を保存できません' })).toBeVisible();
  await page.getByRole('button', { name: 'もう一度読む' }).click();
  await next(page).click();
  await expect(page.getByText(/この英文はクリア済み/)).toBeVisible();
  await expect(page.getByLabel('きらめき 30 個')).toBeVisible();
});
