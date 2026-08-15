# Gaura's Domain

Micro-CTFs to help absolute beginners start trying cybersecurity Capture The Flag challenges.
They are very simple on purpose. If you are already into this stuff, go and do
[Cryptopals](https://cryptopals.com/) or [OverTheWire](https://overthewire.org/wargames/) instead.

**Play it here: [ctf.sandhi.com.au/crypto](https://ctf.sandhi.com.au/crypto/)**

Every challenge hides a flag. Flags look like `flag{something_like_this}`, and you type the one you
find into the box to capture it.

## What it covers

- **101 · Simplest Cryptography** — shifting letters around, and why a wheel of 26 letters wraps.
- **102 · Common Encoding Schemes** — base64, hex and URL encoding, and why none of them are secret.
- **103 · XOR & Binary** — bits, and what happens when you mix two strings and then reuse a key.
- **104 · Intro to Hashing** — the same sized output from any input, and what a collision is.
- **105 · 5 Nights at Crypto's** — file forensics, no helper tools. Opens once the first three are done.

## Run it yourself

No build step and nothing to install. Clone it, serve the `public` folder, open the page.

```sh
git clone https://github.com/GriffynHancock/Gauras-Domain.git
cd Gauras-Domain/public
python3 -m http.server 8000
```

Then open <http://localhost:8000/crypto/>. Serving from `public` is what makes the paths match the
live site.

## Tools that might help

- [CyberChef](https://gchq.github.io/CyberChef/) — drag encodings and ciphers together in the browser. Start here.
- `file` — tells you what a file actually is, whatever its name says.
- `xxd` — shows you the raw bytes, which is where things hide.
- `strings` — pulls readable text out of something that is not text.
- `grep` — finds the bit you are looking for. `cat thing.txt | grep flag` gets used a lot.

## Working on it

`CLAUDE.md` has the conventions, local dev and deploy. `STATUS.md` has the current state and what is
outstanding. Read `docs/voice-guide.md` before writing any copy a student will read, alongside
`docs/authors-original-copy.md` and `docs/prose-accounting.md`.

Note `worst-case/` is the presenter's offline fallback and it contains answers.
