// DRAG-ROTATION DIRECTION — every pointer type, both axes.
//
// There is only ONE pointer handler in the page (pointerdown/pointermove/pointerup), shared by
// mouse, pen and touch. History of this file, because the invariant has flipped once:
//
//   * ORIGINALLY every input used the desktop orbit convention on the vertical axis (drag up to
//     tip the top toward you), which is what desktop 3D tools do.
//   * TOUCH was flipped first, after "up and down rotation are reverse ... on mobile" — a finger
//     is physically on the object, so the surface under it must travel WITH it.
//   * MOUSE was then flipped too, after the same complaint on desktop: "dragging the sha3 cube
//     left and right goes left and right but dragging up and down goes down and up, its inverted.
//     very hard to use". The decisive argument is INTERNAL CONSISTENCY, not which convention is
//     nicer: `rotY += dx` already moves the front face WITH the pointer horizontally, so leaving
//     vertical on the orbit convention made one diagonal drag do direct manipulation on one axis
//     and orbit on the other.
//
// So the load-bearing invariant is now that mouse and touch are IDENTICAL on BOTH axes, and that
// the surface follows the pointer. Asserting they are opposite would assert the reported bug back
// in — that assertion was correct for one revision and is wrong now.
//
// The touch events are dispatched through CDP (Input.dispatchTouchEvent) rather than as
// constructed DOM events, so they arrive as real browser-generated pointer events carrying
// pointerType 'touch' — the same reason CLAUDE.md insists on real pointer clicks over synthetic
// ones. `hasTouch: true` is required for Chromium to accept them at all.
import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const DRAG_PX = 60;          // how far the drag travels, in CSS px
const EXPECT_DEG = DRAG_PX * 0.5;   // the handler's gain

const browser = await chromium.launch();
const fails = [];
const check = (label, ok, detail) => {
  if (ok) console.log(`OK  ${label}${detail ? ' — ' + detail : ''}`);
  else fails.push(`${label}${detail ? ' — ' + detail : ''}`);
};

async function openPage(hasTouch) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 950 },
    hasTouch,
    // isMobile would also change layout; this test is about the INPUT device only, so the page
    // is left in its desktop layout and only the touch capability differs. That isolates the
    // variable: any difference measured below is caused by pointerType, nothing else.
  });
  const page = await context.newPage();
  const origin = new URL(BASE_URL).origin;
  page.on('console', m => { if (m.type() === 'error' && (m.location().url || '').startsWith(origin)) fails.push('console error: ' + m.text()); });
  page.on('pageerror', e => fails.push('page error: ' + String(e)));
  await page.goto(BASE_URL + '?v=touchdrag' + Date.now());
  await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 8000 });
  await page.click('#algo-next');   // switch to SHA-3
  await page.locator('#lane-canvas').scrollIntoViewIfNeeded();
  return { context, page };
}

// Reset the camera and neutralise the once-only scroll hint, so the only thing that moves the
// rotation during a measurement is the drag under test.
async function armCamera(page) {
  await page.evaluate(() => {
    sha3.hintFired = true; sha3.hintAnimating = false; sha3.userRotated = false;
    sha3.rotX = 0; sha3.rotY = 0;
  });
}

