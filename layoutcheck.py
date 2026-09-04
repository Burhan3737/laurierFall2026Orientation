"""The clock draws events at their published length, and nothing else.

Two rules bind the day clock. Both were broken at once for months, by one line,
and nothing in this repository could tell:

  1. No event is drawn longer or shorter than it runs. A block is its published
     length times that day's scale. There is no padding and no minimum height.

  2. Two events share a column only if they genuinely overlap. `ncol > 1` on an
     event that overlaps nothing is a defect.

`placed()` used to pad every event to a minimum drawn length -- 52 minutes on
the day clock -- so a quarter-hour event was still a readable box, and then
packed columns from the padded length. The padding was a reasonable answer to
the first problem and no answer at all to the second: Graduate Waterloo's
2 September evening, five events end to end with not one minute of overlap, was
drawn as five events in two columns at half width, as though a student had to
choose between consecutive parts of one evening. On 8 September it turned a
genuinely busy day from five columns into twelve.

When that was fixed, an audit reintroduced it in a scratch copy and ran every
gate in this repository against it. All of them passed. `clashcheck.py` cannot
catch it by design -- since the gold marks began asking `collidesWith()` rather
than `it.ncol`, they stay honest however the columns are packed -- and
`parity.py` checks which events are drawn, never their geometry. `layoutModel()`
was added so an auditor could read the layout instead of scraping pixels, and
then no gate read it.

This one does.

    python layoutcheck.py            every selection that renders a clock
    python layoutcheck.py --selftest prove both assertions fail on a broken build
"""
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
sys.path.insert(0, HERE)
from _chrome import chrome_flags
from clashcheck import selections

PAGE = "orientation.html"

# Read after the board has built itself, and hand the whole model back through
# the title -- the same trick clashcheck.py and parity.py use, for the same
# reason: --dump-dom gives one string back and nothing else.
PROBE = ('<script>setTimeout(function () {'
         '  var keys = dayKeys(visible()).filter(function (k) { return k !== "TBA"; });'
         '  var out = keys.map(function (k) { return layoutModel(k); });'
         # The model must also match what is on the screen. Asking it to check
         # itself would prove nothing, so the blocks the board actually painted
         # for the day it is showing come back beside it.
         '  var painted = [].slice.call(document.querySelectorAll(".daygrid .blk"))'
         '    .map(function (n) { return Math.round(n.getBoundingClientRect().height); });'
         '  document.title = "LM:" + btoa(unescape(encodeURIComponent(JSON.stringify('
         '    {days: out, shown: (view === "day" ? day : null), painted: painted}))));'
         '}, 900)</script>')


def label(s):
    return "%s / %s%s" % (s["level"], s["campus"],
                          (" + " + "|".join(s["streams"])) if s["streams"] else "")


def frag(s):
    q = ("level=" + s["level"] + "&campus=" + s["campus"] +
         "&term=" + urllib.parse.quote(s["term"]))
    if s["streams"]:
        q += "&streams=" + urllib.parse.quote("|".join(s["streams"]))
    return q + "&view=day"


def probed(page):
    src = open(os.path.join(HERE, page), encoding="utf-8").read()
    tmp = os.path.join(tempfile.gettempdir(), "layoutcheck-" + os.path.basename(page))
    open(tmp, "w", encoding="utf-8").write(src.replace("</body>", PROBE + "</body>", 1))
    return tmp


def read(tmp, s, width=1400):
    url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20") + "#" + frag(s)
    r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--window-size=%d,1200" % width, "--virtual-time-budget=9000",
                        "--dump-dom", url],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"<title>LM:([^<]*)</title>", r.stdout or "")
    if not m:
        return None
    return json.loads(base64.b64decode(m.group(1)).decode("utf-8"))


def faults(days, sel):
    """Every way one selection's clocks can break the two rules."""
    out = []
    for d in days:
        for e in d["events"]:
            # 1. drawn length is the published length. Compared in minutes, not
            #    pixels: rounding a difference leaves half a pixel behind, and a
            #    check that reported that as a defect would be crying wolf.
            if abs(e["drawnMinutes"] - e["minutes"]) > 1:
                out.append("%s  %s  %s (%s) drawn as %.2f minutes, runs %d"
                           % (label(sel), d["day"], e["title"][:44], e["published"],
                              e["drawnMinutes"], e["minutes"]))
            if e["drawnPx"] <= 0:
                out.append("%s  %s  %s drawn %dpx"
                           % (label(sel), d["day"], e["title"][:44], e["drawnPx"]))
            # 2. a column is shared only with something you actually overlap
            if e["ncol"] > 1 and e["overlaps"] == 0:
                out.append("%s  %s  %s (%s) drawn %d-across, overlaps nothing"
                           % (label(sel), d["day"], e["title"][:44], e["published"], e["ncol"]))
        # the model must describe the day it was asked for, not another one
        if any(x is None for x in d["allDay"]):
            out.append("%s  %s  allDay carries %d nameless entries"
                       % (label(sel), d["day"], sum(1 for x in d["allDay"] if x is None)))
    return out


