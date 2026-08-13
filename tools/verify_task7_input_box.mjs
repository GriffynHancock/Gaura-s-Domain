import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
// Third-party console errors are ignored; same-origin ones are still hard failures.
// The page pulls its webfonts from fonts.gstatic.com, and in a sandboxed/offline environment
// that request intermittently 404s. It never reaches the local server (which logs zero 404s
// ever), so it says nothing about the page -- but it used to fail this assertion at random.
const SAME_ORIGIN = new URL(BASE_URL).origin;
page.on('console', msg => {
  if (msg.type() !== 'error') return;
  const src = msg.location().url || '';
  if (src && !src.startsWith(SAME_ORIGIN)) return;
  consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task7');

// custom is preset 0 — one #input-next click lands on letter-a
await page.click('#input-next');
const letterAText = await page.locator('#input-preset-display').innerText();
if (letterAText.trim() !== 'a') throw new Error(`expected input box to show "a", got "${letterAText}"`);

// two more clicks: letter-a -> letter-cyrillic-a -> whitespace
await page.click('#input-next');
await page.click('#input-next');
// Fix 2: whitespace preset now renders as individual chip elements (one per character), not a
// run-on string — assert the real chip DOM structure, not just visible text.
const chipTexts = await page.locator('#input-preset-display .ws-chip').allInnerTexts();
if (chipTexts.length === 0) throw new Error('expected whitespace preset to render individual .ws-chip elements');
if (!chipTexts.some(t => t === 'SP')) throw new Error(`expected an "SP" chip among whitespace chips, got [${chipTexts.join(', ')}]`);
if (!chipTexts.some(t => t === 'TAB')) throw new Error(`expected a "TAB" chip among whitespace chips, got [${chipTexts.join(', ')}]`);
if (!chipTexts.some(t => t === 'ZWSP')) throw new Error(`expected a "ZWSP" chip among whitespace chips, got [${chipTexts.join(', ')}]`);
const wsCaption = await page.locator('#input-preset-display .ws-caption').innerText();
if (!/\d+ invisible characters?/.test(wsCaption)) throw new Error(`expected whitespace caption to state a character count, got "${wsCaption}"`);
const wsText = chipTexts.join(' ');

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log(`OK  letter-a shows "a", whitespace preset shows visible glyphs ("${wsText}"), no console errors`);
await browser.close();
