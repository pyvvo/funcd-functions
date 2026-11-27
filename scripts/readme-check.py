#!/usr/bin/env python3
"""Hold each README to its shape in scripts/readme-template.yaml and to its word budget.

    python3 scripts/readme-check.py [<README.md>...]

With no file, it checks every README.md that git tracks or would add; the pre-commit hook passes the staged ones. A
README's words are those of the whole file, fenced code included: each run of characters between whitespace, as
`wc -w` counts them. Over its shape's target the check warns, and over the hard cap it fails. The README's `##`
headings are its shape's, in the template's order, with task headings only where the shape has `free`, no refused
heading, none twice, and every required one. The writing rules are .claude/rules/readme.md. The check needs nothing
outside Python's standard library.
"""

from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = Path(__file__).resolve().parent / "readme-template.yaml"

# Each shape's word budget, as (target, hard cap): over the target the check warns, over the hard cap it fails.
BUDGETS = {
    "root": (400, 600),
    "app": (600, 900),
    "part": (600, 900),
}

FENCE = re.compile(r"^(`{3,}|~{3,})")


def parse_yaml(text: str) -> object:
    """The template's YAML: block mappings and sequences, plain and quoted scalars, booleans and folded `>-` blocks,
    which is all the template uses."""
    lines = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if stripped and not stripped.startswith("#"):
            lines.append([len(raw) - len(raw.lstrip(" ")), stripped])
    if not lines:
        return {}
    value, end = _block(lines, 0, lines[0][0])
    if end != len(lines):
        raise ValueError(f"the template's line {lines[end][1]!r} is out of place")
    return value


def _block(lines: list, i: int, indent: int) -> tuple[object, int]:
    if lines[i][1].startswith("- "):
        return _sequence(lines, i, indent)
    return _mapping(lines, i, indent)


def _mapping(lines: list, i: int, indent: int) -> tuple[dict, int]:
    out: dict = {}
    while i < len(lines) and lines[i][0] == indent and not lines[i][1].startswith("- "):
        key, sep, rest = lines[i][1].partition(":")
        if not sep:
            raise ValueError(f"the template's line {lines[i][1]!r} holds no key")
        key, rest = key.strip(), rest.strip()
        i += 1
        if rest in (">", ">-"):
            words = []
            while i < len(lines) and lines[i][0] > indent:
                words.append(lines[i][1])
                i += 1
            out[key] = " ".join(words)
        elif rest:
            out[key] = _scalar(rest)
        elif i < len(lines) and lines[i][0] > indent:
            out[key], i = _block(lines, i, lines[i][0])
        else:
            out[key] = None
    return out, i


def _sequence(lines: list, i: int, indent: int) -> tuple[list, int]:
    out: list = []
    while i < len(lines) and lines[i][0] == indent and lines[i][1].startswith("- "):
        item = lines[i][1][2:].strip()
        if not item.startswith(("'", '"')) and (": " in item or item.endswith(":")):
            # A mapping item: its first key sits on the dash's line, the others below it.
            lines[i] = [indent + 2, item]
            value, i = _mapping(lines, i, indent + 2)
            out.append(value)
        else:
            out.append(_scalar(item))
            i += 1
    return out, i


def _scalar(text: str) -> object:
    if text.startswith('"'):
        return json.loads(text)
    if text.startswith("'") and text.endswith("'"):
        return text[1:-1].replace("''", "'")
    if text in ("true", "false"):
        return text == "true"
    return text


def shape_of(path: str, shapes: dict) -> str | None:
    """The first shape with a path that matches path, segment by segment."""
    parts = path.split("/")
    for name, shape in shapes.items():
        for pattern in shape.get("paths") or []:
            want = pattern.split("/")
            if len(want) == len(parts) and all(
                fnmatch.fnmatchcase(p, w) for p, w in zip(parts, want)
            ):
                return name
    return None


