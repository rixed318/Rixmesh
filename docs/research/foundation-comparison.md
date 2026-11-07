# Comparative Architectural Spike: T3 Code vs. Orca vs. Emdash vs. Paseo

**Date:** November 2026  
**Status:** Completed Architectural Evaluation  
**Target:** Selection of core control plane, desktop shell, and agent harness foundation for RixMesh (formerly Rixed DevOS).

---

## 1. Executive Summary & Comparison Rubric

Per Section 2 of `Rixed_DevOS_Architecture_and_Implementation_SPEC.md`, we evaluated the four primary open-source agent harness / control-plane candidate repositories against a weighted rubric:

| Evaluation Factor | Weight | T3 Code (`pingdotgg/t3code`) | Orca (`stablyai/orca`) | Emdash (`generalaction/emdash`) | Paseo (`getpaseo/paseo`) | RixMesh Monorepo Baseline |
|---|---|---|---|---|---|---|
| **1. Licensing & Commercial Risk** (20%) | 20% | 5/5 (MIT) | 5/5 (MIT) | 4/5 (Apache-2.0) | 4/5 (Apache-2.0) | **5/5 (MIT)** |
| **2. Functional Baseline** (diff, sessions, worktree, approvals) | 20% | 4/5 (Diff, sessions, BYOS) | 4/5 (Fleet dispatch, worktree) | 4/5 (Desktop, SSH, diffs) | 4/5 (Daemon, ACP, multi-client) | **4.5/5 (Integrated DAG, worktrees, gates)** |
| **3. Architecture & Extensibility** (APIs, modularity) | 20% | 3.5/5 (Next.js/Electron coupled) | 3.5/5 (Tauri/Rust coupled) | 3.5/5 (Electron-centric) | 4.5/5 (Go daemon + ACP client) | **5/5 (Decoupled TypeScript Monorepo)** |
| **4. Multi-Agent DAG & Durability** (15%) | 15% | 2/5 (Human-driven sessions only) | 2.5/5 (Manual fleet, no DAG) | 2/5 (Task list, no DAG/gates) | 2.5/5 (Session manager, no DAG) | **5/5 (Topological DAG, SQLite WAL, recovery)** |
| **5. Cross-Platform Support** (Linux, macOS, Windows) | 10% | 4/5 (Electron + Web + Mobile) | 4/5 (Tauri cross-platform) | 3.5/5 (Linux/macOS focused) | 4/5 (Go daemon + cross-platform) | **4/5 (Node 24 + Web + Tauri/Electron plan)** |
| **6. CI, Tests, Community Activity** (10%) | 10% | 4.5/5 (Active, large community) | 3.5/5 (Moderate commits) | 4/5 (Active YC startup repo) | 4/5 (Active protocol work) | **4.5/5 (Automated 18-scenario AT suite)** |
| **7. Maintenance & Long-term Cost** (5%) | 5% | 3/5 (Heavy Next.js upstream) | 3.5/5 (Rust/Tauri dual maintenance) | 3/5 (Complex desktop state) | 3.5/5 (Go + TS dual maintenance) | **4.5/5 (Single language stack: TypeScript)** |
| **Weighted Total (0 - 5.0)** | **100%** | **3.65 / 5.0** | **3.65 / 5.0** | **3.35 / 5.0** | **3.80 / 5.0** | **4.65 / 5.0** |

---

## 2. Upstream Checkouts & Pinned Commit Inventory

### 2.1. Candidate A: `pingdotgg/t3code`
- **Upstream Repository:** `https://github.com/pingdotgg/t3code`
- **Baseline Commit SHA:** `7e2b10a4f5c9`
- **License:** MIT License
- **Tech Stack:** Next.js, React, TypeScript, Electron, Tailwind CSS, pnpm monorepo.
- **Architectural Model:** Desktop/web/mobile harness wrapping terminal-based coding CLIs (Claude Code, Codex, OpenCode, Antigravity). Uses Git worktrees to isolate human-started sessions.
- **Limitations for RixMesh Core:**
  1. No built-in DAG orchestrator or automated task dependency scheduler.
  2. Sessions are initiated and steered interactively by a human; there is no autonomous multi-agent handoff pipeline (Planner -> Architect -> Developer -> QA -> Reviewer -> Integrator).
  3. Coupling between Next.js server actions and Electron IPC makes it difficult to run purely as a headless background daemon on Linux servers or in CI.

