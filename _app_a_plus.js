/* ============================================================================
   THE TIMETABLE — variant A
   Interaction model: a persistent identity band (never a gate), a day-density
   navigator, and the schedule drawn on a real clock. Whole-run week grid for
   the overview; a single wide day for reading. Overlaps are visible because
   overlapping events are drawn side by side.
   ========================================================================= */

/* ---- ELIGIBILITY CORE — copied verbatim from _app.js. Must not diverge. --- */
var GATES = ["International","Exchange","Indigenous","Off-campus (LOCUS)","Residence",
             "Mature & Transfer","Accessible Learning","Virtual"];
var NO_PROGRAM = "__none__";
var sel = null;

function gatesOf(e) {
  return (e.tg || []).filter(function (t) { return GATES.indexOf(t) >= 0; });
}

/* why an event is or isn't yours -> {ok, reason} */
function assess(e) {
  if (!sel) return { ok: true, reason: "" };
  if (e.tm !== sel.term)   return { ok: false, reason: "Different term (" + e.tm + ")" };
  if ((e.cp || []).indexOf(sel.campus) === -1)
    return { ok: false, reason: "Different campus (" + (e.cp || []).join("/") + ")" };

  var levelOk = (e.lv === sel.level) || (e.lv === "all") || e.oa;
  if (!levelOk) {
    return { ok: false, reason: e.lv === "bachelor-of-education"
      ? "Bachelor of Education students only"
      : "For " + e.lv + " students" };
  }
  var g = gatesOf(e);
  if (g.length) {
    var claimed = g.filter(function (t) { return sel.streams.indexOf(t) >= 0; });
    if (!claimed.length) {
      return { ok: false, reason: g.indexOf("Virtual") >= 0 && g.length === 1
        ? "Online — tick Virtual to show"
        : g.join(" / ") + " students only" };
    }
  }
  // A program/faculty welcome belongs to one program. Naming yours hides the rest;
  // "All programs" shows them all; NO_PROGRAM hides every one, for the many graduate
  // programs Laurier publishes no welcome for.
  if (sel.program === NO_PROGRAM && e.pg) {
    return { ok: false, reason: "Program-specific welcome" };
  }
  if (sel.program && sel.program !== NO_PROGRAM && e.pg && e.pg !== sel.program) {
    return { ok: false, reason: "For " + e.pg };
  }
  return { ok: true, reason: e.oa && e.lv !== sel.level ? "Open to all Laurier students" : "" };
}
/* ---- END CORE ----------------------------------------------------------- */

var MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];
var DOW  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var DOW3 = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var STREAM_LABEL = { "Virtual": "Online sessions (Zoom)" };
function streamLabel(t) { return STREAM_LABEL[t] || t; }
var DEAD_HOSTS = ["cms03.wlu.ca"];
function isDead(href) {
  return DEAD_HOSTS.some(function (h) { return href.indexOf("//" + h) >= 0; });
}
/* Laurier writes some descriptions as one 3,096-character paragraph. Rendered as
   a single block that is unreadable at any width, so it is broken at Laurier's own
   sentence boundaries — never re-worded, never truncated, no character added or lost.
   A full stop only ends a sentence when the next thing that is not a space starts
   one: "$1.50" and "Sept. 8" are not boundaries. */
