# Working on this project

A dashboard built from Telegram chat exports. **This repo is public and is served
at https://nmeovv.github.io/tg_messages/.** Everything committed here is world
readable, immediately and permanently.

## The one rule: no private message data

The source exports contain real people's private conversations. Only
*aggregates* may ever be committed — counts, matrices, display names, dates,
emoji. Never message text, and never the exports themselves.

Never commit:

- `result.json`, `result1.json`, or any other raw Telegram export. They hold
  full message bodies. Already covered by `.gitignore`; do not override it with
  `git add -f`.
- Anything derived from an export that carries message text, file names, or
  attachment paths.
- **Any `@handle`.** See the next section.
- Screenshots or pasted output containing message contents.

Safe to commit:

- The `.py` sources and `index.html`.
- `build/*.js` — the aggregates the page loads. These are the deployed data.

`build/*.json` are build-time intermediates and are gitignored; only the `.js`
twins are published.

## The second rule: no Telegram handles

Display names are published on purpose — they are all over `build/*.js` and on
the page. A `@handle` is different: it ties one of those names to a real,
reachable account, so the name-to-handle map is the thing that deanonymises
people.

That map lives in `handles_local.py`, which `.gitignore` excludes and which must
stay local. `mentions.py` imports it inside a `try/except ImportError` and falls
back to an empty map, so a fresh clone still runs — `@handle` mentions just go
unresolved into the `unknown` bucket and `mentionsMapped` drops. `mention_name`
entities carry a `user_id` and resolve either way.

Do not paste a handle into a tracked file, a docstring, or a commit message.
The check below scans every tracked file in this directory and fails on one.

This rule is scoped to `tg_messages/`. The site root and `../visual` contain
`@`-names inside old anketa poll text — that is body text those projects publish
deliberately, not a handle map, and it is out of scope here.

## Check before you commit

```sh
python3 check_no_private_data.py
```

It fails the commit if a tracked file names a `@handle`, if a raw export is
tracked, if any tracked file is export-sized (>5MB), or if the published data
contains a key or a string that looks like message content. Run it after any
change to `extract.py`, the data shape, or `build/`.

To make it automatic:

```sh
git config core.hooksPath .githooks   # from the repo root
```

### What the check can and cannot do

It is strongest structurally: `extract.py` emits a known set of keys, and the
check fails on any key it does not recognise. If someone adds a field that
carries message content, it stops the commit even if the value is short. When a
new legitimate field is added, add it to `ALLOWED_KEYS` deliberately — that
prompt is the point, so do not silence it without reading the values.

Its length heuristic (strings over 40 chars, where the longest legitimate one is
a 19-char timestamp) catches message text smuggled into an existing string
field. It cannot catch a *short* message placed in a name-like field. So treat
it as a backstop, not a substitute for knowing what you are publishing.

## Updating the data

Put fresh exports next to `build.py` — the scripts resolve `result.json` and
`result1.json` relative to the working directory.

```sh
# in this directory, with fresh result.json / result1.json dropped in
python3 build.py                    # ~30s, rewrites build/
python3 check_no_private_data.py
git add -A && git commit && git push
```

`build.py` regenerates all eight variants (2 chats x 4 album windows) plus
`manifest.js`. The exports stay untracked.

## How the pieces fit

- `albums.py` — merges photo albums the export splits into one message per
  photo. A timing heuristic; there is no `grouped_id` in the export.
- `mentions.py` — resolves mention entities to participants. Reads the handle
  map from the gitignored `handles_local.py` when it is present.
- `extract.py` — one export plus an album window to one aggregate file.
- `build.py` — every chat x window variant, plus the manifest the page reads
  before fetching any dataset.
- `index.html` — the whole UI. Loads exactly one dataset per view. The group
  tightness section computes cohesion, ranks, the null model, and drop-one and
  swap tests in the browser from the matrices in the data.
- `clique.py` — offline Monte Carlo cross-check of the closed-form null model
  the page uses. Not used by the page; kept because it validates the
  approximation. Its ranking and the page's agree exactly.

## Conventions

- Commits in this repo use the `nmeovv` identity. It is set repo-locally
  already; do not commit with a personal email.
- This directory is one project inside a larger Pages site. Do not touch
  `../neochan`, `../visual`, or the site root.
