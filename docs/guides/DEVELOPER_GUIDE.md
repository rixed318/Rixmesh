# RixMesh Developer & Engineering Manual

> **Scope:** Setup, Architecture, Workflows, Provider Integration, and Troubleshooting  
> **Audience:** Contributors, Platform Engineers, System Integrators

---

## 1. Quickstart

### Prerequisites
- **Node.js:** `v24.x` or later (Native `node:sqlite` required)
- **Package Manager:** `pnpm` `v10.x`
- **Git:** `v2.40+`
- **Recommended Model CLI:** `agy` CLI (Google Antigravity with Gemini 3.8 Flash High subscription) or `codex` / `claude`

### Installation & Launch
```bash
# 1. Clone repository
git clone https://github.com/rixed318/Rixmesh.git
cd Rixmesh

# 2. Install dependencies (verified frozen lockfile)
pnpm install --frozen-lockfile

# 3. Build monorepo packages and UI
pnpm build

# 4. Start RixMesh Studio
pnpm start
# Alternatively: ./bin/rixmesh.js start
```

When started, RixMesh:
1. Launches the unified control plane at `http://127.0.0.1:4100`.
2. Serves the pre-compiled React 19 UI directly from port 4100.
3. Automatically opens your default browser in application mode.

For live frontend/backend development with hot-reloading:
```bash
pnpm dev
# Vite runs at http://localhost:3100
# Backend runs at http://127.0.0.1:4100 with tsx watch
```

---

## 2. Monorepo Organization

```
Rixmesh/
├── apps/
│   ├── server/             # Express + SSE + SQLite Control Plane Daemon
│   │   ├── src/db/         # Database initialization, WAL pragmas, schema migrations
│   │   ├── src/services/   # TaskService, ProjectService, RoleService, ExecutionService
│   │   └── src/server.ts   # Express REST endpoints, Host validation, Static UI router
│   └── web/                # React 19 + Tailwind CSS + Vite Frontend
│       ├── src/components/ # KanbanBoard, DAGVisualizer, AgentMonitor, CodeEditorTab, TaskModals
│       └── src/App.tsx     # Main application state and tab router
├── bin/
│   └── rixmesh.js          # Cross-platform CLI runner and application launcher
├── packages/
│   ├── domain/             # Shared TypeScript schemas, types, and Zod validators
│   ├── orchestrator/       # DAG Scheduler (Kahn's algorithm), LeaseManager, Lock utilities
│   ├── workspaces/         # GitWorktreeManager, PathScopeValidator, SecretRedactor
│   ├── providers/          # Gemini 3.8 Flash High (agy), Codex, Claude, OpenCode adapters
│   ├── policy/             # PolicyEngine (Role permissions & tool approval evaluator)
│   └── artifacts/          # ArtifactStore (Diff patches, test logs, code review records)
├── roles/                  # Declarative Agent Role definitions (YAML)
├── tests/
│   ├── unit/               # Domain validation, DAG scheduler, path validator tests
│   ├── integration/        # Git worktree lifecycle, provider probing tests
│   ├── acceptance/         # AT-01 to AT-18 specification compliance suite
│   └── e2e/                # Multi-agent end-to-end workflow runner (e2e-runner.ts)
└── docs/                   # Architectural decisions (ADRs), threat model, research
```

---

## 3. Testing & Quality Verification

RixMesh uses a multi-tier testing pipeline to guarantee system stability and prevent regressions:

### 3.1 Unit & Acceptance Matrix (AT-01 through AT-18)
```bash
pnpm test
```
Executes 33 automated tests across 6 suites in ~1.5s:
- `tests/acceptance/acceptance-matrix.test.ts`: Verifies all 18 requirements from Section 15 of the specification (worktree isolation, review gates, budget caps, traversal protection, audit sequence).
- `tests/integration/worktree.test.ts`: Verifies physical Git worktree creation, branch isolation, and cleanup.
- `tests/integration/gemini-provider.test.ts`: Probes local `agy` CLI capabilities and streaming token reporting.
- `tests/unit/dag-scheduler.test.ts`: Tests topological sorting, cycle detection, and parallel batch grouping.
- `tests/unit/path-validator.test.ts`: Tests symlink resolution, escape traps, and forbidden pattern detection.
- `tests/unit/domain.test.ts`: Tests Zod schema parsing and role metadata validation.

### 3.2 End-to-End Multi-Agent Workflow Test
```bash
pnpm test:e2e
# or: ./bin/rixmesh.js e2e
```
Executes a live multi-agent DAG workflow:
1. Initializes a temporary Git test repository with an initial commit.
2. Creates a DAG with two parallel independent tasks (Task A: Auth API, Task B: Notification API) and one dependent task (Task C: Consolidated UI).
3. Concurrently runs Tasks A and B in isolated Git worktrees using **Gemini 3.8 Flash High**.
4. Verifies automated tests and peer reviews for each worktree.
5. Acquires sequential merge locks and merges A and B into `main`.
6. Executes Task C once dependencies are satisfied, verifies, and merges into `main`.

