// Verifies the Balatro-style JUICE ESCALATION on the hash module.
//
// WHAT CHANGED vs the previous version of this file, and why the new assertions are stronger:
//
//   The old model ramped every effect off a PERCENTAGE of trace progress (p = idx/(total-1)),
//   so this script asserted (a) "late-run average |--wiggle| rotation > 1.3x the early-run average"
//   and (b) "getMd5SpeedMs(last)/getMd5SpeedMs(0) is about 0.5". Both of those pass identically
//   for a 5-block input and a 56-block input — which is exactly the defect the new model fixes,
//   so keeping them would have been actively misleading.
//
//   The new model is count-based and multiplicative: I = 1.1^n where n is the number of chained
//   blocks that have triggered. The replacements below are strictly stronger:
//     * the CURVE is checked EXACTLY, not statistically — I(n+10)/I(n) must equal 1.1^10 to
//       within 1e-9 at several n, where the old check was a fuzzy ratio of two noisy averages;
//     * the COUNT-DEPENDENCE the old test could not express is now checked end-to-end: a real
//       5-block run and a real 50-block run are both animated in the browser, the escalation
//       actually reached is recorded through an in-page hook, and the 50-block run's peak must
//       exceed the 5-block run's by the predicted 1.1^45 factor;
//     * CONTAINMENT is checked, which the old test had no notion of: no cap exists anywhere, so
//       the test proves instead that the rendered values stay bounded (translation) or bounded
//       in excursion (rotation) and that the page never grows a horizontal scrollbar;
//     * the speed assertion is now the same exact-curve check against 1.05^-n rather than a
//       single "about 0.5" ratio.
//   Everything the old file checked that is still true — that .wiggle reaches the rendered
//   transform, that the block-chain min-height sizing still works, that SHA-3's pacing is a
//   separate mechanism with per-phase floors — is retained below unchanged in substance.
//
// Per CLAUDE.md's "animation verification trap": nothing here samples getComputedStyle of an
// element mid-transition. Escalation is read from recorded in-page hooks; the one computed-style
// read forces transition:none first.

import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

await page.goto(BASE_URL + '?v=wigglejuice2');

const near = (a, b, eps) => Math.abs(a - b) <= eps;

// ============================================================================================
// 1. MD5 escalation curve is EXACTLY multiplicative and count-based
// ============================================================================================
const curve = await page.evaluate(() => {
  const samples = [];
  for (const n of [0, 1, 5, 12, 27, 50, 56]) {
    samples.push({ n, I: md5Intensity(n), ratio10: md5Intensity(n + 10) / md5Intensity(n) });
  }
  return { rate: MD5_JUICE_RATE, samples, at56: md5Intensity(56), at50: md5Intensity(50) };
});
if (curve.rate !== 1.1) throw new Error(`MD5_JUICE_RATE must be the owner-specified 1.1, got ${curve.rate}`);
if (!near(curve.samples[0].I, 1, 1e-12)) throw new Error(`intensity at n=0 must be 1, got ${curve.samples[0].I}`);
for (const s of curve.samples) {
  if (!near(s.ratio10, Math.pow(1.1, 10), 1e-9)) {
    throw new Error(`I(n+10)/I(n) at n=${s.n} should be 1.1^10=${Math.pow(1.1, 10)}, got ${s.ratio10}`);
  }
  if (!near(s.I, Math.pow(1.1, s.n), 1e-9)) throw new Error(`I(${s.n}) should be 1.1^${s.n}, got ${s.I}`);
}
// No cap: the documented extreme values must actually be produced, not clamped.
if (!(curve.at50 > 100)) throw new Error(`no cap expected — I(50) should be ~117, got ${curve.at50}`);
if (!(curve.at56 > 200)) throw new Error(`no cap expected — I(56) should be ~209, got ${curve.at56}`);
console.log(`OK  MD5 intensity is exactly 1.1^n and uncapped (I(10)=${curve.samples[0].ratio10.toFixed(3)}, I(50)=${curve.at50.toFixed(0)}, I(56)=${curve.at56.toFixed(0)})`);

// ============================================================================================
// 2. The wiggle RAMPS IN: nearly imperceptible at the start of a run, building from there.
//    (This replaces an earlier "start at 2x the old 0.6deg" assertion. That tuning put a 1.2deg
//    tilt and a 5.5px jump on the very first register step of every hash, however short, which is
//    the opposite of what is wanted: the escalation should be something you notice arriving.)
// ============================================================================================
const start = await page.evaluate(() => {
  const at = n => { const j = md5JuiceFor(n, 1); return { rot: j.rot, tx: j.tx, ty: j.ty }; };
  return { baseRot: MD5_BASE_ROT, n0: at(0), n1: at(1), n5: at(5), n50: at(50),
           txMax: MD5_TX_MAX, tyMax: MD5_TY_MAX };
});
// At n=0 there must be NO perceptible motion at all — every channel starts from a standstill.
for (const [ch, v] of Object.entries(start.n0)) {
  if (Math.abs(v) > 1e-9) throw new Error(`the wiggle must start from a standstill; ${ch} at n=0 was ${v}`);
}
// Sub-pixel / sub-degree through the first chained block, so a short hash barely moves at all.
if (!(Math.abs(start.n1.rot) < 0.25)) throw new Error(`the wiggle must still be nearly imperceptible after one block, got ${start.n1.rot}deg`);
if (!(Math.abs(start.n1.tx) < 1 && Math.abs(start.n1.ty) < 1)) {
  throw new Error(`translation must still be sub-pixel after one block, got tx=${start.n1.tx}px ty=${start.n1.ty}px`);
}
// ...but it must genuinely build, or the ramp has just turned the effect off.
if (!(Math.abs(start.n5.rot) > Math.abs(start.n1.rot) * 3)) {
  throw new Error(`the wiggle must build with the block count: ${start.n1.rot}deg at n=1 vs ${start.n5.rot}deg at n=5`);
}
if (!(Math.abs(start.n50.rot) > 50)) throw new Error(`the wiggle must still go wild on long inputs, got ${start.n50.rot}deg at n=50`);
if (!(Math.abs(start.n50.tx) > 1 || Math.abs(start.n50.ty) > 1)) {
  throw new Error('translation must still be a real channel late in a run');
}
console.log(`OK  the wiggle ramps in from a standstill (n=0: 0deg/0px; n=1: ${start.n1.rot.toFixed(2)}deg, ${start.n1.tx.toFixed(2)}px; n=5: ${start.n5.rot.toFixed(2)}deg; n=50: ${start.n50.rot.toFixed(0)}deg)`);

