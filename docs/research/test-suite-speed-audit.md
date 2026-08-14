# Test-suite speed audit — `tools/`

Branch `feat/caesar-rewrite-fnac-nights`, 2026-08-14. Brief: verification had become the slow part
of every task (one agent burned 15+ minutes on a header-button change and had to be killed). This
is a hunt for time burned with no diagnostic return — **not** a mandate to cut coverage. Every
assertion that existed before still exists, and the restructured tests were mutation-tested to
prove they still fail for the reasons they used to.

All timings: MacBook (darwin 24.6.0), Chromium headless via Playwright, page served with
`python3 -m http.server 8830` from the repo root,
`HASH_MODULE_URL="http://localhost:8830/public/crypto/hash/"`, served file md5-checked against
`public/crypto/hash/index.html` before every measurement.

**Measurement caution recorded because it nearly polluted this audit:** a second `http.server`
plus a browser doing mutation runs in the background added ~+1.3s to *every* script, including
untouched ones. The before/after numbers below were all taken on an otherwise idle machine; the
untouched scripts were re-timed at the end and came back at their baseline values, which is what
makes the touched-script deltas trustworthy.

## Headline

| | wall clock |
|---|---|
| Baseline: 15 gate scripts, serial, one `node` each (as STATUS.md tells you to run them) | **381.1s** |
| After: same 15, serial | **349.1s** |
| After: `node tools/run_suite.mjs --all` (parallel where safe) | **~340s** |
| After: `node tools/run_suite.mjs` — the fast gate, everything except flash safety | **87.2s** |

`verify_flash_safety` alone is 253.3s of the 381.1s baseline (66%). It measures a real flash pace
over real time against WCAG 2.3.1 and cannot be fast-forwarded; it is untouched. **The single
biggest real-world win is therefore selection, not speed:** the 14 other scripts now run in 87.2s
as one command, and flash safety is opt-in for the changes that can actually move a flash (the
rule the working agreement already states, now enforced by the default).

Excluding flash safety, the same 14 scripts went **127.9s → 95.8s serial (-25%)**, and **87.2s**
through the runner.

## Per-script

| script | before | after | what changed |
|---|---:|---:|---|
| `test_md5_trace` | 0.1s | 0.1s | — pure Node |
| `test_keccak_trace` | 0.1s | 0.0s | — pure Node |
| `verify_task5_md5_registers` | 2.0s | 1.2s | — (unchanged; baseline noise) |
| `verify_task6_block_stack` | 1.7s | 1.5s | — (unchanged) |
| `verify_task7_input_box` | 1.1s | 1.0s | — (unchanged) |
| `verify_task8_collision` | 3.0s | 2.8s | — (unchanged) |
| `verify_task9_full_integration` | 6.9s | 6.5s | — (unchanged; real MD5 + SHA-3 runs) |
| `verify_sha3_touch_drag` | 3.6s | 3.2s | — (unchanged) |
| `verify_task3_lane_grid` | 13.5s | **8.9s** | scroll-hint waits → conditions |
| `verify_task4_sha3_animation` | 20.6s | **16.5s** | sampling pass slider 18 → 25 |
| `verify_step_through` | 19.4s | **13.6s** | `drive()` settle sleep → condition |
| `verify_task_wiggle_juice` | 37.5s | **23.0s** | abort-blur slider 1 → 25; real-time arm 3 blocks → 1 |
| `verify_sha3_aliasing` | 5.2s | 4.9s | — (measurement by construction) |
| `verify_pi_pacing` | 13.1s | 12.6s | — (measurement by construction) |
| `verify_flash_safety` | 253.3s | 253.3s | — **deliberately untouched**, see below |
| *(not in the gate)* `probe_frame_step` | 27.8s | 27.8s | diagnostic tool, not a test |
| *(not in the gate)* `measure_sha3_durations` | 1.1s | 1.1s | pure-function measurement |
| *(not in the gate)* `measure_pi_pacing` | 1.3s | 1.3s | measurement |
| *(not in the gate)* `assert_page_build` / `extract_hash_core` | 0.1s | 0.1s | helpers |

## The fixes, in detail

### 1. `verify_step_through.mjs` — 19.4s → 13.6s

`drive()` waited for the page to consume the step request (`req === null`, a proper condition) and
then **slept a further fixed 260ms** "to let the phase finish", with call sites passing 15/60/120/500ms
variants. Across ~55 `drive()` calls that was ~7s of pure sleep.

The page already exposes the exact thing being waited for: `__stepDebug.state().sha3Active` is the
phase in flight, `null` when it has finished. The settle is now that condition. It is also
*stronger* than the sleep: if a phase floor is ever raised above 260ms the old code would have
under-waited silently, while the condition still waits. On MD5 there is no SHA-3 phase in flight,
so the condition collapses to "the request was consumed", which is already the point at which the
register write has landed. One deliberate 500ms remains (line ~164) — it checks that the phase
**tint is still held after** the phase ended, which is a property of elapsed time, not of a state
the page exposes.

