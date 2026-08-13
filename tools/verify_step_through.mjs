// STEP MODE — breakpoints for the hash animations.
//
// The owner's ask: "there needs to be a step by step control for both md5 and sha3, sort of like
// breakpoints probably like a single subcycle of the wider algorithm ... I think the step 3
// should have step and a redo as in like going next and repeat the current loop, again sort of
// like break points."
//
// Four claims, and they are separate on purpose — "the buttons do something" would pass on
// several wrong implementations:
//
//   1. EXACTLY ONE. A STEP advances one sub-cycle, not two and not a burst. Measured on the
//      page's own recording of what actually fired (sha3.phaseLog for SHA-3, the step counter and
//      register values for MD5), never on a button's return value.
//   2. REDO REPLAYS WITHOUT ADVANCING. The same sub-cycle runs again from its start, the position
//      does not move, and — the part that is easy to get wrong — the STATE does not double-apply.
//      SHA-3's phases mutate permanently (pi permutes slots, rho accumulates spin), so a redo
//      that simply re-ran the phase would permute the lattice twice. The lattice after N steps
//      and R redos must equal the lattice after N steps and no redos.
//   3. THE READOUT IS TRUE. What the page says the position is must equal what the animation
//      actually did.
//   4. NOTHING GETS STUCK, AND NOTHING IS ORPHANED. Toggling step mode before a run, mid-run,
//      after completion and across an algorithm switch must always leave a usable UI, and must
//      never leave an rAF loop from a superseded run still mutating state.
//
// Plus the two pacing fixes shipped alongside it: the restretched slow end, and the wavefront
// that now REPEATS within a slow phase instead of crossing once and leaving the cubes dark.
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

await page.goto(BASE_URL + '?v=step' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug && !!window.__stepDebug, { timeout: 8000 });
await assertPageBuild(page, BASE_URL,
  ['juice', 'phaseLog', 'lanes', 'window.sha3FlashPhaseP', 'window.sha3FlashCyclesFor', 'window.setStepMode']);

const setAlgo = async which => {
  const isMd5 = await page.evaluate(() => document.getElementById('diagram-md5').style.display !== 'none');
  if ((which === 'md5') !== isMd5) await page.click('#algo-next');
};
const setSpeed = v => page.locator('#speed-slider').evaluate((el, val) => {
  el.value = String(val); el.dispatchEvent(new Event('input'));
}, v);
const st = () => page.evaluate(() => __stepDebug.state());
// Drive one request and wait until the live loop has actually consumed it. Waiting on the page's
// own state rather than on a timeout is what makes this safe in a BACKGROUNDED automation tab,
// where rAF is throttled (see CLAUDE.md's animation-verification trap) — the assertions read
// recorded history, never an in-flight sample.
async function drive(kind, settleMs = 260) {
  await page.evaluate(k => (k === 'next' ? __stepDebug.step() : __stepDebug.redo()), kind);
  await page.waitForFunction(() => __stepDebug.state().req === null, { timeout: 5000 });
  await page.waitForTimeout(settleMs);   // let the (short, floored) phase finish before the next
}

// ============================================================================================
//  1. SHA-3 — one sub-cycle is ONE PHASE
// ============================================================================================
console.log('\n-- SHA-3: one step is one phase');
await setAlgo('sha3');
await setSpeed(100);   // floors the phase durations, so a stepped phase finishes promptly
await page.fill('#input-custom', 'crypto-101');
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
await page.click('#step-toggle');
const armed = await st();
check('ticking the box reveals the controls and says what to do',
      armed.on && !armed.controlsHidden && /press step/i.test(armed.readout), armed.readout);

// STEP with nothing running starts the run and presents sub-cycle 1.
await page.click('#step-next');
await page.waitForFunction(() => __stepDebug.state().live, { timeout: 8000 });
await page.waitForTimeout(300);
const first = await st();
check('STEP with nothing running starts a run and presents exactly one sub-cycle',
      first.live && first.index === 1 && first.phaseLogLen === 1, `index ${first.index}, phaseLog ${first.phaseLogLen}`);

// Now walk 12 more and check the log grows by exactly one each time.
const walk = [];
for (let i = 0; i < 12; i++) { await drive('next'); walk.push(await st()); }
const deltas = walk.map((s, i) => s.phaseLogLen - (i ? walk[i - 1].phaseLogLen : first.phaseLogLen));
check('every STEP appends EXACTLY ONE phase to the recording (never two, never a burst)',
      deltas.every(d => d === 1), `deltas ${deltas.join(',')}`);
