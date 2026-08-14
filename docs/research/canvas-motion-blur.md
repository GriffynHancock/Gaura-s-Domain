# Canvas 2D motion blur for the SHA-3 lattice

Research pass, 2026-08-14. Read-only: nothing in `public/crypto/hash/index.html` was changed.
All line numbers are against `public/crypto/hash/index.html` at commit `5bd6a01`.

---

## TL;DR

1. **The blur did not regress.** It is still wired, still fires, and every test that guards it still
   passes. It is *invisible*, for three structural reasons — chiefly that it is an accumulation
   wipe, and accumulation only shows where geometry moved, and geometry only moves during π.
2. **It didn't scale because the control curve saturates at ~slider 45 and the mechanism is
   frame-counted, not time-counted.** Across the whole usable fast half of the slider the wipe alpha
   moves 0.24 → 0.20. And an alpha wipe holds a *fixed number of past frames*, not a fixed shutter
   interval — so as speed rises you get the same N ghosts spaced further apart. That is exactly the
   "repeat the render pass" look the user is objecting to; the current blur *is* that trick, just
   spread over time instead of over one frame.
3. **Recommendation: per-object swept-silhouette smear**, one extra convex polygon per *moving* box,
   drawn immediately before that box in the existing painter's order, its length derived from the
   box's own measured screen-space displacement since the previous frame. Measured cost ≈ **+1.0 ms
   per frame** worst case on top of a 1.5–1.7 ms scene, zero cost when nothing moves, and it is the
   only candidate on the list that is simultaneously directional, per-object, universally supported
   (plain `fill()` — works on every iOS Safari ever shipped) and compatible with a single global
   depth sort.

---

## 1. Did the blur regress?

**No. It runs.** Here is the whole path.

| what | where |
| --- | --- |
| the mechanism — a translucent background rect instead of a wipe | `index.html:3566-3568` |
| the strength curve vs phase duration | `sha3BlurAlpha`, `index.html:3072-3079` |
| the governor deepening | `sha3BlurAlphaNow`, `index.html:3085-3088` |
| the gate that decides whether to blur at all | `index.html:4646-4647` |
| the dissolve tail / attack filter | `index.html:4648-4688`, constants at `2827-2828` |
| the only blurring render call | `sha3Render({ blur: blurAlpha })`, `index.html:4689` |
| instrumentation the tests read | `sha3.lastBlur` / `lastBlurAlpha`, `index.html:3945-3946` |

### Things that were checked and eliminated

- **A stray opaque repaint mid-run.** This was the leading candidate for a silent regression: a bare
  `sha3Render()` is an opaque wipe by definition (`3567`) and would erase the whole accumulation in
  one frame while `lastBlur` still reported `true`, so no test would catch it. There are five call
  sites: `1599`, `3963`, `4537`, `4689`, `4716`. **All four non-animation sites are guarded** —
  `1599` and `3963` behind `if (!sha3.running)`, `4537` is `sha3Stop`'s deliberate final crisp
  frame, `4716` is the post-drain settle loop. The guard at `1599` even carries the commit note
  explaining that this exact bug was found and fixed once already. Nothing repaints opaquely during
  a run.
- **The backing store being cleared.** `sha3ResizeCanvas` (`3397-3411`) only assigns `c.width` /
  `c.height` when the measured size actually changed (`3406`), so it is a no-op mid-run and does not
  reset the accumulation.
- **A second full-canvas fill inside the scene.** There is exactly one `fillRect` and no
  `clearRect`, `drawImage` or `globalCompositeOperation` anywhere in the renderer body (3550-3960).
- **The attack filter starving it.** `sha3.wipeA`'s ramp is gated on `sha3.resetEase > 0`
  (`4681-4683`), i.e. the run opening only. Mid-run it is a straight assignment.

### So why can't you see it?

Three reasons, in descending order of importance.

1. **Accumulation is invisible on static geometry, and only π moves geometry.** θ, ρ, χ and ι
   change *colour*, not position (ρ spins each lane about its own axis, which moves corners only a
   few pixels). An incomplete wipe leaves the previous frame underneath, and the current frame draws
   opaque boxes at the *same pixels*, so the ghost is completely covered. The trail can only appear
   in pixels a box has vacated. π is one phase in five, and its transit is the shortest-lived thing
   on screen.
