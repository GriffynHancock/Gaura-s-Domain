import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task5');
await page.fill('#input-custom', 'register test');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

// Task 6 made renderMd5BlockChain build block-group-0's register markup dynamically on every
// Hash click (no more static pre-rendered block-group-0) — so #reg-0-A only exists after the
// click, not before it. Read the "initial" value right after clicking (synchronous render, still
// showing the seeded MD5 IV) instead of before, which still exercises the same assertion: the
// value changes once the (async, rAF-driven) animation actually runs.
await page.click('#hash-btn');
const initialA = await page.locator('#reg-0-A .reg-val').innerText();

await page.waitForFunction(
  () => document.getElementById('step-counter-0').textContent === 'step 64 / 64',
  { timeout: 15000 }
);

const finalA = await page.locator('#reg-0-A .reg-val').innerText();
if (finalA === initialA) throw new Error('register A value did not change during MD5 animation');
if (!/^[0-9a-f]{8}$/.test(finalA)) throw new Error(`unexpected register A format: "${finalA}"`);

const activeFuncCount = await page.locator('.func-box.active').count();
if (activeFuncCount !== 1) throw new Error(`expected exactly 1 active func-box at animation end, found ${activeFuncCount}`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  register A changed during animation, step counter reached 64/64, exactly one active func-box, no console errors');
await browser.close();
