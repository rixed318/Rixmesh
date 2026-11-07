import React from 'react';
import { Cpu, CheckCircle2, XCircle, Sparkles, Terminal } from 'lucide-react';

interface ProvidersTabProps {
  providers: Record<string, any>;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ providers }) => {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            AI Providers & Model Engines
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Status of integrated AI engines and local CLI adapters
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(providers).map(([id, info]) => {
          const isPrimary = id === 'gemini';
          return (
            <div
              key={id}
              className={`bg-[#161b22] border rounded-xl p-6 shadow-xl flex flex-col justify-between ${
                isPrimary
                  ? 'border-purple-500/50 ring-1 ring-purple-500/30'
                  : 'border-[#30363d]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-400">
                      {id}
                    </span>
                    {isPrimary && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Primary Engine
                      </span>
                    )}
                  </div>
                  {info.available ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Available
                    </span>
                  ) : (
                    <span className="text-xs text-red-400 flex items-center gap-1 font-semibold">
                      <XCircle className="w-4 h-4" /> Unavailable
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mb-1">{info.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{info.reason}</p>

                {/* Models */}
                <div className="mb-4">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Supported Models
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {info.models?.map((m: string) => (
                      <span
                        key={m}
                        className={`text-xs px-2.5 py-1 rounded-md font-mono ${
                          m === 'gemini-3.8-flash-high'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                            : 'bg-[#0d1117] text-gray-300 border border-[#30363d]'
                        }`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {info.capabilities?.map((c: string) => (
                      <span
                        key={c}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#21262d] text-blue-300 border border-[#30363d]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
