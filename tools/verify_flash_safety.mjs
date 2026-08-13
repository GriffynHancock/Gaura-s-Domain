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
//   * it uses a SPATIAL unit. Patches are ninths of the diagram, not the whole-canvas mean (which
//     would understate a local excursion — theta lights five lanes of twenty-five) and not
//     individual elements (which would overstate: a travelling highlight is motion, not a
//     flashing area).
//   * it pins the SLOW END too. The attenuation must not be reachable at speeds where the
//     discrete per-phase steps are the teaching content.
//
// The red-flash threshold (2.3.2) is checked as well, because the escalation deliberately
// reddens as it intensifies and that is the dangerous direction.
import { chromium } from 'playwright';
import { analyse, analyseRed, maxFrameStep, RED_SAT } from './flash_analysis.mjs';

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

// Run a SHA-3 hash to completion with the meter on, and return the recorded frames.
async function recordSha3(page, { input, slider, realtime, maxMs = 120000 }) {
  await setAlgo(page, 'sha3');
  await page.fill('#input-custom', input);
  await setSpeed(page, slider, realtime);
  await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.__flashMeter.start(3));
  await page.click('#hash-btn');
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (!(await page.evaluate(() => sha3.running)) && Date.now() - t0 > 1500) break;
    await page.waitForTimeout(200);
  }
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
  console.log(`      biggest single-frame luminance step = ${step.toFixed(4)}   peak R/(R+G+B) = ${red.maxRatio.toFixed(3)} (saturated-red threshold ${RED_SAT})`);
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
check('the hard caps are real numbers well under the unattenuated amplitude',
      curve.caps.hi > 0 && curve.caps.hi < 0.3 && curve.caps.tint > 0 && curve.caps.tint < 0.32,
      `hi ${curve.caps.hi.toFixed(4)}, tint ${curve.caps.tint.toFixed(4)}`);

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
                          paceMs: g.paceMs, rounds: j.roundsInBlock, blocks: j.blocksDone });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.fill('#input-custom', 'x'.repeat(136 * 2));
await setSpeed(page, 25, false);
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
  const earlyShare = Math.max(...early.map(e => e.share));
  const lateShare = Math.max(...late.map(e => e.share), 0);
  const lateGain = Math.min(...late.map(e => e.gain), 1);
  const earlyGain = Math.min(...early.map(e => e.gain));
  const earlyPace = Math.max(...early.map(e => e.paceMs));
  const latePace = Math.min(...late.map(e => e.paceMs), 1e9);
  console.log(`    slider 25, ${esc.length} frames: measured phase spacing ${earlyPace.toFixed(0)}ms -> ${latePace.toFixed(0)}ms`);
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
// MD5's pacing is deliberately untouched (its escalation is correct per the page's owner), so
// this is the measurement that says whether it needed the same treatment. It is asserted, not
// assumed, and it is asserted at MD5's own worst case.
assertSafe('MD5 slider 100, 57 blocks', await recordMd5(page, { input: 'x'.repeat(64 * 56), slider: 100 }));
assertSafe('MD5 slider 25, 57 blocks', await recordMd5(page, { input: 'x'.repeat(64 * 56), slider: 25 }));

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

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll flash-safety (WCAG 2.3.1 / 2.3.2) checks passed.');
