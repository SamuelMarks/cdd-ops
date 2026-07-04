# LibScript Guide

This guide details how to use `libscript` for managing multi-repository workflows in the CDD ecosystem. `libscript` is a high-performance software provisioning framework and multicloud orchestrator. It acts as a universal PaaS that brings the reproducible deployment model of containers to native execution.

## Massive Updates Overview

LibScript has recently undergone massive structural upgrades:

1. **Decentralized "Every-Thing-is-a-Package-Manager" Architecture:**
   The CLI has moved away from global monolithic commands (like `libscript install <pkg>`). Instead, every component handles its own setup and lifecycle independently. You must now invoke commands against the specific component.

2. **Multicloud PaaS Orchestration:**
   LibScript can now function as a cloud orchestrator. It supports declarative lifecycle management via `libscript.json` and features a unified `cloud` wrapper for AWS, Azure, and GCP utilizing native orchestration primitives.

3. **Built-in `netctl`:**
   Legacy routing components have been replaced by `netctl`, providing robust universal routing and sidecar service injection.

## Syntax Changes

The most prominent change is how you execute commands. Global commands like `install` and `test` have been pushed into the component CLI.

### Old Syntax
```bash
libscript install postgres
libscript test rust
```

### New Syntax
```bash
libscript <component> [COMMAND] [ARGS...]
```

For example:
```bash
libscript postgres install postgres
libscript rust test rust
libscript wait4x install wait4x
```

*Note: You can view the available commands for any component by running `libscript <component> --help`.*

## Global Commands

While component-specific commands handle the lifecycle of individual packages, the global CLI still provides powerful orchestration utilities:

- `list`: List all available components
- `search <query>`: Search available components by name or description
- `env <component> <version>`: Print environment variables for a component
- `install-deps [file]`: Install all dependencies defined in a JSON file (default: `libscript.json`)
- `package_as <format> [args]`: Package libscript usage (e.g., docker, docker_compose, msi, deb, exe)
- `provision <provider>` / `deprovision <provider>`: Provision/deprovision multicloud PaaS stacks.

### `libscript.json`

Libscript now supports declarative deployments. You can define a stack (e.g. `postgres>16, valkey, python>3.12`) within a `libscript.json` file.
Commands like `libscript start` and `libscript up` will parse this manifest and bootstrap the node-group, sync the codebase, and manage secrets automatically.

## Usage in Scripts

When writing Node.js or bash deployment scripts, ensure that you always use the updated syntax.

```typescript
// ✅ CORRECT
execSync(`libscript nodejs install nodejs`);

// ❌ INCORRECT (Will fail silently or throw errors)
execSync(`libscript install nodejs`);
```

Additionally, remember to rely on cross-platform primitives (`fs.mkdirSync`, `fs.rmSync`, `fs.renameSync` or `tar -xf` which is natively available on Windows 10+) when orchestrating deployments manually.
