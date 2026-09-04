/* ============================================================================
   YOUR ORIENTATION — variant C
   Interaction model: a short interview, then a document. Five full-screen
   questions produce one personal itinerary in which every event is already
   open — nothing to click to read. What you do here is tick the ones you mean
   to attend; the page then tells you what clashes, and prints or exports the
   result as your own schedule.
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
var MONF = ["January","February","March","April","May","June","July","August",
            "September","October","November","December"];
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
/* Every rendered title goes through here, so a title can never be shown still
   carrying the day it is already filed under. data-ev-title stays raw, because
   parity compares it against the incumbent. */
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
var draft = null;           /* the answers so far */
var built = false;          /* has the document been generated */
/* Keyed on the event itself, not its position in EV: a shared or bookmarked
   plan must survive events.json being rebuilt. */
var picks = {};             /* stable key -> true */
/* Hashed from dupKey, so ticking an event ticks the event and not one of
   Laurier's listings of it. It used to fold the citation URL in as well, which
   made the two pages Laurier publishes one session on two separate picks. */
function keyOf(e) {
  var raw = dupKey(e);
  var h = 5381;
  for (var i = 0; i < raw.length; i++) h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
var BYKEY = {};
/* localStorage is unavailable on some file:// origins; the hash is the fallback
   and stays the shareable form either way. */
function store(k, v) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  catch (err) { /* no storage on this origin */ }
}
function recall(k) {
  try { return localStorage.getItem(k); } catch (err) { return null; }
}
var onlyPicks = false;
var DASH = String.fromCharCode(8212), APOS = String.fromCharCode(8217);
var density = "brief";      /* "brief" | "full" — a 63,000px page is not a first screen */
var openDays = {};          /* days read in full regardless of the global density */
var editing = null;          /* an answer being changed in place, without the interview */

/* A citation printed 91 times as a bare URL is noise. The page it came from has
   a title; the fragment names the section. Both are in META, so the link can say
   what it points at and still carry the exact href. */
var SRC = {};
(META.sources || []).forEach(function (x) { SRC[x.url] = x.title; });
function citeLabel(u) {
  var base = String(u).split("#")[0], frag = String(u).split("#")[1] || "";
  var t = SRC[base] || base.replace(/^https?:\/\//, "");
  return t + (frag ? " \u00a7" + frag.replace(/-/g, " ") : "");
}

/* ---- clock -------------------------------------------------------------- */
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
  var h = Math.floor(m / 60), mm = m % 60, hh = h % 12; if (hh === 0) hh = 12;
  return hh + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + (h >= 12 ? " p.m." : " a.m.");
}

/* ---- availability ------------------------------------------------------- */
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
/* The number promised on the cover and the number of entries in the document
   have to be the same number. Counting listings while the document wrote out
   events had the button say 91 over a board of 89 — the first figure a student
   reads, on the page whose whole claim is fidelity to what Laurier published. */
function countExact(pick) {
  var prev = sel; sel = pick;
  var n = onePerEvent(EV.filter(function (e) { return assess(e).ok; })).length;
  sel = prev; return n;
}
function settle(s) {
  if (!countFor(s.level, s.campus, s.term)) {
    var c = META.campuses.filter(function (x) { return countFor(s.level, x, s.term); });
    if (c.length) { s.campus = c[0]; }
    else {
      var found = false;
      for (var i = 0; i < META.campuses.length && !found; i++) {
        for (var j = 0; j < META.terms.length; j++) {
          if (countFor(s.level, META.campuses[i], META.terms[j])) {
            s.campus = META.campuses[i]; s.term = META.terms[j]; found = true; break;
          }
        }
      }
    }
  }
  var live = liveStreams(s);
  s.streams = s.streams.filter(function (t) { return live[t]; });
  var progs = livePrograms(s);
  if (s.program && s.program !== NO_PROGRAM && progs.indexOf(s.program) === -1) s.program = "";
  if (!progs.length) s.program = "";
  return s;
}

/* ---- the interview ------------------------------------------------------ */
/* Five near-empty dark screens before a student sees anything is a poor
   welcome. This column shows the schedule the answers are already producing,
   so every question visibly changes something. */
function askAside() {
  var prev = sel;
  sel = draft;
  var list = EV.filter(function (e) { return assess(e).ok; });
  sel = prev;
  var keys = dayKeys(list).filter(function (k) { return k !== "TBA"; });
  if (!list.length) {
    return '<aside class="askside"><h3>So far</h3><p class="asidenote">' +
      "Laurier publishes nothing for this combination yet — change an answer, or tick a " +
      "group when the question comes.</p></aside>";
  }
  var maxN = 1;
  keys.forEach(function (k) {
    maxN = Math.max(maxN, list.filter(function (e) { return e.d === k; }).length);
  });
  return '<aside class="askside"><h3>Your week so far</h3><ul class="asidedays">' +
    keys.slice(0, 12).map(function (k) {
      var dt = new Date(k + "T00:00:00");
      var n = list.filter(function (e) { return e.d === k; }).length;
      return '<li><span class="adow">' + DOW3[dt.getDay()] + " " + dt.getDate() + "</span>" +
        '<span class="abar"><span style="width:' + Math.round(100 * n / maxN) + '%"></span></span>' +
        '<span class="an">' + n + "</span></li>";
    }).join("") + "</ul>" +
    (keys.length > 12 ? '<p class="asidenote">and ' + (keys.length - 12) + " more days</p>" : "") +
    "</aside>";
}