**Mutation test:** made a single step pull two queue items (`if (stepper.on) sha3.qi++;` after the
queue pull, in a scratch copy of the page served on a second port). The test failed with four
assertions, including "STEP with nothing running starts a run and presents exactly one sub-cycle"
and "the queue index advances in lockstep with it". Coverage intact.

### 2. `verify_task3_lane_grid.mjs` — 13.5s → 8.9s

The scroll-hint section (three fresh pages, one per rule) held 9.33s of `waitForTimeout`, of which
6.8s was four 1600–1800ms sleeps.

- The two **positive** waits ("the ~1100ms ease has landed") are now
  `waitForFunction(hint().fired && !hint().animating)` — `hintAnimating` is the renderer's own flag.
- The three **negative** waits ("the hint must NOT fire") cannot be condition-waited by
  construction, but they never needed a whole ease: a hint that is going to fire sets `animating`
  on the next frame and takes ~1100ms to land, so a 400ms window catches one *starting*. To make
  that airtight the assertions now also check `animating`, not just the unchanged rotation — a
  nudge that had merely begun is caught, which the old rotation-only check would also have caught
  but only because it slept past the whole ease.

**Mutation test:** removed both once-only guards in the page (`sha3.hintFired` and the
`io.disconnect()` on first fire). The test failed with `the hint fired more than once: {rotX:-5,
rotY:5} -> {rotX:-6.28, rotY:6.28, animating:true}` — i.e. the 400ms window caught the second
nudge mid-ease. Coverage intact.

### 3. `verify_task_wiggle_juice.mjs` — 37.5s → 23.0s

Two changes, both to *how long a run is asked to take*, neither to an assertion:

**(a) The abort-mid-π case ran at slider 1 (-9s).** It waits — correctly, on a condition — for
`activePhase() === 'pi'`, then aborts. At slider 1 a rate-block is ~195s, so simply *reaching* the
first π cost ~10s. The margin that slow slider was buying is not used by anything: the abort is
fired the instant π is detected, in the same `page.evaluate`, microseconds later. At slider 25 a
rate-block is ~41s, so π still lasts a few hundred ms — thousands of times the margin needed. The
blur is present during π at every slider setting (`sha3BlurAlpha` returns a non-zero alpha across
its whole range; `lastBlur` is truthy for any non-zero alpha), so the smear case is still real.

Checked for silent knock-on: nothing after this block touches `#input-custom` or `#hash-btn`
(the last reference in the file is inside it, line ~825 of 863), so the shorter input cannot leak
into a later assertion that meant to read three blocks.

**Mutation test:** deleted the `sha3Render()` (the crisp repaint) from `sha3Stop()` in the page
copy. The test failed with `aborting a run mid-pi left a motion-blurred frame on the canvas
permanently` — the exact bug the case exists for, still caught at slider 25.

