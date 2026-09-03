# -*- coding: utf-8 -*-
"""Prove the things orientation-a-plus.html does that the other gates cannot see.

parity.py proves the page shows the right events. check.py proves it runs.
invariants.py and contrast.py prove it keeps its promises on screen. None of them
opens the calendar file, prints the page, or ticks anything, so none of them would
notice if the .ics went out with bare line feeds, the printed schedule carried the
chooser, or ticking an event quietly changed which events the board draws.

    python plus_check.py

Every assertion here exists because it is a way this page could be wrong while
every other gate stayed green:

  1. picking changes nothing   a seeded plan holding every event Laurier
                               publishes must not alter the multiset of events
                               the day board draws
  2. searching changes nothing the eligibility tally must be identical with a
                               query typed and with the box empty
  3. the plan survives         written in one page load, read back in the next,
                               same Chrome profile, page opened from disk
  4. the calendar file         CRLF throughout, folded under 75 octets, balanced
                               components, one VEVENT per dated pick, none for an
                               undated one, and the count of those stated
  5. the printed page          a real PDF: every picked event, every registration
                               and citation URL spelled out in full, and none of
                               the chooser, navigator, search or view buttons
  6. the venue mapper          a query for every venue that names a place, and no
                               query invented for one that does not
"""
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter

import fitz  # PyMuPDF, for reading back the PDF Chrome prints

import dupkey
from _chrome import chrome_flags

