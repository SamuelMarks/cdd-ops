# Docker Compose Local Deployment

This directory contains the `docker-compose.yml` configuration for running the containerized CDD platform stack locally.

## Services Included

- `postgres`: PostgreSQL 18 relational database listening on port `5432`.
- `valkey`: Valkey 9 cache and task queue listening on port `6379`.
- `gateway`: API Gateway and ingress proxy (`cdd-gateway:latest`) listening on ports `80` and `8086` with Google & GitHub OAuth configuration.
- `web-ui`: The Angular web dashboard (`cdd-web-ui:latest`) listening on port `8083` with mounted `.wasm` artifacts (`cdd-cpp.wasm` and all 13 `cdd-<lang>.wasm` compilers).
- `docs-ui`: The API documentation portal (`cdd-docs-ui:latest`) listening on port `8082`.
- `control-plane`: Core backend API and workflow orchestrator (`cdd-control-plane:latest`) listening on port `8081` with Google OAuth, GitHub OAuth, and `GITHUB_ORG_NAME` provisioning support.
- `engine`: Code generation worker service (`cdd-engine:latest`) with mounted `.wasm` compilers.
- `publisher`: Package registry release worker (`cdd-publisher:latest`) equipped with `gnupg` (`gpg`) PGP signing and CLI toolchains for all 13 target registries (`cargo`, `npm`, `twine`, `mvn`, `gradle`, `dotnet`, `gem`, `composer`, `go`, `swift`, `conan`, `vcpkg`, `brew`).
- `storage`: Object and artifact storage service (`cdd-storage:latest`) listening on port `8085`.

## Usage

**POSIX (`/bin/sh`):**
```sh
docker compose up -d
```

**Windows (`.cmd`):**
```cmd
docker compose up -d
```
