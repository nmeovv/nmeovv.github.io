"""Build interaction aggregates from a Telegram chat export."""

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from albums import add_window_argument, collapse_albums, validate_window
from mentions import make_resolver

MIN_MESSAGES = 50  # drop drive-by accounts

parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path, default=Path("result.json"))
parser.add_argument("--output-json", type=Path, default=Path("data.json"))
parser.add_argument("--output-js", type=Path, default=Path("data.js"))
parser.add_argument("--global-name", default="DATA")
add_window_argument(parser)
args = parser.parse_args()
album_window = validate_window(parser, args.album_window)

if not args.input.is_file():
    parser.error(f"input file does not exist: {args.input}")
if not re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", args.global_name):
    parser.error("--global-name must be a JavaScript identifier")
input_path = args.input.resolve()
for output_path in (args.output_json, args.output_js):
    if output_path.resolve() == input_path:
        parser.error("an output path cannot overwrite the input export")

raw = json.load(args.input.open())
messages = [m for m in raw["messages"] if m["type"] == "message"]
raw_count = len(messages)
messages, _, album_stats = collapse_albums(messages, album_window)
by_id = {m["id"]: m for m in messages}

# ---------- people ----------
msg_count = Counter(m["from_id"] for m in messages)
name_of = {m["from_id"]: m.get("from") for m in messages}
people = [uid for uid, c in msg_count.most_common() if c >= MIN_MESSAGES]
idx = {uid: i for i, uid in enumerate(people)}
n = len(people)

base_name = {uid: name_of[uid] or "Deleted account" for uid in people}
name_totals = Counter(base_name.values())
name_seen = Counter()
display_name = {}
for uid in people:
    name = base_name[uid]
    name_seen[name] += 1
    display_name[uid] = f"{name} {name_seen[name]}" if name_totals[name] > 1 else name

resolve_mentions = make_resolver(people, name_of)


def kind(m):
    if m.get("media_type") == "sticker":
        return "sticker"
    if "photo" in m or m.get("media_type") in ("video_file", "animation"):
        return "media"
    if m.get("media_type") == "voice_message":
        return "voice"
    if "forwarded_from" in m:
        return "forward"
    return "text"


def text_len(m):
    t = m.get("text")
    if isinstance(t, str):
        return len(t)
    return sum(len(p) if isinstance(p, str) else len(p.get("text", "")) for p in t or [])


# ---------- reply matrix ----------
reply = [[0] * n for _ in range(n)]        # reply[from][to]
gaps = defaultdict(list)                   # (from,to) -> response seconds
dangling = 0

for m in messages:
    rid = m.get("reply_to_message_id")
    if rid is None or m.get("reply_to_peer_id"):
        continue
    parent = by_id.get(rid)
    if parent is None:
        dangling += 1
        continue
    a, b = m["from_id"], parent["from_id"]
    if a in idx and b in idx:
        reply[idx[a]][idx[b]] += 1
        gaps[(idx[a], idx[b])].append(int(m["date_unixtime"]) - int(parent["date_unixtime"]))

# ---------- reaction matrix (who reacts to whom) ----------
react = [[0] * n for _ in range(n)]
react_seen = react_total = 0
emoji_given = defaultdict(Counter)     # person -> emoji -> count
emoji_got = defaultdict(Counter)
emoji_all = Counter()
for m in messages:
    target = m["from_id"]
    if target not in idx:
        continue
    for group in m.get("reactions", []):
        react_total += group["count"]
        sym = group.get("emoji") or "⭐"  # custom_emoji has no unicode char
        emoji_all[sym] += group["count"]
        emoji_got[idx[target]][sym] += group["count"]
        for r in group.get("recent", []):
            react_seen += 1
            src = r["from_id"]
            if src in idx:
                react[idx[src]][idx[target]] += 1
                emoji_given[idx[src]][sym] += 1

# ---------- mentions (who tags whom) ----------
mention = [[0] * n for _ in range(n)]
mention_total = mention_mapped = 0
for m in messages:
    source = m["from_id"]
    if source not in idx:
        continue
    targets, unknown = resolve_mentions(m)
    targets.discard(source)
    mention_total += len(targets) + len(unknown)
    mention_mapped += len(targets)
    for target in targets:
        mention[idx[source]][idx[target]] += 1

