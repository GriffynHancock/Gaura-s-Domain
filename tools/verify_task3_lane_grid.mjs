// Structural verification of the SHA-3 Keccak state view.
//
// REWRITTEN for the Canvas 2D renderer. The previous version of this file asserted against the
// CSS-3D `.lane` DOM (25 elements, .rate/.capacity classes, an inline transform string on
// #lane-grid). That DOM is deliberately gone — see docs/research/3d-rendering-options.md for why
// CSS 3D could not produce closed solids with correct occlusion. Canvas has no queryable DOM, so
// the assertions now read the renderer's own read-only instrumentation hook (window.__sha3Debug)
// AND the real painted pixels. That is strictly stronger than what it replaced: the old file
// could only prove 25 divs existed with the right class names, and could not tell whether
// anything was actually drawn, whether it was drawn in the right colour, or whether dragging
// changed the picture rather than just a string. All three are now checked directly.
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

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

await page.goto(BASE_URL + '?v=task3');
await page.waitForSelector('#lane-canvas', { state: 'attached' });
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 5000 });

// ---- 1. the old CSS-3D lane DOM really is gone (no half-migrated leftovers) ----
const staleLanes = await page.locator('.lane, #lane-grid, .lane-tick').count();
if (staleLanes !== 0) throw new Error(`expected the CSS-3D lane DOM to be removed, found ${staleLanes} stale element(s)`);

// ---- 2. geometry: a real 5 x 5 x N lattice of closed boxes ----
const geom = await page.evaluate(() => ({
  subs: window.__sha3Debug.subsPerLane,
  bitsPerSub: window.__sha3Debug.bitsPerSub,
  boxes: window.__sha3Debug.boxCount(),
  faces: window.__sha3Debug.facesDrawn(),
  rot: window.__sha3Debug.rotation(),
  lanes: window.__sha3Debug.lanes(),
}));
if (geom.lanes.length !== 25) throw new Error(`expected 25 lanes, found ${geom.lanes.length}`);
if (geom.subs * geom.bitsPerSub !== 64) {
  throw new Error(`subsPerLane * bitsPerSub must equal the real 64-bit lane, got ${geom.subs} * ${geom.bitsPerSub}`);
}
if (geom.boxes !== 25 * geom.subs) throw new Error(`expected ${25 * geom.subs} boxes, found ${geom.boxes}`);
// Every box is a closed solid: with backface culling between 1 and 3 of a cube's 6 faces can face
// the camera, so a fully-drawn lattice never paints zero faces for a box and never more than 3.
if (geom.faces < geom.boxes) throw new Error(`only ${geom.faces} faces drawn for ${geom.boxes} boxes — boxes are not being drawn as solids`);
if (geom.faces > geom.boxes * 3) throw new Error(`${geom.faces} faces for ${geom.boxes} boxes — backface culling is not running`);
// THE FACE-ON START. The camera opens square-on so the state reads as the flat 5x5 grid of
// squares every published Keccak diagram uses, and the depth is something the user discovers by
// dragging. Three independent proofs, because "it looks flat" must not be a matter of opinion:
//   * the rotation state is exactly 0/0;
//   * the perspective weight is 0, i.e. the projection is orthographic, which is what makes the
//     eight sub-cubes of an off-centre lane land on exactly the same square instead of fanning
//     outward from the canvas centre;
//   * and the cull therefore passes EXACTLY ONE face per box — the +z face. 200, not the ~600 an
//     oblique camera draws. This is the strongest of the three: it is impossible to draw one face
//     per cube from any camera that is not square-on.
if (geom.rot.rotX !== 0 || geom.rot.rotY !== 0) {
  throw new Error(`the view must START face-on (0,0) so it reads as the flat 5x5 diagram, got ${JSON.stringify(geom.rot)}`);
}
if (geom.rot.perspWeight !== 0) {
  throw new Error(`face-on must project orthographically (perspective weight 0), got ${geom.rot.perspWeight} — the sub-cubes will fan out instead of stacking`);
}
if (geom.faces !== geom.boxes) {
  throw new Error(`face-on must draw exactly one face per box (${geom.boxes}), got ${geom.faces} — the opening view is not square-on`);
}
console.log(`OK  ${geom.boxes} boxes (25 lanes x ${geom.subs} cubes, ${geom.bitsPerSub} real bits each) and the view STARTS face-on: rot 0/0, orthographic, exactly ${geom.faces} faces = 1 per box (a flat 5x5 grid of squares)`);

