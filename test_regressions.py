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

# These guard the parser, not Laurier's editorial decisions: each is a live
# registration link that the extraction has dropped before. The virtual page's
# Zoom link used to be xZf2lSpITnya ("Register Now!" on Start Strong in
# September); on 3 Sept 2026 Laurier retired it and published a YouTube
# recording in its place, so the fragment no longer exists anywhere on any of
# the thirteen pages. Chasing the removal is right — an assertion about a link
# Laurier has deleted stops testing anything and only teaches you to ignore a
# red run — so it now watches the Zoom registration that page still carries.
for frag, what in [('SV_dmTKuCt50hmm4LA', 'undergraduate Fall registration'),
                   ('SV_enB9GE8BCBrmwDk', 'SEEDs registration'),
                   ('1iqV53a_S2yTyNJLLDRUSA', 'virtual orientation Zoom')]:
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


# the chooser must offer a way out for programs Laurier publishes no welcome for
app = open('_app.js', encoding='utf-8').read()
check("chooser offers 'my program is not listed'",
      'NO_PROGRAM' in app and 'My program is not listed' in app)
check("that option hides every program welcome",
      'sel.program === NO_PROGRAM && e.pg' in app)


# --- audit round 4 -------------------------------------------------------
ind = [e for e in E if e['source_file'] == 'indigenous.html']
check("no near-duplicate SEEDs cards from the overview sweep", len(ind) == 20,
      "%d events (Laurier publishes 20)" % len(ind))

for t in ["Setting Yourself Up for Success at University", "University 101 Session (Students Only)"]:
    hits = by_title(t)
    check("SEEDs keeps the detailed accordion copy: %s" % t[:34],
          len(hits) == 1 and len(hits[0]['desc']) > 100)

# the filter groups must be built from the settled selection, not a transient one
check("conditional filters rebuilt after the campus/term fallback",
      "refreshConditional(s2)" in app)

# data notes must describe the board as it actually behaves
# The board is Fall 2026 only. Winter and Spring were dropped from parse.py's META,
# so their notes were removed with them - a note whose condition can never be true
# is a claim nobody can check.
check("the board carries one term only",
      {e['term'] for e in E} == {'Fall 2026'}, str(sorted({e['term'] for e in E})))
check("no note is left describing a term the board no longer carries",
      'Winter 2027' not in app and 'Spring 2026' not in app)
check("program note reflects that filtering now exists",
      "Program welcomes are not filtered by program" not in app
      and "Program or faculty" in app)


# --- audit round 5 -------------------------------------------------------
fm = by_title('French Montana')
check("concert keeps its published ticket price",
      bool(fm) and '$30' in (fm[0]['cost'] or ''), repr(fm[0]['cost']) if fm else 'missing')
check("bold blocks that are not sub-event titles are kept, not discarded",
      bool(fm) and all(k in fm[0]['desc'].lower() for k in ('re-entry', '19+')))

check("data notes emit real punctuation, not escape sequences",
      '\\u201' not in app and '\\u2014' not in app)

check("stream ticks survive a level switch through an invalid combination",
      'keepStreams' in app and 'keepStreams.indexOf(i.value) >= 0' in app)

intl = [e for e in E if e['source_file'] == 'international.html']
labels = [l['text'] for l in (intl[0].get('page_links') or [])] if intl else []
check("page-level CTAs sharing a label are disambiguated",
      len(labels) == len(set(labels)), str(labels))


# --- audit round 6 -------------------------------------------------------
rel = [e for e in E if e.get('program') and 'Religious Studies' in e['program']]
check("a suffixed program name folds into the bare one",
      len({e['program'] for e in rel}) == 1 and len(rel) == 2,
      str(sorted({e['program'] for e in rel})))

fm2 = by_title('French Montana')
# This test used to assert only that CONCERT POLICIES came before the word
# "backpack", which both hold when every heading is hoisted to the front in
# reverse order - which is exactly what the parser was doing. It now pins the
# whole chain, in the order Laurier publishes it.
POLICY_ORDER = ['CONCERT POLICIES', 'Venue Entrance', 'Transportation', 'Weather Policy',
                'Food and Beverage', 'Smoking', 'Bag & Item Policy']
found = [fm2[0]['desc'].find(h) for h in POLICY_ORDER] if fm2 else []
check("every policy heading survives and stays in source order",
      bool(fm2) and all(i >= 0 for i in found) and found == sorted(found),
      str(list(zip(POLICY_ORDER, found))))

# Each heading must sit against the rules it introduces, not merely before them.
check("a policy heading is followed by its own rule, not another heading",
      bool(fm2) and 'no re-entry' in fm2[0]['desc'][fm2[0]['desc'].find('Venue Entrance'):
                                                    fm2[0]['desc'].find('Transportation')])

check("a bold lead-in stays with the text it introduces",
      bool(fm2) and 'Tickets are only $30!!! (+ $1.50 processing fee)' in fm2[0]['desc'],
      "the price and its fee were separated")

# join_lead punctuates a bold lead-in against the text after it, and used to do
# so even when the lead-in already ended in a stop. Laurier's own prose contains
# a stray ".." (the Science welcome), so a double full stop is not by itself a
# defect; only the ones this parser can create are tested.
check("a bold lead-in ending in a stop is not given a second one",
      not any('!.' in e['desc'] or '?.' in e['desc'] for e in E),
      str([e['title'] for e in E if '!.' in e['desc'] or '?.' in e['desc']][:3]))

