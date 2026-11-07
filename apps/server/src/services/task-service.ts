import { AppDatabase } from '../db/database.js';
import {
  Task,
  TaskDependency,
  TaskStatus,
  AuditEvent,
  isValidTransition,
} from '@rixed-devos/domain';
import { DAGScheduler } from '@rixed-devos/orchestrator';

export class TaskService {
  private db: AppDatabase;
  private seqCounter = 1;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  public createTask(params: {
    projectId: string;
    title: string;
    description?: string;
    specPath?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    risk?: 'low' | 'medium' | 'high' | 'critical';
    assigneeRoleId: string;
    writeScope?: string[];
    acceptanceCriteria?: string[];
    testPlan?: string;
    estimatedBudgetUsd?: number;
    dependsOnTaskIds?: string[];
  }): Task {
    const rawDb = this.db.getRawDb();
    const id = `TASK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const task: Task = {
      id,
      projectId: params.projectId,
      title: params.title,
      description: params.description || '',
      specPath: params.specPath,
      status: 'READY',
      priority: params.priority || 'medium',
      risk: params.risk || 'low',
      assigneeRoleId: params.assigneeRoleId,
      writeScope: params.writeScope || ['**/*'],
      acceptanceCriteria: params.acceptanceCriteria || [],
      testPlan: params.testPlan,
      estimatedBudgetUsd: params.estimatedBudgetUsd || 1.0,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    rawDb.exec('BEGIN');
    try {
      rawDb.prepare(`
        INSERT INTO tasks (
          id, project_id, title, description, spec_path, status, priority, risk,
          assignee_role_id, write_scope_json, acceptance_criteria_json, test_plan,
          estimated_budget_usd, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.specPath || null,
        task.status,
        task.priority,
        task.risk,
        task.assigneeRoleId,
        JSON.stringify(task.writeScope),
        JSON.stringify(task.acceptanceCriteria),
        task.testPlan || null,
        task.estimatedBudgetUsd,
        task.version,
        task.createdAt,
        task.updatedAt
      );

      if (params.dependsOnTaskIds && params.dependsOnTaskIds.length > 0) {
        const depStmt = rawDb.prepare(`
          INSERT INTO task_dependencies (task_id, depends_on_task_id, constraint_type)
          VALUES (?, ?, 'finish_to_start')
        `);
        for (const depId of params.dependsOnTaskIds) {
          depStmt.run(task.id, depId);
        }
      }

      this.logAudit(task.projectId, task.id, undefined, 'system', 'task_created', { task });
      rawDb.exec('COMMIT');
    } catch (err) {
      rawDb.exec('ROLLBACK');
      throw err;
    }

    return task;
  }

  public getTask(id: string): Task | null {
    const rawDb = this.db.getRawDb();
    const row = rawDb.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapTask(row);
  }

  public listTasks(projectId: string): Task[] {
    const rawDb = this.db.getRawDb();
    const rows = rawDb.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as any[];
    return rows.map(r => this.mapTask(r));
  }

  public listDependencies(projectId: string): TaskDependency[] {
    const rawDb = this.db.getRawDb();
    const rows = rawDb.prepare(`
      SELECT d.* FROM task_dependencies d
      JOIN tasks t ON d.task_id = t.id
      WHERE t.project_id = ?
    `).all(projectId) as any[];

    return rows.map(r => ({
      taskId: r.task_id,
      dependsOnTaskId: r.depends_on_task_id,
      constraintType: r.constraint_type,
    }));
  }

  public updateStatus(taskId: string, newStatus: TaskStatus, actor: string = 'system', reason?: string): Task {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (!isValidTransition(task.status, newStatus)) {
      throw new Error(`Invalid status transition from ${task.status} to ${newStatus}`);
    }

    const rawDb = this.db.getRawDb();
    const now = new Date().toISOString();

    rawDb.prepare(`
      UPDATE tasks SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?
    `).run(newStatus, now, taskId);

    this.logAudit(task.projectId, taskId, undefined, actor, 'status_changed', {
      previousStatus: task.status,
      newStatus,
      reason,
    });

    task.status = newStatus;
    task.updatedAt = now;
    task.version += 1;
    return task;
  }

  public logAudit(projectId: string, taskId?: string, runId?: string, actor: string = 'system', type: string = 'event', payload: any = {}): void {
    const rawDb = this.db.getRawDb();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    rawDb.prepare(`
      INSERT INTO audit_events (id, project_id, task_id, run_id, seq, actor, type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      taskId || null,
      runId || null,
      this.seqCounter++,
      actor,
      type,
      JSON.stringify(payload),
      new Date().toISOString()
    );
  }

  private mapTask(row: any): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      specPath: row.spec_path || undefined,
      status: row.status,
      priority: row.priority,
      risk: row.risk,
      assigneeRoleId: row.assignee_role_id,
      writeScope: JSON.parse(row.write_scope_json || '[]'),
      acceptanceCriteria: JSON.parse(row.acceptance_criteria_json || '[]'),
      testPlan: row.test_plan || undefined,
      estimatedBudgetUsd: row.estimated_budget_usd,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
