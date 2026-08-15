// PHOTOSENSITIVITY MEASUREMENT — FNAC intro creep sequence.
//
// Not the hash module's flash governor (tools/verify_flash_safety.mjs); that one tests a
// self-limiting animation. This one tests a fixed, scripted scare, and its job is to answer one
// question with pixels rather than opinion: how fast does the screen actually flash, and how big
// is the luminance excursion when it does?
//
// Method:
//   * drive the REAL sequence through the page's own entry point (window.__creep.start()) —
//     nothing here reimplements the timeline;
//   * sample the composited screen with page.screenshot() as fast as the browser will give
//     frames, and record the wall-clock instant of each sample (the achieved sampling interval
//     is reported, so a slow sampler is visible as a caveat rather than hidden as a result);
//   * score the frames with tools/flash_analysis.mjs — the same WCAG 2.3.1/2.3.2 implementation
//     the hash module is held to, imported read-only, so the numbers are comparable;
//   * measure over TILES, not the whole screen. WCAG's threshold applies to a flashing area
//     larger than 25% of a 10-degree field, ~87,000px^2. On this 1100x950 viewport a 3x3 tiling
//     gives ~366x316 = ~116,000px^2 tiles, i.e. the standard's own unit; a 4x4 tiling (~65,000
//     px^2) is measured as well, finer than the standard requires, because the bright thing on
//     screen is a pair of eyes and a coarse mean would dilute them.
//
// Runs the default path and the prefers-reduced-motion path, and checks the hard audio cut.
import { chromium } from 'playwright';
import { relLum, findFlashes, peakRate, redRatio, RED_SAT } from './flash_analysis.mjs';

const BASE_URL = process.env.FNAC_MODULE_URL || 'http://localhost:8815/public/crypto/fnac/';
const FLASH_BOUND_PER_SECOND = 3;   // WCAG's bound. Not a tuning knob.
const VIEW = { width: 1100, height: 950 };

