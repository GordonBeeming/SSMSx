# SSMSx Specification

## Why

SSMS is Windows-only, Azure Data Studio is nearing end-of-life, and neither feels fast. SSMSx is a cross-platform SQL Server management tool built for speed.

## Architecture

**Tauri v2 (Rust)** shell with a **React** frontend and a **C# Native AOT** sidecar for SQL operations.

```
React (invoke) → Tauri Command (Rust) → stdio JSON → C# Sidecar → SQL Server
```

- Tauri provides the native window and IPC layer (same architecture as GitButler)
- C# sidecar uses Microsoft's own `Microsoft.Data.SqlClient` and `MSAL` — the most reliable way to handle SQL Server connectivity and Entra MFA auth
- Communication is newline-delimited JSON over stdio with correlation IDs and batched streaming for large result sets
- React frontend uses Monaco Editor, Zustand state, and TanStack virtualized tables

See [README.md](../README.md) for product positioning and [DEVELOPMENT.md](DEVELOPMENT.md) for the development runbook.

## Architecture: Vertical Slice Architecture (VSA)

The codebase follows **Vertical Slice Architecture** — code is organized by **feature** (connection, explorer, query) rather than by technical layer (components, stores, commands). Each feature contains everything it needs from UI to backend.

### Why VSA

- **Cohesion**: All code for a feature lives together, making it easy to understand and modify
- **Reduced coupling**: Features are self-contained; changes to one feature rarely affect others
- **Parallel development**: Teams/agents can work on different features simultaneously without conflicts
- **Discoverability**: Need to change connection logic? Look in `features/connection/`, not across 5 different directories

### Cross-cutting concerns

Truly shared code (UI primitives, utility functions, infrastructure) lives in dedicated shared directories. A piece of code moves to `shared/` only when it's used by 2+ features — never preemptively.

## Solution Structure

```
ssmsx/
├── src-tauri/                    # Tauri v2 Rust app
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs                # App setup + command registration
│   │   ├── sidecar.rs            # Sidecar lifecycle management (shared infra)
│   │   └── commands/             # Tauri IPC commands (one file per feature)
│   │       ├── connection.rs
│   │       ├── explorer.rs
│   │       └── ping.rs
│   └── sidecars/                 # C# AOT binaries (build output)
│
├── src/                          # React + TypeScript frontend
│   ├── features/                 # Feature slices (primary organization)
│   │   ├── connection/           # Connection management
│   │   │   ├── api/              # Tauri invoke wrappers
│   │   │   ├── components/       # React components
│   │   │   ├── store/            # Zustand store
│   │   │   ├── types.ts          # Feature-specific types
│   │   │   └── index.ts          # Public barrel export
│   │   ├── explorer/             # Object Explorer
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── query/                # Query Editor
│   │       ├── api/
│   │       ├── components/
│   │       ├── store/
│   │       ├── types.ts
│   │       └── index.ts
│   ├── shared/                   # Code used by 2+ features
│   │   ├── components/           # UI primitives (ContextMenu, ConfirmDialog, ErrorBoundary)
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/                # Shared utilities (SQL quoting, etc.)
│   ├── app/                      # App shell (layout, composition)
│   │   └── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── sidecar/                      # C# Native AOT sidecar
│   ├── Ssmsx.Sidecar.slnx
│   ├── src/
│   │   ├── Ssmsx.Sidecar/       # stdio JSON-RPC server entry point
│   │   ├── Ssmsx.Core/          # Business logic (organized by feature)
│   │   │   ├── Connections/      # Connection feature
│   │   │   ├── Explorer/         # Explorer feature
│   │   │   ├── Credentials/      # Shared infrastructure
│   │   │   ├── Auth/             # Shared infrastructure
│   │   │   └── Storage/          # Shared infrastructure
│   │   └── Ssmsx.Protocol/      # Shared message/model types
│   │       ├── Models/           # DTOs by feature
│   │       └── Messages/         # Request/response params by feature
│   └── tests/
│
├── build/                        # Cross-platform build scripts
├── .claude/
│   └── CLAUDE.md                 # VSA guidelines and code quality standards
└── docs/
    └── SPEC.md                   # This file
```

## Sidecar Protocol

