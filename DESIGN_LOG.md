# Design log

Three alternative experiences for the Laurier Orientation Event Finder. The data, the
incumbent page and the regression suite are untouched; each variant has its own body
template, stylesheet and application script, built through `build.py --body --css --js
--out`. The no-argument build stays byte-identical (md5 `2577645c2eeeee417361d7b6037a7174`).

## Rule of the exercise

Two variants that would become the same page if you swapped their stylesheets count as
one variant. So the axes moved here are navigation, where filtering lives, what one event
looks like at rest, how events are grouped, and what a student can do besides read.

|                    | A — The Timetable | B — The Index | C — Your Orientation |
|--------------------|-------------------|---------------|----------------------|
| Navigation         | day paging + whole-run grid | one query-driven stream, re-filed by pivot | linear document after a linear interview |
| Filtering lives    | persistent band, never a gate | facet rail with live counts, always on | one-time full-screen interview |
| One event at rest  | a block sized by its duration | a one-line row | fully written out, nothing to open |
| Grouping           | hour of the day, on a real clock | whichever pivot you choose | day, then morning/afternoon/evening |
| Beyond reading     | see what overlaps | search, pivot, keyboard-drive | tick, clash-check, print, export .ics |

## Brand

Verified from the scraped Laurier pages and cross-checked on the web: purple `#330072`,
gold `#F2A900`, the lighter institutional purple `#924DA7`, the pale purple field
`#F7F5F9`. Laurier's own site sets CallunaSans, which is not on Google Fonts; each variant
takes a different, deliberate stand-in rather than all three using one substitute.

---

## Round 1 — first cut

Built from nothing. The three scrapped concepts (editorial broadsheet, signage board, mono
ledger) were not revisited.

**A — The Timetable.** `orientation-a.html` · `_style_a.css` · `_app_a.js` · `_body_a.html`.
Archivo across its width axis; square corners throughout. A persistent identity band with
segmented controls, a day-density navigator whose bar heights are event counts, then either
the whole run as a grid of day columns against an hour axis, or one day at full width.
Overlapping events are drawn side by side, so a clash is a shape rather than a warning.
Events lasting four hours or more (drop-in desks, headquarters) ride above the clock as
ribbons, because left in the grid they swallowed the column. In the whole-run view a cluster
wider than three columns collapses to a "+N more" tile that opens the day.

**B — The Index.** `orientation-b.html` · `_style_b.css` · `_app_b.js` · `_body_b.html`.
Libre Franklin for the apparatus, Newsreader for the one record being read. No gate: the
corpus is on screen at first paint. A query bar at the top, a facet rail with live counts
(and "+N" for what a stream would add), a pivot that re-files results under date, time of
day, venue, host, stream or schedule section, and a reading pane that holds still while
arrow keys walk the list.

**C — Your Orientation.** `orientation-c.html` · `_style_c.css` · `_app_c.js` · `_body_c.html`.
Faustina and Alegreya Sans on warm paper — the closest Google Fonts get to Laurier's
Calluna. Five full-screen questions, then a document in which every event is already open.
A tick box in the left margin builds a plan; the plan bar counts overlaps, prints, and
exports a `.ics` that works offline.

### Verification at the end of round 1

- `python parity.py` — all three variants render the same multiset of event titles as the
  incumbent across 83 selections spanning all three levels, three campuses, three terms,
  every stream that gates anything, programme narrowing including "mine is not listed",
  and mixed stream+programme cases.
- The eligibility core (`gatesOf` + `assess`) is asserted byte-identical across all four
  application scripts, so parity cannot drift silently.
- Zero JavaScript errors across 69 page states.
- `python test_regressions.py` 48/48; `orientation.html` md5 unchanged.

### Cycle 1 — independent review

Headline finding, and the one that mattered most: *"These are three genuinely distinct
products, not one reskinned. Swapping the stylesheets would not converge them."* No
machine-generated tells found in any of the three. All three came back `revise`.

Acted on:

| Variant | Criticism | What changed |
|---|---|---|
| A | "The default view is the unreadable one" — the whole-run grid split 116px columns into 35px lanes | **One Day is now the landing view**, on today if Laurier publishes anything for today, otherwise the next day that has something on the clock. Whole Run became the secondary toggle, and is forced off below 900px |
| A | truncated one-word-per-line titles in crowded lanes | a lane narrower than 72px now draws a **time-only tick** with the full title on hover; a truncated word is worse than an honest mark |
| A | "`+N more` and the day headers don't look clickable" | the overflow tile says "open the day ›" underlined; day headers reveal an "open ›" cue and underline the numeral on hover |
| A | the sheet buried When/Where under 640px of marketing copy | facts table and registration links now sit **above** the description |
| A | stream chips showed a bare number that contradicted the tally | they now show the **delta** — `+17` — and the label says so |
| B | the placeholder advertised `free food`, which returned nothing | search is **token-AND**: every word must appear somewhere in the record, in any order. Placeholder examples changed to ones that hit on the default board |
| B | `Record 495 of 508` — a raw array index dressed as precision | now `Result 12 of 86`, the position in the current result set |
| B | reader led with 1,200 unbroken words before the venue | **When / Where / Host block and the registration links now precede the prose**; the description is broken at Laurier's own sentence boundaries into paragraphs of three, adding and losing nothing |
| B | facet counts all read `508` inside "include events I cannot attend" | counts are now always "records you could attend", and the rail says so |
| B | two measured contrast failures (3.67:1, 3.05:1) | column headers and zero-count facets darkened to 7.0:1 and 5.6:1 |
| C | five gated questions with no way past them | every step carries **"Skip the questions — show me the … board"** |
| C | "Change my answers" restarted the whole interview | the document header now carries the five answers as chips; clicking one opens **that question only** and returns straight to the document. "Redo the whole interview" is still there for anyone who wants it |
| C | 620px per event, 67 phone screens | venue, host and "part of" are no longer repeated in the facts table beneath the entry that already states them; the citation is one short line naming the page and section rather than a wrapped URL, with the "accessed 31 Aug 2026" statement made once at the top |
| C | no way to skim | a **Titles only** density toggle in the plan bar |
| C | day headers scrolled away | `.dayhead` is sticky under the contents rail |
| C | the zero-result sentence read "0 events… nothing to unfold" | rewritten, and the empty contents rail is hidden |
| all | webfonts fetched from Google for a page described as offline | `fetch_fonts.py` caches the latin subsets and `build.py` inlines them as base64. The variants now emit **no `<link>` at all** and keep their typography with the network unplugged. The corpus contains no latin-ext codepoint, so only the latin subset is carried |

Held: variant C still leads with the interview rather than defaulting straight to a board.
The skip control answers the objection without giving up what makes C a different product;
if a later reviewer says the gate is still wrong, that is the point at which to change the model.

### Cycle 2 — independent review

Again: *"These are three genuinely distinct products... Swap the stylesheets and you get three
ugly pages, not three identical ones."* No machine-generated tells. All three `revise`.
Two earlier points came back harder — hover-only affordances, and CTA buttons above the
description — so both were fixed properly this time.

Acted on:

| Variant | Criticism | What changed |
|---|---|---|
| A | "the whole-run week grid is broken and should not ship" — most events rendered as nameless `12pm` boxes | **the overview stopped pretending to be a clock.** It is now a strip: three time bands that line up across every day, three named events per band per day, then "+N more ›" into the day. Everything drawn has a name and a time. The clock survives where it works — the day view |
| A | phone: seven 35px lanes, one character per line; and 700px of empty grid on a quiet day | below 700px the day is an **agenda** — time, title, venue, and "5 others at this time" instead of drawn collisions |
| A | first event at y≈690 on a 1366×768 laptop | masthead, identity band, navigator and day header all tightened; the first event is now ~150px higher |
| A | titles clipped mid-word with no ellipsis | block titles and venues are line-clamped, so a clipped title reads as clipped |
| A | `.dgo` hover-only — invisible on touch | permanently visible at 55%, full on hover |
| A | disabled step arrow 2.01:1 | darkened to a legible disabled grey |
| B | a 130px venue paragraph destroying the table rhythm | venue and host cells clamp to two lines; the full text is in the reader |
| B | the pivot column repeats its own group heading | **the column the board is filed under is dropped**: no Venue column under Venue, no Host under Host, no Date under Date |
| B | the reader pane is dead weight showing "Nothing selected" | it opens on the next upcoming record |
| B | 390px horizontal scrollbar | `#q` can shrink; the identity line truncates below 640px |
| A + B | three heavy CTA slabs above the description | description first in both |
| all | the same event shown twice with no explanation | **not de-duplicated** — see below — but every repeat is now labelled `copy 1/2` in the list and carries a note in the detail naming the other section it appears under |
| C | 63,440px — "seventy laptop screens" | default density is now **titles**, with the day you are most likely to want open in full and a "Read this day in full" control on every other day heading. Measured: 13,836px desktop, 18,413px phone. Full text is still one click, and print still uses it |
| C | the standfirst described a state the page was not in | it now says which state it is in, and changes with it |
| C | two plan-bar buttons permanently disabled at 3.24:1 | when nothing is ticked they are replaced by a line saying what ticking does |
| C | the tick box vanished on a phone | it is now the first thing in the entry at narrow widths, full width and labelled |
| C | "Undergraduate — 320" beside "91 events so far" | the options read "320 published", the running total reads "91 you can attend so far" |
| C | `.anspen` hover-only | permanent at 60% |
| C | a 5 p.m. event filed under "Evening" | bands carry their ranges: "Morning, before noon" / "Afternoon, noon to 5" / "Evening, 5 p.m. onwards" |

**Held: the duplicates are not merged.** The reviewer asked all three variants to
de-duplicate on title+date+time+venue. They are not going to. Laurier genuinely publishes
"Inner Tube Water Polo" three times on one page and "We Brought What You Forgot" on two
different schedule pages, each copy with its own citation anchor; the incumbent reproduces
every copy, six audit rounds ratified that, and dropping one would break the parity
guarantee that is a hard constraint of this exercise. The complaint underneath — that a
student sees the same line twice and is told nothing — is real, so it is answered by
naming the repeat rather than hiding it.

### Cycle 3 — independent review

Third independent reader, same headline: *"These are three genuinely distinct products.
Swapping stylesheets converges no pair: A's organising axis is time, B's is the query, C's
is the page."* No machine-generated tells in any of them.

The finding worth the round, though, was this: **"The one place they read as one product
reskinned is the event detail record."** All three were using the same facts grid, the same
stack of full-width purple link buttons and the same "CITED FROM" block. That is a real
convergence and round 2 is mostly about fixing it.

---

## Round 2 — differentiate the detail, and finish the phone

**The event detail is now three different things.**

- **A** leads with a **time ribbon**: a bar of the whole day with this event in purple and
  everything it collides with in gold. It is the one thing a clock can say that a list
  cannot, so the sheet says it first. Links stay chunky purple slabs — this is a board.
- **B** reads as a **catalogue record**: a Laurier masthead line over a gold rule, `‹ ›`
  stepping through the result set, field labels in a narrow left column, links as
  underlined text rather than buttons, and a citation set as a reference — *Wilfrid Laurier
  University. "Laurier Fall Orientation: Waterloo Undergraduate Schedule", §sept-8.
  Accessed 31 Aug 2026.*
- **C** stays inline in the document, with no detail view at all.

Other changes from cycle 3:

| Variant | Criticism | What changed |
|---|---|---|
| A | "the one-day clock wastes the screen on quiet days" — 900px of ruled nothing between two events | the axis is **piecewise**: occupied stretches run at full scale, any gap of two hours or more collapses to a labelled band reading "nothing published between 3pm and 8pm". The empty time is stated in words instead of drawn in pixels |
| A | no legend for the gold and lilac rules | a two-item legend under the day header |
| A | hatched empty week cells "read as something is here" | hatching is now reserved for past days |
| A | print had no title and no statement of whose schedule it is | print keeps the masthead and the identity line |
| B | prose in the 96px TIME column (*"You will receive an…"*) | the column says "no time"; Laurier's sentence is quoted in full on the row's own line |
| B | the dead 80px gutter at phone width | the Date pivot drops to a single column below 640px |
| B | "RESULT 5 OF 91" promised a sequence the UI would not walk | `‹ ›` in the reader header |
| B | duplicates listed twice | the repeat **folds behind** "Laurier lists this 2 times — show the other". Both records stay in the page and stay one click away |
| B | "the least Laurier-feeling of the three" | the reading pane now carries a Laurier masthead line over a gold rule |
| B | the pivot "reads as a secondary toolbar" | it is reachable from the record it describes: WHERE carries "9 more here", HOST carries "3 more from them", each jumping to that group under the matching pivot |
| C | Q1 asked "Where are you starting" and answered with degree levels | "Which schedule are you on?" |
| C | the primary action fell below the fold at 1440×900 | the interview footer is pinned to the panel |
| C | skip "reads as an escape hatch rather than an equal path" | "Show me everything now" is a bordered secondary button beside Next |
| C | picks keyed by array index, lost on close | keyed on a hash of title+date+time+URL and persisted to `localStorage` where the origin allows it, with the hash as the shareable fallback |
| C | the tick box became a full-width bar above the title | it is back in the left margin at every width |
| C | no way back to the top of a long document | a Top control in the plan bar |
| C | `.edot` separator at 1.49:1 | darkened to the body meta colour |
| all | "Virtual" listed as if it were a group you belong to | shown as "Online sessions (Zoom)", with a note in C that it is a delivery mode. The stored value is unchanged, so eligibility is untouched |

**Recorded disagreements.** Two cycle-3 findings were checked and are not defects:
`+N more ›` in A's whole-run view already switches to that day (it is wired to the same
handler as the day header), and B's zero-count facets are already `disabled` — though they
now also strike through, since "greyed" clearly was not reading as "unavailable".

**Held again:** A still hands the phone an agenda rather than a compressed clock. Lane
splitting is what makes A's collisions legible, and at 390px five parallel lanes are 35px
wide — the concept does not survive the width. What survives instead is the *argument*:
the agenda keeps the hour gutter, collapses empty stretches with the same "nothing
published between…" band, and names every collision ("5 others at this time").

### Round 2, cycle 1 — independent review

Fourth independent reader. *"Three different verbs: read the clock / query the index /
build and keep a plan. Nobody is reskinning anybody."* On the generated-page question:
*"all three are clean, and I would say so without qualification."* Contrast measured
programmatically over every text-bearing element in every state: **two failures in the
whole set, both on decorative glyphs.** Both fixed.

Two layouts were called broken, and both were:

| Variant | Criticism | What changed |
|---|---|---|
| **B** | **the phone row grid was genuinely broken** — measured live, one row computed its time cell to `0px` so the time did not render at all, the next gave `no time` 196px and crushed the title into 161px. Half the rows on a phone showed no time | below 640px the row **stops being a grid**. Date and time run inline, title, venue and Laurier's own note stack beneath. Four column tracks fighting three pivot rules cannot produce a 0px cell if there are no tracks |
| **A** | **"show what you cannot attend" destroyed the page** — 92 events, 85 overlapping, laid out as ~14 lanes of 30px confetti. A named feature that wrecks the board | past **five concurrent events the clock has nothing left to say**, so the day switches to a list. Ghost mode turns the list on for you, and a "Read it as a list / Draw it on the clock" control makes the choice explicit and reversible. When it switches itself it says why: *"14 events run at once here — too many for the clock, so this day is a list"* |
| B | no way to jump to a day: 7,491px of scrolling to reach Tuesday | a **jump rail** under the pivot bar, wired to the group ids that already existed. It follows the pivot — days under Date, venues under Venue — and becomes a select past 16 groups. Plus a Top control in the sticky header |
| B | venue pivot sorted on room codes (`CC-101 | Career Development Centre`) | venue groups sort on the building name |
| B | search placeholder truncated on a phone | a short placeholder below 700px |
| B | `·` link separator at 1.73:1 | body meta colour |
| A | empty band cells drew an outlined box with a floating em-dash at 2.97:1 — "reads as a failed render" | an empty cell now draws nothing at all |
| A | week columns forced a horizontal scroller at 1400px, and `+8 more` hid most of a busy day | columns narrowed so nine days fit without scrolling, and five events per band instead of three |
| A | `COPY 1/2` is engineer jargon on a student's screen | "listed twice" / "listed 3 times" |
| A | landing skipped a day that had events but no *timed* ones | it lands on today, or the next day with anything published at all |
| C | 14,081px in titles mode — each collapsed entry cost ~155px | a collapsed entry is now **two lines, 65px**; the band and day furniture shrinks with it. Measured: **10,862px**, and Full text is still one click |
| C | "every wizard screen is ~80% empty… reads as a layout that failed to load" | the right-hand column carries **the week the answers are already producing** — a bar per day with counts — and the question block is vertically centred |
| C | "changing a filter is a modal round trip" | `CHANGE` now opens an **inline panel in the document** with the same live counts, applied in place. The full-screen interview is only for the first pass and for "Redo the whole interview" |
| C | the reading toggle was "the quietest thing on the day header" | it is a bordered control, and there is now a global Full text / Titles only in the jump rail |
| C | four equally-weighted purple buttons per entry | `Register Now!` sorts first and is solid gold; the rest are underlined text links |
| C | the phone tick box lost its label | `I'M GOING` is back at every width |

### Round 2, cycle 2 — independent review

Fifth independent reader. Same verdict on the question that matters: *"These are three
genuinely different products. A has no search and nothing to mark; B has no clock and no
plan; C has no grid and no free-text query. The differences are in what a student can* do,
*not what they see — which is the test that matters."* Contrast measured across all three:
**zero failures**, light fields and dark.

The finding worth the cycle was cross-cutting and I had missed it entirely.

**`TODAY` was frozen at build time in all three.** `build.py` bakes `TODAY = "2026-08-31"`
into the payload; A used it to land and to grey past days, B to power "Still to come", C
to decide which day to open in full. On a page opened on 6 September — the week it exists
for — all of that is wrong, and it gets more wrong daily. The variants now compute `NOW`
from the reader's clock and use it for every "has this happened yet" question. `TODAY`
stays what it always was: the date the page was compiled, which is what the citations say.
The incumbent is untouched.

| Variant | Criticism | What changed |
|---|---|---|
| **A** | "the marquee view breaks at 13 days" — a horizontal scroller, three fixed bands rather than a clock, empty outlined cells dominating, titles truncated to uselessness | **the whole run was rebuilt on its side.** One row per day, time running left to right, position and width the real start and the real duration, a collision shown as a stack. Thirteen days fit at 1400px with no sideways scroll and no empty cells, because a day with nothing simply has an empty lane |
| A | titles spent the cell repeating the column heading — "Wednesday, Sept. 9 - Internationa…" | a leading weekday-and-date is stripped from a title shown inside that day's own row |
| A | it landed on a near-empty screen | it lands on the **busiest day ahead** and says where the run starts: *"This is your busiest day. Orientation starts on Friday 4 Sept ›"* |
| A | the `‹` day button at 4.53:1, "one rounding error from failing" | darkened to 7.6:1 |
| **B** | the Venue pivot split one room across several groups — "The Turret \| 3rd floor of the Fred Nichols Campus Centre (FNCC)" and "The Turret \| 3rd Floor, Fred Nichols Campus Centre (FNCC)" | venue spellings **fold**: case and punctuation are normalised, a venue that is a prefix of another folds into it, and the label shown is Laurier's own commonest spelling. 39 groups → 34. The data is untouched; only the grouping folds |
| B | group ordering "arbitrary" — six singleton venues before the 12-event pool | venue, host and stream file **busiest first**. Dates stay chronological |
| B | "the rail contradicts itself" — "the count shows how many records it adds", then reads −17 | "the number is what ticking — or unticking — changes the count by" |
| B | a native scrollbar under the jump strip, "the only visible chrome scrollbar on the page" | hidden, with a fade mask at the scrolling edge |
| B | the floating FILTERS button covered a row | a full-width bar at the bottom, with the list padded clear of it |
| B | no print stylesheet | one, led by a heading naming the schedule, the filters, the query and the pivot |
| **C** | **it opened a day that had already happened** — a consequence of the frozen `TODAY` | fixed by `NOW` |
| C | "ninety-one identical notes… roughly 40% of the vertical height" | a page-level note Laurier repeats on three or more of your events is **stated once at the top** and dropped from the entries, with "applies to 41 of your events". The `Schedule` row goes entirely except where an event is not on the schedule you asked for. Full text: 49,492px → **42,094px** |
| C | `only=1` with no picks was a dead end with no control on screen to escape it | `only=1` without picks is read as off, and ticking down to zero turns it off |
| C | FULL TEXT clipped inside the scrolling day rail at 13 days | it lives in the plan bar only |
| C | three `@media (max-width:720px)` blocks fighting each other, two of them dead | **one deliberate phone layout.** The tick sits under the title with its label — not after a 200-word description, and not as a full-width bar above it |

**Found by my own stress harness, not by a reviewer.** `stress.py` renders the three hard
states — the 170-event board, the 3,096-character description under an eight-row facts
table, and a true 390px viewport — and a source scan alongside it found stray control
characters left by earlier patching: five `U+007F` inside B's group labels ("No venue
published" was preceded by an invisible glyph) and a `U+0000` in a CSS `content` string
that should have been a middot. All removed, and `parity.py` now fails the build if any
control character appears in a variant's source or page.

**Held.** B is not getting a "keep this" affordance. The reviewer offered it as a minimum,
but marking-and-taking-away is the whole of C's reason to exist, and giving it to B would
converge the two. The same reviewer's better suggestion — that B's record model makes
*comparison* nearly free, which neither sibling can do — is the round 3 push.

**The parity gate earned its keep here.** Rebuilding A's whole-run view by line range
silently deleted `agendaHtml`, the function the day view falls back to on a phone and at
high concurrency. Nothing in the visible desktop board changed, so a screenshot would not
have caught it; `parity.py` did, on two counts at once — `Uncaught ReferenceError:
agendaHtml is not defined`, and 46 of 83 selections missing events because the day pages
the harness walks were failing to render. Restored, re-checked: zero console errors, and
the Bachelor of Education board back to 70 of 70.

### Round 2, cycle 3 — independent review

Sixth reader. *"Three, unambiguously. Swap the stylesheets and you'd have a Gantt chart
with serif type, a faceted database in cream, and a wizard in Archivo — three different
pages that happen to be dressed wrong."* Zero contrast failures across eight states, in a
probe the reviewer validated against a deliberate 1.92:1 control. It also caught the
`agendaHtml` regression independently and described the failure mode exactly right: *"a
silently empty board with the counters still confidently populated."*

---

## Round 3 — push each concept past what it already does

Three fixes first, then one new thing per variant.

**A — the run view is now legible, and there is a third view.**

The Gantt's labels were printed *beside* their bars and overprinted by the next one, so
most of a busy day read as `Grou`, `aculty o`, `ie Dye a`. Titles now sit **inside** the
bar, clipped with an ellipsis, and the redundant start-time chip is gone — the axis above
already carries it. The bars got a colour channel back (gold top edge = collides, lilac =
open to all, hatched = not open to you, gold right edge = Laurier lists it more than once)
and the `+N more` truncation is gone: the run view exists to be complete, so a crowded day
grows instead of hiding events.

A class collision was making duplicate bars render in capitals — `.dup` on a bar inherited
`text-transform:uppercase` from the badge class of the same name. Renamed.

