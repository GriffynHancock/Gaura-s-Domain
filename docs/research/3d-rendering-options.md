# 3D rendering options for the Keccak lane grid

Research for: `/Users/gaura/PCAN/ceasar-ctf/public/crypto/hash/index.html`, the `.lane` / `.lane-grid` /
`.lane-front` CSS and `buildLaneGrid` / `pulseLanesFor` / `setupLaneGridDrag` JS (currently ~line 120-260
for CSS, ~476-500 and ~813-1090 for JS).

## Top-line recommendation

**Rewrite the lane grid as hand-rolled Canvas 2D with an axonometric projection and an explicit
painter's-algorithm depth sort.** Not Three.js, not Zdog, not another CSS 3D attempt.

The reasoning in one paragraph: CSS 3D has failed three times for a structural reason, not a skill
reason (below), so a fourth attempt is not worth trying. Zdog's own documentation disqualifies it for
this exact scene (dense grid of touching, overlapping solids). Three.js would work, but the real,
measured no-build-step cost is a ~357 KB minified / ~85 KB gzip file for a scene that is 25 boxes — a
sledgehammer, and one whose retained-mode scene graph fights requirements 4 and 5 rather than helping
with them. Canvas 2D costs zero vendored bytes, is provably correct for painter's-algorithm sorting on
*this specific geometry* (rigid, non-intersecting, convex boxes — see below), reads CSS custom
properties directly for theming, and gets requirement 7's motion blur essentially for free in a way
Three.js doesn't.

The one thing that could flip this verdict: if requirement 5's π-permutation is implemented as boxes
sliding in **straight lines through each other's space** (interpenetrating mid-transit), centroid-based
painter's sorting can visibly mis-order faces during the ~220ms transit. The fix is not "use a library,"
it's "don't route the animation that way" — see the implementation notes at the bottom. Route π as a
lift/slide/drop arc (which also communicates "these lanes are moving to new slots" better than a straight
cross-fade) and the boxes never interpenetrate, so Canvas 2D stays exactly correct throughout.

---

## Why CSS 3D has failed three times — the real technical reason

Two independent, unfixable-by-better-construction limitations, and the project's own attempt history
demonstrates both:

