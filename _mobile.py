"""Measure the page at a real phone viewport, over the DevTools Protocol.

Headless Chrome will not open a *window* narrower than about 504 CSS px, whatever
--window-size is asked for (see _chrome.NARROW_FLOOR). Every earlier attempt in
this project to measure phone layout with --window-size=390,844 was in fact
measuring a 504px page, so nothing below 504 has ever been exercised.

Emulation.setDeviceMetricsOverride does not go through the window at all: it sets
the layout viewport directly, the way device emulation in DevTools does. Every
run here asks the page for its own document.documentElement.clientWidth and the
media queries it believes it is in, and refuses the reading if the width is not
the one that was requested. A measurement that cannot prove its own viewport is
not a measurement.

    python _mobile.py            survey every state at every width
    python _mobile.py --prove    just the viewport proof
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

import websocket

from _chrome import chrome_flags

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PAGE = os.path.join(HERE, "orientation.html")
URL = "file:///" + PAGE.replace("\\", "/").replace(" ", "%20")

WIDTHS = [320, 360, 390, 414, 768, 900, 901, 1024, 1400]
HEIGHT = 844

BOARD = "level=undergraduate&campus=Waterloo&term=Fall%202026"
DENSE = (BOARD + "&streams=International%7CExchange%7CIndigenous%7COff-campus%20(LOCUS)"
                 "%7CResidence%7CMature%20%26%20Transfer%7CAccessible%20Learning%7CVirtual")


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Browser(object):
    def __init__(self):
        self.port = _free_port()
        self.proc = subprocess.Popen(
            [CHROME, *chrome_flags(), "--headless=new", "--disable-gpu", "--no-sandbox",
             "--allow-file-access-from-files", "--window-size=1400,1000",
             "--remote-allow-origins=*",
             "--remote-debugging-port=%d" % self.port, "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        url = None
        for _ in range(200):
            try:
                url = json.loads(urllib.request.urlopen(
                    "http://127.0.0.1:%d/json/version" % self.port, timeout=1
                ).read().decode())["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.1)
        if not url:
            raise RuntimeError("Chrome never opened a debugging port")
        self.ws = websocket.create_connection(url, timeout=60)
        self.n = 0

    def send(self, method, params=None, session=None):
        self.n += 1
        msg = {"id": self.n, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        self.ws.send(json.dumps(msg))
        while True:
            r = json.loads(self.ws.recv())
            if r.get("id") == self.n:
                if "error" in r:
                    raise RuntimeError("%s: %s" % (method, r["error"]))
                return r.get("result", {})

    def close(self):
        try:
            self.send("Browser.close")
        except Exception:
            pass
        try:
            self.ws.close()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


class Tab(object):
    def __init__(self, br, width, height=HEIGHT, mobile=True):
        self.br = br
        t = br.send("Target.createTarget", {"url": "about:blank"})["targetId"]
        self.tid = t
        self.sid = br.send("Target.attachToTarget",
                           {"targetId": t, "flatten": True})["sessionId"]
        br.send("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1,
            # mobile:true gives overlay scrollbars, so the layout viewport is
            # exactly the width asked for at every size and the media queries can
            # be read at the breakpoint itself rather than 15px inside it.
            "mobile": mobile, "screenWidth": width, "screenHeight": height,
        }, self.sid)
        self.width = width

    def ev(self, js, timeout=30):
        r = self.br.send("Runtime.evaluate",
                         {"expression": js, "returnByValue": True,
                          "awaitPromise": True, "timeout": timeout * 1000}, self.sid)
        if "exceptionDetails" in r:
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:400])
        return r["result"].get("value")

    def go(self, frag):
        self.br.send("Page.navigate", {"url": URL + ("#" + frag if frag else "")}, self.sid)
        for _ in range(300):
            try:
                if self.ev("document.readyState==='complete' && "
                           "!!document.querySelector('#navstrip .vb')"):
                    break
            except Exception:
                pass
            time.sleep(0.1)
        time.sleep(0.35)

    def close(self):
        try:
            self.br.send("Target.closeTarget", {"targetId": self.tid})
        except Exception:
            pass


PROBE = r"""
(function () {
  var W = document.documentElement.clientWidth;
  var rep = {
    w: W, inner: window.innerWidth,
    mq900: matchMedia('(max-width:900px)').matches,
    mq700: matchMedia('(max-width:700px)').matches,
    mq560: matchMedia('(max-width:560px)').matches,
    pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    overflow: [], offscreen: [], touch: [], tiny: [], boxes: {}, vb: [], rows: {}
  };
  function nm(n) {
    var c = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/)
              .filter(Boolean).slice(0, 3).join('.');
    return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + c : '');
  }
  function scroller(n) {
    var p = n.parentElement;
    while (p) {
      var o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
      p = p.parentElement;
    }
    return false;
  }
  var all = [].slice.call(document.querySelectorAll('body *'));
  all.forEach(function (n) {
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
    var r = n.getBoundingClientRect();
    if (!r.width && !r.height) return;
    var ox = cs.overflowX;
    if (n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1 &&
        ox !== 'auto' && ox !== 'scroll' && n.id !== 'live')
      rep.overflow.push([nm(n), n.scrollWidth, n.clientWidth]);
    if (r.right > W + 1 && !scroller(n))
      rep.offscreen.push([nm(n), Math.round(r.left), Math.round(r.right)]);
  });
  // touch targets
  [].slice.call(document.querySelectorAll(
      'button, a[href], input, select, summary, [role=button]')).forEach(function (n) {
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var r = n.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.width < 44 || r.height < 44)
      rep.touch.push([nm(n), Math.round(r.width), Math.round(r.height),
                      (n.textContent || '').trim().slice(0, 24)]);
  });
  // text under 12px that is actually a word someone reads
  all.forEach(function (n) {
    var own = [].slice.call(n.childNodes).some(function (k) {
      return k.nodeType === 3 && k.textContent.trim().length > 1;
    });
    if (!own) return;
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var fs = parseFloat(cs.fontSize);
    if (fs < 12) rep.tiny.push([nm(n), fs, (n.textContent || '').trim().slice(0, 24)]);
  });
  // named boxes
  var want = {
    mast: '.mast', h1: '.mast h1', idbar: '#idbar', navstrip: '#navstrip',
    views: '.views', qwrap: '.qwrap', qbox: '#qbox', bynav: '.by-nav',
    bars: '.bars', tally: '.tally', board: '#board', sheet: '.sheet',
    week: '.week', weekwrap: '.weekwrap', daygrid: '.daygrid', legend: '.legend',
    idmore: '.idmore>summary', seg: '.seg', prog: '.progwrap'
  };
  Object.keys(want).forEach(function (k) {
    var n = document.querySelector(want[k]);
    if (!n) return;
    var r = n.getBoundingClientRect();
    if (getComputedStyle(n).display === 'none') return;
    rep.boxes[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width),
                    Math.round(r.height), n.scrollWidth];
  });
  // the view buttons, in order, with the line each one sits on
  [].slice.call(document.querySelectorAll('.views .vb')).forEach(function (n) {
    var r = n.getBoundingClientRect();
    rep.vb.push([(n.textContent || '').trim(), Math.round(r.left), Math.round(r.top),
                 Math.round(r.width), Math.round(r.height), n.scrollWidth, n.clientWidth]);
  });
  // every child of the control row, so wrapping can be read off the geometry
  var vs = document.querySelector('.views');
  if (vs) {
    rep.viewrow = [].slice.call(vs.children).map(function (n) {
      var r = n.getBoundingClientRect();
      return [nm(n), Math.round(r.left), Math.round(r.top), Math.round(r.width),
              Math.round(r.height), Math.round(r.bottom)];
    });
    var bands = [];
    rep.viewrow.forEach(function (c) {
      var hit = bands.filter(function (b) { return c[2] < b[1] - 2 && c[5] > b[0] + 2; })[0];
      if (hit) { hit[0] = Math.min(hit[0], c[2]); hit[1] = Math.max(hit[1], c[5]); }
      else bands.push([c[2], c[5]]);
    });
    rep.rows.viewLines = bands.length;
  }
  // the whole run, when it is on screen
  var lane = document.querySelector('.wklane');
  if (lane) {
    var lr = lane.getBoundingClientRect();
    var bars = [].slice.call(document.querySelectorAll('.wb'));
    var ws = bars.map(function (b) { return b.getBoundingClientRect().width; });
    var named = bars.filter(function (b) {
      var l = b.querySelector('.wbl');
      if (!l) return false;
      // how much of the name survives the bar it is drawn in
      return l.scrollWidth <= l.clientWidth + 1;
    }).length;
    rep.run = {
      rows: document.querySelectorAll('.wkrow').length,
      laneW: Math.round(lr.width), laneLeft: Math.round(lr.left),
      bars: bars.length,
      minBar: Math.round(Math.min.apply(null, ws)),
      medBar: Math.round(ws.slice().sort(function (a, b) { return a - b; })[Math.floor(ws.length / 2)]),
      maxBar: Math.round(Math.max.apply(null, ws)),
      under10: ws.filter(function (w) { return w < 10; }).length,
      under20: ws.filter(function (w) { return w < 20; }).length,
      fullyNamed: named,
      ticks: document.querySelectorAll('.wt').length,
      tickW: (function () {
        var t = [].slice.call(document.querySelectorAll('.wt')).map(function (n) {
          return n.getBoundingClientRect();
        });
        var over = 0;
        for (var i = 1; i < t.length; i++) if (t[i].left < t[i - 1].right - 0.5) over++;
        return over;   // hour labels that collide with the one before
      })(),
      runH: Math.round(document.querySelector('.weekwrap').getBoundingClientRect().height)
    };
  }
  // first event card's distance down the page
  var first = document.querySelector('#board .blk, #board .rg, #board .pl, #board .agb, #board .lrow');
  if (first) rep.rows.firstEventTop = Math.round(
      first.getBoundingClientRect().top + window.scrollY);
  rep.title = (document.querySelector('#board h2, #board h3') || {}).textContent || '';
  rep.title = rep.title.trim().slice(0, 60);
  return rep;
})()
"""


def _pick_three(tab):
    """Tick the first three pickable events, the way a student would."""
    return tab.ev("""(function(){
      var b=[].slice.call(document.querySelectorAll('#board .pk')).slice(0,3);
      b.forEach(function(n){n.click();});
      return b.length;})()""")


def _open_sheet(tab):
    return tab.ev("""(function(){
      var n=document.querySelector('#board [data-id]');
      if(!n) return 0; n.click(); return 1;})()""")


STATES = [
    ("whole run",    BOARD + "&view=week", None),
    ("one day clock", BOARD + "&view=day&list=0", None),
    ("one day list", BOARD + "&view=day&list=1", None),
    ("busiest clock", BOARD + "&view=day&day=2026-09-09&list=0", None),
    ("busiest list", BOARD + "&view=day&day=2026-09-09&list=1", None),
    ("dense clock", DENSE + "&view=day&day=2026-09-09&list=0", None),
    ("to register",  BOARD + "&view=reg", None),
    ("my plan empty", BOARD + "&view=plan", None),
    ("my plan list", BOARD + "&view=day", "plan-list"),
    ("my plan cal",  BOARD + "&view=day", "plan-cal"),
    ("dense",        DENSE + "&view=day", None),
    ("search hit",   BOARD + "&view=day&q=lazaridis", None),
    ("search empty", BOARD + "&view=day&q=zzzzzz", None),
    ("ghosts",       BOARD + "&view=day&ghosts=1", None),
    ("sheet open",   BOARD + "&view=day", "sheet"),
    ("clashes",      BOARD + "&view=clash", None),
]


def survey(br, widths, states, verbose=True, mobile=True):
    out = {}
    for name, frag, act in states:
        for w in widths:
            t = Tab(br, w, mobile=mobile)
            try:
                t.ev("try{localStorage.clear()}catch(e){}")
                t.go(frag)
                if act == "sheet":
                    _open_sheet(t)
                    time.sleep(0.3)
                elif act == "force-week":
                    # readHash() coerces view=week to day below 900px, so the
                    # only way to see the run view at a phone width is to set the
                    # view the way the button would and redraw.
                    t.ev("view='week'; redraw();")
                    time.sleep(0.4)
                elif act in ("plan-list", "plan-cal"):
                    _pick_three(t)
                    time.sleep(0.2)
                    t.ev("""(function(){var b=[].slice.call(
                        document.querySelectorAll('.views .vb')).filter(function(n){
                        return /My plan/i.test(n.textContent)})[0]; if(b)b.click();})()""")
                    time.sleep(0.3)
                    if act == "plan-cal":
                        t.ev("""(function(){var b=document.querySelector(
                            '[data-planview=cal]'); if(b)b.click();})()""")
                        time.sleep(0.3)
                rep = t.ev(PROBE)
            finally:
                t.close()
            if rep["w"] != w:
                raise RuntimeError("VIEWPORT NOT REAL: asked %d, page reports %d"
                                   % (w, rep["w"]))
            out[(name, w)] = rep
            if verbose:
                print("  %-14s %4d  clientWidth=%-4d mq900=%-5s pageScrollW=%-5d "
                      "views=%s lines=%s" %
                      (name, w, rep["w"], rep["mq900"], rep["pageScrollW"],
                       [v[0] for v in rep["vb"]], rep["rows"].get("viewLines")))
    return out


def prove(br):
    print("Viewport proof — the page reports its own width and media state")
    ok = True
    for w in WIDTHS:
        t = Tab(br, w)
        try:
            t.go(BOARD + "&view=day")
            r = t.ev("({w:document.documentElement.clientWidth,"
                     "iw:window.innerWidth,"
                     "mq900:matchMedia('(max-width:900px)').matches,"
                     "mq700:matchMedia('(max-width:700px)').matches,"
                     "dpr:devicePixelRatio})")
        finally:
            t.close()
        good = r["w"] == w
        ok = ok and good
        print("  asked %4d -> clientWidth %4d  innerWidth %4d  mq900=%-5s mq700=%-5s  %s"
              % (w, r["w"], r["iw"], r["mq900"], r["mq700"], "OK" if good else "WRONG"))
    return ok


if __name__ == "__main__":
    br = Browser()
    try:
        if "--prove" in sys.argv:
            sys.exit(0 if prove(br) else 1)
        if not prove(br):
            print("viewport not real; nothing below is trustworthy")
            sys.exit(1)
        print()
        data = survey(br, WIDTHS, STATES)
        print()
        bad = 0
        for (name, w), r in sorted(data.items()):
            lines = []
            if r["pageScrollW"] > w + 1:
                lines.append("page scrolls sideways: scrollWidth %d > %d" % (r["pageScrollW"], w))
            for o in r["offscreen"][:6]:
                lines.append("off-screen %s left=%d right=%d" % tuple(o))
            for o in r["overflow"][:6]:
                lines.append("clipped %s content %d in %d" % tuple(o))
            if lines:
                bad += 1
                print("%-14s %4d" % (name, w))
                for l in lines:
                    print("     " + l)
        print("\n%d state/width combinations have an overflow or off-screen defect" % bad)
        json.dump({"%s@%d" % k: v for k, v in data.items()},
                  open(os.path.join(HERE, "_mobile_survey.json"), "w"), indent=1)
    finally:
        br.close()
