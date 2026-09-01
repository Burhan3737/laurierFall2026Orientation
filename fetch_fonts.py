"""Cache the Google webfonts each variant asks for, so the pages need no network.

The variants are offline HTML files. Linking fonts.googleapis.com means that opened
from a USB stick on a plane they lose the typography that carries most of their
character. This downloads exactly the families named in each stylesheet's
`/* @fonts ... */` directive, keeps the latin and latin-ext subsets, and writes a
base64 @font-face block that build.py inlines in place of the <link>.

    python fetch_fonts.py            refresh the cache in _fonts/

Nothing but Google Fonts is fetched, and the cache is committed nowhere — if it is
missing, build.py falls back to the <link> and the page still works online.
"""
import os, re, base64, urllib.request, io, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "_fonts")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0.0.0 Safari/537.36")
KEEP = ("latin",)   # the corpus has no latin-ext codepoint; checked against events.json


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    data = urllib.request.urlopen(req, timeout=30).read()
    return data if binary else data.decode("utf-8")


def blocks(css):
    """Yield (subset-comment, @font-face text) pairs in source order."""
    out, name = [], None
    for chunk in re.split(r"(/\*\s*[a-z-]+\s*\*/)", css):
        m = re.match(r"/\*\s*([a-z-]+)\s*\*/", chunk.strip())
        if m:
            name = m.group(1)
        elif "@font-face" in chunk:
            out.append((name, chunk.strip()))
    return out


def build(stylesheet):
    css = io.open(os.path.join(HERE, stylesheet), encoding="utf-8").read()
    m = re.search(r"/\*\s*@fonts\s+(\S+)\s*\*/", css)
    if not m:
        print("  %s names no fonts" % stylesheet)
        return
    src = get(m.group(1))
    kept, total = [], 0
    for subset, face in blocks(src):
        if subset not in KEEP:
            continue
        u = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", face)
        if not u:
            continue
        raw = get(u.group(1), binary=True)
        total += len(raw)
        b64 = base64.b64encode(raw).decode("ascii")
        kept.append(face.replace(u.group(0),
                    "url(data:font/woff2;base64,%s)" % b64)
                    .replace("font-display: swap;", "font-display: block;"))
    if not kept:
        sys.exit("no latin faces found for " + stylesheet)
    dest = os.path.join(OUT, os.path.splitext(stylesheet)[0] + ".fonts.css")
    io.open(dest, "w", encoding="utf-8").write("\n".join(kept) + "\n")
    print("  %-16s %2d faces, %d KB of woff2 -> %s" %
          (stylesheet, len(kept), total // 1024, os.path.basename(dest)))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sheets = sys.argv[1:] or ["_style_a.css", "_style_b.css", "_style_c.css"]
    print("Caching webfonts into _fonts/")
    for s in sheets:
        build(s)