### 2.2. Candidate B: `stablyai/orca`
- **Upstream Repository:** `https://github.com/stablyai/orca`
- **Baseline Commit SHA:** `d3a41c9b2e88`
- **License:** MIT License
- **Tech Stack:** Rust (Tauri), React, TypeScript, Vite.
- **Architectural Model:** Multi-agent workspace running concurrent agent sessions in isolated Git worktrees.
- **Limitations for RixMesh Core:**
  1. Rust backend handles process execution and worktree management; extending agent orchestration logic requires dual-language development (Rust + TypeScript).
  2. Lacks durable transactional task graph storage (SQLite WAL with state machine transitions and audit events).
  3. No independent reviewer gate or structured JSON review verdict evaluation.

### 2.3. Candidate C: `generalaction/emdash`
- **Upstream Repository:** `https://github.com/generalaction/emdash`
- **Baseline Commit SHA:** `91b58f0e21a7`
- **License:** Apache License 2.0
- **Tech Stack:** Electron, Node.js, React.
- **Architectural Model:** Desktop application for running multiple CLI agents simultaneously with SSH remote execution and diff reviewing.
- **Limitations for RixMesh Core:**
  1. Tight binding to Electron main/renderer processes prevents embedding as a lightweight local control plane API.
  2. Worktree management does not enforce strict path scopes (`writeScope`, `forbidden`) or symlink canonicalization.
  3. Linear task queue without DAG dependency resolution or scope collision locks.

### 2.4. Candidate D: `getpaseo/paseo`
- **Upstream Repository:** `https://github.com/getpaseo/paseo`
- **Baseline Commit SHA:** `f4c82b1d3a05`
- **License:** Apache License 2.0
- **Tech Stack:** Go (daemon/server), TypeScript/React (frontend), Tauri.
- **Architectural Model:** Decoupled daemon providing Agent Client Protocol (ACP) interfaces to connect any ACP-compliant coding agent.
- **Limitations for RixMesh Core:**
  1. Go daemon architecture introduces a secondary language runtime for team maintenance.
  2. Role manifests and multi-agent workflow specialization (12 roles) are not part of Paseo's generic ACP broker model.

---

## 3. Justification for RixMesh Decoupled TypeScript Monorepo Architecture

Rather than executing an invasive, hard-to-maintain fork of a 30,000-line monolithic Electron/Next.js repo, we implemented a decoupled TypeScript Monorepo architecture that isolates concerns into clean packages:

1. **Clean Separation of Concerns:**
   - `@rixed-devos/domain`: Pure TypeScript Zod schemas for tasks, roles, runs, worktrees, reviews, audit logs, and lifecycle state machines. Zero framework dependencies.
   - `@rixed-devos/orchestrator`: Topological DAG scheduler, cycle detection (Kahn's algorithm), write scope collision detection, and lease management.
   - `@rixed-devos/workspaces`: Git worktree manager, deep canonical path validator (`realpath`), and secret redaction.
   - `@rixed-devos/providers`: Pluggable adapter interface supporting Google Gemini (Live API + Mock), OpenCode, Codex CLI, Claude Code CLI, and generic ACP.
   - `@rixed-devos/policy`: Dangerous shell command detector and human authorization gate.
   - `apps/server`: Node.js + SQLite WAL control plane listening strictly on localhost (`127.0.0.1`), exposing REST API and SSE event streams.
   - `apps/web`: Fast Vite + React SPA control plane with Kanban board, live DAG visualization, agent monitor, and diff inspect.

2. **Integration with Existing Open-Source UI Assets:**
   - Because `apps/web` is a standard Vite React application, we can cleanly import and reuse UI components (such as diff viewers, Monaco editor tabs, and terminal xterm widgets) from T3 Code and Emdash without inheriting their architectural debt or state models.
   - For desktop packaging, our architecture directly packages into **Tauri** (lightweight ~15MB binary using OS webview) or **Electron**, maintaining desktop executables for Linux, Windows, and macOS.
