import { AppDatabase } from '../db/database.js';
import { Project, ProjectSchema } from '@rixed-devos/domain';
import { GitWorktreeManager, PathScopeValidator, SecretRedactor } from '@rixed-devos/workspaces';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProjectFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

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

  /**
   * Recursively scans and lists files in the project workspace, respecting ignores.
   */
  public async listFiles(projectId: string, subDir: string = ''): Promise<ProjectFileEntry[]> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const targetDir = path.resolve(project.rootPath, subDir);
    // Security check
    const check = PathScopeValidator.isSafeFilesystemTarget(project.rootPath, subDir || '.');
    if (!check.allowed) {
      throw new Error(`Access Denied: ${check.reason}`);
    }

    const ignored = new Set(['.git', 'node_modules', 'dist', '.devos', '.turbo', '.next']);
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const result: ProjectFileEntry[] = [];

    for (const ent of entries) {
      if (ignored.has(ent.name)) continue;
      const relPath = path.join(subDir, ent.name);
      if (ent.isDirectory()) {
        result.push({ name: ent.name, path: relPath, type: 'directory' });
      } else {
        const stats = await fs.stat(path.join(targetDir, ent.name)).catch(() => null);
        result.push({ name: ent.name, path: relPath, type: 'file', size: stats?.size });
      }
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Reads file content strictly within the project root.
   */
  public async readFile(projectId: string, relativePath: string): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const check = PathScopeValidator.isSafeFilesystemTarget(project.rootPath, relativePath);
    if (!check.allowed) {
      throw new Error(`Access Denied: ${check.reason}`);
    }

    const fullPath = path.resolve(project.rootPath, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return SecretRedactor.redact(content);
  }

  /**
   * Discovers knowledge base documents (ADRs, specs, handoffs) in project.
   */
  public async listKnowledge(projectId: string): Promise<Array<{ title: string; category: string; path: string }>> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const docs: Array<{ title: string; category: string; path: string }> = [];

    const scanDir = async (dir: string, category: string) => {
      const fullDir = path.join(project.rootPath, dir);
      try {
        const files = await fs.readdir(fullDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            docs.push({
              title: file.replace('.md', '').replace(/[-_]/g, ' '),
              category,
              path: path.join(dir, file),
            });
          }
        }
      } catch {
        // Directory may not exist
      }
    };

    await scanDir('docs/architecture', 'Architecture (ADR)');
    await scanDir('docs/specs', 'Specifications');
    await scanDir('docs/audit', 'Audit & Gap Analysis');
    await scanDir('docs/security', 'Security & Threat Model');
    await scanDir('docs/research', 'Research');

    return docs;
  }
}
