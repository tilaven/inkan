#!/bin/sh
# Runs the visual suite in the same Playwright image everywhere so baselines match across machines.
# Usage: scripts/visual-docker.sh [test|update]
set -eu
mode="${1:-test}"
docker run --rm --ipc=host -e CI -e MODE="$mode" -v "$PWD":/src mcr.microsoft.com/playwright:v1.56.1-noble sh -c '
  set -eu
  mkdir /work
  tar -C /src --exclude=node_modules --exclude=dist --exclude=.astro --exclude=test-results --exclude=.git -cf - . | tar -C /work -xf -
  cd /work
  npm ci
  npm run build
  status=0
  if [ "$MODE" = update ]; then npm run test:visual:update || status=$?; else npm run test:visual || status=$?; fi
  mkdir -p /src/e2e/__screenshots__ /src/test-results
  cp -r e2e/__screenshots__/. /src/e2e/__screenshots__/ 2>/dev/null || true
  cp -r test-results/. /src/test-results/ 2>/dev/null || true
  exit $status
'
