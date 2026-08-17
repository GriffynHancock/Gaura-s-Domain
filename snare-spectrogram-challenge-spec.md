# Spectrogram-in-Snare Steganography — Research & Implementation Spec

## Purpose of this document

This is a brief for an agent tasked with assessing viability and prototyping. It
states the design, the known constraints, the open questions, and the criteria
for calling the approach viable or not. It is not an implementation plan; the
research should come back before code is committed to.

## 1. The artefact

A WAV file that sounds like ordinary electronic music. Hidden in it is a URL,
readable as text in the magnitude spectrogram — but only after the solver
removes or compresses the intervals between percussion hits, at which point the
partial glyphs from successive hits abut and the text becomes legible.

The URL is the entry point to a larger multi-stage challenge. This document
covers only the audio stage.

## 2. Two variants to evaluate

**Variant A — synthesised carrier.** Generate the percussion hits, encode the
text into them, place them on a grid over a backing track that the author
controls.

**Variant B — existing carrier.** Take a track with a relentless, grid-locked
snare (psytrance is the working example) and apply a time-varying multiband gain
to the whole mix during snare windows.

Note on B: the snare is *not* isolated or separated. The image is carved by
gating the full mix inside a frequency band where the snare's energy already
dominates during its hit. Determining whether that dominance is sufficient in
real material is a primary research question.

## 3. Encoding mechanism

- Render the URL as a 1-bit bitmap: frequency on the vertical axis, time on the
  horizontal, one long strip.
- Maintain a column pointer into that strip. Advance the pointer **only while a
  hit is active**; freeze it during gaps. This is what makes the gaps removable
  without losing glyph continuity.
- For each analysis frame during a hit, apply per-band attenuation according to
  the current bitmap column — dark pixels notch the band, light pixels leave it.

Carving letters out of broadband noise is preferred over adding tones to
silence: notches in noise are less perceptually salient than added tones, and a
snare supplies energy across the band for free.

**Phase carries nothing.** The magnitude spectrogram discards it. Any phase
manipulation is musical decoration only and should not appear in the encoding
path.

## 4. The binding constraint

Time-frequency resolution, not the choice of carrier.

A spectrogram column is not free. With a 1024-sample analysis window at 44.1 kHz
the effective horizontal smear is roughly 23 ms regardless of hop size, so a
120 ms hit yields on the order of five genuinely distinct columns — not the
twenty a small hop would suggest.

Working arithmetic to verify: a 20-character URL in a blocky font needs roughly
150–200 columns. At ~5 usable columns per hit that is ~35 hits. At 140 BPM with
a hit on every offbeat eighth, 15 seconds supplies about 35. Feasible, with no
slack.

Levers if it doesn't fit:
- longer hits (also makes each glyph self-contained within one hit, so splice
  errors degrade rather than destroy)
- shorter URL, or a URL shortener
- a narrower font
- more hits per bar

## 5. The solver's path

The reassembly step must be tractable. Two routes, and the design should pick
one deliberately:

- **Threshold gating.** Works only if the inter-hit gaps are genuinely quiet.
  Audacity's Truncate Silence operates on a dB threshold. Elegant when it
  applies, but forces the backing track to duck to near-silence.
- **Grid slicing.** If the hits are strictly periodic, the solver slices at
  regular intervals using the BPM. This removes the quiet-gap requirement
  entirely and lets the backing track play through. Preferred.

Periodicity is therefore a design requirement, not a convenience. Accept that a
metronomic, spectrally identical hit is a tell to a suspicious solver.

## 6. Research questions

Priority order.

1. **Snare dominance in real material (Variant B).** In grid-locked electronic
   tracks, is there a frequency band in which the snare's energy dominates the
   mix during its hit by enough margin that notching that band reads as image
   rather than mud? Measure on actual candidate material rather than reasoning
   about it.
2. **Legible window sizes.** What analysis window and scale do Audacity and
   Sonic Visualiser default to, and is the text legible at those defaults
   without the solver tuning parameters? A challenge that requires the exact
   right FFT size to see anything is unfair.
3. **Onset detection reliability.** For programmatic targeting, how accurately
   do standard onset detectors (librosa, aubio) place hit boundaries on this
   material, and is the error small relative to the column width?
4. **Perceptual cost.** How much notching can be applied before the result
   sounds obviously processed to a listener not looking for it?
5. **Resynthesis path.** Modifying magnitude while retaining the original phase,
   then inverse-STFT — how much artefacting does the phase mismatch introduce
   at these notch depths? (Griffin-Lim should not be needed; original phase is
   available.)
6. **Glyph design.** What is the minimum font that survives ~5 columns per
   character and coarse frequency binning?

## 7. Constraints and non-negotiables

- **Lossless distribution only.** Any lossy encode destroys high-frequency
  detail and with it the payload. WAV or FLAC.
