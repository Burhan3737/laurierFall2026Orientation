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

