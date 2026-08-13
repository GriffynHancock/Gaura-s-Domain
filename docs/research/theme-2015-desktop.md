# Research: 2015 desktop "micro theme" for SHA-3 panel

Companion piece: a separate 1990s-era theme covers MD5. This document is the SHA-3 / "2015" half
only. Scope: research for CSS/content rebuild, not implementation.

## 1. Era recommendation: Windows 7, not 8.1 or 10

**Recommendation: Windows 7 desktop, Aero glass chrome.**

Market share data for calendar year 2015 (NetMarketShare, via TechSpot/TechPowerUp reporting on
StatCounter's later crossover):

- **June 2015: Windows 7 ≈ 61%, Windows 8.1 ≈ 13%, Windows 10 ≈ 0.16%** (Windows 10 was still
  Insider-preview-only; it launched July 29, 2015).
- Windows 10 didn't overtake Windows 7 in global share until roughly a year *after* launch — so for
  essentially all of 2015, Windows 7 was the machine a home enthusiast (the kind of person who'd have
  a pirated CS5 + a Steam library full of Valve/EA/Lionhead games) was actually running.
- Windows 8.1 never got anywhere near dominant share and its tile-based Start screen reads as "the
  one everybody hated and skipped," not as *the* 2015 desktop.

So Windows 7 is not just nostalgic-adjacent, it is the **empirically correct** choice for "what
desktop was SHA-3 announced on." Good news for the brief: it also means no era-purism is being
traded away for recognizability — the accurate answer and the felt-familiar answer are the same OS.

**Audience read:** Australian TAFE students ~16–20 in 2026 were born roughly 2005–2009. Windows 7
(2009–2015 dominant run) is very plausibly what they had on a family PC or primary-school computer
lab machine as small children, and Windows 10 (which many school networks ran through most of their
teen years) is what they know as "a normal PC." So unlike the 90s panel — which will read to them as
alien, "your grandparents' computer" — this Windows 7 panel should land as *recognisable but dated*:
"oh, that's the old version." That's exactly the right register for "not broken, but clearly one
generation back," which mirrors SHA-3's actual status (current, but younger than the omnipresent
SHA-2 people forget is right next to it) — good enough, don't oversell an exact allegory to students.

Sources: [TechSpot, "Windows 10 surpasses Windows 7 in global market share"](https://www.techspot.com/news/73068-windows-10-surpasses-windows-7-global-market-share.html) (reports June 2015 NetMarketShare figures: Win7 ~61%, Win8.1 ~13%, Win10 ~0.16% pre-launch); [TechPowerUp, same StatCounter crossover story](https://www.techpowerup.com/241152/windows-10-finally-surpasses-windows-7-in-global-market-share-statcounter); Windows 10 general-availability date July 29, 2015 (widely documented, e.g. Microsoft's own release history — not separately re-verified here, it's uncontested).

## 2. Visual spec — precise enough to rebuild in CSS

### 2a. Aero glass approximation

Real Aero glass is **not a Gaussian blur** — it's closer to frosted/diffused light scattering with a
tinted, slightly-desaturated backdrop plus a subtle noise/refraction texture, and it reacts to the
desktop's accent colour (Windows lets users pick a glass tint colour; the default out-of-box tint is
a cool blue). One source explicitly makes this distinction: *"The Windows 7 Aero environment effect
for a backdrop is not blurring but diffusing"* ([css-class.com Aero note via W3C public-fx mailing
list](https://lists.w3.org/Archives/Public/public-fx/2014JulSep/0050.html) — a contemporaneous 2014
technical discussion, treat as a knowledgeable secondary source, not a Microsoft primary spec).

For a dependency-free CSS approximation, `backdrop-filter: blur()` is the practical substitute even
though it isn't optically identical — nobody will notice the diffusion-vs-blur distinction at
teaching-demo scale, and the fallback path matters more than the purism:

