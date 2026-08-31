"""Extract every orientation event from Laurier's 13 schedule pages into events.json.

Structure Laurier uses consistently:
  <div id="multicomponent_..">  section, containing <a id="slug"> inside its heading
    <button class="accordion-trigger">  event (or day) title
    <div class="accordion-panel">       detail: <p> blocks with <strong>Where:</strong>/<When:>/<Host:>
A panel may hold MANY sub-events (Athletics bundles); each Where/When line ends one sub-event.

Field text is read via para_text(), which joins text nodes with NO separator and breaks only
on <br>. Laurier splits anchors mid-word ("<a>Y</a><a>our Students' Union</a>"), so any
whitespace-joining extraction truncates the value at the tag seam.
"""
import json, re, os
from bs4 import BeautifulSoup, NavigableString

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
URL = {f: BASE + f.replace('__', '/') for f in META}
PAGE_TITLE = {}

MONTHS = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,
          "sep":9,"sept":9,"oct":10,"nov":11,"dec":12}
SKIP_ID = re.compile(r'^(accordion|text_block|multicomponent|full_width_banner|breadcrumbs'
                     r'|left_nav|wyntk|menu-button|universal-header|activePage)')
FIELD_RE = r'(?:Where|When|Host|Cost|Intended Audience|Who Should Attend|Registration|Location)'
FIELD = re.compile(FIELD_RE + r'\s*:', re.I)
ALL_CAMPUSES = ["Waterloo", "Brantford", "Milton", "Virtual"]

def clean(t):
    return re.sub(r'\s+', ' ', (t or "").replace('\xa0', ' ')).strip()

def para_text(node):
    """Text with NO separator between inline tags; <br> becomes a newline.
    Keeps 'Your Students' Union' intact across Laurier's split anchors."""
    parts = []
    for n in node.descendants:
        if isinstance(n, NavigableString):
            parts.append(str(n))
        elif getattr(n, 'name', None) == 'br':
            parts.append('\n')
    return ''.join(parts).replace('\xa0', ' ')

def lines_of(node):
    return [clean(l) for l in para_text(node).split('\n') if clean(l)]

def slug_anchor(container):
    for e in container.find_all(attrs={"id": True}):
        i = e.get('id')
        if i and not SKIP_ID.match(i):
            return i
    return None

def date_from_text(txt, default_year):
    m = re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})\b', txt)
    if not m:
        return None
    ym = re.search(r'\b(20\d{2})\b', txt)
    if ym:
        default_year = int(ym.group(1))
    key = m.group(1).lower()
    mo = MONTHS.get(key[:4]) or MONTHS[key[:3]]
    return "%04d-%02d-%02d" % (default_year, mo, int(m.group(2)))

def date_from_slug(slug, default_year):
    if not slug:
        return None
    m = re.match(r'^(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)-(\d{1,2})', slug)
    return "%04d-%02d-%02d" % (default_year, MONTHS[m.group(1)], int(m.group(2))) if m else None

def links_in(node):
    out = []
    for a in node.find_all('a', href=True):
        t = clean(a.get_text())
        h = a['href']
        if not t or h.startswith('#'):
            continue
        if h.startswith('/'):
            h = "https://students.wlu.ca" + h
        out.append({"text": t, "href": h})
    merged = []
    for l in out:
        if merged and merged[-1]["href"] == l["href"]:
            merged[-1]["text"] += l["text"]       # Laurier splits anchors mid-word
        else:
            merged.append(dict(l))
    return merged

def grab(lines, label):
    """value of 'Label:' from a list of lines, stopping at the next field label"""
    for ln in lines:
        m = re.search(label + r'\s*:\s*(.*?)(?=\s*' + FIELD_RE + r'\s*:|$)', ln, re.I)
        if m and clean(m.group(1)):
            return clean(m.group(1))
    return ""

