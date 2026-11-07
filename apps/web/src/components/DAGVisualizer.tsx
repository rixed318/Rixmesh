import React from 'react';
import { ArrowRight, CheckCircle2, Clock, GitCommit, Layers, Play } from 'lucide-react';

interface DAGVisualizerProps {
  tasks: any[];
  dependencies: any[];
  onSelectTask: (task: any) => void;
}

export const DAGVisualizer: React.FC<DAGVisualizerProps> = ({
  tasks,
  dependencies,
  onSelectTask,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'border-emerald-500 bg-emerald-500/10 text-emerald-400';
      case 'RUNNING':
        return 'border-blue-500 bg-blue-500/10 text-blue-400 animate-pulse';
      case 'VERIFYING':
      case 'REVIEW_PENDING':
        return 'border-purple-500 bg-purple-500/10 text-purple-400';
      case 'MERGE_READY':
        return 'border-emerald-400 bg-emerald-400/20 text-emerald-300';
      case 'FAILED':
      case 'BLOCKED':
        return 'border-red-500 bg-red-500/10 text-red-400';
      default:
        return 'border-gray-600 bg-gray-800/40 text-gray-400';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl mb-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#30363d] mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Dependency DAG & Workflow Execution Flow
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Deterministic task graph with sequential and parallel worktree isolation gates
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Done
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> In Progress
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span> Review
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span> Ready / Waiting
            </span>
          </div>
        </div>

        {/* Task Nodes Grid */}
        <div className="space-y-6">
          {tasks.map((task, idx) => {
            const deps = dependencies
              .filter((d) => d.taskId === task.id)
              .map((d) => d.dependsOnTaskId);

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${getStatusColor(
                  task.status
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#21262d] flex items-center justify-center font-mono text-xs font-bold text-gray-300">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{task.id}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#21262d] text-purple-300">
                          {task.assigneeRoleId}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">{task.title}</h4>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider bg-[#21262d]">
                      {task.status}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-2 font-mono">
                      Scope: {task.writeScope?.join(', ')}
                    </div>
                  </div>
                </div>

                {deps.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#30363d]/50 flex items-center gap-2 text-xs text-gray-400">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                    <span>Depends on:</span>
                    <div className="flex gap-1.5">
                      {deps.map((depId) => (
                        <span
                          key={depId}
                          className="px-2 py-0.5 rounded bg-[#21262d] font-mono text-[11px] text-blue-300 border border-[#30363d]"
                        >
                          {depId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
