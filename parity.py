REFERENCE = "orientation-classic.html"   # the original build, kept as the parity yardstick

"""Prove the variants show exactly what the incumbent shows.

Eligibility is the one thing in this project that six audit rounds got right, so a
variant is only allowed to differ in *how* it presents events, never in *which* events
it presents. This script drives real Chrome over the real generated pages and compares
the multiset of event titles rendered for a selection against the incumbent's.

    python parity.py            all variants, ~30 selections
    python parity.py a b        only those variants

It also checks two things that would let a drift in by the back door:

  * the eligibility core (gatesOf + assess) is byte-identical in every variant script;
  * no page raises a JavaScript error while rendering any of the selections.

Extraction, per page:
  incumbent  every <h3> is an event title, and the default board is "For me"
  a          the whole-run grid collapses crowded clusters into "+N more" tiles, so
             its day pages are walked for the days that carry one
  b, c       one page renders the whole eligible set
"""
import json, re, subprocess, sys, os, html, tempfile, shutil, urllib.parse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import atexit, threading

HERE = os.path.dirname(os.path.abspath(__file__))
# A full run takes minutes and reads each page fresh as it reaches it. Edit a file
# midway and the parity section tests one build while the console section tests
# another — which is how a run once reported a variant clean in the same breath as
# reporting it missing every event. Everything is snapshotted first, so a run is
# always a statement about one moment.
SNAP = None


def snapshot():
    global SNAP
    SNAP = tempfile.mkdtemp(prefix="parity-snap-")
    for name in os.listdir(HERE):
        if (name.startswith("orientation") and name.endswith(".html")) or            name.startswith(("_app_", "_style_", "_body_")) or name == "_app.js":
            shutil.copy2(os.path.join(HERE, name), os.path.join(SNAP, name))
    return SNAP


def at(name):
    """Read the snapshot, never the working tree."""
    return os.path.join(SNAP or HERE, name)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


# one reusable profile per run, and a sweep of what Chrome leaves behind
from _chrome import chrome_flags

GATES = ["International", "Exchange", "Indigenous", "Off-campus (LOCUS)", "Residence",
         "Mature & Transfer", "Accessible Learning", "Virtual"]

# ---------------------------------------------------------------- chrome ----
def dom(page, frag):
    url = "file:///" + at(page).replace("\\", "/").replace(" ", "%20")
    if frag:
        url += "#" + frag
    r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--dump-dom", "--virtual-time-budget=9000", url],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stdout or ""

SCRIPT = re.compile(r"<script[\s>].*?</script>", re.S | re.I)
def body_only(d):
    """The inlined application source contains the very markup we are grepping for,
    so the scripts have to come out before anything is counted."""
    return SCRIPT.sub("", d)

def frag_of(s):
    p = ("level=" + urllib.parse.quote(s["level"]) +
         "&campus=" + urllib.parse.quote(s["campus"]) +
         "&term=" + urllib.parse.quote(s["term"]))
    if s["streams"]:
        p += "&streams=" + urllib.parse.quote("|".join(s["streams"]))
    if s["program"]:
        p += "&program=" + urllib.parse.quote(s["program"])
    return p

# ------------------------------------------------------------ extraction ----
def titles_incumbent(s):
    d = dom(REFERENCE, frag_of(s))
    return Counter(html.unescape(t) for t in re.findall(r"<h3>(.*?)</h3>", body_only(d), re.S))

def marked(d):
    return Counter(html.unescape(t) for t in re.findall(r'data-ev-title="([^"]*)"', body_only(d)))

def titles_a(s):
    """A pages by day, so parity is also a proof that every eligible event is
    reachable through the day navigator — not merely present in one wide view.
    Counter union takes the max per title, which would hide a repeated title
    appearing on several days, so the day pages are summed instead."""
    base = frag_of(s)
    week = body_only(dom("orientation-a.html", base + "&view=week"))
    days = sorted(set(re.findall(r'class="bar[^"]*" data-day="([^"]+)"', week)))
    if not days:
        return marked(dom("orientation-a.html", base + "&view=week"))
    got = Counter()
    with ThreadPoolExecutor(max_workers=4) as ex:
        for c in ex.map(lambda k: marked(dom("orientation-a.html", base + "&view=day&day=" + k)), days):
            got += c
    return got

def titles_b(s):
    return marked(dom("orientation-b.html", frag_of(s)))

def titles_c(s):
    return marked(dom("orientation-c.html", frag_of(s)))