# Reject call-to-action wording and full sentences, NOT every '!' ending:
# 'Valorant Esports Tournament!' is a real event name, 'Get Your Ticket Now!' is not.
CTA = re.compile(r'^(ITINERARY|NOTE|BONUS|Get Your|Click|Register|Sign up|RSVP|Buy|Watch|Learn more|This session)', re.I)

def looks_like_title(s):
    return (bool(s) and len(s) < 90 and len(s.split()) <= 9
            and not s.endswith('.') and not CTA.match(s) and not FIELD.match(s))

def parse_panel(panel, fallback_title):
    """-> list of sub-event dicts"""
    events, pend_title, pend_desc, pend_links, audience = [], None, [], [], None

    blocks = [p for p in panel.find_all(['p', 'ul', 'ol', 'table', 'h3', 'h4', 'h5'], recursive=True)
              if not (p.name == 'p' and p.find_parent(['ul', 'ol', 'table']))]
    if not blocks:                                  # some panels wrap everything in <span>
        blocks = [panel]

    for p in blocks:
        if p.name == 'table':                        # residence building -> room tables
            rows = []
            for tr in p.find_all('tr'):
                cells = [clean(td.get_text(' ')) for td in tr.find_all(['td', 'th'])]
                cells = [c for c in cells if c]
                if cells:
                    rows.append(" — ".join(cells))
            if rows:
                cap = clean((p.find('caption').get_text(' ') if p.find('caption') else "") + " " + rows[0])
                is_venue = bool(re.search(r'location|building|residence|room|where', cap, re.I))
                # Only a location table stands in for a venue. "Who Attends What Session"
                # is a session-assignment table and must not become the venue.
                pend_desc.append(("Locations — " if is_venue else clean(cap) + " — ") + "; ".join(rows))
            continue

        lns = lines_of(p)
        txt = clean(" ".join(lns))
        if not txt:
            continue

        if re.match(r'^Intended Audience\s*:', txt, re.I):
            audience = clean(re.sub(r'^Intended Audience\s*:', '', lns[0], flags=re.I)) or None
            rest = clean(" ".join(lns[1:]))
            if rest:
                pend_desc.append(rest)
            continue

        field_lines = [l for l in lns if FIELD.search(l)]
        if field_lines and re.search(r'\b(Where|When)\s*:', txt, re.I):
            # text before the first field label on the first line is this sub-event's name
            head = re.split(FIELD_RE + r'\s*:', lns[0], maxsplit=1, flags=re.I)[0]
            head = clean(head)
            inline_title = head if looks_like_title(head) else None
            title = inline_title or pend_title or fallback_title
            events.append({
                "title": title,
                "desc": " ".join(pend_desc).strip(),
                "where": grab(lns, "Where"), "when": grab(lns, "When"),
                "host": grab(lns, "Host"),   "cost": grab(lns, "Cost"),
                "audience": audience,
                "links": pend_links + links_in(p),
                "_bold_title": pend_title,
            })
            pend_title, pend_desc, pend_links, audience = None, [], [], None
            continue

        lead = p.find(['strong', 'b'])
        lt = clean(lead.get_text()) if lead else ""
        if lt and txt.startswith(lt[:12]) and looks_like_title(lt):
            if pend_title and pend_desc:
                pend_desc, pend_links = [], []
            pend_title = lt.rstrip(':').strip()
            rest = clean(txt[len(lt):])
            if rest:
                pend_desc.append(rest)
            pend_links += links_in(p)
            continue

        pend_desc.append(txt)
        pend_links += links_in(p)

    # Fields left as bare text children of the panel (no wrapping <p>) — happens once,
    # on the Brantford Scavenger Hunt, which otherwise loses its published time and host.
    stray = []
    for c in panel.children:
        if getattr(c, 'name', None) in ('p', 'ul', 'ol', 'table', 'h3', 'h4', 'h5'):
            continue
        if isinstance(c, NavigableString):
            stray.append(str(c))
        elif getattr(c, 'name', None) == 'br':
            stray.append('\n')
        else:
            stray.append(para_text(c))
            pend_links += [l for l in links_in(c) if l not in pend_links]
    stray_lines = [clean(l) for l in ''.join(stray).split('\n') if clean(l)]
    if events and stray_lines:
        for key, label in (("when", "When"), ("where", "Where"), ("host", "Host"), ("cost", "Cost")):
            if not events[-1][key]:
                v = grab(stray_lines, label)
                if v:
                    events[-1][key] = v

    # trailing prose after the last Where/When belongs to the last event
    if events and (pend_desc or pend_links):
        tail = " ".join(pend_desc).strip()
        if tail:
            events[-1]["desc"] = (events[-1]["desc"] + " " + tail).strip()
        events[-1]["links"] += [l for l in pend_links if l not in events[-1]["links"]]
        if not events[-1]["host"]:
            events[-1]["host"] = grab([tail], "Host")

    # a lone sub-event never takes a bold lead-in as its name: the accordion title is better
    if len(events) == 1 and events[0].get("_bold_title") and events[0]["title"] == events[0]["_bold_title"]:
        events[0]["title"] = fallback_title
    for e in events:
        e.pop("_bold_title", None)

    # merge sub-events split across paragraphs (Where in one <p>, When in the next)
    merged = []
    for e in events:
        if merged:
            pv = merged[-1]
            complementary = ((not pv["when"] and e["when"] and not e["where"]) or
                             (not pv["where"] and e["where"] and not e["when"]))
            if pv["title"] == e["title"] and complementary:
                for k in ("where", "when", "host", "cost"):
                    if not pv[k] and e[k]:
                        pv[k] = e[k]
                if e["desc"] and e["desc"] not in pv["desc"]:
                    pv["desc"] = (pv["desc"] + " " + e["desc"]).strip()
                pv["links"] += [l for l in e["links"] if l not in pv["links"]]
                continue
        merged.append(e)
    events = merged

    for e in events:
        if not e["where"] and "Locations —" in e["desc"]:
            e["where"] = "See building list in the details"

    if not events:
        events.append({"title": fallback_title, "desc": " ".join(pend_desc).strip(),
                       "where": "", "when": "", "host": "", "cost": "",
                       "audience": audience, "links": pend_links})
    return events

