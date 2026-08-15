// End-to-end checks for the Five Nights at Crypto's module.
// Run: FNAC_MODULE_URL="http://localhost:8815/public/crypto/fnac/" node tools/verify_fnac_module.mjs
//
// Everything here is driven with real pointer input and real keystrokes — no synthetic events,
// no calling the page's own handlers to "prove" a click works. The flash/photosensitivity
// numbers live in the sibling script, tools/verify_fnac_flash_safety.mjs.
import { chromium } from 'playwright';

const BASE_URL = process.env.FNAC_MODULE_URL || 'http://localhost:8815/public/crypto/fnac/';
const fails = [];
const check = (label, ok, detail) => {
  if (ok) console.log(`OK  ${label}${detail ? ' — ' + detail : ''}`);
  else { console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`); fails.push(label); }
};

// NO --autoplay-policy override: Chrome's real autoplay policy is left in force, because the
// whole point of the round-2 trigger change is that a tap grants user activation and a scroll
// does not. Faking the policy away would make the audio assertions meaningless.
const browser = await chromium.launch();

// The gate is no longer a cookie: FNAC opens when Caesar, XOR and Encoding are all complete,
// which the confetti engine mirrors into localStorage['ctf-complete:v1']. Seeding that is how a
// test says "this student has finished the beginner modules" — cookies cannot do it, so it goes
// in via addInitScript (which coexists with the play() spy below).
const GATE_KEY = 'ctf-complete:v1';
const done = (n, t) => ({ c: true, n, t });
const ALL_THREE = { caesar: done(7, 7), xor: done(4, 4), encoding: done(6, 6) };
async function seedGate(page, entries) {
  await page.addInitScript(([key, val]) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }, [GATE_KEY, entries]);
}

async function open({ viewport = { width: 1100, height: 950 }, unlocked = true, creepFired = true,
                     hasTouch = false, gate = null, staleCookie = false } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch, isMobile: hasTouch });
  const cookies = [];
  // the pre-gate-change cookie: seeded only where a test asserts it does NOT grant access
  if (staleCookie) cookies.push({ name: 'ctf-fnac-unlocked', value: '1', url: BASE_URL });
  cookies.push({ name: 'ctf-fnac-creep', value: creepFired ? '1' : '0', url: BASE_URL });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await seedGate(page, gate || (unlocked ? ALL_THREE : {}));
  // spy on play() BEFORE any page script runs, and record how each promise settled — that is the
  // only way to tell "audio was permitted" from "audio was blocked and swallowed".
  await page.addInitScript(() => {
    window.__playLog = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const src = (this.src || '').split('/').pop();
      let p;
      try { p = orig.apply(this, arguments); } catch (e) { window.__playLog.push({ src, ok: false, err: String(e) }); throw e; }
      if (p && p.then) p.then(() => window.__playLog.push({ src, ok: true }), e => window.__playLog.push({ src, ok: false, err: String(e) }));
      else window.__playLog.push({ src, ok: true, note: 'no promise' });
      return p;
    };
  });
  const errs = [];
  // only errors from OUR origin count: the page links Google Fonts, and a flaky external
  // request is a network fact, not a defect in this module.
  const origin = new URL(BASE_URL).origin;
  page.on('console', m => { if (m.type() === 'error' && (m.location().url || origin).startsWith(origin)) errs.push(m.text() + ' @' + (m.location().url || '')); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE_URL + '?v=' + Date.now());
  return { page, ctx, errs };
}

// ---------------------------------------------------------------- 1. page shape / no helpers
{
  const { page, ctx, errs } = await open();
  await page.waitForSelector('#stage-night3 .flag-input');
  check('subtitle is the new one',
    (await page.textContent('header p')).trim() === 'these challenges will hurt your brain more than the bite of 87');
  check('visitor-log box is gone', await page.locator('.raw-html').count() === 0);
  const placeholders = await page.locator('.flag-input').evaluateAll(els => els.map(e => e.placeholder));
  check('every flag input says "Put flag here"',
    placeholders.length === 3 && placeholders.every(p => p === 'Put flag here'), placeholders.join(' | '));
  // (the confetti engine owns a <canvas>; that is not a helper widget, so it is not counted here)
  check('no file inputs / dropzones / hexdumps anywhere',
    await page.locator('input[type=file], .dropzone, .hexdump, .meta-table, .bp-canvas').count() === 0);
  check('the only inputs on the page are the three flag boxes',
    await page.locator('input, textarea').count() === 3);
  const src = await (await fetch(BASE_URL + 'index.html')).text();
  const deadNames = ['mountRawBytesViewer', 'mountMetadataViewer', 'mountBitPlaneViewer', 'mountWeaveTool',
    'mountXorTool', 'bytesToHexDump', 'readFileAsBytes', 'parsePngTextChunks', 'extractLsbMessage',
    'wireDropTarget', 'weaveHalves', 'xorRepeating', 'dropzone', 'hexdump'];
  const present = deadNames.filter(n => src.includes(n));
  check('no dead helper code or CSS left in the file', present.length === 0, present.join(', '));
  const titles = await page.locator('.stage h2').evaluateAll(e => e.map(x => x.textContent.trim()));
  check('night titles', titles[0] === 'Night 1 · Meta Parts' && titles[1] === 'Night 2 · Bit Weaving'
    && titles[2] === 'Night 3 · Triple T', titles.slice(0, 3).join(' / '));
  check('stage count is still 7, FX_TOTAL matches the 3 real nights', await page.locator('.stage').count() === 7
    && await page.evaluate(() => window.FX_TOTAL) === 3);
  check('confetti button is present and locked',
    await page.locator('#fx-btn').getAttribute('aria-disabled') === 'true'
    && await page.locator('#reset-mod').count() === 1);
  check('no theme button', await page.locator('.hdr-btn').count() === 2);
  check('no console errors on load', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. the three nights solve
{
  const { page, ctx, errs } = await open();
  await page.waitForSelector('#stage-night3 .flag-input');
  const answers = { night1: 'flag{tune_into_the_static}', night2: 'flag{data_bender}', night3: 'flag{stop_scrolling}' };
  // a wrong answer must be rejected first, so "correct" is not just "any input turns green"
  await page.click('#stage-night1 .flag-input');
  await page.keyboard.type('flag{nope}');
  await page.click('#stage-night1 .flag-check');
  check('wrong flag is rejected', (await page.textContent('#stage-night1 .verdict')).includes('not it'));
  for (const [id, ans] of Object.entries(answers)) {
    await page.fill(`#stage-${id} .flag-input`, ans);
    await page.click(`#stage-${id} .flag-check`);   // real pointer click
    const v = (await page.textContent(`#stage-${id} .verdict`)).trim();
    check(`${id} accepts ${ans}`, v.startsWith('correct'), v);
  }
  check('solved state persisted', (await page.evaluate(() => localStorage.getItem('ctf-solved:v2:fnac'))).includes('night3'));
  check('no console errors while solving', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 3. assets + night 3 identity
{
  const { page, ctx } = await open();
  await page.waitForSelector('#night3-cipher');
  await page.waitForFunction(() => !document.getElementById('night3-cipher').textContent.startsWith('loading'));
  const onPage = await page.textContent('#night3-cipher');
  const fileBytes = new Uint8Array(await (await fetch(BASE_URL + 'assets/night3/night3-a.txt')).arrayBuffer());
  let latin = ''; fileBytes.forEach(b => latin += String.fromCharCode(b));
  check('on-page ciphertext is byte-identical to night3-a.txt', onPage === latin,
    `${onPage.length} chars vs ${fileBytes.length} bytes`);
  const key = 'tung tung tung sahur';
  let plain = '';
  fileBytes.forEach((b, i) => plain += String.fromCharCode(b ^ key.charCodeAt(i % key.length)));
  // The flag deliberately does NOT sit at offset 0 any more: at 0 a `flag{` crib lands first try and
  // there is nothing to crib-drag toward. This assertion used to pin offset 0, i.e. it defended the
  // very property the night was rebuilt to remove. It now pins the search instead.
  const flagAt = plain.indexOf('flag{stop_scrolling}');
  check('decoding with the key yields the flag', flagAt >= 0, plain.slice(0, 90));
  check('the flag is NOT at offset 0 — there is something to crib-drag toward', flagAt > 0, `offset ${flagAt}`);
  check('the flag sits at the key phase that reveals " sahu"', flagAt % key.length === 14,
    `phase ${flagAt % key.length}, want 14`);
  {
    const crib = 'flag{';
    const hits = [];
    for (let off = 0; off + crib.length <= fileBytes.length; off++) {
      let rec = '';
      for (let j = 0; j < crib.length; j++) rec += String.fromCharCode(fileBytes[off + j] ^ crib.charCodeAt(j));
      if (/^[a-z ]+$/.test(rec)) hits.push(`${off}:${rec}`);
    }
    check('the crib at the real offset recovers a slice of the key', hits.some(h => h === `${flagAt}: sahu`), hits.join(' '));
  }
  const links = await page.locator('.dl').evaluateAll(a => a.map(x => x.getAttribute('href')));
  const want = ['assets/night1/night1-a.png', 'assets/night1/night1-b.png', 'assets/night2/night2-a.bin',
    'assets/night2/night2-b.bin', 'assets/night3/night3-a.txt'];
  check('download links use the night<N>-<letter> names', want.every(w => links.includes(w)), links.join(' '));
  for (const href of [...want, 'assets/night3/hint-sahur.webp', 'assets/creep/eyes.png',
    'assets/creep/scare.mp3', 'assets/creep/flicker.mp3', 'assets/creep/lights-on.mp3']) {
    const r = await fetch(BASE_URL + href);
    check(`${href} serves 200`, r.status === 200, String(r.status));
  }
  check('Sahur hint image is still on the stage', await page.locator('#stage-night3 .hintimg').count() === 1);
  // Night 1's halves still carry their fragments in the trailing bytes
  for (const [href, frag] of [['assets/night1/night1-a.png', 'flag{tune_into_'], ['assets/night1/night1-b.png', 'the_static}']]) {
    const b = new Uint8Array(await (await fetch(BASE_URL + href)).arrayBuffer());
    let s = ''; b.forEach(v => s += String.fromCharCode(v));
    check(`${href} still carries "${frag}"`, s.includes(frag));
  }
  for (const href of ['assets/night2/night2-a.bin', 'assets/night2/night2-b.bin']) {
    const b = new Uint8Array(await (await fetch(BASE_URL + href)).arrayBuffer());
    let s = ''; b.forEach(v => s += String.fromCharCode(v));
    check(`${href} contains no "flag" byte string`, !s.includes('flag'));
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 4. 360px must not scroll sideways
{
  const { page, ctx } = await open({ viewport: { width: 360, height: 740 } });
  await page.waitForSelector('#stage-night3 .flag-input');
  await page.waitForFunction(() => !document.getElementById('night3-cipher').textContent.startsWith('loading'));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check('no horizontal overflow at 360px', m.sw <= m.cw, `scrollWidth ${m.sw} vs clientWidth ${m.cw}`);
  check('cards are unrotated on a phone', await page.evaluate(() => !document.getElementById('stage-night1').style.transform));
  await ctx.close();
}

// ---------------------------------------------------------------- 5. the 1-in-5 gate
{
  const { page, ctx } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  const hits = await page.evaluate(() => {
    let n = 0; for (let i = 0; i < 20000; i++) if (window.__creep.shouldFire()) n++;
    return n;
  });
  check('shouldFire() fires about a fifth of the time', Math.abs(hits / 20000 - 0.2) < 0.02, `${(hits / 200).toFixed(1)}% of 20000 rolls`);
  await page.evaluate(() => { window.__creep.setFired(true); });
  const afterFlag = await page.evaluate(() => { let n = 0; for (let i = 0; i < 2000; i++) if (window.__creep.shouldFire()) n++; return n; });
  check('never fires once the cookie flag is set', afterFlag === 0, `${afterFlag} of 2000`);
  await ctx.close();
}

// the WIRING: a real click/tap, with the roll forced each way
for (const [roll, expect] of [[0.05, true], [0.9, false]]) {
  const { page, ctx } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  await page.evaluate(r => { window.__creepRandom = () => r; }, roll);
  await page.mouse.click(550, 500);        // a real pointer click on the page background
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => window.__creep.state.phase !== 'idle');
  check(`first tap with roll ${roll} ${expect ? 'starts' : 'does not start'} the sequence`, running === expect);
  if (running) {
    // the trigger is a user-activation gesture, so play() must actually be PERMITTED
    const log = await page.evaluate(() => window.__playLog);
    check('audio was permitted on the tap-triggered path (play() resolved, not rejected)',
      log.length > 0 && log.every(e => e.ok), JSON.stringify(log));
    await page.evaluate(() => window.__creep.abort('test'));
  }
  check(`roll ${roll}: cookie flag ${expect ? 'set' : 'untouched'}`,
    await page.evaluate(() => window.__creep.fired()) === expect);
  await ctx.close();
}

// a real TOUCH tap on a phone-sized, touch-enabled context — not a mouse click
{
  const { page, ctx } = await open({ creepFired: false, viewport: { width: 390, height: 780 }, hasTouch: true });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.01; });
  await page.tap('body');                  // dispatches real touchstart/touchend, then click
  await page.waitForTimeout(400);
  check('a real touch tap starts the sequence on a phone-sized viewport',
    await page.evaluate(() => window.__creep.state.phase !== 'idle'));
  const log = await page.evaluate(() => window.__playLog);
  check('touch tap permits audio too', log.length > 0 && log.every(e => e.ok), JSON.stringify(log));
  // a second tap right after must not start counting toward the skip either
  await page.tap('body');
  check('the follow-up tap did not count toward the 3-tap skip',
    await page.evaluate(() => window.__creep.state.clicks) === 0);
  await page.evaluate(() => window.__creep.abort('test'));
  await ctx.close();
}

// the trigger is one-shot and the roll happens once: a second tap after a losing roll must not
// re-roll the dice until the page is reloaded.
{
  const { page, ctx } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.9; });
  await page.mouse.click(550, 500);
  await page.evaluate(() => { window.__creepRandom = () => 0.01; }); // a winning roll from here on
  for (let i = 0; i < 4; i++) await page.mouse.click(600, 520);
  await page.waitForTimeout(300);
  check('the trigger is one-shot: later taps do not re-roll',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  await ctx.close();
}

