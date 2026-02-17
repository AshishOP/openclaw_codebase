---
description: Run self-diagnostic health check on Athena workspace
created: 2026-02-17
last_updated: 2026-02-17
---

# /doctor — Athena Health Check

> **Latency Profile**: LOW (~5s)
> **Stolen From**: OpenClaw's `openclaw doctor` pattern
> **Philosophy**: One command. Full health picture. Actionable fixes.

## Usage

// turbo

```bash
python3 examples/scripts/athena_doctor.py
```

## What It Checks

| # | Check | What It Does |
|---|-------|-------------|
| 1 | **Environment** | Python version ≥ 3.13 |
| 2 | **Structure** | Essential directories + files exist |
| 3 | **Protocols** | Count + validate protocol files |
| 4 | **Workflows** | Count + check frontmatter |
| 5 | **Dead Links** | Scan docs/ for broken internal links |
| 6 | **Version** | Check version consistency across files |
| 7 | **Git** | Uncommitted changes + remote sync |
| 8 | **Sessions** | Session log health + proper closure |
| 9 | **Memory** | CANONICAL.md integrity |
| 10 | **Config** | .env file presence |

## Options

- `--fix` — Auto-fix safe issues
- `--json` — Machine-readable JSON output

## Output

Letter-grade health score (A/B/C/D) with pass/warn/fail breakdown.

## Tagging

# workflow #automation #doctor #health-check