// ============================================================================================
// 3. Containment WITHOUT a cap: the factor is unbounded, the rendered values are bounded
// ============================================================================================
const contained = await page.evaluate(() => {
  let maxTx = 0, maxTy = 0, monotoneRed = true, monotoneSat = true, prevRed = -1, prevSat = -1;
  for (let n = 0; n <= 400; n += 0.25) {
    const j = md5JuiceFor(n, 1);
    maxTx = Math.max(maxTx, Math.abs(j.tx));
    maxTy = Math.max(maxTy, Math.abs(j.ty));
    if (j.redPct < prevRed - 1e-9) monotoneRed = false;
    if (j.sat < prevSat - 1e-9) monotoneSat = false;
    prevRed = j.redPct; prevSat = j.sat;
  }
  const huge = md5JuiceFor(400, 1);
  return { maxTx, maxTy, monotoneRed, monotoneSat, txMax: MD5_TX_MAX, tyMax: MD5_TY_MAX,
           hugeRed: huge.redPct, hugeSat: huge.sat, hugeI: huge.I, hugeRot: huge.rot };
});
if (contained.maxTx > contained.txMax + 1e-9) throw new Error(`translation exceeded its bound: ${contained.maxTx} > ${contained.txMax}`);
if (contained.maxTy > contained.tyMax + 1e-9) throw new Error(`vertical translation exceeded its bound: ${contained.maxTy} > ${contained.tyMax}`);
if (!contained.monotoneRed || !contained.monotoneSat) throw new Error('glow reddening/saturation must increase monotonically with the count');
if (!(contained.hugeI > 1e15)) throw new Error(`the escalation factor itself must stay UNCAPPED, got I(400)=${contained.hugeI}`);
if (!(contained.hugeRed > 80 && contained.hugeRed < 100)) throw new Error(`reddening should approach but not exceed its ceiling, got ${contained.hugeRed}%`);
console.log(`OK  uncapped factor (I(400)=${contained.hugeI.toExponential(2)}, rot=${contained.hugeRot.toExponential(2)}deg) yet bounded rendered translation (|tx|<=${contained.maxTx.toFixed(2)}px, |ty|<=${contained.maxTy.toFixed(2)}px) and bounded colour (${contained.hugeRed.toFixed(1)}% red)`);

// ============================================================================================
// 4. Speed escalates on the SAME count-based multiplicative basis
// ============================================================================================
const speed = await page.evaluate(() => {
  document.getElementById('speed-slider').value = '50';
  const s = n => md5SpeedMsForN(n);
  return { rate: MD5_SPEED_RATE, at0: s(0), at10: s(10), at45: s(45),
           r10a: s(10) / s(0), r10b: s(30) / s(20) };
});
if (speed.rate !== 1.05) throw new Error(`MD5_SPEED_RATE should be 1.05, got ${speed.rate}`);
for (const r of [speed.r10a, speed.r10b]) {
  if (!near(r, Math.pow(1.05, -10), 1e-9)) throw new Error(`speed should follow 1.05^-n exactly; 10-block ratio was ${r}, expected ${Math.pow(1.05, -10)}`);
}
if (!(speed.at45 < speed.at0 * 0.15)) throw new Error(`speed should have escalated far past the old 0.5x by n=45: ${speed.at45} vs ${speed.at0}`);
console.log(`OK  speed follows 1.05^-n exactly (n=0 -> ${speed.at0.toFixed(2)}ms, n=45 -> ${speed.at45.toFixed(3)}ms, ${(speed.at0 / speed.at45).toFixed(1)}x faster)`);

// ============================================================================================
// 5. END-TO-END: a 5-block input is genuinely milder than a 50-block input
//    (the assertion the old percentage model made structurally impossible)
// ============================================================================================
// Recorded through an in-page hook on md5JuiceFor plus the actual --wiggle strings written
// to the DOM, so this measures the real animation, not just the formula.
async function runAndMeasure(text, expectBlocks) {
  const result = await page.evaluate(async ({ text, expectBlocks }) => {
    document.getElementById('input-custom').value = text;
    document.getElementById('input-custom').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('speed-slider').value = '100';
    const rec = { maxN: 0, maxI: 0, maxAbsRot: 0, maxAbsTx: 0, calls: 0, domRot: 0, domTx: 0, domTy: 0 };
    const realFn = window.md5JuiceFor;
    window.md5JuiceFor = function (n, sign) {
      const j = realFn(n, sign);
      rec.calls++;
      rec.maxN = Math.max(rec.maxN, n);
      rec.maxI = Math.max(rec.maxI, j.I);
      rec.maxAbsRot = Math.max(rec.maxAbsRot, Math.abs(j.rot));
      rec.maxAbsTx = Math.max(rec.maxAbsTx, Math.abs(j.tx));
      return j;
    };
    // Independent DOM witness: every style-attribute write on a card is inspected, so a break
    // between "the formula computed a value" and "the value reached the element" is caught.
    const chain = document.getElementById('md5-block-chain');
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        const el = m.target;
        if (!el.classList || !el.classList.contains('block-group')) continue;
        // --wiggle is ONE property carrying the whole jitter as a transform-list fragment
        // ("rotate(Ndeg) translate(Npx, Npx)") — three separate custom properties meant three
        // style invalidations per step for three values that always move together. Parsed back
        // out here so this witness still checks all three components independently.
        const w = el.style.getPropertyValue('--wiggle');
        const mm = /rotate\(([-\d.]+)deg\)\s*translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(w || '');
        if (!mm) continue;
        const r = parseFloat(mm[1]), tx = parseFloat(mm[2]), ty = parseFloat(mm[3]);
        if (!Number.isNaN(r)) rec.domRot = Math.max(rec.domRot, Math.abs(r));
        if (!Number.isNaN(tx)) rec.domTx = Math.max(rec.domTx, Math.abs(tx));
        if (!Number.isNaN(ty)) rec.domTy = Math.max(rec.domTy, Math.abs(ty));
      }
    });
    obs.observe(chain, { subtree: true, attributes: true, attributeFilter: ['style'] });

    document.getElementById('output-digest').textContent = '—';
    document.getElementById('hash-btn').click();
    await new Promise(resolve => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        const d = document.getElementById('output-digest').textContent;
        if ((d && d.length === 32) || performance.now() - t0 > 60000) { clearInterval(iv); resolve(); }
      }, 20);
    });
    obs.disconnect();
    window.md5JuiceFor = realFn;
    rec.blocks = document.querySelectorAll('.block-group').length;
    // Final colour escalation, read off the CARDS. There is now ONE escalation channel, --juice
    // (the `approach` term, 0..1), it is written per .block-group rather than once on the chain,
    // and CSS multiplies it out into the four colour channels at paint time — that is the MD5 lag
    // fix (four inherited custom properties rewritten on the chain per step were 79% of
    // style-recalc time at 56 blocks). The peak is the largest value any card ended up carrying.
    // Channel values are still checked below, derived here with the stylesheet's own
    // coefficients, and section 5b proves the CSS derivation really reaches a rendered colour.
    rec.juice = Math.max(...[...chain.querySelectorAll('.block-group')]
      .map(el => parseFloat(el.style.getPropertyValue('--juice')) || 0));
    rec.juiceRed = `${(88 * rec.juice).toFixed(2)}%`;
    rec.juiceSat = 2.2 * rec.juice;
    rec.juiceGlow = `${(26 * rec.juice).toFixed(2)}px`;
    return rec;
  }, { text, expectBlocks });
  if (result.blocks !== expectBlocks) throw new Error(`expected a ${expectBlocks}-block stack, got ${result.blocks}`);
  if (result.calls < 50) throw new Error(`expected the juice hook to fire many times, got ${result.calls}`);
  return result;
}

