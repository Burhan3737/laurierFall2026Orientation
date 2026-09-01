"""Assert properties of the rendered page, not the presence of lines of code.

Every check here exists because a fix that had been made was silently lost when
later work rewrote the code around it, and nothing noticed: the console was clean,
the parity gate was green, and a screenshot of the top of the page looked right.
`check.py` proves a page runs. This proves it still keeps its promises.

    python invariants.py            all variants
    python invariants.py a c        only those
    python invariants.py --selftest prove each assertion fails on a known-bad page

Each assertion is negative-tested by `--selftest`, because an assertion that has
never gone red is not evidence of anything.
"""
import io
import os
import re
import subprocess
import sys
import tempfile
import shutil, atexit, threading

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


# one reusable profile per run, and a sweep of what Chrome leaves behind
from _chrome import chrome_flags

NL = chr(10)

BOARD = "level=undergraduate&campus=Waterloo&term=Fall%202026"
DENSE = (BOARD + "&streams=International%7CExchange%7CIndigenous%7COff-campus%20(LOCUS)"
                 "%7CResidence%7CMature%20%26%20Transfer%7CAccessible%20Learning%7CVirtual")

# A weekday-and-date prefix on a title shown under a heading naming that day.
DAY_PREFIX = (r"^(Sun|Mon|Tues?|Wed(nes)?|Thurs?|Fri|Satur?)(day)?,?\s+"
              r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*\d{1,2}\s*[-\u2013\u2014:]")

PROBE = """
<script>setTimeout(function () {
  var out = [];

  // 1. no visible title still carries the day it is filed under
  var sel = ".bh,.ch,.rh,.agb h4,.clname,.sbody h3,.briefline,.ebody h4,.rn,.wbl";
  [].slice.call(document.querySelectorAll(sel)).forEach(function (n) {
    var t = (n.textContent || "").trim();
    if (/__DAYRE__/i.test(t)) out.push("day-prefix|" + t.slice(0, 60));
  });

  // 2. a sticky element must clear everything sticky above it
  var st = [].slice.call(document.querySelectorAll("*")).filter(function (n) {
    return getComputedStyle(n).position === "sticky" && n.offsetHeight > 0;
  });
  st.forEach(function (n) {
    var cs = getComputedStyle(n);
    if (cs.top === "auto") return;
    var mine = parseFloat(cs.top) || 0;
    st.forEach(function (m) {
      if (m === n || m.contains(n) || n.contains(m)) return;
      var ms = getComputedStyle(m);
      if (ms.top === "auto") return;
      var theirs = parseFloat(ms.top) || 0;
      // only things that share horizontal space can hide each other: a left-hand
      // rail and a middle column both pinned near the top are side by side
      var rn = n.getBoundingClientRect(), rm = m.getBoundingClientRect();
      if (rn.right <= rm.left + 1 || rm.right <= rn.left + 1) return;
      // equal tops are peers in a sequence — successive day headings replace one
      // another, which is what sticky is for, not an occlusion
      if (theirs >= mine) return;
      // m is pinned above n, so n must start below where m ends
      if (theirs + m.offsetHeight > mine + 1) {
        out.push("sticky-overlap|" + (m.className || m.tagName) + " ends at " +
                 Math.round(theirs + m.offsetHeight) + ", " +
                 (n.className || n.tagName) + " pins at " + Math.round(mine));
      }
    });
  });

  // 3. no --rule-* custom property is being used as a text colour
  var probe = document.createElement("span");
  document.body.appendChild(probe);
  var baseline = getComputedStyle(probe).color;
  var SKIP = { SCRIPT: 1, STYLE: 1, TITLE: 1, HEAD: 1, LINK: 1, META: 1 };
  ["--rule","--rule-p","--line","--line-h"].forEach(function (v) {
    probe.style.color = "";
    probe.style.color = "var(" + v + ")";
    var c = getComputedStyle(probe).color;
    // an undefined variable leaves the inherited colour, which would match half
    // the page; only a variable that resolves to something of its own counts
    if (!c || c === baseline || c === "rgba(0, 0, 0, 0)") return;
    [].slice.call(document.querySelectorAll("*")).forEach(function (n) {
      if (n === probe || SKIP[n.tagName]) return;
      // it is the element's own words that matter, not its descendants' —
      // .tally holds both a <b> and a text node, and the text node was the point
      var own = [].slice.call(n.childNodes).some(function (k) {
        return k.nodeType === 3 && k.textContent.trim();
      });
      if (!own) return;
      if (getComputedStyle(n).color === c) {
        out.push("rule-as-colour|" + (n.className || n.tagName) + " uses " + v);
      }
    });
  });
  probe.remove();

  var seen = {}, uniq = [];
  out.forEach(function (o) { if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
  document.title = "INV:" + uniq.length + "|" + uniq.slice(0, 6).join(" ;; ");
}, 700);</script>
"""


def run(page, frag, width=1400, extra=""):
    src = io.open(os.path.join(HERE, page), encoding="utf-8").read()
    probe = PROBE.replace("__DAYRE__", DAY_PREFIX)
    body = src.replace("</body>", extra + probe + "</body>", 1)
    tmp = os.path.join(HERE, "_inv-" + page)
    io.open(tmp, "w", encoding="utf-8").write(body)
    try:
        url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20")
        if frag:
            url += "#" + frag
        p = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                            "--window-size=%d,900" % width, "--dump-dom",
                            "--virtual-time-budget=11000", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>INV:(\d+)\|(.*?)</title>", p.stdout or "", re.S)
        if not m:
            return ["no-report|the page never finished running"]
        return [x for x in m.group(2).split(" ;; ") if x] if m.group(1) != "0" else []
    finally:
        os.remove(tmp)


STATES = {
    "a": [(BOARD, 1400), (BOARD + "&view=week", 1400), (BOARD + "&view=clash", 1400),
          (DENSE, 1400), (BOARD, 420)],
    "b": [(BOARD, 1400), (BOARD + "&by=where", 1400), (DENSE, 1400), (BOARD, 420)],
    "c": [(BOARD, 1400), (BOARD + "&full=1", 1400), (DENSE, 1400), (BOARD, 420)],
}


def check(v):
    page = "orientation-%s.html" % v
    bad = []
    for frag, width in STATES[v]:
        for issue in run(page, frag, width):
            bad.append("%s @%dpx  %s" % (v, width, issue))
    if bad:
        for b in bad[:8]:
            print("  FAIL  " + b)
        return False
    print("  ok    %s keeps its promises across %d states: no title repeats its own "
          "day, no sticky element hides another, no rule colour used as text"
          % (page, len(STATES[v])))
    return True


def selftest():
    """Prove each assertion goes red on a page built to break it."""
    print("Self-test — each assertion must fail on a known-bad page")
    cases = [
        ("day prefix in a visible title",
         "<script>setTimeout(function(){var n=document.querySelector('.bh,.ebody h4,.rn');"
         "if(n)n.textContent='Tuesday, Sept. 8 - Something';},300);</script>", "a"),
        ("a sticky element hidden behind another",
         "<style>.navstrip{position:sticky;top:0;height:120px}"
         ".dayhead{position:sticky;top:10px}</style>", "a"),
        ("a rule colour used as text",
         "<style>.tally{color:var(--line-h)}</style>", "a"),
    ]
    ok = True
    for name, inject, v in cases:
        found = run("orientation-%s.html" % v, BOARD, 1400, extra=inject)
        print("  %-42s -> %s" % (name, found[:2] if found else "MISSED"))
        if not found:
            ok = False
    return ok


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(0 if selftest() else 1)
    which = [a for a in sys.argv[1:] if a in "abc"] or ["a", "b", "c"]
    print("Rendered invariants")
    results = [check(v) for v in which]
    sys.exit(0 if all(results) else 1)
