#!/bin/bash
set -e

MSG="test: orchestrate native E2E test suite and fix Playwright timeouts

- Fix port collisions by dynamically assigning non-privileged ports.
- Setup diesel_cli for automated database migrations in local testing.
- Fix backend initialization to properly inject the DB pool in Actix Web.
- Refactor Playwright POM to navigate the actual Angular router and handle the WASM loader modal.
- Fix WCAG color contrast accessibility violations in cdd-web-ui."

REPOS=". ../cdd-control-plane ../cdd-docs-ui ../cdd-engine ../cdd-gateway ../cdd-storage ../cdd-web-ui"

for repo in $REPOS; do
    echo "Processing $repo..."
    cd "$repo"
    
    git fetch origin master || true
    git reset --soft origin/master || true
    git add -A
    git commit -m "$MSG" || echo "Nothing to commit in $repo"
    git push origin master || echo "Failed to push $repo"
    
    cd - > /dev/null
done
