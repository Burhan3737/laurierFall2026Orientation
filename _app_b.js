/* ============================================================================
   THE INDEX — variant B
   Interaction model: a catalogue. No gate; the whole corpus is on screen from
   the first paint. A query bar narrows it, a facet rail with live counts
   narrows it further, a pivot re-files it under a different heading, and one
   selected record is read in a pane that never moves.
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
var SRCT = {};
(META.sources || []).forEach(function (x) { SRCT[x.url] = x.title; });
var STREAM_LABEL = { "Virtual": "Online sessions (Zoom)" };
function streamLabel(t) { return STREAM_LABEL[t] || t; }
var DEAD_HOSTS = ["cms03.wlu.ca"];
function isDead(href) {
  return DEAD_HOSTS.some(function (h) { return href.indexOf("//" + h) >= 0; });
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
/* Every rendered title goes through here, so a title can never be shown still
   carrying the day it is already filed under. data-ev-title carries the same
   string, because what the gate measures should be what the student reads. */
function title(e) { return stripDay(e.t); }
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
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function $(id) { return document.getElementById(id); }

/* ---- state -------------------------------------------------------------- */
var Q = "";
var pivot = "day";
var openAll = false;                 /* include records this student cannot attend */
var narrow = { online: false, reg: false, upcoming: false, cost: false, clash: false };
var cur = null;                      /* index of the record in the reading pane */
var railOpen = false;
/* A and C can each answer one student's question. Only a record set can answer
   "how does mine differ from theirs" — the same 508 records read twice and
   diffed. Off by default; the board is unchanged until you ask for it. */
var cmp = null;             /* the second selection, or null */
var cmpOpen = false;        /* the chooser is asked for, not always present */

/* B has no clock, but it can still answer "is this the only thing at this hour?".
   Counted over the records the student can actually attend, deduped, and ignoring
   drop-in desks -- the same rule A and C use, and this comment used to say so
   while the code below tested duration alone. A and C were corrected to require
   a desk to be open across the middle of the day as well as long; B was not, so
   for one student on one day A said 17 events clash and B said 16, and a 7-11pm
   concert carried a marker on one page and none on the other. The rule has to be
   one rule or the three pages contradict each other in front of a first-year. */
var LONG_MIN = 240;
var MIDDAY_IN = 720, MIDDAY_OUT = 840;   // open at noon, still open at 2 p.m.
function isDropIn(w) {
  return !!w && w.e - w.s >= LONG_MIN && w.s <= MIDDAY_IN && w.e >= MIDDAY_OUT;
}
function clashCount(e, pool) {
  var w = e.d ? parseWhen(e.n) : null;
  if (!w || isDropIn(w)) return 0;
  var seen = {}, n = 0;
  pool.forEach(function (o) {
    if (o === e || o.d !== e.d || dupKey(o) === dupKey(e)) return;
    var ow = parseWhen(o.n);
    if (!ow || isDropIn(ow)) return;
    if (!(ow.s < w.e && w.s < ow.e)) return;
    var k = dupKey(o);
    if (seen[k]) return;
    seen[k] = true;
    n++;
  });
  return n;
}
/* The pool of records a clash can be counted against. It used to be a global
   filled as a side effect of drawResults() -- but redraw() runs drawRail()
   first, and the rail reads it. So on the first paint the clash facet counted
   against an empty pool and labelled itself 0, telling a first-year that
   nothing they are going to collides with anything when 54 of their 91 events
   do; on every later paint it held the previous cycle's pool, so the number was
   stale rather than absent, which is why ticking any other facet appeared to
   fix it. A pool that is a function of the selection should be computed from
   the selection when it is wanted, not left behind by whichever phase ran last.
   Each draw phase clears the memo, so neither can read the other's leftovers. */
var CLASHPOOL = null;
function clashPool() {
  // safe from recursion: narrow.clash is false here, so results() never asks
  if (!CLASHPOOL) CLASHPOOL = results({ Q: "", narrow: { online: false, reg: false, upcoming: false, cost: false, clash: false } });
  return CLASHPOOL;
}
var ROWORDER = [];

var REGRE = /regist|rsvp|sign ?up|ticket|book now|purchase/i;
/* Only links Laurier attached to the event itself. Page-level links (e.pl) sit on
   every event on that page, and the Waterloo undergraduate page carries a
   "Register Now!" banner — counting those made this filter answer 166 out of 170
   and told a student nothing. */
function hasReg(e) {
  return (e.l || []).some(function (l) { return REGRE.test(l.text || ""); });
}

/* ---- facets ------------------------------------------------------------- */
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

/* ---- the query ---------------------------------------------------------- */
function hay(e) {
  return [e.t, e.w, e.h, e.x, e.s, e.pt, e.pg, (e.tg || []).join(" ")].join(" ").toLowerCase();
}
/* Every word must appear somewhere in the record, in any order. A phrase search
   would fail on "free food", which is two words Laurier never writes together. */
function terms(q) { return q ? q.split(/\s+/).filter(Boolean) : []; }
function hits(e, q) {
  var t = terms(q);
  if (!t.length) return true;
  var h = hay(e);
  return t.every(function (w) { return h.indexOf(w) >= 0; });
}
function passNarrow(e) {
  if (narrow.online && !e.vr) return false;
  if (narrow.reg && !hasReg(e)) return false;
  if (narrow.upcoming && e.d && e.d < NOW) return false;
  if (narrow.cost && !e.c) return false;
  return true;
}
/* Two campuses never share a record — Laurier publishes Waterloo's Shinerama BBQ
   and Brantford's as separate entries. Comparing by record index would report
   "0 shared", which is true and useless. What a student means by "the same event"
   is the same thing at the same time, so that is what is matched. */
