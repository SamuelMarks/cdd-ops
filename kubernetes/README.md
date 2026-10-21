# Kubernetes Deployment Guide

This directory contains the documentation and manifests for deploying the CDD platform to a production Kubernetes cluster.

## Architecture in Kubernetes

- **Ingress & Gateway:** `cdd-gateway` handles external HTTP/WebSocket traffic and TLS termination.
- **Stateless Services:** `cdd-web-ui`, `cdd-docs-ui`, and `cdd-control-plane` run as replicated `Deployment` workloads.
- **Horizontal Worker Scaling:** `cdd-engine` and `cdd-publisher` scale via HorizontalPodAutoscaler (HPA) based on Valkey queue depth.
- **Persistence:** Managed PostgreSQL, Valkey/Redis, and S3-compatible object storage (`cdd-storage`).
