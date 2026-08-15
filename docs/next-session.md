# Next session

Agreed at the end of 2026-08-15. The session is **speccing first, then probably building the
leaderboard**.

## Spec, don't build (yet)

**Hashing challenges: rainbow tables and salting.** Module 104 has no scored challenges at all, it is
a visualisation. These are the first two. Rainbow tables pair naturally with the module's existing
"MD5 is broken" material, and salting is the answer to the challenge the rainbow table poses, so the
two want to be designed together as a pair rather than separately.

**The lens.** The tool you get for finishing FNAC, used in later challenges. Design was parked
mid-brainstorm with only Section 1 approved: resume from
`docs/superpowers/specs/2026-08-12-fnac-lens-tool-design.md`, which records what is decided and what
is not. Do not restart it from scratch. The author's own framing, from the transcript: "so you are
sort of using it as a lens. maybe that wont work for other problems, so maybe it can be minimised?"

**The leaderboard.** See below, it is the big one.

## The leaderboard

Shape, from the author: **probably just a completion board**, not scores. He is comfortable with
puzzles that people genuinely struggle to solve. In his words, the hard part of this project is the
opposite: "educating and making these super simple ones are the hardest".

Decided so far:
- **Passkeys, not username and password.** "probably just a passkey, its just for a leaderboard.
  web3 style." So: no email, no password reset, no PII. A key the student holds.
- **A user panel** will be needed.
- **A profanity filter that can be turned off.** His reasoning, verbatim: "highscoolers will break
  anything you let them man its going to be so hard to not have them submit really rude names, i
  think we will just have to censor peoples names and have a bad language filter you can turn off."
  Note the filter is a display-time toggle, so the stored name and the shown name differ.

Open, and worth settling in the spec:
- **The real blocker is not storage.** Every flag is validated client-side and readable in page
  source, so a completion board on today's build is claimable by view-source. Moving flag checks to
  the Worker (holding SHA-256 of each flag, never the flag) is the prerequisite. Caesar complicates
  it: its keys are already per-user derived from `ctf-uid`.
- Storage itself is easy: D1, one table, `PRIMARY KEY (user, challenge)` so a completion cannot be
  claimed twice, plus a Cloudflare rate-limit rule on the submit route.
- **The team-name field is the injection surface**, not the flag. Validate server-side, render with
  `textContent`.
- **A design tension to resolve deliberately.** The confetti engine fires only on *module*
  completion, on purpose, to push students into tutoring each other. A leaderboard rewards speed and
  hoarding. Decide which behaviour wins before building.

## Already dispatched at end of session
- README rewrite (it contained challenge answers, on a public repo).
- Encoding search-space info panel: landed.
- FNAC physics unlock reveal: was still failing its own physics assertions when the session ended.
  Check `tools/verify_fnac_module.mjs` before assuming it works, and **do not deploy FNAC until it
  passes** (`wrangler deploy` ships the working tree, not HEAD).

## Standing, not scheduled
The **Snake cryptographic state machine** is written up in `docs/ideas-backlog.md` under "Trollface
folder → QR polyglot → Snake puzzle box", including its two real open questions: whether a max-size
QR can carry a runnable Snake at all, and whether the win key can be made unforgeable rather than an
`if (won) print(flag)`. The author wants to build it one day.

Also outstanding from this session: cutting the generated filler prose page by page (see
`docs/prose-accounting.md`), C3's hint still giving away its crib phrase, and `worst-case/` being
both incomplete and now wrong for XOR.
