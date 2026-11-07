import { AppDatabase } from '../db/database.js';
import { Project, ProjectSchema } from '@rixed-devos/domain';
import { GitWorktreeManager } from '@rixed-devos/workspaces';
import fs from 'node:fs/promises';
import path from 'node:path';

export class ProjectService {
  private db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  public async registerProject(params: {
    name: string;
    rootPath: string;
    gitRemote?: string;
    stack?: string;
  }): Promise<Project> {
    const rawDb = this.db.getRawDb();
    const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Verify git repository and detect head sha
    let baselineSha: string | undefined;
    let defaultBranch = 'main';
    try {
      baselineSha = await GitWorktreeManager.getHeadSha(params.rootPath);
      defaultBranch = await GitWorktreeManager.getCurrentBranch(params.rootPath);
    } catch {
      // Non-git or uninitialized
    }

    const project: Project = {
      id,
      name: params.name,
      rootPath: path.resolve(params.rootPath),
      gitRemote: params.gitRemote,
      defaultBranch,
      baselineSha,
      stack: params.stack || 'typescript',
      createdAt: new Date().toISOString(),
    };

    const stmt = rawDb.prepare(`
      INSERT INTO projects (id, name, root_path, git_remote, default_branch, baseline_sha, stack, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.id,
      project.name,
      project.rootPath,
      project.gitRemote || null,
      project.defaultBranch,
      project.baselineSha || null,
      project.stack,
      project.createdAt
    );

    return project;
  }

  public getProject(id: string): Project | null {
    const rawDb = this.db.getRawDb();
    const row = rawDb.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      gitRemote: row.git_remote || undefined,
      defaultBranch: row.default_branch,
      baselineSha: row.baseline_sha || undefined,
      stack: row.stack,
      createdAt: row.created_at,
    };
  }

  public listProjects(): Project[] {
    const rawDb = this.db.getRawDb();
    const rows = rawDb.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      gitRemote: row.git_remote || undefined,
      defaultBranch: row.default_branch,
      baselineSha: row.baseline_sha || undefined,
      stack: row.stack,
      createdAt: row.created_at,
    }));
  }
}
