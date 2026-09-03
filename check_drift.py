"""Detect whether Laurier has edited the source pages since the last scrape.

Laurier updates these schedules continuously. The build works from snapshots in
_src/, so a silently stale board is the main long-term failure mode: it looks
correct and simply omits whatever was published after the snapshot.

    python check_drift.py          # report only, exit 1 if drift found
    python check_drift.py --update # refresh _src/, then re-run parse.py + build.py

Compares accordion panels (the unit of an event) and each page's byte length.
"""
import sys, ssl, urllib.request, difflib
from bs4 import BeautifulSoup

BASE = "https://students.wlu.ca/support-and-wellness/orientation/assets/schedules/"
PAGES = [
    "bachelor-of-education.html", "graduate/fall-brantford.html", "graduate/fall-virtual.html",
    "graduate/fall-waterloo.html", "graduate/spring.html", "graduate/winter.html",
    "indigenous.html", "international.html", "locus.html",
    "undergraduate/fall-brantford.html", "undergraduate/fall-milton.html",
    "undergraduate/fall-virtual.html", "undergraduate/fall-waterloo.html",
]
CTX = ssl.create_default_context()
UPDATE = "--update" in sys.argv


def fetch(path):
    r = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(r, timeout=60, context=CTX).read()


def panels(html):
    soup = BeautifulSoup(html, "html.parser")
    return [b.get_text(" ", strip=True) for b in soup.find_all("button", class_="accordion-trigger")]


drifted, total_added, total_removed = [], 0, 0
for path in PAGES:
    local = "_src/" + path.replace("/", "__")
    try:
        snap = open(local, "rb").read()
    except FileNotFoundError:
        print("  MISSING SNAPSHOT  " + path)
        drifted.append(path)
        continue

    live = fetch(path)
    if live == snap:
        print("  unchanged  %s" % path)
        continue

    ps, pl = panels(snap), panels(live)
    added = [p for p in pl if p not in ps]
    removed = [p for p in ps if p not in pl]
    total_added += len(added)
    total_removed += len(removed)
    drifted.append(path)

    print("  CHANGED    %s  (%d -> %d bytes, %d -> %d panels)"
          % (path, len(snap), len(live), len(ps), len(pl)))
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
        open(local, "wb").write(live)

print()
if not drifted:
    print("No drift: all %d pages match their snapshots." % len(PAGES))
    sys.exit(0)

print("%d of %d pages changed  (+%d panels, -%d panels)"
      % (len(drifted), len(PAGES), total_added, total_removed))
if UPDATE:
    print("Snapshots refreshed. Now run:  python parse.py && python test_regressions.py && python build.py")
    sys.exit(0)
print("Re-run with --update to refresh, then rebuild.")
sys.exit(1)
