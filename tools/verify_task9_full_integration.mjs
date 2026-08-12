import { chromium } from 'playwright';
import crypto from 'node:crypto';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task9');
await page.waitForSelector('#hash-btn');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; });

// ---- 1. MD5 digest spot-check against a known vector ----
await page.fill('#input-custom', 'abc');
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 32, { timeout: 15000 });
const md5Digest = await page.locator('#output-digest').innerText();
const expectedMd5 = crypto.createHash('md5').update('abc').digest('hex');
if (md5Digest !== expectedMd5) throw new Error(`MD5 digest mismatch: got ${md5Digest}, expected ${expectedMd5}`);
console.log(`OK  MD5("abc") = ${md5Digest}`);

// ---- 2. MD5 register boxes updated during the animation just run ----
const regA = await page.locator('#reg-0-A .reg-val').innerText();
if (!/^[0-9a-f]{8}$/.test(regA) || regA === '67452301') throw new Error(`MD5 register A did not update, still "${regA}"`);
console.log('OK  MD5 register boxes updated during animation');

// ---- 3. SHA-3 digest spot-check + lane grid + round counter ----
await page.click('#algo-next'); // -> SHA-3
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 64, { timeout: 15000 });
const sha3Digest = await page.locator('#output-digest').innerText();
const expectedSha3 = crypto.createHash('sha3-256').update('abc').digest('hex');
if (sha3Digest !== expectedSha3) throw new Error(`SHA3-256 digest mismatch: got ${sha3Digest}, expected ${expectedSha3}`);
console.log(`OK  SHA3-256("abc") = ${sha3Digest}`);

const laneCount = await page.locator('.lane').count();
if (laneCount !== 25) throw new Error(`expected 25 .lane elements, found ${laneCount}`);
const roundCounterText = await page.locator('#round-counter').innerText();
if (roundCounterText !== 'round 24 / 24') throw new Error(`expected round counter at 24/24, got "${roundCounterText}"`);
console.log('OK  SHA-3 lane grid has 25 elements, round counter reached 24/24');

// ---- 4. lane grid is drag-rotatable ----
const grid = page.locator('#lane-grid');
const beforeTransform = await grid.evaluate(el => el.style.transform);
// page.mouse coordinates are viewport-relative, and the grid now reserves its real ~180px
// projected footprint (so it no longer paints over the legend / round counter), which can put it
// below the fold — scroll it in first or the drag silently misses.
await grid.scrollIntoViewIfNeeded();
const box = await grid.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 6 });
await page.mouse.up();
const afterTransform = await grid.evaluate(el => el.style.transform);
if (afterTransform === beforeTransform) throw new Error('drag-rotate did not change #lane-grid transform');
console.log('OK  lane grid is drag-rotatable via real pointer events');

// ---- 5. input box shows real content, not a label, for letter-a and whitespace presets ----
await page.click('#input-next'); // custom(0) -> letter-a(1)
const letterAText = await page.locator('#input-preset-display').innerText();
if (letterAText.trim() !== 'a') throw new Error(`letter-a preset should show "a", got "${letterAText}"`);
await page.click('#input-next'); // -> letter-cyrillic-a(2)
await page.click('#input-next'); // -> whitespace(3)
const wsText = await page.locator('#input-preset-display').innerText();
if (wsText.trim().length === 0) throw new Error('whitespace preset display is empty');
console.log(`OK  input box shows real content for letter-a ("${letterAText.trim()}") and whitespace ("${wsText}")`);

// ---- 6. both collision presets selectable and annotated ----
await page.click('#input-next'); // -> pubtext(4)
await page.click('#input-next'); // -> cat(5)
await page.click('#input-next'); // -> collision-msg1(6)
await page.click('#algo-prev'); // -> back to MD5 (collision only makes sense for MD5)
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 2'), { timeout: 15000 });
console.log('OK  collision-msg1 selectable and annotated');
await page.click('#input-next'); // -> collision-msg2(7)
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('output-annotation').textContent.includes('message 1'), { timeout: 15000 });
console.log('OK  collision-msg2 selectable and annotated');

if (consoleErrors.length) throw new Error('console errors accumulated during the run: ' + consoleErrors.join(' | '));

console.log('All Task 9 integration checks passed — no console errors across the whole run.');
await browser.close();