// scroll must NOT trigger it any more, and no scroll listener may remain
{
  const { page, ctx } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.01; }); // a roll that would win
  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, 900);          // a real wheel scroll
  await page.waitForTimeout(600);
  check('a scroll no longer starts the sequence',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  const src = await (await fetch(BASE_URL + 'index.html')).text();
  check("no scroll listener or scroll-position state remains in the source",
    !/addEventListener\('scroll'/.test(src) && !src.includes('scrollY') && !src.includes('onScroll'));
  await ctx.close();
}

// THE TRAP: the sequence is started BY a click, and three clicks skip it. A fast triple-click or
// a double-tap must not abort the scare it just started.
for (const [name, extraClicks, gap] of [['double-tap', 1, 40], ['fast triple-click', 2, 40], ['four fast taps', 3, 60]]) {
  const { page, ctx, errs } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.01; });
  await page.mouse.click(550, 500);                       // this one triggers it
  for (let i = 0; i < extraClicks; i++) { await page.mouse.click(550, 500, { delay: 5 }); await page.waitForTimeout(gap); }
  await page.waitForTimeout(120);
  check(`${name} at the trigger does not abort the sequence`,
    await page.evaluate(() => window.__creep.state.phase !== 'idle'),
    await page.evaluate(() => JSON.stringify({ phase: window.__creep.state.phase, clicks: window.__creep.state.clicks })));
  await page.evaluate(() => window.__creep.abort('test'));
  check(`${name}: no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 5b. type "scary" to arm
// Every case below starts from the WORST case for the feature: the cookie already says the creep
// has fired, and the roll is forced to a loser. So anything that runs, ran because of "scary".
async function armedPage() {
  const { page, ctx, errs } = await open({ creepFired: true });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.9; });
  return { page, ctx, errs };
}

{
  const { page, ctx, errs } = await armedPage();
  await page.keyboard.type('scary');                       // real keystrokes, nothing focused
  check('typing "scary" arms it', await page.evaluate(() => window.__creep.armed()));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(400);
  check('the next click fires the sequence at 100% despite a losing roll and a set cookie',
    await page.evaluate(() => window.__creep.state.phase !== 'idle'));
  check('the arming was consumed by that click', await page.evaluate(() => !window.__creep.armed()));
  const log = await page.evaluate(() => window.__playLog);
  check('the armed click is a gesture: play() resolved', log.length > 0 && log.every(e => e.ok), JSON.stringify(log));
  await page.evaluate(() => window.__creep.abort('test'));
  await page.waitForTimeout(100);
  await page.mouse.click(560, 520);
  await page.waitForTimeout(400);
  check('a second click does NOT fire it again — one click, then back to normal',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  check('no console errors on the "scary" path', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// case-insensitive, and armed by a skipped run counts as consumed
{
  const { page, ctx } = await armedPage();
  await page.keyboard.type('ScArY');
  check('"scary" matches case-insensitively', await page.evaluate(() => window.__creep.armed()));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(300);
  check('uppercase spelling still fires it', await page.evaluate(() => window.__creep.state.phase !== 'idle'));
  await page.keyboard.press('Space');                       // skip it
  check('skipping still leaves the arming spent',
    await page.evaluate(() => window.__creep.state.phase === 'idle' && !window.__creep.armed()));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(400);
  check('after a SKIPPED armed run, the next click does not re-fire',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  await ctx.close();
}

// typing it twice does not stack
{
  const { page, ctx } = await armedPage();
  await page.keyboard.type('scaryscary');
  check('typing it twice is a no-op, not a stack', await page.evaluate(() => window.__creep.armed()));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(300);
  check('double-armed: first click fires', await page.evaluate(() => window.__creep.state.phase !== 'idle'));
  await page.evaluate(() => window.__creep.abort('test'));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(400);
  check('double-armed: the second click does NOT fire a second run',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  await ctx.close();
}

// THE TRAP AGAIN: the arming click must not count toward the 3-click skip
{
  const { page, ctx } = await armedPage();
  await page.keyboard.type('scary');
  await page.mouse.click(550, 500);                          // this one fires it
  for (let i = 0; i < 3; i++) { await page.mouse.click(550, 500, { delay: 5 }); await page.waitForTimeout(40); }
  await page.waitForTimeout(150);
  check('a fast triple-click right after the arming click does not abort the sequence',
    await page.evaluate(() => window.__creep.state.phase !== 'idle'),
    await page.evaluate(() => JSON.stringify({ phase: window.__creep.state.phase, clicks: window.__creep.state.clicks })));
  await page.evaluate(() => window.__creep.abort('test'));
  await ctx.close();
}

// typing in a flag field must not arm anything
{
  const { page, ctx } = await armedPage();
  await page.click('#stage-night1 .flag-input');
  await page.keyboard.type('scary');
  check('typing "scary" INTO a flag input does not arm it', await page.evaluate(() => !window.__creep.armed()));
  check('the text went into the field where it belongs',
    await page.inputValue('#stage-night1 .flag-input') === 'scary');
  await page.mouse.click(550, 700);
  await page.waitForTimeout(400);
  check('and the following click does not fire the sequence',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  await ctx.close();
}

// while the sequence is running, "scary" is ignored (it must not arm the click that follows it)
{
  const { page, ctx } = await armedPage();
  await page.keyboard.type('scary');
  await page.mouse.click(550, 500);
  await page.waitForTimeout(300);
  await page.keyboard.type('scary');                         // typed mid-sequence
  check('"scary" typed during the sequence is ignored', await page.evaluate(() => !window.__creep.armed()));
  await page.evaluate(() => window.__creep.abort('test'));
  await page.mouse.click(550, 500);
  await page.waitForTimeout(400);
  check('so the click after it does not fire another run',
    await page.evaluate(() => window.__creep.state.phase === 'idle'));
  await ctx.close();
}

// the konami handler had the same typing-in-a-field hole; it is now guarded
{
  const { page, ctx } = await open({ unlocked: true });
  await page.waitForSelector('#stage-night1 .flag-input');
  // drop the completion index WITHOUT reloading: the module stays rendered (inputs exist), but
  // konami is now live again — exactly the state where the hole would bite. Cookies are cleared
  // through the context, not document.cookie: addCookies() scoped them to the module's path, so a
  // path=/ deletion would silently leave one in place and make this check pass for the wrong reason.
  await ctx.clearCookies();
  await page.evaluate(k => localStorage.removeItem(k), 'ctf-complete:v1');
  check('the module really does read as locked before the konami keys are typed',
    await page.evaluate(() => !unlocked()));
  await page.click('#stage-night2 .flag-input');
  await page.keyboard.type('flag{almost}');
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
    await page.keyboard.press(k);
  check('konami keys typed inside a flag field do not trigger the unlock re-render',
    await page.evaluate(() => !document.cookie.includes('ctf-fnac-bypass=1')));
  check('...and the half-typed flag survives',
    (await page.inputValue('#stage-night2 .flag-input')).startsWith('flag{almost}'),
    await page.inputValue('#stage-night2 .flag-input'));
  // NEGATIVE CONTROL — without this the check above passes for any reason at all (wrong keys,
  // dead handler, cookie never cleared). The SAME keystrokes with nothing focused must unlock.
  await page.evaluate(() => document.activeElement.blur());
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
    await page.keyboard.press(k);
  check('control: the same konami keys with no field focused DO unlock',
    await page.evaluate(() => document.cookie.includes('ctf-fnac-bypass=1')));
  await ctx.close();
}

// "spook me again" clears the flag and runs it, from a real click
{
  const { page, ctx, errs } = await open({ creepFired: true });
  await page.waitForSelector('#spook');
  await page.evaluate(() => { window.__creepRandom = () => 0.9; }); // prove the button ignores the roll
  await page.click('#spook');
  await page.waitForTimeout(300);
  check('"spook me again" starts the sequence from a real click',
    await page.evaluate(() => window.__creep.state.phase !== 'idle'));
  const log = await page.evaluate(() => window.__playLog);
  check('"spook me again" is a gesture too: play() resolved', log.length > 0 && log.every(e => e.ok), JSON.stringify(log));
  await page.evaluate(() => window.__creep.abort('test'));
  check('no console errors around the spook button', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 6. skipping
async function skipRun(how, waitMs) {
  const { page, ctx, errs } = await open({ creepFired: false });
  await page.waitForSelector('#spook');
  // start it the way a student does — a real tap — so the audio is actually playing and
  // "audio stopped" below is a real assertion rather than a vacuous one under autoplay block.
  await page.evaluate(() => { window.__creepRandom = () => 0.01; });
  await page.mouse.click(550, 500);
  await page.waitForTimeout(waitMs);
  const phaseBefore = await page.evaluate(() => window.__creep.state.phase);
  const t0 = Date.now();
  if (how === 'space') await page.keyboard.press('Space');
  else for (let i = 0; i < 3; i++) { await page.mouse.click(550, 500); await page.waitForTimeout(60); }
  const stopped = await page.evaluate(() => window.__creep.state.phase === 'idle');
  const dt = Date.now() - t0;
  const overlay = await page.evaluate(() => {
    const el = document.getElementById('creep');
    return { on: el.classList.contains('on'), opacity: el.style.opacity };
  });
  const audioLive = await page.evaluate(() => Object.values(window.__creep.audio()).some(a => !a.paused));
  const played = await page.evaluate(() => window.__playLog.filter(e => e.ok).length);
  check(`skip by ${how}: audio was actually playing before the skip (${played} play() calls resolved)`, played > 0);
  check(`skip by ${how} during "${phaseBefore}" aborts immediately`, stopped && dt < 900, `${dt}ms`);
  check(`skip by ${how}: overlay cleared`, !overlay.on && overlay.opacity === '0', JSON.stringify(overlay));
  check(`skip by ${how}: audio stopped`, !audioLive);
  check(`skip by ${how}: cookie flag still set`, await page.evaluate(() => window.__creep.fired()));
  // and nothing queued fires afterwards
  await page.waitForTimeout(1500);
  check(`skip by ${how}: nothing restarts afterwards`, await page.evaluate(() => window.__creep.state.phase === 'idle'));
  check(`skip by ${how}: no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await skipRun('space', 700);    // mid-flicker
await skipRun('clicks', 700);   // mid-flicker, and past the 500ms click dead zone
await skipRun('space', 4600);   // during the eyes
await skipRun('clicks', 4600);

// ---------------------------------------------------------------- 7. gate: needs ALL THREE
// Caesar + XOR + Encoding. Zero, one and two of them must all stay locked; the stale
// pre-change `ctf-fnac-unlocked=1` cookie must not buy anything on its own.
{
  const cases = [
    ['zero modules complete', {}],
    ['one module complete', { encoding: done(6, 6) }],
    ['two modules complete', { encoding: done(6, 6), caesar: done(7, 7) }],
    ['three modules present but one incomplete',
      { encoding: done(6, 6), caesar: done(7, 7), xor: { c: false, n: 3, t: 4 } }]
  ];
  for (const [label, gate] of cases) {
    const { page, ctx } = await open({ gate });
    await page.waitForSelector('.locked');
    check(`locked with ${label}`, await page.locator('.stage').count() === 0);
    await ctx.close();
  }
  {
    const { page, ctx } = await open({ gate: {}, staleCookie: true });
    await page.waitForSelector('.locked');
    check('a stale ctf-fnac-unlocked=1 cookie does NOT bypass the new rule',
      await page.locator('.stage').count() === 0);
    const txt = await page.textContent('.locked');
    check('the locked screen names all three modules',
      ['Caesar', 'XOR', 'Encoding'].every(n => txt.includes(n)), txt.replace(/\s+/g, ' ').trim());
    check('the locked screen links the unfinished ones',
      await page.locator('.locked a[href="../ceasar/"], .locked a[href="../xor/"], .locked a[href="../encoding/"]').count() === 3);
    await ctx.close();
  }
  {
    const { page, ctx, errs } = await open({ unlocked: true });
    await page.waitForSelector('#stage-night1');
    check('unlocked with all three complete', await page.locator('.stage').count() === 7);
    check('no console errors on the unlocked-by-progress path', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

// ---------------------------------------------------------------- 7b. konami bypass
{
  const { page, ctx, errs } = await open({ gate: {} });
  await page.waitForSelector('.locked');
  check('the gate hides the module', await page.locator('.stage').count() === 0);
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
    await page.keyboard.press(k);
  await page.waitForSelector('#stage-night1', { timeout: 3000 });
  check('konami code unlocks the module', await page.locator('.stage').count() === 7);
  check('konami render leaves exactly one spook button', await page.locator('#spook').count() === 1);
  check('no console errors through the konami path', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES:\n - ` + fails.join('\n - ') : '\nall module checks passed');
process.exit(fails.length ? 1 : 0);
