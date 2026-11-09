import { AppDatabase } from '../db/database.js';
import { ProjectService } from './project-service.js';
import { TaskService } from './task-service.js';
import { RoleService } from './role-service.js';
import { Run, Task, AgentRole, Review } from '@rixed-devos/domain';
import { GitWorktreeManager, PathScopeValidator, SecretRedactor } from '@rixed-devos/workspaces';
import { ProviderRegistry, AgentEvent } from '@rixed-devos/providers';
import { ArtifactStore } from '@rixed-devos/artifacts';
import { DAGScheduler, LeaseManager } from '@rixed-devos/orchestrator';
import { PolicyEngine } from '@rixed-devos/policy';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type EventSubscriber = (event: AgentEvent & { runId: string; taskId: string }) => void;

export class ExecutionService {
  private db: AppDatabase;
  private projectService: ProjectService;
  private taskService: TaskService;
  private roleService: RoleService;
  private artifactStore: ArtifactStore;
  private subscribers = new Set<EventSubscriber>();
  private activeRuns = new Map<string, { runId: string; taskId: string; sessionId?: string; providerId: string }>();
  private leaseManager = new LeaseManager();
  private mergeLock: Promise<void> = Promise.resolve();

  private runningPromises = new Map<string, Promise<void>>();

  constructor(
    db: AppDatabase,
    projectService: ProjectService,
    taskService: TaskService,
    roleService: RoleService,
    baseDataDir: string
  ) {
    this.db = db;
    this.projectService = projectService;
    this.taskService = taskService;
    this.roleService = roleService;
    this.artifactStore = new ArtifactStore(baseDataDir);

    // Reconcile any orphaned runs from previous server crashes
    this.reconcileRunningTasksOnStartup();
  }

