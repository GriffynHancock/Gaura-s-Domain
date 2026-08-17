# Snake Puzzle Box — the short version

One-page sketch of `snake-puzzle-research-proposal.md` (386 lines). Read this first to decide
whether the long one is worth your time.

## The idea

A playable Snake game where the prize is not in the file. Every move is folded into a running hash,
so move 200 depends on move 199 depends on move 1. Finish the board and that chain has landed on one
value, and that value is the decryption key.

So there is no `if (won)` to patch. Forcing a win skips the moves, and the moves are the key. One
illegal step forks the chain and you are no longer opening this box, whatever you do next.

## What it teaches

That a lock can be made of work rather than of secrecy. Nearly every CTF puzzle hides a value and
dares you to find it. This one has no value to hide. That is a genuinely different idea from
anything else on the site.

## The bot that beats every Snake puzzle

Precompute a loop that visits every square and follow it forever. It never traps itself, never
loses, and never looks at the screen, so hiding the apples does nothing to it. Two defences work:

- **Odd number of squares.** No full loop exists, so the bot cannot run at all.
- **A move budget.** The loop-follower is thorough, not efficient. Cap the moves below what it needs
  and it runs out.

Both survive the source code being public, which is the bar.

## Where it would live

A file in a secret area rather than a module on the map. End of the forensics track, the thing the
lens eventually points at. It gates nothing, so a beginner can finish the site without meeting it.

The zero-knowledge layer earns its place here: a winner can prove they won without publishing the
route, so the first solve does not end the puzzle for everyone else.

## The thing to resolve before building

The design needs **exactly one** winning route, or a legitimate winner derives a different key and
gets garbage. But one route means reproducing a specific several-hundred-move sequence with no
mistakes, because any slip forks the chain. That is memorisation under threat of total restart, not
the "hour of practice" the spec targets. Uniqueness and playability pull against each other.

And nobody knows yet whether uniquely-solvable boards even exist at a size a person can play.
Measure that first (§6.4 of the long doc). If they are vanishingly rare, the fallback is to let a
server hold the payload and release it on a valid proof: uniqueness stops mattering and any real win
opens the box, at the cost of it no longer being a self-contained file you can hide somewhere.

## How big is the search space (measured)

Counted directly. Hamiltonian paths from a fixed corner, which is an upper bound on winning plays
before apples and the budget prune it:

| board | cells | winning fills | vs previous board |
|---|---|---|---|
| 3×3 | 9 | 8 | 4× |
| 4×4 | 16 | 52 | 6.5× |
| 5×5 | 25 | 824 | 15.8× |
| 6×6 | 36 | 22,144 | 26.9× |

It is **exponential in the area**, about `1.34^(cells)`, not `n^n` and not double-exponential. It
feels faster than exponential because adding a row and a column adds `2N+1` cells, so the multiplier
itself grows: 5→6 is 21×, 11→12 is 597×.

The number that matters is the gap between answers and search. At 10×10 there are ~10¹² winning
fills sitting inside a naive move tree of ~10¹⁰⁵. That gap is why §6.3's pruning is mandatory.

## Publish a set of them, not one (author's call, 2026-08-17)

This is what makes the design work, and it dissolves the tension above rather than solving it.

Ship a **range of board sizes, each with its own flag**. Small boards are a human race: few enough
fills that a person can find the route, and first-solve bragging rights. Large boards are a machine
race: humans competing to *write the solver*, not to play. Some boxes may stay unopened for years.
That is a feature, not a failure.

The three targets stop fighting because each tier only has to satisfy one of them:

- small board → uniqueness is achievable, humans can play it
- large board → real machine cost, and nobody expects to play it by hand
- unopened board → the honest statement that this is hard

**The refinement that makes the big boards work:** uniqueness is only needed for the human tier. The
artefact already ships `check = SHA256(k)`, so on a large board a solver can enumerate winning plays
and test each against `check`. The puzzle becomes "find the sealed play", and the work is
enumerate-and-test rather than find-the-only-route. No uniqueness search required at that size,
which is the component §6 admits may be infeasible anyway.

**The caveat that follows:** on a non-unique board a legitimate winner can complete the game and
still get garbage, because they found a different valid route. The game must tell them so, in
those words: valid win, not the sealed play. It costs nothing to check (`SHA256(k) == check`) and it
leaks nothing the AEAD tag doesn't already leak. Without it the box just looks broken to the person
who did the hardest part.

## What has to be taught before any of this

The author's point, and it is the real reason to build it: a claimed flag and a claimed final hash
can both simply be made up. Understanding *what would make a win checkable* is the lesson, and it
lands before a single line of Snake is written. Commitments, what a proof is for, why "I solved it,
here is the hash" proves nothing on its own, and what a zero-knowledge proof buys that a screenshot
does not.

So the teaching order is: proof first, Snake second.

## Worth noting

The reusable part is not Snake. It is "the key is the transcript", which works for any deterministic
game with a verifiable play. That is what could house a family of puzzles rather than one.
