#!/usr/bin/env python3
"""Print GitHub Release notes from the first CHANGELOG section. No media attachments."""

from pathlib import Path

text = Path("CHANGELOG.md").read_text(encoding="utf-8")
chunks: list[str] = []
started = False
for line in text.splitlines():
    if line.startswith("## ") and started:
        break
    if line.startswith("## "):
        started = True
    if started:
        chunks.append(line)

notes = "\n".join(chunks).strip()
if not notes:
    raise SystemExit("CHANGELOG.md has no version section")

print(notes)
print()
print(
    "This GitHub Release does not include audio or video files. "
    "OpenTune is a metadata mediator: the API stores catalog metadata in PostgreSQL; "
    "playback and downloads use original provider URLs on the user device."
)
