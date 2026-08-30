"""Resolve Telegram mention entities to active chat members."""

from collections import defaultdict

# The handle -> display name map deanonymises real people, so it must never be
# committed to this public repo. It lives in handles_local.py, which .gitignore
# excludes. Without it, `@handle` mentions stay unresolved and count as unknown;
# `mention_name` entities, which carry a user_id directly, resolve either way.
try:
    from handles_local import HANDLE_TO_NAME
except ImportError:  # pragma: no cover - depends on local checkout only
    HANDLE_TO_NAME = {}


def make_resolver(active_ids, name_of):
    """Return a resolver for one validated export's active participant set."""
    active = set(active_ids)
    ids_by_name = defaultdict(list)
    for user_id in active_ids:
        if name_of.get(user_id):
            ids_by_name[name_of[user_id]].append(user_id)

    handle_targets = {}
    for handle, name in HANDLE_TO_NAME.items():
        matches = ids_by_name.get(name, [])
        if len(matches) == 1:
            handle_targets[handle] = matches[0]

    def resolve(message):
        targets = set()
        unknown = set()
        for entity in message.get("text_entities", []):
            kind = entity.get("type")
            if kind == "mention_name":
                target = f"user{entity.get('user_id')}"
                if target in active:
                    targets.add(target)
                else:
                    unknown.add(f"id:{entity.get('user_id')}")
            elif kind == "mention":
                handle = (entity.get("text") or "").casefold()
                target = handle_targets.get(handle)
                if target is not None:
                    targets.add(target)
                elif handle:
                    unknown.add(handle)
        return targets, unknown

    return resolve