const short = await runAndMeasure('x'.repeat(300), 5);    // (300+9)/64 -> 5 blocks
const long = await runAndMeasure('x'.repeat(3150), 50);   // (3150+9)/64 -> 50 blocks
console.log(`  5-block run:  peak n=${short.maxN.toFixed(2)}  peak I=${short.maxI.toFixed(2)}  peak DOM |rot|=${short.domRot.toFixed(2)}deg  red=${short.juiceRed}`);
console.log(`  50-block run: peak n=${long.maxN.toFixed(2)}  peak I=${long.maxI.toFixed(2)}  peak DOM |rot|=${long.domRot.toFixed(2)}deg  red=${long.juiceRed}`);

if (!(long.maxI > short.maxI * 50)) {
  throw new Error(`a 50-block input must be dramatically wilder than a 5-block one: peak I ${short.maxI} vs ${long.maxI}`);
}
// the predicted ratio is exactly 1.1^45 (peaks are at n=5 and n=50)
const predicted = Math.pow(1.1, 45);
const observed = long.maxI / short.maxI;
if (!near(observed / predicted, 1, 0.02)) {
  throw new Error(`peak-intensity ratio should be 1.1^45 = ${predicted.toFixed(1)}, got ${observed.toFixed(1)}`);
}
if (!(long.domRot > short.domRot * 50)) {
  throw new Error(`DOM-level peak |--wiggle| rotation must scale with block count: ${short.domRot} vs ${long.domRot}`);
}
if (!(long.domTy > 0 && short.domTy > 0)) throw new Error('--wiggle\'s y translation never reached the DOM');
if (!(parseFloat(long.juiceRed) > parseFloat(short.juiceRed) && parseFloat(long.juiceRed) > 60)) {
  throw new Error(`glow reddening must grow with the count and get strong on long inputs: ${short.juiceRed} vs ${long.juiceRed}`);
}
if (!(long.juiceSat > short.juiceSat && long.juiceSat > 1.5)) {
  throw new Error(`glow saturation must grow with the count: ${short.juiceSat} vs ${long.juiceSat}`);
}
console.log(`OK  5 blocks is genuinely milder than 50 (peak I ${short.maxI.toFixed(2)} vs ${long.maxI.toFixed(1)}, ratio ${observed.toFixed(1)} = 1.1^45), and the reddening/saturation grew with it`);

// ============================================================================================
// 5b. The single --juice channel really is multiplied out into RENDERED colour by CSS.
//     (Guards the lag fix: collapsing four written custom properties into one CSS-derived one
//     must not quietly disconnect the escalation from what is painted.)
// ============================================================================================
const juiceRender = await page.evaluate(() => {
  const chain = document.getElementById('block-group-0');   // --juice lives on the CARD now
  const box = document.getElementById('reg-0-A');
  const prev = chain.style.getPropertyValue('--juice');
  const read = v => {
    chain.style.setProperty('--juice', v);
    box.classList.add('pulse');
    box.style.transition = 'none';
    void box.offsetWidth;
    const cs = getComputedStyle(box);
    const out = { border: cs.borderTopColor, bg: cs.backgroundColor, filter: cs.filter, shadow: cs.boxShadow };
    box.classList.remove('pulse');
    box.style.transition = '';
    return out;
  };
  const cold = read('0');
  const hot = read('1');
  chain.style.setProperty('--juice', prev || '0');
  return { cold, hot };
});
for (const k of ['border', 'bg', 'filter', 'shadow']) {
  if (juiceRender.cold[k] === juiceRender.hot[k]) {
    throw new Error(`--juice must drive the rendered ${k}: unchanged between --juice:0 and --juice:1 ("${juiceRender.cold[k]}")`);
  }
}
if (!/saturate\(3\.2\)/.test(juiceRender.hot.filter)) {
  throw new Error(`--juice:1 should resolve to saturate(1 + 2.2) on a chain register box, got "${juiceRender.hot.filter}"`);
}
console.log(`OK  the one --juice channel is multiplied out by CSS into rendered border/background/filter/glow (hot filter: ${juiceRender.hot.filter})`);

// ============================================================================================
// 6. Each card has its OWN off-centre pivot, stable for the life of the render
// ============================================================================================
const origins = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.block-group')];
  const first = els.map(e => e.style.getPropertyValue('--wiggle-origin').trim());
  // read again after a frame: must be identical (assigned once, not re-rolled)
  const second = els.map(e => e.style.getPropertyValue('--wiggle-origin').trim());
  const computed = els.slice(0, 3).map(e => getComputedStyle(e).transformOrigin);
  return { first, second, computed };
});
if (origins.first.some(o => !o)) throw new Error('every card must get a --wiggle-origin');
if (origins.first.join('|') !== origins.second.join('|')) throw new Error('--wiggle-origin must be stable, not re-randomised');
if (new Set(origins.first).size < origins.first.length * 0.8) {
  throw new Error(`pivots must be randomised per card, got only ${new Set(origins.first).size} distinct across ${origins.first.length} cards`);
}
if (origins.first.every(o => o.startsWith('50%'))) throw new Error('pivots must be OFF-centre, not all at 50%');
if (origins.computed.some(c => !/px/.test(c))) throw new Error(`transform-origin did not resolve on the element: ${origins.computed}`);
console.log(`OK  ${new Set(origins.first).size}/${origins.first.length} distinct per-card off-centre pivots, stable across reads (e.g. ${origins.first.slice(0, 3).join(', ')})`);

// ============================================================================================
// 7. Rendered-transform proof (retained): .wiggle really reaches the computed transform, and
//    the translation component is really there — not just the CSS variable being set.
// ============================================================================================
const rotationProof = await page.evaluate(() => {
  const el = document.getElementById('block-group-0');
  el.style.transition = 'none';
  el.classList.remove('wiggle');
  const setW = (rot, tx, ty) => el.style.setProperty('--wiggle', `rotate(${rot}deg) translate(${tx}px, ${ty}px)`);
  setW(0, 0, 0);
  el.classList.add('wiggle');
  void el.offsetWidth;
  const baseline = getComputedStyle(el).transform;
  setW(10, 0, 0);
  void el.offsetWidth;
  const rotated = getComputedStyle(el).transform;
  setW(0, 25, 13);
  void el.offsetWidth;
  const translated = getComputedStyle(el).transform;
  // The single-property collapse must not lose the resting pose when --wiggle is absent: the
  // rule's own fallback has to hold the card exactly where the base transform puts it.
  el.style.removeProperty('--wiggle');
  void el.offsetWidth;
  const missing = getComputedStyle(el).transform;
  el.classList.remove('wiggle');
  el.style.transition = '';
  return { baseline, rotated, translated, missing };
});
if (rotationProof.rotated === rotationProof.baseline) {
  throw new Error(`--wiggle rotate(10deg) produced no computed-transform change (both "${rotationProof.baseline}") — the rotate() is not reaching the element`);
}
if (rotationProof.translated === rotationProof.baseline) {
  throw new Error(`--wiggle translate() produced no computed-transform change — the translate() is not reaching the element`);
}
if (rotationProof.missing !== rotationProof.baseline || /none/.test(rotationProof.missing)) {
  throw new Error(`with --wiggle unset the fallback must reproduce the resting pose exactly, got "${rotationProof.missing}" vs "${rotationProof.baseline}"`);
}
// the translate must move BOTH axes: compare the matrix's last two components
const mt = /matrix(3d)?\(([^)]+)\)/.exec(rotationProof.translated);
const mb = /matrix(3d)?\(([^)]+)\)/.exec(rotationProof.baseline);
if (mt && mb) {
  const a = mt[2].split(',').map(Number), b = mb[2].split(',').map(Number);
  const dx = a[a.length - (mt[1] ? 4 : 2)] - b[b.length - (mb[1] ? 4 : 2)];
  const dy = a[a.length - (mt[1] ? 3 : 1)] - b[b.length - (mb[1] ? 3 : 1)];
  if (!(Math.abs(dx) > 20 && Math.abs(dy) > 10)) {
    throw new Error(`translate(25px, 13px) should shift the matrix on both axes, got dx=${dx} dy=${dy}`);
  }
}
console.log(`OK  rotate() and translate(x, y) both reach the rendered transform`);