/* ---- the interview, on one screen ---------------------------------------
   Five full-screen questions was four page-turns of ceremony in front of a
   student who wants the schedule. Three of those questions decide which
   schedule you are reading — level, campus, term — and they now sit together on
   one screen with their counts. The other two, streams and programme, are
   refinements: they are better asked on the board, where the answer is visible,
   and the YOUR ANSWERS chips already ask them there.
------------------------------------------------------------------------- */
function askGroup(k, label, values, labels) {
  return '<div class="askgrp"><h2>' + esc(label) + "</h2><div class=\"askrow\">" +
    values.map(function (v) {
      // count what this option would actually give, before settle() rescues an
      // impossible combination into a possible one
      var raw = { level: draft.level, campus: draft.campus, term: draft.term,
                  streams: draft.streams.slice(), program: draft.program };
      raw[k] = v;
      var live = countFor(raw.level, raw.campus, raw.term);
      var n = live ? countExact(settle(raw)) : 0;
      return '<button class="askb' + (draft[k] === v ? " on" : "") + (live ? "" : " dead") +
        '" data-k="' + k + '" data-v="' + esc(v) + '"' + (live ? "" : " disabled") + ">" +
        '<span class="askbl">' + esc((labels || {})[v] || v) + "</span>" +
        '<span class="askbn">' + (live ? n + " events" : "none published") + "</span></button>";
    }).join("") + "</div></div>";
}

/* The third question could sit entirely below the scroll line on a 390x844
   phone with nothing to say so, while a gold "Build my orientation" button sat
   in full view directly beneath it. A student could answer two questions,
   never learn there was a third, and press the button. The prompt appears only
   when the last question is genuinely out of sight, and leaves the moment it
   comes into view -- on scroll, and on resize, since which of those is true is
   a question about the viewport. */
function syncAsk() {
  var mid = $("ask").querySelector(".askmid"), tip = $("ask").querySelector(".askmore");
  if (!mid || !tip) return;
  var upd = function () {
    /* Ask the question we actually mean -- is the last question below the fold
       -- rather than "does this panel overflow". The panel is two columns and
       the aside is the taller one, so on a 1366x768 laptop it over-ran by a few
       pixels with all three questions in full view, and the prompt pointed at
       nothing. Measuring the final .askgrp cannot be fooled by the sidebar. */
    var groups = mid.querySelectorAll(".askgrp");
    var last = groups[groups.length - 1];
    if (!last) { tip.hidden = true; return; }
    tip.hidden = !(last.getBoundingClientRect().bottom -
                   mid.getBoundingClientRect().bottom > 4);
  };
  mid.onscroll = upd;
  // drawAsk() rebuilds this panel and calls syncAsk() again on every answer,
  // so retire the previous listener instead of stacking one up per click
  if (syncAsk.onresize) window.removeEventListener("resize", syncAsk.onresize);
  syncAsk.onresize = upd;
  window.addEventListener("resize", upd);
  upd();
  setTimeout(upd, 60);
}

function drawAsk() {
  var n = countExact(draft);
  var h = '<div class="askin">';
  h += '<div class="asktop"><span class="crest">Wilfrid Laurier University <b>Orientation</b></span>' +
       '<span class="prog">One question, three parts</span></div>';
  h += '<div class="askmid"><div class="askcols"><div class="askq">';
  h += "<h1>Which schedule are you on?</h1>";
  h += '<p class="asksub">Laurier publishes a separate orientation schedule for each ' +
       "combination of these three. Everything else — the streams you belong to, your " +
       "programme's own welcome — you can set on the schedule itself, where you can see " +
       "what it changes.</p>";
  h += askGroup("level", "Level of study", META.levels, META.levelLabels);
  h += askGroup("campus", "Campus", META.campuses, null);
  h += askGroup("term", "Starting term", META.terms, null);
  h += "</div>" + askAside() + "</div></div>";
  // there is no "skip" any more: the three answers are already chosen, so the
  // primary button is the escape
  h += '<div class="askfoot"><span class="asknote">Already answered for you — change ' +
    "anything above, or go straight through.</span>" +
    '<div class="askgo"><span class="running">' + n + " event" + (n === 1 ? "" : "s") +
      " you can attend</span>" +
      '<button class="next" id="next">Build my orientation →</button></div>' +
    "</div></div>";
  h = h.replace("<div class=\"askfoot\">",
    '<p class="askmore" hidden>Keep going — there is another question below ↓</p>' +
    '<div class="askfoot">');
  $("ask").innerHTML = h;
  syncAsk();

  [].slice.call($("ask").querySelectorAll("[data-k]")).forEach(function (b) {
    b.onclick = function () {
      draft[b.dataset.k] = b.dataset.v;
      settle(draft);
      drawAsk();
    };
  });
  $("next").onclick = function () { settle(draft); finish(); };
}

function finish() {
  sel = settle(draft);
  built = true;
  $("ask").hidden = true;
  $("doc").hidden = false;
  $("planbar").hidden = false;
  writeHash();
  drawDoc();
  window.scrollTo(0, 0);
}
/* Only "redo the whole thing" comes back here. One answer at a time is changed
   on the document itself, where you can see what it does. */
function reopen() {
  built = false;
  draft = { level: sel.level, campus: sel.campus, term: sel.term,
            streams: sel.streams.slice(), program: sel.program };
  $("ask").hidden = false;
  $("doc").hidden = true;
  $("planbar").hidden = true;
  drawAsk();
  window.scrollTo(0, 0);
}

/* ---- the document ------------------------------------------------------- */
var SRCPOOL = null, SRCPOOLKEY = null;
function sourcePoolKey() {
  return [sel.level, sel.campus, sel.term, sel.streams.join(","), sel.program].join("|");
}
/* Every listing this student may attend, before duplicates are folded, so each
   entry can cite every Laurier page it was published on. */
