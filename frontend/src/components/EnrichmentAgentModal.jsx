import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Database, 
  ShieldCheck, 
  FileText, 
  Cpu, 
  Layers, 
  ArrowRight,
  Clock
} from 'lucide-react';

export default function EnrichmentAgentModal({ 
  isOpen, 
  onClose, 
  isUploading, 
  uploadProgressStep = 0,
  uploadResult, 
  selectedFileName,
  error 
}) {
  if (!isOpen) return null;

  const steps = uploadResult?.result?.agentic_steps || [
    { step_id: 1, name: "Document Parsing & Text Extraction", agent: "EnrichmentAgent:DocParser", details: "Extracting raw text from document buffer..." },
    { step_id: 2, name: "Schema Grounding & Table Mapping", agent: "EnrichmentAgent:SchemaMatcher", details: "Matching WMS table entities (INBORD, RCVTRK, LOCMST, INVDTL)..." },
    { step_id: 3, name: "Tier 2 SQL/MOCA AST Security Validation", agent: "GovernanceGuard:ASTValidator", details: "Validating AST read-only compliance and mutation rules..." },
    { step_id: 4, name: "Structural Metadata Analysis", agent: "EnrichmentAgent:MetadataScorer", details: "Scoring SOP runbook sections and business key consistency..." },
    { step_id: 5, name: "WMS Supply Chain Domain Alignment", agent: "EnrichmentAgent:DomainClassifier", details: "Classifying domain taxonomy against Inbound/Outbound/Inventory..." },
    { step_id: 6, name: "AI Entity & Graph Relationship Extraction", agent: "EnrichmentAgent:GraphExtractor", details: "Generating structured ontology entities and taxonomic links..." },
    { step_id: 7, name: "Neo4j Knowledge Graph Ingestion", agent: "EnrichmentAgent:GraphMutator", details: "Merging nodes and relations into Neo4j graph DB..." },
  ];

  const resultData = uploadResult?.result;
  const confidenceScore = resultData?.confidence_score ?? 0;
  const isAutoIngested = resultData?.decision === 'AUTO_INGEST';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-mono text-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] border border-[#CF1F2E]/30 dark:border-[#F87171]/40">
              <Cpu size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Enrichment Agentic Loop
                </h3>
                {isUploading ? (
                  <span className="flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] border border-[#CF1F2E]/30 dark:border-[#F87171]/40 font-semibold">
                    <Loader2 size={10} className="animate-spin" />
                    <span>RUNNING_LOOP</span>
                  </span>
                ) : uploadResult ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                    isAutoIngested 
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  }`}>
                    {resultData?.decision || 'COMPLETED'}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-md">
                Document: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedFileName || 'document'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-400 flex items-start space-x-2 text-xs">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Ingestion Agent Error:</strong> {error}
              </div>
            </div>
          )}

          {/* ── Summary Metrics Card (When Finished) ── */}
          {uploadResult && resultData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Confidence Score Pill */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Confidence Rubric</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-2xl font-bold ${
                    confidenceScore >= 90 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : confidenceScore >= 70 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {confidenceScore}%
                  </span>
                  <span className="text-[10px] text-zinc-400">/ 100 pts</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      confidenceScore >= 90 ? 'bg-emerald-500' : confidenceScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                    }`} 
                    style={{ width: `${Math.min(confidenceScore, 100)}%` }}
                  />
                </div>
              </div>

              {/* Ingestion Decision */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Target Action</span>
                <div className="flex items-center space-x-1.5 mt-1">
                  <Database size={16} className={isAutoIngested ? 'text-emerald-500' : 'text-amber-500'} />
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    {isAutoIngested ? 'Neo4j Graph Merged' : 'Staged for SME Review'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-2 truncate">
                  {resultData.extracted_entities?.length || 0} entities linked
                </span>
              </div>

              {/* Execution Latency */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Loop Duration</span>
                <div className="flex items-center space-x-1.5 mt-1">
                  <Clock size={16} className="text-[#CF1F2E]" />
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    {resultData.duration_ms || 0} ms
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-2 truncate">
                  AST Tier 2 Verified
                </span>
              </div>
            </div>
          )}

          {/* ── Agentic Loop Stepper Timeline ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5">
              <Layers size={13} className="text-[#CF1F2E]" />
              <span>Agentic Execution Trace</span>
            </h4>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200 dark:before:bg-zinc-800">
              {steps.map((step, idx) => {
                const isStepFinished = uploadResult || (isUploading && uploadProgressStep > idx);
                const isStepActive = isUploading && uploadProgressStep === idx;
                const isStepPending = isUploading && uploadProgressStep < idx;

                return (
                  <div key={step.step_id || idx} className="relative group">
                    {/* Node Dot / Status Indicator */}
                    <div className={`absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold transition-all ${
                      isStepFinished 
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs' 
                        : isStepActive 
                          ? 'bg-[#CF1F2E] text-white border-[#B71825] animate-pulse shadow-xs' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                    }`}>
                      {isStepFinished ? (
                        <CheckCircle2 size={12} className="stroke-[3]" />
                      ) : isStepActive ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {/* Step Content Card */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      isStepActive 
                        ? 'bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 border-[#CF1F2E]/30 dark:border-[#CF1F2E]/40 shadow-xs' 
                        : isStepFinished 
                          ? 'bg-zinc-50/70 dark:bg-[#151518] border-zinc-200 dark:border-zinc-800/80' 
                          : 'bg-zinc-50/30 dark:bg-[#111114] border-zinc-200/50 dark:border-zinc-800/40 opacity-50'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {step.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                            {step.agent}
                          </span>
                        </div>
                        {step.score && (
                          <span className="text-[10px] font-bold text-[#CF1F2E] dark:text-[#F87171] bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 px-2 py-0.5 rounded-full border border-[#CF1F2E]/30 dark:border-[#F87171]/40">
                            {step.score}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                        {step.details}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Extracted Entities & WMS Tables Badges ── */}
          {resultData?.extracted_entities && resultData.extracted_entities.length > 0 && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h5 className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5">
                <Sparkles size={12} className="text-amber-500" />
                <span>Extracted Knowledge Entities ({resultData.extracted_entities.length})</span>
              </h5>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {resultData.extracted_entities.map((ent, idx) => (
                  <div 
                    key={idx} 
                    className="px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="font-semibold text-[#CF1F2E] dark:text-[#F87171]">[{ent.type || 'Node'}]</span>
                    <span>{ent.name}</span>
                    {ent.domain && (
                      <span className="text-[9px] text-zinc-400 font-mono">({ent.domain})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Grounded Oracle WMS Tables ── */}
          {resultData?.matched_tables && resultData.matched_tables.length > 0 && (
            <div className="flex items-center space-x-2 text-[11px] text-zinc-500 font-mono">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Grounded WMS Tables:</span>
              <div className="flex flex-wrap gap-1">
                {resultData.matched_tables.map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex justify-end items-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-semibold text-xs transition-colors"
          >
            {isUploading ? "Running in background..." : "Close Loop"}
          </button>
        </div>

      </div>
    </div>
  );
}
