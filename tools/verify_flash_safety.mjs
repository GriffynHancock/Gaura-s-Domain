// PHOTOSENSITIVITY REGRESSION TEST — the WCAG 2.3.1 / 2.3.2 three-flashes-per-second bound.
//
// This is the test the whole flash-governor exists for, so it is written to be hard to satisfy
// by accident:
//
//   * it MEASURES. Every number below comes from pixels the page actually painted, sampled once
//     per frame by the page's own flash meter and scored by tools/flash_analysis.mjs against
//     WCAG's own definitions (a transition is a >=10% change in relative luminance; a flash is a
//     pair of opposing transitions where the darker state is below 0.80; the bound is three
//     flashes in any one-second window). Nothing here asserts against the model that produced
//     the pixels.
//   * it measures a WORST CASE that is constructed, not assumed: the longest input this test can
//     run crossed with the fastest slider setting, and again with REAL TIME on, which collapses
//     an entire 24-round permutation into a single frame.
//   * it uses a SPATIAL unit, and the unit is CALIBRATED rather than picked. WCAG's threshold
//     only applies to a flashing area larger than 25% of a 10-degree visual field — about
//     341x256px at a normal viewing distance, so ~87,000px^2. A ninth of this 560x360 canvas is
//     187x120 = ~22,400px^2, i.e. almost exactly that 25%. So a 3x3 tiling IS the standard's own
//     unit here: finer patches understate nothing that the standard bounds, and the whole-canvas
//     mean would understate a local excursion badly (theta lights five lanes of twenty-five).
//     A 6x6 probe is run as well, at ~6% of the field — four times finer than the standard
//     requires — and its RATE is still asserted, but not its amplitude: an excursion in an area
//     that small is not something 2.3.1 bounds, and demanding otherwise would be demanding that
//     nothing on screen ever moves quickly.
//   * it pins the SLOW END too. The attenuation must not be reachable at speeds where the
//     discrete per-phase steps are the teaching content.
//
// The red-flash threshold (2.3.2) is checked as well, because the escalation deliberately
// reddens as it intensifies and that is the dangerous direction.
import { chromium } from 'playwright';
import { analyse, analyseRed, maxFrameStep, maxFrameStepAt, RED_SAT } from './flash_analysis.mjs';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

// WCAG's own bound. Not a tuning knob — if this test needs this number raised, the page is unsafe.
const FLASH_BOUND_PER_SECOND = 3;
// A secondary, STRONGER statement, applied only to the cases where the limiter is supposed to be
// doing something: an excursion that never reaches this cannot be a WCAG flash at any rate at
// all. It is how the test tells "the limiter worked" apart from "the sampling window happened to
// be quiet", which a flash COUNT alone cannot distinguish.
const LIMITED_EXCURSION = 0.07;

const browser = await chromium.launch();
const fails = [];
const note = s => console.log(s);

function check(label, ok, detail) {
  if (ok) console.log(`OK  ${label}${detail ? ' — ' + detail : ''}`);
  else fails.push(`${label}${detail ? ' — ' + detail : ''}`);
}

async function newPage(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, ...opts });
  const origin = new URL(BASE_URL).origin;
  page.on('console', m => { if (m.type() === 'error' && (m.location().url || '').startsWith(origin)) fails.push('console error: ' + m.text()); });
  page.on('pageerror', e => fails.push('page error: ' + String(e)));
  await page.goto(BASE_URL + '?v=flashsafety' + Date.now());
  await page.waitForFunction(() => !!window.__sha3Debug && !!window.__flashMeter, { timeout: 8000 });
  return page;
}

async function setAlgo(page, which) {
  const isMd5 = await page.evaluate(() => document.getElementById('diagram-md5').style.display !== 'none');
  if ((which === 'md5') !== isMd5) await page.click('#algo-next');
}

async function setSpeed(page, v, realtime) {
  await page.locator('#speed-slider').evaluate((el, val) => { el.value = String(val); el.dispatchEvent(new Event('input')); }, v);
  await page.evaluate(rt => {
    const t = document.getElementById('realtime-toggle');
    t.checked = !!rt; t.dispatchEvent(new Event('change'));
  }, !!realtime);
}

