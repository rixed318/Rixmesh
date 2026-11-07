import React from 'react';
import { Cpu, GitBranch, Layers, Plus, Terminal, RefreshCw } from 'lucide-react';

interface HeaderProps {
  currentProject: any;
  projects: any[];
  onSelectProject: (id: string) => void;
  activeTab: 'kanban' | 'dag' | 'agents' | 'providers';
  onTabChange: (tab: 'kanban' | 'dag' | 'agents' | 'providers') => void;
  onNewTask: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  projects,
  onSelectProject,
  activeTab,
  onTabChange,
  onNewTask,
  onRefresh,
}) => {
  return (
    <header className="border-b border-[#30363d] bg-[#161b22] px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              RixMesh Studio
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                v0.1.0-alpha.1
              </span>
            </h1>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Multi-Agent Workspace <span className="text-gray-500">•</span> <span className="text-gray-400">by Rixed</span>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm">
          <GitBranch className="w-4 h-4 text-gray-400 mr-2" />
          <select
            value={currentProject?.id || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-gray-200 outline-none text-sm cursor-pointer pr-2"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#161b22] text-gray-200">
                {p.name} ({p.defaultBranch})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 bg-[#0d1117] p-1 rounded-lg border border-[#30363d]">
          <button
            onClick={() => onTabChange('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'kanban'
                ? 'bg-[#21262d] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => onTabChange('dag')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'dag'
                ? 'bg-[#21262d] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            DAG Graph
          </button>
          <button
            onClick={() => onTabChange('agents')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'agents'
                ? 'bg-[#21262d] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Agent Manager
          </button>
          <button
            onClick={() => onTabChange('providers')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'providers'
                ? 'bg-[#21262d] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Providers & Models
          </button>
        </nav>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#21262d] transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={onNewTask}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
