#!/usr/bin/env bash
set -e

# Install pnpm locally without modifying package.json
npm install pnpm --no-save

# Install all workspace dependencies and build the api-server
./node_modules/.bin/pnpm install --no-frozen-lockfile
./node_modules/.bin/pnpm --filter @workspace/api-server run build

# Reset connections file so the app prompts DB setup on first run
echo '{"activeId":null,"connections":[]}' > artifacts/api-server/data/connections.json
