"""Fail if anything about to be published could contain private message text.

The dashboard is served from a public repo, so the only thing that may ever be
committed is aggregates: counts, matrices, names, dates, emoji. Raw exports and
message bodies must not be.

Documentation alone does not stop a mistake, so this is a real check. Run it
before committing, or wire it up as a pre-commit hook (see AGENTS.md).

    python3 check_no_private_data.py
"""

import glob
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
MAX_TRACKED_BYTES = 5_000_000   # aggregates are ~120KB; an export is 14MB+
MAX_STRING_LEN = 40             # longest legitimate string is 19 (a timestamp);
                                # 40 still allows a long display name

# Every key extract.py is expected to emit. A new key here is not automatically
# a leak, but it has to be looked at and added deliberately — that is the point.
ALLOWED_KEYS = {
    "chat", "range", "albums", "totals", "people", "msgCount",
    "reply", "expected", "affinity",
    "react", "reactExpected", "reactAffinity",
    "mention", "mentionExpected", "mentionAffinity",
    "topEmoji", "medianGap", "pairs", "profile",
    "threadSizeHist", "threadDepthHist", "topThreads", "deepThreads", "weeks",
    # albums
    "window", "rawMessages", "albumsFound", "messagesMerged", "largestAlbum",
    # totals
    "messages", "replies", "danglingReplies", "reactionsTotal",
    "reactionsAttributed", "mentionsTotal", "mentionsMapped", "threads",
    # pairs
    "a", "b", "ab", "ba", "total", "lift", "balance",
    # profile
    "id", "name", "repliesOut", "repliesIn", "selfReplies", "replyRate",
    "repliedToRate", "threadsStarted", "reactionsGot", "reactionsPerMsg",
    "medianLen", "medianReplySec", "reactionsGiven", "mentionsGiven",
    "mentionsGot", "emojiGiven", "emojiGot", "kinds", "hours",
    # threads
    "root", "size", "depth", "date", "starter",
    # weeks
    "week", "counts",
    # manifest
    "windows", "default", "chats", "key", "label",
}

# Objects used as maps: their keys are data (message-type labels, hour numbers,
# album windows), not schema, so key names are not checked inside them. Their
# values are still counts, and the string scan below still applies.
FREEFORM_MAPS = {"$.profile[].kinds", "$.profile[].hours", "$.chats[].albums"}

# Leaf keys that would mean message content got in
FORBIDDEN_KEYS = {
    "text", "text_entities", "message", "caption", "body", "content",
    "file", "file_name", "photo", "thumbnail", "mime_type", "sticker_emoji",
    "from", "from_id", "forwarded_from", "via_bot", "poll",
}

failures = []


def fail(msg):
    failures.append(msg)


def git(*args):
    r = subprocess.run(["git", "-C", str(HERE), *args],
                       capture_output=True, text=True)
    return r.stdout.splitlines() if r.returncode == 0 else []


def walk(node, path="$"):
    if isinstance(node, dict):
        for k, v in node.items():
            yield "key", k, path
            yield from walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for v in node:
            yield from walk(v, f"{path}[]")
    elif isinstance(node, str):
        yield "str", node, path


# --- 0. no Telegram handle may be tracked in this project ----------------
# A bare display name is fine — the dashboard publishes those on purpose. A
# @handle is not: it ties that name to a real, reachable Telegram account. The
# map lives in the gitignored handles_local.py, and nothing tracked here may
# name a handle.
#
# Scoped to tg_messages/ deliberately. The root dashboard and ../visual carry
# @-names inside old anketa poll text, which is body text those projects
# publish on purpose and is not a Telegram handle map.
AT_TOKEN = re.compile(r"@[A-Za-z][A-Za-z0-9_]{3,31}")
TEXT_SUFFIXES = (".py", ".js", ".html", ".json", ".md", ".txt", ".css")

# CSS at-rules and doc tags match the handle shape but are not handles.
ALLOWED_AT_TOKENS = {
    "@media", "@keyframes", "@supports", "@import", "@charset", "@namespace",
    "@page", "@layer", "@container", "@property", "@font", "@scope", "@starting",
    "@param", "@returns", "@type", "@typedef", "@example", "@throws", "@see",
    "@handle",  # the literal word, used in comments describing this rule
}


def scan_handles(project_files):
    for f in project_files:
        if not f.endswith(TEXT_SUFFIXES):
            continue
        p = HERE / f
        if not p.is_file():
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        for token in sorted(set(AT_TOKEN.findall(text))):
            if token not in ALLOWED_AT_TOKENS:
                fail(f"{f}: tracked file names the handle {token!r} — a handle "
                     f"identifies a real account. Remove it, or if it is not a "
                     f"handle add it to ALLOWED_AT_TOKENS in this script.")


# `git -C HERE ls-files` yields paths relative to HERE, so every check below is
# scoped to this project and paths resolve against HERE.
tracked = git("ls-files")
scan_handles(tracked)

# --- 1. no raw export may be tracked -------------------------------------
for f in tracked:
    if re.search(r"result\d*\.json$", f):
        fail(f"raw Telegram export is tracked by git: {f}")

# --- 2. nothing export-sized may be tracked ------------------------------
for f in tracked:
    p = HERE / f
    if p.is_file() and p.stat().st_size > MAX_TRACKED_BYTES:
        fail(f"tracked file is {p.stat().st_size/1e6:.1f}MB, over the "
             f"{MAX_TRACKED_BYTES/1e6:.0f}MB limit: {f}")

# --- 3. the published data must be aggregates only -----------------------
data_files = sorted(glob.glob(str(HERE / "build" / "*.js")))
if not data_files:
    fail("no build/*.js found — run build.py before checking")

for path in data_files:
    raw = Path(path).read_text(encoding="utf-8")
    try:
        obj = json.loads(raw[raw.index("=") + 1:].rstrip().rstrip(";"))
    except (ValueError, json.JSONDecodeError) as e:
        fail(f"{Path(path).name}: could not parse ({e})")
        continue

    longest = ("", "")
    for kind, value, where in walk(obj):
        if kind == "key":
            if where in FREEFORM_MAPS:
                continue
            if value in FORBIDDEN_KEYS:
                fail(f"{Path(path).name}: forbidden key {value!r} at {where} "
                     f"— this is message content, not an aggregate")
            elif value not in ALLOWED_KEYS:
                fail(f"{Path(path).name}: unexpected key {value!r} at {where} — "
                     f"confirm it holds no message text, then add it to "
                     f"ALLOWED_KEYS in this script")
        else:
            if len(value) > len(longest[0]):
                longest = (value, where)
            if len(value) > MAX_STRING_LEN:
                fail(f"{Path(path).name}: string of {len(value)} chars at "
                     f"{where} — too long to be a name or date, looks like "
                     f"message text: {value[:60]!r}")
    print(f"  {Path(path).name}: ok, longest string {len(longest[0])} chars "
          f"({longest[1]})")

if failures:
    print("\nPRIVATE DATA CHECK FAILED\n", file=sys.stderr)
    for f in failures:
        print(f"  - {f}", file=sys.stderr)
    print("\nDo not commit until these are resolved.", file=sys.stderr)
    sys.exit(1)

print("\nPrivate data check passed: published data is aggregates only.")
