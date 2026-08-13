// Diagnostic (not an assertion): where in a SHA-3 run the biggest single-frame luminance step
// happens. Reports the top steps with their offset from the first recorded frame, so a spike can
// be attributed to the opening of a run, a phase boundary, or the tail.
import { chromium } from 'playwright';
import { relLum } from './flash_analysis.mjs';
const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const SLIDER = Number(process.env.SLIDER || 100);
const BLOCKS = Number(process.env.BLOCKS || 8);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
await page.goto(BASE_URL + '?v=probe' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug && !!window.__flashMeter, { timeout: 8000 });
await page.click('#algo-next');
await page.fill('#input-custom', 'x'.repeat(136 * BLOCKS));
await page.locator('#speed-slider').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input')); }, SLIDER);
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
// Optional warm-up: an earlier run on the SAME page, cancelled mid-flight the way the
// flash-safety suite's preceding cases leave it, so the measured run is not the page's first.
if (process.env.WARMUP) {
  await page.locator('#speed-slider').evaluate(el => { el.value = '25'; el.dispatchEvent(new Event('input')); });
  await page.click('#hash-btn');
  await page.waitForTimeout(Number(process.env.WARMUP));
  await page.evaluate(() => { currentRunId++; });
  await page.waitForTimeout(500);
  await page.locator('#speed-slider').evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input')); }, SLIDER);
}
await page.evaluate(() => window.__flashMeter.start(3));
await page.click('#hash-btn');
const t0 = Date.now();
while (Date.now() - t0 < 40000) {
  if (!(await page.evaluate(() => sha3.running)) && Date.now() - t0 > 1500) break;
  await page.waitForTimeout(200);
}
const rows = await page.evaluate(() => { window.__flashMeter.stop(); return window.__flashMeter.rows(); });
const steps = [];
for (let k = 0; k < rows[0].tiles.length; k++) {
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const l = relLum(rows[i].tiles[k]);
    if (prev !== null) steps.push({ d: Math.abs(l - prev), i, tile: k, ms: rows[i].t - rows[0].t, from: prev, to: l });
    prev = l;
  }
}
steps.sort((a, b) => b.d - a.d);
console.log(`slider ${SLIDER}, ${BLOCKS} rate-blocks: ${rows.length} frames over ${((rows[rows.length-1].t - rows[0].t)/1000).toFixed(1)}s`);
for (const s of steps.slice(0, 12)) {
  console.log(`  step ${s.d.toFixed(4)}  frame ${s.i}/${rows.length}  t=+${(s.ms/1000).toFixed(2)}s  tile ${s.tile}  ${s.from.toFixed(3)} -> ${s.to.toFixed(3)}`);
}
await browser.close();
