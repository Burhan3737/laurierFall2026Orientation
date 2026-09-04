"""Two properties of the timetable, asserted against the rendered page.

    python clashcheck.py             # the built pages
    python clashcheck.py --negative  # prove it goes red on the code it was written for

1. Nothing is drawn as colliding unless it genuinely overlaps something else.

   The class used to be decided by `it.ncol > 1`, which was never an overlap test.
   placed() padded every item to a minimum drawn height so a short event was still
   a readable box, and packed columns from the padded length, so two strictly
   consecutive events landed in different columns and both came back with ncol 2.
   (The padding is gone now and ncol is a true statement about concurrency, which
   layoutcheck.py holds it to; this class must still not be decided from it.)
   Every block on graduate/Waterloo/Wednesday 2 September was
   painted gold, including the five consecutive parts of the Graduate Student
   Orientation evening, while the Clashes lens for that day correctly showed
   nothing. This walks the DOM and asks the data directly -- does anything the
   student may attend, on this date, actually run across this event's hours --
   without calling the page's own collision engine, so the test is independent of
   the thing it is testing.

2. The key never names a state the view does not draw, and never omits one it does.

   Both directions matter. A key naming a colour nothing on the screen is in
   invites a reader to match the caption to the only edge in front of them, which
   is how a programme-specific welcome got read as open to everybody. A key
   missing a colour that is on the screen leaves ink unexplained -- the printed
   run sheet carried lilac bars with nothing naming them, because viewStates()
   asked clockStates() without `capped` and a bar that both collided and was open
   to all set clash and returned before it could set open.

   The screen key and the printed key are checked separately, because they are
   computed by different routes: the screen key from the entries a view lays out,
   the printed key from viewStates(), which re-derives them before the board
   exists. Those two disagreeing is exactly what item 3 of the audit was.

The states are swept inside the page rather than one Chrome launch per state: the
board is redrawn through its own readHash()/redraw() path, so what is measured is
what a student would be looking at.
"""
import html, io, json, os, re, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
sys.path.insert(0, HERE)
from _chrome import chrome_flags

PAGES = ["orientation.html"]

