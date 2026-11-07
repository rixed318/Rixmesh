import { describe, it, expect } from 'vitest';
import { DAGScheduler } from '@rixed-devos/orchestrator';
import { Task, TaskDependency } from '@rixed-devos/domain';

describe('DAGScheduler', () => {
  const baseTask = (id: string, status: any = 'READY', writeScope: string[] = ['src/**']): Task => ({
    id,
    projectId: 'proj-1',
    title: `Task ${id}`,
    description: '',
    status,
    priority: 'medium',
    risk: 'low',
    assigneeRoleId: 'developer',
    writeScope,
    acceptanceCriteria: [],
    estimatedBudgetUsd: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('should detect cycles in dependency graph', () => {
    const tasks = [baseTask('T1'), baseTask('T2')];
    const cyclicDeps: TaskDependency[] = [
      { taskId: 'T1', dependsOnTaskId: 'T2', constraintType: 'finish_to_start' },
      { taskId: 'T2', dependsOnTaskId: 'T1', constraintType: 'finish_to_start' },
    ];

    const cycle = DAGScheduler.detectCycle(tasks, cyclicDeps);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('T1');
  });

  it('should compute topological order correctly', () => {
    const tasks = [baseTask('T3'), baseTask('T1'), baseTask('T2')];
    const deps: TaskDependency[] = [
      { taskId: 'T2', dependsOnTaskId: 'T1', constraintType: 'finish_to_start' },
      { taskId: 'T3', dependsOnTaskId: 'T2', constraintType: 'finish_to_start' },
    ];

    const order = DAGScheduler.getTopologicalOrder(tasks, deps);
    expect(order).toEqual(['T1', 'T2', 'T3']);
  });

  it('should only return executable tasks whose dependencies are DONE', () => {
    const t1 = baseTask('T1', 'DONE');
    const t2 = baseTask('T2', 'READY');
    const t3 = baseTask('T3', 'READY');

    const deps: TaskDependency[] = [
      { taskId: 'T2', dependsOnTaskId: 'T1', constraintType: 'finish_to_start' },
      { taskId: 'T3', dependsOnTaskId: 'T2', constraintType: 'finish_to_start' },
    ];

    const executable = DAGScheduler.getExecutableTasks([t1, t2, t3], deps);
    expect(executable.map(t => t.id)).toEqual(['T2']); // T3 must wait for T2 to finish
  });

  it('should detect write scope collisions', () => {
    const tA = baseTask('TA', 'READY', ['apps/server/**']);
    const tB = baseTask('TB', 'READY', ['apps/server/src/index.ts']);
    const tC = baseTask('TC', 'READY', ['apps/web/**']);

    expect(DAGScheduler.hasScopeCollision(tA, tB)).toBe(true);
    expect(DAGScheduler.hasScopeCollision(tA, tC)).toBe(false);
  });
});