function sourcePool() {
  var k = sourcePoolKey();
  if (SRCPOOLKEY !== k) {
    SRCPOOLKEY = k;
    SRCPOOL = EV.filter(function (e) { return assess(e).ok; });
  }
  return SRCPOOL;
}
function mine() {
  return onePerEvent(sourcePool());
}
function dayKeys(list) {
  var seen = {}, out = [];
  list.forEach(function (e) { var k = e.d || "TBA"; if (!seen[k]) { seen[k] = true; out.push(k); } });
  out.sort(function (a, b) { return a === "TBA" ? 1 : b === "TBA" ? -1 : (a < b ? -1 : a > b ? 1 : 0); });
  return out;
}
function band(e) {
  var w = parseWhen(e.n);
  if (!w) return 3;
  if (w.s < 720) return 0;
  if (w.s < 1020) return 1;
  return 2;
}
var BANDS = ["Morning, before noon", "Afternoon, noon to 5",
             "Evening, 5 p.m. onwards", "No clock time published"];

/* Overlaps used to be computed only against events already ticked, so the one
   fact worth knowing before you choose was invisible until after you had. This
   counts against the whole schedule; the plan bar still counts only your picks. */
var SCHED = [];
/* A drop-in desk is not a commitment and does not clash with anything -- but
   duration alone does not identify one. Four hours or more was the whole test,
   which filed a 7-11pm Headphone Disco as a desk you can wander past. A drop-in
   is long AND open across the middle of the day; an evening event is neither
   less of a commitment nor less of a clash for running late. This is the rule
   variant A publishes as "open most of the day", held identical here so the two
   cannot tell a student different things about one event. */
var LONG_MIN = 240;
var MIDDAY_IN = 720, MIDDAY_OUT = 840;   // open at noon, still open at 2 p.m.
function isDropIn(w) {
  return !!w && w.e - w.s >= LONG_MIN && w.s <= MIDDAY_IN && w.e >= MIDDAY_OUT;
}
/* Two listings are the same event when Laurier's own day, time, room and title
   agree — the shared rule, so A, B and C cannot disagree about it. */
function sameEvent(a, b) { return dupKey(a) === dupKey(b); }
/* One engine, three callers. These used to be two separate walks: the always-on
   marker deduped Laurier's twice-published records and skipped drop-in desks,
   the pick-driven badge did neither, and the plan bar's total was a third walk
   that did neither either. So one row could read "1 other at this time" and,
   directly beneath it, "Overlaps We Brought What You Forgot; We Brought What
   You Forgot; Shinerama BBQ" -- one duplicate named twice, on the page that
   explains duplicates better than either sibling. Reconciling three walks just
   means three places to drift again, so there is now one predicate and one
   dedupe; the callers differ only in which population they walk. */
function isCommitment(w) { return !!w && !isDropIn(w); }

function clashSet(e, pool) {
  var w = e.d ? parseWhen(e.n) : null;
  if (!isCommitment(w)) return [];
  var seen = {}, out = [];
  pool.forEach(function (o) {
    if (!o || o === e || o.d !== e.d || sameEvent(o, e)) return;
    var ow = parseWhen(o.n);
    if (!isCommitment(ow)) return;
    if (!(ow.s < w.e && w.s < ow.e)) return;
    var k = dupKey(o);
    if (seen[k]) return;
    seen[k] = true;
    out.push(o);
  });
  return out;
}

function clashesInSchedule(e) { return clashSet(e, SCHED).length; }

function clashesWith(e) {
  return clashSet(e, Object.keys(picks).map(function (i) { return BYKEY[i]; }));
}

/* Laurier gives several events the same description word for word. Printed in
   full under each of them it is two phone screens of the same prose; the second
   and later copies point at the first instead. */
