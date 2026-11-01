# Kubernetes Deployment Guide

This directory contains the documentation and reference manifests for deploying the CDD platform to a production Kubernetes cluster.

## Architecture in Kubernetes

- **Ingress & Gateway:** `cdd-gateway` handles external HTTP/WebSocket traffic, OAuth callbacks (`CDD__GOOGLE_*`, `CDD__GITHUB_*`), and TLS termination.
- **Stateless Services:** `cdd-web-ui`, `cdd-docs-ui`, and `cdd-control-plane` run as replicated `Deployment` workloads.
- **Horizontal Worker Scaling:** `cdd-engine` (with `cdd-cpp.wasm` and all 13 `cdd-<lang>.wasm` artifacts mounted) and `cdd-publisher` (with `gnupg` PGP signing and 13-language registry CLI toolchains) scale via HorizontalPodAutoscaler (HPA) based on Valkey queue depth.
- **Persistence:** Managed PostgreSQL, Valkey/Redis, and S3-compatible object storage (`cdd-storage`).

## Environment & Secret Configuration (`ConfigMap` & `Secret`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cdd-platform-config
data:
  CDD__GOOGLE_OAUTH_URL: "https://oauth2.googleapis.com/token"
  CDD__GOOGLE_USERINFO_URL: "https://www.googleapis.com/oauth2/v3/userinfo"
  GITHUB_ORG_NAME: "offscale"
  CDD__WASM_DIR: "/opt/cdd/wasm"
  CDD__STORAGE_URL: "http://cdd-storage:8085"
---
apiVersion: v1
kind: Secret
metadata:
  name: cdd-platform-secrets
type: Opaque
stringData:
  CDD__DATABASE_URL: "postgres://postgres@cdd-postgres:5432/cdd"
  CDD__REDIS_URL: "redis://cdd-valkey:6379"
  CDD__GOOGLE_CLIENT_ID: "replace-with-google-client-id"
  CDD__GOOGLE_CLIENT_SECRET: "replace-with-google-client-secret"
  CDD__GITHUB_CLIENT_ID: "replace-with-github-client-id"
  CDD__GITHUB_CLIENT_SECRET: "replace-with-github-client-secret"
  CDD__STORAGE_SECRET_KEY: "replace-with-storage-secret-key"
  CDD__PGP_KEY_ID: "replace-with-pgp-key-id"
  CDD__PGP_PASSPHRASE: "replace-with-pgp-passphrase"
```

## Deployment Commands

**POSIX (`/bin/sh`):**
```sh
kubectl apply -f kubernetes/
kubectl rollout status deployment/cdd-gateway
```

**Windows (`.cmd`):**
```cmd
kubectl apply -f kubernetes
kubectl rollout status deployment/cdd-gateway
```
