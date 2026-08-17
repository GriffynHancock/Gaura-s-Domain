# Audio Module — Challenge Catalogue

A record of every sub-challenge proposed, grouped by category, with viability
status and the reasoning behind each verdict. Companion to
`snare-spectrogram-challenge-spec.md`, which develops the spectrogram-in-snare
stage in full.

**Tally: 7 viable, 5 rejected.**

Of the seven, two are variants of the same challenge (Snare-Spectrogram A and
B), and one is structural rather than a standalone puzzle (Withheld-Header
Reassembly). So: five distinct puzzles, one structural mechanic, two build
routes for one of the puzzles.

Several were viable only after modification. That is noted per entry, since the
modification is usually the part worth remembering.

---

## Category 1 — Frequency-Domain Steganography

Challenges where the payload lives in the spectrum rather than the waveform.
These share tooling and a common failure mode: any lossy encode destroys them.

### 1.1 Snare-Spectrogram URL — VIABLE

A URL rendered as a bitmap in the magnitude spectrogram, printed across
grid-locked percussion hits. The bitmap column pointer advances only while a hit
is active and freezes during gaps, so a solver who slices the gaps out gets
abutting glyphs and legible text.

**Two build routes:**

- **1.1a — Synthesised carrier.** Generate the hits, encode the text into them,
  place them on a grid over a backing track under the author's control. Simpler.
- **1.1b — Existing carrier.** Take a track with a relentless grid-locked snare
  and apply a time-varying multiband gain to the whole mix during snare windows.

Route B looked harder than it is. The snare is never isolated or separated —
the image is carved by gating the full mix inside a band where snare energy
already dominates. Whether that dominance is sufficient in real material is the
primary open question.

**Modified from original proposal:** the initial version had phase modulation
carrying part of the payload. It cannot — a magnitude spectrogram discards phase
entirely. Also revised from "quiet gaps so a noise gate reassembles it" to
"strict periodicity so the solver slices on the BPM grid," which lets the
backing track play through the gaps.

**Binding constraint:** time-frequency resolution. A 1024-sample window smears
roughly 23 ms per column regardless of hop, so a 120 ms hit yields about five
distinct columns, not twenty.

**Tests:** spectrogram literacy, tempo analysis, careful slicing.

**Status:** fully specified. See the companion spec.

### 1.2 Spectral-Domain File → Spoken Flag — VIABLE

Ship a phase vocoder analysis file (CDP `.ana` or `.pvx`) that resynthesises to
a voice reading the flag letter by letter. The file cannot be played directly;
the solver must identify the format and run it back through a synthesis step.

**Modified from original proposal:** the original premise was that a
Fourier-transformed file would be *audible* as strange overlapping sine waves.
It isn't — transform output is complex coefficients, and playing those as PCM
gives noise. Keeping the full complex analysis file preserves phase and inverts
cleanly, which is what makes the challenge fair.

**Design decision outstanding:** magnitude-only would force Griffin-Lim
reconstruction with characteristic buzzy artefacts. Spelled letters would
probably survive it, but the analysis file keeps phase and inverts exactly, so
there's no reason to take the loss.

**Reading the flag letter by letter is deliberate** — it survives lossy
reconstruction where a normally-spoken string would not.

**Tests:** file identification from magic bytes, willingness to install unfamiliar
software.

**Note:** the trivia payload here is real but should be worded carefully. CDP's
use by Aphex Twin is reported and inferred rather than confirmed by the artist.

### 1.3 Sparse Fourier Series → Resynthesis — VIABLE

Ship a list of partials (frequency plus amplitude envelope) instead of audio.
The solver resynthesises, and the resulting audio carries text in its
spectrogram.

**Why it works only in this specific case:** a general song needs as many series
terms as it has samples, making the "series" the file in another encoding with
nothing hidden. Spectrogram text is spectrally sparse, so a few hundred partials
genuinely reconstructs it. The compression is real rather than nominal.

**Requirement:** static coefficients give a static spectrum. Scrolling text needs
per-partial amplitude envelopes over time — closer to an SDIF-style partials
file than a textbook Fourier series.

**Tests:** additive synthesis concepts, resynthesis tooling.

---

## Category 2 — Signal-as-Display

Challenges where the waveform is not heard but rendered.

### 2.1 Oscilloscope XY Image — VIABLE

A stereo WAV that draws readable content when its channels drive the X and Y
axes of a scope in XY mode.

**Well-established technique.** XY mode makes the scope a vector display with
beam position driven by the two channels; apparent solid lines come from display
persistence. Software emulators exist, so the solver needs no hardware.

**Hard constraint:** beam brightness is fixed and cannot be modulated without a
Z-axis input. Output is line art traced by a moving dot, not filled regions.

**Consequence:** the QR-code variant is not viable (see 4.5). Line-drawn text or
simple geometry is the correct target.

**Tests:** lateral thinking about what a waveform can be, XY-mode awareness.

---

## Category 3 — Computational / Algorithmic

Challenges where the work is computation rather than signal handling. These are
the only ones in the module that aren't audio-specific.

### 3.1 Rule 90 Preimage Search — VIABLE

Present a bitmap where each pixel row is the cell state of a 1D elementary
cellular automaton at one time step. The solver recognises the Sierpinski
structure, identifies the rule, then realises the visible rows are *downstream*
of the key and must walk backwards to recover it.

**Why the search is genuine:** Rule 90 is not reversible. Every configuration has
exactly four possible predecessors, so stepping back k generations gives a
branching tree of 4^k candidates. Only one root decodes to printable ASCII.

