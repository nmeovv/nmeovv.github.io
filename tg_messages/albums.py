"""Collapse Telegram photo albums back into single messages.

Telegram's JSON export carries no `grouped_id`, so an album of N photos arrives
as N separate message objects with N separate ids — which is also how the app
renders it in the timeline. Any album therefore inflates message counts, media
counts, and the hour/week histograms N-fold.

Without a grouping field the only thing left is the timing: an album is
uploaded as one action, so its parts land in the same second or two. That makes
this a heuristic, not a reconstruction. It cannot tell a real album apart from
someone posting several photos in quick succession, which is why the window is
a caller's choice rather than a constant.
"""

MEDIA_TYPES = ("video_file", "animation")


def is_media(m):
    return "photo" in m or m.get("media_type") in MEDIA_TYPES


def _has_text(m):
    t = m.get("text")
    return bool(t) if isinstance(t, str) else bool(t)


def _reaction_key(group):
    return group.get("type"), group.get("emoji"), group.get("document_id")


def _merge_reactions(run):
    """Sum reaction groups across a run so collapsing never loses a reaction."""
    merged = {}
    for m in run:
        for group in m.get("reactions", []):
            key = _reaction_key(group)
            if key not in merged:
                merged[key] = dict(group, recent=list(group.get("recent", [])))
            else:
                merged[key]["count"] += group["count"]
                merged[key]["recent"].extend(group.get("recent", []))
    return list(merged.values())


def _continues(run, m, window):
    """Can `m` join the album run ending at run[-1]?"""
    prev = run[-1]
    if m["from_id"] != prev["from_id"]:
        return False
    if int(m["date_unixtime"]) - int(prev["date_unixtime"]) > window:
        return False
    if m.get("reply_to_message_id") is not None:
        return False  # a reply is a deliberate new message, never an album tail
    if m.get("forwarded_from") != prev.get("forwarded_from"):
        return False
    if m.get("via_bot") != prev.get("via_bot"):
        return False
    return True


def collapse_albums(messages, window):
    """Merge runs of same-sender media messages posted within `window` seconds.

    `messages` must be in chronological order. Returns
    `(collapsed, id_map, stats)`. The surviving message of a run keeps the
    first member's id and date, adopts the caption from whichever member
    carries one, and absorbs every member's reactions. `id_map` sends every
    member id to its survivor so reply targets still resolve.
    """
    if window <= 0:
        return list(messages), {}, {"runs": 0, "merged": 0, "largest": 1}

    runs, cur = [], []
    for m in messages:
        if not is_media(m):
            if cur:
                runs.append(cur)
                cur = []
            runs.append([m])
            continue
        if cur and _continues(cur, m, window):
            cur.append(m)
        else:
            if cur:
                runs.append(cur)
            cur = [m]
    if cur:
        runs.append(cur)

    collapsed, id_map = [], {}
    albums = 0
    largest = 1
    for run in runs:
        head = run[0]
        if len(run) == 1:
            collapsed.append(head)
            continue
        albums += 1
        largest = max(largest, len(run))
        merged = dict(head)
        if not _has_text(merged):
            caption = next((m for m in run if _has_text(m)), None)
            if caption is not None:
                merged["text"] = caption["text"]
                if "text_entities" in caption:
                    merged["text_entities"] = caption["text_entities"]
        reactions = _merge_reactions(run)
        if reactions:
            merged["reactions"] = reactions
        merged["album_size"] = len(run)
        for m in run:
            id_map[m["id"]] = head["id"]
        collapsed.append(merged)

    # replies aimed at any photo of an album now point at the survivor
    for m in collapsed:
        rid = m.get("reply_to_message_id")
        if rid is not None and rid in id_map:
            m["reply_to_message_id"] = id_map[rid]

    return collapsed, id_map, {
        "runs": albums,
        "merged": len(messages) - len(collapsed),
        "largest": largest,
    }


def add_window_argument(parser):
    parser.add_argument(
        "--album-window",
        type=int,
        default=0,
        metavar="SECONDS",
        help="merge same-sender media posted within SECONDS into one message "
             "(0 = off, the raw export view; max 5)",
    )


def validate_window(parser, window):
    if not 0 <= window <= 5:
        parser.error("--album-window must be between 0 and 5 seconds")
    return window