```jsonc
// Request (Rust → C#)
{"id":"abc-123","method":"query.execute","params":{"connectionId":"conn-1","sql":"SELECT 1"}}

// Response (C# → Rust)
{"id":"abc-123","result":{"columns":[""],"rows":[[1]]}}

// Streaming (batches of 5,000 rows)
{"id":"abc-123","result":{"batch":1,"rows":[...],"done":false}}
{"id":"abc-123","result":{"batch":2,"rows":[...],"done":true}}

// Error
{"id":"abc-123","error":{"code":"CONNECTION_FAILED","message":"..."}}
```

Performance at scale: batched streaming + virtual scrolling on frontend (only ~50 rows rendered) + ring buffer memory management + backpressure in Rust layer. MessagePack available as a drop-in optimization if JSON becomes a bottleneck.

## Performance Targets

| Metric | Target |
|--------|--------|
| Startup to window visible | < 300ms |
| Sidecar ready | < 500ms |
| Connection establishment | < 2s |
| First result row after server responds | < 100ms |
| Object Explorer node expansion | < 300ms |

Strategy: lazy load everything, virtualize all lists, never block the UI thread, start sidecar eagerly at app launch.

---

## Milestones

Each milestone has corresponding GitHub issues tracked under a matching GitHub milestone. The workflow for each milestone is:

1. **Plan** — review this spec, refine issue details, break down complex issues further
2. **Execute** — implement using agent teams (see [Development Workflow](#development-workflow))
3. **Verify** — test against the milestone's acceptance criteria
4. **Ship** — merge to main

### Milestone 0: Project Bootstrap

**Goal**: Empty app that opens a Tauri window showing a React page with a working IPC round-trip through the C# sidecar.

| # | Issue | Labels |
|---|-------|--------|
| 1 | Initialize Tauri v2 project with React frontend | infra |
| 2 | Initialize C# sidecar solution with Native AOT | infra, sidecar |
| 3 | Sidecar stdio JSON-RPC server | sidecar |
| 4 | Tauri sidecar integration (Rust spawns C# binary) | tauri, sidecar |
| 5 | End-to-end IPC: React → Rust → C# sidecar round-trip | tauri, sidecar, ui |
| 6 | Dev workflow setup (Vite HMR + cargo tauri dev + sidecar rebuild) | infra, dx |
| 7 | Repo housekeeping (.gitignore, .editorconfig, README) | infra |
| 8 | CI pipeline (GitHub Actions) | infra |

**Verification**: `cargo tauri dev` opens a native window, click a button, see a response from the C# sidecar.

### Milestone 1: Connection Management

**Goal**: User can configure, save, and establish SQL Server connections with SQL Auth, connection strings, and Microsoft Entra MFA.

| # | Issue | Labels |
|---|-------|--------|
| 9 | ConnectionInfo model and ConnectionStore | sidecar |
| 10 | SqlConnectionFactory with SQL Auth | sidecar |
| 11 | Tauri commands + sidecar methods for connection CRUD | tauri, sidecar |
| 12 | Connection dialog UI — Properties tab | ui |
| 13 | Connection dialog UI — Connection String tab | ui |
| 14 | Connection dialog UI — Custom Properties (name, color) | ui |
| 15 | Recent connections list | ui |
| 16 | Microsoft Entra MFA via MSAL | sidecar, auth |
| 17 | OS Keychain credential storage | sidecar, security |

**Verification**: Connect to a SQL Server with SQL auth and Microsoft Entra MFA. Connections saved to disk. Reconnect from recent connections list.

### Milestone 2: Object Explorer

**Goal**: User can browse database objects in a lazy-loaded tree view.

| # | Issue | Labels |
|---|-------|--------|
| 18 | Object Explorer tree component with lazy loading | ui |
| 19 | SchemaDiscovery service in sidecar | sidecar |
| 20 | Tauri commands + sidecar methods for Object Explorer | tauri, sidecar |
| 21 | Object Explorer context menu actions | ui |
| 22 | Object Explorer connection awareness | ui |

**Verification**: Expand the tree — databases, tables, columns all load correctly. Right-click → "Script as SELECT" generates SQL.

### Milestone 3: Query Editor

**Goal**: User can write and execute SQL queries with syntax highlighting, IntelliSense, and results streaming.

| # | Issue | Labels |
|---|-------|--------|
| 23 | Monaco Editor integration (SQL mode) | ui |
| 24 | Query tab management | ui |
| 25 | QueryExecutor service in sidecar | sidecar |
| 26 | Query cancellation in sidecar | sidecar |
| 27 | Tauri commands for query execution + cancellation | tauri, sidecar |
| 28 | Keyboard shortcuts (F5, Ctrl+Shift+E, Ctrl+N) | ui |
| 29 | Query status bar | ui |
| 30 | IntelliSense (schema-aware completions) | ui, sidecar |

**Verification**: Write SQL in Monaco, press F5, see results. IntelliSense suggests table and column names. Cancel a running query.

### Milestone 4: Results Viewer

**Goal**: Display query results in a performant virtualized grid with export.

| # | Issue | Labels |
|---|-------|--------|
| 31 | Virtualized results grid | ui |
| 32 | Messages tab | ui |
| 33 | Export to CSV | ui, sidecar |
| 34 | Copy to clipboard | ui |
| 35 | Column resizing and sorting | ui |
| 36 | Multiple result set support | ui |

**Verification**: `SELECT * FROM large_table` with 100K+ rows renders smoothly. Export CSV. Copy cells to clipboard. Multiple result sets display in separate tabs.

### Milestone 5: Shell & Polish

**Goal**: The app feels cohesive, with proper layout, theming, menus, and packaging.

| # | Issue | Labels |
|---|-------|--------|
| 37 | Application layout shell (3-panel, resizable) | ui |
| 38 | Dark/light theme | ui |
| 39 | Application menu (File, Edit, Query, View) | ui |
| 40 | Window title and app icon | ui |
| 41 | Error handling and toast notifications | ui |
| 42 | Cross-platform packaging (cargo tauri build) | infra |

**Verification**: App looks cohesive. Dark/light theme works. Menus functional. `cargo tauri build` produces installable bundles on Windows, macOS, and Linux.

## Dependency Graph

```
M0 (Bootstrap)
  └─► M1 (Connections)
        ├─► M2 (Object Explorer)  ─┐
        └─► M3 (Query Editor)      ├─► M5 (Shell & Polish)
              └─► M4 (Results)    ─┘
```

M2 and M3 can be developed in parallel once M1 is complete. M5's layout shell (#37) should start early alongside M2/M3.

---

## Development Workflow

### Per-Milestone Process

Each milestone follows this cycle:

1. **Plan the milestone** — enter plan mode, review the issues in the milestone, read relevant code, design the implementation approach. Break complex issues into subtasks if needed. Produce a detailed plan file.

2. **Execute with agent teams** — use `TeamCreate` to parallelize independent work within the milestone. For example in M0, one agent can scaffold the Tauri project while another sets up the C# sidecar solution. Typical team structures:
   - **Sidecar agent** — works on C# backend issues (models, services, handlers)
   - **Tauri agent** — works on Rust IPC commands and sidecar integration
   - **UI agent** — works on React components, stores, and styling
   - **Infra agent** — works on build scripts, CI, and repo configuration

   Agents within a team work in isolated worktrees to avoid conflicts, then changes are reviewed and merged.

3. **Verify** — test the milestone's acceptance criteria end-to-end (see each milestone's verification section above).

4. **Ship** — commit, push, close the milestone's issues.

### Key Dependencies

**Rust**: tauri 2.x, serde, serde_json, tokio

**C# (NuGet)**: Microsoft.Data.SqlClient 6.x, Microsoft.Identity.Client (MSAL) 4.x, System.Text.Json

**Frontend (npm)**: react 19.x, vite 6.x, tailwindcss 4.x, @tauri-apps/api 2.x, @monaco-editor/react 4.x, @tanstack/react-table 8.x, @tanstack/react-virtual 3.x, zustand 5.x

### GitHub Labels

| Label | Scope |
|-------|-------|
| `infra` | Build, CI, project setup |
| `tauri` | Rust shell / Tauri layer |
| `sidecar` | C# backend sidecar |
| `ui` | React frontend |
| `auth` | Authentication |
| `security` | Credential storage, encryption |
| `dx` | Developer experience |