2. **The gate turns it on during those static phases anyway** (`4646`: `dur <= 90 ||
   sha3Pace.share() > 0`), where it does not smear motion — it smears the *colour wavefront*. That
   is a net negative: it softens the crisp FIPS 202 front which is the entire teaching payload of
   θ/χ/ρ/ι. Part of "it looked kind of meh" is blur being applied where it can only blunt the
   lesson.
3. **The temporal smoothing that was added around it** (`smooth`, `3575-3576`, plus the position
   follower and the tint low-pass) makes consecutive frames *more alike*. Accumulation blur is
   literally the difference between consecutive frames; smoothing them together removes the very
   thing the wipe had to show.
4. **REAL TIME has no blur by construction and is actively asserted to have none.** A ~22 ms run is
   one or two frames total, so there is no frame history to accumulate; `verify_task_wiggle_juice.mjs:841`
   throws if a real-time run leaves the canvas blurred.

**Verdict: alive, correct, and structurally incapable of being seen except during π.**

---

## 2. Why didn't it scale with speed?

### Surface cause: the curve saturates before the interesting half of the slider

`sha3BlurAlpha` (`3074-3079`) lerps between `SHA3_BLUR_ALPHA_SLOW = 0.42` and
`SHA3_BLUR_ALPHA_FAST = 0.20` over phase durations from `SHA3_FLASH_SLOW_MS = 170` down to
`SHA3_FLASH_FAST_MS = 45` (`2747-2748`). A run is 24 rounds × 5 phases = 120 phases, so from the
durations in `STATUS.md`:

| slider | run | ≈ per phase | wipe alpha | frames of history |
| --- | --- | --- | --- | --- |
| 1 | 195 s | ~1600 ms | 0.42 (clamped slow) | ~2 |
| 50 | 8.1 s | ~67 ms | **0.24** | ~4 |
| 100 | 1.8 s | ~15 ms | **0.20** (clamped fast) | ~5 |
| REAL TIME | 22 ms | 0 | 0.20 | n/a — no history exists |

Everything from slider ~45 upward is clamped. Over the entire fast half of the control the blur
changes by 0.04 of alpha — about one extra frame of history. `verify_task_wiggle_juice.mjs:675-686`
asserts only *monotonicity* and `fastA < slowA * 0.75` (0.20 < 0.315 ✓), so the test passes on a
change nobody can perceive. The test is not wrong; it is measuring the wrong property.

### Structural cause: an alpha wipe is frame-counted, a shutter is time-counted

This is the more important half, and it is why retuning the constants would not fix the complaint.

A real shutter integrates the image over the interval the shutter is open — so the smear length is
`velocity × exposure`, and it grows **linearly with speed**. An exponential alpha wipe instead keeps
the last *N* frames with geometric weights, where `N ≈ 1/alpha` is a constant. As the animation
speeds up you do not get a longer smear; you get **the same N stamps, spaced further apart**. Past
about 3–4 px of inter-frame displacement the eye resolves them individually and it reads as
stuttered echoes, not blur.

That is the same visual defect as "repeat the render pass": a small number of discrete copies of the
object. The current implementation is that trick distributed over past frames instead of over one
frame, which is why it reads as fake. The user's diagnosis is correct and the mechanism, not the
tuning, is the reason.

Two further consequences worth naming:

- The blur is driven by a **global scalar** (phase duration / measured pace), so a box that isn't
  moving gets the same treatment as one crossing the lattice. Physical blur is *per-object*.
- Because the wipe smears the frame rather than the object, the accumulated image has to be undone
  carefully — hence `SHA3_BLUR_TAIL_MS`, `SHA3_BLUR_ATTACK_TAU`, `sha3.wipeA`, the release logic and
  a chunk of governor commentary. All of that machinery exists to manage the side effects of
  smearing the *whole canvas*. A per-object approach does not accumulate anything, so most of it
  becomes unnecessary rather than needing replication.

---

