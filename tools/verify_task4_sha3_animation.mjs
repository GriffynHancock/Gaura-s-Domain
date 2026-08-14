// Verification of the SHA-3 animation STATE CONTROLLER.
//
// REWRITTEN alongside the Canvas 2D rewrite. The previous version of this file asserted only
// that the round counter reached 24/24 and a 64-hex digest appeared — which the old, broken
// implementation also passed, because it said nothing about whether the animation's effects
// interrupted each other. That was the actual reported defect ("they all interrupt eachother...
// it re-arranges and twists but only for a split second before returning"). The assertions below
// test the controller directly and would have failed on the old implementation:
//
//   * every phase records a real start AND end, and phase i's end is <= phase i+1's start
//     (no two phases ever overlap in time — the central guarantee)
//   * every round emits exactly theta -> rho -> pi -> chi -> iota, in that order, 24 times
//   * pi's rearrangement PERSISTS (the old code had an unconditional 220ms revert to a cached
//     base transform); slot assignments are sampled after a pi commits and re-checked well past
//     that old revert window
//   * capacity lanes are genuinely all-zero until the first permutation, then fill
//   * per-lane rho rotations are distinct from one another
//   * the digest still matches Node's own sha3-256
//
// Timing note (CLAUDE.md "animation verification trap"): rAF is throttled in an automation tab,
// so nothing here samples an in-flight animation's computed style. Everything reads either
// RECORDED history (phaseLog, timestamped from the page's own clock as each phase fired) or
// committed state.
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import { assertPageBuild } from './assert_page_build.mjs';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const INPUT = 'crypto-101';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
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

await page.goto(BASE_URL + '?v=task4');
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 5000 });
// Prove we are testing the intended checkout before asserting anything about it — see
// assert_page_build.mjs for the failure this prevents (a stale page turned a missing debug field
// into a fake "the rho fix has regressed" report).
await assertPageBuild(page, BASE_URL, ['lanes', 'alias', 'lane.spinTrue', 'lane.spinTarget']);
await page.click('#algo-next'); // switch to SHA-3
await page.fill('#input-custom', INPUT);
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();

// ============================================================================================
//  PASS 1 — slow speed, sampling live state: capacity fill, pi persistence, phase indicators
// ============================================================================================
// Slider 25, not 18. This pass needs a run slow enough that the 25ms sampler below catches the
// short-lived states it asserts on — the post-absorb window (rate loaded, capacity still zero) and
// a >=400ms non-pi gap proving the pi rearrangement persists. At slider 25 a rate-block takes ~41s
// over 24 rounds: ~1.7s per round, ~340ms per phase, still 13 samples per phase and ~1.3s of
// contiguous non-pi after every pi. Slider 18 (~2.7s per round) bought more margin than either
// assertion can use and cost ~3s of waiting to reach round 3.
await page.locator('#speed-slider').evaluate(el => { el.value = '25'; el.dispatchEvent(new Event('input')); });

// Install an in-page sampler BEFORE clicking Hash. It records committed state on the page's own
// clock rather than us polling an animating value from outside.
await page.evaluate(() => {
  window.__probe = { samples: [], piSlots: [], indicator: [] };
  window.__probeTimer = setInterval(() => {
    const d = window.__sha3Debug;
    const lanes = d.lanes();
    const phase = d.activePhase();
    window.__probe.samples.push({
      phase,
      capacityNonZero: lanes.filter(l => !l.isRate && l.value > 0).length,
      rateNonZero: lanes.filter(l => l.isRate && l.value > 0).length,
      permuted: lanes.filter(l => l.sx !== l.cx || l.sy !== l.cy).length,
      slots: lanes.map(l => `${l.sx},${l.sy}`).join('|'),
      t: performance.now(),
    });
    const lit = ['theta','rho','pi','chi','iota'].filter(t =>
      document.getElementById('phase-' + t).classList.contains('active'));
    window.__probe.indicator.push({ phase, lit: lit.join(','), t: performance.now() });
  }, 25);
});

await page.click('#hash-btn');
// let the slow run get well past the first couple of rounds
await page.waitForFunction(() => {
  const m = /round (\d+) \/ 24/.exec(document.getElementById('round-counter').textContent);
  return m && Number(m[1]) >= 3;
}, { timeout: 60000 });

const probe = await page.evaluate(() => { clearInterval(window.__probeTimer); return window.__probe; });

