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

// The unlock drop plays ONCE, the first time an unlocked student loads the page, and while it is
// playing the module underneath is inert. Every test here that is not about the drop wants the
// state a student is in on their SECOND visit, so the "already played" key is seeded by default
// and the drop tests opt back in with reveal:true.
const REVEAL_KEY = 'ctf-fnac-reveal:v1';

async function open({ viewport = { width: 1100, height: 950 }, unlocked = true, creepFired = true,
                     hasTouch = false, gate = null, staleCookie = false, reveal = false,
                     reducedMotion = 'no-preference', revealRandom = null } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch, isMobile: hasTouch, reducedMotion });
  const cookies = [];
  // the pre-gate-change cookie: seeded only where a test asserts it does NOT grant access
  if (staleCookie) cookies.push({ name: 'ctf-fnac-unlocked', value: '1', url: BASE_URL });
  cookies.push({ name: 'ctf-fnac-creep', value: creepFired ? '1' : '0', url: BASE_URL });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await seedGate(page, gate || (unlocked ? ALL_THREE : {}));
  if (!reveal) await page.addInitScript(k => { try { localStorage.setItem(k, '1'); } catch (e) {} }, REVEAL_KEY);
  // pin the corner roll and the swing jitter, for the tests that need two runs to be comparable
  if (revealRandom !== null) await page.addInitScript(v => { window.__revealRandom = () => v; }, revealRandom);
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
//
// WHAT "LOCKED" MEANS CHANGED, and these assertions changed with it. The gate used to do
// `app.innerHTML = lockedMarkup()`, so a locked page had zero .stage elements and the old checks
// counted them. The module has to render before anything can fall off the front of it, so it
// renders always and the gate is an overlay on top. Counting stages would now be counting the
// wrong thing entirely — it would fail on a page that is correctly locked. What is asserted
// instead is the intent the count was standing in for: the board covers the viewport, and the
// module behind it cannot be read, clicked, tabbed into or scrolled to.
//
// It is NOT asserted that the flags are unreachable. They are in the page source either way,
// on a page whose whole point is that students go looking in page sources.
async function checkShut(page, label) {
  await page.waitForSelector('#gate-panel .locked');
  const shut = await page.evaluate(() => {
    const p = document.getElementById('gate-panel'), a = document.getElementById('app');
    const r = p.getBoundingClientRect();
    return {
      covers: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight,
      opaque: getComputedStyle(p).backgroundColor === 'rgb(13, 12, 10)',
      inert: a.inert === true && a.getAttribute('aria-hidden') === 'true',
      noScroll: getComputedStyle(document.documentElement).overflow === 'hidden',
      // the panel is what a click at the centre of the screen actually lands on
      onTop: p.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2))
    };
  });
  check(`${label}: the board covers the viewport, opaque, on top`, shut.covers && shut.opaque && shut.onTop, JSON.stringify(shut));
  check(`${label}: the module behind it is inert and cannot be scrolled to`, shut.inert && shut.noScroll, JSON.stringify(shut));
  // real tabbing, not a computed guess: nothing behind the board may take focus
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a ? a.tagName : null, inApp: !!(a && document.getElementById('app').contains(a)) };
  });
  check(`${label}: tabbing cannot reach the module behind the board`, !focus.inApp, JSON.stringify(focus));
}

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
    await checkShut(page, `locked with ${label}`);
    await ctx.close();
  }
  {
    const { page, ctx } = await open({ gate: {}, staleCookie: true });
    await checkShut(page, 'a stale ctf-fnac-unlocked=1 cookie does NOT bypass the new rule');
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
    check('unlocked with all three complete', await page.locator('.stage').count() === 7
      && await page.locator('#gate-panel').count() === 0
      && await page.evaluate(() => document.getElementById('app').inert !== true));
    check('no console errors on the unlocked-by-progress path', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

// ---------------------------------------------------------------- 7b. konami bypass
{
  const { page, ctx, errs } = await open({ gate: {}, reveal: true });
  await checkShut(page, 'the gate covers the module');
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
    await page.keyboard.press(k);
  await page.waitForSelector('#stage-night1', { timeout: 3000 });
  check('konami code takes the board off', await page.locator('.stage').count() === 7
    && await page.locator('#gate-panel').count() === 0
    && await page.evaluate(() => document.getElementById('app').inert !== true));
  // the bypass is a way in, not a reward: no physics on this path, and it must not queue one
  check('konami does not run the drop animation', await page.evaluate(() => window.__reveal.state() === null));
  check('konami render leaves exactly one spook button', await page.locator('#spook').count() === 1);
  check('no console errors through the konami path', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 8. the unlock drop
// Motion is unwatchable in an automation tab (rAF is paused, computed style reads pre-animation
// values), so nothing here looks at pixels. The simulation is driven through window.__reveal.step
// and the state it reports is what gets asserted.
{
  const { page, ctx, errs } = await open({ reveal: true });
  await page.waitForSelector('#gate-panel');
  // Rewind to t=0 with the rAF loop detached FIRST. The animation is already running by the time
  // Playwright gets here, so a covers-the-viewport check taken before this is a race against the
  // board having started to swing — and it lost that race once.
  const s0 = await page.evaluate(() => {
    localStorage.removeItem('ctf-fnac-reveal:v1');
    return window.__reveal.restart();
  });
  await checkShut(page, 'the drop starts with the board up');
  check('it starts held at two corners, not moving', s0.phase === 'held' && s0.ang === 0 && s0.angVel === 0,
    JSON.stringify({ phase: s0.phase, ang: s0.ang }));
  check('the pivot is the corner that did not go first', s0.pivot !== s0.first && ['tl', 'tr'].includes(s0.first),
    `${s0.first} released, hanging from ${s0.pivot}`);

  // step to just after the first release, then to just before the second
  const step = ms => page.evaluate(m => window.__reveal.step(m), ms);
  const s1 = await step(1200);
  check('the first corner releases and it starts swinging', s1.phase === 'swing' && s1.angVel !== 0, JSON.stringify({ phase: s1.phase, angVel: s1.angVel }));
  check('the drop is marked played the moment the first corner goes', await page.evaluate(() => window.__reveal.played()));
  // one full swing PLUS a roll of up to SWING_JITTER more of one, never less
  const P = await page.evaluate(() => window.__reveal.PHYS);
  const swings = (s1.releaseSecondAt - P.HOLD) / (s1.period * 1000);
  check('the second corner is scheduled at one full swing plus a jitter that can only add',
    swings >= 1 - 1e-9 && swings <= 1 + P.SWING_JITTER + 1e-9,
    `${swings.toFixed(4)} swings, period ${(s1.period).toFixed(3)}s, second release ${(s1.releaseSecondAt - P.HOLD).toFixed(0)}ms after the first`);

  // walk the swing in 8ms slices and watch it come back. A full swing means the angle returns to
  // where it started with the spin reversing sign, and the second corner must not have gone before that.
  // The board hangs from one corner, so it starts off to one side and swings TOWARDS straight
  // down. `ang` is how far it has turned from where it was nailed: 0 at the start, theta0 when
  // the centre is directly under the pivot, 2*theta0 at the far side, and back to 0 one full
  // swing later. Sign follows which corner is holding it, so everything below is measured on
  // |ang| against theta0 = atan(W/H).
  const walk = await page.evaluate(async () => {
    const st = window.__reveal.state();
    const theta0 = Math.atan2(st.W / 2, st.H / 2);
    const out = { theta0, peak: 0, downAt: null, farAt: null, back: null, swingEndedAt: null };
    for (let i = 0; i < 2000; i++) {
      const s = window.__reveal.step(8);
      if (!s) break;
      const a = Math.abs(s.ang);
      out.peak = Math.max(out.peak, a);
      if (out.downAt === null && a >= theta0) out.downAt = s.t;          // passed straight down
      if (out.farAt === null && a >= 2 * theta0 - 0.01) out.farAt = s.t; // reached the far side
      if (out.back === null && out.farAt !== null && a <= 0.01) out.back = s.t;
      if (s.phase !== 'swing') { out.swingEndedAt = s.t; break; }
    }
    return out;
  });
  check('the board swings past straight down and all the way back to where it started',
    walk.downAt !== null && walk.farAt !== null && walk.back !== null
    && Math.abs(walk.peak - 2 * walk.theta0) < 0.02,
    `straight down at ${walk.downAt}ms, far side at ${walk.farAt}ms, back at ${walk.back}ms, peak |ang| ${walk.peak.toFixed(4)} vs 2*theta0 ${(2 * walk.theta0).toFixed(4)}`);
  check('the second corner does not release before the swing has come back',
    walk.swingEndedAt !== null && walk.back !== null && walk.swingEndedAt >= walk.back,
    `came back at ${walk.back}ms, second corner at ${walk.swingEndedAt}ms`);

  // once loose, it falls and leaves the viewport, and the rAF loop is not left running
  const fell = await page.evaluate(async () => {
    for (let i = 0; i < 2000; i++) { const s = window.__reveal.step(8); if (!s || s.phase === 'gone') return s; }
    return window.__reveal.state();
  });
  check('it falls off the screen and the panel is removed', fell.phase === 'gone'
    && await page.locator('#gate-panel').count() === 0, JSON.stringify({ phase: fell.phase, cy: fell.cy }));
  check('the rAF loop is stopped', fell.raf === 0);
  check('the module is live again once the board is gone',
    await page.evaluate(() => document.getElementById('app').inert !== true)
    && await page.locator('#spook').count() === 1);
  check('no console errors through the drop', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// clicking it while it is loose: additive impulses, and a 50/50 sideways direction
{
  const { page, ctx, errs } = await open({ reveal: true });
  await page.waitForSelector('#gate-panel');
  // NOTE ON HOW THIS IS DRIVEN. The clicks below mostly do not advance time between them. That
  // is not a shortcut around a hit limit (there isn't one) — it is because the sideways kick is
  // a real coin flip, so a long run of clicks with time passing legitimately walks the board off
  // the side of the screen and out of play. That is the behaviour the author asked for, so it
  // cannot also be the thing the test needs to not happen.
  const res = await page.evaluate(() => {
    window.__reveal.restart();
    window.__reveal.step(1200);                      // first corner gone
    while (window.__reveal.state().phase === 'swing') window.__reveal.step(8);   // now free
    while (window.__reveal.state().vy <= 0) window.__reveal.step(8);             // let it be falling
    const falling = window.__reveal.state();
    window.__reveal.punch(500, 400);
    const one = window.__reveal.state();
    const one_dvy = one.vy - falling.vy;
    window.__reveal.punch(500, 400); window.__reveal.punch(500, 400);
    const three = window.__reveal.state();
    // 200 more, sampling the coin flip. No time passes, so nothing can leave the viewport and
    // "did a click ever stop working" is a real question rather than a race.
    const dirs = [], sides = [];
    for (let i = 0; i < 200; i++) {
      const vx0 = window.__reveal.state().vx;
      dirs.push(window.__reveal.punch(500, 400));
      sides.push(window.__reveal.state().vx - vx0);
    }
    return { falling, one, one_dvy, three, dirs, sides, H: falling.H, after: window.__reveal.state() };
  });
  check('a click while it is falling reverses it: downward velocity becomes upward',
    res.falling.vy > 0 && res.one.vy < 0,
    `falling at ${res.falling.vy.toFixed(0)}px/s, ${res.one.vy.toFixed(0)}px/s after one click`);
  check('the upward impulse is the one the constant asks for',
    Math.abs(res.one_dvy + 1.35 * res.H) < 1e-6, `${res.one_dvy.toFixed(1)}px/s per click`);
  check('impulses are additive: three clicks add three times the velocity of one',
    Math.abs((res.three.vy - res.falling.vy) - 3 * res.one_dvy) < 1e-6,
    `${(res.three.vy - res.falling.vy).toFixed(1)}px/s from three vs ${res.one_dvy.toFixed(1)} from one`);
  const left = res.dirs.filter(d => d === -1).length, right = res.dirs.filter(d => d === 1).length;
  check('the sideways direction is a coin flip, not always the same', left > 20 && right > 20,
    `${left} left / ${right} right over 200 clicks`);
  check('the sideways kick is the same size whichever way it goes',
    res.sides.every(s => Math.abs(Math.abs(s) - 0.45 * res.H) < 1e-6),
    `${(0.45 * res.H).toFixed(1)}px/s either way`);
  check('there is no hit limit: click 203 still works', res.dirs[199] !== null && res.after.phase === 'free');
  // driving the RNG proves the coin flip reads it, both ways
  const forced = await page.evaluate(() => {
    window.__revealRandom = () => 0.1; const a = window.__reveal.punch(500, 400);
    window.__revealRandom = () => 0.9; const b = window.__reveal.punch(500, 400);
    delete window.__revealRandom; return [a, b];
  });
  check('the coin flip is the random source, driven both ways', forced[0] === -1 && forced[1] === 1, JSON.stringify(forced));
  // and a real pointer click on the real element, not the hook: the panel must actually be hit-testable
  const real = await page.evaluate(() => window.__reveal.state().vy);
  await page.mouse.click(550, 470);
  check('a real pointer click on the board is what drives it',
    await page.evaluate(v => window.__reveal.state().vy < v, real));
  check('no console errors while juggling', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// Frame-rate independence: the integrator is driven by elapsed time, so 2 seconds of animation
// must land in the same place whether it arrived as 120 frames or 240. Both runs are seeded to
// the same corner and the same swing jitter, so the frame rate is the only difference.
{
  const twoSeconds = async n => {
    const { page, ctx } = await open({ reveal: true, revealRandom: 0.25 });
    await page.waitForSelector('#gate-panel');
    const s = await page.evaluate(frames => {
      window.__reveal.restart();
      window.__reveal.step(1200);
      const dt = 2000 / frames;
      for (let i = 0; i < frames; i++) window.__reveal.step(dt);
      return window.__reveal.state();
    }, n);
    await ctx.close();
    return s;
  };
  const a = await twoSeconds(120), b = await twoSeconds(240);
  check('60Hz and 120Hz land in the same place after the same elapsed time',
    a.first === b.first && Math.abs(a.ang - b.ang) < 0.01 && Math.abs(a.cy - b.cy) < 2,
    `ang ${a.ang.toFixed(4)} vs ${b.ang.toFixed(4)}, cy ${a.cy.toFixed(1)} vs ${b.cy.toFixed(1)}`);
}

// it plays once ever: a reload after the drop shows the module with no board
{
  const { page, ctx, errs } = await open({ reveal: true });
  await page.waitForSelector('#gate-panel');
  await page.evaluate(() => { window.__reveal.step(1200); });   // first corner goes, key is set
  await page.reload();
  await page.waitForSelector('#stage-night1');
  check('a reload after the drop has started shows the module with no board and no animation',
    await page.locator('#gate-panel').count() === 0
    && await page.evaluate(() => window.__reveal.state() === null)
    && await page.evaluate(() => document.getElementById('app').inert !== true));
  check('no console errors on the second visit', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// prefers-reduced-motion: no board, no physics, just the module
{
  const { page, ctx, errs } = await open({ reveal: true, reducedMotion: 'reduce' });
  await page.waitForSelector('#stage-night1');
  check('reduced motion reveals the module with no drop at all',
    await page.locator('#gate-panel').count() === 0
    && await page.evaluate(() => window.__reveal.state() === null)
    && await page.evaluate(() => document.getElementById('app').inert !== true)
    && await page.locator('#spook').count() === 1);
  check('reduced motion still gets the LOCKED board when the modules are unfinished',
    await (async () => {
      const { page: p2, ctx: c2 } = await open({ gate: {}, reveal: true, reducedMotion: 'reduce' });
      const ok = await p2.locator('#gate-panel .locked').count() === 1;
      await c2.close(); return ok;
    })());
  check('no console errors under reduced motion', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES:\n - ` + fails.join('\n - ') : '\nall module checks passed');
process.exit(fails.length ? 1 : 0);
