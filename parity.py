REFERENCE = "_yardstick.html"   # the plain listing the board is measured against

"""Prove the variants show exactly the events the incumbent shows — merged, never lost.

Eligibility is the one thing in this project that six audit rounds got right, so a
variant is only allowed to differ in *how* it presents events, never in *which* events
it presents.

The rule this script enforces changed once, deliberately. It used to be that a
board renders the same *multiset* of listings as the yardstick:
Laurier publishes one session on two of its schedule pages, the incumbent draws it
twice, so a variant had to draw it twice too. The variants now draw it once and
name both pages in its detail, so the rule is now:

  1. the incumbent still renders every listing Laurier publishes for the selection
     (the reference is checked against the data, so nothing downstream rests on a
     model of eligibility that was never compared to a real page);
  2. a variant renders exactly one entry per *distinct event* — same set, no event
     dropped, none invented, none drawn twice;
  3. and for every listing folded into an entry, that listing's own source URL is
     reachable in the entry's detail. Nothing is lost; it is merged.

Rule 3 is what stops rule 2 being a licence to throw things away, and it is proved
by driving the real interface: every entry on the board is clicked open and the
addresses in the detail that appears are read back out of the DOM.

"Distinct" is dupKey(), and dupkey.py answers that by running the page's own
dupKey() rather than re-implementing it, so the Python side of this gate cannot
drift from the JavaScript side.

    python parity.py            all variants, ~80 selections
    python parity.py a b        only those variants

It also checks what would let a drift in by the back door:

  * the eligibility core (gatesOf + assess) is byte-identical in every variant script;
  * so are the functions that decide facts, duplicate identity among them;
  * link assembly still gathers exactly what the incumbent gathered, per listing;
  * no page raises a JavaScript error while rendering any of the selections.

Extraction, per page:
  incumbent  every <h3> is a listing, and the default board is "For me"
  a, a-plus  the whole-run view carries every entry; the day navigator is walked
             separately, to prove each is also reachable a day at a time
  b, c       one page renders the whole eligible set
"""
import base64, glob, json, re, subprocess, sys, os, html, tempfile, shutil, urllib.parse
from collections import Counter

import dupkey
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
    """Copy what this run reads, then prove the copy has it.

    The filter used to be a set of prefixes, and the yardstick was renamed to one
    the prefixes did not match. Chrome then rendered a file that was not there,
    every link came back missing, and the run reported eight failing selections
    rather than the one missing file. A gate that cannot see its subject must say
    so, not report the absence as a defect in the thing it was measuring."""
    global SNAP
    SNAP = tempfile.mkdtemp(prefix="parity-snap-")
    needed = {REFERENCE} | set(PAGE.values())
    for name in os.listdir(HERE):
        if name in needed or name.startswith(("_app_", "_style_", "_body_"))            or name == "_app.js":
            shutil.copy2(os.path.join(HERE, name), os.path.join(SNAP, name))
    absent = [n for n in sorted(needed) if not os.path.exists(os.path.join(SNAP, n))]
    if absent:
        sys.exit("parity cannot run: %s missing from the working tree. Run "
                 "build_all.py first." % ", ".join(absent))
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
def dom(page, frag, width=1400):
    """Read at a desktop width. Chrome headless defaults to 800px, where variant A
    forces itself out of the whole-run view into a single day — so a check that
    asked for &view=week got one Tuesday and did not say so."""
    url = "file:///" + at(page).replace("\\", "/").replace(" ", "%20")
    if frag:
        url += "#" + frag
    r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--window-size=%d,900" % width,
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

def titles_week(page, s):
    """The A family in its whole-run view, which carries every entry on the board.
    That every entry is *also* reachable a day at a time is a separate claim, and
    day_walk_check() makes it separately rather than folding the two together."""
    return marked(dom(page, frag_of(s) + "&view=week"))