// ---- capacity starts genuinely EMPTY, then fills ----
// Keccak's state really does start all-zero and input never touches capacity directly, so there
// must be a real window where rate lanes are loaded and capacity is still exactly zero.
const absorbed = probe.samples.find(s => s.rateNonZero > 0 && s.capacityNonZero === 0);
if (!absorbed) throw new Error('never observed the honest post-absorb state (rate loaded, capacity still all-zero)');
const filled = probe.samples.filter(s => s.capacityNonZero === 8);
if (!filled.length) throw new Error('capacity lanes never became non-zero — data is not visibly diffusing into capacity');
const firstFill = probe.samples.indexOf(filled[0]);
const absorbIdx = probe.samples.indexOf(absorbed);
if (firstFill <= absorbIdx) throw new Error('capacity filled before/at absorb — it must only fill through the permutation');
console.log(`OK  capacity lanes start all-zero while rate is loaded (${absorbed.rateNonZero}/17 rate lanes), then all 8 fill through the permutation`);

// ---- pi rearrangement PERSISTS ----
// Find a sample where lanes are permuted, then a LATER sample >= 400ms after it (well past the
// old implementation's unconditional 220ms revert-to-base-transform) whose phase is not pi. The
// slot assignment must be unchanged across that gap.
let persisted = null;
for (let i = 0; i < probe.samples.length; i++) {
  const a = probe.samples[i];
  if (a.permuted === 0 || a.phase === 'pi') continue;
  const b = probe.samples.find(s => s.t - a.t >= 400 && s.phase !== 'pi' && s.permuted > 0);
  if (b && b.slots === a.slots) { persisted = { a, b }; break; }
}
if (!persisted) {
  const anyPermuted = probe.samples.some(s => s.permuted > 0);
  throw new Error(anyPermuted
    ? 'pi rearrangement did NOT persist — slot assignment changed/reverted within 400ms outside a pi phase'
    : 'lanes were never observed in a permuted arrangement at all');
}
if (persisted.a.permuted !== 24) {
  throw new Error(`expected 24 of 25 lanes permuted after pi ((0,0) is pi's fixed point), got ${persisted.a.permuted}`);
}
console.log(`OK  pi rearrangement persists — 24/25 lanes still in their permuted slots ${Math.round(persisted.b.t - persisted.a.t)}ms later (old code reverted at 220ms)`);

// ---- phase indicator boxes track the controller, one at a time ----
const litSamples = probe.indicator.filter(s => s.lit);
if (!litSamples.length) throw new Error('no phase indicator box was ever lit');
const mismatched = probe.indicator.filter(s => s.phase && s.lit && s.lit !== s.phase);
if (mismatched.length > probe.indicator.length * 0.08) {
  throw new Error(`phase indicator boxes disagree with the active phase in ${mismatched.length}/${probe.indicator.length} samples`);
}
const multiLit = probe.indicator.filter(s => s.lit.includes(','));
if (multiLit.length) throw new Error(`more than one phase indicator lit at once in ${multiLit.length} samples`);
const litTypes = new Set(litSamples.map(s => s.lit));
if (litTypes.size < 5) throw new Error(`expected all five phase boxes to light up, saw ${[...litTypes].join(',')}`);
console.log(`OK  all five phase indicator boxes light in sync with the controller, never more than one at a time`);

// ============================================================================================
//  PASS 2 — fastest speed, full run: phase ordering, non-overlap, rho spread, digest
// ============================================================================================
await page.locator('#speed-slider').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input')); });
await page.click('#hash-btn'); // re-click mid-run: must hard-cancel the previous run, not queue
await page.waitForFunction(
  () => document.getElementById('round-counter').textContent === 'round 24 / 24',
  { timeout: 60000 }
);
await page.waitForFunction(
  () => /^[0-9a-f]{64}$/.test(document.getElementById('output-digest').textContent),
  { timeout: 10000 }
);

const log = await page.evaluate(() => window.__sha3Debug.phaseLog());

// ---- every phase completed, and NO TWO PHASES OVERLAP ----
// This is the assertion that directly encodes the user's complaint. In the old implementation
// effects were fired from independent setTimeouts and routinely ran on top of each other.
for (let i = 0; i < log.length; i++) {
  if (log[i].end === null || log[i].end === undefined) {
    throw new Error(`phase ${i} (${log[i].type}) never recorded an end time — it did not finish before the run ended`);
  }
  if (log[i].end < log[i].start) throw new Error(`phase ${i} (${log[i].type}) ended before it started`);
  if (i + 1 < log.length && log[i].end > log[i + 1].start + 0.5) {
    throw new Error(`phases overlap: ${log[i].type} ended at ${log[i].end} but ${log[i + 1].type} started at ${log[i + 1].start}`);
  }
}
console.log(`OK  ${log.length} phases ran strictly sequentially — every one finished before the next began, none overlapped`);

