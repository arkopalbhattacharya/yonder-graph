import React, { useEffect, useState } from 'react';
import { Activity, Clock, ShieldAlert, Zap, Server, Terminal, Cpu, CheckCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, PowerOff, Radar, Shield } from 'lucide-react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import AgentDetailModal from './AgentDetailModal';

export default function AgentDashboard({ isActive }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const { enableAskMode, enableSentinel } = useSettings();

  const [sessionTokens, setSessionTokens] = useState(() => {
    try {
      const activeSessionId = localStorage.getItem('yg_active_session_id');
      if (activeSessionId) {
        const stored = localStorage.getItem(`yg_session_tokens_${activeSessionId}`);
        if (stored) return JSON.parse(stored);
      }
      const generic = localStorage.getItem('yg_current_session_tokens');
      if (generic) return JSON.parse(generic);
    } catch (e) {}
    return { total: 0, prompt: 0, completion: 0, agents: {} };
  });

  useEffect(() => {
    const readSessionTokens = () => {
      try {
        const activeSessionId = localStorage.getItem('yg_active_session_id');
        let loaded = null;
        if (activeSessionId) {
          const stored = localStorage.getItem(`yg_session_tokens_${activeSessionId}`);
          if (stored) loaded = JSON.parse(stored);
        }
        if (!loaded) {
          const generic = localStorage.getItem('yg_current_session_tokens');
          if (generic) loaded = JSON.parse(generic);
        }
        if (loaded) setSessionTokens(loaded);
      } catch (e) {}
    };

    readSessionTokens();
    if (!isActive) return;
    
    const fetchStats = async () => {
      try {
        const data = await api.getAuditStats();
        setStats(data);
        readSessionTokens();
        setError(null);
      } catch (err) {
        setError("Failed to load telemetry data.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-surface-light dark:bg-[#09090b] text-xs font-mono text-zinc-500">
        <span>loading_telemetry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-surface-light dark:bg-[#09090b] text-xs font-mono text-rose-500">
        <ShieldAlert size={16} className="mr-2" />
        {error}
      </div>
    );
  }

  const { telemetry, llm_provider, registered_agents } = stats;

  const allEntries = Object.entries(registered_agents || {});
  const activeAgents = allEntries.filter(([name]) => {
    if (!enableAskMode && name === 'AskProcessAgent') {
      return false;
    }
    if (!enableSentinel && name === 'SentinelScannerAgent') {
      return false;
    }
    return true;
  });

  const disabledAgents = allEntries.filter(([name]) => {
    if (!enableAskMode && name === 'AskProcessAgent') {
      return true;
    }
    if (!enableSentinel && name === 'SentinelScannerAgent') {
      return true;
    }
    return false;
  });

  const sessionQueries = telemetry?.session_queries || 0;
  const lifetimeQueries = telemetry?.total_queries || 0;
  const activeSessionInvocations = Object.values(telemetry?.agents || {}).reduce((acc, ag) => acc + (ag.session_invocation_count || 0), 0);

  return (
    <div className="w-full h-full flex flex-col bg-surface-light dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-mono text-xs overflow-hidden relative">
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-[#111114]/80 backdrop-blur z-10 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu size={15} className="text-[#CF1F2E]" />
            <h2 className="text-sm font-bold tracking-tight">agent_telemetry</h2>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
            Multi-Agent Squad metrics, live tokens & telemetry traces
          </p>
        </div>
        <div className="flex items-center space-x-2 text-[11px] bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <Server size={13} className="text-[#CF1F2E]" />
          <span>{llm_provider?.provider} / {llm_provider?.model}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Top Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard 
              title="queries / invocations" 
              value={`${(lifetimeQueries || 0).toLocaleString()} / ${(telemetry?.total_invocations || 0).toLocaleString()}`} 
              sessionBadge={`Session: ${(sessionQueries || 0).toLocaleString()} ${sessionQueries === 1 ? 'query' : 'queries'} (${(activeSessionInvocations || 0).toLocaleString()} calls)`}
              icon={Activity} 
              color="text-[#CF1F2E]"
            />
            <StatCard 
              title="p95_latency" 
              value={`${telemetry?.p95_latency_ms || 0}ms`} 
              subtext="Rolling window"
              icon={Clock} 
              color="text-amber-500"
            />
            <StatCard 
              title="tokens (total)" 
              value={(telemetry?.total_tokens || 0).toLocaleString()} 
              subtext={`Lifetime In: ${(telemetry?.total_prompt_tokens || 0).toLocaleString()} • Out: ${(telemetry?.total_completion_tokens || 0).toLocaleString()}`}
              sessionBadge={`Session: ${(sessionTokens.total || 0).toLocaleString()} (${(sessionTokens.prompt || 0).toLocaleString()} in / ${(sessionTokens.completion || 0).toLocaleString()} out)`}
              icon={Zap} 
              color="text-[#CF1F2E]"
            />
            <StatCard 
              title="gov_intercepts" 
              value={(telemetry?.total_governance_intercepts ?? stats?.governance_intercepts ?? 0).toLocaleString()} 
              subtext="Zero-error AST & policy guard"
              sessionBadge={telemetry?.session_governance_intercepts ? `Session: ${telemetry.session_governance_intercepts}` : null}
              icon={ShieldAlert} 
              color="text-rose-500"
            />
          </div>

          {/* Active Squad Header */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Active Squad ({activeAgents.length} Agents)
              </span>
              {!enableAskMode && (
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] border border-[#CF1F2E]/30 dark:border-[#F87171]/40">
                  Resolve Mode Only
                </span>
              )}
            </div>
          </div>

          {/* Active Agent Squad Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAgents.map(([name, info]) => {
              const agentMetrics = telemetry?.agents?.[name] || {};
              const errorRate = agentMetrics.error_rate || 0;
              const intercepts = agentMetrics.governance_intercepts || 0;
              const isHealthy = errorRate === 0;
              
              const agSession = sessionTokens.agents?.[name] || { prompt: 0, completion: 0, total: 0 };
              const sessionPrompt = agSession.prompt || 0;
              const sessionCompletion = agSession.completion || 0;
              const sessionTotal = agSession.total || 0;

              const totalPrompt = agentMetrics.prompt_tokens || 0;
              const totalCompletion = agentMetrics.completion_tokens || 0;
              const totalTokens = agentMetrics.total_tokens || 0;
              const isSentinel = name === 'SentinelScannerAgent';

              return (
                <div 
                  key={name} 
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    isSentinel
                      ? 'border-rose-500/40 dark:border-rose-500/40 bg-gradient-to-b from-rose-500/5 via-white/80 to-white/80 dark:via-[#111114]/90 dark:to-[#111114]/90 shadow-xs hover:border-rose-500/70'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1 rounded-md ${
                          isSentinel
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {isSentinel ? (
                            <Radar size={13} className="text-rose-500 animate-pulse" />
                          ) : (
                            <Terminal size={13} className="text-[#CF1F2E]" />
                          )}
                        </div>
                        {/* Glowing Health Indicator */}
                        <div className="relative flex items-center justify-center">
                          <span 
                            className={`w-2.5 h-2.5 rounded-full ${
                              isHealthy 
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse' 
                                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'
                            }`}
                            title={isHealthy ? "100% Healthy" : `${errorRate}% Error Rate`}
                          />
                        </div>
                        <span className={`text-xs font-bold ${
                          isSentinel 
                            ? 'text-rose-700 dark:text-rose-300 font-extrabold' 
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}>
                          {name}
                        </span>
                        {isSentinel && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase">
                            AUTONOMY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {intercepts > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center space-x-1">
                            <ShieldAlert size={10} className="mr-0.5 inline" />
                            <span>{intercepts} blocked</span>
                          </span>
                        )}
                        {info.tier && info.tier !== 'none' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isSentinel
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : 'bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] border border-[#CF1F2E]/30 dark:border-[#F87171]/40'
                          }`}>
                            {info.tier}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agent Role Description with More button */}
                    <div className="mb-3">
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed inline">
                        {info.role}{" "}
                        <button 
                          onClick={() => setSelectedAgent({ name, info, metrics: agentMetrics })}
                          className={`inline-flex items-center font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors ${
                            isSentinel 
                              ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300'
                              : 'text-[#CF1F2E] dark:text-[#F87171] hover:text-[#B71825] dark:hover:text-[#EF4444]'
                          }`}
                        >
                          more
                        </button>
                      </p>
                    </div>

                    {info.tools && info.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {info.tools.map((tool) => (
                          <span 
                            key={tool} 
                            className="text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Token Telemetry Breakdown (Current Session & Lifetime) */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#151518] border border-zinc-100 dark:border-zinc-800/80 space-y-2 text-[10px]">
                    
                    {/* Current Session Tokens (from localStorage) */}
                    <div>
                      <div className="flex items-center justify-between font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                        <span className="uppercase tracking-wider">Session Tokens</span>
                        <span className="text-[#CF1F2E] dark:text-[#F87171] font-bold">{sessionTotal.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex items-center space-x-1 text-zinc-600 dark:text-zinc-400">
                          <ArrowDownRight size={11} className="text-[#CF1F2E] flex-shrink-0" />
                          <span>In: <strong className="text-zinc-800 dark:text-zinc-200">{sessionPrompt.toLocaleString()}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1 text-zinc-600 dark:text-zinc-400">
                          <ArrowUpRight size={11} className="text-emerald-500 flex-shrink-0" />
                          <span>Out: <strong className="text-zinc-800 dark:text-zinc-200">{sessionCompletion.toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Lifetime Tokens (from PostgreSQL DB) */}
                    <div className="border-t border-zinc-200/60 dark:border-zinc-800/60 pt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Lifetime Tokens:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {totalTokens.toLocaleString()} ({totalPrompt.toLocaleString()} in / {totalCompletion.toLocaleString()} out)
                      </span>
                    </div>

                  </div>
                  
                  {/* Metric Sub-grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[10px]">
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#16161a] border border-zinc-100 dark:border-zinc-800/60">
                      <div className="text-zinc-400 dark:text-zinc-500 font-medium">CALLS</div>
                      <div className="font-bold text-zinc-800 dark:text-zinc-200 text-xs mt-0.5">
                        {agentMetrics.invocation_count || 0}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#16161a] border border-zinc-100 dark:border-zinc-800/60">
                      <div className="text-zinc-400 dark:text-zinc-500 font-medium">P95</div>
                      <div className="font-bold text-zinc-800 dark:text-zinc-200 text-xs mt-0.5">
                        {agentMetrics.p95_latency_ms || 0}ms
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#16161a] border border-zinc-100 dark:border-zinc-800/60">
                      <div className="text-zinc-400 dark:text-zinc-500 font-medium">HEALTH</div>
                      <div className={`font-bold text-xs mt-0.5 flex items-center space-x-1 ${
                        errorRate > 5 ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        <span>{100 - errorRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disabled / Inactive Agents Section (When Ask Mode or Sentinel is Off) */}
          {disabledAgents.length > 0 && (
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PowerOff size={13} className="text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Inactive Agents ({disabledAgents.length})
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                    Experimental Flag Disabled
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 hover:opacity-100 transition-opacity">
                {disabledAgents.map(([name, info]) => {
                  const agentMetrics = telemetry?.agents?.[name] || {};
                  const isSentinel = name === 'SentinelScannerAgent';
                  return (
                    <div 
                      key={name}
                      className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111114]/40 flex flex-col justify-between space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500">
                            {isSentinel ? <Radar size={13} /> : <Terminal size={13} />}
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600" title="Disabled" />
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                          {isSentinel ? 'SENTINEL OFF' : 'ASK MODE OFF'}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {info.role}{" "}
                        <button 
                          onClick={() => setSelectedAgent({ name, info, metrics: agentMetrics })}
                          className="inline-flex items-center text-[#CF1F2E] hover:underline font-semibold ml-1 cursor-pointer"
                        >
                          more
                        </button>
                      </p>

                      <div className="pt-2 text-[10px] text-zinc-400 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
                        <span>Requires: <strong>Settings &gt; Enable Ask Mode</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Agent Detail Modal Popup */}
      {selectedAgent && (
        <AgentDetailModal
          agentName={selectedAgent.name}
          agentInfo={selectedAgent.info}
          agentMetrics={selectedAgent.metrics}
          sessionTokens={sessionTokens}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, subtext, sessionBadge, icon: Icon, color = "text-zinc-500" }) {
  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs flex flex-col justify-between space-y-1.5">
      <div>
        <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1">
          <span className="text-[10px] uppercase font-bold tracking-wider">{title}</span>
          <Icon size={14} className={color} />
        </div>
        <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
      </div>
      
      {(subtext || sessionBadge) && (
        <div className="space-y-0.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-[10px]">
          {subtext && <div className="text-zinc-500 dark:text-zinc-400 truncate">{subtext}</div>}
          {sessionBadge && <div className="text-[#CF1F2E] dark:text-[#F87171] font-semibold">{sessionBadge}</div>}
        </div>
      )}
    </div>
  );
}