- **Licensing.** Variant B distributes whatever carrier track it is built on.
  Use CC-licensed or self-produced material. Resolve before selecting a track.
- **Verifiability for the solver.** Provide a way to confirm correct
  reassembly, or accept that solvers who did it right won't know they did.

## 8. Viability criteria

Call it viable if, on a prototype:

- the text is legible at a default spectrogram view without parameter tuning
- a solver following the intended path (measure BPM, slice on grid, view
  spectrogram) reaches the URL
- a listener not looking for it does not find the audio conspicuously damaged
- the required hit count fits the intended clip length with margin

If Variant B fails criterion 1 or 3, fall back to Variant A rather than
increasing notch depth.

## 9. Materials to be supplied

- A candidate loop as WAV, with stated BPM
- The target URL
- Preferred frequency band for the text, if any

---

# Appendix: Speculative Additional Stages

These are candidates for the wider audio module, recorded at varying levels of
confidence. Only Stage A (above) has been worked through. Everything here needs
the same viability pass before committing.

## A. Rule 90 preimage search — most developed

**Shape.** Present a bitmap in which each row of pixels is the cell state of a
1D elementary cellular automaton at one time step. The solver recognises the
Sierpinski structure, identifies the rule, then realises the visible rows are
*downstream* of the key and must be walked backwards.

**Why the search is real.** Rule 90 is not reversible. Every configuration has
exactly four possible predecessors, so stepping back k generations gives a
branching tree of 4^k candidates. Only one root decodes to printable ASCII.

**Difficulty dial.**

| k  | candidates | rough cost           |
|----|-----------|----------------------|
| 10 | ~1e6      | seconds              |
| 14 | ~2.7e8    | minutes of Python    |
| 20 | ~1e12     | out of range         |

Target k = 12–14.

**Design notes.**
- Boundary conditions matter and must be chosen deliberately. With null
  boundaries reversibility does appear when the cell count is even; periodic
  boundaries are not reversible. Verify the chosen configuration behaves as
  intended before generating the artefact.
- Recognition alone must not finish the challenge. Showing rows so the rule can
  be inferred is correct — the work is the backwards walk, not the
  identification.
- Rule 90 is linear over GF(2), which is what makes the author's forward
  construction tractable. Note that the same linearity assists the solver. This
  is accepted, not a flaw to design around.

**Open questions.** Does the preimage tree prune usefully, or must the solver
enumerate blind to k=0? Meet-in-the-middle may collapse the intended difficulty;
check before fixing k.

## B. Oscilloscope XY stage — feasible, constrained

**Shape.** A stereo WAV that draws readable content when the channels drive X
and Y of a scope in XY mode.

**Established technique.** XY mode turns the scope into a vector display, beam
position driven by the two channels. Apparent solid lines are a product of
display persistence. Software emulators exist, so no hardware is required of
the solver.

**Hard constraint.** Beam brightness is fixed and cannot be modulated without a
Z-axis input. The output is therefore line art traced by a moving dot — not
filled regions.

**Consequence: no QR code.** QR requires solid filled modules. Achievable only
by raster-scanning, which is slow and visually poor. Line-drawn text or simple
geometry is the right target.

## C. Sparse Fourier series stage — plausible

**Shape.** Ship a list of partials (frequency plus amplitude envelope) rather
than audio. The solver resynthesises, and the resulting audio carries text in
its spectrogram.

**Why it works here specifically.** A general song requires as many series terms
as it has samples, making the "series" just the file in another encoding. But
spectrogram text is spectrally sparse, so a few hundred partials genuinely
reconstructs it and is genuinely compact. The compression is real rather than
nominal.

**Requirement.** Static coefficients give a static spectrum. Scrolling text
needs per-partial amplitude envelopes over time — closer to an SDIF-style
partials file than a textbook Fourier series.

## D. Huffman tree stage — plausible, small

**Shape.** Supply a Huffman tree; the solver recovers the bitstream from
elsewhere in the module and decodes it.

**Scope note.** This works for *text*, not speech. It does not rescue the
discarded idea of a compact state machine emitting spoken audio — speech is
high-entropy, and compressing it is building an audio codec, at which point the
decoder is larger than the puzzle.

**Caveat.** Publishing the tree leaks the alphabet and symbol frequencies.
Minor, but it is information the solver gets for free.

## Rejected, with reasons — do not revisit

- **State machine that accepts only one specific waveform.** The accepting path
  is readable directly off the transition table, so inspecting the machine hands
  over the input. Also brittle: raw sample values shift under any resample or
  re-encode.
- **State machine that emits spoken audio.** Requires roughly one state per
  sample. The machine is the WAV file in a worse container.
- **Guess-the-rule as a search task.** Only 256 elementary rules exist; a solver
  loops all of them in under a second. Becomes a real space only with wider
  neighbourhoods or more cell states.
- **Guess-the-seed by brute force.** A genuine 2^N space, but pure waiting
  rather than skill at every difficulty setting.
