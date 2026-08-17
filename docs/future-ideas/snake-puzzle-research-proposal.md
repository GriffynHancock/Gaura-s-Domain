# Snake Puzzle Box — Implementation Spec

**Status:** draft v0.1 — for implementation by Claude Code
**Author:** Gaura
**One-line:** A game of Snake whose 12-byte payload is not stored in the binary but derived from the unique winning play, with a zero-knowledge proof so a winner can demonstrate they won without revealing the solution.

---

## 0. Reading order for the implementer

Sections 1–3 define *what is being built* and the threat model. Section 4 is the cryptographic core. Section 5 is the game rule set and must be implemented byte-exactly. Section 6 (uniqueness search) is the hardest and least certain part — build it early, because if uniqueness turns out to be infeasible at the target board size, the whole design changes. Sections 7–9 are the ZK layer, presentation layer, and attack catalogue. Section 10 is the build plan.

---

## 1. Goal and non-goals

### Goal

Produce a self-contained digital artefact — a playable Snake game — with these properties:

- **P1 (absence).** The 12-byte payload is not present in the distributed binary in any recoverable form. Static analysis, disassembly, and memory inspection before a win yield only ciphertext and a hash.
- **P2 (no patch bypass).** There is no branch to patch. The classic crack (`jz` → `jmp`, force the win flag) does not work, because the win condition does not *reveal* the payload — it *produces the key material*. Skipping to the end skips the key.
- **P3 (path integrity).** Any invalid intermediate state — an illegal move, a skipped apple, a teleport, a rewind — produces a divergent state chain and therefore a wrong key. Rule enforcement is not required for security; the transcript self-validates.
- **P4 (verifiability).** A winner can produce a succinct proof that they completed a valid game, verifiable by anyone, without revealing the winning move sequence.
- **P5 (playable).** A competent human can finish it with roughly an hour of practice.

### Non-goals

- **Not** resistance to automated solvers. A well-written search bot will beat any human. This is accepted (see §3).
- **Not** witness encryption. The ideal primitive is impractical (§11).
- **Not** DRM. This is a puzzle artefact intended to be attacked; break reports are the point.

---

## 2. What the security actually rests on

State this plainly in the README so nobody is misled.

The construction is **not** secure in the sense that "the payload cannot be extracted." It is secure in the sense that **the payload cannot be extracted by any means cheaper than computing a valid winning play.** Whether that is expensive is a separate, empirical question about the specific puzzle instance, and it has no proof behind it.

Worst-case complexity results exist and are encouraging but do **not** transfer to a specific instance:

- Collecting all food in Snake/Nibbler is NP-hard on solid grid graphs and PSPACE-complete on general grid graphs (De Biasi & Ophelders, FUN 2016).
- Hamiltonian cycle is NP-complete on general grid graphs but **solvable in polynomial time on solid grid graphs** (Umans & Lenhart, FOCS 1997). A plain rectangle is a solid grid graph.

That second result is the trap. A naive "fill the whole board" win condition on a rectangular board is a Hamiltonian path problem on the easy case, and a boustrophedon (zigzag) construction solves it in milliseconds without any search at all.

### 2.1 The Hamiltonian cycle follower — the attack that defeats everything else

The standard perfect-play Snake bot precomputes a Hamiltonian cycle over the grid and follows it forever. It never traps itself, it eats every apple that appears because it visits every cell, and it cannot lose. Critically:

- **It does not read the game state.** It needs board dimensions and a start cell. No coordinates, no memory inspection, no pixels. Any form of state obfuscation, memory encryption, or visual perturbation would be irrelevant to it — which is one reason this project ships none (§8).
- **It is indifferent to apple placement.** Hash-derived placement, adversarial placement, uniform random — all identical from its point of view. Placement alone creates **no** search hardness.

Any design that can be beaten by a blind cycle-follower is not a puzzle. Two levers defeat it:

**Lever 1 — move budget (primary).** Cycle-following has Θ(n⁴) worst-case win time. On a 10×10 board, the probability of finishing within 1,200 moves is roughly 2.6×10⁻¹⁵ (AlphaSnake, arXiv:2211.09622). Capping total moves at `B` forces genuinely efficient routing and puts the instance squarely in the NP-hard "collect all food within a budget" regime. This is the lever that survives full public understanding of the artefact.

**Lever 2 — board parity and obstacles (secondary).** A rectangular grid with an odd cell count has no Hamiltonian cycle, so the naive follower cannot run at all; the player needs a Hamiltonian path with a fixed endpoint. Adding wall obstacles moves the board off the easy solid-grid-graph case entirely.

Apple sequencing (§5.4) matters **only in combination with a budget** — under a tight budget, wandering to wherever the next apple appeared is unaffordable, so placement genuinely constrains the route.

---

## 3. Threat model

Assume **Kerckhoffs' principle**: the rules, source code, seed, and this spec are all public. Security must not depend on any of them being hidden.

### Mode A — Offline artefact (default)

Everything ships to the player. The attacker can:

- Reimplement the game headlessly and search the solution tree at full speed.
- Instrument memory, hook the renderer, run a debugger.
- Test candidate transcripts offline against the AEAD tag (an unavoidable oracle).

Accepted. The cost of winning is a tree search; a machine pays it faster than a human. No countermeasure is attempted at the client layer — an attacker reads game state from the simulator they wrote themselves and never renders a pixel, so there is nothing at that layer worth defending (§8).

### Mode B — Server-authoritative (optional)

The authoritative simulation runs server-side. The apple schedule derives from a server-held secret, and the client receives only rendered frames. An automated player must then interact through the display rather than a local reimplementation.

Costs: no longer self-contained, no longer offline, requires trusting the server, and the payload can't be sealed into the artefact — the server releases it on a valid ZK proof instead.

**Implement Mode A first.** Structure the code so the rule engine is a pure function with no I/O, making a Mode B server a thin wrapper over the same engine.

---

## 4. Cryptographic core

### 4.1 State chain

```
s₀   = H(DOMAIN ‖ VERSION ‖ seed ‖ canonical_initial_state)
sᵢ₊₁ = H(sᵢ ‖ encode_move(mᵢ) ‖ canonical_board_state(i+1))
```

- `H` = Poseidon over BN254 (see §7.1 for why not SHA-256).
- `DOMAIN` = fixed ASCII domain-separation string, e.g. `"snakebox/v1/chain"`.
- Including the full board state in each step is redundant (the state is determined by the moves) but costs nothing and causes divergent implementations to fail loudly rather than silently.

### 4.2 Key derivation

On reaching the win condition:

```
k        = HKDF-SHA256(ikm = s_final, salt = seed, info = "snakebox/v1/key", len = 32)
check    = SHA256(k)
payload  = AEAD-Decrypt(XChaCha20-Poly1305, key = k, nonce = NONCE, ct = CIPHERTEXT, aad = seed ‖ VERSION)
```

The binary ships: `seed`, `NONCE`, `CIPHERTEXT` (12 bytes + 16-byte tag), `check`, `VERSION`. Nothing else.

**Optional key stretching.** Argon2id between `s_final` and `k` adds cost per candidate-transcript verification. Be honest about the value: the attacker's inner loop is the tree search, not key derivation, so this buys very little. Include it only if it costs nothing in UX (target ~100 ms).

### 4.3 Sealing (author-side, offline)

1. Fix `seed` and `VERSION`.
2. Run the uniqueness search (§6) to confirm exactly one winning transcript exists.
3. Replay that transcript through the reference engine to obtain `s_final`.
4. Derive `k`, encrypt the 12-byte payload, emit `check`.
5. **Destroy the transcript and `k`.** They must not survive anywhere in the repo, git history, or build artefacts.

### 4.4 Trap: do not key off the final board

The final board state is *identical for every winning play* — the board is full. It carries zero entropy. The key **must** come from the full move chain, not from the terminal position. An implementer who "simplifies" this has silently reduced the puzzle to nothing.

---

## 5. Game rules (normative)

Any ambiguity here is a bug. Two independent implementations must produce bit-identical chains.

### 5.1 Board