def titles_by_day(page, s):
    """The same board read through the day navigator, one day page at a time.
    A day the navigator does not offer falls back to the first day, which can only
    repeat events already counted, so this is compared as a set: what matters is
    that nothing is reachable in the whole-run view and nowhere else. The old
    regex here looked for a class the week view has never emitted, so this walk
    silently fell through to reading the week view a second time."""
    base = frag_of(s)
    # the day rail is drawn in every view and names every day on the board
    nav = body_only(dom(page, base))
    days = sorted(set(re.findall(r'class="bar[^"]*" data-day="([^"]+)"', nav)))
    if "TBA" not in days:
        days.append("TBA")   # Laurier publishes some events with no date at all
    got = set()
    with ThreadPoolExecutor(max_workers=4) as ex:
        for c in ex.map(lambda k: marked(dom(page, base + "&view=day&day=" + k)), days):
            got |= set(c)
    return got


def titles_main(s):
    return titles_week("orientation.html", s)

GRAB = {"main": titles_main}
PAGE = {"main": "orientation.html"}

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
    """There must be exactly one implementation of each fact.

    Round 3 put an overlap feature into two variants at once and both got it wrong
    the same way, so this used to require that anything copied into more than one
    variant was byte-identical. There is one board now, which is the stronger form
    of the same guarantee — but a check that merely stops finding second copies
    would report "ok" while verifying nothing, so it states what it found instead.

    A second copy appearing later is the failure this exists to catch: two scripts
    defining the same fact must agree to the byte, and if they do not, that is the
    old drift returning under a new name."""
    FACTS = ("parseWhen", "sentences", "paras", "gatesOf", "assess",
             "stripDay", "stripLead", "dupKey", "sameEvent",
             "publishedDetail", "listingRank", "onePerEvent",
             "attendable", "copiesIn", "sourcesOf", "allLinksOf", "audienceLine",
             "clockStates", "legendKeys", "dayEntries")

    def body(path, name):
        src = open(path, encoding="utf-8").read()
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

    scripts = sorted(glob.glob(os.path.join(HERE, "_app*.js")))
    ok, single, shared, missing = True, 0, 0, []
    for name in FACTS:
        got = {}
        for path in scripts:
            b = body(path, name)
            if b:
                got[os.path.basename(path)] = b
        if not got:
            missing.append(name)
            ok = False
        elif len(got) == 1:
            single += 1
        else:
            shared += 1
            if len(set(got.values())) != 1:
                print("  FAIL  %s() differs between %s - two scripts disagree about "
                      "the same fact" % (name, ", ".join(sorted(got))))
                ok = False
    if missing:
        print("  FAIL  no script defines: %s - this list has drifted from the code"
              % ", ".join(missing))
    print("  %s  %d facts have exactly one implementation across %d script(s); %d appear "
          "in more than one and are byte-identical"
          % ("ok  " if ok else "FAIL", single, len(scripts), shared))
    return ok


# --------------------------------------------------- the board is not empty --
SMOKE = ('<script>setTimeout(function(){var n=document.querySelectorAll("[data-ev-title]").length;'
         r'var t=document.body.innerText.match(/(\d+)\s+events? you can attend/);'
         r'var c=document.body.innerText.match(/(\d+)\s+records?/);'
         'var e=document.querySelector(".empty,.none,.rempty,.clashhead,.loosebar,.planhead,.reghead")?1:0;'
         'document.title="SMOKE:"+n+"|"+((t&&t[1])||(c&&c[1])||"?")+"|"+e;},400);</script>')


def smoke_check(names, sels):
    """A board that renders nothing while the counter still says 108 is the worst
    failure this project can have, and it is invisible to a screenshot of the
    desktop layout. Every level x campus x stream combination, at three widths,
    must put at least one event in the DOM whenever the counter is non-zero."""
    jobs = []
    for n in names:
        page = PAGE[n]
        src = open(at(page), encoding="utf-8").read()
        tmp = os.path.join(tempfile.gettempdir(), "smoke-" + page)
        open(tmp, "w", encoding="utf-8").write(src.replace("</body>", SMOKE + "</body>", 1))
        extra = {"main": ["&view=week", "&view=clash", "&view=plan", "&view=reg",
                          "&q=lazaridis"]}
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


