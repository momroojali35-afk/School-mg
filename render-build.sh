#!/usr/bin/env bash
set -e

# Install pnpm globally
npm install -g pnpm

# Install all workspace dependencies (allow postinstall scripts for esbuild etc.)
pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Build the api-server
pnpm --filter @workspace/api-server run build

# Reset connections file so the app prompts DB setup on first run
echo '{"activeId":null,"connections":[]}' > artifacts/api-server/data/connections.json
