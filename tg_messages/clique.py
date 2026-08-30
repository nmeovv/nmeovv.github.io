"""Test the claim: "Mr. Vampire, Kim Chaewon, Ryukyu and @redacted7 (ゴードン)
interact with each other far more than with everyone else."

Raw counts cannot answer this — heavy posters accumulate big numbers with everybody.
So every figure here is measured against a null model: people interact in proportion
to how much everyone posts. Expected traffic from i to j is

    E[i][j] = (interactions i sent) x (messages j posted) / (all messages except i's)

Cohesion = observed / expected. 1.0 means "exactly as much as their volume predicts".
"""

import argparse
import json
import random
import re
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

from albums import add_window_argument, collapse_albums, validate_window
from mentions import make_resolver

MIN_MESSAGES = 50
GROUP = ["Mr. Vampire", "Kim Chaewon", "Ryukyu", "ゴードン"]  # ゴードン = @redacted7

parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path, default=Path("result.json"))
parser.add_argument("--output-js", type=Path, default=Path("clique.js"))
parser.add_argument("--global-name", default="CLIQUE")
parser.add_argument("--trials", type=int, default=20000)
add_window_argument(parser)
args = parser.parse_args()
album_window = validate_window(parser, args.album_window)

if not args.input.is_file():
    parser.error(f"input file does not exist: {args.input}")
if args.output_js.resolve() == args.input.resolve():
    parser.error("the output path cannot overwrite the input export")
if not re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", args.global_name):
    parser.error("--global-name must be a JavaScript identifier")
if args.trials < 100:
    parser.error("--trials must be at least 100")

TRIALS = args.trials

random.seed(7)
raw = json.load(args.input.open())
messages = [m for m in raw["messages"] if m["type"] == "message"]
messages, _, _ = collapse_albums(messages, album_window)
by_id = {m["id"]: m for m in messages}

count = Counter(m["from_id"] for m in messages)
name_of = {m["from_id"]: m.get("from") for m in messages}
people = [uid for uid, c in count.most_common() if c >= MIN_MESSAGES]
idx = {uid: i for i, uid in enumerate(people)}
n = len(people)

base_name = {uid: name_of[uid] or "Deleted account" for uid in people}
name_totals = Counter(base_name.values())
name_seen = Counter()
labels = []
for uid in people:
    name = base_name[uid]
    name_seen[name] += 1
    labels.append(f"{name} {name_seen[name]}" if name_totals[name] > 1 else name)

group_ids = []
for group_name in GROUP:
    matches = [uid for uid in people if name_of[uid] == group_name]
    if len(matches) != 1:
        parser.error(
            f"group member {group_name!r} matched {len(matches)} active accounts; expected exactly one"
        )
    group_ids.append(matches[0])
G = sorted(idx[uid] for uid in group_ids)
Gset = set(G)
rest = [i for i in range(n) if i not in Gset]
total_msgs = sum(count[u] for u in people)
resolve_mentions = make_resolver(people, name_of)


def build(kind):
    M = [[0] * n for _ in range(n)]
    if kind == "reply":
        for m in messages:
            p = by_id.get(m.get("reply_to_message_id"))
            if p is None or m.get("reply_to_peer_id"):
                continue
            a, b = m["from_id"], p["from_id"]
            if a in idx and b in idx and a != b:
                M[idx[a]][idx[b]] += 1
    elif kind == "react":
        for m in messages:
            if m["from_id"] not in idx:
                continue
            for grp in m.get("reactions", []):
                for r in grp.get("recent", []):
                    source = r["from_id"]
                    if source in idx and source != m["from_id"]:
                        M[idx[source]][idx[m["from_id"]]] += 1
    else:
        for m in messages:
            source = m["from_id"]
            if source not in idx:
                continue
            targets, _ = resolve_mentions(m)
            targets.discard(source)
            for target in targets:
                M[idx[source]][idx[target]] += 1
    return M


def expectation(M):
    out = [sum(r) for r in M]
    E = [[0.0] * n for _ in range(n)]
    for i in range(n):
        pool = total_msgs - count[people[i]]
        for j in range(n):
            if i != j:
                E[i][j] = out[i] * count[people[j]] / pool
    return E, out


def inside(M, members):
    s = set(members)
    return sum(M[i][j] for i in s for j in s if i != j)


