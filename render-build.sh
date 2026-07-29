#!/usr/bin/env bash
set -e

# Install pnpm via corepack (bundled with Node.js, no write to /usr/lib needed)
corepack enable pnpm 2>/dev/null || npm install -g pnpm --prefix="$HOME"
export PATH="$HOME/bin:$PATH"

# Install all workspace dependencies (allow postinstall scripts for esbuild etc.)
pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Build the api-server
pnpm --filter @workspace/api-server run build

# Reset connections file so the app prompts DB setup on first run
echo '{"activeId":null,"connections":[]}' > artifacts/api-server/data/connections.json
