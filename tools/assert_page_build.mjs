// A GUARD AGAINST TESTING THE WRONG COPY OF THE PAGE.
//
// Why this exists, in full, because the failure it prevents cost real time and very nearly cost
// a correct piece of work:
//
// These scripts take their target from HASH_MODULE_URL and point a browser at whatever is there.
// The repo has more than one checkout of the same file — a git worktree is a second working tree
// of the same repository — so `python3 -m http.server` started from the wrong directory serves a
// DIFFERENT, usually older, index.html at a URL that looks completely correct. Nothing about the
// URL, the port, or a 200 response distinguishes the two.
//
// Left unguarded, that mismatch does not fail cleanly. It fails as a LIE. A test reading a debug
// field the older page has never heard of gets `undefined`, and the arithmetic downstream turns
// that into a plausible-looking wrong answer rather than an error:
//
//     undefined % 360            -> NaN
//     Math.round(NaN)            -> NaN
//     new Set([NaN, NaN, ...])   -> size 1     // NaN is equal to itself for Set purposes
//
// which surfaced as "per-lane rho rotations are not distinct enough: only 1 distinct angle across
// 25 lanes" — i.e. as a report that the project's headline visual fix had regressed to exactly
// the defect the owner originally complained about. The page was fine. The server was serving a
// different checkout. Measured afterwards on the correct page: 8 distinct true angles and 25
// distinct drawn ones, at every slider position.
//
// So: before asserting anything about behaviour, assert that the page being served is the one
// this test was written against, and say so in terms that point straight at the server.
export async function assertPageBuild(page, url, fields) {
  const missing = await page.evaluate(fs => {
    const out = [];
    const dbg = window.__sha3Debug;
    if (!dbg) return ['window.__sha3Debug'];
    for (const f of fs) {
      if (f.startsWith('lane.')) {
        const key = f.slice(5);
        const lanes = dbg.lanes ? dbg.lanes() : [];
        if (!lanes.length || !Number.isFinite(lanes[0][key])) out.push(f);
      } else if (f.startsWith('window.')) {
        if (typeof window[f.slice(7)] !== 'function') out.push(f);
      } else if (f.startsWith('const.')) {
        // A tuning CONSTANT the test is written against, rather than a function. Same purpose:
        // a build that predates the constant is a build these assertions do not describe.
        // Looked up by EVALUATING the bare name, not off `window`: a top-level `const` is a
        // lexical global binding and is deliberately NOT a property of the window object, so
        // `window[name]` reports every one of them missing on a page that has them all.
        try { if (eval(f.slice(6)) === undefined) out.push(f); } catch (e) { out.push(f); }
      } else if (typeof dbg[f] !== 'function') {
        out.push('__sha3Debug.' + f);
      }
    }
    return out;
  }, fields);
  if (missing.length) {
    throw new Error(
      `the page being served is not the build this test was written against — it is missing: ${missing.join(', ')}.\n` +
      `  URL: ${url}\n` +
      `  This is almost always the server, not the page: check that the static server was started ` +
      `from the root of the checkout you mean to test (a git worktree is a separate working tree ` +
      `of the same repo and serves its own copy of public/crypto/hash/index.html), and that ` +
      `HASH_MODULE_URL points at that server. Compare hashes to be certain:\n` +
      `    curl -s <HASH_MODULE_URL>index.html | md5   vs   md5 -q public/crypto/hash/index.html`);
  }
}