**(b) The SHA-3 real-time arm hashed 3 rate blocks (-5s).** It had silently inherited
`'x'.repeat(300)` from the MD5 arm above and measured an 8.4s normal-playback baseline to compare
against. The claims are a *ratio* (real-time under a fifth of normal) plus π's integer-slot commit
through the zero-duration path; neither depends on block count. Now one block (~1.8s at slider
100). Multi-rate-block absorption is covered where it is the actual subject (`verify_task4`,
`verify_flash_safety`'s 8-block cases).

### 4. `verify_task4_sha3_animation.mjs` — 20.6s → 16.5s

Pass 1 sampled live state at slider 18 and waited to reach round 3: ~2.7s per round, ~11s.
Slider 25 is ~1.7s per round. What the pass needs is that its 25ms sampler catches two short-lived
states — the post-absorb window (rate loaded, capacity still all-zero) and a ≥400ms non-π gap
proving the π rearrangement persists. At slider 25 a phase is ~340ms (13 samples per phase) and
every π is followed by ~1.3s of contiguous non-π. Measured after the change: the persistence pair
was found 2550ms apart, against a 400ms requirement — margin unchanged in practice.

### 5. `tools/run_suite.mjs` (new) — the fast gate

One command, three groups, documented in the file header:

- **pure/state** (`test_*`, task5–9, touch_drag): assert on recorded state, DOM text and digests,
  wait on conditions with generous timeouts. A busy machine makes them slower, never wrong — so
  they run **4 at a time**. 18.5s serial → 6.5s wall.
- **timing** (task3, task4, step_through, wiggle, aliasing, pi_pacing): assert on pacing, frame
  counts, ease fractions sampled at a known offset. Chromium's rAF is wall-clock driven, so CPU
  contention here can produce **a failure that is not a bug** — this repo has already lost sessions
  to plausible-looking fake results. These run **one at a time, after** the parallel group has
  finished, never alongside it. `--jobs N` raises that for anyone who has measured their own
  machine and accepts the trade.
- **safety** (`verify_flash_safety`): **opt-in via `--all`**, with the reason printed at the end of
  every run so nobody assumes the gate covered it.

`--only task3,step_through` runs a subset (both `--only x` and `--only=x` forms); `--list` prints
the groups.

Verified: the pass path (14/14, exit 0), the **failure** path (pointed at a dead port — FAIL lines,
the full captured output of the failing script, and exit 1), `--only` in both argument forms, and
`--list`. **`--all` has not been run end-to-end**, because `verify_flash_safety` currently fails on
this branch for a pre-existing reason (finding 1 below): the first person to run `--all` will get a
FAIL and a long output dump from it. That is the runner correctly reporting a real failure, not a
runner bug.

## Deliberately left slow

- **`verify_flash_safety.mjs` (253.3s) — untouched, not one line.** Its 51.9s of `waitForTimeout`
  is not waste: the 9s window at slider 1 and the 40s escalation window at slider 38 *are* the
  measurements (the file's own comments show the slider-38 case is calibrated to how far the run
  escalates inside that window — shortening it would change the number the assertion compares
  against, which is exactly the "calibration miss read as a safety regression" the comments
  describe). The remaining 204s is a dozen full recordings of real animations. The only genuine
  setup waste I found is `settleSha3()`'s fixed 800ms, called 5 times: `SHA3_PACE_RELEASE_IDLE_MS`
  is 400, so ~500ms would preserve the property with margin. That is 1.5s (0.6%) inside the one
  file `CLAUDE.md` marks as never-to-be-weakened, and I judged the risk/benefit not worth it.
- **`verify_pi_pacing`, `verify_sha3_aliasing`, `measure_*`** — measurement by construction, per
  the brief. Their setup was already condition-waited (`waitForFunction(() => __camSamples.length >
  120, { polling: 250 })` and similar), with no fixed sleeps at all.
- **`verify_task9_full_integration` (6.5s), `verify_task8_collision` (2.8s)** — the time is real
  MD5 and SHA-3 runs to a real digest. Nothing to reclaim.
- **`probe_frame_step.mjs` (27.8s)** — a diagnostic, not part of the gate; it captures frames over
  real time. Not run by `run_suite.mjs`.
- **Python builders** (`build_base64_assets.py`, `build_confetti.py`, `build_hash_assets.py`,
  `build_offline_launcher.py`) — not in the verification hot path, and they *write generated files*
  into the tree, so I did not run them (I cannot use `git` to undo a dirtied working tree).
  `tools/build_fnac_assets.py`, `tools/fnac_png.py`, `tools/verify_fnac_png.py` were out of scope
  and were neither run nor edited.

## Findings for the owner — flagged, not acted on

1. **`verify_flash_safety` already FAILS on this branch, before any of my changes.** Baseline run,
   unmodified file:
   `SHA-3 slider 78, 4 rate-blocks (peak aliasing warp swing): the limiter is visibly limiting — no
   excursion even reaches 0.07 — biggest was 0.0886`.
   Every other assertion in the file passes (flash counts 0, red flashes 0). This is the amplitude
   check, not the WCAG rate bound — but it is the check that says the limiter is doing its job, and
   it is out of scope for a speed audit. It needs a decision from someone who owns the governor.
2. **The π-persistence assertion in `verify_task4` is weaker than it reads.** It searches for *any*
   pair (permuted sample, permuted sample ≥400ms later, same slots) and skips non-permuted samples
   entirely. A page that reverted to canonical slots after *every* π would still pass, because π is
   a fixed permutation: every round would re-produce the identical permuted arrangement, and the
   canonical samples in between are filtered out by the `permuted > 0` condition. I confirmed this
   with a mutation (revert-to-canonical 220ms after each π) that the test does **not** catch —
   including at the original slider 18, so this is pre-existing and unrelated to the slider change.
   Worth fixing by asserting over *all* samples in the gap rather than finding one satisfying pair.
3. **STATUS.md says "16 scripts" and lists 15.** `probe_frame_step` / `measure_*` / `flash_analysis`
   are diagnostics, not gate scripts; the list of 15 is the real gate. Worth correcting, and worth
   pointing at `run_suite.mjs --list` instead of a hand-maintained list.
4. **No test was judged low-value enough to propose cutting.** The expensive ones are expensive
   because they run real animations to a real digest, and the cheap ones cost 1–3s. The saving was
   in how long they *waited*, not in what they *checked*.

## How to run it now

```sh
python3 -m http.server 8830          # from the repo root
export HASH_MODULE_URL="http://localhost:8830/public/crypto/hash/"
curl -s "$HASH_MODULE_URL/index.html" | md5   # vs md5 -q public/crypto/hash/index.html

node tools/run_suite.mjs             # fast gate, ~87s
node tools/run_suite.mjs --all       # + flash safety, ~5.5 min — for anything that moves a flash
node tools/run_suite.mjs --only step_through
```
