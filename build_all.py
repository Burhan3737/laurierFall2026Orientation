"""Rebuild every page from the current events.json.

    python build_all.py

Pages are built from one dataset, so rebuilding only some of them leaves the rest
quietly stale — a page that still renders, still passes its own checks, and shows
last week's data. That happened once; this exists so it cannot happen again.
"""
import subprocess, sys, hashlib, os

# Two outputs, and only one of them is a page. orientation.html is the board. The
# yardstick draws the same events as a plain list, one card per listing, and exists
# so parity.py can prove the board shows exactly what the listing shows and loses
# nothing in the merging. It is underscore-prefixed because it is a test fixture,
# not something to open.
PAGES = [
    ("orientation.html", ["--css", "_style_main.css", "--js", "_app_main.js",
                          "--body", "_body_main.html"]),
    ("_yardstick.html",  ["--css", "_style_min.css",  "--js", "_app.js", "--body", ""]),
]

def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None

changed, failed = [], []
for out, args in PAGES:
    before = md5(out)
    r = subprocess.run([sys.executable, "build.py"] + args + ["--out", out],
                       capture_output=True, text=True)
    if r.returncode:
        failed.append((out, (r.stderr or r.stdout).strip()[:200]))
        continue
    after = md5(out)
    print("  %-26s %s" % (out, "rebuilt (changed)" if before != after else "unchanged"))
    if before != after:
        changed.append(out)

# What Vercel serves. It is a copy of the board under the name a web server looks
# for, written here rather than by hand or by a deploy script, because a deployed
# page that has drifted from its sources is exactly the failure this file exists
# to prevent -- and it would drift silently, since nothing else opens it.
DEPLOY = os.path.join("public", "index.html")
if not failed:
    if not os.path.isdir("public"):
        os.makedirs("public")
    board = open("orientation.html", "rb").read()
    before = md5(DEPLOY)
    if hashlib.md5(board).hexdigest() != before:
        open(DEPLOY, "wb").write(board)
        print("  %-26s %s" % (DEPLOY, "rebuilt (changed)"))
        changed.append(DEPLOY)
    else:
        print("  %-26s %s" % (DEPLOY, "unchanged"))

print()
if failed:
    for out, err in failed:
        print("FAILED %s\n  %s" % (out, err))
    sys.exit(1)
print("%d page(s) were stale and have been rebuilt." % len(changed) if changed
      else "All pages were already current.")