## 3. What should replace it?

### The constraint that eliminates half the candidate list

The renderer builds all 200 boxes, sorts them once by depth (`items.sort`, `index.html:3906`), and
draws back-to-front. **A moving box can be behind a static box.** Therefore any approach that puts
moving geometry on a different surface from static geometry — a second `<canvas>`, an
`OffscreenCanvas` accumulation buffer, a CSS `filter: blur()` on a layer, an SVG `filter: url(#m)`
on a layer — breaks the depth order outright: the whole moving layer composites either entirely in
front of or entirely behind the whole static layer. There is no way to interleave two composited
layers per-object without doing a separate composite per box, which is 200 layer round-trips a
frame.

This single constraint disposes of OffscreenCanvas buffers, second-canvas accumulation, CSS blur and
SVG filters as *primary* mechanisms. They survive only in the degenerate form "blur the entire
scene uniformly", which is not motion blur.

### Measured cost

Playwright + headless Chromium, 560×360 backing store, 600 quads (worst case: 3 visible faces on
each of 200 boxes), each filled and hairline-stroked exactly as the renderer does. Numbers are ms
per frame, mean of 5–60 iterations, stable across two runs.
Probe scripts are in the session scratchpad; the served file was md5-verified against the repo copy
before measuring, per `CLAUDE.md`.

| operation | ms/frame |
| --- | --- |
| baseline scene, 600 filled+stroked quads | **1.52 – 1.68** |
| `ctx.filter='blur(3px)'` left set across all 600 draws | **888 – 930** |
| `ctx.filter='blur(3px)'` on one `drawImage` blit of a pre-rendered scene | 0.03 † |
| `shadowBlur = 6` on all 600 draws | 0.29 |
| `shadowBlur = 16` on all 600 draws | **431 – 440** |
| 4× sub-frame supersample of the whole scene at `globalAlpha 0.25` | 12.4 – 12.7 |
| +200 flat-filled convex smear polygons, then the scene | 2.52 – 2.62 (**+1.0**) |
| +200 gradient-filled smear polygons (fresh gradient each) | 2.94 – 3.00 (**+1.4**) |
| +200 gradient-filled smear polygons (cached gradient + per-object transform) | 5.89 – 5.91 |

† treat as a lower bound only — headless compositing may be deferring the work past the timer.

**Two caveats on the whole table.** (a) These are headless Chromium numbers from a *software*
rasteriser at `dpr: 1` — half the pixel count of a retina projector and none of the GPU fast paths a
real device has. `shadowBlur16`'s 1400× cliff in particular may be a SwiftShader artefact rather
than a real fast-path exit, so re-measure on hardware before relying on it. (b) The smear rows are a
**synthetic proxy, not an instrumented measurement of the real smear path**: they draw 200 12-gons
at radius 26×16, which is denser and larger than the real 8–10-point swept hulls, over the same
600-quad baseline. Read `+1.0 – 1.4 ms` as a conservative order of magnitude for comparable-or-heavier
geometry, not as a figure for code that exists.

Three findings in that table are worth carrying forward regardless of which option is chosen:

- **`ctx.filter` is fine per *blit* and catastrophic per *draw*.** Setting it non-`none` appears to
  force every drawing operation into its own filtered layer: 600 draws = 600 blurs = ~900 ms, a
  ~550× penalty. Any design that blurs boxes individually with `ctx.filter` is dead on arrival.
- **`shadowBlur` falls off a performance cliff.** 0.29 ms at radius 6, 430 ms at radius 16 — a
  1400× jump for a 2.7× radius, i.e. it drops out of a fast path. Anything using it must clamp the
  radius hard and re-measure per browser.
- **Do not cache a gradient behind a per-object `ctx.save/translate/scale`.** Creating a fresh
  `createLinearGradient` per object costs +0.4 ms for 200; the "optimisation" of reusing one unit
  gradient under a transform costs +3.4 ms. The transform/state churn is more expensive than the
  allocation.

### Candidate comparison

