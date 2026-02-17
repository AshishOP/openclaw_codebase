"""
athena.core.config
==================

Centralized configuration and path discovery.
"""

from pathlib import Path
from typing import Optional
import os


# Global Cache for PROJECT_ROOT
_PROJECT_ROOT_CACHE: Optional[Path] = None


def get_project_root() -> Path:
    """
    Discover project root by looking for 'pyproject.toml'.
    Caches the result after the first call.
    """
    global _PROJECT_ROOT_CACHE
    if _PROJECT_ROOT_CACHE:
        return _PROJECT_ROOT_CACHE

    # Priority 0: Explicit environment variable
    root = os.getenv("ATHENA_ROOT")
    if root and Path(root).is_dir():
        _PROJECT_ROOT_CACHE = Path(root)
        return _PROJECT_ROOT_CACHE

    # Priority 1: Walk up from cwd() looking for .athena_root marker
    # This is the most reliable method for installed packages (pip install)
    # where __file__ resolves to site-packages/, not the user's workspace.
    for parent in [Path.cwd(), *Path.cwd().parents]:
        if (parent / ".athena_root").exists():
            _PROJECT_ROOT_CACHE = parent
            return parent

    # Priority 2: Walk up from __file__ looking for pyproject.toml
    # Works when running from source (development mode)
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "pyproject.toml").exists():
            _PROJECT_ROOT_CACHE = parent
            return parent

    # Priority 3: Walk up from cwd() looking for pyproject.toml
    for parent in [Path.cwd(), *Path.cwd().parents]:
        if (parent / "pyproject.toml").exists():
            _PROJECT_ROOT_CACHE = parent
            return parent

    # Final fallback: CWD
    _PROJECT_ROOT_CACHE = Path.cwd()
    return _PROJECT_ROOT_CACHE


PROJECT_ROOT = get_project_root()

# Key Directories
AGENT_DIR = PROJECT_ROOT / ".agent"
CONTEXT_DIR = PROJECT_ROOT / ".context"
FRAMEWORK_DIR = PROJECT_ROOT / ".framework"
SCRIPTS_DIR = AGENT_DIR / "scripts"
MEMORIES_DIR = CONTEXT_DIR / "memories"
SESSIONS_DIR = MEMORIES_DIR / "session_logs"
MEMORY_DIR = PROJECT_ROOT / ".athena" / "memory"
STATE_DIR = AGENT_DIR / "state"
MANIFEST_PATH = STATE_DIR / "sync_manifest.json"
SYSTEM_LEARNINGS_FILE = MEMORY_DIR / "SYSTEM_LEARNINGS.md"
USER_PROFILE_FILE = MEMORY_DIR / "USER_PROFILE.yaml"
INPUTS_DIR = CONTEXT_DIR / "inputs"

# === UNIFIED MEMORY CONFIGURATION ===
# These directories are the "Active Memory" for VectorRAG and local search.


def _resolve_system_docs():
    """Resolve system docs dir: .framework/ (private) or examples/templates/ (public)."""
    candidate = FRAMEWORK_DIR / "v8.2-stable" / "modules"
    if candidate.exists():
        return candidate
    fallback = PROJECT_ROOT / "examples" / "templates"
    if fallback.exists():
        return fallback
    return candidate  # Return primary (will be skipped if missing)


CORE_DIRS = {
    "sessions": SESSIONS_DIR,
    "case_studies": MEMORIES_DIR / "case_studies",
    "protocols": AGENT_DIR / "skills" / "protocols",
    "capabilities": AGENT_DIR / "skills" / "capabilities",
    "workflows": AGENT_DIR / "workflows",
    "system_docs": _resolve_system_docs(),
}

# Extended Memory (Silos mapped to logical tables)
# Only directories that exist will be scanned (see get_active_memory_paths).
EXTENDED_DIRS = [
    (PROJECT_ROOT / "docs", "system_docs"),
    (PROJECT_ROOT / ".athena", "system_docs"),
    (CONTEXT_DIR / "research", "case_studies"),
    (CONTEXT_DIR / "specs", "system_docs"),
]


def get_active_memory_paths():
    """Returns a deduplicated list of all active memory directory Paths."""
    paths = [p for p in CORE_DIRS.values() if p.exists()]
    paths.extend([p for p, _ in EXTENDED_DIRS if p.exists()])
    return sorted(list(set(paths)))


# Key Files (Sharded for token efficiency)
TAG_INDEX_PATH = (
    CONTEXT_DIR / "TAG_INDEX.md"
)  # Legacy monolithic (for backwards compat)
TAG_INDEX_AM_PATH = CONTEXT_DIR / "TAG_INDEX_A-M.md"
TAG_INDEX_NZ_PATH = CONTEXT_DIR / "TAG_INDEX_N-Z.md"
CANONICAL_PATH = CONTEXT_DIR / "CANONICAL.md"


def get_current_session_log() -> Optional[Path]:
    """
    Find the most recent session log file (pattern: YYYY-MM-DD-session-XX.md).
    """
    if not SESSIONS_DIR.exists():
        return None

    import re

    pattern = re.compile(r"(\d{4}-\d{2}-\d{2})-session-(\d{2,3})\.md")
    session_files = []

    for f in SESSIONS_DIR.glob("*.md"):
        match = pattern.match(f.name)
        if match:
            date_str, session_num = match.groups()
            session_files.append((date_str, int(session_num), f))

    if not session_files:
        return None

    # Sort by date then session number descending
    session_files.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return session_files[0][2]