// ---- exactly 24 rounds of theta -> rho -> pi -> chi -> iota, in order ----
const ORDER = ['theta', 'rho', 'pi', 'chi', 'iota'];
const rounds = log.filter(r => r.round >= 0);
if (rounds.length !== 24 * 5) throw new Error(`expected ${24 * 5} round phases, got ${rounds.length}`);
for (let r = 0; r < 24; r++) {
  const seq = rounds.slice(r * 5, r * 5 + 5);
  const types = seq.map(s => s.type).join(',');
  if (types !== ORDER.join(',')) throw new Error(`round ${r} phase order was "${types}", expected "${ORDER.join(',')}"`);
  if (seq.some(s => s.round !== r)) throw new Error(`round ${r} phases carry inconsistent round numbers`);
  if (seq.some(s => s.end - s.start <= 0)) throw new Error(`round ${r} has a zero-duration phase`);
}
console.log('OK  all 24 rounds fired theta -> rho -> pi -> chi -> iota in order, each with a real non-zero duration');

// ---- the aborted first run did not leak into this one ----
if (rounds.length !== 120) throw new Error('phase log contains phases from more than one run — the re-click did not hard-cancel');
console.log('OK  re-clicking Hash mid-run hard-cancelled the previous run (no leaked phases)');

// ---- per-lane rho rotations differ from one another ----
const lanes = await page.evaluate(() => window.__sha3Debug.lanes());
// ============================================================================================
//  THE ORIGINAL COMPLAINT: "the dials always point to the same place"
// ============================================================================================
//
// This is the guard on the project's headline visual fix, so it is now checked on BOTH of the two
// angles the aliasing work introduced, because they can fail independently and only one of them
// is what the viewer actually sees:
//
//   * spinTrue   — the UNSCALED accumulated rho angle. The [FAIRLY ACCURATE] claim the page makes
//                  about rho's real bit-rotation. If this collapsed, the model is wrong.
//   * spinTarget — the APPARENT angle the renderer eases toward, i.e. what is on screen once the
//                  shutter/aliasing factor has been applied. If this collapsed, the picture is
//                  wrong even though the model is right. THIS is the one the owner's complaint
//                  was about.
//
// EIGHT is the ceiling for the true angles, not a shortfall. After exactly 24 rounds a lane has
// turned 24 * offset * (360/64) = offset * 135 degrees, and gcd(135, 360) = 45, so every lane's
// true angle lands on one of the 8 multiples of 45 degrees no matter what its offset is. That is
// a property of Keccak's rho offsets and the round count, not of this code — do not "fix" it.
// The APPARENT angles are not quantised that way (the alias factor is re-evaluated per round and
// the escalation moves it), so they come out 24-25 distinct across the 25 lanes.
//
// Measured across the whole slider, on a completed one-block run: true 8 at every position;
// apparent 25 / 24 / 25 / 25 / 25 at sliders 1 / 18 / 50 / 78 / 100.
const norm = a => Math.round(((a % 360) + 360) % 360);
const badTrue = lanes.filter(l => !Number.isFinite(l.spinTrue)).length;
if (badTrue) throw new Error(`${badTrue} of 25 lanes have a non-numeric spinTrue — the page is not reporting the true rho angle at all`);
const spinSet = new Set(lanes.map(l => norm(l.spinTrue)));
if (spinSet.size < 5) {
  throw new Error(`per-lane rho rotations are not distinct enough: only ${spinSet.size} distinct true angles across 25 lanes (8 is the maximum after 24 rounds)`);
}
// ...and the DRAWN angle, which is what "the dials all point the same way" is actually about.
// Anchored at slider 100 where the geometric alias factor is well away from zero. It CAN
// legitimately collapse at a setting where the factor passes exactly through zero — that is the
// apparent freeze, and it is the point of the effect — which is why the invariant above is
// stated on the true angle and this one is stated at a named speed.
const aliasGeo = await page.evaluate(() => __sha3Debug.alias().geo);
const drawnSet = new Set(lanes.map(l => norm(l.spinTarget)));
if (!(Math.abs(aliasGeo) > 0.02)) {
  throw new Error(`this check needs a speed where apparent motion is not frozen; alias factor is ${aliasGeo}`);
}
if (drawnSet.size < 5) {
  throw new Error(`the DRAWN per-lane rho angles collapsed: only ${drawnSet.size} distinct across 25 lanes at slider 100 (alias factor ${aliasGeo.toFixed(3)}) — this is the "all the dials point to the same place" defect`);
}
console.log(`OK  per-lane rho rotations are genuinely different — ${spinSet.size} distinct TRUE angles (8 is the ceiling after 24 rounds) and ${drawnSet.size} distinct DRAWN angles across 25 lanes, at alias factor ${aliasGeo.toFixed(3)}`);

