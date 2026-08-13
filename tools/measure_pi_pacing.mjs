// Reporting helper (not an assertion): measures pi's per-lane slide windows as the page actually
// computes them, by driving sha3PhaseProgress over a dense sweep of the phase clock and watching
// each lane's drawn position leave its old slot and arrive at its new one.
//
// Reports, per slider position: pi's duration and its share of a round, the geometric alias
// factor, each lane's transit start/end in wall-clock ms, the spread and evenness of the starts,
// and the maximum number of lanes simultaneously mid-transit.
import { chromium } from 'playwright';
const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE_URL + '?v=pipace' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 8000 });

const out = await page.evaluate(() => {
  const order = ['theta', 'rho', 'pi', 'chi', 'iota'];
  const STEPS = 4000;
  const measure = (v) => {
    document.getElementById('speed-slider').value = String(v);
    document.getElementById('speed-slider').dispatchEvent(new Event('input'));
    sha3.blocksDone = 0; sha3.roundsInBlock = 0;
    const durs = {}; let round = 0;
    for (const t of order) { durs[t] = sha3PhaseDuration(t); round += durs[t]; }
    const piMs = durs.pi;

    // arm a real pi transit: every lane moves to its pi image
    const save = sha3.lanes.map(L => [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.radMag, L.radDirX, L.radDirY]);
    sha3.lanes.forEach(L => {
      L.prevSx = L.sx; L.prevSy = L.sy;
      const [nx, ny] = KECCAK_PI_LANE_MAP[L.sx][L.sy]; L.sx = nx; L.sy = ny;
      sha3ArmRadial(L);
    });

    const start = new Array(sha3.lanes.length).fill(null);
    const end = new Array(sha3.lanes.length).fill(null);
    // Separation is reported in TWO REGIMES, because they are different claims.
    //  * SLIDE (lift == 1, the plateau) — the load-bearing one. Lanes are travelling between
    //    slots here, and the depth sort's precondition is that no two are ever co-located.
    //  * RAMP (lift ramping through the rise and the drop) — lanes are stationary over their own
    //    slots and only the fan-out is opening or closing. Layers necessarily pass THROUGH each
    //    other's depth there, because the shelf order is not the slot order; that is what a
    //    centred fan-out IS, it is pre-existing, and a near-zero here is expected, not a defect.
    let maxSimul = 0, minSep = Infinity, minSepSlide = Infinity;
    const EPS = 1e-4;
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      sha3PhaseProgress({ type: 'pi' }, p);
      let inMotion = 0;
      const pos = [];
      sha3.lanes.forEach((L, k) => {
        const dx = L.sx - L.prevSx, dy = L.sy - L.prevSy;
        const den = Math.abs(dx) + Math.abs(dy);
        let s = 0;
        if (den > 0) s = (Math.abs(L.fx - L.prevSx) + Math.abs(L.fy - L.prevSy)) / den;
        if (den > 0) {
          if (s > EPS && start[k] === null) start[k] = p;
          if (s >= 1 - EPS && end[k] === null && start[k] !== null) end[k] = p;
          if (s > EPS && s < 1 - EPS) inMotion++;
        }
        pos.push(sha3LaneWorldXY(L, L.fx, L.fy, L.lift * L.radMag));
      });
      if (inMotion > maxSimul) maxSimul = inMotion;
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
        if (d < minSep) minSep = d;
        if (sha3.lanes[0].lift >= 1 - 1e-12 && d < minSepSlide) minSepSlide = d;
      }
    }
    sha3.lanes.forEach((L, i) => {
      [L.sx, L.sy, L.prevSx, L.prevSy, L.fx, L.fy, L.lift, L.radMag, L.radDirX, L.radDirY] = save[i];
    });

    const movers = start.map((s, k) => (s === null ? null : k)).filter(k => k !== null);
    // starts, in the order lanes actually begin moving
    // DISTINCT start instants — lanes that move together as a group are one event, and the
    // evenness question is about the spacing of EVENTS, not of lanes.
    const uniq = [...new Set(movers.map(k => Math.round(start[k] * 1e6) / 1e6))].sort((a, b) => a - b);
    const sMs = uniq.map(v => v * piMs);
    const eMs = movers.map(k => (end[k] === null ? 1 : end[k]) * piMs).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sMs.length; i++) gaps.push(sMs[i] - sMs[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / (gaps.length || 1));
    return {
      slider: v, piMs, roundMs: round, piShare: piMs / round,
      aliasGeo: sha3AliasGeo(), roundRate: sha3RoundRate(),
      movers: movers.length, events: sMs.length, maxSimul, minSep, minSepSlide,
      firstStart: sMs[0], lastStart: sMs[sMs.length - 1],
      startSpreadMs: sMs[sMs.length - 1] - sMs[0],
      gapMeanMs: mean, gapSdMs: sd, gapMinMs: Math.min(...gaps), gapMaxMs: Math.max(...gaps),
      gapCv: mean > 0 ? sd / mean : 0,
      windowMeanMs: movers.reduce((a, k) => a + ((end[k] === null ? 1 : end[k]) - start[k]) * piMs, 0) / movers.length,
      lastEnd: eMs[eMs.length - 1],
    };
  };
  const res = [];
  for (const v of [1, 10, 25, 50, 68, 75, 90, 100]) res.push(measure(v));
  document.getElementById('speed-slider').value = '50';
  document.getElementById('speed-slider').dispatchEvent(new Event('input'));
  return res;
});

console.log('slider  piMs  round  pi%   aliasGeo  movers maxSimul  startSpread  gapMean±sd (CV)      window  sepSlide  sepAny');
for (const r of out) {
  console.log(
    `${String(r.slider).padStart(5)}  ${r.piMs.toFixed(0).padStart(5)}  ${r.roundMs.toFixed(0).padStart(5)}  ` +
    `${(r.piShare * 100).toFixed(1).padStart(4)}%  ${r.aliasGeo.toFixed(3).padStart(7)}  ` +
    `${String(r.movers).padStart(3)}/${String(r.events)}  ${String(r.maxSimul).padStart(8)}  ` +
    `${r.startSpreadMs.toFixed(1).padStart(10)}ms  ` +
    `${r.gapMeanMs.toFixed(2).padStart(7)}±${r.gapSdMs.toFixed(2).padStart(6)} (${r.gapCv.toFixed(3)})  ` +
    `${r.windowMeanMs.toFixed(1).padStart(7)}ms  ${r.minSepSlide.toFixed(4)}  ${r.minSep.toFixed(4)}`);
}
await browser.close();