layers = {}
for kind in ("reply", "react", "mention"):
    M = build(kind)
    E, out = expectation(M)

    obs = inside(M, G)
    exp = sum(E[i][j] for i in G for j in G if i != j)
    coh = obs / exp

    # --- rank against every other possible foursome -------------------------
    # Ratio alone favours low-volume groups, whose ratios swing wildly on a few
    # interactions. So each foursome also gets a z-score under the same null:
    # sender i's internal hits ~ Binomial(out[i], p_i), summed over the group.
    wt = [count[people[j]] for j in range(n)]

    def zscore(combo):
        s, mu, var = set(combo), 0.0, 0.0
        for i in combo:
            if not out[i]:
                continue
            pool = total_msgs - wt[i]
            p = sum(wt[j] for j in s if j != i) / pool
            mu += out[i] * p
            var += out[i] * p * (1 - p)
        return mu, var ** 0.5

    ranked = []
    for combo in combinations(range(n), 4):
        o = inside(M, combo)
        e = sum(E[i][j] for i in combo for j in combo if i != j)
        mu, sd_c = zscore(combo)
        if e > 0:
            z = (o - mu) / sd_c if sd_c else 0.0
            # rank on the raw values: rounding first invents ties and shifts the rank
            ranked.append({"members": list(combo), "obs": o, "exp": round(e, 1),
                           "coh": round(o / e, 3), "z": round(z, 2),
                           "_coh": o / e, "_z": z})
    by_ratio = sorted(ranked, key=lambda r: -r["_coh"])
    by_z = sorted(ranked, key=lambda r: -r["_z"])
    rank = next(i for i, r in enumerate(by_ratio) if set(r["members"]) == Gset) + 1
    rank_z = next(i for i, r in enumerate(by_z) if set(r["members"]) == Gset) + 1
    ranked = by_ratio

    # --- significance: redraw every interaction under the null model ---------
    # Each sender keeps their own out-degree; targets are redrawn in proportion
    # to how much everyone posts. How often does chance alone match this group?
    group_prob = {}
    for i in G:
        pool = total_msgs - count[people[i]]
        group_prob[i] = sum(count[people[j]] for j in Gset if j != i) / pool
    hits, sims = 0, []
    for _ in range(TRIALS):
        sim = sum(random.binomialvariate(out[i], group_prob[i]) for i in G if out[i])
        sims.append(sim)
        if sim >= obs:
            hits += 1
    sims.sort()
    mean = sum(sims) / len(sims)
    sd = (sum((x - mean) ** 2 for x in sims) / len(sims)) ** 0.5
    pval = (hits + 1) / (TRIALS + 1)

    # --- per member ---------------------------------------------------------
    members = []
    for i in G:
        others = [j for j in G if j != i]
        o = sum(M[i][j] for j in others)
        e = sum(E[i][j] for j in others)
        o_out = sum(M[i][j] for j in rest)
        e_out = sum(E[i][j] for j in rest)
        members.append({
            "name": labels[i], "messages": count[people[i]],
            "toGroup": o, "toGroupExp": round(e, 1), "toGroupLift": round(o / e, 2),
            "toRest": o_out, "toRestExp": round(e_out, 1),
            "toRestLift": round(o_out / e_out, 2) if e_out else None,
            "shareInternal": round(o / sum(M[i]), 3) if sum(M[i]) else 0,
            "shareInternalExp": round(e / sum(M[i]), 3) if sum(M[i]) else 0,
        })

    # --- how each outsider is treated by the Four ---------------------------
    outsiders = []
    for j in rest:
        recv = sum(M[i][j] for i in G)
        recv_e = sum(E[i][j] for i in G)
        give = sum(M[j][i] for i in G)
        give_e = sum(E[j][i] for i in G)
        outsiders.append({
            "name": labels[j], "messages": count[people[j]],
            "fromGroup": recv, "fromGroupExp": round(recv_e, 1),
            "fromGroupLift": round(recv / recv_e, 2) if recv_e else None,
            "toGroup": give, "toGroupExp": round(give_e, 1),
            "toGroupLift": round(give / give_e, 2) if give_e else None,
        })
    outsiders.sort(key=lambda r: r["fromGroupLift"] or 0)

    # --- the individual pairs inside the group ------------------------------
    pairs = []
    for a, b in combinations(G, 2):
        o = M[a][b] + M[b][a]
        e = E[a][b] + E[b][a]
        pairs.append({"a": labels[a], "b": labels[b], "obs": o, "exp": round(e, 1),
                      "lift": round(o / e, 2)})
    pairs.sort(key=lambda p: -p["lift"])

    # --- is every member actually part of the cluster? ----------------------
    # Drop each member (trio cohesion) and swap each member out for every
    # outsider. A member whose removal *raises* cohesion is not in the cluster.
    trios = []
    for drop in G:
        combo = [i for i in G if i != drop]
        o = inside(M, combo)
        e = sum(E[i][j] for i in combo for j in combo if i != j)
        trios.append({"without": labels[drop], "members": [labels[i] for i in combo],
                      "obs": o, "exp": round(e, 1), "coh": round(o / e, 3)})
    trios.sort(key=lambda t: -t["coh"])

    swaps = []
    for drop in G:
        best = []
        for add in rest:
            combo = [i for i in G if i != drop] + [add]
            o = inside(M, combo)
            e = sum(E[i][j] for i in combo for j in combo if i != j)
            mu, sd_c = zscore(combo)
            best.append({"out": labels[drop], "in": labels[add],
                         "coh": round(o / e, 3), "z": round((o - mu) / sd_c, 2) if sd_c else 0})
        best.sort(key=lambda r: -r["coh"])
        swaps.append({"member": labels[drop], "best": best[0],
                      "beats": sum(1 for r in best if r["coh"] > coh), "options": len(best)})

    for r in ranked:            # sorting keys, not part of the output shape
        r.pop("_coh", None)
        r.pop("_z", None)

    layers[kind] = {
        "obs": obs, "exp": round(exp, 1), "cohesion": round(coh, 3),
        "trios": trios, "swaps": swaps,
        "rank": rank, "rankZ": rank_z, "totalCombos": len(ranked),
        "allCohesion": sorted(r["coh"] for r in ranked),
        "top": ranked[:6], "topZ": by_z[:6],
        "median": ranked[len(ranked) // 2], "worst": ranked[-1],
        "null": {"mean": round(mean, 1), "sd": round(sd, 1),
                 "z": round((obs - mean) / sd, 1) if sd else None,
                 "p": pval, "trials": TRIALS,
                 "p95": sims[int(0.95 * TRIALS)], "max": sims[-1]},
        "members": members, "outsiders": outsiders, "pairs": pairs,
    }

out_json = {
    "group": GROUP, "groupNote": "ゴードン is @redacted7",
    "albumWindow": album_window,
    "people": labels, "msgCount": [count[u] for u in people],
    "groupMsgShare": round(sum(count[uid] for uid in group_ids) / total_msgs, 3),
    "layers": layers,
}
with args.output_js.open("w") as f:
    f.write(f"window.{args.global_name} = ")
    json.dump(out_json, f, ensure_ascii=False)
    f.write(";\n")

for kind in ("reply", "react", "mention"):
    L = layers[kind]
    print(f"\n================ {kind.upper()} ================")
    print(f"internal {L['obs']} vs {L['exp']} expected  ->  cohesion {L['cohesion']}x")
    print(f"rank {L['rank']} of {L['totalCombos']} foursomes "
          f"(median foursome {L['median']['coh']}x, tightest {L['top'][0]['coh']}x)")
    N = L["null"]
    print(f"null model: mean {N['mean']} sd {N['sd']}  z={N['z']}  p={N['p']:.5f} "
          f"(95th pct {N['p95']}, max in {N['trials']} trials {N['max']})")
    print(f"rank by z (volume-fair) {L['rankZ']} of {L['totalCombos']}")
    print(" tightest by ratio:")
    for r in L["top"][:5]:
        print("   %.2fx z=%5.1f  %s" % (r["coh"], r["z"], ", ".join(labels[i] for i in r["members"])))
    print(" tightest by z:")
    for r in L["topZ"][:5]:
        print("   %.2fx z=%5.1f  %s" % (r["coh"], r["z"], ", ".join(labels[i] for i in r["members"])))
    print(" members:")
    for m in L["members"]:
        print(f"   {m['name']:16s} in-group {m['toGroup']:5d}/{m['toGroupExp']:7.1f}={m['toGroupLift']}x"
              f"   outward {m['toRest']:5d}/{m['toRestExp']:7.1f}={m['toRestLift']}x"
              f"   internal share {m['shareInternal']*100:.0f}% (exp {m['shareInternalExp']*100:.0f}%)")
    print(" drop-one (trio cohesion):")
    for t in L["trios"]:
        print(f"   without {t['without']:16s} -> {t['coh']}x   ({' + '.join(t['members'])})")
    print(" swap test (replace member with best outsider):")
    for s in L["swaps"]:
        b = s["best"]
        print(f"   {s['member']:16s} -> best replacement {b['in']:16s} gives {b['coh']}x"
              f"   ({s['beats']}/{s['options']} outsiders beat them)")
    print(" internal pairs:")
    for p in L["pairs"]:
        print(f"   {p['a']} + {p['b']}: {p['obs']} vs {p['exp']} = {p['lift']}x")
    print(" outsiders, least to most attention from the Four:")
    for o in L["outsiders"]:
        print(f"   {o['name']:16s} gets {o['fromGroup']:5d}/{o['fromGroupExp']:7.1f}={o['fromGroupLift']}x"
              f"   gives {o['toGroup']:5d}/{o['toGroupExp']:7.1f}={o['toGroupLift']}x")
