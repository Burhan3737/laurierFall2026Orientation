"""Generate a self-contained orientation page from events.json.

    python build.py                                  -> orientation.html   (_style_min.css)
    python build.py --css _style_a.css --out orientation-a.html

The no-argument invocation is the canonical build and its output is byte-for-byte
stable; --css/--out only swap the stylesheet and the destination.
"""
import json, io, os, re, datetime, subprocess, sys, argparse

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument('--css', default='_style_a.css', help='stylesheet to inline')
_ap.add_argument('--js',  default='_app_a.js', help='application script to inline')
_ap.add_argument('--body', default='_body_a.html',
                 help='alternate body template; {{META}}, {{SRCGRID}}, {{WATCHGRID}}, '
                      '{{NSOURCES}}, {{NWATCHED}}, {{NTRACKED}}, {{NEVENTS}}, '
                      '{{NDISTINCT}} are substituted')
_ap.add_argument('--out', default='orientation.html', help='page to write')
ARGS = _ap.parse_args()

d = json.load(open('events.json', encoding='utf-8'))
EV = d['events']
# Laurier publishes many of these sessions on two or three of its schedule pages,
# and the pages fold those copies into one event. "520 events" was therefore a
# number no reader could ever reach: the most anywhere is the distinct count. It
# is not recomputed here — dupkey.py runs the page's own dupKey(), so the footer
# counts events the same way the board does, or not at all.
import dupkey
NDISTINCT = len(dupkey.fold(EV))
TODAY = "2026-08-31"

# ---- compact the payload: short keys, drop empties -------------------------
K = {"date":"d","title":"t","desc":"x","where":"w","when":"n","host":"h","cost":"c",
     "audience":"a","links":"l","level":"lv","campuses":"cp","term":"tm","tags":"tg",
     "open_to_all":"oa","url":"u","section":"s","flags":"f",
     "section_info":"si","section_links":"sl","page_links":"pl","parent":"pt","virtual":"vr","program":"pg"}
def pack(e):
    o = {}
    for long, short in K.items():
        v = e.get(long)
        if v in (None, "", [], False): continue
        o[short] = v
    return o
PAYLOAD = json.dumps([pack(e) for e in EV], separators=(',', ':'), ensure_ascii=False)

LEVELS   = ["undergraduate", "graduate", "bachelor-of-education"]
LEVEL_LB = {"undergraduate":"Undergraduate","graduate":"Graduate","bachelor-of-education":"Bachelor of Education"}
# Virtual is a delivery mode, not a campus: online events show under every campus.
CAMPUSES = ["Waterloo", "Brantford", "Milton"]
TERMS    = sorted({e['term'] for e in EV}, key=lambda t: ("Fall" not in t, t))
STREAMS  = ["International","Exchange","Indigenous","Off-campus (LOCUS)","Residence",
            "Mature & Transfer","Accessible Learning","Virtual"]

SOURCES = sorted({(e['source_file'], e['url'].split('#')[0]) for e in EV})
PAGE_TITLES = d['page_titles']