function sentences(x) {
  var out = [], buf = "", i, ch, j, next;
  for (i = 0; i < x.length; i++) {
    ch = x.charAt(i);
    buf += ch;
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (ch === "." && /\d/.test(x.charAt(i - 1)) && /\d/.test(x.charAt(i + 1))) continue;
    j = i + 1;
    while (j < x.length && /\s/.test(x.charAt(j))) j++;
    next = x.charAt(j);
    if (j >= x.length || /[A-Z“"(]/.test(next)) {
      buf += x.slice(i + 1, j);
      i = j - 1;
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}
function paras(x) {
  if (!x || x.length < 480) return [x];
  var s = sentences(x);
  if (s.length < 4) return [x];
  var out = [], buf = "";
  s.forEach(function (t, i) {
    buf += t;
    if ((i + 1) % 3 === 0) { out.push(buf); buf = ""; }
  });
  if (buf) out.push(buf);
  return out;
}
/* TODAY is the date this page was compiled and is baked into the payload.
   Deciding what is "past" from it makes the board wrong by one more day for every
   day that passes, on a page whose whole job is the week it is opened in. NOW is
   the clock in the student's hand; TODAY stays what it is, a build date. */
var NOW = (function () {
  var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
})();
/* Laurier sometimes prefixes a title with the day it falls on. "Inner Tube Water
   Polo" and "Friday, Sept. 11 - Inner Tube Water Polo" are one event, and a key
   built on the raw title files them apart. Shared by every variant, because
   which listings are the same event is a fact, not a presentation choice. */
function stripDay(t) {
  var s = String(t || "");
  /* Any word at all in the weekday slot, not a list of the correctly spelled
     ones: Laurier publishes "Wednedday, Sept. 9 - Your First Grocery Store Tour
     in Canada", and its own typo was enough to leave the prefix on the card,
     under a heading already reading Wednesday, beside the copy of itself that
     had been stripped. A month and a day number must follow, so a title whose
     first word merely happens to sit before a month name is not eaten. */
  var m = s.match(/^[A-Za-z]{3,12},?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*\d{1,2}\s*[-–—:]\s*/i);
  /* Not every day prefix is a date. "Daily - LOCUS Orientation Hub" on one
     schedule and "LOCUS Orientation Hub" on two others are one hub, open every
     day; the label says when it runs and is not part of its name. */
  if (!m) m = s.match(/^(Daily|Every ?day|Weekdays?|All week|Ongoing)\s*[-–—:]\s*/i);
  return m ? s.slice(m[0].length) : s;
}

/* Some Laurier pages write "Wednesday, Sept. 2 | 8:30 a.m. to 3:30 p.m." into the
   time field. Wherever that string is printed beside a date the page has already
   stated, the leading restatement of the day is dropped. Only the restatement
   goes; the times are untouched, and nothing is dropped unless the day number in
   the string is the day the event is actually on. */
function stripLead(n, d) {
  var s = String(n || "");
  var m = s.match(/^(Sun|Mon|Tues?|Wed(nes)?|Thurs?|Fri|Satur?)(day)?,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*(\d{1,2})(,?\s*\d{4})?\s*[|\-–—:]?\s*/i);
  if (!m) return s;
  if (d && +m[5] !== +String(d).slice(8, 10)) return s;
  return s.slice(m[0].length) || s;
}
function dupKey(e) {
  /* Laurier retypes the same venue with different capitalisation across pages
     ("Zoom | Registration is Required" vs "...is required"), which split one event
     into two unmarked singletons. Fold case and whitespace on the free-text parts;
     the title already goes through stripDay. */
  function fold(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  return [stripDay(e.t), e.d || "", fold(e.n), fold(e.w)].join(" § ");
}
/* ---- one event, however many times Laurier published it -----------------
   Laurier puts many of these events on more than one of its schedule pages, and
   a few of them twice on the same page. Listings that agree on title, day, time
   and venue are one event, so the board shows the event once and its detail
   names every page it came from. Nothing is dropped; it is merged.

   The listings are not typed identically. One may state the audience, name the
   host, or carry a link the other leaves out, so which one gets shown matters
   (see listingRank below), and the links of all of them are joined. Every value
   on the card still comes from one of Laurier's own listings; nothing is
   combined into a sentence Laurier never wrote.

   A listing the student cannot attend must never stand in for one they can.
   Laurier publishes Lane Swim on the undergraduate schedule and again on the
   Bachelor of Education one; with "show what you cannot attend" turned on, taking
   whichever listing carried the most detail put "Bachelor of Education students
   only" against a swim an undergraduate can walk into. An attendable listing
   wins first, and only then the fuller one.

   Which listings are the same event is a fact about Laurier's pages, not a
   presentation choice, so this is one implementation shared by every variant. */
function publishedDetail(e) {
  return String(e.x || "").length + String(e.a || "").length + String(e.h || "").length +
         String(e.c || "").length + JSON.stringify(e.si || {}).length +
         (e.l || []).map(function (l) { return l.href; }).join("").length;
}
function attendable(e) { return assess(e).ok; }
/* Which of Laurier's listings of one event should be the one on the board.
   Attendable beats not attendable. Then the listing published on the schedule
   for the student's own level beats one lifted from another level's page,
   because its "Schedule" line and its citation are the ones that get read: an
   undergraduate should not be told their event is on the Bachelor of Education
   schedule when Laurier also published it on theirs. */
function listingRank(e) {
  return (attendable(e) ? 2 : 0) + (sel && e.lv === sel.level ? 1 : 0);
}
function onePerEvent(list) {
  var best = {}, order = [];
  list.forEach(function (e) {
    var k = dupKey(e);
    if (!(k in best)) { best[k] = e; order.push(k); return; }
    var mine = listingRank(e), theirs = listingRank(best[k]);
    if (mine !== theirs) { if (mine > theirs) best[k] = e; return; }
    if (publishedDetail(e) > publishedDetail(best[k])) best[k] = e;
  });
  return order.map(function (k) { return best[k]; });
}
function copiesIn(list, e) {
  var k = dupKey(e), out = [];
  (list || []).forEach(function (o) { if (dupKey(o) === k) out.push(o); });
  return out.length ? out : [e];
}
function sourcesOf(e) { return copiesIn(sourcePool(), e); }
/* Which of Laurier's thirteen schedules something came from. */
var SRCTITLE = {};
(META.sources || []).forEach(function (x) {
  var t = String(x.title || "");
  var i = t.indexOf(":");
  SRCTITLE[x.url] = i >= 0 ? t.slice(i + 1).trim() : t;
});
function sourceTitle(e) {
  return SRCTITLE[String(e.u || "").split("#")[0]] || "a Laurier schedule";
}
/* Every link Laurier attached to any listing of this event — its own, its
   section's and its page's, in that order. A link that sits on one listing and
   not the other is a link the student would lose if only one were read.

   For a single listing this is the incumbent's assembly unchanged, repeated
   hrefs and all. Laurier gives one LOCUS page two different labels on the same
   event ("LOCUS Links" and "learn more about each link by clicking here"), so
   collapsing by address there would drop a label, not a duplicate. Only across
   listings is a repeated address actually a repeat. */
function allLinksOf(e, copies) {
  var links = (e.l || []).slice();
  function add(l, from) {
    if (links.some(function (x) { return x.href === l.href; })) return;
    /* Two of Laurier's schedules each carry a "Register Now!" banner, pointing
       at two different forms. Brought onto one card they were two buttons with
       one word between them, and one of them was the wrong level's registration
       — the defect an earlier round fixed in the parser, returning by another
       door. A link carried in from another listing names the schedule it came
       from whenever its label is already taken. */
    var taken = links.some(function (x) {
      return String(x.text || "").toLowerCase() === String(l.text || "").toLowerCase();
    });
    links.push(taken && from ? { href: l.href, text: l.text + " " + from } : l);
  }
  /* Which listing a carried-in link came from, said in whichever words actually
     tell it apart from this one. Naming the schedule is enough when the two sit
     on different pages, but Laurier publishes the Niagara Falls trip twice on
     one page, a bus from each campus and a different ticket for each, and "on
     Laurier's International schedule" printed on both separates nothing. */
  function whence(o) {
    var pg = sourceTitle(o), cp;
    if (pg && pg !== sourceTitle(e)) return "(on Laurier's " + pg + ")";
    cp = (o.cp || []).filter(function (c) { return (e.cp || []).indexOf(c) < 0; });
    if (cp.length) return "(" + cp.join(" and ") + ")";
    if (o.s && o.s !== e.s) return "(" + o.s + ")";
    return pg ? "(on Laurier's " + pg + ")" : "";
  }
  (e.sl || []).concat(e.pl || []).forEach(function (l) { add(l, ""); });
  (copies || []).forEach(function (o) {
    if (o === e) return;
    var from = whence(o);
    (o.l || []).concat(o.sl || [], o.pl || []).forEach(function (l) { add(l, from); });
  });
  return links;
}
/* What to tell a student who may attend this. Laurier's own words whenever it
   states an audience, because that is the most accurate thing anyone has.
   Failing that: open to every Laurier student, or open to you — which means it
   matches the level, campus, term and streams you gave, not that everyone may
   come. Saying "open to all" of an event Laurier restricts to undergraduates
   would be the page inventing a permission. */
function audienceLine(e) {
  return e.a || (e.oa ? "Open to all Laurier students" : "Open to you");
}
/* Every rendered title goes through here. Printing e.t directly is how "Tuesday,
   Sept. 8 - Meet and Greet…" ended up sitting under a heading reading "Tuesday 8
   Sept 2026", beside its own duplicate that had been stripped. */
/* "Open most of the day" has to actually mean that. Duration was the only test,
   so a 7-11pm Headphone Disco was filed as a drop-in desk, and the Clashes lens
   never told a student it collides with We Got Game at 7pm -- dropping a real
   choice under a heading that promises it only drops non-choices, which is the
   one claim the whole lens rests on. A desk you can walk up to whenever suits
   you is open across the middle of the day; an evening commitment is not,
   however long it runs. Both tests have to pass now. Variant C applies the same
   rule, so the two cannot tell a student different things about one event. */
var LONG = 240;
var MIDDAY_IN = 720, MIDDAY_OUT = 840;   // open at noon, still open at 2 p.m.
function isDropIn(w) {
  return !!w && w.e - w.s >= LONG && w.s <= MIDDAY_IN && w.e >= MIDDAY_OUT;
}
function title(e) { return stripDay(e.t); }
function sameEvent(a, b) { return dupKey(a) === dupKey(b); }
/* The one answer to "what does this collide with", used by the detail sheet and
   by the Clashes lens alike. It lived in two places and the two drifted: the lens
   excluded drop-in desks and Laurier's duplicate listings, and the sheet did not,
   so the sheet contradicted the lens two clicks later. */
function collidesWith(e) {
  var w = e.d ? parseWhen(e.n) : null;
  if (!w || isDropIn(w)) return [];
  var seen = {}, out = [];
  EV.forEach(function (o) {
    if (o === e || o.d !== e.d || !assess(o).ok || sameEvent(o, e)) return;
    var ow = parseWhen(o.n);
    if (!ow || isDropIn(ow)) return;
    if (!(ow.s < w.e && w.s < ow.e)) return;
    var k = dupKey(o);
    if (seen[k]) return;
    seen[k] = true;
    out.push(o);
  });
  return out;
}
/* Whether a drawn event should be marked as colliding, and with what.

   The class used to be decided by `it.ncol > 1`, which is not an overlap test at
   all. placed() pads every item to a minimum drawn height -- de = max(end, start
   + minMin), 52 minutes on the day clock and 20 on the run -- so that a short
   event is still a readable box. Two strictly consecutive events therefore land
   in different lanes, both come back with ncol 2, and both were painted gold.
   The Graduate Student Orientation evening -- welcome reception, dean's welcome,
   panel, "Are You Ready", trivia, end to end with not a minute of overlap -- was
   drawn as five mutual conflicts, telling a graduate student to choose between
   consecutive parts of one evening on the most important night of their week,
   while the Clashes lens two clicks away correctly showed nothing for that day.
   The page contradicted itself, and the agenda -- which had a real overlap test
   -- drew the same day as ten plain rows under a key still claiming a collision.

   de stays what it is, a layout figure. Whether two events overlap is asked of
   collidesWith(), which is this page's only overlap engine and already drops the
   drop-in desks and Laurier's duplicate listings, so the block, the bar, the
   agenda row, the key above them and the detail sheet cannot disagree.

   An event the student cannot attend is never marked. clockStates() deliberately
   refuses to name a collision on a ghost, and a colour on the screen that no
   caption accounts for is the same fault seen from the other end.

   `within` narrows the answer to a set of events by dupKey: the plan asks what
   in the plan collides with what else in the plan, which is the question its own
   bar and its list form already answer.

   The sweep is every pick against every event, and the run view asks it of
   eighty-odd bars per render, so it is answered once per selection and thrown
   away when the selection changes -- keyed on the selection itself rather than
   cleared by hand, so it cannot go stale. */
var CLASHBY = null, CLASHHIT = {};
function drawnClashes(e, within) {
  if (!assess(e).ok) return [];
  var k = sourcePoolKey();
  if (CLASHBY !== k) { CLASHBY = k; CLASHHIT = {}; }
  var hit = CLASHHIT[e.__i];
  if (!hit) hit = CLASHHIT[e.__i] = collidesWith(e);
  return within ? hit.filter(function (o) { return within[dupKey(o)]; }) : hit;
}
function drawsClash(e, within) { return drawnClashes(e, within).length > 0; }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function $(id) { return document.getElementById(id); }

/* =========================================================================
   A-PLUS — what a student can DO with the timetable
   Everything from here to the end of this section is added on top of variant A.
   The board itself is untouched: same eligibility, same clock, same reading.
   What is new is doing rather than reading — a plan that survives closing the
   page, a calendar file, a way to find the room, a search, a registration
   checklist, and a schedule you can print and carry.

   None of it changes which events exist. Picking, searching, exporting and
   printing are views of the set assess() already decided on.
   ====================================================================== */

/* One test for "is this a registration link", shared by the detail sheet, the
   registration list, the calendar file and the printed schedule. It began as a
   local inside openSheet; four features asking the same question is exactly how
   two answers to one rule get written. */
var REGRE = /regist|rsvp|sign ?up|ticket|book now|purchase/i;

/* One link assembly, so the sheet, the .ics, the printout and the registration
   list read the same fields in the same order. It spans every listing Laurier
   published of this event: a registration link that sits on the Brantford copy
   and not the Waterloo one is still this event's registration link. */
function linksOf(e) {
  return allLinksOf(e, sourcesOf(e));
}

/* Laurier attaches three kinds of link to an event. Its own links, and the links
   in the accordion section it sits under, belong to *this* event. The page links
   are the banner at the top of the schedule — one "Register Now!" covering the
   whole orientation, copied onto all 189 events published on that page. Counting
   those as 189 separate things to register for would be a lie, so they are kept
   apart: the event's own registrations are a checklist, the orientation-wide one
   is stated once, at the top. */
function regLinksOf(e) {
  var seen = {}, out = [];
  sourcesOf(e).forEach(function (o) {
    (o.l || []).concat(o.sl || []).forEach(function (l) {
      if (!REGRE.test(l.text || "") || isDead(l.href) || seen[l.href]) return;
      seen[l.href] = 1; out.push({ href: l.href, text: String(l.text || ""), from: o });
    });
  });
  /* Laurier publishes the Niagara Falls trip twice, one bus from each departure
     campus, identical in name, day, time and venue and pointing at two different
     Eventbrite events. Two buttons both reading "Get Your Ticket for Niagara
     Falls", one of which puts a Brantford student on a coach leaving Waterloo,
     is not a choice anybody can make. Where one label covers two addresses, each
     says which of Laurier's listings it belongs to — named by whichever of
     campus, schedule or section is the thing that actually differs between them,
     since naming the page separates nothing when both were printed on it. */
  var n = {};
  out.forEach(function (l) { var k = l.text.toLowerCase(); n[k] = (n[k] || 0) + 1; });
  function apart(l, of) {
    var mine = of(l.from);
    return mine && out.some(function (x) {
      return x !== l && x.text.toLowerCase() === l.text.toLowerCase() && of(x.from) !== mine;
    }) ? mine : "";
  }
  return out.map(function (l) {
    if (n[l.text.toLowerCase()] < 2) return { href: l.href, text: l.text };
    var q = apart(l, function (o) { return (o.cp || []).join(" and "); }) ||
            apart(l, function (o) { return sourceTitle(o); }) ||
            apart(l, function (o) { return o.s || ""; });
    return { href: l.href, text: q ? l.text + " (" + q + ")" : l.text };
  });
}
/* The banner at the top of a schedule belongs to that schedule and to the
   listing read from it — not to every listing of the same event. Gathering it
   across all of them gave every event both schedules' banners, so the printed
   checklist labelled two different registration forms with the same pair of
   page names and disambiguated nothing. */
function pageRegLinksOf(e) {
  var seen = {}, out = [];
  (e.pl || []).forEach(function (l) {
    if (!REGRE.test(l.text || "") || isDead(l.href) || seen[l.href]) return;
    seen[l.href] = 1; out.push(l);
  });
  return out;
}
function needsReg(e) { return regLinksOf(e).length > 0; }

var LEVELWORD = { undergraduate: "Undergraduate", graduate: "Graduate",
                  "bachelor-of-education": "Bachelor of Education" };
/* The orientation-wide registrations reachable from a set of events, one entry
   per link, each naming the schedules it was printed on and how many events
   carry it. Sorted so the schedule matching the student's own level leads. */
function pageRegGroups(list) {
  var byHref = {}, out = [];
  list.forEach(function (e) {
    var page = sourceTitle(e);
    pageRegLinksOf(e).forEach(function (l) {
      var g = byHref[l.href];
      if (!g) {
        g = byHref[l.href] = { href: l.href, text: l.text, pages: [], n: 0 };
        out.push(g);
      }
      g.n++;
      if (g.pages.indexOf(page) < 0) g.pages.push(page);
    });
  });
  var word = LEVELWORD[sel.level] || "";
  out.forEach(function (g) {
    g.pages.sort();
    g.mine = word ? g.pages.some(function (t) { return t.indexOf(word) >= 0; }) : false;
  });
  return out.sort(function (a, b) { return (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.n - a.n; });
}

/* ---- where on earth is LH1001? -----------------------------------------
   Laurier writes a venue as pipe-separated parts, most specific first:
   "LH1001 | Lazaridis Hall", "The Turret | 3rd Floor, Fred Nichols Campus
   Centre (FNCC)", "Harmony Square | 89 Dalhousie St.". An incoming
   international student has no idea where any of those is — which is most of the
   reason this page exists — so the venue is linked to a map.

   Two rules, and no third:
     * where Laurier gives a street address, that address is the query, verbatim,
       with the campus city appended only if the address does not name one;
     * otherwise the building is searched together with the university and campus.
   No coordinate is invented and no address is guessed at. A venue that names no
   findable place — "TBD", "See building list in the details", "Your Residence
   Building", a Zoom link, a Discord server — gets no link, because a map cannot
   answer it and a link that lands nowhere is worse than none.
------------------------------------------------------------------------- */
var CITY = { Waterloo: "Waterloo, Ontario", Brantford: "Brantford, Ontario",
             Milton: "Milton, Ontario" };
/* a house number, then words, then a street type: "89 Dalhousie St.",
   "192 King Street North", "425 Bingemans Centre Dr., Kitchener, ON". "Level 1
   Lounge" and "Parking Lot 20" carry a number and no street type, so they are
   correctly not read as addresses. */
var STREETRE = /\b\d+[A-Za-z]?\s+[A-Za-z][^|;()]*?\b(?:st|ave|rd|dr|blvd|cres|ln|ct|pl|street|avenue|road|drive|boulevard|crescent|lane|court|place|terrace|way|square|circle|trail)\b\.?/i;
var NOPLACERE = /^\s*(?:tbd|tba|trapped)\s*$|\bzoom\b|discord|ticketing site|will communicate|^\s*your residence building\s*$|^\s*see building list/i;
/* "3rd Floor, Fred Nichols Campus Centre" — the floor is not the building. */
var FLOORRE = /^(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|ground|lower|upper)\s+floor(?:\s+of(?:\s+the)?)?[,\s]+/i;
/* a part saying where you stand relative to a building, not which building */
var POSRE = /^(?:above|below|outside|inside|in\s+front\s+of|across\s+from|behind|beside|next\s+to|space\s+(?:below|under|beneath))\b/i;
/* a part saying where you set off from — the place named after it is real */
var GORE = /^(?:the\s+starting\s+point\s+is|tours?\s+(?:are|will)\s+depart(?:ing)?\s+from(?:\s+the)?|departing\s+from|meet\s+at(?:\s+the)?|meet\s+in)\s+/i;
var CAMPUSRE = /^(?:waterloo|brantford|milton)\s+campus$/i;
var NOTERE = /^(?:(?:team\s+)?registration\s+is\s+required|email\s+to\s+be\s+sent.*)$/i;
var CITYRE = /\b(waterloo|brantford|milton|kitchener|cambridge|guelph|toronto|hamilton|ontario|on)\b/i;

/* A map query names a place, so the campus in it has to be the campus the event
   is *held* on. Preferring the campus the reader picked sent a Milton student to
   Milton for the SEEDs afternoon on Albert Street in Waterloo — 50km wrong, and
   wrong on paper too, where nobody can click through and notice. Laurier scopes
   that day to Milton, Virtual and Waterloo students alike, but says where it is
   in the venue and in the section it publishes it under ("Waterloo Campus SEEDs
   Orientation"). Those are asked first, and an event scoped to one campus is on
   it; only when nothing says where it is does the reader's own campus stand in,
   as the likeliest of the campuses Laurier invited. */
var HELDRE = /\b(Waterloo|Brantford|Milton|Kitchener)\b/i;
var HELDNAME = { waterloo: "Waterloo", brantford: "Brantford",
                 milton: "Milton", kitchener: "Waterloo" };
function campusOf(e) {
  var cp = e.cp || [], u = String(e.u || ""), h = u.indexOf("#");
  var m = HELDRE.exec(e.w || "") || HELDRE.exec(e.s || "") ||
          (h >= 0 ? HELDRE.exec(u.slice(h + 1)) : null);
  if (m) return HELDNAME[m[1].toLowerCase()];
  if (cp.length === 1) return cp[0];
  if (sel && cp.indexOf(sel.campus) >= 0) return sel.campus;
  return cp[0] || "Waterloo";
}
/* Pull a street address out of one part, trimming the bracket it may sit in. */
function addressIn(part) {
  var m = STREETRE.exec(part);
  if (!m) return null;
  var rest = part.slice(m.index);
  if (part.lastIndexOf("(", m.index) >= 0) {
    var close = rest.indexOf(")");
    if (close >= 0) rest = rest.slice(0, close);
  }
  rest = rest.replace(/[\s,;]+$/, "");
  return rest || null;
}
/* {q, label, tail} for a map search, or null when the data names no findable
   place. `tail` is what a printed page needs beside the venue — the words the
   venue string does not already carry — since paper cannot be clicked. */
function mapFor(e) {
  var w = e.w || "";
  if (e.vr || !w || NOPLACERE.test(w)) return null;
  var parts = w.split("|").map(function (p) { return p.trim(); })
               .filter(function (p) { return p && !CAMPUSRE.test(p) && !NOTERE.test(p); });
  var camp = campusOf(e), i, p, addr, skipped = false;
  for (i = parts.length - 1; i >= 0; i--) {
    p = parts[i];
    addr = addressIn(p);
    if (addr) {
      var known = CITYRE.test(addr.slice(addr.search(/\d/)));
      return { q: known ? addr : addr + ", " + (CITY[camp] || "Ontario"),
               label: addr, tail: known ? "" : (CITY[camp] || "Ontario") };
    }
    if (POSRE.test(p)) { skipped = true; continue; }  // "Above the Dining Hall"
    p = p.replace(GORE, "").replace(FLOORRE, "").trim();
    if (!p) continue;
    /* Milton publishes one venue as three room codes in a single sentence.
       Searching that finds nothing, so the honest answer is the campus. */
    var uni = "Wilfrid Laurier University, " + camp + " campus";
    if (p.length > 64 || p.indexOf(";") >= 0)
      return { q: "Wilfrid Laurier University " + camp + " campus", label: camp + " campus",
               tail: uni };
    return { q: p + ", Wilfrid Laurier University, " + (CITY[camp] || "Ontario"),
             label: p, tail: uni };
  }
  /* Milton publishes one venue as "Outside the Main Entrance" and nothing more.
     Every part said where to stand, none said where to stand outside of — the
     campus is then the most a map can honestly be asked for. */
  if (skipped)
    return { q: "Wilfrid Laurier University " + camp + " campus",
             label: camp + " campus",
             tail: "Wilfrid Laurier University, " + camp + " campus" };
  return null;
}
function mapUrl(m) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(m.q);
}
function mapLink(e) {
  var m = mapFor(e);
  if (!m) return "";
  var lab = "Find " + m.label + " on a map";
  return ' <a class="maplk" href="' + esc(mapUrl(m)) + '" target="_blank" rel="noopener" title="' +
    esc(lab) + '" aria-label="' + esc(lab) + '">map ↗</a>';
}

/* ---- the plan a student keeps ------------------------------------------
   Stored against dupKey, not against a row number. Laurier publishes some events
   on two schedule pages at once; ticking one copy and leaving its twin unticked
   would have the board contradict itself two lines apart, and would put one
   session in the calendar file twice. dupKey is this page's single answer to
   "are these the same event", so the plan asks it rather than inventing a second.
------------------------------------------------------------------------- */
var LSPLAN = "wlu-orientation.plan.v1";
var LSREG  = "wlu-orientation.registered.v1";
var PLAN = {};        // dupKey -> 1, the events ticked
var REGDONE = {};     // dupKey -> 1, the registrations already done
/* Opened from a memory stick with storage switched off, every one of these is a
   no-op and the page still works — it just forgets. Nothing else depends on it. */
function lsRead(key) {
  var out = {};
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return out;
    JSON.parse(raw).forEach(function (k) { out[k] = 1; });
  } catch (x) { return {}; }
  return out;
}
function lsWrite(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(Object.keys(obj))); } catch (x) {}
}
function isPicked(e) { return !!PLAN[dupKey(e)]; }
function togglePick(k) {
  if (PLAN[k]) delete PLAN[k]; else PLAN[k] = 1;
  lsWrite(LSPLAN, PLAN);
}
function isDone(e) { return !!REGDONE[dupKey(e)]; }
function toggleDone(k) {
  if (REGDONE[k]) delete REGDONE[k]; else REGDONE[k] = 1;
  lsWrite(LSREG, REGDONE);
}
function sortRun(list) {
  return list.slice().sort(function (a, b) {
    var ad = a.d || "9999-99-99", bd = b.d || "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    var aw = parseWhen(a.n), bw = parseWhen(b.n);
    if (aw && bw && aw.s !== bw.s) return aw.s - bw.s;
    if (aw && !bw) return -1;
    if (!aw && bw) return 1;
    return title(a) < title(b) ? -1 : 1;
  });
}
/* One representative per ticked event, in the order the day runs. A key left
   over from a schedule Laurier has since changed matches nothing and simply
   disappears, rather than being reported as a phantom event.

   Which copy represents the event matters. Laurier publishes one session on
   several schedule pages — Lane Swim appears on the undergraduate page and again
   on the Bachelor of Education page — and only one of those copies carries the
   level the student is. Taking whichever came first put "not on your current
   board — Bachelor of Education students only" against an event the student
   could walk into. An eligible copy wins wherever one exists. */
function planEvents() {
  return sortRun(onePerEvent(EV.filter(function (e) { return PLAN[dupKey(e)]; })));
}
/* What in the plan collides with what else in the plan. collidesWith() is this
   page's only overlap engine — it already drops the drop-in desks and Laurier's
   duplicate listings — so this asks it rather than writing the rule again. */
function planClashes() {
  var picks = planEvents(), inPlan = {}, out = [];
  picks.forEach(function (e) { inPlan[dupKey(e)] = 1; });
  picks.forEach(function (e) {
    var hit = collidesWith(e).filter(function (o) { return inPlan[dupKey(o)]; });
    if (hit.length) out.push({ ev: e, hit: hit });
  });
  return out;
}
/* The plan view and the printed schedule both ask this, on the same redraw, and
   with a large plan it is the most expensive question on the page: every pick
   swept against every event. Answered once per redraw and thrown away at the top
   of the next one, so it can never be stale — redraw() is already the single
   funnel everything that changes the screen goes through. */
var CLASHCACHE = null;
/* A desk that is open across the middle of the day is deliberately not counted
   as a clash — collidesWith() drops it, the day view files it under "open most of
   the day", and the Clashes lens leaves it out. That is right for browsing. In a
   plan it is a silence a student can be caught by, because they have already
   committed to both, so the plan names the events the rule is skipping rather
   than quietly saying "nothing overlapping". The rule itself is untouched: this
   asks isDropIn(), it does not re-decide anything. */
function dropInPicks(list) {
  return list.filter(function (e) {
    var w = e.d ? parseWhen(e.n) : null;
    return !!w && isDropIn(w);
  });
}
function clashMap() {
  if (CLASHCACHE) return CLASHCACHE;
  CLASHCACHE = {};
  planClashes().forEach(function (c) { CLASHCACHE[dupKey(c.ev)] = c.hit; });
  return CLASHCACHE;
}

/* ---- calendar export ----------------------------------------------------
   An event Laurier gives a day and a readable time becomes a timed entry in
   America/Toronto. An event it gives a day but no usable time becomes an all-day
   entry that says so in its own description, because a student told "Sept. 8"
   should still find Sept. 8 in their calendar. An event with no date at all
   cannot become an entry of any kind; those are counted and named on screen
   before the file is downloaded, rather than dropped where nobody would notice.
------------------------------------------------------------------------- */
var TBDRE = /^\s*(?:tbd|tba)\s*$/i;
var CRLF = String.fromCharCode(13) + String.fromCharCode(10);
var VTZ = ["BEGIN:VTIMEZONE", "TZID:America/Toronto",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT",
  "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST",
  "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
  "END:VTIMEZONE"];

function pad2(n) { return (n < 10 ? "0" : "") + n; }
/* Date arithmetic done in UTC so only the calendar day is ever touched; the
   clock is then written as a local wall time under the TZID declared above,
   which is what an orientation session actually is. */
function icsLocal(iso, mins) {
  var extra = Math.floor(mins / 1440);
  mins -= extra * 1440;
  var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + extra));
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" +
         pad2(Math.floor(mins / 60)) + pad2(mins % 60) + "00";
}
function icsDay(iso, plus) {
  var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + (plus || 0)));
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate());
}
function icsNow() {
  var d = new Date();
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" +
         pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
}
var BSL = String.fromCharCode(92);
function icsEsc(s) {
  return String(s == null ? "" : s)
    .split(BSL).join(BSL + BSL)
    .replace(/;/g, BSL + ";").replace(/,/g, BSL + ",")
    .replace(/\r?\n/g, BSL + "n");
}
/* RFC 5545 folds at 75 octets, and an em dash is three of them. Counted in
   bytes rather than characters, so a UTF-8 sequence is never cut in half. */
function icsFold(line) {
  var out = "", run = 0, i, ch, w;
  for (i = 0; i < line.length; i++) {
    ch = line.charAt(i);
    w = ch.charCodeAt(0) < 128 ? 1 : ch.charCodeAt(0) < 2048 ? 2 : 3;
    if (run + w > 72) { out += CRLF + " "; run = 1; }
    out += ch; run += w;
  }
  return out;
}
function hash32(s) {
  var h = 5381, i;
  for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function icsBody(e) {
  var bits = [];
  if (e.pt) bits.push("Part of " + e.pt);
  if (e.h) bits.push("Host: " + e.h);
  if (e.a) bits.push("Audience: " + e.a);
  if (e.c) bits.push("Cost: " + e.c);
  if (!parseWhen(e.n)) {
    bits.push("Laurier publishes no usable time for this event" +
      (e.n ? ', only "' + e.n + '". Entered as all-day.' : ". Entered as all-day."));
  } else if (e.n) {
    bits.push("Published time: " + stripLead(e.n, e.d));
  }
  var m = mapFor(e);
  if (m) bits.push("Map: " + mapUrl(m));
  regLinksOf(e).forEach(function (l) { bits.push("Register (" + l.text + "): " + l.href); });
  pageRegLinksOf(e).forEach(function (l) {
    bits.push("Orientation-wide registration, on Laurier's " + sourceTitle(e) +
              " (" + l.text + "): " + l.href);
  });
  if (e.x) bits.push("", e.x);
  bits.push("", "Cited from " + e.u,
            "Laurier Orientation Event Finder, compiled " + TODAY +
            ". Laurier updates these schedules continuously — reconfirm before travelling.");
  return bits.join(String.fromCharCode(10));
}
function icsEvent(e) {
  if (!e.d) return null;
  var w = parseWhen(e.n), lines = ["BEGIN:VEVENT"];
  lines.push("UID:wlu-orientation-" + hash32(dupKey(e)) + "@laurier-orientation-finder");
  lines.push("DTSTAMP:" + icsNow());
  if (w) {
    lines.push("DTSTART;TZID=America/Toronto:" + icsLocal(e.d, w.s));
    lines.push("DTEND;TZID=America/Toronto:" + icsLocal(e.d, w.e));
  } else {
    lines.push("DTSTART;VALUE=DATE:" + icsDay(e.d, 0));
    lines.push("DTEND;VALUE=DATE:" + icsDay(e.d, 1));
    lines.push("X-MICROSOFT-CDO-ALLDAYEVENT:TRUE");
  }
  lines.push("SUMMARY:" + icsEsc(title(e)));
  /* "TBD" alone in a calendar app's location field tells a student nothing.
     Laurier's word is kept, and what it means is written beside it. */
  lines.push("LOCATION:" + icsEsc(
    !e.w ? (e.vr ? "Online" : "Venue not published by Laurier")
         : TBDRE.test(e.w) ? e.w + " — venue not published by Laurier"
         : e.w));
  lines.push("DESCRIPTION:" + icsEsc(icsBody(e)));
  lines.push("URL:" + icsEsc(e.u));
  lines.push("END:VEVENT");
  return lines;
}
function icsText(list, name) {
  var lines = ["BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Wilfrid Laurier University//Orientation Event Finder//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEsc(name), "X-WR-TIMEZONE:America/Toronto"].concat(VTZ);
  var dropped = 0;
  list.forEach(function (e) {
    var v = icsEvent(e);
    if (v) { lines = lines.concat(v); } else { dropped++; }
  });
  lines.push("END:VCALENDAR");
  return { text: lines.map(icsFold).join(CRLF) + CRLF, dropped: dropped };
}
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 46);
}
function download(name, text, mime) {
  var b = new Blob([text], { type: mime });
  var u = URL.createObjectURL(b);
  var a = document.createElement("a");
  a.href = u; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
}
function icsDownload(list, name, file) {
  download(file, icsText(list, name).text, "text/calendar;charset=utf-8");
}
/* What the student is told before they click, so the file never quietly holds
   less than the plan does. */