---

## 4. Working with Agent Roles

Every agent role is defined as a declarative YAML file in `roles/`.

### Anatomy of a Role (`roles/<role-id>.yaml`)
```yaml
apiVersion: devos/v1
kind: AgentRole
metadata:
  name: backend-developer
  version: "1.0.0"
  title: "Backend Developer"
spec:
  purpose: "Implement server-side logic, SQLite schemas, REST APIs, and unit tests"
  compatibleProviders: [gemini, codex, claude, opencode]
  modelPolicy:
    tier: high
    preferredModel: "gemini-3.8-flash-high"
    allowFallback: true
  autonomy: workspace-write
  limits:
    maxConcurrentTasks: 2
    maxAttempts: 3
    wallClockMinutes: 30
    estimatedBudgetUsd: 1.50
  permissions:
    read: ["**/*"]
    write: ["apps/server/**", "packages/**", "tests/**"]
    forbidden: [".env*", "secrets/**", ".git/**"]
    tools: [file-read, file-write, test-run, git-status, git-diff]
    network: denied
    approvalRequired: [git-push, git-merge]
  review:
    requireIndependentReviewer: true
    requireAutomatedTests: true
```

### Adding a New Role
1. Create a new YAML file in `roles/my-new-role.yaml`.
2. Define `permissions.write` with precise glob scopes to avoid accidental overwrites.
3. Configure `review.requireIndependentReviewer` (`true` for code-generating roles, `false` for read-only or planner roles).
4. Reload roles: the `RoleService` automatically parses and validates the role on server boot.

---

## 5. Integrating Custom Model Adapters

To add a new LLM provider:
1. Create a new adapter file in `packages/providers/src/my-custom-provider.ts` implementing `CodingAgentAdapter`:
   ```typescript
   import { CodingAgentAdapter, ProviderProbeResult, AgentSession, AgentEvent } from './adapter-interface.js';

   export class MyCustomProvider implements CodingAgentAdapter {
     public readonly id = 'my-provider';

     public async probe(): Promise<ProviderProbeResult> {
       // Check binary availability or API credentials
       return { available: true, status: 'implemented', models: ['custom-model-v1'] };
     }

     public async createSession(input: AgentSessionInput): Promise<AgentSession> { ... }
     public async *send(session: AgentSession): AsyncIterable<AgentEvent> { ... }
     public async cancel(sessionId: string): Promise<void> { ... }
     public async close(sessionId: string): Promise<void> { ... }
   }
   ```
2. Register the adapter in `packages/providers/src/registry.ts`:
   ```typescript
   this.registerAdapter(new MyCustomProvider());
   ```
3. Run `pnpm --filter @rixed-devos/providers build` and `pnpm test`.

---

## 6. CLI Reference (`bin/rixmesh.js`)

| Command | Description |
|---|---|
| `rixmesh start` | Compiles web assets if needed, boots the server on port 4100, and opens RixMesh Studio in application mode. |
| `rixmesh dev` | Launches Vite hot-reloading (port 3100) and Express server in watch mode (port 4100). |
| `rixmesh status` | Probes all registered LLM providers, reports availability reasons, and tests database connectivity. |
| `rixmesh test` | Executes the Vitest test runner across all unit and acceptance suites. |
| `rixmesh e2e` | Executes the end-to-end multi-agent verification workflow. |
| `rixmesh help` | Displays available CLI commands and environment flags. |

### Environment Variables
- `PORT`: Server port (default: `4100`).
- `DEVOS_HOST`: Host bind address (default: `127.0.0.1` for local-only safety).
- `DEVOS_DB_PATH`: Custom SQLite database path.
- `DEVOS_DATA_DIR`: Custom worktrees and artifacts storage root.

---

## 7. Troubleshooting & FAQs

### Q: Browser shows `Cannot GET /` on `http://127.0.0.1:4100`
**Cause:** In older versions, Express looked for `apps/web/dist` relative to `process.cwd()`.  
**Resolution:** Resolved in `v0.1.0-alpha.1`. The server dynamically locates `web/dist` across the monorepo hierarchy and serves it directly. If running from source before building, run `pnpm build` or access Vite directly at `http://localhost:3100`.

### Q: Task fails with "Permission Denied: Path does not match allowed write scopes"
**Cause:** The agent attempted to create or edit a file outside the `write` globs defined in its role YAML (e.g., a `backend-developer` attempting to write to `apps/web/`).  
**Resolution:** Verify `specPath` and ensure the task's assigned role has appropriate write permissions in `roles/<role-id>.yaml`.

### Q: Git worktree lock or "fatal: 'devos/TASK-xxx' already exists"
**Cause:** An aborted process left an unpruned Git worktree or branch.  
**Resolution:** Run `git worktree prune` in the target repository, or delete the stale branch: `git branch -D devos/TASK-xxx`.

