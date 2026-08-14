# Crypto 101 — Student Puzzle Sheet (paper / screen-share fallback)

> This sheet has **no answers on it**. It's the plain puzzle text only — safe to print,
> photocopy, or project on a screen in front of students. If you need the solutions to
> check answers, use the matching `challenge.yml` / `README.md` in
> `worst-case/text-challenges/` (presenter eyes only, not this file).

21 challenges across four modules. Work them in any order — later ones in each module
tend to build on ideas from earlier ones.

---

## Caesar / substitution ciphers

### 1. Test Signal

A scrambled signal came through. Every letter has been slid forward by the same fixed
amount — figure out the shift and the static resolves into language.

```
cipher = yetz{Z}
```

### 2. Bee Line

Another scrambled note, another fixed shift. Same idea as before — find the amount
every letter was slid by.

```
cipher = cixd{Ybb}
```

### 3. Radio Tuning

An intercepted signal, shifted by a fixed amount across every letter. Tune it until it
resolves into language.

```
cipher = synt{Pnrfne_Fnynq}
```

### 4. Safe Cracking

Locked text, one dial. Same fixed-shift idea as the earlier signals — find the shift and
the tumblers align.

```
cipher = qwlr{mzcpo_jpe}
```

### 5. Two Tones

One shift isn't enough this time. Two alternating shifts were used across the message:
shift A on the 1st, 3rd, 5th... *letter*, shift B on the 2nd, 4th, 6th... *letter*
(counting letters only — punctuation like `{`, `}`, `_` doesn't take a turn).

```
cipher = bawv{plk_ikcah}
```

### 6. Multiply and Slide

Each letter was multiplied, then shifted: `y = (a·x + b) mod 26`, where `x` is a
letter's position in the alphabet (a=0..z=25). Find the multiplier `a` and the slide
`b`. Not every `a` works — only values coprime with 26 give a clean, reversible
mapping.

```
cipher = hlim{ihhwvc_isc}
```

---

## Encoding (base64, hex, URL-encoding, and layered combinations)

### 7. Decode the Signal

Encoding isn't a lock, it's a costume — reversible, no key needed. Recognise the
disguise and take it off.

```
ZmxhZ3tiYXNlNjRfaXNfbm90X3NlY3JldH0=
```

### 8. Sixteen

Only 16 symbols this time: `0-9 a-f`, always an even number of them. That's your tell.

```
666c61677b6865785f696e5f706c61696e5f73696768747d
```

### 9. Percent Sign

A wall of `%XX`. This is what URL-encoding looks like when every byte gets the percent
treatment.

```
%66%6c%61%67%7b%70%65%72%63%65%6e%74%5f%65%6e%63%6f%64%65%64%7d
```

### 10. Order Matters

Two layers, stacked. Base64 uses `A-Z a-z 0-9 + /` and often ends in `=`; hex is only
`0-9 a-f`. Peel them in the right order — the wrong order gives nonsense.

```
NjY2YzYxNjc3YjcwNjU2NTZjNWY3NDY4NjU1ZjZjNjE3OTY1NzI3Mzdk
```

### 11. Three Deep

Three layers this time: base64, then a punctuation-heavy scramble, then hex. Automated
"magic" decoders often stall on the middle layer — you may need to peel it by hand.

```
ZWVlNGVgZWZmM2ZjZWdmYWVkZWRkN2U0ZWBmaGVkZmFmYmQ3ZWNlZGVkZl9mNQ==
```

### 12. Among the Bytes

Decode the block below as base64 and save the raw output as a `.png` — it renders as a
small sprite. The sprite is the misdirection: keep reading the decoded bytes past the
end of the image and there's more.

```
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAzElEQVR4nGNgGAUjHTCSq/GgkPx/dDH7dw9JNo+RGhZT4hAmaltOijqSHECKoaSoZ2IYYMBEC9+Too+FgQrg1sGTGGJq9uZE6WWhtsUg4K0szsDw5AHD1rsvGRh0JWiTBm7hsBwdzL784j9ZIdDHK0ZWvIMA2OdEAiaGAQZM5GokNpGl6kow0iwRqkEdgSsXEFMks1DiAHSHkAOYGAYYMI06gGGAASMtKyNicgETwwADplEHMIz0KGAhVyN6Cic3pzAxDDBgGmgHDDgAANsDN8XUCZS7AAAAAElFTkSuQmCCCi0tLS1bIGZsYWd7aGlkZGVuX2luX3RoZV9ieXRlc30gXS0tLS0K
```

### 13. Picture This

Bytes can be worn as text, or as a picture. Decode the block below as base64, save the
raw output as a `.png` file, and open it in any image viewer — the flag is written
directly on the image.

```
iVBORw0KGgoAAAANSUhEUgAAAGQAAAAXCAIAAAByNn1sAAAFHUlEQVR4nO2Yb0hTXxjHz9289w5zDiz7g2w6m9QmTnwRiulFRaJQfFUic5ZBexGoq1BEIRa4WekLRZANyhYFg1LYmyW0mQiCLMk3LmputFayoe6F7q65m5OdHz8vXGR/nIkZwj6vzp7z/Z7znIdz7j27CIQQpNgfrH3qUqSK9WekdtYxLNa7d+/EYjGO4/fv3z/62Z8/f46iqFAo1Ol0e+lgYnp7e0+fPg0AKC0tpSOzs7OM0WKxwMNDLBY3NTX5/X749wEA9PX1RQVDoVBvby+Kor9//05kTLiz5ufn+/v7jUYjhNBqtdLBiooKCKHP5wOHzc+fP6uqqjIzM8E/gsPhXLlyJRwOe73eRJqExXI4HBiGlZeXgyNhe3ubzWaDfwqdwPb29h8Uq62tDUGQlpaWra0tZIeysrKkMwWDQY1Gc/HiRRzHRSLR06dPmRtcJBLp7u4+efIkl8tVKBS1tbWtra27veEdOBwOE8nNzR0eHo6aQqvVnj17lm4PDQ3l5+djGCYUCgcHB/fp2hs6gc3NzYSKROdTr9fjOB63y7dzDKOeWS9fvnz48KHb7Q6FQjMzM5mZmTqdju4aGhri8XgWi2V9fb2np4fFYt26dYsxBoPBgYEBDMMcDgcTbG5uvnHjRtS8crn8+vXrEMLXr1+jKPrmzRuSJCcmJnAc1+v1SV0MAAC1Wh27LpIks7Oz79y5s76+Hnfhh1asKGQyWUNDA93Oy8t78OAB3d7a2jp16hRTrLq6OgBAeXn5/Pz8brtOp8vJyYEQfvr0CQDw8eNHCGF+fv7IyAiE8NKlS42NjYxYLpdLpdKkLoYTJ04MDw/DeHz//r2uro7FYuXm5sb2HtrVYXV1VaFQCAQCFEURBDEYDIFAAABAUdSPHz+KiopoGYqiFy5cYFwmk2ljY6OkpKS2ttbj8TBxgiA8Hs/y8vLU1BSfz7dYLGtray6Xq7KyEgDgdDqZAQEAUqnU6XQmdTFk7RC7BIqiqqurIYRer9ftdscKDq1Yzc3Ni4uLJpNpc3MTQnjz5s1IJBJXGfVvlMfjPXnyJBAI7L6XiMXi7Ozsubk5i8Xy+PFjs9k8NzfH4/GkUukeA+7TZbfbZTJZ7Dhfv351u90qlerMmTNxMz9IsTIyMhAEoShqd7qzs7N3796VSqUoikIIFxYW6C4OhyMQCGw2G/0zHA47HI7YATEM+/Xr1+5gRUXF9PS0y+WSyWRer9dsNl++fJnF+j/hgoKCz58/M0qbzVZQUJDUxZCenh73zRsMBul9l2jhBykWh8MpLi5++/YtUy8EQSQSyfj4uM/nW1tb6+zs/PbtG6Pv6OgYGxubmpry+/0qlcrv98eOyWazo97ZlZWVr169IggCQZCamhq9Xk8QBN3V3t5uNBonJiYCgYDRaBwfH1cqlUldNFarFUGQ+vr62BzC4TBzgYjLAY/hixcvvnz5wuVyEQSx2+0AAIPBEAwG8/LyioqKWCyWXC5nxEqlUqFQNDY28vl8v99PEASKolEDCgSCDx8+kCTJRAiCoCjq6tWrAIBr165RFMU8elpaWtRqdVdXV1ZW1r179x49enT79u2krr0JhULv37/HcfzcuXMJRfDIEYvFGo0mKmgymSQSCYZhSqXy6FN69uxZWlqaUCjUarV7yI6iWDabTalULi0tkSQ5OjqK47jT6YTHkDTw95FIJOfPn6+vr19ZWSksLJycnBSJROAYgqQ+Kx+/71nHglSx/oBUscD++Q8qXrkLtWsSTQAAAABJRU5ErkJggg==
```

### 14. Read the Room

Decode the block below as base64 first. What comes out *is* readable — a capture dump —
except for one field, which is two more layers deep. Then read carefully: the flag-shaped
things you can see aren't the real flag, and the real one doesn't look like a flag yet.

```
LS0gY2FwdHVyZSAweDVmIC0tCmF1dGhfdG9rZW46IGZsb3Jne25pY2UtdHJ5fQp0cmFjZT02NzZjNjE2NjdiNmU2Zjc0MmQ2OTc0N2QKcmVmPSU2NyU2YyU2ZiU3MiU2NiU3YiU2ZSU2ZiU3MCU2NSU3ZApwYXlsb2FkOiBGQEtFTDpHS0gwRzZHOjMwQEM+RzBGQzo5OE4KLS0gZW5kIG9mIGNhcHR1cmUgLS0K
```

### 15. Two Faces

One blob decodes two different ways to two different pictures — both real, both
precomputed. Decode the block below as **hex** for one face; decode it as **base64**
and view the raw bytes as a picture for the other. The string is a hex dump with junk
letters wedged in: hex throws the junk letters away (they aren't `0-9a-f`), base64
keeps them.

```
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIGGQIG////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////GQIGGQIG////////////////////////////////GQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////GQIG////////////////////////////////GQIGGQIGGQIGGQIGGQIG////GQIGGQIG////////////////////////////////GQIGGQIGGQIGGQIG////////////////////GQIGGQIG////////////////////////////////////////////GQIGGQIG////////////////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////GQIGGQIGGQIGGQIGGQIGGQIG////////////////////GQIGGQIG////////////////////////////////////GQIGGQIG////////////////////////////////GQIGGQIG////////////////GQIGGQIGGQIGGQIG////////////GQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////GQIG////////////////////////////////GQIGGQIG////////GQIGGQIGGQIGGQIGGQIGGQIG////////////////GQIGGQIG////////////GQIGGQIG////////////////////GQIG////////////////////////////////////////////////////GQIG////////////////////////////GQIG////////GQIGGQIG////////////////GQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////GQIG////////////////////////GQIGGQIGGQIGGQIG////////////GQIG////////////////////////GQIG////////////GQIG////////GQIGGQIG////////////////////////////////////////////////////////////////////////GQIG////////////GQIGGQIGGQIGGQIG////////////////////////GQIG////////////////////////GQIG////////////GQIG////////GQIGGQIGGQIG////////////////////////////////////////GQIGGQIG////////////////////////GQIG////////////////////////GQIG////////////////////GQIG////////////////////////GQIG////////////GQIGGQIGGQIGGQIG////////GQIGGQIG////////////////////////////GQIGGQIG////////////////////////////////GQIG////////////////////GQIG////////////////GQIGGQIG////////////////////////GQIG////////////GQIG////////GQIG////////////////GQIGGQIG////////////////////GQIG////GQIGGQIGGQIG////////////////GQIGGQIGGQIG////////////////GQIGGQIG////////////GQIG////////////////////////////////GQIG////////////////////GQIGGQIG////////////GQIG////GQIGGQIGGQIG////////////GQIG////////////////////////////GQIG////////////////////GQIGGQIGGQIG////////////GQIG////////////////////////////////GQIGGQIG////////////////////GQIGGQIGGQIG////GQIG////////////////GQIGGQIGGQIG////////////////////////GQIGGQIG////////////////////GQIGGQIGGQIGGQIG////////GQIGGQIG////////////////////////////////////GQIGGQIG////////////////////GQIG////GQIGGQIGGQIG////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////////////////////////GQIG////////////////////GQIG////////GQIGGQIGGQIGGQIG////////GQIG////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////GQIG////////GQIG////////////////////////////////////////////////GQIG////////////////////GQIG////GQIG////GQIGGQIGGQIGGQIGGQIG////////////////////////////////GQIG////////////////GQIG////GQIGGQIGGQIG////////GQIG////////////////////////////////////////////////GQIG////////////////////////GQIGGQIG////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////////////////////////////////GQIG////////////////////GQIGGQIG////////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////////////////////////////////GQIG////////////////////////GQIGGQIG////////////GQIG////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////////////////////////////////////GQIG////////////////////////////GQIG////////GQIG////////////////////GQIG////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////GQIG////////////////////////////////////////////////////////////GQIG////////////////////////////GQIGGQIGGQIG////////////////////GQIG////////////GQIG////////GQIG////GQIG////GQIGGQIG////////////GQIG////////////////////////////////////////////////////////////////GQIG////////////////////////////////GQIGGQIGGQIG////////////GQIG////////////GQIG////GQIGGQIG////GQIGGQIGGQIGGQIG////////////GQIG////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////////////////GQIG////////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////GQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIG////////////////////////////////////////////////GQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIG////////////////////////GQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////GQIGGQIGGQIGGQIGGQIGGQIGGQIGGQIG////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////89504e470d0a1a0a0000000d4948445200000091000000170100000000234a904b000000f949444154789c9590b14e02411086ffdd23420c1154ca4b5808a589942646b225cf40e523f004b0179a25be848f41a836c4d2ce17b8a3d046e361073976cc9c8039adf88bd9cc979dddf97f41f8ab48fe43c0716c6b0e60c3ccaa3d7be21230bb7180ccb80d7783f267c217dedbf66117feadfba9a963975f6b00829c0a9326de5f2f541cbea86959080903ef9e7dad9ac2f9f304d12398d9d695f452415bb7dad03dff91cea902318a81b96e3e18c3f7eabdc4fb6c01b89e4b03de0c269ddd4a79daae43cfaed5500325a031f8680577131d637029a22a0022a22c1bf3916b4526f79104bf199cedbc9d7059970a59e5e6cb790ec7e75cd43751845a0a94d2108c0000000049454e44ae426082////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////?q=%4e%60.ref=%79%62%2f%2d%33&ref=%31%77%22&next=%5a%51%6d.ref=%42%6b%31%28&utm=%4f%27&sid=%67%2c&ref=%53%58&cb=%40%21%29%6b.rid=%29%28%78&ref=%5b%56%64%5f%2b&next=%48%22%72%43%3c&q=%78%35%7b%5f%3c&rid=%4d%3a%45&sid=%3a%54%39%6d.ref=%77%30%7e%6e%42&next=%7e%2f%6f%31%23%2ee
```

---

## XOR

### 16. Brute Force

A single secret byte was XOR'd across the whole message. A single byte is only 256
possibilities — try them all and find the one that reads as English.

```
cipher (hex) = 515b56504c5545424352685158455452685a524a
```

### 17. Crib the Key

This time the key is a whole word that repeats — too many combinations to brute. But
every flag starts with `flag{`. Lay that known text over the start of the scrambled
message: `scrambled ⊕ known-text = key`. Watch the key repeat.

```
cipher (hex) = 050d15041a0606111102151d0d062b1b0e063c0a111a1c
```

### 18. Same Key Twice

Two secret messages were scrambled with the SAME key — a lazy, fatal mistake. You don't
get the key. XOR the two scrambled messages together and the key cancels itself,
leaving `message1 ⊕ message2`. Slide a guessed word along that result; where it reads
as English, you've cracked a slice of the OTHER message. Extend outward from there to
recover both messages — the flag is in message 1.

```
message1 (hex) = 363933373736292c3f1a3b302b0f383221223f38
message2 (hex) = 3d3037246c282d61383c70213a356c212722313671
```

---

## Five Nights at Crypto's (file forensics)

These three need the actual files, not just text — put them on a USB stick or a laptop to
pass around. They live in the full repo at `public/crypto/fnac/assets/`.

### 19. Meta Parts

Two files came off the same feed. Both look like dead air. Neither one is, quite.
Attach `night1-a.png` and `night1-b.png` — dump the raw bytes of each and look past the
end of the image data.

Files: `night1/night1-a.png`, `night1/night1-b.png`

### 20. Bit Weaving

Something got taken apart in here. Not cut in half — taken apart smaller than that. Two
files came out. Neither one opens, neither one is anything. Put it back together.

Every byte of the original gave four bits to each half: `night2-a.bin` holds bits 6, 4, 2,
0 of each source byte; `night2-b.bin` holds bits 7, 5, 3, 1. Those four-bit groups are
packed two per output byte, high nibble first, in source order. Interleave them back and
the original file appears — and it is a picture.

Don't bother running `strings` on it. The flag is not in the bytes. Open the picture.

Files: `night2/night2-a.bin`, `night2/night2-b.bin`

### 21. Triple T

It came down the hall at 3am, three knocks at a time, and left this behind. Every byte of
it has been walked over by the same short secret, again and again. Whatever's out there
doesn't hide its name. It shouts it, over and over.

`night3-a.txt` is not text — every byte was XOR'd against a repeating key. You know one
thing about the plaintext for free — it starts with the same five characters every flag
in this session starts with. XOR those against the first five bytes of the file and you
have the first five characters of the key. Read them out loud and you'll know the rest.
`hint-sahur.webp` is a picture of what left it.

Then actually read the message. The name is not the flag.

Files: `night3/night3-a.txt`, `night3/hint-sahur.webp`