var PROSE = {};
/* A link Laurier attaches to most of the schedule is furniture, not detail. */
var GLOBAL_LINK = {};
function findGlobalLinks(list) {
  GLOBAL_LINK = {};
  var n = {};
  list.forEach(function (e) {
    var seen = {};
    ((e.l || []).concat(e.sl || [], e.pl || [])).forEach(function (l) {
      if (seen[l.href]) return;
      seen[l.href] = 1;
      n[l.href] = (n[l.href] || 0) + 1;
    });
  });
  Object.keys(n).forEach(function (h) {
    if (n[h] >= Math.max(4, list.length * 0.6)) GLOBAL_LINK[h] = n[h];
  });
}
function entryHtml(e, full) {
  var a = assess(e);
  var w = parseWhen(e.n);
  var on = !!picks[keyOf(e)];
  var timeLine = w ? clock(w.s) + " – " + clock(w.e) : (e.n ? esc(stripLead(e.n, e.d)) : "Time not published by Laurier");
  var timeCls = w ? "etime" : "etime raw";

  var facts = "";
  function row(k, v) { if (v) facts += "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
  // venue, host and "part of" are already set in the entry itself; repeating them
  // 91 times in a table underneath is what made this document twice as long as it
  // needed to be.
  /* Laurier publishes a few programme welcomes as one panel covering several
     days. Each day is its own entry so it lands on the right day of the board;
     without this the student who opens day two sees one isolated afternoon and
     no sign that the welcome started yesterday and continues tomorrow. */
  row("More days", e.ro ? "Laurier publishes this welcome as one event running "
      + esc(e.ro) + ". Each of those days is on this board on its own."  : "");
  row("Audience", esc(audienceLine(e)));
  row("Cost", esc(e.c));
  row("Stream", (e.tg || []).length ? esc((e.tg || []).join(", ")) : "");
  if (e.s && /Program and Faculty Welcomes/i.test(e.s))
    row("Note", "This is a welcome for one specific programme. Attend only the one matching your own.");
  // the schedule line is the document's own subtitle; only say it when this
  // event does not belong to the schedule the student asked for
  if (e.vr || e.oa || e.lv !== sel.level)
    row("Schedule", esc(e.lv === "all" ? "All levels" : e.lv) + " &middot; " +
        (e.vr ? "Online — open to all campuses" : esc((e.cp || []).join(", "))) + " &middot; " + esc(e.tm));
  Object.keys(e.si || {}).forEach(function (k) {
    if (SHARED[sharedId(k, e.si[k])]) return;   // said once at the top of the document
    row(k, esc(e.si[k]));
  });

  // every page this event was published on, and every link any of them carries
  var src = sourcesOf(e);
  var links = allLinksOf(e, src);
  // a campus map is the same campus map every time; it is carried once, above
  links = links.filter(function (l) { return !(GLOBAL_LINK[l.href] && GLOBAL_LINK[l.href] > 3); });
  var PRIMARY = /regist|rsvp|sign ?up|ticket|book now|purchase/i;
  var linkHtml = links.length ? '<p class="elinks">' + links.slice().sort(function (x, y) {
      return (PRIMARY.test(y.text || "") ? 1 : 0) - (PRIMARY.test(x.text || "") ? 1 : 0);
    }).map(function (l) {
    if (isDead(l.href))
      return '<span class="lk dead" title="' + esc(l.href) + '">' + esc(l.text) +
             " — link broken on Laurier’s site</span>";
    return '<a class="lk' + (PRIMARY.test(l.text || "") ? " primary" : "") + '" href="' + esc(l.href) +
      '" target="_blank" rel="noopener">' + esc(l.text) + "</a>";
  }).join("") + "</p>" : "";

  var flagHtml = (e.f || []).length
    ? '<p class="eflag">Laurier does not publish the ' + (e.f || []).map(function (f) {
        return { "no-date": "date", "no-time": "time", "no-venue": "venue" }[f] || f;
      }).join(", ") + " for this one.</p>" : "";

  var cl = on ? clashesWith(e) : [];
  var clashHtml = cl.length
    ? '<p class="eclash"><b>Overlaps</b> ' + cl.map(function (o) { return esc(o.t); }).join("; ") + "</p>"
    : "";

  var head =
    '<div class="egut">' +
      '<button class="tick" data-pick="' + keyOf(e) + '" aria-pressed="' + on + '">' +
        '<span class="tbox" aria-hidden="true">' + (on ? "✓" : "") + "</span>" +
        '<span class="tlab">' +
        (on ? "Going" : "I\u2019m going") + "</span></button>" +
    "</div>";

  if (!full) {
    return '<article class="entry brief' + (on ? " picked" : "") + '" data-ev-title="' + esc(title(e)) +
      '" data-id="' + e.__i + '">' + head +
      '<div class="ebody">' +
        '<p class="briefline"><span class="btime">' + timeLine + "</span> " + esc(title(e)) +
          (e.vr ? ' <span class="online">Online</span>' : "") +
        "</p>" +
        '<p class="ewhere">' + esc(e.w || "Venue not published") +
          (e.h ? ' <span class="edot">\u00b7</span> ' + esc(e.h) : "") + "</p>" +
        (function () {
          var n = clashesInSchedule(e);
          return n ? '<p class="eover">' + n + " other" + (n === 1 ? "" : "s") +
                     " at this time</p>" : "";
        })() +
        clashHtml +
      "</div></article>";
  }

  return '<article class="entry' + (on ? " picked" : "") + '" id="ev-' + e.__i +
      '" data-ev-title="' + esc(title(e)) + '" data-id="' + e.__i + '">' + head +
    '<div class="ebody">' +
      '<p class="' + timeCls + '">' + timeLine + (e.vr ? ' <span class="online">Online</span>' : "") + "</p>" +
      "<h4>" + esc(title(e)) + "</h4>" +
      '<p class="ewhere">' + esc(e.w || "Venue not published") +
        (e.h ? ' <span class="edot">\u00b7</span> ' + esc(e.h) : "") + "</p>" +
      (e.pt ? '<p class="epart">Part of ' + esc(e.pt) + "</p>" : "") +
      /* Laurier publishes the same event on several of its schedule pages. It is
         one event and it is written out once; every page it came from is cited
         at the foot of the entry. */
      (src.length > 1 ? '<p class="dupnote">Laurier publishes this on <b>' + src.length +
        " of its schedule pages</b>. It is one event, written out once " + DASH +
        " every page it appears on is cited below.</p>" : "") +
      (a.reason ? '<p class="eopen">' + esc(a.reason) + "</p>" : "") +
      (function () {
        var n = clashesInSchedule(e);
        return n ? '<p class="eover">Runs at the same time as ' + n + " other" +
                   (n === 1 ? "" : "s") + " on your schedule</p>" : "";
      })() +
      clashHtml +
      (e.x ? (function () {
          var seenAt = PROSE[e.x];
          if (seenAt && seenAt.id !== e.__i) {
            return '<p class="esame">The same description as <a href="#ev-' + seenAt.id + '">' +
              esc(seenAt.label) + "</a>.</p>";
          }
          if (!seenAt) {
            var dl = e.d ? DOW[new Date(e.d + "T00:00:00").getDay()] + " " +
                     new Date(e.d + "T00:00:00").getDate() + " " + MONF[new Date(e.d + "T00:00:00").getMonth()]
                   : "the undated entry";
            PROSE[e.x] = { id: e.__i, label: esc(e.t) + ", " + dl };
          }
          return '<div class="edesc">' + paras(e.x).map(function (t) {
            return "<p>" + esc(t) + "</p>";
          }).join("") + "</div>";
        })() : "") +
      '<dl class="efacts">' + facts + "</dl>" +
      linkHtml + flagHtml +
      '<p class="ecite">Laurier, ' + src.map(function (o) {
        return '<a href="' + esc(o.u) + '" target="_blank" rel="noopener">' +
          esc(citeLabel(o.u)) + "</a>";
      }).join('<span class="citesep">&middot;</span>') + "</p>" +
    "</div></article>";
}

/* Laurier attaches the same page-level note to every event on a schedule. Set
   under all 91 entries it is byte-identical 91 times and roughly a third of the
   document's height. It is stated once, at the top, and dropped from the
   entries -- so is the "Schedule" row, which only ever repeats the subtitle. */
var SHARED = {};
function findShared(list) {
  SHARED = {};
  var seen = {};
  list.forEach(function (e) {
    Object.keys(e.si || {}).forEach(function (k) {
      var id = k + " § " + e.si[k];
      seen[id] = (seen[id] || 0) + 1;
    });
  });
  Object.keys(seen).forEach(function (id) {
    if (seen[id] < 3) return;       // said twice is not boilerplate; said 91 times is
    var i = id.indexOf(" § ");
    SHARED[id] = { k: id.slice(0, i), v: id.slice(i + 1), n: seen[id] };
  });
}
function sharedId(k, v) { return k + " § " + v; }

function drawDoc() {
  var list = mine();
  findShared(list);
  PROSE = {};
  SCHED = list;
  /* Counted over every listing, not only the ones drawn: a link Laurier attached
     to just one of the two pages an event sits on is still a link to keep. */
  findGlobalLinks(sourcePool());
  var shown = onlyPicks ? list.filter(function (e) { return picks[keyOf(e)]; }) : list;
  var keys = dayKeys(shown);
  // The day a student is most likely to want is open in full; the rest are
  // titles, so the document opens at a length a person can actually scan.
  if (density === "brief" && !Object.keys(openDays).length && keys.length) {
    var soon = keys.filter(function (k) { return k !== "TBA" && k >= NOW; });
    openDays[keys.indexOf(NOW) >= 0 ? NOW : (soon[0] || keys[0])] = true;
  }

  var who = (META.levelLabels[sel.level] || sel.level) + " · " + sel.campus + " campus · " + sel.term;
  var extra = [];
  if (sel.streams.length) extra.push(sel.streams.join(", "));
  if (sel.program === NO_PROGRAM) extra.push("no programme welcome listed");
  else if (sel.program) extra.push(sel.program);

  $("doc").className = "doc" + (density === "full" ? " fulltext" : "");
  $("dochead").innerHTML =
    '<p class="crest">Wilfrid Laurier University <b>Orientation</b></p>' +
    "<h1>Your orientation</h1>" +
    '<p class="who">' + esc(who) + "</p>" +
    (extra.length ? '<p class="whoextra">' + esc(extra.join(" · ")) + "</p>" : "") +
    (onlyPicks && list.length
      ? '<p class="docsum">The <b>' + shown.length + "</b> event" + (shown.length === 1 ? "" : "s") +
        " you have ticked, out of the " + list.length + " you may attend. This is the version " +
        "that prints.</p>"
      : list.length
      ? '<p class="docsum"><b>' + list.length + "</b> event" + (list.length === 1 ? "" : "s") +
        " you may attend, across <b>" + dayKeys(list).filter(function (k) { return k !== "TBA"; }).length +
        "</b> days" +
        (density === "full"
          ? ", every one written out in full " + DASH + " nothing to unfold."
          : ", listed by title. One day is open in full; open any other from its heading, " +
            "or turn on Full text below.") +
        " Read from Laurier" + APOS + "s own schedule pages " + META.readOn + ", including " +
        "the venue, host and registration detail Laurier keeps hidden until you open " +
        "an event.</p>"
      : '<p class="docsum">Laurier publishes <b>no schedule at all</b> for this combination. ' +
        "Change an answer below and the document rebuilds.</p>") +
    (Object.keys(GLOBAL_LINK).length
      ? '<p class="doclinks"><span class="dllab">On every event in this schedule</span>' +
        (function () {
          var seen = {}, out = [];
          list.forEach(function (e) {
            ((e.l || []).concat(e.sl || [], e.pl || [])).forEach(function (l) {
              if (!GLOBAL_LINK[l.href] || GLOBAL_LINK[l.href] <= 3 || seen[l.href]) return;
              seen[l.href] = 1;
              out.push('<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' +
                       esc(l.text) + "</a>");
            });
          });
          return out.join('<span class="dlsep">·</span>');
        })() + "</p>"
      : "") +
    (Object.keys(SHARED).length
      ? '<div class="shared">' + Object.keys(SHARED).map(function (id) {
          var x = SHARED[id];
          return "<p><b>" + esc(x.k) + ".</b> " + esc(x.v) +
            ' <span class="sharedn">applies to ' + x.n + " of your events</span></p>";
        }).join("") + '<p class="sharednote">Laurier repeats these under every event ' +
        "on the schedule they come from. They are stated here once instead.</p></div>"
      : "") +
    '<div class="answers"><span class="anslab">Your answers</span>' +
      ansChip("level", "Level", META.levelLabels[sel.level] || sel.level) +
      ansChip("campus", "Campus", sel.campus) +
      ansChip("term", "Starting", sel.term) +
      (Object.keys(liveStreams(sel)).length
        ? ansChip("streams", "Also me", sel.streams.length ? sel.streams.join(", ") : "nothing extra")
        : "") +
      (livePrograms(sel).length
        ? ansChip("program", "Programme",
            sel.program === NO_PROGRAM ? "not listed" : (sel.program || "every programme"))
        : "") +
      '<button class="redo" id="again">Redo the whole interview</button></div>' + ansPanel();

  var counts = keys.map(function (k) { return shown.filter(function (e) { return (e.d || "TBA") === k; }).length; });
  $("contents").hidden = !keys.length;

  $("contents").innerHTML = keys.length
    ? '<span class="clab">Jump to</span>' + keys.map(function (k, i) {
        var dt = k === "TBA" ? null : new Date(k + "T00:00:00");
        var np = shown.filter(function (e) { return (e.d || "TBA") === k && picks[keyOf(e)]; }).length;
        return '<a class="cday" href="#day-' + k + '"><span class="cdow">' +
          (dt ? DOW3[dt.getDay()] : "TBA") + "</span><span class=\"cnum\">" +
          (dt ? dt.getDate() : "—") + '</span><span class="ccount">' + counts[i] +
          (np ? '<b>' + np + " picked</b>" : "") + "</span></a>";
      }).join("")
    : "";

  $("pages").innerHTML = keys.length ? keys.map(function (k) {
    var dayList = shown.filter(function (e) { return (e.d || "TBA") === k; });
    var dt = k === "TBA" ? null : new Date(k + "T00:00:00");
    var byBand = [[], [], [], []];
    dayList.forEach(function (e) { byBand[band(e)].push(e); });
    byBand.forEach(function (arr) {
      arr.sort(function (x, y) {
        var wx = parseWhen(x.n), wy = parseWhen(y.n);
        return (wx ? wx.s : 9999) - (wy ? wy.s : 9999);
      });
    });
    var past = dt && k < NOW;
    return '<section class="day" id="day-' + k + '">' +
      '<h2 class="dayhead"><span class="hdow">' + (dt ? DOW[dt.getDay()] : "No date published") + "</span>" +
      (dt ? '<span class="hnum">' + dt.getDate() + '</span><span class="hmon">' + MONF[dt.getMonth()] +
            " " + dt.getFullYear() + "</span>" : "") +
      '<span class="hcount">' + dayList.length + " event" + (dayList.length === 1 ? "" : "s") +
      (past ? " \u00b7 already passed" : "") + "</span>" +
      (density === "full" ? "" :
        '<button class="dayfull' + (openDays[k] ? " on" : "") + '" data-full="' + k + '">' +
        (openDays[k] ? "\u25b4 Titles only" : "\u25be Read this day in full") + "</button>") +
      "</h2>" +
      byBand.map(function (arr, bi) {
        if (!arr.length) return "";
        return '<div class="bandblk"><h3 class="bandhead">' + BANDS[bi] + "</h3>" +
               arr.map(function (e) { return entryHtml(e, density === "full" || !!openDays[k]); }).join("") +
               "</div>";
      }).join("") + "</section>";
  }).join("")
    : '<div class="none"><p><b>Nothing to show.</b></p><p>' +
      (onlyPicks ? "You have not ticked anything yet. Turn off “only my picks” to see the whole schedule."
                 : "Laurier publishes no schedule for this combination. Change your answers above.") + "</p></div>";

  wireDoc();
  drawPlanbar();
  syncRail();
}

/* Changing one answer should not throw a full-screen dark interview back over
   the document. This edits it in place, with the same live counts. */
function ansPanel() {
  if (!editing) return "";
  function preview(patch) {
    var s2 = { level: sel.level, campus: sel.campus, term: sel.term,
               streams: sel.streams.slice(), program: sel.program };
    Object.keys(patch).forEach(function (k) { s2[k] = patch[k]; });
    settle(s2);
    return countExact(s2);
  }
  var h = '<div class="anspanel"><div class="apin">';
  if (editing === "level" || editing === "campus" || editing === "term") {
    var vals = editing === "level" ? META.levels : editing === "campus" ? META.campuses : META.terms;
    var labs = editing === "level" ? META.levelLabels : null;
    h += '<h4>' + (editing === "level" ? "Which schedule are you on?"
                 : editing === "campus" ? "Which campus?" : "When do you start?") + "</h4>" +
      '<div class="aprow">' + vals.map(function (v) {
        var patch = {}; patch[editing] = v;
        var n = preview(patch);
        return '<button class="apb' + (sel[editing] === v ? " on" : "") + (n ? "" : " zero") + '" data-set="' +
          editing + '" data-v="' + esc(v) + '"' + (n ? "" : " disabled") + ">" +
          esc((labs || {})[v] || v) + '<span class="apn">' + n + "</span></button>";
      }).join("") + "</div>";
  } else if (editing === "streams") {
    var live = liveStreams(sel), here = countExact(sel);
    h += "<h4>Does any of this apply to you?</h4><div class=\"aprow\">" +
      META.streams.filter(function (t) { return live[t]; }).map(function (t) {
        var on = sel.streams.indexOf(t) >= 0;
        var alt = on ? sel.streams.filter(function (x) { return x !== t; }) : sel.streams.concat([t]);
        var d = preview({ streams: alt }) - here;
        return '<button class="apb' + (on ? " on" : "") + '" data-set="stream" data-v="' + esc(t) + '">' +
          esc(streamLabel(t)) + '<span class="apn">' + (d > 0 ? "+" + d : String(d)) + "</span></button>";
      }).join("") + "</div>";
  } else if (editing === "program") {
    var progs = livePrograms(sel);
    h += "<h4>Which programme or faculty?</h4>" +
      '<select class="apsel" id="apsel"><option value="">Every programme’s welcome</option>' +
      '<option value="' + NO_PROGRAM + '"' + (sel.program === NO_PROGRAM ? " selected" : "") +
      '>Mine is not on the list</option>' +
      progs.map(function (pn) {
        return '<option value="' + esc(pn) + '"' + (pn === sel.program ? " selected" : "") + ">" +
               esc(pn) + "</option>";
      }).join("") + "</select>";
  }
  h += '<button class="apclose" data-edit="">Done</button></div></div>';
  return h;
}

function ansChip(k, label, value) {
  return '<button class="ans" data-edit="' + k + '"><span class="anskey">' + esc(label) +
    '</span><span class="ansval">' + esc(value) + '</span><span class="anspen">change</span></button>';
}

/* The jump rail's height changes with the number of days, so the day heading
   cannot guess its own offset — guessed at 52px it sliced the date numeral in
   half for the whole scroll. */
function syncRail() {
  var r = $("contents");
  document.documentElement.style.setProperty(
    "--rail", (r && !r.hidden ? r.offsetHeight : 0) + "px");
}

function wireDoc() {
  $("again").onclick = function () { editing = null; reopen(); };

  [].slice.call($("dochead").querySelectorAll("[data-edit]")).forEach(function (b) {
    b.onclick = function () {
      editing = b.dataset.edit === editing ? null : (b.dataset.edit || null);
      drawDoc();
    };
  });
  [].slice.call($("dochead").querySelectorAll("[data-set]")).forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.set, v = b.dataset.v;
      if (k === "stream") {
        var i = sel.streams.indexOf(v);
        if (i >= 0) sel.streams.splice(i, 1); else sel.streams.push(v);
      } else { sel[k] = v; }
      settle(sel); writeHash(); drawDoc();
    };
  });
  if ($("apsel")) $("apsel").onchange = function () {
    sel.program = this.value; settle(sel); writeHash(); drawDoc();
  };
  [].slice.call($("pages").querySelectorAll("[data-full]")).forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.full;
      if (openDays[k]) delete openDays[k]; else openDays[k] = true;
      drawDoc();
      var n = document.getElementById("day-" + k);
      if (n) n.scrollIntoView({ block: "start" });
    };
  });
  [].slice.call($("pages").querySelectorAll("[data-pick]")).forEach(function (b) {
    b.onclick = function () {
      var i = b.dataset.pick;
      if (picks[i]) delete picks[i]; else picks[i] = true;
      if (!Object.keys(picks).length) onlyPicks = false;
      writeHash();
      drawDoc();
    };
  });
}

