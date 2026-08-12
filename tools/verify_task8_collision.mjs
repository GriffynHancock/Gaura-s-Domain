import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task8');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

// custom(0) -> letter-a(1) -> letter-cyrillic-a(2) -> whitespace(3) -> pubtext(4) -> cat(5) ->
// collision-msg1(6): six clicks of #input-next from the default custom preset.
for (let i = 0; i < 6; i++) await page.click('#input-next');
const msg1Label = await page.locator('#input-preset-display').innerText();
if (!msg1Label.includes('d131dd02')) throw new Error(`expected collision-msg1 hex preview, got "${msg1Label}"`);

await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.length > 0, { timeout: 15000 });
const annotation1 = await page.locator('#output-annotation').innerText();
if (!annotation1.includes('message 2')) throw new Error(`expected msg1 annotation to reference message 2, got "${annotation1}"`);

await page.click('#input-next'); // collision-msg2
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 1'), { timeout: 15000 });
const annotation2 = await page.locator('#output-annotation').innerText();
if (!annotation2.includes('message 1')) throw new Error(`expected msg2 annotation to reference message 1, got "${annotation2}"`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  both collision presets selectable, each shows correct cross-reference annotation, no console errors');
await browser.close();
