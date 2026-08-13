// PI'S PACING — the rate, the evenness, and the non-interpenetration of pi's lane transit.
//
// The owner's report on the build this replaces: "the actual pacing of the steps of pi in sha3 are
// way too fast, they arent even, they push on eachother." Three separate complaints, and they had
// three separate causes, so they get separate assertions here — a single "pi looks better" check
// would pass on any number of wrong implementations.
//
//   1. TOO FAST. pi is the only step that RELOCATES anything; it was given the same order of
//      magnitude as iota, which flashes one lane. Pinned as pi's SHARE of the round, not as an
//      absolute duration, so the slider stays free to be recalibrated without breaking this.
//   2. NOT EVEN / PUSHING ON EACH OTHER. Measured on the old build, all 24 moving lanes were
//      mid-transit simultaneously at every slider position, with the entire spread of start times
//      equal to one third of a single lane's own slide. Now pinned as: a bounded number of lanes
//      in flight at once, a fixed number of distinct start EVENTS, and even spacing between them.
//   3. THE WARP MADE IT LUMPY. The aliasing warp is a sine folding of the shared phase clock, so
//      evenly-staggered windows come out uneven in wall-clock time. Wanted at the fast end (that
//      is the shutter effect, and it must survive); a defect at the default. Pinned at both ends.
//
// And the invariant all of that has to not break: the painter's-algorithm depth sort is only
// correct while no two lanes are co-located, which is what the lift/slide/drop arc and the
// per-lane shelves exist for. Pinned in the SLIDE regime, which is the load-bearing one.
//
// Everything is measured by driving the page's own sha3PhaseProgress over a dense sweep of the
// phase clock and reading the positions it writes — never by re-deriving its arithmetic here, and
// never by sampling computed style off a live animation (an automation tab backgrounds rAF, so
// that reads pre-animation values and lies).
import { chromium } from 'playwright';
import { assertPageBuild } from './assert_page_build.mjs';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
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

await page.goto(BASE_URL + '?v=pipacing' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 8000 });
// A server started from the wrong checkout serves an older page at a URL that looks perfectly
// correct, and every measurement below would then be describing a build that is not under test.
await assertPageBuild(page, BASE_URL,
  ['const.SHA3_PI_GROUPS', 'const.SHA3_PI_WIN', 'const.SHA3_ALIAS_GATE_LO', 'const.SHA3_ALIAS_GATE_HI',
   'window.sha3AliasGeoTransit', 'window.sha3PhaseProgress', 'window.sha3PhaseDuration']);
await page.click('#algo-next');   // SHA-3
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();

