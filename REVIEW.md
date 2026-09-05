# Review log

Two independent review passes were run against the generated event finder. The second
reviewer was given only the 13 source URLs, the generated page and the verification goals
— no knowledge of the first review or its findings — and was explicitly told that
"no problems found" was a valid result, so as not to manufacture issues.

---

## Round 2 findings and resolution

Status key: **fixed** · *reproduced deliberately* · not a defect

| # | Finding | Status |
|---|---|---|
| 1 | 10 events lost their "… Students Only" restriction and showed to everyone as "For you" (grocery tour, Music Bingo, journal decorating, ISL meet-and-greet) | **fixed** |
| 2 | Exchange Student Orientation was hidden from a student who ticks "Exchange" — its 7 events were tagged International only | **fixed** |
| 3 | 24 sub-events displayed their parent panel's title, producing 8 groups of identical cards | **fixed** |
| 4 | Fire Safety Demonstration split into two cards; one claimed "Time TBA" though the page publishes a time; the other's venue was invented from a session-assignment table | **fixed** |
| 5 | Brantford Scavenger Hunt dropped its published time and host (Laurier left them as bare text outside any `<p>`) | **fixed** |
| 6 | 17 cards said `Location: Zoom` and `Where: not published` simultaneously | **fixed** |
| 7 | SEEDs day 2 lost its campus scope and its `#waterloo` anchor, so Milton/Virtual students saw day 1 but not day 2 | **fixed** |
| 8 | One published item, "Your Time! 6:30 p.m. onwards", was missing — it has no accordion | **fixed** |
| 9 | `cms03.wlu.ca` link does not resolve (NXDOMAIN) | *reproduced, flagged* — Laurier leaked a CMS authoring URL into their own page; the copy is faithful, so the card now labels it "link broken on Laurier's site" rather than hiding it |
| 10 | Button read "up to N" then rendered an empty board; one heading stored as "Satur day" | **fixed** (heading); empty state now points at the stream checkboxes |

### Four of these were regressions from the round-1 fixes

Worth recording, because the pattern was over-correction:

- **#1** — round 1 stopped matching tags against descriptions, to kill false positives where
  "Accessible Learning" appeared in an exhibitor list and "Indigenous"/"International" appeared
  inside programme names. That also removed the legitimate signal, because Laurier writes the
  restriction in a `<span>` after the title, which lands in the description. The rule is now
  narrow: it matches only the literal phrase `"… Students Only"`, which the programme names
  do not contain.
- **#3** — round 1 rejected any candidate title ending in `!` to block "Get Your Ticket Now!".
  That also rejected "Valorant Esports Tournament!" and "Group Exercise: Outdoor Yoga Class!".
  Now only call-to-action wording and full sentences are rejected.
- **#4** and **#6** were introduced by the round-1 table-handling and section-facts changes.

`test_regressions.py` exists so these cannot silently return.

---

## Verified sound in round 2

Checked across **all 503 events**, not a sample:

- 379/379 accordion panels processed; **no fabricated values** anywhere
- 487/487 citation anchors resolve *and* point at the section the event actually came from
- 147/149 links resolve (1 `mailto:`, 1 the dead Laurier link above)
- All 13 live pages matched the `_src/` snapshots *at the time of that review*
  (Laurier has since edited four pages — see round 3)
- Zero date/weekday errors; zero console errors across 14 chooser states
- Source errors reproduced rather than silently corrected

## Known limitations, by choice

- **Programme granularity.** 24 graduate programme welcomes carry no audience restriction on
  Laurier's page, so they appear for every graduate student on that campus. Each card is
  marked programme-specific and a data note explains it. Filtering properly would need a
  taxonomy of ~28 programme names.
- **Virtual** is treated as a delivery mode, not a campus. It is an optional filter
  alongside the identity streams; the 31 online events are hidden until it is ticked, and
  then appear from any campus, marked "Online".
- **Kitchener** folds into Waterloo, matching Laurier's own grouping
  ("Waterloo and Kitchener Student Orientation"), but the word does not appear in the UI.
- **Spring graduate schedule** lists January dates. Reproduced exactly and flagged in a
  data note; confirm with `aspire@wlu.ca` before relying on it.
