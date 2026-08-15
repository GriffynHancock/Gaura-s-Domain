# Who wrote what

Every string a student can see, sorted by author. Built by rendering all six pages and dumping
the visible text, then checking each string against `docs/authors-original-copy.md`.

Griffyn's words are marked HIS. Anything marked MINE was written by an assistant and is fair game
for a rewrite. MIXED means his idea, my phrasing.

Em dash counts are of the page source, so they include code comments as well as copy. The hash
page's 621 is almost entirely comments, which don't ship to the reader but do set the tone for
whoever edits next.

| page | em dashes in source |
|---|---|
| index | 7 |
| ceasar | 90 |
| encoding | 26 |
| hash | 621 |
| xor | 57 |
| fnac | 35 |

## The worst one first

FNAC night 3, `tools/build_fnac_assets.py:45`. This is the plaintext the student recovers after
breaking the XOR, so it's their whole reward for the hardest challenge on the site.

MINE:
> flag{stop_scrolling}  It comes down the hall at 3am with a bat.  It always counts to three.
> Put your phone down.  It does not hide its name. It shouts it, over and over.

It's riddling at the key (comes with a bat, counts to three, shouts its name) and it reads like
creepypasta. Note the constraint before rewriting: sentence spacing is load bearing. Every
character sits at a fixed phase of the 20 byte key and some (character, phase) pairs XOR to CR/LF
or to a byte over 0x80. The double spaces dodge those. Changing words means re-running the
builder's asserts.

## /crypto/ (directory)

HIS: the subtitle, the footer credit.

MINE: all five card blurbs.
> Shift dial, Vigenère two-tone, Affine multiply & slide — 6 puzzles.
> Decode-pipeline builder — base64, hex, URL, ROT13, Atbash — 9 puzzles.
> Mixing messages with a key — brute force, cribbing, and what breaks when one key gets used twice.
> Same-sized chaos from any input — watch MD5 and SHA-3 grind your text into a fingerprint.
> Haunted-house bonus track — file forensics on a commandline.

Five blurbs, six em dashes, and the first two are lists of internal feature names rather than a
reason to click.

## /crypto/ceasar/

HIS: the header subtitle, the "In this case, the information being hidden" info block, the
highlighted call to action.

MINE: everything around the affine number line.
> The signals below use a few different tricks — some are a straight rotation (one shift key), one
> alternates between two shift keys, and the last one multiplies before it shifts.
> When every input maps to its own distinct output — no collisions, every socket on the output line
> filled — the map is called injective (a one-to-one map). An injective map is exactly the property
> encryption needs: it is the reason a unique decryption exists at all.
> The whole time, we have actually been doing modular arithmetic, because you can picture the input
> number as a hand on a clock face...
> Some flags are reward codes too. Key one in to unlock the reward — it stays unlocked on this device.

The injective paragraph is the single densest bit of me on the site. "is exactly the property
encryption needs: it is the reason a unique decryption exists at all" is a sentence no 15 year old
asked for.

## /crypto/encoding/

HIS: the subtitle, and the bones of the info block (base64, hex, URL, what each looks like).

MINE, added on top of his:
> — and it's often (not always) padded with one or two = signs on the end
> That padding is usually the fastest tell you've got.

## /crypto/hash/

HIS: the subtitle (dictated today).

MINE: every caption on the page.
> state carries forward, card to card — this hand-off in the clear is what a length-extension attack exploits
> at speed the motion aliases like a filmed wheel — it can look frozen or backwards. SHA-3 never runs backwards.
> per 1088-bit block. (Not a fair race between the two — see below.)
> Hash something to see how far the animation above is stretching that out.
> SHA-3's 64-bit maths is slow in JavaScript, MD5's 32-bit maths isn't. Both are far faster in native code.

That last one is the "it's not this, it's that" shape twice in one sentence.

## /crypto/xor/

HIS: the page subtitle, the info block, the demo gate line, C2's opening paragraph, C3's subtitle,
C4's subtitle and C4's hint. Most of the reading on this page is his.

MINE:
> The gate — one bit ⊕ one bit
> The scrambled message — byte on top, text below
> Three knobs — one byte each
> locks every 3rd character, starting at character 1
> Crib-drag — slide a guess; where it reads English, you've cracked the OTHER message there
> halves are the same key in both, so they cancel each other out — what survives is message 1 ⊕ message 2
> A 1-byte key has 256 options — tools like CyberChef spray all 256 in a blink. But this key is 3
> bytes, and its "XOR Brute Force" won't search keys longer than a byte or two. Multi-byte repeating
> keys dodge the brute — so you lean on a scrap of the original message you already know instead.
> few enough to just try every one. Running them all is the kind of thing you'd whip up in a quick
> script. Nobody hands you the answer; you spot it.
> In 1977 Australia voted on a national song. Advance Australia Fair won with 43% and was proclaimed
> the national anthem in 1984; the runner-up, on 28%, was Waltzing Matilda. Message 2 is that
> runner-up's name — sung twice over. Type it into the crib and slide it along until message 1 reads back.

The C3 hint is the one you quoted. Beyond the voice, it prints the answer.

MIXED, where I changed his wording while transcribing it:
- He dictated "Play with this to get an intuition for". Shipped as "Play with it to get a feel for".
  "intuition" is his word for the goal and I swapped it for a softer one.
- He dictated "apply a key - type a character to try". Shipped with an em dash and a longer tail.

## /crypto/fnac/

HIS: all four visible lines. "the bite of 87", "sometimes you need to concatenate evidence.",
"Whoops i undid it like a zipper at the atomic level...", the Tung Tung night 3 subtitle.

MINE: the night 3 plaintext above, and the locked screen wording.

## Summary

The pattern is consistent. His writing is the subtitles, the info blocks and the challenge
openings, which is the material a student reads to understand. Mine is the labels, captions,
hints, closing notes and card blurbs, which is the material that sits between his and pads it out.
That is exactly the filler he objected to, and most of it can go rather than be rewritten.