async function canvasCentre(page) {
  const box = await page.locator('#lane-canvas').boundingBox();
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

// A real mouse drag: press, several moves, release.
async function mouseDrag(page, dx, dy) {
  await armCamera(page);
  const c = await canvasCentre(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(c.x + dx * i / 6, c.y + dy * i / 6);
  await page.mouse.up();
  return page.evaluate(() => ({ rotX: sha3.rotX, rotY: sha3.rotY, userRotated: sha3.userRotated }));
}

// A real touch drag, dispatched through the browser's own input pipeline.
async function touchDrag(page, dx, dy) {
  await armCamera(page);
  const c = await canvasCentre(page);
  const cdp = await page.context().newCDPSession(page);
  const pt = (x, y) => ({ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(c.x, c.y)] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent',
      { type: 'touchMove', touchPoints: [pt(c.x + dx * i / 6, c.y + dy * i / 6)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const out = await page.evaluate(() => ({ rotX: sha3.rotX, rotY: sha3.rotY, userRotated: sha3.userRotated }));
  await cdp.detach();
  return out;
}

const { context: mCtx, page: mPage } = await openPage(false);
const mouseUp    = await mouseDrag(mPage, 0, -DRAG_PX);   // drag UP
const mouseDown  = await mouseDrag(mPage, 0,  DRAG_PX);   // drag DOWN
const mouseRight = await mouseDrag(mPage, DRAG_PX, 0);    // drag RIGHT
await mCtx.close();

const { context: tCtx, page: tPage } = await openPage(true);
const touchUp    = await touchDrag(tPage, 0, -DRAG_PX);
const touchDown  = await touchDrag(tPage, 0,  DRAG_PX);
const touchRight = await touchDrag(tPage, DRAG_PX, 0);
await tCtx.close();

// ---- the drags actually landed ----
check('a real touch drag rotates the camera at all (the handler sees touch pointers)',
      touchUp.userRotated === true && Math.abs(touchUp.rotX) > 1,
      `rotX ${touchUp.rotX.toFixed(1)} deg after a ${DRAG_PX}px upward touch drag`);
check('a real mouse drag rotates the camera at all',
      mouseUp.userRotated === true && Math.abs(mouseUp.rotX) > 1,
      `rotX ${mouseUp.rotX.toFixed(1)} deg after a ${DRAG_PX}px upward mouse drag`);

// ---- MOUSE: now direct manipulation too ----
// The desktop orbit convention was reported as "dragging up and down goes down and up, its
// inverted. very hard to use". The decisive argument is internal consistency: rotY += dx already
// moves the front face WITH the pointer horizontally, so leaving the vertical axis on the orbit
// convention made a single diagonal drag do direct manipulation on one axis and orbit on the
// other. Every pointer type now gets direct manipulation on BOTH axes.
check('mouse: dragging UP lowers rotX (surface follows the pointer, same as touch)',
      Math.abs(mouseUp.rotX + EXPECT_DEG) < 1e-6,
      `rotX ${mouseUp.rotX.toFixed(1)} (expected -${EXPECT_DEG})`);
check('mouse: dragging DOWN raises rotX',
      Math.abs(mouseDown.rotX - EXPECT_DEG) < 1e-6,
      `rotX ${mouseDown.rotX.toFixed(1)} (expected +${EXPECT_DEG})`);

// ---- TOUCH: direct manipulation ----
check('touch: dragging UP lowers rotX (the surface under the finger travels WITH the finger)',
      Math.abs(touchUp.rotX + EXPECT_DEG) < 1e-6,
      `rotX ${touchUp.rotX.toFixed(1)} (expected -${EXPECT_DEG})`);
check('touch: dragging DOWN raises rotX',
      Math.abs(touchDown.rotX - EXPECT_DEG) < 1e-6,
      `rotX ${touchDown.rotX.toFixed(1)} (expected +${EXPECT_DEG})`);

// ---- the invariant: every input type behaves the same, on both axes ----
check('vertical drag is IDENTICAL between mouse and touch (both are direct manipulation now)',
      Math.abs(mouseUp.rotX - touchUp.rotX) < 1e-6 && Math.sign(touchUp.rotX) !== 0,
      `mouse ${mouseUp.rotX.toFixed(1)} vs touch ${touchUp.rotX.toFixed(1)} for the same upward drag`);
check('horizontal drag is IDENTICAL between mouse and touch',
      Math.abs(mouseRight.rotY - touchRight.rotY) < 1e-6 && mouseRight.rotY > 0,
      `mouse rotY ${mouseRight.rotY.toFixed(1)} vs touch rotY ${touchRight.rotY.toFixed(1)}`);

// ---- and the direct-manipulation claim checked against the PROJECTION, not against a sign ----
// Push a marker point on the front face of the lattice through sha3Project before and after an
// upward touch drag, and require it to move UP the screen (smaller sy). This is what "the
// surface follows the finger" actually means, stated in pixels.
const { context: pCtx, page: pPage } = await openPage(true);
const surface = await (async () => {
  await armCamera(pPage);
  const before = await pPage.evaluate(() => {
    const cam = { cx: 1, sx: 0, cy: 1, sy: 0, scale: 40, f: 34, pw: sha3PerspWeight(0, 0), ox: 0, oy: 0 };
    return sha3Project(0, 0, 1, cam).sy;
  });
  await touchDrag(pPage, 0, -DRAG_PX);
  const after = await pPage.evaluate(() => {
    const rx = sha3.rotX * Math.PI / 180, ry = sha3.rotY * Math.PI / 180;
    const cam = { cx: Math.cos(rx), sx: Math.sin(rx), cy: Math.cos(ry), sy: Math.sin(ry),
                  scale: 40, f: 34, pw: sha3PerspWeight(sha3.rotX, sha3.rotY), ox: 0, oy: 0 };
    return sha3Project(0, 0, 1, cam).sy;
  });
  return { before, after };
})();
await pCtx.close();
check('touch: a point on the FRONT FACE moves up the screen when the finger moves up',
      surface.after < surface.before - 1e-6,
      `front-face screen y ${surface.before.toFixed(2)} -> ${surface.after.toFixed(2)} (smaller = higher)`);

await browser.close();
if (fails.length) {
  console.error('\nFAILED:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('\nAll drag-direction checks passed.');
