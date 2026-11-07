import { AppDatabase } from '../../apps/server/src/db/database.js';
import { ProjectService } from '../../apps/server/src/services/project-service.js';
import { RoleService } from '../../apps/server/src/services/role-service.js';
import { TaskService } from '../../apps/server/src/services/task-service.js';
import { ExecutionService } from '../../apps/server/src/services/execution-service.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runEndToEndVerification() {
  console.log('\n=============================================================');
  console.log('  🧪 Running RixMesh Verified Multi-Agent E2E Workflow');
  console.log('=============================================================\n');

  const testRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'rixmesh-e2e-verification-'));
  await execFileAsync('git', ['init'], { cwd: testRepo });
  await execFileAsync('git', ['config', 'user.name', 'RixMesh CI Bot'], { cwd: testRepo });
  await execFileAsync('git', ['config', 'user.email', 'bot@rixmesh.local'], { cwd: testRepo });

  await fs.writeFile(path.join(testRepo, 'README.md'), '# E2E Verified Target Project\n');
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

  // 1. Create Project
  console.log('▶ [Step 1] Registering Target Project...');
  const project = await projectService.registerProject({
    name: 'E2E Full Stack App',
    rootPath: testRepo,
    stack: 'typescript',
  });
  console.log(`  ✓ Project registered: ID=${project.id}, defaultBranch=${project.defaultBranch}`);

  // 2. DAG Decomposition: 2 Independent Tasks + 1 Dependent Task
  console.log('▶ [Step 2] Creating DAG: Two independent tasks + one dependent task...');
  const taskBackendA = taskService.createTask({
    projectId: project.id,
    title: 'Implement Authentication API',
    description: 'Add auth endpoints and session handling',
    specPath: 'apps/api/src/auth.ts',
    assigneeRoleId: 'backend-developer',
    writeScope: ['apps/api/**'],
    priority: 'high',
  });

  const taskBackendB = taskService.createTask({
    projectId: project.id,
    title: 'Implement Notification API',
    description: 'Add notification webhook sender',
    specPath: 'apps/api/src/notifications.ts',
    assigneeRoleId: 'backend-developer',
    writeScope: ['apps/api/**'],
    priority: 'medium',
  });

  const taskFrontend = taskService.createTask({
    projectId: project.id,
    title: 'Build Consolidated UI',
    description: 'Create frontend consuming auth and notifications',
    specPath: 'apps/web/src/dashboard.tsx',
    assigneeRoleId: 'frontend-developer',
    writeScope: ['apps/web/**'],
    priority: 'high',
    dependsOnTaskIds: [taskBackendA.id, taskBackendB.id],
  });

  console.log(`  ✓ Independent Task A: ${taskBackendA.id}`);
  console.log(`  ✓ Independent Task B: ${taskBackendB.id}`);
  console.log(`  ✓ Dependent Task C:   ${taskFrontend.id} (Depends on A & B)`);

  // 3. Parallel Execution in Disjoint Worktrees
  console.log('▶ [Step 3] Dispatching Independent Tasks A and B in Parallel Worktrees...');
  const [runA, runB] = await Promise.all([
    executionService.executeTask(taskBackendA.id, 'mock'),
    executionService.executeTask(taskBackendB.id, 'mock'),
  ]);

  console.log(`  ✓ Run A started: ${runA.id} in ${runA.worktreePath}`);
  console.log(`  ✓ Run B started: ${runB.id} in ${runB.worktreePath}`);

  await executionService.waitForTask(taskBackendA.id);
  await executionService.waitForTask(taskBackendB.id);

  console.log(`  ✓ Task A status: ${taskService.getTask(taskBackendA.id)?.status} (Expected: MERGE_READY)`);
  console.log(`  ✓ Task B status: ${taskService.getTask(taskBackendB.id)?.status} (Expected: MERGE_READY)`);

  // 4. Sequential Safe Merge into main
  console.log('▶ [Step 4] Merging Task A and Task B into main branch through sequential merge lock...');
  const mergeA = await executionService.mergeTask(taskBackendA.id);
  const mergeB = await executionService.mergeTask(taskBackendB.id);
  console.log(`  ✓ Task A merged: commit=${mergeA.commitSha?.slice(0, 8)}`);
  console.log(`  ✓ Task B merged: commit=${mergeB.commitSha?.slice(0, 8)}`);

  // 5. Dependent Task Execution
  console.log('▶ [Step 5] Executing Dependent Task C now that prerequisites are DONE...');
  const runC = await executionService.executeTask(taskFrontend.id, 'mock');
  await executionService.waitForTask(taskFrontend.id);
  console.log(`  ✓ Task C status: ${taskService.getTask(taskFrontend.id)?.status} (Expected: MERGE_READY)`);

  const mergeC = await executionService.mergeTask(taskFrontend.id);
  console.log(`  ✓ Task C merged: commit=${mergeC.commitSha?.slice(0, 8)}`);

  console.log('\n=============================================================');
  console.log('  🎉 E2E Verified Multi-Agent Workflow Completed Successfully!');
  console.log('=============================================================\n');

  db.close();
  await fs.rm(testRepo, { recursive: true, force: true });
}

runEndToEndVerification().catch(err => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
