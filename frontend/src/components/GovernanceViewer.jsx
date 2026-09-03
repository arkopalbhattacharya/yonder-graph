import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  AlertOctagon, 
  Terminal, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Cpu, 
  Eye,
  Layers
} from 'lucide-react';
import { api } from '../services/api';

export default function GovernanceViewer({ isActive }) {
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // 'matrix', 'interceptions'
  const [policy, setPolicy] = useState(null);
  const [interceptions, setInterceptions] = useState([]);
  const [totalInterceptions, setTotalInterceptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRisk, setFilterRisk] = useState('ALL'); // 'ALL', 'REQUIRES_APPROVAL', 'BLOCKED', 'LOW', 'MEDIUM', 'HIGH'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchGovernanceData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [policyData, interData] = await Promise.all([
        api.getGovernancePolicy(),
        api.getGovernanceInterceptions(1, 50),
      ]);
      setPolicy(policyData);
      if (interData && interData.interceptions) {
        setInterceptions(interData.interceptions);
        setTotalInterceptions(interData.total || interData.interceptions.length);
      }
    } catch (err) {
      console.error('Error loading governance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    fetchGovernanceData();
    const interval = setInterval(() => {
      fetchGovernanceData();
    }, 15000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-surface-light dark:bg-[#09090b] text-xs font-mono text-zinc-500">
        <div className="flex items-center space-x-2">
          <RefreshCw size={14} className="animate-spin text-blue-500" />
          <span>loading_governance_policy_and_live_interceptions...</span>
        </div>
      </div>
    );
  }

  // Filter interceptions
  const filteredInterceptions = interceptions.filter(item => {
    if (filterRisk === 'PII_MASKED') {
      const isPii = item.is_pii ||
                    item.agent_name === 'PIISanitizerAgent' || 
                    item.status === 'PII_MASKED' || 
                    String(item.risk_level).toUpperCase().includes('PII') ||
                    (item.masked_entities && item.masked_entities.length > 0) ||
                    (item.action_or_topic && item.action_or_topic.toLowerCase().includes('pii')) ||
                    (item.policy_justification && item.policy_justification.toLowerCase().includes('pii'));
      if (!isPii) return false;
    }
    if (filterRisk === 'REQUIRES_APPROVAL' && !item.requires_approval) return false;
    if (filterRisk === 'BLOCKED' && !item.is_blocked) return false;
    if (filterRisk === 'LOW' && !String(item.risk_level).toUpperCase().includes('LOW')) return false;
    if (filterRisk === 'MEDIUM' && !String(item.risk_level).toUpperCase().includes('MEDIUM')) return false;
    if (filterRisk === 'HIGH' && !String(item.risk_level).toUpperCase().includes('HIGH') && !String(item.risk_level).toUpperCase().includes('CRITICAL')) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTopic = item.action_or_topic && item.action_or_topic.toLowerCase().includes(q);
      const matchDomain = item.domain && item.domain.toLowerCase().includes(q);
      const matchJust = item.policy_justification && item.policy_justification.toLowerCase().includes(q);
      const matchSession = item.session_id && item.session_id.toLowerCase().includes(q);
      if (!matchTopic && !matchDomain && !matchJust && !matchSession) return false;
    }
    return true;
  });

  const piiCount = interceptions.filter(i => 
    i.is_pii || 
    i.agent_name === 'PIISanitizerAgent' || 
    i.status === 'PII_MASKED' || 
    String(i.risk_level).toUpperCase().includes('PII') ||
    (i.masked_entities && i.masked_entities.length > 0)
  ).length;
  const requiresApprovalCount = interceptions.filter(i => i.requires_approval).length;
  const blockedCount = interceptions.filter(i => i.is_blocked).length;
  const passedCount = interceptions.length - blockedCount;

  return (
    <div className="w-full h-full flex flex-col bg-surface-light dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-mono text-xs overflow-hidden">
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 justify-between items-center bg-white/80 dark:bg-[#111114]/80 backdrop-blur z-10 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold tracking-tight">zero_error_governance</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              live_telemetry_active
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
            Dual-Tier Cognitive & AST Deterministic Guardrails protecting Oracle Blue Yonder WMS
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Sub-tab Switcher */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px]">
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                activeSubTab === 'matrix'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Overview & Matrix
            </button>
            <button
              onClick={() => setActiveSubTab('interceptions')}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 cursor-pointer ${
                activeSubTab === 'interceptions'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Activity size={12} className={activeSubTab === 'interceptions' ? "text-blue-500" : "text-zinc-400"} />
              <span>Live Interceptions</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeSubTab === 'interceptions' 
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                {totalInterceptions}
              </span>
            </button>
          </div>

          <button
            onClick={() => fetchGovernanceData(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors shadow-2xs cursor-pointer flex items-center space-x-1 text-[11px]"
            title="Refresh Governance Data"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-blue-500' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center space-x-1.5 text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 font-semibold shadow-2xs">
            <ShieldCheck size={13} />
            <span>AST_ENFORCED_ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: LIVE CHAT INTERCEPTIONS & SAFETY AUDIT STREAM      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeSubTab === 'interceptions' && (
            <div className="space-y-4">
              
              {/* Section Header & Metrics KPI Row */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#111114] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Live Chat Interceptions & Cognitive Safety Stream</span>
                    </h3>
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Total Evaluated Invocations: <strong className="text-blue-600 dark:text-blue-400 font-bold">{totalInterceptions}</strong>
                  </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[11px]">
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400 text-[10px] uppercase font-semibold">Total Interceptions</div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{totalInterceptions}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400 text-[10px] uppercase font-semibold">PII Filtered</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{piiCount}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400 text-[10px] uppercase font-semibold">Zero Mutation Guard</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">100% Enforced</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400 text-[10px] uppercase font-semibold">Dual-Control Triggers</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{requiresApprovalCount}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 col-span-2 sm:col-span-1">
                    <div className="text-zinc-400 text-[10px] uppercase font-semibold">Clean Passes</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">{passedCount}</div>
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                  <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="filter by incident topic, domain, session ID..."
                    className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 text-[10px]">
                  {[
                    { id: 'ALL', label: 'All Interceptions' },
                    { id: 'PII_MASKED', label: 'PII Intercepted' },
                    { id: 'REQUIRES_APPROVAL', label: 'Requires Approval' },
                    { id: 'BLOCKED', label: 'Blocked' },
                    { id: 'LOW', label: 'Low Risk' },
                    { id: 'MEDIUM', label: 'Medium Risk' },
                    { id: 'HIGH', label: 'High / Critical' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterRisk(tab.id)}
                      className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap font-medium cursor-pointer border ${
                        filterRisk === tab.id
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 shadow-2xs font-semibold'
                          : 'bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 border-transparent hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

            {/* Interceptions Feed Cards */}
            {filteredInterceptions.length === 0 ? (
              <div className="p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] text-center text-zinc-400 dark:text-zinc-500">
                <ShieldCheck size={28} className="mx-auto mb-2 opacity-50 text-purple-500" />
                <div className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">No matching live interceptions found</div>
                <p className="text-[11px] mt-1">
                  Start an incident triage or general process investigation in Copilot Chat to see real-time governance evaluations recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInterceptions.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const isBlocked = item.is_blocked;
                  const reqApproval = item.requires_approval;
                  const isPii = item.is_pii || item.agent_name === 'PIISanitizerAgent' || item.status === 'PII_MASKED' || String(item.risk_level).toUpperCase().includes('PII');
                  const riskUpper = String(item.risk_level).toUpperCase();
                  
                  let riskBadgeClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800";
                  if (isPii || riskUpper.includes("PII")) {
                    riskBadgeClass = "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold";
                  } else if (riskUpper.includes("LOW")) {
                    riskBadgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                  } else if (riskUpper.includes("MEDIUM")) {
                    riskBadgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                  } else if (riskUpper.includes("HIGH") || riskUpper.includes("CRITICAL")) {
                    riskBadgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold";
                  }

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isBlocked
                          ? 'border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10'
                          : reqApproval
                          ? 'border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10'
                          : isPii
                          ? 'border-amber-500/30 bg-amber-50/10 dark:bg-amber-950/5'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] hover:border-zinc-300 dark:hover:border-zinc-700'
                      } shadow-xs`}
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${riskBadgeClass}`}>
                            {item.risk_level}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            isPii 
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' 
                              : 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                          }`}>
                            {item.tier_selected}
                          </span>

                          {item.domain && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              {item.domain}
                            </span>
                          )}

                          {isPii && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                              <ShieldAlert size={11} />
                              <span>{item.masked_count || 1} PII MASKED</span>
                            </span>
                          )}

                          {reqApproval && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                              <AlertTriangle size={11} />
                              <span>DUAL_CONTROL_TRIGGERED</span>
                            </span>
                          )}

                          {isBlocked && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                              <AlertOctagon size={11} />
                              <span>BLOCKED_BY_POLICY</span>
                            </span>
                          )}
                        </div>

                        {/* Timestamp & Latency */}
                        <div className="flex items-center space-x-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {item.execution_time_ms && (
                            <span>{Math.round(item.execution_time_ms)}ms</span>
                          )}
                          <span>•</span>
                          <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent'}</span>
                        </div>
                      </div>

                      {/* Incident / Topic Title */}
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 flex items-center justify-between">
                        <span className="truncate">{item.action_or_topic}</span>
                        
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-0.5 ml-2 cursor-pointer flex-shrink-0"
                        >
                          <span>{isExpanded ? 'Collapse' : 'Inspect Safety Trace'}</span>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      </div>

                      {/* Policy Justification */}
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                        {item.policy_justification}
                      </p>

                      {/* PII Masked Entities Chips */}
                      {item.is_pii && item.masked_entities && item.masked_entities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {item.masked_entities.map((ent, eIdx) => (
                            <span key={eIdx} className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800/70 shadow-2xs">
                              <strong className="opacity-75 font-semibold">{ent.type || 'PII'}:</strong> {ent.preview || ent.token}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expandable Safety Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5 text-[11px] bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-lg">
                          
                          {/* Recommended Action */}
                          <div>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">Recommended Resolution Path:</span>{' '}
                            <span className="text-zinc-600 dark:text-zinc-400">{item.recommended_action}</span>
                          </div>

                          {/* MOCA Command if applicable */}
                          {item.moca_command && (
                            <div className="p-2 rounded bg-zinc-900 text-zinc-100 font-mono text-[10.5px]">
                              <span className="text-blue-400 select-none font-bold mr-1">$ moca:</span>
                              <code>{item.moca_command}</code>
                            </div>
                          )}

                          {/* Pre-conditions */}
                          {item.preconditions && item.preconditions.length > 0 && (
                            <div>
                              <div className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Enforced Pre-Conditions:</div>
                              <ul className="space-y-1 pl-3 text-zinc-600 dark:text-zinc-400">
                                {item.preconditions.map((p, pIdx) => (
                                  <li key={pIdx} className="list-disc">{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Rollback Steps */}
                          {item.rollback_steps && item.rollback_steps.length > 0 && (
                            <div>
                              <div className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Deterministic Rollback Plan:</div>
                              <ul className="space-y-1 pl-3 text-zinc-600 dark:text-zinc-400">
                                {item.rollback_steps.map((r, rIdx) => (
                                  <li key={rIdx} className="list-disc">{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Audit Metadata Footer */}
                          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between text-[10px] text-zinc-400 font-mono">
                            <span>Agent: <strong>{item.agent_name}</strong></span>
                            <span>Session: <code className="text-zinc-500">{item.session_id}</code></span>
                            <span>Status: <strong className="text-emerald-500">{item.status}</strong></span>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: GOVERNANCE POLICY & GUARDRAIL SPEC MATRIX          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeSubTab === 'matrix' && (
            <div className="space-y-6">
              
              {/* Section 1: Three-Tier Guardrail Specification Header & Description */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <ShieldCheck size={14} className="text-blue-500" />
                  <span>Three-Tier Guardrail Specification</span>
                </div>
                <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
                  Yonder Graph protects enterprise Blue Yonder WMS environments using a three-tier safety architecture. Tier 1 performs cognitive policy and operational risk checks on every triage request, Tier 2 deterministically guarantees zero SQL mutation via AST parsing, and foundational Tier 0 operates entirely on-premise to mask all sensitive customer PII before prompts, live DB rows, uploaded runbooks, or SME feedback ever leave the local boundary.
                </p>
              </div>

              {/* Tier 1 & Tier 2 Comparison Cards (Top Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Tier 1 Box */}
                <div className="p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/20 dark:bg-[#111118] shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold flex items-center text-blue-600 dark:text-blue-400">
                        <ShieldCheck size={15} className="mr-1.5 text-blue-500" /> Tier 1: Cognitive Safety & Intent Governance
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        ai_supervisor_gate
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                      Supervises natural language queries and incident triage tickets. Evaluates operational risk, matches standard runbooks in Neo4j, and enforces organizational escalation policies before diagnostic steps or SQL scripts are generated.
                    </p>
                    <ul className="space-y-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Automated Incident Risk Triage:</strong> Evaluates prompt intent from Low to Critical risk against WMS operational boundaries.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>SOP & Runbook Alignment:</strong> Traverses verified Standard Operating Procedures (SOPs) in Neo4j to guarantee safe, recommended workflows.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Pre-Condition & Rollback Verification:</strong> Verifies transaction lock prerequisites and prepares deterministic rollback steps.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Multi-Persona Operational Context:</strong> Generates tailored operational summaries for L1 Floor Ops, L2 Support, and L3 SMEs.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Tier 2 Box */}
                <div className="p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/20 dark:bg-[#111118] shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold flex items-center text-blue-600 dark:text-blue-400">
                        <Lock size={15} className="mr-1.5 text-blue-500" /> Tier 2: Deterministic AST Hard Guard
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        sql_ast_validator
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                      A hard-coded Abstract Syntax Tree (AST) engine that inspects every generated SQL query at the token level. It operates independently of LLMs to deterministically guarantee zero database mutation and protect warehouse transaction stability.
                    </p>
                    <ul className="space-y-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Absolute Zero-Mutation Guarantee:</strong> Hard-blocks <code>DELETE</code>, <code>UPDATE</code>, <code>DROP</code>, <code>INSERT</code>, <code>ALTER</code>, and <code>TRUNCATE</code> tokens.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Strict Read-Only Enforcement:</strong> Permits only safe diagnostic statements (<code>SELECT</code>, <code>WITH</code>, <code>EXPLAIN PLAN</code>).</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Automatic Row Bound Injection:</strong> Automatically enforces <code>ROWNUM &lt;= 100</code> boundaries to prevent thread saturation and table locks.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                        <span><strong>Oracle Parameter Bind Sanitization:</strong> Validates extracted business keys (Order #, Wave ID, LPN) against regex patterns to eliminate injection.</span>
                      </li>
                    </ul>
                  </div>
                </div>

              </div>

              {/* Tier 0 Box — Foundational Guardrail (Horizontal Full Width underneath Tier 1 and Tier 2) */}
              <div className="p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/20 dark:bg-[#111118] shadow-xs">
                <div className="flex flex-wrap items-center justify-between mb-2.5 gap-2">
                  <span className="text-xs font-bold flex items-center text-blue-600 dark:text-blue-400">
                    <Shield size={15} className="mr-1.5 text-blue-500" /> Tier 0: Data Privacy & PII Perimeter (Foundational Guardrail)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    pii_sanitizer_perimeter • 0 GPU / On-Premise
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                  The foundational data security boundary running entirely on local CPU infrastructure. Automatically sanitizes sensitive customer identities, contact numbers, delivery addresses, and payment tokens across user chat prompts, live Oracle WMS query rows, Knowledge Studio document ingestion, and SME feedback loops before data ever leaves the local enterprise network.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-[11px] text-zinc-700 dark:text-zinc-300 pt-3 border-t border-blue-100 dark:border-blue-950/60">
                  <div className="flex items-start">
                    <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                    <span><strong>Inbound Prompt Tokenization:</strong> Masks emails, phones, names, and physical addresses to typed tokens (<code>&lt;PII_EMAIL_1&gt;</code>, <code>&lt;PII_NAME_1&gt;</code>) prior to cloud LLM dispatch.</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                    <span><strong>Live WMS Database Sanitization:</strong> Intercepts and scrubs sensitive tabular columns (names, addresses) in RAM before LLM context ingestion.</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                    <span><strong>Knowledge & SOP Document Stripping:</strong> Sanitizes uploaded SOP documents (PDF, Excel, Word, MD) before Neo4j graph embedding.</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-500 mr-2 select-none font-bold">▸</span>
                    <span><strong>SME Feedback & HITL Protection:</strong> Cleanses thumbs-down diagnostic corrections and runbook notes before knowledge graph patching.</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Four-Tier Remediation Policy Header & Description */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <Layers size={14} className="text-blue-500" />
                    <span>Four-Tier Remediation Policy Matrix</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
                    This graduated policy matrix establishes clear operational boundaries for IT support engineers and leadership. Routine read-only diagnostics and safe MOCA commands run autonomously at Level 1 and 2, while invasive inventory corrections and core database modifications at Level 3 and 4 enforce mandatory dual-control approvals, pre-conditions, and deterministic rollback plans to safeguard business continuity.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      level: 1,
                      name: "Level 1: Standard MOCA Diagnostics (Autonomous & Preferred)",
                      roleInYonder: "Primary automated triage level for Service Desk and Floor Operations. Yonder Graph safely inspects order, inventory, and wave states using pre-approved read-only MOCA commands and AST-bounded SELECT queries without impacting warehouse inventory states.",
                      scope: ["Inventory balance lookups", "Order waving & load checks", "LPN location verification", "Integrator message status"],
                      approval: "Autonomous — Pre-approved for all IT Support Engineers",
                      badgeClass: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                      badgeText: "Autonomous / Safe"
                    },
                    {
                      level: 2,
                      name: "Level 2: Web UI & DDA Configuration Guidance (Low Risk)",
                      roleInYonder: "Directs support engineers through standard Blue Yonder WMS administrative screens (e.g. Work Queue Manager, Configuration Studio). Solves operational anomalies through verified UI workflows without requiring backend script execution or database mutations.",
                      scope: ["Releasing non-critical QC holds", "Resetting wave allocation thresholds", "Adjusting location operational flags", "Re-queuing pick work"],
                      approval: "Level 2 Application Support Engineer",
                      badgeClass: "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                      badgeText: "UI Guided Workflow"
                    },
                    {
                      level: 3,
                      name: "Level 3: Governed Dry-Run Remediation (Medium-to-High Risk)",
                      roleInYonder: "Manages invasive corrective actions for stuck transactions and allocation mismatches. Yonder Graph generates deterministic dry-run PL/SQL blocks and enforces strict pre-condition checks, requiring explicit review and dual-control sign-off from a designated WMS SME before execution.",
                      scope: ["Orphaned wave un-allocation", "Stuck pick task requeueing", "Pessimistic inventory lock release", "MOCA command parameter overrides"],
                      approval: "Mandatory SME / Lead Support Engineer Authorization",
                      badgeClass: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-semibold",
                      badgeText: "SME Approval Required"
                    },
                    {
                      level: 4,
                      name: "Level 4: Core Architecture & Database Interventions (Critical Risk)",
                      roleInYonder: "Reserved for critical production incidents and emergency data repairs where standard MOCA or UI workflows cannot resolve the failure. Enforces multi-party cryptographic authorization, mandatory backup verification, and automated rollback scripts.",
                      scope: ["Direct table-level data patch", "Schema constraint repair", "Integrator queue purging", "Corrupted transaction rollback"],
                      approval: "Mandatory IT Support Manager & Principal DBA Sign-Off",
                      badgeClass: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 font-bold",
                      badgeText: "Manager & DBA Sign-Off"
                    }
                  ].map((tier) => (
                    <div 
                      key={tier.level} 
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs flex items-start gap-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-800">
                        L{tier.level}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{tier.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${tier.badgeClass}`}>
                            {tier.badgeText}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {tier.roleInYonder}
                        </p>
                        <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-zinc-400 font-semibold uppercase text-[9px]">Typical Actions:</span>
                            {tier.scope.map((s, sIdx) => (
                              <span 
                                key={sIdx} 
                                className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400 font-mono">
                            <strong className="text-zinc-700 dark:text-zinc-300">Gate:</strong> {tier.approval}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Deterministic AST Hard Guard Rules */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <Terminal size={14} className="text-blue-500" />
                    <span>Deterministic AST Hard Guard Rules</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Real-time SQL token validation executed by Yonder Graph before query results or SQL scripts are presented to the support team.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Hard-Blocked Tokens */}
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs">
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 flex items-center space-x-1.5">
                      <AlertOctagon size={14} className="text-rose-500" />
                      <span>Hard-Blocked Mutation Tokens</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mb-2.5">
                      Any generated script containing these keywords is immediately rejected at AST parse time:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(policy.governance_tiers?.tier2?.blocked_tokens || [
                        'ALTER', 'COMMENT', 'CREATE', 'DELETE', 'DROP', 'GRANT', 'INSERT', 'LOCK', 'MERGE', 'RENAME', 'REVOKE', 'TRUNCATE', 'UPDATE'
                      ]).map(token => (
                        <span 
                          key={token} 
                          className="text-[10px] font-mono font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/60 shadow-2xs"
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Allowed Statements */}
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs">
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 flex items-center space-x-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Permitted Query Statements</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mb-2.5">
                      Only non-mutating statement types are approved for operational triage:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(policy.governance_tiers?.tier2?.allowed_statements || [
                        'EXPLAIN PLAN', 'SELECT', 'WITH'
                      ]).map(stmt => (
                        <span 
                          key={stmt} 
                          className="text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/60 shadow-2xs"
                        >
                          {stmt}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-300 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                      <span>Automatic Row Limit Safeguard:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                        {policy.governance_tiers?.tier2?.row_limit || 100} rows max
                      </span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
