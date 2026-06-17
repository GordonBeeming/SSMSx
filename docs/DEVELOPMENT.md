# SSMSx Development

This document is the developer runbook for SSMSx. Keep the README product-focused and put implementation, workflow, and verification details here.

## Architecture

```text
Tauri v2 shell
  Rust commands and sidecar process management
  React 19 + TypeScript frontend
    Monaco editor
    Zustand stores
    Tailwind CSS v4 app styling
  C# .NET sidecar
    Microsoft.Data.SqlClient
    MSAL / Entra auth support
    Schema discovery and query execution
```

The React frontend talks to Rust through Tauri commands. Rust owns the window and sidecar lifecycle. The C# sidecar handles SQL Server work and communicates with Rust over newline-delimited JSON.

## Design Constraints

SSMSx is intentionally dense and utilitarian:

- Light theme only.
- Layered cool grays, 1px borders, and restrained radius.
- Accent blue `#0063B2` for primary actions, focus, and selection.
- Native OS UI fonts, with monospace text for SQL and result data.
- No gradients, decorative imagery, or heavy shadows in app chrome.
- The app icon is the SSMSx data-stack mark.

Repo-local design guidance lives in `.agents/skills/ssmsx-design` and is symlinked from `.claude/skills/ssmsx-design`.

## Project Structure

```text
ssmsx/
  src-tauri/     Tauri v2 Rust app, commands, capabilities, icons
  src/           React frontend and feature modules
  sidecar/       C# sidecar for SQL Server operations
  scripts/       Smoke-test helpers
  docs/          Product and implementation notes
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) latest stable
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Platform-specific Tauri dependencies: see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Local Commands

Install dependencies:

```bash
npm install
```

Run the browser-hosted frontend:

```bash
npm run dev
```

Run the Tauri desktop app with the development sidecar:

```bash
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Run smoke checks:

```bash
npm run smoke:sidecar
npm run smoke:tauri-mcp
```

Generate app icons from the design-system source icon:

```bash
npm run tauri icon .agents/skills/ssmsx-design/assets/icon-1024.png
```

## CI

The GitHub workflow builds the frontend, .NET sidecar, and Tauri bundle across Linux, macOS, and Windows. Release events also run the macOS signing and notarization job.

## Release Versioning

- Release tag: `v{major}.{minor}`.
- CI app version: `{major}.{minor}.{github_run_number}`.
- DMG asset: `ssmsx-{major}.{minor}-aarch64.dmg`.
- Homebrew cask: `gordonbeeming/tap/ssmsx`.

Use `.agents/skills/create-release` when cutting a release.
