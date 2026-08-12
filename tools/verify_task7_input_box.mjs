import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task7');

// custom is preset 0 — one #input-next click lands on letter-a
await page.click('#input-next');
const letterAText = await page.locator('#input-preset-display').innerText();
if (letterAText.trim() !== 'a') throw new Error(`expected input box to show "a", got "${letterAText}"`);

// two more clicks: letter-a -> letter-cyrillic-a -> whitespace
await page.click('#input-next');
await page.click('#input-next');
const wsText = await page.locator('#input-preset-display').innerText();
if (!wsText.includes('\\t') && !wsText.includes('·')) {
  throw new Error(`expected whitespace preset to show visible glyphs (\\t or ·), got "${wsText}"`);
}
if (wsText.trim().length === 0) throw new Error('whitespace preset display is empty — raw whitespace is invisible');

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log(`OK  letter-a shows "a", whitespace preset shows visible glyphs ("${wsText}"), no console errors`);
await browser.close();
