# Surreal games — notes

Working notes from 2026-08-18, spun out of CryptoSnake. Nothing decided. Research pass running
separately on what already exists.

The idea: small games where the puzzle's answer is a combinatorial-game-theory value, with the
birthday construction and the `{L|R}` notation visible while you play, so a player watches a number
get *built* rather than being told what it is.

## Three corrections first, because they change what is buildable

**Chess positions do not have surreal values.** Combinatorial game theory applies to games under
*normal play* (whoever makes the last move wins), that are loop-free, and that decompose into
independent sums you can add together. Chess is none of those: it is won by checkmate, positions can
repeat, and the board does not split into independent pieces. So "give the player a chess game and
watch the value evolve" does not work as stated.

The honourable exception is real and worth knowing: **Noam Elkies, "On Numbers and Endgames" (1996)**
applied CGT to specific chess endgames that *do* decompose, mostly mutual-zugzwang positions where
each side's pawn moves are independent. That is a narrow, careful result about special positions, not
a value function for chess.

**Elo has nothing to do with it.** Elo is a statistical rating fitted to outcomes over many games. A
CGT value is a combinatorial property of a single position. Wiring "the value goes up or down by an
Elo rule" would be inventing a quantity and calling it mathematics.

**Finite games cannot equal φ.** This is the big one. The surreal numbers born on **finite** days are
exactly the **dyadic rationals**, m/2ⁿ. Every irrational — φ, π, e — is born on day ω, and needs an
infinite position. So no finite game has value φ.

That does not kill the idea, it sharpens it. The good version of the puzzle is:

> reach a position whose value is within 2⁻²⁰ of φ

which is well posed, finitely solvable, and teaches the actual thing: that you approach a real number
through dyadic rationals, and each extra day of birthday buys you one more bit of precision. The
constant is the target, not the value. That is a better puzzle than the one that cannot exist.

## Tic-tac-toe is also outside the theory

Same reason as chess. It is won by making three in a row, not by moving last, so it is an achievement
game. Its tree is solved by ordinary backward induction (win / draw / loss), which is Zermelo, and
predates Conway by sixty years. Useful to teach, but it is not surreals.

## What the first demo should probably be

**Blue-Red Hackenbush.** Rules fit in two sentences: a picture is drawn from coloured line segments
standing on the ground, players alternately delete an edge of their own colour, and anything no
longer connected to the ground falls off. Whoever cannot move loses.

It is the canonical demo because Conway built the theory on it, every finite position has a value
that is a dyadic rational, and the value is visibly *constructed* by the shape of the drawing. A
player can see why one stalk of blue is worth 1 and blue-then-red is worth 1/2.

Other candidates worth a look when the research lands: Domineering, Toads and Frogs, Cutcake, Col,
Snort.

## The thing the framing is missing: not every position is a number

This is the part that makes CGT interesting rather than just an arithmetic dressing on a game. Many
positions are **not numbers at all**. They have values like star (`*`), up (`↑`), down (`↓`), which
are incomparable with zero rather than greater or less than it. Impartial games (both players have
the same moves, like Nim) get **Grundy values / nimbers** instead, which are a different system again.

So "find which games compute interesting numbers" has a known partial answer: finite partizan
normal-play games give dyadic rationals *or* non-number values, and the non-number values are where
the actual structure lives. A visualisation that only ever shows decimals would hide the most
interesting half of the theory.

## The visualisation, which is the genuinely good idea here

A game graph, every node a position, with pinned overlay text that can be toggled between:

- the position's canonical `{L|R}` form
- its decimal value where it is a number
- its non-number label (`*`, `↑`, `↓`, …) where it is not
- the **birthday** it was created on

Watching the birthdays tick over while the number refines is exactly the "step by step and then as
fast as it actually goes" idea that runs through the rest of this site.

For small positions this is computable and not merely illustrative: canonical form is found by
recursively removing dominated options and bypassing reversible ones. It is mechanical. It is not
*trivial* at scale, because game trees blow up, but for demo-sized positions it is fine.