# ---------- expected counts & affinity ----------
total_msgs = sum(msg_count[u] for u in people)
out_replies = [sum(reply[i]) for i in range(n)]
in_replies = [sum(reply[i][j] for i in range(n)) for j in range(n)]

expected = [[0.0] * n for _ in range(n)]
affinity = [[None] * n for _ in range(n)]
for i in range(n):
    pool = total_msgs - msg_count[people[i]]
    for j in range(n):
        if i == j or pool <= 0:
            continue
        e = out_replies[i] * msg_count[people[j]] / pool
        expected[i][j] = e
        if e >= 3:  # too little signal below this
            affinity[i][j] = math.log2(max(reply[i][j], 0.5) / e)

react_out = [sum(react[i]) for i in range(n)]
react_in = [sum(react[i][j] for i in range(n)) for j in range(n)]
react_exp = [[0.0] * n for _ in range(n)]
react_aff = [[None] * n for _ in range(n)]
for i in range(n):
    pool = total_msgs - msg_count[people[i]]
    for j in range(n):
        if i == j or pool <= 0:
            continue
        e = react_out[i] * msg_count[people[j]] / pool
        react_exp[i][j] = e
        if e >= 3:
            react_aff[i][j] = math.log2(max(react[i][j], 0.5) / e)

mention_out = [sum(mention[i]) for i in range(n)]
mention_exp = [[0.0] * n for _ in range(n)]
mention_aff = [[None] * n for _ in range(n)]
for i in range(n):
    pool = total_msgs - msg_count[people[i]]
    for j in range(n):
        if i == j or pool <= 0:
            continue
        e = mention_out[i] * msg_count[people[j]] / pool
        mention_exp[i][j] = e
        if e >= 3:
            mention_aff[i][j] = math.log2(max(mention[i][j], 0.5) / e)

# ---------- pairs ----------
pairs = []
for i in range(n):
    for j in range(i + 1, n):
        tot = reply[i][j] + reply[j][i]
        if tot == 0:
            continue
        exp = expected[i][j] + expected[j][i]
        pairs.append({
            "a": i, "b": j, "ab": reply[i][j], "ba": reply[j][i], "total": tot,
            "expected": round(exp, 1),
            "lift": round(tot / exp, 2) if exp > 0 else None,
            "balance": round((reply[i][j] - reply[j][i]) / tot, 3),
        })
pairs.sort(key=lambda p: -p["total"])

# ---------- threads (the actual message trees) ----------
parent_of, children = {}, defaultdict(list)
for m in messages:
    rid = m.get("reply_to_message_id")
    if rid is not None and rid in by_id and not m.get("reply_to_peer_id"):
        parent_of[m["id"]] = rid
        children[rid].append(m["id"])

root_cache = {}


def root_of(mid):
    chain = []
    while mid in parent_of and mid not in root_cache:
        chain.append(mid)
        mid = parent_of[mid]
    r = root_cache.get(mid, mid)
    for c in chain:
        root_cache[c] = r
    return r


depth_cache = {}


def depth_of(mid):
    d, cur = 0, mid
    while cur in parent_of:
        if cur in depth_cache:
            d += depth_cache[cur]
            break
        cur = parent_of[cur]
        d += 1
    depth_cache[mid] = d
    return d


threads = defaultdict(list)
for m in messages:
    if m["id"] in parent_of or children[m["id"]]:
        threads[root_of(m["id"])].append(m["id"])

thread_stats = []
for root, members in threads.items():
    if len(members) < 2:
        continue
    parts = Counter(by_id[i]["from_id"] for i in members)
    thread_stats.append({
        "root": root,
        "size": len(members),
        "depth": max(depth_of(i) for i in members),
        "people": len(parts),
        "date": by_id[root]["date"],
        "starter": display_name.get(by_id[root]["from_id"], "Deleted account"),
    })
thread_stats.sort(key=lambda t: -t["size"])

size_hist = Counter(min(t["size"], 20) for t in thread_stats)
depth_hist = Counter(min(t["depth"], 12) for t in thread_stats)