- **Winter 2027** is a placeholder: all 20 events undated, TBD time and venue.


---

## Round 3 findings and resolution

| # | Finding | Status |
|---|---|---|
| 1 | Laurier published new events after the snapshot: Suicide Prevention Day Awareness (Waterloo UG + grad), World Suicide Awareness Day (Brantford UG + grad, two sub-events each) and **Math Grad Orientation** — 7 event instances missing | **fixed** — re-scraped; 503 → 510 events |
| 2 | The "Mature & Transfer" stream gated zero events; the 7 MTS sub-events showed to every undergraduate as "For you" with no audience shown | **fixed** — now gates 7 |
| 3 | "Welcome Meeting" and "Social" told the student to attend only their own programme's welcome but never named the programme | **fixed** — cards show the parent accordion |

The auditor reported four pages each gaining one panel. Verifying independently found
**five** new panels: `graduate/fall-waterloo.html` gained two, the second being
Math Grad Orientation.

**Root cause of 2 and 3 was the same.** A sub-event knew nothing about the accordion it
came from. Laurier puts the audience there ("Mature and Transfer Student Events") and the
programme name there ("Master of Applied Politics, Political Science"). Recording the
parent panel fixes both, and is more robust than widening the phrase-matching regex —
widening it is what caused the round-2 regressions.

While fixing this, two regexes were found to contain literal backspace characters (0x08)
where a word-boundary escape was intended, introduced by shell here-doc escaping in an earlier round. One
silently disabled a Zoom venue fallback (`no-venue` 43 → 37 once repaired). The files are
now checked for stray control characters.

`check_drift.py` was added: it re-fetches all 13 pages and reports added or removed
accordion panels against the snapshots, so staleness fails loudly instead of silently.
Run `python check_drift.py` before trusting the board.


---

## Round 4 findings and resolution

Audited by the new `orientation-auditor` agent against HEAD, after it re-ran the pipeline.

| # | Finding | Status |
|---|---|---|
| 1 | Switching level while an invalid campus/term was selected hid every filter group, stranding 80 events for an undergraduate. The filter pool was computed before the campus/term fallback and never recomputed | **fixed** |
| 2 | Two near-duplicate SEEDs cards. Laurier publishes each session twice, worded differently ("Setting Yourself Up..." vs "Set Yourself Up..."), and the substring dedup missed it. The duplicate also lost the "(Students Only)" restriction, which matters because a parents' session runs in the same slot | **fixed** — 510 → 508 events |
| 3 | Two data notes contradicted the board: the Winter note claimed all 20 events lack a venue (6 state Zoom), and the program note said filtering by program was not possible after the dropdown had been added | **fixed** |

Finding 1 was a regression introduced by the conditional-rendering change in the same
session. It is the reason `refreshConditional` is now called with the settled selection.

Verified sound across 510 events at the time of audit: no fabricated, truncated or
mis-attributed field anywhere; 384/384 accordion panels producing events; 85/86 outbound
links resolving (the exception being the known Laurier-authored dead link); 504/510
citation fragments resolving to the originating section; zero console errors across 74
headless renders; and the Virtual change confirmed correct in all four respects, including
SEEDs correctly not being treated as online.


---

## Round 5 findings and resolution

| # | Finding | Status |
|---|---|---|
| 1 | The concert's published ticket price was dropped. A bold lead-in that never became a sub-event title was discarded with its block, so the card showed only "(+ $1.50 processing fee)" for a $31.50 ticket, and lost the re-entry, bussing, weather and 19+ policies | **fixed** — `cost` now reads "$30 (+ $1.50 processing fee)" |
| 2 | Data note 5 printed literal `“` escape sequences, from a doubled backslash | **fixed** |
| 3 | Residual half of round 4 #1: filter *groups* were rebuilt correctly, but a ticked stream was still silently cleared when switching level through an invalid campus/term | **fixed** — ticks are captured before the first pass and restored after the settled one |
| 4 | All 21 international cards showed two links both labelled "Register Now!" pointing at different pages, so a graduate student could land on undergraduate registration | **fixed** — duplicates qualified from their target |

Finding 1 was the only published fact missing anywhere on the board, out of a sweep of
every monetary amount in all 384 source panels.

