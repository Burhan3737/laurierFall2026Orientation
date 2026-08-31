"""Generate orientation.html (self-contained) from events.json."""
import json, io, re, datetime, subprocess, sys

d = json.load(open('events.json', encoding='utf-8'))
EV = d['events']
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

src_html = "\n".join(
  '    <div class="src"><b>%s</b><span>%s</span><a href="%s" target="_blank" rel="noopener">%s</a></div>'
  % (f.replace('__',' / ').replace('.html',''), PAGE_TITLES.get(f, f), u, u.replace('https://students.wlu.ca','students.wlu.ca'))
  for f, u in SOURCES)

def opts(name, values, labels=None, kind="radio"):
    out = []
    for i, v in enumerate(values):
        lb = (labels or {}).get(v, v)
        out.append('<label class="opt"><input type="%s" name="%s" value="%s"%s><span>%s</span></label>'
                   % (kind, name, v.replace('&','&amp;').replace('"','&quot;'), ' checked' if kind=="radio" and i==0 else '', lb))
    return "\n        ".join(out)

# fail the build rather than shipping a script that will not parse
for f in ('_app.js',):
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    if r.returncode:
        sys.exit('SYNTAX ERROR in %s\n%s' % (f, r.stderr))

CSS = open('_style_min.css', encoding='utf-8').read()

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laurier Orientation — Event Finder</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400&family=IBM+Plex+Sans:wght@300;400&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</head>
<body>

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

<script>
const EV = {PAYLOAD};
const TODAY = "{TODAY}";
</script>
<script>
{open('_app.js', encoding='utf-8').read()}
</script>
</body>
</html>
"""

io.open('orientation.html', 'w', encoding='utf-8').write(HTML)
print("orientation.html written: %d KB, %d events" % (len(HTML)//1024, len(EV)))
