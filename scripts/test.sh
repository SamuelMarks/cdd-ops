#!/bin/sh
#
# Orchestrates and runs the local End-to-End (E2E) test suite for the CDD platform.
# This script handles provisioning dependencies, applying database migrations,
# starting all necessary microservices on distinct non-privileged ports,
# waiting for the gateway to become healthy, and finally executing the Playwright tests.

set -e

# Trap to ensure background processes are killed when the script exits
trap 'kill 0' EXIT

# Ensure no zombie processes are occupying our designated ports
echo "Cleaning up lingering ports..."
for port in 8081 8082 8083 8084 8085 8086; do
    PIDS=$(lsof -Pi :$port -sTCP:LISTEN -t || true)
    if [ -n "$PIDS" ]; then
        echo "Killing process on port $port"
        kill -9 $PIDS || true
    fi
done

LIBSCRIPT="../libscript/libscript.sh"

echo "Setting up dependencies..."

PG_HOST=${POSTGRES_HOST:-localhost}
PG_PORT=${POSTGRES_PORT:-5432}
PG_USER=${POSTGRES_USER:-postgres}
VALKEY_HOST=${VALKEY_HOST:-localhost}
VALKEY_PORT=${VALKEY_PORT:-6379}

if ! command -v wait4x >/dev/null 2>&1; then
    echo "Installing wait4x..."
    "$LIBSCRIPT" install wait4x
fi

# Skip local installation if running in GitHub Actions (where services are provided)
if [ -z "$GITHUB_ACTIONS" ]; then
    echo "Checking if rust is installed..."
    if ! "$LIBSCRIPT" test rust >/dev/null 2>&1; then
        "$LIBSCRIPT" install rust
    else
        echo "Rust is already installed."
    fi

    echo "Checking if nodejs is installed..."
    if ! "$LIBSCRIPT" test nodejs >/dev/null 2>&1; then
        "$LIBSCRIPT" install nodejs
    else
        echo "Node.js is already installed."
    fi

    echo "Checking if databases are running or installed..."
    if wait4x tcp "$PG_HOST:$PG_PORT" -t 1s >/dev/null 2>&1; then
        echo "PostgreSQL is already running on $PG_HOST:$PG_PORT."
    elif ! "$LIBSCRIPT" test postgres >/dev/null 2>&1; then
        "$LIBSCRIPT" install postgres
    else
        echo "PostgreSQL is already installed."
    fi

    if wait4x tcp "$VALKEY_HOST:$VALKEY_PORT" -t 1s >/dev/null 2>&1; then
        echo "Redis/Valkey is already running on $VALKEY_HOST:$VALKEY_PORT."
    elif ! "$LIBSCRIPT" test redis >/dev/null 2>&1 && ! "$LIBSCRIPT" test valkey >/dev/null 2>&1; then
        "$LIBSCRIPT" install valkey
    else
        echo "Redis/Valkey is already installed."
    fi
fi

echo "Ensuring PostgreSQL is ready..."
wait4x postgresql "postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres?sslmode=disable" -t 60s

echo "Ensuring Redis/Valkey is ready..."
wait4x redis "redis://${VALKEY_HOST}:${VALKEY_PORT}" -t 60s

echo "Setting up Postgres Database for local tests..."
psql -h $PG_HOST -U $PG_USER -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -h $PG_HOST -U $PG_USER -c "CREATE DATABASE cdd"

echo "Ensuring diesel_cli is installed..."
if ! command -v diesel >/dev/null 2>&1; then
    cargo install diesel_cli --no-default-features --features postgres
fi

echo "Running Diesel Migrations via diesel cli..."
(
    cd ../cdd-control-plane
    DATABASE_URL="postgres://$PG_USER@$PG_HOST/cdd" diesel migration run
)

echo "Building and starting CDD microservices..."

# Avoid port collisions by forcing CDD__SERVER_BIND via env vars
# Note: cdd-gateway intentionally gets port 8086 because port 8080 is currently tied up by an active SSH process.
# I will update Playwright to point to 8086.

export CDD__DATABASE_URL="postgres://$PG_USER@$PG_HOST/cdd"
export CDD__REDIS_URL="redis://$VALKEY_HOST:$VALKEY_PORT"

echo "Starting cdd-control-plane..."
(cd ../cdd-control-plane && CDD__SERVER_BIND=0.0.0.0:8081 cargo run) &

echo "Starting cdd-storage..."
(cd ../cdd-storage && PORT=8085 cargo run) &

echo "Starting cdd-docs-ui..."
(cd ../cdd-docs-ui && npm install && npm run build && npm run serve) &

echo "Patching cdd-web-ui to use GITHUB_TOKEN..."
sed -i.bak "s/{ headers: { 'User-Agent': 'node.js' } }/{ headers: { 'User-Agent': 'node.js', ...(process.env.GITHUB_TOKEN ? { Authorization: \`Bearer \${process.env.GITHUB_TOKEN}\` } : {}) } }/g" ../cdd-web-ui/scripts/build-wasm.mjs || true

echo "Starting cdd-web-ui..."
(cd ../cdd-web-ui && npm install && npm start) &

echo "Starting cdd-gateway..."
(cd ../cdd-gateway && CDD__SERVER_BIND=0.0.0.0:8086 cargo run) &

echo "Waiting for Gateway to be healthy on port 8086..."
wait4x http http://localhost:8086/version http://localhost:8086/api/v1/health http://localhost:8086/ --expect-status-code 200 -t 360s
echo "Gateway and downstream services are up!"

echo "Running E2E tests locally..."
(
    cd e2e
    npm install
    npx playwright install --with-deps
    # Execute the playwright tests directly against localhost:8086
    BASE_URL="http://localhost:8086" npx playwright test
)

echo "Tests completed successfully."
