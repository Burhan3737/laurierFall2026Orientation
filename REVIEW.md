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