# a short lead-in, then a dash: what stripDay is expected to have taken off
DASHLEAD = re.compile(r"^[^-\u2013\u2014]{1,24}\s[-\u2013\u2014]\s")

# ------------------------------------------------- one event, one entry ------
def title_check():
    """Laurier writes the day into some of its own titles, and stripDay() takes it
    off again so that two copies of one event file under one key. That is checked
    here from the other side, by a rule that knows nothing about the prefix: any
    two listings agreeing on date, published time and venue, whose titles agree
    once a short lead-in before a dash is dropped, are the same event and must
    have folded into one entry.

    Written that way because both failures were prefixes stripDay did not
    recognise. Laurier publishes "Wednedday, Sept. 9 - Your First Grocery Store
    Tour in Canada", its own misspelling, and "Daily - LOCUS Orientation Hub"
    beside "LOCUS Orientation Hub", and each drew a card twice, one of them under
    a heading that already said the day. A gate that stripped prefixes the way the
    page does would have agreed with it and seen nothing."""
    def fold(x):
        return " ".join(str(x or "").split()).lower()

    def tail(t):
        # a short lead-in and a dash: "Daily - ", "Wednedday, Sept. 9 - ". Case is
        # kept, because dupKey keeps it: the Bachelor of Education page's "Hobbies
        # fair" and the undergraduate page's "Hobbies Fair" are two listings no
        # student can ever see together, and folding them here would ask the page
        # for a merge it must not make.
        m = re.match(DASHLEAD, t or "")
        return (t[m.end():] if m else (t or "")).strip()

    groups = {}
    for e in EVENTS:
        k = (e.get("date") or "", fold(e.get("when")), fold(e.get("where")), tail(e["title"]))
        groups.setdefault(k, []).append(e)
    split = [(k, sorted({x["title"] for x in v}))
             for k, v in groups.items() if len({dupkey.key_of(x) for x in v}) > 1]
    for k, titles in split[:4]:
        print("  FAIL  %s %s is filed as %d different events: %s"
              % (k[0], k[3][:40], len(titles), titles))
    if split:
        print("  %d of Laurier's own repeats are still drawn more than once" % len(split))
        return False
    print("  ok    %d listings, %d distinct events: no repeat survives a day prefix "
          "the page did not expect" % (len(EVENTS), len(dupkey.fold(EVENTS))))

    # and the two it did not expect, named, because they are what this is for.
    # Both events run more than once, so the claim is not that every listing of
    # the name is one event: it is that the prefixed listing and the plain one
    # sharing its day, hour and room end up under the same key, printed plainly.
    named = True
    for prefixed, plain in (
            ("Wednedday, Sept. 9 - Your First Grocery Store Tour in Canada",
             "Your First Grocery Store Tour in Canada"),
            ("Daily - LOCUS Orientation Hub", "LOCUS Orientation Hub")):
        held = {}
        for e in EVENTS:
            if e["title"] in (prefixed, plain):
                held.setdefault(dupkey.key_of(e), set()).add(e["title"])
        merged = [k for k, t in held.items() if t == {prefixed, plain}]
        stray = [e for e in EVENTS if e["title"] == prefixed
                 and dupkey.shown_title(e) != plain]
        if len(merged) != 1 or stray:
            print("  FAIL  %s: %d keys hold both listings, %d still print the prefix"
                  % (prefixed[:44], len(merged), len(stray)))
            named = False
    if named:
        print("  ok    Laurier's misspelled weekday and its Daily label are both stripped, "
              "and each of those two events is named once")
    return named