check('...and the queue index advances in lockstep with it',
      walk.every((s, i) => s.index === first.index + i + 1 && s.sha3Qi === s.index),
      `index ${first.index} -> ${walk[walk.length - 1].index}, qi ${walk[walk.length - 1].sha3Qi}`);

// The phases must arrive in the real FIPS-202 order, one per press.
const order = await page.evaluate(() => __sha3Debug.phaseLog().map(r => r.type));
const perm = order.filter(t => ['theta', 'rho', 'pi', 'chi', 'iota'].includes(t));
const expected = ['theta', 'rho', 'pi', 'chi', 'iota'];
check('stepping walks the real phase order theta -> rho -> pi -> chi -> iota',
      perm.length >= 5 && perm.slice(0, 5).every((t, i) => t === expected[i]), perm.join(' '));

// THE READOUT. It must name the phase and round the animation is actually standing on.
const posn = await st();
const logNow = await page.evaluate(() => __sha3Debug.phaseLog());
const last = logNow[logNow.length - 1];
const glyph = { theta: 'θ', rho: 'ρ', pi: 'π', chi: 'χ', iota: 'ι' }[last.type];
check('the SHA-3 position readout matches the phase that actually just fired',
      glyph ? posn.readout.includes(last.type) && posn.readout.includes(glyph)
              && posn.readout.includes(`round ${last.round + 1}/24`)
            : posn.readout.length > 0,
      `readout "${posn.readout}" vs recorded ${last.type} round ${last.round + 1}`);
check('...and the on-page round counter agrees with it (it now ticks on every phase, not just iota)',
      last.round < 0 || posn.roundCounter === `round ${last.round + 1} / 24`,
      `"${posn.roundCounter}" vs recorded round ${last.round + 1}`);

// ============================================================================================
//  2. SHA-3 REDO — replays the SAME sub-cycle, and does not double-apply it
// ============================================================================================
console.log('\n-- SHA-3: redo replays without advancing');
const beforeRedo = await st();
const laneBefore = await page.evaluate(() => __sha3Debug.lanes().map(L => [L.sx, L.sy, L.spinTrue, L.value]));
const logLenBefore = beforeRedo.phaseLogLen;
for (let i = 0; i < 3; i++) await drive('redo');
const afterRedo = await st();
const laneAfter = await page.evaluate(() => __sha3Debug.lanes().map(L => [L.sx, L.sy, L.spinTrue, L.value]));
check('REDO does not advance the position',
      afterRedo.index === beforeRedo.index && afterRedo.sha3Qi === beforeRedo.sha3Qi
      && afterRedo.readout === beforeRedo.readout,
      `index ${beforeRedo.index} -> ${afterRedo.index}, readout "${afterRedo.readout}"`);
check('REDO does not append to the recording (three redos, zero new phases)',
      afterRedo.phaseLogLen === logLenBefore, `${logLenBefore} -> ${afterRedo.phaseLogLen}`);
// The one that catches a naive "just call sha3StartPhase again": pi would permute twice, rho
// would spin twice as far.
const same = JSON.stringify(laneBefore) === JSON.stringify(laneAfter);
check('REDO leaves the lattice EXACTLY as it was — no double-permute, no doubled rotation',
      same,
      same ? '25 lanes identical in slot, true rho angle and value'
           : 'lanes diverged: ' + JSON.stringify(laneBefore.filter((v, i) => JSON.stringify(v) !== JSON.stringify(laneAfter[i])).slice(0, 3)));
// ...and stepping after a redo resumes correctly rather than skipping the replayed phase.
await drive('next');
const afterResume = await st();
check('a STEP after a REDO advances by exactly one, from where the redo left it',
      afterResume.index === beforeRedo.index + 1 && afterResume.phaseLogLen === logLenBefore + 1,
      `index ${afterResume.index}, phaseLog ${afterResume.phaseLogLen}`);

// ============================================================================================
//  3. MD5 — one sub-cycle is ONE TRACE EVENT (= one register update, in the main loop)
// ============================================================================================
console.log('\n-- MD5: one step is one trace event');
await setAlgo('md5');       // this bumps currentRunId and must retire the SHA-3 stepper
const afterSwitch = await st();
check('switching algorithm while HELD releases the stepper and orphans nothing',
      !afterSwitch.live && afterSwitch.on,
      `live ${afterSwitch.live}, step mode still on ${afterSwitch.on}`);
