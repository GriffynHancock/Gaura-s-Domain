// RUN THE HASH-MODULE TEST SUITE — with the two things that were costing whole minutes:
// a default that leaves out the one script that cannot be made fast, and parallelism for the
// scripts that provably do not care about the machine being busy.
//
//   node tools/run_suite.mjs                  # the FAST GATE: everything except flash safety
//   node tools/run_suite.mjs --all            # ...plus verify_flash_safety (~4 min, see below)
//   node tools/run_suite.mjs --only task3,step_through
//   node tools/run_suite.mjs --list
//
// Needs a served page, exactly like the scripts it runs:
//   python3 -m http.server 8830        (from the repo root)
//   HASH_MODULE_URL="http://localhost:8830/public/crypto/hash/" node tools/run_suite.mjs
//
// WHY THERE ARE THREE GROUPS
//
//   pure/state — assert on recorded state, DOM text and digests. They wait on page conditions
//     with generous timeouts, so a slower machine makes them take longer and never makes them
//     wrong. Safe to run several at once; this group is the whole reason the runner exists.
//
//   timing — assert on pacing: phase durations, frame counts, ease fractions sampled at a known
//     offset, escalation curves, the aliasing shutter. Chromium's rAF is wall-clock driven, so a
//     machine loaded with three other headless browsers really can drop these below the rates they
//     measure and produce a FAILURE THAT IS NOT A BUG. This repo has already burned sessions on
//     plausible-looking fake results (see CLAUDE.md), so these run one at a time by default, and
//     they run AFTER the parallel group has finished rather than alongside it. --jobs raises the
//     concurrency for anyone who has measured their machine and accepts that trade.
//
//   safety — verify_flash_safety measures a real flash pace over real time against WCAG 2.3.1.
//     It is ~4 minutes because a photosensitivity measurement cannot be fast-forwarded, and it is
//     two thirds of the suite's total wall clock. It is OPT-IN, not because it is optional but
//     because it is only meaningful for changes that can move a flash (animation timing, pacing,
//     escalation/aliasing curves, per-frame colour, opacity/blur, the governor, repaint cadence).
//     Run it — with --all — whenever your change touches any of those. See
//     .superpowers/sdd/AGENT-WORKING-AGREEMENT.md rule 6: an agent was killed on this branch for
//     running it on a header-button change.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const GROUPS = {
  pure:   ['test_md5_trace', 'test_keccak_trace'],
  state:  ['verify_task5_md5_registers', 'verify_task6_block_stack', 'verify_task7_input_box',
           'verify_task8_collision', 'verify_task9_full_integration', 'verify_sha3_touch_drag'],
  timing: ['verify_task3_lane_grid', 'verify_task4_sha3_animation', 'verify_step_through',
           'verify_task_wiggle_juice', 'verify_sha3_aliasing', 'verify_pi_pacing'],
  safety: ['verify_flash_safety'],
};

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
// Accepts both `--only=a,b` and `--only a,b` — getting that wrong silently runs the WHOLE suite
// when someone asked for one script, which is the exact failure mode this runner exists to stop.
const valOf = f => {
  const eq = argv.find(x => x.startsWith(f + '='));
  if (eq) return eq.slice(f.length + 1);
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

if (has('--list')) {
  for (const [g, names] of Object.entries(GROUPS)) console.log(`${g.padEnd(7)} ${names.join(' ')}`);
  process.exit(0);
}

const only = valOf('--only');
const jobs = Math.max(1, Number(valOf('--jobs') || 1));
const parallel = [...GROUPS.pure, ...GROUPS.state];
let serial = [...GROUPS.timing];
if (has('--all')) serial = [...serial, ...GROUPS.safety];

let plannedParallel = parallel, plannedSerial = serial;
if (only) {
  const want = only.split(',').map(s => s.trim()).filter(Boolean);
  const match = name => want.some(w => name.includes(w));
  plannedParallel = parallel.filter(match);
  plannedSerial = [...GROUPS.timing, ...GROUPS.safety].filter(match);
  const all = [...plannedParallel, ...plannedSerial];
  if (!all.length) { console.error(`--only matched nothing. Try --list.`); process.exit(2); }
}

function run(name) {
  const started = Date.now();
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(HERE, name + '.mjs')], {
      env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', code => resolve({ name, code, out, ms: Date.now() - started }));
  });
}

// A bounded worker pool — no fixed waits anywhere, each slot starts the next script the instant
// one finishes.
async function pool(names, n) {
  const queue = [...names], results = [];
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const r = await run(name);
      results.push(r);
      console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${(r.ms / 1000).toFixed(1)}s  ${r.name}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, names.length) }, worker));
  return results;
}

// The parallel group's concurrency is fixed at 4 on purpose — these scripts are contention-safe,
// so --jobs (which is about accepting contention risk) has nothing to say about them.
const PARALLEL_JOBS = 4;
const t0 = Date.now();
console.log(`-- ${plannedParallel.length} state/pure scripts, ${PARALLEL_JOBS} at a time`);
const results = await pool(plannedParallel, PARALLEL_JOBS);
if (plannedSerial.length) {
  console.log(`-- ${plannedSerial.length} timing-sensitive scripts, ${jobs} at a time (nothing else running)`);
  results.push(...await pool(plannedSerial, jobs));
}
const wall = (Date.now() - t0) / 1000;

const failed = results.filter(r => r.code !== 0);
for (const f of failed) {
  console.log(`\n================ ${f.name} (exit ${f.code}) ================`);
  console.log(f.out.trimEnd());
}
const cpu = results.reduce((s, r) => s + r.ms, 0) / 1000;
console.log(`\n${results.length - failed.length}/${results.length} passed in ${wall.toFixed(1)}s wall clock ` +
            `(${cpu.toFixed(1)}s of script time)`);
if (!has('--all') && !only) console.log('verify_flash_safety was NOT run — pass --all if your change can move a flash.');
process.exit(failed.length ? 1 : 0);