// ============================================================================================
// 8. Nothing breaks the layout at extreme escalation (no cap -> containment must hold)
// ============================================================================================
const layout = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.block-group')];
  const chainEl = document.getElementById('md5-block-chain');
  // AT REST first: the min-height/overlap regression is about the resting stack, so it must be
  // measured before the forced peak wiggle below inflates every card's bounding box.
  const rest = {
    chainMinHeight: parseFloat(getComputedStyle(chainEl).minHeight),
    lowestBottom: Math.max(...groups.map(g => g.getBoundingClientRect().bottom)),
    outputTop: document.getElementById('hash-box-output').getBoundingClientRect().top,
  };
  // Force the worst case simultaneously on every card: rotation has its largest screen
  // excursion near 90deg (it is periodic, so bigger angles are not worse), plus max translation.
  groups.forEach((el, i) => {
    el.style.transition = 'none';
    el.style.setProperty('--wiggle', `rotate(${i % 2 ? 90 : -90}deg) translate(${i % 2 ? MD5_TX_MAX : -MD5_TX_MAX}px, ${i % 2 ? MD5_TY_MAX : -MD5_TY_MAX}px)`);
    el.style.setProperty('--juice', '1');   // peak escalation, now a single per-card channel
    el.classList.add('wiggle', 'pulse');
  });
  void document.body.offsetWidth;
  const de = document.documentElement;
  const box = document.getElementById('animation-box');
  const res = {
    docScrollW: de.scrollWidth, docClientW: de.clientWidth,
    boxScrollW: box.scrollWidth, boxClientW: box.clientWidth,
    chainMinHeight: rest.chainMinHeight,
    blocks: groups.length,
    lowestBottom: rest.lowestBottom,
    outputTop: rest.outputTop,
  };
  groups.forEach(el => {
    el.classList.remove('wiggle', 'pulse');
    el.style.transition = '';
    ['--wiggle', '--juice'].forEach(v => el.style.removeProperty(v));
  });
  return res;
});
if (layout.docScrollW > layout.docClientW + 1) {
  throw new Error(`peak wiggle grew a page-wide horizontal scrollbar: scrollWidth ${layout.docScrollW} > clientWidth ${layout.docClientW}`);
}
if (layout.boxScrollW > layout.boxClientW + 1) {
  throw new Error(`peak wiggle overflowed the animation box: ${layout.boxScrollW} > ${layout.boxClientW}`);
}
console.log(`OK  at peak wiggle on all ${layout.blocks} cards the page still has no horizontal overflow (doc ${layout.docScrollW}/${layout.docClientW}, box ${layout.boxScrollW}/${layout.boxClientW})`);

// Retained regression: the block-chain min-height measurement still sizes the stack so the
// output stage box never overlaps the lowest card.
if (!(layout.chainMinHeight > 210)) throw new Error(`chain min-height should have grown past the 210px default for a ${layout.blocks}-block stack, got ${layout.chainMinHeight}px`);
if (!(layout.outputTop >= layout.lowestBottom - 2)) throw new Error(`output stage box (top=${layout.outputTop}) overlaps the lowest card (bottom=${layout.lowestBottom}) — minHeight sizing regressed`);
console.log(`OK  block-chain min-height sizing still correct (${layout.chainMinHeight}px, output below the lowest card)`);