def section_prose(cont):
    """paragraphs of a section that sit OUTSIDE any accordion panel"""
    return [p for p in cont.find_all('p') if not p.find_parent('div', class_='accordion-panel')]

def parse_page(fname):
    html = open('_src/' + fname, encoding='utf-8', errors='replace').read()
    soup = BeautifulSoup(html, 'html.parser')
    for t in soup(['script', 'style']):
        t.decompose()
    h1 = soup.find('h1')
    PAGE_TITLE[fname] = clean(h1.get_text()) if h1 else fname
    level, campus, term, stream = META[fname]
    year = 2027 if "Winter" in term else 2026
    out = []

    # Page-level "Register Now!" calls-to-action live in top-level text blocks that sit
    # OUTSIDE any multicomponent container, so the section walk below never sees them.
    page_links = []
    for blk in soup.find_all(attrs={"id": re.compile(r'^text_block_')}):
        if blk.find_parent('div', id=re.compile(r'^multicomponent_')):
            continue
        t = clean(blk.get_text(' '))
        if re.search(r'regist|rsvp|sign up', t, re.I):
            for l in links_in(blk):
                if l not in page_links and not re.search(r'/orientation/(undergraduate|graduate)\.html$', l['href']):
                    page_links.append(l)

    prev_anchor, prev_campuses, prev_info = None, None, None
    for cont in soup.find_all('div', id=re.compile(r'^multicomponent_')):
        anchor = slug_anchor(cont)
        head = cont.find(['h2', 'h3'])
        # para_text joins with no separator, so a heading split by an inline anchor
        # ("Satur<a id=...></a>day") does not become "Satur day".
        sect = re.sub(r'(\d)([A-Z])', r'\1 \2', clean(para_text(head))) if head else ""
        prose = section_prose(cont)
        prose_txt = [clean(" ".join(lines_of(p))) for p in prose]

        sect_date = date_from_slug(anchor, year) or date_from_text(sect, year)
        if not sect_date:
            cands = []
            for t in prose_txt:
                dd = date_from_text(t, year)
                if dd:
                    cands.append((0 if re.search(r'Date and Time', t, re.I) else 1, dd))
            if cands:
                cands.sort(key=lambda x: x[0])
                sect_date = cands[0][1]

        # campus: this container's own heading wins, then the enclosing <h2>
        def campus_of(hay):
            if not hay:
                return None
            if re.search(r'brantford', hay, re.I):            return "Brantford"
            if re.search(r'milton', hay, re.I):               return "Milton"
            if re.search(r'virtual', hay, re.I):              return "Virtual"
            if re.search(r'waterloo|kitchener', hay, re.I):   return "Waterloo"
            return None
        if campus == "split":
            up = cont.find_previous('h2')
            c = (campus_of((anchor or "") + " " + sect)
                 or campus_of(clean(up.get_text(' ')) if up else "") or "All")
        else:
            c = campus
        campuses = [c] if c != "All" else list(ALL_CAMPUSES)
        # A continuation subsection (only an <h3>, no anchor of its own) is still governed
        # by the preceding section: SEEDs day 2 otherwise loses its campus scope and anchor.
        if anchor is None and head is not None and head.name == 'h3' and prev_anchor:
            anchor = prev_anchor
            campuses = list(prev_campuses)

        # "Who Should Attend: Students from the Milton, Virtual, and Waterloo Campuses"
        for t in prose_txt:
            m = re.search(r'Who Should Attend\s*:\s*(.*)', t, re.I)
            if m:
                named = [x for x in ALL_CAMPUSES if re.search(r'\b' + x + r'\b', m.group(1), re.I)]
                if named:
                    campuses = sorted(set(campuses) | set(named))

        # section-level facts and registration calls-to-action
        sect_info, sect_links = {}, []
        for p, t in zip(prose, prose_txt):
            for label in ("Registration", "Location", "Cost"):
                v = grab([t], label)
                # a section fact of "TBD" adds nothing and reads as a contradiction
                # next to the card's own "not published" venue line
                if v and clean(v).upper() not in ("TBD", "TBA", "N/A") and label not in sect_info:
                    sect_info[label] = v
            if re.search(r'regist|rsvp|sign up|tickets?', t, re.I):
                sect_links += [l for l in links_in(p) if l not in sect_links]
        # CTA buttons sit in bare <div>s, not <p>s, so scan the section's text blocks too
        for blk in cont.find_all('div', id=re.compile(r'^text_block_')):
            if blk.find_parent('div', class_='accordion-panel'):
                continue
            if re.search(r'regist|rsvp|sign up', clean(blk.get_text(' ')), re.I):
                for l in links_in(blk):
                    if l not in sect_links and not re.search(r'/orientation/(undergraduate|graduate)\.html', l['href']):
                        sect_links.append(l)
        if re.search(r'open to ALL new to Laurier undergraduate students only', " ".join(prose_txt), re.I):
            sect_info["Note"] = "Laurier states events on this page are open to new undergraduate students only unless otherwise noted."

        if anchor:
            prev_anchor, prev_campuses = anchor, list(campuses)

        triggers = cont.find_all('button', class_='accordion-trigger')
        # A section that yields no events still carries page-wide registration links
        # ("Have You Registered For Orientation?"); promote them so they are not lost.
        if not triggers and sect_links:
            for l in sect_links:
                if l not in page_links:
                    page_links.append(l)
        made = 0
        for btn in triggers:
            title = clean(btn.get_text())
            panel = cont.find(id=btn.get('id', '').replace('accordion_id_', 'accordion_panel_'))
            if panel is None:
                continue
            d = date_from_text(title, year) or sect_date
            for ev in parse_panel(panel, title):
                if not ev["where"] or clean(ev["where"]).upper() in ("TBD", "TBA", "N/A"):
                    ev["where"] = sect_info.get("Location", "") or ev["where"]
                    if not ev["where"] and re.search(r'zoom', " ".join(prose_txt), re.I):
                        ev["where"] = "Zoom"
                dd = date_from_text(ev["when"], year) or d if ev["when"] else d
                ev.update({"date": dd, "section": sect, "anchor": anchor,
                           "level": level, "campus": c, "campuses": campuses, "term": term,
                           "stream": stream, "source_file": fname,
                           "section_info": sect_info, "section_links": sect_links, "page_links": page_links,
                           "url": URL[fname] + ("#" + anchor if anchor else "")})
                out.append(ev)
                made += 1

        # Overview items with no accordion of their own (e.g. SEEDs "Your Time! 6:30 p.m.
        # onwards") would otherwise be dropped, since extraction is accordion-driven.
        if triggers:
            known = {clean(b.get_text()).lower() for b in triggers}
            for p in prose:
                lns = lines_of(p)
                if len(lns) < 2:
                    continue
                lead = p.find(['strong', 'b'])
                nm = clean(lead.get_text()) if lead else ""
                if not nm or not looks_like_title(nm) or FIELD.search(lns[0]):
                    continue
                rest = clean(" ".join(lns[1:]))
                if not re.match(r'^\d{1,2}(:\d\d)?\s*(a\.m\.|p\.m\.|onwards|-|to)', rest, re.I):
                    continue
                if any(nm.lower() in k or k in nm.lower() for k in known):
                    continue
                out.append({
                    "title": nm, "desc": "", "where": sect_info.get("Location", ""),
                    "when": rest, "host": "", "cost": sect_info.get("Cost", ""),
                    "audience": None, "links": [],
                    "date": sect_date, "section": sect, "anchor": anchor,
                    "level": level, "campus": c, "campuses": campuses, "term": term,
                    "stream": stream, "source_file": fname,
                    "section_info": sect_info, "section_links": sect_links,
                    "page_links": page_links,
                    "url": URL[fname] + ("#" + anchor if anchor else ""),
                })

        # A section with no accordion can still BE an event (e.g. the Virtual Campus welcome).
        # It must carry its own heading — otherwise it is page intro prose that merely
        # mentions a date, which is how this first misfired.
        if (not triggers and sect and sect_date
                and any(re.search(r'\b\d{1,2}(:\d\d)?\s*(a\.m\.|p\.m\.)', t, re.I) for t in prose_txt)):
            when = ""
            for t in prose_txt:
                m = re.search(r'(\d{1,2}(?::\d\d)?\s*(?:-|to|–)\s*\d{1,2}(?::\d\d)?\s*(?:a\.m\.|p\.m\.))', t, re.I)
                if m:
                    when = clean(m.group(1)); break
            body = [t for t in prose_txt if len(t) > 60]
            out.append({
                "title": sect, "desc": " ".join(body[:2]),
                "where": sect_info.get("Location", "Zoom" if re.search(r'zoom', " ".join(prose_txt), re.I) else ""),
                "when": when, "host": "", "cost": sect_info.get("Cost", ""),
                "audience": None, "links": sect_links or [l for p in prose for l in links_in(p)],
                "date": sect_date, "section": sect, "anchor": anchor,
                "level": level, "campus": c, "campuses": campuses, "term": term,
                "stream": stream, "source_file": fname,
                "section_info": sect_info, "section_links": sect_links, "page_links": page_links,
                "url": URL[fname] + ("#" + anchor if anchor else ""),
            })
    return out

