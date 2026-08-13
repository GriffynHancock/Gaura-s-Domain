// TEMPORAL ALIASING (the wagon-wheel / strobe effect) on the SHA-3 animation.
//
// The owner's request: "counterintuitively, the colours should start slowing down after about 5x
// and then start speeding up again reversed, and then slow down again, as if it is going insanely
// fast and being seen through a shutter lens... the spinning and reordering would probably not go
// as fast before slowing down and gradually reversing, but the colour movement and the brightness
// might have a much higher limit and so go out of phase but that's ok... where the sha3 speed
// starts at default middle slider position is actually pretty much the limit."
//
// So there are four separate claims to pin, and they are separate on purpose — a single "it goes
// backwards somewhere" assertion would pass on any number of wrong implementations:
//
//   1. THE CURVE. Apparent rate rises with true rate, PEAKS, falls back through zero (apparently
//      frozen), goes negative (apparently reversed), and folds again. Asserted on the apparent
//      RATE, not on the ratio, because the ratio decaying is not the same statement.
//   2. THE CALIBRATION. Geometry peaks at the DEFAULT slider position, 50 — the owner's own
//      anchor for "pretty much the limit before it starts slowing down".
//   3. THE DIVERGENCE. Colour/brightness aliases substantially later than geometry, so the two go
//      out of phase across the top of the slider. This is wanted, not tolerated.
//   4. THE HONESTY. None of it touches the algorithm. Same digest, same phase order, lanes settle
//      on their TRUE slots, and the true rho rotation is recorded unscaled even when the drawn
//      one is retrograde. Plus the safety precondition of the depth sort: no two lanes may ever
//      be co-located, including at the most retrograde warp.
import { chromium } from 'playwright';
import crypto from 'node:crypto';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const INPUT = 'crypto-101';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
const fails = [];
const origin = new URL(BASE_URL).origin;
page.on('console', m => { if (m.type() === 'error' && (m.location().url || '').startsWith(origin)) fails.push('console error: ' + m.text()); });
page.on('pageerror', e => fails.push('page error: ' + String(e)));
const check = (label, ok, detail) => {
  if (ok) console.log(`OK  ${label}${detail ? ' — ' + detail : ''}`);
  else fails.push(`${label}${detail ? ' — ' + detail : ''}`);
};

await page.goto(BASE_URL + '?v=alias' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 8000 });
await page.click('#algo-next');   // SHA-3
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();

// ============================================================================================
//  1. THE CURVE, as a pure function of true rate — no animation in flight
// ============================================================================================
const curve = await page.evaluate(() => {
  const cfg = __sha3Debug.alias();
  const fs = cfg.geoHz;
  const pts = [];
  // Sweep true rate from stationary to three full folds of the geometric shutter.
  for (let i = 0; i <= 300; i++) {
    const r = (i / 100) * fs;
    const f = sha3AliasFactor(r, fs);
    pts.push({ r, f, apparent: r * f });
  }
  return { cfg, pts };
});
const A = curve.pts.map(p => p.apparent);
const fs = curve.cfg.geoHz;
// slow limit: drawn truthfully
check('at low true rates the apparent rate IS the true rate (nothing is distorted at the slow end)',
      curve.pts.slice(1, 11).every(p => Math.abs(p.f - 1) < 0.02),
      `factor stays within 2% of 1 up to ${curve.pts[10].r.toFixed(2)} rounds/s`);
// rise then fall
const peakIdx = A.indexOf(Math.max(...A));
check('apparent rate RISES to a peak, then falls (the aliasing threshold)',
      peakIdx > 5 && peakIdx < 100 && A.slice(0, peakIdx).every((v, i) => i === 0 || v >= A[i - 1] - 1e-12)
      && A[150] < A[peakIdx],
      `peak apparent ${A[peakIdx].toFixed(2)} rounds/s at true rate ${curve.pts[peakIdx].r.toFixed(2)} (shutter ${fs})`);
// through zero
const zero1 = curve.pts.findIndex((p, i) => i > peakIdx && p.apparent <= 0);
check('...then passes through ZERO — the motion appears frozen',
      zero1 > 0 && Math.abs(curve.pts[zero1].r - fs) < fs * 0.02,
      `apparent rate reaches 0 at true rate ${curve.pts[zero1].r.toFixed(2)} rounds/s (shutter ${fs})`);
// reversal
const minIdx = A.indexOf(Math.min(...A));
check('...then goes NEGATIVE — the motion appears to run backwards',
      A[minIdx] < 0 && curve.pts[minIdx].r > fs && curve.pts[minIdx].r < 2 * fs,
      `most retrograde apparent rate ${A[minIdx].toFixed(2)} rounds/s at true rate ${curve.pts[minIdx].r.toFixed(2)}`);