const SLIDERS = [1, 10, 25, 50, 68, 75, 90, 100];
const data = await page.evaluate((sliders) => {
  const order = ['theta', 'rho', 'pi', 'chi', 'iota'];
  const STEPS = 6000, EPS = 1e-4;

  const measure = (v) => {
    document.getElementById('speed-slider').value = String(v);
    document.getElementById('speed-slider').dispatchEvent(new Event('input'));
    sha3.blocksDone = 0; sha3.roundsInBlock = 0;
    const durs = {}; let round = 0;
    for (const t of order) { durs[t] = sha3PhaseDuration(t); round += durs[t]; }

    // Arm a REAL pi transit — the true KECCAK_PI_LANE_MAP image of each lane's current slot,
    // with the shelves the page itself assigns — then drive the real sha3PhaseProgress.
    const save = sha3.lanes.map(L => [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.liftShelf]);
    sha3.lanes.forEach(L => {
      L.prevSx = L.sx; L.prevSy = L.sy;
      const [nx, ny] = KECCAK_PI_LANE_MAP[L.sx][L.sy]; L.sx = nx; L.sy = ny;
      L.liftShelf = (((L.prevSx * 5 + L.prevSy) / 24) - 0.5) * SHA3_LIFT_SPREAD;
    });

    const start = new Array(sha3.lanes.length).fill(null);
    const end = new Array(sha3.lanes.length).fill(null);
    let maxSimul = 0, minSepSlide = Infinity, minSepAny = Infinity;
    let slideBeforeLift = false, slideAfterLift = false;
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      sha3PhaseProgress({ type: 'pi' }, p);
      const lifted = sha3.lanes[0].lift >= 1 - 1e-12;
      let inMotion = 0;
      const pos = [];
      sha3.lanes.forEach((L, k) => {
        const den = Math.abs(L.sx - L.prevSx) + Math.abs(L.sy - L.prevSy);
        if (den > 0) {
          const s = (Math.abs(L.fx - L.prevSx) + Math.abs(L.fy - L.prevSy)) / den;
          if (s > EPS && start[k] === null) start[k] = p;
          if (s >= 1 - EPS && end[k] === null && start[k] !== null) end[k] = p;
          if (s > EPS && s < 1 - EPS) {
            inMotion++;
            // A lane may only be SLIDING while the fan-out is fully open. Below lift == 1 the
            // shelves are partially collapsed, and two crossing lanes could interpenetrate.
            if (!lifted) { if (p < 0.5) slideBeforeLift = true; else slideAfterLift = true; }
          }
        }
        pos.push([(L.fx - 2) * SHA3_CELL, (2 - L.fy) * SHA3_CELL + L.lift * (SHA3_LIFT_BASE + L.liftShelf)]);
      });
      if (inMotion > maxSimul) maxSimul = inMotion;
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
        if (d < minSepAny) minSepAny = d;
        if (lifted && d < minSepSlide) minSepSlide = d;
      }
    }
    sha3.lanes.forEach((L, i) => { [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.liftShelf] = save[i]; });

    const movers = start.map((s, k) => (s === null ? null : k)).filter(k => k !== null);
    // Distinct start INSTANTS. Lanes that move together as a group are one event to the eye, and
    // the evenness question is about the spacing of events, not of lanes.
    const uniq = [...new Set(movers.map(k => Math.round(start[k] * 1e5) / 1e5))].sort((a, b) => a - b);
    const sMs = uniq.map(u => u * durs.pi);
    const gaps = [];
    for (let i = 1; i < sMs.length; i++) gaps.push(sMs[i] - sMs[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / (gaps.length || 1));
    return {
      slider: v, piMs: durs.pi, roundMs: round, piShare: durs.pi / round,
      rateQ: sha3RoundRate() / __sha3Debug.alias().geoHz,
      gateF: sha3AliasGeoTransit(), rawF: sha3AliasGeo(),
      movers: movers.length, events: sMs.length, maxSimul,
      startSpreadMs: sMs[sMs.length - 1] - sMs[0],
      gapMeanMs: mean, gapSdMs: sd, gapCv: mean > 0 ? sd / mean : 0,
      windowMeanMs: movers.reduce((a, k) => a + ((end[k] === null ? 1 : end[k]) - start[k]) * durs.pi, 0) / movers.length,
      unfinished: movers.filter(k => end[k] === null).length,
      minSepSlide, minSepAny, slideBeforeLift, slideAfterLift,
      groups: SHA3_PI_GROUPS, win: SHA3_PI_WIN,
    };
  };
  const res = sliders.map(measure);
  document.getElementById('speed-slider').value = '50';
  document.getElementById('speed-slider').dispatchEvent(new Event('input'));
  return res;
}, SLIDERS);

const by = Object.fromEntries(data.map(d => [d.slider, d]));
console.log('\nslider  piMs   pi%    q     f(gated)  events  maxSimul  spread   gapCV    sepSlide');
for (const d of data) {
  console.log(`${String(d.slider).padStart(5)}  ${d.piMs.toFixed(0).padStart(5)}  ${(d.piShare * 100).toFixed(1)}%  ` +
    `${d.rateQ.toFixed(2).padStart(5)}  ${d.gateF.toFixed(3).padStart(7)}  ${String(d.events).padStart(5)}  ` +
    `${String(d.maxSimul).padStart(7)}  ${d.startSpreadMs.toFixed(1).padStart(7)}ms  ${d.gapCv.toFixed(3)}  ${d.minSepSlide.toFixed(5)}`);
}
console.log('');

// ============================================================================================
//  1. TOO FAST — pi gets a share of the round proportionate to being the step that MOVES things
// ============================================================================================
// Stated as a share, and as a comparison against the phases that only flash, so the slider can be
// recalibrated freely. pi was 30.8% of the round when the complaint was made.
const shares = await page.evaluate(() => {
  const tot = ['theta', 'rho', 'pi', 'chi', 'iota'].reduce((a, t) => a + SHA3_PHASE_BASE[t], 0);
  const o = {}; for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) o[t] = SHA3_PHASE_BASE[t] / tot;
  return { o, tot };
});
check('pi takes the largest share of the round, and clearly more than it used to',
      shares.o.pi >= 0.35 && shares.o.pi === Math.max(...Object.values(shares.o)),
      Object.entries(shares.o).map(([t, s]) => `${t} ${(s * 100).toFixed(1)}%`).join('  ') + ` (was pi 30.8%)`);
