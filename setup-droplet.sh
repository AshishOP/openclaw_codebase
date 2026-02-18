#!/bin/bash
# =============================================================================
# OpenClaw + Athena - DigitalOcean Droplet Setup Script
# =============================================================================
#
# Run this on your fresh Ubuntu droplet:
#   curl -fsSL https://raw.githubusercontent.com/AshishOP/openclaw_codebase/main/setup-droplet.sh | bash
#
# Or manually:
#   git clone https://github.com/AshishOP/openclaw_codebase.git
#   cd openclaw_codebase && chmod +x setup-droplet.sh && ./setup-droplet.sh
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     🦞 OpenClaw + Athena - Droplet Setup Script              ║"
echo "║                                                               ║"
echo "║  This script will:                                            ║"
echo "║  1. Install dependencies (Node.js, Python, etc.)              ║"
echo "║  2. Clone the repository                                      ║"
echo "║  3. Setup OpenClaw gateway                                    ║"
echo "║  4. Setup Athena with local mode                              ║"
echo "║  5. Configure environment variables                           ║"
echo "║  6. Setup systemd service for auto-start                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# Configuration
# =============================================================================
REPO_URL="https://github.com/AshishOP/openclaw_codebase.git"
INSTALL_DIR="$HOME/openclaw_codebase"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"  # Set via environment or prompt
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
WHATSAPP_PHONE="${WHATSAPP_PHONE:-}"

# =============================================================================
# Step 1: System Update & Dependencies
# =============================================================================
echo -e "${YELLOW}[1/7] Updating system and installing dependencies...${NC}"

sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    sox \
    libsox-fmt-all

# Install Node.js 22.x (required for OpenClaw)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 22.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✓ npm: $(npm --version)${NC}"

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm: $(pnpm --version)${NC}"

# =============================================================================
# Step 2: Clone Repository
# =============================================================================
echo -e "${YELLOW}[2/7] Cloning repository...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory exists, pulling latest...${NC}"
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${GREEN}✓ Repository cloned to $INSTALL_DIR${NC}"

# =============================================================================
# Step 3: Setup OpenClaw
# =============================================================================
echo -e "${YELLOW}[3/7] Setting up OpenClaw...${NC}"

# Install OpenClaw globally
npm install -g openclaw

# Verify installation
if command -v openclaw &> /dev/null; then
    echo -e "${GREEN}✓ OpenClaw installed: $(openclaw --version)${NC}"
else
    echo -e "${RED}✗ OpenClaw installation failed${NC}"
    exit 1
fi

# Create OpenClaw config directory
mkdir -p ~/.openclaw/workspace

# =============================================================================
# Step 4: Setup Athena (Local Mode)
# =============================================================================
echo -e "${YELLOW}[4/7] Setting up Athena with local mode...${NC}"

cd "$INSTALL_DIR/Athena-Public"

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies (lite version for server)
pip install --upgrade pip
pip install -r requirements-lite.txt

# Install additional local mode dependencies
pip install chromadb

# Create necessary directories
mkdir -p .agent/state/chroma
mkdir -p .context/memories/session_logs

echo -e "${GREEN}✓ Athena setup complete${NC}"

# =============================================================================
# Step 5: Create Environment Files
# =============================================================================
echo -e "${YELLOW}[5/7] Creating environment files...${NC}"

cd "$INSTALL_DIR"

# Prompt for API keys if not set
if [ -z "$GOOGLE_API_KEY" ]; then
    echo -e "${YELLOW}Enter your Google API Key (for Gemini embeddings):${NC}"
    read -r GOOGLE_API_KEY
fi

if [ -z "$NVIDIA_API_KEY" ]; then
    echo -e "${YELLOW}Enter your NVIDIA API Key (for LLM):${NC}"
    read -r NVIDIA_API_KEY
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo -e "${YELLOW}Enter your Telegram Bot Token (optional, press Enter to skip):${NC}"
    read -r TELEGRAM_BOT_TOKEN
fi

# Create Athena .env file
cat > "$INSTALL_DIR/Athena-Public/.env" << EOF
# Athena Configuration - Local Mode
ATHENA_MODE=local
ATHENA_DATA_DIR=$HOME/.athena/data

# Google API for embeddings (required even in local mode)
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# Supabase (not needed in local mode - leave empty)
SUPABASE_URL=
SUPABASE_KEY=
EOF