// folds again — and, importantly, the SWING DOES NOT DECAY. Index i of the sweep is true rate
// i/100 of a shutter period, so [100,200] is the first retrograde lobe and [200,300] the second
// forward one. The apparent rate must still reach nearly the full +-f_s/pi in the later lobes,
// otherwise the effect would fade out exactly where the escalation pushes the pace hardest.
const lobe2 = A.slice(100, 201);   // first retrograde lobe
const lobe3 = A.slice(200, 301);   // second forward lobe
check('...and it FOLDS AGAIN rather than settling (slow, reverse, slow again, repeatedly)',
      Math.min(...lobe2) < -0.8 * A[peakIdx] && Math.max(...lobe3) > 0.8 * A[peakIdx],
      `lobe swings: forward peak ${A[peakIdx].toFixed(2)}, retrograde ${Math.min(...lobe2).toFixed(2)}, forward again ${Math.max(...lobe3).toFixed(2)} rounds/s — the amplitude does not decay with speed`);

// ============================================================================================
//  2 + 3. CALIBRATION and DIVERGENCE, measured across the real slider
// ============================================================================================
const sweep = await page.evaluate(() => {
  const out = [];
  for (let v = 1; v <= 100; v++) {
    document.getElementById('speed-slider').value = String(v);
    const a = __sha3Debug.alias();
    out.push({ v, rate: a.roundRate, geo: a.geo, col: a.col,
               geoApp: a.roundRate * a.geo, colApp: a.roundRate * a.col });
  }
  document.getElementById('speed-slider').value = '50';
  return out;
});
const geoPeak = sweep.reduce((a, b) => (b.geoApp > a.geoApp ? b : a));
check('the GEOMETRIC aliasing threshold lands on the default slider position (the owner\'s anchor)',
      Math.abs(geoPeak.v - 50) <= 4,
      `apparent geometric motion peaks at slider ${geoPeak.v} (${geoPeak.geoApp.toFixed(2)} rounds/s of apparent motion from ${geoPeak.rate.toFixed(2)} real)`);
const geoFrozen = sweep.find(s => s.v > geoPeak.v && s.geo <= 0);
const geoReverse = sweep.filter(s => s.geo < -0.02);
check('above the default, apparent geometry slows, freezes and reverses',
      !!geoFrozen && geoReverse.length > 5,
      `frozen at slider ${geoFrozen && geoFrozen.v}, retrograde over ${geoReverse.length} slider positions (deepest factor ${Math.min(...sweep.map(s => s.geo)).toFixed(3)})`);
// The colour channel must still be tracking honestly where geometry has already folded.
const atGeoFreeze = sweep.find(s => s.v === (geoFrozen ? geoFrozen.v : 68));
check('COLOUR aliases LATER than geometry — it is still tracking where geometry has frozen',
      atGeoFreeze.col > 0.75,
      `at slider ${atGeoFreeze.v} the geometric factor is ${atGeoFreeze.geo.toFixed(3)} while the colour factor is still ${atGeoFreeze.col.toFixed(3)}`);
// "Colour has a higher limit than geometry" stated as the thing it actually means: colour's own
// aliasing threshold arrives much further up the slider than geometry's. NOT stated as "colour's
// factor is always the larger of the two" — once colour folds it can and does dip below
// geometry's later lobe, and that crossing is itself part of the two channels running out of
// step with each other.
const zeroGeo = sweep.find(s => s.geo <= 0);
const zeroCol = sweep.find(s => s.col <= 0);
const diverged = sweep.filter(s => s.v > 50 && Math.abs(s.col - s.geo) > 0.3);
check('the COLOUR shutter\'s limit is far higher up the slider than the GEOMETRIC one',
      zeroGeo && zeroCol && zeroCol.v - zeroGeo.v >= 15,
      `geometry first freezes at slider ${zeroGeo && zeroGeo.v}, colour not until slider ${zeroCol && zeroCol.v}`);
check('the two channels are visibly OUT OF PHASE across the fast half (this divergence is the point)',
      diverged.length > 20,
      `the two factors differ by more than 0.3 at ${diverged.length} of the 50 fast slider positions`);
check('colour reaches its own aliasing limit too, at the very top of the slider',
      sweep[99].col < 0.5,
      `at slider 100 the colour factor is ${sweep[99].col.toFixed(3)} (geometry ${sweep[99].geo.toFixed(3)})`);
console.log(`    slider ->  1: geo ${sweep[0].geo.toFixed(3)} col ${sweep[0].col.toFixed(3)} | 50: geo ${sweep[49].geo.toFixed(3)} col ${sweep[49].col.toFixed(3)} | 75: geo ${sweep[74].geo.toFixed(3)} col ${sweep[74].col.toFixed(3)} | 100: geo ${sweep[99].geo.toFixed(3)} col ${sweep[99].col.toFixed(3)}`);