// ---- 3. rate/capacity split at the exact real absorb-order positions ----
// keccak256WithTrace visits lanes as x=(j/8)%5, y=floor((j/8)/5); the first 17 are the rate
// lanes for rateBytes=136. Assert lane-by-lane, not just by count.
const expectedRate = new Set();
for (let i = 0; i < 17; i++) expectedRate.add(`${i % 5},${Math.floor(i / 5)}`);
for (const L of geom.lanes) {
  const want = expectedRate.has(`${L.cx},${L.cy}`);
  if (L.isRate !== want) throw new Error(`lane (${L.cx},${L.cy}) rate/capacity mismatch: got isRate=${L.isRate}, expected ${want}`);
}
const rateCount = geom.lanes.filter(l => l.isRate).length;
if (rateCount !== 17) throw new Error(`expected 17 rate lanes, found ${rateCount}`);
console.log('OK  17 rate / 8 capacity lanes at the exact absorb-order positions');

// ---- 4. the 8-bits-per-cube reduction is stated on the page, not silently implied ----
const noteText = (await page.locator('#cube-note').innerText()).replace(/\s+/g, ' ');
if (!/64 bits/.test(noteText)) {
  throw new Error(`#cube-note must state the real 64-bit lane size; got "${noteText}"`);
}
// Pinned to the ACTUAL constants, not a hardcoded "8". Changing SHA3_SUBS_PER_LANE without
// rewriting the note would otherwise leave the page stating a falsehood with the test still green.
const subRe = new RegExp(`${geom.subs} cubes per lane`);
const bitRe = new RegExp(`1 cube = ${geom.bitsPerSub} real bits`);
if (!subRe.test(noteText) || !bitRe.test(noteText)) {
  throw new Error(`#cube-note must state the live reduction (${geom.subs} cubes per lane, ${geom.bitsPerSub} real bits each); got "${noteText}"`);
}
console.log(`OK  page states the real 64-bit lane depth and that one drawn cube = ${geom.bitsPerSub} real bits`);

// ---- 4b. pi's order-24 return to identity ----
// This explanation used to be a visible caption under the canvas. It has deliberately been moved
// into an HTML comment: the module is presented live and explained out loud, so the page carries
// labels rather than paragraphs. It is NOT honesty-critical the way the 8-bits-per-cube reduction
// above is — nothing left on the page asserts anything that becomes misleading without it — but
// it is [EXACT] and must remain findable by a curious student reading the source, so this now
// asserts it is still there in the served document rather than in the rendered text.
const pageSource = await page.content();
const piComment = /<!--[^]*?24 rounds[^]*?-->/.test(pageSource);
if (!piComment || !/(full circle|all the way around)/i.test(pageSource)) {
  throw new Error("pi's order-24 return to identity must stay documented in the page source, in a comment a curious reader can find");
}
if (/24 rounds/.test(noteText)) {
  throw new Error(`#cube-note should now be a one-line label, not a paragraph explaining pi; got "${noteText}"`);
}
console.log("OK  pi's order-24 return to identity is documented in the page source (moved out of the visible caption)");

// ---- 5. the canvas actually paints (non-blank pixel data) ----
await page.click('#algo-next'); // MD5 -> SHA-3, so the canvas is visible
const canvas = page.locator('#lane-canvas');
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);

