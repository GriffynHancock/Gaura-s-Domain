# Crypto games

A genre note. Written 2026-08-18 by Gaura, transcribed and tidied.

## What a crypto game is

A small game where the prize is not stored in the file. The winning play *computes* the key, so
there is no check to patch and no string to find. You cannot skip to the end, because the end is
made out of the middle.

CryptoSnake is the first one. The pattern generalises to any deterministic game with a verifiable
transcript, which is why it is a genre and not a one-off.

## Why this and not the other thing

The interesting limits here are conceptual. Squeezing Doom onto a pregnancy test is sick, but the
constraint is hardware. Crypto games ride the laws of computation and information instead: what can
be known, what can be proven, what costs too much to search.

That is the material. Not pixels, not frame budget. Search space, proof, and the gap between what is
hard in theory and what is hard in your specific instance.

## The design rules

- **Runs on local hardware.** No server required to play. The artefact is the game.
- **Not naively bypassable.** No flag in the strings, no branch to flip, no "if won" to patch.
- **Playable frame rate.** It is a game. If it does not run smoothly it is a demo of an idea, not a
  game about one.
- **Simple, clean, and not buggy.** People are going to attack it. A messy implementation gives them
  bugs to find instead of mathematics, which wastes everyone's time and teaches nothing.

That last rule is the important one. The whole point is to be experimented on. A beautiful system
invites real attacks; a sloppy one just invites bug reports.

## Two skill ceilings, which is the good part

**The human ceiling** behaves like speedrunning. People will decide that anything past 4x4 Snake is
intractable by hand, and then somebody will do it anyway. Then someone learns their method, and
extends it. It progresses in exactly the way a speedrun category progresses: a route gets found,
gets refined, gets broken open by a new idea.

**The machine ceiling** is separate and scales. Once the obvious brute-force flags are gone, the
remaining boards are an optimisation problem. Somebody might prove a whole subtree cannot contain
the answer, and prune it out. That is a genuinely different sport, and it is the same one that
Minecraft seed finding turned into: people competing through algorithms rather than through play.

Having both means a puzzle does not die when the first person solves it. The small ones fall to
humans, the large ones fall to machines, and some may stay shut for years. That is a feature.

## The educational bit, which is the actual reason

You are playing Snake. You are being taught witness encryption.

A player does not need the vocabulary to feel the shape of it. They can see that forcing a win gives
them nothing, and that is the whole idea of a lock made of work rather than of secrecy. The words can
come later, or never, and the intuition still landed.

That is the surreal part of it: these are toys that carry mathematics most people never get near,
and a toy is allowed to be played with before it is understood. The hope is that some people go and
look up what they were actually holding.

## Mathematical structures as the roadmap

Each structure is a different game.

- **Search hardness** — CryptoSnake. The key is the transcript. Sits on the worst-case versus
  average-case gap that stops anyone building real cryptography on NP-hardness.
- **Combinatorial game theory / surreal numbers** — see `surreal-games.md`. The value of a position
  as the target, the route to it as the secret. Nobody has built the birthday animation, and nobody
  has used surreal numbers cryptographically at all.
- **Tetris** — piece sequence from the state chain, same construction as Snake's apples. Tetris is
  NP-hard, so the complexity story is already written.
- **Pong** — continuous or analogue input. The hard constraint is that the state chain must be
  bit-identical across machines, so no floating point anywhere in the state path. Fixed point or
  exact rationals. That constraint is the design problem for this one, not a detail.

## Open

- Naming. The genre is crypto games. Pandora's Box is the vessel: a published set of boxes with
  different flags, some of which nobody opens for a long time.
- Whether a two-player crypto game works. Combinatorial game theory needs two players, and every
  game listed above is solitaire. A two-player crypto game would be a genuinely new object, and it is
  where surreal numbers would properly apply rather than being decoration.
