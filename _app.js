/* ---------- model -------------------------------------------------------
   Each event carries: lv level, cp campus, tm term, tg identity tags,
   oa open-to-all override. An event is "mine" when level+campus+term line up
   AND every identity gate it sits behind is one the user claimed.
------------------------------------------------------------------------- */
var GATES = ["International","Exchange","Indigenous","Off-campus (LOCUS)","Residence",
             "Mature & Transfer","Accessible Learning"];
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];
var DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

var ALL_STREAMS = GATES.slice();
// Laurier leaked a CMS authoring URL into their published page; the host does not resolve.
// Reproduced faithfully, but flagged so nobody wastes time clicking it.
var DEAD_HOSTS = ["cms03.wlu.ca"];
function isDead(href) {
  return DEAD_HOSTS.some(function (h) { return href.indexOf("//" + h) >= 0; });
}
var sel = null, showFit = "mine", hidePast = false, Q = "";

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
    if (!claimed.length) return { ok: false, reason: g.join(" / ") + " students only" };
  }
  return { ok: true, reason: e.oa && e.lv !== sel.level ? "Open to all Laurier students" : "" };
}

function dobj(e) { return e.d ? new Date(e.d + "T00:00:00") : null; }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- rendering ---------------------------------------------------- */
function card(e) {
  var a = assess(e);
  var dt = dobj(e);
  var past = dt && e.d < TODAY;
  var tier = a.ok ? (e.oa ? "open" : "core") : "no";
  var badge = a.ok
    ? '<span class="badge ' + (e.oa ? "b-open" : "b-core") + '">' + esc(e.a || (e.oa ? "Open to all students" : "For you")) + "</span>"
    : '<span class="badge b-no">' + esc(a.reason) + "</span>";

  var when = e.d
    ? DOW[dt.getDay()] + ", " + MON[dt.getMonth()] + ". " + dt.getDate() + ", " + dt.getFullYear() + (e.n ? " — " + esc(e.n) : "")
    : (e.n ? esc(e.n) : "Date not published");

  var facts = "";
  function row(k, v) { if (v) facts += "<dt>" + k + "</dt><dd>" + v + "</dd>"; }
  row("When", when);
  row("Where", esc(e.w) || "Not published by Laurier");
  row("Host", esc(e.h));
  row("Audience", esc(e.a));
  row("Cost", esc(e.c));
  row("Stream", (e.tg || []).length ? esc((e.tg || []).join(", ")) : "");
  if (e.s && /Program and Faculty Welcomes/i.test(e.s))
    row("Note", "This is a welcome for one specific program. Attend only the one matching your own.");
  row("Schedule", esc(e.lv === "all" ? "All levels" : e.lv) + " &middot; " + esc((e.cp || []).join(", ")) + " &middot; " + esc(e.tm));

  Object.keys(e.si || {}).forEach(function (k) { row(k, esc(e.si[k])); });

  var links = (e.l || []).slice();
  (e.sl || []).concat(e.pl || []).forEach(function (l) {
    if (!links.some(function (x) { return x.href === l.href; })) links.push(l);
  });
  var linkHtml = links.length
    ? links.map(function (l) {
        if (isDead(l.href)) {
          return '<span class="reglink dead" title="' + esc(l.href) +
                 '">' + esc(l.text) + " — link broken on Laurier's site</span>";
        }
        return '<a class="reglink" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + " &rarr;</a>";
      }).join(" ")
    : "";

  var flagHtml = (e.f || []).length
    ? '<div class="note">Not published by Laurier: ' + (e.f || []).map(function (f) {
        return { "no-date": "date", "no-time": "time", "no-venue": "venue" }[f] || f;
      }).join(", ") + '.</div>'
    : "";

  return '<details class="ev' + (past ? " past" : "") + '" data-tier="' + tier + '">' +
    "<summary>" +
      '<div class="time">' + (e.n ? esc(e.n) : "Time TBA") + "</div>" +
      "<h3>" + esc(e.t) + "</h3>" +
      '<div class="metaline">' + badge +
        '<span class="where">' + esc(e.w || e.s || "") + "</span>" +
        '<span class="exp">details</span>' +
      "</div>" +
    "</summary>" +
    '<div class="body">' +
      (e.x ? '<p class="desc">' + esc(e.x) + "</p>" : "") +
      '<dl class="facts">' + facts + "</dl>" +
      linkHtml + flagHtml +
      '<div class="cite"><strong>Cited from:</strong><br>&middot; <a href="' + esc(e.u) +
        '" target="_blank" rel="noopener">' + esc(e.u) + "</a><br>&middot; Accessed 31 Aug 2026, including the collapsed accordion panels.</div>" +
    "</div></details>";
}

