# Future ideas

Gaura's notes on things that might get built. These are working notes, not commitments and not
finished designs. They are here so anyone reading the repo can see where it might go.

Nothing in this folder is wired into the site. For what is actually being worked on next, see
`docs/next-session.md`; for things parked in one-paragraph form, see `docs/ideas-backlog.md`.

- **[Crypto games](crypto-games.md)** — the genre note. What a crypto game is, the design rules,
  the two skill ceilings (humans like speedrunners, machines like Minecraft seed finders), and the
  mathematical structures each future game would be built on. Start here for the direction.

- **Snake Puzzle Box** — a game of Snake whose payload is derived from the winning play rather than
  stored in the binary, with a zero-knowledge proof so a winner can show they won without giving
  away the solution.
  - **[The short version](snake-puzzle-box-sketch.md)** — one page, start here.
  - **[Full research proposal](snake-puzzle-research-proposal.md)** — draft v0.1, 386 lines. The
    uniqueness search in section 6 decides whether the whole design is possible.

- **[Surreal games](surreal-games.md)** — small games where the puzzle's answer is a
  combinatorial-game-theory value, with the birthday construction visible while you play. Notes
  only. Contains the corrections that decide what is actually buildable (finite games can only be
  dyadic rationals, so no position ever equals φ).

A shorter, earlier sketch of the same idea (trollface folder → QR polyglot → Snake) is in
`docs/ideas-backlog.md`.
