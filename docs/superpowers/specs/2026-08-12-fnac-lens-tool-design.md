# FNAC "Lens" Floating Tool — Design Stub (in progress, parked)

_Companion to the FNAC design spec. Started 2026-08-12, paused mid-brainstorm to address
Hashing-module visualization feedback — resume here, don't restart from scratch._

## Overview

Replaces FNAC's three separate embedded per-stage viewer instances (Raw Bytes Viewer, Metadata
Viewer, Bit-Plane Viewer, currently mounted fresh inside each Night's card) with **one shared
floating tool** — draggable, always-on-top, one instance for the whole page. Each stage's card
keeps displaying its file(s) as visible `<img>` previews + download links (already shipped); the
floating tool is where you drop/select a file to actually inspect it.

## Decided so far

**Section 1 — Window & interaction model (approved):**
- Floating window, `position:fixed`, draggable by a title bar, high z-index (always on top).
- **Minimize toggle** — collapses to a small pill/icon. Deliberate: a future puzzle type that
  doesn't fit this tool shouldn't be stuck with it in the way.
- **Not resizable** — fixed sensible size (~340×420px) covers hex dump + metadata table +
  bit-plane canvas without resize-handle engineering. Explicitly cut from "window with title and
  resizing and everything" to avoid technical bloat, per the user's own stated worry.
- **Reset button** in the main page's top corner — snaps the tool back to default
  position/mode and clears the loaded file.
- **Mode switcher inside the window** (Raw / Metadata / Bit-Plane tabs/buttons), not auto-detect
  — same file stays loaded, you switch lenses on it. Matches Night 2's actual lesson (same file,
  raw bytes vs metadata give different answers) and Night 3 (Bit-Plane greys out/disables for
  non-image files rather than guessing).
- **Input**: both real drag-and-drop (desktop) AND a plain click-to-open native file picker
  (works everywhere including mobile, zero custom touch code — same fallback pattern the
  original FNAC plan already used for the Raw Bytes Viewer).
- **No CF Worker rate-limit concern** — confirmed the whole drop-to-text conversion is
  client-side only (FileReader + Canvas), zero network requests involved, nothing to guard.

## Not yet decided (resume here)

- Exact mode-switcher UI (tabs vs. small buttons vs. dropdown).
- Where the tool's default/idle position is on page load, and whether it persists across reload
  (localStorage) or always resets.
- Whether minimizing preserves the loaded file/mode (so un-minimizing resumes where you left off)
  or clears it.
- Migration: this replaces 3 embedded viewer call sites (`buildNight1`/`buildNight2`/`buildNight3`
  currently each call `mountRawBytesViewer`/`mountMetadataViewer`/`mountBitPlaneViewer` directly)
  — need a plan for how those three functions change to work with one shared floating instance
  instead of mounting their own.
- Any visual/skin treatment beyond "matches warm-editorial-ui" — does it get FNAC's dark skin
  treatment specifically, or does it need to also work if reused on a future non-FNAC module?
