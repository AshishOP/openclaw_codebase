#!/bin/bash
# OpenClaw + Athena Startup Script for Termux/Debian Proot
# Run this after cloning the repo

set -e

echo "🦞 OpenClaw + Athena Setup for Termux"
echo "======================================"

# Detect environment
if [ -d "/data/data/com.termux" ]; then
    echo "📱 Running in Termux"
    ROOT_DIR="/data/data/com.termux/files/usr/var/lib/proot-distro/installed-rootfs/debian/root"
else
    echo "🖥️ Running in standard Linux"
    ROOT_DIR="$HOME"
fi

cd "$ROOT_DIR"

# Check if repo exists
if [ ! -d "openclaw_codebase" ]; then
    echo "❌ openclaw_codebase not found. Clone it first:"
    echo "   git clone https://github.com/AshishOP/openclaw_codebase.git"
    exit 1
fi

# ==================== OpenClaw Setup ====================
echo ""
echo "📦 Setting up OpenClaw..."

cd "$ROOT_DIR/openclaw_codebase/openclaw"

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
    echo "⚠️ Node.js 22+ required. Installing..."
    if command -v pkg &> /dev/null; then
        pkg install nodejs -y
    elif command -v apt &> /dev/null; then
        apt install nodejs -y
    fi
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing OpenClaw dependencies (this may take a while)..."
pnpm install

# Build OpenClaw
echo "🔨 Building OpenClaw..."
pnpm build

# Install OpenClaw globally
echo "🔗 Installing OpenClaw CLI globally..."
npm link

# Run onboarding
echo ""
echo "🎯 Running OpenClaw onboarding..."
echo "   This will configure your AI provider (Anthropic/OpenAI/etc)"
openclaw onboard

# ==================== Athena Setup ====================
echo ""
echo "📦 Setting up Athena MCP Server..."

cd "$ROOT_DIR/openclaw_codebase/Athena-Public"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "📦 Installing Python..."
    if command -v pkg &> /dev/null; then
        pkg install python -y
    elif command -v apt &> /dev/null; then
        apt install python3 python3-pip -y
    fi
fi

# Install Athena (minimal for Termux)
echo "📦 Installing Athena dependencies..."
pip install -r requirements-lite.txt

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️ IMPORTANT: Edit .env and add your API keys:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - OPENAI_API_KEY (for embeddings)"
    echo ""
fi

# ==================== Start Services ====================
echo ""
echo "🚀 Starting services..."
echo ""

# Create startup script
cat > "$ROOT_DIR/start-services.sh" << 'STARTUP'
#!/bin/bash
# Start OpenClaw + Athena

echo "🦞 Starting OpenClaw Gateway..."
cd ~/openclaw_codebase/openclaw
openclaw gateway --port 18789 --verbose &
OPENCLAW_PID=$!

echo "🧠 Starting Athena MCP Server..."
cd ~/openclaw_codebase/Athena-Public
python3 -m athena &
ATHENA_PID=$!

echo ""
echo "✅ Services running!"
echo "   OpenClaw PID: $OPENCLAW_PID"
echo "   Athena PID: $ATHENA_PID"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $OPENCLAW_PID $ATHENA_PID 2>/dev/null" EXIT
wait
STARTUP

chmod +x "$ROOT_DIR/start-services.sh"

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit ~/.openclaw/openclaw.json to configure your AI model"
echo "   2. Edit ~/openclaw_codebase/Athena-Public/.env with API keys"
echo "   3. Run: ~/start-services.sh"
echo ""
echo "🎮 Quick test:"
echo "   openclaw agent --message 'Hello!'"