# ------------------------------------------------------- clean characters ---
def control_check(names):
    """A stray DEL or NUL from a bad patch renders as an invisible glyph in a
    heading and survives every other test. It should not survive this one."""
    ok = True
    files = ["_app_%s.js", "_style_%s.css", "_body_%s.html"]
    for n in names:
        for pat in files:
            path = at(pat % n)
            if not os.path.exists(path):
                continue
            src = open(path, encoding="utf-8").read()
            allowed = (9, 10, 13)
            bad = sorted({ord(c) for c in src
                          if (ord(c) < 32 and ord(c) not in allowed)
                          or 127 <= ord(c) <= 159})
            if bad:
                print("  FAIL  %s carries %s" % (os.path.basename(path),
                      ", ".join("U+%04X" % b for b in bad)))
                ok = False
        for pat in [PAGE[n]]:
            path = at(pat)
            if not os.path.exists(path):
                continue
            src = open(path, encoding="utf-8").read()
            allowed = (9, 10, 13)
            # C1 (127-159) as well as C0: a stylesheet once carried a U+0091 beside
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
LINK_EQUIV = r"""
const fs = require('fs');
function body(src, name) {
  const i = src.indexOf('\nfunction ' + name + '(') + 1;
  if (i === 0) throw new Error('no ' + name);
  let k = src.indexOf('{', i) + 1, d = 1;
  while (d) { if (src[k] === '{') d++; else if (src[k] === '}') d--; k++; }
  return src.slice(i, k);
}
const APP = fs.readFileSync(process.argv[2], 'utf8');
const META = {sources: []};
eval(body(APP, 'sourceTitle'));
var SRCTITLE = {};
eval(body(APP, 'allLinksOf'));
/* the incumbent's assembly, lifted out of _app.js as it stands */
function incumbent(e) {
  var links = (e.l || []).slice();
  (e.sl || []).concat(e.pl || []).forEach(function (l) {
    if (!links.some(function (x) { return x.href === l.href; })) links.push(l);
  });
  return links;
}
const K = {links:'l', section_links:'sl', page_links:'pl'};
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).events.map(function (e) {
  const o = {}; for (const l in K) o[K[l]] = e[l]; return o;
});
let bad = 0;
rows.forEach(function (e) {
  const a = JSON.stringify(allLinksOf(e, [e]).map(function (l) { return l.href; }));
  const b = JSON.stringify(incumbent(e).map(function (l) { return l.href; }));
  if (a !== b) bad++;
});
process.stdout.write(String(bad) + ' ' + String(rows.length));
"""