def paint_faults(got, sel):
    """What the board painted, against what the model says it painted.

    The model is derived from the functions the renderer draws with, which makes
    it truthful about the layout and says nothing about whether the layout
    survived the stylesheet. Both defects that shipped in this corner of the page
    were exactly that: a title the model held in full and CSS cut in half, and a
    title the renderer drew outside its own bar. So the heights are read back off
    the painted blocks and compared, as a multiset -- the model lists a day in
    placement order and the DOM in document order, and it is the set of heights
    that has to agree, not the sequence."""
    out = []
    day = next((d for d in got["days"] if d["day"] == got["shown"]), None)
    if not day or not got["painted"]:
        return out
    want = sorted(e["drawnPx"] for e in day["events"])
    have = sorted(got["painted"])
    if len(want) != len(have):
        return ["%s  %s  the model has %d blocks, the page painted %d"
                % (label(sel), day["day"], len(want), len(have))]
    for w, h in zip(want, have):
        if abs(w - h) > 2:
            out.append("%s  %s  a block is %dpx on the page and %dpx in the model"
                       % (label(sel), day["day"], h, w))
            break
    return out


def sweep(page, sels):
    tmp = probed(page)
    bad, clocks, blocks, painted = [], 0, 0, 0
    with ThreadPoolExecutor(max_workers=3) as ex:
        for sel, got in zip(sels, ex.map(lambda s: read(tmp, s), sels)):
            if got is None:
                bad.append("%s  the board never reported a layout" % label(sel))
                continue
            clocks += len(got["days"])
            blocks += sum(len(d["events"]) for d in got["days"])
            painted += len(got["painted"])
            bad += faults(got["days"], sel)
            bad += paint_faults(got, sel)
    return bad, clocks, blocks, painted


# ------------------------------------------------------------ on paper -----
# The printed calendar is a second renderer over the same placement, and it kept
# a 13pt floor under a slot so its number and time stayed readable. At half a
# point a minute that floor is twenty-six minutes. While placed() padded every
# event to thirty it could never reach the next slot; when the padding went, it
# printed the Dean's Welcome over the Graduate Student Panel on every graduate
# selection — the very defect the screen had just been cured of, surviving on
# paper on the one evening the cure was written about. A shared edge between two
# columns is not an overlap, hence the tolerance.
PRINT = ('<script>setTimeout(function(){planCal=true;'
         'document.title="PR:"+btoa(unescape(encodeURIComponent(printHtml())));},900)</script>')
SLOT = re.compile(r'top:([\d.]+)pt;height:([\d.]+)pt;left:([\d.]+)%;width:calc\(([\d.]+)%'
                  r'[^>]*>.*?<span class="prslott">([^<]*)</span>', re.S)
EDGE = 0.5


def print_faults(page, sels):
    src = open(os.path.join(HERE, page), encoding="utf-8").read()
    tmp = os.path.join(tempfile.gettempdir(), "layoutcheck-print-" + os.path.basename(page))
    open(tmp, "w", encoding="utf-8").write(src.replace("</body>", PRINT + "</body>", 1))

    def one(sel):
        url = ("file:///" + tmp.replace("\\", "/").replace(" ", "%20") + "#"
               + frag(sel).replace("&view=day", "") + "&plan=cal")
        r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                            "--window-size=1400,1200", "--virtual-time-budget=9000",
                            "--dump-dom", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>PR:([^<]*)</title>", r.stdout or "")
        if not m:
            return [], 0
        html = base64.b64decode(m.group(1)).decode("utf-8")
        out, n = [], 0
        for grid in re.findall(r'<div class="prslots">(.*?)</div></div>', html, re.S):
            box = []
            for g in SLOT.finditer(grid):
                t, h, l, w = (float(x) for x in g.groups()[:4])
                box.append((t, t + h, l, l + w, g.group(5)))
                n += 1
            for i in range(len(box)):
                for j in range(i + 1, len(box)):
                    a, b = box[i], box[j]
                    if (a[0] < b[1] - EDGE and b[0] < a[1] - EDGE
                            and a[2] < b[3] - EDGE and b[2] < a[3] - EDGE):
                        out.append("%s  the printed calendar draws %s over %s by %.1fpt"
                                   % (label(sel), a[4], b[4], min(a[1], b[1]) - max(a[0], b[0])))
        return out, n

    bad, slots = [], 0
    with ThreadPoolExecutor(max_workers=3) as ex:
        for o, n in ex.map(one, sels):
            bad += o
            slots += n
    return bad, slots


