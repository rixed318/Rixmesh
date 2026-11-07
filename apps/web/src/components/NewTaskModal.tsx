import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';

interface NewTaskModalProps {
  roles: any[];
  existingTasks: any[];
  onClose: () => void;
  onCreateTask: (taskData: any) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  roles,
  existingTasks,
  onClose,
  onCreateTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState(roles[0]?.metadata?.name || 'backend-developer');
  const [priority, setPriority] = useState('medium');
  const [writeScope, setWriteScope] = useState('apps/**, packages/**');
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreateTask({
      title,
      description,
      assigneeRoleId: role,
      priority,
      writeScope: writeScope.split(',').map((s) => s.trim()),
      dependsOnTaskIds: dependsOn,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]/40">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Create DevOS Task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#30363d] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
              Task Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement user authentication REST endpoint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-blue-500 rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
              Description & Acceptance Criteria
            </label>
            <textarea
              rows={3}
              placeholder="Define requirements, edge cases, and expected outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-blue-500 rounded-lg px-3 py-2 text-white outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                Assignee Agent Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white outline-none cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.metadata.name} value={r.metadata.name}>
                    {r.metadata.title || r.metadata.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white outline-none cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
              Write Scope (Comma-separated globs)
            </label>
            <input
              type="text"
              value={writeScope}
              onChange={(e) => setWriteScope(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-blue-500 rounded-lg px-3 py-2 text-white font-mono text-xs outline-none"
            />
          </div>

          {existingTasks.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                Dependencies (DAG Prerequisite Tasks)
              </label>
              <select
                multiple
                value={dependsOn}
                onChange={(e) =>
                  setDependsOn(Array.from(e.target.selectedOptions, (o) => o.value))
                }
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-xs text-white outline-none max-h-24"
              >
                {existingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.id}] {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
