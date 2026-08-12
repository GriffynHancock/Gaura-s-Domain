import { chromium } from 'playwright';

const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(BASE_URL + '?v=task3');
// SHA-3's diagram (and #lane-grid within it) is display:none until the user toggles off the
// default MD5 view, but buildLaneGrid() runs at page load regardless — so wait for it attached
// to the DOM, not visible.
await page.waitForSelector('#lane-grid', { state: 'attached' });

const laneCount = await page.locator('.lane').count();
if (laneCount !== 25) throw new Error(`expected 25 .lane elements, found ${laneCount}`);

const rateCount = await page.locator('.lane.rate').count();
const capacityCount = await page.locator('.lane.capacity').count();
if (rateCount !== 17) throw new Error(`expected 17 rate lanes, found ${rateCount}`);
if (capacityCount !== 8) throw new Error(`expected 8 capacity lanes, found ${capacityCount}`);

// switch to SHA-3 so the lane grid is visible, then drag it and confirm the transform changed
await page.click('#algo-next'); // MD5 -> SHA-3 (only two algorithms, so one click toggles)
await page.waitForSelector('#lane-grid:visible', { timeout: 2000 }).catch(() => {});
const grid = page.locator('#lane-grid');
const before = await grid.evaluate(el => el.style.transform);
// #lane-grid now reserves its real ~180px projected footprint (the legend and round counter used
// to be painted over by the lanes), which pushes it below a default 720px-tall viewport. Scroll it
// into view first — page.mouse coordinates are viewport-relative, so an off-screen drag silently
// does nothing.
await grid.scrollIntoViewIfNeeded();
const box = await grid.boundingBox();
if (!box) throw new Error('#lane-grid has no bounding box (not visible)');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 });
await page.mouse.up();
const after = await grid.evaluate(el => el.style.transform);
if (after === before) throw new Error(`drag did not change #lane-grid transform (still "${before}")`);

if (consoleErrors.length) throw new Error('console errors: ' + consoleErrors.join(' | '));

console.log('OK  25 lanes (17 rate / 8 capacity) rendered, drag-rotation changes transform, no console errors');
await browser.close();