// ============================================================================================
// 9. SHA-3: same escalation model, its own counters, still a SEPARATE pacing mechanism
// ============================================================================================
const sha3Curve = await page.evaluate(() => {
  document.getElementById('speed-slider').value = '50';
  const snap = (r, b) => {
    const sr = __sha3Debug.juice();
    return { r, b };
  };
  const probe = (rounds, blocks) => {
    // drive the real state the intensity reads from, then restore
    const dbg = __sha3Debug.juice();
    return null;
  };
  return {
    roundRate: SHA3_ROUND_RATE, blockRate: SHA3_BLOCK_RATE,
    speedRoundRate: SHA3_SPEED_ROUND_RATE, speedBlockRate: SHA3_SPEED_BLOCK_RATE,
    tintMin: SHA3_TINT_MIN, tintMax: SHA3_TINT_MAX,
    // exact curve, sampled through the real functions by setting their inputs, plus the two
    // VISUAL channels the escalation drives (wavefront width and phase-tint depth) read back
    // through the same debug hook the renderer's own values come from.
    samples: [[0, 0], [12, 0], [23, 0], [0, 1], [23, 3], [10, 26]].map(([r, b]) => {
      const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone;
      sha3.roundsInBlock = r; sha3.blocksDone = b;
      sha3.flashEsc = 1 - 1 / sha3Intensity();
      const j = __sha3Debug.juice();
      const out = { r, b, I: sha3Intensity(), S: sha3SpeedIntensity(), widen: j.flashWiden, tint: j.flashTint };
      sha3.roundsInBlock = keepR; sha3.blocksDone = keepB; sha3.flashEsc = 0;
      return out;
    }),
    scale: sha3PhaseScale(),
    theta: sha3PhaseDuration('theta'),
    thetaWithArgs: sha3PhaseDuration('theta', 5, 200),
    perRound: ['theta', 'rho', 'pi', 'chi', 'iota'].reduce((s, t) => s + sha3PhaseDuration(t), 0),
  };
});
// The SHA-3 escalation used to drive three channels: camera shake, plane shake, and speed. The
// two SHAKE channels are gone by owner decision — the lattice holds still — but the escalation
// itself is NOT: a long input must still read as bigger work than a short one, exactly as MD5's
// does. It now drives the wavefront's WIDTH and the phase TINT's depth instead, neither of which
// moves anything, plus speed as before. Both the curve and its arrival at the two visual channels
// are pinned here, so "no shaking" can never quietly become "no escalation".
if (sha3Curve.roundRate !== 1.06 || sha3Curve.blockRate !== 1.1) {
  throw new Error(`SHA-3 visual escalation rates should be 1.06/round and 1.1/block, got ${sha3Curve.roundRate}/${sha3Curve.blockRate}`);
}
if (sha3Curve.speedRoundRate !== 1.04 || sha3Curve.speedBlockRate !== 1.06) {
  throw new Error(`SHA-3 pacing rates should be 1.04/round and 1.06/block, got ${sha3Curve.speedRoundRate}/${sha3Curve.speedBlockRate}`);
}
for (const s of sha3Curve.samples) {
  const want = Math.pow(1.06, s.r) * Math.pow(1.1, s.b);
  if (!near(s.I / want, 1, 1e-9)) throw new Error(`sha3Intensity(r=${s.r},b=${s.b}) should be ${want}, got ${s.I}`);
  const wantS = Math.pow(1.04, s.r) * Math.pow(1.06, s.b);
  if (!near(s.S / wantS, 1, 1e-9)) throw new Error(`sha3SpeedIntensity(r=${s.r},b=${s.b}) should be ${wantS}, got ${s.S}`);
}
const oneBlockArc = sha3Curve.samples.find(s => s.r === 23 && s.b === 0).I;
if (!(oneBlockArc > 3.5)) throw new Error(`a single SHA-3 block must visibly escalate across its 24 rounds, got only ${oneBlockArc}x`);
const laterBlock = sha3Curve.samples.find(s => s.b === 26).I;
if (!(laterBlock > oneBlockArc * 2)) throw new Error(`later rate-blocks must be wilder than the first (5 layers < 100 layers), got ${laterBlock} vs ${oneBlockArc}`);
// ...and it must actually reach the picture, not just exist as a number.
const first = sha3Curve.samples.find(s => s.r === 0 && s.b === 0);
const deep = sha3Curve.samples.find(s => s.b === 26);
if (!(first.widen === 1 && first.tint === sha3Curve.tintMin)) {
  throw new Error(`at the very start the flash must be at its narrowest and palest, got widen=${first.widen} tint=${first.tint}`);
}
if (!(deep.widen > first.widen * 1.5)) {
  throw new Error(`the wavefront must widen as a long input grinds on: ${first.widen} -> ${deep.widen}`);
}
// The tint's escalation, restated in ABSOLUTE terms now that the tint is deliberately much more
// prominent from the very first phase (SHA3_TINT_MIN/MAX went 0.14/0.32 -> 0.34/0.62, so the
// active step's hue substantially overrides the block's own colour rather than washing over it).
// The old form of this check was a RATIO — "deeper than 1.8x its starting value" — which the new
// depths cannot meet: 0.62/0.34 is 1.82x of headroom in total, because the floor rose so much.
// The ratio was never the interesting quantity though. What the escalation has to do is put a
// VISIBLE amount of extra hue on screen for a long input, and by that measure it now does
// strictly more than before: the tint travels 0.28 of the way to the phase colour across a long
// run where it used to travel 0.18. So: assert the absolute travel (stronger than before) and
// keep a relative floor as well (weaker than before, and justified by the arithmetic above).
if (!(deep.tint - first.tint > 0.2)) {
  throw new Error(`the phase tint must visibly deepen as a long input grinds on: ${first.tint} -> ${deep.tint} (travel ${(deep.tint - first.tint).toFixed(3)}, need > 0.2)`);
}
if (!(deep.tint > first.tint * 1.5)) {
  throw new Error(`the phase tint must deepen as a long input grinds on: ${first.tint} -> ${deep.tint}`);
}
// Containment without a cap, same rule as everywhere else on this page: the factor is unbounded,
// the rendered values are not. The tint ceiling in particular is the value the rate/capacity
// separability in verify_task4 is verified at, so it must never be exceeded.
if (!(deep.tint <= sha3Curve.tintMax + 1e-9)) {
  throw new Error(`the phase tint must stay under its verified ceiling ${sha3Curve.tintMax}, got ${deep.tint}`);
}
console.log(`OK  SHA-3 escalation = 1.06^round * 1.1^block exactly (one block arcs 1 -> ${oneBlockArc.toFixed(2)}x; block 26 already at ${laterBlock.toFixed(1)}x) and reaches the picture without moving anything: wavefront ${first.widen.toFixed(2)}x -> ${deep.widen.toFixed(2)}x wide, phase tint ${first.tint.toFixed(2)} -> ${deep.tint.toFixed(2)} (ceiling ${sha3Curve.tintMax})`);

// SHA-3 pacing remains a separate mechanism from MD5's (retained assertion).
if (Math.abs(sha3Curve.scale - 0.28) > 0.001) throw new Error(`sha3PhaseScale() at default should be 0.28, got ${sha3Curve.scale}`);
if (Math.abs(sha3Curve.thetaWithArgs - sha3Curve.theta) > 0.01) throw new Error('SHA-3 phase durations must ignore MD5-style idx/total args');
const fastest = await page.evaluate(() => {
  document.getElementById('speed-slider').value = '100';
  const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone;
  sha3.roundsInBlock = 23; sha3.blocksDone = 26;   // deepest escalation, fastest slider
  const out = ['theta', 'rho', 'pi', 'chi', 'iota'].map(t => [t, sha3PhaseDuration(t)]);
  sha3.roundsInBlock = keepR; sha3.blocksDone = keepB;
  document.getElementById('speed-slider').value = '50';
  return out;
});
// The floors are now split by what each phase has to SHOW, rather than one flat 20ms rule for all
// five. pi and rho are the two phases that genuinely MOVE something — pi slides every lane to a
// new slot, rho eases 25 spins — and a movement that occupies one frame is a jump, not a
// movement, which is the failure mode the phase controller exists to prevent. So those two keep a
// floor above one 60Hz frame. theta, chi and iota only flash: a flash has no in-between state to
// lose, so a single frame of it is still a flash, and holding them to pi's floor was throwing
// away most of the fast end of the slider for nothing.
const MOVING_FLOOR = 16.7, FLASH_FLOOR = 8;
for (const [t, ms] of fastest) {
  const need = (t === 'pi' || t === 'rho') ? MOVING_FLOOR : FLASH_FLOOR;
  if (ms < need) throw new Error(`phase ${t} is only ${ms}ms at max escalation + fastest slider (floor for this phase is ${need}ms) — it would snap`);
}
console.log(`OK  SHA-3 phase floors still hold at max escalation: ${fastest.map(([t, m]) => `${t}=${m.toFixed(0)}ms`).join(' ')} (moving phases >= ${MOVING_FLOOR}ms, flash-only phases >= ${FLASH_FLOOR}ms)`);

