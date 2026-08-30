# Chat interaction analysis

Turns a Telegram JSON export into an interactive HTML dashboard of who replies to
and reacts to whom.

## Run

```sh
python3 build.py            # every chat x album-window variant -> build/
python3 -m http.server 8899 # then open http://localhost:8899/index.html
```

`build.py` just drives `extract.py`, which also runs on its own:

```sh
python3 extract.py --album-window 1   # result.json -> data.json + data.js
```

A local server is needed: `index.html` injects the one dataset the current view
needs, and `file://` blocks that. Every variant assigns to the same `window.DATA`
global, and `build/manifest.js` lists what exists so the tabs and the album
control can render before any dataset arrives.

## Why a matrix and not a tree

The literal message tree turned out to be the wrong picture: 63% of threads are
one level deep and 54% are a single reply, so drawing 2,932 mostly-two-node trees
shows nothing. The directed 12×12 matrix is where the structure actually lives.
The thread-shape histograms keep the distribution that justifies this.

## The affinity view

Raw reply counts mostly restate who talks most. The **Affinity** toggle divides
each cell by its expected value — what you'd see if people replied at random in
proportion to how much everyone posts:

```
expected[i][j] = replies_sent_by_i × messages_from_j / (all messages − i's own)
```

Cells show log₂(observed ÷ expected), so `+1.0` is twice the expected traffic and
`-1.0` is half. Pairs with fewer than 3 expected replies are blanked as `·` —
too little signal to read.

## Counting photo albums

Telegram renders an album of ten photos as ten entries in the timeline, and the
export agrees: ten message objects with ten ids. So a single upload lands as ten
messages in every count. That is 16% of the smaller export and 11% of the larger
one — enough to change who the top poster is.

The export carries no `grouped_id`, so albums cannot be recovered exactly, only
guessed at from timing: an album is one upload, so its parts share a timestamp.
The **Photo albums** control at the top of the page is a plain on/off switch —
count every photo, or count an album as one message — because the width of the
merge window turns out not to matter. A 1s window catches 3,103 of the 3,163
messages a 3s window does, and past about 5 seconds these are clearly separate
messages anyway. That flatness is itself the useful result: the runs are tight,
so they really are albums rather than someone posting steadily.

"Count albums as one message" uses the 1-second window. `?albums=2` and
`?albums=3` are built and still load if you want to check that flatness
yourself; the control just doesn't spend UI on them.

Merging only ever changes *message* counting. Replies and reactions are
preserved exactly: a run collapses onto its first photo, replies aimed at any
member are repointed there, and the members' reactions are summed onto it. The
reply, reaction, and mention grids are identical in every window; what moves is
`msgCount`, and with it every expected value and affinity figure that divides by
it.

## Group tightness

The last section takes any set of people and asks whether they keep their
interactions among themselves more than their posting volume predicts. Pick
people with the chips; everything recomputes in the browser from the matrices
already in `data-*.js`, so there is no precomputed answer and no fixed group.

Three tests, all volume-normalised:

1. **Cohesion** — internal traffic over expected internal traffic, where
   `E[i][j] = interactions_sent_by_i x messages_from_j / (all messages - i's own)`.
   Self-interaction is excluded, so the score only reflects traffic between
   different people.
2. **Benchmark** — the same figure for every other group of the same size, so
   "more than the rest" is measured rather than asserted. Groups of a size with
   at most 150,000 combinations are enumerated exactly; past that the page
   samples 30,000 random groups and reports a percentile instead of a rank.
3. **Null model** — senders keep their own out-degree and their targets are
   drawn in proportion to posting volume. Each sender's internal hits are then
   binomial, so the mean and standard deviation are closed-form and the z-score
   and p-value come out instantly, without shuffling the chat.

Then a **drop-one / swap test**: recompute cohesion with each member removed, or
swapped for each outsider. A member whose removal *raises* cohesion is not part
of the cluster, and the verdict says so.

`clique.py` is the offline version of the same maths for one hardcoded group. The
page no longer uses it, but it validates the closed-form null against a real
Monte Carlo (20,000 redraws), which is why it is still here. Its ranking and the
page's agree exactly.

## URL parameters

`?chat=recent|history` · `?albums=0|1|2|3` · `?group=0,2,5` ·
`?layer=reply|react|mention` · `?scale=raw|row|aff` · `?theme=dark` — the page
opens in that state, so a specific view is shareable. Defaults: albums merged at
1s, replies, totals, and the top four posters as the group. `?group` takes
indices into the people list and is rewritten as you pick, so any group you
build can be linked to. The tabs and the album control are links, so each
survives switching the other.

## Caveats

- Only the 12 accounts with 50+ messages are included (`MIN_MESSAGES` in `extract.py`).
- Album merging is a timing heuristic. It cannot tell a real album from someone
  posting several photos in quick succession, and it will not merge photos that
  arrived slowly. Neither window is the "true" count; the export does not have one.
- 158 replies point at messages outside the export window and are dropped.
- Telegram only names the *most recent* reactors per emoji, so the reaction
  matrix covers 14,562 of 16,663 reactions (87%). Per-person "received" totals in
  the People table use the full counts and are exact.