async function canvasStats() {
  return page.evaluate(() => {
    const c = document.getElementById('lane-canvas');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 37) { // stride-sample
      seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      sum += d[i] + d[i + 1] + d[i + 2]; n++;
    }
    return { distinct: seen.size, mean: sum / n };
  });
}
const idle = await canvasStats();
// A blank canvas has exactly one colour. The FACE-ON opening view legitimately has few — it is 25
// flat squares in two families (gold rate, grey capacity) plus their edge strokes and the
// background — so the old "> 20 distinct colours" floor is the wrong test to apply here and is
// re-applied to the ROTATED view further down, where it is the right one. What must hold here is
// that real geometry is painted at all, and that the two lane families are still tellable apart
// in the flat view (which is the whole point of showing it).
if (idle.distinct < 4) throw new Error(`canvas looks blank — only ${idle.distinct} distinct sampled colours in the face-on view`);
const flatFamilies = await page.evaluate(() => {
  const warm = c => c[0] - c[2];
  const rate = [], cap = [];
  window.__sha3Debug.lanes();   // ensure a render has happened
  sha3.lanes.forEach(L => (L.isRate ? rate : cap).push(warm(L.lastCol)));
  return { worstRate: Math.min(...rate), bestCap: Math.max(...cap) };
});
if (!(flatFamilies.worstRate > flatFamilies.bestCap)) {
  throw new Error(`even flat, every rate lane must read warmer than every capacity lane (worst rate ${flatFamilies.worstRate}, best capacity ${flatFamilies.bestCap})`);
}
console.log(`OK  the face-on view paints real geometry (${idle.distinct} distinct sampled colours) and still separates rate from capacity (${flatFamilies.worstRate.toFixed(1)} vs ${flatFamilies.bestCap.toFixed(1)} warmth)`);

// ---- 6. retina backing store ----
const dprOk = await page.evaluate(() => {
  const c = document.getElementById('lane-canvas');
  const want = Math.min(3, window.devicePixelRatio || 1);
  return Math.abs(c.width - Math.round(c.getBoundingClientRect().width * want)) <= 2;
});
if (!dprOk) throw new Error('canvas backing store is not sized by devicePixelRatio');
console.log('OK  canvas backing store sized for devicePixelRatio');

// ---- 7. drag-rotation changes BOTH the projection state and the painted pixels ----
const rotBefore = await page.evaluate(() => window.__sha3Debug.rotation());
const box = await canvas.boundingBox();
if (!box) throw new Error('#lane-canvas has no bounding box (not visible)');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(250);
const rotAfter = await page.evaluate(() => ({ ...window.__sha3Debug.rotation(),
                                              faces: window.__sha3Debug.facesDrawn(),
                                              hint: window.__sha3Debug.hint() }));
if (rotAfter.rotX === rotBefore.rotX && rotAfter.rotY === rotBefore.rotY) {
  throw new Error(`drag did not change the camera rotation (still ${JSON.stringify(rotBefore)})`);
}
const dragged = await canvasStats();
if (Math.abs(dragged.mean - idle.mean) < 0.5 && dragged.distinct === idle.distinct) {
  throw new Error('drag changed the rotation state but the painted pixels are unchanged — the canvas is not re-rendering');
}
// THE DISCOVERY. Dragging away from face-on must actually reveal the solids: more than one face
// per box now passes the cull, perspective is back on, and the many-Lambert-shaded-faces colour
// count the flat view legitimately does not have is now present. This is the pair to the
// face-on assertions above — together they pin "flat at rest, 3D once you touch it".
if (!(rotAfter.faces > geom.boxes)) {
  throw new Error(`after a drag the boxes must read as solids — expected more than ${geom.boxes} faces (one per box), got ${rotAfter.faces}`);
}
if (!(rotAfter.perspWeight > 0)) throw new Error(`rotating away from square-on must restore perspective, got weight ${rotAfter.perspWeight}`);
if (dragged.distinct < 20) throw new Error(`the rotated lattice should be richly shaded, got only ${dragged.distinct} distinct sampled colours`);
// The drag must also latch "the user is driving", which is what stands the scroll hint down.
if (rotAfter.hint.userRotated !== true) throw new Error('a real pointer drag must set userRotated, so the scroll hint knows to stand down');
console.log(`OK  real pointer drag rotates the projection (${JSON.stringify(rotBefore)} -> rotX ${rotAfter.rotX}/rotY ${rotAfter.rotY}), repaints, and REVEALS the cubes: ${geom.faces} faces face-on -> ${rotAfter.faces} rotated, ${idle.distinct} -> ${dragged.distinct} distinct colours`);