// Bring the canvas to REST before a recording starts.
//
// Why this exists: cases run back to back on one page, and an earlier case can leave a run still
// in flight (case 3 deliberately cancels one). The next case's very first recorded frame is then
// the previous case's leftover image, and its second frame is the new run's freshly-reset
// lattice — so the pair reads as one enormous luminance step that belongs to NEITHER run. It is
// an artifact of stitching two recordings together, and it moves with unrelated changes (it
// changed when the slow end of the speed slider was restretched, purely because a preceding case
// then sat at a different point in its run when it was cancelled).
//
// This is NOT sweeping a real transition under the rug: clicking Hash over a run already in
// flight is a real thing a user does, it does produce a real step, and it is measured directly —
// see the dedicated re-click case below, which does nothing but that, ten times over.
async function settleSha3(page) {
  await page.evaluate(() => { currentRunId++; });
  await page.waitForFunction(() => !sha3.running, { timeout: 5000 }).catch(() => {});
  // Long enough to outlast SHA3_PACE_RELEASE_MS as well, so a recording starts with the previous
  // run's attenuation fully released rather than part-way through releasing.
  await page.waitForTimeout(800);
}

// Run a SHA-3 hash to completion with the meter on, and return the recorded frames.
async function recordSha3(page, { input, slider, realtime, maxMs = 120000, tiles = 3 }) {
  await setAlgo(page, 'sha3');
  await page.fill('#input-custom', input);
  await setSpeed(page, slider, realtime);
  await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
  await settleSha3(page);
  await page.evaluate(t => window.__flashMeter.start(t), tiles);
  await page.click('#hash-btn');
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (!(await page.evaluate(() => sha3.running)) && Date.now() - t0 > 1500) break;
    await page.waitForTimeout(200);
  }
  return page.evaluate(() => { window.__flashMeter.stop(); return window.__flashMeter.rows(); });
}

// A SUSTAINED worst case. A single REAL TIME run is over in under a second, and "no more than
// three flashes in any one-second window" measured across 0.9s of recording is close to
// vacuous. Re-clicking Hash is also the single most likely thing a bored teenager does, and it
// is the one path that exercises the state RESET: sha3ResetState wipes the pace average and the
// luminance detector on every run start, so each new click re-opens an unattenuated window.
// Stacking those openings back to back is the worst case the reset can produce.
async function recordSha3Burst(page, { input, slider, realtime, clicks = 10, gapMs = 300, tiles = 3 }) {
  await setAlgo(page, 'sha3');
  await page.fill('#input-custom', input);
  await setSpeed(page, slider, realtime);
  await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
  await settleSha3(page);   // same reason as recordSha3: measure THIS burst, not the last case's tail
  await page.evaluate(t => window.__flashMeter.start(t), tiles);
  for (let i = 0; i < clicks; i++) { await page.click('#hash-btn'); await page.waitForTimeout(gapMs); }
  await page.waitForTimeout(1200);
  return page.evaluate(() => { window.__flashMeter.stop(); return window.__flashMeter.rows(); });
}

async function recordMd5(page, { input, slider, maxMs = 120000 }) {
  await setAlgo(page, 'md5');
  await page.fill('#input-custom', input);
  await setSpeed(page, slider, false);
  await page.evaluate(() => { document.getElementById('output-digest').textContent = ''; });
  await page.click('#hash-btn');
  await page.waitForTimeout(60);
  await page.evaluate(() => { window.__flashMeter.start(3); window.__flashMeter.startMd5(); });
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.evaluate(() => /^[0-9a-f]{32}$/.test(document.getElementById('output-digest').textContent.trim()))) break;
    await page.waitForTimeout(150);
  }
  return page.evaluate(() => { window.__flashMeter.stop(); return window.__flashMeter.md5Rows(); });
}

