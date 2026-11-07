# Implementation Status & Subsystem Inventory

**Platform:** RixMesh (RixMesh Studio / Core)  
**Version:** `0.1.0-alpha.1` (Development Baseline)  
**Date:** November 2026  
**Test Suite:** 33 tests passing across 6 test suites (`pnpm test`)

---

## 1. Subsystem Implementation Matrix

| Subsystem | Package / Path | Status | Live / Mock Status | Evidence & Test File |
|---|---|---|---|---|
| **Domain Schemas & State Machine** | `packages/domain/src/index.ts` | **Implemented** | Pure domain logic | `tests/unit/domain.test.ts` (State transitions, schema validations) |
| **Topological DAG Scheduler** | `packages/orchestrator/src/dag-scheduler.ts` | **Implemented** | Pure algorithm | `tests/unit/dag-scheduler.test.ts` (Kahn's cycle detection, scope collision, top-sort) |
| **Git Worktree Isolation** | `packages/workspaces/src/worktree-manager.ts` | **Implemented** | Real Git CLI execution | `tests/integration/worktree.test.ts`, `[AT-03]` (Isolated directories and branches) |
| **Path & Symlink Validator** | `packages/workspaces/src/path-validator.ts` | **Implemented** | Real filesystem canonicalization (`realpath`) | `tests/unit/path-validator.test.ts`, `[AT-09]` (Symlink escape & traversal checks) |
| **Secret Redactor Engine** | `packages/workspaces/src/secret-redactor.ts` | **Implemented** | Regex sanitization | `[AT-11]` (Redacts Google, OpenAI, GitHub tokens & private keys) |
| **Google Gemini Provider** | `packages/providers/src/gemini-provider.ts` | **Implemented** | Live API (when key present) + Honest Mock Fallback | `tests/integration/gemini-provider.test.ts` (ThinkingConfig, probe, execution) |
| **OpenCode CLI Adapter** | `packages/providers/src/opencode-provider.ts` | **Implemented** | Probe: Real CLI detection; Execution: Stub | `[AT-14]` (System probe detection of `opencode`) |
| **Codex CLI Adapter** | `packages/providers/src/codex-provider.ts` | **Implemented** | Probe: Real CLI detection; Execution: Stub | `[AT-14]` (System probe detection of `codex`) |
| **Claude Code CLI Adapter** | `packages/providers/src/claude-provider.ts` | **Implemented** | Probe: Real CLI detection; Execution: Stub | `[AT-14]` (System probe detection of `claude`) |
| **Mock Provider** | `packages/providers/src/mock-provider.ts` | **Implemented** | Fully deterministic mock | `[AT-03]`, `[AT-04]`, `[AT-07]`, `[AT-08]`, `[AT-13]` (Simulates defect, budget, test failure) |
| **Provider Registry & Fallbacks** | `packages/providers/src/registry.ts` | **Implemented** | In-memory registry with safe fallback | `[AT-14]` (Safe resolution with fallback diagnostics) |
| **Policy Engine & Command Approvals** | `packages/policy/src/policy-engine.ts` | **Implemented** | Rule evaluation | `[AT-10]` (Identifies dangerous shell commands requiring human approval) |
| **Artifact Store** | `packages/artifacts/src/artifact-store.ts` | **Implemented** | Real filesystem persistence | `[AT-05]`, `[AT-15]` (Saves patch diffs, test logs, metadata) |
| **SQLite WAL Control Plane DB** | `apps/server/src/db/database.ts` | **Implemented** | Native Node.js `sqlite` (DatabaseSync) | `[AT-01]`, `[AT-06]`, `[AT-17]` (Schema migrations, indexes, event replay) |
| **Multi-Agent Execution Service** | `apps/server/src/services/execution-service.ts` | **Implemented** | Real orchestrator with concurrency & gates | `[AT-03]`, `[AT-04]`, `[AT-08]`, `[AT-12]` (Parallel execution, independent review, merge queue) |
| **Localhost Control Plane Daemon** | `apps/server/src/server.ts`, `src/index.ts` | **Implemented** | Express REST API + SSE events, `127.0.0.1` | `apps/server/dist/server.js` |
| **Web Control Plane (SPA)** | `apps/web/src/App.tsx` | **Implemented** | React 19 + Tailwind + Vite | `apps/web/dist` (Kanban, DAG viewer, Agent monitor, Providers) |
| **Desktop Application Shell** | `docs/architecture/ADR-0006-desktop-strategy.md` | **Design / Prototype Phase** | Tauri 2.0 / Electron target | Packaging roadmap documented for Linux, Windows, macOS |

---

## 2. Verified Capabilities Breakdown

### Real Multi-Agent Workflow
1. **Parallel Worktree Execution (`[AT-03]`):**
   - Verified that two independent developer tasks run simultaneously.
   - Each task runs in its own directory `.devos/worktrees/task-{id}-{runId}` and branch `devos/TASK-{taskId}`.
2. **Dependent Task Enforcement (`[AT-04]`):**
   - Verified that tasks with `dependsOnTaskIds` throw an error and refuse to execute until all prerequisites are in `DONE` status.
3. **Independent Peer Review (`[AT-08]`):**
   - Verified that code review runs in a separate session from the developer.
   - If defects or unfulfilled criteria are detected, reviewer issues `request_changes`, transitioning task to `REWORK` and blocking merge.
4. **Sequential Merge Queue (`[AT-12]`, `[AT-15]`):**
   - Verified that branch merges are serialized via `mergeLock` mutex.
   - Merge conflicts are cleanly trapped, aborting merge without corrupting `main`, and transitioning task to `BLOCKED`.
5. **Durable Crash Recovery (`[AT-06]`):**
   - Verified that tasks active when a server crashes are cleanly transitioned to `WAITING_USER` upon server startup, avoiding orphaned ghost runs.

---

## 3. Known Limitations & Open Items for Subsequent Releases

1. **External CLI Execution:**
   - While `GeminiProvider` supports live API calls via Google Generative AI REST endpoints, `CodexProvider`, `ClaudeProvider`, and `OpenCodeProvider` currently implement probe detection of their respective CLIs on PATH, but require additional ACP/CLI pipe binding for full interactive subagent execution.
2. **Desktop Shell Binary:**
   - The current build produces a web control plane + Node.js backend. Packaging as a self-contained `.AppImage` (Linux), `.exe` installer (Windows), and `.dmg` (macOS) is planned via Tauri in v0.1.0-alpha.2.
3. **Multi-User / Remote Mode:**
   - Current release is strictly single-user, local-first, binding to `127.0.0.1`. Remote access with mutual TLS and bearer token authentication is deferred to post-MVP.
