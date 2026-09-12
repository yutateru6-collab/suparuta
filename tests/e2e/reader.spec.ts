import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildChunkPrompt } from '../../services/chunkPrompt';
const reviewedText = readFileSync('public/libraries-of-things.reviewed.json', 'utf8');
const reviewed: {en:string;jp:string;speaker:null}[] = JSON.parse(reviewedText);
const smart = readFileSync('tests/fixtures/libraries.smart.txt', 'utf8');
const source = readFileSync('tests/fixtures/libraries.source.txt', 'utf8').trim();
const pageErrors = new WeakMap<Page, string[]>();
const input = (page: Page) => page.getByLabel('英文テキスト');
const start = async (page: Page, text = reviewedText) => {
  await input(page).fill(text);
  await page.getByRole('button', { name: 'チャンク読みを開始', exact: true }).click();
  await expect(page.getByTestId('reader-text')).toBeVisible();
};
test.beforeEach(async ({ page }) => {
  const errors: string[]=[]; pageErrors.set(page,errors); page.on('pageerror', error=>errors.push(error.message));
  // Production rendering must not depend on third-party scripts or fonts.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
});
test.afterEach(async ({ page }) => expect(pageErrors.get(page)).toEqual([]));

test('all reviewed chunks and translations, completion, restart and responsive screenshots', async ({page}, info) => {
  await page.screenshot({ path: info.outputPath('input.png'), fullPage: true });
  await start(page);
  await page.getByRole('button',{name:'日本語訳: OFF',exact:true}).click();
  for (let i=0;i<reviewed.length;i++) {
    await expect(page.getByTestId('reader-text')).toHaveText(reviewed[i].en);
    await expect(page.getByTestId('translation')).toHaveText(reviewed[i].jp);
    const box=await page.getByTestId('reader-text').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
    if (i===23) await page.screenshot({path:info.outputPath('reader-long-chunk.png'),fullPage:true});
    await page.getByRole('button',{name:'次のチャンク',exact:true}).click();
  }
  await expect(page.getByRole('heading',{name:'トレーニング完了！'})).toBeVisible();
  await page.getByRole('button',{name:'もう一度読む'}).click();
  await expect(page.getByTestId('frame-counter')).toHaveText('1 / 32');
});
test('original smart-quote JSON loads 58 chunks and retains its quoted phrase', async ({page})=>{
  await start(page,smart);
  await expect(page.getByTestId('frame-counter')).toHaveText('1 / 58');
  await expect(page.getByRole('status')).toContainText('引用符の形式を補正');
  for(let i=0;i<7;i++) await page.getByRole('button',{name:'次のチャンク',exact:true}).click();
  await expect(page.getByTestId('reader-text')).toHaveText('"libraries of things."');
});
test('invalid second row is rejected in place without partial playback or text loss', async ({page})=>{
  const bad='[{"en":"Hello world."},{"jp":"英文がありません"}]';
  await input(page).fill(bad); await page.getByRole('button',{name:'チャンク読みを開始',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('2件目');
  await expect(input(page)).toHaveValue(bad); await expect(page.getByTestId('reader-text')).toHaveCount(0);
});
test('copy button uses the latest prompt and reconstructs JSON to English', async ({page})=>{
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async (text:string)=>{(window as any).__copiedPrompt=text;}}}));
  await input(page).fill(reviewedText); await page.getByRole('button',{name:'プロンプトコピー',exact:true}).click();
  await expect(page.getByRole('button',{name:/コピー完了/})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__copiedPrompt)).toBe(buildChunkPrompt(source));
});
test('clipboard rejection provides selectable fallback instead of a false success', async ({page})=>{
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await input(page).fill('Hello world.'); await page.getByRole('button',{name:'プロンプトコピー',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('コピーが許可されません');
  await expect(page.getByLabel('手動コピー用プロンプト')).toHaveValue(buildChunkPrompt('Hello world.'));
  await expect(page.getByRole('button',{name:/コピー完了/})).toHaveCount(0);
});
test('Esc closes only the settings dialog, and returning home preserves input', async ({page})=>{
  await start(page); await page.getByRole('button',{name:'表示・動作設定',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'表示・動作設定',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'表示・動作設定',exact:true})).not.toBeVisible();
  await expect(page.getByTestId('reader-text')).toBeVisible();
  await page.getByRole('button',{name:'入力に戻る',exact:true}).click(); await expect(input(page)).toHaveValue(reviewedText);
});
test('changing display units preserves reading position and labels full-chunk translation', async ({page})=>{
  await start(page); for(let i=0;i<4;i++) await page.getByRole('button',{name:'次のチャンク',exact:true}).click();
  await page.getByRole('button',{name:'日本語訳: OFF',exact:true}).click();
  await page.getByRole('button',{name:'表示・動作設定',exact:true}).click();
  await page.getByRole('button',{name:'1語',exact:true}).click(); await page.keyboard.press('Escape');
  await expect(page.getByTestId('reader-text')).toHaveText('such');
  await expect(page.getByTestId('translation')).toContainText('元のチャンク全体の訳');
});
test('translation delay does not elapse before playback or during a pause', async ({page})=>{
  await start(page); await page.getByRole('button',{name:'翻訳遅延: なし',exact:true}).click();
  await page.waitForTimeout(2150); await expect(page.getByTestId('translation')).toHaveCount(0);
  await page.getByRole('button',{name:'スタート',exact:true}).click(); await page.waitForTimeout(500);
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.waitForTimeout(2150); await expect(page.getByTestId('translation')).toHaveCount(0);
  await page.getByRole('button',{name:'スタート',exact:true}).click();
  await expect(page.getByTestId('translation')).toBeVisible({timeout:2500});
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
});
test('seven-second delay does not slow playback when translation is disabled', async ({page})=>{
  await start(page,JSON.stringify([{en:'Hello world.',jp:'こんにちは。',speaker:null}]));
  await page.getByRole('button',{name:'表示・動作設定',exact:true}).click();
  await page.getByRole('button',{name:'7秒',exact:true}).click();
  await page.getByRole('button',{name:'訳を表示: ON',exact:true}).click();
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'スタート',exact:true}).click();
  await expect(page.getByRole('heading',{name:'トレーニング完了！'})).toBeVisible({timeout:3000});
});
test('corrupt persisted history does not crash or get overwritten', async ({page})=>{
  await page.evaluate(()=>localStorage.setItem('spartan_reader_history','{"corrupt":true}'));
  await page.reload(); await expect(page.getByRole('status')).toContainText('既存データは上書きせず');
  await start(page); await page.getByRole('button',{name:'入力に戻る',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('spartan_reader_history'))).toBe('{"corrupt":true}');
});
test('storage quota errors remain nonfatal and display a warning', async ({page})=>{
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Quota','QuotaExceededError');};});
  await start(page);
  await page.getByRole('button',{name:'入力に戻る',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('履歴を保存できません');
});
test('JSON file upload and sample button work', async ({page})=>{
  await page.locator('input[type="file"]').setInputFiles({name:'reviewed.json',mimeType:'application/json',buffer:Buffer.from(reviewedText)});
  await expect(input(page)).toHaveValue(reviewedText);
  await input(page).fill(''); await page.getByRole('button',{name:'校閲済みサンプルを入れる',exact:true}).click();
  expect(JSON.parse(await input(page).inputValue())).toEqual(reviewed);
});
test('production build loads bundled CSS and exposes the deployed commit metadata', async ({page})=>{
  const color=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(color).toBe('rgb(15, 15, 19)');
  const assets=await page.locator('link[rel=stylesheet]').evaluateAll(elements=>elements.map(el=>(el as HTMLLinkElement).href));
  expect(assets.some(url=>url.includes('/assets/')&&url.endsWith('.css'))).toBe(true);
  const res=await page.request.get('/build-info.json'); expect(res.ok()).toBe(true);
  expect((await res.json()).version).toBe('0.2.0');
});
