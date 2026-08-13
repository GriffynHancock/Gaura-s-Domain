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
// correct while no two lanes are co-located, which is what pi's transit arc exists to guarantee.
//
// THAT ARC IS NOW A RADIAL BLOOM IN THE X-Y PLANE, IN TWO STAGES, WITH NO LIFT, NO SHELF AND NO
// CAMERA ZOOM (see the SHA3_RAD_* block in the page). Every moving lane is displaced outward from
// the centre of the metacube by an amount proportional to how far it is about to travel, and then
// falls into its destination as one move; the old scheme translated the whole lattice up, fanned
// it into horizontal shelves, and closed the bloom in a separate third stage while the camera
// zoomed out under it. The separation assertions below were rewritten with it, and they are
// equivalent-or-stronger on every axis:
//
//   * The old build asserted separation only in the SLIDE regime (lift == 1), carving out the
//     ramps because vertical shelves necessarily pass through each other while they open. Radial
//     displacement from distinct integer slots does not, so the assertion here is GLOBAL over the
//     whole phase clock — a strictly larger claim.
//   * The old build proved the exact-zero family away with a scalar argument on one axis (the
//     shelf quantum, 3/25 of a cell, cannot cancel a whole-slot y offset for fewer than 25
//     lanes). This one ENUMERATES that family outright: while the bloom is open every lane is
//     parked at either its source or its destination slot, so the set of "both lanes stationary"
//     configurations is finite — 24 compositions x 300 pairs x 4 park combinations — and every
//     one of them is computed in closed form, on both axes.
//   * The old build measured only the CONTROLLER's positions. What is drawn past the governor's
//     trip point is the FOLLOWER's, which is a different curve; it is now measured too, and the
//     clearance floor that backstops it is asserted directly.
//
// Everything is measured by driving the page's own sha3PhaseProgress over a dense sweep of the
// phase clock and placing lanes with the page's own sha3LaneWorldXY — never by re-deriving that
// arithmetic here, and never by sampling computed style off a live animation (an automation tab
// backgrounds rAF, so that reads pre-animation values and lies).
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
   'const.SHA3_RAD_BASE', 'const.SHA3_RAD_GAIN', 'const.SHA3_RAD_TIE', 'const.SHA3_RAD_CLEARANCE',
   'const.SHA3_RAD_SWIRL', 'const.SHA3_RAD_HOLD', 'const.SHA3_LIFT_FLOOR_GAIN',
   'window.sha3AliasGeoTransit', 'window.sha3PhaseProgress', 'window.sha3PhaseDuration',
   'window.sha3ArmRadial', 'window.sha3LaneWorldXY', 'lane.radMag']);
await page.click('#algo-next');   // SHA-3
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();

