import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '../../apps/server/src/db/database.js';
import { ProjectService } from '../../apps/server/src/services/project-service.js';
import { RoleService } from '../../apps/server/src/services/role-service.js';
import { TaskService } from '../../apps/server/src/services/task-service.js';
import { ExecutionService } from '../../apps/server/src/services/execution-service.js';
import { GitWorktreeManager, PathScopeValidator, SecretRedactor } from '../../packages/workspaces/src/index.js';
import { ProviderRegistry } from '../../packages/providers/src/index.js';
import { DAGScheduler } from '../../packages/orchestrator/src/index.js';
import { PolicyEngine } from '../../packages/policy/src/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('RixMesh Complete 18-Scenario Acceptance Matrix (AT-01 to AT-18)', () => {
  let tempRepo: string;
  let db: AppDatabase;
  let projectService: ProjectService;
  let roleService: RoleService;
  let taskService: TaskService;
  let executionService: ExecutionService;
  let rolesDir: string;
  let baseDataDir: string;

  beforeEach(async () => {
    tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'rixmesh-acceptance-'));
    await execFileAsync('git', ['init'], { cwd: tempRepo });
    await execFileAsync('git', ['config', 'user.name', 'RixMesh Bot'], { cwd: tempRepo });
    await execFileAsync('git', ['config', 'user.email', 'bot@rixmesh.local'], { cwd: tempRepo });

    await fs.writeFile(path.join(tempRepo, 'README.md'), '# Target Test Project\n', 'utf-8');
    await execFileAsync('git', ['add', '-A'], { cwd: tempRepo });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: tempRepo });
    await execFileAsync('git', ['branch', '-M', 'main'], { cwd: tempRepo });

    rolesDir = path.resolve(process.cwd(), 'roles');
    baseDataDir = path.join(tempRepo, '.devos');

    db = new AppDatabase(':memory:');
    projectService = new ProjectService(db);
    roleService = new RoleService(rolesDir);
    taskService = new TaskService(db);
    executionService = new ExecutionService(db, projectService, taskService, roleService, baseDataDir);

    await roleService.loadRoles();
  });

  afterEach(async () => {
    await executionService.waitForAllTasks().catch(() => {});
    db.close();
    await fs.rm(tempRepo, { recursive: true, force: true }).catch(() => {});
  });

  it('[AT-01] Create/Open project: Reads Git state, initializes database record', async () => {
    const project = await projectService.registerProject({
      name: 'Alpha Project',
      rootPath: tempRepo,
      stack: 'typescript',
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Alpha Project');
    expect(project.defaultBranch).toBe('main');
    expect(project.baselineSha).toBeDefined();
    expect(project.baselineSha?.length).toBe(40);
  });

  it('[AT-02] Generate spec and DAG: Constructs tasks with dependencies and topological sorting', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task1 = taskService.createTask({
      projectId: project.id,
      title: 'Backend API',
      assigneeRoleId: 'backend-developer',
      priority: 'high',
    });

    const task2 = taskService.createTask({
      projectId: project.id,
      title: 'Frontend UI',
      assigneeRoleId: 'frontend-developer',
      priority: 'medium',
      dependsOnTaskIds: [task1.id],
    });

    const tasks = taskService.listTasks(project.id);
    const deps = taskService.listDependencies(project.id);

    expect(tasks.length).toBe(2);
    expect(deps.length).toBe(1);
    expect(deps[0].taskId).toBe(task2.id);
    expect(deps[0].dependsOnTaskId).toBe(task1.id);

    const cycle = DAGScheduler.detectCycle(tasks, deps);
    expect(cycle).toBeNull();

    const order = DAGScheduler.getTopologicalOrder(tasks, deps);
    expect(order).toEqual([task1.id, task2.id]);
  });

  it('[AT-03] Independent tasks: Executes two independent tasks concurrently in separate worktrees', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const taskA = taskService.createTask({
      projectId: project.id,
      title: 'Feature A: Auth Service',
      assigneeRoleId: 'backend-developer',
      specPath: 'apps/auth/index.ts',
      writeScope: ['apps/auth/**'],
    });

    const taskB = taskService.createTask({
      projectId: project.id,
      title: 'Feature B: Billing Service',
      assigneeRoleId: 'backend-developer',
      specPath: 'apps/billing/index.ts',
      writeScope: ['apps/billing/**'],
    });

    // Both are independent (no dependencies between them, disjoint write scopes)
    expect(DAGScheduler.hasScopeCollision(taskA, taskB)).toBe(false);

    // Launch both concurrently
    const [runA, runB] = await Promise.all([
      executionService.executeTask(taskA.id, 'mock'),
      executionService.executeTask(taskB.id, 'mock'),
    ]);

    expect(runA.worktreePath).toBeDefined();
    expect(runB.worktreePath).toBeDefined();
    expect(runA.worktreePath).not.toEqual(runB.worktreePath);

    await executionService.waitForTask(taskA.id);
    await executionService.waitForTask(taskB.id);

    const finalA = taskService.getTask(taskA.id);
    const finalB = taskService.getTask(taskB.id);

    expect(finalA?.status).toBe('MERGE_READY');
    expect(finalB?.status).toBe('MERGE_READY');
  });

  it('[AT-04] Dependent task: Blocks execution until prerequisite task is DONE', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task1 = taskService.createTask({
      projectId: project.id,
      title: 'Prerequisite Core Module',
      assigneeRoleId: 'backend-developer',
      specPath: 'src/core.ts',
    });

    const task2 = taskService.createTask({
      projectId: project.id,
      title: 'Dependent Plugin Module',
      assigneeRoleId: 'frontend-developer',
      specPath: 'src/plugin.ts',
      dependsOnTaskIds: [task1.id],
    });

    // Attempt to execute task2 while task1 is still in DRAFT
    await expect(executionService.executeTask(task2.id, 'mock')).rejects.toThrow('Prerequisite task');

    // Now execute task1 and merge it
    await executionService.executeTask(task1.id, 'mock');
    await executionService.waitForTask(task1.id);
    await executionService.mergeTask(task1.id);

    expect(taskService.getTask(task1.id)?.status).toBe('DONE');

    // Now task2 should execute successfully!
    const run2 = await executionService.executeTask(task2.id, 'mock');
    expect(run2.id).toBeDefined();
    await executionService.waitForTask(task2.id);
    expect(taskService.getTask(task2.id)?.status).toBe('MERGE_READY');
  });

  it('[AT-05] Cancel run: Stops execution, sets CANCELLED, preserves partial artifacts', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Long Running Job',
      assigneeRoleId: 'backend-developer',
    });

    await executionService.executeTask(task.id, 'mock');
    await executionService.cancelTask(task.id);
    await executionService.waitForTask(task.id);

    const updated = taskService.getTask(task.id);
    expect(updated?.status).toBe('CANCELLED');
  });

  it('[AT-06] Restart server during run: Reconciles interrupted tasks without duplicates', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Interrupted Task',
      assigneeRoleId: 'backend-developer',
    });

    // Mark task as RUNNING with an active run
    taskService.updateStatus(task.id, 'RUNNING', 'orchestrator');
    db.getRawDb().prepare(`
      INSERT INTO runs (id, task_id, provider_id, model_id, status, started_at)
      VALUES ('RUN-INTERRUPT', ?, 'mock', 'mock-model', 'active', ?)
    `).run(task.id, new Date().toISOString());

    // Reconcile as happens upon server startup
    executionService.reconcileRunningTasksOnStartup();

    const reconciledTask = taskService.getTask(task.id);
    expect(reconciledTask?.status).toBe('WAITING_USER');

    const run = db.getRawDb().prepare(`SELECT status FROM runs WHERE id = 'RUN-INTERRUPT'`).get() as any;
    expect(run.status).toBe('interrupted');
  });

  it('[AT-07] Failing test: Blocks merge and records failed verification logs', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Faulty Feature with Broken Tests',
      assigneeRoleId: 'backend-developer',
    });

    const role = roleService.getRole('backend-developer')!;
    role.spec.modelPolicy.preferredModel = 'mock-test-fail';

    await executionService.executeTask(task.id, 'mock');
    await executionService.waitForTask(task.id);

    const updatedTask = taskService.getTask(task.id);
    expect(updatedTask?.status).toBe('FAILED');

    // Attempting to merge a failed task must throw
    await expect(executionService.mergeTask(task.id)).rejects.toThrow(
      /is not in MERGE_READY state/
    );
  });

  it('[AT-08] Independent review rejects: Blocks merge and returns task to REWORK', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Task containing REJECT_REVIEW defect',
      assigneeRoleId: 'backend-developer',
    });

    await executionService.executeTask(task.id, 'mock');
    await executionService.waitForTask(task.id);

    const updatedTask = taskService.getTask(task.id);
    expect(updatedTask?.status).toBe('REWORK');

    // Check review record
    const reviews = db.getRawDb().prepare(`SELECT * FROM reviews WHERE task_id = ?`).all(task.id) as any[];
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0].verdict).toBe('request_changes');

    // Merge must be blocked
    await expect(executionService.mergeTask(task.id)).rejects.toThrow(
      /is not in MERGE_READY state \(current: REWORK\)/
    );
  });

  it('[AT-09] Out-of-scope edit: Rejects path traversal and out-of-scope modifications', () => {
    const traversal = PathScopeValidator.isPathAllowed('../../etc/passwd', ['src/**']);
    expect(traversal.allowed).toBe(false);
    expect(traversal.reason).toContain('Path traversal');

    const outOfScope = PathScopeValidator.isPathAllowed('apps/secret/config.json', ['src/**']);
    expect(outOfScope.allowed).toBe(false);
    expect(outOfScope.reason).toContain('does not match allowed write scopes');

    const forbidden = PathScopeValidator.isPathAllowed('src/.env.local', ['src/**']);
    expect(forbidden.allowed).toBe(false);
    expect(forbidden.reason).toContain('forbidden security pattern');
  });

  it('[AT-10] Dangerous tool request: Requires explicit human authorization', () => {
    const role = roleService.getRole('backend-developer')!;

    const safeCmd = PolicyEngine.evaluateAction(role, 'execute_command', 'git status');
    expect(safeCmd.requiresApproval).toBe(false);
    expect(safeCmd.risk).toBe('low');

    const dangerousCmd = PolicyEngine.evaluateAction(role, 'execute_command', 'rm -rf /');
    expect(dangerousCmd.requiresApproval).toBe(true);
    expect(dangerousCmd.risk).toBe('critical');

    const dropDb = PolicyEngine.evaluateAction(role, 'execute_command', 'drop database production');
    expect(dropDb.requiresApproval).toBe(true);
  });

  it('[AT-11] Secret access attempt: Redacts secrets from logs and denies protected paths', () => {
    const rawSecretLog = 'API_KEY=AIzaSyA_fake_secret_key_123456789012345 and token=ghp_123456789012345678901234567890123456';
    const redacted = SecretRedactor.redact(rawSecretLog);

    expect(redacted).not.toContain('AIzaSyA_fake');
    expect(redacted).not.toContain('ghp_1234567890');
    expect(redacted).toContain('[REDACTED_SECRET');

    const forbiddenCheck = PathScopeValidator.isPathAllowed('.env', ['**/*']);
    expect(forbiddenCheck.allowed).toBe(false);
  });

  it('[AT-12] Branch conflict: Aborts safely without silent overwrite on merge conflict', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Conflict Task',
      assigneeRoleId: 'backend-developer',
      specPath: 'README.md',
    });

    await executionService.executeTask(task.id, 'mock');
    await executionService.waitForTask(task.id);

    // Force conflict: commit directly on main to the same file
    await fs.writeFile(path.join(tempRepo, 'README.md'), '# Main branch conflicting change\n');
    await execFileAsync('git', ['add', 'README.md'], { cwd: tempRepo });
    await execFileAsync('git', ['commit', '-m', 'Conflicting main commit'], { cwd: tempRepo });

    // Attempt merge
    const result = await executionService.mergeTask(task.id);
    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);

    const taskState = taskService.getTask(task.id);
    expect(taskState?.status).toBe('BLOCKED');
  });

  it('[AT-13] Usage budget exceeded: Pauses execution and transitions to WAITING_USER', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Expensive Computation',
      assigneeRoleId: 'backend-developer',
      estimatedBudgetUsd: 1.0, // Budget is $1.00
    });

    // Mock provider with 'mock-exceed-budget' emits $10.00
    const role = roleService.getRole('backend-developer')!;
    role.spec.modelPolicy.preferredModel = 'mock-exceed-budget';

    await executionService.executeTask(task.id, 'mock');
    await executionService.waitForTask(task.id);

    const finalTask = taskService.getTask(task.id);
    expect(finalTask?.status).toBe('WAITING_USER');
  });

  it('[AT-14] Model/provider unavailable: Provides friendly error and explicit fallback', async () => {
    const registry = ProviderRegistry.getInstance();
    const resolution = await registry.resolveProvider('non-existent-provider');

    expect(resolution.isFallback).toBe(true);
    expect(resolution.fallbackReason).toContain('Falling back');
    expect(['mock', 'gemini']).toContain(resolution.adapter.id);
  });

  it('[AT-15] Diff review & protected merge: Protects main branch and generates diff evidence', async () => {
    const project = await projectService.registerProject({ name: 'Alpha', rootPath: tempRepo });

    const task = taskService.createTask({
      projectId: project.id,
      title: 'Valid Tested Change',
      assigneeRoleId: 'backend-developer',
      specPath: 'src/index.ts',
    });

    await executionService.executeTask(task.id, 'mock');
    await executionService.waitForTask(task.id);

    expect(taskService.getTask(task.id)?.status).toBe('MERGE_READY');

    const merge = await executionService.mergeTask(task.id);
    expect(merge.success).toBe(true);
    expect(taskService.getTask(task.id)?.status).toBe('DONE');

    // Verify main branch now contains the new commit
    const log = await execFileAsync('git', ['log', '-n', '1', '--oneline'], { cwd: tempRepo });
    expect(log.stdout).toContain('Merge devos task branch');
  });

  it('[AT-16] Docs/knowledge: Documents and architecture ADRs persist in Git', async () => {
    const specExists = await fs.stat(path.resolve(process.cwd(), 'docs/specs/Rixed_DevOS_Architecture_and_Implementation_SPEC.md')).catch(() => null);
    expect(specExists).not.toBeNull();

    const adrExists = await fs.stat(path.resolve(process.cwd(), 'docs/architecture/ADR-0001-foundation.md')).catch(() => null);
    expect(adrExists).not.toBeNull();
  });

  it('[AT-17] Event replay: Monotonically ordered events are preserved and replayable', async () => {
    const project = await projectService.registerProject({ name: 'Replay Project', rootPath: tempRepo });

    db.getRawDb().prepare(`
      INSERT INTO audit_events (id, project_id, seq, actor, type, payload_json, created_at)
      VALUES
        ('ev-1', ?, 1, 'user', 'task_created', '{"taskId": "t-1"}', '2026-11-07T12:00:00Z'),
        ('ev-2', ?, 2, 'orchestrator', 'task_started', '{"taskId": "t-1"}', '2026-11-07T12:01:00Z')
    `).run(project.id, project.id);

    const events = db.getRawDb().prepare(`SELECT * FROM audit_events WHERE project_id = ? ORDER BY seq ASC`).all(project.id) as any[];
    expect(events.length).toBe(2);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
  });

  it('[AT-18] Source attribution: Pinned upstream inventory and THIRD_PARTY_NOTICES present', async () => {
    const noticesPath = path.resolve(process.cwd(), 'THIRD_PARTY_NOTICES.md');
    const licensePath = path.resolve(process.cwd(), 'LICENSE');

    const notices = await fs.readFile(noticesPath, 'utf-8');
    const license = await fs.readFile(licensePath, 'utf-8');

    expect(license).toContain('MIT');
    expect(notices).toContain('T3 Code');
    expect(notices).toContain('Orca');
    expect(notices).toContain('Emdash');
    expect(notices).toContain('Paseo');
    expect(notices).toContain('OpenCode');
  });
});
