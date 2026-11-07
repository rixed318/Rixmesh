# ADR-0003: Git Worktree Isolation & Merge Queue

## Status
Accepted

## Context
When multiple agents work concurrently on different tasks in the same project, direct edits to the main workspace branch lead to race conditions, partial overwrites, and state corruption.

## Decision
1. **Isolated Worktrees**: Every task execution runs in a dedicated Git worktree located at `.devos/worktrees/task-{taskId}-{runId}` on an isolated branch `devos/TASK-{taskId}`.
2. **Path Scope Enforcement**: File writes are validated against the role's and task's allowed write scopes (e.g. `apps/api/**`). Edits to forbidden paths (`.git/**`, `.env*`, `secrets/**`) are strictly blocked.
3. **Controlled Merge Queue**: Changes can only merge into the project's base branch (`main` / `master`) after:
   - Passing automated tests (`test_gate`).
   - Receiving an approval verdict from an independent Code Reviewer agent (`review_gate`).
   - Passing optional Human-in-the-Loop review (`human_gate`).
4. **Clean Worktree Lifecycle**: Completed or cancelled worktrees are safely pruned using `git worktree remove --force` without touching the target branch history.
