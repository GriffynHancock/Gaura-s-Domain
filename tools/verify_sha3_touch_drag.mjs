// DRAG-ROTATION DIRECTION — mouse vs touch.
//
// The reported bug: "up and down rotation are reverse to what it should be on mobile". There is
// only ONE pointer handler in the page (pointerdown/pointermove/pointerup), shared by mouse, pen
// and touch, so there was never a sign error between two code paths to find. The defect is a
// CONVENTION mismatch, and the projection maths pins which convention each device wants:
//
//   sha3Project, front-face point (py=0, pz=+1), rotY=0:  sy = oy + sin(rotX)
//
// so RAISING rotX drives the front face DOWN the screen.
//
//   * MOUSE — the cursor is a handle on the CAMERA, not on the object. Dragging up tipping the
//     top toward you is the standard desktop-3D orbit convention, and it is the behaviour the
//     owner said is already right. Pinned here so a future change cannot quietly flip it.
//   * TOUCH — the finger is physically on the object. Direct manipulation is the only correct
//     rule: the surface under the finger must travel WITH the finger, which is the opposite sign.
//
// So the load-bearing invariant is that the two are OPPOSITE on the vertical axis and IDENTICAL
// on the horizontal one — not that they match. Asserting "touch equals mouse" would assert the
// reported bug back in.
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

// ---- MOUSE: unchanged desktop convention, pinned ----
// Drag up raises rotX. Per sha3Project that tips the top of the lattice TOWARD the viewer.
check('mouse: dragging UP raises rotX (desktop orbit convention, unchanged)',
      Math.abs(mouseUp.rotX - EXPECT_DEG) < 1e-6,
      `rotX ${mouseUp.rotX.toFixed(1)} (expected +${EXPECT_DEG})`);
check('mouse: dragging DOWN lowers rotX',
      Math.abs(mouseDown.rotX + EXPECT_DEG) < 1e-6,
      `rotX ${mouseDown.rotX.toFixed(1)} (expected -${EXPECT_DEG})`);

// ---- TOUCH: direct manipulation ----
check('touch: dragging UP lowers rotX (the surface under the finger travels WITH the finger)',
      Math.abs(touchUp.rotX + EXPECT_DEG) < 1e-6,
      `rotX ${touchUp.rotX.toFixed(1)} (expected -${EXPECT_DEG})`);
check('touch: dragging DOWN raises rotX',
      Math.abs(touchDown.rotX - EXPECT_DEG) < 1e-6,
      `rotX ${touchDown.rotX.toFixed(1)} (expected +${EXPECT_DEG})`);

// ---- the invariant that is the actual fix ----
check('vertical drag is OPPOSITE between mouse and touch (this is the fix, not a bug)',
      Math.sign(mouseUp.rotX) === -Math.sign(touchUp.rotX) && Math.sign(touchUp.rotX) !== 0,
      `mouse ${mouseUp.rotX.toFixed(1)} vs touch ${touchUp.rotX.toFixed(1)} for the same upward drag`);
check('horizontal drag is IDENTICAL between mouse and touch (only the vertical axis was wrong)',
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
