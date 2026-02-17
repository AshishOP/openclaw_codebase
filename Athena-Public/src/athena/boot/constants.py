from athena.core.config import get_project_root

# Paths — resolved dynamically via cwd() marker detection (cross-platform)
PROJECT_ROOT = get_project_root()

LOGS_DIR = PROJECT_ROOT / ".context" / "memories" / "session_logs"
SUPABASE_SEARCH_SCRIPT = PROJECT_ROOT / ".agent" / "scripts" / "smart_search.py"
PROTOCOLS_JSON = PROJECT_ROOT / ".agent" / "protocols.json"
SAFE_BOOT_SCRIPT = PROJECT_ROOT / "safe_boot.sh"


def _resolve_core_identity():
    """Fallback chain for Core_Identity.md location."""
    # Priority 1: Private repo path (.framework/)
    candidate = (
        PROJECT_ROOT / ".framework" / "v8.2-stable" / "modules" / "Core_Identity.md"
    )
    if candidate.exists():
        return candidate
    # Priority 2: Public repo template (examples/templates/)
    candidate = PROJECT_ROOT / "examples" / "templates" / "core_identity_template.md"
    if candidate.exists():
        return candidate
    # Fallback: return the primary path (will trigger a helpful error at boot)
    return PROJECT_ROOT / ".framework" / "v8.2-stable" / "modules" / "Core_Identity.md"


CORE_IDENTITY = _resolve_core_identity()

# Configuration
BOOT_TIMEOUT_SECONDS = 90
# Hash verification: None for public repo (template file differs per user).
# Set a SHA-384 hash here if you want to enforce integrity on your own Core_Identity.
EXPECTED_CORE_HASH = None

# Colors
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"
