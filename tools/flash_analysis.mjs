// WCAG 2.3.1 / 2.3.2 flash analysis, run over a series of MEASURED frames.
//
// Input is what public/crypto/hash/index.html's flash meter records: rows of
//   { t: <page clock ms>, tiles: [[r,g,b], ...] }
// one row per painted frame, one tile per measured patch of screen. Nothing here models the
// animation; it only reads pixels that were actually painted.
//
// Definitions used, straight from the standard:
//   general flash — "a pair of opposing changes in relative luminance of 10% or more of the
//                    maximum relative luminance, where the relative luminance of the darker
//                    image is below 0.80". Max relative luminance is 1.0, so the threshold is
//                    an absolute 0.10 change.
//   red flash     — the same pair where either state is a "saturated red", defined as
//                    R/(R+G+B) >= 0.8 on the linearised channels.
//   the bound     — no more than THREE flashes in any one-second period.

export const FLASH_THRESHOLD = 0.10;   // relative-luminance change that counts as a transition
export const DARK_LIMIT = 0.80;        // pairs only count when the darker state is below this
export const RED_SAT = 0.8;            // R/(R+G+B) at or above this is a "saturated red"

const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export function relLum([r, g, b]) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
export function redRatio([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b), s = R + G + B;
  return s <= 1e-9 ? 0 : R / s;
}

// One patch's luminance series -> the timestamps at which a WCAG flash completed.
// A flash completes on the SECOND of two opposing >=threshold transitions, so the returned time
// is the instant the pair became a flash.
export function findFlashes(series, threshold = FLASH_THRESHOLD, darkLimit = DARK_LIMIT) {
  const out = [];
  if (series.length < 2) return out;
  let ext = series[0].l, lastDir = 0, extT = series[0].t;
  for (let i = 1; i < series.length; i++) {
    const s = series[i];
    const d = s.l - ext;
    if (Math.abs(d) >= threshold) {
      const dir = d > 0 ? 1 : -1;
      if (lastDir !== 0 && dir === -lastDir && Math.min(s.l, ext) < darkLimit) {
        out.push({ t: s.t, from: ext, to: s.l, fromT: extT, delta: Math.abs(d) });
      }
      lastDir = dir; ext = s.l; extT = s.t;
    } else if (lastDir > 0) { if (s.l > ext) { ext = s.l; extT = s.t; } }
    else if (lastDir < 0) { if (s.l < ext) { ext = s.l; extT = s.t; } }
    else { ext = s.l; extT = s.t; }
  }
  return out;
}

// Worst count of flashes in any rolling one-second window.
export function peakRate(flashTimes) {
  let peak = 0, at = 0;
  for (let i = 0; i < flashTimes.length; i++) {
    let n = 0;
    for (let j = i; j < flashTimes.length && flashTimes[j] - flashTimes[i] < 1000; j++) n++;
    if (n > peak) { peak = n; at = flashTimes[i]; }
  }
  return { peak, at };
}

// Full report over every patch of a recorded run.
export function analyse(rows, opts = {}) {
  const threshold = opts.threshold === undefined ? FLASH_THRESHOLD : opts.threshold;
  if (!rows.length) throw new Error('flash analysis got no frames — the meter never sampled anything');
  const nTiles = rows[0].tiles.length;
  const per = [];
  let worst = { peak: 0, tile: -1, at: 0 };
  let maxDelta = 0, maxLum = 0, minLum = 1, maxRed = 0, maxRedDelta = 0;
  for (let k = 0; k < nTiles; k++) {
    const series = rows.map(r => ({ t: r.t, l: relLum(r.tiles[k]) }));
    for (const s of series) { if (s.l > maxLum) maxLum = s.l; if (s.l < minLum) minLum = s.l; }
    const flashes = findFlashes(series, threshold);
    for (const f of flashes) if (f.delta > maxDelta) maxDelta = f.delta;
    const { peak, at } = peakRate(flashes.map(f => f.t));
    per.push({ tile: k, flashes: flashes.length, peak });
    if (peak > worst.peak) worst = { peak, tile: k, at };
    // red channel: worst saturation reached, and the worst swing in linear red across a
    // one-frame-to-next step (the channel WCAG's red-flash test is written against)
    let prevR = null;
    for (const r of rows) {
      const rr = redRatio(r.tiles[k]);
      if (rr > maxRed) maxRed = rr;
      const R = lin(r.tiles[k][0]);
      if (prevR !== null && Math.abs(R - prevR) > maxRedDelta) maxRedDelta = Math.abs(R - prevR);
      prevR = R;
    }
  }
  const span = (rows[rows.length - 1].t - rows[0].t) / 1000;
  return {
    frames: rows.length, seconds: span, fps: rows.length / Math.max(1e-6, span),
    tiles: nTiles, per, worstPeakPerSecond: worst.peak, worstTile: worst.tile,
    maxFlashDelta: maxDelta, maxLum, minLum, lumRange: maxLum - minLum,
    maxRedRatio: maxRed, maxRedStep: maxRedDelta,
  };
}

// WCAG 2.3.2's red flash, measured rather than argued. Two parts, both reported:
//   * whether any measured state is a SATURATED RED at all (R/(R+G+B) >= 0.8 on linearised
//     channels). If nothing ever is, the red-flash threshold cannot be met by definition and the
//     rest is moot — but "cannot be met" is worth measuring rather than asserting from the
//     source colours, because filters and blending change the ratio that reaches the screen.
//   * the flash rate on the linear RED channel on its own, so the answer does not depend on that
//     first condition holding.
export function analyseRed(rows) {
  let peak = 0, maxRatio = 0;
  for (let k = 0; k < rows[0].tiles.length; k++) {
    const series = rows.map(r => ({ t: r.t, l: lin(r.tiles[k][0]) }));
    for (const r of rows) { const rr = redRatio(r.tiles[k]); if (rr > maxRatio) maxRatio = rr; }
    const p = peakRate(findFlashes(series, FLASH_THRESHOLD, 1.01).map(f => f.t)).peak;
    if (p > peak) peak = p;
  }
  return { peakPerSecond: peak, maxRatio };
}

// The largest luminance change between CONSECUTIVE measured frames, per patch — the raw
// excursion, independent of whether it was big enough to be scored as a flash. This is what
// proves an attenuation actually attenuated rather than merely falling under the threshold in
// the particular window that was sampled.
export function maxFrameStep(rows) {
  let mx = 0;
  for (let k = 0; k < rows[0].tiles.length; k++) {
    let prev = null;
    for (const r of rows) {
      const l = relLum(r.tiles[k]);
      if (prev !== null && Math.abs(l - prev) > mx) mx = Math.abs(l - prev);
      prev = l;
    }
  }
  return mx;
}

// WHERE the biggest single-frame step happened, not just how big it was. Added after a whole
// debugging session went into locating one by hand: a step at the first frame of a recording is a
// seam between two runs, a step in the middle is the animation itself, and the two need completely
// different fixes. Returns null for an empty recording.
export function maxFrameStepAt(rows) {
  let best = null;
  if (!rows || !rows.length) return null;
  for (let k = 0; k < rows[0].tiles.length; k++) {
    let prev = null;
    for (let i = 0; i < rows.length; i++) {
      const l = relLum(rows[i].tiles[k]);
      if (prev !== null) {
        const d = Math.abs(l - prev);
        if (!best || d > best.step) best = { step: d, frame: i, frames: rows.length, tile: k,
                                             ms: rows[i].t - rows[0].t, from: prev, to: l };
      }
      prev = l;
    }
  }
  return best;
}
