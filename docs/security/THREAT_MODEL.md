# Security Threat Model & Mitigation Strategy

**Platform:** RixMesh  
**Target:** Local-First Multi-Agent Development Environment  
**Specification Baseline:** Section 13 of `Rixed_DevOS_Architecture_and_Implementation_SPEC.md`

---

## 1. Threat Taxonomy

### Threat 1: Prompt Injection via Repository Content & MCP Outputs
- **Vector:** Malicious instructions hidden in READMEs, documentation, dependencies, or tool output instructing the agent to overwrite protected files or exfiltrate credentials.
- **Mitigation:**
  - Strict input/output schema validation (Zod).
  - Prompts alone are NEVER trusted to enforce security boundaries.
  - Runtime enforcement of path scopes and permissions via `PathScopeValidator` and `PolicyEngine`.

### Threat 2: Secret Exfiltration (.env, SSH Keys, Tokens)
- **Vector:** An agent commands a shell subprocess or inspects environment variables to transmit `~/.ssh/id_rsa`, `.env` files, or cloud credentials.
- **Mitigation:**
  - `PathScopeValidator` strictly forbids files matching `**/.env*`, `**/secrets/**`, `**/*id_rsa*`, `**/*id_ed25519*`, `**/*.pem`.
  - `SecretRedactor` continuously filters all outgoing logs, diffs, and SSE streaming events to mask API keys, Bearer tokens, and private keys with `[REDACTED_SECRET...]`.

### Threat 3: Worktree Symlink Escape & Path Traversal
- **Vector:** An agent generates a symlink within its assigned worktree pointing to `/etc/passwd` or `~/.ssh`, and writes through the link.
- **Mitigation:**
  - Lexical path normalization alone is recognized as insufficient.
  - `PathScopeValidator.isSafeFilesystemTarget` resolves canonical filesystem paths via `fs.realpathSync`.
  - Any path or ancestor symlink resolving outside the workspace root triggers an immediate hard rejection (`Symlink escape detected`).

### Threat 4: Unauthorized Shell Execution & Privilege Escalation
- **Vector:** An agent attempts destructive shell operations such as `rm -rf /`, `drop database`, `chmod -R 777`, or arbitrary piping `curl | bash`.
- **Mitigation:**
  - `PolicyEngine.evaluateAction` intercepts shell commands before execution.
  - High-risk keywords immediately transition the action to `requiresApproval: true` with `risk: 'critical'`.
  - Unapproved actions block task execution until the developer explicitly approves through the `/api/approvals/:id/decide` endpoint.

### Threat 5: Git Merge Races & Stale Baseline Overwrites
- **Vector:** Multiple concurrent agents finish worktrees at roughly the same time, racing on checking out and merging into `main`.
- **Mitigation:**
  - `ExecutionService.mergeLock` sequential mutex serializes merges.
  - Quality gates check that automated tests passed and the latest independent review issued `approved`.
  - Merge conflicts abort cleanly (`git merge --abort`), transition the task to `BLOCKED`, and preserve the target branch.

### Threat 6: Unbounded Cost & Runaway Token Consumption
- **Vector:** A looping agent consumes excessive API quota without progress.
- **Mitigation:**
  - Roles specify `estimatedBudgetUsd` and timeout limits (`wallClockMinutes`).
  - When reported usage exceeds the task's budget ceiling, the task is immediately paused in `WAITING_USER` status.

### Threat 7: Network Exposure & Remote Unauthorized Control
- **Vector:** Server binds to `0.0.0.0`, exposing the control plane API to the local network without authentication.
- **Mitigation:**
  - Daemon explicitly binds to `127.0.0.1` (localhost only) by default.
  - Any future remote bridge requires explicit opt-in, TLS encryption, and bearer token verification.

---

## 2. Process Sandbox Evolution Strategy

> [!IMPORTANT]
> **Git Worktrees are for workspace version isolation, NOT security sandboxing.**
> A native Node.js process executing arbitrary scripts in a worktree can still access OS resources if not constrained.

### Phase 1 (Current Baseline: v0.1.0-alpha.1)
- Host-level lexical + `fs.realpath` path enforcement.
- Shell command interception and keyword gating via `PolicyEngine`.
- Secret masking via `SecretRedactor`.
- Explicit warning displayed when running in non-containerized local developer mode.

### Phase 2 (Hardened Isolation: v0.2.0)
- Containerized execution via lightweight Docker / Podman containers per task run.
- Read-only mounts for repository root with a writable layer strictly mounted to the worktree path.
- Non-root UID execution with dropped Linux capabilities (`--cap-drop=ALL`) and `no-new-privileges`.
- Loopback network isolation (`--network=none` or explicit egress proxy allowlist).
