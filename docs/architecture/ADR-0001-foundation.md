# ADR-0001: System Foundation & Multi-Package Architecture

## Status
Accepted

## Context
Rixed DevOS requires a unified local-first control plane for multi-agent software engineering. The platform coordinates multiple autonomous coding agents with specialized roles, isolated Git worktrees, and strict quality gates.
Previous candidates evaluated in the architectural spike:
1. **T3 Code** (pingdotgg/t3code) — MIT. Clean React/TypeScript control-plane model.
2. **Orca** (stablyai/orca) — MIT. Parallel worktree execution and subagent management.
3. **Emdash** (generalaction/emdash) — Apache-2.0. Desktop orchestration.
4. **Paseo** (getpaseo/paseo) — Apache-2.0. ACP provider daemon model.

## Decision
We adopt a clean, decoupled **TypeScript Monorepo Architecture** managed via `pnpm`:
- **Core Domain (`packages/domain`)**: Typed schemas (Zod) for tasks, roles, runs, worktrees, reviews, audit logs, and lifecycle state machines.
- **Task DAG Orchestrator (`packages/orchestrator`)**: Deterministic topological scheduler with lease management, heartbeats, and recovery.
- **Git Workspaces (`packages/workspaces`)**: Dedicated Git worktree manager isolating each task run in `refs/heads/devos/TASK-{id}`.
- **Provider Adapters (`packages/providers`)**: Native adapter layer featuring **Gemini 3.8 Flash (High)** as primary engine, alongside OpenCode, Codex CLI, Claude Code CLI, and generic ACP/MCP adapters.
- **Local Control Plane Daemon (`apps/server`)**: SQLite database with write-ahead logging (WAL), REST API, Server-Sent Events (SSE) / WebSocket streaming.
- **Web Control Plane (`apps/web`)**: Fast, responsive React SPA with Kanban, interactive DAG graph, live logs, and unified diff viewer.

## Consequences
- **Positive**: Single-language stack (TypeScript) across backend and frontend, full type safety, zero external database dependencies for single-user local operation, clear separation of concerns.
- **Negative**: Native Git operations require proper subprocess handling and cleanup across Linux/macOS/WSL2.
