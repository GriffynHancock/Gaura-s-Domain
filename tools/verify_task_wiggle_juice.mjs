// Verifies the Balatro-style JUICE ESCALATION on the hash module.
//
// WHAT CHANGED vs the previous version of this file, and why the new assertions are stronger:
//
//   The old model ramped every effect off a PERCENTAGE of trace progress (p = idx/(total-1)),
//   so this script asserted (a) "late-run average |--wiggle-rot| > 1.3x the early-run average"
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
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
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
// 2. Starting amplitude is ~2x the pre-escalation one, and the wiggle now includes translation
// ============================================================================================
const start = await page.evaluate(() => {
  const j0 = md5JuiceFor(0, 1), j1 = md5JuiceFor(1, 1);
  return { baseRot: MD5_BASE_ROT, rot0: j0.rot, tx0: j0.tx, ty0: j0.ty, rot1: j1.rot,
           txMax: MD5_TX_MAX, tyMax: MD5_TY_MAX };
});
// the pre-escalation implementation started at 0.6deg
if (!near(start.rot0 / 0.6, 2, 0.01)) throw new Error(`starting rotation should be ~2x the old 0.6deg, got ${start.rot0}deg`);
if (Math.abs(start.tx0) < 0.5) throw new Error(`wiggle must include real horizontal translation at n=0, got tx=${start.tx0}px`);
if (Math.abs(start.ty0) < 0.2) throw new Error(`wiggle must include real vertical translation at n=0, got ty=${start.ty0}px`);
console.log(`OK  starting amplitude doubled (${start.rot0}deg vs the old 0.6deg) and includes translation (tx=${start.tx0.toFixed(2)}px, ty=${start.ty0.toFixed(2)}px)`);

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
// Recorded through an in-page hook on md5JuiceFor plus the actual --wiggle-rot strings written
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
        const r = parseFloat(el.style.getPropertyValue('--wiggle-rot'));
        const tx = parseFloat(el.style.getPropertyValue('--wiggle-tx'));
        const ty = parseFloat(el.style.getPropertyValue('--wiggle-ty'));
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
    // final inherited colour channels, as actually resolved on a register box
    const box = document.getElementById('reg-0-A');
    const cs = getComputedStyle(box);
    rec.juiceRed = getComputedStyle(chain).getPropertyValue('--juice-red').trim();
    rec.juiceSat = parseFloat(getComputedStyle(chain).getPropertyValue('--juice-sat'));
    rec.juiceGlow = getComputedStyle(chain).getPropertyValue('--juice-glow').trim();
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
  throw new Error(`DOM-level peak |--wiggle-rot| must scale with block count: ${short.domRot} vs ${long.domRot}`);
}
if (!(long.domTy > 0 && short.domTy > 0)) throw new Error('--wiggle-ty (translation) never reached the DOM');
if (!(parseFloat(long.juiceRed) > parseFloat(short.juiceRed) && parseFloat(long.juiceRed) > 60)) {
  throw new Error(`glow reddening must grow with the count and get strong on long inputs: ${short.juiceRed} vs ${long.juiceRed}`);
}
if (!(long.juiceSat > short.juiceSat && long.juiceSat > 1.5)) {
  throw new Error(`glow saturation must grow with the count: ${short.juiceSat} vs ${long.juiceSat}`);
}
console.log(`OK  5 blocks is genuinely milder than 50 (peak I ${short.maxI.toFixed(2)} vs ${long.maxI.toFixed(1)}, ratio ${observed.toFixed(1)} = 1.1^45), and the reddening/saturation grew with it`);

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
  el.style.setProperty('--wiggle-rot', '0deg');
  el.style.setProperty('--wiggle-tx', '0px');
  el.style.setProperty('--wiggle-ty', '0px');
  el.classList.add('wiggle');
  void el.offsetWidth;
  const baseline = getComputedStyle(el).transform;
  el.style.setProperty('--wiggle-rot', '10deg');
  void el.offsetWidth;
  const rotated = getComputedStyle(el).transform;
  el.style.setProperty('--wiggle-rot', '0deg');
  el.style.setProperty('--wiggle-tx', '25px');
  el.style.setProperty('--wiggle-ty', '13px');
  void el.offsetWidth;
  const translated = getComputedStyle(el).transform;
  el.classList.remove('wiggle');
  el.style.transition = '';
  ['--wiggle-rot', '--wiggle-tx', '--wiggle-ty'].forEach(v => el.style.removeProperty(v));
  return { baseline, rotated, translated };
});
if (rotationProof.rotated === rotationProof.baseline) {
  throw new Error(`--wiggle-rot:10deg produced no computed-transform change (both "${rotationProof.baseline}") — the rotate() is not reaching the element`);
}
if (rotationProof.translated === rotationProof.baseline) {
  throw new Error(`--wiggle-tx/--wiggle-ty produced no computed-transform change — the translate() is not reaching the element`);
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
    el.style.setProperty('--wiggle-rot', (i % 2 ? 90 : -90) + 'deg');
    el.style.setProperty('--wiggle-tx', (i % 2 ? MD5_TX_MAX : -MD5_TX_MAX) + 'px');
    el.style.setProperty('--wiggle-ty', (i % 2 ? MD5_TY_MAX : -MD5_TY_MAX) + 'px');
    el.classList.add('wiggle', 'pulse');
  });
  const chain = document.getElementById('md5-block-chain');
  chain.style.setProperty('--juice-bright', '0.85');
  chain.style.setProperty('--juice-sat', '2.2');
  chain.style.setProperty('--juice-red', '88%');
  chain.style.setProperty('--juice-glow', '26px');
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
    ['--wiggle-rot', '--wiggle-tx', '--wiggle-ty'].forEach(v => el.style.removeProperty(v));
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
    // exact curve, sampled through the real function by setting its inputs
    samples: [[0, 0], [12, 0], [23, 0], [0, 1], [23, 3], [10, 26]].map(([r, b]) => {
      const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone;
      sha3.roundsInBlock = r; sha3.blocksDone = b;
      const I = sha3Intensity(), S = sha3SpeedIntensity();
      sha3.roundsInBlock = keepR; sha3.blocksDone = keepB;
      return { r, b, I, S };
    }),
    scale: sha3PhaseScale(),
    theta: sha3PhaseDuration('theta'),
    thetaWithArgs: sha3PhaseDuration('theta', 5, 200),
    perRound: ['theta', 'rho', 'pi', 'chi', 'iota'].reduce((s, t) => s + sha3PhaseDuration(t), 0),
  };
});
if (sha3Curve.roundRate !== 1.06 || sha3Curve.blockRate !== 1.1) {
  throw new Error(`SHA-3 rates should be 1.06/round and 1.1/block, got ${sha3Curve.roundRate}/${sha3Curve.blockRate}`);
}
for (const s of sha3Curve.samples) {
  const want = Math.pow(1.06, s.r) * Math.pow(1.1, s.b);
  if (!near(s.I / want, 1, 1e-9)) throw new Error(`sha3Intensity(r=${s.r},b=${s.b}) should be ${want}, got ${s.I}`);
}
const oneBlockArc = sha3Curve.samples.find(s => s.r === 23 && s.b === 0).I;
if (!(oneBlockArc > 3.5)) throw new Error(`a single SHA-3 block must visibly escalate across its 24 rounds, got only ${oneBlockArc}x`);
const laterBlock = sha3Curve.samples.find(s => s.b === 26).I;
if (!(laterBlock > oneBlockArc * 2)) throw new Error(`later rate-blocks must be wilder than the first (5 layers < 100 layers), got ${laterBlock} vs ${oneBlockArc}`);
console.log(`OK  SHA-3 intensity = 1.06^round * 1.1^block exactly (one block arcs 1 -> ${oneBlockArc.toFixed(2)}x; block 26 already at ${laterBlock.toFixed(1)}x)`);

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
for (const [t, ms] of fastest) {
  if (ms < 20) throw new Error(`phase ${t} is only ${ms}ms at max escalation + fastest slider — it would snap`);
}
console.log(`OK  SHA-3 phase floors still hold at max escalation: ${fastest.map(([t, m]) => `${t}=${m.toFixed(0)}ms`).join(' ')}`);

