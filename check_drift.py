"""Detect whether Laurier has edited the source pages since the last scrape.

Laurier updates these schedules continuously. The build works from snapshots in
_src/, so a silently stale board is the main long-term failure mode: it looks
correct and simply omits whatever was published after the snapshot.

    python check_drift.py          # report only, exit 1 if drift found
    python check_drift.py --update # refresh the snapshots, then re-run parse.py + build.py

Compares accordion panels (the unit of an event) and each page's byte length.

Two kinds of page are watched. The thirteen the board is built from, whose
snapshots live in _src/ and are read by parse.py; and pages that publish
orientation events we have decided not to put on the board, which are watched
only, so that a decision can be revisited when the page changes rather than
never. Watching is not parsing: parse.py reads the files named in its own META
and nothing else, and a watched-only snapshot is kept outside _src/ so that
stays true by construction rather than by care.

A clean run also records the date it happened, in _read.json. The built pages
tell a student when these schedules were read from Laurier, and that sentence
used to be a string literal in five files: refreshing the snapshots without
remembering to edit all five turned a true sentence into a false one, silently,
in the direction that matters (the page claiming to be more current than it is).
build.py reads the date from here instead, so the claim is a consequence of the
last successful check rather than of anybody's memory.
"""
import sys, os, ssl, json, datetime, urllib.request
from bs4 import BeautifulSoup

READ_FILE = "_read.json"

BASE = "https://students.wlu.ca/support-and-wellness/orientation/assets/schedules/"
PAGES = [
    "bachelor-of-education.html", "graduate/fall-brantford.html", "graduate/fall-virtual.html",
    "graduate/fall-waterloo.html", "graduate/spring.html", "graduate/winter.html",
    "indigenous.html", "international.html", "locus.html",
    "undergraduate/fall-brantford.html", "undergraduate/fall-milton.html",
    "undergraduate/fall-virtual.html", "undergraduate/fall-waterloo.html",
]

# Watched, not parsed. These pages publish dated, registrable events for students
# the board serves, in the same accordion format as the schedules, but nothing on
# them belongs on a board of orientation events for the term ahead. Each entry
# records why. A change to one of them is a decision to revisit, not a rebuild to
# run, which is the whole reason they are watched rather than ignored.
# The third field is why the page is watched and why nothing on it is on the
# board. It is data rather than a comment because the built page says the same
# thing to a student reading the sources section, and two copies of a reason
# drift apart the way two copies of a rule do. build.py reads this list.
WATCH = [
    ("https://students.wlu.ca/academics/graduate-and-postdoctoral-studies/aspire/"
     "incoming-student-support.html",
     "_watch/aspire__incoming-student-support.html",
     "Laurier publishes its graduate 'Laurier Crash Course' webinars here, dated "
     "and registrable, in the same accordions as the schedules. Every Fall 2026 "
     "session has already run, so none of them belongs on a board for the term "
     "ahead. Laurier says the Winter 2027 sessions go up at the beginning of the "
     "fall semester, which is now, so the page is checked for them rather than "
     "assumed to be empty."),
    ("https://students.wlu.ca/academics/graduate-and-postdoctoral-studies/aspire/"
     "skills-training.html",
     "_watch/aspire__skills-training.html",
     "Laurier's ASPIRE skills training publishes dated, registrable graduate "
     "workshops here, several of them inside the orientation window (Sept. 9, 14, "
     "17, 18, 21, 22, 23, 25 and 28, 2026). They are professional skills training "
     "- teaching and TA development, scholarship proposal writing - and run all "
     "term, not arrival events, so they are not orientation and are not on the "
     "board. The page is checked because it is the one place Laurier posts dated "
     "graduate sessions outside the schedules, and a genuine orientation item "
     "appearing here would otherwise be invisible."),
]

CTX = ssl.create_default_context()
UPDATE = "--update" in sys.argv


def fetch(url):
    r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(r, timeout=60, context=CTX).read()


