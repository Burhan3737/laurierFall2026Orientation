"""Put the current board on Vercel, and refuse to if it is not the current board.

    python deploy.py            check everything, then deploy to production
    python deploy.py --check    check only, deploy nothing
    python deploy.py --preview  deploy to a preview URL instead of production

What is actually deployed is public/index.html, which build_all.py writes as a copy
of orientation.html. Nothing here builds the page a second way: a deploy script
that knows how to build is a second build, and the two drift.

The checks below exist because each one is a way this has gone wrong, or would:

  the page is stale       orientation.html older than its own sources, so the
                          thing deployed is not the thing in the repository
  the copy has drifted    public/index.html not byte-identical to the board
  the tree is dirty       deploying work that is not committed means the live
                          page cannot be traced back to a commit
  a gate is red           the board is only trustworthy because the gates say so,
                          and a deploy is exactly when that stops being abstract
"""
import hashlib
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BOARD = os.path.join(HERE, "orientation.html")
DEPLOY = os.path.join(HERE, "public", "index.html")

# The gates that can run in under a minute or so. parity and plus_check are the
# slow ones and are deliberately not here: this is a pre-flight, not a substitute
# for the full suite, and it says so if they have not been run.
QUICK = ["test_regressions.py", "check.py", "invariants.py", "contrast.py"]


def sh(cmd, **kw):
    return subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, **kw)


def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def fail(msg, fix=None):
    print("  FAIL  " + msg)
    if fix:
        print("        " + fix)
    return False


def check():
    ok = True

    # 1. rebuild, so the page and its deployed copy are both current by construction
    r = sh([sys.executable, "build_all.py"])
    if r.returncode:
        return fail("build_all.py failed", (r.stderr or r.stdout).strip()[:300])
    if "rebuilt (changed)" in r.stdout:
        print("  ok    rebuilt from sources (a page was stale and is not any more)")
    else:
        print("  ok    every page already current")

    # 2. the deployed file must BE the board, not a copy that once was
    if not os.path.exists(DEPLOY):
        ok = fail("public/index.html is missing", "run: python build_all.py")
    elif md5(DEPLOY) != md5(BOARD):
        ok = fail("public/index.html differs from orientation.html",
                  "run: python build_all.py")
    else:
        print("  ok    public/index.html is byte-identical to the board")

    # 3. nothing uncommitted, or the live page cannot be traced to a commit
    r = sh(["git", "status", "--porcelain"])
    dirty = [l for l in r.stdout.splitlines() if l.strip()]
    if dirty:
        ok = fail("%d uncommitted change(s); the deploy could not be traced to a commit"
                  % len(dirty),
                  "commit first, or accept that the live page matches no revision")
        for line in dirty[:8]:
            print("        " + line)
    else:
        head = sh(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
        print("  ok    tree is clean at %s" % head)

    # 4. the quick gates
    for g in QUICK:
        r = sh([sys.executable, g])
        if r.returncode:
            ok = fail("%s exited %d" % (g, r.returncode),
                      (r.stdout or r.stderr).strip().splitlines()[-1][:200]
                      if (r.stdout or r.stderr).strip() else "")
        else:
            print("  ok    %s" % g)

    print("\n  note  parity.py and plus_check.py are not run here (minutes, not seconds).")
    print("        Run the full suite before a deploy that matters.")
    return ok


def vercel_available():
    for cmd in (["vercel", "--version"], ["npx", "vercel", "--version"]):
        try:
            if sh(cmd).returncode == 0:
                return cmd[:-1]
        except OSError:
            pass
    return None


def main():
    args = sys.argv[1:]
    print("Pre-flight")
    ok = check()
    if not ok:
        print("\nNOT DEPLOYED - fix the above first.")
        return 1
    if "--check" in args:
        print("\nAll checks passed. Nothing deployed (--check).")
        return 0

    base = vercel_available()
    if not base:
        print("\nAll checks passed, but the Vercel CLI is not on PATH.")
        print("Install it with:  npm i -g vercel")
        print("Then either re-run this script, or deploy by hand:")
        print("  vercel --prod        (from %s)" % HERE)
        print("Or connect the GitHub repository in the Vercel dashboard - vercel.json")
        print("already pins the output directory, so no build step is needed.")
        return 1

    cmd = base + (["--prod"] if "--preview" not in args else [])
    print("\nDeploying: %s" % " ".join(cmd))
    # inherit stdio: this one is interactive the first time (login, project link)
    return subprocess.run(cmd, cwd=HERE).returncode


if __name__ == "__main__":
    sys.exit(main())