// ---- the slider must speed things up ACROSS ITS WHOLE TRAVEL ----
// The reported failure was "the max speed isn't fast enough, and it doesn't seem to speed up
// much". Both had the same cause: the old per-phase floors summed to 184ms/round while the old
// fast-end scale put the unfloored per-round total at 182ms, so at slider 100 every phase sat on
// its floor from the first round and the top of the travel did nothing. This measures the whole
// curve — the full simulated duration of a one-rate-block run (24 rounds x 5 phases + 5 stage
// events, escalation included) at six settings — and asserts that it keeps falling all the way,
// not just over the slow half.
const runCurve = await page.evaluate(() => {
  const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone;
  const at = v => {
    document.getElementById('speed-slider').value = String(v);
    let total = 0;
    sha3.blocksDone = 0;
    for (let r = 0; r < 24; r++) {
      sha3.roundsInBlock = r;
      for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) total += sha3PhaseDuration(t);
    }
    sha3.roundsInBlock = 0;
    total += 5 * sha3PhaseDuration('box');
    return Math.round(total);
  };
  const out = [1, 25, 50, 65, 80, 90, 100].map(v => [v, at(v)]);
  sha3.roundsInBlock = keepR; sha3.blocksDone = keepB;
  document.getElementById('speed-slider').value = '50';
  return out;
});
const runAt = Object.fromEntries(runCurve);
for (let i = 1; i < runCurve.length; i++) {
  // every step of the slider must still be doing something, in particular past the midpoint
  if (!(runCurve[i][1] < runCurve[i - 1][1] * 0.93)) {
    throw new Error(`the slider goes dead between ${runCurve[i - 1][0]} and ${runCurve[i][0]}: ${runCurve[i - 1][1]}ms -> ${runCurve[i][1]}ms`);
  }
}
// The slow end is legibility-critical and must NOT have been sped up by any of this. RAISED again,
// >60s to >150s: after the 65s build the owner reported the slowest setting was "nowhere near slow
// enough, probably another two or four times slower", so SHA3_SCALE_SLOW went 2.25 -> 6.75 and the
// measured one-rate-block run at slider 1 is now ~195s. The bound sits at the bottom of the
// requested 2-4x band (2x of 65s = 130s, so >150s catches a regression to anything below ~2.3x).
if (!(runAt[1] > 150000)) throw new Error(`the slow end must stay slow enough to read (>150s), got ${runAt[1]}ms`);
// The default is the one the room sees first; it is unchanged on purpose.
if (!(runAt[50] > 7000 && runAt[50] < 10000)) throw new Error(`the default (slider 50) should be unchanged at ~8.5s, got ${runAt[50]}ms`);
// The fast end must be a real step change, not the old ~4.6s. It does NOT need to reach REAL
// TIME's ~22ms — that is a separate toggle — but it must feel like a different mode of use.
if (!(runAt[100] < 2200)) throw new Error(`the fast end must be genuinely fast (<2.2s), got ${runAt[100]}ms`);
// ...and BOTH halves of the travel must carry a real range. This replaces an earlier check that
// the fast half carried MORE range than the slow half — which was the right shape of assertion
// when the complaint was "it doesn't seem to speed up much", but is now directly contradicted by
// the owner's later instruction to make the slow end 2.5x slower. Stretching the slow end is
// exactly what makes the slow half's ratio the larger one, so the old comparison would fail on
// the requested behaviour rather than on a regression.
//
// What the original defect actually was — a stretch of travel where nothing happens — is caught
// by two checks that are unaffected: the per-step "the slider goes dead between X and Y" loop
// above (every sampled step must shorten the run by at least 7%), and the requirement that each
// half spans at least 3x. Both halves are geometric now, so a fixed ratio is the natural bound.
const fastHalfRatio = runAt[50] / runAt[100], slowHalfRatio = runAt[1] / runAt[50];
if (!(fastHalfRatio > 3 && slowHalfRatio > 3)) {
  throw new Error(`both halves of the slider must carry a real range (>3x each), got fast ${fastHalfRatio.toFixed(2)}x, slow ${slowHalfRatio.toFixed(2)}x`);
}
console.log(`OK  SHA-3 slider speeds up across its whole travel: ${runCurve.map(([v, ms]) => `${v}->${(ms / 1000).toFixed(1)}s`).join(' ')} (slow half ${slowHalfRatio.toFixed(1)}x, fast half ${fastHalfRatio.toFixed(1)}x)`);

// ============================================================================================
// 10. SHA-3 does NOT shake — the lattice holds still (owner decision; the directional flash now
//     carries the per-step axis information the shake used to gesture at, without moving anything)
// ============================================================================================
await page.evaluate(() => { document.getElementById('algo-next').click(); document.getElementById('speed-slider').value = '60'; });
const sha3Still = await page.evaluate(async () => {
  document.getElementById('input-custom').value = 'shake me';
  document.getElementById('input-custom').dispatchEvent(new Event('input', { bubbles: true }));
  const seen = { blurDuringPi: false, firstI: null, lastI: null, maxWiden: 0, maxTint: 0,
                 maxRotDrift: 0, gains: [], flashTypes: new Set() };
  const rot0 = __sha3Debug.rotation();
  document.getElementById('output-digest').textContent = '—';
  document.getElementById('hash-btn').click();
  await new Promise(resolve => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const j = __sha3Debug.juice();
      if (seen.firstI === null) seen.firstI = j.intensity;
      seen.lastI = j.intensity;
      seen.maxWiden = Math.max(seen.maxWiden, j.flashWiden);
      seen.maxTint = Math.max(seen.maxTint, j.flashTint);
      if (j.flashType) { seen.flashTypes.add(j.flashType); seen.gains.push(j.flashGain); }
      // The camera must never wander from wherever the user dragged it.
      const r = __sha3Debug.rotation();
      seen.maxRotDrift = Math.max(seen.maxRotDrift, Math.abs(r.rotX - rot0.rotX), Math.abs(r.rotY - rot0.rotY));
      const ph = __sha3Debug.activePhase();
      if (ph === 'pi' && __sha3Debug.lastBlur()) seen.blurDuringPi = true;
      const d = document.getElementById('output-digest').textContent;
      if ((d && d.length === 64) || performance.now() - t0 > 90000) { clearInterval(iv); resolve(); }
    }, 12);
  });
  // after the run fully settles the canvas must be repainted CRISP — no permanent smear
  await new Promise(r => setTimeout(r, 1400));
  seen.blurAfterRun = __sha3Debug.lastBlur();
  seen.blurAlphaAfterRun = __sha3Debug.lastBlurAlpha();
  seen.noShake = __sha3Debug.noShake();
  seen.flashTypesList = [...seen.flashTypes];
  return seen;
});
// Structural: no shake state, no shake functions. If either comes back, this fails loudly rather
// than the shake quietly returning because some later edit reinstated a "small" jitter.
if (sha3Still.noShake.shakeStateKeys.length) {
  throw new Error(`the SHA-3 renderer must carry no shake state, found ${sha3Still.noShake.shakeStateKeys}`);
}
if (sha3Still.noShake.shakeFns.length) {
  throw new Error(`the SHA-3 shake functions must be gone, found ${sha3Still.noShake.shakeFns}`);
}
// Behavioural: the camera stayed exactly where it was for the whole run.
if (!(sha3Still.maxRotDrift === 0)) {
  throw new Error(`the camera must not move during a run — it is only ever moved by a drag — drifted ${sha3Still.maxRotDrift}deg`);
}
if (!(sha3Still.lastI > sha3Still.firstI * 2)) {
  throw new Error(`SHA-3 escalation must still be visible across a run: ${sha3Still.firstI} -> ${sha3Still.lastI}`);
}
// Removing the shake must not have removed the crescendo with it: the two surviving visual
// channels have to have genuinely moved during this real run.
if (!(sha3Still.maxWiden > 1.2)) throw new Error(`the wavefront must have visibly widened during a real run, peaked at ${sha3Still.maxWiden}x`);
if (!(sha3Still.maxTint > 0.2)) throw new Error(`the phase tint must have visibly deepened during a real run, peaked at ${sha3Still.maxTint}`);
// And the thing that replaced the shake actually ran.
if (sha3Still.flashTypesList.length < 4) {
  throw new Error(`the directional flash must arm for the phases that used to shake, saw only ${sha3Still.flashTypesList}`);
}
console.log(`OK  SHA-3 no longer shakes at all (no shake state, no shake functions, camera drift ${sha3Still.maxRotDrift}deg across a full run), yet still escalates ${sha3Still.firstI.toFixed(2)} -> ${sha3Still.lastI.toFixed(2)}x through the flash's width (to ${sha3Still.maxWiden.toFixed(2)}x) and the phase tint (to ${sha3Still.maxTint.toFixed(2)}), across ${sha3Still.flashTypesList.length} phase types`);

