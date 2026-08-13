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

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('All Task 4 (SHA-3 animation controller) checks passed.');
await browser.close();