const sha3Frozen = await page.evaluate(async () => {
  const a = __sha3Debug.phaseLog().length;
  await new Promise(r => setTimeout(r, 600));
  return { a, b: __sha3Debug.phaseLog().length, running: sha3.running };
});
check('...and the superseded SHA-3 loop really has stopped (no orphaned rAF still firing phases)',
      sha3Frozen.a === sha3Frozen.b && !sha3Frozen.running,
      `phaseLog ${sha3Frozen.a} -> ${sha3Frozen.b} over 600ms, running ${sha3Frozen.running}`);

await page.fill('#input-custom', 'crypto-101');
await page.click('#step-next');
await page.waitForFunction(() => __stepDebug.state().live, { timeout: 8000 });
await page.waitForTimeout(200);
// Walk to the first main-loop event, then step through register updates one at a time.
let guard = 0;
while (guard++ < 40 && !/step \d+\/64/.test((await st()).readout)) await drive('next', 60);
const md5Steps = [];
for (let i = 0; i < 6; i++) {
  const s = await st();
  const regs = await page.evaluate(() => ['A', 'B', 'C', 'D']
    .map(l => document.querySelector('#reg-0-' + l + ' .reg-val').textContent).join(' '));
  const counter = await page.evaluate(() => document.getElementById('step-counter-0').textContent);
  md5Steps.push({ index: s.index, readout: s.readout, regs, counter });
  await drive('next', 60);
}
const nums = md5Steps.map(s => Number(/step (\d+)\/64/.exec(s.readout)[1]));
check('every MD5 STEP advances exactly one of the 64 per-block steps',
      nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), `steps ${nums.join(',')}`);
check('...and the trace index advances by exactly one alongside it',
      md5Steps.every((s, i) => i === 0 || s.index === md5Steps[i - 1].index + 1),
      `trace index ${md5Steps[0].index} -> ${md5Steps[md5Steps.length - 1].index}`);
check('the MD5 readout matches the block card\'s own step counter',
      md5Steps.every(s => s.counter === `step ${/step (\d+)\/64/.exec(s.readout)[1]} / 64`),
      `readout "${md5Steps[0].readout}" vs card "${md5Steps[0].counter}"`);
check('each step really is ONE register update — A/B/C/D changes between consecutive steps',
      md5Steps.every((s, i) => i === 0 || s.regs !== md5Steps[i - 1].regs),
      `${md5Steps[0].regs} -> ${md5Steps[1].regs}`);
// The readout names the round and the active nonlinear function, which is the other half of
// "show where you are" for MD5.
check('the MD5 readout names the block, the round and the active function',
      /step \d+\/64 · block \d+ · round \d+ · [FGHI]/.test(md5Steps[0].readout), md5Steps[0].readout);

console.log('\n-- MD5: redo replays without advancing');
const md5Before = await st();
const regsBefore = await page.evaluate(() => ['A', 'B', 'C', 'D']
  .map(l => document.querySelector('#reg-0-' + l + ' .reg-val').textContent).join(' '));
for (let i = 0; i < 3; i++) await drive('redo', 60);
const md5After = await st();
const regsAfter = await page.evaluate(() => ['A', 'B', 'C', 'D']
  .map(l => document.querySelector('#reg-0-' + l + ' .reg-val').textContent).join(' '));
check('MD5 REDO replays the same step without advancing (index, readout and registers all unmoved)',
      md5After.index === md5Before.index && md5After.readout === md5Before.readout && regsAfter === regsBefore,
      `index ${md5Before.index} -> ${md5After.index}, regs ${regsBefore} -> ${regsAfter}`);

// ============================================================================================
//  4. THE STATE TABLE — every toggle path leaves a coherent, non-stuck UI
// ============================================================================================
console.log('\n-- toggling step mode in every state');
// (a) UNTICK while holding: normal playback must RESUME, not stop and not restart.
const heldAt = (await st()).index;
await page.click('#step-toggle');   // off
await page.waitForTimeout(900);
const resumed = await st();
const md5Running = await page.evaluate(() => new Promise(res => {
  const c = document.getElementById('step-counter-0').textContent;
  setTimeout(() => res({ before: c, after: document.getElementById('step-counter-0').textContent }), 500);
}));
check('unticking while HELD resumes normal playback (it neither stops nor restarts)',
      !resumed.on && (md5Running.before !== md5Running.after || !resumed.live),
      `held at ${heldAt}; counter ${md5Running.before} -> ${md5Running.after}`);