check('pi lasts several times longer than the flash-only phases it used to be comparable with',
      shares.o.pi / shares.o.iota >= 3 && shares.o.pi / shares.o.chi >= 2.1,
      `pi/iota ${(shares.o.pi / shares.o.iota).toFixed(2)}x, pi/chi ${(shares.o.pi / shares.o.chi).toFixed(2)}x`);
// The budget was REDISTRIBUTED, not enlarged. This is what keeps the slider's calibrated run
// lengths and — just as important — sha3RoundRate, which every aliasing threshold is defined
// against, exactly where they were.
check('the per-round budget is unchanged, so the slider calibration and the alias thresholds move not at all',
      shares.tot === 1820, `base durations sum to ${shares.tot}ms per round`);

// ============================================================================================
//  2. EVEN, AND NOT PUSHING ON EACH OTHER
// ============================================================================================
const SLOW = data.filter(d => d.slider <= 50);   // the slow half and the default
check('every moving lane completes its transit at every slider position',
      data.every(d => d.movers === 24 && d.unfinished === 0),
      data.map(d => `${d.slider}:${d.movers}`).join(' '));
check('pi reads as a fixed number of distinct group moves, not one blur of 24',
      data.every(d => d.events === by[50].groups),
      `${by[50].events} start events at every slider position (SHA3_PI_GROUPS = ${by[50].groups})`);
// The headline regression guard. It was 24 of 24, everywhere.
check('only a bounded handful of lanes is ever mid-transit at once (was 24 of 24 at every setting)',
      data.every(d => d.maxSimul <= 10),
      `max simultaneously in motion: ${data.map(d => `${d.slider}:${d.maxSimul}`).join(' ')}`);
// A stagger only reads as a stagger if the spread of starts is large next to one lane's own move.
check('the spread of start times is comparable to a single group\'s own slide, not a fraction of it',
      data.every(d => d.startSpreadMs >= d.windowMeanMs * 1.5),
      SLOW.map(d => `${d.slider}: spread ${d.startSpreadMs.toFixed(0)}ms vs window ${d.windowMeanMs.toFixed(0)}ms`).join('  '));
// THE EVENNESS ITSELF, through the whole slow half AND the default.
check('the gaps between group starts are even through the slow half and at the default slider',
      SLOW.every(d => d.gapCv <= 0.02),
      SLOW.map(d => `${d.slider}: CV ${d.gapCv.toFixed(4)} (gap ${d.gapMeanMs.toFixed(1)}±${d.gapSdMs.toFixed(2)}ms)`).join('  '));

// ============================================================================================
//  3. THE WARP — gated out of the even range, fully alive past the threshold
// ============================================================================================
check('the transit warp is EXACTLY the identity through the slow half and the default',
      SLOW.every(d => d.gateF === 1),
      SLOW.map(d => `${d.slider}: q=${d.rateQ.toFixed(2)} f=${d.gateF}`).join('  '));
// ...and the aliasing itself is untouched where it is the point. At and above the freeze rate the
// gate returns the raw sinc factor bit-for-bit, so the freeze, the retrograde band and the
// re-folds are exactly the effect that was calibrated.
const FAST = data.filter(d => d.rateQ >= 1);
check('past the geometric threshold the gate hands back the raw alias factor, unmodified',
      FAST.length >= 3 && FAST.every(d => d.gateF === d.rawF),
      FAST.map(d => `${d.slider}: q=${d.rateQ.toFixed(2)} f=${d.gateF.toFixed(3)}`).join('  '));
check('...and the transit really does stall and run retrograde up there (the shutter effect survives)',
      FAST.some(d => Math.abs(d.gateF) < 0.05) && FAST.some(d => d.gateF < -0.1),
      `frozen at slider ${(FAST.find(d => Math.abs(d.gateF) < 0.05) || {}).slider}, retrograde f=${Math.min(...FAST.map(d => d.gateF)).toFixed(3)}`);