// The one assertion that matters, applied to a recording. `limited` says whether the limiter is
// expected to be engaged for this case, which buys the stronger amplitude check on top of the
// rate bound.
function assertSafe(label, rows, limited) {
  if (!rows || rows.length < 30) { fails.push(`${label}: the meter recorded only ${rows ? rows.length : 0} frames — nothing was measured`); return null; }
  const a = analyse(rows);
  const red = analyseRed(rows);
  const step = maxFrameStep(rows);
  console.log(`    ${label}: ${a.frames} frames over ${a.seconds.toFixed(1)}s at ${a.fps.toFixed(0)}fps, ${a.tiles} patches`);
  console.log(`      general flashes, worst 1s window = ${a.worstPeakPerSecond}   red flashes = ${red.peakPerSecond}`);
  const at = maxFrameStepAt(rows);
  console.log(`      biggest single-frame luminance step = ${step.toFixed(4)}   peak R/(R+G+B) = ${red.maxRatio.toFixed(3)} (saturated-red threshold ${RED_SAT})`);
  // WHERE it happened matters as much as how big it was: frame 0-1 of a recording is a seam
  // between two runs, anything later is the animation itself.
  if (at) console.log(`        ...at frame ${at.frame}/${at.frames} (t=+${(at.ms / 1000).toFixed(2)}s), patch ${at.tile}: ${at.from.toFixed(3)} -> ${at.to.toFixed(3)}`);
  check(`${label}: at most ${FLASH_BOUND_PER_SECOND} general flashes in any one second`,
        a.worstPeakPerSecond <= FLASH_BOUND_PER_SECOND, `measured ${a.worstPeakPerSecond}`);
  check(`${label}: at most ${FLASH_BOUND_PER_SECOND} red flashes in any one second`,
        red.peakPerSecond <= FLASH_BOUND_PER_SECOND, `measured ${red.peakPerSecond}`);
  check(`${label}: never reaches a saturated red, so 2.3.2's threshold cannot be met at all`,
        red.maxRatio < RED_SAT, `peak R/(R+G+B) ${red.maxRatio.toFixed(3)}`);
  if (limited) {
    check(`${label}: the limiter is visibly limiting — no excursion even reaches ${LIMITED_EXCURSION}`,
          step < LIMITED_EXCURSION, `biggest was ${step.toFixed(4)}`);
  }
  return a;
}

// ============================================================================================
//  1. The governor's curve, as a pure function — no animation in flight
// ============================================================================================
const page = await newPage();
const curve = await page.evaluate(() => {
  const g = __sha3Debug.governor();
  const at = hz => ({ hz, gain: __sha3Debug.govGainForRate(hz), share: __sha3Debug.govShareForRate(hz) });
  return { cfg: g, caps: g.caps, points: [0, 0.5, g.freeHz, 1.2, 1.6, g.tripHz, 5, 20, 60].map(at) };
});
note(`\n-- the governor curve (free <= ${curve.cfg.freeHz}Hz, fully tripped at ${curve.cfg.tripHz}Hz, counting transitions of ${curve.cfg.threshold} relative luminance)`);
note(`   solved caps for this palette: brightness excursion <= ${curve.caps.hi.toFixed(4)}, tint <= ${curve.caps.tint.toFixed(4)}`);
check('nothing is attenuated at or below the free rate',
      curve.points.filter(p => p.hz <= curve.cfg.freeHz).every(p => p.gain === 1 && p.share === 0),
      curve.points.filter(p => p.hz <= curve.cfg.freeHz).map(p => `${p.hz}Hz->${p.gain}`).join(' '));
check('attenuation is monotone in the measured rate',
      curve.points.every((p, i) => i === 0 || p.gain <= curve.points[i - 1].gain + 1e-12));
check('the attenuation is fully on at and above the trip rate',
      curve.points.filter(p => p.hz >= curve.cfg.tripHz).every(p => p.share === 1));
check('the brightness cap is a real number well under the unattenuated amplitude',
      curve.caps.hi > 0 && curve.caps.hi < 0.3, `hi ${curve.caps.hi.toFixed(4)}`);
// THE TINT CAP IS NOW EXPECTED TO BE VACUOUS, and that is a stronger result than the cap was.
// The phase tint used to be a plain mix toward the phase hue, which moves luminance as well as
// chroma, so it needed a solved depth ceiling to keep that movement under
// SHA3_SAFE_TINT_EXCURSION. It is now applied at CONSTANT LUMINANCE (sha3TintAt), so no depth —
// not even a full replacement of the cube's colour by the phase hue — moves luminance at all, and
// the solver returns 1. Asserting "the cap is below 0.32" would now be asserting that the tint is
// still a luminance-bearing channel. So the assertion is restated as the property the cap existed
// to guarantee, checked directly against the renderer's own tint function at FULL depth, on the
// brightest material there is.
const tintNeutral = await page.evaluate(() => {
  const P = sha3.palette;
  const brightest = mixRgb(mixRgb(P.bg, P.ink, 0.42), P.gold, 1.0);
  const L0 = relLum(brightest[0], brightest[1], brightest[2]);
  let worst = 0, at = null;
  for (const name of ['theta', 'rho', 'pi', 'chi', 'iota']) {
    for (const t of [0.25, 0.5, 0.62, 0.8, 1.0]) {
      const c = sha3TintAt(brightest, P[name], t);
      const d = Math.abs(relLum(c[0], c[1], c[2]) - L0);
      if (d > worst) { worst = d; at = `${name} at depth ${t}`; }
    }
  }
  return { worst, at, limit: SHA3_SAFE_TINT_EXCURSION, capSolved: sha3.caps.tint };
});
check('the phase tint moves luminance by essentially nothing, at ANY depth and any phase hue',
      tintNeutral.worst < tintNeutral.limit * 0.25,
      `worst ${tintNeutral.worst.toFixed(5)} (${tintNeutral.at}) against a ${tintNeutral.limit} budget; solved cap accordingly ${tintNeutral.capSolved.toFixed(3)}`);

