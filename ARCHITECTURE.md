# CDD Platform Architecture

This document outlines the high-level architecture of the CDD ecosystem from an operational perspective.

## Microservices

The platform consists of the following key services:

1.  **cdd-gateway**: Nginx/Envoy API Gateway handling ingress routing and basic rate limiting.
2.  **cdd-web-ui**: The frontend Angular application.
3.  **cdd-control-plane**: The backend API managing state, auth, and routing to the engine.
4.  **cdd-engine**: The core code generation worker.
5.  **cdd-storage**: Blob storage service (e.g., MinIO locally, S3 in prod).
6.  **cdd-publisher**: Background worker for publishing SDKs.
7.  **cdd-docs-ui**: Frontend for API documentation.

## Networking

All external traffic flows through `cdd-gateway`. Internal services communicate directly via internal DNS/service discovery.
