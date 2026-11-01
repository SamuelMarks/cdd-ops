# LibScript Guide

This guide details how to use `libscript` for managing multi-repository workflows in the CDD ecosystem. `libscript` is a high-performance software provisioning framework, operating system synthesis toolkit, and multicloud orchestrator. It acts as a universal PaaS that brings the reproducible deployment model of containers to native execution.

## Massive Updates Overview

LibScript has recently undergone massive structural upgrades across its 4-tier architecture:

1. **Unified `component_core` Lifecycle Engine & Transitive `PATH` Inheritance (`_lib/`):**
   Over 300+ components under `_lib/` (languages, databases, web-servers, caches, utilities, init-systems, kernels, filesystems) share a unified lifecycle engine (`_lib/_common/component_core.sh` and `component_core.cmd`) and idempotent transitive stack `PATH` inheritance (`_lib/_common/env_base.{sh,cmd}`, `_lib/_common/env_printer.{sh,cmd}`) with strict functional parity between POSIX `/bin/sh` (`libscript.sh`) and Windows Batch (`libscript.cmd`).

2. **Declarative Stack Resolution, `frontends`, `databases`, & Hooks (`libscript.json`):**
   `_lib/orchestration/resolve_stack.sh` (and `.cmd`) resolves component dependencies, transitive runtime/build dependencies, port bindings, and capabilities using a constraint solver (`resolve_stack.jq`). Top-level `frontends` (`_lib/app-servers/provision_frontend.{sh,cmd}`) and `databases` (`_lib/databases/provision_db.{sh,cmd}`, `health_db.{sh,cmd}`) automate SPA compilation, incremental `artifact_check` fingerprinting, database creation, and schema migrations alongside `run_hooks` and `daemonize` across 8+ init supervisors.

3. **Generalized Multi-Format Packaging (`package-as` & `packaging.json`):**
   `libscript package-as` synthesizes container definitions (`docker`, `dockerfile`, `docker_compose`, `docker-compose`, `docker-image`, `oci-image`), native OS installers (`msi` via WiX / `msi-rs`, `innosetup`, `nsis`, `deb`, `rpm`, `apk`, `txz`, `pkg`, `dmg`, `tui`), and bootable disk, hypervisor, and cloud images (`iso`, `raw-img`, `qcow2`, `vmdk`, `vdi`, `rootfs-tar`, `bsd-img`, `illumos-distro`, `freebsd-distro`, `unikernel`, `qemu-qcow2`, `vmware-vmdk`, `hyperv-vhd`, `hyperv-vhdx`, `proxmox-template`, `virtualbox-vdi`, `virtualbox-ova`, `xen-img`, `microvm-disk`, `aws-ami`, `azure-vhd`, `gcp-image`, `cloud-img`, `vagrant-box`, `disk-builder`) driven by `packaging.json` (`packaging/packaging.schema.json`).

4. **Tier 3.5 Cluster Topologies, Tier 4 Workload Payloads, Traits & Distro Synthesis:**
   LibScript includes declarative engines for multi-node cluster quorum choreography (`topologies/engine.sh`), scheduler-agnostic workload payloads (`payloads/engine.sh`), node substrate traits (`traits/engine.sh`), full Linux/FreeBSD/Illumos distribution assembly (`distro`), and native repository generation (`repogen`).

## Syntax Changes

The global CLI (`libscript.sh` on POSIX and `libscript.cmd` on Windows) uses an **action-first** syntax so every command works identically on both Unix shells and Windows Command Prompt.

### Canonical Action-First Global CLI Syntax
```sh
libscript <ACTION> <PACKAGE_NAME> [VERSION] [OPTIONS...]
```

For example, on POSIX (`/bin/sh`):
```sh
# Install components
./libscript.sh install postgres latest
./libscript.sh install rust latest
./libscript.sh install wait4x latest

# Test installed components
./libscript.sh test rust
./libscript.sh test postgres

# Service & Database lifecycle management
./libscript.sh provision-db libscript.json
./libscript.sh start postgres valkey
./libscript.sh status postgres
./libscript.sh health libscript.json
```

On Windows Command Prompt (`.cmd`):
```cmd
libscript.cmd install postgres latest
libscript.cmd install rust latest
libscript.cmd install wait4x latest
libscript.cmd test rust
libscript.cmd test postgres
libscript.cmd provision-db libscript.json
libscript.cmd start postgres valkey
libscript.cmd status postgres
libscript.cmd health libscript.json
```

### Direct Component CLI Invocation (Category Path)
You can also invoke a component's CLI directly by its category path on POSIX (`/bin/sh`):
```sh
./libscript.sh _lib/languages/rust install latest
./libscript.sh _lib/databases/postgres status
```

