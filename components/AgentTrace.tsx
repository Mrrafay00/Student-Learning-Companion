import React, { useEffect, useRef } from 'react';
import { AgentLog, AgentType } from '../types';

interface AgentTraceProps {
  logs: AgentLog[];
  isLowBandwidth: boolean;
}

const getAgentColor = (agent: AgentType, lowBandwidth: boolean) => {
  if (lowBandwidth) return 'border-gray-800 text-gray-900 bg-white';
  
  switch (agent) {
    case AgentType.ASSESSMENT: return 'bg-blue-50 border-blue-200 text-blue-800';
    case AgentType.ADAPTATION: return 'bg-purple-50 border-purple-200 text-purple-800';
    case AgentType.CURATOR: return 'bg-green-50 border-green-200 text-green-800';
    case AgentType.LANGUAGE: return 'bg-orange-50 border-orange-200 text-orange-800';
    case AgentType.SAFETY: return 'bg-red-50 border-red-200 text-red-800';
    case AgentType.SYSTEM: return 'bg-gray-50 border-gray-200 text-gray-800';
    default: return 'bg-white border-gray-200';
  }
};

const AgentTrace: React.FC<AgentTraceProps> = ({ logs, isLowBandwidth }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className={`h-full flex flex-col ${isLowBandwidth ? 'border-r-2 border-black' : 'border-r border-slate-200 bg-white shadow-sm'}`}>
      <div className={`p-4 border-b ${isLowBandwidth ? 'border-black' : 'border-slate-100'}`}>
        <h2 className={`font-bold text-lg ${isLowBandwidth ? 'uppercase' : ''}`}>Agent Coordination Plan</h2>
        <p className="text-xs text-slate-500 mt-1">Live trace of multi-agent system</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 && (
          <div className="text-center text-slate-400 text-sm mt-10 italic">
            Waiting for session start...
          </div>
        )}
        
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={`text-sm p-3 rounded-md border animate-in fade-in slide-in-from-left-2 duration-300 ${getAgentColor(log.agent, isLowBandwidth)} ${isLowBandwidth ? 'rounded-none border-2' : ''}`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-xs uppercase tracking-wider opacity-80">{log.agent}</span>
              <span className="text-[10px] opacity-60 font-mono">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}
              </span>
            </div>
            <div className="font-semibold mb-1">{log.action}</div>
            <div className="opacity-90 text-xs leading-relaxed break-words font-mono bg-white/50 p-1 rounded">
              {log.details}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default AgentTrace;