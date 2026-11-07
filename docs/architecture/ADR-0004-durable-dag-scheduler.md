# ADR-0004: Durable Task Graph, Leases, and State Machine

## Status
Accepted

## Context
Long-running autonomous development workflows require durability across crashes, reboots, and network hiccups. Tasks must express clear dependencies (e.g. Backend API must finish before Frontend Client integration begins).

## Decision
1. **Beads-inspired DAG Structure**: Tasks model explicit dependencies via `task_dependencies(task_id, depends_on_task_id)`.
2. **Deterministic State Machine**:
   `DRAFT` -> `SPECIFIED` -> `APPROVAL_REQUIRED` -> `READY` -> `QUEUED` -> `RUNNING` -> `VERIFYING` -> `REVIEW_PENDING` -> `MERGE_READY` -> `DONE`
   Failure transitions: `BLOCKED`, `FAILED`, `CANCELLED`, `WAITING_USER`, `REWORK`.
3. **Lease & Heartbeat Management**: Active runs hold a leased lock with expiration timestamps. If a daemon crashes or an agent hangs, an orphaned lease sweep recovers the task without duplicating commits.
4. **Idempotent Transitions**: Every status change generates an audit event with sequential ordering (`audit_events(project_id, seq)`).
