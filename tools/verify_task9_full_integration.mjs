import { chromium } from 'playwright';
import crypto from 'node:crypto';

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
// 30s, not the original 15s: SHA-3's animation is deliberately slow-by-default now
// (getSha3SpeedMs), ~10.7s at the fastest slider setting. Timeout headroom only.
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 64, { timeout: 30000 });
const sha3Digest = await page.locator('#output-digest').innerText();
const expectedSha3 = crypto.createHash('sha3-256').update('abc').digest('hex');
if (sha3Digest !== expectedSha3) throw new Error(`SHA3-256 digest mismatch: got ${sha3Digest}, expected ${expectedSha3}`);
console.log(`OK  SHA3-256("abc") = ${sha3Digest}`);

// The CSS-3D `.lane` DOM was replaced by a Canvas 2D renderer, so these read the renderer's
// read-only instrumentation hook and the real painted pixels instead of counting divs — see the
// header comment in tools/verify_task3_lane_grid.mjs.
const state = await page.evaluate(() => ({
  boxes: window.__sha3Debug.boxCount(),
  lanes: window.__sha3Debug.lanes().length,
  rate: window.__sha3Debug.lanes().filter(l => l.isRate).length,
  faces: window.__sha3Debug.facesDrawn(),
  phases: window.__sha3Debug.phaseLog().length,
}));
if (state.lanes !== 25) throw new Error(`expected 25 lanes, found ${state.lanes}`);
if (state.boxes !== 25 * 8) throw new Error(`expected 200 drawn boxes, found ${state.boxes}`);
if (state.rate !== 17) throw new Error(`expected 17 rate lanes, found ${state.rate}`);
if (state.faces < state.boxes) throw new Error(`only ${state.faces} faces drawn for ${state.boxes} boxes — not drawn as solids`);
if (state.phases !== 125) throw new Error(`expected 125 controller phases for a one-rate-block input, found ${state.phases}`);
const roundCounterText = await page.locator('#round-counter').innerText();
if (roundCounterText !== 'round 24 / 24') throw new Error(`expected round counter at 24/24, got "${roundCounterText}"`);
console.log(`OK  SHA-3 canvas state: 25 lanes / ${state.boxes} boxes / ${state.faces} faces, ${state.phases} phases, round counter 24/24`);

// ---- 4. the state canvas is drag-rotatable, and the drag actually repaints ----
const canvas = page.locator('#lane-canvas');
await canvas.scrollIntoViewIfNeeded();
const sampleCanvas = () => page.evaluate(() => {
  const c = document.getElementById('lane-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 37) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
  return sum / n;
});
const beforeRot = await page.evaluate(() => window.__sha3Debug.rotation());
const beforePixels = await sampleCanvas();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 35, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(250);
const afterRot = await page.evaluate(() => window.__sha3Debug.rotation());
if (afterRot.rotX === beforeRot.rotX && afterRot.rotY === beforeRot.rotY) {
  throw new Error('drag-rotate did not change the canvas projection rotation');
}
if (Math.abs((await sampleCanvas()) - beforePixels) < 0.5) {
  throw new Error('drag-rotate changed the rotation state but the canvas did not repaint');
}
console.log('OK  state canvas is drag-rotatable via real pointer events and repaints');

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
