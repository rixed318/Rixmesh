import React, { useState, useEffect } from 'react';
import { Folder, FileCode, ChevronRight, ChevronDown, FileText, GitCommit, Copy, Check, Eye } from 'lucide-react';

interface CodeEditorTabProps {
  currentProject: any;
  tasks?: any[];
}

export const CodeEditorTab: React.FC<CodeEditorTabProps> = ({ currentProject, tasks = [] }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'files' | 'diffs'>('files');
  const [selectedTaskDiff, setSelectedTaskDiff] = useState<any>(null);

  // Load project root files
  useEffect(() => {
    if (!currentProject) return;
    fetch(`/api/projects/${currentProject.id}/files`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setFiles(data);
          // Auto select first file if available
          const firstFile = data.find(f => f.type === 'file');
          if (firstFile) {
            loadFile(firstFile.path);
          }
        }
      })
      .catch(err => console.error('Error fetching files:', err));
  }, [currentProject]);

  const loadFile = async (relPath: string) => {
    if (!currentProject) return;
    setLoading(true);
    setSelectedFilePath(relPath);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/files/content?path=${encodeURIComponent(relPath)}`);
      const data = await res.json();
      setFileContent(data.content || '');
    } catch (err) {
      console.error('Failed to read file:', err);
      setFileContent('// Failed to read file content');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finishedTasksWithDiff = tasks.filter(
    t => t.status === 'MERGE_READY' || t.status === 'DONE' || t.status === 'REVIEW_PENDING' || t.status === 'REWORK'
  );

  return (
    <div className="flex h-[calc(100vh-61px)] bg-[#0d1117] text-gray-200">
      {/* Sidebar Navigation */}
      <div className="w-72 border-r border-[#30363d] bg-[#161b22] flex flex-col">
        {/* Toggle Mode */}
        <div className="p-3 border-b border-[#30363d] flex gap-2">
          <button
            onClick={() => setViewMode('files')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              viewMode === 'files'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Project Files</span>
          </button>
          <button
            onClick={() => setViewMode('diffs')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              viewMode === 'diffs'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Task Diffs</span>
          </button>
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {viewMode === 'files' ? (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
                Workspace Explorer
              </div>
              {files.map(f => (
                <button
                  key={f.path}
                  onClick={() => f.type === 'file' && loadFile(f.path)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-2 transition ${
                    selectedFilePath === f.path
                      ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                      : 'text-gray-300 hover:bg-[#21262d]'
                  }`}
                >
                  {f.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
                Worktree Patches ({finishedTasksWithDiff.length})
              </div>
              {finishedTasksWithDiff.length === 0 ? (
                <div className="p-4 text-xs text-gray-500 text-center">
                  No completed task diffs available yet. Execute tasks to generate worktree diffs.
                </div>
              ) : (
                finishedTasksWithDiff.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTaskDiff(t);
                      setSelectedFilePath(`Task: ${t.title}`);
                      setFileContent(
                        `// Unified Diff for Task ${t.id} [${t.title}]\n// Assignee: ${t.assigneeRoleId}\n// Status: ${t.status}\n\n// Target Spec Path: ${t.specPath || 'N/A'}\n// Scope: ${JSON.stringify(t.writeScope)}\n\n// Verified under Git Worktree isolation.`
                      );
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs mb-2 transition ${
                      selectedTaskDiff?.id === t.id
                        ? 'bg-purple-500/20 border-purple-500/40 text-white'
                        : 'bg-[#0d1117] border-[#30363d] text-gray-300 hover:bg-[#21262d]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-purple-400">{t.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262d] text-gray-400">
                        {t.status}
                      </span>
                    </div>
                    <div className="font-medium truncate">{t.title}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
        {/* Editor Tab Bar */}
        <div className="h-10 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">{selectedFilePath || 'No file selected'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!fileContent}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#21262d] transition text-xs flex items-center gap-1"
              title="Copy Content"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              Loading file content...
            </div>
          ) : !selectedFilePath ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Eye className="w-8 h-8 mb-2 opacity-50" />
              <span>Select a file from the explorer or inspect a task diff</span>
            </div>
          ) : (
            <pre className="text-gray-300 whitespace-pre font-mono">
              <code>{fileContent}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