/* ---- the plan ----------------------------------------------------------- */
function pickedEvents() {
  return Object.keys(picks).map(function (k) { return BYKEY[k]; })
    .filter(Boolean)
    .sort(function (x, y) {
      var ax = x.d || "9999", ay = y.d || "9999";
      if (ax !== ay) return ax < ay ? -1 : 1;
      var wx = parseWhen(x.n), wy = parseWhen(y.n);
      return (wx ? wx.s : 9999) - (wy ? wy.s : 9999);
    });
}
/* Ticking both copies of a twice-published record is not a clash with yourself,
   so picks are folded by dupKey before pairing -- the old pairwise walk counted
   that pair, and every phantom it counted inflated the headline. */
function distinctPicked() {
  var seen = {}, out = [];
  pickedEvents().forEach(function (e) {
    var k = dupKey(e);
    if (seen[k]) return;
    seen[k] = true;
    out.push(e);
  });
  return out;
}
function clashCount() {
  var p = distinctPicked(), n = 0;
  for (var i = 0; i < p.length; i++) n += clashSet(p[i], p.slice(i + 1)).length;
  return n;
}
function drawPlanbar() {
  var p = pickedEvents(), c = clashCount();
  $("planbar").innerHTML =
    '<div class="planin">' +
      '<span class="plancount"><b>' + p.length + "</b> ticked" +
      (c ? ' <button class="planclash" id="clashbtn">' + c + " overlap" + (c === 1 ? "" : "s") +
           " — show me</button>" : "") + "</span>" +
      '<div class="planacts">' +
        '<button class="pb' + (density === "full" ? " on" : "") + '" id="densebtn">' +
          (density === "brief" ? "Full text" : "Titles only") + "</button>" +
        (p.length
          ? '<button class="pb' + (onlyPicks ? " on" : "") + '" id="onlybtn">' +
              (onlyPicks ? "Showing only my picks" : "Show only my picks") + "</button>" +
            '<button class="pb" id="icsbtn">Add to calendar</button>'
          : '<span class="planhint">Tick an event to build a plan you can filter, export and print.</span>') +
        '<button class="pb" id="topbtn">Top</button>' +
        '<button class="pb primary" id="printbtn">Print</button>' +
      "</div>" +
    "</div>";
  if ($("onlybtn"))
    $("onlybtn").onclick = function () { onlyPicks = !onlyPicks; writeHash(); drawDoc(); window.scrollTo(0, 0); };
  if ($("icsbtn")) $("icsbtn").onclick = downloadIcs;
  $("printbtn").onclick = function () { window.print(); };
  $("topbtn").onclick = function () { window.scrollTo({ top: 0, behavior: "smooth" }); };
  if ($("clashbtn")) $("clashbtn").onclick = function () {
    var p = pickedEvents(), first = null;
    for (var i = 0; i < p.length && !first; i++) {
      if (clashesWith(p[i]).length) first = p[i];
    }
    if (!first) return;
    if (!openDays[first.d || "TBA"]) { openDays[first.d || "TBA"] = true; drawDoc(); }
    var n = document.getElementById("ev-" + first.__i);
    if (n) { n.scrollIntoView({ block: "center", behavior: "smooth" }); n.classList.add("flash"); }
  };
  $("densebtn").onclick = function () {
    density = density === "brief" ? "full" : "brief";
    if (density === "full") openDays = {};
    writeHash(); drawDoc();
  };
}

