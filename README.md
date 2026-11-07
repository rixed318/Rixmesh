# Rixed DevOS

<div align="center">

![Rixed DevOS Banner](https://img.shields.io/badge/Rixed%20DevOS-Multi--Agent%20Engineering%20OS-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-v24%2B-green?style=for-the-badge)
![Primary AI](https://img.shields.io/badge/Primary%20AI-Gemini%203.8%20Flash%20(High)-purple?style=for-the-badge)

**A local-first multi-agent software engineering operating system and control plane.**  
Inspired by Google Antigravity, BMAD Method, Beads/Gas City, Archon, and OpenSpec.

</div>

---

## 🌟 Overview

**Rixed DevOS** replaces chaotic monolithic LLM chat prompts with an organized, disciplined team of autonomous coding agents. Each agent operates with a defined role, strict permissions, isolated Git worktree runtime, and multi-tier quality gates.

### Core Architecture Highlights

- 🧠 **Primary Brain: Gemini 3.8 Flash (High)**  
  High-speed reasoning, massive multi-token context window, and tool orchestration. Also supports OpenAI Codex CLI, Anthropic Claude Code CLI, and OpenCode.
- 🌳 **Git Worktree Isolation**  
  Every task executes in an isolated Git worktree (`refs/heads/devos/TASK-{id}`). Agents cannot corrupt the main workspace or overwrite each other's work.
- 📊 **Deterministic Task DAG Orchestrator**  
  Complex user goals decompose into a directed acyclic graph (DAG) of dependency-linked tasks with lease management and automatic recovery.
- 🛡️ **Independent Peer Review Gate**  
  Code produced by developer agents is never self-evaluated. A dedicated **Code Reviewer Agent** independently analyzes the unified Git diff and test logs against acceptance criteria.
- ⚡ **Zero-Dependency Native Persistence**  
  Utilizes Node 24's built-in `node:sqlite` engine with Write-Ahead Logging (WAL) and atomic transactions.
- 🖥️ **Interactive Control Plane UI**  
  Responsive React 19 dashboard featuring Kanban boards, DAG dependency visualizer, live terminal log streaming, and unified diff reviewer.

---

## 👥 12 Specialized Agent Roles

Every role has a YAML manifest in `roles/`:

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

## 🚀 Quickstart

### Prerequisites
- Node.js `v24.x` (or later)
- `pnpm` `v10.x`
- Git `2.40+`

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/rixed318/rixed-devos.git
cd rixed-devos

# Install workspace dependencies
pnpm install
```

### 2. Development Mode
```bash
# Runs backend server (port 4100) and frontend UI (port 3100) in parallel
pnpm dev
```
Open your browser at `http://localhost:3100`.

### 3. Build & Production
```bash
# Build all packages and the web UI
pnpm build

# Start the standalone server
pnpm --filter @rixed-devos/server start
```
The server serves both the REST API and the compiled Web UI from `http://localhost:4100`.

---

## 🧪 Testing

```bash
# Run unit and integration tests (Vitest)
pnpm test

# Run End-to-End Acceptance Suite (Section 15 matrix)
pnpm test:e2e
```

---

## 📁 Repository Structure

```text
rixed-devos/
├── apps/
│   ├── server/           # Fastify/Express Control Plane with native SQLite
│   └── web/              # React 19 + Tailwind CSS + Lucide Dashboard
├── packages/
│   ├── domain/           # Zod schemas, TypeScript types, state machine
│   ├── orchestrator/     # DAG scheduler, topological resolver, leases
│   ├── workspaces/       # Git worktree manager & path scope security
│   ├── providers/        # Gemini 3.8 Flash (High), Codex, Claude, OpenCode
│   ├── policy/           # Permissions, dangerous action approval engine
│   └── artifacts/        # Patches, logs, and SHA-256 evidence store
├── roles/                # 12 Declarative YAML agent role manifests
├── workflows/            # Small-bugfix, feature-dev, refactor workflows
├── docs/
│   ├── architecture/     # ADR-0001 through ADR-0004
│   └── specs/            # Full ChatGPT architectural specification
└── tests/
    ├── unit/             # DAG, domain, and path security tests
    ├── integration/      # Real worktree and Gemini provider tests
    └── e2e/              # End-to-end acceptance suite
```

---

## 📜 License

MIT License. Copyright (c) 2026 rixed318.
See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full details.
