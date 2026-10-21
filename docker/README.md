# Docker Compose Local Deployment

This directory contains the `docker-compose.yml` configuration for running the containerized CDD platform stack locally.

## Services Included

- `gateway`: Nginx reverse proxy listening on port `80`.
- `web-ui`: The Angular web dashboard (`cdd-web-ui:latest`).
- `control-plane`: Core backend API and workflow orchestrator (`cdd-control-plane:latest`).
- `engine`: Code generation worker service (`cdd-engine:latest`).
- `storage`: S3-compatible object storage backed by MinIO (`minio/minio`).

## Usage

```sh
docker compose up -d
```