def esc_html(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def short(u):
    return u.replace('https://students.wlu.ca', 'students.wlu.ca')

src_html = "\n".join(
  '    <div class="src"><b>%s</b><span>%s</span><a href="%s" target="_blank" rel="noopener">%s</a></div>'
  % (f.replace('__',' / ').replace('.html',''), PAGE_TITLES.get(f, f), u, short(u))
  for f, u in SOURCES)

# ---- the page that is watched but never read ------------------------------
# Laurier publishes orientation events in one more place that nothing on this
# board comes from. check_drift.py watches it so that the decision not to parse
# it can be revisited when the page changes rather than never, and the sources
# section has to say so: "13 pages" and "14 pages tracked" are both true, and a
# section stating only one of them leaves a reader holding the wrong number.
#
# The list is read out of check_drift.py rather than copied into here. A second
# copy of a fact is a fact waiting to drift, and this project has been bitten by
# that more than once. ast reads the assignment; nothing in check_drift.py runs,
# so a build never touches the network.
import ast
_cd = ast.parse(open('check_drift.py', encoding='utf-8').read())
_watch = next(ast.literal_eval(n.value) for n in _cd.body
              if isinstance(n, ast.Assign)
              and getattr(n.targets[0], 'id', None) == 'WATCH')

def _snap_title(path):
    """The watched page's own <title>, out of the snapshot check_drift.py keeps,
    so the card names the page the way Laurier names it."""
    raw = open(path, encoding='utf-8', errors='replace').read()
    m = re.search(r'<title>(.*?)</title>', raw, re.S)
    t = re.sub(r'\s+', ' ', m.group(1)).strip() if m else path
    return re.sub(r'\s*\|\s*Wilfrid Laurier University\s*$', '', t)

WATCHED = [(u, _snap_title(p), why) for u, p, why in _watch]

watch_html = "\n".join(
  '    <div class="src watched"><b>Watched &middot; not read</b><span>%s</span>'
  '<em>%s</em><a href="%s" target="_blank" rel="noopener">%s</a></div>'
  % (esc_html(t), esc_html(why), u, short(u))
  for u, t, why in WATCHED)

def opts(name, values, labels=None, kind="radio"):
    out = []
    for i, v in enumerate(values):
        lb = (labels or {}).get(v, v)
        out.append('<label class="opt"><input type="%s" name="%s" value="%s"%s><span>%s</span></label>'
                   % (kind, name, v.replace('&','&amp;').replace('"','&quot;'), ' checked' if kind=="radio" and i==0 else '', lb))
    return "\n        ".join(out)

# fail the build rather than shipping a script that will not parse
for f in (ARGS.js,):
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    if r.returncode:
        sys.exit('SYNTAX ERROR in %s\n%s' % (f, r.stderr))

CSS = open(ARGS.css, encoding='utf-8').read()
APP = open(ARGS.js, encoding='utf-8').read()

# A stylesheet may name its own webfonts with a first-line directive:
#     /* @fonts https://fonts.googleapis.com/css2?... */
# so that a variant can bring its own typography without editing this template.
DEFAULT_FONTS = ("https://fonts.googleapis.com/css2?"
                 "family=IBM+Plex+Mono:wght@300;400&family=IBM+Plex+Sans:wght@300;400&display=swap")
_m = re.search(r'/\*\s*@fonts\s+(\S+)\s*\*/', CSS)
FONTS = _m.group(1) if _m else DEFAULT_FONTS

# A variant is an offline document: if fetch_fonts.py has cached its webfaces, they
# are inlined as base64 and no <link> is emitted at all, so the page keeps its
# typography with the network unplugged. Without a cache it falls back to the link,
# and the canonical no-argument build always takes the link path unchanged.
_NL = chr(10)
_fontcache = os.path.join('_fonts', os.path.splitext(os.path.basename(ARGS.css))[0] + '.fonts.css')
if ARGS.body and os.path.exists(_fontcache):
    FONTHEAD = '<style>' + _NL + open(_fontcache, encoding='utf-8').read()
else:
    FONTHEAD = ('<link rel="preconnect" href="https://fonts.googleapis.com">' + _NL +
                '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' + _NL +
                '<link href="%s" rel="stylesheet">' % FONTS + _NL +
                '<style>' + _NL)

HEAD = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laurier Orientation — Event Finder</title>
{FONTHEAD}{CSS}
</style>
</head>
"""

BODY_DEFAULT = f"""<body>

<header class="board">
  <div class="wrap">
    <div class="kicker">Wilfrid Laurier University &middot; Orientation</div>
    <h1>Orientation <em>Event Finder</em></h1>
    <p class="sub">Every event Laurier publishes across all {len(SOURCES)} orientation schedules — undergraduate, graduate and Bachelor of Education, on all three campuses, plus the international, Indigenous and off-campus streams. Choose who you are and the board filters itself.</p>
  </div>
</header>

<section class="chooser wrap" id="chooser">
  <div class="q">
    <div class="qlabel">Level of study</div>
    <div class="qopts">
        {opts("level", LEVELS, LEVEL_LB)}
    </div>
  </div>
  <div class="q">
    <div class="qlabel">Campus</div>
    <div class="qopts">
        {opts("campus", CAMPUSES)}
    </div>
  </div>
  <div class="q">
    <div class="qlabel">Starting term</div>
    <div class="qopts">
        {opts("term", TERMS)}
    </div>
  </div>
  <div class="q" id="qprogram" hidden>
    <div class="qlabel">Program or faculty <span class="hint">optional — hides other programs' welcomes</span></div>
    <select id="program"><option value="">All programs &mdash; show every welcome</option></select>
  </div>
  <div class="q" id="qstream">
    <div class="qlabel">Also applies to me <span class="hint">optional — unlocks stream-specific events</span></div>
    <div class="qopts">
        {opts("stream", STREAMS, kind="checkbox")}
    </div>
  </div>
  <button id="go" class="go">Show my events</button>
</section>

<div class="whobar" id="whobar" hidden>
  <div class="wrap">
    <span class="who" id="who"></span>
    <button class="chip" id="change">Change</button>
  </div>
</div>

<div class="filterbar" id="filterbar" hidden>
  <div class="wrap">
    <span class="flabel">Show</span>
    <button class="chip on" data-f="fit" data-v="mine">For me</button>
    <button class="chip" data-f="fit" data-v="all">Everything</button>
    <button class="chip" id="pastbtn">Hide past</button>
    <input id="q" placeholder="Search events, venues, hosts...">
    <span class="count" id="count"></span>
  </div>
</div>

<main class="wrap" id="timeline"></main>

<section class="blk wrap" id="notes" hidden>
  <h2>Data <em>notes</em></h2>
  <p class="lede">Discrepancies found in Laurier's own published pages while extracting. Reported, not silently corrected.</p>
  <ol class="todo" id="noteslist"></ol>
</section>

<section class="blk wrap">
  <h2>Sources <em>&amp; citations</em></h2>
  <p class="lede">Every event links back to the exact section of the page it came from. All {len(SOURCES)} schedules were scraped on 31 Aug 2026, including the collapsed accordion panels where Laurier keeps venue, host and registration detail.</p>
  <div class="srcgrid">
{src_html}
  </div>
</section>

<footer class="wrap">
  {len(EV)} events extracted from {len(SOURCES)} Laurier schedule pages &middot; compiled 31 Aug 2026<br>
  Laurier updates these schedules continuously — reconfirm before travelling to a venue &middot; eligibility shown here is an interpretation of each page's stated audience, not an official ruling
</footer>
"""

TAIL = f"""
<script>
const EV = {PAYLOAD};
const TODAY = "{TODAY}";
</script>
<script>
{APP}
</script>
</body>
</html>
"""

# A variant supplies its own body markup and its own script; the chooser vocabulary that
# build.py holds (levels, campuses, terms, streams) is handed over as META so the variant
# can build whatever control surface it likes without re-deriving it from the events.
META = json.dumps({
  "levels": LEVELS, "levelLabels": LEVEL_LB, "campuses": CAMPUSES,
  "terms": TERMS, "streams": STREAMS,
  "nEvents": len(EV), "nDistinct": NDISTINCT, "nSources": len(SOURCES),
  "nWatched": len(WATCHED), "nTracked": len(SOURCES) + len(WATCHED),
  "pageTitles": PAGE_TITLES,
  "sources": [{"file": f, "title": PAGE_TITLES.get(f, f), "url": u} for f, u in SOURCES],
  "watched": [{"title": t, "url": u, "why": w} for u, t, w in WATCHED],
}, separators=(',', ':'), ensure_ascii=False)

if ARGS.body:
    BODY = (open(ARGS.body, encoding='utf-8').read()
            .replace('{{META}}', META)
            .replace('{{SRCGRID}}', src_html)
            .replace('{{WATCHGRID}}', watch_html)
            .replace('{{NSOURCES}}', str(len(SOURCES)))
            .replace('{{NWATCHED}}', str(len(WATCHED)))
            .replace('{{NTRACKED}}', str(len(SOURCES) + len(WATCHED)))
            .replace('{{NEVENTS}}', str(len(EV)))
            .replace('{{NDISTINCT}}', str(NDISTINCT)))
else:
    BODY = BODY_DEFAULT

HTML = HEAD + BODY + TAIL

io.open(ARGS.out, 'w', encoding='utf-8').write(HTML)
print("%s written: %d KB, %d listings / %d distinct events (%s + %s)"
      % (ARGS.out, len(HTML)//1024, len(EV), NDISTINCT, ARGS.css, ARGS.js))