HERE = os.path.abspath(os.path.dirname(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PAGE = os.path.join(HERE, "orientation-a-plus.html")
BOARD = "level=undergraduate&campus=Waterloo&term=Fall%202026"
LSPLAN = "wlu-orientation.plan.v1"
LSREG = "wlu-orientation.registered.v1"

SCRIPT = re.compile(r"<script[\s>].*?</script>", re.S | re.I)
DAYRE = re.compile(
    r"^(Sun|Mon|Tues?|Wed(nes)?|Thurs?|Fri|Satur?)(day)?,?\s+"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*\d{1,2}\s*[-\u2013\u2014:]\s*",
    re.I)
REGRE = re.compile(r"regist|rsvp|sign ?up|ticket|book now|purchase", re.I)

FAILURES = []


def ok(passed, label, detail=""):
    print("  %s  %s%s" % ("ok  " if passed else "FAIL", label,
                          ("  ->  " + detail) if (detail and not passed) else ""))
    if not passed:
        FAILURES.append(label)
    return passed


# --------------------------------------------------------------- the data ---
# "Are these the same event" is answered by dupKey() in the application scripts.
# It used to be answered a second time here, transcribed into Python by hand, and
# a transcription is a copy waiting to drift. dupkey.py runs the page's own
# function instead, so there is one implementation and no transcription.
dup_key = dupkey.key_of

EV = dupkey.events()


def copies_of(e):
    """Every listing of the same event. Laurier publishes one session on several
    schedule pages and the page exports the copy the student is eligible for, so a
    citation belonging to any copy is the right citation."""
    k = dup_key(e)
    return [o for o in EV if dup_key(o) == k]


def cite_urls(e):
    return {o["url"] for o in copies_of(e)}


GATES = ["International", "Exchange", "Indigenous", "Off-campus (LOCUS)", "Residence",
         "Mature & Transfer", "Accessible Learning", "Virtual"]


def eligible_here(e):
    """The BOARD selection above, in Python: undergraduate / Waterloo / Fall 2026,
    no streams, no programme narrowing."""
    if e["term"] != "Fall 2026" or "Waterloo" not in (e.get("campuses") or []):
        return False
    if not (e["level"] == "undergraduate" or e["level"] == "all" or e.get("open_to_all")):
        return False
    return not [t for t in (e.get("tags") or []) if t in GATES]


def own_reg_links(e):
    seen, out = set(), []
    for l in (e.get("links") or []) + (e.get("section_links") or []):
        if REGRE.search(l.get("text") or "") and "//cms03.wlu.ca" not in l["href"] \
           and l["href"] not in seen:
            seen.add(l["href"])
            out.append(l)
    return out


# ------------------------------------------------------------- the browser --
def page_with(picks, done=None, inject_head="", inject_body=""):
    """A copy of the page with a plan already in localStorage."""
    src = open(PAGE, encoding="utf-8").read()
    seed = ("<script>try{localStorage.setItem(%s,%s);localStorage.setItem(%s,%s);}"
            "catch(e){}</script>"
            % (json.dumps(LSPLAN), json.dumps(json.dumps(picks)),
               json.dumps(LSREG), json.dumps(json.dumps(done or []))))
    src = src.replace("<head>", "<head>" + seed + inject_head, 1)
    if inject_body:
        src = src.replace("</body>", inject_body + "</body>", 1)
    tmp = os.path.join(tempfile.gettempdir(), "plus-probe.html")
    open(tmp, "w", encoding="utf-8").write(src)
    return tmp


def plain_page(inject_body=""):
    """The real page, untouched apart from the probe that reads it back."""
    src = open(PAGE, encoding="utf-8").read()
    if inject_body:
        src = src.replace("</body>", inject_body + "</body>", 1)
    tmp = os.path.join(tempfile.gettempdir(), "plus-plain.html")
    open(tmp, "w", encoding="utf-8").write(src)
    return tmp


def url_of(path, frag=""):
    return "file:///" + path.replace("\\", "/").replace(" ", "%20") + ("#" + frag if frag else "")


def dom(path, frag="", width=1400, budget=12000):
    r = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--window-size=%d,1000" % width, "--dump-dom",
                        "--virtual-time-budget=%d" % budget, url_of(path, frag)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stdout or ""


def report(path, frag, expr, width=1400):
    """Evaluate an expression inside the page and read it back out of the title."""
    probe = ("<script>setTimeout(function(){try{document.title='RPT:'+(%s);}"
             "catch(e){document.title='RPT:THREW '+e.message;}},900)</script>" % expr)
    src = open(path, encoding="utf-8").read().replace("</body>", probe + "</body>", 1)
    tmp = os.path.join(tempfile.gettempdir(), "plus-report.html")
    open(tmp, "w", encoding="utf-8").write(src)
    d = dom(tmp, frag, width)
    m = re.search(r"<title>RPT:(.*?)</title>", d, re.S)
    return m.group(1) if m else None


def b64_report(path, frag, expr):
    """Same, for anything too big or too newline-ridden to survive a title."""
    probe = ("<script>setTimeout(function(){var v=(%s);"
             "var i=document.createElement('i');i.id='b64';"
             "i.setAttribute('data-v',btoa(unescape(encodeURIComponent(v))));"
             "document.body.appendChild(i);},900)</script>" % expr)
    src = open(path, encoding="utf-8").read().replace("</body>", probe + "</body>", 1)
    tmp = os.path.join(tempfile.gettempdir(), "plus-b64.html")
    open(tmp, "w", encoding="utf-8").write(src)
    m = re.search(r'<i id="b64" data-v="([^"]*)"', dom(tmp, frag))
    return base64.b64decode(m.group(1)).decode("utf-8") if m else None


def drawn_titles(path, frag):
    return Counter(re.findall(r'data-ev-title="([^"]*)"', SCRIPT.sub("", dom(path, frag))))


# ------------------------------------------------------------ the fixtures --
def fixtures():
    """A plan chosen to hit every branch: a timed event, a dated one Laurier gives
    no usable time, an undated one, a street-address venue, an online venue and an
    event carrying its own registration link."""
    picks, seen, chosen = [], set(), []

    def take(pred, label):
        for e in EV:
            k = dup_key(e)
            if k in seen or not pred(e):
                continue
            seen.add(k)
            picks.append(k)
            chosen.append((label, e))
            return e
        raise SystemExit("fixture missing: " + label)

    take(lambda e: e.get("date") and e.get("when") and "Lazaridis Hall" in (e.get("where") or ""),
         "timed, in a named building")
    take(lambda e: e.get("date") and (not e.get("when") or "TBD" in (e.get("when") or "")),
         "dated, no usable time")
    take(lambda e: not e.get("date"), "no date at all")
    take(lambda e: "Dalhousie" in (e.get("where") or ""), "street address venue")
    take(lambda e: (e.get("where") or "").startswith("Zoom"), "online, no findable place")
    take(lambda e: own_reg_links(e), "carries its own registration link")
    return picks, chosen


# --------------------------------------------------------------- the tests --
def test_picking_and_searching_change_nothing(picks):
    print("\nPicking and searching are views, not filters")
    everything = []
    seen = set()
    for e in EV:
        k = dup_key(e)
        if k not in seen:
            seen.add(k)
            everything.append(k)
    empty = plain_page()
    loaded = page_with(everything)
    same = True
    for day in ("2026-09-08", "2026-09-09"):
        frag = BOARD + "&view=day&day=" + day
        a, b = drawn_titles(empty, frag), drawn_titles(loaded, frag)
        if a != b:
            same = False
            ok(False, "a %d-event plan leaves the day board alone" % len(everything),
               "%s differs by %s" % (day, list((a - b) + (b - a))[:3]))
    ok(same, "a plan of every event leaves the day board identical (2 days compared)")

    base = report(empty, BOARD, "document.body.innerText.match(/(\\d+) events? you can attend/)[1]")
    with_q = report(empty, BOARD + "&q=lazaridis",
                    "document.body.innerText.match(/(\\d+) events? you can attend/)[1]")
    ok(base == with_q and base not in (None, "0"),
       "a search leaves the eligibility tally untouched (%s events either way)" % base,
       "%r vs %r" % (base, with_q))

    n_all = report(empty, BOARD, 'String(visible().length)')
    n_q = report(empty, BOARD + "&q=lazaridis", 'String(visible().length)')
    ok(n_all and n_q and int(n_q) < int(n_all) and int(n_q) > 0,
       "a search does narrow the board (%s of %s drawn)" % (n_q, n_all))


def test_plan_persists(picks):
    print("\nThe plan survives closing the page")
    seeded = page_with(picks)
    wrote = report(seeded, BOARD + "&view=plan", "String(planEvents().length)")
    ok(wrote == str(len(picks)), "a plan of %d is read back in the page that set it" % len(picks),
       "got %r" % wrote)
    # a second load, same Chrome profile, of the untouched page: file:// localStorage
    # is shared, so this is the student reopening the file tomorrow
    again = report(plain_page(), BOARD + "&view=plan", "String(planEvents().length)")
    ok(again == str(len(picks)),
       "and again in a fresh load of the real page, same browser profile", "got %r" % again)
    left = report(plain_page(), BOARD + "&view=plan",
                  "String(document.querySelectorAll('#board [data-pick]').length)")
    ok(left == str(len(picks)), "and every one of them is drawn in the plan view", "got %r" % left)


def test_ics(picks, chosen):
    print("\nThe calendar file")
    seeded = page_with(picks)
    text = b64_report(seeded, BOARD + "&view=plan",
                      "icsText(planEvents(),'Laurier Orientation').text")
    dropped = report(seeded, BOARD + "&view=plan",
                     "String(icsText(planEvents(),'x').dropped)")
    if not ok(bool(text), "the file is produced"):
        return
    open(os.path.join(HERE, "_plus_plan.ics"), "wb").write(text.encode("utf-8"))

    lines = text.split("\r\n")
    flat = text.replace("\r\n", "")
    ok(flat.count("\n") == 0 and flat.count("\r") == 0,
       "every line ends CRLF and nothing else does",
       "%d bare LF, %d bare CR" % (flat.count("\n"), flat.count("\r")))
    over = [l for l in lines if len(l.encode("utf-8")) > 75]
    ok(not over, "no line exceeds 75 octets once folded",
       "%d over, first: %r" % (len(over), over[:1]))

    stack, balanced = [], True
    for l in lines:
        if l.startswith("BEGIN:"):
            stack.append(l[6:])
        elif l.startswith("END:"):
            if not stack or stack[-1] != l[4:]:
                balanced = False
                break
            stack.pop()
    ok(balanced and not stack, "BEGIN and END components balance")
    ok(text.count("BEGIN:VTIMEZONE") == 1 and "TZID:America/Toronto" in text,
       "one VTIMEZONE, declaring America/Toronto")

    dated = [e for _, e in chosen if e.get("date")]
    undated = [e for _, e in chosen if not e.get("date")]
    ok(text.count("BEGIN:VEVENT") == len(dated),
       "one VEVENT per dated pick (%d of %d picks)" % (len(dated), len(picks)),
       "found %d" % text.count("BEGIN:VEVENT"))
    ok(dropped == str(len(undated)),
       "the %d pick Laurier publishes no date for is reported, not dropped in silence"
       % len(undated), "reported %r" % dropped)

    # unfold before looking for values, since any of them may be split across lines
    un = []
    for l in lines:
        if l.startswith(" ") and un:
            un[-1] += l[1:]
        else:
            un.append(l)
    body = "\n".join(un)
    for field in ("UID:", "DTSTAMP:", "SUMMARY:", "LOCATION:", "DESCRIPTION:", "URL:"):
        ok(body.count(field) >= len(dated), "every VEVENT carries %s" % field.rstrip(":"))
    timed = [e for e in dated if e.get("when") and "TBD" not in e["when"]]
    ok(body.count("DTSTART;TZID=America/Toronto:") == len(timed),
       "%d timed entr%s in local Toronto time" % (len(timed), "y" if len(timed) == 1 else "ies"))
    ok(body.count("DTSTART;VALUE=DATE:") == len(dated) - len(timed),
       "%d all-day entr%s where Laurier gives a day and no time"
       % (len(dated) - len(timed), "y" if len(dated) - len(timed) == 1 else "ies"))

    missing = [e["title"][:40] for e in dated
               if not any(u in body for u in cite_urls(e))]
    ok(not missing, "every entry carries its citation URL", str(missing[:3]))
    novenue = [e["title"][:40] for e in dated
               if e.get("where") and e["where"].replace(",", "\\,") not in body]
    ok(not novenue, "every entry carries its venue in LOCATION", str(novenue[:3]))
    noreg = [e["title"][:40] for e in dated
             for l in own_reg_links(e) if l["href"] not in body]
    ok(not noreg, "every registration link is written into the description", str(noreg[:3]))


def test_print(picks, chosen):
    print("\nThe printed schedule, read back out of a real PDF")
    seeded = page_with(picks)
    out = os.path.join(HERE, "_plus_print.pdf")
    subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                    "--window-size=1400,1000", "--no-pdf-header-footer",
                    "--print-to-pdf=" + out, "--virtual-time-budget=15000",
                    url_of(seeded, BOARD + "&view=plan")],
                   capture_output=True)
    if not ok(os.path.exists(out) and os.path.getsize(out) > 4000, "Chrome printed a PDF"):
        return
    doc = fitz.open(out)
    txt = "\n".join(p.get_text() for p in doc)
    doc.close()
    open(os.path.join(HERE, "_plus_print.txt"), "w", encoding="utf-8").write(txt)
    flatten = re.sub(r"\s+", " ", txt)

    ok("MY ORIENTATION SCHEDULE" in txt.upper(), "it is headed as a personal schedule")
    ok("Undergraduate" in txt and "Waterloo campus" in txt and "Fall 2026" in txt,
       "it says who it is for")

    absent = [w for w in ("Show what you cannot attend", "Search title, venue, host",
                          "events you can attend", "Whole run", "To register",
                          "Every published orientation event", "Sources", "Data notes",
                          "Empty the plan", "Print my schedule")
              if w.lower() in flatten.lower()]
    ok(not absent, "nothing that only works on a screen is on the paper", str(absent))

    titles = [DAYRE.sub("", e["title"]) for _, e in chosen]
    lost = [t[:44] for t in titles if re.sub(r"\s+", " ", t) not in flatten]
    ok(not lost, "every event in the plan is printed (%d)" % len(titles), str(lost[:3]))

    flat_nospace = flatten.replace(" ", "")
    want = []
    for _, e in chosen:
        want.append(("citation for " + e["title"][:30], cite_urls(e)))
        for l in own_reg_links(e):
            want.append(("registration for " + e["title"][:30], {l["href"]}))
    cut = [label for label, group in want
           if not any(u.replace(" ", "") in flat_nospace for u in group)]
    ok(not cut, "every citation and registration URL is spelled out in full (%d)" % len(want),
       str(cut[:2]))

    venues = [e["where"] for _, e in chosen if e.get("where")]
    novenue = [v[:40] for v in venues if re.sub(r"\s+", " ", v) not in flatten]
    ok(not novenue, "every venue is printed", str(novenue[:3]))
    ok("Cited from" in txt, "each entry names where it was cited from")
    ok(len(doc if False else txt) > 1500, "the page is not blank")


