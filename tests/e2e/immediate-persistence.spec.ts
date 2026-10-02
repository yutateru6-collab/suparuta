import { test, expect } from '@playwright/test';

for (const mode of ['quest', 'classic'] as const) {
  test(`${mode}: next followed immediately by reload preserves the new position`, async ({ page }) => {
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/');
    if (mode === 'classic') await page.getByRole('button', { name: 'クラシック表示に切り替える' }).click();
    await page.getByLabel('英文テキスト').fill('["First small sentence.","Second clear sentence.","Last little sentence."]');
    await page.getByRole('button', { name: mode === 'quest' ? '冒険をはじめる' : 'チャンク読みを開始', exact: true }).click();
    await page.getByTestId(mode === 'quest' ? 'quest-reader-text' : 'reader-text').waitFor();
    // Reload in the same browser task as the click, before deferred React effects.
    const [, savedAtReload] = await Promise.all([
      page.waitForEvent('load'),
      page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('button[aria-label="次のチャンク"]')!.click();
        const saved = JSON.parse(localStorage.getItem('spartan_reader_session_v1')!);
        location.reload();
        return saved;
      }),
    ]);
    expect(savedAtReload.wordOffset).toBe(3);
    if (mode === 'quest') expect(savedAtReload.viewed).toEqual([[0, 3]]);
    await page.getByRole('button', { name: '前回の続きから読む' }).click();
    await expect(page.getByTestId(mode === 'quest' ? 'quest-reader-text' : 'reader-text')).toHaveText('Second clear sentence.');
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('spartan_reader_session_v1')!));
    expect(session.wordOffset).toBe(3);
    if (mode === 'quest') expect(session.viewed).toEqual([[0, 3]]);
  });

  test(`${mode}: a keyboard move saves before its event returns`, async ({ page }) => {
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/');
    if (mode === 'classic') await page.getByRole('button', { name: 'クラシック表示に切り替える' }).click();
    await page.getByLabel('英文テキスト').fill('["First small sentence.","Second clear sentence."]');
    await page.getByRole('button', { name: mode === 'quest' ? '冒険をはじめる' : 'チャンク読みを開始', exact: true }).click();
    const saved = await page.evaluate(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      return JSON.parse(localStorage.getItem('spartan_reader_session_v1')!);
    });
    expect(saved.wordOffset).toBe(3);
    if (mode === 'quest') expect(saved.viewed).toEqual([[0, 3]]);
    await page.reload();
    await page.getByRole('button', { name: '前回の続きから読む' }).click();
    await expect(page.getByTestId(mode === 'quest' ? 'quest-reader-text' : 'reader-text')).toHaveText('Second clear sentence.');
  });
}

test('draft and settings persist before the input event returns', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  const saved = await page.evaluate(() => {
    const input = document.querySelector<HTMLTextAreaElement>('#reading-input')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'A newly entered draft.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(button => button.textContent === '高速 (160)')!.click();
    return {draft: JSON.parse(localStorage.getItem('spartan_reader_draft_v1')!), settings: JSON.parse(localStorage.getItem('spartan_reader_settings_v1')!)};
  });
  expect(saved.draft).toBe('A newly entered draft.');
  expect(saved.settings.wpm).toBe(160);
  await page.reload();
  await expect(page.getByLabel('英文テキスト')).toHaveValue(saved.draft);
  await expect(page.getByRole('slider', { name: '表示速度（WPM）' })).toHaveValue('160');
});