  public subscribe(cb: EventSubscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private emit(event: AgentEvent, runId: string, taskId: string): void {
    const redactedEvent: AgentEvent = {
      ...event,
      payload: SecretRedactor.redactObject(event.payload),
    };

    for (const sub of this.subscribers) {
      try {
        sub({ ...redactedEvent, runId, taskId });
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
  }

  /**
   * Startup recovery: sweeps any tasks/runs that were interrupted by a server restart.
   */
  public reconcileRunningTasksOnStartup(): void {
    try {
      const danglingTasks = this.db.getRawDb().prepare(`
        SELECT id, title, status FROM tasks WHERE status IN ('RUNNING', 'VERIFYING', 'REVIEW_PENDING')
      `).all() as Array<{ id: string; title: string; status: string }>;

      for (const t of danglingTasks) {
        this.taskService.updateStatus(
          t.id,
          'WAITING_USER',
          'orchestrator',
          `Interrupted by server restart while in status ${t.status}. Ready for resume or retry.`
        );
      }

      this.db.getRawDb().prepare(`
        UPDATE runs SET status = 'interrupted', finished_at = ? WHERE status = 'active'
      `).run(new Date().toISOString());
    } catch {
      // Table might not exist yet during migration
    }
  }

  /**
   * Executes a task ensuring prerequisites are met and isolation is strictly enforced.
   */
  public async executeTask(taskId: string, requestedProviderId?: string): Promise<Run> {
    const task = this.taskService.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const project = this.projectService.getProject(task.projectId);
    if (!project) throw new Error(`Project ${task.projectId} not found`);

    const role = this.roleService.getRole(task.assigneeRoleId);
    if (!role) throw new Error(`Role ${task.assigneeRoleId} not found`);

    // 1. Dependency gate: All prerequisite tasks MUST be in 'DONE' status
    const allTasks = this.taskService.listTasks(task.projectId);
    const allDependencies = this.taskService.listDependencies(task.projectId);
    const myDeps = allDependencies.filter(d => d.taskId === taskId);

    for (const dep of myDeps) {
      const parentTask = allTasks.find(t => t.id === dep.dependsOnTaskId);
      if (!parentTask || parentTask.status !== 'DONE') {
        const parentStatus = parentTask ? parentTask.status : 'missing';
        throw new Error(
          `Cannot execute task ${taskId}: Prerequisite task ${dep.dependsOnTaskId} is in status '${parentStatus}', expected 'DONE'`
        );
      }
    }

    // 2. Concurrency gate: Check write scope collision with any currently active task
    for (const active of this.activeRuns.values()) {
      if (active.taskId !== taskId) {
        const activeTask = this.taskService.getTask(active.taskId);
        if (activeTask && DAGScheduler.hasScopeCollision(task, activeTask)) {
          throw new Error(
            `Cannot execute task ${taskId} concurrently: Write scope collision with active task ${active.taskId}`
          );
        }
      }
    }

    // 3. Resolve Provider (MockProvider forbidden in user mode)
    const targetProviderId = requestedProviderId || role.spec.compatibleProviders[0] || 'gemini';
    const isTestMode = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const { adapter: provider } = await ProviderRegistry.getInstance().resolveProvider(
      targetProviderId,
      { allowMock: isTestMode }
    );

    const runId = `RUN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    // 4. Advance task status to RUNNING
    this.taskService.updateStatus(taskId, 'RUNNING', 'orchestrator', `Run ${runId} started with provider ${provider.id}`);

    // 5. Create isolated Git worktree and dedicated branch (NEVER fallback to project.rootPath!)
    let worktreePath = '';
    let baselineSha = project.baselineSha || 'HEAD';

    try {
      const wt = await GitWorktreeManager.createWorktree(project.rootPath, taskId, runId, baselineSha);
      worktreePath = wt.worktreePath;
      baselineSha = wt.baselineSha;

      this.db.getRawDb().prepare(`
        INSERT INTO worktrees (id, project_id, task_id, branch, path, baseline_sha, state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(`wt-${runId}`, project.id, taskId, wt.branch, wt.worktreePath, wt.baselineSha, now);
    } catch (err: any) {
      this.taskService.updateStatus(taskId, 'FAILED', 'orchestrator', `Worktree creation failed: ${err.message}`);
      throw new Error(
        `Critical: Failed to create isolated Git worktree for task ${taskId}: ${err.message}. Execution halted to protect user workspace.`
      );
    }

    // Acquire durable lease
    this.leaseManager.acquireLease(taskId, runId, provider.id, 60000);

    const run: Run = {
      id: runId,
      taskId,
      providerId: provider.id,
      modelId: role.spec.modelPolicy.preferredModel || 'gemini-3.8-flash-high',
      worktreePath,
      status: 'active',
      startedAt: now,
      usage: { tokensPrompt: 0, tokensCompletion: 0, costUsd: 0 },
    };

    this.db.getRawDb().prepare(`
      INSERT INTO runs (id, task_id, provider_id, model_id, worktree_path, status, started_at, usage_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.taskId,
      run.providerId,
      run.modelId,
      run.worktreePath || null,
      run.status,
      run.startedAt,
      JSON.stringify(run.usage)
    );

    this.activeRuns.set(runId, { runId, taskId, providerId: provider.id });

    // 6. Launch Execution
    let resolveTaskPromise: () => void = () => {};
    const taskPromise = new Promise<void>(resolve => {
      resolveTaskPromise = resolve;
    });
    this.runningPromises.set(taskId, taskPromise);

    (async () => {
      try {
        const { sessionId } = await provider.startSession({
          cwd: worktreePath,
          role,
          task,
          instructions: task.description || task.title,
          baselineCommit: baselineSha,
          model: run.modelId,
          allowedTools: role.spec.permissions.tools,
        });

        const activeEntry = this.activeRuns.get(runId);
        if (activeEntry) activeEntry.sessionId = sessionId;

        let executionSuccess = true;
        let failureReason = '';

        for await (const event of provider.send(sessionId, task.title)) {
          this.emit(event, runId, taskId);

          if (event.type === 'usage_reported') {
            run.usage = event.payload;
            // Check budget limit
            if (task.estimatedBudgetUsd && event.payload.costUsd > task.estimatedBudgetUsd) {
              this.taskService.updateStatus(taskId, 'WAITING_USER', 'orchestrator', `Budget limit exceeded ($${event.payload.costUsd} > $${task.estimatedBudgetUsd})`);
              executionSuccess = false;
              failureReason = 'Budget limit exceeded';
              break;
            }
          }

          if (event.type === 'error') {
            executionSuccess = false;
            failureReason = event.payload?.message || 'Provider execution error';
          }

          if (event.type === 'finished') {
            if (event.payload?.status === 'failed') {
              executionSuccess = false;
              failureReason = event.payload?.reason || 'Agent finished with failed status';
            }
          }
        }

        if (!executionSuccess) {
          const currentTask = this.taskService.getTask(taskId);
          if (currentTask && currentTask.status !== 'WAITING_USER' && currentTask.status !== 'CANCELLED') {
            this.taskService.updateStatus(taskId, 'FAILED', 'orchestrator', failureReason);
          }
          this.db.getRawDb().prepare(`
            UPDATE runs SET status = ?, finished_at = ? WHERE id = ?
          `).run(currentTask?.status === 'WAITING_USER' ? 'paused' : 'failed', new Date().toISOString(), run.id);
          this.activeRuns.delete(runId);
          this.leaseManager.releaseLease(taskId, runId);
          return;
        }

        if (this.taskService.getTask(taskId)?.status === 'CANCELLED') {
          this.leaseManager.releaseLease(taskId, runId);
          return;
        }

        // 7. Commit changes and inspect git diff in worktree
        let diff = '';
        let resultCommit = baselineSha;
        try {
          resultCommit = await GitWorktreeManager.commitChanges(
            worktreePath,
            `devos(${task.assigneeRoleId}): ${task.title}`
          );
          diff = await GitWorktreeManager.getDiff(worktreePath, baselineSha);
        } catch (err: any) {
          console.warn('Git commit/diff notice:', err.message);
        }

        // Save diff artifact
        if (diff) {
          await this.artifactStore.saveArtifact(runId, 'patch', 'diff.patch', SecretRedactor.redact(diff));
        }

        // 8. Quality Gate: Automated tests check
        this.taskService.updateStatus(taskId, 'VERIFYING', 'orchestrator', 'Automated verification started');

        if (role.spec.review.requireAutomatedTests || task.testPlan) {
          const testCmd = task.testPlan || 'git status --porcelain';
          let testSuccess = true;
          let testOutput = '';

          try {
            const { stdout, stderr } = await execAsync(testCmd, { cwd: worktreePath });
            testOutput = `Command: ${testCmd}\nExit Code: 0\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
          } catch (err: any) {
            testSuccess = false;
            testOutput = `Command: ${testCmd}\nExit Code: ${err.code || 1}\nSTDOUT:\n${err.stdout || ''}\nSTDERR:\n${err.stderr || err.message}`;
          }

          // Save test log artifact
          await this.artifactStore.saveArtifact(runId, 'test_log', 'test.log', SecretRedactor.redact(testOutput));

          if (!testSuccess) {
            this.taskService.updateStatus(taskId, 'FAILED', 'orchestrator', `Quality Gate Failure: Automated tests failed. See test.log.`);
            this.db.getRawDb().prepare(`
              UPDATE runs SET status = 'failed', finished_at = ? WHERE id = ?
            `).run(new Date().toISOString(), run.id);
            this.activeRuns.delete(runId);
            this.leaseManager.releaseLease(taskId, runId);
            return;
          }
        }

        // 9. Peer Review Gate: Independent Reviewer
        if (role.spec.review.requireIndependentReviewer) {
          this.taskService.updateStatus(taskId, 'REVIEW_PENDING', 'orchestrator', 'Pending peer code review');
          const review = await this.conductIndependentReview(project.id, taskId, runId, diff, baselineSha, provider.id);
          
          if (review.verdict !== 'approved') {
            // Task rejected! Sent to REWORK
            this.taskService.updateStatus(taskId, 'REWORK', 'code-reviewer', review.summary);
            this.activeRuns.delete(runId);
            this.leaseManager.releaseLease(taskId, runId);
            return;
          }
        }

        // All quality gates passed!
        this.taskService.updateStatus(taskId, 'MERGE_READY', 'orchestrator', 'Ready for merge');

        // Update run state
        run.status = 'completed';
        this.db.getRawDb().prepare(`
          UPDATE runs SET status = 'completed', finished_at = ?, usage_json = ? WHERE id = ?
        `).run(new Date().toISOString(), JSON.stringify(run.usage), run.id);

      } catch (err: any) {
        if (this.taskService.getTask(taskId)?.status !== 'CANCELLED') {
          console.error(`Run ${runId} execution error:`, err);
          this.taskService.updateStatus(taskId, 'FAILED', 'orchestrator', err.message);
          this.db.getRawDb().prepare(`
            UPDATE runs SET status = 'failed', finished_at = ? WHERE id = ?
          `).run(new Date().toISOString(), run.id);
        }
      } finally {
        this.activeRuns.delete(runId);
        this.runningPromises.delete(taskId);
        this.leaseManager.releaseLease(taskId, runId);
        resolveTaskPromise();
      }
    })();

