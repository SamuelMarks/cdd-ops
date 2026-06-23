# CDD Platform Roadmap

This document outlines the strategic direction and upcoming features for the Compiler Driven Development (CDD) ecosystem.

## Immediate Roadmap (Next Release Cycle)

*   **Developer CLI (`cddctl`)**
    *   A command-line interface for interacting with the hosted CDD platform directly from the terminal.
    *   Capabilities: Authenticate, upload OpenAPI specifications, trigger SDK generation builds, and manage project settings without navigating to the Web UI.
*   **Auto-generated Mock Servers**
    *   Leverage the existing mock server generation capabilities across the 13 `cdd-*` language tools to automatically provision and host functional mock endpoints.
    *   Enables frontend and client developers to immediately begin testing against generated SDKs while the real backend API is still under development, fully integrated into the platform's routing.

## Long-term Roadmap (Future Horizons)

*   **Enterprise SSO (SAML/OIDC)**
    *   Integration with enterprise identity providers (e.g., Okta, Google Workspace, Azure AD) via SAML or OpenID Connect.
    *   Streamlines onboarding, enforcing organizational security policies and access controls across the CDD platform.
*   **SDK Analytics & Usage Telemetry**
    *   Comprehensive dashboards within the Web UI showing adoption metrics.
    *   Tracks how often published SDKs are downloaded, integrated, and utilized, providing API publishers with visibility into developer engagement.