- `W × H` grid, cells indexed row-major, `idx = y * W + x`, origin top-left.
- No wrapping. Walls are lethal.
- Target size: **5×5 (25 cells) or 7×7 (49 cells)** — odd cell counts, so no Hamiltonian cycle exists and the blind cycle-follower (§2.1) cannot run. Subject to §6 feasibility.
- Optional wall cells declared in the seed manifest. Walls are lethal and are excluded from the fill target and from free-cell enumeration. Adding walls is the §6.4 fallback for hardening an instance.

### 5.2 Initial state

- Snake occupies a single cell at a fixed index defined in the seed manifest, length 1.
- Initial direction: fixed, defined in the manifest.
- Apple 0 placed by §5.4 from `s₀`.

### 5.3 Movement

- One move per tick. Moves are `{U, R, D, L}` encoded as `{0, 1, 2, 3}` (2-bit, packed big-endian into the transcript).
- Reversing directly into the neck is **illegal**, not a no-op. It terminates the game as a loss. (No-ops would create transcript ambiguity.)
- The snake advances head-first. If the new head cell is not an apple, the tail cell is vacated in the same tick. If it is an apple, the tail is retained (growth = 1 per apple).
- Collision with a wall or with any occupied body cell (after tail vacation is applied) is a loss.

### 5.4 Apple placement — the load-bearing rule

Apples are placed **deterministically from the state chain**, onto the free cells, at the moment the previous apple is eaten:

```
free      = [cells not occupied by the snake], in ascending row-major index order
r         = H(sᵢ ‖ "apple" ‖ apple_counter)   interpreted as an integer
j         = uniform_index(r, len(free))       // rejection sampling, NOT modulo
apple     = free[j]
```

**Use rejection sampling.** Modulo introduces bias, and biased placement is both a subtle bug and a possible cryptanalytic handle. Specify the rejection loop exactly: take the low 64 bits of `r`, reject if `≥ floor(2⁶⁴ / len(free)) * len(free)`, else divide; on rejection, rehash with an incremented counter.

Because placement depends on `sᵢ`, which depends on every prior move, the apple sequence cannot be precomputed: the player's route to apple *n* determines where apple *n+1* appears.

**Do not overstate this.** Hash-derived placement by itself creates no search hardness — a blind Hamiltonian cycle follower is completely indifferent to it (§2.1). Its value is (a) making the instance well-defined and unforgeable, and (b) *in combination with the move budget of §5.5*, making the route genuinely constrained, since under a tight budget the player cannot afford to travel wherever the next apple happens to land.

### 5.5 Win condition and move budget

A **move budget** `B` is declared in the seed manifest and bound into the AEAD `aad`. Exceeding `B` moves is a loss, checked before each tick. This is the primary defence against the cycle-follower (§2.1) and is not optional.

Calibrating `B` is an empirical task for Phase 1:

- `B_cycle` — measured moves a Hamiltonian cycle/path follower needs on this instance.
- `B_opt` — the shortest winning transcript found by the solver.
- Set `B` in a band above `B_opt` but far below `B_cycle`. A tighter `B` makes the puzzle harder for both humans and machines, and also improves the odds of a uniquely-solvable instance (§6), since budget pruning is severe.

Note the coupling: `B` is what makes uniqueness plausible in the first place. Without a budget there are typically astronomically many winning transcripts.

The game is won when the snake's body occupies every non-wall cell on the board within `B` moves. Because apples are placed onto free cells, the final apple necessarily lands on the last free cell — no special-casing required. The transcript **ends at the final apple**; do not include the fatal move afterwards. This gives a canonical, unambiguous endpoint.

### 5.6 Determinism requirements

- Integer arithmetic only in the rule engine. **No floating point anywhere in the state path.** Rendering may use floats; rendering must never feed back into state.
- Fixed endianness (little-endian) for all encodings; state it explicitly in the encoder.
- No iteration over hash maps or sets. Free-cell enumeration is by ascending index, always.
- No wall-clock time, no RNG, no locale, no platform-dependent behaviour in the engine.

### 5.7 Canonical encodings

Define and freeze:

- `encode_move(m)` → 1 byte, value 0–3.
- `canonical_board_state()` → `[head_idx: u16][length: u16][body cells head→tail: u16 each][apple_idx: u16]`.
- Transcript file format: `[magic "SNKB"][version: u8][seed: 32B][move_count: u32][packed 2-bit moves]`.

Publish **test vectors**: at minimum three short scripted games (win, wall-death, self-collision) with their full expected chain values, so any reimplementation can self-check.

---

## 6. Uniqueness search (mandatory, hardest component)

### 6.1 Why

`key = KDF(transcript)`. If two distinct winning transcripts exist, they yield different keys, and only the author's decrypts. A player who legitimately wins by another route gets garbage. **The puzzle instance must have exactly one solution.**

### 6.2 The task

Given a candidate `seed`, count the winning transcripts. Accept the seed only if the count is exactly 1.

```
solve_count(seed, cap=2):
    DFS over game states from the initial state
    at each node, try moves in fixed order {U,R,D,L}
    prune: dead (wall/self), and reachability pruning (see 6.3)
    on win, increment count; abort early if count >= cap
    return count
```

### 6.3 Pruning (required — naive DFS will not terminate)

- **Flood-fill reachability.** After each move, flood-fill from the head over free cells. If the reachable region is smaller than the number of cells still needing to be filled, prune.
- **Apple reachability.** If the current apple is not in the head's reachable region, prune.
- **Articulation / parity.** On a bipartite grid, colour cells like a chessboard. A path filling the board must alternate colours; if the remaining free cells' colour counts are incompatible with the remaining path length, prune. This is cheap and cuts enormously.
- **Transposition table** keyed on `(body configuration, apple, remaining count)`. Memory-bound; use a bounded LRU.

### 6.4 Feasibility is an open question — measure it

Nobody knows in advance whether uniquely-solvable seeds are common at 6×6, or whether the search is tractable. **Instrument this first.** Deliverable: a report giving, for board sizes 4×4, 5×5, 6×6:

- distribution of solution counts over ~10⁴ random seeds
- median and p99 wall-clock time for `solve_count(cap=2)`
- fraction of seeds with exactly one solution

If unique seeds are vanishingly rare at the target size, fall back options in priority order:

1. Shrink the board.
2. Add fixed wall obstacles to the board (this also moves you off the easy solid-grid-graph case).
3. Relax to *k*-solution instances and use Shamir secret sharing across the *k* keys — fiddly, adds a leak surface, last resort.
4. Move to Mode B, where the server releases the payload on a valid ZK proof and uniqueness is unnecessary.

### 6.5 Difficulty calibration

A uniquely-solvable instance may be either trivial or impossible for a human. Measure both ends:

- **Machine cost:** node count and wall-clock for a good solver to find the solution from scratch.
- **Human cost:** playtest. Target ≈1 hour of practice to completion (P5).

Search the seed space for instances in the desired band on both axes. Report both numbers in the README — the machine cost is the honest statement of how much work the artefact demands.

---

## 7. Zero-knowledge verification layer

### 7.1 Why Poseidon, not SHA-256

The circuit must recompute the state chain — one hash per move, potentially several hundred moves. SHA-256 costs roughly 25k R1CS constraints per invocation; several hundred of those is a circuit nobody can prove on a laptop. Poseidon is designed for arithmetic circuits and costs a few hundred constraints per permutation.

So: **Poseidon for the per-step chain, SHA-256 exactly once** at the end for `check = SHA256(k)`. One in-circuit SHA-256 is acceptable.

### 7.2 Statement

```
Public inputs:  seed, VERSION, check, W, H, initial_state
Private witness: moves[]

Circuit asserts:
  1. Replaying moves[] from initial_state under the §5 rules produces no illegal move
  2. The terminal board is full (win condition met)
  3. The Poseidon chain over that replay yields s_final
  4. SHA256(HKDF(s_final, ...)) == check
```

A valid proof demonstrates the prover knows a winning transcript, without revealing it. Since the solution is unique, this is exactly "I solved it" — and crucially, publishing the proof does **not** let others derive the key.