function icsTally(list) {
  var t = { timed: 0, allday: 0, none: 0 };
  list.forEach(function (e) {
    if (!e.d) t.none++; else if (parseWhen(e.n)) t.timed++; else t.allday++;
  });
  return t;
}

/* ---- search -------------------------------------------------------------
   Title, venue, host, the panel an event sits under, and the description; every
   word of the query has to appear somewhere among them. The description is in
   there because the words a frightened student actually types — "halal",
   "accessible", "grocery" — are almost never in a title. Laurier writes
   "Accessible Learning" into seventeen descriptions and none of their headings.

   This narrows the board and only the board. What a student is allowed to attend
   is decided upstream by assess() and is untouched by anything typed here.
------------------------------------------------------------------------- */
var q = "";
var QFOCUS = null;      // caret to restore after the redraw a keystroke causes
/* Lower-cased once per event rather than once per keystroke: some descriptions
   run to 3,000 characters and there are 508 of them. Two haystacks, one
   tokeniser — the second is only there so the page can say how many of its
   results were found in Laurier's prose rather than in a heading, which is the
   difference between a useful search and a surprising one. */
function hayMain(e) {
  if (e.__hm === undefined) {
    e.__hm = (title(e) + " " + (e.w || "") + " " + (e.h || "") + " " + (e.pt || "")).toLowerCase();
  }
  return e.__hm;
}
function hayAll(e) {
  if (e.__ha === undefined) e.__ha = hayMain(e) + " " + String(e.x || "").toLowerCase();
  return e.__ha;
}
function qWords() {
  return q.toLowerCase().split(/\s+/).filter(function (w) { return !!w; });
}
function hitsIn(h) {
  return qWords().every(function (w) { return h.indexOf(w) >= 0; });
}
function matchQ(e) { return !q || hitsIn(hayAll(e)); }
function descOnly(e) { return !!q && hitsIn(hayAll(e)) && !hitsIn(hayMain(e)); }
function eligibleSet() {
  return onePerEvent(EV.filter(function (e) { return assess(e).ok; }));
}

/* ---- state -------------------------------------------------------------- */
var view = "day";       // "day" | "week" | "clash"
var day  = null;        // ISO date when view === "day"
var MORE = null;        // null until the refinements row is folded or unfolded by hand
var ghosts = false;     // draw events this student may not attend
var picked = null;      // index of the event open in the sheet
var asList = false;     // read the day as an agenda instead of a clock
/* How the plan is read, and therefore how it prints. A view, never a filter:
   both forms hold every ticked event, and neither adds one. */
var planCal = false;    // read the plan on the clock instead of as a list

/* Past five concurrent events a day column gets tight, so the blocks tighten:
   smaller type, venue dropped. The clock is not given up — abandoning it on the
   busiest day surrenders the one thing this view is for — but the list is offered
   beside it, and "show what you cannot attend" (which can reach ninety-two at
   once, or 30px of confetti) turns the list on for you. */
var MAX_LANES = 5;

/* ---- clock parsing ------------------------------------------------------
   Laurier writes times as prose: "5 to 7 p.m.", "9 - 10:30 a.m.",
   "Noon to 2 p.m. (or until supplies last)", "Sept. 8 from 10 a.m. to 4 p.m.".
   Anything that cannot be read confidently is left off the clock and listed
   above the grid instead — never guessed at.
------------------------------------------------------------------------- */
function parseWhen(str) {
  if (!str) return null;
  var t = String(str).toLowerCase();
  if (t.indexOf("tbd") >= 0 || t.indexOf("tba") >= 0) return null;
  t = t.replace(/(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)\.?\s*\d{1,2}/g, " ");
  t = t.replace(/\b(noon|midday)\b/g, "12:00pm").replace(/\bmidnight\b/g, "12:00am");
  var re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/g, m, hits = [];
  while ((m = re.exec(t)) !== null) {
    var h = +m[1];
    if (h < 1 || h > 12) continue;
    hits.push({ h: h, mm: m[2] ? +m[2] : 0, ap: m[3] ? m[3].charAt(0) : null });
    if (hits.length === 2) break;
  }
  if (!hits.length) return null;
  var a = hits[0], b = hits[1] || null;
  var aHadAp = !!a.ap;
  if (!a.ap && b && b.ap) a.ap = b.ap;
  if (b && !b.ap && a.ap)  b.ap = a.ap;
  if (!a.ap) a.ap = (a.h >= 7 && a.h <= 11) ? "a" : "p";
  if (b && !b.ap) b.ap = (b.h >= 7 && b.h <= 11) ? "a" : "p";
  function mins(x) {
    var h = x.h % 12;
    return (x.ap === "p" ? h + 12 : h) * 60 + x.mm;
  }
  var s = mins(a), e = b ? mins(b) : null;
  if (e !== null && e <= s) {
    /* "11 to 1 p.m." — the start borrowed the wrong half of the day */
    if (!aHadAp) { var s2 = s - 720; if (s2 >= 0 && s2 < e) s = s2; }
    if (e <= s) e = null;
  }
  if (e === null) e = s + 60;
  return { s: s, e: e };
}
/* Midnight is 1440, and Math.floor(1440 / 60) is 24: it is >= 12, so the old
   arithmetic said "pm", and 24 % 12 === 0 was forced to 12, so it said "12".
   The week axis therefore ended "...10pm, 11pm, 12pm" -- noon's own label, on
   the flagship view, at the one hour it is least excusable to get wrong. The
   hour has to come back inside the day before anything is asked of it, and the
   axis and the event times both need that, so they share it rather than each
   keeping a copy to drift apart. */
function hourParts(m) {
  var h24 = Math.floor(m / 60) % 24, mm = m % 60;
  var hh = h24 % 12; if (hh === 0) hh = 12;
  return { h24: h24, mm: mm, hh: hh, ap: h24 >= 12 ? "pm" : "am" };
}
function hourLabel(m) {
  var p = hourParts(m);
  if (p.mm === 0 && p.h24 === 12) return "noon";
  if (p.mm === 0 && p.h24 === 0) return "midnight";
  return p.hh + p.ap;
}
function clock(m) {
  var p = hourParts(m);
  if (p.mm === 0 && p.h24 === 0) return "midnight";
  return p.hh + (p.mm ? ":" + (p.mm < 10 ? "0" : "") + p.mm : "") + p.ap;
}

/* ---- selection ---------------------------------------------------------- */
function pool(s) {
  return EV.filter(function (e) {
    return e.tm === s.term && (e.cp || []).indexOf(s.campus) >= 0 &&
           ((e.lv === s.level) || (e.lv === "all") || e.oa);
  });
}
function countFor(level, campus, term) {
  return pool({ level: level, campus: campus, term: term }).length;
}
function liveStreams(s) {
  var live = {};
  pool(s).forEach(function (e) { gatesOf(e).forEach(function (t) { live[t] = (live[t] || 0) + 1; }); });
  return live;
}
function livePrograms(s) {
  var names = [];
  pool(s).forEach(function (e) { if (e.pg && names.indexOf(e.pg) === -1) names.push(e.pg); });
  return names.sort();
}
/* The number in the band and the number of entries on the board have to be the
   same number. Counting listings while the board drew events had the band say 91
   over a day rail adding up to 89. */
function countExact(pick) {
  var prev = sel; sel = pick;
  var n = onePerEvent(EV.filter(function (e) { return assess(e).ok; })).length;
  sel = prev; return n;
}

/* Keep the selection legal: move off a campus or term Laurier publishes
   nothing for, and drop streams and a program this combination does not have. */
function settle() {
  if (!countFor(sel.level, sel.campus, sel.term)) {
    var c = META.campuses.filter(function (x) { return countFor(sel.level, x, sel.term); });
    if (c.length) { sel.campus = c[0]; }
    else {
      var found = false;
      for (var i = 0; i < META.campuses.length && !found; i++) {
        for (var j = 0; j < META.terms.length; j++) {
          if (countFor(sel.level, META.campuses[i], META.terms[j])) {
            sel.campus = META.campuses[i]; sel.term = META.terms[j]; found = true; break;
          }
        }
      }
    }
  }
  var live = liveStreams(sel);
  sel.streams = sel.streams.filter(function (t) { return live[t]; });
  var progs = livePrograms(sel);
  if (sel.program && sel.program !== NO_PROGRAM && progs.indexOf(sel.program) === -1) sel.program = "";
  if (!progs.length) sel.program = "";
}

/* ---- identity band ------------------------------------------------------ */
function seg(name, values, labels, current, disabledFn) {
  return '<div class="seg" role="group" aria-label="' + esc(name) + '">' + values.map(function (v) {
    var off = disabledFn ? disabledFn(v) : false;
    return '<button class="segb' + (v === current ? " on" : "") + (off ? " off" : "") +
      '" data-k="' + name + '" data-v="' + esc(v) + '"' + (off ? " disabled" : "") +
      (off ? ' title="Laurier publishes no schedule for this combination"' : "") + ">" +
      esc((labels || {})[v] || v) + "</button>";
  }).join("") + "</div>";
}

function drawIdbar() {
  var live = liveStreams(sel), progs = livePrograms(sel);
  var n = countExact(sel);
  var h = '<div class="idin">';
  h += '<div class="idrow">';
  h += '<div class="idq"><span class="idlab">I am a</span>' +
        seg("level", META.levels, META.levelLabels, sel.level, null) + "</div>";
  h += '<div class="idq"><span class="idlab">student at</span>' +
        seg("campus", META.campuses, null, sel.campus, function (v) { return !countFor(sel.level, v, sel.term); }) + "</div>";
  h += '<div class="idq"><span class="idlab">starting</span>' +
        seg("term", META.terms, null, sel.term, function (v) { return !countFor(sel.level, sel.campus, v); }) + "</div>";
  h += "</div>";

  var extras = "";
  if (progs.length) {
    extras += '<div class="idq"><span class="idlab"><label for="prog">My program</label></span><select id="prog" class="idsel">' +
      '<option value="">Every program’s welcome</option>' +
      '<option value="' + NO_PROGRAM + '"' + (sel.program === NO_PROGRAM ? " selected" : "") +
        '>Not listed — hide them all</option>' +
      progs.map(function (p) {
        return '<option value="' + esc(p) + '"' + (p === sel.program ? " selected" : "") + ">" + esc(p) + "</option>";
      }).join("") + "</select></div>";
  }
  var shown = META.streams.filter(function (t) { return live[t]; });
  if (shown.length) {
    extras += '<div class="idq idq-wide"><span class="idlab">Also me ' +
      '<span class="idhint">\u2014 what ticking or unticking changes</span></span><div class="ticks">' +
      shown.map(function (t) {
        var on = sel.streams.indexOf(t) >= 0;
        var alt = on ? sel.streams.filter(function (x) { return x !== t; }) : sel.streams.concat([t]);
        var d = countExact({ level: sel.level, campus: sel.campus, term: sel.term,
                             streams: alt, program: sel.program }) - n;
        return '<button class="tick' + (on ? " on" : "") + '" data-k="stream" data-v="' + esc(t) +
               '" aria-pressed="' + on + '" title="' +
               (on ? "unticking removes " + (-d) : "ticking adds " + d) + ' events">' +
               esc(streamLabel(t)) + '<span class="tickn">' + (d > 0 ? "+" + d : String(d)) +
               "</span></button>";
      }).join("") + "</div></div>";
  }
  /* On a phone the program select and the stream ticks were 180px of controls
     between the question and the answer, and a student scrolled a screen and a
     half before seeing a single event. They are refinements, not the question,
     so below 900px they start folded behind a line that says what they are and
     how many are on. Once folded or unfolded by hand that choice sticks through
     redraws — MORE stays null only until someone expresses a preference. */
  if (extras) {
    var nOn = sel.streams.length + (sel.program ? 1 : 0);
    var openNow = MORE === null
      ? !(window.matchMedia && window.matchMedia("(max-width:900px)").matches)
      : MORE;
    h += '<details class="idmore"' + (openNow ? " open" : "") + '><summary>' +
      (nOn ? nOn + " refinement" + (nOn === 1 ? "" : "s") + " on"
           : "My program, and anything else I am") +
      "</summary>" + '<div class="idrow idrow-2">' + extras + "</div></details>";
  }

  h += '<div class="idfoot"><span class="tally"><b>' + n + "</b> event" + (n === 1 ? "" : "s") +
       " you can attend</span>" +
       '<button class="ghostbtn' + (ghosts ? " on" : "") + '" id="ghostbtn" aria-pressed="' + ghosts + '">' +
       (ghosts ? "Hide" : "Show") + " what you cannot attend</button></div>";
  h += "</div>";
  $("idbar").innerHTML = h;

  var dm = $("idbar").querySelector(".idmore");
  if (dm) dm.addEventListener("toggle", function () { MORE = dm.open; });

  [].slice.call($("idbar").querySelectorAll("[data-k]")).forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.k, v = b.dataset.v;
      if (k === "stream") {
        var i = sel.streams.indexOf(v);
        if (i >= 0) sel.streams.splice(i, 1); else sel.streams.push(v);
      } else { sel[k] = v; }
      settle(); redraw();
    };
  });
  var ps = $("prog");
  if (ps) ps.onchange = function () { sel.program = this.value; redraw(); };
  $("ghostbtn").onclick = function () {
    ghosts = !ghosts;
    if (ghosts) asList = true;
    redraw();
  };
}

/* ---- what gets drawn ---------------------------------------------------- */
/* The one funnel. Eligibility first — the thing six audit rounds settled — then
   the student's own search, and nothing else. Every view reads this, so the day
   navigator, the clock, the whole run and the clash list can never disagree
   about what is on the board. */
/* Every listing on this student's board, before duplicates are folded and
   before the search box narrows it. The detail reads it to name every Laurier
   page an event was published on — searching is a view, not a filter, so it
   must not change which pages an event is said to come from. */
var SRCPOOL = null, SRCPOOLKEY = null;
function sourcePoolKey() {
  return [ghosts, sel.level, sel.campus, sel.term, sel.streams.join(","), sel.program].join("|");
}
function sourcePool() {
  var k = sourcePoolKey();
  if (SRCPOOLKEY !== k) { SRCPOOLKEY = k; SRCPOOL = EV.filter(function (e) { return ghosts || assess(e).ok; }); }
  return SRCPOOL;
}
function visible() {
  return onePerEvent(sourcePool().filter(matchQ));
}
function dayKeys(list) {
  var seen = {}, out = [];
  list.forEach(function (e) { var k = e.d || "TBA"; if (!seen[k]) { seen[k] = true; out.push(k); } });
  out.sort(function (a, b) { return a === "TBA" ? 1 : b === "TBA" ? -1 : (a < b ? -1 : a > b ? 1 : 0); });
  return out;
}
function onDay(list, k) {
  return list.filter(function (e) { return (e.d || "TBA") === k; });
}

