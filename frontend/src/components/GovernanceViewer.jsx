import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Lock, AlertOctagon, Terminal, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function GovernanceViewer({ isActive }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    
    const fetchPolicy = async () => {
      try {
        const data = await api.getGovernancePolicy();
        setPolicy(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPolicy();
  }, [isActive]);

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-surface-light dark:bg-[#09090b] text-xs font-mono text-zinc-500">
        <span>loading_governance_policy...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface-light dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-mono text-xs overflow-hidden">
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-[#111114]/80 backdrop-blur z-10 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert size={16} className="text-purple-500" />
            <h2 className="text-sm font-bold tracking-tight">zero_error_governance</h2>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
            Dual-Tier Cognitive & AST Deterministic Guardrails protecting Oracle Blue Yonder WMS
          </p>
        </div>

        <div className="flex items-center space-x-2 text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 font-semibold shadow-2xs">
          <ShieldCheck size={13} />
          <span>AST_ENFORCED_ACTIVE</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Two Tiers Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tier 1 Box */}
            <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center text-purple-600 dark:text-purple-400">
                    <ShieldCheck size={15} className="mr-1.5" /> Tier 1: Cognitive Safety
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                    ai_agent_eval
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                  {policy.governance_tiers?.tier1?.description}
                </p>
                <ul className="space-y-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                  {policy.governance_tiers?.tier1?.capabilities?.map((cap, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-purple-500 mr-2 select-none font-bold">▸</span>
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tier 2 Box */}
            <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center text-rose-600 dark:text-rose-400">
                    <Lock size={15} className="mr-1.5" /> Tier 2: AST Deterministic
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    sql_ast_engine
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                  {policy.governance_tiers?.tier2?.description}
                </p>
                <ul className="space-y-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                  {policy.governance_tiers?.tier2?.capabilities?.map((cap, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-rose-500 mr-2 select-none font-bold">▸</span>
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Four-Tier Remediation Policy */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Four-Tier Remediation Policy Matrix
            </div>
            <div className="space-y-2.5">
              {policy.tiers?.map((tier, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs flex items-start gap-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                    L{tier.level}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{tier.name}</span>
                      {tier.requires_approval && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          SME Approval Required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2 leading-relaxed">
                      {tier.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tier.risk_levels?.map(rl => (
                        <span 
                          key={rl} 
                          className="text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800"
                        >
                          risk: {rl.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 2 Enforcement Rules */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Tier 2 AST Enforcement Rules
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Hard-Blocked Tokens */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 shadow-xs">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2.5 flex items-center space-x-1.5">
                  <AlertOctagon size={14} />
                  <span>Hard-Blocked Mutation Tokens</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {policy.governance_tiers?.tier2?.blocked_tokens?.map(token => (
                    <span 
                      key={token} 
                      className="text-[10px] font-mono font-semibold bg-white dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900 shadow-2xs"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Allowed Statements */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2.5 flex items-center space-x-1.5">
                  <Terminal size={14} />
                  <span>Permitted Query Statements</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {policy.governance_tiers?.tier2?.allowed_statements?.map(stmt => (
                    <span 
                      key={stmt} 
                      className="text-[10px] font-mono font-semibold bg-white dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900 shadow-2xs"
                    >
                      {stmt}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-2.5 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between">
                  <span>Automatic Row Limit Enforced:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {policy.governance_tiers?.tier2?.row_limit} rows
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