Verified sound across all 508 events: no fabricated, truncated or mis-attributed field;
384/384 accordion panels producing events; 87 outbound links with 86 resolving (the
exception being the known Laurier-authored dead link); 502/502 citation fragments
resolving to the originating section; rendered count matching an independent model in all
147 board states; zero console errors.


---

## Round 6 findings and resolution

| # | Finding | Status |
|---|---|---|
| 1 | Laurier publishes two accordions for one cohort, one titled as a suffix of the other ("PhD Religious Studies" and "PhD Religious Studies - Faculty Meet and Greet"). They became two dropdown values, so picking either hid the student's other event and labelled it as another program's | **fixed** — a suffixed name folds into the bare one when both exist |
| 2 | Round 5's fix restored the concert's policy blocks but appended them after the trailing prose, so the bag rules appeared un-headed before the heading that introduces them; the "Bag & Item Policy" heading was dropped entirely, as was "ENTRANCE DETAILS:" on both football cards | **fixed** — displaced blocks are folded in at the position they appear, and a still-pending heading is emitted with the tail it introduces |
| 3 | The mid-word anchor rejoin glued together two genuinely different labels sharing one href, producing "LOCUS Linkslearn more about each link by clicking here" | **fixed** — only DOM-adjacent anchors are merged |
| 4 | A nested `<ul>` was emitted twice, duplicating a sentence on both football cards | **fixed** — nested lists are skipped the way nested paragraphs already were |

Findings 2 and 4 were residue from the round-5 description fix. Finding 3 had been latent
since the original scraper: the merge rule written for Laurier's mid-word anchor splits
also matched two unrelated labels in one sentence.

Verified sound across all 508 events: no fabricated or truncated field; 384/384 accordion
panels producing events; 148/149 HTTP URLs resolving (the exception being the known
Laurier-authored dead link); 502/502 citation fragments resolving to the originating
section; rendered counts matching an independent model in all 135 click-driven chooser
states; zero console errors. The round-5 fixes were confirmed not to have caused damage
elsewhere: `cost` is extracted only from the one real price, and the stream-tick restore
is correctly guarded so a hidden stream is never re-ticked.

## Rounds 7 onward

The per-round tables above stop at round 6. Rounds 7 and 8 are recorded in the commit
log rather than here (`de8d7a5`, `baed9c1` and the commits that follow them). This
section resumes the written record.

## Ninth cycle: multi-day panels, and a second watched page

| # | Finding | Status |
|---|---|---|
| 1 | Lazaridis publishes four graduate welcomes as a single accordion covering two and a half days — "Sept. 8 from 10 a.m. to 4 p.m., Sept. 9 from 11 a.m. to 4 p.m. and Sept. 10 from 2 to 4 p.m." Read as one event, each landed only on Sept. 8. A student checking Wednesday saw nothing and would have missed day two of their own orientation | **fixed** — `split_multiday()` gives each published day its own listing, carrying the hours Laurier gave that day |
| 2 | Nothing told a student that a split listing was one day of a longer welcome; they saw one isolated afternoon | **fixed** — the detail sheet carries a "More days" row quoting the string Laurier published, in all six pages |
| 3 | Laurier's ASPIRE skills-training page publishes dated, registrable graduate sessions inside the orientation window and nothing watched it | **fixed** — added to `check_drift.py`'s `WATCH`. It is teaching and TA development running all term, not arrival events, so nothing on it goes on the board; it is watched so that decision can be revisited when the page changes |

The split is deliberately narrow. An over-greedy date regex that stole the date from an
ordinary single-day event would be the far worse failure and would not be visible on the
board, so `test_regressions.py` asserts both directions: the four known panels split into
twelve listings with the right hours, and no other event is touched.

Three of the bugs in this project's history — and the one that disabled this very regex —
were a word-boundary escape written inside a shell heredoc, which arrives as a literal
backspace (0x08). It is invisible in every editor and the regex simply stops matching.
`test_regressions.py` now fails if any source file contains a stray control character.

Sources tracked: 13 read, 2 watched, 15 in total. The built pages state these counts from
`check_drift.py`'s own lists rather than from a literal, so they cannot disagree with it.