await page.waitForFunction(() => document.getElementById('output-digest').textContent.length === 32, { timeout: 30000 });
check('the resumed run completes and prints a real digest',
      (await page.evaluate(() => document.getElementById('output-digest').textContent)).length === 32);

// (b) TICK mid-run: the run holds, it is not cancelled.
await page.evaluate(() => { document.getElementById('output-digest').textContent = '—'; });
await setSpeed(1);
await page.click('#hash-btn');
await page.waitForTimeout(500);
await page.click('#step-toggle');   // on, mid-run
await page.waitForTimeout(700);
const midA = await st();
await page.waitForTimeout(900);
const midB = await st();
check('ticking the box MID-RUN holds the run in place rather than cancelling it',
      midA.live && midB.live && midA.index === midB.index && midA.index > 0,
      `held at index ${midA.index} for ~900ms, still live`);
await drive('next', 120);
const midC = await st();
check('...and a STEP from that hold advances exactly one',
      midC.index === midA.index + 1, `${midA.index} -> ${midC.index}`);

// (c) REAL TIME and step mode are mutually exclusive, enforced both ways.
await page.evaluate(() => { const t = document.getElementById('realtime-toggle'); t.checked = true; t.dispatchEvent(new Event('change')); });
const rtOn = await page.evaluate(() => ({ rt: document.getElementById('realtime-toggle').checked, step: __stepDebug.state().on }));
await page.evaluate(() => __stepDebug.set(true));
const stepOn = await page.evaluate(() => ({ rt: document.getElementById('realtime-toggle').checked, step: __stepDebug.state().on }));
check('REAL TIME and step mode cannot both be on (enforced in both directions)',
      rtOn.rt && !rtOn.step && stepOn.step && !stepOn.rt,
      `real-time first: ${JSON.stringify(rtOn)}; step first: ${JSON.stringify(stepOn)}`);

// (d) after a completed run, STEP starts a fresh one instead of doing nothing.
await page.evaluate(() => { currentRunId++; });
await page.waitForTimeout(400);
const idle = await st();
await page.click('#step-next');
await page.waitForFunction(() => __stepDebug.state().live && __stepDebug.state().index >= 1, { timeout: 10000 });
const restarted = await st();
check('STEP after a finished/cancelled run starts a fresh one rather than sitting stuck',
      !idle.live && restarted.live && restarted.index === 1,
      `idle live ${idle.live} -> restarted index ${restarted.index}`);

// (e) SPAMMING. Ten Hash clicks under a held stepper must leave exactly one live run.
await page.evaluate(() => { for (let i = 0; i < 10; i++) document.getElementById('hash-btn').click(); });
await page.waitForTimeout(900);
const spam = await st();
check('spamming Hash while stepping leaves exactly one live run, matching currentRunId',
      spam.runId === spam.currentRunId && spam.live, `runId ${spam.runId}, currentRunId ${spam.currentRunId}`);

// ============================================================================================
//  5. THE CONTROLS THEMSELVES — real buttons, the keyboard, and the rate limit
// ============================================================================================
console.log('\n-- buttons, keyboard, rate limit');
await page.waitForTimeout(400);
const kbBefore = await st();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
const kbAfter = await st();
check('the right-arrow key steps',
      kbAfter.index === kbBefore.index + 1, `${kbBefore.index} -> ${kbAfter.index}`);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
const kbRedo = await st();
check('the left-arrow key replays without advancing',
      kbRedo.index === kbAfter.index, `${kbAfter.index} -> ${kbRedo.index}`);

// Typing must never be hijacked. The textarea is the case that matters: space and arrows there
// are text editing, not playback.
await page.click('#input-custom');
const typedBefore = await st();
await page.keyboard.type('ab cd');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const typedAfter = await st();
const typedValue = await page.evaluate(() => document.getElementById('input-custom').value);
check('typing in the input textarea never triggers a step (space and arrows stay text editing)',
      typedAfter.index === typedBefore.index && typedValue.includes('ab cd'),
      `index ${typedBefore.index} -> ${typedAfter.index}, textarea "${typedValue.slice(-8)}"`);
await page.evaluate(() => document.getElementById('input-custom').blur());

