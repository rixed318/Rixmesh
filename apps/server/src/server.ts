import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { AppDatabase } from './db/database.js';
import { ProjectService } from './services/project-service.js';
import { RoleService } from './services/role-service.js';
import { TaskService } from './services/task-service.js';
import { ExecutionService } from './services/execution-service.js';
import { ProviderRegistry } from '@rixed-devos/providers';
import { SecretRedactor } from '@rixed-devos/workspaces';
import { PolicyEngine } from '@rixed-devos/policy';

export interface DevOsServerInstance {
  app: express.Express;
  db: AppDatabase;
  projectService: ProjectService;
  roleService: RoleService;
  taskService: TaskService;
  executionService: ExecutionService;
}

export function createDevOsServer(options: {
  dbPath?: string;
  rolesDir?: string;
  baseDataDir?: string;
}): DevOsServerInstance {
  const app = express();

  // Security: Host & DNS Rebinding validation (Localhost only)
  app.use((req: Request, res: Response, next) => {
    const host = req.headers.host || '';
    const isLocalhost =
      host.startsWith('localhost:') ||
      host.startsWith('127.0.0.1:') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (!isLocalhost && process.env.NODE_ENV !== 'test') {
      return res.status(403).json({
        error: 'Forbidden: Access restricted to local connections (localhost / 127.0.0.1).',
      });
    }
    next();
  });

  // Security: CORS restricted to local origins
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          callback(null, true);
        } else {
          callback(new Error('CORS blocked: Only local origins permitted'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json());

  const db = new AppDatabase(options.dbPath || ':memory:');
  const projectService = new ProjectService(db);
  const rolesDir = options.rolesDir || path.resolve(process.cwd(), 'roles');
  const roleService = new RoleService(rolesDir);
  const taskService = new TaskService(db);
  const baseDataDir = options.baseDataDir || path.resolve(process.cwd(), '.devos');
  const executionService = new ExecutionService(db, projectService, taskService, roleService, baseDataDir);

  // Load roles on startup
  roleService.loadRoles().catch(err => console.error('Failed to load roles:', err));

  // Auto-register current Git repository if database is empty
  setTimeout(async () => {
    try {
      const existing = projectService.listProjects();
      if (existing.length === 0) {
        let repoRoot = process.cwd();
        for (let i = 0; i < 4; i++) {
          if (fs.existsSync(path.join(repoRoot, '.git'))) break;
          const parent = path.dirname(repoRoot);
          if (parent === repoRoot) break;
          repoRoot = parent;
        }
        if (fs.existsSync(path.join(repoRoot, '.git'))) {
          const registered = await projectService.registerProject({
            name: 'RixMesh Monorepo',
            rootPath: repoRoot,
            stack: 'typescript',
          });
          console.log(`[RixMesh] Auto-registered active workspace: ${registered.name} (${registered.rootPath})`);

          // Seed default sample task for instant interactive testing
          taskService.createTask({
            projectId: registered.id,
            title: 'Verify Gemini 3.8 Flash High Integration',
            description: 'Run automated diagnostics across provider runtime and check local agy CLI health.',
            specPath: 'apps/server/src/server.ts',
            assigneeRoleId: 'backend-developer',
            priority: 'high',
            writeScope: ['apps/server/**'],
          });
        }
      }
    } catch (err: any) {
      console.warn('[RixMesh] Auto-registration notice:', err.message);
    }
  }, 200);

  // Health & System Info
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.1.0-alpha.1',
      brand: 'RixMesh',
      defaultModel: 'gemini-3.8-flash-high',
      security: {
        localhostOnly: true,
        secretRedaction: true,
        symlinkCheck: true,
        dnsRebindingProtection: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Projects
  app.get('/api/projects', (req: Request, res: Response) => {
    res.json(projectService.listProjects());
  });

  app.post('/api/projects', async (req: Request, res: Response) => {
    try {
      const project = await projectService.registerProject(req.body);
      res.status(201).json(project);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const project = projectService.getProject(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  });

  // Project Files & Knowledge
  app.get('/api/projects/:id/files', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const subDir = (req.query.subDir as string) || '';
    try {
      const files = await projectService.listFiles(id, subDir);
      res.json(files);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.get('/api/projects/:id/files/content', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Missing path query parameter' });
    try {
      const content = await projectService.readFile(id, filePath);
      res.json({ path: filePath, content });
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.get('/api/projects/:id/knowledge', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const docs = await projectService.listKnowledge(id);
      res.json(docs);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  // Tasks
  app.get('/api/projects/:id/tasks', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const tasks = taskService.listTasks(id);
    const dependencies = taskService.listDependencies(id);
    res.json({ tasks, dependencies });
  });

  app.post('/api/projects/:id/tasks', (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const task = taskService.createTask({
        projectId: id,
        ...req.body,
      });
      res.status(201).json(task);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const task = taskService.getTask(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.get('/api/tasks/:id/diff', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const diff = await executionService.getTaskDiff(id);
      res.json({ taskId: id, diff });
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.post('/api/tasks/:id/start', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const task = taskService.getTask(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const role = roleService.getRole(task.assigneeRoleId);
      if (role) {
        const policyEval = PolicyEngine.evaluateAction(role, 'execute_task');
        if (!policyEval.allowed && policyEval.requiresApproval) {
          const approvalId = `appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          db.getRawDb().prepare(`
            INSERT INTO approvals (id, project_id, task_id, run_id, action, command, reason, status, requested_at)
            VALUES (?, ?, ?, null, 'execute_task', null, ?, 'pending', ?)
          `).run(approvalId, task.projectId, task.id, policyEval.reason || 'Approval required by policy', new Date().toISOString());
          return res.status(403).json({ error: 'Action requires approval', approvalId, reason: policyEval.reason });
        }
      }

      const { providerId } = req.body || {};
      const run = await executionService.executeTask(id, providerId);
      res.status(202).json(run);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.post('/api/tasks/:id/cancel', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      await executionService.cancelTask(id);
      res.json({ success: true, taskId: id, status: 'CANCELLED' });
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.post('/api/tasks/:id/merge', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const result = await executionService.mergeTask(id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: SecretRedactor.redact(err.message) });
    }
  });

  app.get('/api/tasks/:id/reviews', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const reviews = db.getRawDb().prepare(`
      SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at DESC
    `).all(id);
    res.json(reviews);
  });

  // Approvals
  app.get('/api/approvals', (req: Request, res: Response) => {
    const approvals = db.getRawDb().prepare(`
      SELECT * FROM approvals ORDER BY requested_at DESC
    `).all();
    res.json(approvals);
  });

  app.post('/api/approvals/:id/decide', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { decision } = req.body;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    db.getRawDb().prepare(`
      UPDATE approvals SET status = ?, decided_at = ?, decided_by = 'user' WHERE id = ?
    `).run(decision, new Date().toISOString(), id);

    res.json({ id, status: decision });
  });

  // Roles
  app.get('/api/roles', (req: Request, res: Response) => {
    res.json(roleService.listRoles());
  });

  // Providers
  app.get('/api/providers', async (req: Request, res: Response) => {
    const probes = await ProviderRegistry.getInstance().probeAll();
    res.json(probes);
  });

  // SSE Live Event Streaming
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const unsubscribe = executionService.subscribe(event => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // Serve compiled web UI if available, or redirect to dev UI
  const resolveWebDist = (): string | null => {
    const candidates = [
      path.resolve(process.cwd(), 'apps', 'web', 'dist'),
      path.resolve(process.cwd(), '..', 'web', 'dist'),
      path.resolve(process.cwd(), '../../apps/web/dist'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'index.html'))) {
        return c;
      }
    }
    return null;
  };

  const webDist = resolveWebDist();
  if (webDist) {
    app.use(express.static(webDist));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    // If web distribution has not been built yet, redirect root browser requests to Vite dev port
    app.get('/', (req: Request, res: Response) => {
      res.redirect('http://localhost:3100');
    });
  }

  return { app, db, projectService, roleService, taskService, executionService };
}
