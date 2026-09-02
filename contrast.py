# -*- coding: utf-8 -*-
"""Measured contrast, not eyeballed contrast.

The brief asks for body and small text at 4.5:1 or better. Four rounds running,
the only failures found by hand were things nobody looks at twice -- a separator
glyph, a disabled stepper -- which is exactly the argument for measuring instead
of looking. This walks every element that actually paints text, resolves the
background up the ancestor chain through transparency, and applies the WCAG 2.x
size rule (large text is 24px, or 18.66px at 700+).

--selftest injects a known-bad element and confirms the walk goes red on it. A
checker that has never failed has not been shown to work.
"""
import os, re, subprocess, sys, tempfile
import shutil, atexit, threading

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


# one reusable profile per run, and a sweep of what Chrome leaves behind
from _chrome import chrome_flags

HERE = os.path.abspath(os.path.dirname(__file__))
BASE = "file:///" + HERE.replace("\\", "/").replace(" ", "%20") + "/"

PAGES = {
    "orientation-a.html": ["", "&view=week", "&view=clash", "&ghosts=1"],
    "orientation-b.html": ["", "&only=clash", "&pivot=venue",
                           "&cmp=1&clevel=graduate&ccampus=Brantford&cterm=Fall%202026"],
    "orientation-c.html": ["", "&full=1", "&only=picks"],
    "orientation-a-plus.html": ["", "&view=week", "&view=clash", "&view=plan",
                                "&view=reg", "&ghosts=1", "&q=lazaridis"],
}
SEL = "#level=undergraduate&campus=Waterloo&term=Fall%202026"

PROBE = r"""
<script>
setTimeout(function () {
  var D = document.getElementById('f').contentDocument, W = D.defaultView, bad = [];
  function rgb(s) {
    var m = String(s).match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function over(fg, bg) {            /* composite a translucent colour onto its backdrop */
    var a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  }
  function backdrop(n) {
    var stack = [];
    for (var p = n; p && p.nodeType === 1; p = p.parentElement) {
      var c = rgb(W.getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; }
    }
    var out = [255, 255, 255, 1];
    for (var i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  }
  function paints(n) {               /* does this element itself paint a text node */
    for (var i = 0; i < n.childNodes.length; i++) {
      var k = n.childNodes[i];
      if (k.nodeType === 3 && k.nodeValue.trim().length) return true;
    }
    return false;
  }
  var all = D.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var n = all[i];
    if (!paints(n)) continue;
    var cs = W.getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    var r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    var bg = backdrop(n), fg = rgb(cs.color);
    if (!fg) continue;
    if (fg[3] < 1) fg = over(fg, bg);
    var L1 = lum(fg), L2 = lum(bg);
    var ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    var px = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight, 10) || 400;
    var large = px >= 24 || (px >= 18.66 && wt >= 700);
    var need = large ? 3 : 4.5;
    if (ratio + 0.005 < need) {
      bad.push((n.tagName + '.' + (n.className || '').toString().trim().split(/\s+/).join('.'))
               .slice(0, 46) + ' ' + Math.round(px) + 'px/' + wt +
               ' rgb(' + fg.slice(0, 3).map(Math.round) + ') on rgb(' + bg.slice(0, 3).map(Math.round) +
               ') = ' + ratio.toFixed(2) + ' need ' + need);
    }
  }
  var seen = {}, uniq = [];
  bad.forEach(function (b) { if (!seen[b]) { seen[b] = 1; uniq.push(b); } });
  document.title = 'CONTRAST ' + uniq.length + ' >>' + uniq.slice(0, 12).join(' >>');
}, 6500);
</script>
"""


def probe(url, width=1400, height=1000, inject=""):
    host = os.path.join(tempfile.gettempdir(), "_contrast_host.html")
    with open(host, "w", encoding="utf-8") as fh:
        fh.write("<style>html,body{margin:0}</style><iframe id=f style='border:0' width=%d "
                 "height=%d src='%s'></iframe>%s%s" % (width, height, url, inject, PROBE))
    out = subprocess.run(
        [CHROME, *chrome_flags(), "--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
         "--virtual-time-budget=16000", "--window-size=%d,%d" % (width + 60, height + 60),
         "--dump-dom", "file:///" + host.replace("\\", "/").replace(" ", "%20")],
        capture_output=True, text=True, encoding="utf-8", errors="replace").stdout or ""
    m = re.search(r"CONTRAST (\d+) ?(.*?)</title>", out, re.S)
    if not m:
        return None, ["probe did not report"]
    items = [x for x in m.group(2).split(">>") if x.strip()]
    return int(m.group(1)), items


def selftest():
    """A known-bad element must turn the walk red, or the walk proves nothing."""
    inject = ("<script>setTimeout(function(){var D=document.getElementById('f').contentDocument;"
              "var p=D.createElement('p');p.textContent='deliberately unreadable';"
              "p.setAttribute('style','position:fixed;top:4px;left:4px;z-index:99999;"
              "background:#ffffff;color:#c9c9c9;font-size:13px');D.body.appendChild(p);},2500)</script>")
    n, items = probe(BASE + "orientation-a.html" + SEL, inject=inject)
    hit = any("201,201,201" in i for i in items)
    print("  %s  self-test: a 13px #C9C9C9 paragraph on white is %s"
          % ("ok  " if hit else "FAIL", "reported" if hit else "NOT reported \u2014 the walk is blind"))
    return hit


def main():
    if "--selftest" in sys.argv:
        return 0 if selftest() else 1
    print("Measured contrast (WCAG 2.x, backgrounds resolved through transparency)")
    ok = True
    if not selftest():
        return 1
    for page, hashes in PAGES.items():
        worst = []
        for h in hashes:
            for w in (1400, 430):
                n, items = probe(BASE + page + SEL + h, width=w,
                                 height=1000 if w == 1400 else 900)
                if n is None:
                    print("  FAIL  %s %s @%d \u2014 %s" % (page, h or "(base)", w, items[0]))
                    ok = False
                elif n:
                    worst.extend(items)
        if worst:
            ok = False
            seen, uniq = set(), []
            for x in worst:
                if x not in seen:
                    seen.add(x)
                    uniq.append(x)
            print("  FAIL  %s \u2014 %d text elements below the floor:" % (page, len(uniq)))
            for x in uniq[:14]:
                print("          " + x)
        else:
            print("  ok    %s \u2014 every painted text element at or above the floor "
                  "across %d states \u00d7 2 widths" % (page, len(hashes)))
    print("ALL PASSED" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