// ---- lane contents are data-derived: a different input gives a different state ----
const stateOf = ls => ls.map(l => l.bytes.join(',')).join(';');
const stateA = stateOf(lanes);
await page.fill('#input-custom', INPUT + '-different');
await page.click('#hash-btn');
await page.waitForFunction(() => document.getElementById('round-counter').textContent === 'round 24 / 24', { timeout: 60000 });
await page.waitForTimeout(400);
const stateB = stateOf(await page.evaluate(() => window.__sha3Debug.lanes()));
if (stateA === stateB) throw new Error('two different inputs produced an identical rendered lane state — the picture is not data-derived');
console.log('OK  two different inputs produce visibly different lane contents (the render is driven by real state)');

// ---- digest parity ----
await page.fill('#input-custom', INPUT);
// Blank the readout first: the previous run's 64-hex digest is still on screen, so a bare
// "looks like a digest" wait would match the STALE value immediately and compare the wrong hash.
await page.evaluate(() => { document.getElementById('output-digest').textContent = '—'; });
await page.click('#hash-btn');
await page.waitForFunction(() => /^[0-9a-f]{64}$/.test(document.getElementById('output-digest').textContent), { timeout: 60000 });
const digest = await page.locator('#output-digest').innerText();
const expected = crypto.createHash('sha3-256').update(INPUT).digest('hex');
if (digest !== expected) throw new Error(`SHA3-256 digest mismatch: got ${digest}, expected ${expected}`);
console.log(`OK  digest still correct: SHA3-256("${INPUT}") = ${digest}`);

