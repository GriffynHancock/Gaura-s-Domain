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

// Task (hash-viz-followup, card wiggle): the Z-stack position moved from a literal inline
// `style.transform` to an inline `--block-base-transform` custom property that the stylesheet's
// `.block-group{transform:var(--block-base-transform)}` rule reads, specifically so the new
// step-wiggle effect can append a rotate/translate jitter on top of this base position without
// clobbering it. Check the custom property (still inline, still static/non-animating, so the
// project's "inline is the source of truth" rule still applies) — but that only proves the value
// was AUTHORED, not that the stylesheet rule actually resolved it onto the element. Also assert
// the rendered effect: a non-identity computed transform (proves `transform:var(...)` resolved,
// not just parsed) AND that block 1 visibly sits below block 0 by the real stackOffsetY (30px) —
// proves the CSS var pipeline delivers the same real layout the old literal inline transform did.
const t1 = await page.locator('#block-group-1').evaluate(el => el.style.getPropertyValue('--block-base-transform'));
if (!/translateZ\(-60px\)/.test(t1)) throw new Error(`block-group-1 missing expected translateZ recession, got "${t1}"`);

const rendered = await page.evaluate(() => {
  const g0 = document.getElementById('block-group-0');
  const g1 = document.getElementById('block-group-1');
  return {
    ct0: getComputedStyle(g0).transform,
    ct1: getComputedStyle(g1).transform,
    top0: g0.getBoundingClientRect().top,
    top1: g1.getBoundingClientRect().top,
  };
});
if (!rendered.ct0 || rendered.ct0 === 'none') throw new Error('block-group-0 computed transform is "none" — --block-base-transform did not resolve');
if (!rendered.ct1 || rendered.ct1 === 'none' || rendered.ct1 === rendered.ct0) {
  throw new Error(`block-group-1 computed transform should differ from block 0's (its own translateZ recession), got ct0="${rendered.ct0}" ct1="${rendered.ct1}"`);
}
const dy = rendered.top1 - rendered.top0;
if (!(dy > 15 && dy < 45)) throw new Error(`block-group-1 should sit ~30px below block-group-0 (stackOffsetY), measured dy=${dy}px`);

const captionVisible = await page.locator('#stack-caption').evaluate(el => getComputedStyle(el).display !== 'none');
if (!captionVisible) throw new Error('stack-caption should be visible for a multi-block input');

await page.waitForFunction(
  () => document.getElementById('step-counter-1') && document.getElementById('step-counter-1').textContent === 'step 64 / 64',
  { timeout: 15000 }
);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  2 blocks stacked with Z-axis recession, caption shown, block 1 register view completes, no console errors');
await browser.close();
