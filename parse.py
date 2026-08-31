"""Extract every orientation event from Laurier's 13 schedule pages into events.json.

Structure Laurier uses consistently:
  <div id="multicomponent_..">  section, containing <a id="slug"> inside its heading
    <button class="accordion-trigger">  event (or day) title
    <div class="accordion-panel">       detail: <p> blocks, with <strong>Where:</strong>/<When:>/<Host:>
A panel may hold MANY sub-events (Athletics bundles); each Where/When <p> ends one sub-event,
and its name is the bolded lead-in of the preceding <p>.
"""
import json, re, os, glob
from bs4 import BeautifulSoup

BASE = "https://students.wlu.ca/support-and-wellness/orientation/assets/schedules/"

# file -> (level, campus, term, stream)
META = {
 "undergraduate__fall-waterloo.html":   ("undergraduate", "Waterloo",  "Fall 2026", None),
 "undergraduate__fall-brantford.html":  ("undergraduate", "Brantford", "Fall 2026", None),
 "undergraduate__fall-milton.html":     ("undergraduate", "Milton",    "Fall 2026", None),
 "undergraduate__fall-virtual.html":    ("undergraduate", "Virtual",   "Fall 2026", None),
 "graduate__fall-waterloo.html":        ("graduate", "Waterloo",  "Fall 2026", None),
 "graduate__fall-brantford.html":       ("graduate", "Brantford", "Fall 2026", None),
 "graduate__fall-virtual.html":         ("graduate", "Virtual",   "Fall 2026", None),
 "graduate__winter.html":               ("graduate", "split",     "Winter 2027", None),
 "graduate__spring.html":               ("graduate", "split",     "Spring 2026", None),
 "bachelor-of-education.html":          ("bachelor-of-education", "split", "Fall 2026", None),
 "international.html":                  ("all", "split", "Fall 2026", "International"),
 "indigenous.html":                     ("all", "split", "Fall 2026", "Indigenous"),
 "locus.html":                          ("undergraduate", "split", "Fall 2026", "Off-campus (LOCUS)"),
}
URL = {
 "undergraduate__fall-waterloo.html":  BASE+"undergraduate/fall-waterloo.html",
 "undergraduate__fall-brantford.html": BASE+"undergraduate/fall-brantford.html",
 "undergraduate__fall-milton.html":    BASE+"undergraduate/fall-milton.html",
 "undergraduate__fall-virtual.html":   BASE+"undergraduate/fall-virtual.html",
 "graduate__fall-waterloo.html":       BASE+"graduate/fall-waterloo.html",
 "graduate__fall-brantford.html":      BASE+"graduate/fall-brantford.html",
 "graduate__fall-virtual.html":        BASE+"graduate/fall-virtual.html",
 "graduate__winter.html":              BASE+"graduate/winter.html",
 "graduate__spring.html":              BASE+"graduate/spring.html",
 "bachelor-of-education.html":         BASE+"bachelor-of-education.html",
 "international.html":                 BASE+"international.html",
 "indigenous.html":                    BASE+"indigenous.html",
 "locus.html":                         BASE+"locus.html",
}
PAGE_TITLE = {}

MONTHS = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,
          "sep":9,"sept":9,"oct":10,"nov":11,"dec":12}
SKIP_ID = re.compile(r'^(accordion|text_block|multicomponent|full_width_banner|breadcrumbs|left_nav|wyntk|menu-button|universal-header|activePage)')

def clean(t):
    return re.sub(r'\s+', ' ', t.replace(' ', ' ')).strip()

def slug_anchor(container):
    """the human-authored #anchor inside a section container, if any"""
    for e in container.find_all(attrs={"id": True}):
        i = e.get('id')
        if i and not SKIP_ID.match(i):
            return i
    return None

def date_from_text(txt, default_year):
    """'Tuesday, Sept. 8' / 'Sept. 8' / 'Aug. 31' -> iso"""
    m = re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})\b', txt)
    if not m:
        return None
    ym = re.search(r'\b(20\d{2})\b', txt)      # prefer an explicit year when the page states one
    if ym:
        default_year = int(ym.group(1))
    mo = MONTHS[m.group(1).lower()[:4].rstrip('.')] if m.group(1).lower()[:4] in MONTHS else MONTHS[m.group(1).lower()[:3]]
    return "%04d-%02d-%02d" % (default_year, mo, int(m.group(2)))