def panels(html):
    soup = BeautifulSoup(html, "html.parser")
    return [b.get_text(" ", strip=True) for b in soup.find_all("button", class_="accordion-trigger")]


def check(url, local, name, tag):
    """Report one page. Returns (drifted, added, removed)."""
    try:
        snap = open(local, "rb").read()
    except FileNotFoundError:
        print("  MISSING SNAPSHOT  %s%s" % (name, tag))
        if UPDATE:
            os.makedirs(os.path.dirname(local) or ".", exist_ok=True)
            open(local, "wb").write(fetch(url))
        return True, 0, 0

    live = fetch(url)
    if live == snap:
        print("  unchanged  %s%s" % (name, tag))
        return False, 0, 0

    ps, pl = panels(snap), panels(live)
    added = [p for p in pl if p not in ps]
    removed = [p for p in ps if p not in pl]

    print("  CHANGED    %s%s  (%d -> %d bytes, %d -> %d panels)"
          % (name, tag, len(snap), len(live), len(ps), len(pl)))
    for p in added:
        print("      + %s" % p[:96])
    for p in removed:
        print("      - %s" % p[:96])
    if not added and not removed:
        if len(ps) != len(pl):
            # titles match as a set but not as a multiset: Laurier repeated a panel.
            # Reporting "no panels added or removed" here would be false.
            print("      (panel count changed %d -> %d with no new titles: a panel is "
                  "now published more than once)" % (len(ps), len(pl)))
        else:
            print("      (no panels added or removed - wording or prose changed)")

    if UPDATE:
        os.makedirs(os.path.dirname(local) or ".", exist_ok=True)
        open(local, "wb").write(live)
    return True, len(added), len(removed)


drifted, watched_drifted, total_added, total_removed = [], [], 0, 0
for path in PAGES:
    bad, a, r = check(BASE + path, "_src/" + path.replace("/", "__"), path, "")
    total_added += a
    total_removed += r
    if bad:
        drifted.append(path)

print()
print("Watched, not on the board:")
for url, local, why in WATCH:
    name = url.split("/aspire/")[-1] if "/aspire/" in url else url.rsplit("/", 1)[-1]
    bad, a, r = check(url, local, name, "  (watched only)")
    print("      why: %s" % why)
    total_added += a
    total_removed += r
    if bad:
        watched_drifted.append(name)

def record_read():
    """Every tracked page was downloaded in full and the snapshots now match it.
    That is the strongest true statement anyone can make about how current this
    board is, and it is the one the built pages make, so it is written down here
    at the moment it becomes true rather than typed into five templates later."""
    today = datetime.date.today().isoformat()
    json.dump({"checked": today, "pages": len(PAGES), "watched": len(WATCH)},
              open(READ_FILE, "w", encoding="utf-8"), indent=2)
    print("Recorded in %s: read from Laurier on %s." % (READ_FILE, today))


print()
if not drifted and not watched_drifted:
    print("No drift: all %d pages match their snapshots (%d on the board, %d watched only)."
          % (len(PAGES) + len(WATCH), len(PAGES), len(WATCH)))
    record_read()
    sys.exit(0)

if drifted:
    print("%d of %d schedule pages changed  (+%d panels, -%d panels across everything "
          "checked)" % (len(drifted), len(PAGES), total_added, total_removed))
if watched_drifted:
    print("%d watched page(s) changed: %s" % (len(watched_drifted), ", ".join(watched_drifted)))
    print("  These are not on the board. A change here is a decision to make, not a "
          "rebuild to run: read what changed, then decide whether it belongs in "
          "parse.py's META.")
if UPDATE:
    record_read()
    print("Snapshots refreshed. Now run:  python parse.py && python test_regressions.py "
          "&& python build_all.py")
    sys.exit(0)
# Deliberately not recorded: the snapshots do not match Laurier, so nothing may
# claim they were read today. The date stays at the last check that was clean.
print("Re-run with --update to refresh, then rebuild.")
sys.exit(1)