**1. `filter`/`opacity` on a `preserve-3d` container silently forces it to `flat`.** This is documented
in the CSS itself (`.lane` at hash/index.html:200-208: *"`.lane` is a PURE 3D CONTAINER — it deliberately
carries no `opacity`, no `filter`... every browser I've tested treats those as CSS grouping properties:
they force this element's USED transform-style to `flat`"*) and independently confirmed by
[CSS-Tricks, "Things to Watch Out for When Working with CSS 3D"](https://css-tricks.com/things-watch-working-css-3d/):
*"Any filter value besides `none` causes flattening... the workaround is applying filters to individual
faces rather than parent containers."* That's exactly what attempt 3 did — but it means the level of
nesting where a proper 6-face closed cube would live (a `preserve-3d` parent holding 6 face children,
each independently transformable) is the *same* level that must stay filter-free for requirement 3
(per-box brightness pulse). You can have real per-box pulsing, or you can have a real nested 6-face solid
in a single element hierarchy — not both — which is why every attempt has produced loose planes glued to
a front face instead of a closed box. (Workaround: an outer `.lane-pulse-wrapper` with no transform that
carries the filter, wrapping an inner `preserve-3d` geometry node with no filter — doable, but this is
exactly the "aligning CSS panels by hand with no coordinate system" the owner flagged, now with an *extra*
wrapper layer per box, for one requirement.)

**2. There is no z-buffer.** CSS sorts whole *planes* inside a `preserve-3d` context using an algorithm
the spec does not pin down for intersecting/near elements. From the W3C mailing list discussion of the
spec (turned up by search, [lists.w3.org public-fx thread](https://lists.w3.org/Archives/Public/public-fx/2011OctDec/0028.html)):
possible sort keys include midpoint, front-most point, back-most point, or local origin, and
implementations have disagreed. CSS-Tricks' gotchas piece confirms there is **no generic fix** —
*"There's not a generic solution for [z-fighting]. It's something to tackle on a case-by-case basis"* via
DOM reordering and hand-tuned translation offsets. That workaround is static (fixed DOM order), but which
of 25 adjacent boxes should occlude which changes continuously as the whole grid rotates under pointer
drag (requirement 2) — a static DOM-order hack cannot track a moving viewpoint. This is req 1's real
blocker, independent of the filter bug.

**Do real multi-cube CSS 3D grids exist?** Yes, one real example was found and fetched —
[appukuttan.dblog.org, "Multiple Cubes with CSS 3D"](https://appukuttan.dblog.org/multiple-cubes-with-css-3d) —
a 3×3 CSS-grid of independent 6-face cubes, each with real `--width`/`--height`/`--depth` custom
properties, under one shared `rotateX/rotateY` + `preserve-3d` transform. It is a legitimate example of
*constructing* real solids correctly. But it does not touch occlusion between cubes at all — the cubes in
that demo don't overlap or sit edge-to-edge densely enough to expose the sorting problem. The other
canonical piece in this space, [CSS-Tricks "CSS in 3D: Learning to Think in Cubes Instead of Boxes"](https://css-tricks.com/css-in-3d-learning-to-think-in-cubes-instead-of-boxes/),
composes single complex objects (a book, a desk scene) out of cuboids, not a grid of many, and its only
statement on inter-element depth conflicts is the same "case-by-case, no generic solution" line. In other
words: the "solved on CodePen in 2016" instinct is half right — building one correct 6-face cube is a
solved, well-documented pattern — but nobody has actually solved dense-grid occlusion for *many*
independent CSS 3D solids under free rotation, because the platform doesn't give you the primitive
(a depth buffer) to do it. That's the honest answer to give the owner.

**Requirement 7 (motion blur):** also a straightforward "no" for CSS. `filter: blur()` is isotropic
(blurs in all directions, not just along the direction of travel) and would blur the box at rest too
unless toggled on/off per-frame with JS, at which point you're not really "doing it in CSS" anymore.

---

## Per-option evaluation

### CSS 3D (a fourth attempt, done "properly")

| Req | Verdict | Reasoning |
|---|---|---|
| 1. Real closed solids, correct occlusion | **No** | Filter-forces-flat blocks real 6-face nesting with per-box pulse (above); no z-buffer, so 25 adjacent rotating solids have no correct generic sort — confirmed by CSS-Tricks and the W3C thread, not just this project's experience. |
| 2. Pointer-drag rotate | Yes | Already works today. |
| 3. Per-box highlight | Partial | Works today only because the geometry was sacrificed (filters on leaf faces, not a real container) — the fix for req 1 would cost this. |
| 4. Per-box independent rotation | Partial | Possible in principle (nested `preserve-3d` per box) but composes badly with position (see req 5) since both are being hand-written into one `style.transform` string. |
| 5. Stay-put rearrange | Partial | CSS transitions *can* persist a new `translate3d` — the current bug (hash/index.html:1072, `setTimeout(() => el.style.transform = el.dataset.baseTransform, 220)`) is a logic bug, not a CSS limitation. But see the general note below on why this keeps breaking. |
| 6. Whole-plane / whole-assembly shake | Yes | This is CSS 3D's strength — group transforms on a shared ancestor are cheap and this is exactly what `preserve-3d` composition is good at. |
| 7. Motion blur | No | See above. |
| 8. Runs on phone | Yes | Compositor-accelerated transforms are cheap. |

Vendored size: 0 KB (no library). Complexity: high and, per three attempts, not converging — the failures
are structural, not "hasn't been polished enough yet."

### Three.js

Real measured numbers (not estimated from memory), pulled 2026-08-13:

```
curl -sL https://unpkg.com/three/build/three.module.min.js -o /tmp/t.js
wc -c /tmp/t.js                    # 365,552 bytes  (357 KB)   minified
gzip -9 -c /tmp/t.js | wc -c       #  86,554 bytes  (84.5 KB)  gzip
brotli -c /tmp/t.js | wc -c        #  72,382 bytes  (70.7 KB)  brotli
```
Current npm `latest` at fetch time: **three@0.185.1**. This is the *whole* core module build (no
loaders, no `OrbitControls` — those live separately under `examples/jsm/` and would add a few more KB if
used; this project's existing pointer-drag code can be reused instead, so skip them).

Important number *not* to use for this project: a commonly-cited "minimal tree-shaken three.js scene
gzips to ~118 KB" figure floating around the [three.js forum](https://discourse.threejs.org/t/8kb-gzipped-size-increase-in-0-181-0-recommendation-on-tooling-to-analyze-package-size/87880)
is *smaller* than the number above, which looks like a win — but it requires a bundler (Rollup/webpack)
doing dead-code elimination across `import { Scene, PerspectiveCamera, ... } from 'three'` statements.
This project has no build step, so that number isn't reachable here; vendoring `three.module.min.js`
whole and importing from it via a plain `<script type="module">` local `import` (which is 100% viable
with no bundler — ES modules are natively supported and this is a single local file, not a CDN request at
page load) means paying the **full ~357 KB / ~85 KB gzip** figure, not the tree-shaken one. State that
plainly if this option is chosen.

Also worth knowing: as of r150 (well before the current r185-equivalent 0.185.1), three.js **deprecated
and then removed** the old single-file UMD build (`three.min.js`, usable via a plain non-module
`<script src>`). Only the ES module build remains. That's not a blocker (`type="module"` + a relative
`import` from a locally vendored file needs no build step and no network request beyond the local file),
but it does mean "just drop in a script tag like it's 2016" doesn't apply anymore — the module has to be
served as a static file alongside the page, which this project's asset pipeline already supports (it's
just another file under `public/crypto/hash/`).

| Req | Verdict | Reasoning |
|---|---|---|
| 1. Real closed solids, correct occlusion | **Yes** | Real z-buffer via WebGL; this is the one thing a GPU-backed renderer trivially gets right that CSS structurally cannot. |
| 2. Pointer-drag rotate | Yes | Trivial — rotate the camera or a group. |
| 3. Per-box highlight | Yes | Per-mesh `material.color`/emissive, or a shared shader uniform array. |
| 4. Per-box independent rotation | Yes | Native to a scene graph — each mesh has its own transform, no string-concatenation collisions. |
| 5. Stay-put rearrange | Yes | Same reason — mutate each mesh's target position once, nothing "reverts" because nothing is implicitly tied to a CSS transition timeout. |
| 6. Whole-plane / whole-assembly shake | Yes | Parent-group transforms, same pattern as CSS but with a real scene graph instead of DOM nesting. |
| 7. Motion blur | Partial | Not built in for rigid-body motion; needs a velocity-buffer post-process pass or an accumulation-buffer trick — real work, more than Canvas 2D's one-line trick below. |
| 8. Runs on phone | Yes, with care | WebGL is GPU-accelerated and fine for 25 boxes; but shipping ~85 KB gzip (blocking parse/compile before first paint, unless deferred) plus WebGL context init cost is heavier than this scene needs. |

Theming: fully achievable — read the page's CSS custom properties (`getComputedStyle(document.documentElement).getPropertyValue('--gold')`)
once at scene-build time (and on a theme-change listener) and set them as `MeshBasicMaterial`/`MeshStandardMaterial`
colors. Nothing about Three.js fights the warm-editorial palette; it's just an extra indirection layer
(CSS var → JS → Three.js color) that Canvas 2D also needs, at the same cost.

Complexity to implement: lower than Canvas 2D for the geometry/occlusion part (the renderer does that),
comparable or higher for the "hold the pedagogical intent" part — a full scene graph, camera, lighting
setup, and render loop is more machinery than this feature actually needs, and is the more likely source
of new categories of bugs (lighting looking wrong in dark mode, raycasting for interactivity, disposal/
memory-leak hygiene on re-render) that this project hasn't had to deal with yet.

### Zdog

[zzz.dog](https://zzz.dog/) — "round, flat, designer-friendly pseudo-3D engine," explicitly the
"pseudo-3D geometry with a nicer API" niche the owner asked about.

Measured size: `zdog.dist.min.js` is **29,737 bytes (29 KB) minified, 7,240 bytes (7.1 KB) gzip** —
genuinely tiny, smaller than any other option here including hand-rolled canvas code once you count the
matrix/projection math. **But it fails requirement 1 by its own documentation, not by omission.** From
[zzz.dog/extras](https://zzz.dog/extras) (Zdog's own docs page): *"Z-fighting is one of Zdog's charms.
Embrace it."* Its depth model sorts by the centroid (average) of each shape's path points — a coarse
heuristic, not a real per-pixel or per-face sort — and the documented workarounds are: give overlapping
shapes the same color, physically move shapes apart so their strokes don't overlap, or add invisible
balancing shapes to fix a shape's sort key by hand. Every one of those workarounds is incompatible with
"25 boxes packed edge-to-edge in a 5×5 lattice, each independently colorable and independently rotatable"
— that's precisely the dense-overlap scenario Zdog's own docs say to avoid. It's the right tool for
sparse illustrative scenes (icons, mascots, isolated shapes with visible air between them), not for a
tight grid of touching solids.

Maintenance: latest GitHub release is **v1.1.1, published 2019-10-23** — about seven years old at the
time of this research, with no v2 despite the README (last checked) still describing v1 as *"a
beta-release... expect lots of changes for v2."* Not necessarily broken, but not a library seeing
ongoing depth-sorting improvements either.

| Req | Verdict | Reasoning |
|---|---|---|
| 1. Real closed solids, correct occlusion | **No** | Own docs: centroid-based sort, "z-fighting is one of Zdog's charms," documented workarounds require separating shapes — the opposite of this scene. |
| 2. Pointer-drag rotate | Yes | Built-in illustration drag-to-rotate is Zdog's headline feature. |
| 3. Per-box highlight | Yes | Shape color is a live-updatable property. |
| 4. Per-box independent rotation | Yes | Every Anchor has independent rotate. |
| 5. Stay-put rearrange | Yes | Anchor `translate` is just state; no CSS-transition-revert failure mode. |
| 6. Whole-plane / assembly shake | Yes | Group (parent Anchor) transforms. |
| 7. Motion blur | No | Canvas/SVG immediate-mode redraw each frame with no accumulation; nothing built in. |
| 8. Runs on phone | Yes, for small scenes | But this project's own 25-box, adjacent-face scene is close to the case where Zdog's real weakness shows. |

Verdict: disqualified on requirement 1 alone, and it's the requirement this project has already failed
three times on for a different reason — swapping in a library whose own maintainers call the same failure
mode "a charm" doesn't fix it.

### Canvas 2D, hand-rolled axonometric projection (recommended)

This was floated early and rejected as "too much work." Re-evaluated: for *this specific geometry* it's
substantially less work than it sounds, because the general hard cases for painter's-algorithm sorting
don't apply here.

**Why the sort is provably correct for this scene:** Newell's algorithm and the classic painter's-algorithm
failure cases ([Wikipedia, Newell's algorithm](https://en.wikipedia.org/wiki/Newell%27s_algorithm); see
also the cyclic-overlap and interpenetration cases described in standard treatments like
[paroj.github.io's overlap/depth-buffering notes](https://paroj.github.io/gltut/Positioning/Tut05%20Overlap%20and%20Depth%20Buffering.html))
arise from **interpenetrating or non-convex** geometry — two objects whose extents overlap along the
sort axis so that "A is behind B" is only true for part of each object. A 5×5 lattice of identical,
non-intersecting, convex, axis-aligned boxes at rest has no such case: for any two boxes, one is strictly
farther from the camera than the other along the view direction, full stop, for every rotation. Sorting
25 box centroids by camera-space depth (one dot product each) and painting back-to-front is exactly
correct, always, **as long as the boxes stay in the rigid lattice or move without interpenetrating**
(the caveat that matters for requirement 5's π step — see below).

**What it costs to build:**
- A small vec3/mat3 helper (rotateX, rotateY, project-to-screen with a simple orthographic or weak-perspective
  axonometric projection) — on the order of 40-60 lines, no dependency.
- 8 vertices per box (cheap to generate procedurally from center + half-extents), 6 faces as vertex-index
  lists, one cross-product-based backface cull per face (skip faces pointing away from camera — this alone
  removes half the fill work and most of the visual "wait, I can see through it" bugs the CSS attempts had).
- Depth-sort: compute each box's rotated centroid, sort 25 numbers (trivial cost), paint back-to-front.
- Each face fills as a `ctx.fill()` on a projected polygon (3-4 points), color = base lane color (`--gold`
  or `--panel2`, matching the existing rate/capacity split) times a per-face shade factor (top brighter,
  side darker — same visual convention the current CSS `::before`/`::after` brightness multipliers already
  use, so this is a direct port of an idea already validated, not a new design).
- Per-box pulse (req 3): a brightness multiplier read straight off each box's own JS state, multiplied into
  the fill color at paint time — no CSS filter-forces-flat trap exists in Canvas at all, because there's no
  `preserve-3d` subtree to collapse.

**Theming:** read `getComputedStyle(document.documentElement).getPropertyValue('--gold')` etc. once (and
on a `prefers-color-scheme`/theme-toggle change listener, matching how the rest of the page already
re-themes), parse to RGB, use directly as fill colors and as the fixed points the per-face shade multiplier
scales from. This is a strict subset of what the Three.js theming path needs (same CSS-var-read step,
no extra material/shader indirection on top) so it's a wash on that specific point, but simpler in every
other dimension.

**Requirement 7, motion blur — this is a case *for* Canvas 2D, not against it:** instead of
`ctx.clearRect(0,0,w,h)` at the top of each frame, paint a translucent rect in the background color
(`ctx.fillStyle = 'rgba(bg, 0.35)'; ctx.fillRect(...)`) before drawing the boxes. Previous frames bleed
through at reduced opacity, producing a cheap accumulation-style trail automatically, tunable by one alpha
value, and easy to gate on "only during a fast rearrange, not at rest" (skip the translucent step, do a
real `clearRect`, when nothing is animating). This is meaningfully *less* work than the equivalent in
Three.js (which has no built-in motion blur and needs a velocity buffer or an offscreen accumulation
target — real GPU pipeline work) or in CSS (isotropic `filter: blur()`, wrong shape of blur, and it
can't be conditioned on velocity without JS driving it frame-by-frame anyway).

| Req | Verdict | Reasoning |
|---|---|---|
| 1. Real closed solids, correct occlusion | **Yes** | Painter's algorithm is exactly correct for this geometry (see proof sketch above); explicit backface culling avoids the "planes not meeting" artifact by construction — every face is a real quad with 4 shared vertices, not glued-on pseudo-elements. |
| 2. Pointer-drag rotate | Yes | Same pointer-event math the page already has (`setupLaneGridDrag`), feeding accumulated rotateX/rotateY into the projection matrix instead of a CSS transform string. |
| 3. Per-box highlight | Yes | Multiply fill color by a per-box brightness value at paint time — no CSS grouping-property trap can exist. |
| 4. Per-box independent rotation | Yes | Each box owns its own local rotation state, applied before the shared camera rotation — trivial in a coordinate system with real per-object transforms, which is exactly what the owner asked for. |
| 5. Stay-put rearrange | Yes | Box position is a plain JS field (`{gx, gy}` or a target vec3), not a CSS transition with an implicit revert; π mutates the field once, the renderer keeps reading it every frame until the next mutation. Fixes the actual bug (see implementation notes). |
| 6. Whole-plane / assembly shake | Yes | Apply an extra small offset/rotation to a subset (or all) of the boxes' transforms for N frames — same idea as a CSS group transform, implemented as a shared modifier in the render loop instead of a shared DOM ancestor. |
| 7. Motion blur | Yes | Translucent-background-fill trick above; cheap, tunable, conditionable on speed. |
| 8. Runs on phone | Yes | 25 boxes × ~5 visible faces is trivial 2D canvas fill work — orders of magnitude below what causes jank on phones; no WebGL context/driver variability to worry about either. |

Vendored size: **0 KB.** Complexity: moderate, concentrated in one well-understood, well-scoped piece of
math (a rotation + projection helper), not spread across "which CSS grouping property silently breaks
`preserve-3d` this time." Fits the single-file constraint with zero friction — it's the same kind of code
this page already has for the trace/animation logic, just extended with a projection step.

### WebGL directly / a micro-wrapper

Considered and not recommended as a distinct option: for a scene this small (25 static-topology boxes,
no textures, no lighting model beyond flat-shaded faces), raw WebGL buys back essentially nothing over
Canvas 2D's painter's algorithm (which is already exactly correct here, not an approximation being
avoided) while paying setup costs Canvas 2D doesn't have — shader compilation, buffer/attribute wiring,
context-loss handling, and a real coordinate/projection pipeline that Canvas 2D's 2D `ctx.fill()` calls
sidestep entirely. Micro-wrappers like `twgl.js` (~9-11 KB gzip) or `regl` (~20 KB+ gzip) exist and would
be smaller than Three.js, but they still inherit WebGL's setup complexity for zero benefit on a scene
where the "hard problem" (occlusion) is already solved for free by the geometry being rigid and convex.
Skip this tier — it's strictly dominated by Canvas 2D for this specific scene.

---

## Implementation notes for the recommended option (Canvas 2D)

**Depth sorting.** Per box: rotate its 8 local vertices (or just its center, for sorting — vertices only
needed for painting) by the shared grid rotation (+ that box's own independent rotation for req 4, applied
first, in local space), then dot the resulting camera-space position against the view direction to get a
depth scalar. Sort the 25 boxes descending by depth (farthest first), paint in that order. Within a box,
cull back-facing faces (face normal · view direction ≥ 0 → skip) and paint the remaining 1-3 visible faces
in their own centroid-depth order (usually just "top, then front, then side" — determinable once and
memoized per octant of rotation if profiling ever calls for it, though at 25 boxes this is very unlikely
to be needed).

**Requirement 5 — stay-put rearrangement, and the actual bug to fix.** The current code's real defect
is at hash/index.html:1072 —

```js
setTimeout(() => { el.style.transform = el.dataset.baseTransform; }, 220);
```

— which unconditionally reverts every lane to its *original* grid slot 220ms after any transform change,
because position was never actually modeled as state; it's read back out of a `dataset` attribute that π
never updates. The fix is architectural, not a bigger timeout: keep one JS object per lane —
`{ gx, gy, rotX, rotY, rotZ, pulse }` — where `gx`/`gy` (or a target `{x,y,z}`) is the *only* source of
truth for where a box draws. `π` mutates `gx`/`gy` for the 25 lanes according to the permutation formula
already computed (`KECCAK_PI_LANE_MAP`, hash/index.html:447-456) and nothing ever reverts it, because
there is no separate "base transform" to snap back to — the render loop always draws from current state.
This is the same fix that unlocks requirement 4 cleanly too: `rotX/rotY/rotZ` per box, applied in the
box's own local frame before the shared camera rotation, replacing the `.lane-tick` swinging-indicator
hack (hash/index.html:241-253) with the actual rotation the owner wants.

**Avoiding interpenetration during the π transition (the one case that could threaten the depth-sort
guarantee).** If a box's position is animated as a straight-line lerp from its old grid slot to its new
one, two boxes swapping diagonally-opposite slots will pass close to or through the lattice's interior
space mid-transit, and for a few frames the "boxes never overlap" precondition the sort proof relies on
can be violated (rare, brief, and only for adjacent-frame visual glitches, not a hard crash — but still
worth avoiding). Recommended instead: animate each moving lane along a **lift-slide-drop** arc — rise in Z
(toward camera) above the whole lattice, translate over its old and new grid (x,y) footprint, then drop
back into the new slot's Z. This keeps every box either at its resting depth or strictly above the entire
lattice for the whole transit, so the "no interpenetration" precondition holds throughout, the depth sort
stays exactly correct with no special-casing, and it reads better pedagogically too — you can visually
track "this lane picked up and moved to that slot" rather than watching two colors cross-fade in place.
This also composes cleanly with the motion-blur trick above (the arc is exactly the "fast rearrangement"
case the owner asked to blur).

**What would change this recommendation.** If a future requirement needs textures, real lighting/shadows,
or a much larger scene (hundreds of boxes, not 25), the painter's-algorithm guarantee and the "GPU
overhead isn't worth it" argument both weaken and Three.js's ~85 KB gzip cost becomes easier to justify.
For the Keccak lane grid as specified, none of that applies.
