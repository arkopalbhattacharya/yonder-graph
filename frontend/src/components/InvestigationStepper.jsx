import React, { useState } from 'react';
import { Terminal, ShieldCheck, Zap, Copy, Check, Download } from 'lucide-react';
import { api } from '../services/api';
import CodeCard from './CodeCard';

export default function InvestigationStepper({ steps, sessionId }) {
  const [consolidatedSQL, setConsolidatedSQL] = useState(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [hasCopiedAll, setHasCopiedAll] = useState(false);

  if (!steps || steps.length === 0) return null;

  const hasAnySQL = steps.some((s) => s.diagnostic_sql && s.diagnostic_sql.trim());

  const handleConsolidateSQL = async () => {
    setIsConsolidating(true);
    try {
      const res = await api.consolidateSQL(steps, sessionId);
      setConsolidatedSQL(res);
    } catch (err) {
      console.error("SQL consolidation failed:", err);
    } finally {
      setIsConsolidating(false);
    }
  };

  const copyConsolidated = () => {
    if (!consolidatedSQL?.consolidated_sql) return;
    navigator.clipboard.writeText(consolidatedSQL.consolidated_sql);
    setHasCopiedAll(true);
    setTimeout(() => setHasCopiedAll(false), 2000);
  };

  const downloadConsolidated = () => {
    if (!consolidatedSQL?.consolidated_sql) return;
    const blob = new Blob([consolidatedSQL.consolidated_sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_diagnostic_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3.5 font-mono">
      <div className="text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold mb-2.5 flex items-center space-x-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
        <span>Ordered Investigation Steps</span>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Vertical Dotted Connector Line */}
        <div className="absolute left-2.5 top-3 bottom-3 w-px border-l-2 border-dotted border-purple-400/50 dark:border-purple-500/40 pointer-events-none" />

        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Step Number Badge */}
            <div className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-purple-50 dark:bg-purple-950/80 border border-purple-500/60 text-purple-600 dark:text-purple-400 font-bold text-[10px] shadow-xs z-10">
              {step.step_number || idx + 1}
            </div>

            {/* Step Card */}
            <div className="p-3.5 bg-white dark:bg-[#121216] border border-zinc-200/80 dark:border-zinc-800 rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  {step.step_title || `Step ${step.step_number}`}
                </span>
                {step.diagnostic_sql && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] border border-emerald-200/50 dark:border-emerald-900/40 flex items-center space-x-1">
                    <ShieldCheck size={10} />
                    <span>Tier 2 AST Safe</span>
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {step.description}
              </p>

              {/* Per-Step Diagnostic SQL */}
              {step.diagnostic_sql && (
                <div className="pt-1.5">
                  <CodeCard 
                    title={`Diagnostic SQL — Step ${step.step_number || idx + 1}`}
                    code={step.diagnostic_sql}
                    language="sql"
                  />
                </div>
              )}

              {/* Expected Outcome */}
              {step.expected_outcome && (
                <div className="text-[10px] bg-zinc-50 dark:bg-[#0e0e11] p-2 rounded border border-zinc-200/60 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Expected Outcome: </span>
                  <span>{step.expected_outcome}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Button to Generate Full Consolidated SQL Script */}
      {hasAnySQL && (
        <div className="mt-4 pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
          {!consolidatedSQL ? (
            <button
              onClick={handleConsolidateSQL}
              disabled={isConsolidating}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-purple-950/60 dark:hover:bg-purple-900/70 border border-zinc-700 dark:border-purple-800/60 text-white dark:text-purple-200 text-xs font-semibold shadow-xs transition-colors"
            >
              <Zap size={13} className="text-amber-400" />
              <span>{isConsolidating ? 'Consolidating SQL Scripts...' : 'Generate Full Consolidated SQL Script'}</span>
            </button>
          ) : (
            <div className="p-3 bg-zinc-900 dark:bg-[#09090b] border border-purple-900/60 rounded-lg text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-purple-300 font-semibold">
                  <Terminal size={13} className="text-purple-400" />
                  <span>Consolidated Oracle Diagnostic Script</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={copyConsolidated}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] flex items-center space-x-1 px-2"
                    title="Copy Script"
                  >
                    {hasCopiedAll ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{hasCopiedAll ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={downloadConsolidated}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] flex items-center space-x-1 px-2"
                    title="Download .sql"
                  >
                    <Download size={11} />
                    <span>.sql</span>
                  </button>
                </div>
              </div>

              <pre className="p-2.5 bg-black/60 rounded border border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto custom-scrollbar leading-relaxed">
                {consolidatedSQL.consolidated_sql}
              </pre>

              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="text-emerald-400 flex items-center space-x-1">
                  <ShieldCheck size={11} />
                  <span>Tier 2 AST Safeguard Verified</span>
                </span>
                <span>{consolidatedSQL.step_count} step queries merged</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
