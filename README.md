# RixMesh

<div align="center">

![RixMesh Banner](https://img.shields.io/badge/RixMesh-Multi--Agent%20Workspace-blueviolet?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-0.1.0--alpha.1-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)
![Acceptance](https://img.shields.io/badge/Acceptance%20Matrix-18%2F18%20Passed-brightgreen?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-v24%2B-green?style=for-the-badge)

**Open-source multi-agent development workspace.**  
*Create. Delegate. Review. Ship.*  
*One workspace. A whole engineering team.*  
*by Rixed*

</div>

---

## 🌟 Overview

**RixMesh** (featuring **RixMesh Studio** and **RixMesh Core**) is a local-first, multi-agent software engineering environment inspired by Google Antigravity, BMAD Method, Beads/Gas City, Archon, and OpenSpec.

Instead of monolithic conversational prompts, RixMesh provides a disciplined multi-agent control plane where specialized AI agents collaborate across isolated Git worktrees, enforced by dependency graphs, independent peer review gates, and automated test verification.

### Core Architectural Capabilities

- 🔌 **Provider-Agnostic Engine:**  
  Supports **Gemini 3.8 Flash (High)** with live reasoning `thinkingConfig`, **OpenCode**, **OpenAI Codex CLI**, **Anthropic Claude Code CLI**, and generic **ACP** agents. Provides honest status reporting (`implemented`, `tested-live`, `tested-mock`, `unavailable`).
- 🌳 **Real Git Worktree Isolation:**  
  Each active task executes in an isolated Git worktree (`refs/heads/devos/TASK-{id}`). Agents can modify code in parallel without corrupting the main branch or colliding with concurrent tasks.
- 📊 **Durable Topological DAG Scheduler:**  
  Decomposes complex specifications into a cycle-free directed acyclic graph (DAG) using Kahn's algorithm, with write-scope collision prevention.
- 🛡️ **Independent Peer Review Gate:**  
  Code produced by a developer agent is never self-evaluated. A dedicated **Code Reviewer** operates in an isolated session, evaluates the unified Git diff against acceptance criteria, and transitions defective changes to `REWORK`.
- 🔒 **Filesystem Canonicalization & Secret Redaction:**  
  Deep `fs.realpath` validation stops symlink traversal escapes. Sensitive API keys, private keys, and tokens are automatically redacted from logs, diffs, and SSE streams.
- ⚡ **Zero-Dependency Native Persistence:**  
  Built on Node 24's native `node:sqlite` engine (DatabaseSync) with Write-Ahead Logging (WAL) and automatic crash reconciliation.
- 🖥️ **RixMesh Studio Interface:**  
  Modern responsive UI featuring Kanban board, live DAG visualizer, agent monitor, providers matrix, and unified diff inspector.

---

## 👥 12 Specialized Agent Roles

Every role is defined declaratively via YAML in `roles/`:

| Role | Title | Autonomy | Responsibilities |
|---|---|---|---|
| `orchestrator` | System Orchestrator | Read-only | Workflow scheduling, dependency resolution, failure recovery |
| `product-analyst` | Product Analyst | Spec-write | User stories, requirements, acceptance criteria, OpenSpec proposals |
| `software-architect` | Software Architect | Spec-write | Component boundaries, API contracts, ADR authoring |
| `task-planner` | Task Planner | Spec-write | Task graph decomposition, dependency edges, write scopes |
| `ui-ux-designer` | UI/UX Designer | Spec-write | Interaction flows, design tokens, responsive layout specs |
| `frontend-developer` | Frontend Developer | Workspace-write | React UI components, client state, browser integration tests |
| `backend-developer` | Backend Developer | Workspace-write | REST & WebSocket APIs, SQLite schemas, domain logic, TDD |
| `qa-engineer` | QA Engineer | Test-write | Unit, integration, regression, and E2E test suites |
| `code-reviewer` | Code Reviewer | **Read-only** | Critical independent peer review of unified diff against baseline |
| `security-auditor` | Security Auditor | **Read-only** | Vulnerability scanning, secret leaks, path traversal prevention |
| `documentation-engineer` | Docs Engineer | Spec-write | README, API references, changelogs, release notes |
| `devops-engineer` | DevOps & Release | Workspace-write | CI/CD pipelines, Docker packaging, release manifests |

---

## 🔄 Task Lifecycle State Machine

```text
[DRAFT] ─► [SPECIFIED] ─► [APPROVAL_REQUIRED] ─► [READY] ─► [QUEUED] ─► [RUNNING]
                                                                            │
      ┌───────────────── [REWORK] ◄─────────────────────────────────────────┤
      │                                                                     ▼
      │                                                               [VERIFYING] (Automated Tests)
      │                                                                     │
      │                                                                     ▼
      └─────────────────────────────────────────────────────────── [REVIEW_PENDING]
                                                                            │
                                                                   (Independent Review)
                                                                            ▼
                                                                      [MERGE_READY]
                                                                            │
                                                                   (Controlled Merge)
                                                                            ▼
                                                                          [DONE]
```

---

## 🧪 Verified Acceptance Testing Matrix (18/18 PASS)

All 18 acceptance scenarios from Section 15 of the specification are fully implemented and automated in Vitest:

```bash
pnpm test
```

| ID | Check | Result | Verification Evidence |
|---|---|---|---|
| **AT-01** | Create / Open Project | **PASS** | Validates Git HEAD SHA and branch in database |
| **AT-02** | Generate Spec & DAG | **PASS** | Kahn's cycle detection and topological order |
| **AT-03** | Independent Parallel Tasks | **PASS** | Two tasks execute concurrently in separate worktrees |
| **AT-04** | Dependent Task Blocking | **PASS** | Dependent task blocked until prerequisite is DONE |
| **AT-05** | Cancel Run | **PASS** | Task cancelled, partial artifacts preserved |
| **AT-06** | Server Restart Recovery | **PASS** | Reconciles active runs into WAITING_USER without duplicates |
| **AT-07** | Failing Test Gate | **PASS** | Merge blocked on test failure |
| **AT-08** | Independent Review Reject | **PASS** | Reviewer rejects defect; transitions to REWORK |
| **AT-09** | Out-of-Scope & Traversal | **PASS** | `realpath` blocks symlink escape & directory traversal |
| **AT-10** | Dangerous Tool Approval | **PASS** | Shell commands (`rm -rf`) require human approval |
| **AT-11** | Secret Access & Redaction | **PASS** | API keys and SSH keys redacted from logs & events |
| **AT-12** | Branch Conflict Trapping | **PASS** | Conflict detected cleanly; target branch preserved |
| **AT-13** | Usage Budget Ceiling | **PASS** | Pauses in WAITING_USER when budget exceeded |
| **AT-14** | Provider Fallback | **PASS** | Friendly error with automatic fallback to available engine |
| **AT-15** | Diff Review & Safe Merge | **PASS** | Sequential merge lock prevents Git race conditions |
| **AT-16** | Docs/Knowledge In Git | **PASS** | Canonical specs and ADRs persist in repository |
| **AT-17** | Audit Event Replay | **PASS** | Monotonically ordered events replayed from SQLite |
| **AT-18** | Source Attribution | **PASS** | Upstream citations and licenses in THIRD_PARTY_NOTICES.md |

---

## 🚀 Quickstart

### Prerequisites
- Node.js `v24.x` (or later)
- `pnpm` `v10.x`
- Git `2.40+`

### 1. Installation
```bash
git clone https://github.com/rixed318/rixmesh.git
cd rixmesh
pnpm install
```

### 2. Development Mode
```bash
pnpm dev
```
Open your browser at `http://localhost:3100`.

### 3. Build & Production Daemon
```bash
pnpm build
pnpm --filter @rixed-devos/server start
```
Control plane daemon serves API and UI on `http://127.0.0.1:4100` (localhost only).

---

## 📚 Documentation Package

- [GAP Analysis](docs/audit/GAP_ANALYSIS.md)
- [Implementation Status](docs/audit/IMPLEMENTATION_STATUS.md)
- [Foundation Comparative Spike](docs/research/foundation-comparison.md)
- [Acceptance Matrix](docs/testing/ACCEPTANCE_MATRIX.md)
- [Security Threat Model](docs/security/THREAT_MODEL.md)
- [Release Readiness](docs/releases/RELEASE_READINESS.md)
- [Product Roadmap](docs/roadmap/ROADMAP.md)
- [Engineering Handoff](HANDOFF.md)
- [ADR-0001: Foundation Architecture](docs/architecture/ADR-0001-foundation.md)
- [ADR-0002: Provider Independence](docs/architecture/ADR-0002-provider-independence.md)
- [ADR-0005: Brand Identity RixMesh](docs/architecture/ADR-0005-branding-rixmesh.md)
- [ADR-0006: Desktop Application Strategy](docs/architecture/ADR-0006-desktop-strategy.md)

---

## 📜 License & Attribution

MIT License. Copyright (c) 2026 rixed318.  
See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full citations of T3 Code, Orca, Emdash, Paseo, OpenCode, and related foundational research.