check("football keeps its ENTRANCE DETAILS heading",
      sum(1 for e in E if 'ENTRANCE DETAILS' in e['desc']) == 2)

check("nested lists are not emitted twice",
      not any(e['desc'].count('end zone closest to Albert') > 1 for e in E))

bad_join = [l['text'] for e in E for l in e.get('links', [])
            if 'clicking here' in l['text'] and 'LOCUS Links' in l['text']]
check("non-adjacent anchors sharing an href are not glued together", not bad_join, str(bad_join))
check("mid-word split anchors are still rejoined",
      any(l['text'] == "Your Students' Union" for e in E for l in e.get('links', [])))

# --- multi-day panels ------------------------------------------------------
# Lazaridis publishes four graduate welcomes as a single panel spanning three
# days: "Sept. 8 from 10 a.m. to 4 p.m., Sept. 9 from 11 a.m. to 4 p.m. and
# Sept. 10 from 2 to 4 p.m." Read as one event it landed only on Sept. 8, so an
# MBA student looking at Wednesday saw nothing and would have missed day two of
# their own orientation. Each day is now its own listing, carrying the hours
# Laurier published for that day and the full published string in runs_over.
be = [e for e in E if e['title'].startswith('Master of Arts in Business Economics')]
check("a multi-day panel becomes one listing per day",
      sorted(e['date'] for e in be) == ['2026-09-08', '2026-09-09', '2026-09-10'],
      str(sorted(e['date'] for e in be)))

check("each split day keeps the hours published for that day",
      sorted((e['date'], e['when']) for e in be)
      == [('2026-09-08', '10 a.m. to 4 p.m'), ('2026-09-09', '11 a.m. to 4 p.m'),
          ('2026-09-10', '2 to 4 p.m')],
      str(sorted((e['date'], e['when']) for e in be)))

check("a split listing records the string Laurier actually published",
      bool(be) and all(e.get('runs_over', '').startswith('Sept. 8 from 10 a.m.')
                       and 'Sept. 10 from 2 to 4 p.m' in e['runs_over'] for e in be))

# The split must fire only where Laurier really published several dates. Every
# ordinary single-day event losing its date to an over-greedy regex is the far
# worse failure, and it would not be visible on the board.
split = [e for e in E if e.get('runs_over')]
check("the split fires only on genuinely multi-day panels",
      len(split) == 12 and len({e['title'] for e in split}) == 4,
      "%d listings across %d titles" % (len(split), len({e['title'] for e in split})))

check("no single-day event was split",
      all(e['runs_over'].count(' and ') >= 1 for e in split))

# --- blocks Laurier did not write as paragraphs ----------------------------
# Outlook pastes copy as <div class="elementToProof">, and the parser read only
# p/ul/ol/table/h-tags. World Suicide Awareness Day put both of its sub-events in
# bare divs, so the board drew two cards with the same accordion title and not one
# word of description - a student could not tell the morning flag raising from the
# evening vigil.
for name in ('Flag Raising Ceremony', 'An Evening of Hope and Healing'):
    got = by_title(name)
    check("a sub-event written in a <div> keeps its own name (%s)" % name, len(got) == 2,
          "%d listings" % len(got))
    check("...and its description (%s)" % name,
          bool(got) and all(len(e['desc']) > 200 for e in got),
          str([len(e['desc']) for e in got]))

check("a description written in a <div> is not dropped",
      all(e['desc'] for e in by_title('Orientation Check-In')),
      str([(e['url'].rsplit('/', 1)[-1], len(e['desc'])) for e in by_title('Orientation Check-In')]))

# A wrapper div holding other blocks must not be taken as well as its children.
bad_twice = [e['title'] for e in E
             if any(t and e['desc'].count(t) > 1
                    for t in [e['desc'][:80]] if len(e['desc']) > 160)]
check("a wrapping <div> does not emit its contents twice", not bad_twice, str(bad_twice[:3]))

# --- prose sharing a block with the fields ---------------------------------
# Laurier puts a sentence after the last "Host:" line, separated only by <br>.
# grab() reads a value from a single line and never across lines, so anything
# below the last labelled line is prose. It used to be discarded, which lost the
# Academic Resource Fair's pointer to the Get Involved Fair while keeping the
# pointer back from the Fair - the board showed one half of a pair.
GIF = "Looking for ways to get involved outside the classroom"
carry = [e for e in E if GIF in e['desc']]
check("prose after the last field label is kept", len(carry) == 2, "%d listings" % len(carry))
check("...and only where Laurier published it",
      all('Academic Resource Fair' in e['title'] or 'Academic Res' in e['title'] for e in carry),
      str([e['title'] for e in carry]))

# --- source hygiene --------------------------------------------------------
# A word-boundary escape written inside a shell heredoc arrives as a literal backspace (0x08).
# It has silently disabled a regex in this parser more than once; the character
# is invisible in every editor and the regex simply stops matching.
import glob
dirty = []
for f in sorted(glob.glob('*.py') + glob.glob('_*.js') + glob.glob('_body*.html')):
    t = open(f, encoding='utf-8', errors='replace').read()
    if any(ord(c) < 9 or 13 < ord(c) < 32 for c in t):
        dirty.append(f)
check("no source file contains a stray control character", not dirty, str(dirty))

print()
if fails:
    print("%d FAILED" % len(fails))
    sys.exit(1)
print("all passed")
