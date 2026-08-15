import { chromium } from 'playwright';
const OUT = process.env.OUT;
const URL = 'http://localhost:8787/public/crypto/encoding/?v=' + Date.now();
const b = await chromium.launch();
const errs = [];
const pg = await b.newPage({ viewport: { width: 900, height: 1400 } });
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
await pg.goto(URL, { waitUntil: 'networkidle' });

const sum = pg.locator('#schemes > summary');
await sum.click();
console.log('open after click:', await pg.locator('#schemes').evaluate(e => e.open));

// pane A -> rot47, pane B -> url
const before = await pg.locator('[data-out="a"]').innerText();
await pg.locator('.ab-seg[data-pane="a"] button', { hasText: 'rot47' }).click();
const afterA = await pg.locator('[data-out="a"]').innerText();
const beforeB = await pg.locator('[data-out="b"]').innerText();
await pg.locator('.ab-seg[data-pane="b"] button', { hasText: 'url' }).click();
const afterB = await pg.locator('[data-out="b"]').innerText();
console.log('A changed:', before !== afterA, JSON.stringify(afterA.replace(/\s+/g, '')));
console.log('B changed:', beforeB !== afterB, JSON.stringify(afterB.replace(/\s+/g, '')));

// back to base64/hex for the screenshot, then tap source byte 1
await pg.locator('.ab-seg[data-pane="a"] button', { hasText: 'base64' }).click();
await pg.locator('.ab-seg[data-pane="b"] button', { hasText: 'hex' }).click();
await pg.locator('#ab-bytes .cell').nth(1).click();
console.log('hot cells after tap:', await pg.locator('#ab .cell.hot').count());

await pg.locator('#schemes').scrollIntoViewIfNeeded();
await pg.screenshot({ path: OUT + '/panel-light.png', fullPage: false });
await pg.locator('#theme').click();
await pg.waitForTimeout(300);
await pg.locator('#schemes').scrollIntoViewIfNeeded();
await pg.screenshot({ path: OUT + '/panel-dark.png', fullPage: false });
await pg.locator('#theme').click();

// toggle closes
await sum.click();
console.log('open after 2nd click:', await pg.locator('#schemes').evaluate(e => e.open));

// existing puzzle I still solves
const flag = await pg.evaluate(() => window.ASSETS.flags.a);
const card = pg.locator('details.card').first();
await card.locator('.tile[data-m="base64"]').click();
await card.locator('.submit input').fill(flag);
await card.locator('.check').click();
console.log('puzzle I solved:', await card.evaluate(e => e.classList.contains('solved')));
console.log('FX_TOTAL:', await pg.evaluate(() => window.FX_TOTAL));
console.log('card count:', await pg.locator('details.card').count());
console.log('console errors:', errs);
await b.close();