## Ninth audit: what it found in the rest of the board

The audit confirmed both changes above — the split is right in both directions (all 492
published `when` strings are verbatim substrings of their own source page, no listing's
date differs from what Laurier publishes, and a sweep of all 396 panels for other
multi-date strings found none the regex missed), and it agreed the ASPIRE skills page is
professionalization rather than orientation. It found three defects elsewhere.

| # | Finding | Status |
|---|---|---|
| 1 | On the concert card, all seven safety and entry headings were hoisted to the front in **reverse order**, each detached from the rules it introduces. On the one ticketed event, a student could not tell which paragraph was the bag policy and which the re-entry policy | **fixed** — a heading now folds into the paragraphs that followed it, not into everything accumulated before it |
| 2 | The same mechanism split `Tickets are only $30!!! (+ $1.50 processing fee)`, leaving the fee attached to the headliner's name | **fixed** — a bold lead-in is reinserted against its own text, and `join_lead` no longer adds a stop to a sentence already ending in one |
| 3 | Data notes 01 and 03 counted Laurier's *listings* but called them events, promising 27 undated and 20 Winter 2027 events where the board can render at most 21 and 14 | **fixed** — the notes count through `onePerEvent`, the same fold the board draws with |
| 4 | The "More days" row printed a double full stop, Laurier's string already ending in `p.m.` | **fixed** |