def link_core_check(names):
    """The variants no longer read one listing's links: they read every listing of
    the event, because Laurier attaches a registration link to the Brantford copy
    and not the Waterloo one. That is a widening, and a widening is exactly where
    a rule quietly stops matching the incumbent's, so it is checked rather than
    asserted: allLinksOf() is run over every event, one listing at a time, and
    must return byte-for-byte what _app.js's own assembly returns."""
    ok = True
    d = tempfile.mkdtemp(prefix="linkcore-")
    js = os.path.join(d, "run.js")
    open(js, "w", encoding="utf-8").write(LINK_EQUIV)
    r = subprocess.run(["node", js, at("_app_main.js"), os.path.join(HERE, "events.json")],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        print("  FAIL  could not run allLinksOf(): %s" % (r.stderr or r.stdout)[:200])
        ok = False
    else:
        bad, total = r.stdout.split()
        if bad != "0":
            print("  FAIL  allLinksOf() differs from the incumbent's assembly on %s of %s "
                  "listings" % (bad, total))
            ok = False
        else:
            print("  ok    on a single listing, allLinksOf() returns exactly what _app.js "
                  "assembles, for all %s events" % total)
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
    # No programme chosen is the same state as "__none__": the board holds the
    # programme welcomes back until a student names theirs. There is no longer a
    # setting that shows all of them, so an empty selection cannot mean that here.
    prog = s["program"] or "__none__"
    if prog == "__none__" and e.get("program"):
        return False
    if prog != "__none__" and e.get("program") and e["program"] != prog:
        return False
    return True


def links_check(sels):
    """No registration link or citation is lost between the data and a page.

    The yardstick writes every link of every listing straight into the DOM, so it
    is the one page where this can be proved by reading the markup. The board
    keeps links in the detail sheet and renders them when the sheet opens, which
    is why it cannot be read this way and is covered instead by link_core_check
    (allLinksOf() returns exactly what the yardstick assembles, for every listing
    listings) and by the harvest, which opens sheets and collects what they draw.

    Asking the board for these links directly reports every one of them missing —
    which is what this check did when it was first pointed at the board, and the
    failure looked like lost data rather than a misdirected question."""
    ev = json.load(open(os.path.join(HERE, "events.json"), encoding="utf-8"))["events"]
    bad = 0
    for s in sels:
        d = body_only(dom(REFERENCE, frag_of(s)))
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



# ------------------------------------------- what the data says is on a board --
EVENTS = dupkey.events()


def listings(s):
    """Every listing Laurier publishes that this student may attend."""
    return [e for e in EVENTS if eligible(e, s)]


def distinct(s):
    """One entry per distinct event on that board — what a variant must render."""
    return dupkey.fold(listings(s))


def wanted_titles(s):
    """The titles a variant must print, one per distinct event. Compared on the
    title the page actually shows: Laurier writes the day into some of its own
    titles, the pages strip it before printing, and which listing of an event
    supplies the string is a presentation choice this gate has no business
    pinning down."""
    return Counter(dupkey.shown_title(e) for e in distinct(s))


def reference_check(sels, base):
    """The yardstick has to be checked too.

    Everything below is measured against a model of eligibility written in this
    file. If that model were wrong, every variant could agree with it and the run
    would come back green while the board showed the wrong events. So the model is
    first held against the yardstick, which renders one <h3> per
    listing and has not been touched: for every selection, the listings the model
    says are eligible must be exactly the ones the incumbent draws."""
    bad = 0
    for s, got in zip(sels, base):
        want = Counter(e["title"] for e in listings(s))
        if want != got:
            bad += 1
            if bad <= 4:
                print("  FAIL  %s" % label(s))
                print("        incumbent draws %d, the data model says %d"
                      % (sum(got.values()), sum(want.values())))
                miss, extra = want - got, got - want
                if miss:
                    print("        the model expects and the page omits: %s" % list(miss)[:3])
                if extra:
                    print("        the page draws and the model omits: %s" % list(extra)[:3])
    if bad:
        print("  %d of %d selections differ" % (bad, len(sels)))
        return False
    print("  ok    %s renders exactly the listings the eligibility model predicts "
          "across all %d selections (%d listings)"
          % (REFERENCE, len(sels), sum(sum(b.values()) for b in base)))
    return True


# ------------------------------------- nothing lost, only merged -------------
# Every entry on the board is opened and the addresses in its detail are read
# back. `sel` finds the entries; `detail` is the element the page fills when one
# is opened, or None where the page writes the detail inline and nothing needs
# clicking.
MERGE = {
    "main": dict(page="orientation.html", extra="&view=week",
                 sel="#board [data-id]", detail="#sheet"),
}

HARVEST = """<script>
setTimeout(function () {
  var out = {}, nodes = [].slice.call(document.querySelectorAll(%(sel)s));
  nodes.forEach(function (n) {
    var box = n;
    %(open)s
    var got = [].slice.call(box.querySelectorAll("a[href]")).map(function (a) {
      return a.getAttribute("href");
    });
    var id = n.getAttribute("data-id");
    out[id] = (out[id] || []).concat(got);
  });
  var s = document.createElement("i");
  s.id = "harvest";
  s.textContent = btoa(unescape(encodeURIComponent(JSON.stringify(out))));
  document.body.appendChild(s);
}, 500);
</script>"""

OPEN_TMPL = ('n.click(); box = document.querySelector(%s); '
             'if (!box) { box = document.createElement("div"); }')


def harvest(name, s):
    """Open every entry on the board and collect the addresses in its detail."""
    cfg = MERGE[name]
    js = HARVEST % {
        "sel": json.dumps(cfg["sel"]),
        "open": OPEN_TMPL % json.dumps(cfg["detail"]) if cfg["detail"] else "",
    }
    src = open(at(cfg["page"]), encoding="utf-8").read()
    tmp = os.path.join(tempfile.gettempdir(), "harvest-" + cfg["page"])
    open(tmp, "w", encoding="utf-8").write(src.replace("</body>", js + "</body>", 1))
    url = ("file:///" + tmp.replace("\\", "/").replace(" ", "%20") + "#" +
           frag_of(s) + cfg["extra"])
    r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--window-size=1400,900", "--dump-dom",
                        "--virtual-time-budget=25000", url],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    os.remove(tmp)
    m = re.search(r'<i id="harvest">([A-Za-z0-9+/=]*)</i>', r.stdout or "")
    if not m:
        return None
    return json.loads(base64.b64decode(m.group(1)).decode("utf-8"))


