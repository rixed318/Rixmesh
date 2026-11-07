import React from 'react';
import { Shield, Sparkles, Terminal, FileCode, CheckCircle, Lock } from 'lucide-react';

interface AgentMonitorProps {
  roles: any[];
}

export const AgentMonitor: React.FC<AgentMonitorProps> = ({ roles }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Agent Role Catalog & Capabilities
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Specialized multi-agent personas with explicit permissions, write boundaries, and quality gate policies
          </p>
        </div>
        <div className="text-xs bg-[#161b22] border border-[#30363d] px-3 py-1.5 rounded-lg text-purple-300 font-medium">
          Total Roles: {roles.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => {
          const spec = role.spec || {};
          const meta = role.metadata || {};
          return (
            <div
              key={meta.name}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg flex flex-col justify-between hover:border-purple-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {meta.name}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#21262d] text-gray-300 border border-[#30363d]">
                    {spec.autonomy}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-2">{meta.title || meta.name}</h3>
                <p className="text-xs text-gray-400 mb-4 line-clamp-3">{spec.purpose}</p>

                {/* Model Policy */}
                <div className="bg-[#0d1117] p-2.5 rounded-lg border border-[#21262d] mb-3 text-xs">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">
                    Primary Engine
                  </div>
                  <div className="text-purple-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    {spec.modelPolicy?.preferredModel || 'gemini-3.8-flash-high'}
                  </div>
                </div>

                {/* Allowed Write Scope */}
                <div className="text-xs mb-3">
                  <span className="text-gray-400 font-medium">Write Scopes:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {spec.permissions?.write?.length > 0 ? (
                      spec.permissions.write.map((scope: string) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 rounded bg-[#21262d] text-[10px] font-mono text-blue-300"
                        >
                          {scope}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Read-only (No write access)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quality Gates */}
              <div className="pt-3 border-t border-[#30363d] flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <CheckCircle
                    className={`w-3.5 h-3.5 ${
                      spec.review?.requireIndependentReviewer ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  />
                  Peer Review Gate
                </span>
                <span className="flex items-center gap-1">
                  <Terminal
                    className={`w-3.5 h-3.5 ${
                      spec.review?.requireAutomatedTests ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  />
                  Test Gate
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
