import React from 'react';
import { Play, CheckCircle2, AlertTriangle, Clock, ArrowRight, UserCheck } from 'lucide-react';

interface KanbanBoardProps {
  tasks: any[];
  onSelectTask: (task: any) => void;
  onStartTask: (taskId: string) => void;
  onMergeTask: (taskId: string) => void;
}

const COLUMNS = [
  { id: 'READY', title: 'Ready / Queued', statuses: ['READY', 'QUEUED'] },
  { id: 'RUNNING', title: 'In Progress (Active Worktree)', statuses: ['RUNNING'] },
  { id: 'VERIFYING', title: 'Verifying & Testing', statuses: ['VERIFYING'] },
  { id: 'REVIEW_PENDING', title: 'Peer Review', statuses: ['REVIEW_PENDING'] },
  { id: 'MERGE_READY', title: 'Merge Ready', statuses: ['MERGE_READY'] },
  { id: 'DONE', title: 'Done', statuses: ['DONE'] },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  onStartTask,
  onMergeTask,
}) => {
  const getTasksForColumn = (statuses: string[]) => {
    return tasks.filter((t) => statuses.includes(t.status));
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-6 min-h-[calc(100vh-80px)] overflow-x-auto">
      {COLUMNS.map((col) => {
        const columnTasks = getTasksForColumn(col.statuses);
        return (
          <div
            key={col.id}
            className="flex flex-col bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm"
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-[#30363d] bg-[#21262d]/50 flex items-center justify-between">
              <h3 className="font-semibold text-xs tracking-wider text-gray-300 uppercase">
                {col.title}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#30363d] text-gray-400 font-mono">
                {columnTasks.length}
              </span>
            </div>

            {/* Task Cards Container */}
            <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-160px)]">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="bg-[#0d1117] border border-[#30363d] hover:border-blue-500/50 p-4 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5 group relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-400">{task.id}</span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors line-clamp-2">
                    {task.title}
                  </h4>

                  <div className="mt-3 pt-3 border-t border-[#21262d] flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      <span className="font-medium text-purple-300">{task.assigneeRoleId}</span>
                    </div>

                    {/* Quick action button */}
                    {task.status === 'READY' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartTask(task.id);
                        }}
                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition"
                        title="Start Task"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {task.status === 'MERGE_READY' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMergeTask(task.id);
                        }}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] rounded transition flex items-center gap-1"
                        title="Merge into main"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Merge</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-[#30363d] rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