Then the push. The reviewer's own suggestion, and the right one: *"The thing only A can do,
and nobody is doing, is resolve clashes."* A already computes every collision and only
counts them. **Clashes is now a third view**: every moment in the run where two or more
events overlap becomes one block naming the moment and listing exactly what is on offer, so
a student chooses rather than discovering the conflict on the day. The headline is honest
about chained overlaps — "14 overlapping, up to 5 at once" — because a cluster is a chain,
not fourteen simultaneous things.

**B — the table stopped repeating itself, and it can compare two boards.**

The panel name was printed under every row in a run ("in Athletics and Recreation - Fitness
Programming", ten times consecutively); it is now said when it changes and not again. The
HOST column disappears when fewer than 30% of rows have one, and those that do carry it
under the title instead. `Wednesday, Sept. 2, 2026 — Wednesday, Sept. 2 | 8:30 a.m.` printed
the date twice because Laurier writes it into the time field; a leading restatement of the
day is dropped, nothing else altered. The `<select>` jump control — the one OS-default
widget on the page — is gone; every pivot gets the same rail.

The push, from cycle 2's reviewer: B's record model makes **comparison** nearly free and
neither sibling can do it. B now compares two boards — another campus, another level —
marking every record *on both* / *yours only* / *theirs only*, with a summary. Matching is
by event identity rather than record index, because Laurier files Waterloo's Shinerama BBQ
and Brantford's as separate entries: comparing indices reported "0 shared", which was true
and useless. By identity it reports 7 shared, 81 yours only, 43 theirs only.

**C — the interview is one screen.**

Two reviewers in a row called the five-question gate the wrong front door: *"A is 0–1
click, B is 0–1 click, C is five screens and six to ten clicks."* Level, campus and term
are the three answers that decide which schedule you are reading, and they now sit together
on one screen with live counts and the running week chart. Streams and programme were
refinements asked blind; they belong on the board, where you can see what they change, and
the `YOUR ANSWERS · CHANGE` chips already ask them there in place. There is no "skip" any
more because there is nothing to skip: the three answers arrive already chosen and the
primary button is the escape.

Also: option counts now report what an option would actually give rather than what
`settle()` would rescue it into — Spring 2026 and Winter 2027 correctly read "none
published" for a Waterloo undergraduate instead of inheriting Fall's 91.

**A new gate, from the reviewer's own suggestion.** *"For every level × campus × stream
combination, and at 380/700/1400px, the board must contain at least one `[data-id]` node
whenever the counter is non-zero. That one check would have caught it."* `parity.py` now
runs exactly that — 126 board states across three widths — and fails if any board draws
nothing while its own counter says otherwise.

**Round 3 verification.** `python parity.py` — all 83 selections match the incumbent
exactly for all three variants (4,278 event renderings each); eligibility core
byte-identical; every registration link and citation present (137 hrefs across 10
selections); Laurier's dead link still shown and still unclickable; zero console errors
across 69 page states. Two gates that had been written but never wired into `main()` are
now wired and passing: the empty-board smoke test (**126 board states across 380/700/1400px**,
none empty while its own counter was not) and the control-character scan.
`test_regressions.py` 48/48; `orientation.html` md5 `2577645c2eeeee417361d7b6037a7174`.

### Round 3, cycle 1 — independent review

Seventh reader. *"Three genuinely distinct products, unambiguously… the round-3 pushes
deepened them rather than converging them."* Contrast probed element-by-element across
eleven states against a validated control: **one failure in the whole set**, A's `.cldot`
separator at 2.01:1. No horizontal overflow anywhere at a true 430px.

The lead finding was mine to own: **A's new Clashes view and C's new OVERLAPS both counted
Laurier's duplicate listings as scheduling clashes**, and both counted all-day drop-in
desks as clashes. Two of the three variants gained an overlap feature in round 3 and two
got it wrong the same way — while B, which has no clash feature, was folding duplicates
correctly all along.

| Variant | Criticism | What changed |
|---|---|---|
| **A** | the clash view charged a duplicate listing against you as a conflict, on the line under the badge that said it was a duplicate | duplicates are deduped before clustering |
| A | drop-in desks counted as clashes — "a 6h45 check-in desk against a BBQ" — though A's own day view segregates them as "open most of the day" | `parts.long` is excluded; the clash view now honours the rule the day view invented |
| A | "clusters are connected components, not simultaneity windows" — `MON 7 12pm–10pm · 14 OVERLAPPING` is an afternoon, not a moment | the sweep cuts at every point where the concurrent set changes, then keeps only the **maximal** windows. `MON 7 12pm–10pm · 14` became `MON 7 1pm–1:30pm · 7 at once` and its neighbours |
| A | "73 of your 91 events" — a statistic describing 80% of the board describes nothing | recomputed off the deduped, drop-in-excluded set, and the lede now says what it excludes and why |
| A | `.cldot` at 2.01:1 — "the third round running in which a decorative separator is the only failure" | body meta colour |
| A | duplicates drew two identical bars in the run view, "reads as a rendering fault" | one bar per event, marked; the day view still shows both |
| A | leading weekday-and-date still in clash titles, under a heading naming that day | the strip is applied there too |
| A | bars under ~90px showed "SE…", "Ch…", "D" | below 88px the label is dropped; the tooltip carries it |
| A | Register links sat below a 3,096-character description | links directly under the facts, above the prose |
| **B** | **the TIME column truncated** — `8:30am–3:30…` — "the one cell in a schedule that must never clip" | see below |
| B | EVENT collapsed to ~100px on a graduate board while VENUE kept 200px | TIME is fixed and never yields; EVENT has a 210–230px floor; VENUE is the column that gives ground |
| B | "a badge on the majority class is decoration" — 81 of 142 rows read YOURS ONLY | only the two rare answers are badged; your own rows are the ground the comparison stands on |
| B | the badge took its own line | inline, before the panel name |
| B | 142 records vs 7+81+43 didn't reconcile | the bar now says "131 distinct events, listed as 142 records because Laurier publishes some of them more than once" |
| B | the identity summary squeezed the search field to "Search 508 events — try" | clamped to 34ch, and streams collapse to a count |
| B | nothing said a comparison was running | "· comparing with Brantford" in the header |
| **C** | OVERLAPS reported an event against its own duplicate | `clashesWith` skips events Laurier lists more than once |
| C | OVERLAPS fired on drop-in events — two of one plan's "2 OVERLAPS" were false | events of three hours or more are exempt, both in the per-entry line and the plan-bar count |
| C | "the tick box loses its label in every collapsed row — third round for this" | the label is on every row at every width now, and a ticked box carries a check mark rather than reading as an amber bullet |
| C | the gutter was ~100px of dead space | narrowed, with a smaller box in titles mode |
| C | the landing still ran airy | ~50px tighter |

**Two silent failures found while fixing the above, neither visible on screen.** B's TIME
clipping was not a width problem: `.piv-day` and `.nohost` each defined four column tracks
for *different* four columns, so on a board that was both, TIME inherited the 88px track
meant for DATE. The combinations are now spelled out explicitly. And a stray `@media`
brace left by an earlier edit meant **every CSS rule after it was being silently
discarded** — the stylesheet still loaded, the page still rendered, and several
recent B changes had simply never taken effect. `parity.py` now fails on an unbalanced
stylesheet as well as on control characters.

Also repaired: a global rename in round 2 had rewritten the explanatory comment above `NOW`
into one that contradicted itself ("NOW is the date this page was compiled… NOW stays what
it is, a build date"). Reworded in all three.

### Duplicated-logic audit

Prompted by the round-3 finding that two variants gained an overlap feature in one round
and both got it wrong the same way. Every helper that appears in more than one variant was
diffed.

- **`parseWhen` had drifted between A and B/C.** A defaulted the meridiem on an end time
  that had none; B and C did not, and would have read such a time as a.m. Tested across all
  **190 distinct time strings in the corpus the two agree on every one**, so nothing was
  wrong on this data — but this is the function that decides when every event runs, feeding
  A's clock and clash windows, B's time column and sort, and C's overlaps and `.ics` export.
  Latent divergence in exactly the place it would matter after a data refresh. All three now
  carry one implementation.
- **`clock` differed in shape between A and B** while producing identical output. Unified.
  C's differs deliberately — a document says "8:30 a.m.", a board says "8:30am".
- **"A desk open all day" had two definitions**: A excluded events of four hours or more
  from the clock and from clashes; C exempted three hours or more from overlaps. A student
  comparing the two would have been given different answers about the same event. C is
  aligned to A's 240 minutes, which is the threshold the product already publishes to the
  student as "open most of the day".
- Deliberate differences confirmed and left: `settle` (A and B mutate the shared selection,
  C takes a parameter), `markDups` (C additionally records which copies share a URL, for
  its "ticking one ticks them all" note), `buildNotes` prose (each describes its own
  presentation), and B's `evKey` for comparison, which matches on title, date and time
  *without* venue — deliberately, because comparing Waterloo against Brantford is exactly
  the case where the same event is at two different venues.

`parity.py` now fails if `parseWhen`, `sentences`, `paras`, `gatesOf` or `assess` differ
between variants. Presentation may differ; facts may not.

### Round 3, cycle 2 — independent review

Eighth reader. *"Three, unambiguously. Swap the stylesheets and nothing converges… the
verbs differ — A compares times, B files records, C keeps a plan."* Contrast measured on
computed colours: nothing small clears less than 4.5:1 anywhere.

**A's whole-run view was shipped broken.** `laneW` was referenced and never defined —
`weekHtml` threw on every render and `drawBoard` wrote an empty `<main>`. It is the
leftmost of the three lenses, so it is the first thing a curious student clicks, and
`writeHash` persisted `view=week` so a reload landed them on the blank board again. The
variable had been added and lost: the batch that introduced it aborted on an unrelated
mismatch before writing, and the line that used it went in separately.

**Why the console gate missed it, which matters more than the bug.** `console_check` ran at
Chrome's default headless window of 800px, and A deliberately forces itself out of the week
view below 900px. So the check exercised a view that could not throw, and passed, for two
rounds. It now runs every state at **1400px and 420px**, and the empty-board smoke test
additionally visits A's week and clash lenses, B's venue pivot and C's full-text mode at
desktop width. Refining that also exposed a flaw in the smoke assertion itself — a filtered
lens may legitimately have nothing to show — so it now distinguishes "drew nothing" from
"drew nothing and explained why", and only fails on the first.

| Variant | Criticism | What changed |
|---|---|---|
| **A** | the whole-run view threw on every render | `laneW` defined; the gate widened so it cannot pass unrendered again |
| A | the expanded sheet's "runs at the same time as" was not deduplicated — "the clash view dedupes and even says so in its standfirst; the sheet contradicts it two clicks later" | the sheet uses the same rule as the clash view: deduped, drop-in desks excluded |
| A | the chip label said "what ticking it adds" while a ticked chip read `-15` | "what ticking or unticking changes" |
| A | three identically weighted purple slabs — "registration is the only one with a deadline" | Register is the only filled button; the rest are underlined links |
| A | the three lenses were a vertical cluster beside a horizontal day rail | horizontal, above the rail: lens, then day |
| A | titles repeated the day they sat under | the day prefix is stripped in the day view and the agenda too |
| **B** | **every stream count went negative under "include events I cannot attend"** — `-400`, `-416` | the baseline is now measured the same way as the delta. A student reading `-416` would conclude the page was broken, and would be right |
| B | "Different term (Spring 2026)" stamped under every row of a group | when a whole group is out for one reason, it is said once on the heading |
| B | a zero-count facet was struck through **including the one currently selected** | the current selection is never rendered unavailable |
| B | "Compare with" was a permanent chip row on every screen including a phone | behind one "Compare with another campus or level…" affordance, and off entirely below 1080px |
| B | the reader's tint stopped where its content did | it runs the full sticky height |
| B | `markDups` keyed on the raw title, so "Friday, Sept. 11 - Inner Tube Water Polo" escaped the fold | see below |
| **C** | **the phone gate opened scrolled past its own headline** — the classic centred-overflow trap | it starts at the top, and centres only where there is height to centre in |
| C | the desktop gate floated in the middle third of an empty screen | the week chart is sticky beside all three answer rows |
| C | full text printed byte-identical descriptions back to back | the second and later copies say "The same description as *Orientation Headquarters, Friday 4 September*" and link to it |
| C | ninety-one "campus map →" links | a link Laurier attaches to most of a schedule is carried once at the top, under "on every event in this schedule" |
| C | "1 OVERLAP" named a number and not the clash | it is now a button that opens the day and scrolls to the colliding entry |

**The duplicate-identity fix went to all three at once.** The reviewer found it in B, but
"which listings are the same event" is a fact, so `stripDay` and `dupKey` are now one shared
implementation and every duplicate key in every variant routes through them — A's run-view
fold, its clash dedupe and its sheet; B's `markDups` and its comparison key; C's pick key
and overlap suppression. The shared-logic gate covers `stripDay`, `dupKey` and `sameEvent`
alongside `parseWhen`, `sentences`, `paras`, `gatesOf` and `assess`.

**Negative-testing the gate that failed silently.** A check that has never gone red is not
evidence of anything. The console gate was re-run against a deliberately broken copy of
variant A (`weekHtml` throwing on entry): **caught at 1400px, missed at 800px** — the old
blind spot reproduced on demand, and the fix confirmed to observe the thing it claims to
cover. Habit for the remaining rounds: when a check is added, prove it fails on a known-bad
input before trusting it green.

**Round 3 gate.** `python parity.py` — 83/83 selections match the incumbent for all three
variants (4,278 event renderings each); **182 board states** across three widths in the
empty-board smoke test, now including A's week and clash lenses, B's venue pivot and C's
full-text mode; shared logic identical; stylesheets balanced; no control characters; every
registration link and citation present; zero console errors at both 1400px and 420px.
`test_regressions.py` 48/48; incumbent md5 unchanged.

### Round 3, cycle 3 — independent review

Ninth reader. *"These are three genuinely distinct products… A's positional time axis, B's
pivot-and-compare, and C's tick-and-print are structurally different pieces of software."*
Contrast measured numerically on all three: every text colour passes, the lowest being a
disabled control. No generated-page tells. All three survive 390px.

The round-3 features got their first verdicts on their own terms:
**A's Clashes lens** — *"the single best idea across all three variants"*, and it correctly
excludes drop-in desks and duplicate listings. **B's comparison mode** — *"the sharpest
single feature in the whole set… no one else answers 'should I have picked the other
schedule?'"* **C's interview** — *"not a gate"*, because the answers persist as chips that
edit in place. The editorial de-duplication in C was called *"the best thinking in the
set — no other variant edits its source rather than merely rendering it."*

Three faults were named that round 4 has to answer, all on the variants' own headline
screens rather than on surface:

1. **A's whole-run view leaves 37% of its bars unnamed** — 50 of 134 measured. The 88px
   label cutoff I added in round 3 to stop one-character labels went too far the other way.
2. **B's sticky day heading sits underneath its own results header**, so scrolling into the
   middle of a long day leaves an orphaned row with no date visible anywhere.
3. **A abandons the clock on the busiest day** — 32 events, 9 concurrent, and it switches
   itself to a list. *"The differentiator vanishes on the one day a student most needs to
   see the shape of."*

Also named: A is *"the best at seeing the week and the worst at keeping it"*, and C computes
overlaps only for events already ticked, so the fact A leads with is invisible in C until
after you have committed.

## Round 4 — the three headline screens

Round 3's features had come back well received; round 4 is about the faults R3C3 named on
each variant's own main screen.

**A — the run view names everything, and the clock stops surrendering.**

The 88px label cutoff added in round 3 to stop one-character labels had gone too far the
other way: measured, **35 of 111 bars carried no label at all**. Three ladders now, instead
of one threshold — the title inside the bar where it fits, the title spilling to the right
of the bar where that lane stays empty (the layouter already knows how far), and nothing
only when neither is true. Measured after: **0 of 108 unlabelled**.

The run view's duplicate collapse turned out never to have landed — the batch that
introduced it aborted on an unrelated mismatch before writing, the same failure that had
cost `laneW` a round earlier. Applied, with a distinction the earlier attempt missed: two
entries sharing a title and a start time but sitting in **different rooms** are not
duplicates, so both are drawn and the label carries the venue. Duplicate bars within a day
row went 3 → 1, and the survivor is "Get Involved Fair", genuinely in two places at once.

*"The clock switches itself off on the busiest day… the differentiator vanishes on the one
day a student most needs to see the shape of."* It no longer does. Past five concurrent
events the blocks tighten — smaller type, venue dropped — and the list is offered beside
the clock rather than replacing it. Only a phone still forces the list, and the "Whole run"
tab is no longer offered below 900px, where it could not work.

Print: blocks no longer clip their own venue, the day steppers are suppressed, and the run
and clash views print.

**B — the day heading clears the header, and the catalogue knows about time.**

*"The sticky day heading is permanently hidden behind the results header… on a 138-record
board this is the most damaging thing in the variant."* The header's height changes with
the pivot row wrapping and the jump rail, so it is now **measured** into a custom property
rather than guessed at 46px.

*"B has no notion of a clash… the facet rail is exactly where a `Clashes with something`
filter belongs."* It has both now: a muted "4 others at this time" on the row, and a
"Runs at the same time as something" filter in ONLY SHOW. It uses the same rule as A and C
— deduped, drop-in desks excluded — and it is the rail's own idiom rather than a copy of
A's lens. Comparison gained a three-swatch key so all three states read without badging the
majority one, and the disabled stepper went from 2.23:1 to 4.6:1.

**C — the overlap fact arrives before you commit.**

*"Clashes are computed only for picked events… the fact A leads with is invisible here
until you have already committed."* Overlaps are now counted against the whole schedule and
shown muted under every entry in both densities; the plan bar still counts only your picks,
which is the number that belongs there. The summary now names the day it opened in full and
why ("**Wednesday 2 September** — your first day still to come — is open in full"), the
YOUR ANSWERS row is a grid that wraps rather than truncating the chip whose content matters
most, and print constrains headings and tables to the same measure as the prose.

### The recurring failure, and what now prevents it

Three fixes in three rounds were lost the same way: a multi-edit batch wrote the line that
*calls* something and aborted, before writing the definition. `laneW`, then the run-view
duplicate collapse, then C's `clashesInSchedule`. Saying "I will verify each edit landed"
did not hold, because it was a thing to remember rather than a thing the tooling did.

**`check.py`** now does it. One command per variant: build, `node --check`, a reference
check, and a console check that loads the page in Chrome at **1400px and 420px** across
four states each. It is run after every write to an app script, before anything else
proceeds — not at the end of a round.

The reference check is deliberately narrow, and getting it honest took four attempts, each
failing in a way worth recording:

- matching every `name(` flagged every method call — `.map(`, `.filter(` — and was useless;
- stripping comments with a regex was defeated by regex literals containing `//`;
- stripping strings with one pattern per quote type corrupted mixed quoting: run a
  double-quote pattern over `'<span class="dup">'` and it matches the inner `"dup"`;
- a single left-to-right scan still swallowed the file, because a regex literal in the
  corpus contains a quote — `/[A-Z“"(]/` — which opened a string that never closed.

It now scans once, tracking strings, both comment forms and regex literals, and is tested
against known-bad inputs rather than trusted because it is green: renaming
`clashesInSchedule` yields exactly `['clashesInSchedule']`, deleting `var LONG_MIN` yields
exactly `['LONG_MIN']`, and all three real files come back clean.

**What it caught immediately.** C had not one undefined reference but three, from the same
aborted batch: `clashesInSchedule`, `sameEvent`, and `LONG_MIN`. Only the first was visible
in the browser, because it threw before reaching the others. The reference check found
`sameEvent` statically; the console layer found `LONG_MIN`, which is read rather than
called — so the constant check was added afterwards and negative-tested too. Layered
checks found what any single one of them would have missed.

**A gate that straddled two builds.** The round-4 run reported variant C *missing every
event on every selection* and, ten minutes later in the same run, *zero console errors* —
because it reads each page fresh as it reaches it, and C was fixed and rebuilt while the
run was still going. Both statements were true of the file at the moment they were made,
and the run as a whole meant nothing. `parity.py` now **snapshots** every page and script
into a temp directory before it starts and tests only that, so a run is a statement about
one moment. Same failure family as the 800px console check and the swallowed CSS: green
for a reason unrelated to the thing being asked about.

Two process rules from this, now held to: read a gate's result before acting on it, and
never edit while one is running.

### Round 4, cycle 1 — independent review

Tenth reader, and the hardest of the set. Both round-3 asks on A were confirmed answered:
unnamed run-view bars went from *"50 of 134"* to *"3 of 89"*, and the clock *"no longer
surrenders: at 32 events with 9 concurrent lanes it still draws, and it is still legible —
that was the most important ask of the round and it landed."* Still three genuinely
distinct products; *"the verbs are different (A positions, B files, C keeps)."*

Then the finding that matters:

> "Rebuilding the headline screens **lost round-3 fixes living in the code the rebuild
> touched** — three in A's `openSheet`, one in A's title rendering, one in C's phone gate —
> and C's brand-new sticky heading reproduced, exactly, the fault that was being fixed in B
> in the same round."

That is the fourth instance of one failure: a multi-edit batch aborts, and the parts that
had already been verified in earlier rounds quietly go back to how they were. All of it was
invisible to a console check and to a screenshot of the top of the page.

**What was restored, and why it will not go again.** A's sheet had reverted to an
unfiltered clash list (listing drop-in desks and an event's own duplicate), links below a
3,096-character description, and four identically weighted buttons. Rather than re-apply
the three fixes, the rule they encode now lives in **one function**: `collidesWith()`,
called by the sheet and defined once beside the Clashes lens's rule, and `title()`, through
which every visible title in all three variants now passes. `data-ev-title` still carries
the raw title, because that is what parity compares against the incumbent.

**`invariants.py`** asserts the properties rather than the code, which is what the reviewer
asked for. Three assertions, each negative-tested against a page built to break it:

1. no visible title still carries the day it is filed under;
2. no sticky element pins where something sticky above it still covers;
3. no `--rule-*` / `--line-*` custom property is used as a text colour.

Run against the real build, they immediately found three of the reviewer's own findings
independently — C's day heading sliced in half by the jump rail above it (`contents ends at
74, dayhead pins at 52`), C's `.dlsep` separator at 1.49:1 (`dlsep uses --rule-p`, the
fourth round running a decorative separator has been the only contrast failure in the set),
and B's rail, results header and reader all pinned 3px under the top bar's own gold rule —
plus two day-prefixed titles in B that no reviewer had reached. All fixed: C measures the
rail's height at runtime instead of guessing, B's `--top` accounts for its border, and the
separator uses the meta colour.

Getting assertion 2 honest took two passes — a left-hand rail and a middle column are both
pinned near the top but sit side by side and cannot hide each other, and two day headings
with the same `top` are peers replacing one another, which is what sticky is *for*. It now
requires the two to overlap horizontally and one to be strictly above the other.

**A gate that reported false failures.** The round-4 snapshot run came back with five parity
mismatches and four empty boards — and, tellingly, with `orientation.html` itself failing.
The incumbent has not been touched and its md5 is unchanged, so that was the signal the run
was wrong rather than the build. Re-run serially, the flagged selection matched exactly
(incumbent 86, A 86, B 86, C 86, all equal), and probing the incumbent directly returned
`JSERR:0` — zero errors — on both selections it had failed.

The cause was load: four parallel Chromes plus a review agent driving its own browsers, and
a page missing its virtual-time budget reports nothing, which is indistinguishable from a
page that hung. Both runners now **retry once, serially, with a longer budget** before
failing. A real hang fails twice; a machine under load does not. A gate that cries wolf gets
ignored, which is the same end state as one that never goes red.

### R4C2 revision, part 3 — the fold

R4C2's top-damage item for both A and C was that a 1366x768 laptop — the most
common screen in a Laurier lab — showed **no events at all** without scrolling.
Measured before: A first event at y=854, C at y=866, B at y=348.

The fix is not "make everything smaller". It is deciding what earns its place
above the fold. In both cases the answer was the same: the sentence explaining
the page is worth two seconds and then it is furniture.

- **A**: masthead padding 17/20 -> 13/15, `h1` clamp ceiling 52px -> 38px, crest
  margin 11 -> 7, identity band padding 11/10 -> 8/7, day heading margin 16 -> 11,
  legend margin 9 -> 6. Then a `@media (max-height:820px)` block that drops the
  standfirst entirely and pulls `h1` down again. Result **y=736**.
- **C**: `.dochead` padding 54/30 -> 26/18, `h1` clamp ceiling 66px -> 46px,
  `.docsum` 17.5px -> 16px over a wider measure (52ch -> 74ch, so it is two lines
  not four), `.day` padding-top 36 -> 22. Under `max-height:820px` the shared-notes
  box and the global links box both hide — they are reference material, and
  reference material can live below the first day. Result **y=541**.

Both are CSS-only; no app script changed. Verified after: a 736, b 348, c 541 —
all three above the fold at 1366x768. check.py green, invariants.py green on
5/4/4 states, test_regressions.py all passed, incumbent md5 still
2577645c2eeeee417361d7b6037a7174. Parity re-run despite this being CSS-only,
because a `display:none` in a height media query is exactly the kind of change
that could hide something the gate counts.

Gate after the fold work (CSS-only, but run anyway): **ALL PASSED** — eligibility
core byte-identical across the three app scripts; all 83 selections match the
incumbent exactly, 4278 event renderings compared, for each of A, B and C; 182
board states across 3 widths, none empty while the counter was not; no stray
control characters; stylesheets balance; link assembly byte-identical; 137 hrefs
present across 10 selections; zero console errors across 69 states (incumbent 14,
a 16, b 21, c 18).

## Round 4, cycle 3 — the reviewer found wrong answers, not ugly ones

Verdicts: A fix-then-ship, B fix-then-ship, C ship. Ranking A, B, C, and it would
delete C if forced to two — "a redundancy call, not a quality call", because
A+B keeps both the clock and the search and A+C loses search entirely.

Three of its findings were the page giving a **wrong answer**, which is the only
class of defect that matters more than any layout note.

**One rule, two implementations, both wrong.** B tried to drop a leading
restatement of the day from Laurier's time field and built the regex with
`new RegExp("^\s*" + ...)` — inside a double-quoted JS string `"\s"` is just
`"s"`, so the pattern required literal `s` characters and never matched once.
24 events read "Friday, Sept. 11, 2026 — Friday, Sept. 11 | 8:30 a.m.". A had the
same line in its event sheet with **no** stripping at all, so it printed the day
twice too. This is the duplication the brief warned about: the same rule written
in two places and wrong in both. Fixed by writing it **once** —
`stripLead(n, d)`, a literal regex, byte-identical in all three scripts and now
in the shared-logic gate beside `parseWhen` and `stripDay`. It only strips when
the day number in the string is the day the event is actually on, so a genuine
"Tuesday, Sept. 8" sitting on a Sept 9 event survives untouched. Negative-tested
against eight strings before wiring it in, including that mismatch case and a
string that would be emptied by stripping.

**B's `&only=clash` deep link returned an empty board and blamed the student.**
`var list = results()` ran one line before `CLASHPOOL` was filled, and
`results()` counts clashes against that pool, so a shared link showed "Nothing
you can attend matches — 281 records do, but they are restricted to other
students", which was false. Two lines swapped. Verified: 56 rows, header "56 of
508 records".

**B's registration filter was 94% false positives.** `hasReg` tested
`e.l.concat(e.sl, e.pl)`, and `e.pl` is page-level — the Waterloo undergraduate
page carries a "Register Now!" banner, so 166 of 170 events matched. Now event-level
links only: 3 for this selection (CSEDI 101 RSVP, Valorant team registration,
French Montana tickets), header and rows agreeing.

**A's week view had five anonymous bars.** The spilled-title branch put the label
at `left:100%` inside `.wb`, which is `overflow:hidden` — measured visible width
**0px**. The label is now a **sibling** of the bar rather than a child, which
fixes both the clipping and the honesty of its contrast, since it is drawn on the
lane and should be measured against the lane. Verified at 1400px: 86 bars, 86
named, spilled labels visible, zero anonymous.

**contrast.py** — the brief asks for a measured floor and I had been measuring by
hand. Now a walk over every element that paints a text node, resolving background
up the ancestor chain through transparency and applying the WCAG size rule, across
11 states x 2 widths. It self-tests first: it injects a 13px #C9C9C9 paragraph on
white and refuses to run unless it reports it. It found exactly one real failure
left, B's disabled reader stepper at 4.07 (#7C7490 -> #6E6782, now 4.94), and
confirmed A's relocated week label is clean. **ALL PASSED.**

Horizontal overflow: B was the only page that swiped sideways, and the cause was
not the top bar the reviewer suspected but `.endin`'s
`repeat(auto-fit,minmax(340px,1fr))` — 340 + 44px of padding does not fit 345px.
`minmax(min(340px,100%),1fr)`. Swept 3 pages x 3 states x 360/390/430: clean.
Also added the one `:focus-visible` rule B was missing across 26KB of custom controls.

### Acting on the rest of R4C3

**A, phone economy.** The reviewer measured 1.4 screens of scaffolding before the
first event at 390x844, with the eight stream chips alone taking y=530-710. Those
chips and the programme select are refinements, not the question, so below 900px
they fold into a disclosure that says how many are on. It remembers being opened
by hand (`MORE` stays null only until someone expresses a preference), and it is
open and its summary hidden above 900px, where there is room and no reason to make
anyone ask. The standfirst goes below 700px. Measured after: first event at
**y=799 on a 390x844 phone** (was ~1145) and **y=624 at 1366x768**.

**A, the link fell behind the screen.** `ghosts` and `asList` changed what was
drawn without being written to the hash, so a shared link showed a different page
from the one being looked at. Rather than add two `writeHash()` calls, `redraw()`
now writes the hash itself and the seven redundant `writeHash(); redraw();` pairs
are gone. Anything that changes the screen goes through `redraw()`, so a third
toggle cannot repeat the mistake. Verified: `&ghosts=1` restores and draws six
unattendable events.

**C, a question you could miss.** At 390x844 the third question sat below the
scroll line of `.askmid` with a gold "Build my orientation" in full view beneath
it, and nothing said there was more. A student could answer two of three and press
the button. There is now a prompt that appears only when the panel really does
scroll and leaves at the end of it. Verified: 390x844 scrollable by 366px, prompt
shown; 1400x1000 not scrollable, prompt hidden.

**C, phone header.** Same treatment as the short-viewport rule, now also below
700px: the notes Laurier repeats and the links it puts on every event wait until
after the first day. **y=1039 -> y=801** at 390x844. Also `scroll-padding-bottom`
so a jump target never lands under the fixed plan bar.

**C, duplicates in brief mode.** Two identical lines in a row read as a rendering
fault; the full entry explained itself and the brief one did not. It does now,
naming which copy it is and which section each came from.

**B, "every record" opened in January.** With `all=1` a Fall 2026 undergraduate
landed on Monday 5 January 2026 — a graduate Spring schedule with nothing on it
for them. Groups holding something attendable now sort first, groups and never
records, so a day is never split in two. Verified: opens on Friday 4 Sept 2026.
(I wrote a second sort to do this and then deleted it once the comparator covered
it — two implementations of one rule is the thing that produced the `stripLead`
bug in the first place.)

**B, two true numbers side by side.** "91 of 508 records" over "Result 1 of 89"
was never wrong, just unexplained. The header now names both: records, and
distinct events.

**Disagreement, recorded.** R4C3 wants A's grid and C's brief list to fold
Laurier's duplicate listings into one row. I am not doing it. The parity gate
compares a `Counter` of rendered titles against the incumbent, so folding a
duplicate makes the variant render fewer events than the page it must match —
"a variant that quietly drops or adds events is a failed variant, however good it
looks." The complaint underneath it is fair, and both pages now answer it in
words instead: A tags the pair and C explains it in brief as well as in full.

---

## Round 5 — six corrections from the person who has to use it

Six changes, applied to the main page (`_app_a.js` / `_body_a.html` / `_style_a.css`)
and to A-plus, and to B and C wherever the change is a fact about the data rather
than a way of showing it.

### 1. The "where this data disagrees with itself" section is gone

Laurier is the source of truth. Cataloguing our disagreements with it is a note to
ourselves, printed where a student is looking for a room number. The section, its
list and `buildNotes()` — 3,200 characters of it — are out of main and A-plus,
along with the `.notelist` rules that dressed it. B and C keep theirs: the change
named two files, and C's is framed as "before you rely on this", which is a
different sentence from ours.

### 2. One event, however many times Laurier published it

Laurier puts the same session on two or three of its schedule pages. The board used
to draw it twice with a "listed twice" badge, which is the page explaining its own
plumbing. It now draws the event **once**, and the detail names every page it came
from, with each address written out.

Three things had to be got right, and only one of them was obvious.

**Which listings are the same event** is `dupKey` — title with any day prefix
stripped, date, published time, venue, the free-text parts case- and
whitespace-folded. That was already shared by all four scripts and did not need to
change: it already keeps Lane Swim's 7:30am, noon and 8pm runs apart on 9 Sept,
Open Climbing's two sittings on 11 Sept, and — the one a previous round got wrong —
the two Get Involved Fairs at 11am on 11 Sept, which share an hour but sit in the
Quad and outside the Athletic Complex under different hosts.

**Which listing gets shown**, though, is not free. Laurier does not retype the two
copies identically: one states "First-Year Off-Campus Students Only" and the other
says nothing about audience; one names Athletics and Recreation as host and the
other leaves it blank; the Free Store Pop-up has 187 characters of description on
one page and 876 on the other. Taking the first would have silently dropped a
restriction on six events. So `onePerEventPreferring` takes the listing carrying the
most of what Laurier published — description, audience, host, cost, section notes
and links, by length — and the links of *all* the listings are joined, because the
football game's ticket link sits on one copy and not the other. Checked over every
level x campus x term, with and without every stream: **no audience, host, cost,
description or section note is lost by that rule anywhere.**

And a listing the student *cannot* attend must never stand in for one they can. With
"show what you cannot attend" on, the pool includes the Bachelor of Education copy
of Lane Swim, which is longer, so "most detail" chose it and stamped "Bachelor of
Education students only" on a swim an undergraduate can walk into. Attendable wins
first; fullest only breaks the tie. The board caught this at 29 events drawn where
89 were expected.

**Nothing may be merged across boards.** The fold runs over the listings the student
is eligible for, never over the whole file, so the Niagara Falls Trip keeps the
Brantford bus link on the Brantford page and the Waterloo one on Waterloo. Those two
are never eligible together and are never merged.

Dead weight removed with it: `markDups`/`DUP`/`dupTag` in all four scripts, B's
fold-behind-a-disclosure row group and its "91 records, 89 distinct events" pair,
C's "copy 1 of 2" brief line, the week grid's second de-duplication and the clash
lens's third. The band's own tally counted listings while the board drew events, so
it said 91 over a day rail adding up to 89; it counts events now.

C's pick key was hashed from the citation URL, which made the two pages Laurier
publishes one session on into two separate ticks. It is hashed from `dupKey` now.

### The gate had to change, and it had to get stronger

`parity.py`'s rule was that a variant renders the same *multiset* of listings as
`orientation-classic.html`. That rule now forbids exactly the thing the page is
supposed to do, so it was rewritten to prove the new property rather than relaxed
into something that would pass either way. Three claims, in order:

1. **The yardstick is checked too.** Everything else is measured against an
   eligibility model written in `parity.py`. If that model were wrong every variant
   could agree with it and the run would come back green. So it is first held
   against `orientation-classic.html`, which is untouched and renders one `<h3>` per
   listing: for all 83 selections the model's listings must be exactly what the
   incumbent draws.
2. **Same set of distinct events.** A variant renders exactly one entry per
   `dupKey` — none dropped, none invented, none drawn twice.
3. **Nothing lost, only merged.** Every entry on the board is *clicked open* and the
   addresses in the detail that appears are read back out of the DOM. For every
   listing folded into an entry, that listing's own citation URL must be there.

Claim 3 is what stops claim 2 from being a licence to throw things away, and it is
proved through the real interface rather than by reading the source. It found the
first bug it was pointed at: `openSheet` in main declared `var mine` for the source
list and the overlap ribbon below it declared `var mine` again for a parsed time, so
the sheet threw on every click — invisible to every other gate, because no other
gate opens a card.

Negative-tested before being trusted. Against a build that keeps only the first
listing's sources: twelve failures, naming the events. Against one that draws every
listing: "170 entries for 157 distinct events; one is drawn more than once".
Against one that drops a single event: "156 distinct events drawn, 157 expected".
Against the real build: green.

`plus_check.py` computed `dupKey` in Python by hand, and that split has broken this
project seven times. There is now no second implementation: `dupkey.py` extracts
`stripDay` and `dupKey` out of `_app_a.js` and **runs those functions under node**
against `events.json`. Both gates import it. `shared_logic_check` proves the other
three scripts carry the same bytes, so deriving from one derives from all four.

Link assembly widened from one listing to all of them, and a widening is where a
rule quietly stops matching the incumbent's — so `link_core_check` no longer
compares source text, it *runs* `allLinksOf` over all 508 events one listing at a
time and requires byte-identical output to `_app.js`'s own assembly. That caught a
real regression immediately: the first version de-duplicated by address, and Laurier
gives one LOCUS page two different labels on the same event ("LOCUS Links" and
"learn more about each link by clicking here"), so collapsing by address dropped a
label rather than a duplicate. Within one listing the assembly is now the
incumbent's exactly; only across listings is a repeated address a repeat.

`titles_by_day` had been looking for `class="bar"`, which the week view has never
emitted, so for four rounds it silently fell through to reading the week view a
second time and proved nothing. It walks the day pages now, as its own check.

### 3. No implementation vocabulary in anything a student reads

"…including the collapsed accordion panels where Laurier keeps venue, host and
registration detail" is how we scraped it. It now reads "including the venue, host
and registration detail Laurier keeps hidden until you open an event", in all three
body templates and in every citation block. A-plus's search said it matched on
"panel"; it matches on "what it is part of". B called events *records* in nine
user-facing strings — the rail note, the empty state, the reading pane, the stepper
labels and the count in the top bar — and calls them events. Comments are untouched;
this is about what a student reads.

### 4. The One Day heading says less

The "N run at the same time as something else" line is gone: the Clashes lens
answers that question properly, naming which events and when, and the heading was
restating it worse. "This is your busiest day" is gone too — it was gated on "not
the first day of the run", so it fired on eight days of nine including one with a
single event on it. The pointer to where orientation actually starts stays.

### 5. The eligibility badge says one of three honest things

It used to say "Open to all students" or "You can attend this". Both are wrong about
an event Laurier restricts to undergraduates. `audienceLine()` — shared, byte
identical in all four scripts — says, in order: **Laurier's own words** if it states
an audience, because that is the most accurate thing anyone has; else **"Open to all
Laurier students"** for the four *We Brought What You Forgot* listings that really
are open across levels; else **"Open to you"**, which claims only that it matches the
level, campus, term and streams you gave. It reads the same in the detail sheet, in
B's reading pane, in C's facts list and on the printed sheet.

`assess()` is not touched — it is byte-identical to `_app.js` under gate, and the
badge was never its business.

### 6. Paper gets the clock

The printed schedule was a list of paragraphs, on a page whose whole argument is the
clock. It is a timetable now.

**A-plus** builds a grid per day: hours down the left, each event a box in its slot,
as tall as it is long, overlaps side by side. It uses the screen's own piecewise
axis — occupied stretches to scale, a hole of two hours or more collapsing to a band
that names the hours it stands for — because drawn to scale one quiet Saturday was
five inches of ruled nothing and paper does not scroll. `makeScale` took a gap
height parameter to do it, rather than growing a second copy.

A grid cannot carry a web address, so under each day the same events are written out
in the same order, numbered to match the boxes, with venue, host, the audience line,
anything it overlaps, and every registration and citation address in full. That is
what the list gave that the grid does not.

How much a box can hold depends on how many share the width. Four abreast on A4 is
about 110pt each and a name fits. Five or six is 70pt: the boxes keep their number
and their time and the numbered list below carries the names, and the page says so.
Past six each block is a hairline too narrow for its own number, so that day is
written out in time order and the page says why. On a Waterloo undergraduate's Fall
board that is one day of nine — Monday 7 September, seven deep at noon.

**Main** has no printed-document layer and is not getting one; what it has is the
day you are looking at, and that now prints as the grid rather than being flattened
into a column. Every distinction that was colour on screen is a line weight or a
border style on paper — a clash is a heavier reading edge, an open-to-all event a
double one, an event you cannot attend a dotted one on grey — so the sheet survives
a monochrome laser. It loses nothing it used to have: its list print carried no
addresses either.

Verified by rendering real PDFs with Chrome and reading them back with PyMuPDF, page
images included, not by trusting the CSS.

### Round 5, cycle 1 — the independent review, and what it changed

Given file paths and nothing else. Verdicts: A **restart**, A-plus **ship** (with three
fixes first), B **revise**, C **revise**. Its ranking for a student planning a week was
"A+, decisively". It measured its own contrast walk across every state and reported zero
failures on all four pages.

Six of its findings were the page giving a wrong answer, and five of those were mine.

**C promised 91 events and delivered 89.** The cover counted listings while the document
wrote out events — the same defect as A's tally, fixed there and missed here, and it sat
on the first number a stressed student reads. `countExact` folds now, on all three pages
that have one.

**A-plus's registration checklist stopped disambiguating.** Its own copy says "each is
labelled with the schedule it was printed on", and both entries had come to carry the
same pair of schedule names. Cause: I had widened `pageRegLinksOf` to gather across every
listing of an event, so every event carried both schedules' banners. A banner belongs to
the page it is printed on and to the listing read from it, not to the event; it is
gathered from the one listing again.

**B's comparison strip stated a total it was not counting.** I had shortened it to "107
events between them", next to a header reading 109 — because the strip counts by title,
day and time (so Waterloo's Shinerama BBQ and Brantford's are one event on two campuses,
which is the question that view exists to answer) and the header counts by the finer key
the board folds on. Two different questions, and the shorter sentence implied they were
the same one. The strip now says what it counts and offers no total.

**The printed board reprinted one address eleven times.** Nearly every event on a day
comes from the same page of Laurier's site. It is stated once under the day heading, and
only the entries that came from somewhere else — or from two places — carry their own.
Thirteen pages to twelve, and the reading is much quieter.

**The printed grid numbered its blocks out of reading order** — the 5pm row ran 18, 14,
15, 16, 17, because the numbers came from the time sort and the columns from the
placement. Ties on start time now break by column, so the row reads 14 to 18.

**A's printed sheet did not say whose schedule it was**, and clipped titles. The identity
band's controls are furniture and are not printed, which left the sheet anonymous; there
is now a one-line "Undergraduate · Waterloo campus · Fall 2026" that exists only on paper.
The clipping was `-webkit-line-clamp` on the title: a block sized by how long an event
lasts still has to be able to say its whole name, so in print the clamp comes off the
title, the type steps down, and the venue keeps a two-line clamp. Checked by rendering the
PDF and reading it back against the board: 21 of 21 titles present, none truncated. The
reviewer also noted that gold-means-clash and lilac-means-open-to-all both print as black
ink; they are told apart by the weight and style of the reading edge, and a distinction
nothing explains is not a signal, so the key is now printed beside the tally.

**Held, and recorded.** The review's headline is that A is a subset of A-plus and should be
replaced rather than restyled. That is a judgement about which variants to keep, not one of
the six changes asked for here, and acting on it would mean designing a fourth product. It
is passed on rather than acted on. The same goes for its notes on the whole-run view's
truncated labels, the phone form of that view, B's venue-pivot sort order and column
truncation, C's document length and missing clock, and the composition of the two chooser
screens — all pre-existing, none of them touched by this round.

---

## Round 6 — seven corrections from an audit, and one page put under watch

### 1. The data notes are back on main and A-plus

Round 5 asked for the "where this data disagrees with itself" section to go "and
any now-dead code that fed it", and `buildNotes()` went with it. It was not dead:
the same function fed four notes that `REVIEW.md` records as the *agreed
mitigation* for four known limitations, and removing them left a graduate reading
the Spring board seven events under "Fri 9 Jan" with nothing anywhere to say that
Laurier's Spring page carries January dates. B and C had kept theirs, so the main
page was the only one that had quietly stopped saying it.

Restored to A and A-plus: undated events, the Spring page's January dates, the
Winter 2027 placeholder, and program and faculty welcomes carrying no audience.
The framing is not restored — the heading is "Before you rely on this", the lede
says these are things Laurier leaves unsettled rather than things we disagree with
it about, and the fifth note, a count of events without a usable time or venue, is
left out: it is a statistic about the extraction, which is the kind of thing round
5 was right to remove.

### 2 and 3. `stripDay` was defeated by a typo and by the word "Daily"

`international.html` publishes **"Wednedday, Sept. 9 - Your First Grocery Store
Tour in Canada"** — Laurier's own misspelling, live today. The alternation of
correctly spelled weekdays did not match it, so the prefix stayed on the card,
under a heading already reading Wednesday, and `dupKey` filed it apart from the
correctly spelled copy of itself on the Brantford schedule: one event, drawn
twice. The weekday slot is now any word at all, with a month and a day number
required after it so a title that merely begins with a word before a month name is
not eaten.

`locus.html` publishes **"Daily - LOCUS Orientation Hub"** where two undergraduate
schedules publish "LOCUS Orientation Hub", same day, hour and room. Not every day
prefix is a date; the label says when it runs and is not part of its name. Both
now strip, 355 distinct events becomes 353, and because `dupkey.py` runs the
page's own function under node, `parity.py` and `plus_check.py` followed without
being told.

`plus_check.py` had a second copy of the old regex to strip titles before looking
for them on the printed page. It went stale the moment the page learned better —
a gate that strips differently from the page it is checking proves nothing — so it
calls `dupkey.shown_title()` now, and there is one implementation again.

### 4. A map link sent a Milton student 50km the wrong way

`campusOf()` preferred the campus the *reader* picked. Laurier scopes the Waterloo
SEEDs day to Milton, Virtual and Waterloo students alike, so with Milton chosen the
map query for the Indigenous Student Centre on Albert Street read "…, Milton,
Ontario" — and the same wrong campus was printed on paper, where a student cannot
click through and notice. It now asks where the event is *held*: the venue, then
the section Laurier publishes it under ("Waterloo Campus SEEDs Orientation"), then
the anchor it is cited from (indigenous.html's day one is `#waterloo`), then an
event scoped to a single campus. Only when nothing says where it is does the
reader's own campus stand in.

`plus_check.py`'s map test passed through all of this, because its rule was that
every word of a query came from the venue or names *a* campus, and "Milton" is a
campus. It now renders the board three times, once per campus picked, and requires
that any campus a query names is one Laurier itself puts the event on. Against the
old `campusOf` it fails on two of the three passes, naming the SEEDs events.

### 5. "Orientation starts on …" stopped being true on the second morning

The day it named was the next day with events at or after the live clock, not the
start of the run — correct on 3 September and wrong from the 6th, which is the week
this page exists for. The run's first day is now found without asking the clock,
and the label follows it: "Orientation starts on Friday 4 Sept" until it does,
"Next up Sunday 6 Sept" afterwards.

### 6. Two different tickets, one label

`international.html` publishes the Niagara Falls Trip twice, one bus from each
departure campus, identical in name, day, time and venue, pointing at two different
Eventbrite events. With "show what you cannot attend" on, the registration list
offered both as "Get Your Ticket for Niagara Falls". `allLinksOf`'s disambiguator
appends the schedule a link was carried in from, and both were printed on the same
schedule, so it separated nothing. Both it and `regLinksOf` now qualify by the
field that actually differs — campus first, then schedule, then section — and the
two read "(Brantford)" and "(Waterloo)".

### 7. The footer counted something no reader could reach

"520 events extracted from 13 Laurier schedule pages" was true of the file and
false of the page: duplicates fold, so the most anyone can reach anywhere is 353.
The footer now states both numbers and what the difference is, and the count is not
recomputed for it — `build.py` folds with `dupkey.py`, which runs the page's own
`dupKey()`, so the footer counts events the same way the board does or not at all.
B's "N of 520 events" counter and its phone search placeholder had the same
unreachable denominator and now use the same number.

### 8. A page nobody was watching

`students.wlu.ca/academics/graduate-and-postdoctoral-studies/aspire/incoming-student-support.html`
carries the graduate "Laurier Crash Course" — dated, timed, registrable webinars in
the same accordion format as the schedules. Nothing is missing from the board
today, because every Fall 2026 session has already run, but the page says the
Winter 2027 sessions go up "at the beginning of the fall semester", which is now.
It is added to `check_drift.py` as **watched, not parsed**: its snapshot lives in
`_watch/` rather than `_src/`, and `parse.py` reads the files named in its own
`META` and nothing else, so a watched page cannot reach the board by accident. The
report names it separately and says what a change there means — a decision to make,
not a rebuild to run.

### Gates

`build_all.py`, then `parity.py` (83 selections x 4 variants, including a new
"one event, one entry" check that folds by a rule knowing nothing about day
prefixes, and fails on the old `stripDay`), `check.py`, `invariants.py`,
`contrast.py`, `plus_check.py`, `test_regressions.py` 48/48, `check_drift.py`
clean across 14 pages. Both new assertions were negative-tested against the code
they were written for before being trusted.

---

## Round 7 — three things the person using it noticed

### 1. A key that named colours the day did not contain, and a colour nobody had named

The report was that "open to all Laurier students" appeared on every event. It does
not: `audienceLine()` says that of two listings in the whole Fall/Waterloo pool,
and the sentence is correct. What was on the screen was the **key under the day
heading**, and it printed both of its captions on every day whether or not the day
held either state. The screenshot that came with the report is Tuesday 15
September: one event, no collision, not open to anybody outside its own level, and
the page underneath it asserting that something ran at the same time as something
else and that something was open to every Laurier student.

The second half of the fault is why that mattered. `.blk` draws an ordinary event
with a 4px `--purple` edge and `.blk.open` with a 4px `--lilac` one, and only the
lilac had a caption. Two purples one step apart, one of them named — so the named
one is the one a reader reaches for, and a programme-specific welcome was read as
open to everybody. **A key that names a state nothing on the screen is in is worse
than no key**, because it invites exactly that match.

Three changes, in A and A-plus:

- **Every key is conditional.** `clockStates()` is handed `[event, doesItCollide]`
  pairs for everything the view actually draws and reports which of the four states
  are present; `legendKeys()` writes only those. A day with nothing colliding and
  nothing open across levels now shows no key at all, and the `<div class="legend">`
  is not emitted either — empty it is still 6px of margin and a flex row holding a
  day apart from its own clock.
- **The ordinary state is named**, whenever anything else is. On its own "an
  ordinary event on your board" tells nobody anything, so it is drawn only as the
  thing the other keys are not.
- **Lilac means one thing and is a different shape.** `.blk.open` is a *double*
  edge now, which is what the printed sheet has always used to tell the two apart,
  so the distinction survives at swatch size and through a monochrome laser rather
  than resting on two purples. The all-day ribbon, which used lilac for "all day",
  is purple; ribbons and untimed chips carry `.open` and `.off` like everything
  else; and the agenda — the same day read as a list — carries the same edges, so
  one key covers both forms instead of the list signalling open-to-all with a
  slightly different purple on its start time and explaining it nowhere.

`clockStates()` mirrors the stylesheet rather than the data, which is the whole
point of it. A reading edge carries one meaning at a time and a collision takes it,
so on the day clock a colliding event is drawn neither lilac nor purple and the key
must not claim anything is — the first version of this said "open to all Laurier
students" over a board on which the only such event was gold. The whole-run view
draws a collision as a gold cap *above* a filled bar, where the two really do show
together, and passes `capped`.

**The whole-run view had no key at all**, which is the same fault with the caption
missing rather than wrong: purple bars, lilac bars and gold-capped bars, and
nothing anywhere saying which was which. It has the same conditional key, with
filled swatches because that is what it draws.

**And the printed key was on the screen.** `.prkey` in A was styled only inside
`@media print`, which does not hide it — it merely left it unstyled, so the
identity band carried "on your boardruns at the same time as something else" in
running text with no swatches between the captions. It is `display:none` off paper
now, and on paper it names the states the sheet actually carries: printed
unconditionally it had been telling a reader whose sheet held one event that
something on it collided.

`assess()` and `audienceLine()` are untouched. This was never about who may attend.

### 2. Thirteen and fourteen are both true, and the page said only one of them

`check_drift.py` tracks fourteen pages: the thirteen the board is built from and
the ASPIRE "Laurier Crash Course" page, watched but never parsed. The sources
section said thirteen, which is true of events and not of tracking, and a reader
who had seen the fourteen had no way to reconcile them.

Changing 13 to 14 would have been the other false statement, so both are said. The
schedules keep their count and their grid; under them, **"Watched, not read"**
states that fourteen pages are checked for change, that the thirteen above are
where every event came from, and that the rest publish orientation events nothing
on this board comes from. The watched page gets a card of its own, with Laurier's
own title for it, its address, and **why it contributes nothing** — every Fall 2026
session on it has already run, and Laurier says the Winter 2027 sessions go up at
the beginning of the fall semester, which is now.

That reason is now the third field of `check_drift.py`'s `WATCH`, printed in its
report and read out of it by `build.py` with `ast.literal_eval` — nothing in
`check_drift.py` is executed, so a build never touches the network. It is read
rather than copied for the reason everything else here is: a second copy of a fact
is a fact waiting to drift, and this project has been bitten by that more than
once. `{{NWATCHED}}` and `{{NTRACKED}}` join the substitutions, and `META` carries
`nWatched`, `nTracked` and the watched list, so a variant that wants to say
something about it does not have to re-derive it.

`orientation-classic.html` is not given the block. It is `parity.py`'s yardstick and
it is left alone.

### 3. The plan reads as a list or as a calendar, and paper prints one of them

Two faults, one cause. `printHtml()` emitted the calendar grid **and** the numbered
detail list of the same events underneath it — the whole schedule twice, four
sheets where two would do — and My plan, on a page whose entire argument is that a
week is a shape, could only be read as a column of paragraphs.

**My plan has a List / Calendar toggle.** The calendar form is `byDay()` over the
same picks with the board's own scale, blocks, ribbons and chips, so a ticked event
looks the same wherever a student meets it. A day too crowded to draw falls back to
the agenda for that day alone and says why, which is what the day board does and
what the printed sheet does. The toggle sits with a sentence saying both forms hold
the same *N* events and that printing follows whichever is being read, because a
control that sits where a filter sits and leaves the count unmoved is one a student
reads twice and then stops trusting.

**Paper follows that choice, and prints one document.** Calendar prints grids;
list prints the written entries. Never both.

**The judgement calls, made rather than dodged:**

- *A grid cannot carry a web address, and paper cannot be clicked.* Dropping the
  registration links would have been dropping the only way a student actually gets
  a place. They are collected in **one appendix after the last day** — not under
  each day, which is how it would have turned back into the second document — in
  the same numbers as the boxes above, each with its venue, its registration and
  ticket addresses, any citation the day heading did not already carry, and the
  note when a pick is no longer on the board. The venue is in it too: it costs one
  line and a student needs a room more than they need a host.
- *A day that cannot be drawn is written out in full instead*, keeps the sentence
  saying why, and is then left out of the appendix — it needs nothing from it and
  would otherwise be the one day printed twice.
- *What prints is what was ticked.* If the plan holds anything, the plan is the
  document; the board is neither appended to it nor set beside it.
- *The empty case is decided rather than left.* With nothing ticked there is no
  selection to honour, so the whole eligible board prints — under **"Everything I
  may attend"**, not "My orientation schedule", with a first line reading "Nothing
  is ticked, so this is not a chosen schedule". A sheet found on a desk a week
  later must not be mistaken for one somebody put together.
- Both documents number a day the same way, so block 3 on the calendar and entry 3
  in the list are the same event.

### The gates had to learn to count

`plus_check.py` printed one PDF and looked for words in it. Every interesting
failure here is a *count*: the board leaking into a personal schedule, or both
documents coming out at once, would each have left every word it looked for in
place.

Every written entry and every line of the address list carries one `Where:` and
nothing else on the sheet does, so **`entries_in()` counts them** and the sheet must
hold exactly the number of events it claims. That one assertion catches both
failures. Beside it, the events *not* in the plan are named and checked for
individually — 86 of them — so a leak is reported as which event leaked. Four PDFs
are printed and read back now instead of one: plan and empty plan, each as a list
and as a calendar. The address appendix gained its `Where:` label partly so a gate
can count entries without knowing which document it is holding, and partly because
a bare address under a title is worse to read than a labelled one.

Negative-tested before being trusted, against four deliberately broken builds:
both documents printed at once (caught, in both forms, by the count); three events
off the board leaking into the plan (caught by the count and named by the leak
check); the calendar dropping its address list (caught); the empty board headed as
a personal schedule (caught). The one case that correctly did *not* fire is
"calendar drops its address list" measured against the list form, which has no
address list to drop.

A new test proves the toggle is a view: the plan is rendered both ways and the
titles drawn must be the same set, and that set must be every ticked event once.
Negative-tested by making `planCalHtml()` drop a day — 6 events against 5, caught.
It also captures `window.onerror` from a listener installed in the head, before the
application script runs, because an error thrown during the opening redraw is
exactly the one a probe added at the end of the body arrives too late to see.

One defect the new tests found in themselves: `page_with()` wrote every seeded copy
to one temp path, so creating the empty-plan page silently replaced the seeded one
and a full run of assertions passed against the wrong board. The file name is a
parameter now.

### The independent review, and what it changed

Given file paths and four questions, and nothing about why any of this was being
done. It reported the conditional key as "a real achievement" and swept every day
of every level and campus to check it — then found four places where it still
over-claimed and one where the page said something outright false. Nine of its
findings were acted on.

**"An ordinary event on your board" over a day with no ordinary event on it.**
Bachelor of Education, Waterloo, Monday 7 September: eleven cards on the clock,
every one of them gold, and the key still offering a purple swatch. The purple on
that page belonged to two all-day ribbons — a lavender full-bleed strip filed
under its own heading, which is not what the swatch draws. `clockStates()` takes a
third field now: an entry drawn *beside* the clock rather than on it keeps the
marked states, which really are the same colour wherever they appear, and gives up
the unmarked one. Both Bachelor of Education Mondays now show the collision key
alone, and Graduate Waterloo Sunday 6 shows "open to all Laurier students" alone.

**Gold meant two things in A-plus.** `.ag.mine`, `.rib.mine`, `.chipev.mine` and
`.clrow.mine .clopt` put a gold reading edge on a *ticked* event, on the stated
reasoning that gold carried nothing in the agenda, the ribbons and the chips. That
stopped being true earlier in this same round, when those three started wearing
the clock's own edges. The reviewer found the result: on a Friday with four drop-in
sessions, the one in the plan was gold under a key reading "runs at the same time
as something else" — about sessions this page explicitly never counts as clashing.
The reading edge is the event's state everywhere now, and a ticked event is the
corner tick it already was on the clock: a badge, not an edge.

**"Nothing published between 1pm and 7pm", over a plan.** Laurier published
fourteen things in that window; they were simply not ticked. `rules()`,
`agendaHtml()` and `printGrid()` take the phrase now, and the plan says "nothing in
your plan" on screen and "nothing in my plan" on paper. The same string is correct
on the board and was a plain falsehood in the one place this round added.

**The collision cap on the whole run was one rendered pixel.** 2px of gold on the
top edge of a 22px bar, and the entire collision signal across an eighty-bar grid.
It is 4px, and so is the swatch beside it.

**The printed calendar dropped the host and the audience for every event.** Seven
picks, seven hosts on the list sheet, none on the calendar sheet. The address list
carries both now, with the cost, because a grid can say when and cannot say who is
running the thing or who may come.

**A printed Tuesday of twenty-one numbered boxes with no names in them.** `PR_LANES`
was 4 — a guess at how many boxes fit across a page. Measured: the printed grid is
about 510pt, so five abreast is 102pt a box and six is 85pt. At five the same
Tuesday prints all twenty-one names, on a sheet that was 45% white space. The
height cap went from 430pt to 560pt with it.

**Sheets that came off the stack were anonymous.** Page three of a nine-page board
opened "6 12pm–3pm Shinerama BBQ" and ran ten more entries before naming a day.
A true running head needs a fixed element repeated per page, and Chrome's print
pipeline placed one over the content on two of three attempts, so it is not used.
The identity rides the day headings instead, which is deterministic, and **every
entry now carries its own day** in the time column — three words, and no sheet is
anonymous whatever it starts in the middle of.

**Printing an empty plan was an eight-page document or a ten-page one, decided by a
switch the empty screen did not show.** The empty panel carries the toggle now,
labelled "Print as", with a line saying what Ctrl+P would produce and that it comes
out headed as the board rather than as a schedule anyone chose.

**"Switching to Calendar takes the controls away."** It does not — every block
opens the same card, which holds the links, the calendar file and the tick that
removes it — but a reader who cannot see them is entitled to think otherwise, and
the page now says so above the first day.

**And the detail sheet's own strip named one of its three inks.** "Gold is what it
collides with" left `#330072` unexplained forty pixels from a key where the same
purple means "does not collide". It names all three.

**Held.** The reviewer's headline is that A is A-plus with the useful half removed
and should be replaced by a phone-first variant. That is a decision about which
products to keep, not a defect, and is passed on rather than acted on. So are its
findings on B's comparison arithmetic, B's collision caption surviving a pivot into
a view where "at this time" is not the axis, B's truncated host column, C's
12,000px scroll with no sticky day band, C's gate whitespace, C's URLs breaking
mid-token, A's day axis being flattened by one seven-hour event, the diagonal hatch
carrying six meanings, and the shared link that comes back as a list when `ghosts`
is on. All are real; none is one of the three things this round was asked to fix,
and each would need its own round.

One point it raised was argued and kept: on the whole run, a bar that is both open
to all levels and colliding shows lilac *and* a gold cap, so the key offering both
is not over-claiming — the run draws collisions as a cap above a filled bar, which
is why `clockStates()` takes `capped`. Making the cap visible was the fix that
mattered there.

---

## Round 8 — five defects from the audit

### 1. Laurier moved Music Bingo, and the page could not say when it had read the schedules

`check_drift.py --update` found four pages changed. Two changes reached the board:

- **Music Bingo is 5 to 7 p.m.**, not 5:30, on `locus.html` and
  `undergraduate/fall-waterloo.html`. `bachelor-of-education.html` still says 5:30, so
  Laurier now contradicts itself across its own pages. Each page's own value is
  reproduced and nothing is reconciled. The two undergraduate listings agree and fold
  into one event as they always did; the Bachelor of Education copy no longer folds with
  them, because `dupKey` includes the published time. That is the fold working — the
  distinct count went 353 to 354 — and no student sees both, because the two are on
  different levels.
- **Laurier retired the virtual orientation's Zoom registration** and published a
  YouTube recording in its place, and dropped the page-level "Register Now!" banner from
  `undergraduate/fall-virtual.html`. `test_regressions.py` asserted that Zoom fragment
  was reachable, so the suite went 47/48 — correctly. That assertion guards the parser,
  not Laurier's editorial decisions, so it now watches the Zoom registration that page
  still carries (CSEDI 101). An assertion about a link Laurier has deleted stops testing
  anything and only teaches you to ignore a red run.

**Both dates are now consequences of the build.** "read on 31 Aug 2026" and "compiled
31 Aug 2026" were string literals in nine places — `build.py`, four body templates and
four application scripts — so refreshing the snapshots without editing all nine turned a
true sentence into a false one, in the direction that matters: the page claiming to be
more current than it is. It had already happened. `check_drift.py` now writes `_read.json`
at the moment every tracked page has been downloaded in full and found to match its
snapshot, and refuses to write it while drift is outstanding, so the claim cannot outrun
the data. `build.py` reads it into `READ_ON`; where the record is missing it falls back to
the newest snapshot on disk, which is weaker but is still a fact about these files rather
than a memory of one. `COMPILED` and `TODAY` are the build date. `META.readOn` and
`META.compiled` carry both to every variant, and `{{READON}}`/`{{COMPILED}}` to every body
template, so no page states a date it was told rather than one it worked out.

### 2. "Runs at the same time as something else", drawn over events that do not overlap

The worst of the five, and the one a student would act on. `blockHtml`, the run bars and
`dayEntries` all decided the class with `it.ncol > 1`. `ncol` is a layout figure:
`placed()` pads every item to a minimum drawn height (`de = max(end, start + minMin)`, 52
minutes on the day clock and 20 on the run) so a short event is still a readable box, so
two strictly consecutive events land in different lanes and both come back with `ncol` 2.

On graduate/Waterloo/Wednesday 2 September, **all seven blocks were gold** — including the
Graduate Student Orientation evening, which is strictly sequential: reception 5:30–6:30,
dean's welcome 6:30–6:45, panel 6:45–7:30, "Are You Ready" 7:30–8:10, trivia 8:10–8:30.
The page told a graduate student to choose between consecutive parts of one evening on the
most important night of their week, while its own Clashes lens correctly showed nothing for
that day, and the agenda — which had a real overlap test — drew the same day as ten plain
rows under a key still claiming a collision.

`de` stays what it is, a layout figure. **`drawnClashes(e, within)`** now answers the
question, and it asks `collidesWith()` — this page's only overlap engine, which already
drops the drop-in desks and Laurier's duplicate listings — so the block, the bar, the
agenda row, the key above them and the detail sheet cannot disagree. It refuses to mark an
event the student cannot attend, because `clockStates()` refuses to name a collision on a
ghost and a colour no caption accounts for is the same fault seen from the other end. The
sweep is every event against every event and the run view asks it of eighty-odd bars per
render, so it is answered once per selection and keyed on the selection itself rather than
cleared by hand, so it cannot go stale.

The agenda gave up its own overlap test at the same time: it had a correct one, but a
second implementation of a rule is a rule waiting to drift, and "N others at this time" now
counts the same set the edge is drawn from.

`dayEntries`, `clockStates` and `drawnClashes` are byte-identical in `_app_a.js` and
`_app_a_plus.js`, and `parity.py`'s shared-logic gate holds them that way. The one place
they are deliberately asked a narrower question is **A-plus's plan drawn as a calendar**,
which passes `PLAN`: without it a block would be gold for colliding with something the
student never put in their plan, while the plan's list form — reading the same picks
through `planClashes()` — said nothing of the kind.

Verified on the state the audit named: seven blocks, two marked (Campus Tour and
Orientation Check-In, which genuinely run together), five plain, and the key naming
exactly "an ordinary event" and "runs at the same time as something else".

### 3. The printed run key omitted the colour that was on the sheet

`viewStates()` called `clockStates(ent)` with no `capped`, while `weekHtml` calls
`clockStates(wentries, true)`. Without `capped`, a bar that both collides and is open to
all sets `clash` and returns before it can set `open` — so a printed run sheet carried
lilac with nothing naming it, which is precisely the fault the conditional key was built
to remove, and screen and paper disagreed about the same board. It passes
`view === "week"` now.

**And the print stylesheet was dead.** `@media print .wb{background:#fff;...}` sat three
hundred lines above the base `.wb{background:var(--purple)}` at equal specificity, so every
property in it lost and the run printed in full colour with its bars absolutely positioned
at `width:auto`.

The decision, made rather than inherited: **the run prints in monochrome and stays a
grid.** Monochrome because the rest of this sheet already is — a block on the printed day
clock is white with a reading edge whose weight and style carry its state — and a sheet
that only works out of a colour printer is a sheet that does not work. A grid because
flattening the run into a column of bars throws away the only thing it is for: thirteen
days of position and duration, read at once. The rules live at the foot of the stylesheet,
after the ones they have to beat.

All-day ribbons and untimed chips came with it. They wear the clock's own reading edges on
screen and the printed key describes those edges in black, so left in colour they were the
two things on the sheet the key did not fit — and they appear on the day sheet as well as
under the run. Measured on the printed run: purple fills 5 to 0.

### 4. A printed entry that said both "Open to you" and "not on the board you were looking at"

`printEntry` and `printAddresses` pushed `audienceLine(e)` unconditionally. It falls back
to "Open to you", which means "matches the level, campus, term and streams you gave", and
77 events are stream-gated with no audience Laurier ever published — so every one of them
printed "Open to you" directly above a note saying it was not on the board. A pick reaches
paper whenever a stream it needs is not currently ticked, so this was not a corner case.
Both now do what the detail sheet has always done, `a.ok ? audienceLine(e) : a.reason`, and
the note below no longer repeats the reason.

### 5. Gold caps on the run with nothing naming them

`.wb.off` replaced only the background, so `.wb.clash`'s gold cap survived on the hatching
— while `clockStates()` returns early for `off` and never sets `clash`, so the colour had
no caption anywhere on the page. Closed at source: `drawnClashes()` returns nothing for an
event the student cannot attend. The stylesheet says the same thing where the cap is
actually drawn, because CSS and JS are separate files and the invariant is one line.

### The gate, and proving it goes red

**`clashcheck.py`** asserts two properties against the rendered page, across every day of
every board at three settings — the clock, the same day read as an agenda, and the board
with "show what you cannot attend" on:

1. nothing is drawn as colliding unless it genuinely overlaps something else. It walks the
   DOM and asks the data directly — does anything the student may attend, on this date,
   actually run across this event's hours — **without calling `collidesWith()`**, because a
   check that calls the implementation it is checking cannot fail;
2. the key names exactly the states its board draws, in both directions, for the screen key
   and the printed key separately. They are computed by different routes — the screen key
   from the entries a view lays out, the printed key from `viewStates()` before the board
   exists — and those two disagreeing is what finding 3 was.

**2,232 board states, clean.** Negative-tested one defect at a time rather than all three
at once, because the loudest fault masks the others and a gate that fails for the wrong
reason has not been tested: the layout figure put back as an overlap test, the printed key
asked without `capped`, and the collision mark allowed onto a ghost. Each is caught, and
each is named by the assertion written for it.

### Gates

`build_all.py`; `parity.py` (83 selections across 4 variants against the classic yardstick,
4,147 entries each, 294 board states in the empty-board smoke, zero console errors across
92 states); `clashcheck.py` 2,232 states and its three-part negative test; `check.py`;
`invariants.py`; `contrast.py`; `plus_check.py`; `test_regressions.py` 48/48;
`check_drift.py` clean across 14 pages.
