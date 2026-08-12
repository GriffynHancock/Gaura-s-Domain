import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task6');

// a string long enough to force 2 MD5 blocks: after the 0x80 + length padding, anything over
// 55 bytes needs a second 512-bit block.
const longInput = 'x'.repeat(80);
await page.fill('#input-custom', longInput);
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });
await page.click('#hash-btn');

await page.waitForSelector('#block-group-1', { timeout: 5000 });
const blockCount = await page.locator('.block-group').count();
if (blockCount !== 2) throw new Error(`expected 2 stacked blocks for an 80-byte input, found ${blockCount}`);

const t1 = await page.locator('#block-group-1').evaluate(el => el.style.transform);
if (!/translateZ\(-60px\)/.test(t1)) throw new Error(`block-group-1 missing expected translateZ recession, got "${t1}"`);

const captionVisible = await page.locator('#stack-caption').evaluate(el => getComputedStyle(el).display !== 'none');
if (!captionVisible) throw new Error('stack-caption should be visible for a multi-block input');

await page.waitForFunction(
  () => document.getElementById('step-counter-1') && document.getElementById('step-counter-1').textContent === 'step 64 / 64',
  { timeout: 15000 }
);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  2 blocks stacked with Z-axis recession, caption shown, block 1 register view completes, no console errors');
await browser.close();