def date_from_slug(slug, default_year):
    if not slug: return None
    m = re.match(r'^(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)-(\d{1,2})$', slug)
    if m:
        return "%04d-%02d-%02d" % (default_year, MONTHS[m.group(1)], int(m.group(2)))
    return None

def links_in(node):
    out = []
    for a in node.find_all('a', href=True):
        t = clean(a.get_text())
        h = a['href']
        if not t or h.startswith('#'): continue
        if h.startswith('/'): h = "https://students.wlu.ca" + h
        out.append({"text": t, "href": h})
    # merge Laurier's split anchors ("Y" + "our Students' Union")
    merged = []
    for l in out:
        if merged and merged[-1]["href"] == l["href"]:
            merged[-1]["text"] += l["text"]
        else:
            merged.append(dict(l))
    return merged

FIELD = re.compile(r'(Where|When|Host|Cost|Intended Audience)\s*:', re.I)

def parse_panel(panel, fallback_title):
    """-> list of sub-event dicts"""
    events, pend_title, pend_desc, pend_links, audience = [], None, [], [], None
    for p in panel.find_all(['p', 'ul', 'ol', 'h3', 'h4', 'h5'], recursive=True):
        if p.find_parent(['ul', 'ol']) and p.name == 'p':
            continue
        txt = clean(p.get_text(' '))
        if not txt:
            continue
        if re.match(r'^Intended Audience\s*:', txt, re.I):
            # the audience is the FIRST line only; a description often follows after a <br>
            first = clean(p.get_text('\n').split('\n')[0])
            aud = clean(re.sub(r'^Intended Audience\s*:', '', first, flags=re.I))
            if not aud:                       # label and value split across the break
                seg = clean(re.sub(r'^Intended Audience\s*:', '', txt, flags=re.I))
                aud = clean(re.split(r'(?<=[a-z])\s+(?=[A-Z][a-z]+\s+(?:us|your|the))', seg)[0])[:90]
            audience = aud
            rest = clean(txt[len(first):]) if txt.startswith(first) else ""
            if rest:
                pend_desc.append(rest)
            continue
        has_where = bool(p.find('strong', string=re.compile(r'Where', re.I))) or bool(re.search(r'\bWhere\s*:', txt))
        has_when  = bool(p.find('strong', string=re.compile(r'When', re.I)))  or bool(re.search(r'\bWhen\s*:', txt))
        if has_where or has_when:
            raw = p.get_text('\n')
            def grab(label):
                m = re.search(label + r'\s*:\s*(.*?)(?:\n|$)', raw, re.I | re.S)
                return clean(m.group(1)) if m else ""
            events.append({
                "title": pend_title or fallback_title,
                "desc": " ".join(pend_desc).strip(),
                "where": grab("Where"), "when": grab("When"),
                "host": grab("Host"), "cost": grab("Cost"),
                "audience": audience,
                "links": pend_links + links_in(p),
            })
            pend_title, pend_desc, pend_links = None, [], []
            continue
        # a bolded lead-in starts a new sub-event block
        lead = p.find(['strong', 'b'])
        if lead and clean(lead.get_text()) and txt.startswith(clean(lead.get_text())[:12]) and len(clean(lead.get_text())) < 90:
            lt = clean(lead.get_text())
            if not FIELD.match(lt):
                if pend_title and pend_desc:
                    pend_desc, pend_links = [], []
                pend_title = lt.rstrip(':').strip()
                rest = clean(txt[len(lt):])
                if rest: pend_desc.append(rest)
                pend_links += links_in(p)
                continue
        pend_desc.append(txt)
        pend_links += links_in(p)
    merged = []
    for e in events:
        if merged:
            pv = merged[-1]
            same = (pv["title"] == e["title"])
            complementary = ((not pv["when"] and e["when"] and not e["where"]) or
                             (not pv["where"] and e["where"] and not e["when"]))
            if same and complementary:
                for k in ("where", "when", "host", "cost"):
                    if not pv[k] and e[k]:
                        pv[k] = e[k]
                if e["desc"] and not pv["desc"]:
                    pv["desc"] = e["desc"]
                pv["links"] += [l for l in e["links"] if l not in pv["links"]]
                continue
        merged.append(e)
    events = merged

    if not events:
        events.append({"title": fallback_title, "desc": " ".join(pend_desc).strip(),
                       "where": "", "when": "", "host": "", "cost": "",
                       "audience": audience, "links": pend_links})
    return events