And on Windows Command Prompt (`.cmd`):
```cmd
libscript.cmd _lib\languages\rust install latest
libscript.cmd _lib\databases\postgres status
```

*Note: Avoid the legacy `<pkg> install <pkg>` syntax, as `libscript.cmd` on Windows strictly requires the action verb first and passing `<pkg>` as the third argument sets `<version>` to `<pkg>`.*

## Global Commands

The top-level `libscript` CLI provides the following global commands:

- `list`: List all available components across `_lib/` and `stacks/`
- `search <query>`: Search available components by name or description
- `db-search <query>` / `update-db`: Query and refresh the component registry database
- `semver`: Semantic version comparison and constraint evaluation utility
- `install <pkg> <version>` / `use <pkg> <version>` / `download <pkg> <version>`: Install, switch, or pre-download a component version
- `remove <pkg> [version]` / `uninstall <pkg> [version]`: Remove an installed component
- `install-service <pkg> <version>` / `uninstall-service <pkg> <version>`: Register or remove native OS init services
- `start` | `stop` | `status` | `status-all` | `health` | `logs` | `logs-all` | `restart` | `up` | `down`: Manage service lifecycles and deep health probes for individual components or an entire `libscript.json` stack
- `provision-db [libscript.json]` / `deprovision-db [libscript.json]`: Provision or deprovision databases and run declarative migrations defined in `libscript.json`
- `export-state [libscript.json] <dir>` / `import-state [libscript.json] <dir>`: Export or import portable database and application state snapshots
- `test <pkg> [version]`: Run component verification checks
- `run` | `which` | `exec` | `env` | `serve` | `route` | `info`: Execute binaries, inspect paths, or emit environment configurations for a component
- `install-deps [file]`: Parallel-download and sequentially install all dependencies and frontends defined in `libscript.json`
- `process-downloads`: Process queued offline/cached artifact downloads
- `package-as <format> [args...]`: Package the stack into containers (`docker`, `docker_compose`, `docker-image`, `oci-image`), native installers (`msi`, `innosetup`, `nsis`, `deb`, `rpm`, `apk`, `txz`, `pkg`, `dmg`, `tui`), or bootable VM/cloud images (`iso`, `qcow2`, `aws-ami`, `azure-vhd`, `gcp-image`, `vagrant-box`, etc.)
- `provision <provider>` / `deprovision <provider>` / `backup <node>` / `restore <node>`: Provision, teardown, backup, or restore multicloud infrastructure across AWS, GCP, Azure, Proxmox, Hetzner, and Firecracker
- `deploy-remote <user@host> [options]`: Idempotently synchronize repositories, install dependencies, and restart daemonized services on a remote host over SSH
- `config`: Manage global LibScript configuration settings
- `repogen`: Generate signed APT, RPM, FreeBSD, and IPS package repositories
- `distro`: Assemble bootable Linux, FreeBSD, and Illumos distributions from `os-config.json`
- `payload` / `topology` / `trait`: Execute Tier 4 workload payloads, Tier 3.5 cluster topologies, and substrate traits

### `libscript.json` & `packaging.json`

`cdd-ops` includes both declarative manifests in the repository root:
- `libscript.json`: Conforms to `../libscript/libscript.schema.json` and defines the CDD platform's required toolchains (`rust`, `nodejs`, `wait4x`), databases (`postgres`, `valkey`), web servers (`nginx`), declarative `databases` and `frontends` (`cdd-docs-ui`, `cdd-web-ui` with `artifact_check`), environment variables (`vars`), build/startup `hooks`, and background `services` with `health_url` and `depends_on`.
- `packaging.json`: Conforms to `../libscript/packaging/packaging.schema.json` and defines the product `upgrade_code` GUID, `database_contracts`, daemon `services` (with `binary_Or_Entrypoint` and `health_check`), `ingress` routes, `features`, and branding metadata for generating native installers.

## Usage in Scripts

When writing Node.js, POSIX `/bin/sh`, or Windows `.cmd` deployment scripts, always use the canonical action-first syntax:

```typescript
// ✅ CORRECT (Works identically on POSIX libscript.sh and Windows libscript.cmd)
execSync(`"${libscript}" install nodejs latest`);
execSync(`"${libscript}" test nodejs`);

// ❌ INCORRECT (Fails on Windows libscript.cmd and passes package name as version)
execSync(`"${libscript}" nodejs install nodejs`);
```

Additionally, rely on cross-platform primitives (`fs.mkdirSync`, `fs.rmSync`, `fs.renameSync` or `tar -xf` which is natively available on Windows 10+) when orchestrating deployments.