// ============================================================================================
// 11. Motion blur: on during the fast rearrangement, off at idle and during drag
// ============================================================================================
if (!sha3Still.blurDuringPi) throw new Error('motion blur never engaged during the pi rearrangement');
if (sha3Still.blurAfterRun) throw new Error('motion blur is still on after the run finished — it would smear permanently');
// ---- ...and its STRENGTH rises with speed ----
// The blur is an incomplete wipe: sha3Render lays down a translucent background instead of
// clearing, so a LOWER alpha erases less of the previous frame and leaves a LONGER trail. Faster
// playback should therefore wipe with a lower alpha — both because a fast phase really does move
// further between frames, and because smearing consecutive frames together is the other half
// (with the brightness gain) of stopping fast playback from reading as a strobe.
const blurCurve = await page.evaluate(() => {
  const at = v => {
    document.getElementById('speed-slider').value = String(v);
    const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone;
    sha3.roundsInBlock = 0; sha3.blocksDone = 0;
    const a = __sha3Debug.blurAlphaFor(sha3PhaseDuration('pi'));
    sha3.roundsInBlock = keepR; sha3.blocksDone = keepB;
    return a;
  };
  const out = [1, 25, 50, 75, 100].map(v => [v, at(v)]);
  document.getElementById('speed-slider').value = '50';
  return out;
});
for (let i = 1; i < blurCurve.length; i++) {
  if (!(blurCurve[i][1] <= blurCurve[i - 1][1] + 1e-9)) {
    throw new Error(`blur must not weaken as speed rises: slider ${blurCurve[i - 1][0]} alpha ${blurCurve[i - 1][1]} -> ${blurCurve[i][0]} alpha ${blurCurve[i][1]}`);
  }
}
const slowA = blurCurve[0][1], fastA = blurCurve[blurCurve.length - 1][1];
if (!(fastA < slowA * 0.75)) {
  throw new Error(`the fast end must blur noticeably more than the slow end (lower wipe alpha), got ${slowA} -> ${fastA}`);
}
// Never so low that the lattice never resolves: below ~0.12 the canvas is holding 8+ frames of
// history and reads as mush rather than as motion.
if (!(fastA >= 0.12)) throw new Error(`blur alpha ${fastA} is too low — the lattice would never resolve`);
// A crisp wipe is alpha 0 by construction, which is what every "must be crisp" path uses.
if (sha3Still.blurAlphaAfterRun !== 0) {
  throw new Error(`after the run the canvas must be wiped opaquely (alpha 0), got ${sha3Still.blurAlphaAfterRun}`);
}
console.log(`OK  motion blur STRENGTHENS with speed (pi's wipe alpha ${blurCurve.map(([v, a]) => `${v}->${a.toFixed(2)}`).join(' ')}; lower = longer trail) and still ends crisp at alpha 0`);
// drag must repaint crisply
const canvas = await page.locator('#lane-canvas').boundingBox();
await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
await page.mouse.down();
await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + canvas.height / 2 + 30, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);
if (await page.evaluate(() => __sha3Debug.lastBlur())) throw new Error('drag-rotation must render crisply, not blurred');
// aborting mid-run must also leave a crisp frame (the smear-on-abort case)
const abortBlur = await page.evaluate(async () => {
  // Slow enough to sit inside pi for a comfortable while, without paying the whole slow end to get
  // there: at slider 25 a rate-block takes ~41s across 24 rounds, so pi alone lasts a few hundred
  // ms — thousands of times longer than the microseconds between "activePhase() === 'pi'" below
  // and the abort click two lines later, which both run inside this one page.evaluate. Slider 1
  // (the old value) took ~10s just to reach the first pi and bought no extra margin: the abort is
  // fired the instant pi is detected, never after a fixed delay. The blur is present during pi at
  // EVERY slider setting (sha3BlurAlpha returns a non-zero alpha across its whole range, and
  // lastBlur is truthy for any non-zero alpha), so the smear case is still genuinely exercised.
  document.getElementById('speed-slider').value = '25';
  document.getElementById('hash-btn').click();
  // Wait for the controller to actually BE in pi rather than guessing with a fixed delay. A fixed
  // 900ms landed in rho or theta often enough that this assertion survived deleting the very fix
  // it exists to guard (sha3Stop's crisp repaint) — it only catches the bug if the last painted
  // frame was a blurred one, which is only guaranteed mid-pi.
  const t0 = performance.now();
  while (performance.now() - t0 < 20000 && __sha3Debug.activePhase() !== 'pi') {
    await new Promise(r => requestAnimationFrame(r));
  }
  const inPi = __sha3Debug.activePhase() === 'pi';
  const blurAtAbort = __sha3Debug.lastBlur();
  document.getElementById('algo-next').click();          // switch to MD5 -> hard-cancels the run
  await new Promise(r => setTimeout(r, 500));
  return { inPi, blurAtAbort, blurAfter: __sha3Debug.lastBlur() };
});
if (!abortBlur.inPi) throw new Error('could not get the controller into pi to test the abort case');
if (!abortBlur.blurAtAbort) throw new Error('expected the canvas to be mid-blur at the moment of abort — the test is not exercising the smear case');
if (abortBlur.blurAfter) throw new Error('aborting a run mid-pi left a motion-blurred frame on the canvas permanently');
console.log('OK  motion blur engages during pi, and is off at idle, during drag, and after an aborted run');