| # | approach | what it looks like | cost/frame @200 boxes | iOS Safari | drives from velocity? | painter's sort |
| --- | --- | --- | --- | --- | --- | --- |
| A | **current**: translucent wipe accumulation | N discrete ghosts, N fixed by alpha; invisible on static geometry | ~0 (it replaces the wipe) | ✅ universal | only via a global scalar; frame-counted so it can't scale correctly | ✅ untouched |
| B | `ctx.filter='blur(Npx)'` per box | true isotropic Gaussian, **no direction** — looks out-of-focus, not fast | **~900 ms** | ❌ pref-flagged in Safari 18+, incl. iOS | radius from speed, trivially | ✅ but irrelevant |
| C | `ctx.filter` on one whole-scene blit | entire lattice out of focus, static boxes included | ~0.03 † | ❌ same flag | global only | ⚠️ needs a full offscreen re-render |
| D | `shadowBlur` as a per-object Gaussian (draw off-canvas, land the shadow on-canvas) | true Gaussian glow in **one flat colour** — loses faces, shading and the rate/capacity gold/dim identity | 0.29 @r6, 430 @r16 | ✅ universal, ancient | radius from speed, but the cliff caps it | ✅ per-object, in order |
| E | sub-frame temporal supersampling — re-render the scene at k intermediate *times* at `1/k` alpha | genuinely correct shutter integration; at k=4 still visibly banded on fast motion | 12.4 (k=4); ~25 (k=8) | ✅ universal | exact, by construction | ✅ if each pass re-sorts (else wrong) |
| F | **swept-silhouette smear** — one convex polygon per moving box, hull of its corners now ∪ its corners a shutter ago, filled with a coverage ramp | a real directional streak that lengthens with speed, ends soft, and appears *only* on things that moved | **+1.0 – 1.4** | ✅ universal (`fill()` + `createLinearGradient`) | exact and per-object | ✅ drawn inline, in order |
| G | CSS `filter: blur()` on the canvas element | whole page element out of focus | GPU, ~free | ✅ universal | global only | ❌ can't separate layers |
| H | SVG `feGaussianBlur stdDeviation="8 0"` + `feOffset`, via `filter:url(#m)` | genuinely **anisotropic** — real directional blur, arbitrary angle by wrapping in a rotated group | element filter, re-rasterised per frame; WebKit has open perf bugs | ✅ supported | global angle+length only | ❌ can't separate layers |

**On (E) vs "the fake blur you already rejected."** These are not the same thing and the report
should be honest about it: re-drawing the same instant N times adds nothing but opacity, whereas
re-drawing at N intermediate *times* within the frame is exactly what an offline renderer's shutter
does — it is real motion blur. But the objection mostly survives anyway: at any k you can afford
(≤4, i.e. ~8× the frame cost) the result is visibly banded during π's fast transit, which is the
same "few discrete copies" artefact by a different route. It is the honest-but-expensive option, and
it is the fallback if (F) turns out to be hard to make look right.

**On (H), for the record.** `stdDeviation="8 0"` is a real, iOS-supported, hardware-composited
directional blur, and rotating the filtered group gives an arbitrary angle. This renderer
specifically cannot use it because there is one canvas and one depth sort. Worth knowing it exists;
it is the right answer for a page whose moving things live on their own element.

---

## Recommendation: (F) swept-silhouette smear

### Why

- It is the only candidate that is directional, per-object, and drawn **inline in the existing sort
  order** — so the painter's algorithm is untouched by construction. Each box's smear is drawn
  immediately before that box, in the same back-to-front pass.
- It is genuinely different from what was rejected. There is **one** extra path per *moving* box
  whose *geometry encodes the displacement*, versus N re-renders of 200 boxes. Nothing is repeated.
- It is honest: a box that isn't moving gets no smear at all, so θ/χ/ρ/ι keep their crisp colour
  wavefronts and the lesson stays sharp. π gets a real streak.
- It scales correctly by construction, because its length *is* the displacement (see below).
- Cost is +1.0–1.4 ms in the worst case where all 200 boxes move — which only happens during π —
  and exactly zero the rest of the time, because a box with sub-pixel displacement is skipped.
- Dependency-free, no new API surface, works on every browser that can run the page today.

### The geometry