// ============================================================================================
//  DIRECTIONAL FLASH — each phase's wavefront must travel along the axis that step is actually
//  defined on in FIPS 202. Getting one of these wrong teaches a false structure, so it is pinned
//  here rather than left to eyeballing. Sampled straight from sha3FlashWave, which is a pure
//  function of (phase, progress, lane, sub-cube) — no rAF involved, so the CLAUDE.md
//  backgrounded-tab animation trap cannot affect the reading.
//
//    theta  §3.2.1  D[x] depends on C[x-1] and C[x+1]  -> travels along x, as a whole x-PLANE
//                   (D[x] is independent of y, so every y at that x lights together)
//    rho    §3.2.2  each lane rotates its own 64-bit ring -> travels along z, wrapping, and each
//                   lane offset by its own real KECCAK_RHO_OFFSETS entry
//    pi     §3.2.3  (x,y) -> (y, 2x+3y mod 5), z untouched -> swirls in x-y, never along z
//    chi    §3.2.4  depends on x+1 and x+2 at FIXED y -> travels along x (NOT y: a Keccak row is
//                   indexed by y and runs along x), backwards, as five independent per-row races
//    iota   §3.2.5  lane (0,0) only -> no sweep at all, a point flash on the real (0,0) lane
// ============================================================================================
const wave = await page.evaluate(() => {
  const centroid = (type, p) => {
    let W = 0, mx = 0, my = 0, mz = 0, n = 0;
    for (const L of sha3.lanes) for (let k = 0; k < SHA3_SUBS_PER_LANE; k++) {
      const a = sha3FlashWave(type, p, L, k);
      if (a <= 0) continue;
      W += a; mx += a * (L.fx / 4); my += a * (L.fy / 4); mz += a * (k / (SHA3_SUBS_PER_LANE - 1)); n++;
    }
    return W > 0 ? { x: mx / W, y: my / W, z: mz / W, n } : null;
  };
  const ps = [0.2, 0.4, 0.6, 0.8];
  const out = { theta: ps.map(p => centroid('theta', p)), chi: ps.map(p => centroid('chi', p)),
                pi: ps.map(p => centroid('pi', p)), iota: ps.map(p => centroid('iota', p)) };
  // rho is per-lane by construction, so an assembly-wide centroid says nothing: sample one lane's
  // own depth centroid, and check two lanes with different rho offsets are genuinely out of step.
  out.rho = {};
  for (const key of ['0,0', '2,3']) {
    const [cx, cy] = key.split(',').map(Number);
    const L = sha3LaneAt(cx, cy);
    // CIRCULAR mean, not an arithmetic one: rho's wave wraps (a lane's 64 bits are a ring), and an
    // arithmetic centroid is biased toward 0.5 whenever the band straddles the seam.
    out.rho[key] = { off: KECCAK_RHO_OFFSETS[cx][cy], z: [0, 0.25, 0.5, 0.75].map(p => {
      let sn = 0, cs = 0;
      for (let k = 0; k < SHA3_SUBS_PER_LANE; k++) {
        const a = sha3FlashWave('rho', p, L, k), th = 2 * Math.PI * (k / (SHA3_SUBS_PER_LANE - 1));
        sn += a * Math.sin(th); cs += a * Math.cos(th);
      }
      return (Math.atan2(sn, cs) / (2 * Math.PI) + 1) % 1;
    }) };
  }
  out.piTouchesZ = [0.1, 0.3, 0.5, 0.7, 0.9].some(p => {
    const L = sha3LaneAt(1, 3);
    const vals = []; for (let k = 0; k < SHA3_SUBS_PER_LANE; k++) vals.push(sha3FlashWave('pi', p, L, k));
    return Math.max(...vals) - Math.min(...vals) > 1e-9;   // must be FALSE: pi ignores z
  });
  return out;
});
const rising = a => a.every((v, i) => i === 0 || v > a[i - 1] + 1e-6);
const thetaX = wave.theta.map(r => r.x);
if (!rising(thetaX)) throw new Error(`theta's wavefront must travel along +x, got x centroids ${thetaX}`);
if (wave.theta.some(r => Math.abs(r.y - 0.5) > 0.05 || Math.abs(r.z - 0.5) > 0.05)) {
  throw new Error(`theta's front must be a whole x-plane (no y or z component), got ${JSON.stringify(wave.theta)}`);
}
const chiX = wave.chi.map(r => r.x);
if (!rising(chiX.slice().reverse())) throw new Error(`chi's wavefront must travel along -x, got x centroids ${chiX}`);
// chi must NOT read as a y-sweep: its per-row stagger is scrambled precisely so the y centroid
// stays roughly put while x crosses the whole assembly. Compare the two excursions rather than
// demanding y be pinned exactly — a staggered start inevitably wobbles y at the tails, where only
// one or two rows are still in the wave. What must not happen is y travelling like x does; that
// would make chi a diagonal wipe, teaching a y-direction Keccak's chi does not have.
const span = a => Math.max(...a) - Math.min(...a);
const chiXSpan = span(chiX), chiYSpan = span(wave.chi.map(r => r.y));
if (!(chiYSpan < 0.4 * chiXSpan)) {
  throw new Error(`chi must sweep along x, not diagonally: y excursion ${chiYSpan.toFixed(2)} vs x excursion ${chiXSpan.toFixed(2)}`);
}
if (wave.pi.some(r => Math.abs(r.z - 0.5) > 0.02) || wave.piTouchesZ) {
  throw new Error('pi must never sweep along z — pi permutes lane positions in x-y and leaves z untouched');
}
const piAng = wave.pi.map(r => Math.atan2(r.y - 0.5, r.x - 0.5));
if (new Set(piAng.map(a => Math.round(a * 4))).size < 3) {
  throw new Error(`pi's sweep must be rotational (its centroid must swing around the centre), got angles ${piAng}`);
}
// The front must advance around the ring by the same amount p advanced (0.25 per sample), in the
// same direction, for every lane — that is what "rotating the lane's own 64-bit ring" looks like.
for (const [key, r] of Object.entries(wave.rho)) {
  for (let i = 1; i < r.z.length; i++) {
    const step = ((r.z[i] - r.z[i - 1]) % 1 + 1) % 1;
    if (!(step > 0.12 && step < 0.38)) {
      throw new Error(`rho's wave must advance steadily around lane ${key}'s 64-bit ring (expected ~+0.25 per 0.25 of the phase), got step ${step.toFixed(3)} from ${r.z.map(v => v.toFixed(2))}`);
    }
  }
}
// Different rho offsets must put different lanes at different points of their own ring.
const rhoLead = ((wave.rho['2,3'].z[0] - wave.rho['0,0'].z[0]) % 1 + 1) % 1;
if (!(rhoLead > 0.08 && rhoLead < 0.92)) {
  throw new Error(`rho lanes with different offsets must be visibly out of step (lane 2,3 has offset ${wave.rho['2,3'].off} vs lane 0,0's ${wave.rho['0,0'].off}), got a phase lead of ${rhoLead.toFixed(3)}`);
}
if (Math.abs(rhoLead - (wave.rho['2,3'].off % 64) / 64) > 0.06) {
  throw new Error(`rho's per-lane phase offset must be the lane's REAL rho amount (${wave.rho['2,3'].off}/64 = ${((wave.rho['2,3'].off % 64) / 64).toFixed(3)}), got ${rhoLead.toFixed(3)}`);
}
if (wave.iota.some(r => r.n !== 8)) {
  throw new Error(`iota must light exactly the 8 drawn cubes of one lane (it XORs a constant into all 64 bits of lane (0,0)), got ${wave.iota.map(r => r.n)}`);
}
if (wave.iota.some(r => r.x !== 0 || r.y !== 0)) {
  throw new Error(`iota must flash only lane (0,0) and never travel, got ${JSON.stringify(wave.iota)}`);
}
console.log(`OK  each phase sweeps its real FIPS 202 axis: theta +x as a plane (${thetaX.map(v => v.toFixed(2)).join('->')}), chi -x as five staggered per-row races, rho along z per-lane and out of step, pi rotational in x-y with zero z component, iota a point flash on lane (0,0)`);

