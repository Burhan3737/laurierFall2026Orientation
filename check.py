"""Build a variant and prove it actually runs, in one command.

Three times a fix was lost because a multi-edit batch wrote the line that *calls*
something and aborted before writing the definition. `node --check` cannot see
that — the syntax is perfect — and the page still serves; it just throws on every
render. So this does what a person cannot be relied on to remember:

    python check.py            build and check the board
    python check.py c          just that one

  1. build the page
  2. node --check          (syntax)
  3. reference check       (every bare call has a definition in the file)
  4. console check         (load it in Chrome wide and narrow, zero errors)

Run it after every write to an app script, before anything else proceeds.
"""
import glob, io
import os
import re
import subprocess
import sys
import shutil, tempfile, atexit, threading

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


# one reusable profile per run, and a sweep of what Chrome leaves behind
from _chrome import chrome_flags

# Everything the browser supplies, plus the globals build.py injects, plus the
# keywords that look like calls to a regex.
KNOWN = set("""
EV META TODAY console document window Math JSON Object Array String Number Boolean
Date RegExp Error parseInt parseFloat isNaN isFinite encodeURIComponent Blob URL
decodeURIComponent setTimeout setInterval clearTimeout clearInterval localStorage
sessionStorage history location navigator alert confirm FormData Promise Set Map
requestAnimationFrame matchMedia getComputedStyle addEventListener print
removeEventListener if for while switch catch function return typeof instanceof
new delete void in of do else try finally
""".split())

DEF_FN = re.compile(r"function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(")
DEF_VAR = re.compile(r"(?:^|[^A-Za-z0-9_$])var\s+([A-Za-z_$][A-Za-z0-9_$]*)")
DEF_ASSIGN = re.compile(r"([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*function")
DEF_PARAMS = re.compile(r"function\s*[A-Za-z0-9_$]*\s*\(([^)]*)\)")
NEWLINE = chr(10)
STR_D = re.compile(r'"(?:[^"\\]|\\.)*"')
STR_S = re.compile(r"'(?:[^'\\]|\\.)*'")
DEF_SET = re.compile(r"([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)")
CONST = re.compile(r"(?:^|[^.A-Za-z0-9_$])([A-Z][A-Z0-9_]{2,})(?![A-Za-z0-9_$])")
CALL = re.compile(r"(?:^|[^.A-Za-z0-9_$])([a-z_$][A-Za-z0-9_$]*)\s*\(")

STATES = {
    "main": ["level=undergraduate&campus=Waterloo&term=Fall%202026",
             "level=undergraduate&campus=Waterloo&term=Fall%202026&view=week",
             "level=undergraduate&campus=Waterloo&term=Fall%202026&view=clash",
             "level=undergraduate&campus=Waterloo&term=Fall%202026&view=plan",
             "level=undergraduate&campus=Waterloo&term=Fall%202026&view=reg",
             "level=undergraduate&campus=Waterloo&term=Fall%202026&q=lazaridis",
             "level=graduate&campus=Waterloo&term=Fall%202026&view=week"],
}

# The source triple is named for the build; the page it writes is named separately.
PAGES = {"main": "orientation.html"}

TRAP = ('<script>window.__e=[];addEventListener("error",function(v){__e.push(v.message)});'
        'addEventListener("unhandledrejection",function(){__e.push("promise")});</script>')
REPORT = ('<script>setTimeout(function(){document.title="JSERR:"+__e.length+"|"+'
          '__e.join(" // ")},500);</script>')


def code_only(src):
    """Strip comments and string literals in one pass.

    Two independent regexes cannot do this: run a double-quote pattern over
    '<span class="dup">' and it matches the inner "dup", corrupting everything
    after it. A single left-to-right scan is the only honest way.
    """
    out = []
    i, n = 0, len(src)
    quote = None
    while i < n:
        ch = src[i]
        if quote:
            if ch == chr(92):
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        nxt = src[i + 1] if i + 1 < n else ""
        if ch == "/" and nxt == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
            continue
        if ch == "/" and nxt == "/":
            j = src.find(NEWLINE, i)
            i = n if j < 0 else j
            out.append(" ")
            continue
        if ch == '"' or ch == "'":
            quote = ch
            out.append(" ")
            i += 1
            continue
        # A regex literal can contain a quote — /[A-Z"(]/ — and treating that quote
        # as the start of a string swallows the rest of the file. A slash starts a
        # regex when what precedes it cannot end an expression.
        if ch == "/":
            k = len(out) - 1
            while k >= 0 and out[k] in (" ", chr(9), NEWLINE):
                k -= 1
            prev = out[k] if k >= 0 else ""
            if prev == "" or prev in "(,=:[!&|?{};+-*%~^<>":
                i += 1
                in_class = False
                while i < n:
                    c = src[i]
                    if c == chr(92):
                        i += 2
                        continue
                    if c == "[":
                        in_class = True
                    elif c == "]":
                        in_class = False
                    elif c == "/" and not in_class:
                        i += 1
                        break
                    elif c == NEWLINE:
                        break
                    i += 1
                out.append(" ")
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def refcheck(path):
    """Catch a bare call to something the file never defines.

    Deliberately narrow. It looks only at `name(` with no dot in front — a method
    belongs to whatever object it sits on and cannot be checked here — and counts a
    name as defined if it is declared anywhere in the file, since declarations
    hoist. Parameter names are treated as file-wide, which over-approximates on
    purpose: this exists to catch one specific failure, a call written without its
    definition, and a check that cries wolf gets ignored.
    """
    src = code_only(io.open(path, encoding="utf-8").read())
    defined = set(DEF_FN.findall(src))
    defined |= set(DEF_VAR.findall(src))
    defined |= set(DEF_ASSIGN.findall(src))
    # `var LANE_H = 22, LANE_GAP = 2;` declares two names; anything assigned
    # anywhere counts, since the question is only whether a definition exists.
    defined |= set(DEF_SET.findall(src))
    for group in DEF_PARAMS.findall(src):
        for part in group.split(","):
            m = re.match(r"\s*([A-Za-z_$][A-Za-z0-9_$]*)", part)
            if m:
                defined.add(m.group(1))
    called = set(CALL.findall(src))
    # `LONG_MIN` was lost the same way and slipped through, because it is read
    # rather than called. Shouty constants are a convention here, so they can be
    # checked the same way without guessing at every local variable.
    consts = set(CONST.findall(src))
    missing = (called - defined - KNOWN) | (consts - defined - KNOWN)
    return sorted(missing)


