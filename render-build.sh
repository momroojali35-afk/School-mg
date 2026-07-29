#!/usr/bin/env bash
set -e

# Install pnpm locally (avoids EROFS / global write restrictions on Render)
npm install pnpm

# Run install and build via the local pnpm binary
./node_modules/.bin/pnpm install --frozen-lockfile
./node_modules/.bin/pnpm --filter @workspace/api-server run build

# Reset connections file so the app prompts DB setup on first run
echo '{"activeId":null,"connections":[]}' > artifacts/api-server/data/connections.json
