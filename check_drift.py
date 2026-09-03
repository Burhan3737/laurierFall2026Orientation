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
"""
import sys, os, ssl, urllib.request
from bs4 import BeautifulSoup

BASE = "https://students.wlu.ca/support-and-wellness/orientation/assets/schedules/"
PAGES = [
    "bachelor-of-education.html", "graduate/fall-brantford.html", "graduate/fall-virtual.html",
    "graduate/fall-waterloo.html", "graduate/spring.html", "graduate/winter.html",
    "indigenous.html", "international.html", "locus.html",
    "undergraduate/fall-brantford.html", "undergraduate/fall-milton.html",
    "undergraduate/fall-virtual.html", "undergraduate/fall-waterloo.html",
]

# Watched, not parsed. The graduate "Laurier Crash Course" webinars are published
# here — dated, timed and registrable, in the same accordion format as the
# schedules — but every Fall 2026 session has already run, so nothing is missing
# from the board today. The page states that the Winter 2027 sessions go up "at
# the beginning of the fall semester", which is now, and until this existed
# nothing would have told us when they did.
WATCH = [
    ("https://students.wlu.ca/academics/graduate-and-postdoctoral-studies/aspire/"
     "incoming-student-support.html",
     "_watch/aspire__incoming-student-support.html"),
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
for url, local in WATCH:
    name = url.split("/aspire/")[-1] if "/aspire/" in url else url.rsplit("/", 1)[-1]
    bad, a, r = check(url, local, name, "  (watched only)")
    total_added += a
    total_removed += r
    if bad:
        watched_drifted.append(name)

print()
if not drifted and not watched_drifted:
    print("No drift: all %d pages match their snapshots (%d on the board, %d watched only)."
          % (len(PAGES) + len(WATCH), len(PAGES), len(WATCH)))
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
    print("Snapshots refreshed. Now run:  python parse.py && python test_regressions.py "
          "&& python build_all.py")
    sys.exit(0)
print("Re-run with --update to refresh, then rebuild.")
sys.exit(1)
