# Author's original copy, verbatim

Griffyn's own words, dictated 2026-08-15, transcribed here exactly as given (typos and all).
**This is the source of truth for voice.** When copy needs rewriting, come back to these, not to
whatever polished version currently sits in the page.

Corrections agreed separately and applied on top: exponents in the XOR subtitle (2^0/2^1/2^2/2^3),
and "bit" -> "byte" in C4 (a 3-byte key, 16,777,216 possibilities).

---

## XOR page, header and info block

> make the red text to the top of the page the page consistent with the other ones, change the title
> of the page to "this xor that", and the subtitle "everything in a computer is ultimately encoded in
> bits (1s and 0s) which is a binary number system where instead of ones, tens, hundreds, and
> thousands, it has 2^0 (1), 2^ (2), 2^3 (4) 2^4 (8), etc. So, while 6 is just 6 in our base10
> counting system, in binary 6 can be written as 0110, which means "no 8, yes 4, yes 2, no 1". in the
> information block it should read "Binary has an interesting property, that you can combine binary
> strings using simple logic to "mix" them, and as long as you know one of the original strings, they
> can be unmixed. This is done through an Exclusive Or operation, where every bit of the two strings
> are compared to eachother, the rule is "If two bits are the same, output 0, if different, output
> 1". This can be used to "lock" messages by repeating a xor operation over and over using a little
> string repeatedly across a big string. take away the right top text on each challeng, the "1-byte
> key", etc.

## XOR demo and C1

