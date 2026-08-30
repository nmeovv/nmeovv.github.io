"""Generate every (chat x album-window) dataset the dashboard can show.

Each variant is a self-contained file that assigns to the same global, because
the page loads exactly one chat and one album window at a time. `manifest.js`
lists what exists so the tabs and the album control can render before any
dataset is fetched.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

CHATS = [
    ("recent", Path("result.json")),
    ("history", Path("result1.json")),
]
WINDOWS = [0, 1, 2, 3]  # seconds; 0 = count every photo separately
DEFAULT_WINDOW = 1      # album parts land in the same second

parser = argparse.ArgumentParser()
parser.add_argument("--out", type=Path, default=Path("build"))
args = parser.parse_args()

args.out.mkdir(exist_ok=True)


def run(script, *extra):
    cmd = [sys.executable, script, *map(str, extra)]
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode:
        sys.exit(f"{' '.join(cmd)} failed:\n{done.stderr}")
    return done.stdout


manifest = {"windows": WINDOWS, "default": DEFAULT_WINDOW, "chats": []}

for key, export in CHATS:
    if not export.is_file():
        sys.exit(f"missing export: {export}")
    entry = {"key": key, "albums": {}}
    for w in WINDOWS:
        data_js = args.out / f"data-{key}-a{w}.js"
        data_json = args.out / f"data-{key}-a{w}.json"
        run("extract.py", "--input", export, "--output-js", data_js,
            "--output-json", data_json, "--global-name", "DATA", "--album-window", w)
        summary = json.loads(data_json.read_text())
        entry.setdefault("label", summary["chat"])
        entry["albums"][str(w)] = summary["albums"]
        print(f"{key} a{w}: {summary['totals']['messages']:>7,} messages "
              f"({summary['albums']['messagesMerged']:,} merged into "
              f"{summary['albums']['albumsFound']:,} albums)")
    manifest["chats"].append(entry)

with (args.out / "manifest.js").open("w") as f:
    f.write("window.MANIFEST = ")
    json.dump(manifest, f, ensure_ascii=False)
    f.write(";\n")
print(f"\nwrote {len(list(args.out.glob('*.js')))} files to {args.out}/")