# ---------------------------------------------------------------- the sweep --
# Injected after the page has built itself. Everything it needs -- EV, sel,
# parseWhen, assess, dupKey, readHash, redraw, dayKeys, visible -- is already a
# global of the inlined application script.
SWEEP = r"""
<script>
window.__verdict = null;
setTimeout(function () {
  var bad = [], seen = 0;

  function win(e) { return e.d ? parseWhen(e.n) : null; }

  /* Deliberately not collidesWith(): a check that calls the implementation it is
     checking cannot fail. Same date, someone else, really running across these
     hours, and a listing the student may attend. */
  function reallyOverlaps(e) {
    var w = win(e);
    if (!w) return false;
    var k = dupKey(e);
    for (var i = 0; i < EV.length; i++) {
      var o = EV[i];
      if (o === e || o.d !== e.d || dupKey(o) === k) continue;
      if (!assess(o).ok) continue;
      var ow = win(o);
      if (ow && ow.s < w.e && w.s < ow.e) return true;
    }
    return false;
  }

  /* Mirrors clockStates() against the stylesheet rather than the data: what a
     reader can actually see on the screen. On the day clock a reading edge
     carries one meaning and a collision takes it; the run caps a filled bar, so
     there both show. Ribbons and untimed chips sit under their own headings and
     look nothing like the swatch, so they carry the marked states only. */
  function drawn() {
    var st = { plain: false, open: false, clash: false, off: false };
    var ns = document.querySelectorAll(
      "#board .blk, #board .ag, #board .wb, #board .rib, #board .chipev");
    [].forEach.call(ns, function (n) {
      var c = n.classList;
      if (c.contains("off")) { st.off = true; return; }
      if (c.contains("rib") || c.contains("chipev")) {
        if (c.contains("open")) st.open = true;
        return;
      }
      if (c.contains("wb")) {
        if (c.contains("clash")) st.clash = true;
        if (c.contains("open")) st.open = true; else st.plain = true;
        return;
      }
      if (c.contains("clash")) { st.clash = true; return; }
      if (c.contains("open")) st.open = true; else st.plain = true;
    });
    return st;
  }

  function keysIn(root, pfx) {
    return {
      plain: !!root.querySelector("." + pfx + "plain"),
      open:  !!root.querySelector("." + pfx + "open"),
      clash: !!root.querySelector("." + pfx + "clash"),
      off:   !!root.querySelector("." + pfx + "off")
    };
  }

  /* legendKeys() names clash, open and off whenever they are present, and names
     the ordinary state only alongside something else -- on its own "an ordinary
     event on your board" tells nobody anything. */
  function keyFaults(where, key, st) {
    var out = [];
    ["clash", "open", "off"].forEach(function (k) {
      if (key[k] && !st[k]) out.push(where + " key names " + k + "; nothing on the board draws it");
      if (!key[k] && st[k]) out.push(where + " board draws " + k + "; the key does not name it");
    });
    var named = key.clash || key.open || key.off;
    if (key.plain && !st.plain) out.push(where + " key names an ordinary event; every event drawn is marked");
    if (named && st.plain && !key.plain) out.push(where + " board draws an unmarked event; the key does not name it");
    if (!named && key.plain) out.push(where + " key names the ordinary state alone");
    return out;
  }

  function look(tag) {
    seen++;
    var st = drawn();
    [].forEach.call(document.querySelectorAll("#board .clash[data-id]"), function (n) {
      var e = EV[+n.dataset.id];
      if (!reallyOverlaps(e))
        bad.push(tag + " :: drawn as colliding but overlaps nothing: " +
                 (e.t || "") + " " + (e.n || "no time"));
    });
    /* A ghost never carries a collision mark. clockStates() sets "off" and
       returns before it can set "clash", so the key never names a collision on
       something the student cannot attend -- and .wb.off replaced only the
       background, so a gold cap survived on the hatching with no caption
       anywhere on the page. */
    [].forEach.call(document.querySelectorAll("#board .off.clash"), function (n) {
      var e = EV[+n.dataset.id];
      bad.push(tag + " :: marked as colliding and as not open to you at once, " +
               "a pairing the key cannot caption: " + ((e && e.t) || n.className));
    });
    var board = document.getElementById("board");
    keyFaults(tag + " :: screen", keysIn(board, "lg-"), st).forEach(function (m) { bad.push(m); });
    /* Only the pages that print the board itself carry one. A-plus hides the
       board when printing and lays out its own document, so there is nothing
       here for a printed key to caption; printKeys() existing is the page
       saying which of the two it is. */
    if (typeof printKeys === "function") {
      var pk = document.querySelector(".prkey");
      if (pk) keyFaults(tag + " :: print", keysIn(pk, "k-"), st).forEach(function (m) { bad.push(m); });
      else if (st.clash || st.open || st.off)
        bad.push(tag + " :: print key absent while the board draws a state");
    }
  }

  /* Three passes over every day of the run: the clock, the same day read as an
     agenda, and the board with the events the student cannot attend turned on.
     The agenda is not a variation on the clock -- it had a real overlap test of
     its own while the clock had a layout figure, so with &list=1 the same day
     drew ten plain rows under a key still claiming a collision. Ghosts force the
     list too, and are the only way a hatched bar reaches the screen at all. */
  var base = window.__frag;
  [["", ""], [" list", "&list=1"], [" ghosts", "&ghosts=1"]].forEach(function (m) {
    var name = m[0], g = m[1];
    location.hash = base + "&view=week" + g;
    readHash(); redraw();
    look(base + " week" + name);
    var ks = dayKeys(visible());
    ks.forEach(function (k) {
      location.hash = base + "&view=day&day=" + k + g;
      readHash(); redraw();
      look(base + " " + k + name);
    });
  });

  document.title = "CLASH:" + seen + "|" + bad.slice(0, 8).join(" ~ ");
}, 400);
</script>
"""


def selections():
    ev = json.load(open(os.path.join(HERE, "events.json"), encoding="utf-8"))["events"]
    gates = ["International", "Exchange", "Indigenous", "Off-campus (LOCUS)", "Residence",
             "Mature & Transfer", "Accessible Learning", "Virtual"]

    def pool(lv, cp, tm):
        return [e for e in ev
                if e["term"] == tm and cp in (e.get("campuses") or [])
                and (e["level"] == lv or e["level"] == "all" or e.get("open_to_all"))]

    out = []
    terms = sorted({e["term"] for e in ev}, key=lambda t: ("Fall" not in t, t))
    for lv in ("undergraduate", "graduate", "bachelor-of-education"):
        for cp in ("Waterloo", "Brantford", "Milton"):
            for tm in terms:
                p = pool(lv, cp, tm)
                if not p:
                    continue
                out.append({"level": lv, "campus": cp, "term": tm, "streams": []})
                st = sorted({t for e in p for t in (e.get("tags") or []) if t in gates})
                if st:
                    out.append({"level": lv, "campus": cp, "term": tm, "streams": st})
    return out


def frag(s):
    p = ("level=" + urllib.parse.quote(s["level"]) +
         "&campus=" + urllib.parse.quote(s["campus"]) +
         "&term=" + urllib.parse.quote(s["term"]))
    if s["streams"]:
        p += "&streams=" + urllib.parse.quote("|".join(s["streams"]))
    return p


def label(s):
    b = [s["level"], s["campus"], s["term"]]
    if s["streams"]:
        b.append("+".join(s["streams"]))
    return " / ".join(b)