function render() {
  var list = EV.filter(function (e) {
    var a = assess(e);
    if (showFit === "mine" && !a.ok) return false;
    if (hidePast && e.d && e.d < TODAY) return false;
    if (Q) {
      var hay = [e.t, e.w, e.h, e.x, e.s, (e.tg || []).join(" ")].join(" ").toLowerCase();
      if (hay.indexOf(Q) === -1) return false;
    }
    return true;
  });

  list.sort(function (x, y) {
    var a = x.d || "9999", b = y.d || "9999";
    return a < b ? -1 : a > b ? 1 : 0;
  });

  var days = [], seen = {};
  list.forEach(function (e) { var k = e.d || "TBA"; if (!seen[k]) { seen[k] = []; days.push(k); } seen[k].push(e); });

  document.getElementById("timeline").innerHTML = days.length ? days.map(function (k) {
    var undated = (k === "TBA"), dt = undated ? null : new Date(k + "T00:00:00");
    var past = !undated && k < TODAY;
    return '<div class="daygroup"><div class="daycol"><div class="sticky">' +
      '<div class="dow">' + (undated ? "Undated" : DOW[dt.getDay()]) + "</div>" +
      '<div class="dnum">' + (undated ? "&mdash;" : dt.getDate()) + "</div>" +
      '<div class="dmon">' + (undated ? "TBA" : MON[dt.getMonth()] + " " + dt.getFullYear()) + "</div>" +
      (past ? '<div class="dtag">Passed</div>' : "") +
      '</div></div><div class="events">' + seen[k].map(card).join("") + "</div></div>";
  }).join("")
    : '<p class="empty">No events match. Try “Everything”, or tick a stream above.</p>';

  document.getElementById("count").textContent = list.length + " shown";
}

/* ---------- data notes --------------------------------------------------- */
function buildNotes() {
  var notes = [];
  var undated = EV.filter(function (e) { return !e.d; });
  if (undated.length) {
    var byTerm = {};
    undated.forEach(function (e) { byTerm[e.tm] = (byTerm[e.tm] || 0) + 1; });
    notes.push(["Events published without a date",
      undated.length + " events carry no date on Laurier's page (" +
      Object.keys(byTerm).map(function (t) { return byTerm[t] + " in " + t; }).join(", ") +
      "). They appear at the end of the board under “Undated”."]);
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
    notes.push(["The entire Winter 2027 schedule is a placeholder",
      "All " + winter.length + " Winter 2027 events are published with no date and TBD for time and venue. " +
      "Laurier states registration opens in October 2026."]);
  }
  var prog = EV.filter(function (e) { return e.s && /Program and Faculty Welcomes/i.test(e.s); }).length;
  if (prog) {
    notes.push(["Program welcomes are not filtered by program",
      prog + " graduate program and faculty welcomes carry no audience restriction on Laurier's page, so they " +
      "all appear for every graduate student on that campus. Only the one matching your own program is yours — " +
      "each card is marked accordingly."]);
  }

  var list = document.getElementById("noteslist");
  if (!notes.length) return;
  list.innerHTML = notes.map(function (n, i) {
    return "<li><b>" + String(i + 1).padStart(2, "0") + "</b><div><strong>" + n[0] + "</strong><p>" + n[1] + "</p></div></li>";
  }).join("");
  document.getElementById("notes").hidden = false;
}

/* ---------- chooser ------------------------------------------------------ */
function readChooser() {
  function one(n) { var el = document.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : null; }
  var streams = [].slice.call(document.querySelectorAll('input[name="stream"]:checked')).map(function (i) { return i.value; });
  return { level: one("level"), campus: one("campus"), term: one("term"), streams: streams };
}

document.getElementById("go").onclick = function () {
  sel = readChooser();
  var bits = [sel.level.replace(/-/g, " "), sel.campus, sel.term];
  if (sel.streams.length) bits.push(sel.streams.join(" + "));
  document.getElementById("who").textContent = bits.join("  ·  ");
  writeHash();
  document.getElementById("chooser").hidden = true;
  document.getElementById("whobar").hidden = false;
  document.getElementById("filterbar").hidden = false;
  buildNotes();
  render();
  document.getElementById("whobar").scrollIntoView({ behavior: "smooth", block: "start" });
};

