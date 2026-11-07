import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  Terminal,
  FileText,
  GitBranch,
  ShieldCheck,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface TaskDetailModalProps {
  task: any;
  events: any[];
  onClose: () => void;
  onStartTask: (taskId: string, providerId?: string) => void;
  onMergeTask: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  events,
  onClose,
  onStartTask,
  onMergeTask,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'diff' | 'spec'>('logs');

  const taskEvents = events.filter((e) => e.taskId === task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">{task.id}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                {task.assigneeRoleId}
              </span>
              <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-[#30363d] text-gray-300">
                {task.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{task.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#30363d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quality Gates Checklist */}
          <div className="grid grid-cols-4 gap-3 bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <div className="font-semibold text-gray-200">Spec Gate</div>
                <div className="text-[10px] text-gray-400">Approved</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-4 h-4 ${
                  task.status === 'VERIFYING' ||
                  task.status === 'REVIEW_PENDING' ||
                  task.status === 'MERGE_READY' ||
                  task.status === 'DONE'
                    ? 'text-emerald-400'
                    : 'text-gray-400'
                }`}
              />
              <div className="text-xs">
                <div className="font-semibold text-gray-200">Worktree & Code</div>
                <div className="text-[10px] text-gray-400">
                  {task.status === 'RUNNING' ? 'In Progress' : 'Committed'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`w-4 h-4 ${
                  task.status === 'MERGE_READY' || task.status === 'DONE'
                    ? 'text-emerald-400'
                    : 'text-gray-400'
                }`}
              />
              <div className="text-xs">
                <div className="font-semibold text-gray-200">Independent Review</div>
                <div className="text-[10px] text-gray-400">
                  {task.status === 'MERGE_READY' || task.status === 'DONE' ? 'Approved' : 'Pending'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch
                className={`w-4 h-4 ${task.status === 'DONE' ? 'text-emerald-400' : 'text-gray-400'}`}
              />
              <div className="text-xs">
                <div className="font-semibold text-gray-200">Merge Gate</div>
                <div className="text-[10px] text-gray-400">
                  {task.status === 'DONE' ? 'Merged to main' : 'Awaiting Gate'}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs for details */}
          <div>
            <div className="flex border-b border-[#30363d] space-x-4 mb-4 text-sm font-medium">
              <button
                onClick={() => setActiveTab('logs')}
                className={`pb-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Live Agent Terminal ({taskEvents.length})
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`pb-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === 'diff'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                Unified Git Diff
              </button>
            </div>

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 font-mono text-xs text-gray-300 max-h-72 overflow-y-auto space-y-2">
                {taskEvents.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-400">[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-purple-400 font-bold uppercase">{ev.type}:</span>
                    <span className="text-gray-200">
                      {ev.payload?.text ||
                        ev.payload?.message ||
                        JSON.stringify(ev.payload || {})}
                    </span>
                  </div>
                ))}
                {taskEvents.length === 0 && (
                  <div className="text-gray-400 italic">No execution events recorded yet. Click 'Run Task' below.</div>
                )}
              </div>
            )}

            {/* Diff Tab */}
            {activeTab === 'diff' && (
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-72">
                <div className="text-gray-400 mb-2 font-bold">Branch: devos/TASK-{task.id}</div>
                <div className="text-emerald-400">+ // Generated by Rixed DevOS [Gemini 3.8 Flash (High)]</div>
                <div className="text-emerald-400">+ // Task: {task.title}</div>
                <div className="text-emerald-400">+ export const taskId = '{task.id}';</div>
                <div className="text-emerald-400">+ export const status = 'completed';</div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="p-4 border-t border-[#30363d] bg-[#21262d]/40 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Write Scope: <span className="font-mono text-gray-200">{task.writeScope?.join(', ')}</span>
          </div>

          <div className="flex items-center space-x-3">
            {task.status !== 'DONE' && (
              <button
                onClick={() => onStartTask(task.id, 'gemini')}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-purple-600/20 transition active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute (Gemini 3.8 Flash)</span>
              </button>
            )}

            {task.status === 'MERGE_READY' && (
              <button
                onClick={() => onMergeTask(task.id)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Merge to Main</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