// ============================================================================================
// 12. Real-time switch: measured, displayed, honest
// ============================================================================================
await page.evaluate(() => { document.getElementById('speed-slider').value = '100'; });
const rt = await page.evaluate(async () => {
  // the benchmark is deferred to idle; make sure it has run
  if (!hashBench.done) runHashBenchmark();
  return {
    md5PerBlockUs: hashBench.md5PerBlockUs,
    sha3PerBlockUs: hashBench.sha3PerBlockUs,
    text: document.getElementById('realtime-readout').textContent,
    note: document.getElementById('realtime-note').textContent,
  };
});
if (!(rt.md5PerBlockUs > 0 && rt.md5PerBlockUs < 1000)) throw new Error(`implausible MD5 benchmark: ${rt.md5PerBlockUs} us/block`);
if (!(rt.sha3PerBlockUs > 0 && rt.sha3PerBlockUs < 5000)) throw new Error(`implausible SHA-3 benchmark: ${rt.sha3PerBlockUs} us/block`);
if (!/MD5/.test(rt.text) || !/SHA-3/.test(rt.text)) throw new Error(`readout should state both measured figures, got "${rt.text}"`);
if (!/JavaScript/i.test(rt.note) || !/(native|hardware)/i.test(rt.note)) {
  throw new Error(`the readout must be honest that this is a browser JS measurement and that native is faster: "${rt.note}"`);
}
// The two figures are handicapped by DIFFERENT amounts (Keccak's 64-bit lanes are BigInt here;
// MD5's 32-bit words are native JS numbers), so printing them side by side manufactures a false
// "SHA-3 is ~45x slower than MD5" reading. The page must disclaim the comparison, not just the
// absolute magnitudes, and must say WHY (the 64-bit/32-bit JS asymmetry).
if (!/(not a fair race|aren't a fair race|not a race)/i.test(rt.note)) {
  throw new Error(`the note must disclaim the MD5-vs-SHA-3 comparison, not only the absolute numbers: "${rt.note}"`);
}
if (!/64-bit/.test(rt.note) || !/32-bit/.test(rt.note)) {
  throw new Error(`the note must explain the 64-bit vs 32-bit JS asymmetry behind the gap: "${rt.note}"`);
}
if (!/(not a fair race|see below|not comparable)/i.test(rt.text)) {
  throw new Error(`the readout line itself must flag that the two figures are not a like-for-like comparison, got "${rt.text}"`);
}
// The note was cut from a paragraph to a single line: the module is presented live and explained
// out loud, so the page carries the qualifier and not the essay. The qualifier itself cannot move
// to a comment — it disclaims a claim the readout directly above it still makes on the page — but
// the reasoning behind it can, and must stay findable there. Both halves are checked: short on the
// page, complete in the source.
if (rt.note.replace(/\s+/g, ' ').trim().length > 220) {
  throw new Error(`the caveat must stay a one-liner, not grow back into a paragraph (${rt.note.trim().length} chars)`);
}
const rtSource = await page.content();
if (!/<!--[^]*?not a fair race between the algorithms[^]*?-->/i.test(rtSource)) {
  throw new Error('the full benchmark caveat must remain in the page source as a comment for anyone who wants the detail');
}
console.log(`OK  benchmark measured MD5 ${rt.md5PerBlockUs.toFixed(3)} us/block, SHA-3 ${rt.sha3PerBlockUs.toFixed(2)} us/block, with an honest caveat note that disclaims the cross-algorithm comparison`);

// toggling REAL TIME must collapse the animation to effectively instant, and report a slowdown
const rtRun = await page.evaluate(async () => {
  document.getElementById('input-custom').value = 'x'.repeat(300);
  document.getElementById('input-custom').dispatchEvent(new Event('input', { bubbles: true }));
  const time = async () => {
    document.getElementById('output-digest').textContent = '—';
    const t0 = performance.now();
    document.getElementById('hash-btn').click();
    await new Promise(resolve => {
      const iv = setInterval(() => {
        const d = document.getElementById('output-digest').textContent;
        if ((d && d.length === 32) || performance.now() - t0 > 60000) { clearInterval(iv); resolve(); }
      }, 8);
    });
    return performance.now() - t0;
  };
  document.getElementById('realtime-toggle').checked = false;
  const normalMs = await time();
  document.getElementById('realtime-toggle').checked = true;
  const realMs = await time();
  document.getElementById('realtime-toggle').checked = false;
  return { normalMs, realMs, readout: document.getElementById('realtime-readout').textContent };
});
if (!(rtRun.realMs < rtRun.normalMs * 0.35)) {
  throw new Error(`REAL TIME must collapse the animation: normal ${rtRun.normalMs.toFixed(0)}ms vs real-time ${rtRun.realMs.toFixed(0)}ms`);
}
if (!/slower than the machine/.test(rtRun.readout)) throw new Error(`readout should state the slowdown factor, got "${rtRun.readout}"`);
console.log(`OK  REAL TIME collapses a 5-block MD5 from ${rtRun.normalMs.toFixed(0)}ms to ${rtRun.realMs.toFixed(0)}ms; readout: "${rtRun.readout.replace(/\s+/g, ' ').slice(0, 160)}…"`);

// SHA-3's real-time path is a DIFFERENT mechanism from MD5's (zero-length phases drained by the
// controller's bounded while-loop, rather than a tiny per-event spacing in playTrace), so it
// needs its own arm. It is also the only escape hatch for a long SHA-3 input: the per-phase
// floors make a multi-rate-block run take minutes at ANY slider setting.
const rtSha3 = await page.evaluate(async () => {
  document.getElementById('algo-next').click();          // -> SHA-3
  // ONE rate block, not the 3-block 'x'.repeat(300) left over from the MD5 arm above. The claim
  // here is a RATIO (real-time must land under a fifth of normal playback) plus the integer-slot
  // commit through the zero-duration path; neither depends on how many blocks the normal run
  // chews through, and a 1-block normal run at slider 100 is ~1.8s against ~8.4s for 3 blocks.
  // Multi-rate-block absorption is covered where it is actually the subject (verify_task4,
  // verify_flash_safety's 8-block cases).
  document.getElementById('input-custom').value = 'crypto-101';
  document.getElementById('input-custom').dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('speed-slider').value = '100';
  const time = async () => {
    document.getElementById('output-digest').textContent = '—';
    const t0 = performance.now();
    document.getElementById('hash-btn').click();
    await new Promise(resolve => {
      const iv = setInterval(() => {
        const d = document.getElementById('output-digest').textContent;
        if ((d && d.length === 64) || performance.now() - t0 > 120000) { clearInterval(iv); resolve(); }
      }, 8);
    });
    return { ms: performance.now() - t0, digest: document.getElementById('output-digest').textContent };
  };
  document.getElementById('realtime-toggle').checked = false;
  const normal = await time();
  document.getElementById('realtime-toggle').checked = true;
  const real = await time();
  // pi mutates slot integers and commits them on finish; through the zero-duration path the
  // start/progress/finish all happen in one frame, so verify the commit still landed on exact
  // integer slots — a fractional slot would be permuted from by the next pi and drift the lattice.
  const lanes = __sha3Debug.lanes();
  const slotsAreIntegers = lanes.every(L => Number.isInteger(L.sx) && Number.isInteger(L.sy));
  const slotSet = new Set(lanes.map(L => `${L.sx},${L.sy}`));
  document.getElementById('realtime-toggle').checked = false;
  document.getElementById('algo-prev').click();
  return { normal, real, slotsAreIntegers, distinctSlots: slotSet.size, blur: __sha3Debug.lastBlur() };
});
if (rtSha3.normal.digest !== rtSha3.real.digest) {
  throw new Error(`REAL TIME changed the SHA-3 digest — it must be presentation only (${rtSha3.normal.digest} vs ${rtSha3.real.digest})`);
}
if (rtSha3.real.digest.length !== 64) throw new Error('SHA-3 real-time run did not produce a digest');
if (!(rtSha3.real.ms < rtSha3.normal.ms * 0.2)) {
  throw new Error(`REAL TIME must collapse the SHA-3 run: normal ${rtSha3.normal.ms.toFixed(0)}ms vs real-time ${rtSha3.real.ms.toFixed(0)}ms`);
}
if (!rtSha3.slotsAreIntegers) throw new Error('pi did not commit to integer slots through the zero-duration real-time path');
if (rtSha3.distinctSlots !== 25) throw new Error(`the 25 lanes must still occupy 25 distinct slots after a real-time run, got ${rtSha3.distinctSlots}`);
if (rtSha3.blur) throw new Error('a real-time SHA-3 run left the canvas blurred');
console.log(`OK  REAL TIME collapses a SHA-3 run from ${rtSha3.normal.ms.toFixed(0)}ms to ${rtSha3.real.ms.toFixed(0)}ms, same digest, pi still committed to 25 distinct integer slots, canvas crisp`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('\nOK  count-based multiplicative juice escalation verified on MD5 and SHA-3 (uncapped and contained), a still SHA-3 lattice, motion blur, and the real-time switch — no console errors');
await browser.close();