def test_print_is_the_same_from_any_view(picks, chosen):
    """A student who hits Ctrl+P while looking at the whole run must get the same
    schedule as one who presses the button in the plan. The printed document is
    built from the plan, not from whatever happens to be on the screen."""
    print("\nThe printed schedule does not depend on the view it was printed from")
    seeded = page_with(picks)
    texts = {}
    for frag in (BOARD + "&view=plan", BOARD + "&view=week",
                 BOARD + "&view=day&day=2026-09-08"):
        out = os.path.join(tempfile.gettempdir(), "plus-view-%d.pdf" % len(texts))
        subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--window-size=1400,1000", "--no-pdf-header-footer",
                        "--print-to-pdf=" + out, "--virtual-time-budget=15000",
                        url_of(seeded, frag)], capture_output=True)
        doc = fitz.open(out)
        texts[frag.split("&")[-1]] = re.sub(r"\s+", " ",
                                            "\n".join(p.get_text() for p in doc))
        doc.close()
    vals = list(texts.values())
    ok(len(set(vals)) == 1, "the same paper comes out of all three views",
       str({k: len(v) for k, v in texts.items()}))

    # ...except the registration list, which is its own piece of paper
    out = os.path.join(tempfile.gettempdir(), "plus-reg.pdf")
    subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                    "--window-size=1400,1000", "--no-pdf-header-footer",
                    "--print-to-pdf=" + out, "--virtual-time-budget=15000",
                    url_of(seeded, BOARD + "&view=reg")], capture_output=True)
    doc = fitz.open(out)
    reg = re.sub(r"\s+", " ", "\n".join(p.get_text() for p in doc))
    doc.close()
    ok("WHAT I STILL HAVE TO BOOK" in reg.upper(),
       "printing from To register prints the booking checklist, not the schedule")
    ok(reg not in vals and vals[0] not in reg, "and it is a different document")
    wanted = [l["href"] for e in EV if eligible_here(e) and own_reg_links(e)
              for l in own_reg_links(e)]
    missed = [u for u in set(wanted) if u.replace(" ", "") not in reg.replace(" ", "")]
    ok(not missed, "every booking URL on the board is written out in full (%d)"
       % len(set(wanted)), str(missed[:2]))


