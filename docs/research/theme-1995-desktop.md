# Research: mid-1990s desktop theme for the MD5 panel

Scope: the MD5 (1992, broken) side of a two-era hash-visualization page. Companion doc (separate
agent) covers the SHA-3/2015 side. This doc is research only — no code.

---

## 1. Recommendation: Windows 95, not mid-90s Linux/X11

**Go with Windows 95.** Reasoning:

- **Audience fit is the deciding factor.** The brief's own framing settles it: "if it would just be
  indistinguishable from bfd and all the other stuff to beginners then it doesn't matter, just go with
  Windows." A TAFE room of 16-20 year-olds born 2006-2010 knows "old computer" almost entirely through
  memes, and the meme-legible mid-90s aesthetic *is* Windows 95 — teal desktop, grey 3D chrome, blue
  title bar, Start button. Mid-90s X11 desktops (FVWM, twm, CDE, AfterStep) are visually **more**
  distinctive to people who already know Unix desktop history, but to a first-time viewer several of
  them read as "generic old grey window manager" rather than "the 90s," which directly triggers the
  brief's own exclusion clause. CDE in particular has a famously *un*-charismatic, muddy grey-brown
  Motif look — the search results here landed on "the colour scheme wasn't much to look at" as basically
  the consensus description ([It's FOSS on CDE](https://itsfoss.com/common-desktop-environment/),
  [xteddy.org CDE gallery](https://xteddy.org/xwinman/cde.html)). AfterStep/Window Maker are more
  visually striking (NeXTSTEP-derived dock, dark slate chrome) but that reads as "NeXT/early-Mac-ish,"
  not "Linux" or "1990s" to a beginner — it would need a caption to land at all.
- **The nerd-credibility upside is real but narrow.** FVWM95 (a real, shipping 1996 window manager that
  deliberately cloned Win95 chrome for Unix users switching between the two) is the one genuinely
  on-the-nose "nerdier" option — but it's a Win95 reskin, so choosing it instead of Win95 buys you a
  in-joke for people who already know what FVWM95 is, at the cost of legibility for literally everyone
  else in the room. Not worth it for a teaching page whose stated goal is instant "this is old and
  busted" recognition, not an easter egg for the one kid who's already used Linux.
- **Timeline check on "two or three years after adoption."** MD5 was published April 1992 (RFC 1321).
  Windows 95 shipped **August 24, 1995** — that's a 3-year gap, which matches the owner's framing well.
  A stricter "what was actually current in 1992" reading would point to Windows 3.1 (April 1992) or
  Windows for Workgroups 3.11 (1993) instead — those are the *exact*-contemporary environments. I'd
  still recommend Win95 over Win 3.1: Win95 is the one with instant meme-recognizability (Start button,
  taskbar, the teal desktop are the "that's the old computer" visual shorthand for this generation),
  where Win3.1's Program Manager/File Manager grid-of-icons look is comparatively illegible to someone
  who's never seen it. If the owner wants stricter period-accuracy over recognizability, Win 3.1 chrome
  (raised grey 3D, no taskbar, Program Manager window instead of a Start menu/taskbar) is the fallback —
  flagging it here so the choice is explicit rather than silently overridden.
- **Net call:** Windows 95, on recognizability grounds, exactly as the owner pre-authorized.

---

## 2. Visual spec — Windows 95 chrome, precise enough to build in CSS

Caveat up front on sourcing: there is no single Microsoft-published "here are the hex codes" document
for Win95 — all of the values below come from (a) community UI-reconstruction projects that reverse-engineered
the values from `SystemParametersInfo`/`GetSysColor` defaults and pixel-sampled screenshots, cross-checked
against each other, and (b) Wikipedia/technical write-ups for release dates and font history. Where two
reconstructions disagree I've flagged it — pick either, they're both "close enough" for a CSS approximation
and neither is more "official" than the other.

### 2.1 Colour palette

| Element | Hex | Notes / source |
|---|---|---|
| Desktop background (teal) | `#008080` | Most-cited value across UI-recreation libraries and colour-archive sites (e.g. [color-hex Windows 95 palette](https://www.color-hex.com/color-palette/4556), [SpyColor](https://www.spycolor.com/008080)). One pixel-sampled source gives `#018281` instead ([iColorPalette](https://icolorpalette.com/color/018281/)) — near-identical, use `#008080` as the round, commonly-reproduced value. |
| 3D face / window & button background | `#c0c0c0` | Standard Win32 `COLOR_BTNFACE`/`COLOR_3DFACE`; matches [98.css](https://github.com/jdan/98.css) `--surface`. |
| Button face (slightly distinct shade some recreations use) | `#dfdfdf` | Used by some reconstructions for button face vs. window face; treat `#c0c0c0`/`#dfdfdf` as interchangeable "light grey" — pick one and be consistent. |
| Bevel highlight (raised top/left edge) | `#ffffff` | `COLOR_BTNHIGHLIGHT` |
| Bevel shadow (raised bottom/right edge, one level) | `#808080` | `COLOR_BTNSHADOW` |
| Bevel dark shadow (raised bottom/right edge, outer level) | `#000000` (or near-black `#0a0a0a`) | `COLOR_3DDKSHADOW` — outermost 1px line on raised elements |
| Title bar active — gradient start (left, dark) | `#000080` | Navy; `COLOR_ACTIVECAPTION` |
| Title bar active — gradient end (right, light) | `#1084d0` | `COLOR_GRADIENTACTIVECAPTION`; horizontal gradient, left navy → right lighter blue |
| Title bar inactive — gradient | `#808080` → `#b5b5b5` | Grey gradient, same direction |
| Title bar text | `#ffffff`, bold | |
| Window client-area background | `#ffffff` (or `#c0c0c0` for dialog-style panels) | |
| Selection blue (highlighted text/icons) | `#000080` or `#0a246a` | `COLOR_HIGHLIGHT` — reconstructions vary; `#0a246a` is closer to the icon-label selection blue |

Sources: [98.css source](https://github.com/jdan/98.css) (the most widely used/vetted Win98-chrome CSS
recreation — Win95 and Win98 share this palette almost exactly, Win98 mainly adds the flatter toolbar
style), a Win95-specific CSS-variable reconstruction surfaced via [LobeHub's "Windows 95 Web Designer"
skill writeup](https://someclaudeskills.com/docs/skills/windows_95_web_designer/) (itself a
reconstruction/tribute, not a primary Microsoft source — cross-checked here against 98.css and found
consistent on every value that overlaps), and the classic [Windows 95 256-colour palette on
Lospec](https://lospec.com/palette-list/windows-95-256-colours) for the underlying system palette.

### 2.2 Window chrome anatomy — the bevel is the signature detail, get this right

The raised/sunken 3D look is **two nested 1px borders**, not one:
- **Raised element** (button at rest, window frame, raised toolbar): outer edge dark
  (`#000000`/`#0a0a0a`) at bottom+right, `#ffffff` highlight at top+left; inner edge `#808080` shadow at
  bottom+right, `#dfdfdf`/`#c0c0c0` at top+left. In CSS this is most cleanly built as two stacked
  `inset box-shadow`s or two nested elements each with `border-style: solid` and per-side colours — the
  classic approach (used by 98.css) is `border-top/left: 1px solid #fff; border-right/bottom: 1px solid
  #000` on the outer box, then the same again 1px in with the shadow/highlight pair swapped-in-lightness.
- **Sunken element** (pressed button, text input, status bar segments): exactly the same construction
  with light/dark swapped — dark at top+left, light at bottom+right. This is the detail most people get
  backwards; "sunken = shadow falls toward the top-left, as if light is hitting from top-left and the
  surface dips away from it" is the mental model.
- **Window frame**: 2px total border width (the outer dark line is part of it), non-resizable-looking
  chunky corners.
- **Title bar**: ~18-22px tall (reconstructions differ: one gives 22px derived from font+padding, common
  browser recreations land closer to 18-19px at "normal" DPI) with the left→right navy-to-blue gradient,
  small icon at far left (16×16), text next, then three 16×14px flat-grey buttons at the right
  (minimize `_`, maximize `□`, close `×`) each with the same raised-bevel treatment, pressed-inward on
  click.
- **Menu bar** (if included under the title bar): flat `#c0c0c0`, black text, no gradient, top-level
  items highlight navy-on-hover.

### 2.3 Taskbar anatomy

- **Position**: bottom of screen (this is the Win95-specific instruction from the brief — bottom for
  Windows, left for a Linux/IT-admin look, which this doc isn't using).
- **Height**: sources disagree in the 24-30px band — Quora/community consensus centers on **~28px** at
  standard 96 DPI ([Wikipedia Taskbar](https://en.wikipedia.org/wiki/Taskbar) confirms the general
  bottom-bar concept but not an exact px figure; practical Win95 UI recreations commonly use 28-30px).
  Use 28-30px as a safe, commonly-cited approximation.
- **Background**: same `#c0c0c0` 3D face grey as everything else, with a raised 1px top edge (the
  taskbar sits "up" off the desktop) — same highlight/shadow bevel rule as 2.2.
- **Start button**: bottom-left, raised bevel button, bold Windows flag-ish icon + "Start" label. *Legal
  note: do not reproduce the actual Windows flag logo — see §5.* A generic coloured-square "flag-like"
  glyph or just the wordmark carries the reference without the trademark.
- **Open-window buttons**: raised-bevel rectangular buttons in the middle strip, pressed/sunken when
  that window is active/focused — this is a nice, cheap detail if there's a second fake "window" to
  represent as an inactive taskbar entry.
- **System tray + clock**: bottom-right, **sunken** bevel (opposite of the rest of the taskbar) framing
  a small icon cluster and the `HH:MM` clock text — sunken is correct here, it's one of the few
  genuinely-sunken regions on the whole desktop.

### 2.4 Typography

- **Real system font**: MS Sans Serif (a bitmap/raster font, not scalable) was Windows 95's actual
  default UI font — title bars, menus, dialogs. Tahoma existed and shipped on the Win95 CD but was **not**
  the default; it became the default system font starting with Windows 98/2000 and was popularized
  earlier via Office 97 replacing MS Sans Serif in Office's own UI
  ([FontsArena Windows 95 font history](https://fontsarena.com/blog/windows-95-font/)). One of the two
  reconstruction sources cited in §2.1 states Win95 title bars use "bold Tahoma" — **that's an
  inaccuracy in that reconstruction**; the period-correct answer is MS Sans Serif (bold, ~8pt/11px
  raster) for the title bar and UI chrome. Worth getting right since typography is one of the most
  legible "this actually is Win95" signals.
- **Web-safe/free substitute**: MS Sans Serif itself isn't freely licensable for redistribution. Since
  this is CSS-only (no font files shipped), lean on font-stack fallbacks rather than an embedded font:
  `font-family: Tahoma, Geneva, Verdana, sans-serif` gets visually close on any system that has Tahoma
  (most do) and degrades reasonably; **Verdana** in particular is a genuinely close-in-spirit
  web-safe stand-in (same Matthew Carter humanist-sans lineage as Tahoma —
  [Verdana, Wikipedia](https://en.wikipedia.org/wiki/Verdana)) and is essentially universally installed.
  A pixel-perfect option exists — Wine's "Tahoma" metric-compatible substitute is LGPL — but that's an
  actual font file to embed, which trades off against the "no external fonts" implementation constraint
  in §6; recommend skipping it and accepting the `Tahoma, Verdana, sans-serif` stack as "close enough,"
  since nobody in the room will be pixel-comparing against a real Win95 box.
- **Sizes**: chrome text is small — 11px is the commonly cited UI-chrome size in reconstructions; body
  text inside the fake "window" content area should stay at normal legible teaching-page sizes (this is
  still teaching material — see §6 on accessibility).

### 2.5 Icon aesthetic

- **Dimensions**: 32×32 for desktop icons (the size Windows 95 actually used on the desktop and in
  large-icon views), 16×16 for title-bar icons and small-icon contexts — both were Microsoft's
  recommended/required sizes under the Windows 95 Logo program
  ([Q147672 Win95 Logo icon spec, kbarchive](https://jeffpar.github.io/kbarchive/kb/147/Q147672/)).
- **Colour depth**: period-correct icons were built for a 16-colour or 256-colour palette (many machines
  in 1995-97 still ran 256-colour/16-bit display modes). For a chunky, era-honest look, deliberately
  limit any hand-drawn pixel icons to a small, flat, high-contrast palette rather than smooth modern
  gradients/anti-aliasing — that constraint *is* the look. Transparency in real `.ico` files of the era
  used a hard 1-bit mask (no alpha blending) — replicate that as crisp, non-antialiased edges if drawing
  pixel-art icons in CSS/SVG, rather than soft drop-shadows.
- **Label style**: icon labels sit centered below the icon, white text on the desktop with a
  faint drop/selection-shadow effect when not selected, solid navy highlight box behind the label when
  selected — cheap and recognizable if icons are meant to look "selectable" for flavour.

---

## 3. Content: period-appropriate desktop icons, Australia-aware, dates checked

Target window: **1995-97** (Win95 ship date through just past Dungeon Keeper's release), which is also
consistent with "MD5 is 1992, this is a couple of years into Win95's reign."

| Icon idea | Real release | Fits 1995-97 window? | Notes |
|---|---|---|---|
| Doom | Dec 10, 1993 | Yes (older, plausible holdover) | Actually pre-dates Win95 but was massively still played on Win95 boxes via DOS-compat; totally era-plausible as an icon. |
| Doom II | Oct 1994 | Yes | Same logic, arguably more likely as the "installed" version by 1995-97. |
| Quake | June 22, 1996 | Yes, cleanly in-window | One of *the* defining 1996 PC games — strong choice. |
| Dungeon Keeper | June 27, 1997 | Yes, at the tail end of the window | Fine if the target year is late-90s-adjacent (1997); flag if the theme is meant to feel strictly "1995." |
| Diablo | Dec 31, 1996 | Yes, just barely (New Year's Eve 1996) | Squeaks into the window; safe to include as a late-1996/1997 icon. |
| Diablo II | Summer 2000 | **No — anachronism** | This is outside the mid-90s window by 3-4 years; recommend dropping it or, if wanted, only using it self-aware as an "we know, it's not period-correct" nod. Owner's original list said "Diablo 1/2" — worth flagging explicitly since it's an easy slip. |

All dates cross-checked via Wikipedia / Doom Wiki / Diablo Wiki entries surfaced in search; treat as
solid (these are well-documented, non-controversial release dates).

**Communications software — the Australia-specific angle, which is the strongest content idea in the brief:**

- **Trumpet Winsock** — the standout choice. A shareware TCP/IP stack for Windows 3.x written by
  **Peter Tattam**, an Australian programmer working out of the University of Tasmania psychology
  department; version 1.0A shipped in 1994 and it became *the* way an ordinary Windows user got dial-up
  internet working before TCP/IP was bundled into the OS
  ([Trumpet Winsock, Wikipedia](https://en.wikipedia.org/wiki/Trumpet_Winsock)). It's also got a genuine
  local legal-history hook: Trumpet successfully sued Sydney ISP **OzEmail** in the Federal Court
  (Tasmania registry) in 1996 for copyright infringement after OzEmail bundled Trumpet Winsock on cover
  disks without a license — a very "Australian tech nerd trivia" footnote
  ([AustLII case summary](https://classic.austlii.edu.au/au/journals/UTasLawRw/1996/13.pdf),
  [Trumpet Software Pty Ltd case text](http://www.isc.meiji.ac.jp/~sumwel_h/doc/cases/Trumpet_1996_AU_DC_Tasmania.htm)).
  Strongly recommend an icon for this — it's exactly the "nerdier, real Australian angle" the brief
  wants, and it long predates Win95's built-in TCP/IP stack, so it's period-correct as "the thing you'd
  have needed in 94-95 and probably still had installed."
- **OzEmail** — one of the first Australian commercial ISPs, relaunched 1994 with backing from Malcolm
  Turnbull and Trevor Kennedy, listed on NASDAQ May 1996
  ([OzEmail history summary](https://en.wikipedia.org/wiki/OzEmail)). A branded-feeling "dial-up ISP"
  icon (generic — don't reproduce their actual logo, see §5) or a fake "New Message" icon labelled with
  an `@ozemail.com.au`-style joke address is a nice, low-risk period touch.
  A local ISP dialer icon reads as very period-real to anyone who lived through it, and is instantly
  legible even to someone who didn't (dial-up modem sound is itself a strong retro-meme trigger).
- **ICQ** — technically launched **Nov 15, 1996** ([ICQ, Wikipedia](https://en.wikipedia.org/wiki/ICQ)),
  so it's valid for the tail of the 1995-97 window but not for an "1995" scene. If the theme skews
  earlier, swap for or supplement with **mIRC**, which shipped Feb 28, 1995 and fits the whole window
  comfortably ([mIRC, Wikipedia](https://en.wikipedia.org/wiki/MIRC)) — IRC (via mIRC) was the dominant
  real-time chat option before ICQ existed, arguably more period-accurate for 1995-96 specifically.
- **Netscape Navigator** — first released Dec 15, 1994 ([Netscape Navigator,
  Wikipedia](https://en.wikipedia.org/wiki/Netscape_Navigator)), the dominant browser through this whole
  window (Internet Explorer 3, released 1996, was the first IE anyone took seriously, so Navigator is
  the safer "what an Australian enthusiast had" default) — good, safe browser icon choice. Don't
  reproduce the actual Navigator "N" logo/lighthouse mark — see §5.

**Suggested final icon set**: Doom / Doom II, Quake, Dungeon Keeper, Diablo, Trumpet Winsock, an
OzEmail-style dial-up icon, mIRC (and/or ICQ if leaning late-90s), a generic "Navigator-esque" browser
icon, plus one or two mundane period fillers (Solitaire, My Computer, Recycle Bin, a "readme.txt") to
sell the "actual desktop, not just a joke wall" feel.

---

## 4. Proxmox top bar (framing layer — doesn't need to be period-accurate)

Current Proxmox VE web UI conventions, useful for faking the header convincingly without shipping their
actual assets:

- Proxmox's own web UI ships **light and dark themes**, dark mode formalized in 7.4 and refined in 8.0
  ([Proxmox dark-theme guide](https://computingforgeeks.com/customize-proxmox-ve-web-ui-with-dark-theme/)),
  so a dark VM-manager top bar is itself period-plausible for "current Proxmox" without needing exact
  colour-matching to the real product — recommend treating this as "generic modern dark
  ops-console/hypervisor-manager chrome" rather than a pixel-accurate Proxmox clone, both for legal
  safety (§5) and because exact current hex values weren't confirmed by a primary source in this
  research pass (the forum/theme threads found describe *that* theming exists, not the shipped default
  hex values — recommend a follow-up look at the Proxmox web UI's own CSS/ExtJS theme files, or just
  building an evocative-but-generic dark console bar and not worrying about exact match).
- Layout convention worth keeping regardless of exact colour: dark horizontal bar, product/cluster name
  left-aligned, node/VM breadcrumb next, user/session info and a version string right-aligned in small
  monospace-ish text, minimal icon-only controls (no big glyphy toolbar). This is enough to *read* as
  "hypervisor management console" to anyone who's seen any admin dashboard, without needing exact
  Proxmox hex values.
- For the brief's "window title changes as you switch between the two [era] themes, as if undocked" —
  that's a UI/JS behavior note for the build phase, not a research finding; flagging it here only so
  it's not lost between this doc and the SHA-3 companion doc.

---

## 5. Legal / asset reality check — where the line actually is

This page is public (GitHub + public site), so the standard here is real: don't ship anything a
trademark or copyright holder could plausibly send a takedown for, even a small teaching project.

**Safe to approximate (CSS-drawn, original, or generic-labelled) — do this:**
- The teal desktop colour, grey 3D bevel system, navy title-bar gradient, taskbar layout: these are
  **UI conventions and colour choices**, not copyrightable/trademarked in themselves — dozens of
  open-source projects (98.css, os-gui.js.org, react95, etc.) already reproduce this exact look freely
  and are widely used/starred without issue, which is a useful existence-proof of "this is fine to
  recreate."
- Generic icon glyphs: a folder, a floppy disk, a monitor, a "network cable," a smiley — all fine as
  original small pixel-art, since the *idea* of a floppy-disk save icon isn't ownable, only a specific
  studio's specific rendering of one might be closely copied.
- Fake/parody labels: "Doomsday '93", "QCraft", "Keeper of the Dungeon", a joke ISP name, a joke browser
  name with an invented logo — this sidesteps the whole issue and can still land the joke for anyone who
  recognizes the shape of the reference. This is the lowest-risk path for every icon in §3 if the owner
  wants zero legal exposure.

**Do NOT ship, even approximated closely:**
- The actual **Windows flag logo** (the four-colour flag/window-pane mark) — actively trademarked and
  one of the most recognizable logos in software; a close CSS recreation of the *specific* flag mark is
  the single biggest risk item in this whole brief. Recommend a generic "flag-ish" abstract shape (a
  plain coloured square/rectangle icon, or just bold "Start" wordmark with no flag glyph at all) rather
  than a four-pane flag in Windows' specific colours.
- Real **game box art or icon art** for Doom/Quake/Dungeon Keeper/Diablo — id Software/Bethesda,
  Blizzard/Activision assets are all actively defended IP. Original pixel-art homages using the games'
  *names* as text labels (a name is generally fine to reference — nominative use — the specific artwork
  is not) is the safe path; a hand-drawn "generic demon/skull" icon captioned "Doom" reads perfectly
  well without reproducing id's actual sprite work.
- **Netscape's "N"/lighthouse logo**, the **AOL/Netscape wordmark styling**, **ICQ's flower/bird
  logo**, **mIRC's actual icon** — same rule, original glyph + text label instead of the real mark.
- Proxmox's **actual current logo/wordmark** in the top bar — since §4 already recommends treating this
  as generic "hypervisor console" chrome rather than a literal Proxmox clone, this mostly resolves
  itself; just don't drop their orange logo mark or exact "Proxmox VE" wordmark styling in.
- **OzEmail's actual logo** — same pattern; a joke ISP name/icon in the spirit of OzEmail (or a text
  label that clearly riffs on it, e.g. "OzModem" or similar) rather than their real branding.

**Rule of thumb to hand to whoever builds this**: colours, layout geometry, and UI *conventions* are
fine to recreate exactly (that's how every retro-UI CSS library on GitHub already operates, unchallenged,
for years); specific logos, wordmarks, and copyrighted artwork are not — swap those for original
homage-labels every time. This gets 95% of the nostalgia payoff with close to none of the legal exposure.

---

## 6. Implementation notes

- **No external images**: everything in §2 (bevels, gradients, taskbar) is achievable with
  `linear-gradient`, layered `box-shadow`/`border` tricks, and `background-color` — no image assets
  needed for the chrome itself. Icons can be small inline SVGs (crisp, non-antialiased edges to match
  the period's 1-bit-transparency look) rather than raster images, keeping the file dependency-free per
  the project's existing single-HTML-file convention.
- **No external fonts**: use the `Tahoma, Verdana, sans-serif` fallback stack from §2.4 rather than
  embedding a font file — Tahoma is present on the overwhelming majority of real devices (Windows and
  many Linux distros ship a metric-compatible substitute), and Verdana is a true web-safe font present
  essentially everywhere, so this stack degrades gracefully without a network fetch or embedded font
  data. `image-rendering: pixelated` is worth applying to any small icon SVGs/canvases to reinforce the
  chunky period look at small sizes.
- **Light/dark host-theme interaction**: recommend the desktop skin **ignore the host page's light/dark
  toggle and commit to its own fixed palette** rather than trying to remap Win95's specific,
  historically-fixed colours (teal desktop, navy title bar) onto the site's abstract light/dark tokens —
  the whole point of the skin is that it *looks like a specific real OS*, and that OS didn't have a dark
  mode. Swapping its colours based on host theme would undercut the "this is a real, dated, specific
  artifact" effect the brief is going for. Practically: scope the desktop skin's CSS to its own custom
  properties, defined once, outside the site's `:root` light/dark variable swap, so it renders
  identically regardless of the reader's site-theme choice. (Contrast with the companion 2015/SHA-3
  theme, which — being contemporary — may reasonably be expected to have an actual dark mode toggle of
  its own; worth aligning with that doc's author on whether the *pair* of desktop skins should behave
  consistently on this point.)
- **Accessibility / legibility**: this is teaching content, not just a gag, so:
  - Keep the *content* text inside the fake "window" (the actual crypto animation and any explanatory
    copy) at normal, accessible font sizes and contrast — confine the tiny 11px chrome-text aesthetic to
    genuinely decorative UI furniture (title bar, taskbar, icon labels), never to text a student needs
    to read to learn something.
  - The navy-on-white and black-on-grey combinations in §2.1 are all comfortably high-contrast by
    WCAG standards, so the palette itself isn't a barrier — the risk is purely from using period-accurate
    *font sizes* for real content, which should be avoided.
  - Provide the same information redundantly if any of it is icon-only (e.g. don't rely solely on a tiny
    pixel-art Doom-skull to convey "this represents 1990s software" — a text label under each icon,
    consistent with real desktop-icon convention anyway, handles this for free).
- **Reduced-motion**: if any "window" chrome gets interactive flourishes (button press states, a fake
  taskbar clock ticking, a cursor-drag window move), gate them behind
  `@media (prefers-reduced-motion: no-preference)` per the project's existing animation conventions
  elsewhere in the codebase.