# ---------- per-person profile ----------
profile = []
for i, uid in enumerate(people):
    mine = [m for m in messages if m["from_id"] == uid]
    kinds = Counter(kind(m) for m in mine)
    lens = sorted(text_len(m) for m in mine if kind(m) == "text")
    starts = sum(1 for t in thread_stats if by_id[t["root"]]["from_id"] == uid)
    got = sum(r["count"] for m in mine for r in m.get("reactions", []))
    all_gaps = sorted(g for j in range(n) for g in gaps[(i, j)])
    profile.append({
        "id": i,
        "name": display_name[uid],
        "messages": len(mine),
        "repliesOut": out_replies[i],
        "repliesIn": in_replies[i],
        "selfReplies": reply[i][i],
        "replyRate": round(out_replies[i] / len(mine), 3),
        "repliedToRate": round(in_replies[i] / len(mine), 3),
        "threadsStarted": starts,
        "reactionsGot": got,
        "reactionsPerMsg": round(got / len(mine), 2),
        "medianLen": lens[len(lens) // 2] if lens else 0,
        "medianReplySec": all_gaps[len(all_gaps) // 2] if all_gaps else None,
        "reactionsGiven": react_out[i],
        "mentionsGiven": mention_out[i],
        "mentionsGot": sum(mention[j][i] for j in range(n)),
        "emojiGiven": emoji_given[i].most_common(6),
        "emojiGot": emoji_got[i].most_common(6),
        "kinds": dict(kinds),
        "hours": Counter(datetime.fromisoformat(m["date"]).hour for m in mine),
    })

# ---------- activity over time ----------
weeks = defaultdict(lambda: [0] * n)
for m in messages:
    if m["from_id"] in idx:
        d = datetime.fromisoformat(m["date"])
        weeks[d.strftime("%G-W%V")][idx[m["from_id"]]] += 1

out = {
    "chat": raw["name"],
    "range": [messages[0]["date"], messages[-1]["date"]],
    "albums": {
        "window": album_window,       # 0 = every photo counted on its own
        "rawMessages": raw_count,     # what the export contains before merging
        "albumsFound": album_stats["runs"],
        "messagesMerged": album_stats["merged"],
        "largestAlbum": album_stats["largest"],
    },
    "totals": {
        "messages": len(messages),
        "replies": sum(sum(r) for r in reply),
        "danglingReplies": dangling,
        "reactionsTotal": react_total,
        "reactionsAttributed": react_seen,
        "mentionsTotal": mention_total,
        "mentionsMapped": mention_mapped,
        "threads": len(thread_stats),
    },
    "people": [p["name"] for p in profile],
    "msgCount": [p["messages"] for p in profile],
    "reply": reply,
    "expected": [[round(v, 1) for v in row] for row in expected],
    "affinity": [[None if v is None else round(v, 2) for v in row] for row in affinity],
    "react": react,
    "reactExpected": [[round(v, 1) for v in row] for row in react_exp],
    "reactAffinity": [[None if v is None else round(v, 2) for v in row] for row in react_aff],
    "mention": mention,
    "mentionExpected": [[round(v, 1) for v in row] for row in mention_exp],
    "mentionAffinity": [[None if v is None else round(v, 2) for v in row] for row in mention_aff],
    "topEmoji": emoji_all.most_common(20),
    "medianGap": [[(lambda g: sorted(g)[len(g) // 2] if len(g) >= 5 else None)(gaps[(i, j)])
                   for j in range(n)] for i in range(n)],
    "pairs": pairs,
    "profile": profile,
    "threadSizeHist": [[k, v] for k, v in sorted(size_hist.items())],
    "threadDepthHist": [[k, v] for k, v in sorted(depth_hist.items())],
    "topThreads": thread_stats[:20],
    "deepThreads": sorted(thread_stats, key=lambda t: -t["depth"])[:10],
    "weeks": [{"week": w, "counts": c} for w, c in sorted(weeks.items())],
}
with args.output_json.open("w") as f:
    json.dump(out, f, ensure_ascii=False)
with args.output_js.open("w") as f:  # lets index.html open over file://
    f.write(f"window.{args.global_name} = ")
    json.dump(out, f, ensure_ascii=False)
    f.write(";\n")
print(json.dumps(out["totals"], indent=1))
print("people:", out["people"])
print("top pairs:", [(out["people"][p["a"]], out["people"][p["b"]], p["total"], p["lift"]) for p in pairs[:8]])
