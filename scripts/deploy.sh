#!/bin/sh

set -e


LIBSCRIPT="../libscript/libscript.sh"

echo "Provisioning core dependencies..."
"$LIBSCRIPT" install rust
"$LIBSCRIPT" install nodejs

echo "Checking if databases are installed..."
if ! "$LIBSCRIPT" test postgres >/dev/null 2>&1; then
    "$LIBSCRIPT" install postgres
else
    echo "PostgreSQL is already installed."
fi

if ! "$LIBSCRIPT" test redis >/dev/null 2>&1 && ! "$LIBSCRIPT" test valkey >/dev/null 2>&1; then
    "$LIBSCRIPT" install valkey
else
    echo "Redis/Valkey is already installed."
fi

echo "Setting up Postgres Database..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -U postgres -c "CREATE DATABASE cdd"

echo "Building cdd-* repositories in-place..."
for repo in "cdd-gateway" "cdd-web-ui" "cdd-control-plane" "cdd-engine" "cdd-storage" "cdd-publisher" "cdd-docs-ui"; do
    if [ -d "../$repo" ]; then
        echo "Building $repo..."
        (
            cd "../$repo"
            if [ -f "Cargo.toml" ]; then
                cargo build
            elif [ -f "package.json" ]; then
                npm install
                npm run build --if-present
            fi
        )
    else
        echo "Warning: Repository ../$repo not found, skipping."
    fi
done

echo "Exporting infrastructure formats..."
"$LIBSCRIPT" package_as docker
"$LIBSCRIPT" package_as docker-compose
"$LIBSCRIPT" package_as msi
"$LIBSCRIPT" package_as exe
"$LIBSCRIPT" package_as deb

echo "Deployment script completed successfully."