// ---- 8. theme toggle repaints the canvas from the page's CSS custom properties ----
const beforeTheme = await canvasStats();
await page.click('#theme');
await page.waitForTimeout(350);
const afterTheme = await canvasStats();
if (Math.abs(afterTheme.mean - beforeTheme.mean) < 5) {
  throw new Error(`theme toggle did not visibly repaint the canvas (mean ${beforeTheme.mean.toFixed(1)} -> ${afterTheme.mean.toFixed(1)})`);
}
console.log(`OK  theme toggle repaints the canvas (mean brightness ${beforeTheme.mean.toFixed(1)} -> ${afterTheme.mean.toFixed(1)})`);

// ---- 9. first paint after switching to SHA-3 is sized to the REAL box, on a narrow viewport ----
// Regression guard: the canvas starts inside a display:none subtree (MD5 is the default), and a
// hidden element reports a zero-size getBoundingClientRect — so the load-time sizing fell back to
// the element's hardcoded width/height attributes instead of its real width:100% CSS box. On a
// phone that meant a stretched first paint. Must be checked BEFORE any drag/theme/resize, since
// any of those would mask it.
const narrow = await browser.newPage({ viewport: { width: 420, height: 800 } });
await narrow.goto(BASE_URL + '?v=task3narrow');
await narrow.waitForFunction(() => !!window.__sha3Debug, { timeout: 5000 });
await narrow.click('#algo-next');
await narrow.waitForTimeout(150);
const sizing = await narrow.evaluate(() => {
  const c = document.getElementById('lane-canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  return { cssW: Math.round(c.getBoundingClientRect().width), backing: c.width, expected: Math.round(c.getBoundingClientRect().width * dpr) };
});
await narrow.close();
if (Math.abs(sizing.backing - sizing.expected) > 2) {
  throw new Error(`canvas mis-sized on first SHA-3 paint at a narrow viewport: backing store ${sizing.backing}px for a ${sizing.cssW}px box (expected ~${sizing.expected}px)`);
}
console.log(`OK  first SHA-3 paint is correctly sized on a 420px viewport (${sizing.cssW}px box -> ${sizing.backing}px backing store)`);

// ---- 10. the scroll hint: a nudge for people who never think to drag ----
// Starting face-on only works as a discovery if the discovery is actually findable. When the
// bottom of the page comes into view the camera eases ~5 degrees onto each axis, which is enough
// for the flat squares to visibly acquire sides. Three rules, each checked on its own fresh page
// load because they are all about "what happened first":
//   A. it fires, it EASES (does not snap), and it fires only ONCE;
//   B. if the user has already rotated manually it never fires at all — it must not fight them;
//   C. reaching the bottom while MD5 is showing does not burn the one shot on a hidden canvas.
const hintPage = async (label, fn) => {
  const p = await browser.newPage({ viewport: { width: 1100, height: 950 } });
  p.on('pageerror', err => consoleErrors.push(`[${label}] ${err}`));
  await p.goto(BASE_URL + '?v=' + label);
  await p.waitForFunction(() => !!window.__sha3Debug, { timeout: 5000 });
  const out = await fn(p);
  await p.close();
  return out;
};
const toBottom = p => p.evaluate(() => document.getElementById('realtime-note').scrollIntoView({ block: 'center' }));
// The page says when the ease is over — `hint().animating` is the renderer's own flag — so waiting
// for the END of the nudge is a condition, not a guessed 1600ms. The two NEGATIVE cases (it must
// NOT fire) cannot be condition-waited by construction, but they do not need a whole ease either:
// a re-fire sets `animating` on the very next frame and takes SHA3_HINT_MS (~1100ms) to land, so
// a few hundred ms is enough to catch one starting — and `animating` is asserted alongside the
// unchanged rotation so a nudge that had merely begun is still caught.
const hintSettled = p => p.waitForFunction(() => {
  const h = __sha3Debug.hint();
  return h.fired && !h.animating;
}, { timeout: 5000 });
const NEGATIVE_WINDOW_MS = 400;   // >> one frame; any hint that was going to fire has started

const hintA = await hintPage('hintA', async p => {
  await p.click('#algo-next');                     // MD5 -> SHA-3
  await p.waitForTimeout(150);
  const before = await p.evaluate(() => __sha3Debug.rotation());
  await toBottom(p);
  await p.waitForTimeout(130);
  const mid = await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint() }));
  await hintSettled(p);
  const after = await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint(), faces: __sha3Debug.facesDrawn() }));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(250);
  await toBottom(p);
  await p.waitForTimeout(NEGATIVE_WINDOW_MS);
  const again = await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint() }));
  return { before, mid, after, again };
});
if (hintA.before.rotX !== 0 || hintA.before.rotY !== 0) throw new Error('hint test did not start face-on');
const dX = hintA.after.h.dx, dY = hintA.after.h.dy;
if (!(Math.abs(dX) >= 3 && Math.abs(dX) <= 10 && Math.abs(dY) >= 3 && Math.abs(dY) <= 10)) {
  throw new Error(`the hint should be a ~5 degree nudge, not a re-aim: dx=${dX} dy=${dY}`);
}
if (hintA.after.r.rotX !== dX || hintA.after.r.rotY !== dY) {
  throw new Error(`the hint must land exactly ${dX}/${dY} degrees from the face-on start, got ${JSON.stringify(hintA.after.r)}`);
}
// EASED, not snapped: sampled ~130ms into an ~1100ms ease it must have moved, but nowhere near
// the whole way. A snap would already be at the destination on the first sample.
const midFrac = Math.abs(hintA.mid.r.rotY / dY);
if (!(midFrac > 0 && midFrac < 0.5)) {
  throw new Error(`the hint must ease in gently — 130ms into it the rotation was ${(midFrac * 100).toFixed(0)}% of the way there (${JSON.stringify(hintA.mid.r)})`);
}
// ONCE. Scrolling back up and down again must not nudge it a second time.
if (hintA.again.r.rotX !== hintA.after.r.rotX || hintA.again.r.rotY !== hintA.after.r.rotY || hintA.again.h.animating) {
  throw new Error(`the hint fired more than once: ${JSON.stringify(hintA.after.r)} -> ${JSON.stringify(hintA.again)} on a second scroll`);
}
// ...and it must genuinely have revealed depth, not just changed a number.
if (!(hintA.after.faces > 200)) throw new Error(`after the hint the cubes should show more than one face each, got ${hintA.after.faces}`);
if (!(hintA.after.r.perspWeight > 0)) throw new Error('the hint should bring the perspective back on');