- **Glass panel base:** semi-transparent cool-blue-grey fill, roughly `rgba(180, 205, 225, 0.35–0.45)`
  layered over a `backdrop-filter: blur(12–18px) saturate(150%)`. Add a very faint `rgba(255,255,255,0.08)`
  inner top highlight (a `linear-gradient` from `rgba(255,255,255,0.35)` at the very top 2–3px fading
  to transparent) to fake the glossy top-edge catch-light that real Aero windows have.
- **Border:** a 1px outer edge close to `rgba(255,255,255,0.6)` on the top/left transitioning to a
  darker `rgba(30,60,90,0.4)` on bottom/right, to fake the bevel. A 1px inset near-white line just
  inside the border reads as "glass edge" cheaply.
- **Browser support / fallback:** `backdrop-filter` has been broadly supported in evergreen browsers
  (Chrome/Edge since ~2020, Safari with `-webkit-` prefix, Firefox shipped support in 2022) but is
  **not universal on older browsers and some Firefox/Linux configurations still disable it by
  default**. Ship a solid fallback: `background: rgba(210, 225, 240, 0.92)` (an opaque pale
  blue-grey) inside an `@supports not (backdrop-filter: blur(1px))` block, or just always set that
  background colour and let `backdrop-filter` layer on top when supported — it degrades gracefully
  to "solid pale blue-grey window," which still reads as "Windows-ish," rather than to invisible glass.
  Use `@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))` to
  conditionally add the blur/translucency on top of that base.