// The rate limit: the photosensitivity guard behind the keyboard. Mash the button as fast as
// Playwright can and confirm the accepted rate is bounded.
await page.evaluate(() => { currentRunId++; });
await page.waitForTimeout(300);
await page.click('#step-next');
await page.waitForFunction(() => __stepDebug.state().live, { timeout: 10000 });
const rlBefore = await st();
const t0 = Date.now();
for (let i = 0; i < 20; i++) await page.evaluate(() => __stepDebug.request('next'));
const elapsed = Date.now() - t0;
await page.waitForTimeout(400);
const rlAfter = await st();
const accepted = rlAfter.index - rlBefore.index;
const maxAllowed = Math.ceil(elapsed / (await page.evaluate(() => __stepDebug.minIntervalMs))) + 2;
check('the request rate limit bounds how fast steps can be armed (the photosensitivity guard)',
      accepted <= maxAllowed, `${accepted} steps accepted from 20 requests in ${elapsed}ms (bound ${maxAllowed})`);

// ============================================================================================
//  6. THE PACING FIXES that shipped with this
// ============================================================================================
console.log('\n-- the restretched slow end, and the repeating wavefront');
const durations = await page.evaluate(() => {
  const order = ['theta', 'rho', 'pi', 'chi', 'iota'];
  const keepR = sha3.roundsInBlock, keepB = sha3.blocksDone, keepV = document.getElementById('speed-slider').value;
  const at = v => {
    document.getElementById('speed-slider').value = String(v);
    let total = 0;
    for (let r = 0; r < 24; r++) { sha3.roundsInBlock = r; for (const t of order) total += sha3PhaseDuration(t); }
    sha3.roundsInBlock = 0;
    return Math.round(total);
  };
  const out = { 1: at(1), 50: at(50), 100: at(100) };
  sha3.roundsInBlock = keepR; sha3.blocksDone = keepB;
  document.getElementById('speed-slider').value = keepV;
  return out;
});
console.log(`    one rate-block run: slider 1 = ${(durations[1] / 1000).toFixed(1)}s, ` +
            `slider 50 = ${(durations[50] / 1000).toFixed(1)}s, slider 100 = ${(durations[100] / 1000).toFixed(1)}s`);
// The owner asked for "another two or four times slower" than the 65s build, with the default and
// the fast end left exactly where they were calibrated.
check('the slow end is 2-4x slower than the 65s build it replaced',
      durations[1] >= 130000 && durations[1] <= 270000, `${(durations[1] / 1000).toFixed(1)}s at slider 1`);
check('...while the default and the fast end are untouched',
      durations[50] > 7000 && durations[50] < 10000 && durations[100] < 2200,
      `${(durations[50] / 1000).toFixed(1)}s / ${(durations[100] / 1000).toFixed(1)}s`);

// THE REPEATING WAVEFRONT.
//
// THE RIGHT QUANTITY, and the wrong one. The obvious measure — what fraction of the phase a cube
// is lit for — is INVARIANT under repeating, and provably so: folding p into N repeats resamples
// the same wave N times, so the total lit fraction cannot change. Measuring that and asserting an
// improvement would be asserting something the design cannot deliver, and the first draft of this
// test did exactly that.
//
// The report was not about total light, it was about the light GOING AWAY and not coming back:
// "the pulses of light that indicates the next phase in the cubes cuts out quite early". So the
// quantity is the LONGEST CONTINUOUS DARK STRETCH a cube sits through inside one phase, and the
// count of separate times it lights. Repeating divides the first by N and multiplies the second
// by N, which is exactly what "multiple cycles where it is still visible" asks for.
const CYCLES_AT_SLOW_END = 3;   // representative; the per-phase counts are checked separately below
const pulse = await page.evaluate(N => {
  const types = ['theta', 'chi'];      // the two clipped sweeps; rho/pi already wrap, iota is a point
  const out = {};
  const measure = (type, cycles) => {
    // Worst cube of the lattice for this wave, so the numbers are a floor and not an average.
    let worstGap = 0, fewestLightings = Infinity, litFrac = 1;
    const S = 3000;
    for (const l of sha3.lanes) {
      for (let k = 0; k < 4; k++) {
        let gap = 0, run = 0, lightings = 0, lit = 0, wasOn = false;
        for (let i = 0; i < S; i++) {
          const on = sha3FlashWave(type, sha3FlashPhaseP(i / (S - 1), cycles), l, k, 1) > 0.05;
          if (on) { lit++; if (!wasOn) lightings++; gap = Math.max(gap, run); run = 0; }
          else run++;
          wasOn = on;
        }
        gap = Math.max(gap, run);
        worstGap = Math.max(worstGap, gap / S);
        fewestLightings = Math.min(fewestLightings, lightings);
        litFrac = Math.min(litFrac, lit / S);
      }
    }
    return { gap: worstGap, lightings: fewestLightings, lit: litFrac };
  };
  for (const type of types) out[type] = { once: measure(type, 1), cycled: measure(type, N) };
  // ...and the cycle count actually chosen at each end of the slider.
  const keepV = document.getElementById('speed-slider').value;
  const cyclesAt = v => {
    document.getElementById('speed-slider').value = String(v);
    const r = {}; for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) r[t] = sha3FlashCyclesFor(sha3PhaseDuration(t));
    return r;
  };
  const slow = cyclesAt(1), mid = cyclesAt(50), fast = cyclesAt(100);
  document.getElementById('speed-slider').value = keepV;
  return { out, slow, mid, fast };
}, CYCLES_AT_SLOW_END);
for (const [t, v] of Object.entries(pulse.out)) {
  console.log(`    ${t}: worst cube's longest dark stretch ${(v.once.gap * 100).toFixed(0)}% of the phase ` +
              `-> ${(v.cycled.gap * 100).toFixed(0)}% with ${CYCLES_AT_SLOW_END} cycles; ` +
              `lights ${v.once.lightings}x -> ${v.cycled.lightings}x ` +
              `(lit fraction ${(v.once.lit * 100).toFixed(0)}% either way, by construction)`);
}
console.log(`    cycles chosen: slider 1 ${JSON.stringify(pulse.slow)}  slider 50 ${JSON.stringify(pulse.mid)}  slider 100 ${JSON.stringify(pulse.fast)}`);
check('repeating the sweep cuts the longest dark stretch a cube sits through, in proportion to the repeat count',
      Object.values(pulse.out).every(v => v.cycled.gap < v.once.gap / (CYCLES_AT_SLOW_END - 0.6)),
      Object.entries(pulse.out).map(([t, v]) => `${t} ${(v.once.gap * 100).toFixed(0)}% -> ${(v.cycled.gap * 100).toFixed(0)}%`).join(', '));
