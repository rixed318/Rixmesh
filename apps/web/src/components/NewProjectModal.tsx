import React, { useState } from 'react';
import { X, Folder, Sparkles } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (data: { name: string; rootPath: string; stack?: string }) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [stack, setStack] = useState('typescript');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rootPath.trim()) return;
    onCreateProject({
      name: name.trim(),
      rootPath: rootPath.trim(),
      stack,
    });
    setName('');
    setRootPath('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Folder className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-white">Open Git Repository</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#30363d]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Next.js Web App"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Absolute Repository Path
            </label>
            <input
              type="text"
              required
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="e.g. /home/rus/dev/my-project"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono transition"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Must be an initialized Git repository with an initial commit.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Technology Stack
            </label>
            <select
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="typescript">TypeScript / Node.js</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
              <option value="polyglot">Polyglot / Other</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-[#21262d] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Register Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