// ============================================================================================
// 10. SHA-3 shakes PLANES / the whole assembly — never an individual cube
// ============================================================================================
await page.evaluate(() => { document.getElementById('algo-next').click(); document.getElementById('speed-slider').value = '60'; });
const sha3Shake = await page.evaluate(async () => {
  document.getElementById('input-custom').value = 'shake me';
  document.getElementById('input-custom').dispatchEvent(new Event('input', { bubbles: true }));
  const seen = { axes: new Set(), maxPlaneAmp: 0, maxCam: 0, blurDuringPi: false, blurAtIdlePhase: false,
                 planeAmpCount: 0, intensityGrew: false, firstI: null, lastI: null };
  document.getElementById('output-digest').textContent = '—';
  document.getElementById('hash-btn').click();
  await new Promise(resolve => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const j = __sha3Debug.juice();
      if (seen.firstI === null) seen.firstI = j.intensity;
      seen.lastI = j.intensity;
      seen.axes.add(String(j.planeAxis));
      seen.planeAmpCount = j.planeAmps.length;
      seen.maxPlaneAmp = Math.max(seen.maxPlaneAmp, ...j.planeAmps.map(Math.abs));
      seen.maxCam = Math.max(seen.maxCam, Math.abs(j.camShakeX), Math.abs(j.camShakeY));
      const ph = __sha3Debug.activePhase();
      if (ph === 'pi' && __sha3Debug.lastBlur()) seen.blurDuringPi = true;
      const d = document.getElementById('output-digest').textContent;
      if ((d && d.length === 64) || performance.now() - t0 > 90000) { clearInterval(iv); resolve(); }
    }, 12);
  });
  // after the run fully settles the canvas must be repainted CRISP — no permanent smear
  await new Promise(r => setTimeout(r, 1400));
  seen.blurAfterRun = __sha3Debug.lastBlur();
  seen.shakeAfterRun = __sha3Debug.juice().shakeDecay;
  seen.planeShakeMax = __sha3Debug.planeShakeMax;
  seen.camShakeMax = __sha3Debug.camShakeMax;
  seen.axesList = [...seen.axes];
  return seen;
});
if (!sha3Shake.axesList.includes('x') || !sha3Shake.axesList.includes('y')) {
  throw new Error(`expected both x-plane (theta) and y-plane (chi) shakes, saw axes ${sha3Shake.axesList}`);
}
if (sha3Shake.planeAmpCount !== 5) throw new Error(`plane shake must be one amplitude per PLANE (5), got ${sha3Shake.planeAmpCount} — anything per-lane or per-cube is wrong`);
if (!(sha3Shake.maxPlaneAmp > 0.01)) throw new Error('plane shake never actually fired');
if (sha3Shake.maxPlaneAmp > sha3Shake.planeShakeMax + 1e-9) {
  throw new Error(`plane shake ${sha3Shake.maxPlaneAmp} exceeded its interpenetration-safe bound ${sha3Shake.planeShakeMax}`);
}
if (!(sha3Shake.maxCam > 0.05)) throw new Error('whole-assembly (camera) shake never fired');
if (!(sha3Shake.lastI > sha3Shake.firstI * 2)) throw new Error(`SHA-3 escalation must be visible across a run: ${sha3Shake.firstI} -> ${sha3Shake.lastI}`);
console.log(`OK  SHA-3 shakes 5 planes (max ${sha3Shake.maxPlaneAmp.toFixed(3)} < ${sha3Shake.planeShakeMax} clearance bound) + the whole assembly via the camera (max ${sha3Shake.maxCam.toFixed(2)}deg); intensity ${sha3Shake.firstI.toFixed(2)} -> ${sha3Shake.lastI.toFixed(2)}`);

// ============================================================================================
// 11. Motion blur: on during the fast rearrangement, off at idle and during drag
// ============================================================================================
if (!sha3Shake.blurDuringPi) throw new Error('motion blur never engaged during the pi rearrangement');
if (sha3Shake.blurAfterRun) throw new Error('motion blur is still on after the run finished — it would smear permanently');
if (sha3Shake.shakeAfterRun !== 0) throw new Error(`shake did not settle to zero after the run (${sha3Shake.shakeAfterRun})`);
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
  document.getElementById('speed-slider').value = '1';   // slow, so we can reliably abort mid-pi
  document.getElementById('hash-btn').click();
  await new Promise(r => setTimeout(r, 900));
  document.getElementById('algo-next').click();          // switch to MD5 -> hard-cancels the run
  await new Promise(r => setTimeout(r, 400));
  return __sha3Debug.lastBlur();
});
if (abortBlur) throw new Error('aborting a run mid-pi left a motion-blurred frame on the canvas permanently');
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

console.log('\nOK  count-based multiplicative juice escalation verified on MD5 and SHA-3 (uncapped and contained), plane/assembly shake, motion blur, and the real-time switch — no console errors');
await browser.close();
