import { Task, TaskDependency, TaskStatus } from '@rixed-devos/domain';

export interface DAGNode {
  task: Task;
  dependencies: string[]; // task IDs this node depends on
  dependents: string[];   // task IDs that depend on this node
}

export class DAGScheduler {
  /**
   * Detects cycles in the task dependency graph using Kahn's algorithm.
   * Returns null if acyclic, or array of cyclic task IDs if a cycle exists.
   */
  public static detectCycle(tasks: Task[], dependencies: TaskDependency[]): string[] | null {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const t of tasks) {
      inDegree.set(t.id, 0);
      adj.set(t.id, []);
    }

    for (const dep of dependencies) {
      if (inDegree.has(dep.taskId) && adj.has(dep.dependsOnTaskId)) {
        adj.get(dep.dependsOnTaskId)!.push(dep.taskId);
        inDegree.set(dep.taskId, (inDegree.get(dep.taskId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedCount++;
      for (const v of adj.get(u) || []) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (visitedCount === tasks.length) {
      return null; // Acyclic
    }

    // Cyclic nodes are those with inDegree > 0
    return Array.from(inDegree.entries())
      .filter(([_, deg]) => deg > 0)
      .map(([id]) => id);
  }

  /**
   * Returns topological order of task IDs. Throws error if cycle detected.
   */
  public static getTopologicalOrder(tasks: Task[], dependencies: TaskDependency[]): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const t of tasks) {
      inDegree.set(t.id, 0);
      adj.set(t.id, []);
    }

    for (const dep of dependencies) {
      if (inDegree.has(dep.taskId) && adj.has(dep.dependsOnTaskId)) {
        adj.get(dep.dependsOnTaskId)!.push(dep.taskId);
        inDegree.set(dep.taskId, (inDegree.get(dep.taskId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);
      for (const v of adj.get(u) || []) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (order.length !== tasks.length) {
      throw new Error('Dependency graph contains cyclic dependencies');
    }

    return order;
  }

  /**
   * Finds all tasks whose prerequisite dependencies are ALL in 'DONE' status,
   * and whose current status is ready to be queued.
   */
  public static getExecutableTasks(tasks: Task[], dependencies: TaskDependency[]): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));
    const doneTaskIds = new Set<string>(
      tasks.filter(t => t.status === 'DONE').map(t => t.id)
    );

    const depsByTask = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!depsByTask.has(dep.taskId)) {
        depsByTask.set(dep.taskId, []);
      }
      depsByTask.get(dep.taskId)!.push(dep.dependsOnTaskId);
    }

    return tasks.filter(task => {
      // Must be ready to run
      if (task.status !== 'READY' && task.status !== 'QUEUED') {
        return false;
      }

      const reqs = depsByTask.get(task.id) || [];
      // All requirements must be DONE
      return reqs.every(reqId => doneTaskIds.has(reqId));
    });
  }

  /**
   * Checks for write scope collisions between concurrently running tasks.
   * If two tasks have overlapping file patterns, they should not run concurrently.
   */
  public static hasScopeCollision(taskA: Task, taskB: Task): boolean {
    const scopesA = taskA.writeScope || [];
    const scopesB = taskB.writeScope || [];

    for (const a of scopesA) {
      for (const b of scopesB) {
        if (a === '**/*' || b === '**/*') return true;
        if (a === b) return true;
        // Prefix matching
        const prefixA = a.replace(/\/\*\*.*$/, '');
        const prefixB = b.replace(/\/\*\*.*$/, '');
        if (prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)) {
          return true;
        }
      }
    }
    return false;
  }
}