def test_venue_map():
    print("\nVenue map links")
    expr = ("(function(){var s={},o=[];EV.forEach(function(e){var w=e.w||'';if(s[w])return;"
            "s[w]=1;var m=mapFor(e);o.push([w,m?m.q:'']);});return JSON.stringify(o);})()")
    raw = b64_report(plain_page(), BOARD, expr)
    if not ok(bool(raw), "the mapper answers for every venue"):
        return
    rows = json.loads(raw)
    mapped = [r for r in rows if r[1]]
    unmapped = [r[0] for r in rows if not r[1]]
    print("        %d distinct venues, %d linked, %d left unlinked"
          % (len(rows), len(mapped), len(unmapped)))

    # A query is only honest if every word in it either came out of the venue
    # string or is one of the few we knowingly add: the university, the campus and
    # its city. Anything else would be an invented place.
    ADDED = {"wilfrid", "laurier", "university", "campus", "ontario", "on",
             "waterloo", "brantford", "milton", "kitchener"}
    invented = []
    for w, q in mapped:
        have = set(re.findall(r"[a-z0-9]+", w.lower()))
        extra = [t for t in re.findall(r"[a-z0-9]+", q.lower())
                 if t not in have and t not in ADDED]
        if extra:
            invented.append((w[:38], extra[:4]))
    ok(not invented, "every word of every query came from the venue or names the campus",
       str(invented[:3]))

    want = {
        "LH1001 | Lazaridis Hall": "Lazaridis Hall, Wilfrid Laurier University, Waterloo, Ontario",
        "Balsillie School of International Affairs (BSIA) | 67 Erb Street W.":
            "67 Erb Street W., Waterloo, Ontario",
        "Harmony Square | 89 Dalhousie St.": "89 Dalhousie St., Brantford, Ontario",
        "Bingemans | 425 Bingemans Centre Dr., Kitchener, ON":
            "425 Bingemans Centre Dr., Kitchener, ON",
        "MAC137 | Milton Academic Centre":
            "Milton Academic Centre, Wilfrid Laurier University, Milton, Ontario",
        "The Turret | 3rd Floor, Fred Nichols Campus Centre (FNCC)":
            "Fred Nichols Campus Centre (FNCC), Wilfrid Laurier University, Waterloo, Ontario",
    }
    got = dict(rows)
    for venue, expect in want.items():
        ok(got.get(venue) == expect, "%s -> the right query" % venue[:52],
           "got %r" % got.get(venue))
    for venue in ("TBD", "Zoom", "GHG Discord Server", "Your Residence Building",
                  "See building list in the details"):
        ok(got.get(venue, "sentinel") == "", "%s -> no link, because a map cannot answer it" % venue,
           "got %r" % got.get(venue))


def main():
    print("orientation-a-plus.html — the doing layer")
    picks, chosen = fixtures()
    print("  fixture plan: %d events" % len(picks))
    for label, e in chosen:
        print("    %-34s %s" % (label, (e["title"] or "")[:58]))
    test_picking_and_searching_change_nothing(picks)
    test_plan_persists(picks)
    test_ics(picks, chosen)
    test_print(picks, chosen)
    test_print_is_the_same_from_any_view(picks, chosen)
    test_venue_map()
    print("\n%s" % ("ALL PASSED" if not FAILURES else
                    "%d FAILURES: %s" % (len(FAILURES), "; ".join(FAILURES[:4]))))
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(main())
