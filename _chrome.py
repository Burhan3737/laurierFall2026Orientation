"""Headless Chrome invocation, shared by check.py, invariants.py, parity.py,
contrast.py and stress.py.

Chrome mints a brand-new throwaway profile directory per launch when no
--user-data-dir is given, and does not reliably remove it. An earlier run of this
harness left roughly 57,000 of them -- about 165 GB -- and filled the disk, which
killed Chrome mid-run and cost us a parity result. Two defences, because the
first is not sufficient on its own:

  * One profile per process, and per thread where we drive Chrome in parallel,
    since two Chrome instances sharing a profile fight over its lock. It is
    reused across every launch and removed on the way out.

  * A sweep of what Chrome scatters *outside* the profile. It unpacks
    externally-registered extensions -- on this machine Adobe's web2pdf, 5.1 MB
    at a time -- into a scoped_dir* in the system temp on every launch, whatever
    profile it is handed. Pinning the profile does not stop that.

The sweep deletes only entries that match Chrome's own temp-name patterns *and*
appeared after this process started: match what we created, not merely the shape
of its name. A blanket clean of *.tmp would have taken an unrelated installer
sitting in the same directory. Anything still held by a live Chrome fails to
delete and is left alone, which is the behaviour we want.
"""
import atexit, glob, os, re, shutil, tempfile, threading, time

_TMP = tempfile.gettempdir()
_START = time.time()
_PROFILE_ROOT = tempfile.mkdtemp(prefix="wlu-chrome-")
_profiles, _lock = {}, threading.Lock()

_LITTER_DIRS = ("scoped_dir*", "HeadlessChrome*")
_GUID_TMP = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$", re.I)


def _profile_dir():
    key = threading.get_ident()
    with _lock:
        d = _profiles.get(key)
        if d is None:
            d = os.path.join(_PROFILE_ROOT, "p%d" % key)
            os.makedirs(d, exist_ok=True)
            _profiles[key] = d
    return d


def chrome_flags():
    """The profile flag, plus the switches that keep a headless run to itself.

    None of these change how a page renders; they stop Chrome reaching for the
    network, the update service and the default-apps list on every launch.
    """
    return [
        "--user-data-dir=" + _profile_dir(),
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
    ]


def _rm_if_ours(p):
    try:
        if os.path.getmtime(p) < _START:
            return                      # predates this run: not ours to delete
    except OSError:
        return
    if os.path.isdir(p):
        shutil.rmtree(p, ignore_errors=True)
    else:
        try:
            os.remove(p)
        except OSError:
            pass                        # still locked by a live Chrome


def _sweep():
    shutil.rmtree(_PROFILE_ROOT, ignore_errors=True)
    for pat in _LITTER_DIRS:
        for p in glob.glob(os.path.join(_TMP, pat)):
            _rm_if_ours(p)
    for p in glob.glob(os.path.join(_TMP, "*.tmp")):
        if _GUID_TMP.match(os.path.basename(p)):
            _rm_if_ours(p)


atexit.register(_sweep)