Each box is already projected to 8 screen-space corners and pushed as
`items.push({ corners, depth, base, edge, hi, cs, sn, k })` at `index.html:3893`. For a convex box,
the convex hull of those 8 projected points *is* its silhouette. So:

- keep last frame's 8 projected corners per box (stable key: lane index × 8 + `k`);
- the smear polygon is the **convex hull of 16 points** — this frame's 8, plus this frame's 8
  translated back by the shutter displacement (equivalently, last frame's 8 scaled toward this
  frame's by the shutter fraction);
- monotone-chain hull on 16 points × 200 boxes is ~3 200 points a frame, i.e. microseconds;
- fill it with a linear gradient along the displacement direction that ramps alpha up over the
  trailing end and holds it across the body.

Using **all 8 corners rather than the centroid** is what makes ρ's axial spin and the camera drag
blur for free — rotation shows up as corner displacement even when the centre doesn't move.

### The coverage ramp (why it looks like blur and not like a stretched box)

For a convex shape of screen width `w` along the direction of travel, translating by `d` during the
exposure, the exact shutter coverage is a trapezoid: it ramps from 0 to a plateau over the leading
and trailing `w`, and the plateau is `min(1, w / (w + d))`. So:

```
alpha_plateau = w / (w + d)      // dimming as the streak lengthens — energy is conserved
gradient:  0.0 → 0                (trailing tip)
           w/(w+d) → alpha_plateau
           1.0 → alpha_plateau    (leading end, where the crisp box is drawn over it)
```

Then draw the crisp faces on top **at the same `alpha_plateau`**, not at 1. That is the difference
between "a blurred object" and "a sharp object with a trail behind it" — the latter is the ghost
look. Colour the smear with the box's own `base` at the mean of its visible-face shades; losing the
per-face shading inside the streak is correct, since a blurred object genuinely loses detail.

### How strength is derived — the part that actually answers "it never scaled"

**Do not derive it from the slider, the phase duration, or the pace average. Derive it from
measured per-box screen displacement.**

```js
// per box, in screen pixels, after projection
const d = hypot(cx - prev_cx, cy - prev_cy);      // or max over the 8 corners
const shutter = SHA3_SHUTTER_ANGLE;               // 0..1, fraction of the frame the shutter is open
const smear = Math.min(d * shutter, SHA3_SMEAR_MAX_PX);
if (smear < 0.75) { /* draw crisply, no smear polygon at all */ }
```

Why this is the right input and everything else is a proxy for it:

- It is automatically correct at **every** slider setting, because a faster run really does move
  boxes further per frame — no anchor constants, no clamps, no curve to saturate.
- It is automatically correct under **juice escalation**, which shortens phases without touching the
  slider.
- It is automatically correct in **REAL TIME**: displacement is enormous, so it saturates at
  `SHA3_SMEAR_MAX_PX`. Note this is a *behaviour change* — real time currently has no blur at all
  and `verify_task_wiggle_juice.mjs:841` asserts `lastBlur` is false after a real-time run. That
  assertion is about the accumulation wipe persisting; it will need rewording, and that is a
  deliberate decision to record, not a silent weakening.
- It is automatically zero on static geometry, so the FIPS 202 wavefronts stay crisp with no gate,
  no phase-type special case, and no `type === 'pi'` test.
- It is frame-rate independent in the right way: on a slow device with a 33 ms frame, displacement
  per frame doubles and so does the smear — which is exactly what a camera does.

**Consequence: `SHA3_BLUR_ALPHA_FAST` / `_SLOW` / `_GOV`, `sha3BlurAlpha`, `sha3BlurAlphaNow`,
`SHA3_BLUR_TAIL_MS`, `SHA3_BLUR_ATTACK_TAU`, `sha3.wipeA` and the whole tail/attack apparatus get
deleted, not retuned.** They exist to manage a whole-canvas accumulation. With no accumulation there
is no trail that can outlive motion, no "erase N frames in one frame" step, and no reason to filter
the wipe. The wipe goes back to being opaque, always. The only new tunables are
`SHA3_SHUTTER_ANGLE` (start at 0.5 — a physical 180° shutter) and `SHA3_SMEAR_MAX_PX` (start at
about two box widths, both to bound cost and to keep the lattice legible).

### Implementation sketch

Inside `sha3Render`, in the existing draw loop at `index.html:3908-3942`, before the per-face loop:

```js
// ---- one-time state: previous frame's projected corners, keyed by lane*8+k ----
// sha3.prevCorners = Float32Array(200 * 8 * 2), plus sha3.prevValid flag.

for (const it of items) {                      // already depth-sorted: order is preserved
  const sm = sha3SmearFor(it);                 // null if the box barely moved
  if (sm) {
    // sm.hull: Array<[x,y]> convex hull of the 16 points (this frame + shutter-displaced)
    // sm.dx, sm.dy: shutter displacement in screen px;  sm.plateau: w/(w+d)
    const g = ctx.createLinearGradient(sm.tailX, sm.tailY, sm.headX, sm.headY);
    // NOTE: `it.hi` already carries the wavefront AND the speed-inverse gain (see 3910). If the
    // streak is painted at full `hi` and the crisp box is then drawn over its leading end, that
    // end accumulates brightness twice. Carry `hi` at the plateau weight here (or use the
    // pre-gain shade for the streak body) so the total emitted light is conserved.
    const col = rgbCss(it.base, sm.shade * (1 + it.hi * sm.plateau));  // alpha applied via stops
    g.addColorStop(0,          rgba(col, 0));
    g.addColorStop(sm.rampEnd, rgba(col, sm.plateau));
    g.addColorStop(1,          rgba(col, sm.plateau));
    ctx.beginPath();
    ctx.moveTo(sm.hull[0][0], sm.hull[0][1]);
    for (let i = 1; i < sm.hull.length; i++) ctx.lineTo(sm.hull[i][0], sm.hull[i][1]);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();                                // no stroke: a streak has no rim
  }
  const boxAlpha = sm ? sm.plateau : 1;        // the crisp box fades as the streak lengthens
  for (const f of SHA3_FACES) { /* ... existing face loop, alpha *= boxAlpha ... */ }
}
// after the loop: copy this frame's corners into sha3.prevCorners
```

Notes that matter:

- `sha3.prevValid` must be **cleared** by `sha3Stop`, `sha3ResetState`, a theme change, a resize and
  the first frame after a drag, so a stale previous frame can never manufacture a smear across a
  discontinuity. This replaces "motion blur must never outlive motion" with a stronger, simpler
  invariant: no previous frame, no smear.
- Keep `sha3.lastBlur` / `lastBlurAlpha` as instrumentation but redefine them — e.g. `lastBlur` =
  "any box smeared this frame", `lastBlurAlpha` → a new `lastSmearMaxPx`. The existing tests read
  these; they should be migrated deliberately, not left reporting a mechanism that no longer exists.
- Do **not** stroke the smear polygon, and do not reuse a cached gradient under a per-object
  transform (measured 3.4× worse than allocating fresh, above).
- The hull only needs the box's *silhouette*, so an axis-aligned-ish 6-point hull of the 8 projected
  corners is typical; the 16-point hull of the swept pair is typically 8–10 points.

### Cheaper tier, if +1.0 ms ever matters

Skip the hull: `ctx.save(); translate to centre; rotate to velocity; scale(1 + d/w, 1); rotate back;`
then draw the faces once. One transform, no new geometry. It is a genuine per-object directional
smear rather than a repeated pass, but it stretches the box about its centre, which distorts the
axonometric projection and looks wrong on the large displacements where blur matters most. The
measurements above say the transform churn is not actually cheaper, so this is a fallback for
readability, not for speed.

---

## Assessment against the two things that must not be weakened

### The photosensitivity governor (`tools/verify_flash_safety.mjs`)

Fully assessable by the existing harness — the governor samples **real painted pixels**
(`index.html:2894-2900`), so it will measure the smear automatically with no change to the
measurement path. **This pass did not run `verify_flash_safety.mjs`** (read-only, and it is slow);
what follows is a prediction to be checked, not a result.

Expected direction: **lower measured flash energy**, for three separate reasons.

1. A smear spreads the same emitted light over a larger area at a lower peak alpha (`plateau =
   w/(w+d)` explicitly conserves energy), which reduces per-tile luminance excursion during exactly
   the fast phases the governor cares about.
2. It removes the two largest single-frame luminance steps currently documented in the file — the
   "switching from a deep trail back to an opaque wipe erases several frames in one frame" step
   (`4648-4653`, measured as the single biggest step in a run) and the opaque→deep-trail attack step
   (`4664-4671`, measured at 0.08 on the centre tile at slider 100). Both are artefacts of
   whole-canvas accumulation and both disappear with it.
3. It removes the click-mashing interaction at `1591-1598` entirely: with no accumulated image,
   there is nothing for a re-click to erase.

The one thing to watch: the smear covers *more pixels* than the crisp box, so a bright box on a dark
background raises the mean luminance of its tile even at lower peak alpha. Whether area × lower-peak
nets out below the current reading is an empirical question for the suite. **No part of this
requires touching the governor, its caps, or its thresholds** — it is a change to what is painted,
which the closed loop already measures.

### The temporal-aliasing effect

Blur is a low-pass filter and the aliasing effect is a high-frequency phenomenon, so they do
interact. There is a real design choice here and it should be made explicitly:

- **Blur from *true* motion** (physically the most honest): at the aliasing peak the lattice would
  show a long smear even while the apparent position is frozen — which is what a *long*-shutter
  camera really records. But it would wash out the freeze-and-reverse illusion the page has
  deliberately calibrated so that the default slider is the peak.
- **Blur from *apparent* (drawn) motion — recommended.** Take `d` from the positions actually
  drawn, i.e. after the `sinc` warp (`sha3AliasFactor`, `index.html:2514`). This is not a
  compromise; it is the internally consistent physics. The page's aliasing *is* a stroboscopic,
  short-shutter effect — a strobe is precisely a shutter open for a small fraction of the interval,
  and a short shutter produces little blur. So near the aliasing peak, where apparent displacement
  collapses toward zero, the smear collapses with it, the wagon-wheel freeze stays crisp and
  readable, and away from the peak the smear grows with the motion you can actually see. Both
  effects then agree about what is moving.

This resolution also means the interaction is *self-limiting*: the effect that would muddy the
illusion is exactly the effect that switches itself off where the illusion lives.

---

## Risks, in order

1. **Hull overlap vs. the painter's-algorithm proof — the biggest one.** The existing correctness
   argument (`index.html:3901-3905`, and the π non-interpenetration guarantee flagged in
   `CLAUDE.md`) is that no two *boxes* ever co-locate mid-transit, so for any pair one is strictly
   nearer. A swept hull is strictly larger than its box, and two hulls **can** overlap in screen
   space even when the boxes never do. This does not change π's motion — so it is not the
   "re-prove minimum separation across all 24 π compositions" trigger — but it does change what is
   drawn, so the argument has to be restated in terms of *footprint overlap* rather than point
   separation. The mitigating facts: hulls are semi-transparent (so an ordering error is a subtle
   blend artefact, not a box vanishing), `SHA3_SMEAR_MAX_PX` bounds how far a hull can extend, and
   each hull is drawn immediately before its own box in the same sorted order. Verify against
   `tools/verify_pi_pacing.mjs` and by eye at the shortest π durations.
2. **The flash-safety prediction is unverified.** Section above; `verify_flash_safety.mjs` (~4 min)
   is the gate, and it must be run before this ships. Do not tune the governor to accommodate the
   blur — if the smear raises measured flash energy, shorten `SHA3_SHUTTER_ANGLE` or
   `SHA3_SMEAR_MAX_PX` instead.
3. **`alpha_plateau` desynchronises `sha3SolveCaps` from what is painted.** Drawing the crisp faces
   at `boxAlpha = sm.plateau` means boxes get *dimmer* the faster they move — correct physics, but
   `sha3SolveCaps` binary-searches the tint cap against a model (`lumOf(sha3TintAt(...))`) that
   assumes faces are drawn at full alpha. The file's own comment at `3860-3863` states the
   invariant — "sha3SolveCaps models the same renormalisation, so the solved tint cap describes
   what is actually drawn" — and a per-box alpha the solver doesn't know about breaks it. The break
   is in the safe direction (the real frame is *dimmer* than modelled, so the cap is conservative),
   but "conservative" is not "exact", and this file has already been burned once by a model that
   didn't match the paint. Either teach the solver the plateau, or record explicitly that the cap
   becomes conservative-but-inexact during π.
4. **Three existing test assertions describe the old mechanism and will need rewriting**
   (`verify_task_wiggle_juice.mjs:654`, `:662-691`, `:841`). Rewriting a test to describe a new,
   better-specified property is legitimate; deleting the property is not. The replacements should
   assert: smear length is proportional to measured displacement; smear is zero on a static
   lattice, during a drag, and after a run; and the crisp lattice is always recoverable.
5. **Gradient allocation churn.** 200 `createLinearGradient` objects per frame during π is measured
   fine (+0.4 ms) but is GC pressure on low-end Android. Quantising the gradient to, say, 8 alpha
   buckets and caching per-bucket-per-direction is available if it shows up in profiling — but the
   measurements above warn against "optimising" it with per-object canvas transforms.
6. **Light theme.** A smear is a translucent fill of the box's own colour, so it inherits the theme
   automatically — but on the light (bone) background a dark box's streak is a *darkening*, and the
   perceptual weight of the same alpha differs between themes. Check both; the plateau formula may
   want a small per-theme gain.

---

## Sources

- [MDN: `CanvasRenderingContext2D.filter`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter) — marked "Limited availability".
- [MDN browser-compat-data, `api/CanvasRenderingContext2D.json`](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/CanvasRenderingContext2D.json) — authoritative, fetched 2026-08-14: Chrome 52, Firefox 49, **Safari 18 behind the "Canvas Filters" preference, `safari_ios: mirror`**. This is the fact that rules `ctx.filter` out as a primary mechanism for a classroom of iPhones.
- [WebKit bug 198416 — Support `CanvasRenderingContext2D.filter`](https://bugs.webkit.org/show_bug.cgi?id=198416) — the implementation history behind that flag.
- [`context-filter-polyfill`](https://github.com/davidenke/context-filter-polyfill) — the standard workaround for Safari; a dependency, so out of scope here, but it documents the gap.
- [Codrops — Motion Blur Effect with SVG (feGaussianBlur + feOffset)](https://tympanus.net/codrops/2015/04/08/motion-blur-effect-svg/) — anisotropic `stdDeviation="x y"`, and rotating the filtered group to get an arbitrary blur angle.
- [MDN: `<feGaussianBlur>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur) — the two-value `stdDeviation` that makes directional blur possible at all.
- [WebKit bug 283156 — blur effects on SVG have performance issues](https://bugs.webkit.org/show_bug.cgi?id=283156) — open perf caveat for the SVG-filter route on the exact engine the students' phones run.
- [Endless Sky — MotionBlur design notes](https://github.com/endless-sky/endless-sky/wiki/MotionBlur) — the velocity-stretch / stretched-bounding-box formulation this recommendation is the Canvas 2D analogue of.
- [Wikipedia — Display motion blur](https://en.wikipedia.org/wiki/Display_motion_blur) — why sample-and-hold displays already blur moving content, i.e. why the smear should be *added* to, not substituted for, the eye's own integration.
- [CodePen — Simple Canvas Motion Blur](https://codepen.io/shshaw/pen/KZXOdd) — a clean example of the translucent-wipe accumulation technique the page currently uses.
- [canvas-sketch motion blur gist (mattdesl)](https://gist.github.com/mattdesl/447feabf4c819889a5e73de0da37abc0) — sub-frame temporal supersampling in Canvas 2D; note the author restricts it to offline sequence export, which is the honest verdict on candidate (E) for real-time use.
- [keithwhor/canvasBlurRect](https://github.com/keithwhor/canvasBlurRect) — downscale-blur-upscale as the pre-`ctx.filter` way to get a fast blur; relevant if a whole-scene blur is ever wanted on Safari.
