import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class AppDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        git_remote TEXT,
        default_branch TEXT NOT NULL DEFAULT 'main',
        baseline_sha TEXT,
        stack TEXT NOT NULL DEFAULT 'typescript',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        spec_path TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        priority TEXT NOT NULL DEFAULT 'medium',
        risk TEXT NOT NULL DEFAULT 'low',
        assignee_role_id TEXT NOT NULL,
        write_scope_json TEXT NOT NULL DEFAULT '["**/*"]',
        acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
        test_plan TEXT,
        estimated_budget_usd REAL NOT NULL DEFAULT 1.0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL,
        depends_on_task_id TEXT NOT NULL,
        constraint_type TEXT NOT NULL DEFAULT 'finish_to_start',
        PRIMARY KEY (task_id, depends_on_task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        worktree_path TEXT,
        session_id TEXT,
        status TEXT NOT NULL,
        exit_code INTEGER,
        usage_json TEXT NOT NULL DEFAULT '{}',
        started_at TEXT NOT NULL,
        finished_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS worktrees (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        branch TEXT NOT NULL,
        path TEXT NOT NULL,
        baseline_sha TEXT NOT NULL,
        result_sha TEXT,
        state TEXT NOT NULL DEFAULT 'created',
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_id TEXT,
        reviewer_role_id TEXT NOT NULL DEFAULT 'code-reviewer',
        verdict TEXT NOT NULL,
        summary TEXT NOT NULL,
        findings_json TEXT NOT NULL DEFAULT '[]',
        diff_summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        run_id TEXT,
        action TEXT NOT NULL,
        command TEXT,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TEXT NOT NULL,
        decided_at TEXT,
        decided_by TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        run_id TEXT,
        seq INTEGER NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_deps_parent ON task_dependencies(depends_on_task_id);
      CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_events(project_id, seq);
    `);
  }

  public close(): void {
    this.db.close();
  }
}
