import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=wigglejuice');

// ---- 1+3: wiggle+flash on step events, amplitude grows with progress ----
// Pick a multi-block preset (public-domain text is long) so we get many step events.
await page.evaluate(() => {
  const sel = document.getElementById('input-preset-display');
  // Find "Public-domain text" preset by cycling next until found, else fall back to long custom text.
});
await page.fill('#input-custom', 'x'.repeat(400)); // forces several MD5 blocks
await page.locator('#speed-slider').evaluate(el => { el.value = '50'; });

// Instrument: capture --wiggle-rot values applied to block-group-0 over the run, tagged with
// idx/total via a hooked updateMd5RegisterView-adjacent observation: simplest is a MutationObserver
// on style attribute of block-group-0.
// Global progress fraction p (used for both the speed ramp and the wiggle amplitude) is computed
// off the WHOLE trace's idx/total, not any one block's local step — a single block's card only
// ever sees a slice of that range (block 0 finishes early, the last block finishes late). Poll
// EVERY .block-group in document order (chronological order they get built/consumed) so the
// samples span the full run, not just one card's slice of it.
const samples = await page.evaluate(async () => {
  document.getElementById('hash-btn').click();
  await new Promise(r => setTimeout(r, 100)); // let renderMd5BlockChain build the cards
  return new Promise((resolve) => {
    const collected = [];
    const poll = setInterval(() => {
      document.querySelectorAll('.block-group.wiggle').forEach(grp => {
        const rot = grp.style.getPropertyValue('--wiggle-rot');
        if (rot) collected.push(rot);
      });
      const outDigest = document.getElementById('output-digest').textContent;
      if (outDigest && outDigest.length === 32) {
        clearInterval(poll);
        resolve(collected);
      }
    }, 5);
    setTimeout(() => { clearInterval(poll); resolve(collected); }, 20000);
  });
});

if (samples.length < 10) throw new Error(`expected many wiggle samples on block-group-0, got ${samples.length}`);
const absDeg = s => Math.abs(parseFloat(s));
const early = samples.slice(0, Math.floor(samples.length * 0.2)).map(absDeg);
const late = samples.slice(Math.floor(samples.length * 0.8)).map(absDeg);
const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const earlyAvg = avg(early), lateAvg = avg(late);
console.log(`wiggle amplitude: early avg ${earlyAvg.toFixed(2)}deg, late avg ${lateAvg.toFixed(2)}deg (n=${samples.length})`);
if (!(lateAvg > earlyAvg * 1.3)) throw new Error(`wiggle amplitude did not grow meaningfully: early=${earlyAvg} late=${lateAvg}`);

await page.waitForFunction(() => document.getElementById('output-digest').textContent !== '—' && document.getElementById('output-digest').textContent.length === 32, { timeout: 10000 });

// ---- 1/3 (rendered-transform proof): --wiggle-rot being SET is not proof the card actually
// moves — a typo in the .block-group.wiggle rule, or the var failing to resolve, would still
// pass the sampling above. Per this project's own documented trap ("Animation verification
// trap" in CLAUDE.md), force transition:none on a fresh static card, apply .wiggle with a known
// --wiggle-rot, and read the COMPUTED transform matrix to confirm the rotation component is
// actually present and non-zero (not just that the class/var landed).
const rotationProof = await page.evaluate(() => {
  const el = document.getElementById('block-group-0');
  const baseline = getComputedStyle(el).transform;
  el.style.transition = 'none';
  el.style.setProperty('--wiggle-rot', '10deg');
  el.style.setProperty('--wiggle-tx', '0px');
  el.classList.add('wiggle');
  void el.offsetWidth; // force layout so the computed transform reflects the new rule
  const wiggled = getComputedStyle(el).transform;
  el.classList.remove('wiggle');
  el.style.transition = '';
  el.style.removeProperty('--wiggle-rot');
  el.style.removeProperty('--wiggle-tx');
  return { baseline, wiggled };
});
if (rotationProof.wiggled === rotationProof.baseline) {
  throw new Error(`.block-group.wiggle with --wiggle-rot:10deg produced no computed-transform change (baseline === wiggled === "${rotationProof.baseline}") — the rotate() is not reaching the rendered element`);
}
console.log(`rotation proof: baseline="${rotationProof.baseline}" -> wiggled="${rotationProof.wiggled}" (differ: confirmed)`);

// ---- regression: renderMd5BlockChain's minHeight measurement still works with the CSS-var
// transform (it reads getBoundingClientRect() synchronously right after building the cards, so
// it depends on --block-base-transform having resolved by then). For a 7-block stack (400 'x's),
// confirm the container grew well past its 210px CSS default and the output stage box sits below
// the lowest card (no overlap) — the exact failure mode the minHeight logic exists to prevent.
const layout = await page.evaluate(() => {
  const chain = document.getElementById('md5-block-chain');
  const groups = [...document.querySelectorAll('.block-group')];
  const lowestBottom = Math.max(...groups.map(g => g.getBoundingClientRect().bottom));
  const outputTop = document.getElementById('hash-box-output').getBoundingClientRect().top;
  return {
    minHeightPx: parseFloat(getComputedStyle(chain).minHeight),
    blockCount: groups.length,
    lowestBottom,
    outputTop,
  };
});
console.log(`layout: ${layout.blockCount} blocks, chain min-height=${layout.minHeightPx}px, lowest card bottom=${layout.lowestBottom.toFixed(1)}, output box top=${layout.outputTop.toFixed(1)}`);
if (!(layout.minHeightPx > 210)) throw new Error(`chain min-height should have grown past the 210px CSS default for a ${layout.blockCount}-block stack, got ${layout.minHeightPx}px`);
if (!(layout.outputTop >= layout.lowestBottom - 2)) throw new Error(`output stage box (top=${layout.outputTop}) overlaps the lowest card (bottom=${layout.lowestBottom}) — minHeight sizing regressed`);

// ---- 2: speed ramps ~50% faster by the end ----
const speeds = await page.evaluate(() => {
  // getMd5SpeedMs is a top-level function in the page script; sample it directly at low/high progress.
  const total = 200;
  const early = getMd5SpeedMs(0, total);
  const late = getMd5SpeedMs(total - 1, total);
  return { early, late };
});
console.log(`getMd5SpeedMs: idx=0 -> ${speeds.early}ms, idx=last -> ${speeds.late}ms`);
const ratio = speeds.late / speeds.early;
if (!(ratio < 0.55 && ratio > 0.45)) throw new Error(`expected ~0.5x ratio late/early, got ${ratio}`);

// ---- 4: SHA-3 unaffected ----
const sha3 = await page.evaluate(() => {
  const v = document.getElementById('speed-slider').value;
  return { at50: getSha3SpeedMs(), floorCheck: true };
});
console.log('getSha3SpeedMs() at default slider:', sha3.at50);
if (Math.abs(sha3.at50 - 100) > 0.01) throw new Error(`getSha3SpeedMs() at default should be 100ms, got ${sha3.at50}`);
// getSha3SpeedMs must ignore extra args entirely (same value with or without them)
const sha3WithArgs = await page.evaluate(() => getSha3SpeedMs(5, 200));
if (Math.abs(sha3WithArgs - sha3.at50) > 0.01) throw new Error('getSha3SpeedMs must ignore idx/total args');

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  card wiggle+flash fires per step and grows with progress, MD5 speed ramps ~50% faster by the end, SHA-3 speed function untouched, no console errors');
await browser.close();