# ---- identity tagging ------------------------------------------------------
# Matched against `audience` and against explicit "... Only" phrasing in the title/section.
# Never against free-text descriptions: "Accessible Learning" appears in Resource Fair
# exhibitor lists, and "Indigenous"/"International" appear inside program NAMES.
TAG_RULES = [
 ("International",        r'international|exchange'),
 ("Exchange",             r'\bexchange\b'),
 ("Indigenous",           r'indigenous|seeds'),
 ("Off-campus (LOCUS)",   r'off-?campus|locus'),
 ("Residence",            r'\bresidence\b'),
 ("Mature & Transfer",    r'mature|transfer student'),
 ("Accessible Learning",  r'accessible learning'),
]
# Requires the literal phrase "... Students Only". Laurier writes the restriction in a
# <span> after the bolded title, which lands in `desc`, so `desc` must be searched — but
# only for this exact phrasing. Matching bare keywords in `desc` wrongly tags program
# names ("...Indigenous Field of Study") and exhibitor lists ("...Accessible Learning...").
ONLY_PHRASE = re.compile(r'([A-Za-z&\-\' ]{3,60}?)\s+Students\s+Only\b', re.I)
# A section heading that names a stream ("Exchange Student Orientation") governs its events.
SECT_STREAM = re.compile(r'\b(Exchange|International|Indigenous)\s+Student', re.I)
OPEN_TO_ALL = re.compile(r'open to all laurier students|undergraduate and graduate', re.I)