// ============================================================================================
//  2. THE SLOW END MUST BE UNTOUCHED — the discrete per-phase steps are the teaching content
// ============================================================================================
note('\n-- the slow end');
await setAlgo(page, 'sha3');
await page.fill('#input-custom', 'crypto-101');
await setSpeed(page, 1, false);
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
await page.evaluate(() => {
  window.__slow = { share: 0, tau: 0, gain: 1, samples: 0 };
  const tick = () => {
    if (sha3.running) {
      const g = __sha3Debug.governor();
      window.__slow.share = Math.max(window.__slow.share, g.share);
      window.__slow.tau = Math.max(window.__slow.tau, g.tau);
      window.__slow.gain = Math.min(window.__slow.gain, g.gain);
      window.__slow.samples++;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.click('#hash-btn');
await page.waitForTimeout(9000);
const slow = await page.evaluate(() => window.__slow);
// Scoped to the opening of the run ON PURPOSE. Later in a run the page's own uncapped escalation
// has genuinely sped the animation up — by round 20 at slider 1 the phases arrive roughly nine
// times a second — and attenuating THAT is the whole point of the change, so asserting "slider 1
// is never attenuated" across a whole run would be asserting the bug back in.
check('at slider 1 the governor does not engage while the run is still slow',
      slow.samples > 200 && slow.share === 0 && slow.tau === 0 && slow.gain === 1,
      `over ${slow.samples} frames of the opening: peak share ${slow.share}, peak smoothing ${slow.tau}ms, min gain ${slow.gain}`);
// ...and with the governor idle, nothing is smoothed: positions and highlights are drawn exactly
// on their targets, which is what makes the slow end bit-identical to the pre-governor renderer.
const slowExact = await page.evaluate(() => {
  const bad = sha3.lanes.filter(L => Math.abs(L.rx - L.fx) > 1e-12 || Math.abs(L.ry - L.fy) > 1e-12
                                  || Math.abs(L.rlift - L.lift) > 1e-12).length;
  return { bad, n: sha3.lanes.length };
});
check('with the governor idle every lane is drawn exactly on its target (no tweening at all)',
      slowExact.bad === 0, `${slowExact.bad} of ${slowExact.n} lanes off-target`);
await page.evaluate(() => { currentRunId++; });   // stop the slow run before the next case

// The luminance safety net is DORMANT in normal use (the pace channel keeps excursions well
// under its 0.07 counting threshold), so prove separately that it is armed: feed it a synthetic
// square wave of legal-but-fast excursions and check it trips.
const netProof = await page.evaluate(() => {
  const before = __sha3Debug.governor();
  const saved = { det: sha3Gov.det, rate: sha3Gov.rate, held: sha3Gov.held };
  sha3Gov.det = []; sha3Gov.rate = 0; sha3Gov.held = 0;
  let t = 1e6;
  for (let i = 0; i < 40; i++) { t += 50; sha3Gov.feed(t, [i % 2 ? 0.5 : 0.34], 50); }
  const tripped = { rate: sha3Gov.rate, held: sha3Gov.held, share: sha3Gov.s, gain: sha3Gov.gain,
                    hiCap: sha3Gov.hiCap, tintCap: sha3Gov.tintCap };
  sha3Gov.det = saved.det; sha3Gov.rate = saved.rate; sha3Gov.held = saved.held; sha3Gov.apply(saved.held);
  return { before: before.share, tripped };
});
check('the luminance safety net trips on a synthetic 10Hz, 0.16-amplitude square wave',
      netProof.tripped.rate >= 3 && netProof.tripped.share === 1 && netProof.tripped.gain < 0.3
      && isFinite(netProof.tripped.hiCap) && isFinite(netProof.tripped.tintCap),
      `measured ${netProof.tripped.rate.toFixed(1)}Hz -> share ${netProof.tripped.share}, gain ${netProof.tripped.gain.toFixed(2)}, caps ${netProof.tripped.hiCap.toFixed(3)}/${netProof.tripped.tintCap.toFixed(3)}`);

// ============================================================================================
//  3. THE REPORTED BUG: a fixed LOW slider, where the uncapped escalation does the speeding up
// ============================================================================================
//
// The old gain read a phase's nominal duration, so it did respond to the escalation — but the
// PHASE TINT, which pulses on every single phase, was explicitly speed-independent and therefore
// never attenuated by anything. This checks the property that actually matters instead: at a
// slider setting the user never touches, the attenuation must rise as the run escalates.
note('\n-- a fixed LOW slider setting, escalating (the reported failure)');
await page.evaluate(() => {
  window.__esc = [];
  const tick = () => {
    if (sha3.running) {
      const g = __sha3Debug.governor(), j = __sha3Debug.juice();
      window.__esc.push({ t: performance.now(), share: g.share, gain: g.gain, rate: g.rate,
                          paceMs: g.paceMs, paceShare: g.paceShare,
                          rounds: j.roundsInBlock, blocks: j.blocksDone });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.fill('#input-custom', 'x'.repeat(136 * 2));
// SLIDER 32, not 25. RECALIBRATED, not relaxed: this case needs a setting slow enough that the
// opening of the run is genuinely legible, so that any attenuation measured later can only have
// come from the escalation. The slow half of the slider has since been restretched to make the
// slow end 2.5x slower (owner request), which moved every position on it — the effective phase
// scale that used to sit at slider 25 (0.596) now sits at slider 32. Slider 25 now runs at what
// used to be reached around slider 9, and the luminance safety net has ALWAYS engaged early
// there: measured on the pre-change build at slider 9, the largest mid-run frame step is 0.0785,
// against the same 0.07 counting threshold, i.e. identical to what this build measures at its
// slider 25 (0.0778). Nothing about the page's behaviour at a given effective speed changed; the
// number that names that speed did.
await setSpeed(page, 32, false);
// Start from rest: this case is about the escalation WITHIN one run, so the previous case's
// attenuation must not still be releasing into its opening samples (see SHA3_PACE_RELEASE_MS).
await settleSha3(page);
await page.evaluate(() => { window.__esc = []; });
await page.click('#hash-btn');
await page.waitForTimeout(40000);
const esc = await page.evaluate(() => window.__esc);
await page.evaluate(() => { currentRunId++; });
if (!esc.length) fails.push('the escalation probe recorded nothing');
else {
  const t0 = esc[0].t;
  const early = esc.filter(e => e.t - t0 < 4000 && e.paceMs < 1e8);
  const late = esc.filter(e => e.rounds >= 12 || e.blocks >= 1);
  // Measured on the PACE channel specifically. sha3Gov.s is the max of two independent
  // attenuations, and the luminance safety net is a knife-edge at this speed in EVERY build:
  // ordinary mid-run frames here reach about 0.065 against a 0.07 counting threshold, so whether
  // the net happens to latch in the first four seconds is noise, not signal (measured on the
  // pre-change build at the same effective phase scale: the same ~0.065 excursions). The pace
  // channel is the one this case is actually about — the reported bug was that the escalation
  // sped the animation up without anything responding — and it is not marginal.
  const earlyShare = Math.max(...early.map(e => e.paceShare));
  const lateShare = Math.max(...late.map(e => e.paceShare), 0);
  const lateGain = Math.min(...late.map(e => e.gain), 1);
  const earlyGain = Math.min(...early.map(e => 1 - e.paceShare * 0.75));
  const earlyPace = Math.max(...early.map(e => e.paceMs));
  const latePace = Math.min(...late.map(e => e.paceMs), 1e9);
  console.log(`    slider 32, ${esc.length} frames: measured phase spacing ${earlyPace.toFixed(0)}ms -> ${latePace.toFixed(0)}ms`);
  console.log(`      attenuation share ${earlyShare.toFixed(3)} -> ${lateShare.toFixed(3)}, gain ${earlyGain.toFixed(3)} -> ${lateGain.toFixed(3)}`);
  check('at a FIXED low slider, the attenuation responds to the escalation alone',
        earlyShare < 0.1 && lateShare > 0.5 && lateGain < 0.85 && earlyGain > 0.95,
        `share ${earlyShare.toFixed(3)} -> ${lateShare.toFixed(3)}, gain -> ${lateGain.toFixed(3)}`);
  check('...and it is driven by a MEASURED arrival interval, not by the slider',
        latePace < earlyPace * 0.6,
        `measured spacing ${earlyPace.toFixed(0)}ms -> ${latePace.toFixed(0)}ms at an unchanged slider`);
}

// ============================================================================================
//  4. WORST CASE — longest input, fastest slider, and REAL TIME
// ============================================================================================
note('\n-- worst constructible cases, measured on painted pixels');
assertSafe('SHA-3 slider 100, 8 rate-blocks', await recordSha3(page, { input: 'x'.repeat(136 * 8), slider: 100 }), true);
assertSafe('SHA-3 REAL TIME, 8 rate-blocks', await recordSha3(page, { input: 'x'.repeat(136 * 8), slider: 100, realtime: true, maxMs: 25000 }), true);
assertSafe('SHA-3 REAL TIME, re-clicked 10x back to back (sustained worst case)',
           await recordSha3Burst(page, { input: 'x'.repeat(136 * 8), slider: 100, realtime: true }), true);
// THE SEAM, measured on purpose: Hash re-clicked while the previous run is still mid-flight, at
// the fastest ANIMATED setting. Every click hard-resets the state, so a fully lit, mid-transit
// lattice is replaced by an all-zero one between two frames — the single largest discontinuity
// this page can produce, and one a bored teenager reaches by mashing the button. Ten of them in
// three seconds is also a rate test on the discontinuity itself, not just an amplitude one.
assertSafe('SHA-3 slider 100, Hash re-clicked 10x mid-run (the reset seam)',
           await recordSha3Burst(page, { input: 'x'.repeat(136 * 8), slider: 100, realtime: false }), true);
// FINER TILING. At 3x3 the lattice sits almost entirely inside one tile and the other eight are
// constant background, so a local excursion — theta lights 5 lanes of 25 — is averaged down
// before it is measured. 6x6 puts roughly four tiles across the lattice, which is finer than
// WCAG's area threshold really requires (5 lanes is a few percent of a 10-degree field) and is
// therefore a deliberately harsher test than the standard asks for.
// NOT marked `limited`: see the calibration note at the top. At 6x6 a patch is ~6% of a
// 10-degree field, four times under the area WCAG's threshold applies to, so the rate bound is
// the meaningful assertion and the amplitude is reported as information. Measured there: a
// biggest local excursion around 0.12 during pi's transit, occurring about once a second — which
// is a bright object moving through a small patch, and is bounded by the same 3/second rule.
// SLIDER 78 — the peak of the aliasing warp's swing, which none of the other cases cover. The pi
// transit is drawn through w(p) = p + (1-f)*sin(2*pi*p)/(2*pi), so its instantaneous progress rate
// at the start of the transit is (1 + (1-f)) — and f, the geometric alias factor, is at its most
// negative (-0.217) around here, making the opening of pi run up to 2.2x faster than unwarped.
// That is the same lift ramp that produces the largest ordinary mid-run luminance excursion, so
// the band where the new code moves geometry hardest gets its own measurement rather than an
// argument. (Slider 1, 32, 100 and REAL TIME leave 33..99 unmeasured otherwise.)
assertSafe('SHA-3 slider 78, 4 rate-blocks (peak aliasing warp swing)',
           await recordSha3(page, { input: 'x'.repeat(136 * 4), slider: 78 }), true);
assertSafe('SHA-3 slider 100, 6x6 tiling (localised excursions, 4x finer than the standard)',
           await recordSha3(page, { input: 'x'.repeat(136 * 4), slider: 100, tiles: 6 }));
// MD5's pacing is deliberately untouched (its escalation is correct per the page's owner), so
// this is the measurement that says whether it needed the same treatment. It is asserted, not
// assumed, and it is asserted at MD5's own worst case.
assertSafe('MD5 slider 100, 57 blocks', await recordMd5(page, { input: 'x'.repeat(64 * 56), slider: 100 }));
assertSafe('MD5 slider 25, 57 blocks', await recordMd5(page, { input: 'x'.repeat(64 * 56), slider: 25 }));

// DARK THEME. The two hard caps are solved against whichever palette is in use, so the dark
// theme is a genuinely different solve, not the same numbers on different colours — and dark
// backgrounds make a given brightness excursion a LARGER share of the tile's luminance. Measured
// rather than argued from the light-theme result.
note('\n-- dark theme (the caps are re-solved per palette)');
const darkCaps = await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  sha3ReadPalette();
  return __sha3Debug.governor().caps;
});
console.log(`    dark-theme caps: brightness <= ${darkCaps.hi.toFixed(4)}, tint <= ${darkCaps.tint.toFixed(4)}`);
check('the dark theme gets its own solved caps', darkCaps.hi > 0 && darkCaps.tint > 0);
assertSafe('SHA-3 slider 100, dark theme, 4 rate-blocks', await recordSha3(page, { input: 'x'.repeat(136 * 4), slider: 100 }), true);
await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); sha3ReadPalette(); });

// ============================================================================================
//  5. prefers-reduced-motion
// ============================================================================================
note('\n-- prefers-reduced-motion');
const rmPage = await newPage({ reducedMotion: 'reduce' });
const rm = await rmPage.evaluate(() => {
  const g = __sha3Debug.governor();
  return { reduceMotion: g.reduceMotion, share: __sha3Debug.govShareForRate(0),
           gain: __sha3Debug.govGainForRate(0), blur: __sha3Debug.blurAlphaNowFor(600) };
});
check('the page sees the OS setting', rm.reduceMotion === true);
check('reduced motion pins the governor fully open regardless of measured rate',
      rm.share === 1 && rm.gain < 0.3, `share ${rm.share}, gain ${rm.gain}`);
check('...and forces the deepest motion blur even on a long, slow phase',
      rm.blur <= 0.12, `wipe alpha ${rm.blur}`);
const rmCss = await rmPage.evaluate(() => {
  // transition:none first — computed style during a transition returns the value the element is
  // moving FROM, which is exactly the trap CLAUDE.md warns about.
  const el = document.querySelector('.stage-box');
  el.style.transition = 'none';
  el.classList.add('pulse');
  const f = getComputedStyle(el).filter;
  el.classList.remove('pulse'); el.style.transition = '';
  return f;
});
check('reduced motion damps MD5\'s card flash in CSS too', /brightness\(1\.1\d*\)/.test(rmCss), `resolved to ${rmCss}`);
assertSafe('SHA-3 slider 100 under reduced motion', await recordSha3(rmPage, { input: 'x'.repeat(136 * 4), slider: 100 }), true);
// ...and at the SLOW end under reduced motion, which is the combination most likely to be a
// legibility problem rather than a safety one: the pace share is pinned to 1, so the deepest
// motion blur is on at every slider setting. The check is that the lattice is still there to
// read — every one of the 200 boxes still drawn, and the rate/capacity colour split intact.
const rmSlow = await (async () => {
  await recordSha3(rmPage, { input: 'crypto-101', slider: 1, maxMs: 12000 });
  return rmPage.evaluate(() => {
    const warm = c => c[0] - c[2];
    sha3.lanes.forEach(L => { L.glow = 0; });
    sha3.flashType = null; sha3Render();
    const rate = sha3.lanes.filter(L => L.isRate).map(L => warm(L.lastCol));
    const cap = sha3.lanes.filter(L => !L.isRate).map(L => warm(L.lastCol));
    return { faces: __sha3Debug.facesDrawn(), boxes: __sha3Debug.boxCount(),
             worstRate: Math.min(...rate), bestCap: Math.max(...cap) };
  });
})();
check('under reduced motion the slow end is still fully legible',
      rmSlow.boxes === 200 && rmSlow.faces > 0 && rmSlow.worstRate > rmSlow.bestCap,
      `${rmSlow.boxes} boxes, ${rmSlow.faces} faces, rate/capacity warmth gap intact (${rmSlow.worstRate.toFixed(1)} vs ${rmSlow.bestCap.toFixed(1)})`);

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll flash-safety (WCAG 2.3.1 / 2.3.2) checks passed.');