### 7.3 Toolchain

Circom + snarkjs (Groth16) or Noir + Barretenberg. Noir is likely the better fit — higher-level, and the game rules are awkward to express in raw Circom. Either way:

- In-circuit board representation: a bit array of `W*H` occupancy plus an ordered body list. Each step's update touches every cell; budget `O(moves × W × H)` constraints for the rules alone.
- Groth16 requires a trusted setup per circuit. For an artefact this is acceptable — document the ceremony (or the fact that you ran it alone, which is honest and fine here since a compromised setup only lets someone forge a *proof*, not recover the key).
- Verifier: a small standalone binary plus an optional web verifier page.

### 7.4 Ordering note

The ZK layer is independent of the sealing construction and can be built after the game works. Do not block on it.

---

## 8. Presentation layer

**No obfuscation of any kind.** The renderer draws a plain grid, plain cells, plain snake. Board state is stored as ordinary integers. No visual perturbation, no memory encryption, no WASM hardening, no hidden rule manifest.

This is a deliberate choice, not an omission. Three reasons:

1. **It wouldn't work.** The strongest off-the-shelf solver reads nothing at all (§2.1). Obfuscation is invisible to it.
2. **It contradicts the project's own posture.** The spec, rules, seed, and source are published and attacks are invited (§9). Kerckhoffs' principle applies: a design that needs any of that hidden is not a design.
3. **It buys time, not difficulty.** The first person to reimplement the rules publishes a headless simulator and the effort floor drops to zero permanently.

All difficulty lives in the move budget (§5.5) and the board instance (§5.1). Those survive full public understanding of the artefact. Nothing else does.

### 8.1 Requirements

- Plain 2D canvas render: grid lines, filled cells, distinct apple colour, visible move counter and remaining budget.
- Keyboard input, one move per tick, with a queued-input buffer so fast play isn't dropped.
- **Constraint:** the renderer reads state and never writes it (§5.6). Rendering may use floats; the rule engine may not.
- Legible defaults: high contrast, no animation that obscures cell boundaries, no timing pressure beyond the move budget.

## 9. Attack catalogue

Ship this as `ATTACKS.md`. Invite reports; require that a report include a proposed repair.

### Expected to work (by design, not bugs)

- **Headless tree search.** The intended cost. Report node counts.
- **Offline candidate testing** against the AEAD tag. Unavoidable; harmless given a large solution space.
- **Reimplementing the rules headlessly.** Expected and uninteresting; the rules are published.

### Real vulnerabilities to guard against

| # | Attack | Mitigation |
|---|---|---|
| A1 | Key derived from terminal board (zero entropy) | §4.4; test vector asserting two different valid-prefix games diverge |
| A2 | Plaintext or key present in the shipped binary | Build-time check: grep the artefact for the payload and for `k`; fail the build on a hit |
| A3 | Modulo bias in apple placement | §5.4 rejection sampling; statistical test over 10⁶ placements |
| A4 | Float or hash-map iteration in the state path causing cross-platform divergence | §5.6; CI runs test vectors on Linux/macOS/Windows and x86/ARM |
| A5 | Transcript ambiguity (no-op moves, trailing moves after win) | §5.3 and §5.5 make both illegal/excluded |
| A6 | Multiple winning transcripts (silently breaks the artefact for legitimate winners) | §6 uniqueness proof, re-verified in CI against the shipped seed |
| A7 | Key or transcript leaked in git history or build logs | Pre-commit hook; audit history before publishing |
| A8 | Timing side channel on `check` comparison | Constant-time compare (cosmetic here, but free) |
| A9 | Partial-progress leak (UI reveals payload bytes as you go) | Never derive or display anything key-derived before the win condition |
| A10 | Seed manifest tampering shifting the puzzle to an easier instance | Bind seed and version into the AEAD `aad` (§4.2) — tampering yields decryption failure |
| A11 | **Blind Hamiltonian cycle follower wins without reading state** | Move budget §5.5 (primary) + odd cell count §5.1 (secondary). **CI must assert that a cycle/path follower fails on the shipped instance.** This is the single most important regression test in the project. |
| A12 | Budget not enforced, or enforced only in the renderer | Budget check lives in the pure rule engine, bound into `aad`, and is asserted by test vector |