document.getElementById("change").onclick = function () {
  document.getElementById("chooser").hidden = false;
  document.getElementById("whobar").hidden = true;
  document.getElementById("filterbar").hidden = true;
  document.getElementById("timeline").innerHTML = "";
  document.getElementById("notes").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

[].slice.call(document.querySelectorAll('.chip[data-f]')).forEach(function (b) {
  b.onclick = function () {
    [].slice.call(document.querySelectorAll('.chip[data-f="' + b.dataset.f + '"]'))
      .forEach(function (x) { x.classList.remove("on"); });
    b.classList.add("on");
    showFit = b.dataset.v;
    render();
  };
});
document.getElementById("pastbtn").onclick = function () {
  hidePast = !hidePast;
  this.classList.toggle("on", hidePast);
  this.textContent = hidePast ? "Showing upcoming" : "Hide past";
  render();
};
document.getElementById("q").oninput = function () { Q = this.value.toLowerCase().trim(); render(); };

/* ---------- availability: grey out combinations Laurier publishes nothing for --- */
function countFor(level, campus, term) {
  return EV.filter(function (e) {
    if (e.tm !== term) return false;
    if ((e.cp || []).indexOf(campus) === -1) return false;
    return (e.lv === level) || (e.lv === "all") || e.oa;
  }).length;
}
function refreshAvailability() {
  var s = readChooser();
  if (!s.level) return;
  [].slice.call(document.querySelectorAll('input[name="campus"]')).forEach(function (i) {
    var n = countFor(s.level, i.value, s.term);
    i.disabled = (n === 0);
    i.parentNode.classList.toggle("off", n === 0);
    i.parentNode.title = n === 0 ? "Laurier publishes no schedule for this combination" : n + " events";
  });
  [].slice.call(document.querySelectorAll('input[name="term"]')).forEach(function (i) {
    var n = countFor(s.level, s.campus, i.value);
    i.disabled = (n === 0);
    i.parentNode.classList.toggle("off", n === 0);
    i.parentNode.title = n === 0 ? "Laurier publishes no schedule for this combination" : n + " events";
  });
  // if the current pick just became invalid, move to the first valid one
  ["campus", "term"].forEach(function (name) {
    var cur = document.querySelector('input[name="' + name + '"]:checked');
    if (cur && cur.disabled) {
      var ok = document.querySelector('input[name="' + name + '"]:not(:disabled)');
      if (ok) ok.checked = true;
    }
  });
  var s2 = readChooser();
  if (s2.campus !== s.campus || s2.term !== s.term) {
    [].slice.call(document.querySelectorAll('input[name="term"]')).forEach(function (i) {
      var n = countFor(s2.level, s2.campus, i.value);
      i.disabled = (n === 0);
      i.parentNode.classList.toggle("off", n === 0);
    });
    [].slice.call(document.querySelectorAll('input[name="campus"]')).forEach(function (i) {
      var n = countFor(s2.level, i.value, s2.term);
      i.disabled = (n === 0);
      i.parentNode.classList.toggle("off", n === 0);
    });
    s2 = readChooser();
  }
  var total = countFor(s2.level, s2.campus, s2.term);
  // countFor() ignores stream gating, so this is an UPPER bound: say so.
  document.getElementById("go").textContent =
    total ? "Show my events (up to " + total + ")" : "No schedule published";
  document.getElementById("go").disabled = !total;
}
[].slice.call(document.querySelectorAll('.chooser input')).forEach(function (i) {
  i.addEventListener("change", refreshAvailability);
});
refreshAvailability();

/* ---------- shareable state in the URL hash ------------------------------ */
function writeHash() {
  var s = readChooser();
  var p = "level=" + encodeURIComponent(s.level) +
          "&campus=" + encodeURIComponent(s.campus) +
          "&term=" + encodeURIComponent(s.term);
  if (s.streams.length) p += "&streams=" + encodeURIComponent(s.streams.join("|"));
  history.replaceState(null, "", "#" + p);
}
function applyHash() {
  var h = location.hash.replace(/^#/, "");
  if (!h) return false;
  var p = {};
  h.split("&").forEach(function (kv) {
    var i = kv.indexOf("=");
    if (i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });
  if (!p.level || !p.campus || !p.term) return false;
  function pick(name, val) {
    var el = document.querySelector('input[name="' + name + '"][value="' + val.replace(/"/g, '\\"') + '"]');
    if (el) { el.checked = true; return true; }
    return false;
  }
  var ok = pick("level", p.level) && pick("campus", p.campus) && pick("term", p.term);
  if (p.streams) {
    p.streams.split("|").forEach(function (s) { pick("stream", s); });
  }
  refreshAvailability();
  return ok;
}
if (applyHash()) {
  document.getElementById("go").click();
}