def merge_check(names, sels):
    """The rule that keeps "render it once" from meaning "throw one away".

    For each selection: the set of distinct events the page opened must be exactly
    the set the data says is on that board — no event drawn twice, none missing,
    none invented — and for every listing folded into an entry, that listing's own
    citation URL must be present in the entry's detail. A page that merged two
    listings and kept only one of their sources fails here."""
    ok = True
    for name in names:
        mine = True
        checked = folded = 0
        for s in sels:
            got = harvest(name, s)
            if got is None:
                print("  FAIL  %s  %s  ->  the board never reported" % (name, label(s)[:48]))
                mine = False
                continue
            want = listings(s)
            by_key = {}
            for e in want:
                by_key.setdefault(dupkey.key_of(e), []).append(e)

            drawn = {}
            for sid, hrefs in got.items():
                e = EVENTS[int(sid)]
                k = dupkey.key_of(e)
                drawn.setdefault(k, []).extend(hrefs)

            if set(drawn) != set(by_key):
                miss = set(by_key) - set(drawn)
                extra = set(drawn) - set(by_key)
                print("  FAIL  %s  %s  ->  %d distinct events drawn, %d expected"
                      % (name, label(s)[:48], len(drawn), len(by_key)))
                if miss:
                    print("        never drawn: %s" % [k.split(" § ")[0] for k in list(miss)[:3]])
                if extra:
                    print("        drawn but not eligible: %s"
                          % [k.split(" § ")[0] for k in list(extra)[:3]])
                mine = False
                continue

            if len(got) != len(by_key):
                print("  FAIL  %s  %s  ->  %d entries for %d distinct events; one is "
                      "drawn more than once" % (name, label(s)[:48], len(got), len(by_key)))
                mine = False
                continue

            for k, copies in by_key.items():
                if len(copies) > 1:
                    folded += 1
                seen = set(drawn[k])
                lost = [o["url"] for o in copies if o["url"] not in seen]
                if lost:
                    print("  FAIL  %s  %s  ->  %s was published on %d Laurier pages and "
                          "the detail reaches %d" % (name, label(s)[:40], copies[0]["title"][:40],
                                                     len(copies), len(copies) - len(lost)))
                    print("        unreachable: %s" % lost[:2])
                    mine = False
            checked += len(by_key)
        if checked:
            print("  %s  %-6s %d entries opened across %d selections; %d of them were "
                  "published by Laurier more than once, and every page of every one is "
                  "reachable in its detail" %
                  ("ok  " if mine else "FAIL", name, checked, len(sels), folded))
        ok = ok and mine
    return ok


def day_walk_check(names, sels):
    """Every entry in the whole-run view must also be reachable a day at a time.
    A variant that drew the run correctly and stranded an event in a day the
    navigator never offers would pass everything else in this file."""
    ok = True
    for name in names:
        if name != "main":
            continue
        mine = True
        page = PAGE[name]
        for s in sels:
            week = set(titles_week(page, s))
            days = titles_by_day(page, s)
            if week - days:
                print("  FAIL  %s  %s  ->  %d entries are in the whole run and on no day "
                      "page: %s" % (name, label(s)[:44], len(week - days), list(week - days)[:3]))
                mine = False
        print("  %s  %-6s every entry reachable through the day navigator, "
              "%d selections" % ("ok  " if mine else "FAIL", name, len(sels)))
        ok = ok and mine
    return ok

