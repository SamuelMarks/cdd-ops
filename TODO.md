# CDD Platform TODOs

Actionable engineering tasks to achieve the project roadmap.

## Developer CLI (`cddctl`)
- [ ] Initialize new Rust repository (`cddctl`) utilizing `clap` for command parsing.
- [ ] Implement authentication flows (Personal Access Tokens or OAuth2 Device Authorization Grant) against `cdd-control-plane`.
- [ ] Implement `cddctl init` to bootstrap local project configurations.
- [ ] Implement `cddctl build` to package local schemas and trigger remote generation via the CDD API.
- [ ] Update `cdd-ops` deployment scripts to distribute the CLI binary alongside the platform.

## Auto-generated Mock Servers
- [ ] Update `cdd-engine` to invoke the existing mock generation flags/commands across the 13 `cdd-*` language tools.
- [ ] Implement orchestration in `cdd-control-plane` to compile (if necessary) and run the generated mock server artifacts as background processes or containers.
- [ ] Configure `cdd-gateway` to dynamically route `/mock/{project_id}/{language}/*` traffic to the running mock server instances.
- [ ] Add controls in `cdd-web-ui` to toggle mock servers on/off, select language targets for mocks, and view their execution logs.

## Enterprise SSO (Longterm)
- [ ] Research and select an OIDC/SAML library for Rust (e.g., `openidconnect`).
- [ ] Design the database schema changes required in `cdd-control-plane` to support multiple identity providers and tenant mapping.
- [ ] Update the `cdd-web-ui` login flow to support identity provider redirection.

## SDK Analytics & Usage Telemetry (Longterm)
- [ ] Define the telemetry payload schema and API endpoints in `cdd-control-plane` for tracking downloads and usage.
- [ ] Design the database aggregations or time-series schema necessary for performant analytics queries.
- [ ] Build the Analytics dashboard views in `cdd-web-ui` using a charting library.
