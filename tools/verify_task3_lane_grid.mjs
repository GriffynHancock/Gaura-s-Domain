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
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
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
  lanes: window.__sha3Debug.lanes(),
}));
if (geom.lanes.length !== 25) throw new Error(`expected 25 lanes, found ${geom.lanes.length}`);
if (geom.subs * geom.bitsPerSub !== 64) {
  throw new Error(`subsPerLane * bitsPerSub must equal the real 64-bit lane, got ${geom.subs} * ${geom.bitsPerSub}`);
}
if (geom.boxes !== 25 * geom.subs) throw new Error(`expected ${25 * geom.subs} boxes, found ${geom.boxes}`);
// Every box is a closed solid: with backface culling exactly 1-3 of a cube's 6 faces can face the
// camera, so a fully-drawn lattice paints between 1 and 3 faces per box and never zero. A "plane
// glued to a front face" implementation (the bug being fixed) would paint exactly one.
if (geom.faces < geom.boxes) throw new Error(`only ${geom.faces} faces drawn for ${geom.boxes} boxes — boxes are not being drawn as solids`);
if (geom.faces > geom.boxes * 3) throw new Error(`${geom.faces} faces for ${geom.boxes} boxes — backface culling is not running`);
console.log(`OK  ${geom.boxes} boxes (25 lanes x ${geom.subs} cubes, ${geom.bitsPerSub} real bits each), ${geom.faces} visible faces drawn`);

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
if (!/64 bits/.test(noteText) || !/8 real bits/.test(noteText)) {
  throw new Error(`#cube-note must state the real 64-bit lane size and what one drawn cube stands for; got "${noteText}"`);
}
console.log('OK  page states the real 64-bit lane depth and that one drawn cube = 8 real bits');

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
// A blank canvas (or one painted with only the flat background) has essentially one colour. The
// shaded lattice has many, because every visible face gets its own Lambert-shaded fill.
if (idle.distinct < 20) throw new Error(`canvas looks blank/flat — only ${idle.distinct} distinct sampled colours`);
console.log(`OK  canvas renders real pixel data (${idle.distinct} distinct sampled colours)`);

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
const rotAfter = await page.evaluate(() => window.__sha3Debug.rotation());
if (rotAfter.rotX === rotBefore.rotX && rotAfter.rotY === rotBefore.rotY) {
  throw new Error(`drag did not change the camera rotation (still ${JSON.stringify(rotBefore)})`);
}
const dragged = await canvasStats();
if (Math.abs(dragged.mean - idle.mean) < 0.5 && dragged.distinct === idle.distinct) {
  throw new Error('drag changed the rotation state but the painted pixels are unchanged — the canvas is not re-rendering');
}
console.log(`OK  real pointer drag rotates the projection (${JSON.stringify(rotBefore)} -> ${JSON.stringify(rotAfter)}) and repaints`);

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

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('All Task 3 (Keccak state canvas) checks passed.');
await browser.close();