/* ---- day-density navigator ---------------------------------------------- */
function drawNav() {
  var list = visible(), keys = dayKeys(list);
  var counts = keys.map(function (k) { return onDay(list, k).length; });
  var max = Math.max.apply(null, counts.concat([1]));
  var h = '<div class="navin">';
  var clashN = clashClusters(list).length;
  var wide = window.innerWidth >= 900;
  var planN = planEvents().length;
  /* Deduplicated the same way the list below deduplicates, or the badge says 6
     and the sentence under it says 5 — Laurier lists one breakfast twice. */
  var regSeen = {}, regN = 0;
  list.forEach(function (e) {
    var k = dupKey(e);
    if (regSeen[k] || !assess(e).ok || !needsReg(e) || isDone(e)) return;
    regSeen[k] = 1; regN++;
  });
  function vb(k, label, n) {
    return '<button class="vb' + (view === k ? " on" : "") + '" data-view="' + k + '">' + label +
      (n ? '<span class="vbn">' + n + "</span>" : "") + "</button>";
  }
  h += '<div class="views">' +
       (wide ? vb("week", "Whole run", 0) : "") +
       vb("day", "One day", 0) +
       vb("clash", "Clashes", clashN) +
       vb("plan", "My plan", planN) +
       vb("reg", "To register", regN) +
       '<div class="qwrap">' +
       '<input id="qbox" class="qbox" type="search" autocomplete="off" spellcheck="false" ' +
       'aria-label="Search the board by title, venue, host or description" ' +
       'placeholder="Search title, venue, host" value="' + esc(q) + '">' +
       (q ? '<button class="qclr" id="qclr">clear</button>' : "") +
       "</div></div>";
  if (q) {
    var onBoard = list.filter(function (e) { return ghosts || assess(e).ok; });
    var shown = onBoard.length;
    var deep = onBoard.filter(descOnly).length;
    var whole = onePerEvent(sourcePool()).length;
    h += '<p class="qnote">Search &ldquo;' + esc(q) + '&rdquo; — <b>' + shown +
      "</b> of your " + whole + " events match on title, venue, host, what it is " +
      "part of, or Laurier&rsquo;s own description" +
      (deep ? "; <b>" + deep + "</b> of them only in the description" : "") + ". " +
      "It narrows what is drawn; it does not change what you are eligible for." +
      (view === "plan" ? " Your plan below is not filtered by it." : "") + "</p>";
  }
  /* My plan and To register carry their own day headings; the density rail
     under them is 190px of a phone screen restating what is directly below. */
  var showBars = view !== "plan" && view !== "reg";
  if (showBars) h += '<div class="bars">';
  if (showBars) keys.forEach(function (k, i) {
    var undated = k === "TBA", dt = undated ? null : new Date(k + "T00:00:00");
    var past = !undated && k < NOW, today = k === NOW;
    h += '<button class="bar' + (view === "day" && k === day ? " sel" : "") + (past ? " past" : "") +
      (today ? " today" : "") + '" data-day="' + k + '" title="' + counts[i] + ' events">' +
      '<span class="barn">' + counts[i] + "</span>" +
      '<span class="barw"><span class="barf" style="height:' + Math.max(6, Math.round(100 * counts[i] / max)) + '%"></span></span>' +
      '<span class="bard">' + (undated ? "TBA" : DOW3[dt.getDay()]) + "</span>" +
      '<span class="barm">' + (undated ? "—" : dt.getDate()) + "</span></button>";
  });
  h += (showBars ? "</div>" : "") + "</div>";
  $("navstrip").innerHTML = h;
  [].slice.call($("navstrip").querySelectorAll("[data-view]")).forEach(function (b) {
    b.onclick = function () {
      view = b.dataset.view;
      if (view === "day" && !day) day = keys[0];
      redraw();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
  [].slice.call($("navstrip").querySelectorAll("[data-day]")).forEach(function (b) {
    b.onclick = function () { day = b.dataset.day; view = "day"; redraw(); };
  });
  var qb = $("qbox");
  if (qb) {
    qb.oninput = function () {
      QFOCUS = this.selectionStart;
      q = this.value;
      redraw();
    };
    /* redraw() replaces the strip this box lives in, so on every keystroke the
       box the student is typing into stops existing. The caret is put back where
       it was, not at the end, so editing the middle of a query still works. */
    if (QFOCUS !== null) {
      qb.focus();
      try { qb.setSelectionRange(QFOCUS, QFOCUS); } catch (x) { }
      QFOCUS = null;
    }
  }
  var qc = $("qclr");
  if (qc) qc.onclick = function () { q = ""; redraw(); };
}

/* ---- laying events out on the clock ------------------------------------- */
function placed(items, minMin) {
  items.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
  var clusters = [], cur = [], curEnd = -1;
  items.forEach(function (it) {
    it.de = Math.max(it.e, it.s + minMin);
    if (cur.length && it.s >= curEnd) { clusters.push(cur); cur = []; curEnd = -1; }
    cur.push(it); curEnd = Math.max(curEnd, it.de);
  });
  if (cur.length) clusters.push(cur);
  clusters.forEach(function (cl, ci) {
    cl.forEach(function (it) { it.cl = ci; });
    var ends = [];
    cl.forEach(function (it) {
      var k = 0; while (ends[k] !== undefined && ends[k] > it.s) k++;
      ends[k] = it.de; it.col = k;
    });
    var n = ends.length;
    cl.forEach(function (it) {
      it.ncol = n;
      var sp = 1;
      for (var k = it.col + 1; k < n; k++) {
        var blocked = cl.some(function (o) { return o !== it && o.col === k && o.s < it.de && it.s < o.de; });
        if (blocked) break;
        sp++;
      }
      it.span = sp;
    });
  });
  return items;
}
/* A drop-in desk -- long, and open across the middle of the day -- is not a
   session you diarise. Left on the clock it swallows the whole column and makes
   every real session beside it a sliver, so it rides above the grid as a ribbon
   instead. An evening event that merely runs long stays on the clock, where a
   student can see what it costs them. */

function split(list) {
  var timed = [], long = [], loose = [];
  list.forEach(function (e) {
    var w = parseWhen(e.n);
    if (!w) { loose.push(e); return; }
    if (isDropIn(w)) long.push({ ev: e, s: w.s, e: w.e });
    else timed.push({ ev: e, s: w.s, e: w.e });
  });
  long.sort(function (a, b) { return a.s - b.s; });
  return { timed: timed, long: long, loose: loose };
}
function ribbonHtml(it) {
  var e = it.ev, a = assess(e), off = !a.ok;
  return '<button class="rib' + (off ? " off" : (e.oa ? " open" : "")) + (isPicked(e) ? " mine" : "") + '" ' +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i + '">' +
    '<span class="rt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
    '<span class="rh">' + esc(title(e)) + "</span>" +
    (isPicked(e) ? '<span class="mymark" aria-hidden="true">✓</span>' : "") + "</button>";
}
/* ---- a clock with the dead hours squeezed out ---------------------------
   Laurier's quiet days have four-hour holes in them. Drawn to scale that is
   900px of ruled nothing between two events, which is most of a laptop screen
   spent saying "no". So the axis is piecewise: occupied stretches run at full
   scale, and any gap of two hours or more collapses to a labelled band that
   still names the hours it stands for. Nothing is hidden; the empty time is
   stated in words instead of drawn in pixels.
------------------------------------------------------------------------- */
var GAP_MIN = 120, GAP_PX = 46;

function makeScale(items, ppm, gapPx) {
  gapPx = gapPx || GAP_PX;
  var iv = items.map(function (it) { return [it.s, it.de]; })
                .sort(function (a, b) { return a[0] - b[0]; });
  var merged = [];
  iv.forEach(function (r) {
    var last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  });
  var blocks = [], y = 0;
  for (var i = 0; i < merged.length; i++) {
    if (i > 0) {
      var gs = merged[i - 1][1], ge = merged[i][0];
      if (ge - gs >= GAP_MIN) { blocks.push({ a: gs, b: ge, y: y, h: gapPx, gap: true }); y += gapPx; }
      else { blocks.push({ a: gs, b: ge, y: y, h: (ge - gs) * ppm }); y += (ge - gs) * ppm; }
    }
    var a = i === 0 ? Math.floor(merged[i][0] / 60) * 60 : merged[i][0];
    var b = i === merged.length - 1 ? Math.ceil(merged[i][1] / 60) * 60 : merged[i][1];
    blocks.push({ a: a, b: b, y: y, h: (b - a) * ppm });
    y += (b - a) * ppm;
  }
  return {
    blocks: blocks, H: y, ppm: ppm,
    pos: function (m) {
      for (var i = 0; i < blocks.length; i++) {
        var bl = blocks[i];
        if (m < bl.a) return bl.y;
        // a minute that lands exactly on a boundary belongs to the block below it
        if (m < bl.b || i === blocks.length - 1)
          return bl.gap ? bl.y : bl.y + (m - bl.a) * ppm;
      }
      return y;
    }
  };
}

function hourAxis(sc) {
  var h = "";
  sc.blocks.forEach(function (bl) {
    if (bl.gap) return;   // the band itself already names the hours it stands for
    for (var m = Math.ceil(bl.a / 60) * 60; m <= bl.b; m += 60) {
      var lab = hourLabel(m);
      h += '<div class="hr" style="top:' + sc.pos(m) + 'px"><span>' + lab + "</span></div>";
    }
  });
  return h;
}

/* `of` names what the empty stretch is empty of. On the board that is what
   Laurier published; in the plan it is what the student ticked, and saying
   "nothing published between 1pm and 7pm" over a plan on a day Laurier
   published fourteen things is the page stating a falsehood about its own
   source. */
function rules(sc, of) {
  var h = "";
  sc.blocks.forEach(function (bl) {
    if (bl.gap) {
      h += '<div class="gapband" style="top:' + bl.y + "px;height:" + bl.h + 'px"><span>' +
           (of || "nothing published") + " between " + clock(bl.a) + " and " + clock(bl.b) +
           "</span></div>";
      return;
    }
    for (var m = Math.ceil(bl.a / 60) * 60; m <= bl.b; m += 60)
      h += '<div class="rule" style="top:' + sc.pos(m) + 'px"></div>';
  });
  return h;
}

/* A block on the day clock. Nothing else uses this: the whole-run view gave up
   on drawing hours and lists names instead. */
function blockHtml(it, sc, within) {
  var e = it.ev, a = assess(e), off = !a.ok;
  var u = 100 / it.ncol, left = it.col * u, w = u * Math.min(it.span || 1, it.ncol - it.col);
  var cls = "blk" + (off ? " off" : (e.oa ? " open" : "")) + (drawsClash(e, within) ? " clash" : "") +
            (e.d && e.d < NOW ? " past" : "") + (isPicked(e) ? " mine" : "");
  var top = sc.pos(it.s), bot = sc.pos(it.de);
  var label = clock(it.s) + "–" + clock(it.e) + " · " + (e.t || "") + (e.w ? " · " + e.w : "");
  return '<article class="' + cls + '" style="top:' + top + "px;height:" +
    Math.max(30, bot - top - 2) + "px;left:calc(" + left + "% + 1px);width:calc(" + w + "% - 3px)\" " +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i +
    '" tabindex="0" title="' + esc(label) + '">' +
    '<span class="bt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
    '<span class="bh">' + esc(title(e)) + "</span>" +
    (isPicked(e) ? '<span class="mymark" aria-hidden="true">✓</span>' : "") +
    '<span class="bw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) + "</span>" +
    (off ? '<span class="bx">' + esc(a.reason) + "</span>" : "") + "</article>";
}
function looseHtml(e) {
  var a = assess(e), off = !a.ok;
  return '<button class="chipev' + (off ? " off" : (e.oa ? " open" : "")) + (isPicked(e) ? " mine" : "") + '" ' +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i + '">' +
    '<span class="ch">' + esc(title(e)) + "</span>" +
    '<span class="cw">' + esc(off ? a.reason
        /* "TBD" is Laurier saying it has not set a time, not a time. Letting it
           win over the venue drew an online session and its in-person twin as two
           chips reading "TBD", indistinguishable, in the undated group. */
        : (e.n && !/^(TBD|TBA)\.?$/i.test(e.n) ? e.n : (e.w || e.n || "Time not published"))) + "</span>" +
    (isPicked(e) ? '<span class="mymark" aria-hidden="true">✓</span>' : "") + "</button>";
}

/* ---- the board ---------------------------------------------------------- */
var looseCarry = [];
function drawBoard() {
  var list = visible(), keys = dayKeys(list);
  looseCarry = [];
  if (view === "plan") {
    $("board").innerHTML = planHtml();
  } else if (view === "reg") {
    $("board").innerHTML = regHtml(list);
  } else if (!keys.length) {
    $("board").innerHTML = q
      ? '<div class="empty"><p>Nothing on your board matches &ldquo;' + esc(q) + '&rdquo;.</p>' +
        "<p>The search reads the title, the venue, the host, what the event is part " +
        "of, and Laurier&rsquo;s own description of it.</p>" +
        '<p><button class="pbtn" id="qclr2">Clear the search</button></p></div>'
      : '<div class="empty"><p>Laurier publishes nothing for this combination yet.</p>' +
        "<p>Try another term, or tick a stream above.</p></div>";
  } else {
    $("board").innerHTML = view === "week" ? weekHtml(list, keys)
                        : view === "clash" ? clashHtml(list)
                        : dayHtml(list, keys);
  }
  wireBlocks();
}

/* Three events side by side is the most a 120px column can say. Beyond that the
   week grid stops pretending and says how many more there are; the day view has
   the room to draw them all. */
/* ---- the whole run: one row per day, time running left to right ---------
   Nine days as columns needed a horizontal scroller at 1400px and thirteen made
   it useless — a view whose whole justification is seeing the run at once cannot
   ask you to scroll sideways to see the run. Turned on its side it fits any
   number of days, keeps the time axis honest (position and width are the real
   start and the real duration), and shows a collision as a stack.
------------------------------------------------------------------------- */
var LANE_H = 22, LANE_GAP = 2;

/* A title inside its own day column should not begin by naming that day. */
function shortTitle(e, dayKey) {
  var t = e.t || "";
  if (!dayKey || dayKey === "TBA") return t;
  var m = t.match(/^(Sun|Mon|Tues?|Wed(nes)?|Thurs?|Fri|Satur?)(day)?,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*\d{1,2}\s*[-–—:]\s*/i);
  return m ? t.slice(m[0].length) : t;
}

/* ---- the third view: what you actually have to choose between ------------
   A already computes every collision in the run — it is the only one of these
   boards that does. Counting them ("16 run at the same time as something else")
   states the problem; this view puts the choice in front of you. Every moment
   where two or more events overlap becomes one card listing exactly what is on
   offer at that hour, so a student can pick rather than discover the conflict
   on the day.
------------------------------------------------------------------------- */
/* A moment you have to choose between is not the same as a chain of overlaps.
   Three corrections, all of which this got wrong first time:

   - Laurier's duplicate listings are not a clash. One event published on two of
     its schedule pages is one event, folded before the board is built; charging
     it against the student as a conflict with itself would be the page
     contradicting itself on adjacent lines.
   - A desk that is open from 11am to 5:45pm does not clash with anything. The
     day view already segregates these as "open most of the day", and the clash
     view has to honour the rule the day view invented.
   - A cluster found by chaining overlaps can span an afternoon: A overlaps B,
     B overlaps C, and A and C never meet. The honest unit is a window in which
     the same set of events is genuinely running together, so the sweep below
     cuts at every point where that set changes. */
function clashClusters(list) {
  var out = [];
  dayKeys(list).forEach(function (k) {
    if (k === "TBA") return;
    var timed = split(onDay(list, k)).timed;      // drop-in desks excluded

    // Laurier's repeats were folded before the board was built, so what is left
    // here is genuinely a set of different things running at the same time.
    var items = timed;
    if (items.length < 2) return;

    var edges = [];
    items.forEach(function (it) { edges.push(it.s, it.e); });
    edges = edges.filter(function (v, i, a) { return a.indexOf(v) === i; })
                 .sort(function (a, b) { return a - b; });

    var run = null;
    for (var i = 0; i < edges.length - 1; i++) {
      var a = edges[i], b = edges[i + 1];
      var on = items.filter(function (it) { return it.s < b && a < it.e; });
      if (on.length < 2) { if (run) { out.push(run); run = null; } continue; }
      var sig = on.map(function (it) { return it.ev.__i; }).sort().join(",");
      if (run && run.sig === sig) { run.to = b; continue; }
      if (run) out.push(run);
      run = { day: k, items: on, sig: sig, from: a, to: b };
    }
    if (run) out.push(run);
  });
  // Cutting at every boundary produces a window per boundary, and most of them
  // are a subset of the one beside them — 12pm-1pm with five events sitting next
  // to 1pm-1:30pm with the same five plus two. Only the maximal windows are a
  // choice; the rest are the same choice seen a few minutes earlier.
  var keep = out.filter(function (g) {
    return !out.some(function (h) {
      if (h === g || h.day !== g.day || h.items.length <= g.items.length) return false;
      return g.items.every(function (it) { return h.items.indexOf(it) >= 0; });
    });
  });
  // Maximal windows still split one busy afternoon into four cards that share
  // most of their events — "1pm-1:30 seven at once" beside "2pm-2:30 five at
  // once", with the same three long sessions counted in each. A student does not
  // face four decisions there; they face one stretch. Windows that touch in time
  // become a single card spanning the stretch, headlined by the most that ever
  // run together inside it.
  var merged = [];
  keep.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.from - b.from; });
  keep.forEach(function (g) {
    var last = merged[merged.length - 1];
    if (last && last.day === g.day && g.from <= last.to) {
      last.to = Math.max(last.to, g.to);
      g.items.forEach(function (it) {
        if (last.items.indexOf(it) < 0) last.items.push(it);
      });
      last.peak = Math.max(last.peak, g.items.length);
      return;
    }
    merged.push({ day: g.day, from: g.from, to: g.to,
                  items: g.items.slice(), peak: g.items.length });
  });
  merged.forEach(function (g) {
    g.items.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
  });
  return merged;
}

function clashHtml(list) {
  var groups = clashClusters(list);
  if (!groups.length) {
    return '<div class="empty"><p>Nothing you can attend overlaps.</p>' +
      "<p>Every event on your board runs at a time of its own.</p></div>";
  }
  var caught = {};
  groups.forEach(function (g) { g.items.forEach(function (it) { caught[it.ev.__i] = true; }); });
  var n = Object.keys(caught).length;
  var h = '<div class="clashhead"><h2>' + groups.length + " moment" + (groups.length === 1 ? "" : "s") +
    " where you have to choose</h2>" +
    '<p class="lede">' + n + " of your " + list.length + " events are in one. Desks and fairs that stay " +
    "open across the middle of the day are left out, and so is Laurier listing the same " +
    "event twice — neither is a choice you have to make.</p></div>";

  h += '<div class="clashlist">' + groups.map(function (g) {
    var dt = new Date(g.day + "T00:00:00");
    var lo = g.from, hi = g.to;
    return '<section class="cl' + (g.day < NOW ? " past" : "") + '">' +
      '<button class="clwhen" data-day="' + g.day + '">' +
        '<span class="cdow">' + DOW3[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] + "</span>" +
        '<span class="ctime">' + clock(lo) + "–" + clock(hi) + "</span>" +
        '<span class="cn">' + (g.peak === g.items.length
          ? g.items.length + " at once"
          : g.items.length + " overlap, up to " + g.peak + " at once") + "</span>" +
        '<span class="cgo">see the day ›</span></button>' +
      '<ul class="clopts">' + g.items.map(function (it) {
        var e = it.ev;
        return '<li class="clrow' + (isPicked(e) ? " mine" : "") + '">' +
          '<button class="clopt" data-ev-title="' + esc(title(e)) + '" data-id="' + e.__i + '">' +
          '<span class="clt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
          '<span class="clname">' + esc(title(e)) + "</span>" +
          '<span class="clw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) +
            (e.h ? ' <span class="cldot">·</span> ' + esc(e.h) : "") + "</span>" +
          (e.oa ? '<span class="clopen">open to all Laurier students</span>' : "") +
          "</button>" + pickBtn(e, "clash") + "</li>";
      }).join("") + "</ul></section>";
  }).join("") + "</div>";
  return h;
}

/* A bar with no name is texture, not information — a third of the run view was
   coming out anonymous under a flat 88px cutoff. Three ladders instead: the title
   inside the bar when it fits, the title to the right of the bar when the lane is
   free that far, and nothing only when neither is true. Where two entries share a
   title and a start time in one day, the room is appended so they can be told
   apart. */
function barLabel(it, e, k, wide, room, laneW, byTitle, left, top, off) {
  var t = shortTitle(e, k);
  if (byTitle && byTitle[stripDay(e.t) + " @" + it.s] > 1 && e.w) t += " — " + e.w;
  var insidePx = wide / 100 * laneW;
  if (insidePx >= 46) return ['<span class="wbl">' + esc(t) + "</span>", ""];
  var roomPx = room / 100 * laneW;
  /* The spilled label is a sibling of the bar, not a child of it. As a child it
     sat at left:100% inside a box with overflow:hidden and rendered at zero
     width — five bars a week came out anonymous. As a sibling it also reads
     against the lane it is actually drawn on rather than against the purple. */
  if (roomPx >= 62)
    return ["", '<span class="wbl out' + (off ? " goff" : "") + '" style="left:' +
            (left + wide) + "%;width:" + (room - wide) + "%;top:" + top + 'px">' +
            esc(t) + "</span>"];
  return ["", ""];
}

function weekHtml(list, keys) {
  var dated = keys.filter(function (k) { return k !== "TBA"; });
  if (!dated.length) {
    return '<div class="loosebar"><h3>No date published <span>' + onDay(list, "TBA").length +
      "</span></h3><div class=\"chips\">" + onDay(list, "TBA").map(looseHtml).join("") + "</div></div>";
  }

  var rows = {}, all = [];
  dated.forEach(function (k) {
    var pt = split(onDay(list, k));
    rows[k] = pt;
    all = all.concat(pt.timed, pt.long);
  });
  if (!all.length) {
    return '<div class="loosebar"><h3>Nothing on the clock <span>' + list.length + "</span></h3>" +
      '<p class="lede">Laurier publishes no usable time for any of these, so there is no run to draw.</p>' +
      '<div class="chips">' + list.map(looseHtml).join("") + "</div></div>";
  }
  // how wide a lane actually is, so a bar too narrow to hold a title can be
  // left unlabelled rather than showing one clipped character
  var laneW = Math.max(320, ($("board").clientWidth || 1200) - 86);
  var lo = Math.floor(Math.min.apply(null, all.map(function (i) { return i.s; })) / 60) * 60;
  var hi = Math.ceil(Math.max.apply(null, all.map(function (i) { return i.e; })) / 60) * 60;
  var span = Math.max(60, hi - lo);
  function pc(m) { return 100 * (m - lo) / span; }

  var ticks = "";
  for (var m = lo; m <= hi; m += 60) {
    var lab = hourLabel(m);
    ticks += '<span class="wt" style="left:' + pc(m) + '%">' + lab + "</span>";
  }
  var gridlines = "";
  for (var g = lo; g <= hi; g += 60)
    gridlines += '<span class="wl" style="left:' + pc(g) + '%"></span>';

  /* The bars carry the same three states the day clock does — purple for an
     ordinary event, lilac for one open to all Laurier students, a gold cap for a
     collision — and until now said so nowhere. The rows are built first so the
     key above them can name the states this run actually contains. */
  var wentries = [];
  var body = "";

  dated.forEach(function (k) {
    var dt = new Date(k + "T00:00:00"), past = k < NOW;
    var pt = rows[k];
    // Where two entries share a title and a start time but sit in different rooms
    // they are not the same event -- the Get Involved Fair runs in the Quad and
    // outside the Athletic Complex at the same hour -- so both are drawn and the
    // label says which is which. (Laurier's own repeats were folded before the
    // board was built; there is nothing left to de-duplicate here.)
    var byTitle = {};
    pt.timed.concat(pt.long).forEach(function (it) {
      var tk = stripDay(it.ev.t) + " @" + it.s;
      byTitle[tk] = (byTitle[tk] || 0) + 1;
    });
    var items = placed(pt.timed.concat(pt.long), 20);
    var lanes = items.reduce(function (mx, it) { return Math.max(mx, it.col + 1); }, 1);
    var shown = items;
    var n = onDay(list, k).length;

    shown.forEach(function (it) { wentries.push([it.ev, drawsClash(it.ev), false]); });

    body += '<div class="wkrow' + (past ? " past" : "") + (k === NOW ? " today" : "") + '">' +
      '<button class="wkday" data-day="' + k + '">' +
        '<span class="wdw">' + DOW3[dt.getDay()] + "</span>" +
        '<span class="wdd">' + dt.getDate() + "</span>" +
        '<span class="wdm">' + MON[dt.getMonth()] + "</span>" +
        '<span class="wdn">' + n + "</span></button>" +
      '<div class="wklane" style="height:' + (lanes * (LANE_H + LANE_GAP) + 4) + 'px">' + gridlines +
      shown.map(function (it) {
        var e = it.ev, a = assess(e), off = !a.ok;
        var left = pc(it.s), wide = Math.max(0.6, pc(it.e) - pc(it.s));
        // how far this bar's own lane stays empty to its right — the space a
        // label can spill into without ever being overprinted by the next bar
        var nxt = shown.filter(function (o) { return o.col === it.col && o.s > it.s; })
                       .sort(function (x, y) { return x.s - y.s; })[0];
        var room = Math.max(wide, (nxt ? pc(nxt.s) : 100) - left);
        var btop = it.col * (LANE_H + LANE_GAP) + 2;
        var lab = barLabel(it, e, k, wide, room, laneW, byTitle, left, btop, off);
        return lab[1] + '<button class="wb' + (off ? " off" : (e.oa ? " open" : "")) +
          (drawsClash(e) ? " clash" : "") +
          (isPicked(e) ? " mine" : "") +
          '" style="left:' + left + "%;width:" + wide + "%;top:" + btop + "px\" " +
          (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i +
          '" title="' + esc(clock(it.s) + "–" + clock(it.e) + " · " + e.t +
            (e.w ? " · " + e.w : "")) + '">' +
          lab[0] +
          "</button>";
      }).join("") +
      "</div></div>";
    pt.loose.forEach(function (e) { looseCarry.push([k, e]); });
  });
  body += "</div>";

  onDay(list, "TBA").forEach(function (e) { looseCarry.push(["TBA", e]); });
  /* The untimed chips below the run carry the same edges, so they are part of
     what the key has to account for. */
  looseCarry.forEach(function (p) { wentries.push([p[1], false, true]); });

  var wkeys = legendKeys(clockStates(wentries, true));
  /* Above the grid, not between the axis and the first row: put inside, a key
     reads as part of the ruling it is explaining. */
  var h = (wkeys ? '<div class="legend legend-run">' + wkeys + "</div>" : "") +
    '<div class="weekwrap"><div class="wkhead"><span class="wklab">The run</span>' +
    '<div class="wkaxis">' + ticks + "</div></div>" + body;
  if (looseCarry.length) {
    h += '<div class="loosebar"><h3>No clock time published <span>' + looseCarry.length + "</span></h3>" +
      '<p class="lede">Laurier gives these a day but no usable time, or no date at all. They are listed rather than placed, because guessing would be worse.</p>' +
      '<div class="chips">' + looseCarry.map(function (p) {
        var k = p[0], e = p[1];
        var lab = k === "TBA" ? "Undated"
          : DOW3[new Date(k + "T00:00:00").getDay()] + " " + new Date(k + "T00:00:00").getDate();
        return '<span class="looseday">' + lab + "</span>" + looseHtml(e);
      }).join("") + "</div></div>";
  }
  return h;
}

/* Read the day as a list rather than a clock. Two things force this: a phone,
   where five parallel lanes are 35px wide, and a day so crowded that the clock
   has nothing left to say. The argument survives the change of form — the hour
   gutter stays, empty stretches are still named rather than drawn, and every
   collision is counted in words. */
function agendaHtml(items, of, within) {
  var prevEnd = null;
  return '<div class="agenda">' + items.map(function (it) {
    var gap = "";
    if (prevEnd !== null && it.s - prevEnd >= GAP_MIN)
      gap = '<div class="aggap">' + (of || "nothing published") + " between " +
            clock(prevEnd) + " and " + clock(it.s) + "</div>";
    prevEnd = prevEnd === null ? it.de : Math.max(prevEnd, it.de);
    var e = it.ev, a = assess(e), off = !a.ok;
    var clash = drawnClashes(e, within);
    return gap + '<article class="ag' + (off ? " off" : (e.oa ? " open" : "")) +
      (clash.length ? " clash" : "") +
      (isPicked(e) ? " mine" : "") + '" ' +
      (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i + '" tabindex="0">' +
      '<div class="agt">' + clock(it.s) + "<span>" + clock(it.e) + "</span></div>" +
      '<div class="agb"><h4>' + esc(title(e)) + "</h4>" +
        '<p class="agw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) +
          mapLink(e) + "</p>" +
        (off ? '<p class="agx">' + esc(a.reason) + "</p>" : "") +
        (clash.length ? '<p class="agc">' + clash.length + " other" + (clash.length === 1 ? "" : "s") +
                        " at this time</p>" : "") +
      "</div>" + '<div class="agp">' + pickBtn(e, "ag") + "</div>" +
      (isPicked(e) ? '<span class="mymark" aria-hidden="true">✓</span>' : "") +
      "</article>";
  }).join("") + "</div>";
}

/* ---- what the colours on the clock mean ---------------------------------
   The key used to be printed whole on every day, so a Tuesday with one event on
   it asserted that something ran at the same time as something else and that
   something was open to all Laurier students, and neither was true. A key that
   names a state nothing on the screen is in is worse than no key: it invites the
   reader to match a caption to the only edge in front of them.

   The ordinary state had no key at all, which was the other half of the same
   fault — a plain purple edge sat beside a lilac swatch captioned "open to all
   Laurier students", two purples one step apart with only one of them named, and
   a programme-specific welcome was read as open to everybody. The plain state is
   named now whenever anything else is, and lilac has become a double edge so the
   difference survives at swatch size and in black and white.

   clockStates() is given [event, doesItCollide] pairs for everything the view
   actually draws, blocks, ribbons and untimed chips alike, because whether two
   events collide is a fact about the placement rather than about the list.
------------------------------------------------------------------------- */
function clockStates(entries, capped) {
  var st = { plain: false, open: false, clash: false, off: false };
  entries.forEach(function (p) {
    var e = p[0], clash = p[1], aside = p[2];
    if (!assess(e).ok) { st.off = true; return; }
    if (clash) st.clash = true;
    /* The key has to name the colour on the screen, not a property of the
       event. A reading edge can carry one meaning at a time and a collision
       takes it, so an event that collides is drawn neither lilac nor purple and
       the key must not claim that anything is. The whole run draws a collision
       as a gold cap above a filled bar, where the two do show together, and
       passes capped. */
    if (clash && !capped) return;
    /* An all-day ribbon and an untimed chip sit under their own headings and
       look nothing like the swatch: a lavender full-bleed strip is not a white
       box with a purple edge. On a Bachelor of Education Monday every card on
       the clock was gold and the only purple on the page was two ribbons, and
       the key still offered "an ordinary event on your board" with a swatch
       matching nothing. They keep the marked states, which really are the same
       colour wherever they appear, and give up the unmarked one. */
    if (aside) { if (e.oa) st.open = true; return; }
    if (e.oa) st.open = true; else st.plain = true;
  });
  return st;
}
function legendKeys(st) {
  var k = "";
  if (st.clash) k += '<span class="lg lg-clash">runs at the same time as something else</span>';
  if (st.open) k += '<span class="lg lg-open">open to all Laurier students</span>';
  if (st.off) k += '<span class="lg lg-off">not open to you</span>';
  /* On its own, "an ordinary event" tells nobody anything. It earns its place
     only as the thing the other keys are not. */
  if (k && st.plain)
    k = '<span class="lg lg-plain">an ordinary event on your board</span>' + k;
  return k;
}
/* The entries one day of the clock draws, in the form clockStates() wants:
   the event, whether it collides, and whether it is drawn beside the clock
   rather than on it. */
function dayEntries(pt, items, within) {
  return items.map(function (it) { return [it.ev, drawsClash(it.ev, within), false]; })
    .concat(pt.long.map(function (it) { return [it.ev, false, true]; }),
            pt.loose.map(function (e) { return [e, false, true]; }));
}

function dayHtml(list, keys) {
  if (keys.indexOf(day) === -1) day = keys[0];
  var i = keys.indexOf(day);
  var undated = day === "TBA", dt = undated ? null : new Date(day + "T00:00:00");
  var todays = onDay(list, day);
  var parts = split(todays);
  var items = placed(parts.timed, 52);
  var sc = items.length ? makeScale(items, 1.15) : null;
  /* How many events overlap is the Clashes lens's whole subject, and it answers
     it properly — which of them you have to choose between, and when. Counting
     them again in the day heading said less and said it twice. */
  var lanes = items.reduce(function (m, it) { return Math.max(m, it.ncol); }, 0);
  var narrow = window.innerWidth < 700;
  // Surrendering the clock on the busiest day gives up the one thing this view
  // is for. Past MAX_LANES it tightens instead, and only a phone forces the list.
  var tight = lanes > MAX_LANES;
  var listNow = asList || narrow;

  /* The board opens on the busiest day ahead, so it points at where the run
     starts. That sentence is only true until the run does start: from the second
     morning onward the next day with events on it is not the beginning of
     anything, and the week this page exists for is exactly the week it would be
     saying so. The label follows the clock rather than going quietly false. */
  var dated = keys.filter(function (k) { return k !== "TBA"; });
  var begun = dated.length > 0 && dated[0] < NOW;
  var firstK = begun ? dated.filter(function (k) { return k >= NOW; })[0] : dated[0];
  var away = firstK && firstK !== day;
  var fdt = away ? new Date(firstK + "T00:00:00") : null;

  var h = '<div class="dayhead"><div class="dayin">' +
    '<button class="step" data-step="-1"' + (i <= 0 ? " disabled" : "") + ' aria-label="Previous day">‹</button>' +
    '<div class="dtitle"><h2>' + (undated ? "Undated" : DOW[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] + " " + dt.getFullYear()) + "</h2>" +
    "<p>" + todays.length + " event" + (todays.length === 1 ? "" : "s") +
    (parts.loose.length ? " · " + parts.loose.length + " without a clock time" : "") + "</p>" +
    (away ? '<p class="peak">' + (begun ? "Next up" : "Orientation starts on") + " " +
      '<button class="peakbtn" data-day="' + firstK + '">' + DOW[fdt.getDay()] + " " +
      fdt.getDate() + " " + MON[fdt.getMonth()] + " ›</button></p>" : "") + "</div>" +
    '<button class="step" data-step="1"' + (i >= keys.length - 1 ? " disabled" : "") + ' aria-label="Next day">›</button>' +
    "</div>" + (function () {
      /* The list reads the same events with the same edges, so the key holds in
         both modes; it is the day that decides what is in it, not the form. */
      var keys2 = legendKeys(clockStates(dayEntries(parts, items)));
      var extra =
        (narrow || items.length < 2 ? "" :
          '<button class="modebtn" data-mode="1">' +
          (listNow ? "Draw it on the clock" : "Read it as a list") + "</button>") +
        (tight && !asList
          ? '<span class="lgnote">' + lanes + " run at once here — the clock is tight; " +
            "the list may read easier</span>" : "");
      /* An empty <div class="legend"> is not nothing: it is 6px of margin and a
         flex row holding a day apart from its own clock. */
      return (keys2 || extra) ? '<div class="legend">' + keys2 + extra + "</div>" : "";
    })() + "</div>";

  if (parts.long.length)
    h += '<div class="allday"><h3>Open most of the day <span>' + parts.long.length + '</span></h3>' +
         '<div class="ribs wide">' + parts.long.map(ribbonHtml).join("") + "</div></div>";

  if (parts.loose.length)
    h += '<div class="loosebar tight"><h3>Time not published <span>' + parts.loose.length + "</span></h3><div class=\"chips\">" +
         parts.loose.map(looseHtml).join("") + "</div></div>";

  if (items.length && listNow)
    h += agendaHtml(items);
  else if (items.length)
    h += '<div class="daygrid' + (tight ? " tight" : "") + '"><div class="gutcol"><div class="gut" style="height:' + sc.H + 'px">' +
      hourAxis(sc) + '</div></div><div class="col wide" style="height:' + sc.H + 'px">' +
      rules(sc) + items.map(function (it) { return blockHtml(it, sc); }).join("") +
      "</div></div>";
  else if (!parts.loose.length && !parts.long.length)
    h += '<div class="empty"><p>Nothing on this day.</p></div>';
  return h;
}

/* ---- shared furniture for the plan, the registration list and the printout - */
function dayLabel(k) {
  if (k === "TBA") return "No date published";
  var dt = new Date(k + "T00:00:00");
  return DOW[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] + " " + dt.getFullYear();
}
function whenLabel(e) {
  var w = parseWhen(e.n);
  if (w) return clock(w.s) + "–" + clock(w.e);
  return e.n ? stripLead(e.n, e.d) : "Time not published";
}
function byDay(list) {
  var keys = [], g = {};
  list.forEach(function (e) {
    var k = e.d || "TBA";
    if (!g[k]) { g[k] = []; keys.push(k); }
    g[k].push(e);
  });
  keys.sort(function (a, b) { return a === "TBA" ? 1 : b === "TBA" ? -1 : (a < b ? -1 : a > b ? 1 : 0); });
  return keys.map(function (k) { return { k: k, items: g[k] }; });
}
function pickBtn(e, mode) {
  var on = isPicked(e);
  return '<button class="pk' + (on ? " on" : "") + (mode ? " pk-" + mode : "") +
    '" data-pick="' + esc(dupKey(e)) + '" aria-pressed="' + on + '">' +
    '<span class="pkm" aria-hidden="true">' +
    (on ? (mode === "row" ? "✕" : "✓") : "+") + "</span>" +
    '<span class="pkt">' + (on ? (mode === "row" ? "Remove" : "In my plan") : "Add to plan") +
    "</span></button>";
}
function regRow(e) {
  var ls = regLinksOf(e);
  if (!ls.length) return "";
  return '<p class="plreg">' + ls.map(function (l) {
    return '<a class="lk primary" href="' + esc(l.href) + '" target="_blank" rel="noopener">' +
      esc(l.text) + " →</a>";
  }).join(" ") + "</p>";
}

/* ---- the plan ----------------------------------------------------------
   The one place a student sees what they have actually committed to, in the
   order the days run. Clashes here come from collidesWith() — the same engine
   the detail sheet and the Clashes lens use — so the plan cannot tell a student
   something the rest of the page contradicts.
------------------------------------------------------------------------- */
/* ---- the plan, drawn on the clock ---------------------------------------
   The plan was a column of paragraphs on a page whose whole argument is that a
   week is a shape, not a list. This is the same plan with the same events in it
   — byDay() over the same picks, one day at a time, using the board's own
   scale, blocks, ribbons and chips, so a ticked event looks the same wherever a
   student meets it.

   A day too crowded to draw falls back to the agenda for that day alone and
   says why, which is what the day board does and what the printed sheet does;
   surrendering the clock quietly would leave a student wondering what happened
   to it.
------------------------------------------------------------------------- */
function planCalHtml(picks) {
  var narrow = window.innerWidth < 700;
  var all = [];
  var body = byDay(picks).map(function (g) {
    var pt = split(g.items);
    var items = placed(pt.timed, 52);
    var lanes = items.reduce(function (m, it) { return Math.max(m, it.ncol); }, 0);
    var sc = items.length ? makeScale(items, 1.15) : null;
    var tooDeep = lanes > MAX_LANES;
    /* PLAN is already keyed by dupKey, and it is the set planClashes() and the
       plan bar count against. Passing it here is what stops the plan's calendar
       form marking a block gold for colliding with something the student did
       not put in their plan, while its list form -- reading the same picks --
       says nothing of the kind. */
    all = all.concat(dayEntries(pt, items, PLAN));

    var h = '<section class="pday pcalday' + (g.k !== "TBA" && g.k < NOW ? " past" : "") +
      '"><h3 class="pdayh">' + esc(dayLabel(g.k)) +
      '<span class="pdayn">' + g.items.length + "</span></h3>";

    if (pt.long.length)
      h += '<div class="allday"><h4>Open most of the day <span>' + pt.long.length +
               "</span></h4><div class=\"ribs wide\">" + pt.long.map(ribbonHtml).join("") + "</div></div>";

    if (pt.loose.length)
      h += '<div class="loosebar tight"><h4>Time not published <span>' + pt.loose.length +
               "</span></h4><div class=\"chips\">" + pt.loose.map(looseHtml).join("") + "</div></div>";

    if (items.length && (narrow || tooDeep)) {
      h += '<p class="lgnote">' + (narrow
        ? "The clock is too narrow to draw here, so this day is read in time order."
        : lanes + " of these run at once, which is more than the clock can draw and " +
          "still be read, so this day is written out in time order.") + "</p>";
      h += agendaHtml(items, "nothing in your plan", PLAN);
    } else if (items.length) {
      h += '<div class="daygrid"><div class="gutcol"><div class="gut" style="height:' +
        sc.H + 'px">' + hourAxis(sc) + '</div></div><div class="col wide" style="height:' +
        sc.H + 'px">' + rules(sc, "nothing in your plan") +
        items.map(function (it) { return blockHtml(it, sc, PLAN); }).join("") + "</div></div>";
    }
    return h + "</section>";
  }).join("");

  /* The list carries a Details button, a calendar file and a Remove beside
     every event; the clock has room for none of them, and a reader who cannot
     see them may reasonably think this form has taken them away. It has not:
     every block opens the same card, which holds all three. */
  var keys = legendKeys(clockStates(all));
  return '<p class="pcalnote">Every block, ribbon and chip below opens its own ' +
    "card \u2014 that is where the venue, the links, the calendar file and the tick " +
    "that removes it from your plan live. Nothing here is only readable.</p>" +
    (keys ? '<div class="legend plegend">' + keys + "</div>" : "") +
    '<div class="planlist plancal">' + body + "</div>";
}

function planHtml() {
  var picks = planEvents();
  if (!picks.length) {
    return '<div class="empty planhead planempty"><h2>Your plan is empty</h2>' +
      "<p>Tick an event anywhere on this page — on a day, inside a clash, or from its " +
      "detail card — and it collects here.</p>" +
      "<p>The plan is kept in this browser, on this device. Close the page and come back " +
      "tomorrow and it is still here. Nothing is sent anywhere and Laurier is not told.</p>" +
      '<p><button class="pbtn" data-view="day">Go and pick some events ›</button></p>' +
      /* Printing with nothing ticked produces the whole board, and which of the
         two forms it comes out in is decided by this switch. Hidden here, it was
         an eight-page document and a ten-page one behind a control the reader
         had no way to see or set. */
      '<div class="pviews" role="group" aria-label="How this would print">' +
        '<span class="pvlab">Print as</span>' +
        '<button class="pv' + (planCal ? "" : " on") + '" data-planview="list" ' +
          'aria-pressed="' + (!planCal) + '">List</button>' +
        '<button class="pv' + (planCal ? " on" : "") + '" data-planview="cal" ' +
          'aria-pressed="' + planCal + '">Calendar</button>' +
        '<span class="pvnote">With nothing ticked there is no plan to print, so ' +
          "Ctrl+P prints every event you may attend — as " +
          (planCal ? "a calendar of the whole board" : "a written list") +
          ", headed as the board rather than as a schedule you chose.</span>" +
      "</div></div>";
  }
  var cm = clashMap(), t = icsTally(picks);
  var offBoard = picks.filter(function (e) { return !assess(e).ok; });
  var nClash = Object.keys(cm).length;
  var drop = dropInPicks(picks);

  var h = '<div class="planhead"><div class="planin">' +
    "<h2>My plan</h2>" +
    '<p class="lede"><b>' + picks.length + "</b> event" + (picks.length === 1 ? "" : "s") +
    " ticked" +
    (nClash ? ", <b class=\"warnn\">" + nClash + " of them overlapping</b>"
            : drop.length ? ", and no two timed sessions overlap" : ", nothing overlapping") +
    ". Kept in this browser on this device — not sent anywhere.</p>" +
    (drop.length ? '<p class="dropnote"><b>' + drop.length + "</b> of your picks " +
      (drop.length === 1 ? "is a session that stays" : "are sessions that stay") +
      " open across the middle of the day — a desk, a fair, a drop-in. This page never " +
      "counts those as clashing with anything, here or in the Clashes lens, because you can " +
      "walk up to them whenever suits you. They are marked below; nothing else is hidden.</p>"
      : "") +
    lostNote() +
    /* The plan is the one place this page lets a student read their own week,
       and until now it could only be read as a column of paragraphs on a page
       whose whole argument is the clock. The toggle is a view and not a filter:
       both forms hold exactly these events, and the sentence beside it says so,
       because a control that looks like a filter beside a count that does not
       move is a control a student stops trusting. */
    '<div class="pviews" role="group" aria-label="How to show the plan">' +
      '<span class="pvlab">Show as</span>' +
      '<button class="pv' + (planCal ? "" : " on") + '" data-planview="list" ' +
        'aria-pressed="' + (!planCal) + '">List</button>' +
      '<button class="pv' + (planCal ? " on" : "") + '" data-planview="cal" ' +
        'aria-pressed="' + planCal + '">Calendar</button>' +
      '<span class="pvnote">Both hold the same ' + picks.length + " event" +
        (picks.length === 1 ? "" : "s") + " — this changes how they are drawn, " +
        "not which ones are here. Printing follows whichever you are reading.</span>" +
    "</div>" +
    '<div class="planacts">' +
      '<button class="abtn" id="dlplan">Add all to my calendar (.ics)</button>' +
      '<button class="abtn" id="printplan">Print my schedule' +
        (planCal ? " (as a calendar)" : " (as a list)") + "</button>" +
      '<button class="abtn ghost" id="clearplan">Empty the plan</button>' +
    "</div>" +
    '<p class="acct">The calendar file will carry <b>' + t.timed + '</b> timed entr' +
      (t.timed === 1 ? "y" : "ies") +
      (t.allday ? " and <b>" + t.allday + "</b> all-day entr" + (t.allday === 1 ? "y" : "ies") +
        " where Laurier publishes a day but no usable time" : "") +
      (t.none ? ". <b class=\"warnn\">" + t.none + "</b> cannot go in at all — Laurier publishes " +
        "no date for " + (t.none === 1 ? "it" : "them") + ", and a calendar entry without a date " +
        "is not a thing. " + (t.none === 1 ? "It is" : "They are") + " listed below, unexported." : ".") +
    "</p></div></div>";

  h += planCal ? planCalHtml(picks) : '<div class="planlist">' + byDay(picks).map(function (g) {
    return '<section class="pday' + (g.k !== "TBA" && g.k < NOW ? " past" : "") + '">' +
      '<h3 class="pdayh">' + esc(dayLabel(g.k)) +
      '<span class="pdayn">' + g.items.length + "</span></h3>" +
      g.items.map(function (e) {
        var hit = cm[dupKey(e)] || [], a = assess(e);
        var m = mapFor(e), w = e.d ? parseWhen(e.n) : null;
        var isDrop = !!w && isDropIn(w);
        return '<article class="pl' + (hit.length ? " hit" : "") + (a.ok ? "" : " off") + '">' +
          '<div class="plt">' + esc(whenLabel(e)) +
            (!e.d ? '<span class="plnod">no date</span>' : "") + "</div>" +
          '<div class="plb"><h4>' + esc(title(e)) + "</h4>" +
            '<p class="plw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) +
              mapLink(e) + (m ? "" : '<span class="nomap"> — nothing here a map can find</span>') +
              (e.h ? ' <span class="pdot">·</span> ' + esc(e.h) : "") + "</p>" +
            (hit.length ? '<p class="plclash"><b>Overlaps</b> ' + hit.map(function (o) {
                return esc(title(o)) + " (" + esc(whenLabel(o)) + ")";
              }).join("; ") + "</p>" : "") +
            (isDrop ? '<p class="pldrop"><b>Open most of the day</b> — not counted as ' +
              "clashing with anything above. Fit it in where it suits you.</p>" : "") +
            (a.ok ? "" : '<p class="ploff">Not on your current board — ' + esc(a.reason) +
              ". It stays in your plan; change the band above to see it.</p>") +
            regRow(e) +
            /* The controls belong beside the event they act on, not pinned to a
               far gutter with 900px of white between. Reading order matters too:
               the card is what a student wants, the calendar file is a task, and
               removing something is a quiet correction, not the loudest thing here. */
            '<div class="plx">' +
              '<button class="abtn ghost small" data-id="' + e.__i + '">Details</button>' +
              (e.d ? '<button class="lkb" data-ics="' + e.__i + '">Add to calendar</button>'
                   : '<span class="noics small">no date &mdash; cannot go in a calendar</span>') +
              pickBtn(e, "row") +
            "</div>" +
          "</div></article>";
      }).join("") + "</section>";
  }).join("") + "</div>";

  if (offBoard.length)
    h += '<p class="planfoot">' + offBoard.length + " event" + (offBoard.length === 1 ? "" : "s") +
      " in your plan " + (offBoard.length === 1 ? "is" : "are") + " not on the board you are " +
      "currently looking at. Nothing has been removed — the identity band decides what the " +
      "board shows, and your plan outlives it.</p>";
  return h;
}

/* ---- registration triage -----------------------------------------------
   Two different things, kept apart. Laurier puts a "Register Now!" banner at the
   top of a schedule page and the extractor copies it onto every event on that
   page — 189 of them from one banner. That is one registration for the whole
   orientation, and listing it 189 times would tell a student to do it 189 times.
   It is stated once, at the top. Below it are the registrations that genuinely
   belong to a single event: its own links and the links in the accordion section
   it sits under.
------------------------------------------------------------------------- */
function regHtml(list) {
  var mine = list.filter(function (e) { return assess(e).ok; });
  var seen = {}, own = [];
  mine.forEach(function (e) {
    var k = dupKey(e);
    if (needsReg(e) && !seen[k]) { seen[k] = 1; own.push(e); }
  });
  own = sortRun(own);
  var wide = pageRegGroups(mine);
  var done = own.filter(isDone).length;

  var h = '<div class="reghead"><div class="planin"><h2>To register</h2>' +
    '<p class="lede">What still needs booking before you turn up. Ticking something off is ' +
    "kept in this browser, like your plan.</p></div></div>";

  if (wide.length) {
    h += '<section class="regwide"><h3>Orientation itself</h3>' +
      '<p class="lede">Laurier prints ' + (wide.length === 1 ? "this" : "these") +
      " at the top of the schedule page" + (wide.length === 1 ? "" : "s") +
      " rather than against any one event. " + (wide.length === 1 ? "It covers" : "They cover") +
      " the whole orientation, so " + (wide.length === 1 ? "it is" : "they are") +
      " listed once here instead of against each of the " +
      wide.reduce(function (n, x) { return n + x.n; }, 0) + " events carrying " +
      (wide.length === 1 ? "it" : "them") + ". Laurier gives them all the same words, so " +
      "each is labelled with the schedule it was printed on.</p><ul class=\"reglist\">" +
      wide.map(function (x) {
        return '<li class="' + (x.mine ? "regmine" : "regother") + '">' +
          '<p class="regfrom">On Laurier&rsquo;s <b>' + esc(x.pages.join(" and ")) +
            "</b>" + (x.mine ? " — the schedule for your level" : "") + "</p>" +
          '<a class="lk primary" href="' + esc(x.href) + '" target="_blank" rel="noopener">' +
            esc(x.text) + " →</a>" +
          '<span class="regurl">' + esc(x.href) + "</span></li>";
      }).join("") + "</ul></section>";
    if (!wide.some(function (x) { return x.mine; })) {
      h = h.replace("</ul></section>",
        '</ul><p class="regnone">None of these was printed on a ' +
        esc(LEVELWORD[sel.level] || sel.level) + " schedule — Laurier does not repeat its " +
        "own registration banner on every page, and the events on your board come from " +
        "elsewhere. Its schedule pages are listed in full at the foot of this page.</p>" +
        "</section>");
    }
  }

  if (!own.length) {
    h += '<div class="empty"><p>No event on your board carries a registration or ticket link ' +
      "of its own.</p><p>" + (wide.length ? "Only the orientation-wide registration above applies to you."
        : "Nothing here needs booking.") + "</p></div>";
    return h;
  }

  h += '<section class="regown"><h3>These events, one by one</h3>' +
    '<p class="lede"><b>' + own.length + "</b> event" + (own.length === 1 ? "" : "s") +
    " on your board " + (own.length === 1 ? "carries" : "carry") +
    " a registration, RSVP or ticket link of " + (own.length === 1 ? "its" : "their") + " own. " +
    "<b>" + done + "</b> ticked off.</p>" +
    byDay(own).map(function (g) {
      return '<div class="rgday' + (g.k !== "TBA" && g.k < NOW ? " past" : "") + '">' +
        '<h4 class="pdayh">' + esc(dayLabel(g.k)) + "</h4>" +
        g.items.map(function (e) {
          var d = isDone(e);
          return '<article class="rg' + (d ? " done" : "") + '">' +
            '<button class="tickoff' + (d ? " on" : "") + '" data-done="' + esc(dupKey(e)) +
              '" aria-pressed="' + d + '" aria-label="Mark ' + esc(title(e)) +
              ' as registered" title="' + (d ? "Registered — click to untick"
                                             : "Tick this when you have registered") +
              '"><span aria-hidden="true">' + (d ? "✓" : "&nbsp;") + "</span></button>" +
            '<div class="rgb"><h5>' + esc(title(e)) + "</h5>" +
              '<p class="rgm">' + esc(whenLabel(e)) + ' <span class="pdot">·</span> ' +
              esc(e.w || (e.vr ? "Online" : "Venue not published")) + mapLink(e) + "</p>" +
              '<p class="plreg">' + regLinksOf(e).map(function (l) {
                return '<a class="lk primary" href="' + esc(l.href) + '" target="_blank" ' +
                  'rel="noopener">' + esc(l.text) + " →</a>";
              }).join(" ") + "</p>" +
              '<div class="plx">' +
                '<button class="abtn ghost small" data-id="' + e.__i + '">Details</button>' +
                pickBtn(e, "reg") +
              "</div></div></article>";
        }).join("") + "</div>";
    }).join("") + "</section>";
  return h;
}

/* ---- the printed schedule ----------------------------------------------
   A printed page cannot be clicked, so every URL is written out in full and
   nothing that only works on screen is put on it: no chooser, no navigator, no
   view buttons, no clock drawing, no colour doing a job that words should do.
   It prints the plan if there is one, and otherwise the board as filtered, and
   it says at the top which of those it is.

   This is built into the document on every redraw rather than assembled when the
   print dialog opens, so Ctrl+P prints the same thing as the button does.
------------------------------------------------------------------------- */
/* Who the sheet is for, in one line, shared by both printed documents. */
function printWho() {
  return (META.levelLabels[sel.level] || sel.level) + " · " + sel.campus +
    " campus · " + sel.term +
    (sel.streams.length ? " · also " + sel.streams.map(streamLabel).join(", ") : "") +
    (sel.program && sel.program !== NO_PROGRAM ? " · program: " + sel.program : "") +
    (sel.program === NO_PROGRAM ? " · program welcomes hidden" : "");
}

/* The registration list is the second thing here worth carrying on paper: a
   checklist you tick with a pen, with the booking URL written out because a
   printed page cannot be clicked. Printing from that view prints that, not the
   schedule — anything else prints something the student was not looking at. */
function printRegHtml() {
  var mine = visible().filter(function (e) { return assess(e).ok; });
  var seen = {}, own = [];
  mine.forEach(function (e) {
    var k = dupKey(e);
    if (needsReg(e) && !seen[k]) { seen[k] = 1; own.push(e); }
  });
  own = sortRun(own);
  var wide = pageRegGroups(mine);
  var done = own.filter(isDone).length;

  PRWHAT = "What I still have to book";
  var h = '<div class="prsheet"><header class="prhead">' +
    '<p class="prcrest">Wilfrid Laurier University · Orientation</p>' +
    "<h1>What I still have to book</h1>" +
    '<p class="prwho">' + esc(printWho()) + "</p>" +
    '<p class="prwhat">' + own.length + " event" + (own.length === 1 ? "" : "s") +
      " on my board " + (own.length === 1 ? "carries" : "carry") + " a registration, RSVP or " +
      "ticket link of " + (own.length === 1 ? "its" : "their") + " own; " + done +
      " already ticked off. Compiled from Laurier's published schedules on " + META.compiled + ".</p>" +
    "</header>";

  if (wide.length) {
    h += '<section class="prreg"><h2>Register for orientation itself</h2>' +
      wide.map(function (x) {
        return '<p class="prurl"><b>' + esc(x.text) + "</b> — on Laurier&rsquo;s " +
          esc(x.pages.join(" and ")) + (x.mine ? " (the schedule for your level)" : "") +
          "<br>" + esc(x.href) + "</p>";
      }).join("") + "</section>";
  }
  if (!own.length) {
    h += '<p class="prnone">No event on this board carries a registration or ticket link ' +
      "of its own.</p>";
  }
  h += byDay(own).map(function (g) {
    return '<section class="prday"><h2>' + esc(dayLabel(g.k)) + "</h2>" +
      printRunHead() +
      g.items.map(function (e) {
        var m = mapFor(e), d = isDone(e);
        return '<div class="prev prreg-ev' + (d ? " prdone" : "") + '">' +
          '<p class="prt"><span class="prbox">' + (d ? "×" : "&nbsp;") + "</span> " +
            esc(whenLabel(e)) + "</p>" +
          '<div class="prbody"><p class="prn">' + esc(title(e)) + "</p>" +
            '<p class="prw"><b>Where:</b> ' +
              esc(e.w || (e.vr ? "Online" : "Venue not published by Laurier")) +
              (m && m.tail ? " · " + esc(m.tail) : "") + "</p>" +
            regLinksOf(e).map(function (l) {
              return '<p class="prurl"><b>Register (' + esc(l.text) + ")</b><br>" +
                esc(l.href) + "</p>";
            }).join("") +
            '<p class="prcite">Cited from ' + esc(e.u) + "</p>" +
          "</div></div>";
      }).join("") + "</section>";
  }).join("");
  h += '<footer class="prfoot"><p>Printed from the Laurier Orientation Event Finder, ' +
    "compiled " + META.compiled + " from " + META.nSources + " published Laurier schedules. " +
    "Laurier updates these continuously — reconfirm a deadline before relying on it.</p>" +
    "</footer></div>";
  return h;
}

/* ---- the printed schedule, drawn as a timetable -------------------------
   On screen this page's whole argument is the clock. Printed as a list it threw
   that away: paragraph after paragraph, with no way to see that Tuesday
   afternoon is free and Wednesday morning is three deep. So paper gets the clock
   too — one grid a day, the hours down the left, each event a box in its own
   slot, as tall as it is long.

   A grid cannot carry everything a list can. It has no room for a web address,
   and paper cannot be clicked, so under each day's grid the same events are
   written out in the same order, numbered to match the boxes, with the venue,
   the host, what Laurier says about who may come, anything it overlaps, and
   every registration and citation address spelled out in full.

   Past four events running at once a box is narrower than a word. That day drops
   to the written list on its own, and the page says why rather than printing a
   grid nobody can read.
------------------------------------------------------------------------- */
/* Measured rather than assumed. The printed grid is the page width less the
   hour gutter: on A4 with 12mm margins that is about 510pt, so five abreast is
   102pt a box and six is 85pt. Four was a guess, and it cost a Tuesday its
   twenty-one names on a sheet that was 45% white space — a key with no lock,
   with the reader sent three pages on to find out what any of it was. */
var PR_LANES = 5;      // the most a printed day can stack and still name its events
var PR_LANES_MAX = 6;  // past that a box holds a number and a time, and nothing else
var PR_PT_HOUR = 30;   // points per hour at full scale
var PR_PT_GAP = 13;    // a collapsed stretch of nothing, named rather than drawn
var PR_PT_MAX = 560;   // the tallest grid that still leaves the page room to breathe

function printGrid(items, named, of) {
  /* The same piecewise axis the screen uses: occupied stretches run to scale,
     and a hole of two hours or more collapses to a band that names the hours it
     stands for. Drawn to scale, one quiet Saturday was five inches of ruled
     nothing, and paper does not scroll. */
  var sc = makeScale(items, PR_PT_HOUR / 60, PR_PT_GAP);
  if (sc.H > PR_PT_MAX) sc = makeScale(items, (PR_PT_HOUR * PR_PT_MAX / sc.H) / 60, PR_PT_GAP);
  var h = '<div class="prcal" style="height:' + (sc.H + 3).toFixed(1) + 'pt">';
  sc.blocks.forEach(function (bl) {
    if (bl.gap) {
      h += '<div class="prgap" style="top:' + bl.y.toFixed(1) + "pt;height:" +
        bl.h.toFixed(1) + 'pt"><span>' + esc(of || "nothing published") + " between " +
        esc(clock(bl.a)) + " and " + esc(clock(bl.b)) + "</span></div>";
      return;
    }
    for (var m = Math.ceil(bl.a / 60) * 60; m <= bl.b; m += 60) {
      h += '<div class="prhr" style="top:' + sc.pos(m).toFixed(1) + 'pt"><span>' +
        esc(hourLabel(m)) + "</span></div>";
    }
  });
  h += '<div class="prslots">' + items.map(function (it) {
    var u = 100 / it.ncol, left = it.col * u;
    var w = u * Math.min(it.span || 1, it.ncol - it.col);
    var top = sc.pos(it.s), bot = sc.pos(it.de);
    return '<div class="prslot' + (isPicked(it.ev) ? " prmine" : "") + '" style="top:' +
      top.toFixed(1) + "pt;height:" + Math.max(13, bot - top - 1.5).toFixed(1) +
      "pt;left:" + left.toFixed(2) + "%;width:calc(" + w.toFixed(2) + '% - 2.5pt)">' +
      '<span class="prno">' + it.no + "</span>" +
      '<span class="prslott">' + esc(clock(it.s)) + "–" + esc(clock(it.e)) + "</span>" +
      (named ? '<span class="prslotn">' + esc(title(it.ev)) + "</span>" : "") + "</div>";
  }).join("") + "</div></div>";
  return h;
}

/* A printed sheet that starts in the middle of a day used to run ten entries
   before naming one, because the date lived only in the heading above. Every
   entry carries its own day now: three words in the time column, and no sheet
   of a nine-page schedule is anonymous. */
function shortDay(k) {
  if (!k || k === "TBA") return "No date";
  var dt = new Date(k + "T00:00:00");
  return DOW3[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()];
}

/* One event, written out. The grid says when; this says everything else, and it
   is the only place a printed page can put a web address. */
function printEntry(e, no, hit, common) {
  var m = mapFor(e), src = sourcesOf(e);
  var pw = e.d ? parseWhen(e.n) : null;
  var isDrop = !!pw && isDropIn(pw), a = assess(e);
  var bits = [];
  if (e.h) bits.push("Host: " + e.h);
  /* The detail sheet has always got this right -- a.ok ? audienceLine(e) :
     a.reason -- and paper had not. audienceLine() falls back to "Open to you",
     which means "matches the level, campus, term and streams you gave", and
     77 events are stream-gated with no audience Laurier ever published, so
     every one of them printed "Open to you" directly above a note saying it
     was not on the board you were looking at. A pick reaches paper whenever a
     stream it needs is not currently ticked, so this was not a corner case.
     Laurier's own reason is the honest line, and the note below no longer
     repeats it. */
  bits.push(a.ok ? audienceLine(e) : a.reason);
  if (e.c) bits.push("Cost: " + e.c);
  return '<div class="prev">' +
    '<p class="prt"><span class="prno">' + no + "</span> " +
      '<span class="prday-lab">' + esc(shortDay(e.d)) + "</span> " +
      esc(whenLabel(e)) + "</p>" +
    '<div class="prbody">' +
      '<p class="prn">' + esc(title(e)) + "</p>" +
      '<p class="prw"><b>Where:</b> ' +
        esc(e.w || (e.vr ? "Online" : "Venue not published by Laurier")) +
        (m && m.tail ? " · " + esc(m.tail) : "") + "</p>" +
      '<p class="prm">' + esc(bits.join(" · ")) + "</p>" +
      (a.ok ? "" : '<p class="proff"><b>Note:</b> not on the board you were ' +
        "looking at.</p>") +
      (hit && hit.length ? '<p class="prc"><b>Overlaps:</b> ' + esc(hit.map(function (o) {
          return title(o) + " (" + whenLabel(o) + ")";
        }).join("; ")) + "</p>" : "") +
      (isDrop ? '<p class="prc"><b>Open most of the day:</b> not counted as clashing ' +
        "with anything above.</p>" : "") +
      regLinksOf(e).map(function (l) {
        return '<p class="prurl"><b>Register (' + esc(l.text) + ")</b><br>" +
          esc(l.href) + "</p>";
      }).join("") +
      (common && src.length === 1 && src[0].u === common ? "" :
        '<p class="prcite">Cited from ' +
          (src.length > 1 ? src.length + " Laurier pages<br>" : "") +
          src.map(function (o) { return esc(o.u); }).join("<br>") + "</p>") +
    "</div></div>";
}

/* Who the sheet is for and what is on it, in the two lines that make a printed
   page unambiguous once it is off the screen. The heading differs deliberately
   between the two cases: a board printed because nothing was ticked must not be
   mistaken for a schedule somebody chose. */
/* Repeated under every day heading, so no sheet of a multi-page schedule is
   anonymous once it is separated from the others. */
var PRWHAT = "";
function printRunHead() {
  return PRWHAT ? '<p class="prrun"><b>' + esc(PRWHAT) + "</b> · " +
    esc(printWho()) + "</p>" : "";
}

function printSheetHead(usingPlan, list) {
  PRWHAT = usingPlan ? "My orientation schedule" : "Everything I may attend";
  return '<div class="prsheet"><header class="prhead">' +
    '<p class="prcrest">Wilfrid Laurier University · Orientation</p>' +
    "<h1>" + (usingPlan ? "My orientation schedule" : "Everything I may attend") + "</h1>" +
    '<p class="prwho">' + esc(printWho()) + "</p>" +
    '<p class="prwhat">' + (usingPlan
      ? "The " + list.length + " event" + (list.length === 1 ? "" : "s") +
        " I ticked, and nothing else — this is my plan, not the whole board."
      : "Nothing is ticked, so this is not a chosen schedule: it is every event I am " +
        "eligible for" + (q ? ' matching the search "' + esc(q) + '"' : "") + ", " +
        list.length + " in all.") + " " +
    (planCal
      ? "Drawn on the clock, a day at a time; the venues and the web addresses are " +
        "collected at the end, because a grid has room for neither."
      : "Written out in time order, with the venue, the host and every web address " +
        "against each event.") +
    " Compiled from Laurier’s published schedules on " + META.compiled + ".</p></header>";
}

/* ---- the addresses a grid cannot carry ----------------------------------
   A calendar is a shape. It has no room for a room name and none at all for a
   web address, and paper cannot be clicked, so the registration links — which
   are how a student actually gets a place — would simply be gone. They are
   collected here instead, in the same numbers as the boxes above, each with its
   venue and any citation the day's own line did not already cover. Nothing the
   grid or the day heading has already said is repeated. */
function printAddresses(days) {
  if (!days.length) return "";
  var body = days.map(function (d) {
    return '<section class="pradday"><h3>' + esc(dayLabel(d.k)) + "</h3>" +
      printRunHead() +
      d.entries.map(function (e) {
        var m = mapFor(e), src = sourcesOf(e), a = assess(e);
        var covered = d.common && src.length === 1 && src[0].u === d.common;
        /* The grid can say when. It cannot say who is running the thing or
           what Laurier says about who may come, and a sheet that drops both is
           a sheet a student has to go back to a laptop for. */
        var bits = [];
        if (e.h) bits.push("Host: " + e.h);
        bits.push(a.ok ? audienceLine(e) : a.reason);
        if (e.c) bits.push("Cost: " + e.c);
        return '<p class="prad"><span class="prno">' + d.no[e.__i] + "</span> " +
          '<span class="prday-lab">' + esc(shortDay(e.d)) + "</span> " +
          esc(whenLabel(e)) + " · <b>" + esc(title(e)) + "</b><br>" +
          /* Labelled the way the written entries label it, so one line of a
             printed sheet means the same thing in both documents — and so a
             gate can count entries without knowing which document it is
             holding. */
          "<b>Where:</b> " +
          esc(e.w || (e.vr ? "Online" : "Venue not published by Laurier")) +
          (m && m.tail ? " · " + esc(m.tail) : "") +
          "<br>" + esc(bits.join(" · ")) +
          (a.ok ? "" : "<br>Not on the board I was looking at.") +
          regLinksOf(e).map(function (l) {
            return "<br>Register (" + esc(l.text) + "): " + esc(l.href);
          }).join("") +
          (covered ? "" : "<br>Cited from " +
            src.map(function (o) { return esc(o.u); }).join("; ")) +
          "</p>";
      }).join("") + "</section>";
  }).join("");
  return '<section class="praddr"><h2>Where each one is, and how to book it</h2>' +
    '<p class="prlede">The numbers are the numbers in the boxes above. Every venue, ' +
    "every registration and ticket address, and every citation a day heading did not " +
    "already carry.</p>" + body + "</section>";
}

/* ---- the printed schedule -----------------------------------------------
   One document, never two. This used to print the calendar grid and then the
   numbered list of the same events underneath it — the whole schedule twice,
   and four sheets of paper where two would do. The reader has already said how
   they read their plan; paper follows that choice rather than hedging.

   And what prints is what was ticked. If the plan holds anything, the plan is
   the document: the board is neither appended to it nor set beside it, because
   a sheet that mixes the two is a sheet a student cannot trust to be their own.
   With nothing ticked there is no choice to honour, so the whole eligible board
   prints — under a heading that says plainly that is what it is, so it cannot
   be mistaken later for a schedule somebody put together.
------------------------------------------------------------------------- */
function printHtml() {
  if (view === "reg") return printRegHtml();
  var picks = planEvents();
  var usingPlan = picks.length > 0;
  var list = usingPlan ? picks : sortRun(visible().filter(function (e) { return assess(e).ok; }));
  var cm = usingPlan ? clashMap() : {};

  var h = printSheetHead(usingPlan, list);

  var wide = pageRegGroups(list);
  if (wide.length) {
    h += '<section class="prreg"><h2>Register for orientation itself</h2>' +
      wide.map(function (x) {
        return '<p class="prurl"><b>' + esc(x.text) + "</b> — on Laurier&rsquo;s " +
          esc(x.pages.join(" and ")) + (x.mine ? " (the schedule for your level)" : "") +
          "<br>" + esc(x.href) + "</p>";
      }).join("") + "</section>";
  }

  if (!list.length) {
    h += '<p class="prnone">There is nothing to print: no event on this board.</p>';
  }

  var appendix = [];

  h += byDay(list).map(function (g) {
    var parts = split(g.items);
    var items = placed(parts.timed, 30);
    var lanes = items.reduce(function (mx, it) { return Math.max(mx, it.ncol); }, 0);

    /* Numbered down the day and, within one start time, left to right across
       the grid — the 5pm row read 18, 14, 15, 16, 17 when the numbers came from
       the time sort alone and the columns came from the placement. Both
       documents number the same way, so block 3 on the calendar and entry 3 in
       the list are the same event. */
    var col = {};
    items.forEach(function (it) { col[it.ev.__i] = it.col; });
    var ordered = sortRun(g.items).slice().sort(function (a, b) {
      var aw = parseWhen(a.n), bw = parseWhen(b.n);
      var as = aw ? aw.s : 1e6, bs = bw ? bw.s : 1e6;
      if (as !== bs) return as - bs;
      return (col[a.__i] === undefined ? 99 : col[a.__i]) -
             (col[b.__i] === undefined ? 99 : col[b.__i]);
    });
    var no = {};
    ordered.forEach(function (e, i) { no[e.__i] = i + 1; });
    items.forEach(function (it) { it.no = no[it.ev.__i]; });

    /* Nearly every event on a day comes from the same page of Laurier's site.
       Printed under each of them that address filled most of the sheet: eleven
       events, eleven copies of one URL. It is stated once under the day, and
       only the entries that came from somewhere else carry their own. */
    var seen = {}, common = null;
    g.items.forEach(function (e) {
      var src = sourcesOf(e);
      if (src.length !== 1) return;          // published twice: it cites both, always
      seen[src[0].u] = (seen[src[0].u] || 0) + 1;
      if (!common || seen[src[0].u] > seen[common]) common = src[0].u;
    });
    if (!common || seen[common] < 3) common = null;

    var head = '<section class="prday"><h2>' + esc(dayLabel(g.k)) + "</h2>" +
      printRunHead() +
      (common ? '<p class="prdaycite">Every entry below is cited from ' +
        esc(common) + "</p>" : "");

    if (parts.long.length) {
      head += '<p class="prallday"><b>Open most of the day</b> ' +
        parts.long.map(function (it) {
          return "<span>" + no[it.ev.__i] + " " + esc(title(it.ev)) + ", " +
            esc(clock(it.s)) + "–" + esc(clock(it.e)) + "</span>";
        }).join("") + "</p>";
    }

    var loose = parts.loose.length
      ? '<p class="prloose"><b>No clock time published</b> ' +
        parts.loose.map(function (e) {
          return "<span>" + no[e.__i] + " " + esc(title(e)) + "</span>";
        }).join("") + "</p>"
      : "";

    var written = '<div class="prdetail">' + ordered.map(function (e) {
      return printEntry(e, no[e.__i], cm[dupKey(e)] || [], common);
    }).join("") + "</div>";

    if (!planCal) return head + loose + written + "</section>";

    /* How much a box can hold depends on how many have to share the width. Four
       abreast on an A4 page is about 110pt each and a name fits. Six is 70pt,
       which fits a number and a time and would chop a name in half, so the boxes
       keep the shape of the day and the address list at the end carries the
       names. Past six even that is a smear of hairlines, and the day is better
       read as a list — which is what it becomes, with the reason printed above. */
    var drew = false;
    if (items.length && lanes <= PR_LANES_MAX) {
      if (lanes > PR_LANES) {
        head += '<p class="prwhy">' + lanes + " of these run at once, so the blocks below " +
          "carry their number and their time; read the names off the list at the end.</p>";
      }
      head += printGrid(items, lanes <= PR_LANES,
        usingPlan ? "nothing in my plan" : "nothing published");
      drew = true;
    } else if (items.length) {
      head += '<p class="prwhy">' + lanes + " of these run at the same time. Drawn " +
        lanes + " abreast each block is a hairline, too narrow to carry even its own " +
        "number, so this day alone is written out in time order rather than drawn.</p>";
    }

    /* The stated fallback writes that one day out in full, so it needs nothing
       from the address list and would otherwise be printed twice. */
    if (!drew && items.length) return head + loose + written + "</section>";
    appendix.push({ k: g.k, entries: ordered, no: no, common: common });
    return head + loose + "</section>";
  }).join("");

  if (planCal) h += printAddresses(appendix);

  h += '<footer class="prfoot"><p>Printed from the Laurier Orientation Event Finder, ' +
    "compiled " + META.compiled + " from " + META.nSources + " published Laurier schedules. " +
    "Laurier updates these continuously — reconfirm before travelling to a venue. " +
    "Eligibility shown here is an interpretation of each page's stated audience, not an " +
    "official ruling.</p></footer></div>";
  return h;
}

function drawPrint() {
  var n = $("printout");
  if (n) n.innerHTML = printHtml();
}

function wireBlocks() {
  [].slice.call(document.querySelectorAll("#board [data-id]")).forEach(function (n) {
    n.onclick = function (ev) {
      /* a link or a button drawn inside a card is its own target — clicking the
         map link must open the map, not the card behind it */
      if (ev.target.closest && ev.target.closest("a,button") &&
          ev.target.closest("a,button") !== n) return;
      openSheet(+n.dataset.id);
    };
    n.onkeydown = function (ev) {
      /* the tick button lives inside the card; Enter on it must tick, not also
         open the card behind it */
      if (ev.target !== n) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openSheet(+n.dataset.id); }
    };
  });
  [].slice.call(document.querySelectorAll(".dhead[data-day], .smore[data-day], .peakbtn[data-day], .wkday[data-day], .clwhen[data-day]")).forEach(function (b) {
    b.onclick = function (ev) { ev.stopPropagation(); day = b.dataset.day; view = "day"; redraw(); };
  });
  var mb = document.querySelector("[data-mode]");
  if (mb) mb.onclick = function () { asList = !asList; redraw(); };
  [].slice.call(document.querySelectorAll("[data-step]")).forEach(function (b) {
    b.onclick = function () {
      var keys = dayKeys(visible()), i = keys.indexOf(day) + (+b.dataset.step);
      if (i >= 0 && i < keys.length) { day = keys[i]; redraw(); }
    };
  });
  wireDoing();
}

/* Every control that changes the plan, exports it or prints it. The sheet is
   redrawn along with the board where it is open, so a tick made inside it does
   not leave the card behind saying the opposite of the board. */
function wireDoing() {
  [].slice.call(document.querySelectorAll("[data-pick]")).forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var open = $("sheet").hidden ? null : picked;
      togglePick(b.dataset.pick);
      redraw();
      if (open !== null) openSheet(open);
    };
  });
  [].slice.call(document.querySelectorAll("[data-done]")).forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      toggleDone(b.dataset.done);
      redraw();
    };
  });
  [].slice.call(document.querySelectorAll("[data-ics]")).forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      var e = EV[+b.dataset.ics];
      if (!e) return;
      icsDownload([e], title(e), "laurier-" + (slug(title(e)) || "event") + ".ics");
    };
  });
  [].slice.call(document.querySelectorAll("#board [data-view]")).forEach(function (b) {
    b.onclick = function () { view = b.dataset.view; redraw(); window.scrollTo({ top: 0 }); };
  });
  [].slice.call(document.querySelectorAll("[data-planview]")).forEach(function (b) {
    b.onclick = function () {
      planCal = b.dataset.planview === "cal";
      redraw();
    };
  });
  var dl = $("dlplan");
  if (dl) dl.onclick = function () {
    icsDownload(planEvents(), "Laurier Orientation — my plan", "laurier-orientation-plan.ics");
  };
  var pr = $("printplan");
  if (pr) pr.onclick = function () { window.print(); };
  var cl = $("clearplan");
  if (cl) cl.onclick = function () {
    if (!confirm("Empty your plan? " + planEvents().length +
                 " ticked events will be forgotten on this device.")) return;
    PLAN = {}; lsWrite(LSPLAN, PLAN); redraw();
  };
  var q2 = $("qclr2");
  if (q2) q2.onclick = function () { q = ""; redraw(); };
}

