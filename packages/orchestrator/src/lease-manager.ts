export interface TaskLease {
  taskId: string;
  runId: string;
  leaseOwner: string;
  heartbeatAt: number;
  expiresAt: number;
  fencingToken: number;
}

export class LeaseManager {
  private leases = new Map<string, TaskLease>();
  private defaultTtlMs: number;
  private tokenCounter = 1;

  constructor(defaultTtlMs: number = 30000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public acquireLease(taskId: string, runId: string, owner: string, ttlMs?: number): TaskLease | null {
    const now = Date.now();
    const existing = this.leases.get(taskId);

    if (existing && existing.expiresAt > now) {
      if (existing.runId === runId && existing.leaseOwner === owner) {
        // Renewal
        existing.heartbeatAt = now;
        existing.expiresAt = now + (ttlMs || this.defaultTtlMs);
        return existing;
      }
      // Held by another active run
      return null;
    }

    const lease: TaskLease = {
      taskId,
      runId,
      leaseOwner: owner,
      heartbeatAt: now,
      expiresAt: now + (ttlMs || this.defaultTtlMs),
      fencingToken: this.tokenCounter++,
    };
    this.leases.set(taskId, lease);
    return lease;
  }

  public heartbeat(taskId: string, runId: string, extensionMs?: number): boolean {
    const now = Date.now();
    const lease = this.leases.get(taskId);
    if (!lease || lease.runId !== runId || lease.expiresAt <= now) {
      return false;
    }
    lease.heartbeatAt = now;
    lease.expiresAt = now + (extensionMs || this.defaultTtlMs);
    return true;
  }

  public releaseLease(taskId: string, runId: string): boolean {
    const lease = this.leases.get(taskId);
    if (lease && lease.runId === runId) {
      this.leases.delete(taskId);
      return true;
    }
    return false;
  }

  public getLease(taskId: string): TaskLease | null {
    const lease = this.leases.get(taskId);
    if (!lease) return null;
    if (lease.expiresAt <= Date.now()) {
      this.leases.delete(taskId);
      return null;
    }
    return lease;
  }

  public sweepExpired(): TaskLease[] {
    const now = Date.now();
    const expired: TaskLease[] = [];
    for (const [taskId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now) {
        expired.push(lease);
        this.leases.delete(taskId);
      }
    }
    return expired;
  }
}
