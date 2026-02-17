import subprocess
import sys

from athena.boot.constants import GREEN, RESET


class SystemLoader:
    @staticmethod
    def verify_environment():
        """Titanium Airlock: Verifies dependencies and env vars."""
        from athena.boot.constants import PROJECT_ROOT, RED, BOLD, RESET, DIM

        # Skip shell-based verification on Windows (bash not available)
        if sys.platform == "win32":
            print(f"   {DIM}⏭️  Airlock: Skipped (Windows — bash unavailable){RESET}")
            return

        ensure_env = PROJECT_ROOT / "examples" / "scripts" / "ensure_env.sh"

        if not ensure_env.exists():
            print(f"   ⚠️  Airlock: ensure_env.sh missing at {ensure_env}")
            return

        print("🛡️  Verifying Environment (Airlock)...")
        result = subprocess.run(
            ["bash", str(ensure_env)], capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"\n{RED}{BOLD}❌ Environment Check Failed{RESET}")
            print(f"{DIM}{result.stdout}{RESET}")
        else:
            print(f"   {GREEN}✅ Environment Healthy{RESET}")

    @staticmethod
    def enforce_daemon():
        """Ensures the Athena Daemon (athenad) is active."""
        from athena.boot.constants import PROJECT_ROOT, GREEN, RESET

        daemon_script = PROJECT_ROOT / "src" / "athena" / "core" / "athenad.py"

        try:
            if sys.platform == "win32":
                # Windows: use tasklist to check for athenad
                check = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq python*", "/FO", "CSV"],
                    capture_output=True,
                    text=True,
                )
                daemon_running = "athenad" in check.stdout
            else:
                # Unix/macOS: use pgrep
                check = subprocess.run(
                    ["pgrep", "-f", "athenad.py"], capture_output=True
                )
                daemon_running = check.returncode == 0

            if not daemon_running:
                print("🧠 Starting Athena Daemon (Titanium)...")
                subprocess.Popen(
                    [sys.executable, str(daemon_script)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=(sys.platform != "win32"),
                    # On Windows, start_new_session=True raises errors in some configs
                    creationflags=(
                        subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                    ),
                )
                print(f"   {GREEN}✅ Daemon Started.{RESET}")
            else:
                print(f"   {GREEN}✅ Athena Daemon active.{RESET}")
        except Exception as e:
            print(f"   ⚠️  Daemon enforcement failed: {e}")

    @staticmethod
    def sync_ui():
        """Launch UI components and sync hardware state."""
        print("🔄 Syncing UI Components...")

        # `open -a` is macOS-only. Skip gracefully on other platforms.
        if sys.platform != "darwin":
            print(f"   {GREEN}✅ UI Sync: Skipped (non-macOS){RESET}")
            return

        cmd = [
            "open",
            "-a",
            "Antigravity",
            "--args",
            "--disable-gpu-driver-bug-workarounds",
            "--ignore-gpu-blacklist",
            "--enable-gpu-rasterization",
        ]

        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"   {GREEN}✅ Antigravity Sync Initiated{RESET}")
        except Exception as e:
            print(f"   ⚠️  Failed to sync Antigravity: {e}")
