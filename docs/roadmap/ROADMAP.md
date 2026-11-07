# RixMesh Product Roadmap: From Alpha to v1.0.0

**Vision:** An open-source, local-first multi-agent software engineering workspace where human developers collaborate with specialized AI agents to specify, build, test, review, and ship software.

---

## Phase 1: Core Engine & GAP Resolution (v0.1.0-alpha.1) — CURRENT
- [x] Comprehensive GAP audit against original specification.
- [x] Foundation research: comparative spike of T3 Code, Orca, Emdash, and Paseo (`docs/research/foundation-comparison.md`).
- [x] Pluggable provider adapter interface with honest status tracking (`implemented`, `tested-live`, `tested-mock`, `unavailable`).
- [x] Google Gemini adapter with live API support (`thinkingConfig`) and honest test-mock fallback.
- [x] Full 18-scenario acceptance suite passing (`tests/acceptance/acceptance-matrix.test.ts`).
- [x] Parallel worktree execution for independent tasks (`refs/heads/devos/TASK-{id}`).
- [x] Sequential merge queue with mutex lock preventing Git race conditions.
- [x] Independent code reviewer gate with defect detection and `REWORK` state transition.
- [x] Deep canonical filesystem check (`fs.realpath`) preventing symlink escapes.
- [x] Secret redactor engine sanitizing API keys, private keys, and tokens from logs and events.
- [x] Localhost binding default (`127.0.0.1`).
- [x] Retract premature `v1.0.0` tag; establish baseline at `v0.1.0-alpha.1`.

---

## Phase 2: Desktop Shell & Integrated Developer UX (v0.1.0-alpha.2)
- [ ] **Tauri 2.0 Desktop Shell:** Introduce `apps/desktop` embedding Vite frontend and daemon runner.
- [ ] **Monaco Code Editor Integration:** In-browser and desktop code editing with syntax highlighting and diff comparisons.
- [ ] **Interactive Terminal:** Integrated `xterm.js` terminal tabs attached to individual active task worktrees.
- [ ] **Visual Roles & Skills Editor:** UI for modifying role manifests, permissions, write scopes, and autonomy levels directly.

---

## Phase 3: External CLI Engine Integrations & ACP (v0.2.0)
- [ ] **OpenCode Native Adapter:** Subprocess streaming integration with `opencode` CLI.
- [ ] **Codex & Claude Code CLI Support:** Structured subprocess pipes with permission delegation.
- [ ] **ACP (Agent Client Protocol):** Connect any generic ACP-compliant coding agent.
- [ ] **Atomic Package Rebranding:** Rename internal packages to `@rixmesh/core`, `@rixmesh/orchestrator`, `@rixmesh/workspaces`, `@rixmesh/providers`, etc.

---

## Phase 4: Container Sandboxing & Memory (v0.3.0)
- [ ] **Containerized Execution Sandbox:** Docker / Podman runner per task with read-only root mounts and network isolation.
- [ ] **Project Knowledge & Memory:** Vetted lessons, ADRs, and decision log indexed via SQLite full-text search.
- [ ] **Dynamic Role Selection:** Automatic team selection (e.g. Planner + Developer + Reviewer for bugfixes; full team for large features).

---

## Phase 5: Production Release (v1.0.0)
- [ ] Multi-platform code-signed installers:
  - Linux: AppImage, `.deb`
  - Windows: Authenticode-signed NSIS `.exe` installer
  - macOS: Apple Developer ID signed and notarized `.dmg` (Universal binary)
- [ ] Multi-project workspace management with independent Git remotes.
- [ ] Comprehensive documentation and community role catalog.