check('...and every cube lights once per cycle instead of once per phase',
      Object.values(pulse.out).every(v => v.cycled.lightings >= CYCLES_AT_SLOW_END && v.once.lightings === 1),
      Object.entries(pulse.out).map(([t, v]) => `${t} ${v.once.lightings}x -> ${v.cycled.lightings}x`).join(', '));
check('the slow end really does get multiple cycles per phase',
      Object.values(pulse.slow).some(c => c >= 2) && Object.values(pulse.slow).every(c => c >= 1),
      JSON.stringify(pulse.slow));
check('the calibrated default and fast end are left at exactly one sweep per phase (unchanged)',
      Object.values(pulse.mid).every(c => c === 1) && Object.values(pulse.fast).every(c => c === 1),
      `mid ${JSON.stringify(pulse.mid)}, fast ${JSON.stringify(pulse.fast)}`);
// The sustained sweep rate is what the photosensitivity governor sees. Bound it against the rate
// below which the governor attenuates nothing, so the slow end can never dim itself.
const sweepHz = await page.evaluate(() => {
  const keepV = document.getElementById('speed-slider').value;
  let worst = 0;
  for (let v = 1; v <= 100; v++) {
    document.getElementById('speed-slider').value = String(v);
    for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) {
      const d = sha3PhaseDuration(t);
      worst = Math.max(worst, 1000 / (d / sha3FlashCyclesFor(d)));
    }
  }
  document.getElementById('speed-slider').value = keepV;
  return { worst, free: __sha3Debug.governor().freeHz };
});
console.log(`    worst sustained sweep rate across the whole slider: ${sweepHz.worst.toFixed(2)}Hz`);
// Only the REPEAT is bounded here — at the fast end a phase is one sweep and its rate is the
// phase rate, which the governor and the aliasing shutter already own.
const repeatHz = await page.evaluate(() => {
  const keepV = document.getElementById('speed-slider').value;
  let worst = 0;
  for (let v = 1; v <= 100; v++) {
    document.getElementById('speed-slider').value = String(v);
    for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) {
      const d = sha3PhaseDuration(t), c = sha3FlashCyclesFor(d);
      if (c > 1) worst = Math.max(worst, 1000 / (d / c));
    }
  }
  document.getElementById('speed-slider').value = keepV;
  return worst;
});
check('wherever the sweep repeats, its rate stays under the governor\'s free band (nothing new to attenuate)',
      repeatHz < sweepHz.free, `worst repeat rate ${repeatHz.toFixed(2)}Hz against a ${sweepHz.free}Hz free band`);

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll step-through checks passed.');