const hintB = await hintPage('hintB', async p => {
  await p.click('#algo-next');
  await p.waitForTimeout(150);
  const c = await p.locator('#lane-canvas').boundingBox();
  await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await p.mouse.down();
  await p.mouse.move(c.x + c.width / 2 + 120, c.y + c.height / 2 - 30, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(200);
  const manual = await p.evaluate(() => __sha3Debug.rotation());
  await toBottom(p);
  await p.waitForTimeout(NEGATIVE_WINDOW_MS);
  return { manual, post: await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint() })) };
});
if (hintB.post.r.rotX !== hintB.manual.rotX || hintB.post.r.rotY !== hintB.manual.rotY) {
  throw new Error(`the hint overrode a view the user had already set: ${JSON.stringify(hintB.manual)} -> ${JSON.stringify(hintB.post.r)}`);
}
if (hintB.post.h.fired) throw new Error('the hint fired even though the user had already rotated manually');

const hintC = await hintPage('hintC', async p => {
  await toBottom(p);                                // bottom reached while MD5 is showing
  await p.waitForTimeout(NEGATIVE_WINDOW_MS);
  const whileMd5 = await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint() }));
  await p.click('#algo-next');                      // now switch to SHA-3
  await hintSettled(p);
  return { whileMd5, after: await p.evaluate(() => ({ r: __sha3Debug.rotation(), h: __sha3Debug.hint() })) };
});
if (hintC.whileMd5.h.fired) throw new Error('the hint fired while the SHA-3 canvas was hidden — the one shot was wasted where nobody could see it');
if (!hintC.after.h.fired || hintC.after.r.rotY !== dY) {
  throw new Error(`the hint should be deferred until SHA-3 is actually on screen, then fire: ${JSON.stringify(hintC.after)}`);
}
console.log(`OK  scroll hint eases ${dX}/${dY} degrees onto the face-on view (${(midFrac * 100).toFixed(0)}% of the way at 130ms), fires exactly once, defers while MD5 is showing, and never touches a view the user has already dragged`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('All Task 3 (Keccak state canvas) checks passed.');
await browser.close();