const fails = [];
const check = (label, ok, detail) => {
  if (ok) console.log(`OK  ${label}${detail ? ' — ' + detail : ''}`);
  else { console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`); fails.push(label); }
};

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required',
         '--disable-renderer-backgrounding',
         '--disable-backgrounding-occluded-windows',
         '--disable-features=CalculateNativeWinOcclusion']
});

// A scratch page whose only job is to turn PNG buffers into tile means. Keeps the measurement
// dependency-free (no image library) while still reading real decoded pixels.
const decoder = await browser.newPage();
await decoder.goto('about:blank');
async function tileMeans(buffers, cols, rows) {
  const out = [];
  for (const b of buffers) {
    out.push(await decoder.evaluate(async ({ b64, cols, rows }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const tiles = [];
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const x = Math.floor(rx * img.width / cols), y = Math.floor(ry * img.height / rows);
          const w = Math.floor((rx + 1) * img.width / cols) - x;
          const h = Math.floor((ry + 1) * img.height / rows) - y;
          const d = ctx.getImageData(x, y, w, h).data;
          let r = 0, g = 0, bl = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
          const n = d.length / 4;
          tiles.push([r / n, g / n, bl / n]);
        }
      }
      return tiles;
    }, { b64: b.toString('base64'), cols, rows }));
  }
  return out;
}

async function newPage(reduced) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    reducedMotion: reduced ? 'reduce' : 'no-preference'
  });
  await ctx.addCookies([{ name: 'ctf-fnac-creep', value: '0', url: BASE_URL }]);
  const page = await ctx.newPage();
  // FNAC's gate is now "Caesar + XOR + Encoding all complete", mirrored by the confetti engine
  // into localStorage — no unlock cookie any more. Seed it so the module renders for the run.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ctf-complete:v1', JSON.stringify({
        caesar: { c: true, n: 7, t: 7 }, xor: { c: true, n: 4, t: 4 }, encoding: { c: true, n: 6, t: 6 }
      }));
      // ...and mark the one-shot unlock drop as already played. Seeding the gate above is what
      // makes an unlocked page, which is also what makes the drop fire, and a board swinging
      // across the frame during THIS recording would put a second large-area animation in the
      // same numbers. The baseline these figures are compared against was measured without it,
      // so the creep sequence is measured alone, as it always was.
      localStorage.setItem('ctf-fnac-reveal:v1', '1');
    } catch (e) {}
  });
  const errs = [];
  // same-origin errors only — an external font request that flakes is not this page's bug
  const origin = new URL(BASE_URL).origin;
  page.on('console', m => { if (m.type() === 'error' && (m.location().url || origin).startsWith(origin)) errs.push(m.text() + ' @' + (m.location().url || '')); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE_URL + '?v=flash' + Date.now());
  await page.waitForFunction(() => !!window.__creep, { timeout: 8000 });
  return { page, ctx, errs };
}

// Record the sequence: start it, then screenshot in a tight loop until it finishes.
async function record(reduced) {
  const { page, ctx, errs } = await newPage(reduced);
  const frames = [], times = [];
  const t0 = Date.now();
  await page.evaluate(() => window.__creep.start());
  const total = await page.evaluate(() => {
    const C = window.__creep.CREEP;
    const flicker = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? C.FADE : C.FLICKER_CYCLES * C.FLICKER_OFF + (C.FLICKER_CYCLES - 1) * C.FLICKER_ON;
    return flicker + C.HOLD + C.EYES + C.RESTORE;
  });
  while (Date.now() - t0 < total + 400) {
    const t = Date.now() - t0;
    frames.push(await page.screenshot({ type: 'png' }));
    times.push(t);
  }
  const log = await page.evaluate(() => window.__creep.log());
  const audio = await page.evaluate(() => {
    const a = window.__creep.audio();
    const s = a.scare;
    return s ? { paused: s.paused, currentTime: s.currentTime, duration: s.duration } : null;
  });
  await ctx.close();
  return { frames, times, log, audio, errs, total };
}

function score(frames, times, tiles, label) {
  const series = [];
  for (let i = 0; i < tiles[0].length; i++) series.push([]);
  tiles.forEach((tileRow, f) => tileRow.forEach((rgb, i) => series[i].push({ t: times[f], l: relLum(rgb) })));
  let worstRate = { peak: 0 }, worstExc = 0, worstRed = 0, worstPace = 0;
  series.forEach(s => {
    const fl = findFlashes(s);
    const r = peakRate(fl.map(f => f.t));
    if (r.peak > worstRate.peak) worstRate = r;
    // AMPLITUDE-INDEPENDENT pace: the same flash-pair logic run at a 0.03 threshold, i.e. every
    // visible light/dark cycle whether or not it is big enough to be a WCAG flash. This is the
    // number that says the flicker is paced under 3/sec by construction, not by being dim.
    worstPace = Math.max(worstPace, peakRate(findFlashes(s, 0.03, 1.0).map(f => f.t)).peak);
    let lo = Infinity, hi = -Infinity;
    s.forEach(p => { lo = Math.min(lo, p.l); hi = Math.max(hi, p.l); });
    worstExc = Math.max(worstExc, hi - lo);
  });
  // R/(R+G+B) is degenerate on near-black tiles (a single stray red LSB reads as 1.0 while the
  // tile is invisible), so saturation is only meaningful where there is light to be red.
  tiles.forEach((row, f) => row.forEach(rgb => {
    if (relLum(rgb) >= 0.02) worstRed = Math.max(worstRed, redRatio(rgb));
  }));
  const whole = times.map((t, f) => {
    const row = tiles[f];
    const m = row.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => v / row.length);
    return { t, l: relLum(m) };
  });
  const wholeFl = findFlashes(whole);
  const wholeRate = peakRate(wholeFl.map(f => f.t));
  let wlo = Infinity, whi = -Infinity;
  whole.forEach(p => { wlo = Math.min(wlo, p.l); whi = Math.max(whi, p.l); });
  console.log(`  [${label}] worst tile: ${worstRate.peak} WCAG flashes/sec, ${worstPace} light/dark cycles/sec at a 0.03 threshold, peak luminance excursion ${worstExc.toFixed(4)}`);
  console.log(`  [${label}] whole screen: ${wholeRate.peak} flashes/sec, excursion ${(whi - wlo).toFixed(4)} (min ${wlo.toFixed(4)}, max ${whi.toFixed(4)}), max red ratio on lit tiles ${worstRed.toFixed(3)}`);
  return { worstRate: worstRate.peak, worstPace, worstExc, wholeRate: wholeRate.peak, wholeExc: whi - wlo, worstRed };
}

for (const reduced of [false, true]) {
  const name = reduced ? 'prefers-reduced-motion' : 'default';
  console.log(`\n=== ${name} ===`);
  // A starved sampler produces ALIASED numbers, not conservative ones: a run recorded at 6Hz
  // once reported 4 cycles/sec for the same 2.67/sec page. So the recording is retried until the
  // sampler is demonstrably faster than the shortest held state, and only then scored. This is a
  // property of the measuring instrument, not of the page.
  const sampleBound = reduced ? 300 : 180;   // each path's own shortest event
  let rec = null, gaps = null, attempts = 0;
  while (attempts++ < 6) {
    const r = await record(reduced);
    const g = r.times.slice(1).map((t, i) => t - r.times[i]).sort((a, b) => a - b);
    if (!rec || g[g.length - 1] < gaps[gaps.length - 1]) { rec = r; gaps = g; }  // keep the BEST
    if (gaps[gaps.length - 1] < sampleBound) break;
    console.log(`  (starved recording: slowest sampling gap ${g[g.length - 1]}ms, retrying)`);
  }
  const { frames, times, log, audio, errs, total } = rec;
  const median = gaps[Math.floor(gaps.length / 2)];
  console.log(`  ${frames.length} frames over ${times[times.length - 1]}ms; sampling interval min ${gaps[0]}ms / median ${median}ms / max ${gaps[gaps.length - 1]}ms (~${(1000 / median).toFixed(1)}Hz)`);
  // The instrument is guarded on BOTH paths, at each path's own shortest event: 180ms held
  // flicker states by default, 600ms fades under reduced motion. A starved recording must
  // announce itself rather than score silently — an aliased number is worse than no number.
  check(`${name}: sampler is faster than this path's shortest event (< ${sampleBound}ms)`,
    gaps[gaps.length - 1] < sampleBound, `slowest gap ${gaps[gaps.length - 1]}ms`);

  const t3 = await tileMeans(frames, 3, 3);
  const s3 = score(frames, times, t3, '3x3, WCAG unit');
  const t4 = await tileMeans(frames, 4, 4);
  const s4 = score(frames, times, t4, '4x4, finer than required');
  // An 8x8 probe (~137x119px, ~1.9% of a 10-degree field) is far below anything WCAG 2.3.1
  // bounds by area, and is measured only to get an honest PACE number: at 3x3/4x4 the flicker
  // is diluted under every threshold, so a rate of 0 there says "too small to see", not "slow".
  // At 8x8 the flicker IS resolved, and this is where the "flashes per second we ship" figure
  // comes from. Its amplitude is deliberately NOT asserted.
  const t8 = await tileMeans(frames, 8, 8);
  const s8 = score(frames, times, t8, '8x8, pace probe (sub-threshold area)');
  check(`${name}: resolved flicker pace at the 8x8 probe stays under 3/sec`,
    s8.worstPace <= FLASH_BOUND_PER_SECOND, `${s8.worstPace} light/dark cycles/sec, worst-tile excursion ${s8.worstExc.toFixed(4)}`);

  check(`${name}: WCAG 2.3.1 general flash rate at the standard's own spatial unit`,
    s3.worstRate <= FLASH_BOUND_PER_SECOND, `${s3.worstRate} <= ${FLASH_BOUND_PER_SECOND}`);
  check(`${name}: general flash rate at a finer 4x4 probe`,
    s4.worstRate <= FLASH_BOUND_PER_SECOND, `${s4.worstRate} <= ${FLASH_BOUND_PER_SECOND}`);
  check(`${name}: light/dark cycles stay under 3/sec regardless of amplitude`,
    Math.max(s3.worstPace, s4.worstPace) <= FLASH_BOUND_PER_SECOND,
    `worst ${Math.max(s3.worstPace, s4.worstPace)} cycles/sec`);
  // 2.3.2 needs a flash PAIR to exist before saturated red matters; there are none. The ratio is
  // reported anyway, measured only over tiles with light in them.
  check(`${name}: no saturated red on any lit tile (2.3.2 has nothing to bite on)`,
    Math.max(s3.worstRed, s4.worstRed) < RED_SAT, `max R/(R+G+B) ${Math.max(s3.worstRed, s4.worstRed).toFixed(3)}`);

  // phase timing, from the page's own timestamped log
  const at = p => { const e = log.find(x => x.phase === p); return e ? e.t : null; };
  const base = at('flicker');
  const rel = p => at(p) === null ? null : at(p) - base;
  console.log(`  phase log (ms from start): dark ${rel('dark')}, eyes ${rel('eyes')}, restore ${rel('restore')}, done ${rel('done')}`);
  if (!reduced) {
    check('flicker-to-dark is ~2s', Math.abs(rel('dark') - 1920) < 120, `${rel('dark')}ms`);
    check('dark hold is 2s', Math.abs((rel('eyes') - rel('dark')) - 2000) < 120, `${rel('eyes') - rel('dark')}ms`);
    check('eyes phase is 7.8s', Math.abs((rel('restore') - rel('eyes')) - 7800) < 150, `${rel('restore') - rel('eyes')}ms`);
  }
  if (audio) {
    console.log(`  scare.mp3: paused=${audio.paused} currentTime=${audio.currentTime?.toFixed(2)}s duration=${audio.duration?.toFixed(1)}s`);
    if (audio.duration && audio.currentTime > 0.1) {
      check(`${name}: scare audio hard-cut at 7.8s`,
        audio.paused && Math.abs(audio.currentTime - 7.8) < 0.35, `paused=${audio.paused} at ${audio.currentTime.toFixed(2)}s`);
    } else {
      console.log('  NOTE: audio never advanced in this browser (no output device / codec) — the ' +
                  'cut is still driven by the same timer, and the visual timeline above is unaffected.');
    }
  }
  check(`${name}: no console errors`, errs.length === 0, errs.join(' | '));
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES:\n - ` + fails.join('\n - ') : '\nall flash-safety checks passed');
process.exit(fails.length ? 1 : 0);
