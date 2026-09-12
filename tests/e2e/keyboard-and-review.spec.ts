import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const text = readFileSync('public/libraries-of-things.reviewed.json','utf8');
const sample = JSON.parse(text);
test.beforeEach(async({page})=>{
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.getByLabel('英文テキスト').fill(text);
  await page.getByRole('button',{name:'チャンク読みを開始',exact:true}).click();
});
test('focused playback button still supports arrows, restart and Escape without losing input',async({page})=>{
  await page.getByRole('button',{name:'スタート',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('frame-counter')).toHaveText('2 / 32');
  await page.keyboard.press('r');
  await expect(page.getByTestId('frame-counter')).toHaveText('1 / 32');
  await page.getByRole('button',{name:'スタート',exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('英文テキスト')).toHaveValue(text);
});
test('review is lazy-rendered and selects a chunk without starting playback',async({page})=>{
  await expect(page.getByTestId('review-rows').locator('button')).toHaveCount(0);
  await page.getByRole('button',{name:'チャンク復習リスト',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'チャンクふりかえり（全32件）',exact:true});
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('review-rows').locator('button')).toHaveCount(32);
  await dialog.getByText(sample[4].en,{exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('reader-text')).toHaveText(sample[4].en);
  await expect(page.getByTestId('frame-counter')).toHaveText('5 / 32');
  await expect(page.getByRole('button',{name:'再開',exact:true})).toBeVisible();
  await expect(page.getByTestId('review-rows').locator('button')).toHaveCount(0);
});
