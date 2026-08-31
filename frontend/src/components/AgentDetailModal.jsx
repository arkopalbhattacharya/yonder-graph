import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, Cpu, Terminal, CheckCircle2, AlertTriangle, Layers, Wrench, Shield, ArrowDownRight, ArrowUpRight, Zap, Users, Radar } from 'lucide-react';
import { AGENT_PROFILES } from '../data/agentProfiles';

export default function AgentDetailModal({ agentName, agentInfo, agentMetrics, sessionTokens, onClose }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'l1', 'l2', 'l3'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!agentName) return null;

  const isSentinel = agentName === 'SentinelScannerAgent';

  const profile = AGENT_PROFILES[agentName] || {
    name: agentName,
    title: agentName,
    tagline: agentInfo?.role || "Antigravity Multi-Agent Specialist",
    primaryMission: agentInfo?.role || "Executes specialized autonomous tasks in the Yonder Graph multi-agent squad.",
    category: "Autonomous Agent",
    tier: agentInfo?.tier || "Standard",
    l1Summary: {
      title: "L1 — Service Desk & Operations",
      audience: "Service Desk Analysts, Floor Staff",
      points: ["Handles incoming operational queries and executes automated workflows."]
    },
    l2Summary: {
      title: "L2 — Application Support",
      audience: "L2 Support Engineers, WMS Analysts",
      points: ["Triages errors, maps process flows, and extracts operational parameters."]
    },
    l3Summary: {
      title: "L3 — Core Engineering & DBAs",
      audience: "Architects, Database Administrators, Developers",
      points: ["Enforces schema constraints, token limits, and deterministic safety rules."]
    },
    governanceGuardrails: [
      "Operates within designated safety boundaries and token limits."
    ]
  };

  const errorRate = agentMetrics?.error_rate || 0;
  const isHealthy = errorRate === 0;
  const intercepts = agentMetrics?.governance_intercepts || 0;

  const agSession = sessionTokens?.agents?.[agentName] || {
    prompt: agentMetrics?.session_prompt_tokens || 0,
    completion: agentMetrics?.session_completion_tokens || 0,
    total: agentMetrics?.session_total_tokens || 0
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-[#16161a]/80 backdrop-blur">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${
              isSentinel
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400'
                : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400'
            }`}>
              {isSentinel ? <Radar size={18} className="animate-pulse" /> : <Terminal size={18} />}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                {/* Glowing Health Indicator */}
                <div className="relative flex items-center justify-center">
                  <span className={`w-3 h-3 rounded-full ${
                    isHealthy 
                      ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse' 
                      : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse'
                  }`} />
                </div>
                <h3 className="text-base font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                  {profile.name}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                  isHealthy 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}>
                  {isHealthy ? '100% HEALTHY' : `${errorRate}% ERROR RATE`}
                </span>
                {intercepts > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center space-x-1 font-mono">
                    <ShieldAlert size={10} className="mr-0.5" />
                    <span>{intercepts} blocked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {profile.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs leading-relaxed">
          
          {/* Mission & Overview Box */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 space-y-2">
            <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <Layers size={13} className="text-blue-500" />
              <span>Primary Mission & Role</span>
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-snug">
              {profile.tagline}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              {profile.primaryMission}
            </p>
          </div>

          {/* Tab Selection Filter */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <div className="flex items-center space-x-1.5">
              <Users size={14} className="text-zinc-400" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Engineering Tier Breakdown
              </span>
            </div>
            <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg text-[10px] font-mono">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'all' 
                    ? 'bg-white dark:bg-[#1a1a1f] text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                All Tiers
              </button>
              <button 
                onClick={() => setActiveTab('l1')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'l1' 
                    ? 'bg-emerald-500 text-white font-bold shadow-2xs' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                L1 Ops
              </button>
              <button 
                onClick={() => setActiveTab('l2')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'l2' 
                    ? 'bg-blue-500 text-white font-bold shadow-2xs' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                L2 Support
              </button>
              <button 
                onClick={() => setActiveTab('l3')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'l3' 
                    ? 'bg-blue-600 text-white font-bold shadow-2xs' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                L3 Core/DBA
              </button>
            </div>
          </div>

          {/* L1 / L2 / L3 Engineering Cards */}
          <div className="space-y-4">
            
            {/* L1 Card */}
            {(activeTab === 'all' || activeTab === 'l1') && (
              <div className="p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                      {profile.l1Summary.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-mono bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                    Audience: {profile.l1Summary.audience}
                  </span>
                </div>
                <ul className="space-y-1.5 pl-3 list-disc text-zinc-700 dark:text-zinc-300 marker:text-emerald-500 text-xs">
                  {profile.l1Summary.points.map((pt, idx) => (
                    <li key={idx} className="leading-relaxed">{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* L2 Card */}
            {(activeTab === 'all' || activeTab === 'l2') && (
              <div className="p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                      {profile.l2Summary.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80 font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
                    Audience: {profile.l2Summary.audience}
                  </span>
                </div>
                <ul className="space-y-1.5 pl-3 list-disc text-zinc-700 dark:text-zinc-300 marker:text-blue-500 text-xs">
                  {profile.l2Summary.points.map((pt, idx) => (
                    <li key={idx} className="leading-relaxed">{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* L3 Card */}
            {(activeTab === 'all' || activeTab === 'l3') && (
              <div className="p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                      {profile.l3Summary.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80 font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
                    Audience: {profile.l3Summary.audience}
                  </span>
                </div>
                <ul className="space-y-1.5 pl-3 list-disc text-zinc-700 dark:text-zinc-300 marker:text-blue-600 text-xs">
                  {profile.l3Summary.points.map((pt, idx) => (
                    <li key={idx} className="leading-relaxed">{pt}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>

          {/* Tools & Safety Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tools */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <Wrench size={12} className="text-amber-500" />
                <span>Tools & Capabilities</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agentInfo?.tools && agentInfo.tools.length > 0 ? (
                  agentInfo.tools.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono border border-zinc-300/60 dark:border-zinc-700">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500 text-[11px] italic">
                    Pure cognitive agent (zero external tool attachments)
                  </span>
                )}
              </div>
            </div>

            {/* Governance Guardrails */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <Shield size={12} className="text-rose-500" />
                <span>Governance & Safety</span>
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 list-disc pl-3 marker:text-rose-500">
                {profile.governanceGuardrails?.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* Token Profile & Telemetry Snapshot */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 space-y-3 font-mono">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">
              <div className="flex items-center space-x-1.5">
                <Zap size={12} className="text-blue-500" />
                <span>Live Token & Invocation Telemetry</span>
              </div>
              <span>Total Invocations: {agentMetrics?.invocation_count || 0}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Current Session (localStorage)</span>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {agSession.total.toLocaleString()} tokens
                </div>
                <div className="flex items-center space-x-3 text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                  <span>In: <strong className="text-zinc-700 dark:text-zinc-300">{agSession.prompt.toLocaleString()}</strong></span>
                  <span>Out: <strong className="text-zinc-700 dark:text-zinc-300">{agSession.completion.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Lifetime Total (PostgreSQL DB)</span>
                <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  {(agentMetrics?.total_tokens || 0).toLocaleString()} tokens
                </div>
                <div className="flex items-center space-x-3 text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                  <span>In: <strong className="text-zinc-700 dark:text-zinc-300">{(agentMetrics?.prompt_tokens || 0).toLocaleString()}</strong></span>
                  <span>Out: <strong className="text-zinc-700 dark:text-zinc-300">{(agentMetrics?.completion_tokens || 0).toLocaleString()}</strong></span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/70 dark:bg-[#16161a]/80 backdrop-blur text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>Yonder Graph • Enterprise WMS Graph-RAG Squad</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