/* ---- calendar export ---------------------------------------------------- */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function icsEscape(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;")
    .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line) {
  var out = [], s = line;
  while (s.length > 72) { out.push(s.slice(0, 72)); s = " " + s.slice(72); }
  out.push(s);
  return out.join("\r\n");
}
function downloadIcs() {
  var p = pickedEvents();
  if (!p.length) return;
  var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Laurier Orientation//Your Orientation//EN",
           "CALSCALE:GREGORIAN"];
  p.forEach(function (e, i) {
    var d = e.d, w = parseWhen(e.n);
    L.push("BEGIN:VEVENT");
    L.push("UID:laurier-orientation-" + e.__i + "-" + i + "@wlu.ca");
    L.push("DTSTAMP:20260831T000000Z");
    if (d && w) {
      var ds = d.replace(/-/g, "");
      L.push("DTSTART:" + ds + "T" + pad(Math.floor(w.s / 60)) + pad(w.s % 60) + "00");
      L.push("DTEND:" + ds + "T" + pad(Math.floor(w.e / 60) % 24) + pad(w.e % 60) + "00");
    } else if (d) {
      L.push("DTSTART;VALUE=DATE:" + d.replace(/-/g, ""));
    } else {
      L.push("DTSTART;VALUE=DATE:20260901");
    }
    L.push(fold("SUMMARY:" + icsEscape(e.t)));
    if (e.w) L.push(fold("LOCATION:" + icsEscape(e.w)));
    var desc = [];
    if (!w && e.n) desc.push("Time as published: " + e.n);
    if (e.h) desc.push("Host: " + e.h);
    if (e.a) desc.push("Audience: " + e.a);
    if (e.c) desc.push("Cost: " + e.c);
    if (e.x) desc.push(e.x);
    desc.push("Source: " + e.u);
    L.push(fold("DESCRIPTION:" + icsEscape(desc.join("\n"))));
    L.push(fold("URL:" + e.u));
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  var text = L.join("\r\n") + "\r\n";
  var name = "laurier-orientation.ics";
  var a = document.createElement("a");
  a.download = name;
  try {
    a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  } catch (err) {
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(text);
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
      "). Yours, if any, are gathered at the end under “no date published”."]);
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
    notes.push(["Programme and faculty welcomes carry no audience on Laurier's page",
      prog + " events are specific to one programme or faculty, but Laurier states no audience " +
      "restriction on them, so unless you named your programme they all appear. Answer that " +
      "question again to narrow them — Laurier does not publish a welcome for every programme."]);
  }
  if (!notes.length) return;
  $("noteslist").innerHTML = notes.map(function (n, i) {
    return "<li><b>" + String(i + 1).padStart(2, "0") + "</b><div><strong>" + n[0] + "</strong><p>" + n[1] + "</p></div></li>";
  }).join("");
  $("notes").hidden = false;
}