## The crypto version

Same construction as CryptoSnake, different game: the key derives from the sequence of moves that
reaches a target value, not from the value itself. The value is public, the route is the secret.

This is a better fit than Snake for one specific reason: the target can be *stated* as the puzzle
("reach 5/8", "get within 2⁻²⁰ of φ") without giving away the route, so the challenge explains itself
without a hint.

## Pandora's Box, the subgenre

CryptoSnake is the first. The pattern generalises to any deterministic game with a verifiable
transcript. Noted for later:

- **CryptoTetris** — piece sequence derived from the state chain, same as apple placement. Tetris is
  NP-hard, so the complexity story is already written.
- **CryptoPong** — the author's idea, continuous or analogue input. One hard constraint: the spec
  forbids floating point anywhere in the state path, because the chain must be bit-identical across
  machines. Continuous input therefore needs fixed-point or exact rational arithmetic, and "an angle
  in radians" is exactly the thing that will not reproduce. Solvable, but it is the whole design
  problem for that one.

## What already exists (researched 2026-08-18)

Every correction above was checked against sources and held up. Two precision notes: cite Elkies as
the 1996 *Games of No Chance* chapter, with the 1999 arXiv preprint as the readable copy; and
cgsuite's temperature support is documented in Siegel's book rather than confirmed hands-on, so check
it before relying on it.

**Prior art in Hackenbush, which is thinner than expected.**
- `fi-le.itch.io/hackenbush` — "Hackenbush: Pocket Edition". Live, open source (GPLv2, Godot), and it
  actually computes and shows the surreal value of a position while you play. The closest thing to
  the idea here, and the first thing to go and play.
- `github.com/Jutanium/hackenbush-vue` — explorable-explanation style, self-described as very much in
  progress.
- `geometer.org/hackenbush` — Tom Davis's desktop program, Intel-Mac era, probably awkward to run now.
- `hackenbush.xyz` — dead, DNS failure. Wikiversity still links to it.

**The tooling.** `cgsuite` (Aaron Siegel) is the field standard: ships Clobber, Toads and Frogs,
Kayles, Wythoff Nim, and has its own scripting language for defining new rulesets. Its companion text
is Siegel, *Combinatorial Game Theory* (AMS GSM 146), which covers canonical forms and Berlekamp's
temperature theory. No meaningful alternative in Python, Haskell, Rust or Sage.

**The gaps, which are the reason to build.**
- **No interactive birthday-construction animation exists anywhere.** Day 0, day 1, day 2, numbers
  appearing as they are born. Nobody has built it. That is the single most distinctive thing in this
  idea and it is unclaimed.
- No live widget showing `{L|R}` notation and the decimal value side by side and editable. Only
  static worked examples in course notes.
- **No digital game invents a new mechanic around CGT values.** Everything found is a Hackenbush
  port. Nobody has used the values as the substance of a puzzle.
- **No cryptographic use of surreal numbers at all.** Reported as a real absence, not a failed search.

**Recent theory.** The Aschenbrenner / van den Dries / van der Hoeven programme on transseries and
model theory is real, active and citable. No connection found between surreals and automatic
differentiation or complexity theory, reported honestly as a gap rather than stretched.

**Confirmed on the demo choice.** Hackenbush first, because the correspondence between positions and
surreal numbers there is an exact theorem rather than an analogy. **Toads and Frogs second**, because
it is where the non-number values (`*`, `↑`, `↓`) show up naturally.

## Open questions

- Which small game gives the richest set of values for the least explanation.
- Whether a "reach this value" puzzle has a unique route, or the same non-uniqueness problem as
  Snake. Probably the same, and probably solved the same way (ship the check hash, tell an honest
  winner they found a different route).
- Whether any naturally-occurring game position has a value anyone would call interesting, or whether
  interesting values have to be constructed deliberately.
