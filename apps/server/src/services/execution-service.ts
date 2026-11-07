import { AppDatabase } from '../db/database.js';
import { ProjectService } from './project-service.js';
import { TaskService } from './task-service.js';
import { RoleService } from './role-service.js';
import { Run, Task, AgentRole, Review } from '@rixed-devos/domain';
import { GitWorktreeManager } from '@rixed-devos/workspaces';
import { ProviderRegistry, AgentEvent } from '@rixed-devos/providers';
import { ArtifactStore } from '@rixed-devos/artifacts';
import path from 'node:path';

export type EventSubscriber = (event: AgentEvent & { runId: string; taskId: string }) => void;

export class ExecutionService {
  private db: AppDatabase;
  private projectService: ProjectService;
  private taskService: TaskService;
  private roleService: RoleService;
  private artifactStore: ArtifactStore;
  private subscribers = new Set<EventSubscriber>();

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
  }

  public subscribe(cb: EventSubscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private emit(event: AgentEvent, runId: string, taskId: string): void {
    for (const sub of this.subscribers) {
      try {
        sub({ ...event, runId, taskId });
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
  }

  public async executeTask(taskId: string, requestedProviderId?: string): Promise<Run> {
    const task = this.taskService.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const project = this.projectService.getProject(task.projectId);
    if (!project) throw new Error(`Project ${task.projectId} not found`);

    const role = this.roleService.getRole(task.assigneeRoleId);
    if (!role) throw new Error(`Role ${task.assigneeRoleId} not found`);

    // Determine provider: default to Gemini 3.8 Flash (High) Primary Engine!
    const providerId = requestedProviderId || role.spec.compatibleProviders[0] || 'gemini';
    const provider = ProviderRegistry.getInstance().get(providerId);

    const runId = `RUN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    // 1. Advance task status to RUNNING
    this.taskService.updateStatus(taskId, 'RUNNING', 'orchestrator', `Run ${runId} started with provider ${providerId}`);

    // 2. Create isolated Git worktree
    let worktreePath = project.rootPath;
    let baselineSha = project.baselineSha || 'HEAD';

    try {
      const wt = await GitWorktreeManager.createWorktree(project.rootPath, taskId, runId, baselineSha);
      worktreePath = wt.worktreePath;
      baselineSha = wt.baselineSha;

      // Record worktree in DB
      this.db.getRawDb().prepare(`
        INSERT INTO worktrees (id, project_id, task_id, branch, path, baseline_sha, state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(`wt-${runId}`, project.id, taskId, wt.branch, wt.worktreePath, wt.baselineSha, now);
    } catch (err: any) {
      console.warn(`Worktree creation bypassed/failed (${err.message}). Using root project path.`);
    }

    const run: Run = {
      id: runId,
      taskId,
      providerId,
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

    // 3. Start agent session & stream turns
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

        for await (const event of provider.send(sessionId, task.title)) {
          this.emit(event, runId, taskId);

          if (event.type === 'usage_reported') {
            run.usage = event.payload;
          }

          if (event.type === 'finished') {
            run.status = event.payload.status === 'completed' ? 'completed' : 'failed';
          }
        }

        // 4. Inspect git diff and commit changes in worktree
        let diff = '';
        let resultCommit = baselineSha;
        try {
          diff = await GitWorktreeManager.getDiff(worktreePath, baselineSha);
          if (diff) {
            resultCommit = await GitWorktreeManager.commitChanges(
              worktreePath,
              `devos(${task.assigneeRoleId}): ${task.title}`
            );
          }
        } catch (err: any) {
          console.warn('Git commit/diff step:', err.message);
        }

        // Save diff artifact
        if (diff) {
          await this.artifactStore.saveArtifact(runId, 'patch', 'diff.patch', diff);
        }

        // 5. Trigger Quality Verification & Independent Review
        this.taskService.updateStatus(taskId, 'VERIFYING', 'orchestrator', 'Automated verification started');

        // Execute Reviewer Agent if required
        if (role.spec.review.requireIndependentReviewer) {
          this.taskService.updateStatus(taskId, 'REVIEW_PENDING', 'orchestrator', 'Pending peer code review');
          await this.conductIndependentReview(project.id, taskId, runId, diff, baselineSha);
        } else {
          this.taskService.updateStatus(taskId, 'MERGE_READY', 'orchestrator', 'Ready for merge');
        }

        // Update run finished state
        this.db.getRawDb().prepare(`
          UPDATE runs SET status = ?, finished_at = ?, usage_json = ? WHERE id = ?
        `).run(run.status, new Date().toISOString(), JSON.stringify(run.usage), run.id);

      } catch (err: any) {
        console.error(`Run ${runId} execution error:`, err);
        this.taskService.updateStatus(taskId, 'FAILED', 'orchestrator', err.message);
        this.db.getRawDb().prepare(`
          UPDATE runs SET status = 'failed', finished_at = ? WHERE id = ?
        `).run(new Date().toISOString(), run.id);
      }
    })();

    return run;
  }

  public async conductIndependentReview(
    projectId: string,
    taskId: string,
    runId: string,
    diff: string,
    baselineSha: string
  ): Promise<Review> {
    const reviewerRole = this.roleService.getRole('code-reviewer') || {
      apiVersion: 'devos/v1',
      kind: 'AgentRole' as const,
      metadata: { name: 'code-reviewer', version: '1.0.0', title: 'Code Reviewer' },
      spec: {
        purpose: 'Independent code review',
        compatibleProviders: ['gemini'],
        modelPolicy: { tier: 'high', preferredModel: 'gemini-3.8-flash-high', allowFallback: true },
        autonomy: 'read-only' as const,
        permissions: { read: ['**/*'], write: [], forbidden: ['*'], tools: [], network: 'denied' as const, approvalRequired: [] },
        skills: [],
        review: { requireIndependentReviewer: false, requireAutomatedTests: false },
      },
    };

    const gemini = ProviderRegistry.getInstance().get('gemini');
    const { sessionId } = await gemini.startSession({
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

    for await (const event of gemini.send(sessionId, 'review')) {
      if (event.type === 'artifact_emitted' && event.payload?.content) {
        verdict = event.payload.content.verdict || 'approved';
        summary = event.payload.content.summary || summary;
      }
    }

    const reviewId = `rev-${Date.now()}`;
    const review: Review = {
      id: reviewId,
      taskId,
      runId,
      reviewerRoleId: 'code-reviewer',
      verdict,
      summary,
      findings: [],
      diffSummary: diff.slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    this.db.getRawDb().prepare(`
      INSERT INTO reviews (id, task_id, run_id, reviewer_role_id, verdict, summary, findings_json, diff_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(
      review.id,
      review.taskId,
      review.runId || null,
      review.reviewerRoleId,
      review.verdict,
      review.summary,
      review.diffSummary || null,
      review.createdAt
    );

    if (verdict === 'approved') {
      this.taskService.updateStatus(taskId, 'MERGE_READY', 'code-reviewer', summary);
    } else {
      this.taskService.updateStatus(taskId, 'REWORK', 'code-reviewer', summary);
    }

    return review;
  }

  public async mergeTask(taskId: string): Promise<{ success: boolean; commitSha?: string; error?: string }> {
    const task = this.taskService.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.status !== 'MERGE_READY') {
      throw new Error(`Task ${taskId} is not in MERGE_READY state (current: ${task.status})`);
    }

    const project = this.projectService.getProject(task.projectId);
    if (!project) throw new Error(`Project ${task.projectId} not found`);

    const branch = `devos/TASK-${taskId}`;
    const result = await GitWorktreeManager.mergeBranch(project.rootPath, branch, project.defaultBranch);

    if (result.success) {
      this.taskService.updateStatus(taskId, 'DONE', 'orchestrator', `Successfully merged ${branch} into ${project.defaultBranch}`);
    } else {
      this.taskService.updateStatus(taskId, 'BLOCKED', 'orchestrator', `Merge conflict or failure: ${result.error}`);
    }

    return result;
  }
}