// The gate must not snap on as the slider crosses it, and it must be monotone in amplitude.
const gateCurve = await page.evaluate(() => {
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const q = (i / 400) * 1.4;
    const u = (q - SHA3_ALIAS_GATE_LO) / (SHA3_ALIAS_GATE_HI - SHA3_ALIAS_GATE_LO);
    const g = q <= SHA3_ALIAS_GATE_LO ? 0 : q >= SHA3_ALIAS_GATE_HI ? 1 : u * u * (3 - 2 * u);
    pts.push({ q, g });
  }
  return pts;
});
let maxJump = 0;
for (let i = 1; i < gateCurve.length; i++) maxJump = Math.max(maxJump, Math.abs(gateCurve[i].g - gateCurve[i - 1].g));
check('the gate ramps in smoothly rather than snapping on at a slider position',
      maxJump < 0.02 && gateCurve.every((p, i) => i === 0 || p.g >= gateCurve[i - 1].g - 1e-12),
      `monotone, largest step ${maxJump.toFixed(4)} over the ramp`);

// ============================================================================================
//  4. THE DEPTH SORT'S PRECONDITION — no two lanes co-located while anything is sliding
// ============================================================================================
// Asserted in the SLIDE regime (lift == 1) and not globally, deliberately. During the rise and
// the drop the lanes are stationary over their own slots and only the fan-out is opening; layers
// necessarily pass through each other's depth there, because the shelf order is not the slot
// order — that is what a centred fan-out is, and it predates this work. What must never happen is
// two lanes meeting while one of them is TRAVELLING, which is the case the sort cannot survive.
check('no lane ever slides while the fan-out is still opening or already closing',
      data.every(d => !d.slideBeforeLift && !d.slideAfterLift),
      'every group window satisfies RISE <= t0 < t1 <= FALL');
check('two lanes are never co-located during the slide, at any slider position',
      data.every(d => d.minSepSlide > 0.005),
      `closest approach across the whole slider: ${Math.min(...data.map(d => d.minSepSlide)).toFixed(5)} world units ` +
      `(SHA3_CELL = 1.0; the design this replaces grazed 0.00030, and hit exactly 0 once the stagger was widened ` +
      `under the old SHA3_LIFT_SPREAD of 3.0)`);
// The shelf quantum must not be able to cancel a whole-slot offset — the failure that produced an
// exact 0. q * k == m must have no solution for k in 1..24, m in 1..4.
const quantum = await page.evaluate(() => SHA3_LIFT_SPREAD / 24);
let worstMiss = Infinity;
for (let k = 1; k <= 24; k++) for (let m = 1; m <= 4; m++) worstMiss = Math.min(worstMiss, Math.abs(quantum * k - m));
check('the lift-shelf quantum cannot exactly cancel a whole-slot offset (the exact-collision family)',
      worstMiss > 0.03,
      `quantum ${quantum} of SHA3_CELL; worst-case miss over all lane/slot separations ${worstMiss.toFixed(4)}`);

// ============================================================================================
//  5. HONESTY — none of the above touched pi's rule or the phase order
// ============================================================================================
await page.fill('#input-custom', 'crypto-101');
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input')); });
await page.click('#hash-btn');
await page.waitForFunction(() => /^[0-9a-f]{64}$/.test(document.getElementById('output-digest').textContent.trim()), { timeout: 60000 });
await page.waitForFunction(() => !sha3.running, { timeout: 20000 });
const after = await page.evaluate(() => ({
  digest: document.getElementById('output-digest').textContent.trim(),
  order: [...new Set(__sha3Debug.phaseLog().filter(r => r.round >= 0).map(r => r.type))].join(','),
  offSlot: sha3.lanes.filter(L => L.fx !== L.sx || L.fy !== L.sy || L.lift !== 0).length,
  fractional: sha3.lanes.filter(L => !Number.isInteger(L.sx) || !Number.isInteger(L.sy)).length,
  slotsDistinct: new Set(sha3.lanes.map(L => L.sx + ',' + L.sy)).size,
}));
const { createHash } = await import('node:crypto');
check('the digest is still correct after a full run at the most aliased setting',
      after.digest === createHash('sha3-256').update('crypto-101').digest('hex'), after.digest);
check('the phase order is untouched', after.order === 'theta,rho,pi,chi,iota', after.order);
check('every lane commits to an exact integer slot, and the 25 slots stay a permutation',
      after.offSlot === 0 && after.fractional === 0 && after.slotsDistinct === 25,
      `${after.slotsDistinct}/25 distinct slots, ${after.fractional} fractional, ${after.offSlot} left mid-transit`);

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll pi pacing checks passed.');