Finding 1 was recorded as fixed in round 6 (#2) and was not. The round-6 fix handled one
displaced heading correctly and reversed any run of two or more, because it prepended the
pending heading to everything accumulated since the last flush rather than to the text
that followed it. It survived three audits because **the test guarding it could not
fail**: it asserted only that `CONCERT POLICIES` appeared before the word `backpack`,
which is true of the reversed output too. The test now pins the whole chain of seven
headings in source order, checks each heading sits against its own rule, and is verified
to fail on the pre-fix data. That is the second time in this project a check has passed
because it could not observe the thing it claimed to cover.

Blast radius of the parser fix, measured against the previous build: 3 of 528 listings
changed — the concert, and two copies of one event where `Students!.` became `Students!`.
Nothing else moved.

One assertion added here was wrong on its first run: it flagged any double full stop,
and Laurier's own Science welcome ends `...as a Science student..`. Reproducing that is
correct, so the test now covers only the double stops this parser can create.

### A defect introduced while fixing finding 3, and the guard that now catches it

Folding the note counts through `onePerEvent` was applied to all six application
scripts at once. Two of them — `_app.js` and `_app_classic.js` — never define that
function, because `orientation-classic.html` deliberately draws one card per *listing*
rather than one per event; that is exactly what makes it the yardstick the variants are
measured against. Both scripts died at load, and `orientation-classic.html` rendered an
empty board.

`node --check` passed, because an undefined identifier is a runtime error, not a syntax
error. `check.py` already had the check that catches this — `refcheck()`, which resolves
every call a script makes — but it ran only for the four variants, which have a matching
stylesheet and body. The two scripts that broke had neither, so nothing checked them.
`check.py` now resolves every call in every `_app*.js` before it does anything else, and
that guard was verified by reintroducing the bug: `node --check` still passed, and the
new check reported `onePerEvent`.

The notes in `_app.js` and `_app_classic.js` keep the listing counts, which are the true
ones for a page that draws listings. This is the third time in this project one rule has
been applied in two places that were not the same place.

## Tenth audit: the commit held, and three older defects surfaced

The audit was scoped at the previous commit and told to go at the heading-order defect
directly rather than sweep for it, since it had passed that card three times. It verified
the commit independently — re-ran the old parser in a temp tree, wrote its own
document-order checker, and reported 0 ordering violations across all 396 panels on HEAD
against exactly 1 on the pre-fix parser, with no word gained or lost anywhere. It settled
the open question about the new guard by instrumenting the parser rather than reasoning
from the diff as I had: the `len(pend_desc) == pend_at` case occurs at three sites, all
with empty `pend_desc`, so behaviour is unchanged — while confirming the shape I was
worried about (`prose → heading → heading`) would drop a heading, and does not occur in
any panel Laurier publishes today. It mutation-tested every assertion added that round.

Three defects, all older than the commit, and all one root cause.

| # | Finding | Status |
|---|---|---|
| 1 | `parse.py` read only `p/ul/ol/table/h3/h4/h5`. Laurier writes some panels as bare `<div>`s — Outlook pastes them as `<div class="elementToProof">` — and everything in them was dropped. World Suicide Awareness Day lost both sub-event names and every word of both descriptions: the board drew two cards with the same title and no text, so the morning flag raising and the evening vigil were indistinguishable. The graduate "Orientation Check-In" lost its description while its Brantford twin kept one, and the LOCUS Hub card lost its intro | **fixed** — leaf `<div>`s are read as blocks; a div holding another block is a wrapper and is skipped so nothing is emitted twice |
| 2 | Laurier puts a sentence after the last field label in the same block, separated by `<br>`. It was discarded, losing the Academic Resource Fair's pointer to the Get Involved Fair while the pointer back was kept — the board showed one half of a pair | **fixed** — `grab()` reads a value from one line and never across lines, so anything below the last labelled line is prose and is kept |
| 3 | In the undated group the chip printed the time before the venue, and every Winter 2027 event publishes `TBD` as its time. An online session and its in-person twin drew two identical chips reading "TBD" | **fixed** — `TBD`/`TBA` is Laurier declining to set a time, not a time, so the venue wins and the online chip reads "Zoom" |

Blast radius of the two parser fixes: 4 titles and 7 descriptions of 528 listings. Every
change is additive — no description shrank, and every old description is still a prefix
of its new one, so nothing was reordered or lost. No date, time, venue, host, cost or
link moved.

One correction to the audit: it reported finding 2 as affecting six listings. Only two
source panels carry that sentence, and exactly two listings now carry it — reconciled
against the raw HTML of all thirteen pages rather than against the finding.

Findings 1 and 2 are guarded by six new assertions, each verified to fail on the pre-fix
data. Finding 3 is a rendering rule and is guarded only by the rendering gates.

Two process defects were fixed alongside them. `build.py` ran `node --check` but not the
resolver, so `build_all.py` on its own would still have written the page that dies at
load; it now refuses to write when a script calls something it never defines, proved by
reintroducing the fault. And `_app_classic.js` was byte-identical to `_app.js` and built
by nothing — `orientation-classic.html` builds from `_app.js`. Two identical copies where
one is dead is this project's oldest failure shape, and it caught me directly: the fix I
made to that file last round had no effect on anything. It has been removed.

## Consolidation: one page, and what it cost the gates

The four design variants and the feature copy were removed. `orientation.html` is the
only page; it builds from `_app_main.js` / `_style_main.css` / `_body_main.html`, renamed
from the a-plus sources it was promoted from. `orientation-classic.html` survives as
`_yardstick.html`: not a design, but the plain listing parity measures the board against,
underscore-prefixed so it cannot be mistaken for something to open.

The provenance apparatus was removed from the page, not from the project. The watched
pages are still checked on every audit; the board simply no longer explains itself to a
student. The footer no longer counts Laurier's listings or describes the merge, the
sources lede no longer describes the scrape, and the clash blurb no longer explains
duplicate folding.

Ten scripts named the deleted files. Two of the rewirings would have been silently wrong.

**`shared_logic_check` would have stopped checking anything.** It required that any rule
copied into more than one variant be byte-identical. With one board it would have found
fewer than two copies of every function, skipped all twenty, and printed `ok`. It now
asserts the invariant that actually holds — each fact has exactly one implementation, and
any second copy must agree to the byte — and reports the counts it found rather than a
bare pass. Verified by planting a differing `dupKey` in the yardstick: it fails.

**`links_check` was pointed at a page that cannot answer it.** It proves no registration
link or citation is lost, and it worked by reading a page that writes every link of every
listing into the markup — variant C in full-text mode. Repointing it at the board looked
like a rename and was not: the board keeps links in the detail sheet and renders them on
open, so the check reported 93 links missing across eight selections. That read as lost
data and was a misdirected question. It now runs against the yardstick, the one page that
writes them all; the board's own link rule stays covered by `link_core_check`, which runs
`allLinksOf()` over all 528 listings against the yardstick's assembly, and by the harvest,
which opens sheets and collects what they draw.

A third fault was in the same family. `parity.snapshot()` copied the tree by filename
prefix, and the renamed yardstick matched none of them, so Chrome rendered a file that did
not exist and the run blamed the board for the absence. The snapshot now derives what it
needs from the page table and exits naming the missing file. All three are the same shape:
a check that cannot see its subject reports the blindness as a defect in the thing it was
measuring.

## Fall 2026 only

Winter 2027 and Spring 2026 were dropped from parse.py's META. The Winter page was an
undated placeholder whose sessions open for registration in October, and the Spring page
listed January dates on a page titled Spring; neither helps somebody arriving this
September. Eleven schedules, 488 listings, 329 events, one term. Undated events fell from
27 to 7, nearly all of the old ones having been the Winter placeholder.

Two consequences worth stating. The chooser drew the term as a segmented control, which
with one value renders a single button that looks like it ought to do more than it does;
it is now a plain statement, so the scope stays visible without pretending to be a choice.
And the two data notes describing those terms were removed rather than left dormant: both
were conditional on data that no longer exists, and a note whose condition can never be
true is a claim nobody can check. The regression test that guarded the Winter note wording
is replaced by two that pin what is now true - the board carries exactly one term, and no
note names a term it no longer carries.

The auditor brief gained a Scope section saying the same thing, including that the two
removed pages are not missing sources and must not be reported by its page-discovery step
as pages we do not know about.

## Eleventh audit: the board held, nine defects in the gates and the copy

The board came through the Fall-only cut and the consolidation intact — a field-level
diff against the previous commit found exactly one changed listing in the whole dataset,
Laurier's own lane-swim relabel. Nine findings, all real. Three reach a student.

| # | Finding | Status |
|---|---|---|
| 1 | Laurier publishes the LOCUS Welcome Day deadlines — Early Bird before 21 August, Registration Deadline 2 September — as two `<li>`s beside the Register Now button. `section_prose()` read only `<p>`, so 26 cards carried the live button and neither date. On 4 September that offers a student a registration that Laurier says closed two days ago | **fixed** — lists count as section prose, and both labels are captured |
| 2 | Changing level kept the day and fell back to `keys[0]` when the new level did not publish it, dropping the student onto the earliest day on the board — 31 August for graduate Waterloo, one finished event, four days behind | **fixed** — the fallback uses the page's own load-time rule: today, else the next day with something on it |
| 3 | `redraw()` wrote the hash before the board settled the day, so the URL named a day the board was not showing | **fixed** — the hash is written after |
| 4 | The empty board advised "Try another term" after the term stopped being a control | **fixed** — it points at the streams, which is what actually reveals those sessions |
| 5 | `test_regressions.py` read `_app.js`, the yardstick fixture, not the board. Five guards were statements about a page nobody opens; deleting `_app_main.js` outright would have left all five green | **fixed** — repointed and restated, each mutation-tested to go red |
| 6 | `parity.shared_logic_check()` was rewritten, recorded here as verified, and never called by `main()` | **fixed** — called, and both core checks now run unconditionally rather than through an `and` that would skip the second whenever the first failed |
| 7 | `invariants.py --selftest` crashed on a deleted variant; its three assertions had not been proved able to fail since the consolidation. One case also injected into class names the board does not use | **fixed** — the injection now uses the same selector the assertion scans |
| 8 | `clashcheck.py --negative` aborted on a stale code string, so two of its three defect classes went unproven | **fixed** — retargeted; all three caught and named |
| 9 | `stress.py` had not run since the variants were deleted; stale counts in six files' comments; dead `.watchgrid` / `.srcsub` / `.src em` CSS | **fixed** |

Finding 6 is the one worth remembering. I rewrote that check, mutation-tested it by hand
with `python -c`, watched it fail on a planted second `dupKey`, and wrote in this file
that it was verified — without ever checking that the suite invokes it. Proving a function
works is not proving it runs. It was dormant through two full audits.

Findings 5, 7 and 8 are the same error in three places: after the consolidation, checks
went on passing because their subject no longer existed. Finding 1 is the third instance
of a selector too narrow for how Laurier writes a page — `<div>` last round, `<ul>` this
one — and both times the cost was information the student needed and no sign it was gone.

## The names beside the short bars

Reported from a screenshot of graduate Waterloo, whole run: three titles sitting after
their block rather than on it. Only that selection, because only it has events short
enough - Dean’s Welcome 6:30 to 6:45, Trivia 8:10 to 8:30, Check-In 5:00 to 5:30. A
day is about 1,250px across in that view, so a quarter hour is roughly three pixels and
the title cannot go inside; barLabel() draws it beside the bar rather than leave the bar
anonymous, which is deliberate.

The defect underneath was real though. The spilled label was display:flex, and
text-overflow does not apply to a flex item, so it was cut mid-word - “Laurier Trivia
Challeng”, “Orientation Check-” - which is what made it read as broken rather than as a
label. It ellipsises now. It was also plain ink text on the lane with nothing tying it to
its bar; it is a chip in the bar’s own colour, flush against it and carrying its purple
left edge, so the two read as one object.

The bar was not widened to fit the words. This view is a clock, and drawing a quarter
hour as an hour would misstate the time and could make two events look like they overlap
when they do not - which clashcheck.py exists to prevent.

## The clock stops padding

Reported from the board: consecutive events drawn side by side as though they ran at the
same time. They were. placed() padded every item to a minimum drawn length so a short
event was still a readable box, and then packed columns from that padded length. The two
jobs are not the same job. Graduate Waterloo on 2 September - reception, dean’s welcome,
panel, “Are You Ready”, trivia, end to end with not one minute of overlap - came back as
five events in two columns at half width. On 8 September the same artefact inflated a
genuinely busy day from 5 columns to 12.

The padding is gone. Columns are packed on the published interval, so ncol is a true
statement about concurrency again. Legibility moved to the scale: scaleFor() picks pixels
per minute so the shortest event of the day clears one readable line at its true length,
and the day gets taller - the page scrolls, and height is cheaper than a lie about time.
Only three days move at all. 1 September, whose virtual evening is five- and ten-minute
segments, goes to 5.20 px/min and 624px. 2 and 3 September, whose deans’ welcomes are a
quarter of an hour, go to 1.73. Every other day’s shortest event is half an hour or more
and already cleared the line; 8 September, the busiest, is unchanged in height.

What gives way is what is written in a box, never how long it is drawn: under 56px the
venue steps aside, under 40px the time and the name share a row. Both are on the card.

Three things came with it. The layout figures are one commented table rather than three
literals at three call sites - which is how a quarter-hour came to be drawn as 52 minutes
without anyone deciding it.  exposes what the clock decided:
published time, drawn minutes, column, and how many events each one actually overlaps, so
an audit can read the model instead of scraping pixels. And the rendered checks stay,
because the last two defects here were a name the model held correctly and the stylesheet
cut in half, and a name the renderer drew outside its own bar - neither visible in any
model.

layoutModel earned itself on the first run by reporting four events on 8 September as
drawn at the wrong length. They were half a pixel out from rounding a difference rather
than differencing two rounds, so it now compares minutes to minutes.

## Twelfth audit: the screen was right, the paper was not, and nothing guarded either

The layout rewrite held on screen — 24,895 placements across 162 selections, no event
drawn at a length other than its own, no event sharing a column with something it does
not overlap, and the model checked against the painted DOM rather than only against
itself. Five findings.

| # | Finding | Status |
|---|---|---|
| 1 | Laurier moved the Cultural Analysis and Social Theory welcome from Tue 8 Sept 1-3:30pm DAWB 4-105 to Fri 11 Sept 2-4pm DAWB 3-106, and lengthened a lane swim on its undergraduate page only. The board was stale | **fixed** — snapshots refreshed; the swim is reproduced per page, as Laurier publishes it |
| 2 | `printGrid` kept a 13pt floor under a slot. At half a point a minute that floor is 26 minutes: harmless while `placed()` padded to 30, and once the padding went it printed the Dean's Welcome over the Graduate Student Panel by 5.5pt on every graduate selection | **fixed** — the floor yields to the next slot in the column rather than overrunning it |
| 3 | **Nothing in the repository could fail if either layout rule broke.** The audit rebuilt both defects and every gate stayed green | **fixed** — `layoutcheck.py` |
| 4 | `layoutModel().allDay` returned a list of nulls: `split()` hands back wrappers, and the field read `.t` off the wrapper | **fixed** |
| 5 | Between 700 and 899px a published time was cut clean — `11:30am-1:30pm` to `11:30am-1:3`, which reads as an event ending at half past one in the morning. Pre-existing; verified identical before the rewrite | **fixed** — the end time is dropped rather than truncated, and names wrap instead of being sliced |

Finding 3 is the one that matters. `clashcheck.py` cannot catch a column defect by
design — since the gold marks began asking `collidesWith()` rather than `ncol`, they stay
honest however the columns are packed — and `parity.py` checks which events are drawn,
never their geometry. `layoutModel()` was added so an audit could read the layout instead
of scraping pixels, and then no gate read it. Adding the reader is not the same as adding
the check.

`layoutcheck.py` sweeps every selection that renders a clock, asserts both rules, compares
the model against the heights actually painted, and checks the printed calendar for
overprinting. Three things were wrong with it before it was worth having, and each is the
same mistake in a different coat:

- the first mutant inflated `it.e` itself, so the ground truth moved with the defect and
  the test proved nothing;
- `layoutModel()` computed its own geometry rather than reporting the renderer's, so a
  floor added in `blockHtml` was invisible to it — there is one height function now, used
  by both;
- the self-test ran the first six selections, all undergraduate, and reported its own
  print mutant as MISSED because the defect only appears on a graduate evening.

Three gates also claimed to read the page at 420px. Chrome will not open a window
narrower than 504 CSS px in headless mode whatever `--window-size` asks for, so they read
504 and the 320-503 band is exercised by nothing. The claims now say 504, and `_chrome.py`
records the floor and what it costs, rather than leaving a true-sounding number in place.

## Four things taken off the page

Asked for directly, and the first three are removals.

The **Clashes** tab is hidden behind a flag rather than deleted: the lens still answers on
`&view=clash` and every gate still drives it, so it cannot rot while it is off. It was one
tab too many on a page a student reads once, and the collisions it named are drawn on the
clock anyway.

The key names **two states**, colliding and ordinary. “Open to all Laurier students” is
gone — the caption, the lilac reading edge, and the badge the Clashes lens was still
printing. It told a student nothing they could act on: every event on their board is one
they may attend, and which of them are also open to somebody else is not their question.
`clockStates()` no longer reports the state either, or the key would name fewer states
than the board draws, which is the thing `clashcheck.py` exists to catch.

**“Before you rely on this”** is gone. It had been asked for before and I kept it. What
went with it: the note counting undated events and the one explaining that programme
welcomes state no audience. Both remain true of the board as behaviour — undated events
sit under their own heading, the programme dropdown still filters — it is the prose about
them that has been removed.

And an answer rather than a change. The Niagara Falls trip **is** in To register, on
19 September, on both Waterloo and Brantford. It disappears in exactly two situations:
without International or Exchange ticked, because Laurier publishes it for “International
and Exchange Students” and it is gated accordingly; and on Milton at any setting, because
Laurier runs one bus from Waterloo and one from Brantford and publishes no Milton
departure. Both are the board reporting Laurier faithfully.

## A key whose two swatches were the same colour

Reported from the whole-run legend: both keys drawn as the same purple block against two
different captions. A real defect, and an old one. The rule read

    .legend-run .legend-run .lg-clash::before { ... }

There is no legend inside a legend, so it matched nothing and the collision swatch never
took its gold cap. Fixed by deleting the repeated selector.

Worth noting why nothing caught it.  measures painted text against its
background, and a swatch is a  box with no text in it.  proves
the key names exactly the states the board draws, which it did — two captions for two
states, both correct. Neither gate was wrong; a key whose two swatches are indistinguish-
able is simply outside what either can see.

Also removed: the line beside the mode button reading “N run at once here — the clock is
tight; the list may read easier”. The button is the control; the page does not also need
to advise a student about its own rendering. The note that appears when a day genuinely
cannot be drawn as a clock is kept and cut to the fact — without it the clock vanishes and
the day changes shape with nothing said.