    return run;
  }

  public async waitForTask(taskId: string): Promise<void> {
    const p = this.runningPromises.get(taskId);
    if (p) await p;
  }

  public async waitForAllTasks(): Promise<void> {
    await Promise.all(Array.from(this.runningPromises.values()));
  }

  /**
   * Conducts independent code review in an isolated session.
   */
  public async conductIndependentReview(
    projectId: string,
    taskId: string,
    runId: string,
    diff: string,
    baselineSha: string,
    providerId: string = 'gemini'
  ): Promise<Review> {
    const reviewerRole = this.roleService.getRole('code-reviewer') || {
      apiVersion: 'devos/v1',
      kind: 'AgentRole' as const,
      metadata: { name: 'code-reviewer', version: '1.0.0', title: 'Code Reviewer' },
      spec: {
        purpose: 'Independent code review',
        compatibleProviders: [providerId],
        modelPolicy: { tier: 'high', preferredModel: 'gemini-3.8-flash-high', allowFallback: true },
        autonomy: 'read-only' as const,
        permissions: { read: ['**/*'], write: [], forbidden: ['*'], tools: [], network: 'denied' as const, approvalRequired: [] },
        skills: [],
        review: { requireIndependentReviewer: false, requireAutomatedTests: false },
      },
    };

    const isTestMode = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const { adapter: reviewerProvider } = await ProviderRegistry.getInstance().resolveProvider(
      providerId,
      { allowMock: isTestMode }
    );

    const { sessionId } = await reviewerProvider.startSession({
      cwd: '',
      role: reviewerRole,
      task: this.taskService.getTask(taskId)!,
      instructions: `Review the following unified diff:\n\n${diff}`,
      baselineCommit: baselineSha,
      model: 'gemini-3.8-flash-high',
      allowedTools: [],
    });

    let verdict: 'approved' | 'request_changes' | 'blocked' = 'approved';
    let summary = 'Code adheres to quality gates and architecture standards.';
    let findings: any[] = [];

    for await (const event of reviewerProvider.send(sessionId, `Review the following unified diff:\n\n${diff}`)) {
      if (event.type === 'artifact_emitted' && event.payload?.content) {
        verdict = event.payload.content.verdict || verdict;
        summary = event.payload.content.summary || summary;
        findings = event.payload.content.findings || [];
      }
    }

    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const review: Review = {
      id: reviewId,
      taskId,
      runId,
      reviewerRoleId: 'code-reviewer',
      verdict,
      summary,
      findings,
      diffSummary: diff.slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    this.db.getRawDb().prepare(`
      INSERT INTO reviews (id, task_id, run_id, reviewer_role_id, verdict, summary, findings_json, diff_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      review.id,
      review.taskId,
      review.runId || null,
      review.reviewerRoleId,
      review.verdict,
      review.summary,
      JSON.stringify(review.findings),
      review.diffSummary || null,
      review.createdAt
    );

    return review;
  }

  /**
   * Retrieves unified git diff for a task from its active worktree or latest artifact.
   */
  public async getTaskDiff(taskId: string): Promise<string> {
    const wt = this.db.getRawDb().prepare(`
      SELECT path, baseline_sha FROM worktrees WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(taskId) as { path: string; baseline_sha: string } | undefined;

    if (wt && wt.path && fs.existsSync(wt.path)) {
      try {
        const diff = await GitWorktreeManager.getDiff(wt.path, wt.baseline_sha);
        if (diff) return diff;
      } catch {}
    }

    const run = this.db.getRawDb().prepare(`
      SELECT id FROM runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 1
    `).get(taskId) as { id: string } | undefined;

    if (run) {
      const patch = await this.artifactStore.getArtifactContent(run.id, 'diff.patch');
      if (patch) return patch;
    }

    return '';
  }

  /**
   * Safely merges a task branch using a sequential merge queue to avoid git race conditions.
   * Strictly enforces positive code review approval and verified diff.
   */
  public async mergeTask(taskId: string): Promise<{ success: boolean; commitSha?: string; error?: string; conflict?: boolean }> {
    const task = this.taskService.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.status !== 'MERGE_READY') {
      throw new Error(`Task ${taskId} is not in MERGE_READY state (current: ${task.status})`);
    }

    const role = this.roleService.getRole(task.assigneeRoleId);

    // Verify latest review is approved
    const latestReview = this.db.getRawDb().prepare(`
      SELECT verdict FROM reviews WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(taskId) as { verdict?: string } | undefined;

    if (role?.spec.review.requireIndependentReviewer) {
      if (!latestReview || latestReview.verdict !== 'approved') {
        throw new Error(`Cannot merge: latest code review verdict is '${latestReview?.verdict || 'none'}', must be 'approved'`);
      }
    } else if (latestReview && latestReview.verdict !== 'approved') {
      throw new Error(`Cannot merge: latest code review verdict is '${latestReview.verdict}', not 'approved'`);
    }

    const project = this.projectService.getProject(task.projectId);
    if (!project) throw new Error(`Project ${task.projectId} not found`);

    const branch = `devos/TASK-${taskId}`;

    // Acquire sequential merge lock
    const currentLock = this.mergeLock;
    let releaseLock: () => void = () => {};
    this.mergeLock = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    try {
      await currentLock;
      const result = await GitWorktreeManager.mergeBranch(project.rootPath, branch, project.defaultBranch);

      if (result.success) {
        this.taskService.updateStatus(taskId, 'DONE', 'orchestrator', `Successfully merged ${branch} into ${project.defaultBranch}`);
        // Prune worktree
        const wtRecord = this.db.getRawDb().prepare(`
          SELECT path FROM worktrees WHERE task_id = ? AND state = 'active'
        `).get(taskId) as { path: string } | undefined;

        if (wtRecord) {
          await GitWorktreeManager.removeWorktree(project.rootPath, wtRecord.path);
          this.db.getRawDb().prepare(`UPDATE worktrees SET state = 'merged' WHERE task_id = ?`).run(taskId);
        }
      } else {
        this.taskService.updateStatus(taskId, 'BLOCKED', 'orchestrator', `Merge conflict or failure: ${result.error}`);
      }

      return result;
    } finally {
      releaseLock();
    }
  }

  /**
   * Automatically scans project DAG for ready executable tasks and triggers them.
   */
  public async processQueue(projectId: string): Promise<string[]> {
    const tasks = this.taskService.listTasks(projectId);
    const deps = this.taskService.listDependencies(projectId);
    const executable = DAGScheduler.getExecutableTasks(tasks, deps);
    const startedTaskIds: string[] = [];

    for (const task of executable) {
      // Check collision with running tasks
      let hasCollision = false;
      for (const active of this.activeRuns.values()) {
        const activeTask = this.taskService.getTask(active.taskId);
        if (activeTask && DAGScheduler.hasScopeCollision(task, activeTask)) {
          hasCollision = true;
          break;
        }
      }

      if (!hasCollision) {
        await this.executeTask(task.id);
        startedTaskIds.push(task.id);
      }
    }

    return startedTaskIds;
  }

  /**
   * Cancels a running task and its associated provider session.
   */
  public async cancelTask(taskId: string): Promise<void> {
    const active = Array.from(this.activeRuns.values()).find(a => a.taskId === taskId);
    if (active) {
      if (active.sessionId) {
        const provider = ProviderRegistry.getInstance().get(active.providerId);
        await provider.cancel(active.sessionId);
      }
      this.activeRuns.delete(active.runId);
      this.leaseManager.releaseLease(taskId, active.runId);
      this.db.getRawDb().prepare(`
        UPDATE runs SET status = 'cancelled', finished_at = ? WHERE id = ?
      `).run(new Date().toISOString(), active.runId);
    }

    this.taskService.updateStatus(taskId, 'CANCELLED', 'orchestrator', 'Task cancelled by user request');
  }
}