// ============================================================================================
//  4a. THE WARP — exact endpoints, bounded, and NO TWO LANES EVER CO-LOCATED
// ============================================================================================
// pi's transit is the one aliased quantity that has to arrive somewhere exact, and the painter's
// -algorithm depth sort is only correct because boxes never interpenetrate. So: the warp's
// endpoints must be exact, and the warped transit must never put two lanes at the same place.
const warp = await page.evaluate(() => {
  const out = { ends: [], range: [], minSep: Infinity, minSepF: null };
  for (const f of [1, 0.5, 0, -0.3, -1]) {
    out.ends.push({ f, at0: sha3AliasWarp(0, f), at1: sha3AliasWarp(1, f) });
    let lo = 1, hi = 0;
    for (let i = 0; i <= 1000; i++) {
      const w = sha3AliasWarp(i / 1000, f);
      if (w < lo) lo = w; if (w > hi) hi = w;
    }
    out.range.push({ f, lo, hi });
  }
  // Replay pi's transit and measure the closest approach of any two lanes, in WORLD units,
  // exactly as sha3Render places them: x from the slot, y from the slot plus the transit lift
  // (which is where each lane's distinct liftShelf separates them). Done for a range of alias
  // factors, INCLUDING f = 1 — the unwarped transit that has always shipped — because f = 1 is
  // the control. The claim being tested is not "the warped transit clears some absolute margin"
  // (the un-warped one does not clear an arbitrary margin either; lanes pass each other closely
  // by design, held apart on the lift axis) but "the warp does not bring any two lanes closer
  // together than the design already does".
  const saveSlots = sha3.lanes.map(L => [L.sx, L.sy]);
  sha3.lanes.forEach(L => { L.prevSx = L.sx; L.prevSy = L.sy;
    const [nx, ny] = KECCAK_PI_LANE_MAP[L.sx][L.sy]; L.sx = nx; L.sy = ny;
    L.liftShelf = (((L.prevSx * 5 + L.prevSy) / 24) - 0.5) * SHA3_LIFT_SPREAD; });
  out.sep = {};
  // f = 1 is swept far more finely than the rest: it is the CONTROL, and the claim it has to
  // support is "every configuration the warp draws is one the unwarped transit already draws at
  // some other instant". That is true by construction — the whole configuration is a function of
  // the warped clock w alone, and w maps [0,1] into [0,1] — so a dense unwarped sweep must find
  // an approach at least as close as any warped one. A coarse control could miss it and turn a
  // proof into a coin flip.
  for (const f of [1, 0.5, 0, -0.22, -1]) {
    let minSep = Infinity;
    const steps = f === 1 ? 20000 : 600;
    for (let i = 0; i <= steps; i++) {
      const w = sha3AliasWarp(i / steps, f);
      // exactly what sha3PhaseProgress does, with the warped progress
      const RISE = 0.26, FALL = 0.74;
      const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const lift = w < RISE ? ease(w / RISE) : w < FALL ? 1 : 1 - ease((w - FALL) / (1 - FALL));
      const span = FALL - RISE;
      const pos = sha3.lanes.map((L, idx) => {
        const stag = (idx / sha3.lanes.length) * 0.26;
        const t0 = RISE + stag * span, t1 = FALL - (0.26 - stag) * span;
        const s = w <= t0 ? 0 : w >= t1 ? 1 : ease((w - t0) / (t1 - t0));
        const fx = L.prevSx + (L.sx - L.prevSx) * s, fy = L.prevSy + (L.sy - L.prevSy) * s;
        return [(fx - 2) * SHA3_CELL, (2 - fy) * SHA3_CELL + lift * (SHA3_LIFT_BASE + L.liftShelf)];
      });
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
        if (d < minSep) minSep = d;
      }
    }
    out.sep[f] = minSep;
  }
  sha3.lanes.forEach((L, i) => { L.sx = saveSlots[i][0]; L.sy = saveSlots[i][1];
    L.fx = L.sx; L.fy = L.sy; L.prevSx = L.sx; L.prevSy = L.sy; L.lift = 0; L.liftShelf = 0; });
  return out;
});
check('the aliasing warp has EXACT endpoints (pi still lands on its true slot)',
      warp.ends.every(e => e.at0 === 0 && Math.abs(e.at1 - 1) < 1e-12),
      warp.ends.map(e => `f=${e.f}: ${e.at0}->${e.at1.toFixed(12)}`).join('  '));