// ---- flash brightness must FALL as the animation speeds up (photosensitivity + legibility) ----
const gains = await page.evaluate(() => {
  const o = { bySlider: {}, escalated: null };
  for (const v of [1, 25, 50, 75, 100]) {
    document.getElementById('speed-slider').value = String(v);
    sha3.roundsInBlock = 0; sha3.blocksDone = 0;
    o.bySlider[v] = ['theta', 'rho', 'pi', 'chi', 'iota'].map(t => sha3FlashGain(sha3PhaseDuration(t)));
  }
  // The slider is only one of two things that shorten a phase; the uncapped juice escalation is
  // the other, and it is the one a long input actually hits. The dimming must respond to it too.
  document.getElementById('speed-slider').value = '25';
  sha3.roundsInBlock = 0; sha3.blocksDone = 0;
  const calm = sha3FlashGain(sha3PhaseDuration('theta'));
  sha3.roundsInBlock = 23; sha3.blocksDone = 26;
  const wild = sha3FlashGain(sha3PhaseDuration('theta'));
  sha3.roundsInBlock = 0; sha3.blocksDone = 0;
  document.getElementById('speed-slider').value = '50';
  o.escalated = { calm, wild };
  return o;
});
const sliders = [1, 25, 50, 75, 100];
for (let i = 1; i < sliders.length; i++) {
  const prev = gains.bySlider[sliders[i - 1]], cur = gains.bySlider[sliders[i]];
  if (cur.some((g, j) => g > prev[j] + 1e-9)) {
    throw new Error(`flash gain must not rise with speed: slider ${sliders[i - 1]} ${prev} -> ${sliders[i]} ${cur}`);
  }
}
if (!(Math.max(...gains.bySlider[100]) < 0.45)) throw new Error(`the fastest setting must be genuinely gentle, got ${gains.bySlider[100]}`);
if (!(Math.min(...gains.bySlider[1]) > 0.9)) throw new Error(`the slowest setting must keep full punch, got ${gains.bySlider[1]}`);
if (!(gains.escalated.wild < gains.escalated.calm * 0.75)) {
  throw new Error(`escalation-driven speed-up must dim the flash too: ${gains.escalated.calm} -> ${gains.escalated.wild}`);
}
console.log(`OK  flash brightness falls as speed rises (slider 1 -> ${gains.bySlider[1][0].toFixed(2)}, 50 -> ${gains.bySlider[50][0].toFixed(2)}, 100 -> ${gains.bySlider[100][0].toFixed(2)}; escalation alone takes it ${gains.escalated.calm.toFixed(2)} -> ${gains.escalated.wild.toFixed(2)})`);

// ---- ...but COLOUR must NOT. Brightness and hue are separate channels with separate rules ----
// The gain above exists for photosensitivity and legibility, and both of those are properties of
// rapid BRIGHTNESS swings. It used to be multiplied into the phase tint as well, which meant a
// fast run also came out desaturated — the object appeared to fade rather than to flash more
// gently, which is not the same thing and is not what anyone wanted. So this pins the split
// directly on the RENDERED PIXELS, not just on the intermediate numbers: at slider 1 and slider
// 100, with the escalation held identical, every cube's material colour must come out
// BYTE-IDENTICAL while the highlight must fall.
const speedColour = await page.evaluate(() => {
  // Make the two samples comparable at all. The renderer's tint and highlight are one-pole
  // FILTERS whenever the controller is live, so sampling twice in a row while a settle window
  // from an earlier check is still painting compares "partway to the target" against "further
  // along toward the same target" — a difference in how long the filter has run, not in speed.
  // Park the controller and clear the filter state before each render so both samples land
  // exactly on their targets, which is what the assertion below is actually about.
  currentRunId++; sha3.running = false;
  // ...and park the CLOSED LOOP too. This check is about the feed-forward relationship between
  // playback speed and brightness (sha3FlashGain), and about the fact that it does not touch
  // colour. The measured governor is a separate mechanism with its own tests: leaving it holding
  // a hard cap from an earlier check clamps BOTH samples to the same ceiling and makes the
  // brightness half of the comparison meaningless — the slow sample reads the cap, not the gain.
  sha3Gov.hiCap = Infinity; sha3Gov.tintCap = Infinity; sha3Gov.gain = 1; sha3Gov.tau = 0;
  sha3Pace.ema = 1e9; sha3Pace.relFrom = 0;
  const sample = v => {
    sha3.tintAmtS = undefined; sha3.tintColS = null;
    sha3.lanes.forEach(L => { if (L.hiS) L.hiS.fill(0); });
    document.getElementById('speed-slider').value = String(v);
    sha3.roundsInBlock = 10; sha3.blocksDone = 0;   // identical escalation at both speeds
    const dur = sha3PhaseDuration('theta');
    sha3.flashType = 'theta'; sha3.flashP = 0.5;
    sha3.flashGain = sha3FlashGain(dur);
    sha3.flashEsc = 1 - 1 / sha3Intensity();
    sha3.lanes.forEach(L => { L.glow = 0.5; });
    sha3Render();
    return {
      dur, gain: sha3.flashGain, tint: __sha3Debug.juice().flashTint,
      cols: sha3.lanes.map(L => L.lastCol.map(c => Math.round(c * 1000) / 1000)),
      maxHi: Math.max(...sha3.lanes.map(L => L.lastHi)),
    };
  };
  const slow = sample(1), fast = sample(100);
  sha3.flashType = null; sha3.flashEsc = 0; sha3.roundsInBlock = 0;
  sha3.lanes.forEach(L => { L.glow = 0; });
  document.getElementById('speed-slider').value = '50'; sha3Render();
  return { slow, fast };
});
if (!(speedColour.fast.dur < speedColour.slow.dur * 0.5)) {
  throw new Error(`the two samples must genuinely differ in speed, got ${speedColour.slow.dur}ms vs ${speedColour.fast.dur}ms`);
}
if (speedColour.slow.tint !== speedColour.fast.tint) {
  throw new Error(`the phase TINT must not depend on playback speed: ${speedColour.slow.tint} at slider 1 vs ${speedColour.fast.tint} at slider 100`);
}
const colourDrift = Math.max(...speedColour.slow.cols.map((c, i) =>
  Math.max(...c.map((v, j) => Math.abs(v - speedColour.fast.cols[i][j])))));
