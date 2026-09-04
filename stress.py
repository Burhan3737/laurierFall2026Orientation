"""Render the three hard states each variant has to survive, so they can be looked at.

The board is not hard at 20 events. It is hard at 170, and it is hard when one event
carries a 3,096-character description under an eight-row facts table, and it is hard at
390px. Those are the states this renders.

    python stress.py            all variants, all three states
    python stress.py a c        only those

Writes PNGs to %TEMP%/stress-*.png. Nothing here ships; it exists so the density cases
get looked at every round instead of being assumed.
"""
import os, sys, subprocess, tempfile, json
import shutil, atexit, threading

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = tempfile.gettempdir()
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


# one reusable profile per run, and a sweep of what Chrome leaves behind
from _chrome import chrome_flags

# 170 events across 16 days — the densest selection Laurier publishes for anyone
DENSE = ("level=undergraduate&campus=Waterloo&term=Fall%202026&streams="
         "International%7CExchange%7CIndigenous%7COff-campus%20(LOCUS)%7CResidence%7C"
         "Mature%20%26%20Transfer%7CAccessible%20Learning%7CVirtual")
# the 3,096-character description, six facts, four registration links
LONGEST = "French Montana: Welcome Back Concert"
# eight facts rows
WIDEST = "Craft Your First Year: Journal Decorating"

FRAME = ('<!DOCTYPE html><html><head><style>html,body{margin:0;background:#777}'
         'iframe{width:390px;height:HEIGHTpx;border:0;display:block;margin:0 auto;'
         'background:#fff}</style></head><body><iframe src="SRC"></iframe></body></html>')


def shot(name, html, frag, w, h, inject="", iframe=False):
    src = open(os.path.join(HERE, html), encoding="utf-8").read()
    if inject:
        src = src.replace("</body>", inject + "</body>", 1)
    tmp = os.path.join(OUT, "stress-src-" + html)
    open(tmp, "w", encoding="utf-8").write(src)
    url = "file:///" + tmp.replace("\\", "/") + ("#" + frag if frag else "")
    if iframe:
        page = FRAME.replace("SRC", url).replace("HEIGHT", str(h))
        f2 = os.path.join(OUT, "stress-frame.html")
        open(f2, "w", encoding="utf-8").write(page)
        url = "file:///" + f2.replace("\\", "/")
        w = 500
    png = os.path.join(OUT, "stress-%s.png" % name)
    subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=%d,%d" % (w, h), "--screenshot=" + png,
                    "--virtual-time-budget=14000", url],
                   capture_output=True)
    print("  %-22s %s" % (name, png))


def opener(title):
    """Click what the board uses to reveal an event's full detail."""
    t = json.dumps(title)
    return ('<script>setTimeout(function(){var n=document.querySelector('
            "'[data-ev-title=' + JSON.stringify(%s) + ']');"
            'if(n)openSheet(+n.dataset.id);},600);</script>' % t)


def main():
    # One board. This iterated the deleted variants and had not run since they went,
    # which nothing noticed because nothing ships from it.
    page = "orientation.html"
    print("Stress states -> %s" % OUT)
    shot("dense", page, DENSE, 1400, 1400)
    shot("long", page,
         "level=undergraduate&campus=Waterloo&term=Fall%202026&view=day&day=2026-09-10",
         1400, 1500, opener(LONGEST))
    shot("phone", page,
         "level=undergraduate&campus=Waterloo&term=Fall%202026", 390, 1500, iframe=True)


if __name__ == "__main__":
    main()
