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
  app.use(cors());
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

  // Health
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      primaryModel: 'Gemini 3.8 Flash (High)',
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
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const project = projectService.getProject(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
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
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const task = taskService.getTask(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/api/tasks/:id/start', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const { providerId } = req.body || {};
      const run = await executionService.executeTask(id, providerId);
      res.status(202).json(run);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tasks/:id/merge', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const result = await executionService.mergeTask(id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
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

  // Serve compiled web UI if available
  const webDist = path.resolve(process.cwd(), 'apps', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return { app, db, projectService, roleService, taskService, executionService };
}