if (colourDrift !== 0) {
  throw new Error(`cube COLOUR must be identical at every speed — a fast run must not look washed out. Max per-channel drift slider 1 vs 100: ${colourDrift}`);
}
if (!(speedColour.fast.maxHi < speedColour.slow.maxHi * 0.6)) {
  throw new Error(`...while the BRIGHTNESS spike must still fall with speed: ${speedColour.slow.maxHi} -> ${speedColour.fast.maxHi}`);
}
console.log(`OK  speed changes brightness ONLY: at the same escalation, slider 1 -> 100 leaves every cube's colour byte-identical (tint ${speedColour.slow.tint.toFixed(3)} both) while the highlight falls ${speedColour.slow.maxHi.toFixed(3)} -> ${speedColour.fast.maxHi.toFixed(3)}`);

// ---- the phase hue must NEVER cost the rate/capacity read ----
//
// THIS TEST IS THE GUARANTEE, not a confirmation of one. The tint used to be a plain affine mix
// applied identically to every cube, which compressed the gold/grey warmth gap by exactly (1-t)
// and therefore could not invert or cross it at any depth — a proof, needing no measurement. It
// is no longer affine: sha3TintAt renormalises each cube back onto its own pre-tint luminance, so
// the map is per-cube and nonlinear, and the ordering is an empirical property of the palette and
// the five phase hues. Measured, it shows: the affine version left exactly 38% of the at-rest gap
// at t = 0.62, i.e. (1-t); the renormalised one leaves 42%. Close, different, and no longer
// derivable. So this runs on real hashed state at the worst case on every knob — full gain, tint
// at its crest, every lane glowing, escalation fully open so the depth is SHA3_TINT_MAX — and it
// is what decides whether a change to the tint depth, the hues or the renormalisation is safe.
//
// UPDATED for the deliberately much more prominent tint (0.14/0.32 -> 0.34/0.62). Two changes,
// and the net is a STRONGER statement than before, not a weaker one:
//
//   * the FILL-gap floor is now stated against the measurement instead of a round number. At
//     t = SHA3_TINT_MAX = 0.62 roughly (1-t) of the gap survives — 38% under the old affine mix,
//     42% as actually drawn — so the old "> 50% of the gap at rest" was unsatisfiable at the new
//     depth by definition of the change, not by regression. The floor is 0.30, which leaves real
//     room below the ~0.40 measured, so a genuine regression (a tint that stopped being uniform,
//     a hue that dragged one family harder than the other) still trips it.
//   * a second, UNCOMPRESSED channel is asserted: the box outlines. They are drawn from the fill
//     pulled SHA3_EDGE_IDENTITY of the way back to the lane's own untinted material, so their
//     gap must survive at essentially its full at-rest value at every tint depth. That is a
//     property the old renderer did not have and could not have been asserted of.
//
// The load-bearing assertion in both cases is the STRICT ORDERING — every rate lane warmer than
// every capacity lane — which is what "which 17 lanes are gold" actually depends on.
const FILL_GAP_FLOOR = 0.30;   // see above: the maths predicts 0.38 at SHA3_TINT_MAX
const EDGE_GAP_FLOOR = 0.60;   // the edge channel keeps most of the gap at any tint depth
const legibility = await page.evaluate(() => {
  const gold = c => c[0] - c[2];      // warmth: gold lanes are warm, capacity lanes neutral/cool
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sample = (type) => {
    // WORST CASE on every knob: full speed-gain, tint at its crest, and the escalation fully
    // opened up so the tint sits at SHA3_TINT_MAX rather than SHA3_TINT_MIN.
    sha3.flashType = type; sha3.flashP = 0.5; sha3.flashGain = 1; sha3.flashEsc = 1;
    sha3.lanes.forEach(L => { L.glow = type ? 0.9 : 0; });
    sha3Render();
    const rate = [], cap = [], rateE = [], capE = [];
    sha3.lanes.forEach(L => {
      (L.isRate ? rate : cap).push(gold(L.lastCol));
      (L.isRate ? rateE : capE).push(gold(L.lastEdge));
    });
    return { worstRate: Math.min(...rate), bestCap: Math.max(...cap), gap: mean(rate) - mean(cap),
             worstRateEdge: Math.min(...rateE), bestCapEdge: Math.max(...capE),
             edgeGap: mean(rateE) - mean(capE),
             tint: sha3.tintAmtS };
  };
  // Start from a genuinely untinted lattice. The tint now RELEASES on a time constant when no
  // phase is active (SHA3_TINT_OFF_TAU) rather than snapping to zero, so an earlier check in
  // this file that left a tint standing would otherwise still be decaying into this sample. On
  // the real page sha3Stop zeroes it at the end of every run; here we do the same by hand.
  sha3.tintAmtS = 0; sha3.tintColS = null;
  const out = { rest: sample(null) };
  for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) out[t] = sample(t);
  sha3.flashType = null; sha3.flashEsc = 0; sha3.lanes.forEach(L => { L.glow = 0; });
  sha3.tintAmtS = 0; sha3.tintColS = null; sha3Render();
  return out;
});
for (const [t, r] of Object.entries(legibility)) {
  if (!(r.worstRate > r.bestCap)) {
    throw new Error(`during ${t} the rate and capacity lanes overlap in FILL warmth (worst rate ${r.worstRate.toFixed(1)} <= best capacity ${r.bestCap.toFixed(1)}) — "which 17 lanes are gold" must stay answerable at every phase`);
  }
  if (!(r.worstRateEdge > r.bestCapEdge)) {
    throw new Error(`during ${t} the rate and capacity lanes overlap in EDGE warmth (worst rate ${r.worstRateEdge.toFixed(1)} <= best capacity ${r.bestCapEdge.toFixed(1)})`);
  }
  if (!(r.gap > legibility.rest.gap * FILL_GAP_FLOOR)) {
    throw new Error(`during ${t} the rate/capacity FILL gap collapsed to ${r.gap.toFixed(1)} from ${legibility.rest.gap.toFixed(1)} at rest (floor ${(FILL_GAP_FLOOR * 100)}%; a tint of depth ${r.tint.toFixed(2)} should leave roughly ${((1 - r.tint) * 100).toFixed(0)}%)`);
  }
  if (!(r.edgeGap > legibility.rest.edgeGap * EDGE_GAP_FLOOR)) {
    throw new Error(`during ${t} the rate/capacity EDGE gap collapsed to ${r.edgeGap.toFixed(1)} from ${legibility.rest.edgeGap.toFixed(1)} at rest — the outline channel is supposed to be the one the tint cannot consume`);
  }
}
// The tint must actually BE prominent — this is the owner-requested change, so assert the
// depth rather than only asserting that it did no harm.
const litTints = Object.entries(legibility).filter(([t]) => t !== 'rest').map(([, r]) => r.tint);
if (!(Math.min(...litTints) > 0.55)) {
  throw new Error(`the phase tint is supposed to substantially override the block colour: deepest-escalation crest measured only ${Math.min(...litTints).toFixed(3)}`);
}
if (!(legibility.rest.tint === 0)) throw new Error(`the lattice at rest must be untinted, measured ${legibility.rest.tint}`);
console.log(`OK  phase tint reaches ${Math.min(...litTints).toFixed(2)} of the way to the phase hue (was 0.32) and every rate lane still stays warmer than every capacity lane through all five tints — fill gap ${legibility.rest.gap.toFixed(1)} at rest -> worst ${Math.min(...Object.entries(legibility).filter(([t]) => t !== 'rest').map(([, r]) => r.gap)).toFixed(1)} tinted; edge gap ${legibility.rest.edgeGap.toFixed(1)} -> ${Math.min(...Object.entries(legibility).filter(([t]) => t !== 'rest').map(([, r]) => r.edgeGap)).toFixed(1)}`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('All Task 4 (SHA-3 animation controller) checks passed.');
await browser.close();
