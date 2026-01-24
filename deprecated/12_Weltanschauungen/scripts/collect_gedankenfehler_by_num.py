#!/usr/bin/env python3
"""
Collect all Gedankenfehler "gedanke" texts across all assistants and write one file per number.

Input:
  deprecated/12_Weltanschauungen/assistants/*/Gedankenfehler/NN.yaml

Output:
  deprecated/12_Weltanschauungen/tmp/NN.txt

Usage:
  python3 deprecated/12_Weltanschauungen/scripts/collect_gedankenfehler_by_num.py
  python3 deprecated/12_Weltanschauungen/scripts/collect_gedankenfehler_by_num.py --base /path/to/deprecated/12_Weltanschauungen
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import yaml


NN_YAML_RE = re.compile(r"^(?P<nn>\d{2})\.yaml$")


@dataclass(frozen=True)
class GedankenEntry:
    nn: str
    assistant: str
    weltanschauung: str
    source: str
    variant_index: int
    autor: str
    created_at: str
    variant_id: str
    gedanke: str


def _safe_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return str(v)


def load_bernhard_gedankenfehler_map(path: Path) -> Dict[str, str]:
    """
    Returns mapping: "NN" -> gedankenfehler string (from bernhard-von-hellental/gedankenfehler.yaml)
    """
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw = path.read_text(encoding="utf-8", errors="replace")

    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        return {}
    items = data.get("gedankenfehler")
    if not isinstance(items, list):
        return {}

    out: Dict[str, str] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        nummer = item.get("nummer")
        if isinstance(nummer, int):
            nn = f"{nummer:02d}"
        elif isinstance(nummer, str) and nummer.strip().isdigit():
            nn = f"{int(nummer.strip()):02d}"
        else:
            continue

        gf = item.get("gedankenfehler")
        if isinstance(gf, str) and gf.strip():
            out[nn] = gf.strip()
    return out


def iter_yaml_files(assistants_dir: Path) -> Iterable[Tuple[str, Path]]:
    for assistant_dir in sorted([p for p in assistants_dir.iterdir() if p.is_dir()]):
        gf_dir = assistant_dir / "Gedankenfehler"
        if not gf_dir.is_dir():
            continue
        for p in sorted([x for x in gf_dir.iterdir() if x.is_file()]):
            m = NN_YAML_RE.match(p.name)
            if not m:
                continue
            yield assistant_dir.name, p


def parse_file(assistant_name: str, path: Path) -> List[GedankenEntry]:
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw = path.read_text(encoding="utf-8", errors="replace")

    try:
        data = yaml.safe_load(raw)
    except Exception as e:
        raise RuntimeError(f"YAML parse failed for {path}: {e}") from e

    if not isinstance(data, dict):
        return []

    weltanschauung = _safe_str(data.get("weltanschauung"))
    m = NN_YAML_RE.match(path.name)
    nn_from_filename = m.group("nn") if m else None
    # IMPORTANT: group by filename number (NN.yaml), as requested; some YAMLs have mismatching `nummer:`.
    nn = nn_from_filename or "??"

    varianten = data.get("varianten", [])
    if not isinstance(varianten, list):
        return []

    out: List[GedankenEntry] = []
    for idx, v in enumerate(varianten):
        if not isinstance(v, dict):
            continue
        gedanke = v.get("gedanke")
        if not isinstance(gedanke, str) or not gedanke.strip():
            continue
        out.append(
            GedankenEntry(
                nn=nn,
                assistant=assistant_name,
                weltanschauung=weltanschauung,
                source=str(path),
                variant_index=idx,
                autor=_safe_str(v.get("autor")),
                created_at=_safe_str(v.get("created_at")),
                variant_id=_safe_str(v.get("id")),
                gedanke=gedanke.rstrip(),
            )
        )
    return out


def write_outputs(entries: List[GedankenEntry], tmp_dir: Path, bernhard_map: Dict[str, str]) -> List[Path]:
    tmp_dir.mkdir(parents=True, exist_ok=True)

    by_nn: Dict[str, List[GedankenEntry]] = {}
    for e in entries:
        by_nn.setdefault(e.nn, []).append(e)

    written: List[Path] = []
    for nn in sorted(by_nn.keys()):
        # Stable ordering
        group = sorted(by_nn[nn], key=lambda x: (x.assistant.lower(), x.variant_index, x.autor.lower()))
        out_path = tmp_dir / f"{nn}.txt"

        gf = bernhard_map.get(nn, "<Gedankenfehler>")
        header = (
            'Fasse folgende Texte über Erziehung zusammen in einem 150 Token langen Text. '
            'Nimm das Wichtigste, Bedeutsamste was den Gedankenfehler: '
            f'"{gf}" widerlegt.'
        )

        # Per user request: ONLY the "gedanke:" texts (plus the required header prompt), nothing else.
        parts: List[str] = [header, ""]
        texts = [e.gedanke.strip() for e in group if isinstance(e.gedanke, str) and e.gedanke.strip()]
        parts.append("\n\n".join(texts).rstrip())
        out_path.write_text("\n".join(parts).rstrip() + "\n", encoding="utf-8")
        written.append(out_path)
    return written


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base",
        default=str(Path(__file__).resolve().parents[1]),
        help="Path to deprecated/12_Weltanschauungen (defaults to script's parent folder).",
    )
    parser.add_argument(
        "--bernhard",
        default=str(Path(__file__).resolve().parents[4] / "assistants" / "bernhard-von-hellental" / "gedankenfehler.yaml"),
        help="Path to ragkeep/assistants/bernhard-von-hellental/gedankenfehler.yaml",
    )
    args = parser.parse_args()

    base_dir = Path(args.base).resolve()
    assistants_dir = base_dir / "assistants"
    tmp_dir = base_dir / "tmp"
    bernhard_path = Path(args.bernhard).resolve()

    if not assistants_dir.is_dir():
        raise SystemExit(f"assistants dir not found: {assistants_dir}")
    if not bernhard_path.is_file():
        raise SystemExit(f"bernhard gedankenfehler file not found: {bernhard_path}")

    all_entries: List[GedankenEntry] = []
    errors: List[str] = []

    for assistant_name, path in iter_yaml_files(assistants_dir):
        try:
            all_entries.extend(parse_file(assistant_name, path))
        except Exception as e:
            errors.append(str(e))

    bernhard_map = load_bernhard_gedankenfehler_map(bernhard_path)
    written = write_outputs(all_entries, tmp_dir, bernhard_map)

    # Print a short summary for CLI usage
    print(f"Collected {len(all_entries)} gedanke entries into {len(written)} files under {tmp_dir}")
    if errors:
        print(f"WARNING: {len(errors)} file(s) failed to parse.")
        for msg in errors[:20]:
            print(" -", msg)
        if len(errors) > 20:
            print(" - ...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

