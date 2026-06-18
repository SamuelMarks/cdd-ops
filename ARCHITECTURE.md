# CDD Platform Architecture

This document provides a comprehensive overview of the architecture of the Compiler Driven Development (CDD) ecosystem. The platform is designed as a scalable, cloud-native microservices architecture, capable of running anywhere from a local developer machine to a multi-region production Kubernetes cluster, as well as native bare-metal installations.

## Core Design Principles

1.  **Modularity:** Separation of concerns via distinct microservices.
2.  **Scalability:** Compute-heavy operations (like code generation) are decoupled into horizontal workers (`cdd-engine`).
3.  **Resilience:** Stateless services where possible, with persistent state managed by robust backing stores (PostgreSQL, Valkey, S3).
4.  **Language Agnostic Execution:** The core engine is designed to handle multiple compiler targets via isolated environments or lightweight containers.

---

## 1. Service Topology

The platform consists of several specialized microservices.

### 1.1 Ingress & Edge
*   **cdd-gateway**
    *   **Role:** The main entry point for all external traffic.
    *   **Technology:** Nginx or Envoy proxy.
    *   **Responsibilities:**
        *   TLS Termination.
        *   Routing external HTTP/WebSocket requests to the appropriate backend service.
        *   Rate limiting and basic DDoS protection.
        *   Serving static assets for web UIs in some configurations.

### 1.2 User Interfaces
*   **cdd-web-ui**
    *   **Role:** The primary graphical interface for developers using the CDD platform.
    *   **Technology:** Angular, served via Nginx.
    *   **Responsibilities:** Project management, triggering builds, viewing logs, managing credentials.
*   **cdd-docs-ui**
    *   **Role:** Documentation portal and API reference viewer.
    *   **Technology:** Starlight/Astro or Angular.
    *   **Responsibilities:** Rendering generated SDK documentation and platform guides.

### 1.3 Core Business Logic
*   **cdd-control-plane**
    *   **Role:** The brain of the platform.
    *   **Technology:** Rust (Actix/Axum).
    *   **Responsibilities:**
        *   API serving for the Web UI and external clients.
        *   Authentication and Authorization (RBAC, JWT validation).
        *   Orchestrating workflows (e.g., dispatching tasks to the engine).
        *   Database transaction management.

### 1.4 Compute & Execution
*   **cdd-engine**
    *   **Role:** The heavy lifter for compiler and generation tasks.
    *   **Technology:** Rust (Worker framework).
    *   **Responsibilities:**
        *   Consuming code generation jobs from the message queue.
        *   Executing compiler toolchains.
        *   Generating ASTs and outputting code.
        *   Streaming execution logs back to the control plane/UI.

### 1.5 Asynchronous Workers
*   **cdd-publisher**
    *   **Role:** Distributes generated artifacts to package registries.
    *   **Technology:** Rust.
    *   **Responsibilities:**
        *   Taking generated code from storage.
        *   Publishing to NPM, Crates.io, PyPI, Go modules, etc.
        *   Managing registry credentials and signatures.

### 1.6 Data & Storage
*   **cdd-storage**
    *   **Role:** Abstraction over object storage for generated artifacts and raw source.
    *   **Technology:** MinIO (local) / AWS S3 / Azure Blob Storage.
    *   **Responsibilities:** Storing large immutable files, serving signed URLs for download.

---

## 2. Data Architecture

The platform relies on a combination of relational data, in-memory caching, and object storage.

### 2.1 Relational State (PostgreSQL)
*   **Usage:** Primary source of truth.
*   **Data Stored:** User accounts, project configurations, deployment histories, RBAC roles, audit logs.
*   **Pattern:** Managed via asynchronous ORM (e.g., SeaORM or SQLx) in the `cdd-control-plane`.

### 2.2 Caching & Message Queue (Valkey / Redis)
*   **Usage:** High-throughput ephemeral state and message brokering.
*   **Data Stored:** User session tokens (JWT blacklists), real-time job status, build output streams.
*   **Pattern:**
    *   **Pub/Sub:** Used to stream live build logs from `cdd-engine` back to `cdd-web-ui` via WebSockets.
    *   **Task Queues:** `cdd-control-plane` pushes generation tasks to a Redis queue, which `cdd-engine` workers pop from.

### 2.3 Object Storage (S3 API)
*   **Usage:** Artifact retention.
*   **Data Stored:** Uploaded schemas, generated SDK tarballs, generated documentation HTML.

---

## 3. Request Flow Examples

### 3.1 Triggering a Code Generation Build
1.  **User** clicks "Build" in `cdd-web-ui`.
2.  `cdd-web-ui` sends an HTTP POST request to `cdd-gateway`.
3.  `cdd-gateway` routes the request to `cdd-control-plane`.
4.  `cdd-control-plane` authenticates the request, validates the project config, and writes a "Pending" build record to **PostgreSQL**.
5.  `cdd-control-plane` pushes a build job payload onto a queue in **Valkey**.
6.  An idle `cdd-engine` worker pulls the job from **Valkey**.
7.  `cdd-engine` begins execution, pushing real-time log lines to a **Valkey** Pub/Sub channel.
8.  `cdd-control-plane` reads the Pub/Sub channel and pushes logs over a WebSocket via `cdd-gateway` to the `cdd-web-ui`.
9.  Upon completion, `cdd-engine` uploads the generated artifact to `cdd-storage` (S3).
10. `cdd-engine` updates the build record in **PostgreSQL** to "Completed".
11. (Optional) A message is sent to `cdd-publisher` to deploy the artifact to a package registry.

---

## 4. Security & Authentication

*   **API Security:** All API endpoints are secured using JSON Web Tokens (JWT).
*   **Internal Communication:** By default, internal services trust each other on the private network (Kubernetes service mesh or Docker bridge network). For native/bare-metal deployments, mutual TLS (mTLS) is recommended.
*   **Secrets Management:** Environment variables or Kubernetes Secrets are used. For advanced deployments, HashiCorp Vault integration is supported.

---

## 5. Observability (Logging, Metrics, Tracing)

To ensure operational health, the platform exports standard telemetry data.
*   **Logging:** Structured JSON logs are emitted by all Rust and Node.js services. These are designed to be ingested by Promtail/Loki, FluentBit, or Datadog.
*   **Metrics:** Prometheus metrics endpoints (`/metrics`) are exposed by `cdd-control-plane` and `cdd-engine` detailing active jobs, queue depth, and memory usage.
*   **Tracing:** OpenTelemetry (OTel) is integrated to trace requests from `cdd-gateway` through to `cdd-engine` execution.

---

## 6. Deployment Topologies

The architecture allows for diverse deployment strategies (see `README.md` for specific commands).

1.  **Containerized (Kubernetes / Docker Compose):**
    The standard cloud-native approach. Each service runs in its own isolated container. Scaling `cdd-engine` is handled via Kubernetes HPA (Horizontal Pod Autoscaler) based on custom queue depth metrics.
2.  **Native / Bare Metal (Systemd / Services):**
    For environments where containers are not viable, the Rust binaries and Node UIs can be deployed directly as native OS services (`systemd` on Linux, Background Services on Windows), managed by OS package managers (`.deb`, `.msi`, `.rpm`).