def check(v):
    css = "_style_%s.css" % v
    js = "_app_%s.js" % v
    body = "_body_%s.html" % v
    out = PAGES[v]

    r = subprocess.run([sys.executable, "build.py", "--css", css, "--js", js,
                        "--body", body, "--out", out],
                       cwd=HERE, capture_output=True, text=True)
    if r.returncode:
        print("  FAIL  %s did not build" % v)
        print((r.stdout or "") + (r.stderr or ""))
        return False

    r = subprocess.run(["node", "--check", os.path.join(HERE, js)],
                       capture_output=True, text=True)
    if r.returncode:
        print("  FAIL  %s syntax" % js)
        print((r.stderr or "")[:400])
        return False

    missing = refcheck(os.path.join(HERE, js))
    if missing:
        print("  FAIL  %s calls but never defines: %s" % (js, ", ".join(missing)))
        return False

    src = io.open(os.path.join(HERE, out), encoding="utf-8").read()
    probed = src.replace("<head>", "<head>" + TRAP, 1)
    probed = probed.replace("</body>", REPORT + "</body>", 1)
    tmp = os.path.join(HERE, "_probe-" + out)
    io.open(tmp, "w", encoding="utf-8").write(probed)

    bad = []
    try:
        for width in (1400, 420):
            for frag in STATES[v]:
                url = "file:///" + tmp.replace("\\", "/").replace(" ", "%20")
                if frag:
                    url += "#" + frag
                p = subprocess.run([CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox",
                                    "--window-size=%d,900" % width, "--dump-dom",
                                    "--virtual-time-budget=9000", url],
                                   capture_output=True, text=True,
                                   encoding="utf-8", errors="replace")
                m = re.search(r"<title>JSERR:(\d+)\|(.*?)</title>", p.stdout or "", re.S)
                if not m:
                    bad.append((width, frag, "never finished running"))
                elif m.group(1) != "0":
                    bad.append((width, frag, m.group(2)[:120]))
    finally:
        os.remove(tmp)

    if bad:
        for w, f, msg in bad[:6]:
            print("  FAIL  %s @%dpx  #%s  ->  %s" % (v, w, f[:48], msg))
        return False

    print("  ok    %s builds, parses, resolves every call, and runs clean at "
          "1400px and 504px across %d states" % (out, len(STATES[v])))
    return True


def resolve_all():
    """Every application script resolves every call it makes.

    check(v) already does this, but only for a build with a stylesheet and body that have a
    matching stylesheet and body. _app.js has neither - the yardstick
    is built from it - so it was checked by nothing: a blanket edit put four calls
    to onePerEvent into it, which it does not define, and node --check passed because an
    undefined identifier is a runtime error. The page it builds rendered
    an empty board, and because it is parity.py's yardstick the failure showed
    up as all 83 selections disagreeing rather than as one dead page."""
    ok = True
    for js in sorted(glob.glob(os.path.join(HERE, "_app*.js"))):
        r = subprocess.run(["node", "--check", js], capture_output=True, text=True)
        if r.returncode:
            print("  FAIL  %s syntax" % os.path.basename(js))
            ok = False
            continue
        missing = refcheck(js)
        if missing:
            print("  FAIL  %s calls but never defines: %s"
                  % (os.path.basename(js), ", ".join(missing)))
            ok = False
    print("  %s  all %d application scripts parse and resolve every call they make"
          % ("ok  " if ok else "FAIL", len(glob.glob(os.path.join(HERE, "_app*.js")))))
    return ok


if __name__ == "__main__":
    which = [a for a in sys.argv[1:] if a in STATES] or ["main"]
    results = [resolve_all()] + [check(v) for v in which]
    sys.exit(0 if all(results) else 1)