const SLIDERS = [1, 10, 25, 50, 68, 75, 90, 100];
const measured = await page.evaluate((sliders) => {
  const order = ['theta', 'rho', 'pi', 'chi', 'iota'];
  const STEPS = 6000, EPS = 1e-4;

  const measure = (v, opts) => {
    const steps = (opts && opts.steps) || STEPS;
    document.getElementById('speed-slider').value = String(v);
    document.getElementById('speed-slider').dispatchEvent(new Event('input'));
    sha3.blocksDone = 0; sha3.roundsInBlock = 0;
    const durs = {}; let round = 0;
    for (const t of order) { durs[t] = sha3PhaseDuration(t); round += durs[t]; }

    // Arm a REAL pi transit — the true KECCAK_PI_LANE_MAP image of each lane's current slot, with
    // the radial bloom the page itself assigns (sha3ArmRadial, the shipped function) — then drive
    // the real sha3PhaseProgress. `keep` leaves the permuted arrangement in place afterwards, so
    // successive calls walk pi's COMPOSITION ORBIT: round 2 permutes pi(identity), round 3
    // permutes pi(pi(identity)), and so on. Each arrangement is a different source->destination
    // pairing AND a different set of travel distances (and so of radii), so measuring only the
    // identity arrangement would pin one of twenty-four distinct geometries.
    const save = sha3.lanes.map(L => [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift,
                                      L.radMag, L.radDirX, L.radDirY]);
    sha3.lanes.forEach(L => {
      L.prevSx = L.sx; L.prevSy = L.sy;
      const [nx, ny] = KECCAK_PI_LANE_MAP[L.sx][L.sy]; L.sx = nx; L.sy = ny;
      sha3ArmRadial(L);
    });
    // Every lane's world position at phase clock p, through the renderer's own placement
    // function. `rad` is the envelope times the lane's armed magnitude — exactly what
    // sha3Render draws when the position follower is transparent (posK == 1), which it is at
    // every speed up to and including the default.
    const posAt = p => { sha3PhaseProgress({ type: 'pi' }, p);
                         return sha3.lanes.map(L => sha3LaneWorldXY(L, L.fx, L.fy, L.lift * L.radMag)); };

    const start = new Array(sha3.lanes.length).fill(null);
    const end = new Array(sha3.lanes.length).fill(null);
    let maxSimul = 0, minSepSlide = Infinity, minSepAny = Infinity;
    let worstP = 0, worstPair = null;
    let slideBeforeLift = false, slideAfterLift = false;
    // ---- STAGE STRUCTURE. The motion is supposed to be exactly two stages: the rows push out
    // radially, then each row falls into place. The way a THIRD stage shows up in the data is
    // very specific, and both of its fingerprints are counted here rather than eyeballed:
    //   * `runs` counts direction changes in a lane's drawn RADIUS over the phase. One rise and
    //     one fall is 2. A close ramp bolted on after the slide makes the radius fall, flatten
    //     and fall again — which the old build did, and which shows up as a run count of 3+ (or,
    //     with a plateau in the middle, as a radius still non-zero after the lane has arrived).
    //   * `landedWithRad` counts samples where a lane has finished its slide (s == 1) but is
    //     still displaced. That is the "skewed position nearly back in place" the owner reported,
    //     stated numerically: it must be zero, at every sample, for every lane.
    const runs = sha3.lanes.map(() => ({ dir: 0, prev: -1, changes: 0 }));
    // The LARGEST displacement any lane still has once it has arrived. Reported as a magnitude
    // rather than a count because `s` is read back off the interpolated position with a tolerance
    // (EPS), so "arrived" is sampled a hair early and a correct build leaves a residue of order
    // EPS^2 there. A build with a separate close ramp leaves a fraction of a whole cell.
    let landedRad = 0;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const pos = posAt(p);
      // The shared stage-one ramp, read off the page's own published scalar. It USED to be
      // legible as any lane's `lift`, back when that was one shared number; `lift` is now
      // per-lane (it carries each lane's own fall-in too), so the ramp is published explicitly.
      const lifted = sha3.piBloom >= 1 - 1e-12;
      let inMotion = 0;
      sha3.lanes.forEach((L, k) => {
        const den = Math.abs(L.sx - L.prevSx) + Math.abs(L.sy - L.prevSy);
        if (den > 0) {
          const s = (Math.abs(L.fx - L.prevSx) + Math.abs(L.fy - L.prevSy)) / den;
          if (s > EPS && start[k] === null) start[k] = p;
          if (s >= 1 - EPS && end[k] === null && start[k] !== null) end[k] = p;
          const rad = L.lift * L.radMag;
          const R = runs[k];
          if (R.prev >= 0) {
            const d = Math.abs(rad - R.prev) < 1e-13 ? 0 : (rad > R.prev ? 1 : -1);
            if (d !== 0 && d !== R.dir) { R.changes++; R.dir = d; }
          }
          R.prev = rad;
          if (s >= 1 - EPS && rad > landedRad) landedRad = rad;
          if (s > EPS && s < 1 - EPS) {
            inMotion++;
            // A lane may only be SLIDING while the bloom is fully open. Below lift == 1 the
            // lattice is still packed, and two crossing lanes could interpenetrate.
            if (!lifted) { if (p < 0.5) slideBeforeLift = true; else slideAfterLift = true; }
          }
        }
      });
      if (inMotion > maxSimul) maxSimul = inMotion;
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
        if (d < minSepAny) { minSepAny = d; worstP = p; worstPair = [a, b]; }
        if (lifted && d < minSepSlide) minSepSlide = d;
      }
    }
    // REFINE. A sampled minimum is an upper bound on the true one: between two samples the pair
    // may pass closer than either sample saw. So ternary-search the closest pair's separation
    // around the sample that found it, and report the refined value. Without this the headline
    // number is a function of the step count rather than of the geometry.
    if (worstPair) {
      const sep = p => { const q = posAt(p);
        return Math.hypot(q[worstPair[0]][0] - q[worstPair[1]][0], q[worstPair[0]][1] - q[worstPair[1]][1]); };
      let lo = Math.max(0, worstP - 2 / steps), hi = Math.min(1, worstP + 2 / steps);
      for (let it = 0; it < 60; it++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (sep(m1) < sep(m2)) hi = m2; else lo = m1;
      }
      const refined = sep((lo + hi) / 2);
      if (refined < minSepAny) minSepAny = refined;
      if (refined < minSepSlide) minSepSlide = refined;
    }
    // THE EXACT-ZERO FAMILY, IN CLOSED FORM. A separation can only be exactly zero when both
    // lanes are stationary (a moving lane is on a continuous path and is at any given point only
    // instantaneously). While the bloom is open every lane is parked at either its source or its
    // destination slot, so the family is finite and can be enumerated rather than sampled.
    // The two states have DIFFERENT radii now, and that is the whole argument: a lane that has
    // not moved yet is at its source slot pushed out by its full radMag; a lane that has landed
    // is on its destination slot with nothing left. The dangerous pair is a landed lane sitting
    // on slot D and the lane whose SOURCE is D, and the waiting lane's own radMag is what
    // separates them.
    let minSepRest = Infinity;
    const parks = sha3.lanes.map(L => [[L.prevSx, L.prevSy, L.radMag], [L.sx, L.sy, 0]]);
    for (let a = 0; a < sha3.lanes.length; a++) for (let b = a + 1; b < sha3.lanes.length; b++) {
      for (const pa of parks[a]) for (const pb of parks[b]) {
        const A = sha3LaneWorldXY(sha3.lanes[a], pa[0], pa[1], pa[2]);
        const B = sha3LaneWorldXY(sha3.lanes[b], pb[0], pb[1], pb[2]);
        const d = Math.hypot(A[0] - B[0], A[1] - B[1]);
        if (d < minSepRest) minSepRest = d;
      }
    }
    // ...and the property the whole design is FOR: displacement tracks travel distance, and pi's
    // fixed point does not move at all.
    const travelMag = sha3.lanes.map(L => [Math.hypot(L.sx - L.prevSx, L.sy - L.prevSy), L.radMag]);
    const n = travelMag.length;
    const mt = travelMag.reduce((q, c) => q + c[0], 0) / n, mm = travelMag.reduce((q, c) => q + c[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [t, m] of travelMag) { sxy += (t - mt) * (m - mm); sxx += (t - mt) ** 2; syy += (m - mm) ** 2; }
    const radCorr = sxy / Math.sqrt(sxx * syy);
    const fixedLane = sha3.lanes.find(L => L.sx === L.prevSx && L.sy === L.prevSy);
    const fixedStill = !!fixedLane && fixedLane.radMag === 0 && fixedLane.sx === 0 && fixedLane.sy === 0;
    const maxRadMag = Math.max(...sha3.lanes.map(L => L.radMag));
    const minMoverMag = Math.min(...sha3.lanes.filter(L => L.radMag > 0).map(L => L.radMag));
    if (opts && opts.keep) {
      // settle on the new slots exactly as sha3FinishPhase does, ready for the next composition
      sha3.lanes.forEach(L => { L.fx = L.sx; L.fy = L.sy; L.lift = 0; });
    } else {
      sha3.lanes.forEach((L, i) => {
        [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.radMag, L.radDirX, L.radDirY] = save[i];
      });
    }

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
      minSepRest, radCorr, fixedStill, maxRadMag, minMoverMag,
      maxRuns: Math.max(...movers.map(k => runs[k].changes)), landedRad,
      groups: SHA3_PI_GROUPS, win: SHA3_PI_WIN,
    };
  };
  const res = sliders.map(v => measure(v));
  // THE COMPOSITION ORBIT — the same closest-approach measurement, but walked across all 24 of
  // pi's successive arrangements rather than the identity one alone. Coarser per arrangement
  // (the identity sweep above is the fine one); the claim is that no OTHER arrangement is worse.
  const orbitSave = sha3.lanes.map(L => [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift,
                                         L.radMag, L.radDirX, L.radDirY]);
  const orbit = [];
  for (let r = 0; r < 24; r++) orbit.push(measure(50, { steps: 1200, keep: true }));
  sha3.lanes.forEach((L, i) => {
    [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.radMag, L.radDirX, L.radDirY] = orbitSave[i];
  });
  const orbitStats = {
    rounds: orbit.length,
    minSepSlide: Math.min(...orbit.map(o => o.minSepSlide)),
    minSepAny: Math.min(...orbit.map(o => o.minSepAny)),
    minSepRest: Math.min(...orbit.map(o => o.minSepRest)),
    worstRound: orbit.reduce((a, o, i) => (o.minSepAny < orbit[a].minSepAny ? i : a), 0),
    maxSimul: Math.max(...orbit.map(o => o.maxSimul)),
    events: [...new Set(orbit.map(o => o.events))],
    slideOutsideLift: orbit.some(o => o.slideBeforeLift || o.slideAfterLift),
    minCorr: Math.min(...orbit.map(o => o.radCorr)),
    allFixedStill: orbit.every(o => o.fixedStill),
    maxRadMag: Math.max(...orbit.map(o => o.maxRadMag)),
    minMoverMag: Math.min(...orbit.map(o => o.minMoverMag)),
    maxRuns: Math.max(...orbit.map(o => o.maxRuns)),
    landedRad: Math.max(...orbit.map(o => o.landedRad)),
  };
  document.getElementById('speed-slider').value = '50';
  document.getElementById('speed-slider').dispatchEvent(new Event('input'));
  // Returned as an OBJECT, not an array with an extra property: page.evaluate serialises its
  // result as JSON, and JSON drops non-index properties hung off an array.
  return { rows: res, orbit: orbitStats };
}, SLIDERS);
const data = measured.rows;

