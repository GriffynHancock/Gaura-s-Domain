# How to write copy for this site

This is Griffyn's voice, worked out from everything he dictated and typed across the build.
The raw evidence is `docs/authors-original-copy.md` (his dictated copy, verbatim) and the
exemplar set it was drawn from. If this guide and his actual words ever disagree, his words win.

This document is written in the voice it describes, so it doesn't teach one thing and demonstrate
another.

## The short version

Casual and direct, a bit intimate. Peer to peer, not teacher to class. You explain the thing,
and then you stop. The reader is a 15 to 20 year old who might be smarter than the material, and
who will go and try to hack the site if you bore them.

No swearing on the website. He swears constantly in chat, none of it ships.

## Hard rules

These come from counting his writing against the AI drafts he rejected.

**No em dashes.** He uses zero. The drafts used about 20 for every 1000 words. Where he wants a
dash he types a plain hyphen doing the job of a colon, like `apply a key - type a character to try`.
If a sentence needs an em dash it needs a comma or a full stop instead.

**No bold.** He never once asked for it. The drafts bolded about 28 times per 1000 words. When he
wants a phrase to land he puts it in quote marks:

> the rule is "If two bits are the same, output 0, if different, output 1"
> "in theory" any two inputs should make totally different outputs
> combine binary strings using simple logic to "mix" them

His other emphasis is colour and strikethrough, and he asks for those by name when he wants them
("encoding should be in red and encryption should be strikethrough").

**No "it's not this, it's that".** He does negate, freely, but only to correct something the
student actually believes, and he never hangs a tidy counterweight off it:

> It's about changing the form of the information not about actually making it secret

That is a correction. The seesaw shape, where you deny one thing so you can announce another, is
the thing he hates.

**Don't narrate the reader's hands.** "Type it into the crib and slide it along until message 1
reads back" was the line he quoted back in disgust. His own imperatives are fine because they
invite play and name a goal, and they never walk through a sequence of mechanical steps:

> Play with this to get an intuition for encrypting and decrypting xor strings
> tap the bits below and see how they combine in a xor operation
> Try a few keys yourself, then when you get bored click the button below

The test: are you inviting them to mess with something, or reading them an instruction manual?

**Say it once.** He wants repetition caught. "it should catch where i explain something twice or
am rambling a bit." If the intro, the hint and the closing note all explain the same idea, two of
them go.

**Never give away the answer.** He killed a hint that named the crib phrase, and he pads blobs with
junk so you can't scroll to the bottom and guess the encoding. If a line makes the puzzle solvable
without the insight, it's wrong even if it reads nicely.

## How the sentences go

His copy sentences are short, about 9 or 10 words on average, and they run together with commas
where a more formal writer would start a new sentence. Keep the comma splices, they're his.

He builds a thought by adding clauses, then lands it on plain speech:

> instead of ones, tens, hundreds, and thousands, it has 2^0 (1), 2^1 (2), 2^2 (4), 2^3 (8), etc.
> So, while 6 is just 6 in our base10 counting system, in binary 6 can be written as 0110, which
> means "no 8, yes 4, yes 2, no 1"

That last quoted gloss is the whole teaching move. Say the formal version, then say it the way a
person would say it out loud.

"So" is his pivot into a worked example, and he does the example himself in first person:

> So if i encrypt two messages with a single key, combining those encrypted messages will destroy
> the key because they match

Brackets carry hedges, asides and technical caveats. He uses a lot of them, more than the AI drafts
did. `(usually)`, `(in complexity and content, not aesthetic)`, `(this many)`.

Lists run inline and trail off. "etc.", "or something", "and such".

No "however", "therefore", "in other words", "that said", "worth noting", "as you can see". None of
these appear anywhere in his writing.

## Where the warmth goes

Warmth appears exactly where a student might quit, and nowhere else:

> yes this is hard. you will need to derive the key from the hint, or you wont get it.
> then when you get bored click the button below
> Play with this to get an intuition for

He never reassures. No "don't worry", no "easier than it looks". He names the difficulty and leaves
it sitting there. Everywhere else he is flat and factual.

## Terms

Gloss a term the moment you use it, in the same sentence, with "which means":

> a technique called 'Cribbing', which means guessing what the secret message might contain to
> help crack it

Then never define it again.

Plain words beat jargon. "a little string repeatedly across a big string" rather than "key length".
"mix" and "unmix" rather than encrypt and decrypt when talking about XOR. For the XOR module the
locked vocabulary is encrypted, decrypted, lock, unlock, scrambled message. Never cipher,
plaintext, recovered.

Words he uses: juice (animation feel), slop (filler), sick, cool, beautiful, satisfying, whip up,
cheeky, whacky, bloat, visual noise, intuition, really get, brainrot.

Australian spelling. Colour, recognise, visualisation, analogue.

## Capitals and lowercase

In explanatory copy, normal sentence capitals. The 62% lowercase figure in his writing comes from
how he types in chat, not from how he writes copy, and copying it into published prose would be
imitating his keyboard rather than his voice.

Deliberate lowercase belongs in titles and flavour text, where he clearly wants it:

> this xor that
> sometimes you need to concatenate evidence.
> Whoops i undid it like a zipper at the atomic level...

Capitals for effect only, and rarely. "OR, do I have space in my heart for other brainrot?" carries
the XOR pun. "I toss and turn in my Crib" carries the whole hint.

Fix real transcription errors (a missing apostrophe, "eat standard" for "each standard"). Don't fix
his phrasing while you're in there.

## Jokes

Jokes go in titles, subtitles and flavour text. Explanatory blocks stay straight.

FNAC is where the humour goes all the way up, and FNAC is the optional bonus. References are
specific and unexplained, and he expects the room to get them: the bite of 87, Tung Tung Sahur,
Balatro, waltzing matilda.

He shows up in the copy in first person and doesn't apologise for it. "These are my micro-ctf's".
"Whoops i undid it". The site has an author and the author is a bit of a goof.

## What gets cut

He deletes constantly, and the pattern is consistent. Cut anything that is:

- a hint box (four separate removals)
- a cute editorial summary, "The mistake:", "The punchline:", "One blob, two pictures"
- a restatement of something already on screen, "the key you have assembled", "256 is a lot",
  "where the key bit is 1 it flips"
- a status badge or label that isn't load bearing, "play, not scored", "live", "in progress"

Cutting doesn't mean the reader loses the help. Twice he moved the cut material somewhere better
instead: "Some of what i said before actually should be in the demo text." The objection is
placement and redundancy, not that help exists.

## Two passes, not one

He asked for style and truth to be checked separately. "and it should ask 'is this true?'"

So after the voice pass, do a fact pass. Does the copy say something the code doesn't do. Does a
number check out. Does an intro claim something is on screen when it isn't.

## Marking who wrote what

Nothing currently distinguishes his copy from generated connective text, which is why a bad batch
went out unnoticed. From now on, blocks of page copy carry a comment:

    <!-- copy: author -->     his words, dictated or written. Don't rewrite without asking.
    <!-- copy: generated -->  written by an assistant. Fair game for a rewrite pass.
    <!-- copy: mixed -->      his structure, filled in. Say what you changed.

## Still open

Things the evidence doesn't settle, for Griffyn to call:

1. How durable should the references be. Waltzing Matilda and Tung Tung Sahur are perfect for this
   room and this year. He already caught his own audience assumption slipping once, "(looks like
   most of the people in the competition are older actually now that i see them)".
2. "we" or "you". He uses "we" for the shared walkthrough ("Here we will use a technique called
   Cribbing") and "you" for the reader's own action. That split is probably the rule, but it isn't
   stated anywhere, and the AI drafts collapsed them.