def parse_page(fname):
    html = open('_src/' + fname, encoding='utf-8', errors='replace').read()
    soup = BeautifulSoup(html, 'html.parser')
    for t in soup(['script', 'style']): t.decompose()
    h1 = soup.find('h1')
    PAGE_TITLE[fname] = clean(h1.get_text()) if h1 else fname
    level, campus, term, stream = META[fname]
    year = 2027 if "Winter" in term else 2026
    out = []
    for cont in soup.find_all('div', id=re.compile(r'^multicomponent_')):
        anchor = slug_anchor(cont)
        head = cont.find(['h2', 'h3'])
        sect = re.sub(r'(\d)([A-Z])', r' ', clean(head.get_text(' '))) if head else ""
        sect_date = date_from_slug(anchor, year) or date_from_text(sect, year)
        if not sect_date:
            cands = []
            for pp in cont.find_all('p'):
                if pp.find_parent('div', class_='accordion-panel'):
                    continue
                t = clean(pp.get_text(' '))
                dd = date_from_text(t, year)
                if dd:
                    cands.append((0 if re.search(r'Date and Time', t, re.I) else 1, dd))
            if cands:
                cands.sort(key=lambda x: x[0])
                sect_date = cands[0][1]
        # campus for split pages (international / indigenous / locus)
        c = campus
        if campus == "split":
            def campus_of(hay):
                if not hay: return None
                if re.search(r'brantford', hay, re.I): return "Brantford"
                if re.search(r'milton', hay, re.I):    return "Milton"
                if re.search(r'virtual', hay, re.I):   return "Virtual"
                if re.search(r'waterloo|kitchener', hay, re.I): return "Waterloo"
                return None
            up = cont.find_previous('h2')
            # the container's OWN heading/anchor wins; only fall back to the enclosing h2
            c = (campus_of((anchor or "") + " " + sect)
                 or campus_of(clean(up.get_text(' ')) if up else "")
                 or "All")
        for btn in cont.find_all('button', class_='accordion-trigger'):
            title = clean(btn.get_text())
            pid = btn.get('id', '').replace('accordion_id_', 'accordion_panel_')
            panel = cont.find(id=pid)
            if panel is None: continue
            d = date_from_text(title, year) or sect_date
            for ev in parse_panel(panel, title):
                dd = d
                if ev["when"]:
                    d2 = date_from_text(ev["when"], year)
                    if d2:
                        dd = d2
                ev.update({"date": dd, "section": sect, "anchor": anchor,
                           "level": level, "campus": c, "term": term,
                           "stream": stream, "source_file": fname,
                           "url": URL[fname] + ("#" + anchor if anchor else "")})
                out.append(ev)
    return out

TAG_RULES = [
 ("International",       r'international|exchange student'),
 ("Exchange",            r'\bexchange\b'),
 ("Indigenous",          r'indigenous|seeds'),
 ("Off-campus (LOCUS)",  r'off-?campus|locus'),
 ("Residence",           r'\bresidence\b'),
 ("Mature & Transfer",   r'mature|transfer student'),
 ("Accessible Learning", r'accessible learning'),
 ("Bachelor of Education", r'bachelor of education|\bbed\b'),
]
OPEN_TO_ALL = re.compile(r'open to all laurier students|all students|open to all|undergraduate and graduate', re.I)

def enrich(e):
    hay = " ".join(filter(None, [e.get("audience"), e.get("title"), e.get("section"), e.get("desc","")[:400]]))
    tags = [name for name, pat in TAG_RULES if re.search(pat, hay, re.I)]
    if e["stream"] and e["stream"] not in tags:
        tags.append(e["stream"])
    e["tags"] = sorted(set(tags))
    e["open_to_all"] = bool(e.get("audience") and OPEN_TO_ALL.search(e["audience"])) or \
                       bool(re.search(r'open to all laurier students|undergraduate and graduate', e.get("desc",""), re.I))
    f = []
    if not e["date"]:  f.append("no-date")
    if not e["when"]:  f.append("no-time")
    if not e["where"]: f.append("no-venue")
    e["flags"] = f
    return e

all_ev = []
for f in sorted(META):
    if not os.path.exists('_src/' + f):
        print("MISSING", f); continue
    ev = [enrich(x) for x in parse_page(f)]
    print("%-38s %3d events" % (f, len(ev)))
    all_ev += ev

json.dump({"page_titles": PAGE_TITLE, "events": all_ev}, open('events.json', 'w', encoding='utf-8'),
          indent=1, ensure_ascii=False)
print("\nTOTAL", len(all_ev))
print("no date:", sum(1 for e in all_ev if not e['date']))
print("no when:", sum(1 for e in all_ev if not e['when']))
