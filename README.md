# RixMesh

<div align="center">

![RixMesh Banner](https://img.shields.io/badge/RixMesh-Multi--Agent%20Workspace-blueviolet?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-0.1.0--alpha.1-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)
![Acceptance Matrix](https://img.shields.io/badge/Acceptance%20Matrix-18%2F18%20Passed-brightgreen?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-v24%2B-green?style=for-the-badge)

**Local-first multi-agent software engineering operating system & control plane.**  
*Create. Decompose. Delegate. Review. Ship.*  
*One workspace. An entire engineering organization.*  
*Built by [rixed318](https://github.com/rixed318)*

</div>

---

## 🌟 Overview

**RixMesh** is an open-source, local-first multi-agent development environment inspired by Google Antigravity, the BMAD Method, Beads/Gas City, Archon, and OpenSpec.

Instead of unreliable monolithic prompt chains, RixMesh provides a deterministic engineering control plane where 12 specialized AI agents collaborate across isolated Git worktrees, enforced by topological dependency graphs (DAG), automated verification suites, and independent peer reviews.

```
       [Product Analyst] ──► [Software Architect] ──► [Task Planner]
                                                             │ (DAG Decomposition)
                                                             ▼
                                                [Parallel Git Worktrees]
                                               ┌─────────────┴─────────────┐
                                               ▼                           ▼
                                      [Frontend Developer]        [Backend Developer]
                                               │                           │
                                               ▼                           ▼
                                      [Automated Tests]           [Automated Tests]
                                               │                           │
                                               ▼                           ▼
                                      [Independent Review]        [Independent Review]
                                               └─────────────┬─────────────┘
                                                             ▼
                                                    [Controlled Merge]
                                                             ▼
                                                        [Mainline]
```

---

## ⚡ Key Architectural Capabilities

- 🌳 **Physical Git Worktree Isolation:**  
  Every active task executes inside an isolated Git worktree (`refs/heads/devos/TASK-{id}`). Agents can modify files in parallel without corrupting the working copy or colliding with concurrent runs.
- 📊 **Topological DAG Scheduler:**  
  Decomposes initiatives into a cycle-free directed acyclic graph using Kahn’s algorithm. Tasks with independent write scopes run concurrently; tasks with shared scopes or prerequisites are strictly ordered.
- 🛡️ **Mandatory Quality Gates & Independent Review:**  
  Developer agents never self-evaluate. Changes must pass automated tests in the worktree (`test.log` recorded) and receive a formal positive verdict (`verdict === 'approved'`) from a separate, read-only **Code Reviewer** agent before merge locks can be acquired.
- 🧠 **Authentic Model Runtime (Gemini 3.8 Flash High):**  
  Communicates with local AI subscriptions via CLI subprocess (`agy` CLI with `--model gemini-3.8-flash-high --effort high`). Supports real streaming events, reasoning tokens, and live usage cost tracking. Also features native adapters for **OpenAI Codex CLI**, **Anthropic Claude Code**, and **OpenCode**.
- 🚫 **No Silent Mocking:**  
  `MockProvider` is forbidden in user mode. Missing or unconfigured engines produce immediate actionable errors, never fabricated simulations.
- 🔒 **Defense-in-Depth Security:**  
  Enforces `fs.realpath` path canonicalization to block symlink escapes, scrubs API keys and secrets via regex redactor, restricts HTTP access to localhost (`127.0.0.1`) to neutralize DNS rebinding, and enforces role-based tool policies.
- ⚡ **Zero-Dependency Native Persistence:**  
  Built on Node 24’s native `node:sqlite` (`DatabaseSync`) in Write-Ahead Logging (WAL) mode with durable sequential audit IDs across restarts.
- 🖥️ **RixMesh Studio:**  
  Full-featured React 19 web application with Kanban Board, live DAG Visualizer, Agent Monitor, Provider Status Dashboard, and a built-in Unified Git Diff Inspector.

---

## 🚀 Quickstart

### Prerequisites
- **Node.js** `v24.x` or later (Native `node:sqlite` required)
- **pnpm** `v10.x`
- **Git** `2.40+`
- **Model Engine:** `agy` CLI (Google Antigravity with Gemini 3.8 Flash High subscription), `codex`, or `claude`

### 1. Clone & Install
```bash
git clone https://github.com/rixed318/Rixmesh.git
cd Rixmesh
pnpm install --frozen-lockfile
```

### 2. Build & Launch Application
```bash
# Compile monorepo packages and web UI
pnpm build

# Start RixMesh Studio (serves UI + API and opens browser window)
pnpm start
```
*RixMesh Studio opens at `http://127.0.0.1:4100` in standalone application mode.*

### 3. Development Mode (with Live Hot-Reloading)
```bash
pnpm dev
```
- **Vite Web UI:** `http://localhost:3100` (live hot module reloading)
- **Control Plane API:** `http://127.0.0.1:4100` (watch mode via tsx)

---

## 💻 CLI Commands (`bin/rixmesh.js`)

You can run the RixMesh CLI directly or via `pnpm`:

```bash
# Check status of configured model engines, CLI tools, and SQLite database
./bin/rixmesh.js status

# Run all 33 unit and acceptance tests
./bin/rixmesh.js test

# Run the live multi-agent E2E workflow with Gemini 3.8 Flash High
./bin/rixmesh.js e2e

# Display help and options
./bin/rixmesh.js help
```

---

## 👥 12 Specialized Agent Roles

Every role is defined declaratively in `roles/<role>.yaml`:

| Role ID | Role Title | Autonomy | Responsibilities |
|---|---|---|---|
| `orchestrator` | System Orchestrator | Read-only | Workflow dispatching, dependency resolution, failure recovery |
| `product-analyst` | Product Analyst | Spec-write | User stories, requirements, acceptance criteria, OpenSpec proposals |
| `software-architect` | Software Architect | Spec-write | Component boundaries, API contracts, architectural decision records (ADRs) |
| `task-planner` | Task Planner | Spec-write | DAG task breakdown, dependency edges, write scope definition |
| `ui-ux-designer` | UI/UX Designer | Spec-write | Layout specs, design tokens, interaction flows |
| `frontend-developer` | Frontend Developer | Workspace-write | React components, state management, UI integration tests |
| `backend-developer` | Backend Developer | Workspace-write | REST/WebSocket endpoints, SQLite schemas, domain logic, unit tests |
| `qa-engineer` | QA Engineer | Test-write | Unit, integration, regression, and E2E test suites |
| `code-reviewer` | Code Reviewer | **Read-only** | Critical independent peer review of unified diffs against baseline |
| `security-auditor` | Security Auditor | **Read-only** | Vulnerability scanning, secret leakage detection, path validation |
| `documentation-engineer` | Docs Engineer | Spec-write | README, API references, changelogs, architecture manuals |
| `devops-engineer` | DevOps Engineer | Workspace-write | CI/CD pipelines, package bundlers, release manifests |

---

## 🧪 Acceptance Testing Matrix (18/18 PASS)

All 18 acceptance scenarios from the engineering specification are automated and pass in CI:

```bash
pnpm test
```

| Scenario ID | Test Name | Result | Verification Evidence |
|---|---|---|---|
| **AT-01** | Create / Open Project | **PASS** | Validates Git HEAD SHA, default branch, and database record |
| **AT-02** | Generate Spec & DAG | **PASS** | Kahn's cycle detection and topological batching verified |
| **AT-03** | Parallel Independent Tasks | **PASS** | Concurrent execution of two tasks in disjoint Git worktrees |
| **AT-04** | Dependent Task Blocking | **PASS** | Child task blocked until all parent tasks reach `DONE` |
| **AT-05** | Cancel Run Lifecycle | **PASS** | Aborts running subprocess; preserves partial artifacts |
| **AT-06** | Server Restart Recovery | **PASS** | Reconciles active runs into `WAITING_USER` without duplicates |
| **AT-07** | Failing Test Gate | **PASS** | Blocks merge when automated tests in worktree exit non-zero |
| **AT-08** | Independent Review Reject | **PASS** | Reviewer rejects defect; transitions task to `REWORK` |
| **AT-09** | Out-of-Scope & Traversal | **PASS** | `fs.realpath` traps directory traversal and symlink escapes |
| **AT-10** | Dangerous Tool Approval | **PASS** | Privileged actions (`rm -rf`) require explicit human approval |
| **AT-11** | Secret Leak Redaction | **PASS** | AWS, GitHub, GCP, JWT, and SSH keys redacted from logs |
| **AT-12** | Branch Conflict Trapping | **PASS** | Conflict detected cleanly; working branch preserved |
| **AT-13** | Usage Budget Ceiling | **PASS** | Pauses execution when task dollar ceiling is exceeded |
| **AT-14** | Provider Selection & Error | **PASS** | Actionable error when engine unavailable; no silent mock |
| **AT-15** | Diff Review & Safe Merge | **PASS** | Sequential merge lock prevents Git race conditions |
| **AT-16** | Git-Persisted Artifacts | **PASS** | Specifications and ADRs persist in Git repository |
| **AT-17** | Audit Event Replay | **PASS** | Monotonically ordered audit events replayed from SQLite |
| **AT-18** | Source Attribution | **PASS** | Upstream citations and licenses in `THIRD_PARTY_NOTICES.md` |

---

## 📚 Technical Documentation Package

- 🏛️ **[System Architecture Specification](docs/architecture/ARCHITECTURE.md)** — In-depth architectural design, sequence diagrams, concurrency models, and security defenses.
- 📖 **[Developer & Engineering Manual](docs/guides/DEVELOPER_GUIDE.md)** — Step-by-step developer guide, CLI documentation, role creation, and adapter guides.
- 🔬 **[Foundation Comparative Analysis](docs/research/foundation-comparison.md)** — Empirical evaluation of T3 Code, Orca, Emdash, and Paseo with authentic pinned SHAs.
- 🛡️ **[Security Threat Model](docs/security/THREAT_MODEL.md)** — STRIDE analysis, attack surface taxonomy, and mitigation proofs.
- 📋 **[Acceptance Testing Matrix](docs/testing/ACCEPTANCE_MATRIX.md)** — Traceability matrix covering AT-01 through AT-18.
- 📈 **[Release Readiness Plan](docs/releases/RELEASE_READINESS.md)** — Release checklist and packaging specifications.
- 🗺️ **[Product Roadmap](docs/roadmap/ROADMAP.md)** — Upcoming milestones (Tauri desktop packaging, remote workers).

---

## 📜 License & Attribution

Distributed under the **MIT License**. Copyright (c) 2026 **rixed318**.  
See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full notices and upstream citations.