def probe(page, s):
    src = io.open(os.path.join(HERE, page), encoding="utf-8").read()
    inject = ('<script>window.__frag=' + json.dumps(frag(s)) + ';</script>') + SWEEP
    doc = src.replace("</body>", inject + "</body>", 1)
    tmp = os.path.join(HERE, "_clashprobe-" + page)
    io.open(tmp, "w", encoding="utf-8").write(doc)
    url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20") + "#" + frag(s)
    try:
        r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu",
                            "--no-sandbox", "--window-size=1400,900", "--dump-dom",
                            "--virtual-time-budget=30000", url],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        os.remove(tmp)
    m = re.search(r"<title>CLASH:(\d+)\|(.*?)</title>", r.stdout or "", re.S)
    if not m:
        return None, ["%s never finished the sweep" % page]
    faults = [html.unescape(x) for x in m.group(2).split(" ~ ") if x.strip()]
    return int(m.group(1)), faults


def run(pages):
    total, allbad = 0, []
    for page in pages:
        for s in selections():
            n, faults = probe(page, s)
            if n is None:
                allbad.append((page, label(s), faults))
                print("  FAIL  %-24s %s  ->  %s" % (page, label(s), faults[0]))
                continue
            total += n
            if faults:
                allbad.append((page, label(s), faults))
                print("  FAIL  %-24s %s" % (page, label(s)))
                for f in faults[:4]:
                    print("          %s" % f)
    print()
    if allbad:
        print("%d state group(s) failed across %d board states." % (len(allbad), total))
        return False
    print("  ok    %d board states: nothing is drawn as colliding that does not "
          "overlap, and every key names exactly the states its board draws" % total)
    return True


# ------------------------------------------------------- the negative test ---
# A check that has never gone red is not evidence of anything, and one that goes
# red for the wrong reason is worse: the loudest fault masks the others, so each
# defect is put back on its own and the gate has to name that defect and not
# merely fail. Three, one per finding this gate was written for.
BREAKS = [
    ("the layout figure used as an overlap test", "overlaps nothing", [
        ('(drawsClash(e, within) ? " clash" : "")', '(it.ncol > 1 ? " clash" : "")'),
        ('wentries.push([it.ev, drawsClash(it.ev), false]);',
         'wentries.push([it.ev, it.ncol > 1, false]);'),
        ('          (drawsClash(e) ? " clash" : "") +', '          (it.ncol > 1 ? " clash" : "") +'),
        ('  return items.map(function (it) { return [it.ev, drawsClash(it.ev, within), false]; })',
         '  return items.map(function (it) { return [it.ev, it.ncol > 1, false]; })'),
    ]),
    ("the printed key asked without capped", "the key does not name it", [
        ('legendKeys(clockStates(wentries, true))', 'legendKeys(clockStates(wentries))'),
    ]),
    ("a collision mark on an event the student cannot attend",
     "marked as colliding and as not open to you", [
        ('if (!assess(e).ok) return [];', 'if (false) return [];'),
    ]),
]


def negative():
    base = io.open(os.path.join(HERE, "_app_main.js"), encoding="utf-8").read()
    allok = True
    for name, expect, edits in BREAKS:
        js = base
        for a, b in edits:
            if js.count(a) != 1:
                print("  the negative test no longer matches the code it breaks: %r" % a[:50])
                return False
            js = js.replace(a, b)
        bjs = os.path.join(HERE, "_app_broken.js")
        bout = "orientation-broken.html"
        io.open(bjs, "w", encoding="utf-8", newline="").write(js)
        print("negative test: %s" % name)
        try:
            r = subprocess.run([sys.executable, "build.py", "--css", "_style_main.css",
                                "--js", "_app_broken.js", "--body", "_body_main.html",
                                "--out", bout], cwd=HERE, capture_output=True, text=True)
            if r.returncode:
                print("  the broken build failed to build: %s" % (r.stderr or r.stdout)[:200])
                return False
            faults = run_quiet([bout])
        finally:
            os.remove(bjs)
            if os.path.exists(os.path.join(HERE, bout)):
                os.remove(os.path.join(HERE, bout))
        hit = [f for f in faults if expect in f]
        if not faults:
            print("  FAIL  the gate passed a build with this defect in it\n")
            allok = False
        elif not hit:
            print("  FAIL  the gate went red, but on something else: %s\n" % faults[0][:150])
            allok = False
        else:
            print("  ok    caught, and named it: %s\n" % hit[0][:150])
    return allok


def run_quiet(pages, per_level=2):
    """The negative pass only has to demonstrate detection, and it builds and
    sweeps once per defect, so it takes two boards per level rather than all
    eighteen. All three levels are covered, streams included; a defect this broad
    that hid from those would be a different defect."""
    picked, seen = [], {}
    for s in selections():
        if seen.get(s["level"], 0) < per_level:
            seen[s["level"]] = seen.get(s["level"], 0) + 1
            picked.append(s)
    faults = []
    for page in pages:
        for s in picked:
            n, bad = probe(page, s)
            faults.extend(bad)
    return faults


if __name__ == "__main__":
    if "--negative" in sys.argv:
        ok = negative()
        print("negative test ok: every defect this gate exists for is caught, and named."
              if ok else "NEGATIVE TEST FAILED.")
        sys.exit(0 if ok else 1)
    print("collision honesty and key honesty\n")
    sys.exit(0 if run(PAGES) else 1)