# Create OpenClaw config
cat > ~/.openclaw/openclaw.json << 'OPENCLAW_CONFIG'
{
  "meta": {"lastTouchedVersion": "2026.2.15", "lastTouchedAt": "2026-02-19T00:00:00.000Z"},
  "wizard": {"lastRunAt": "2026-02-19T00:00:00.000Z", "lastRunVersion": "2026.2.15", "lastRunCommand": "onboard", "lastRunMode": "local"},
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "apiKey": "NVIDIA_API_KEY_PLACEHOLDER",
        "api": "openai-completions",
        "models": [
          {"id": "z-ai/glm5", "name": "Z-AI GLM5", "reasoning": false, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 131072, "maxTokens": 8192},
          {"id": "deepseek-ai/deepseek-v3.2", "name": "DeepSeek V3.2", "reasoning": true, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 131072, "maxTokens": 8192},
          {"id": "meta/llama-3.3-70b-instruct", "name": "Meta Llama 3.3 70B", "reasoning": false, "input": ["text"], "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, "contextWindow": 131072, "maxTokens": 4096}
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {"primary": "nvidia/z-ai/glm5"},
      "models": {"nvidia/z-ai/glm5": {}},
      "workspace": "/root/.openclaw/workspace",
      "compaction": {"mode": "safeguard"},
      "maxConcurrent": 4,
      "subagents": {"maxConcurrent": 8}
    }
  },
  "messages": {"ackReactionScope": "group-mentions"},
  "commands": {"native": "auto", "nativeSkills": "auto"},
  "channels": {
    "whatsapp": {"dmPolicy": "allowlist", "selfChatMode": true, "allowFrom": ["PHONE_PLACEHOLDER"], "groupPolicy": "allowlist", "debounceMs": 0, "mediaMaxMb": 50},
    "telegram": {"enabled": true, "dmPolicy": "pairing", "botToken": "TELEGRAM_BOT_TOKEN_PLACEHOLDER", "groupPolicy": "allowlist", "streamMode": "partial"}
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "0.0.0.0",
    "auth": {"mode": "token", "token": "droplet-openclaw-token-2026"},
    "tailscale": {"mode": "off", "resetOnExit": false},
    "nodes": {"denyCommands": ["camera.snap", "camera.clip", "screen.record", "calendar.add", "contacts.add", "reminders.add"]}
  },
  "plugins": {
    "enabled": true,
    "slots": {"memory": "memory-athena"},
    "load": {"paths": ["/root/openclaw_codebase/openclaw/extensions/memory-athena"]},
    "entries": {
      "telegram": {"enabled": true},
      "whatsapp": {"enabled": true},
      "memory-athena": {
        "enabled": true,
        "config": {
          "transport": "stdio",
          "pythonPath": "/root/openclaw_codebase/Athena-Public/venv/bin/python3",
          "athenaProjectDir": "/root/openclaw_codebase/Athena-Public",
          "toolPrefix": "athena_"
        }
      }
    }
  }
}
OPENCLAW_CONFIG

# Replace placeholders with actual values
sed -i "s/NVIDIA_API_KEY_PLACEHOLDER/$NVIDIA_API_KEY/g" ~/.openclaw/openclaw.json
sed -i "s/TELEGRAM_BOT_TOKEN_PLACEHOLDER/$TELEGRAM_BOT_TOKEN/g" ~/.openclaw/openclaw.json
if [ -n "$WHATSAPP_PHONE" ]; then
    sed -i "s/PHONE_PLACEHOLDER/$WHATSAPP_PHONE/g" ~/.openclaw/openclaw.json
fi

echo -e "${GREEN}✓ Configuration files created${NC}"

# =============================================================================
# Step 6: Create Systemd Service
# =============================================================================
echo -e "${YELLOW}[6/7] Creating systemd service...${NC}"

cat > /tmp/openclaw.service << 'SYSTEMD_SERVICE'
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/openclaw_codebase
Environment="PATH=/root/openclaw_codebase/Athena-Public/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="ATHENA_MODE=local"
Environment="GOOGLE_API_KEY=GOOGLE_API_KEY_PLACEHOLDER"
ExecStart=/usr/bin/openclaw gateway --port 18789 --verbose
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

# Replace placeholder
sed -i "s/GOOGLE_API_KEY_PLACEHOLDER/$GOOGLE_API_KEY/g" /tmp/openclaw.service

sudo mv /tmp/openclaw.service /etc/systemd/system/openclaw.service
sudo systemctl daemon-reload
sudo systemctl enable openclaw

echo -e "${GREEN}✓ Systemd service created and enabled${NC}"

# =============================================================================
# Step 7: Start and Verify
# =============================================================================
echo -e "${YELLOW}[7/7] Starting OpenClaw...${NC}"

sudo systemctl start openclaw

# Wait for service to start
sleep 5

# Check status
if sudo systemctl is-active --quiet openclaw; then
    echo -e "${GREEN}✓ OpenClaw is running!${NC}"
else
    echo -e "${RED}✗ OpenClaw failed to start. Check logs:${NC}"
    echo "  sudo journalctl -u openclaw -f"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 ✅ Setup Complete!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Gateway URL:${NC} ws://YOUR_DROPLET_IP:18789"
echo -e "${BLUE}📍 Canvas URL:${NC}  http://YOUR_DROPLET_IP:18789/__openclaw__/canvas/"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  Start:   sudo systemctl start openclaw"
echo "  Stop:    sudo systemctl stop openclaw"
echo "  Restart: sudo systemctl restart openclaw"
echo "  Logs:    sudo journalctl -u openclaw -f"
echo "  Status:  sudo systemctl status openclaw"
echo ""
echo -e "${YELLOW}Config Files:${NC}"
echo "  OpenClaw: ~/.openclaw/openclaw.json"
echo "  Athena:   ~/openclaw_codebase/Athena-Public/.env"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Get your droplet IP: curl -4 ifconfig.me"
echo "  2. Test the gateway: curl http://YOUR_IP:18789"
echo "  3. Connect from your app using the gateway URL"
echo ""