| k  | candidates | rough cost        |
|----|-----------|-------------------|
| 10 | ~1e6      | seconds           |
| 14 | ~2.7e8    | minutes of Python |
| 20 | ~1e12     | out of range      |

Target k = 12–14.

**Modified from original proposal:** the original framing had the solver
searching *forward* for a rule or seed. Both directions collapse (see 4.3, 4.4).
Reversing the direction — show the downstream rows, hide the upstream key — is
what makes it work. Recognition gets them to the starting line; the backwards
walk is the actual challenge.

**Design notes:** boundary conditions must be chosen deliberately. Null
boundaries give reversibility when the cell count is even; periodic boundaries
do not. Rule 90's linearity over GF(2) is what makes the author's forward
construction tractable, and the same linearity assists the solver — accepted,
not a flaw.

**Open risk:** if the preimage tree prunes well, or meet-in-the-middle applies,
the 4^k figure collapses and k=14 stops being real work. Verify before fixing k.

**Tests:** pattern recognition, cellular automata literacy, search implementation.

### 3.2 Huffman Tree Decode — VIABLE

Supply a Huffman tree; the solver recovers the bitstream from elsewhere in the
module and decodes it.

**Scope note:** this works for text, not speech. It does not rescue the discarded
compact-state-machine-emits-speech idea (see 4.2) — speech is high-entropy, and
compressing it is building an audio codec, at which point the decoder is larger
than the puzzle.

**Caveat:** publishing the tree leaks the alphabet and symbol frequencies. Minor,
but free information for the solver.

**Tests:** classical compression, bitstream handling.

---

## Category 4 — Structural Mechanics

Not puzzles in themselves. Mechanics that change how the other challenges
behave.

### 4.1 Withheld-Header Reassembly — VIABLE

Split the challenge file into parts distributed across earlier stages, with the
header fragment delivered last. Until the header arrives, `file` and magic-byte
lookup return nothing, so the format cannot be identified early.

**What it solves:** the format-identification challenges (1.2 especially) reduce
to "read a magic byte and use a search engine" if the header is available up
front. Withholding it moves the recognition moment to after reassembly, where it
has some weight.

**Requirement:** provide a way to verify correct reassembly — a hash, or fragment
boundaries self-evident from earlier stages. Without it, solvers who did it
right are staring at float garbage with no way to know they succeeded.

**Secondary benefit:** the intended emotional beat. The solver gets several steps
in before discovering they need to go and install unfamiliar software.

---

## Category 5 — Rejected

Recorded with reasons so they don't get re-proposed once the reasoning fades.

### 5.1 State Machine Accepting One Specific Waveform — REJECTED

A machine that accepts exactly one long input sequence *is* that sequence. The
accepting path reads directly off the transition table, so inspecting the
machine hands over the input — the opposite of the intended property. Unlike a
hash there is no one-wayness.

Secondary problem: raw sample values are not stable under resampling or
re-encoding, so exact-match matching breaks if anyone touches the file.

**Salvageable inversion:** have the machine *transform* audio into the flag
rather than *check* it. Then the flag isn't in the rules, wrong inputs produce
garbage rather than rejection, and the machine reveals nothing. But that is a
keyed decode where the audio is the key, so the solver needs the audio from an
earlier stage.

### 5.2 State Machine Emitting Spoken Audio — REJECTED

Requires roughly one state per sample — 120,000 states for 15 seconds at 8 kHz.
The machine is the WAV file in a worse container. Only becomes interesting if the
machine is much smaller than its output, which requires the output to be highly
compressible. Speech is not.

### 5.3 Guess-the-Rule Search — REJECTED

Only 256 elementary rules exist. A solver loops all of them in under a second.
Becomes a real space only with wider neighbourhoods (5-cell binary gives 2^32)
or additional cell states.

### 5.4 Guess-the-Seed Brute Force — REJECTED

A genuine 2^N space, and tunable to any difficulty. Rejected on design grounds
rather than technical ones: it is pure waiting rather than skill at every
setting. Superseded by 3.1, which requires the same recognition but rewards
implementation.

### 5.5 QR Code on Oscilloscope — REJECTED

QR requires solid filled modules; XY mode draws line art with a moving dot and
fixed brightness. Achievable only by raster-scanning, which is slow and visually
poor. Use line-drawn text instead.

---

## Cross-Cutting Constraints

Apply to every viable entry above.

- **Lossless distribution only.** WAV or FLAC. Any lossy encode destroys the
  frequency-domain payloads.
- **Licensing.** Route 1.1b distributes whatever carrier track it is built on.
  Use CC-licensed or self-produced material.
- **Verifiability.** Every multi-step stage needs a way for the solver to confirm
  intermediate progress.
- **Recognition is not the challenge.** Several of these reduce to "identify
  format, search the web, open in tool." Where that is the whole path, add work
  after the recognition moment (1.1's slicing, 3.1's backwards walk) or gate the
  recognition behind 4.1.

## Suggested Ordering

Ordered by escalating obscurity, with 4.1 spanning the sequence:

1. **1.1** Snare-spectrogram → yields a URL. Familiar technique, unfamiliar twist.
2. **2.1** Oscilloscope XY → lateral thinking, no new maths.
3. **3.2** Huffman tree → classical, unlocks a fragment.
4. **1.3** Sparse Fourier series → introduces resynthesis.
5. **1.2** Spectral-domain file → the CDP payoff, header arriving via 4.1.
6. **3.1** Rule 90 → the computational finale.
