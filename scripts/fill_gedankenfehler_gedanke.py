#!/usr/bin/env python3
"""
Fill missing `gedanke:` entries in bernhard-von-hellental/gedankenfehler.yaml by summarizing
corresponding tmp/<nummer>.txt files via DeepSeek Chat.

Rules:
- If an item already has `gedanke:`, skip it.
- If tmp/<nummer>.txt does not exist, skip it.
- Insert `gedanke:` right after the item's `gedankenfehler:` line.
- Keep YAML single-quoted scalar style; escape single quotes by doubling.

Usage:
  python ragkeep/scripts/fill_gedankenfehler_gedanke.py \
    --yaml @ragkeep/assistants/bernhard-von-hellental/gedankenfehler.yaml \
    --tmp-dir @deprecated/12_Weltanschauungen/tmp \
    --dry-run

Env:
  - DEEPSEEK_API_KEY (preferred) or RAGRUN_DEEPSEEK_API_KEY
  - Optional: DEEPSEEK_BASE_URL (default: https://api.deepseek.com)
  - Optional: DEEPSEEK_MODEL (default: deepseek-chat)
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Iterable, List, Optional

import httpx


def _strip_at_path(p: str) -> str:
    t = (p or "").strip()
    return t[1:] if t.startswith("@") else t


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _yaml_single_quote(text: str) -> str:
    # YAML single-quoted scalar escapes ' by doubling it.
    return "'" + text.replace("'", "''") + "'"


@dataclass(frozen=True)
class DeepSeekConfig:
    api_key: str
    base_url: str = "https://api.deepseek.com"
    model: str = "deepseek-chat"
    timeout_s: float = 60.0


class DeepSeekClient:
    def __init__(self, cfg: DeepSeekConfig) -> None:
        self.cfg = cfg

    async def chat(self, messages: List[dict[str, str]], *, temperature: float, max_tokens: int) -> str:
        payload: dict[str, object] = {
            "model": self.cfg.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.cfg.api_key}",
        }
        async with httpx.AsyncClient(timeout=self.cfg.timeout_s) as client:
            r = await client.post(f"{self.cfg.base_url.rstrip('/')}/chat/completions", json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError("DeepSeek returned no choices")
            msg = choices[0].get("message") if isinstance(choices[0], dict) else None
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, str) or not content.strip():
                raise RuntimeError("DeepSeek returned empty content")
            return content.strip()


ITEM_START_RE = re.compile(r"^(\s*)-\s+nummer:\s*(\d+)\s*$")
HAS_GEDANKE_RE = re.compile(r"^\s*gedanke:\s*")
GEDANKENFEHLER_RE = re.compile(r"^(\s*)gedankenfehler:\s*(.*)$")


def _iter_items(lines: List[str]) -> Iterable[tuple[int, int, int]]:
    """
    Yield (start_idx, end_idx_exclusive, nummer) for each YAML list item under `gedankenfehler:`.
    Assumes items begin with a line like "    - nummer: 3".
    """
    starts: list[tuple[int, int]] = []
    for i, ln in enumerate(lines):
        m = ITEM_START_RE.match(ln.rstrip("\n"))
        if m:
            starts.append((i, int(m.group(2))))
    for idx, (start_i, nummer) in enumerate(starts):
        end_i = starts[idx + 1][0] if idx + 1 < len(starts) else len(lines)
        yield start_i, end_i, nummer


def _extract_existing_gedanke_lengths(lines: List[str]) -> list[int]:
    lens: list[int] = []
    for ln in lines:
        if "gedanke:" not in ln:
            continue
        m = re.match(r"^\s*gedanke:\s*'(.*)'\s*$", ln.rstrip("\n"))
        if m:
            val = m.group(1)
            lens.append(len(val))
    return lens


def _guess_target_len(lines: List[str]) -> int:
    lens = _extract_existing_gedanke_lengths(lines)
    if not lens:
        return 520
    # Robust: median of existing
    return int(median(lens))


async def _summarize_to_gedanke(
    *,
    client: DeepSeekClient,
    nummer: int,
    thought_error: str,
    source_text: str,
    target_len_chars: int,
) -> str:
    target_min = max(250, int(target_len_chars * 0.80))
    target_max = max(target_min + 50, int(target_len_chars * 1.15))

    system = (
        "Du bist ein deutscher Redakteur. Du schreibst knapp, klar, warm, ohne Pathos. "
        "Du erfindest keine Zitate und keine Quellenangaben. Du gibst nur den Text aus, ohne Meta-Kommentare."
    )
    user = f"""