def enrich(e):
    hay = e.get("audience") or ""
    m = ONLY_PHRASE.search(e.get("title", "") + " " + (e.get("section") or "")
                           + " " + e.get("desc", "")[:250])
    if m:
        phrase = clean(m.group(1))
        # the match can start mid-sentence ("... Events - International and Exchange")
        phrase = re.sub(r'^.*?[-–]\s*', '', phrase).strip(' -–')
        hay += " " + phrase + " Students Only"
        if not e.get("audience") and phrase:
            e["audience"] = phrase + " Students Only"
    sm = SECT_STREAM.search(e.get("section") or "")
    if sm:
        hay += " " + sm.group(1)
    tags = [name for name, pat in TAG_RULES if re.search(pat, hay, re.I)]
    if e["stream"] and e["stream"] not in tags:
        tags.append(e["stream"])
    e["tags"] = sorted(set(tags))
    e["open_to_all"] = bool(OPEN_TO_ALL.search((e.get("audience") or "") + " " + e.get("desc", "")))

    def missing(v):
        return (not v) or clean(v).upper() in ("TBD", "TBA", "N/A")
    f = []
    if not e["date"]:          f.append("no-date")
    if missing(e["when"]):     f.append("no-time")
    if missing(e["where"]):    f.append("no-venue")
    e["flags"] = f
    return e

all_ev = []
for f in sorted(META):
    if not os.path.exists('_src/' + f):
        print("MISSING", f); continue
    ev = [enrich(x) for x in parse_page(f)]
    print("%-38s %3d events" % (f, len(ev)))
    all_ev += ev

# build-time guards: these would silently hide events in the UI
assert all(e["campuses"] for e in all_ev), "event with no campus would be invisible"
assert all(e["title"] for e in all_ev), "event with no title"

json.dump({"page_titles": PAGE_TITLE, "events": all_ev},
          open('events.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print("\nTOTAL", len(all_ev))
print("no date:", sum(1 for e in all_ev if 'no-date' in e['flags']),
      " no time:", sum(1 for e in all_ev if 'no-time' in e['flags']),
      " no venue:", sum(1 for e in all_ev if 'no-venue' in e['flags']))
print("host truncated to 1 char:", sum(1 for e in all_ev if len(e['host']) == 1))
print("section-level links captured:", sum(1 for e in all_ev if e['section_links']))
