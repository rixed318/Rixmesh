# RixMesh Acceptance Testing Matrix (AT-01 — AT-18)

**Test Suite:** `tests/acceptance/acceptance-matrix.test.ts`  
**Framework:** Vitest 3.2.7  
**Overall Result:** **18 / 18 Passed (100%)**  
**Execution Time:** ~650ms

---

## 1. Acceptance Scenarios Matrix

| ID | Check / Scenario | Mode (Real / Mock) | Execution Command | Result | Verification Evidence & Artifacts |
|---|---|---|---|---|---|
| **AT-01** | **Create / Open Project** | Real Git + Real DB | `pnpm vitest run -t "AT-01"` | **PASS** | Project registered with valid Git HEAD SHA and default branch in SQLite `projects` table. |
| **AT-02** | **Generate Spec & DAG** | Real Domain + DAG | `pnpm vitest run -t "AT-02"` | **PASS** | Topological ordering verified; Kahn's algorithm validates cycle-free dependency edges. |
| **AT-03** | **Independent Parallel Tasks** | Real Git Worktrees + Mock Provider | `pnpm vitest run -t "AT-03"` | **PASS** | Two separate worktree directories (`.devos/worktrees/task-{id}-{runId}`) and branches (`devos/TASK-{id}`) created simultaneously without lock contention. |
| **AT-04** | **Dependent Task Queue** | Real Orchestrator | `pnpm vitest run -t "AT-04"` | **PASS** | Throws `Prerequisite task ... is in status 'DRAFT', expected 'DONE'`. Successfully executes once prerequisite is merged. |
| **AT-05** | **Cancel Run** | Real Orchestrator + Worktree | `pnpm vitest run -t "AT-05"` | **PASS** | Task transitions to `CANCELLED`, run marked `cancelled`, partial artifacts preserved. |
| **AT-06** | **Restart Server Recovery** | Real SQLite WAL DB | `pnpm vitest run -t "AT-06"` | **PASS** | `reconcileRunningTasksOnStartup()` sweeps interrupted active tasks into `WAITING_USER` state; runs marked `interrupted`. |
| **AT-07** | **Failing Test Gate** | Real Worktree + Test Runner | `pnpm vitest run -t "AT-07"` | **PASS** | Task status set to `FAILED` with exitCode 1; `mergeTask()` throws error and blocks merge into `main`. |
| **AT-08** | **Independent Review Rejection** | Real Review Session + Diff | `pnpm vitest run -t "AT-08"` | **PASS** | Reviewer detects defects in patch; issues `verdict: 'request_changes'`; task transitions to `REWORK`; merge blocked. |
| **AT-09** | **Out-of-Scope & Traversal** | Real Filesystem (`realpath`) | `pnpm vitest run -t "AT-09"` | **PASS** | Path traversal (`../../etc/passwd`), out-of-scope files (`apps/secret`), and forbidden files (`.env`) denied. |
| **AT-10** | **Dangerous Tool Approval** | Real Policy Engine | `pnpm vitest run -t "AT-10"` | **PASS** | Dangerous commands (`rm -rf /`, `drop database`) classified as `critical` requiring human approval; safe commands allowed. |
| **AT-11** | **Secret Access & Redaction** | Real Redactor + Policy | `pnpm vitest run -t "AT-11"` | **PASS** | API keys (`AIzaSy...`, `ghp_...`), private keys, and passwords sanitized into `[REDACTED_SECRET...]`. |
| **AT-12** | **Branch Conflict Trapping** | Real Git Subprocess | `pnpm vitest run -t "AT-12"` | **PASS** | Merge conflict on `main` is cleanly detected; `git merge --abort` executed; task marked `BLOCKED`; `main` preserved. |
| **AT-13** | **Usage Budget Enforcement** | Real Execution Service | `pnpm vitest run -t "AT-13"` | **PASS** | Exceeding `estimatedBudgetUsd` pauses task in `WAITING_USER` status awaiting human authorization. |
| **AT-14** | **Provider Unavailability** | Real Provider Registry | `pnpm vitest run -t "AT-14"` | **PASS** | Non-existent or unavailable provider triggers structured fallback with clear diagnostic reason. |
| **AT-15** | **Diff Review & Merge** | Real Git Subprocess | `pnpm vitest run -t "AT-15"` | **PASS** | Diff patch generated and stored; non-fast-forward merge creates merge commit in target branch. |
| **AT-16** | **Docs / Knowledge Persistence** | Real Filesystem | `pnpm vitest run -t "AT-16"` | **PASS** | Validates presence of canonical specs (`docs/specs/**`) and architectural decisions (`docs/architecture/**`). |
| **AT-17** | **Audit Event Replay** | Real SQLite WAL DB | `pnpm vitest run -t "AT-17"` | **PASS** | Monotonically sequenced audit events (`seq = 1, 2`) replayed from SQLite database. |
| **AT-18** | **Source Attribution** | Real File Check | `pnpm vitest run -t "AT-18"` | **PASS** | Validates `THIRD_PARTY_NOTICES.md` with upstream references and license details for T3 Code, Orca, Emdash, Paseo, OpenCode. |

---

## 2. Test Execution Command

To run the complete suite across all 18 acceptance scenarios:

```bash
pnpm vitest run tests/acceptance/acceptance-matrix.test.ts
```

To run all unit, integration, and acceptance tests (33 tests total):

```bash
pnpm test
```