check('the warp stays inside the phase (never overshoots the transit)',
      warp.range.every(r => r.lo >= -1e-12 && r.hi <= 1 + 1e-12),
      warp.range.map(r => `f=${r.f}: [${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`).join('  '));
// No two lanes may ever be CO-LOCATED — that is the precondition the painter's-algorithm depth
// sort relies on, and it is what pi's staggered per-lane slide windows are for. Warping the
// SHARED phase clock (rather than each lane's own s) is what preserves it: the warped picture is
// a configuration the unwarped design already produces at some other instant.
const control = warp.sep['1'];
const worst = Math.min(...Object.entries(warp.sep).filter(([f]) => f !== '1').map(([, v]) => v));
check('two lanes are never exactly co-located under any alias factor',
      Object.values(warp.sep).every(v => v > 0),
      Object.entries(warp.sep).map(([f, v]) => `f=${f}: ${v.toFixed(5)}`).join('  '));
// Stated as a COMPARISON, not as an absolute margin, and deliberately so. Lanes swapping slots do
// pass very close during pi's transit — that is true of the unwarped design that has always
// shipped, and the thing that keeps the depth sort correct there is the staggered slide windows
// plus the per-lane lift shelves, not a wide clearance. The question the aliasing has to answer
// is only whether it makes that worse, and it cannot: the warp reparametrises the shared clock,
// so every frame it draws is a frame the unwarped transit also draws.
check('the warp draws no configuration the unwarped transit does not (no new near-collisions)',
      worst >= control - 1e-9,
      `closest approach over a full pi transit: unwarped ${control.toFixed(5)} world units (dense sweep), worst warped ${worst.toFixed(5)}`);

// ============================================================================================
//  4b. HONESTY — the algorithm is untouched at the most aliased setting
// ============================================================================================
await page.fill('#input-custom', INPUT);
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input')); });
await page.click('#hash-btn');
await page.waitForFunction(() => /^[0-9a-f]{64}$/.test(document.getElementById('output-digest').textContent.trim()), { timeout: 60000 });
await page.waitForFunction(() => !sha3.running, { timeout: 20000 });
const after = await page.evaluate(() => {
  const log = __sha3Debug.phaseLog().filter(r => r.round >= 0);
  const lanes = __sha3Debug.lanes();
  return {
    digest: document.getElementById('output-digest').textContent.trim(),
    order: log.map(r => r.type).join(','),
    rounds: new Set(log.map(r => r.round)).size,
    offSlot: sha3.lanes.filter(L => L.fx !== L.sx || L.fy !== L.sy || L.lift !== 0).length,
    fractional: sha3.lanes.filter(L => !Number.isInteger(L.sx) || !Number.isInteger(L.sy)).length,
    // the TRUE accumulated rho angle is kept unscaled alongside the drawn one
    spinTrueDistinct: new Set(sha3.lanes.map(L => Math.round(((L.spinTrue % 360) + 360) % 360))).size,
    drawnDiffersFromTrue: sha3.lanes.some(L => Math.abs(L.spinTarget - L.spinTrue) > 1),
    aliasAtEnd: __sha3Debug.alias(),
  };
});
const expected = crypto.createHash('sha3-256').update(INPUT).digest('hex');
check('the digest is unchanged by the aliasing', after.digest === expected, after.digest);
const wanted = Array.from({ length: 24 }, () => 'theta,rho,pi,chi,iota').join(',');
check('the phase ORDER is unchanged — theta, rho, pi, chi, iota, 24 times, forwards',
      after.order === wanted && after.rounds === 24, `${after.rounds} rounds recorded`);
check('every lane settles on its TRUE slot when the motion stops (aliasing is apparent only)',
      after.offSlot === 0 && after.fractional === 0,
      `${after.offSlot} lanes left off-slot, ${after.fractional} at fractional slots`);
check('the TRUE rho rotation is recorded unscaled, even while the drawn one is retrograde',
      after.spinTrueDistinct >= 5 && after.drawnDiffersFromTrue,
      `${after.spinTrueDistinct} distinct true rho angles across 25 lanes; drawn angle differs from true (alias factor ${after.aliasAtEnd.geo.toFixed(3)})`);

// The honesty note has to be ON THE PAGE, not just in the source: a student who sees the lattice
// counter-rotate must not be able to conclude that Keccak runs backwards.
const noteText = await page.evaluate(() => (document.getElementById('alias-note') || {}).textContent || '');
check('the page says in plain words that the apparent reversal is a shutter illusion',
      /alias|shutter|strobe/i.test(noteText) && /(never|not).*(backwards|reverse|back)/i.test(noteText),
      JSON.stringify(noteText.trim()));

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll SHA-3 temporal-aliasing checks passed.');
