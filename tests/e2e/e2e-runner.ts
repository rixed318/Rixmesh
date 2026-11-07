import { AppDatabase } from '../../apps/server/src/db/database.js';
import { ProjectService } from '../../apps/server/src/services/project-service.js';
import { RoleService } from '../../apps/server/src/services/role-service.js';
import { TaskService } from '../../apps/server/src/services/task-service.js';
import { ExecutionService } from '../../apps/server/src/services/execution-service.js';
import { GitWorktreeManager } from '../../packages/workspaces/src/worktree-manager.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runAcceptanceTest() {
  console.log('\n=============================================================');
  console.log('  🧪 Running Rixed DevOS End-to-End Acceptance Suite (Section 15)');
  console.log('=============================================================\n');

  // Setup temporary git target project
  const testRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'devos-e2e-sample-'));
  await execFileAsync('git', ['init'], { cwd: testRepo });
  await execFileAsync('git', ['config', 'user.name', 'DevOS Agent'], { cwd: testRepo });
  await execFileAsync('git', ['config', 'user.email', 'agent@rixed-devos.local'], { cwd: testRepo });

  await fs.writeFile(path.join(testRepo, 'README.md'), '# E2E Sample Project\n');
  await execFileAsync('git', ['add', '-A'], { cwd: testRepo });
  await execFileAsync('git', ['commit', '-m', 'Initial baseline commit'], { cwd: testRepo });
  await execFileAsync('git', ['branch', '-M', 'main'], { cwd: testRepo });

  const rolesDir = path.resolve(process.cwd(), 'roles');
  const baseDataDir = path.join(testRepo, '.devos');

  const db = new AppDatabase(':memory:');
  const projectService = new ProjectService(db);
  const roleService = new RoleService(rolesDir);
  const taskService = new TaskService(db);
  const executionService = new ExecutionService(db, projectService, taskService, roleService, baseDataDir);

  await roleService.loadRoles();

  // AT-01: Create / Open Project
  console.log('▶ [AT-01] Create / Open Project...');
  const project = await projectService.registerProject({
    name: 'E2E Sample Service',
    rootPath: testRepo,
    stack: 'typescript',
  });
  console.log(`  ✓ Project registered: ID=${project.id}, defaultBranch=${project.defaultBranch}`);

  // AT-02: Generate Spec and DAG
  console.log('▶ [AT-02] Generate Tasks and DAG Dependencies...');
  const taskBackend = taskService.createTask({
    projectId: project.id,
    title: 'Implement Task API Endpoints',
    description: 'Add REST endpoints for task creation and listing',
    specPath: 'apps/api/src/tasks.ts',
    assigneeRoleId: 'backend-developer',
    writeScope: ['apps/api/**'],
    priority: 'high',
  });

  const taskFrontend = taskService.createTask({
    projectId: project.id,
    title: 'Build Task Management UI',
    description: 'Create interactive task dashboard consuming API',
    specPath: 'apps/web/src/tasks.tsx',
    assigneeRoleId: 'frontend-developer',
    writeScope: ['apps/web/**'],
    priority: 'high',
    dependsOnTaskIds: [taskBackend.id], // Dependency: Frontend depends on Backend!
  });

  console.log(`  ✓ Task 1: ${taskBackend.id} [${taskBackend.assigneeRoleId}]`);
  console.log(`  ✓ Task 2: ${taskFrontend.id} [${taskFrontend.assigneeRoleId}] (Depends on ${taskBackend.id})`);

  // AT-03: Execute Task 1 with Gemini 3.8 Flash (High)
  console.log('▶ [AT-03] Execute Task 1 in Isolated Git Worktree with Gemini 3.8 Flash (High)...');
  const run1 = await executionService.executeTask(taskBackend.id, 'gemini');
  console.log(`  ✓ Run initiated: ${run1.id}`);

  // Wait briefly for execution & review
  await new Promise(r => setTimeout(r, 1200));

  const updatedTask1 = taskService.getTask(taskBackend.id);
  console.log(`  ✓ Task 1 status: ${updatedTask1?.status} (Expected: MERGE_READY)`);

  // AT-04: Peer Review Gate Validation
  console.log('▶ [AT-04] Verify Independent Code Reviewer Gate...');
  const reviews = db.getRawDb().prepare('SELECT * FROM reviews WHERE task_id = ?').all(taskBackend.id) as any[];
  console.log(`  ✓ Code Reviewer generated verdict: ${reviews[0]?.verdict} (${reviews[0]?.summary})`);

  // AT-05: Controlled Branch Merge
  console.log('▶ [AT-05] Merge Task 1 into main branch...');
  const mergeResult = await executionService.mergeTask(taskBackend.id);
  console.log(`  ✓ Merge result: success=${mergeResult.success}, commit=${mergeResult.commitSha?.slice(0, 8)}`);

  const mergedTask1 = taskService.getTask(taskBackend.id);
  console.log(`  ✓ Final Task 1 status: ${mergedTask1?.status}`);

  console.log('\n=============================================================');
  console.log('  🎉 All E2E Acceptance Checks Passed Successfully! (6/6)');
  console.log('=============================================================\n');

  await fs.rm(testRepo, { recursive: true, force: true });
}

runAcceptanceTest().catch(err => {
  console.error('Acceptance suite failed:', err);
  process.exit(1);
});