def outside_fences(text: str) -> list[tuple[int, str]]:
    """Each line outside fenced code, with its number."""
    out, fence = [], ""
    for n, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if fence:
            if stripped.startswith(fence):
                fence = ""
            continue
        opened = FENCE.match(stripped)
        if opened:
            fence = opened.group(1)
            continue
        out.append((n, line))
    return out


def check(path: str, text: str, shapes: dict) -> tuple[list[str], list[str]]:
    """What fails in the README at path, and what it warns about."""
    name = shape_of(path, shapes)
    if name is None:
        return [
            f"{path}: no shape of scripts/readme-template.yaml has a path that matches it"
        ], []
    shape, (target, cap) = shapes[name], BUDGETS[name]
    fails, warns = [], []
    words = len(text.split())
    if words > cap:
        fails.append(
            f"{path}: {words} words, over the hard cap of {cap} for a README of the shape {name}: move "
            "reference detail to a page that it links"
        )
    elif words > target:
        warns.append(
            f"{path}: {words} words, over the target of {target} for a README of the shape {name} (hard cap "
            f"{cap})"
        )
    lines = outside_fences(text)
    titles = [n for n, line in lines if line.startswith("# ")]
    if not titles or titles[0] != 1:
        fails.append(f"{path}: the first line is no `# ` title")
    for n in titles[1:]:
        fails.append(f"{path}: line {n}: a second `# ` title")
    headings = [(n, line[3:].strip()) for n, line in lines if line.startswith("## ")]
    first_end = headings[0][0] if headings else len(text.splitlines()) + 1
    if not any(line.strip() for line in text.splitlines()[1 : first_end - 1]):
        fails.append(
            f"{path}: no text under the title, where the first section holds: {shape['first']['holds']}"
        )
    sections = shape.get("sections") or []
    position = {s["heading"]: i for i, s in enumerate(sections) if not s.get("free")}
    free = next((i for i, s in enumerate(sections) if s.get("free")), None)
    refused = set(shape.get("refused") or [])
    seen: set = set()
    last, previous = -1, ""
    for n, heading in headings:
        if heading in seen:
            fails.append(f'{path}: line {n}: "{heading}" appears twice')
            continue
        seen.add(heading)
        if heading in refused:
            fails.append(f'{path}: line {n}: "{heading}" is a refused heading')
            continue
        at = position.get(heading, free)
        if at is None:
            fails.append(
                f'{path}: line {n}: "{heading}" is no heading of the shape {name}, whose headings are '
                f"{', '.join(position)}"
            )
        elif at < last:
            what = (
                f'the task section "{heading}"'
                if heading not in position
                else f'"{heading}"'
            )
            fails.append(f'{path}: line {n}: {what} comes after "{previous}"')
        else:
            last, previous = at, heading
    for s in sections:
        if s.get("required") and s["heading"] not in seen:
            fails.append(
                f'{path}: no "{s["heading"]}" section, which every README of the shape {name} holds'
            )
    return fails, warns


def readmes() -> list[str]:
    """Every README.md that git tracks or would add."""
    listed = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return sorted(
        p
        for p in listed.splitlines()
        if p.rsplit("/", 1)[-1] == "README.md" and (ROOT / p).is_file()
    )


def main(argv: list[str]) -> int:
    shapes = parse_yaml(TEMPLATE.read_text(encoding="utf-8"))
    unbudgeted = sorted(set(shapes) - set(BUDGETS))
    if unbudgeted:
        print(
            f"readme-check: no word budget for the shapes {', '.join(unbudgeted)}",
            file=sys.stderr,
        )
        return 1
    paths = (
        readmes()
        if not argv
        else [
            Path(a).resolve().relative_to(ROOT).as_posix()
            for a in argv
            if Path(a).name == "README.md" and Path(a).is_file()
        ]
    )
    fails, warns = [], []
    for path in paths:
        failed, warned = check(path, (ROOT / path).read_text(encoding="utf-8"), shapes)
        fails += failed
        warns += warned
    for warning in warns:
        print(f"readme-check: warning: {warning}", file=sys.stderr)
    for failure in fails:
        print(f"readme-check: {failure}", file=sys.stderr)
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
