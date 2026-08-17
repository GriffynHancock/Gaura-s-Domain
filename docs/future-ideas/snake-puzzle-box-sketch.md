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

## Worth noting

The reusable part is not Snake. It is "the key is the transcript", which works for any deterministic
game with a verifiable play. That is what could house a family of puzzles rather than one.