function evKey(e) { return [stripDay(e.t), e.d || "", e.n || ""].join(" § "); }
function compareSets() {
  var prev = sel, A = {}, B = {}, ka = {}, kb = {};
  EV.forEach(function (e) { if (assess(e).ok) { A[e.__i] = true; ka[evKey(e)] = true; } });
  sel = cmp;
  EV.forEach(function (e) { if (assess(e).ok) { B[e.__i] = true; kb[evKey(e)] = true; } });
  sel = prev;
  return { A: A, B: B, ka: ka, kb: kb };
}
function cmpLabel(s) {
  return (META.levelLabels[s.level] || s.level) + " · " + s.campus + " · " + s.term +
         (s.streams.length ? " · " + s.streams.join(" + ") : "");
}

function results(over) {
  var o = over || {};
  var prev = sel;
  if (o.sel) sel = o.sel;
  var oa = ("openAll" in o) ? o.openAll : openAll;
  var q  = ("Q" in o) ? o.Q : Q;
  var nr = o.narrow || narrow;
  var cset = (!o.sel && cmp) ? compareSets() : null;
  var out = EV.filter(function (e) {
    if (cset) { if (!cset.A[e.__i] && !cset.B[e.__i]) return false; }
    else if (!oa && !assess(e).ok) return false;
    if (!hits(e, q)) return false;
    if (nr.online && !e.vr) return false;
    if (nr.reg && !hasReg(e)) return false;
    if (nr.upcoming && e.d && e.d < NOW) return false;
    if (nr.cost && !e.c) return false;
    if (nr.clash && !clashCount(e, clashPool())) return false;
    return true;
  });
  sel = prev;
  return onePerEvent(out);
}
/* Every listing this student could reach, before duplicates are folded, so the
   reading pane can name each Laurier page an event was published on. */
var SRCPOOL = null, SRCPOOLKEY = null;
function sourcePoolKey() {
  return [openAll, !!cmp, sel.level, sel.campus, sel.term,
          sel.streams.join(","), sel.program].join("|");
}
function sourcePool() {
  var k = sourcePoolKey();
  if (SRCPOOLKEY !== k) {
    SRCPOOLKEY = k;
    var cset = cmp ? compareSets() : null;
    SRCPOOL = EV.filter(function (e) {
      return cset ? (cset.A[e.__i] || cset.B[e.__i]) : (openAll || assess(e).ok);
    });
  }
  return SRCPOOL;
}
/* Facet counts are always "records you could attend". Counting them inside
   "include events I cannot attend" made every number read 508, which is exactly
   the mode where the counts need to mean something. */
function countIf(patch) {
  var s2 = { level: sel.level, campus: sel.campus, term: sel.term,
             streams: sel.streams.slice(), program: sel.program };
  Object.keys(patch).forEach(function (k) { s2[k] = patch[k]; });
  return results({ sel: s2, openAll: false }).length;
}

/* ---- rail --------------------------------------------------------------- */
function facetList(label, name, values, labels, current, countFn) {
  return '<div class="fgroup"><h3>' + esc(label) + "</h3><ul>" + values.map(function (v) {
    var n = countFn(v), on = v === current;
    return '<li><button class="fb' + (on ? " on" : "") + (n || on ? "" : " zero") + '" data-k="' + name +
      '" data-v="' + esc(v) + '"' + (n || on ? "" : " disabled") + '><span class="fx" aria-hidden="true"></span>' +
      '<span class="ft">' + esc((labels || {})[v] || v) + '</span><span class="fn">' + n + "</span></button></li>";
  }).join("") + "</ul></div>";
}

function drawRail() {
  CLASHPOOL = null;   // this phase computes its own; see clashPool()
  var live = liveStreams(sel), progs = livePrograms(sel);
  var h = "";

  h += '<div class="railhead"><h2>Narrow</h2><button class="reset" id="reset">Reset</button></div>' +
       '<p class="railnote">Counts are events you could attend.</p>';

  h += facetList("Level of study", "level", META.levels, META.levelLabels, sel.level, function (v) {
    return countIf({ level: v });
  });
  h += facetList("Campus", "campus", META.campuses, null, sel.campus, function (v) {
    return countIf({ campus: v });
  });
  h += facetList("Starting term", "term", META.terms, null, sel.term, function (v) {
    return countIf({ term: v });
  });

  if (progs.length) {
    h += '<div class="fgroup"><h3><label for="prog">Program or faculty</label></h3>' +
      '<select id="prog" class="fsel"><option value="">Every program’s welcome</option>' +
      '<option value="' + NO_PROGRAM + '"' + (sel.program === NO_PROGRAM ? " selected" : "") +
      '>Mine is not listed — hide them all</option>' +
      progs.map(function (p) {
        return '<option value="' + esc(p) + '"' + (p === sel.program ? " selected" : "") + ">" + esc(p) + "</option>";
      }).join("") + "</select></div>";
  }

  // countIf() deliberately measures "records you could attend", so the baseline
  // it is subtracted from has to be measured the same way. Reading it off the live
  // board made every stream delta negative the moment "include events I cannot
  // attend" was on.
  var here = countIf({});
  var shown = META.streams.filter(function (t) { return live[t]; });
  if (shown.length) {
    h += '<div class="fgroup"><h3>Streams you belong to</h3>' +
      '<p class="fnote">Laurier restricts these events to the students they name. The number is what ticking — or unticking — changes the count by.</p><ul>' +
      shown.map(function (t) {
        var on = sel.streams.indexOf(t) >= 0;
        var s2 = on ? sel.streams.filter(function (x) { return x !== t; }) : sel.streams.concat([t]);
        var d = countIf({ streams: s2 }) - here;
        return '<li><button class="fb tickb' + (on ? " on" : "") + '" data-k="stream" data-v="' + esc(t) +
          '"><span class="fx box" aria-hidden="true"></span><span class="ft">' + esc(streamLabel(t)) +
          '</span><span class="fn">' + (d > 0 ? "+" + d : String(d)) + "</span></button></li>";
      }).join("") + "</ul></div>";
  }

  var nk = [["online", "Online / Zoom only"], ["reg", "Has a registration link"],
            ["upcoming", "Still to come"], ["cost", "Has a stated cost"],
            ["clash", "Runs at the same time as something"]];
  h += '<div class="fgroup"><h3>Only show</h3><ul>' + nk.map(function (p) {
    var patch = {}; Object.keys(narrow).forEach(function (k) { patch[k] = narrow[k]; });
    patch[p[0]] = !narrow[p[0]];
    var n = results({ narrow: patch }).length;
    return '<li><button class="fb tickb' + (narrow[p[0]] ? " on" : "") + '" data-k="narrow" data-v="' + p[0] +
      '"><span class="fx box" aria-hidden="true"></span><span class="ft">' + p[1] +
      '</span><span class="fn">' + n + "</span></button></li>";
  }).join("") + "</ul></div>";

  h += '<div class="fgroup"><ul><li><button class="fb tickb' + (openAll ? " on" : "") +
    '" data-k="openall" data-v="1"><span class="fx box" aria-hidden="true"></span>' +
    '<span class="ft">Include events I cannot attend</span><span class="fn">' +
    results({ openAll: true }).length + "</span></button></li></ul></div>";

  $("rail").innerHTML = h;

  [].slice.call($("rail").querySelectorAll("[data-k]")).forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.k, v = b.dataset.v;
      if (k === "stream") {
        var i = sel.streams.indexOf(v);
        if (i >= 0) sel.streams.splice(i, 1); else sel.streams.push(v);
        settle();
      } else if (k === "narrow") { narrow[v] = !narrow[v]; }
      else if (k === "openall") { openAll = !openAll; }
      else { sel[k] = v; settle(); }
      writeHash(); redraw();
    };
  });
  var ps = $("prog");
  if (ps) ps.onchange = function () { sel.program = this.value; writeHash(); redraw(); };
  $("reset").onclick = function () {
    Q = ""; $("q").value = ""; openAll = false;
    Object.keys(narrow).forEach(function (k) { narrow[k] = false; });
    sel.streams = []; sel.program = "";
    writeHash(); redraw();
  };
}