/* ---- hash --------------------------------------------------------------- */
function writeHash() {
  if (!sel) return;
  var p = "level=" + encodeURIComponent(sel.level) +
          "&campus=" + encodeURIComponent(sel.campus) +
          "&term=" + encodeURIComponent(sel.term);
  if (sel.streams.length) p += "&streams=" + encodeURIComponent(sel.streams.join("|"));
  if (sel.program) p += "&program=" + encodeURIComponent(sel.program);
  var ks = Object.keys(picks);
  if (ks.length) p += "&picks=" + ks.join("|");
  store("laurier-orientation-picks", ks.length ? ks.join("|") : null);
  store("laurier-orientation-answers", [sel.level, sel.campus, sel.term].join("|"));
  if (onlyPicks) p += "&only=1";
  if (density === "full") p += "&full=1";
  history.replaceState(null, "", "#" + p);
}
function readHash() {
  var h = location.hash.replace(/^#/, ""), p = {};
  h.split("&").forEach(function (kv) {
    var i = kv.indexOf("=");
    if (i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
  });
  var complete = META.levels.indexOf(p.level) >= 0 && META.campuses.indexOf(p.campus) >= 0 &&
                 META.terms.indexOf(p.term) >= 0;
  draft = {
    level:  META.levels.indexOf(p.level) >= 0 ? p.level : META.levels[0],
    campus: META.campuses.indexOf(p.campus) >= 0 ? p.campus : META.campuses[0],
    term:   META.terms.indexOf(p.term) >= 0 ? p.term : META.terms[0],
    streams: p.streams ? p.streams.split("|").filter(function (s) { return GATES.indexOf(s) >= 0; }) : [],
    program: p.program || ""
  };
  settle(draft);
  /* The three answers are remembered the way the picks are. C is the only
     variant that gates, and gating a returning student again is the cost of
     that choice; it does not have to be paid twice. */
  if (!complete) {
    var was = (recall("laurier-orientation-answers") || "").split("|");
    if (was.length === 3 && META.levels.indexOf(was[0]) >= 0 &&
        META.campuses.indexOf(was[1]) >= 0 && META.terms.indexOf(was[2]) >= 0) {
      draft.level = was[0]; draft.campus = was[1]; draft.term = was[2];
      settle(draft);
      complete = true;
    }
  }
  var saved = p.picks || recall("laurier-orientation-picks") || "";
  saved.split("|").forEach(function (k) { if (k && BYKEY[k]) picks[k] = true; });
  onlyPicks = p.only === "1" && Object.keys(picks).length > 0;
  density = p.full === "1" ? "full" : "brief";
  return complete;
}

/* ---- go ----------------------------------------------------------------- */
EV.forEach(function (e, i) { e.__i = i; });
onePerEvent(EV).forEach(function (e) { BYKEY[keyOf(e)] = e; });
var resumed = readHash();
buildNotes();
if (resumed) {
  finish();
} else {
  onlyPicks = false;
  $("ask").hidden = false;
  drawAsk();
}