Tools worth pointing an implementer at (community reconstructions, **not** Microsoft source — verify
visually against a real screenshot before trusting exact values):
- [makeaero.com/window-glass](https://makeaero.com/window-glass) — a free live-preview Aero glass
  window CSS generator (title bar, glossy caption buttons, menu/status bar), exports plain CSS/HTML,
  no dependencies. Best single starting point for concrete gradient stops.
- [7.css (khang-nd)](https://khang-nd.github.io/7.css/) — a maintained, JS-independent CSS framework
  that recreates the whole Windows 7 widget set (buttons, title bars, glass class). Its docs describe
  buttons as "2 shades of gray as a vertical gradient" normally, shifting to "sky blues" when
  active/pressed, and it exposes a `--w7-w-bg` custom property for window background — useful as a
  reference implementation to read the source CSS of rather than a library to import (brief calls for
  dependency-free single-file HTML, so treat 7.css as a **reference to imitate**, not a dependency to add).

### 2b. Window chrome anatomy (the crypto panel as a Win7 window)

- **Title bar height:** ~30–32px is the commonly cited Win7 default (DPI-dependent in the real OS;
  use 32px as a clean round number for CSS).
- **Top corners:** rounded, small radius — about 6–8px, only on the top two corners (`border-radius:
  8px 8px 0 0` on the outer window chrome).
- **Glass border thickness:** ~4–6px visible glass "frame" around the entire window (real Aero
  windows have a noticeably thick frosted border, not a hairline) — for the panel, a 4px translucent
  border matching the glass-panel treatment above.
- **Caption buttons (min/max/close):** three square-ish glossy buttons right-aligned in the title
  bar, ~28–30px each. The close button is the recognisable one: solid red gradient
  (`#e81123`-ish red family, roughly `linear-gradient(#ff5f4f, #d32020)` for a rough approximation)
  with a white "×" glyph, glossy top highlight. Min/max buttons are the same glass-grey as the title
  bar with a simple line/square glyph, gaining a light blue hover highlight.
- **Drop shadow:** a soft, fairly large diffuse shadow under the whole window —
  `box-shadow: 0 12px 32px rgba(0,0,0,0.35)` is a reasonable approximation; real Aero shadows were
  soft and dark but not sharp-edged.

### 2c. Taskbar anatomy

- **Height:** the commonly cited Win7 default taskbar height is **40px** (taskbar button glyphs were
  authored at 40px per state — [Microsoft Q&A / community technical notes on taskbar button
  imagery](https://learn.microsoft.com/en-us/answers/questions/2471650/how-can-i-disable-the-dynamic-task-bar-button-high) references the 40px button image height; treat as
  a widely-repeated technical figure rather than a single canonical Microsoft spec citation).
- **Translucent dark treatment:** taskbar glass is a darker, more opaque variant of the same Aero
  treatment — roughly `rgba(10, 20, 35, 0.55)` over blur, versus the lighter window-chrome glass.
- **Start orb:** circular, Windows logo, with a soft outer glow (`box-shadow: 0 0 12px
  rgba(120,190,255,0.6)`) that reacts on hover — brightens/pulses slightly. Approximate with a radial
  gradient orb (`radial-gradient` blue-to-dark) plus the glow shadow; skip actual logo art (trademark
  — see §6), a plain glowing circle silhouette communicates "start button" adequately for teaching
  set-dressing without depicting the logo.
- **Hot-track glow:** Windows 7 taskbar buttons pick up a colour-tinted glow that follows the mouse
  and "sticks" briefly to the last-hovered button — a nice-to-have hover microinteraction if budget
  allows, skippable otherwise.
- **Pinned icons:** flat square icon tiles, subtle bottom border highlight when a program is "running"
  (a small glowing underline/box). Icons for this project should be CSS/emoji/simple shape homages,
  not ripped logos (§6).
- **Aero Peek sliver:** a thin (~5–8px wide), full-height, borderless rectangle at the **far
  right edge** of the taskbar — hovering/clicking it makes all windows go transparent to reveal the
  desktop. For a static teaching page, a thin decorative sliver at the right edge of the taskbar with
  a subtle lighter tint is enough to read as "that's the peek button" to anyone who used Windows 7.
- **System tray + clock:** small area left of the peek sliver, dark glass background, showing a
  handful of tiny monochrome tray icons and a clock (use a static time, doesn't need to be live) in
  the Segoe-substitute font.

### 2d. Typography

Segoe UI is proprietary (Microsoft ClearType Font Collection licensing) and cannot be shipped.
**Recommended substitute: [Selawik](https://learn.microsoft.com/en-us/typography/font-list/selawik)**
— Microsoft's *own* open-source, metrics-compatible replacement for Segoe UI, designed in-house by
Aaron Bell, released April 2015 (coincidentally the same year as the theme target) under the **SIL
Open Font License 1.1**, freely embeddable. This is a stronger choice than a generic humanist
sans-serif because it's purpose-built to *be* a Segoe UI substitute and is legally clean. Available
via its [GitHub mirror](https://github.com/dodbrian/font-selawik) as static `.ttf`/`.woff` files —
would need to be base64-embedded or self-hosted to satisfy "no external fonts"; check final file size
budget (a single weight is normally well under 100KB and workable to inline as a `@font-face`
data URI, but confirm against the page's total size budget before committing).

If avoiding a font embed entirely (simplest, safest for a single dependency-free HTML file): fall back
to the system sans stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) — on
Windows this literally renders as real Segoe UI (no legal issue, it's the user's own installed font,
not a shipped asset), and elsewhere degrades to a reasonable system sans. This is arguably the more
pragmatic choice for a "no external assets" static file — recommend it unless the exact Segoe
letterforms matter more than expected.

Typical sizes/weights: title bar text ~12–13px regular/semibold; taskbar clock ~11–12px; icon labels
~11px. Segoe UI's whole personality is *small, clean, slightly cool-toned* — avoid oversizing text or
the chrome stops reading as OS chrome and starts reading as a generic card UI.

### 2e. Default Windows 7 wallpaper ("Harmony")

The out-of-box Windows 7 wallpaper is officially titled **"Harmony"**, created by Chuck Anderson and
Erik Attkisson (same team behind the logon screen background). It depicts a stylised Windows flag
logo rendered as a translucent, glowing, glassy motif — done with **seven** design elements (leaves,
branches, flower petals) as a deliberate nod to the "7" in Windows 7 — set against a **deep blue
background with soft diagonal light rays / glow**, giving the light-ray-through-water look the brief
references. ([Windows Wallpaper Wiki, "Harmony"](https://windowswallpaper.miraheze.org/wiki/Harmony) — a
fan-maintained wiki, treat detail claims about the flag's exact element count as a fan reconstruction,
not Microsoft-sourced, but the overall look — blue field, translucent glowing flag motif, soft light
rays — is consistent across multiple independent descriptions and safe to rely on.)

**CSS approximation** (no shipped image, purely gradient-drawn):
- Base: deep blue radial gradient, roughly `radial-gradient(ellipse at 60% 40%, #1c3f6e 0%, #0a1f3d 60%, #051022 100%)`.
- Light rays: 2–4 large, soft, semi-transparent diagonal `linear-gradient` bands or `conic-gradient`
  slices at low opacity (`rgba(150,200,255,0.06)`–`rgba(180,220,255,0.12)`), layered at slightly
  different angles to fake volumetric light shafts.
- Optional centrepiece: a soft glowing translucent blob/rounded shape near the upper-middle,
  frosted-glass style (same technique as the window glass), to gesture at the flag motif without
  reproducing the actual Windows logo (trademark — see §6). A plain glowing abstract shape reads as
  "that wallpaper" to anyone who's seen it, without depicting the trademark.

## 3. Content / icon list — dates checked

| Item | Verified date | 2015 status | Notes |
|---|---|---|---|
| **Minecraft** | Public alpha 2009; the "grass block" icon was the game's icon from early years through 2015 and well beyond — the switch away from the grass-block icon (to other art, eventually a Creeper-based icon) happened much later, ~2023. | **Correct as-is.** In 2015 the icon was the grass block (dirt cube, green grass top), not the newer/creeper icon. | Draw as a simple 3-tone isometric cube (green top, brown/dirt sides) — easy, safe CSS/pixel-art homage, no logo needed. |
| **Spore** | Released **Sept 2008**. | Plausible "still installed" 2015 relic — 7 years old by then, era-correct for "stuff on an old gaming PC," not period-new. | Fine as a nostalgia-shelf item. |
| **Black & White 2** | Released **Oct 2005**. | Same bucket as Spore — a decade-old game by 2015, plausible leftover install. | Good "ancient game still on the desktop" joke. |
| **Team Fortress 2** | Released **Oct 10, 2007** (standalone + Orange Box). | By 2015 TF2 was 8 years old but *still actively played and updated* (it remained one of Steam's most-played F2P titles through the 2010s) — genuinely period-live, not just a relic. | Strong, accurate inclusion. |
| **Portal 2** | Released **April 19, 2011**. | Only 4 years old in 2015 — solidly period-current, no note needed. | Fine as-is. |
| **Half-Life 2** | Released **Nov 16, 2004**. | 11 years old by 2015 — plausible "everyone still has this installed" Steam-library relic (HL2 stayed a Steam staple for a decade+). | Fine, same bucket as B&W2/Spore. |
| **Dungeon Keeper 2** | Released **June 1999**. | 16 years old by 2015 — the oldest item on the list by far. Still plausible as "abandonware still sitting in a folder from a decade ago," which is itself a good joke (the machine has *sediment layers*). | Keep it, it strengthens the "accumulated cruft" reading rather than undermining period accuracy — the joke is about the PC's age, not the game's freshness. |
| **Half-Life 3 "in Cyrillic" .zip.exe** | N/A — Half-Life 3 has never been released or officially announced (as of 2026). "Russian leak" fake-download jokes referencing it were already a well-worn meme by the mid-2010s. | Intentional joke, not an error — flag as the deliberate gag it is. | See §6 for the double-extension teaching angle. |
| **Adobe CS5 (Photoshop, Premiere Pro, After Effects, Lightroom, Audition)** | Creative Suite 5 launched **April 12–30, 2010**; Audition replaced Soundbooth as "the audio one" starting with CS5. | **5 years old and one-plus major versions behind by 2015** — Adobe had moved to the **Creative Cloud subscription model starting mid-2013**, discontinuing perpetual-licence CS after CS6. A *legitimate* 2015 machine would run CC apps, not CS5. | This is very plausibly the intended joke, not an error — see below. |

**On the CS5-in-2015 anachronism specifically:** the brief itself already spots this and reads it
correctly. By 2015, Adobe's real product was Creative Cloud (subscription, auto-updating); a *boxed,
cracked CS5 install with a keygen* is not period-accurate for "current Adobe software" but is
extremely period-accurate for **"what a cash-strapped home enthusiast/pirate actually had installed,"**
because CS5 was the last big perpetual-licence version widely cracked and circulated before the CC
shift made piracy harder (subscription auth, cloud licence checks). So: keep it, but understand *why*
it lands — the joke isn't "this is the 2015 software," it's "this is 2015-era piracy inertia," which
is a sharper and more honest gag than getting the software version right. Label it in any teaching
notes as intentional if it ever needs defending.

**Suggested additions** (era-appropriate, would land with this audience, currently missing from the
list):
- **Steam client icon** — near-universal 2015 PC gaming presence, cheap to draw, ties together the
  Valve/EA game shelf already on the list.
- **A period browser icon** — Chrome (dominant by 2015) or the old Internet Explorer blue-e/Firefox
  fox are all safe to render as simple geometric homages; helps sell "this is a real desktop."
- **Discord** — publicly launched **May 13, 2015**, right in the SHA-3 target year. This is a genuinely
  good period-precision detail: including it (rather than the more expected Skype/TeamSpeak/Ventrilo)
  signals the desktop is dated to *exactly* 2015, not "sometime in the 2010s." Worth calling out in the
  panel copy or a tooltip as an Easter egg for anyone who checks — it's the kind of accurate-to-the-month
  detail that rewards a sharp student.
- **uTorrent / a generic torrent-client icon** — consistent with the general piracy-adjacent-but-comic
  framing already established by the CS5-patcher joke; safer than reproducing an actual torrent site.
- **Winamp or Windows Media Player** — period-plausible desktop music player, cheap set dressing.

## 4. Meme archaeology — dates checked

| Meme | Verified origin | 2015 status | Notes |
|---|---|---|---|
| **I Can Has Cheezburger** (lolcats) | Site launched **Jan 11, 2007** by Eric Nakagawa and Kari Unebasami; peaked ~1.5M daily hits by May 2007. | 8 years stale by 2015 — squarely "your older sibling's meme," already a period fossil by the SHA-3 target year. | This staleness *is* the joke — see framing note below. |
| **Epic Face (Madness Combat)** | Madness Combat is a long-running Newgrounds flash series (creator: Krinkels, series started 2002); "Epic face" is a recognisable expression/screenshot format drawn from the series that circulated as a reaction image through the 2000s–2010s meme ecosystem. | Could not pin an exact single "first appeared as a standalone meme" date from search results — treat the precise origin date as **unverified**; the series and its imagery were well-established well before 2015. | Verify visually before drawing — describe as "a Madness-Combat-style stick-figure reaction face," don't claim a specific year if implementing literally. |
| **"Trolled" folder / trollface** | The Trollface image itself dates to a **2008** Rage Comics-adjacent 4chan post (creator: Whynne, "Coon and Friends" comic, 2008); "you got trolled" folder-prank jokes are a widely recognised format from the trollface/rage-comic era (roughly 2008–2012 peak). | Could not confirm a single canonical "Trolled folder" origin post — this is best treated as a **generic format** ("a folder icon relabeled to prank someone") rather than a citable single meme with a fixed date. Safe to include as set dressing; don't cite a specific origin claim. | Straightforward to render: a plain folder icon mislabeled/recoloured, no rights issue since it's a generic Windows folder + text joke, not reproducing a specific artist's trollface artwork if avoiding that image itself (see §6 on trollface's own murky authorship/rights history). |
| **Rage comics generally** | First rage comic posted to 4chan's /b/ in **2008** ("FFFFFUUUUU-" strip); peak popularity **late 2000s–early 2010s**. | 5–7 years stale by 2015, same "aging meme sediment" bucket as ICHC. | Good, correctly-dated inclusion for the "old dead memes accumulating on an old PC" joke. |

**Framing note (this is the actual joke, and it's a good one):** none of these memes are
period-*current* for 2015 — they're all artifacts of roughly 2007–2010, sitting stale on a machine
that's itself dated 2015. That's not a research error, it's the correct read: an old, cluttered,
never-cleaned-up home PC accumulates dead meme images the same way it accumulates old
software installs (Dungeon Keeper 2, CS5) — the *staleness itself* is what sells "this is somebody's
real, lived-in, unmaintained desktop," reinforcing the "old and busted" reading the brief wants,
just via content-age rather than OS-era. Keep this framing explicit in any implementation notes so
whoever builds it doesn't second-guess it as a mistake.

**Suggested additions** genuinely period-appropriate to 2015 itself (rather than older memes still
lying around) if the owner wants at least one *fresh-for-2015* meme alongside the old ones:
- **Doge** (peaked ~2013 but still very live culturally through 2015) — reads as the "recent" meme
  relative to the 2007–2010 fossils, giving a nice contrast layer.
- **"Left Shark" (Katy Perry Super Bowl)** — Feb 2015, exactly period-correct, a good sharp-detail
  Easter egg similar to Discord's launch date.
- **Pepe the Frog** — circulating as a mainstream reaction-image meme by 2015 (pre-dates its later,
  much more fraught political appropriation, which mostly happened 2016 onward) — **flag this one as
  a judgment call**: given the audience is minors and the imagery later became strongly associated
  with hate symbolism, recommend *skipping* it even though it's period-plausible; the "old and busted"
  joke doesn't need it and the reputational risk isn't worth the marginal nostalgia value.

## 5. The Proxmox top-bar layer

Current Proxmox VE web UI header (this is the *framing* layer — using the current, real Proxmox UI is
correct per the brief, since it's meant to look like today's tool hosting yesterday's OS as a VM):

- **Layout**, per Proxmox's own docs: logo top-left, followed immediately by the running version
  string; centre/right area has a search field; far right has a row of action buttons (Documentation,
  Create VM, Create CT) then the user menu (identity + dropdown for settings / 2FA / password /
  language / **colour theme** / logout). ([Proxmox VE wiki, "Graphical User Interface"](https://pve.proxmox.com/wiki/Graphical_User_Interface) — primary/official source.)
- **Colour:** default theme uses a **black header bar** with the orange Proxmox wordmark/logo — this
  is Proxmox's well-known brand pairing (black + Proxmox-orange, roughly `#e57000`–`#ff6c02` family).
  A dark-mode variant ("Proxmox Dark") also exists as a built-in theme option since **v7.4** (2023),
  and several community themes exist (e.g. a Discord-styled dark theme), but the primary/default is
  the black-and-orange bar — that's the one to imitate for instant recognisability. (Exact hex wasn't
  extracted from a primary source in this pass — sample from a live Proxmox instance or the
  `dashboardicons.com`/Wikimedia Commons Proxmox logo SVG for the precise orange if pixel-accuracy
  matters; treat the hex guess above as approximate, not sourced.)
- **Version string treatment:** small, monospace-or-plain-sans, muted-grey text immediately after the
  logo, e.g. "Virtual Environment 8.x" — for this project's joke, this is the natural place to put a
  fake "running: SHA3-VM" / "running: MD5-VM" label that **changes as the visitor switches themes**,
  selling the "undocked VM window" framing the brief describes. No sidebar needed (brief explicitly
  says top-bar-only, no Proxmox tree sidebar) — keep it to a single slim horizontal strip pinned above
  the desktop section.
- **Typography:** Proxmox's real UI uses a standard sans (system font stack, ExtJS-based UI) — nothing
  distinctive enough to need a special substitute; the project's own body sans (Hanken Grotesk, per
  the existing design system) is a fine stand-in and keeps this layer visually distinct from the
  Segoe/Selawik used *inside* the desktop illusion — that contrast is actually useful, it reinforces
  "this bar is the outer real tool, the desktop below is the emulated one."

## 6. Legal / appropriateness read

This is the section that matters most for this half of the theme, since almost everything on the
owner's list is a trademarked logo, a copyrighted asset, or (for the CS5-patcher joke) an implied
reference to piracy tooling. Page is public on GitHub and a public website, aimed at school-distributed
teaching material for minors — treat that combination as the binding constraint, not a soft guideline.

**Categorise every element as CSS-safe vs asset-risk:**

| Element | Read |
|---|---|
| Windows 7 window chrome / Aero glass / taskbar / Start orb glow | **Safe.** These are generic UI *conventions* (rounded glass windows, translucent taskbar, glowing circular start button) — recreating the *look and feel* in original CSS is not reproducing Microsoft's copyrighted assets or trademarks, it's the same kind of homage 7.css and dozens of "retro desktop" web toys already do openly. Do not use the actual Windows logo glyph anywhere (see wallpaper note in §2e) — a plain glowing orb/abstract shape sidesteps the trademark cleanly while still reading as "that button." |
| Wallpaper ("Harmony" look) | **Safe as a CSS gradient homage** (§2e) — approximating the *colour and mood* of a wallpaper is fine; do not embed or trace the actual Windows 7 wallpaper file (copyrighted Microsoft asset) or reproduce the Windows flag logo shape precisely. |
| Minecraft grass-block icon, game logos (Spore, Black & White 2, TF2, Portal 2, Half-Life 2, Dungeon Keeper 2) | **Asset-risk if using real logo art.** These are all trademarked/copyrighted brand marks belonging to Mojang/EA/Valve/Lionhead-EA respectively. **Recommendation: original geometric/pixel-art homages**, not traced or downloaded logos — e.g. a simple 3-tone isometric cube unmistakably *reads as* "that Minecraft block" to anyone who's played it, without reproducing Mojang's actual trademarked assets. This is both the safer legal posture and more in keeping with "dependency-free, no external images" implementation constraint anyway (§7) — a forced constraint that happens to also be the right call. |
| Adobe CS5 app icons (Photoshop/Premiere/AE/Lightroom/Audition) | **Same as above** — recognisable coloured-square-with-two-letter-abbreviation icon *style* (Ps, Pr, Ae, Lr, Au) can be homaged generically (coloured square, rounded corners, two-letter monogram) without reproducing Adobe's actual trademarked icon artwork. |
| **CS5 "patcher with an anime-girl icon"** | **This is the one to actually reconsider, not just legally but on appropriateness grounds.** |

**On the patcher/keygen joke specifically:** the reference is accurate — "keygen with anime-girl art
and chiptune/Eurodance music" is a real, well-documented warez-scene convention going back to the
crack-intro/demoscene tradition ([Wikipedia, "Crack intro"](https://en.wikipedia.org/wiki/Crack_intro);
[Hackaday retrospective on keygen music culture](https://hackaday.com/2025/07/20/remembering-chiptunes-the-demoscene-and-the-illegal-music-of-keygens/)).
It's a genuinely funny, specific, well-observed reference for anyone who lived through that era.

But weigh it against the actual constraints here:
- **Audience:** minors, in a **school-distributed** teaching resource.
- **Distribution:** public GitHub repo + public website, i.e. permanent, searchable, attributable to
  the school/programme.
- **Function of the joke:** depicting a piracy tool (a keygen/patcher icon) isn't just an aesthetic
  risk, it's *modelling and normalising software piracy tooling* to teenagers, in material an
  educational institution's name is attached to. That's a different category of risk than "trademarked
  logo used as a visual reference" — it's a content-appropriateness call, not just an IP one.

**Recommendation: keep the *joke* (an old cracked Adobe suite languishing on the desktop is period-true
and funny), drop the *literal patcher-with-anime-girl icon depiction*.** A version that keeps the humour
without the risk:
- Render it as a mundane, semi-legible "CS5_Keygen_FINAL_v2_ACTUALLY_WORKS.exe" or similar
  over-the-top filename as a **desktop icon label** (the *naming convention* is the joke — everyone
  who's seen a sketchy download folder recognises "_FINAL_v2_ACTUALLYWORKING" instantly) sitting next
  to the CS5 icons, using a **generic** grey/warning-triangle executable icon rather than any
  anime-girl artwork. This keeps 100% of the "this machine has a pirated Adobe suite" joke and most of
  the "sketchy file naming" humour, while removing the actual depicted-tool-with-character-art element
  that's the uncomfortable part for a minors-facing, school-branded artifact.
- If the owner specifically wants the visual gag preserved, an original (not-traced, not
  style-referencing any specific existing keygen artist) simple silhouette placeholder is a fallback,
  but the filename-only version is the cleaner recommendation and loses very little comedic value.

**On "Half-Life 3 in Cyrillic as a .zip.exe":** this is both a good joke *and*, independently, flagged
correctly in the brief as a real teaching opportunity — **double-extension disguise** (`HalfLife3.zip.exe`
appearing to be an archive when it's actually a Windows executable, because `.zip` is not the real
extension) is a genuine, still-current social-engineering technique. Recommend not leaving this as
pure set dressing: give it a hover/click state that briefly calls out *why* it's dangerous ("notice
the real extension is `.exe`, not `.zip` — this is how malware hides today too"), turning the funniest
icon on the desktop into the one bit of the theme that's directly, explicitly on-curriculum for a CTF
prep module. This costs little to add and meaningfully strengthens the pedagogical case for including
the joke at all.

**Overall verdict:** the theme concept is sound and the individual references are almost all
defensible as CSS-drawn homages rather than shipped infringing assets — the one genuine
appropriateness call is the keygen/anime-girl icon, and the recommendation above (keep the gag, lose
the depicted tool) resolves it without flattening the joke.

## 7. Implementation notes

- **No external images.** Every icon (Minecraft cube, game-logo homages, Adobe app monograms, meme
  placeholders, folder icons, Start orb) should be CSS shapes/gradients or, at most, small inline SVG
  — consistent with the "dependency-free single HTML file" convention already used across this
  project's modules, and it happens to also be the safer legal posture (§6).
- **No external fonts** by default rule; if Segoe-accuracy is wanted, self-host **Selawik**
  (SIL OFL, see §2d) as a base64 `@font-face`, budget-permitting — otherwise rely on the OS font
  stack (`"Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif`), which is legally
  uncomplicated since it only ever renders a font the visitor already has installed.
- **`backdrop-filter` fallback:** always define an opaque fallback background colour for glass panels
  before layering translucency (see §2a) — don't let the whole chrome vanish on browsers/configs
  where `backdrop-filter` is unsupported or disabled.
- **Host page light/dark toggle:** this desktop theme is inherently "its own visual world" (a period
  OS skin), so it likely should **not** try to obey the host page's light/dark toggle literally —
  recommend the desktop illusion stays visually constant (it's supposed to look like a specific fixed
  OS, at a specific fixed time of day, that's the joke), while ensuring the **surrounding page chrome**
  (headings, body copy, nav) still correctly follows the site's existing token-based light/dark system
  per the project's design-system conventions. If the owner wants the desktop itself to react to dark
  mode, the cleanest approach is swapping to a "night" variant of the same wallpaper gradient (darker
  blues) rather than trying to force Aero glass to invert convincingly — Aero glass has no sensible
  "dark mode," inverting it stops looking like Windows 7.
- **Accessibility:** this is teaching material, legibility must survive the pastiche. Keep body/label
  text on top of glass panels at a contrast ratio that passes WCAG AA against the *worst-case*
  translucent backdrop (test against the lightest wallpaper area showing through, not just the
  intended average) — glass UIs are notorious for contrast failures where text sits over a
  bright patch of background. Consider a subtle text-shadow or a slightly more opaque text-plate
  behind small labels (taskbar icon captions, title bar text) rather than relying on translucency
  alone to stay legible in every position.
- **Responsive behaviour:** taskbar and title-bar chrome should collapse sensibly on narrow viewports
  (icon captions can hide before icons themselves do; taskbar can shrink height rather than wrap).
- **Proxmox bar as shared chrome:** since the brief specifies one Proxmox-style bar above *both*
  theme panels (undocked-VM framing), implement it once, with its inner "running: X" label driven by
  whatever mechanism already switches between the two theme panels — keep this piece visually
  constant in style (black/orange, ExtJS-plain typography) regardless of which desktop era is showing
  underneath, since it's explicitly the "real tool" layer, not part of either pastiche.