/* ---- pivots ------------------------------------------------------------- */
var PIVOTS = [["day", "Date"], ["daypart", "Time of day"], ["where", "Venue"],
              ["host", "Host"], ["stream", "Stream"], ["section", "Schedule section"]];

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
function clock(m) {
  var h = Math.floor(m / 60), mm = m % 60;
  var ap = h >= 12 ? "pm" : "am", hh = h % 12; if (hh === 0) hh = 12;
  return hh + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + ap;
}
/* Laurier sometimes writes a sentence where a time should be ("You will receive
   an email with your move-in date"). Sliced to fit a numeric column that reads
   as a rendering fault, so the column says "no time" and the sentence is shown
   in full on the row's own line. */
function shortWhen(e) {
  var w = parseWhen(e.n);
  if (w) return clock(w.s) + "–" + clock(w.e);
  return e.n ? "no time" : "—";
}
function whenNote(e) {
  return (!parseWhen(e.n) && e.n) ? esc(e.n) : "";
}

/* Laurier writes the same room several ways: "The Turret | 3rd floor of the Fred
   Nichols Campus Centre (FNCC)" and "The Turret | 3rd Floor, Fred Nichols Campus
   Centre (FNCC)" are one place. Filing them apart made the venue pivot report 39
   venues when it had found rather fewer. The data is untouched; only the grouping
   folds, and the label shown is Laurier's own commonest spelling. */
