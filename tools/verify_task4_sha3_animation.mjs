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
await page.click('#algo-next'); // switch to SHA-3
await page.fill('#input-custom', INPUT);
await page.locator('#lane-canvas').scrollIntoViewIfNeeded();

// ============================================================================================
//  PASS 1 — slow speed, sampling live state: capacity fill, pi persistence, phase indicators
// ============================================================================================
await page.locator('#speed-slider').evaluate(el => { el.value = '18'; el.dispatchEvent(new Event('input')); });

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
const spinSet = new Set(lanes.map(l => Math.round((l.spinTarget % 360 + 360) % 360)));
if (spinSet.size < 5) {
  throw new Error(`per-lane rho rotations are not distinct enough: only ${spinSet.size} distinct angles across 25 lanes`);
}
console.log(`OK  per-lane rho rotations are genuinely different (${spinSet.size} distinct angles across 25 lanes)`);

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

// ---- the phase hue must NEVER cost the rate/capacity read ----
// The tint is applied uniformly to every cube precisely so this holds by construction (an affine
// map compresses the gold/grey gap but cannot cross it). This checks the rendered result anyway,
// on real hashed state, at the worst case: full gain, tint at its crest, every lane glowing.
const legibility = await page.evaluate(() => {
  const gold = c => c[0] - c[2];      // warmth: gold lanes are warm, capacity lanes neutral/cool
  const sample = (type) => {
    // WORST CASE on every knob: full speed-gain, tint at its crest, and the escalation fully
    // opened up so the tint sits at SHA3_TINT_MAX rather than SHA3_TINT_MIN.
    sha3.flashType = type; sha3.flashP = 0.5; sha3.flashGain = 1; sha3.flashEsc = 1;
    sha3.lanes.forEach(L => { L.glow = type ? 0.9 : 0; });
    sha3Render();
    const rate = [], cap = [];
    sha3.lanes.forEach(L => (L.isRate ? rate : cap).push(gold(L.lastCol)));
    return { worstRate: Math.min(...rate), bestCap: Math.max(...cap),
             gap: rate.reduce((a, b) => a + b, 0) / rate.length - cap.reduce((a, b) => a + b, 0) / cap.length };
  };
  const out = { rest: sample(null) };
  for (const t of ['theta', 'rho', 'pi', 'chi', 'iota']) out[t] = sample(t);
  sha3.flashType = null; sha3.flashEsc = 0; sha3.lanes.forEach(L => { L.glow = 0; }); sha3Render();
  return out;
});
for (const [t, r] of Object.entries(legibility)) {
  if (!(r.worstRate > r.bestCap)) {
    throw new Error(`during ${t} the rate and capacity lanes overlap in warmth (worst rate ${r.worstRate.toFixed(1)} <= best capacity ${r.bestCap.toFixed(1)}) — "which 17 lanes are gold" must stay answerable at every phase`);
  }
  if (!(r.gap > legibility.rest.gap * 0.5)) {
    throw new Error(`during ${t} the rate/capacity colour gap collapsed to ${r.gap.toFixed(1)} from ${legibility.rest.gap.toFixed(1)} at rest`);
  }
}
console.log(`OK  every rate lane stays warmer than every capacity lane through all five phase tints (gap at rest ${legibility.rest.gap.toFixed(1)}, worst phase ${Math.min(...Object.values(legibility).map(r => r.gap)).toFixed(1)})`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('All Task 4 (SHA-3 animation controller) checks passed.');
await browser.close();