---

## 10. Build plan

| Phase | Deliverable | Blocking? |
|---|---|---|
| 0 | Rule engine as a pure function, Rust core. Test vectors for win/loss/illegal cases. | yes |
| 1 | Solver with §6.3 pruning. Cycle/path-follower baseline to measure `B_cycle`. Feasibility report on solution-count distributions **under a budget**. | **yes — go/no-go gate** |
| 2 | Uniqueness search; select a seed meeting both machine-cost and human-difficulty targets | yes |
| 3 | Sealing tool (author-side, offline). Build-time leak checks (A2, A7). | yes |
| 4 | Playable client — plain canvas renderer, keyboard input, budget display | yes |
| 5 | ZK circuit, prover, verifier, web verifier page | no |
| 6 | `ATTACKS.md`, README with honest security statement, published test vectors | yes |

**Phase 1 is the gate.** If uniquely-solvable instances turn out to be infeasible to find or verify at any playable board size, stop and revisit §6.4 before building anything else.

Suggested stack: Rust for engine + solver + sealer (determinism, speed); Rust→WASM for the client; Noir for the circuit; TypeScript for the shell. WASM here is for determinism and speed, not obscurity.

---

## 11. Research references

**Complexity of the game**

- De Biasi & Ophelders, *The Complexity of Snake*, FUN 2016 (LIPIcs vol. 49, art. 11) — NP-hardness of collecting all food on solid grid graphs; PSPACE-completeness on general grid graphs; PSPACE-completeness of configuration-to-configuration reachability. Journal version: *The complexity of snake and undirected NCL variants*, TCS 2017. https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.FUN.2016.11
- *AlphaSnake: Policy Iteration on a Nondeterministic NP-hard Markov Decision Process*, arXiv:2211.09622 — gives the win-time distribution and Θ(n⁴) worst case for the Hamiltonian cycle strategy, and the 10×10 / 1,200-step figure. **This is the quantitative basis for choosing `B` in §5.5.** https://arxiv.org/pdf/2211.09622
- *Playing Snake on a Graph*, arXiv:2506.21281 (2025) — two-player framing with an adversarial apple placer; NP-hardness on grid graphs. Relevant if you ever move apple placement adversarial rather than hash-derived.

**Why the board shape matters**

- Itai, Papadimitriou & Szwarcfiter (1982) — Hamiltonian path/cycle NP-complete on general grid graphs.
- Umans & Lenhart, *Hamiltonian cycles in solid grid graphs*, FOCS 1997 — polynomial-time on hole-free grid graphs. **Read this one; it is the reason a plain rectangle is a weak instance.** https://ieeexplore.ieee.org/document/646138/
- *Hamiltonicity is Hard in Thin or Polygonal Grid Graphs, but Easy in Thin Polygonal Grid Graphs*, arXiv:1706.10046 — a map of which grid restrictions are hard. Useful when choosing obstacle layouts for §6.4 fallback 2.

**The ideal primitive (context, not implementation)**

- Garg, Gentry, Sahai & Waters, *Witness Encryption and its Applications*, STOC 2013 — introduces encrypting to an NP statement such that any witness-holder can decrypt. https://eprint.iacr.org/2013/258.pdf
- Current status: practical constructions from established assumptions remain out of reach; a 2026 implementable general-NP instantiation estimates ciphertext sizes around 338 TB at 100-bit security. https://eprint.iacr.org/2026/175.pdf

---

## 12. Open questions for the author

1. Board size target — hold at 6×6, or let Phase 1 findings decide?
2. Mode B (server-authoritative) — build it, or ship Mode A only and be upfront that bots win?
3. Obstacles — allowed in the board layout? They strengthen the instance (§6.4) at some cost to visual simplicity.
4. What is the 12-byte payload, and does it need to mean anything, or is it a token?
5. Publish the seed-selection process, or keep the uniqueness proof private? (Publishing is more honest and doesn't weaken anything.)
