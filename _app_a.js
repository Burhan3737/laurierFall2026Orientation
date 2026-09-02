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
  var m = String(t || "").match(/^(Sun|Mon|Tues?|Wed(nes)?|Thurs?|Fri|Satur?)(day)?,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s*\d{1,2}\s*[-–—:]\s*/i);
  return m ? String(t).slice(m[0].length) : String(t || "");
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
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function $(id) { return document.getElementById(id); }

/* ---- state -------------------------------------------------------------- */
var view = "day";       // "day" | "week" | "clash"
var day  = null;        // ISO date when view === "day"
var MORE = null;        // null until the refinements row is folded or unfolded by hand
var ghosts = false;     // draw events this student may not attend
var picked = null;      // index of the event open in the sheet
var asList = false;     // read the day as an agenda instead of a clock

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
function countExact(pick) {
  var prev = sel; sel = pick;
  var n = EV.filter(function (e) { return assess(e).ok; }).length;
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
function visible() {
  return EV.filter(function (e) { return ghosts ? true : assess(e).ok; });
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
  h += '<div class="views">' +
       (wide ? '<button class="vb' + (view === "week" ? " on" : "") + '" data-view="week">Whole run</button>' : "") +
       '<button class="vb' + (view === "day" ? " on" : "") + '" data-view="day">One day</button>' +
       '<button class="vb' + (view === "clash" ? " on" : "") + '" data-view="clash">Clashes' +
       (clashN ? '<span class="vbn">' + clashN + "</span>" : "") + "</button></div>";
  h += '<div class="bars">';
  keys.forEach(function (k, i) {
    var undated = k === "TBA", dt = undated ? null : new Date(k + "T00:00:00");
    var past = !undated && k < NOW, today = k === NOW;
    h += '<button class="bar' + (view === "day" && k === day ? " sel" : "") + (past ? " past" : "") +
      (today ? " today" : "") + '" data-day="' + k + '" title="' + counts[i] + ' events">' +
      '<span class="barn">' + counts[i] + "</span>" +
      '<span class="barw"><span class="barf" style="height:' + Math.max(6, Math.round(100 * counts[i] / max)) + '%"></span></span>' +
      '<span class="bard">' + (undated ? "TBA" : DOW3[dt.getDay()]) + "</span>" +
      '<span class="barm">' + (undated ? "—" : dt.getDate()) + "</span></button>";
  });
  h += "</div></div>";
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
  return '<button class="rib' + (off ? " off" : "") + '" ' +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(e.t) + '" data-id="' + e.__i + '">' +
    '<span class="rt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
    '<span class="rh">' + esc(title(e)) + "</span></button>";
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

function makeScale(items, ppm) {
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
      if (ge - gs >= GAP_MIN) { blocks.push({ a: gs, b: ge, y: y, h: GAP_PX, gap: true }); y += GAP_PX; }
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

function rules(sc) {
  var h = "";
  sc.blocks.forEach(function (bl) {
    if (bl.gap) {
      h += '<div class="gapband" style="top:' + bl.y + "px;height:" + bl.h + 'px"><span>' +
           "nothing published between " + clock(bl.a) + " and " + clock(bl.b) + "</span></div>";
      return;
    }
    for (var m = Math.ceil(bl.a / 60) * 60; m <= bl.b; m += 60)
      h += '<div class="rule" style="top:' + sc.pos(m) + 'px"></div>';
  });
  return h;
}

/* A block on the day clock. Nothing else uses this: the whole-run view gave up
   on drawing hours and lists names instead. */
function blockHtml(it, sc) {
  var e = it.ev, a = assess(e), off = !a.ok;
  var u = 100 / it.ncol, left = it.col * u, w = u * Math.min(it.span || 1, it.ncol - it.col);
  var cls = "blk" + (off ? " off" : (e.oa ? " open" : "")) + (it.ncol > 1 ? " clash" : "") +
            (e.d && e.d < NOW ? " past" : "");
  var top = sc.pos(it.s), bot = sc.pos(it.de);
  var label = clock(it.s) + "–" + clock(it.e) + " · " + (e.t || "") + (e.w ? " · " + e.w : "");
  return '<article class="' + cls + '" style="top:' + top + "px;height:" +
    Math.max(30, bot - top - 2) + "px;left:calc(" + left + "% + 1px);width:calc(" + w + "% - 3px)\" " +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(e.t) + '" data-id="' + e.__i +
    '" tabindex="0" title="' + esc(label) + '">' +
    '<span class="bt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
    '<span class="bh">' + esc(title(e)) + "</span>" + dupTag(e) +
    '<span class="bw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) + "</span>" +
    (off ? '<span class="bx">' + esc(a.reason) + "</span>" : "") + "</article>";
}
function looseHtml(e) {
  var a = assess(e), off = !a.ok;
  return '<button class="chipev' + (off ? " off" : "") + '" ' +
    (off ? 'data-ev-off="' : 'data-ev-title="') + esc(e.t) + '" data-id="' + e.__i + '">' +
    '<span class="ch">' + esc(title(e)) + "</span>" +
    '<span class="cw">' + esc(off ? a.reason : (e.n || e.w || "Time not published")) + "</span></button>";
}

/* Laurier publishes some events on more than one schedule page, and a few more
   than once on the same page. The incumbent reproduces every copy and six audit
   rounds decided that was right, so nothing is dropped here either -- but a
   student seeing the same line twice deserves to be told why. */
var DUP = {};
function markDups(list) {
  DUP = {};
  var g = {};
  list.forEach(function (e) {
    var k = dupKey(e);
    (g[k] = g[k] || []).push(e);
  });
  Object.keys(g).forEach(function (k) {
    var arr = g[k];
    if (arr.length < 2) return;
    arr.forEach(function (e, i) {
      DUP[e.__i] = { n: arr.length, i: i + 1,
        others: arr.filter(function (o) { return o !== e; })
                   .map(function (o) { return o.s || "another section"; }) };
    });
  });
}
function dupTag(e) {
  var d = DUP[e.__i];
  return d ? '<span class="dup" title="Laurier lists this event ' + d.n +
    ' times, with the same day, time and venue">' +
    (d.n === 2 ? "listed twice" : "listed " + d.n + " times") + "</span>" : "";
}

/* ---- the board ---------------------------------------------------------- */
var looseCarry = [];
function drawBoard() {
  var list = visible(), keys = dayKeys(list);
  markDups(list);
  looseCarry = [];
  if (!keys.length) {
    $("board").innerHTML = '<div class="empty"><p>Laurier publishes nothing for this combination yet.</p>' +
      "<p>Try another term, or tick a stream above.</p></div>";
    return;
  }
  $("board").innerHTML = view === "week" ? weekHtml(list, keys)
                      : view === "clash" ? clashHtml(list)
                      : dayHtml(list, keys);
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

   - Laurier's duplicate listings are not a clash. The board already labels them
     "listed twice"; charging them against the student as a conflict as well is
     the page contradicting itself on adjacent lines.
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

    // one representative per set of Laurier duplicates
    var seenKey = {}, items = [];
    timed.forEach(function (it) {
      var key = dupKey(it.ev);
      if (seenKey[key]) return;
      seenKey[key] = true;
      items.push(it);
    });
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
        return '<li><button class="clopt" data-ev-title="' + esc(e.t) + '" data-id="' + e.__i + '">' +
          '<span class="clt">' + clock(it.s) + "–" + clock(it.e) + "</span>" +
          '<span class="clname">' + esc(title(e)) + dupTag(e) + "</span>" +
          '<span class="clw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) +
            (e.h ? ' <span class="cldot">·</span> ' + esc(e.h) : "") + "</span>" +
          (e.oa ? '<span class="clopen">open to all Laurier students</span>' : "") +
          "</button></li>";
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

  var h = '<div class="weekwrap"><div class="wkhead"><span class="wklab">The run</span>' +
    '<div class="wkaxis">' + ticks + "</div></div>";

  dated.forEach(function (k) {
    var dt = new Date(k + "T00:00:00"), past = k < NOW;
    var pt = rows[k];
    // Laurier listing an event twice draws two identical bars, which reads as a
    // rendering fault. One bar, marked, and the day view still shows both. Where
    // two entries share a title and a start time but sit in different rooms they
    // are not duplicates, so both are drawn and the label says which is which.
    var seenB = {}, uniq = [], byTitle = {};
    pt.timed.concat(pt.long).forEach(function (it) {
      var dk = dupKey(it.ev);
      if (seenB[dk]) return;
      seenB[dk] = true;
      uniq.push(it);
      var tk = stripDay(it.ev.t) + " @" + it.s;
      byTitle[tk] = (byTitle[tk] || 0) + 1;
    });
    var items = placed(uniq, 20);
    var lanes = items.reduce(function (mx, it) { return Math.max(mx, it.col + 1); }, 1);
    var shown = items;
    var n = onDay(list, k).length;

    h += '<div class="wkrow' + (past ? " past" : "") + (k === NOW ? " today" : "") + '">' +
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
          (it.ncol > 1 ? " clash" : "") + (DUP[e.__i] ? " wdup" : "") +
          '" style="left:' + left + "%;width:" + wide + "%;top:" + btop + "px\" " +
          (off ? 'data-ev-off="' : 'data-ev-title="') + esc(e.t) + '" data-id="' + e.__i +
          '" title="' + esc(clock(it.s) + "–" + clock(it.e) + " · " + e.t +
            (e.w ? " · " + e.w : "") + (DUP[e.__i] ? " · Laurier lists this " +
            DUP[e.__i].n + " times" : "")) + '">' +
          lab[0] +
          "</button>";
      }).join("") +
      "</div></div>";
    pt.loose.forEach(function (e) { looseCarry.push([k, e]); });
  });
  h += "</div>";

  onDay(list, "TBA").forEach(function (e) { looseCarry.push(["TBA", e]); });
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
function agendaHtml(items) {
  var prevEnd = null;
  return '<div class="agenda">' + items.map(function (it) {
    var gap = "";
    if (prevEnd !== null && it.s - prevEnd >= GAP_MIN)
      gap = '<div class="aggap">nothing published between ' + clock(prevEnd) + " and " + clock(it.s) + "</div>";
    prevEnd = prevEnd === null ? it.de : Math.max(prevEnd, it.de);
    var e = it.ev, a = assess(e), off = !a.ok;
    var clash = items.filter(function (o) { return o !== it && o.s < it.e && it.s < o.e; });
    return gap + '<article class="ag' + (off ? " off" : (e.oa ? " open" : "")) + '" ' +
      (off ? 'data-ev-off="' : 'data-ev-title="') + esc(e.t) + '" data-id="' + e.__i + '" tabindex="0">' +
      '<div class="agt">' + clock(it.s) + "<span>" + clock(it.e) + "</span></div>" +
      '<div class="agb"><h4>' + esc(title(e)) + "</h4>" + dupTag(e) +
        '<p class="agw">' + esc(e.w || (e.vr ? "Online" : "Venue not published")) + "</p>" +
        (off ? '<p class="agx">' + esc(a.reason) + "</p>" : "") +
        (clash.length ? '<p class="agc">' + clash.length + " other" + (clash.length === 1 ? "" : "s") +
                        " at this time</p>" : "") +
      "</div></article>";
  }).join("") + "</div>";
}

function dayHtml(list, keys) {
  if (keys.indexOf(day) === -1) day = keys[0];
  var i = keys.indexOf(day);
  var undated = day === "TBA", dt = undated ? null : new Date(day + "T00:00:00");
  var todays = onDay(list, day);
  var parts = split(todays);
  var items = placed(parts.timed, 52);
  var sc = items.length ? makeScale(items, 1.15) : null;
  var clashes = items.filter(function (it) { return it.ncol > 1; }).length;
  var lanes = items.reduce(function (m, it) { return Math.max(m, it.ncol); }, 0);
  var narrow = window.innerWidth < 700;
  // Surrendering the clock on the busiest day gives up the one thing this view
  // is for. Past MAX_LANES it tightens instead, and only a phone forces the list.
  var tight = lanes > MAX_LANES;
  var listNow = asList || narrow;

  // the board opens on the busiest day ahead, so the thing worth pointing at is
  // where the run actually starts
  var firstK = keys.filter(function (k) { return k !== "TBA" && k >= NOW; })[0];
  var away = firstK && firstK !== day;
  var fdt = away ? new Date(firstK + "T00:00:00") : null;

  var h = '<div class="dayhead"><div class="dayin">' +
    '<button class="step" data-step="-1"' + (i <= 0 ? " disabled" : "") + ' aria-label="Previous day">‹</button>' +
    '<div class="dtitle"><h2>' + (undated ? "Undated" : DOW[dt.getDay()] + " " + dt.getDate() + " " + MON[dt.getMonth()] + " " + dt.getFullYear()) + "</h2>" +
    "<p>" + todays.length + " event" + (todays.length === 1 ? "" : "s") +
    (clashes ? ' · <b class="clashn">' + clashes + " run at the same time as something else</b>" : " · nothing overlaps") +
    (parts.loose.length ? " · " + parts.loose.length + " without a clock time" : "") + "</p>" +
    (away ? '<p class="peak">This is your busiest day. Orientation starts on ' +
      '<button class="peakbtn" data-day="' + firstK + '">' + DOW[fdt.getDay()] + " " +
      fdt.getDate() + " " + MON[fdt.getMonth()] + " ›</button></p>" : "") + "</div>" +
    '<button class="step" data-step="1"' + (i >= keys.length - 1 ? " disabled" : "") + ' aria-label="Next day">›</button>' +
    '</div><div class="legend">' +
      (listNow ? "" : '<span class="lg lg-clash">runs at the same time as something else</span>' +
                      '<span class="lg lg-open">open to all Laurier students</span>') +
      (ghosts ? '<span class="lg lg-off">not open to you</span>' : "") +
      (narrow || items.length < 2 ? "" :
        '<button class="modebtn" data-mode="1">' +
        (listNow ? "Draw it on the clock" : "Read it as a list") + "</button>") +
      (tight && !asList
        ? '<span class="lgnote">' + lanes + " run at once here — the clock is tight; " +
          "the list may read easier</span>" : "") +
    "</div></div>";

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

function wireBlocks() {
  [].slice.call(document.querySelectorAll("#board [data-id]")).forEach(function (n) {
    n.onclick = function () { openSheet(+n.dataset.id); };
    n.onkeydown = function (ev) {
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
  row("Where", esc(e.w) || "Not published by Laurier");
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

  var links = (e.l || []).slice();
  (e.sl || []).concat(e.pl || []).forEach(function (l) {
    if (!links.some(function (x) { return x.href === l.href; })) links.push(l);
  });
  /* Registration is the only one of these with a deadline attached, so it leads
     and it is the only filled button. The rest are references. */
  var PRIMARY = /regist|rsvp|sign ?up|ticket|book now|purchase/i;
  var linkHtml = links.length ? '<div class="links">' + links.slice().sort(function (x, y) {
      return (PRIMARY.test(y.text || "") ? 1 : 0) - (PRIMARY.test(x.text || "") ? 1 : 0);
    }).map(function (l) {
      if (isDead(l.href))
        return '<span class="lk dead" title="' + esc(l.href) + '">' + esc(l.text) +
               " — link broken on Laurier’s site</span>";
      return '<a class="lk' + (PRIMARY.test(l.text || "") ? " primary" : "") + '" href="' +
        esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + " →</a>";
    }).join("") + "</div>" : "";

  var flagHtml = (e.f || []).length
    ? '<p class="flag">Not published by Laurier: ' + (e.f || []).map(function (f) {
        return { "no-date": "date", "no-time": "time", "no-venue": "venue" }[f] || f;
      }).join(", ") + ".</p>" : "";

  var dupNote = DUP[i] ? '<p class="dupnote"><b>Laurier lists this ' + DUP[i].n +
    " times</b> with the same day, time and venue. This is copy " + DUP[i].i + ", under " +
    esc(e.s || "an unnamed section") + "; the other" + (DUP[i].n > 2 ? "s are" : " is") + " under " +
    esc(DUP[i].others.join("; ")) + ". Nothing is hidden here — the board reproduces " +
    "Laurier's pages exactly as published.</p>" : "";

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
        DOW[new Date(e.d + "T00:00:00").getDay()] + "’s run — gold is what it collides with.</p></div>";
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
        (a.ok ? esc(e.a || (e.oa ? "Open to all students" : "You can attend this")) : esc(a.reason)) +
        (e.vr ? " · Online" : "") + "</div>" +
      "<h3>" + esc(title(e)) + "</h3>" +
      (e.pt ? '<p class="sparent">Part of ' + esc(e.pt) + "</p>" : "") +
      dupNote + ribbon +
      '<dl class="facts">' + facts + "</dl>" +
      clashList + linkHtml +
      (e.x ? '<div class="sdesc">' + paras(e.x).map(function (t) {
          return "<p>" + esc(t) + "</p>";
        }).join("") + "</div>" : "") + flagHtml +
      '<p class="cite"><strong>Cited from</strong><br><a href="' + esc(e.u) + '" target="_blank" rel="noopener">' +
        esc(e.u) + "</a><br>Accessed 31 Aug 2026, including the collapsed accordion panels.</p>" +
    "</div>";
  $("sheet").hidden = false; $("scrim").hidden = false;
  document.body.classList.add("locked");
  $("sclose").onclick = closeSheet;
  $("sclose").focus();
}
function closeSheet() {
  $("sheet").hidden = true; $("scrim").hidden = true;
  document.body.classList.remove("locked");
  if (picked !== null) {
    var n = document.querySelector('#board [data-id="' + picked + '"]');
    if (n) n.focus();
  }
  picked = null;
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
      "). They are listed under “no clock time published” rather than placed on the grid."]);
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
      "Laurier's own “TBD” placeholders, not just blank fields."]);
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
      "restriction on them, so by default they all show. Use the “My program” dropdown to " +
      "narrow to your own, or choose “Not listed” to hide them all — Laurier does not " +
      "publish a welcome for every program."]);
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
  p += "&view=" + view;
  if (view === "day" && day) p += "&day=" + day;
  /* Both of these change what is on the screen, so both belong in the link. A
     student who turns on the events they cannot attend and sends the page to a
     friend was sending a different page from the one they were looking at. */
  if (ghosts) p += "&ghosts=1";
  if (asList) p += "&list=1";
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
  if (p.view === "day" || p.view === "week" || p.view === "clash") view = p.view;
  ghosts = p.ghosts === "1";
  asList = ghosts || p.list === "1";
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

/* ---- go ----------------------------------------------------------------- */
EV.forEach(function (e, i) { e.__i = i; });
readHash();
/* The hash is written here and nowhere else. Two toggles had been added over the
   rounds that redrew the board without updating the link, which is the same
   mistake waiting for the third. Anything that changes the screen goes through
   redraw(), so the link cannot fall behind the screen. */
function redraw() { writeHash(); drawIdbar(); drawNav(); drawBoard(); }
redraw();
buildNotes();
$("scrim").onclick = closeSheet;
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