const orbit = measured.orbit;
const by = Object.fromEntries(data.map(d => [d.slider, d]));
console.log('\nslider  piMs   pi%    q     f(gated)  events  maxSimul  spread   gapCV    sepAny   sepRest');
for (const d of data) {
  console.log(`${String(d.slider).padStart(5)}  ${d.piMs.toFixed(0).padStart(5)}  ${(d.piShare * 100).toFixed(1)}%  ` +
    `${d.rateQ.toFixed(2).padStart(5)}  ${d.gateF.toFixed(3).padStart(7)}  ${String(d.events).padStart(5)}  ` +
    `${String(d.maxSimul).padStart(7)}  ${d.startSpreadMs.toFixed(1).padStart(7)}ms  ${d.gapCv.toFixed(3)}  ${d.minSepAny.toFixed(5)}  ${d.minSepRest.toFixed(5)}`);
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
//  4. THE DEPTH SORT'S PRECONDITION — no two boxes ever co-located, radial-bloom edition
// ============================================================================================
check('no lane ever slides while the bloom is still opening or already closing',
      data.every(d => !d.slideBeforeLift && !d.slideAfterLift),
      'every group window satisfies RISE <= t0 < t1 <= 1');
// GLOBAL, not carved out to the slide regime. The scheme this replaces could only claim
// separation while its shelves were fully open, because opening shelves cross each other by
// construction. Radial displacement from distinct integer slots does not, so the claim here
// covers the whole phase clock — ramps included — and is strictly stronger than its predecessor.
check('two lanes are never co-located at ANY point of the phase, at any slider position',
      data.every(d => d.minSepAny > 0.02),
      `closest approach across the whole slider: ${Math.min(...data.map(d => d.minSepAny)).toFixed(5)} world units ` +
      `(SHA3_CELL = 1.0; the vertical-shelf design this replaces managed 0.0113, and hit exactly 0 ` +
      `under the old SHA3_LIFT_SPREAD of 3.0)`);
// ...and across ALL 24 of pi's arrangements, not just the one the lattice starts in. pi composes,
// so each round presents a different source->destination pairing and a different set of radii.
check('...and that holds for every one of pi\'s 24 successive arrangements, not just the first',
      orbit.rounds === 24 && orbit.minSepAny > 0.02 && orbit.maxSimul <= 10 &&
      orbit.events.length === 1 && !orbit.slideOutsideLift,
      `worst closest approach over the whole composition orbit: ${orbit.minSepAny.toFixed(5)} world units ` +
      `(at composition ${orbit.worstRound + 1}/24); max in flight ${orbit.maxSimul}, start events ${orbit.events.join('/')}`);
// THE EXACT-ZERO FAMILY, ENUMERATED RATHER THAN SAMPLED. Only two STATIONARY lanes can be
// separated by exactly zero for more than an instant, and while the bloom is open every lane is
// parked at its source or its destination slot — a finite family, computed in closed form on both
// axes inside the page. This is the successor to the old scalar shelf-quantum argument, and it is
// the stronger one: that covered y alone and one lane-index spacing rule, this covers every pair,
// both axes, and all 24 compositions.
check('the exact-collision family is empty — no two PARKED lanes can ever share a world point',
      orbit.minSepRest > 0.05 && Math.min(...data.map(d => d.minSepRest)) > 0.05,
      `closest any two parked lanes come, over 24 compositions x 300 pairs x 4 park combinations: ` +
      `${orbit.minSepRest.toFixed(4)} world units`);
// The property the redesign exists for, asserted rather than eyeballed: the further a lane is
// about to travel, the further out of the metacube it bows — and pi's fixed point does not bow.
check('displacement magnitude tracks how far the lane is about to travel',
      orbit.minCorr > 0.95,
      `worst travel-vs-radius correlation over the orbit: r = ${orbit.minCorr.toFixed(4)}; ` +
      `radii run ${orbit.minMoverMag.toFixed(2)} (shortest hop) to ${orbit.maxRadMag.toFixed(2)} (longest) world units`);
check('lane (0,0), pi\'s only fixed point, never displaces at all',
      orbit.allFixedStill,
      'the one lane pi does not move has radMag exactly 0 in every composition');

// ============================================================================================
//  4b. THE MOTION IS TWO STAGES, AND NOTHING SCALES
// ============================================================================================
// The owner's report on the build this replaces: "you are currently going — radial explosion
// (with scaling) > falling in to a skewed position nearly back in place > falling back into place
// the rest of the way." Three defects in one sentence, and each gets its own assertion, because a
// single "pi looks better" check would pass on any number of wrong implementations.
//
// STAGE COUNT, stated as a property of the drawn radius rather than of the source. A lane's
// displacement rises once (the bloom), holds, and falls once (the lane's own fall-in) — two
// monotone runs. The third stage the owner saw was a SHARED close ramp that ran after every
// lane's slide had already finished, which necessarily produces either a third run or a lane
// sitting off-slot after it has arrived. Both are counted.
//
// ASSERTED OVER THE SLOW HALF AND THE DEFAULT, NOT THE FAST END, AND THAT IS NOT A LOOPHOLE. Past
// the geometric aliasing threshold the shared phase clock is deliberately folded (sha3AliasWarp),
// so p runs forward, stalls and backs up within a single phase — which necessarily makes the
// radius rise and fall more than once and puts a lane briefly back off a slot it had reached.
// That is the shutter effect, it is calibrated, and section 3 above asserts it is still alive. It
// is a property of the CLOCK, not of the motion's shape: the shape is a function of p, and these
// checks pin the shape everywhere the clock is the identity. Both are also checked over the whole
// composition orbit, which is measured at the default slider.
const SLOWD = data.filter(d => d.gateF === 1);
check('pi resolves in exactly two stages: one push out, then one fall in',
      orbit.maxRuns === 2 && SLOWD.length >= 4 && SLOWD.every(d => d.maxRuns === 2),
      `the drawn radius has ${orbit.maxRuns} monotone runs per lane over all 24 compositions ` +
      `(2 = one rise, one fall; the three-stage build had a separate close ramp after the slide)`);
check('no lane ever finishes its slide while still displaced (the "skewed near-final pose" is gone)',
      orbit.landedRad < 1e-6 && SLOWD.every(d => d.landedRad < 1e-6),
      `largest displacement still on an arrived lane: ${orbit.landedRad.toExponential(2)} world units ` +
      `(the three-stage build left up to ${1.43.toFixed(2)} — a whole lane's radius — to be cleaned ` +
      `up afterwards by the close ramp)`);
// NOTHING SCALES. Sampled off the live renderer during a real run — sha3Render publishes the
// scale it drew each frame — rather than off the source, so a zoom reintroduced anywhere in the
// projection path is caught. Sampled from a rAF loop in the page (the automation tab backgrounds
// rAF, so a computed-style read at an arbitrary moment would be reading a pre-animation value).
await page.locator('#speed-slider').evaluate(el => { el.value = '30'; el.dispatchEvent(new Event('input')); });
await page.fill('#input-custom', 'pi-scale');
await page.evaluate(() => {
  window.__camSamples = [];
  const tick = () => {
    if (sha3.running && sha3.active && sha3.active.type === 'pi') window.__camSamples.push(sha3.camScale);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.click('#hash-btn');
// Enough frames to cover several whole pi phases at this slider, then read; there is no need to
// sit through all 24 rounds, and `polling` is set explicitly because the default rAF polling is
// the one thing that cannot be relied on in a backgrounded automation tab.
await page.waitForFunction(() => window.__camSamples.length > 120, null, { timeout: 120000, polling: 250 });
const cam = await page.evaluate(() => {
  const s = window.__camSamples;
  return { n: s.length, distinct: [...new Set(s)].length, min: Math.min(...s), max: Math.max(...s) };
});
check('the camera does not zoom, scale or otherwise resize the assembly while pi runs',
      cam.distinct === 1 && cam.max - cam.min === 0,
      `${cam.n} frames sampled inside pi, ${cam.distinct} distinct cam.scale value(s) ` +
      `(${cam.min.toFixed(4)}); the build this replaces zoomed out by up to 20% in proportion to the bloom`);

// ---- THE FOLLOWER PATH, which is what is actually DRAWN once the governor trips --------------
// Past the governor's trip point sha3Render draws eased followers (rx, ry, rrad), not the
// controller's own targets, and that is a different curve — so measuring the controller alone
// would leave the fast end unasserted. Here the follower loop is run forward at a realistic frame
// time against the real phase clock, and the drawn positions are measured directly.
const follow = await page.evaluate(() => {
  const save = sha3.lanes.map(L => [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift,
                                    L.radMag, L.radDirX, L.radDirY, L.rx, L.ry, L.rrad]);
  let minSep = Infinity, minFloorSlack = Infinity, worstOffNoClear = 0;
  // tau chosen at the aggressive end of what the governor can ask for, and a 16.7ms frame
  const posTau = 90 * SHA3_POS_TAU_SCALE;
  const posK = 1 - Math.exp(-16.7 / posTau);
  for (let r = 0; r < 24; r++) {
    sha3.lanes.forEach(L => {
      L.prevSx = L.sx; L.prevSy = L.sy;
      const [nx, ny] = KECCAK_PI_LANE_MAP[L.sx][L.sy]; L.sx = nx; L.sy = ny;
      sha3ArmRadial(L);
    });
    for (let i = 0; i <= 400; i++) {
      sha3PhaseProgress({ type: 'pi' }, i / 400);
      // the shipped follower update, transcribed once (it lives inside sha3Render's frame loop
      // and cannot be called on its own) — kept adjacent to the constants it reads so a change
      // to SHA3_LIFT_FLOOR_GAIN or SHA3_RAD_CLEARANCE is picked up here automatically
      for (const L of sha3.lanes) {
        L.rx += (L.fx - L.rx) * posK;
        L.ry += (L.fy - L.ry) * posK;
        L.rrad += (L.lift * L.radMag - L.rrad) * posK;
        const off = Math.max(Math.abs(L.rx - L.fx), Math.abs(L.ry - L.fy));
        const floor = Math.min(1, off * SHA3_LIFT_FLOOR_GAIN) * SHA3_RAD_CLEARANCE;
        if (L.rrad < floor) L.rrad = floor;
        // the guarantee the floor exists to give: an off-slot lane is never left un-displaced
        if (off > 1 / SHA3_LIFT_FLOOR_GAIN) {
          minFloorSlack = Math.min(minFloorSlack, L.rrad - SHA3_RAD_CLEARANCE);
          if (L.rrad < SHA3_RAD_CLEARANCE - 1e-9) worstOffNoClear = Math.max(worstOffNoClear, off);
        }
      }
      const pos = sha3.lanes.map(L => sha3LaneWorldXY(L, L.rx, L.ry, L.rrad));
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
        if (d < minSep) minSep = d;
      }
    }
    sha3.lanes.forEach(L => { L.fx = L.sx; L.fy = L.sy; L.lift = 0; });
  }
  sha3.lanes.forEach((L, i) => {
    [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift,
     L.radMag, L.radDirX, L.radDirY, L.rx, L.ry, L.rrad] = save[i];
  });
  return { minSep, minFloorSlack, worstOffNoClear };
});
check('the DRAWN (follower) path keeps two boxes apart too, across all 24 compositions',
      follow.minSep > 0.02,
      `closest approach of the eased follower positions: ${follow.minSep.toFixed(5)} world units`);
check('the clearance floor is a guarantee: a lagging lane is always pushed the full SHA3_RAD_CLEARANCE out',
      follow.worstOffNoClear === 0 && follow.minFloorSlack >= -1e-9,
      `no lane ever lagged its target by more than 1/SHA3_LIFT_FLOOR_GAIN of a cell with less than the full clearance`);

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