Erzeuge für eine YAML-Datei ein Feld `gedanke:` als EINEN zusammenhängenden Absatz.

Kontext:
- nummer: {nummer}
- gedankenfehler: {thought_error}

Input-Text (Quelle):
{source_text}

Anforderungen:
- Schreibe Deutsch.
- Länge: ungefähr {target_len_chars} Zeichen (Zielbereich: {target_min}–{target_max} Zeichen).
- Ein Absatz, keine Aufzählung, keine Überschrift.
- Kein "In diesem Text...", keine Prompt-Erwähnung.
- Keine Anführungszeichen im Output, keine YAML-Syntax.
""".strip()

    out = await client.chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
        max_tokens=260,
    )
    out = _collapse_ws(out)
    # Ensure a clean ending.
    if out and out[-1] not in ".!?":
        out += "."
    return out


async def main_async() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--yaml",
        default="@ragkeep/assistants/bernhard-von-hellental/gedankenfehler.yaml",
        help="Path to gedankenfehler.yaml",
    )
    ap.add_argument(
        "--tmp-dir",
        default="@deprecated/12_Weltanschauungen/tmp",
        help="Directory containing numbered *.txt files (e.g. 07.txt)",
    )
    ap.add_argument("--dry-run", action="store_true", help="Do not write changes back")
    ap.add_argument("--limit", type=int, default=0, help="Max items to fill (0 = no limit)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    yaml_path = Path(_strip_at_path(args.yaml)).resolve()
    tmp_dir = Path(_strip_at_path(args.tmp_dir)).resolve()

    api_key = (os.getenv("DEEPSEEK_API_KEY") or os.getenv("RAGRUN_DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("Missing API key: set DEEPSEEK_API_KEY (or RAGRUN_DEEPSEEK_API_KEY).")
    base_url = (os.getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com").strip()
    model = (os.getenv("DEEPSEEK_MODEL") or "deepseek-chat").strip()

    cfg = DeepSeekConfig(api_key=api_key, base_url=base_url, model=model)
    client = DeepSeekClient(cfg)

    raw = yaml_path.read_text(encoding="utf-8")
    lines = raw.splitlines(keepends=True)

    target_len = _guess_target_len(lines)

    changed = 0
    scanned = 0

    # We'll apply edits by building a new lines list.
    out_lines = list(lines)

    # Because we mutate, iterate with an index offset approach.
    delta = 0
    for start_i, end_i, nummer in _iter_items(lines):
        scanned += 1
        start = start_i + delta
        end = end_i + delta
        block = out_lines[start:end]

        if any(HAS_GEDANKE_RE.match(ln) for ln in block):
            continue

        txt_path = tmp_dir / f"{nummer:02d}.txt"
        if not txt_path.exists():
            continue

        # Find the gedankenfehler line (needed for prompt and insertion point).
        gf_line_idx: int | None = None
        gf_indent = "      "
        thought_error = ""
        for j, ln in enumerate(block):
            m = GEDANKENFEHLER_RE.match(ln.rstrip("\n"))
            if m:
                gf_line_idx = j
                gf_indent = m.group(1)
                thought_error = (m.group(2) or "").strip()
                break
        if gf_line_idx is None:
            # Can't place safely; skip
            continue

        source_text = txt_path.read_text(encoding="utf-8").strip()
        if not source_text:
            continue

        if args.verbose:
            print(f"[fill] nummer={nummer} txt={txt_path}", file=sys.stderr)

        gedanke_text = await _summarize_to_gedanke(
            client=client,
            nummer=nummer,
            thought_error=thought_error,
            source_text=source_text,
            target_len_chars=target_len,
        )

        yaml_value = _yaml_single_quote(gedanke_text)
        insert_line = f"{gf_indent}gedanke: {yaml_value}\n"

        insert_at = start + gf_line_idx + 1
        out_lines.insert(insert_at, insert_line)
        delta += 1
        changed += 1

        if args.limit and changed >= args.limit:
            break

    if args.dry_run:
        print(f"dry-run: would add gedanke to {changed} items (scanned {scanned})", file=sys.stderr)
        return 0

    if changed == 0:
        print("No changes needed.", file=sys.stderr)
        return 0

    yaml_path.write_text("".join(out_lines), encoding="utf-8")
    print(f"Updated {yaml_path} (added {changed} gedanke entries).", file=sys.stderr)
    return 0


def main() -> None:
    import asyncio

    raise SystemExit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()

