#!/usr/bin/env python3
"""Build the single-file offline launcher (worst_case/launch_offline.py).

Bundles the CORE modules only (Caesar, Encoding, XOR, the shared confetti
engine, and the directory page) as a base64 tar.gz embedded directly in a
plain-stdlib Python script. Deliberately EXCLUDES FNAC — its real cat
photos push it to ~7MB, too large to trust as a single terminal paste in
an actual emergency. FNAC is instead picked up via --src if a copy of the
repo is already reachable (USB stick, presenter's own laptop, whatever).

Run: .venv/bin/python tools/build_offline_launcher.py
Output is committed (like assets.js) — edit this script, not the output.
"""
import base64
import io
import pathlib
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
OUT = ROOT / 'worst-case' / 'launch_offline.py'

# Everything under public/crypto/ except fnac (too big to embed).
CORE_DIRS = ['ceasar', 'encoding', 'xor', 'confetti']
CORE_FILES = ['index.html']


def build_bundle_bytes() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for d in CORE_DIRS:
            src = PUBLIC / 'crypto' / d
            if src.is_dir():
                tar.add(src, arcname=f'crypto/{d}')
        for f in CORE_FILES:
            src = PUBLIC / 'crypto' / f
            if src.is_file():
                tar.add(src, arcname=f'crypto/{f}')
    return buf.getvalue()


TEMPLATE = '''#!/usr/bin/env python3
"""
Crypto 101 CTF prep — OFFLINE / WORST-CASE LAUNCHER
=====================================================
Generated file — do not hand-edit. Rebuilt by tools/build_offline_launcher.py.

What this is: a single self-contained Python script (stdlib only — no pip,
no internet, nothing but a stock `python3` like every Kali box already has)
that unpacks the CORE crypto modules (Caesar, Encoding, XOR, shared
confetti engine, directory page) from an embedded bundle and serves them
locally. For when the live site (ctf.sandhi.com.au) is unreachable —
venue wifi down, DNS blocked, whatever.

Usage:
    python3 launch_offline.py                  # unpack + serve core modules only
    python3 launch_offline.py --src /path/to/ceasar-ctf   # also pull in FNAC
                                                            # from a full repo copy
                                                            # already on this machine
                                                            # (USB stick, laptop, etc.)
    python3 launch_offline.py --port 9000       # custom port (default 8787)
    python3 launch_offline.py --out /tmp/myctf  # custom unpack directory

FNAC (the "Five Nights at Crypto's" bonus module) is deliberately NOT
embedded in this script — its real cat photos make it ~7MB, too large to
trust as a single copy-paste in an actual emergency. Pass --src pointing
at any already-present copy of the ceasar-ctf repo (a laptop, a USB
stick mounted at /media/..., anything with a public/crypto/fnac/ folder
in it) and this script will copy it in on top of the core bundle.

Once running, open the printed URL. Path quirk: this serves the `public/`
directory as webroot, so paths are `/crypto/<module>/` (no extra prefix)
— same as production, unlike the local dev convention elsewhere in this
project's docs.
"""
import argparse
import base64
import http.server
import io
import os
import shutil
import socketserver
import sys
import tarfile
import webbrowser

BUNDLE_B64 = """
{bundle_b64}
""".strip()


def unpack(out_dir):
    raw = base64.b64decode(BUNDLE_B64)
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
        tar.extractall(out_dir)
    print(f"[offline-launcher] unpacked core modules into {{out_dir}}")


def pull_fnac(src_repo, out_dir):
    src = os.path.join(src_repo, 'public', 'crypto', 'fnac')
    dst = os.path.join(out_dir, 'crypto', 'fnac')
    if not os.path.isdir(src):
        print(f"[offline-launcher] WARNING: no public/crypto/fnac/ found under --src {{src_repo!r}} — skipping FNAC", file=sys.stderr)
        return False
    shutil.copytree(src, dst, dirs_exist_ok=True)
    print(f"[offline-launcher] copied FNAC in from {{src}}")
    return True


def serve(webroot, port):
    os.chdir(webroot)
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        url = f"http://localhost:{{port}}/crypto/"
        print(f"[offline-launcher] serving on {{url}}  (Ctrl+C to stop)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\\n[offline-launcher] stopped")


def main():
    ap = argparse.ArgumentParser(description="Offline/worst-case launcher for the Crypto 101 CTF prep site.")
    ap.add_argument('--out', default=None, help='directory to unpack into (default: a temp-ish local folder next to this script)')
    ap.add_argument('--src', default=None, help='path to an existing full ceasar-ctf checkout, to also pull in FNAC (not embedded — too large)')
    ap.add_argument('--port', type=int, default=8787)
    args = ap.parse_args()

    out_dir = args.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crypto-101-offline')
    os.makedirs(out_dir, exist_ok=True)

    unpack(out_dir)

    if args.src:
        pull_fnac(args.src, out_dir)
    else:
        print("[offline-launcher] FNAC not included (no --src given) — core modules (Caesar/Encoding/XOR) are fully playable.")
        print("[offline-launcher] to include FNAC: python3 launch_offline.py --src /path/to/a/full/ceasar-ctf/checkout")

    serve(out_dir, args.port)


if __name__ == '__main__':
    main()
'''


def main():
    bundle = build_bundle_bytes()
    b64 = base64.b64encode(bundle).decode('ascii')
    # wrap at 100 chars/line so the file isn't one absurd line
    wrapped = '\n'.join(b64[i:i + 100] for i in range(0, len(b64), 100))
    script = TEMPLATE.format(bundle_b64=wrapped)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(script)
    print(f'wrote {OUT} ({len(script)/1024:.0f} KB, bundle {len(bundle)/1024:.0f} KB -> b64 {len(b64)/1024:.0f} KB)')


if __name__ == '__main__':
    main()
