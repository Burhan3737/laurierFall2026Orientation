"""Which listings are the same event — the page's own answer, in Python.

`dupKey()` lives in the four application scripts and decides what the board folds
into one entry. `plus_check.py` and `parity.py` both need the same answer, and for
seven rounds of this project that meant a second implementation transcribed by
hand into Python, which is exactly the arrangement that drifts.

There is no transcription here. This module extracts `stripDay()` and `dupKey()`
out of `_app_a.js` and runs *those functions* under node against `events.json`.
If the key changes in the application, it changes here in the same commit,
because there is only one of it. `parity.shared_logic_check()` proves the other
three scripts carry the same bytes, so deriving from `_app_a.js` derives from all
four.

    from dupkey import key_of, shown_title, fold, copies_of
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "_app_a.js")
DATA = os.path.join(HERE, "events.json")

# the short names build.py packs the payload under, for the fields dupKey reads
PACK = {"title": "t", "date": "d", "when": "n", "where": "w"}

_RUNNER = r"""
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
function body(name) {
  const i = src.indexOf('\nfunction ' + name + '(') + 1;
  if (i === 0) throw new Error('no function ' + name + ' in ' + process.argv[2]);
  let k = src.indexOf('{', i) + 1, d = 1;
  while (d) { if (src[k] === '{') d++; else if (src[k] === '}') d--; k++; }
  return src.slice(i, k);
}
eval(body('stripDay'));
eval(body('dupKey'));
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
process.stdout.write(JSON.stringify(rows.map(function (e) {
  return [dupKey(e), stripDay(e.t)];
})));
"""

_KEYS = None
_TITLES = None
_BY_SIG = None
_EVENTS = None


def _sig(e):
    return (e.get("title") or "", e.get("date") or "", e.get("when") or "", e.get("where") or "")


def _load():
    """Run the page's own dupKey over every event, once per process."""
    global _KEYS, _TITLES, _BY_SIG, _EVENTS
    if _KEYS is not None:
        return
    _EVENTS = json.load(open(DATA, encoding="utf-8"))["events"]
    packed = [{s: e.get(l) for l, s in PACK.items()} for e in _EVENTS]
    d = tempfile.mkdtemp(prefix="dupkey-")
    js = os.path.join(d, "run.js")
    rows = os.path.join(d, "rows.json")
    open(js, "w", encoding="utf-8").write(_RUNNER)
    json.dump(packed, open(rows, "w", encoding="utf-8"), ensure_ascii=False)
    r = subprocess.run(["node", js, SOURCE, rows],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        sys.exit("dupkey.py could not run the page's own dupKey():\n" + (r.stderr or r.stdout))
    pairs = json.loads(r.stdout)
    assert len(pairs) == len(_EVENTS)
    _KEYS = [k for k, _ in pairs]
    _TITLES = [t for _, t in pairs]
    _BY_SIG = {}
    for e, k, t in zip(_EVENTS, _KEYS, _TITLES):
        _BY_SIG[_sig(e)] = (k, t)
    # Two listings with the same title, date, time and venue must resolve to one
    # key, or the lookup below is answering a different question from the page.
    assert len({v[0] for v in _BY_SIG.values()}) == len(set(_KEYS))


def events():
    _load()
    return _EVENTS


def key_of(e):
    """The key the page would file this event under."""
    _load()
    return _BY_SIG[_sig(e)][0]


def shown_title(e):
    """The title the page prints, with any day prefix Laurier wrote into it
    stripped — stripDay() again, run rather than transcribed."""
    _load()
    return _BY_SIG[_sig(e)][1]


def fold(rows):
    """One entry per distinct event, first occurrence winning the slot.

    The page picks a richer representative than this (see listingRank),
    but which listing is shown is a presentation choice; which events exist is
    not, and that is all anything here asks."""
    seen, out = set(), []
    for e in rows:
        k = key_of(e)
        if k in seen:
            continue
        seen.add(k)
        out.append(e)
    return out


def copies_of(e, rows):
    """Every listing in `rows` that is this same event."""
    k = key_of(e)
    return [o for o in rows if key_of(o) == k]


def keys_of(rows):
    return [key_of(e) for e in rows]


if __name__ == "__main__":
    ev = events()
    ks = keys_of(ev)
    multi = {}
    for k in ks:
        multi[k] = multi.get(k, 0) + 1
    dupes = {k: n for k, n in multi.items() if n > 1}
    print("%d listings, %d distinct events, %d published more than once"
          % (len(ev), len(multi), len(dupes)))
