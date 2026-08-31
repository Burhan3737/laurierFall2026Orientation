"""Regression tests for defects found in review. Run after `python parse.py`.

Each test names the defect it guards against, so a future parser change that
reintroduces one fails here instead of silently shipping.

    python parse.py && python test_regressions.py
"""
import json, re, sys, collections

E = json.load(open('events.json', encoding='utf-8'))['events']
fails = []

def check(name, ok, detail=""):
    (print("  ok   " + name) if ok else fails.append((name, detail)))
    if not ok:
        print("  FAIL " + name + ("  -> " + detail if detail else ""))

def by_title(sub):
    return [e for e in E if sub.lower() in e['title'].lower()]

print("regression tests (%d events)\n" % len(E))

# --- extraction fidelity ---------------------------------------------------
bad = [e['title'] for e in E if e['host'] and len(e['host']) < 3]
check("host not truncated at a split-anchor seam", not bad, str(bad[:3]))

check("venue keeps text after a pipe",
      not any(e['where'] == 'GHG Discord Server' and 'Team Registration' in e.get('desc', '')
              for e in E))

check("concert keeps its real name",
      bool(by_title('French Montana')) and not by_title('Get Your Ticket Now'))

check("sub-events are not named after their parent panel",
      not [e for e in E if e['title'] in ('Community and Connection Programming',
                                          'Athletics and Recreation - Fitness Programming')])

check("'!' titles survive (Valorant / D&D / Yoga)",
      all(by_title(t) for t in ['Valorant Esports Tournament',
                                'Character Creation in Dungeons and Dragons',
                                'Outdoor Yoga Class']))

fire = by_title('Live Fire Safety Demonstration')
check("fire safety is one card with its published time and venue",
      len(fire) == 1 and fire[0]['when'] and 'Parking Lot 20' in fire[0]['where'],
      "n=%d %r" % (len(fire), fire[0] if fire else None))

sc = [e for e in by_title('Scavenger Hunt') if 'brantford' in e['source_file']]
check("bare-text When:/Host: are captured (Brantford Scavenger Hunt)",
      bool(sc) and sc[0]['when'] and sc[0]['host'], str(sc[:1]))

check("no heading mangled by an inline anchor ('Satur day')",
      not any('Satur day' in e['section'] for e in E))

check("no event has an empty title", all(e['title'] for e in E))
check("every event has at least one campus", all(e['campuses'] for e in E))

# --- eligibility -----------------------------------------------------------
ungated = [e['title'] for e in E
           if re.search(r'Students Only', (e.get('desc') or '')[:150], re.I) and not e['tags']]
check("'... Students Only' restrictions are gated", not ungated, str(ungated[:3]))

ex = [e for e in E if e.get('anchor') == 'exchange-waterloo']
check("Exchange Student Orientation is tagged Exchange",
      bool(ex) and all('Exchange' in e['tags'] for e in ex))

# these must NOT be gated: the keyword is in the programme name / an exhibitor list
for t, tag in [('International Public Policy', 'International'),
               ('Indigenous Field of Study', 'Indigenous'),
               ('Academic Resource Fair', 'Accessible Learning')]:
    hits = by_title(t)
    check("'%s' not falsely gated as %s" % (t, tag),
          bool(hits) and not any(tag in e['tags'] for e in hits))

seeds = collections.defaultdict(set)
for e in E:
    if e['source_file'] == 'indigenous.html' and e['date']:
        seeds[e['date']].add(tuple(sorted(e['campuses'])))
check("both SEEDs Waterloo days share the campus scope their page states",
      seeds.get('2026-09-03') == seeds.get('2026-09-04'),
      "%s vs %s" % (seeds.get('2026-09-03'), seeds.get('2026-09-04')))

check("SEEDs day 2 keeps its section anchor",
      all(e['anchor'] for e in E if e['source_file'] == 'indigenous.html' and e['date'] == '2026-09-04'))

# --- completeness ----------------------------------------------------------
for t in ['Start Strong in September', 'Faculty of Education New Student Welcome', 'Your Time']:
    check("published event present: %s" % t, bool(by_title(t)))

for frag, what in [('SV_dmTKuCt50hmm4LA', 'undergraduate Fall registration'),
                   ('SV_enB9GE8BCBrmwDk', 'SEEDs registration'),
                   ('xZf2lSpITnya', 'virtual orientation Zoom')]:
    n = sum(1 for e in E
            if any(frag in l['href'] for l in
                   e.get('links', []) + e.get('section_links', []) + e.get('page_links', [])))
    check("registration link reachable: %s" % what, n > 0, "found on %d events" % n)

# --- coherence -------------------------------------------------------------
contradictions = [e['title'] for e in E
                  if e.get('section_info', {}).get('Location') and 'no-venue' in e['flags']]
check("no card claims a venue and 'no venue' at once", not contradictions, str(contradictions[:3]))

dupes = collections.Counter((e['source_file'], e['title'], e['date'], e['when'], e['where'],
                             tuple(e['campuses'])) for e in E)
extra = {k: v for k, v in dupes.items() if v > 1 and 'Inner Tube Water Polo' not in k[1]}
check("no unexplained duplicate cards", not extra, str(list(extra)[:2]))


# --- program / faculty filtering ------------------------------------------
progs = [e for e in E if e.get('program')]
check("program/faculty extracted at both levels",
      len({e['level'] for e in progs}) >= 2 and len(progs) > 20,
      "%d events, levels=%s" % (len(progs), sorted({e['level'] for e in progs})))

check("every graduate 'Program and Faculty Welcomes' event names its program",
      all(e.get('program') for e in E
          if e['section'] and 'Program and Faculty Welcomes' in e['section']))

check("undergraduate faculty receptions name their faculty",
      all(e.get('program') for e in E
          if e['audience'] and 'undergraduate program' in e['audience']))

mac = [e for e in progs if 'Applied Computing' in e['program']]
check("Master of Applied Computing welcome present", bool(mac),
      "Laurier publishes it on the Brantford graduate page")

print()
if fails:
    print("%d FAILED" % len(fails))
    sys.exit(1)
print("all passed")