/* ---- the detail sheet --------------------------------------------------- */
function openSheet(i) {
  var e = EV[i]; if (!e) return;
  picked = i;
  var a = assess(e), dt = e.d ? new Date(e.d + "T00:00:00") : null;
  var when = e.d
    ? DOW[dt.getDay()] + ", " + MON[dt.getMonth()] + ". " + dt.getDate() + ", " + dt.getFullYear() + (stripLead(e.n, e.d) ? " — " + esc(stripLead(e.n, e.d)) : "")
    : (e.n ? esc(e.n) : "Date not published");

  var facts = "";
  function row(k, v) { if (v) facts += "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
  row("When", when);
  /* Laurier publishes a few programme welcomes as one panel covering several
     days. Each day is its own entry so it lands on the right day of the board;
     without this the student who opens day two sees one isolated afternoon and
     no sign that the welcome started yesterday and continues tomorrow. */
  row("More days", e.ro ? "Laurier publishes this welcome as one event running "
      + esc(e.ro).replace(/\.$/, "") + ". Each of those days is on this board on its own."  : "");
  var mp = mapFor(e);
  row("Where", e.w
    ? esc(e.w) + mapLink(e) +
      (mp ? "" : '<span class="nomap"> — nothing here a map can find</span>')
    : (e.vr ? "Online" : "Not published by Laurier"));
  row("Part of", esc(e.pt));
  row("Host", esc(e.h));
  row("Audience", esc(e.a));
  row("Cost", esc(e.c));
  row("Stream", (e.tg || []).length ? esc((e.tg || []).join(", ")) : "");
  if (e.s && /Program and Faculty Welcomes/i.test(e.s))
    row("Note", "This is a welcome for one specific program. Attend only the one matching your own.");
  row("Schedule", esc(e.lv === "all" ? "All levels" : e.lv) + " &middot; " +
      (e.vr ? "Online — open to all campuses" : esc((e.cp || []).join(", "))) + " &middot; " + esc(e.tm));
  Object.keys(e.si || {}).forEach(function (k) { row(k, esc(e.si[k])); });

  /* Every page this event was published on, and every link any of them carries. */
  var src = sourcesOf(e);
  var links = linksOf(e);
  /* Registration is the only one of these with a deadline attached, so it leads
     and it is the only filled button. The rest are references. */
  var linkHtml = links.length ? '<div class="links">' + links.slice().sort(function (x, y) {
      return (REGRE.test(y.text || "") ? 1 : 0) - (REGRE.test(x.text || "") ? 1 : 0);
    }).map(function (l) {
      if (isDead(l.href))
        return '<span class="lk dead" title="' + esc(l.href) + '">' + esc(l.text) +
               " — link broken on Laurier’s site</span>";
      return '<a class="lk' + (REGRE.test(l.text || "") ? " primary" : "") + '" href="' +
        esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + " →</a>";
    }).join("") + "</div>" : "";

  var flagHtml = (e.f || []).length
    ? '<p class="flag">Not published by Laurier: ' + (e.f || []).map(function (f) {
        return { "no-date": "date", "no-time": "time", "no-venue": "venue" }[f] || f;
      }).join(", ") + ".</p>" : "";

  /* Laurier publishes the same event on several of its schedule pages. It is one
     event and it is shown once; every place it was published is named below, so
     a student who found it somewhere else can still see where. */
  var dupNote = src.length > 1 ? '<p class="dupnote">Laurier publishes this on <b>' +
    src.length + " of its schedule pages</b>. It is one event, shown once — " +
    "every page it appears on is listed at the foot of this card.</p>" : "";

  /* Where this event sits in its day, and what it runs into. This is the one
     thing a clock can say that a list cannot, so the sheet leads with it. */
  var ribbon = "";
  if (e.d) {
    var mine = parseWhen(e.n);
    var dayTimed = split(EV.filter(function (o) {
      return o.d === e.d && (ghosts || assess(o).ok);
    })).timed;
    if (mine && dayTimed.length > 1) {
      var lo = Math.min.apply(null, dayTimed.map(function (x) { return x.s; }));
      var hi = Math.max.apply(null, dayTimed.map(function (x) { return x.e; }));
      var w = Math.max(1, hi - lo);
      ribbon = '<div class="tribbon"><div class="trbar">' + dayTimed.map(function (x) {
        var isMe = x.ev === e;
        var over = !isMe && x.s < mine.e && mine.s < x.e;
        return '<span class="tk' + (isMe ? " me" : (over ? " hit" : "")) + '" style="left:' +
          (100 * (x.s - lo) / w) + "%;width:" + Math.max(0.9, 100 * (x.e - x.s) / w) + '%" title="' +
          esc(clock(x.s) + " " + x.ev.t) + '"></span>';
      }).join("") + '</div><div class="trends"><span>' + clock(lo) + "</span><span>" +
        clock(hi) + '</span></div><p class="trcap">Where this sits in ' +
        DOW[new Date(e.d + "T00:00:00").getDay()] + "’s run: purple is this " +
        "event, gold is what it collides with, grey is everything else that day.</p></div>";
    }
  }

  var others = collidesWith(e);
  var clashList = others.length
    ? '<div class="clashbox"><h4>Runs at the same time as</h4><ul>' +
      others.map(function (o) {
        return "<li><b>" + esc(title(o)) + "</b><span>" + esc(o.n) + "</span></li>";
      }).join("") + "</ul></div>"
    : "";

  $("sheet").innerHTML =
    '<button class="sclose" id="sclose">Close</button>' +
    '<div class="sbody">' +
      '<div class="skick' + (a.ok ? "" : " no") + '">' +
        (a.ok ? esc(audienceLine(e)) : esc(a.reason)) +
        (e.vr ? " · Online" : "") + "</div>" +
      '<h3 id="sheettitle">' + esc(title(e)) + "</h3>" +
      (e.pt ? '<p class="sparent">Part of ' + esc(e.pt) + "</p>" : "") +
      '<div class="sacts">' + pickBtn(e, "sheet") +
        /* the tick is the action a student comes to a card to take, so purple
           filled belongs to it and its state; the calendar file is secondary */
        (e.d ? '<button class="abtn ghost small" data-ics="' + e.__i +
               '">Add to calendar (.ics)</button>'
             : '<span class="noics">No date published — this cannot go in a calendar</span>') +
      "</div>" +
      dupNote + ribbon +
      '<dl class="facts">' + facts + "</dl>" +
      clashList + linkHtml +
      (e.x ? '<div class="sdesc">' + paras(e.x).map(function (t) {
          return "<p>" + esc(t) + "</p>";
        }).join("") + "</div>" : "") + flagHtml +
      '<p class="cite"><strong>' + (src.length > 1
          ? "Cited from " + src.length + " Laurier pages"
          : "Cited from") + "</strong>" +
        src.map(function (o) {
          return '<span class="citeone"><a href="' + esc(o.u) + '" target="_blank" rel="noopener">' +
            esc(o.u) + "</a>" + (o.s ? "<em>" + esc(o.s) + "</em>" : "") + "</span>";
        }).join("") +
        "Read " + META.readOn + ", including the venue, host and registration detail Laurier " +
        "keeps hidden until you open an event.</p>" +
    "</div>";
  $("sheet").hidden = false; $("scrim").hidden = false;
  document.body.classList.add("locked");
  lockBehind(true);
  $("sclose").onclick = closeSheet;
  wireDoing();
  $("sclose").focus();
}
/* A modal that leaves the page behind it reachable by Tab is a modal in
   appearance only. Everything except the sheet and the scrim that dismisses it
   is taken out of the tree while it is open. */
function lockBehind(on) {
  [].slice.call(document.body.children).forEach(function (n) {
    if (n === $("sheet") || n === $("scrim") || n.tagName === "SCRIPT") return;
    if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert");
  });
}
function closeSheet() {
  $("sheet").hidden = true; $("scrim").hidden = true;
  lockBehind(false);
  document.body.classList.remove("locked");
  if (picked !== null) {
    var n = document.querySelector('#board [data-id="' + picked + '"]');
    if (n) n.focus();
  }
  picked = null;
}


/* ---- hash --------------------------------------------------------------- */
function writeHash() {
  var p = "level=" + encodeURIComponent(sel.level) +
          "&campus=" + encodeURIComponent(sel.campus) +
          "&term=" + encodeURIComponent(sel.term);
  if (sel.streams.length) p += "&streams=" + encodeURIComponent(sel.streams.join("|"));
  if (sel.program) p += "&program=" + encodeURIComponent(sel.program);
  p += "&view=" + view;
  if (view === "day" && day) p += "&day=" + day;
  /* Both of these change what is on the screen, so both belong in the link. A
     student who turns on the events they cannot attend and sends the page to a
     friend was sending a different page from the one they were looking at. */
  if (ghosts) p += "&ghosts=1";
  if (asList) p += "&list=1";
  if (planCal) p += "&plan=cal";
  if (q) p += "&q=" + encodeURIComponent(q);
  LASTHASH = "#" + p;
  history.replaceState(null, "", LASTHASH);
}
var LASTHASH = "";
function readHash() {
  var h = location.hash.replace(/^#/, ""), p = {};
  h.split("&").forEach(function (kv) {
    var i = kv.indexOf("=");
    if (i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
  });
  sel = {
    level:  META.levels.indexOf(p.level) >= 0 ? p.level : META.levels[0],
    campus: META.campuses.indexOf(p.campus) >= 0 ? p.campus : META.campuses[0],
    term:   META.terms.indexOf(p.term) >= 0 ? p.term : META.terms[0],
    streams: p.streams ? p.streams.split("|").filter(function (s) { return GATES.indexOf(s) >= 0; }) : [],
    program: p.program || ""
  };
  settle();
  if (["day", "week", "clash", "plan", "reg"].indexOf(p.view) >= 0) view = p.view;
  q = p.q || "";
  ghosts = p.ghosts === "1";
  asList = ghosts || p.list === "1";
  planCal = p.plan === "cal";
  /* a week grid is no use on a phone; the clash list reads fine there */
  if (window.innerWidth < 900 && view === "week") view = "day";
  if (p.day) { day = p.day; if (p.view !== "week") view = "day"; }
  // Land on today if Laurier publishes anything for today; otherwise on the next
  // day that actually has something on the clock, so the first screen is a
  // timetable rather than an empty grid with two untimed notes on it.
  if (!day) {
    var ks = dayKeys(visible());
    var soon = ks.filter(function (k) { return k !== "TBA" && k >= NOW; });
    var busiest = soon.slice().sort(function (x, y) {
      return onDay(visible(), y).length - onDay(visible(), x).length;
    })[0];
    day = ks.indexOf(NOW) >= 0 ? NOW : (busiest || soon[0] || ks[0] || null);
  }
}

/* ---- what Laurier leaves unsettled --------------------------------------
   Four places where its own pages do not answer the question, kept beside the
   sources rather than folded into the events, because a student reading a room
   number should not have to step over them. Each is counted from the data on
   every build, so a note cannot outlive the thing it describes. The counts run
   through onePerEvent because they describe cards a student can see, and the
   board draws one card per event: counting Laurier's listings instead promised
   20 undated Winter sessions where 14 exist. */
function buildNotes() {
  var notes = [];
  var undated = onePerEvent(EV.filter(function (e) { return !e.d; }));
  if (undated.length) {
    var byTerm = {};
    undated.forEach(function (e) { byTerm[e.tm] = (byTerm[e.tm] || 0) + 1; });
    notes.push(["Some events are published without a date",
      undated.length + " events carry no date on Laurier's page (" +
      Object.keys(byTerm).map(function (t) { return byTerm[t] + " in " + t; }).join(", ") +
      "). They cannot be put on the clock, so they are gathered at the end of the " +
      "run under a heading reading “Undated”."]);
  }
  var spring = onePerEvent(EV.filter(function (e) { return e.tm === "Spring 2026" && e.d && e.d.slice(5, 7) === "01"; }));
  if (spring.length) {
    notes.push(["The Spring graduate schedule shows January dates",
      "The page titled “Laurier Spring Orientation: Graduate Schedule” lists its " +
      spring.length + " sessions on Jan. 5, 7 and 9, 2026. January is the winter term at " +
      "Laurier, so the page looks either mislabelled or left over from an earlier cycle. " +
      "The dates are shown exactly as Laurier published them — confirm with " +
      "aspire@wlu.ca before relying on them."]);
  }
  var winter = onePerEvent(EV.filter(function (e) { return e.tm === "Winter 2027"; }));
  if (winter.length && winter.every(function (e) { return !e.d; })) {
    var wVenue = winter.filter(function (e) { return (e.f || []).indexOf("no-venue") === -1; }).length;
    var wTime = winter.filter(function (e) { return (e.f || []).indexOf("no-time") === -1; }).length;
    notes.push(["The Winter 2027 schedule is mostly a placeholder",
      "All " + winter.length + " Winter 2027 events are published without a date, and Laurier " +
      "states registration opens in October 2026. " +
      (wVenue ? wVenue + " of them do give a venue (the online sessions state Zoom); the other " +
                (winter.length - wVenue) + " are TBD. " : "None gives a venue. ") +
      (wTime ? wTime + " give a time." : "None gives a time.")]);
  }
  var prog = onePerEvent(EV.filter(function (e) { return e.pg; })).length;
  if (prog) {
    notes.push(["Program and faculty welcomes say nothing about who may come",
      prog + " events are held for one program or faculty, but Laurier states no audience " +
      "on them, so by default they all show. Use the “My program” dropdown to " +
      "narrow to your own, or choose “Not listed” to hide them all — Laurier " +
      "does not publish a welcome for every program."]);
  }
  if (!notes.length) return;
  $("noteslist").innerHTML = notes.map(function (n, i) {
    return "<li><b>" + String(i + 1).padStart(2, "0") + "</b><div><strong>" + n[0] +
      "</strong><p>" + n[1] + "</p></div></li>";
  }).join("");
  $("notes").hidden = false;
}

/* ---- go ----------------------------------------------------------------- */
EV.forEach(function (e, i) { e.__i = i; });
PLAN = lsRead(LSPLAN);
REGDONE = lsRead(LSREG);
/* A pick is stored against dupKey — title, date, published time and venue — so a
   pick made against a schedule Laurier has since edited matches nothing in a
   rebuilt file. Dropping those without a word would be the page quietly losing a
   student's work, so they are counted and said out loud. */
var LOSTPICKS = (function () {
  var live = {};
  EV.forEach(function (e) { live[dupKey(e)] = 1; });
  return Object.keys(PLAN).filter(function (k) { return !live[k]; }).length;
})();
function lostNote() {
  if (!LOSTPICKS) return "";
  return '<p class="lostnote"><b>' + LOSTPICKS + "</b> event" + (LOSTPICKS === 1 ? "" : "s") +
    " you ticked " + (LOSTPICKS === 1 ? "is" : "are") + " not in this version of the file. " +
    "Laurier edits these schedules continuously; when a time or a venue changes, the tick " +
    "no longer matches anything and cannot be shown. Nothing else in your plan is affected.</p>";
}
readHash();
/* The hash is written here and nowhere else. Two toggles had been added over the
   rounds that redrew the board without updating the link, which is the same
   mistake waiting for the third. Anything that changes the screen goes through
   redraw(), so the link cannot fall behind the screen. */
function redraw() {
  CLASHCACHE = null;
  writeHash(); drawIdbar(); drawNav(); drawBoard(); drawPrint(); announce();
}
/* The tally is rebuilt with the band it sits in, so a live region there would be
   destroyed before anything could read it. This one outlives every redraw. */
var SPOKEN = false;
function announce() {
  var n = $("live");
  if (!n) return;
  var msg = countExact(sel) + " events you can attend" +
    (q ? ", " + visible().filter(function (e) { return ghosts || assess(e).ok; }).length +
         " of them matching “" + q + "”" : "");
  if (SPOKEN) n.textContent = msg;
  SPOKEN = true;
}
redraw();
buildNotes();
$("scrim").onclick = closeSheet;
$("skip").onclick = function () {
  var b = $("board");
  b.focus();
  b.scrollIntoView({ block: "start" });
};
/* A shared link pasted into a tab that is already open used to do nothing at all,
   because the hash was only ever read once. Anything this page wrote itself is
   ignored, so the listener cannot fight writeHash(). */
window.addEventListener("hashchange", function () {
  if (location.hash === LASTHASH) return;
  readHash();
  redraw();
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && !$("sheet").hidden) { closeSheet(); return; }
  if (!$("sheet").hidden) return;
  if (/^(input|select|textarea)$/i.test(ev.target.tagName || "")) return;
  if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
    var keys = dayKeys(visible());
    if (view === "week") { view = "day"; day = day || keys[0]; }
    else {
      var i = keys.indexOf(day) + (ev.key === "ArrowRight" ? 1 : -1);
      if (i < 0 || i >= keys.length) return;
      day = keys[i];
    }
    redraw();
  }
});
