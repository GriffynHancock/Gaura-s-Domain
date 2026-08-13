// Reporting helper (not an assertion): predicted wall-clock length of a one-rate-block SHA-3 run
// at a set of slider positions, computed from the page's own sha3PhaseDuration by replaying the
// escalation counters exactly as sha3StartPhase advances them. No animation is played, so this is
// fast and is not subject to rAF throttling in an automation tab.
import { chromium } from 'playwright';
const BASE_URL = process.env.HASH_MODULE_URL || 'http://localhost:8787/public/crypto/hash/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE_URL + '?v=dur' + Date.now());
await page.waitForFunction(() => !!window.__sha3Debug, { timeout: 8000 });
const out = await page.evaluate(() => {
  const order = ['theta', 'rho', 'pi', 'chi', 'iota'];
  const run = (v, blocks) => {
    document.getElementById('speed-slider').value = String(v);
    let total = 0;
    for (let b = 0; b < blocks; b++) {
      sha3.blocksDone = b; sha3.roundsInBlock = 0;
      for (let r = 0; r < 24; r++) {
        sha3.roundsInBlock = r;
        for (const t of order) total += sha3PhaseDuration(t);
      }
    }
    sha3.blocksDone = 0; sha3.roundsInBlock = 0;
    return total / 1000;
  };
  const res = {};
  for (const v of [1, 10, 18, 25, 50, 75, 100]) res[v] = { oneBlock: run(v, 1), fourBlocks: run(v, 4) };
  document.getElementById('speed-slider').value = '50';
  return res;
});
for (const [v, d] of Object.entries(out)) {
  console.log(`slider ${String(v).padStart(3)}  1 rate-block: ${d.oneBlock.toFixed(1)}s   4 rate-blocks: ${d.fourBlocks.toFixed(1)}s`);
}
await browser.close();
