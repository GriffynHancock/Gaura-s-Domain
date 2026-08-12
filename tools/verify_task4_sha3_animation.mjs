import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task4');
await page.click('#algo-next'); // switch to SHA-3
await page.fill('#input-custom', 'crypto-101');
// custom preset is index 0, already selected by default — no need to arrow to it
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; }); // fastest speed
await page.click('#hash-btn');

// wait for the round counter to reach the final round
await page.waitForFunction(
  () => document.getElementById('round-counter').textContent === 'round 24 / 24',
  // 30s, not the original 15s: SHA-3's pacing is deliberately slow now (getSha3SpeedMs — a full
  // 125-event run is ~10.7s even at the FASTEST slider setting, ~12.5s at default). Purely a
  // timeout headroom change; the assertion itself (24/24 actually reached) is unchanged.
  { timeout: 30000 }
);

// The round counter updates on the LAST round's `iota` event, but `squeeze`/`output` trace
// events (which write the digest) fire a frame or two after that — so also wait for the
// digest itself to actually populate, rather than assuming it's already there.
await page.waitForFunction(
  () => /^[0-9a-f]{64}$/.test(document.getElementById('output-digest').textContent),
  { timeout: 5000 }
);

const digest = await page.locator('#output-digest').innerText();
if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`unexpected SHA-3 digest format: "${digest}"`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log(`OK  round counter reached 24/24, digest rendered (${digest}), no console errors`);
await browser.close();
