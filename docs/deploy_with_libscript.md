# Deploying with LibScript

This document outlines how to provision and deploy the full CDD platform using `libscript`. The provided deployment scripts replicate the environment setup and project building steps of the `.github/workflows/ci.yml` pipeline.

## Architecture Overview

```mermaid
flowchart TB
    subgraph Toolchains ["Language Toolchains"]
        Rust[Rust]
        Node[Node.js]
    end

    subgraph Infrastructure ["Proxy Servers & Databases"]
        Nginx[Nginx Proxy]
        PG[(PostgreSQL)]
        Valkey[(Valkey)]
    end

    subgraph Repositories ["CDD Repositories (Microservices & UI)"]
        CP[cdd-control-plane]
        Eng[cdd-engine]
        Stor[cdd-storage]
        GW[cdd-gateway]
        Pub[cdd-publisher]
        Web[cdd-web-ui]
        Docs[cdd-docs-ui]
        SDK[cdd-browser-sdk]
    end

    subgraph Orchestration ["Operations"]
        Ops[cdd-ops]
    end

    Ops -.->|Installs| Toolchains
    Ops -.->|Provisions| Infrastructure
    Ops -.->|Clones & Builds| Repositories
```

## Deployment Flow

```mermaid
flowchart TD
    subgraph Phase1 ["1. Provision Dependencies (libscript)"]
        A1[Install Toolchains:<br/>Rust, Node.js]
        A2[Install Proxy:<br/>Nginx]
        A3[Install Databases:<br/>Postgres, Valkey]
    end

    subgraph Phase2 ["2. Source Acquisition (git)"]
        B1[Clone Backends:<br/>Control Plane, Engine, Storage, Gateway, Publisher]
        B2[Clone Frontends & SDK:<br/>Web UI, Docs UI, Browser SDK]
    end

    subgraph Phase3 ["3. Build & Test (cdd-ops)"]
        C1[npm install]
        C2[npm run test]
        C1 --> C2
    end

    subgraph Phase4 ["4. Production Release (libscript)"]
        D1[deploy-remote:<br/>Sync & Provision Host]
        D2[daemonize / up:<br/>Manage Services & Health]
        D1 --> D2
    end

    Phase1 --> Phase2
    Phase2 --> Phase3
    Phase3 --> Phase4
```

## Automated Scripts

Two scripts are provided in the repository root for streamlined setup:
- **POSIX (Linux/macOS/FreeBSD):** `deploy_with_libscript.sh`
- **Windows (Command Prompt):** `deploy_with_libscript.cmd`

## What the Scripts Do

1. **Install Dependencies:**
   Utilizing the unified action-first `libscript` CLI and `libscript.json`, the scripts automatically install the necessary core dependencies:
   - Rust (`libscript install rust latest`)
   - Node.js (`libscript install nodejs latest`)
   - Nginx (`libscript install nginx latest`)
   - Postgres (`libscript install postgres latest`)
   - Valkey (`libscript install valkey latest`)
   - Declarative stack dependencies (`libscript install-deps libscript.json`)

2. **Clone Microservices:**
   Just like the GitHub Actions CI workflow, the scripts navigate to the parent directory to clone the necessary CDD repositories alongside `cdd-ops`. This includes:
   - `cdd-control-plane`
   - `cdd-engine`
   - `cdd-storage`
   - `cdd-web-ui`
   - `cdd-browser-sdk`
   - `cdd-docs-ui`
   - `cdd-gateway`
   - `cdd-publisher`

3. **Build the Projects:**
   Finally, the scripts change back into `cdd-ops` to install NPM dependencies and execute the full build/test suite using the native `npm install` and `npm run test` sequence exactly as orchestrated in `ci.yml`.

## Execution

To begin deployment, execute the script corresponding to your operating system from the root of the `cdd-ops` directory.

### macOS / Linux

Make sure the script is executable, then run it:

```sh
chmod +x deploy_with_libscript.sh
./deploy_with_libscript.sh
```

### Windows

Run the batch script via Command Prompt:

```cmd
.\deploy_with_libscript.cmd
```

## Remote Deployment via `deploy-remote` & Service Lifecycle Management

`libscript` features a built-in remote deployment orchestrator (`deploy-remote`, backed by `_lib/cloud/core/deploy_remote.sh`) and an init-system supervisor abstraction (`_lib/init-systems/daemonize.sh` / `daemonize.cmd`), plus native `openssh` component provisioning (`libscript install openssh latest`).

### 1. Idempotent Remote Sync & Provisioning (`deploy-remote`)

Once the local build completes, use `libscript deploy-remote` to synchronize local repositories to a target host over SSH, automatically run `install-deps` and `up` for each application containing a `libscript.json`, and configure the reverse proxy:

```sh
../libscript/libscript.sh deploy-remote deploy@production-server.local
  --sync-dirs="cdd-ops"
  --apps="cdd-ops"
  --health-apps="cdd-ops"
```

### 2. Service Lifecycle & Health Management

Both locally and on remote hosts, `libscript` manages the lifecycle of all services declared in `libscript.json` across native init systems (`systemd`, `openrc`, `runit`, `s6`, `dinit`, `launchd`, FreeBSD `rc.d`, Illumos `smf`, and Windows Services):

```sh
# Start all CDD services and run pre_start/post_start hooks
../libscript/libscript.sh up libscript.json

# Check service status
../libscript/libscript.sh status libscript.json

# Restart or stop the stack
../libscript/libscript.sh restart libscript.json
../libscript/libscript.sh down libscript.json
```

Combining `libscript.json`, `packaging.json`, and `deploy-remote` allows you to script an end-to-end continuous deployment pipeline natively across any operating system.
