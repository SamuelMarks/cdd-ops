#!/bin/sh
set -eu

# @file scripts/deploy.sh
# @description POSIX /bin/sh entrypoint for deploying and packaging the CDD platform locally.
# @arg $@ Optional CLI flags forwarded to `scripts/deploy.ts` (e.g., `--target deb --target msi`).
# @env POSTGRES_HOST Optional PostgreSQL hostname (defaults to localhost).
# @env POSTGRES_PORT Optional PostgreSQL port (defaults to 5432).
# @env POSTGRES_USER Optional PostgreSQL user (defaults to postgres).
# @env VALKEY_HOST Optional Valkey/Redis hostname (defaults to localhost).
# @env VALKEY_PORT Optional Valkey/Redis port (defaults to 6379).
# @env GITHUB_TOKEN Optional GitHub API token for downloading prebuilt microservice binaries.
# @exitcode 0 If deployment and packaging succeed.
# @exitcode >0 If deployment or packaging fails.

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)

CDPATH='' cd -- "$REPO_ROOT"
exec npm run deploy -- "$@"