var VENUE_OF = null;
function normVenue(v) {
  return String(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function buildVenueMap() {
  var counts = {}, norms = [];
  EV.forEach(function (e) {
    if (!e.w) return;
    var n = normVenue(e.w);
    if (!counts[n]) { counts[n] = {}; norms.push(n); }
    counts[n][e.w] = (counts[n][e.w] || 0) + 1;
  });
  norms.sort(function (a, b) { return a.length - b.length; });
  var fold = {};
  norms.forEach(function (n) {
    var host = n;
    for (var i = 0; i < norms.length; i++) {
      if (norms[i] !== n && n.indexOf(norms[i] + " ") === 0) { host = fold[norms[i]] || norms[i]; break; }
    }
    fold[n] = host;
  });
  var spell = {};
  Object.keys(counts).forEach(function (n) {
    var host = fold[n];
    spell[host] = spell[host] || {};
    Object.keys(counts[n]).forEach(function (w) {
      spell[host][w] = (spell[host][w] || 0) + counts[n][w];
    });
  });
  VENUE_OF = {};
  EV.forEach(function (e) {
    if (!e.w) return;
    var sp = spell[fold[normVenue(e.w)]];
    VENUE_OF[e.w] = Object.keys(sp).sort(function (x, y) {
      return sp[y] - sp[x] || x.length - y.length;
    })[0];
  });
}

function groupKey(e) {
  if (pivot === "day")     return e.d || "TBA";
  if (pivot === "where")   return (VENUE_OF && VENUE_OF[e.w]) || e.w || "No venue published";
  if (pivot === "host")    return e.h || "No host published";
  if (pivot === "section") return e.s || "No section";
  if (pivot === "stream")  return (e.tg || []).length ? (e.tg || []).join(" + ") : "Open to everyone eligible";
  if (pivot === "daypart") {
    var w = parseWhen(e.n);
    if (!w) return "Time not published";
    if (w.s < 12 * 60) return "1 Morning — before noon";
    if (w.s < 17 * 60) return "2 Afternoon — noon to 5pm";
    return "3 Evening — 5pm onwards";
  }
  return "";
}
/* "CC-101 | Career Development Centre" files under the building, not the room. */
/* Venue, host and stream file busiest-first: a student wants the pool with twelve
   sessions before six rooms holding one each. Dates stay chronological. */
var GSIZE = {};
var GHASOK = {};   /* groups holding at least one record this student can attend */
function sortKey(k) {
  if (pivot === "day" || pivot === "daypart") return String(k);
  return String(100000 - (GSIZE[k] || 0)) + "|" + String(k).toLowerCase();
}
function slug(k) {
  return String(k).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
function countWith(kind, key) {
  var prev = pivot;
  pivot = kind;
  var n = results().filter(function (e) { return groupKey(e) === key; }).length;
  pivot = prev;
  return n;
}
function groupLabel(k) {
  if (pivot === "day") {
    if (k === "TBA") return "No date published";
    var dt = new Date(k + "T00:00:00");
    return DOW[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] + " " + dt.getFullYear();
  }
  if (pivot === "daypart") return k.replace(/^\d /, "");
  return String(k);
}

/* ---- results ------------------------------------------------------------ */
function hilite(s) {
  var t = esc(s), ws = terms(Q);
  if (!ws.length) return t;
  ws.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
    var out = "", low = t.toLowerCase(), i = 0, j;
    while ((j = low.indexOf(w, i)) >= 0) {
      if (t.lastIndexOf("<", j) > t.lastIndexOf(">", j)) { out += t.slice(i, j + w.length); i = j + w.length; continue; }
      out += t.slice(i, j) + "<mark>" + t.slice(j, j + w.length) + "</mark>";
      i = j + w.length;
    }
    t = out + t.slice(i);
  });
  return t;
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

/* Laurier files a run of events under one panel and the panel's name was
   printed under every one of them. It is said when it changes, and not again. */
var lastParent = null, groupReason = null;
var CSET = null;
/* Marking the majority class marks nothing. Your own board is the ground the
   comparison stands on, so only the two rare answers get a badge. */
function cmpTag(e) {
  if (!CSET) return "";
  var k = evKey(e), a = !!CSET.ka[k], b = !!CSET.kb[k];
  if (a && b) return '<span class="cmp both">on both</span>';
  if (CSET.A[e.__i]) return "";
  return '<span class="cmp theirs">theirs only</span>';
}
function rowHtml(e) {
  var a = assess(e), off = !a.ok;
  var dt = e.d ? new Date(e.d + "T00:00:00") : null;
  return '<button class="row' + (off ? " off" : "") + (e.__i === cur ? " cur" : "") + '" ' +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(title(e)) + '" data-id="' + e.__i + '">' +
    '<span class="rd">' + (dt ? DOW3[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] : "undated") + "</span>" +
    '<span class="rt">' + shortWhen(e) + "</span>" +
    '<span class="rn">' + hilite(title(e)) +
      cmpTag(e) +
      (e.pt && e.pt !== lastParent ? '<span class="rp">in ' + hilite(e.pt) + "</span>" : "") + "</span>" +
    (function () { lastParent = e.pt || lastParent; return ""; })() +
    '<span class="rw">' + (e.vr ? '<span class="tagv">Online</span> ' : "") + hilite(e.w || "") + "</span>" +
    '<span class="rh">' + hilite(e.h || "") + "</span>" +
    (e.h ? '<span class="rhin">' + hilite(e.h) + "</span>" : "") +
    (function () {
      var cn = clashCount(e, clashPool());
      return cn ? '<span class="rclash">' + cn + " other" + (cn === 1 ? "" : "s") +
                  " at this time</span>" : "";
    })() +
    (whenNote(e) ? '<span class="rnote">Laurier says: ' + whenNote(e) + "</span>" : "") +
    (off && a.reason !== groupReason ? '<span class="rx">' + esc(a.reason) + "</span>" : "") +
    "</button>";
}

/* One row per event. Laurier publishing it on two of its schedule pages is not
   two entries here, and the reading pane names both pages. */
function groupRows(arr) {
  return arr.map(function (e) { return rowHtml(e); }).join("");
}

var JUMPSLOT = "<!--jump-->";
function cmpBar() {
  if (!cmp) {
    if (!cmpOpen) {
      return '<button class="cmpopen" data-cmpopen="1">Compare with another campus or level…</button>';
    }
    return '<div class="cmpbar"><span class="cmplab">Compare with</span>' +
      META.campuses.filter(function (c) { return c !== sel.campus && countFor(sel.level, c, sel.term); })
        .map(function (c) {
          return '<button class="cmpb" data-cmp="campus:' + esc(c) + '">' + esc(c) + "</button>";
        }).join("") +
      META.levels.filter(function (l) { return l !== sel.level && countFor(l, sel.campus, sel.term); })
        .map(function (l) {
          return '<button class="cmpb" data-cmp="level:' + esc(l) + '">' +
                 esc(META.levelLabels[l] || l) + "</button>";
        }).join("") +
      '<button class="cmpx" data-cmpopen="0">Not now</button></div>';
  }
  var c = CSET || compareSets();
  var both = 0, mine = 0, only = 0;
  Object.keys(c.ka).forEach(function (k) { if (c.kb[k]) both++; else mine++; });
  Object.keys(c.kb).forEach(function (k) { if (!c.ka[k]) only++; });
  return '<div class="cmpbar on"><span class="cmplab">Comparing</span>' +
    '<span class="cmpwho">' + esc(cmpLabel(sel)) + "</span>" +
    '<span class="cmpvs">against</span><span class="cmpwho">' + esc(cmpLabel(cmp)) + "</span>" +
    '<span class="cmpsum"><b>' + both + "</b> on both · <b>" + mine + "</b> yours only · <b>" +
    only + "</b> theirs only</span>" +
    /* Counted by title, day and time, so Waterloo's Shinerama BBQ and
       Brantford's read as the same event on two campuses — which is the whole
       question this view exists to answer. That is deliberately a coarser test
       than the one the board folds by, so these three numbers do not add up to
       the count in the top bar and are not offered as if they did. */
    '<span class="cmpnote">counted by title, day and time, so one event running ' +
    "on both campuses counts once</span>" +
    '<span class="cmpkey"><i class="k-both"></i>on both <i class="k-mine"></i>yours only ' +
    '<i class="k-theirs"></i>theirs only</span>' +
    '<button class="cmpx" data-cmp="off">Stop comparing</button></div>';
}
/* Answering "what am I doing on Tuesday" should not cost 7,500px of scrolling.
   The groups already carry ids; this exposes them, under whichever pivot is on. */
function jumpRail(groups, seen) {
  if (groups.length < 2) return "";
  return '<div class="jump"><span class="jlab">Jump to</span>' + groups.map(function (k) {
    var lab = groupLabel(k);
    if (pivot === "day" && k !== "TBA") {
      var dt = new Date(k + "T00:00:00");
      lab = DOW3[dt.getDay()] + " " + dt.getDate();
    }
    return '<button class="jb" data-jump="g-' + slug(k) + '"><span class="jt">' + esc(lab) +
      '</span><span class="jn">' + seen[k].length + "</span></button>";
  }).join("") + "</div>";
}

/* .reshead is sticky and its height changes with the pivot row wrapping and the
   jump rail. The group heading sticks under it, so its offset has to be measured
   rather than guessed — guessed, it sat behind the header and a student scrolled
   into the middle of a long day with no date visible anywhere. */
function syncStick() {
  var rh = $("results").querySelector(".reshead");
  if (rh) document.documentElement.style.setProperty("--reshead", rh.offsetHeight + "px");
}

function drawResults() {
  CSET = cmp ? compareSets() : null;
  CLASHPOOL = null;   // this phase computes its own; see clashPool()
  var list = results();
  var withHost = list.filter(function (e) { return e.h; }).length;
  var hostSparse = list.length && withHost / list.length < 0.3;
  $("results").className = "results piv-" + pivot + (hostSparse ? " nohost" : "");
  GSIZE = {};
  GHASOK = {};
  list.forEach(function (e) {
    var k = groupKey(e);
    GSIZE[k] = (GSIZE[k] || 0) + 1;
    if (assess(e).ok) GHASOK[k] = 1;
  });
  /* With every record showing, a strict chronological order opened a Fall 2026
     undergraduate on Monday 5 January 2026 — a graduate Spring schedule with
     nothing on it for them. Groups they can attend something in come first, in
     order; everything else keeps its order behind them. Groups are moved, never
     records, so a day is never split in two. */
  list.sort(function (x, y) {
    if (openAll) {
      var ox = GHASOK[groupKey(x)] ? 0 : 1, oy = GHASOK[groupKey(y)] ? 0 : 1;
      if (ox !== oy) return ox - oy;
    }
    if (pivot === "day" || pivot === "daypart") {
      var ax = x.d || "9999", ay = y.d || "9999";
      if (ax !== ay) return ax < ay ? -1 : 1;
      var wx = parseWhen(x.n), wy = parseWhen(y.n);
      return (wx ? wx.s : 9999) - (wy ? wy.s : 9999);
    }
    var kx = sortKey(groupKey(x)), ky = sortKey(groupKey(y));
    if (kx !== ky) return kx < ky ? -1 : 1;
    return (x.d || "9999") < (y.d || "9999") ? -1 : 1;
  });
  if (pivot === "daypart") {
    list.sort(function (x, y) {
      var kx = groupKey(x), ky = groupKey(y);
      if (kx !== ky) return kx < ky ? -1 : 1;
      return (x.d || "9999") < (y.d || "9999") ? -1 : 1;
    });
  }

  var groups = [], seen = {};
  list.forEach(function (e) {
    var k = groupKey(e);
    if (!seen[k]) { seen[k] = []; groups.push(k); }
    seen[k].push(e);
  });

  var h = '<div class="reshead"><div class="pivots"><span class="plab">File the whole board under</span>' +
    PIVOTS.map(function (p) {
      return '<button class="pv' + (pivot === p[0] ? " on" : "") + '" data-pivot="' + p[0] + '">' + p[1] + "</button>";
    }).join("") +
    '<button class="totop" data-top="1">Top</button></div>' + cmpBar() + JUMPSLOT + "</div>";

  if (!list.length) {
    var wider = openAll ? 0 : results({ openAll: true }).length;
    h += '<div class="none"><p><b>Nothing you can attend matches' + (Q ? " “" + esc(Q) + "”" : "") +
      ".</b></p>" +
      (wider ? "<p>" + wider + " event" + (wider === 1 ? " does" : "s do") +
               ", but " + (wider === 1 ? "it is" : "they are") + " restricted to other students. " +
               '<button class="inlinebtn" data-k="openall" data-v="1">Show ' + (wider === 1 ? "it" : "them") +
               " anyway</button></p>"
             : "<p>" + (Q ? "Try one word rather than several, or clear the search. " : "") +
               "Widen a facet on the left.</p>") + "</div>";
    $("results").innerHTML = h;
    [].slice.call($("results").querySelectorAll("[data-k]")).forEach(function (b) {
      b.onclick = function () { openAll = true; writeHash(); redraw(); };
    });
    wireRows();
    return;
  }

  h = h.replace(JUMPSLOT, jumpRail(groups, seen));
  lastParent = null;
  h += '<div class="printhead"><b>Laurier Orientation — ' +
       esc(META.levelLabels[sel.level] || sel.level) + ", " + esc(sel.campus) + ", " + esc(sel.term) +
       "</b><span>" + list.length + " event" + (list.length === 1 ? "" : "s") +
       (Q ? ' matching “' + esc(Q) + "”" : "") +
       (sel.streams.length ? ", including " + esc(sel.streams.join(", ")) : "") +
       " · filed under " + esc((PIVOTS.filter(function (p) { return p[0] === pivot; })[0] || ["", ""])[1]) +
       " · printed from the Laurier Orientation Index, compiled " + META.compiled + "</span></div>";
  h += '<div class="rowhead"><span class="h-date">Date</span><span class="h-time">Time</span>' +
       '<span class="h-event">Event</span><span class="h-venue">Venue</span>' +
       '<span class="h-host">Host</span></div>';
  h += groups.map(function (k) {
    var rs = seen[k].map(function (e) { return assess(e).ok ? "" : assess(e).reason; });
    var shared = (rs.length > 1 && rs[0] && rs.every(function (r) { return r === rs[0]; })) ? rs[0] : null;
    return '<section class="grp" id="g-' + slug(k) + '"><h2 class="ghead"><span class="gt">' + esc(groupLabel(k)) +
      "</span>" + (shared ? '<span class="greason">' + esc(shared) + "</span>" : "") +
      '<span class="gn">' + seen[k].length + "</span></h2>" +
      (function () {
        lastParent = null;
        // when every row in a group is out for the same reason, say it once
        var reasons = seen[k].map(function (e) { return assess(e).ok ? "" : assess(e).reason; });
        groupReason = (reasons.length > 1 && reasons[0] &&
                       reasons.every(function (r) { return r === reasons[0]; })) ? reasons[0] : null;
        return groupRows(seen[k]);
      })() + "</section>";
  }).join("");
  $("results").innerHTML = h;
  /* "Result 3 of 91" printed against the board's first row because the reader
     asked results() for its position while the board rendered a sorted copy of
     the same array. The ordinal and the stepper are a promise about where you
     are on screen, so they walk the rows that are on screen. */
  ROWORDER = [].slice.call($("results").querySelectorAll(".row"))
    .map(function (n) { return +n.dataset.id; });
  syncStick();
  wireRows();
  // A search with a result and an empty reading pane wastes the best third of
  // the screen; put the top hit in it.
  if (cur === null || !list.some(function (e) { return e.__i === cur; })) {
    var soon = list.filter(function (e) { return e.d && e.d >= NOW; });
    cur = (Q ? list[0] : (soon[0] || list[0])).__i;
    var n0 = $("results").querySelector('[data-id="' + cur + '"]');
    if (n0) n0.classList.add("cur");
    drawReader();
  }
}

function wireRows() {
  [].slice.call($("results").querySelectorAll("[data-pivot]")).forEach(function (b) {
    b.onclick = function () { pivot = b.dataset.pivot; writeHash(); drawResults(); };
  });
  [].slice.call($("results").querySelectorAll("[data-jump]")).forEach(function (b) {
    b.onclick = function () {
      var n = document.getElementById(b.dataset.jump);
      if (n) n.scrollIntoView({ block: "start" });
    };
  });
  if ($("jumpsel")) $("jumpsel").onchange = function () {
    var n = this.value && document.getElementById(this.value);
    if (n) n.scrollIntoView({ block: "start" });
    this.value = "";
  };
  [].slice.call($("results").querySelectorAll("[data-cmpopen]")).forEach(function (b) {
    b.onclick = function () { cmpOpen = b.dataset.cmpopen === "1"; drawResults(); };
  });
  [].slice.call($("results").querySelectorAll("[data-cmp]")).forEach(function (b) {
    b.onclick = function () {
      var v = b.dataset.cmp;
      if (v === "off") { cmp = null; }
      else {
        var kv = v.split(":");
        cmp = { level: sel.level, campus: sel.campus, term: sel.term,
                streams: sel.streams.slice(), program: sel.program };
        cmp[kv[0]] = kv.slice(1).join(":");
      }
      writeHash(); redraw();
    };
  });
  var tb = $("results").querySelector("[data-top]");
  if (tb) tb.onclick = function () { window.scrollTo({ top: 0, behavior: "smooth" }); };
  [].slice.call($("results").querySelectorAll("[data-id]")).forEach(function (b) {
    b.onclick = function () { select(+b.dataset.id, false); };
  });
}

function drawMeta() {
  var n = results().length;
  /* One number, because there is now only one thing to count. Two used to sit
     here — "91 of 508 records" over a reader counting 89 — because Laurier
     lists some events on two pages and the reader folded them and the board did
     not. The board folds them too. */
  /* And the total is the events there are, not the listings Laurier printed:
     520 was a number no reader could reach, because the board folds the copies. */
  $("topmeta").innerHTML = '<span class="cnt"><b>' + n + "</b> of " + META.nDistinct +
    " events</span>" +
    '<span class="who">' + esc(META.levelLabels[sel.level] || sel.level) + " &middot; " + esc(sel.campus) +
    " &middot; " + esc(sel.term) +
    (sel.streams.length ? " &middot; " + sel.streams.length + " stream" +
      (sel.streams.length === 1 ? "" : "s") : "") +
    (cmp ? ' &middot; <b class="whocmp">comparing with ' + esc(cmp.campus === sel.campus
      ? (META.levelLabels[cmp.level] || cmp.level) : cmp.campus) + "</b>" : "") + "</span>";
  $("qclear").hidden = !Q;
}

/* ---- reading pane ------------------------------------------------------- */
function select(i, scroll) {
  cur = i;
  [].slice.call($("results").querySelectorAll(".row.cur")).forEach(function (n) { n.classList.remove("cur"); });
  var node = $("results").querySelector('[data-id="' + i + '"]');
  if (node) {
    node.classList.add("cur");
    if (scroll) node.scrollIntoView({ block: "nearest" });
  }
  drawReader();
  if (window.matchMedia("(max-width:1080px)").matches) {
    document.body.classList.add("reading");
  }
}

function drawReader() {
  if (cur === null) {
    $("reader").innerHTML = '<div class="rempty"><h2>Nothing selected</h2>' +
      "<p>Click an event — or press <kbd>&darr;</kbd> — and it opens here, with its venue, host, " +
      "audience, cost, registration links and the citation back to Laurier&rsquo;s page.</p>" +
      "<dl class=\"keys\"><dt><kbd>/</kbd></dt><dd>jump to the search box</dd>" +
      "<dt><kbd>&uarr;</kbd><kbd>&darr;</kbd></dt><dd>move through the list</dd>" +
      "<dt><kbd>Esc</kbd></dt><dd>clear the search</dd></dl></div>";
    return;
  }
  var e = EV[cur], a = assess(e);
  var dt = e.d ? new Date(e.d + "T00:00:00") : null;
  var nWhen = stripLead(e.n, e.d);
  var when = e.d
    ? DOW[dt.getDay()] + ", " + MON[dt.getMonth()] + ". " + dt.getDate() + ", " + dt.getFullYear() + (nWhen ? " — " + esc(nWhen) : "")
    : (e.n ? esc(e.n) : "Date not published");

  /* The three facts a student needs before anything else sit above the fold;
     everything Laurier also publishes follows the prose. */
  var key = "", facts = "";
  function krow(k, v) { if (v) key += "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
  function row(k, v) { if (v) facts += "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
  function xlink(kind, key, word) {
    var n = countWith(kind, key) - 1;
    return n > 0 ? ' <button class="xlink" data-x="' + kind + '" data-key="' + esc(key) + '">' +
      n + " more " + word + "</button>" : "";
  }
  krow("When", when);
  krow("Where", (esc(e.w) || "Not published by Laurier") +
       (e.w ? xlink("where", e.w, "here") : ""));
  krow("Host", (esc(e.h) || "Not published by Laurier") +
       (e.h ? xlink("host", e.h, "from them") : ""));
  row("Part of", esc(e.pt));
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
  var links = allLinksOf(e, src);
  /* An index entry cites where it came from as text, not as a stack of buttons.
     This is also what keeps the reading pane from looking like variant A's sheet. */
  var linkHtml = links.length ? '<p class="lklist"><span class="lklab">Booking and detail</span>' +
    links.map(function (l) {
      if (isDead(l.href))
        return '<span class="lk dead" title="' + esc(l.href) + '">' + esc(l.text) +
               " — link broken on Laurier’s site</span>";
      return '<a class="lk" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + "</a>";
    }).join('<span class="lksep">·</span>') + "</p>" : "";

  var flagHtml = (e.f || []).length
    ? '<p class="flag">Not published by Laurier: ' + (e.f || []).map(function (f) {
        return { "no-date": "date", "no-time": "time", "no-venue": "venue" }[f] || f;
      }).join(", ") + ".</p>" : "";

  var pos = ROWORDER.indexOf(cur);
  var shown = { length: ROWORDER.length };

  $("reader").innerHTML =
    '<button class="backbtn" id="backbtn">&larr; Back to results</button>' +
    '<article class="rec">' +
      '<div class="recmast">Wilfrid Laurier University <b>Orientation</b></div>' +
      '<div class="recnav"><button class="stepr" id="prevrec"' + (pos <= 0 ? " disabled" : "") +
        ' aria-label="Previous event">‹</button>' +
        '<span class="recno">' + (pos >= 0 ? "Result " + (pos + 1) + " of " + shown.length
                                           : "Not in the current results") + "</span>" +
        '<button class="stepr" id="nextrec"' + (pos < 0 || pos >= shown.length - 1 ? " disabled" : "") +
        ' aria-label="Next event">›</button></div>' +
      '<div class="elig' + (a.ok ? "" : " no") + '">' +
        (a.ok ? esc(audienceLine(e)) : esc(a.reason)) + "</div>" +
      "<h2>" + esc(e.t) + "</h2>" +
      (e.pt ? '<p class="parent">Part of ' + esc(e.pt) + "</p>" : "") +
      /* Laurier publishes the same event on several of its schedule pages. It is
         one event and it is listed once; every page it came from is cited below. */
      (src.length > 1 ? '<p class="dupnote">Laurier publishes this on <b>' + src.length +
        " of its schedule pages</b>. It is one event, listed once \u2014 every page it " +
        "appears on is cited at the foot of this entry.</p>" : "") +
      '<dl class="facts key">' + key + "</dl>" +
      (e.x ? '<div class="prose">' + paras(e.x).map(function (p) {
          return "<p>" + esc(p) + "</p>";
        }).join("") + "</div>" : "") +
      linkHtml +
      '<dl class="facts">' + facts + "</dl>" + flagHtml +
      '<p class="cite"><span>' + (src.length > 1
          ? "Cited from " + src.length + " Laurier pages"
          : "Cited from") + "</span>" +
        src.map(function (o) {
          return "Wilfrid Laurier University. <i>" +
            esc(META.pageTitles ? (SRCT[o.u.split("#")[0]] || o.u.split("#")[0]) : o.u) + "</i>" +
            (o.u.indexOf("#") > 0 ? ", &sect;" + esc(o.u.split("#")[1].replace(/-/g, " ")) : "") +
            '. <a href="' + esc(o.u) + '" target="_blank" rel="noopener">' + esc(o.u) + "</a>";
        }).join("<br>") +
        "<br>Read " + META.readOn + ", including the venue, host and registration detail " +
        "Laurier keeps hidden until you open an event.</p>" +
    "</article>";
  $("backbtn").onclick = function () { document.body.classList.remove("reading"); };
  if ($("prevrec")) $("prevrec").onclick = function () { if (pos > 0) select(ROWORDER[pos - 1], true); };
  if ($("nextrec")) $("nextrec").onclick = function () {
    if (pos >= 0 && pos < ROWORDER.length - 1) select(ROWORDER[pos + 1], true);
  };
  [].slice.call($("reader").querySelectorAll("[data-x]")).forEach(function (b) {
    b.onclick = function () {
      pivot = b.dataset.x;
      writeHash(); drawResults(); drawMeta();
      var n = document.getElementById("g-" + slug(b.dataset.key));
      if (n) n.scrollIntoView({ block: "start" });
      document.body.classList.remove("reading");
    };
  });
}

/* ---- data notes --------------------------------------------------------- */
function buildNotes() {
  var notes = [];
  var undated = EV.filter(function (e) { return !e.d; });
  if (undated.length) {
    var byTerm = {};
    undated.forEach(function (e) { byTerm[e.tm] = (byTerm[e.tm] || 0) + 1; });
    notes.push(["Events published without a date",
      undated.length + " events carry no date on Laurier's page (" +
      Object.keys(byTerm).map(function (t) { return byTerm[t] + " in " + t; }).join(", ") +
      "). Filed under “no date published”."]);
  }
  var spring = EV.filter(function (e) { return e.tm === "Spring 2026" && e.d && e.d.slice(5, 7) === "01"; });
  if (spring.length) {
    notes.push(["Spring graduate schedule shows January dates",
      "The page titled “Laurier Spring Orientation: Graduate Schedule” lists its sessions on Jan. 5, 7 and 9, 2026. " +
      "January is the winter term at Laurier, so this page appears to be either mislabelled or left over from a previous cycle. " +
      "Dates are reproduced exactly as published — confirm with aspire@wlu.ca before relying on them."]);
  }
  var noTime  = EV.filter(function (e) { return (e.f || []).indexOf("no-time") >= 0; }).length;
  var noVenue = EV.filter(function (e) { return (e.f || []).indexOf("no-venue") >= 0; }).length;
  if (noTime || noVenue) {
    notes.push(["Events without a usable time or venue",
      noTime + " events have no usable time and " + noVenue + " no usable venue. This counts " +
      "Laurier's own “TBD” placeholders, not only the ones it leaves empty."]);
  }
  var winter = EV.filter(function (e) { return e.tm === "Winter 2027"; });
  if (winter.length && winter.every(function (e) { return !e.d; })) {
    var wVenue = winter.filter(function (e) { return (e.f || []).indexOf("no-venue") === -1; }).length;
    var wTime = winter.filter(function (e) { return (e.f || []).indexOf("no-time") === -1; }).length;
    notes.push(["The Winter 2027 schedule is mostly a placeholder",
      "All " + winter.length + " Winter 2027 events are published without a date, and Laurier states " +
      "registration opens in October 2026. " +
      (wVenue ? wVenue + " of them do give a venue (the Virtual sessions state Zoom); the other " +
                (winter.length - wVenue) + " are TBD. " : "None gives a venue. ") +
      (wTime ? wTime + " give a time." : "None gives a time.")]);
  }
  var prog = EV.filter(function (e) { return e.pg; }).length;
  if (prog) {
    notes.push(["Program and faculty welcomes carry no audience on Laurier's page",
      prog + " events are specific to one program or faculty, but Laurier states no audience " +
      "restriction on them, so by default they all show. Use the program facet to narrow to your " +
      "own, or choose “Mine is not listed” to hide them all — Laurier does not publish a welcome " +
      "for every program."]);
  }
  if (!notes.length) return;
  $("noteslist").innerHTML = notes.map(function (n, i) {
    return "<li><b>" + String(i + 1).padStart(2, "0") + "</b><div><strong>" + n[0] + "</strong><p>" + n[1] + "</p></div></li>";
  }).join("");
  $("notes").hidden = false;
}

/* ---- hash --------------------------------------------------------------- */
function writeHash() {
  var p = "level=" + encodeURIComponent(sel.level) +
          "&campus=" + encodeURIComponent(sel.campus) +
          "&term=" + encodeURIComponent(sel.term);
  if (sel.streams.length) p += "&streams=" + encodeURIComponent(sel.streams.join("|"));
  if (sel.program) p += "&program=" + encodeURIComponent(sel.program);
  if (Q) p += "&q=" + encodeURIComponent(Q);
  if (pivot !== "day") p += "&by=" + pivot;
  if (openAll) p += "&all=1";
  if (cmp) p += "&vs=" + encodeURIComponent(cmp.level + "|" + cmp.campus + "|" + cmp.term);
  var on = Object.keys(narrow).filter(function (k) { return narrow[k]; });
  if (on.length) p += "&only=" + on.join("|");
  history.replaceState(null, "", "#" + p);
}
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
  Q = (p.q || "").toLowerCase().trim();
  if (PIVOTS.some(function (x) { return x[0] === p.by; })) pivot = p.by;
  openAll = p.all === "1";
  if (p.vs) {
    var v = p.vs.split("|");
    if (META.levels.indexOf(v[0]) >= 0 && META.campuses.indexOf(v[1]) >= 0 && META.terms.indexOf(v[2]) >= 0)
      cmp = { level: v[0], campus: v[1], term: v[2], streams: sel.streams.slice(), program: sel.program };
  }
  if (p.only) p.only.split("|").forEach(function (k) { if (k in narrow) narrow[k] = true; });
}

/* ---- go ----------------------------------------------------------------- */
EV.forEach(function (e, i) { e.__i = i; });
buildVenueMap();
readHash();
function redraw() { drawRail(); drawResults(); drawMeta(); drawReader(); }
$("q").value = Q;
if (window.innerWidth < 700) $("q").placeholder = "Search " + META.nDistinct + " events";
redraw();
buildNotes();
writeHash();

$("q").oninput = function () {
  Q = this.value.toLowerCase().trim();
  writeHash(); drawRail(); drawResults(); drawMeta();
};
$("qclear").onclick = function () { Q = ""; $("q").value = ""; writeHash(); redraw(); $("q").focus(); };
$("railtoggle").onclick = function () {
  railOpen = !railOpen;
  document.body.classList.toggle("railopen", railOpen);
};

document.addEventListener("keydown", function (ev) {
  var typing = /^(input|select|textarea)$/i.test(ev.target.tagName || "");
  if (ev.key === "/" && !typing) { ev.preventDefault(); $("q").focus(); $("q").select(); return; }
  if (ev.key === "Escape") {
    if (document.body.classList.contains("reading")) { document.body.classList.remove("reading"); return; }
    if (Q) { Q = ""; $("q").value = ""; writeHash(); redraw(); }
    return;
  }
  if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
  if (typing && ev.target.id !== "q") return;
  if (!ROWORDER.length) return;
  ev.preventDefault();
  var at = ROWORDER.indexOf(cur);
  var next = at < 0 ? 0 : at + (ev.key === "ArrowDown" ? 1 : -1);
  if (next < 0) next = 0;
  if (next >= ROWORDER.length - 1) next = ROWORDER.length - 1;
  select(ROWORDER[next], true);
});