GRAB = {"a": titles_a, "b": titles_b, "c": titles_c}
PAGE = {"a": "orientation-a.html", "b": "orientation-b.html", "c": "orientation-c.html"}

# ------------------------------------------------------------ selections ----
def build_selections():
    ev = json.load(open(os.path.join(HERE, "events.json"), encoding="utf-8"))["events"]

    def pool(level, campus, term):
        return [e for e in ev
                if e["term"] == term and campus in (e.get("campuses") or [])
                and (e["level"] == level or e["level"] == "all" or e.get("open_to_all"))]

    levels = ["undergraduate", "graduate", "bachelor-of-education"]
    campuses = ["Waterloo", "Brantford", "Milton"]
    terms = sorted({e["term"] for e in ev}, key=lambda t: ("Fall" not in t, t))

    live = [(lv, cp, tm) for lv in levels for cp in campuses for tm in terms if pool(lv, cp, tm)]
    sels = []

    # every level/campus/term combination Laurier publishes anything for
    for lv, cp, tm in live:
        sels.append({"level": lv, "campus": cp, "term": tm, "streams": [], "program": ""})

    # each stream on its own, wherever it gates something
    for lv, cp, tm in live:
        p = pool(lv, cp, tm)
        streams = sorted({t for e in p for t in (e.get("tags") or []) if t in GATES})
        for t in streams:
            sels.append({"level": lv, "campus": cp, "term": tm, "streams": [t], "program": ""})
        if len(streams) > 1:
            sels.append({"level": lv, "campus": cp, "term": tm, "streams": streams, "program": ""})

    # programme narrowing, including "mine is not listed"
    for lv, cp, tm in live:
        progs = sorted({e["program"] for e in pool(lv, cp, tm) if e.get("program")})
        if progs:
            sels.append({"level": lv, "campus": cp, "term": tm, "streams": [], "program": progs[0]})
            sels.append({"level": lv, "campus": cp, "term": tm, "streams": [], "program": progs[len(progs) // 2]})
            sels.append({"level": lv, "campus": cp, "term": tm, "streams": [], "program": "__none__"})

    # a couple of loaded ones: streams and a programme together
    for lv, cp, tm in live[:4]:
        p = pool(lv, cp, tm)
        streams = sorted({t for e in p for t in (e.get("tags") or []) if t in GATES})
        progs = sorted({e["program"] for e in p if e.get("program")})
        if streams and progs:
            sels.append({"level": lv, "campus": cp, "term": tm,
                         "streams": streams[:2], "program": progs[0]})

    seen, out = set(), []
    for s in sels:
        k = (s["level"], s["campus"], s["term"], tuple(s["streams"]), s["program"])
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
    return out

def label(s):
    bits = [s["level"], s["campus"], s["term"]]
    if s["streams"]:
        bits.append("+".join(s["streams"]))
    if s["program"]:
        bits.append("prog=" + (s["program"] if s["program"] != "__none__" else "none"))
    return " / ".join(bits)

# ----------------------------------------------------------- core sameness --
CORE = re.compile(r"function gatesOf\(e\) \{.*?\n\}\n.*?function assess\(e\) \{.*?\n\}\n", re.S)

def core_check(names):
    def core(path):
        m = CORE.search(open(at(path), encoding="utf-8").read())
        return m.group(0) if m else None
    ref = core("_app.js")
    ok = True
    for n in names:
        if core("_app_%s.js" % n) != ref:
            print("  FAIL  _app_%s.js eligibility core differs from _app.js" % n)
            ok = False
    print("  %s  eligibility core byte-identical in %s" %
          ("ok  " if ok else "FAIL", ", ".join("_app_%s.js" % n for n in names)))
    return ok

# ------------------------------------------------------------- console ------
TRAP = ('<script>window.__e=[];addEventListener("error",function(v){__e.push(v.message)});'
        'addEventListener("unhandledrejection",function(){__e.push("promise")});</script>')
REPORT = ('<script>setTimeout(function(){document.title="JSERR:"+__e.length+"|"+__e.join(" // ")},60);'
          '</script>')

def console_check(page, frags, width=1400):
    """Run at a desktop width. At the headless default of 800px, variant A forces
    itself out of its whole-run view, so a view that threw on every render passed
    this check for two rounds."""
    src = open(at(page), encoding="utf-8").read()
    probed = src.replace("<head>", "<head>" + TRAP, 1).replace("</body>", REPORT + "</body>", 1)
    tmp = os.path.join(tempfile.gettempdir(), "probe-" + page)
    open(tmp, "w", encoding="utf-8").write(probed)
    bad = []
    def run(f):
        url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20") + ("#" + f if f else "")
        r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                            "--window-size=%d,900" % width,
                            "--dump-dom", "--virtual-time-budget=9000", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>JSERR:(\d+)\|(.*?)</title>", r.stdout or "", re.S)
        if not m:
            # Under four parallel Chromes a page can miss its budget and report
            # nothing, which is indistinguishable from a page that hung. One
            # serial retry tells them apart; a real hang fails twice.
            r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                                "--window-size=%d,900" % width,
                                "--dump-dom", "--virtual-time-budget=20000", url],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            m = re.search(r"<title>JSERR:(\d+)\|(.*?)</title>", r.stdout or "", re.S)
        if not m:
            return (f, "no report — the page never finished running, twice")
        if m.group(1) != "0":
            return (f, m.group(2)[:200])
        return None
    with ThreadPoolExecutor(max_workers=4) as ex:
        for r in ex.map(run, frags):
            if r:
                bad.append(r)
    os.remove(tmp)
    return bad

# ------------------------------------------------- one answer, one function --
def shared_logic_check(names):
    """Round 3 put an overlap feature into two variants at once and both got it
    wrong the same way. Anything copied into more than one variant is a place
    where the same bug can be fixed once and left standing twice, so the
    functions that decide *facts* — when an event runs, which listings are the
    same event, how prose is broken — must be byte-identical wherever they
    appear. Presentation may differ; facts may not."""
    def body(path, name):
        src = open(at(path), encoding="utf-8").read()
        m = re.search(r"^function %s\(" % name, src, re.M)
        if not m:
            return None
        i = m.start()
        k = src.index("{", i) + 1
        d = 1
        while d:
            if src[k] == "{":
                d += 1
            elif src[k] == "}":
                d -= 1
            k += 1
        return src[i:k]

    ok = True
    for name in ("parseWhen", "sentences", "paras", "gatesOf", "assess",
                 "stripDay", "stripLead", "dupKey", "sameEvent"):
        got = {}
        for n in names:
            b = body("_app_%s.js" % n, name)
            if b:
                got[n] = b
        if len(got) < 2:
            continue
        if len(set(got.values())) != 1:
            print("  FAIL  %s() differs between %s — the variants can disagree "
                  "about the same fact" % (name, ", ".join(sorted(got))))
            ok = False
    print("  %s  time parsing, prose breaking, duplicate identity and the "
          "eligibility core are one implementation everywhere" % ("ok  " if ok else "FAIL"))
    return ok


# --------------------------------------------------- the board is not empty --
SMOKE = ('<script>setTimeout(function(){var n=document.querySelectorAll("[data-ev-title]").length;'
         r'var t=document.body.innerText.match(/(\d+)\s+events? you can attend/);'
         r'var c=document.body.innerText.match(/(\d+)\s+records?/);'
         'var e=document.querySelector(".empty,.none,.rempty,.clashhead,.loosebar")?1:0;'
         'document.title="SMOKE:"+n+"|"+((t&&t[1])||(c&&c[1])||"?")+"|"+e;},400);</script>')


def smoke_check(names, sels):
    """A board that renders nothing while the counter still says 108 is the worst
    failure this project can have, and it is invisible to a screenshot of the
    desktop layout. Every level x campus x stream combination, at three widths,
    must put at least one event in the DOM whenever the counter is non-zero."""
    jobs = []
    for n in names:
        page = "orientation-%s.html" % n
        src = open(at(page), encoding="utf-8").read()
        tmp = os.path.join(tempfile.gettempdir(), "smoke-" + page)
        open(tmp, "w", encoding="utf-8").write(src.replace("</body>", SMOKE + "</body>", 1))
        extra = {"a": ["&view=week", "&view=clash"], "b": ["&by=where"], "c": ["&full=1"]}
        for s in sels:
            for w in (380, 700, 1400):
                jobs.append((n, tmp, frag_of(s), label(s), w))
            for x in extra.get(n, []):
                jobs.append((n, tmp, frag_of(s) + x, label(s) + x, 1400))

    def run(job):
        n, tmp, frag, lab, w = job
        url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20") + "#" + frag
        r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                            "--window-size=%d,900" % w, "--dump-dom",
                            "--virtual-time-budget=9000", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>SMOKE:(\d+)\|(\d+|\?)\|(\d)</title>", r.stdout or "")
        if not m:
            r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                                "--window-size=%d,900" % w, "--dump-dom",
                                "--virtual-time-budget=20000", url],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            m = re.search(r"<title>SMOKE:(\d+)\|(\d+|\?)\|(\d)</title>", r.stdout or "")
        if not m:
            return (n, w, lab, "no report - the page never finished running, twice")
        drawn, says, explained = int(m.group(1)), m.group(2), m.group(3) == "1"
        # A filtered lens may legitimately have nothing to show. Drawing nothing is
        # only a failure when the page also says nothing about why.
        if says != "?" and int(says) > 0 and drawn == 0 and not explained:
            return (n, w, lab, "counter says %s, board drew nothing and explained nothing" % says)
        return None

    bad = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for r in ex.map(run, jobs):
            if r:
                bad.append(r)
    if bad:
        for n, w, lab, msg in bad[:8]:
            print("  FAIL  %s @%dpx  %s  ->  %s" % (n, w, lab[:52], msg))
        print("  %d of %d board states drew nothing" % (len(bad), len(jobs)))
        return False
    print("  ok    %d board states across %d widths, none empty while the counter "
          "was not" % (len(jobs), 3))
    return True


# ------------------------------------------------------- clean characters ---
def control_check(names):
    """A stray DEL or NUL from a bad patch renders as an invisible glyph in a
    heading and survives every other test. It should not survive this one."""
    ok = True
    files = ["_app_%s.js", "_style_%s.css", "_body_%s.html"]
    for n in names:
        for pat in files + ["orientation-%s.html"]:
            path = at(pat % n)
            if not os.path.exists(path):
                continue
            src = open(path, encoding="utf-8").read()
            allowed = (9, 10, 13)
            # C1 (127-159) as well as C0: _style_a.css carried a U+0091 beside
            # its U+0002 -- both halves of the same mangled pair of CSS escapes
            # -- and only the U+0002 was ever reported.
            bad = sorted({ord(c) for c in src
                          if (ord(c) < 32 and ord(c) not in allowed)
                          or 127 <= ord(c) <= 159})
            if bad:
                print("  FAIL  %s carries %s" % (os.path.basename(path),
                      ", ".join("U+%04X" % b for b in bad)))
                ok = False
    print("  %s  no stray control characters in any variant source or page" %
          ("ok  " if ok else "FAIL"))

    # An unbalanced brace does not make a stylesheet fail to load. It makes every
    # rule after it disappear, silently, while the page still renders.
    braces = True
    for n in names:
        path = at("_style_%s.css" % n)
        depth, where = 0, None
        for i, ch in enumerate(open(path, encoding="utf-8").read()):
            if ch == "{":
                depth += 1
                if where is None:
                    where = i
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    where = None
                if depth < 0:
                    break
        if depth != 0:
            print("  FAIL  _style_%s.css has %d unclosed block(s) — every rule after "
                  "the first is being discarded" % (n, depth))
            braces = False
    print("  %s  stylesheets balance" % ("ok  " if braces else "FAIL"))
    return ok and braces


# ------------------------------------------------------- links survive ------
LINKCORE = re.compile(r"var links = .e\.l \|\| \[\].\.slice\(\);.*?\}\);", re.S)

def link_core_check(names):
    """Every variant must assemble the same link set from the same three fields."""
    def core(path):
        m = LINKCORE.search(open(at(path), encoding="utf-8").read())
        return m.group(0) if m else None
    ref = core("_app.js")
    ok = ref is not None
    for n in names:
        if core("_app_%s.js" % n) != ref:
            print("  FAIL  _app_%s.js assembles links differently from _app.js" % n)
            ok = False
    print("  %s  link assembly byte-identical in every variant" % ("ok  " if ok else "FAIL"))
    # Laurier leaked a CMS authoring URL into a published page. It must stay visible
    # and stay unclickable, in every variant.
    dead = True
    for n in names:
        src = open(at("_app_%s.js" % n), encoding="utf-8").read()
        if "cms03.wlu.ca" not in src or "link broken on Laurier" not in src:
            print("  FAIL  _app_%s.js drops the flag on Laurier's dead link" % n)
            dead = False
    print("  %s  Laurier's dead link still shown, still unclickable" % ("ok  " if dead else "FAIL"))
    return ok and dead


def expected_links(sel_dict, ev):
    """Every href the incumbent would render for this selection, from the data."""
    want = set()
    for e in ev:
        if not eligible(e, sel_dict):
            continue
        seen = []
        for l in (e.get("links") or []) + (e.get("section_links") or []) + (e.get("page_links") or []):
            if l["href"] not in seen:
                seen.append(l["href"])
        for href in seen:
            if "//cms03.wlu.ca" not in href:      # Laurier's own dead link renders as text
                want.add(href)
        want.add(e["url"])
    return want


def eligible(e, s):
    if e["term"] != s["term"]:
        return False
    if s["campus"] not in (e.get("campuses") or []):
        return False
    if not (e["level"] == s["level"] or e["level"] == "all" or e.get("open_to_all")):
        return False
    g = [t for t in (e.get("tags") or []) if t in GATES]
    if g and not [t for t in g if t in s["streams"]]:
        return False
    if s["program"] == "__none__" and e.get("program"):
        return False
    if s["program"] and s["program"] != "__none__" and e.get("program") and e["program"] != s["program"]:
        return False
    return True


def links_check(sels):
    """Variant C in full-text mode writes every link and citation of every event
    into the page, so it can prove end to end that none were lost."""
    ev = json.load(open(os.path.join(HERE, "events.json"), encoding="utf-8"))["events"]
    bad = 0
    for s in sels:
        d = body_only(dom("orientation-c.html", frag_of(s) + "&full=1"))
        got = set(html.unescape(h) for h in re.findall(r'href="([^"]+)"', d))
        want = expected_links(s, ev)
        missing = want - got
        if missing:
            bad += 1
            print("  FAIL  %s — %d links missing, e.g. %s" %
                  (label(s), len(missing), sorted(missing)[:2]))
    if not bad:
        total = sum(len(expected_links(s, ev)) for s in sels)
        print("  ok    every registration link and citation present across %d selections "
              "(%d hrefs)" % (len(sels), total))
    return bad == 0


# ---------------------------------------------------------------- main ------
def main():
    names = [a for a in sys.argv[1:] if a in GRAB] or ["a", "b", "c"]
    snapshot()
    sels = build_selections()
    print("Parity: %d selections x %d variants, against orientation.html\n" % (len(sels), len(names)))

    print("Eligibility core")
    core_ok = core_check(names)

    print("\nBaseline: reading the incumbent")
    with ThreadPoolExecutor(max_workers=4) as ex:
        base = list(ex.map(titles_incumbent, sels))
    empty = [label(s) for s, b in zip(sels, base) if not b]
    print("  %d selections, %d..%d events each%s" %
          (len(sels), min(sum(b.values()) for b in base), max(sum(b.values()) for b in base),
           ("  (%d render nothing)" % len(empty)) if empty else ""))

    all_ok = core_ok
    for n in names:
        print("\norientation-%s.html" % n)
        with ThreadPoolExecutor(max_workers=3) as ex:
            got = list(ex.map(GRAB[n], sels))
        fails = 0
        for s, b, g in zip(sels, base, got):
            if b != g:
                fails += 1
                miss = b - g
                extra = g - b
                print("  FAIL  %s" % label(s))
                if miss:
                    print("        missing %d: %s" % (sum(miss.values()), list(miss)[:4]))
                if extra:
                    print("        extra   %d: %s" % (sum(extra.values()), list(extra)[:4]))
        if fails:
            all_ok = False
            print("  %d of %d selections differ" % (fails, len(sels)))
        else:
            print("  ok    all %d selections match the incumbent exactly "
                  "(%d event renderings compared)" % (len(sels), sum(sum(b.values()) for b in base)))

    print("\nEmpty-board smoke")
    all_ok = smoke_check(names, [x for x in sels if not x["program"]][:14]) and all_ok

    print("\nSource hygiene")
    all_ok = control_check(names) and all_ok

    print("\nLinks and citations")
    all_ok = link_core_check(names) and all_ok
    all_ok = links_check(sels[:10]) and all_ok

    print("\nConsole errors")
    probe = [frag_of(s) for s in sels[:14]]
    for page, extra in [("orientation.html", []),
                        ("orientation-a.html", ["&view=day&day=2026-09-08", "&view=week"]),
                        ("orientation-b.html", ["&by=where", "&by=host", "&by=daypart",
                                                "&by=stream", "&by=section", "&all=1", "&q=residence"]),
                        ("orientation-c.html", ["&picks=1|2|3", "&only=1", ""])]:
        frags = probe + [probe[0] + x for x in extra]
        if page == "orientation-c.html":
            frags.append("")
        bad = console_check(page, frags, 1400) + console_check(page, frags, 420)
        if bad:
            all_ok = False
            print("  FAIL  %s" % page)
            for f, msg in bad[:6]:
                print("        %s  ->  %s" % (f[:60], msg))
        else:
            print("  ok    %s  — %d states, zero errors" % (page, len(frags)))

    print("\n%s" % ("ALL PASSED" if all_ok else "FAILURES ABOVE"))
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