def main():
    sels = selections()
    bad, clocks, blocks, painted = sweep(PAGE, sels)
    for b in bad[:12]:
        print("  FAIL  %s" % b)
    if len(bad) > 12:
        print("  ... and %d more" % (len(bad) - 12))
    print("  %s  %d selections, %d day clocks, %d blocks: every event drawn at its "
          "published length, and no event sharing a column with something it does "
          "not overlap" % ("ok  " if not bad else "FAIL", len(sels), clocks, blocks))
    print("  %s  %d of those measured on the page as well, and the page agrees with "
          "the model" % ("ok  " if not bad else "FAIL", painted))
    pbad, slots = print_faults(PAGE, sels)
    for b in pbad[:6]:
        print("  FAIL  %s" % b)
    print("  %s  %d printed slots across %d selections: nothing printed over anything else"
          % ("ok  " if not pbad else "FAIL", slots, len(sels)))
    return 0 if not (bad or pbad) else 1


# --------------------------------------------------------------- self-test --
# An assertion that has never gone red is not evidence of anything. These are
# the two defects this file exists for, put back one at a time.
BREAKS = [
    ("the padding, and columns packed from it", "overlaps nothing", [
        ("      ends[k] = it.e; it.col = k;",
         "      ends[k] = Math.max(it.e, it.s + 52); it.col = k;"),
        ("    cur.push(it); curEnd = Math.max(curEnd, it.e);",
         "    cur.push(it); curEnd = Math.max(curEnd, it.e, it.s + 52);"),
    ]),
    ("a floor that prints over the next slot", "printed calendar draws", [
        ("    var next = items.filter(function (o) { return o.col === it.col && o.s >= it.e; })",
         "    var next = null && items.filter(function (o) { return o.col === it.col && o.s >= it.e; })"),
        ("    var hpt = Math.max(Math.min(PR_SLOT_MIN, room), bot - top - 1.5);",
         "    var hpt = Math.max(PR_SLOT_MIN, bot - top - 1.5);"),
    ]),
    ("a floor under the drawn height", "drawn as", [
        ("  return sc.pos(it.e) - sc.pos(it.s) - 2;",
         "  return Math.max(52, sc.pos(it.e) - sc.pos(it.s) - 2);"),
    ]),
]


def selftest():
    print("Self-test — each assertion must fail on a build made to break it")
    base = open(os.path.join(HERE, "_app_main.js"), encoding="utf-8").read()
    # Enough selections to reach every defect below, not just the first ones the
    # enumerator happens to yield: the print floor only collides on the graduate
    # evening, and a self-test that never loaded a graduate board reported its own
    # mutant as MISSED.
    all_sels = selections()
    sels = ([s for s in all_sels if s["level"] == "graduate"][:3]
            + [s for s in all_sels if s["level"] != "graduate"][:3])
    ok = True
    for name, expect, edits in BREAKS:
        js = base
        for a, b in edits:
            if js.count(a) != 1:
                print("  the self-test no longer matches the code it breaks: %r" % a[:52])
                return False
            js = js.replace(a, b)
        bjs = os.path.join(HERE, "_app_broken_layout.js")
        bout = "orientation-broken-layout.html"
        open(bjs, "w", encoding="utf-8", newline="").write(js)
        try:
            r = subprocess.run([sys.executable, "build.py", "--js", "_app_broken_layout.js",
                                "--out", bout], cwd=HERE, capture_output=True, text=True)
            if r.returncode:
                print("  the broken build did not build: %s" % (r.stderr or r.stdout)[:200])
                return False
            bad, _, _, _ = sweep(bout, sels)
            # the printed calendar is a second renderer over the same placement,
            # and a self-test that only drove the screen left its mutant unseen
            bad += print_faults(bout, sels)[0]
        finally:
            os.remove(bjs)
            if os.path.exists(os.path.join(HERE, bout)):
                os.remove(os.path.join(HERE, bout))
        hit = [b for b in bad if expect in b]
        print("  %-42s -> %s" % (name, (hit[0][:96] if hit else "MISSED")))
        if not hit:
            ok = False
    print("  %s  both rules go red when they are broken" % ("ok  " if ok else "FAIL"))
    return ok


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(0 if selftest() else 1)
    sys.exit(main())