# ---------------------------------------------------------------- main ------
def main():
    names = [a for a in sys.argv[1:] if a in GRAB] or ["main"]
    snapshot()
    sels = build_selections()
    print("Parity: %d selections x %d variants, against %s\n" % (len(sels), len(names), REFERENCE))

    print("Eligibility core")
    # both run: 'a and b' would skip the second whenever the first failed, which is
    # exactly the run where you want to know everything that is wrong.
    core_ok = core_check(names)
    core_ok = shared_logic_check(names) and core_ok

    print("\nBaseline: the incumbent, held against the data")
    with ThreadPoolExecutor(max_workers=4) as ex:
        base = list(ex.map(titles_incumbent, sels))
    empty = [label(s) for s, b in zip(sels, base) if not b]
    print("  %d selections, %d..%d listings each%s" %
          (len(sels), min(sum(b.values()) for b in base), max(sum(b.values()) for b in base),
           ("  (%d render nothing)" % len(empty)) if empty else ""))
    all_ok = reference_check(sels, base) and core_ok
    print("  %d listings fold to %d distinct events across the run"
          % (len(EVENTS), len(dupkey.fold(EVENTS))))

    for n in names:
        print("\n%s" % PAGE[n])
        with ThreadPoolExecutor(max_workers=3) as ex:
            got = list(ex.map(GRAB[n], sels))
        fails = 0
        for s, g in zip(sels, got):
            w = wanted_titles(s)
            if w != g:
                fails += 1
                miss, extra = w - g, g - w
                print("  FAIL  %s" % label(s))
                if miss:
                    print("        missing %d: %s" % (sum(miss.values()), list(miss)[:4]))
                if extra:
                    print("        extra   %d: %s" % (sum(extra.values()), list(extra)[:4]))
        if fails:
            all_ok = False
            print("  %d of %d selections differ" % (fails, len(sels)))
        else:
            print("  ok    all %d selections render exactly one entry per distinct event "
                  "(%d entries compared)"
                  % (len(sels), sum(sum(wanted_titles(s).values()) for s in sels)))

    # The selections carrying the most of Laurier's repeats, so the merge is
    # proved where there is something to merge, and on every level.
    dupey = sorted(sels, key=lambda x: -sum(
        1 for k, n in Counter(dupkey.keys_of(listings(x))).items() if n > 1))[:3]
    seen_lv = {x["level"] for x in dupey}
    for x in sels:
        if x["level"] not in seen_lv and listings(x):
            dupey.append(x)
            seen_lv.add(x["level"])

    print("\nNothing lost, only merged")
    all_ok = merge_check(names, dupey) and all_ok

    print("\nReachable a day at a time")
    all_ok = day_walk_check(names, dupey[:2]) and all_ok

    print("\nEmpty-board smoke")
    all_ok = smoke_check(names, [x for x in sels if not x["program"]][:14]) and all_ok

    print("\nOne event, one entry")
    all_ok = title_check() and all_ok

    print("\nSource hygiene")
    all_ok = control_check(names) and all_ok

    print("\nLinks and citations")
    all_ok = link_core_check(names) and all_ok
    all_ok = links_check(sels[:10]) and all_ok

    print("\nConsole errors")
    probe = [frag_of(s) for s in sels[:14]]
    for page, extra in [("orientation.html", ["&view=day&day=2026-09-08", "&view=week",
                                              "&view=clash", "&view=plan", "&view=reg",
                                              "&q=lazaridis", "&q=zzzznothing",
                                              "&view=plan&q=lazaridis", "&ghosts=1"]),
                        (REFERENCE, [])]:
        frags = probe + [probe[0] + x for x in extra]
        bad = console_check(page, frags, 1400) + console_check(page, frags, 504)
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