> in the challenge text for brute force, it should say here we are representing eight bit letters in
> hexa decimal to save space. If the Key string that is used to encode. The message is very short like
> only a single letter then every single combination of the eight bits that could make up one of those
> letters can be tried. Here we have precomputed I set of all possible a bit keys and run them across
> using an EXO operation on the secret message already, this is a normal thing to whip up as a short
> script and it's output might look like this, search through to find the flag. You might need a
> paraphrase that a little bit it's a bit long. Take away the play.not scored text in the demo. Some of
> what i said before actually should be in the demo text. change the takes two bits text to "and
> outputs a 1 only when they differ, outputting a 0 when they are the same. tap the bits below and see
> how they combine in a xor operation. (the lock and unlock area is a little broken on mobile, the
> 0(xor)0=0 etc should be on the line under the bit buttons on mobile widths. remove the "where the key
> bit is 1 it flips" text. Move some of my prose about text and hex to the "a letter is just 8 bits"
> block. add "We will use a single letter as a key here to encrypt a message that is only a single
> letter long. Play with this to get an intuition for encrypting and decrypting xor strings, changing
> your input message and clicking the bits of the key to change it. see how they mix and unmix.

## XOR C1 and C2

> in challenge 1, the text "try every 1-byte key" text should be replaced with "Try a few keys
> yourself, then when you get bored click the button below to brute force it trying every
> combination.". Change the "run all 256 keys" text to "brute force", add an opening animation where
> the list fills in really quickly but not instantly so it looks like its being bruteforced, could have
> them appear with slight brightness increase that fades over a half second like they are hot. remove
> the filter. remove the "256 is a lot" text. in the "apply a key" box, make it so you can only type a
> character, but display its hex code in a box to the right. so the text should read "apply a key -
> type a character to try". remove the hint box. challenge 2, the first paragraph should read "This key
> is a short word applied over and over to a longer string. Here we will use a technique called
> 'Cribbing', which means guessing what the secret message might contain to help crack it. Here you can
> see the encrypted message, there is a box for you to try cribbing in. Remember, if you know either
> the key or the original string you can pull the xor apart. What text do flags always have?" you can
> shorten if you want. the scrambled message box should just say encrypted message, and have box

> the "key = scrambled" text should be removed. the hex, text, key block should have the text with a
> red background. the "type the repeating key" should be "Type the key we find here". Put a key (like
> visual guide) to the right of the crib box (remove the "5 characters" text.) that shows the letter a
> as a hex-letter-key pair, annotate it as "hex" "message" "key applied on this byte" oh shit also,
> actually make the background of they key red, and the message background white to be consistent with
> the demo. also put the key on top, then the message, then the hex under that (so flip the stack). in
> challenge 2 change the placeholder text in the flag box to "Paste the flag here", and remove the hint
> box.

## XOR C3

> C3 title should be "Reuse, Recycle". Subtitle - "If two messages have been mixed using the same key,
> or different keys but the same message, they can be used to cancel out the common string. So if i
> encrypt two messages with a single key, combining those encrypted messages will destroy the key
> because they match, letting us attack one message with the other one directly. Put a visual aide, a
> small box with "encrypted 1" above it as a title that is red on one side (with a K1 in it) and white
> on the other (with an M1), and another box next to it with the title "encrypted 2" that has the red
> and white in opposite sides, M2 in the white, and K1 in the red. put an xor symbol between them, and
> to the right an equals sign, and then a box with two white boxes, M1 and M2. remove the "the mistake:"
> box. in all of the hex message examples please put a toggle in the top right to switch between hex,
> binary and text. the "xor the two together" should be removed, just have the text boxes for encrypted
> message 1 and 2 (the ones that currently contain hex) have a xor symbol between them, then put an =
> below and the text box with the message 1 xor message 2 text box below that. now, the message to be
> cribbed after typing flag needs to be some recognisable phrase, and I feel the part that lines up with
> flag{ should be in the middle of the text so they have to drag the slider around like a flash light.
> the phrase needs to be something ultra recognisable for 18 year olds in only 5 characters. (looks like
> most of the people in the competition are older actually now that i see them), maybe a line from a
> super popular phrase, like youre a wizard harry or something. or a slogan from an advertisement?
> really racking my brain for this. need help. also the key should be flag{compost!}. change the hint to
> something about the phrase or song. maybe the key message could be "waltzing matilda" and the hint
> could be "this song was nearly selected as the official anthem of australia, but it was decided that
> (the current national anthem) would be more appropriate"

## XOR C4

> c4 should be called "brute force 2". the sub text should be "This is a brute force of a 3 bit key,
> yes this is hard. you will need to derive the key from the hint, or you wont get it. The 1 bit key has
> 256 possibilities, but a 3 bit key has (however many) possibilities." Take away the "You are given the
> key length: 3" box completely. We need to re arrange the sliders. stack them all on top of eachother,
> put the 3 previews in a single window above, and give it a toggle between hex and text. colour each
> slider with the red-yellow-green scheme of the decrypted preview (under the sliders). take away the
> "key you have assembled" box because its redundant. turn "the message under that key" into "Decrypted
> string". turn knob phrasing (in the colour keys) into "key parts - bit 1, bit 2, bit 3.", remove ". =
> not a readable...". remove the "the punchline" box. Change the answer key to T4x, and make the hint be
> "Do one bit of the key at a time. The key is in L33tSp34k, and it is the single form of the completion
> of this famous phrase - "In this world nothing can be said to be certain, except death and _____."

## Hash page

> Change the top red text to be consistent with the other modules. change the title to "Same sized
> chaos output.". Make the subtitle "Hashing functions take an arbitrary input, mix it up and make an
> output of a fixed size. The special thing about them is that "in theory" any two inputs should make
> totally different outputs, even if they are only different by one tiny piece. Old hashing schemes like
> MD5 were found to produce the same output with certain inputs, called a collision, which makes them
> insecure." remove the md5 collision demo block near the bottom.

## Directory page

> The dir needs a night mode toggle. The title should be Gaura's Domain (domain in red, gaura in gold).
> subtitle "These are my micro-ctf's to help absolute beginners start trying cybersecurity Capture The
> Flag challenges. They are very simple, so if you are already into this stuff, try out the Cryptopals
> ctf or OverTheWire or something." (https://cryptopals.com/) (https://overthewire.org/wargames/). Take
> away all the "live" "in progress" etc. bubbles. down the bottom instead of "ctf.sandhi.com.au/crypto -
> not..." put "Designed by Griffyn Hancock AKA Gaurahari Das, coded by Claude Code."
> (https://github.com/GriffynHancock/) should be the hyperlink of Griffyn Hancock.
