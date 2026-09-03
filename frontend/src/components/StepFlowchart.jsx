import React from 'react';
import { Database } from 'lucide-react';

export default function StepFlowchart({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="relative my-3 font-mono">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold mb-2 flex items-center space-x-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#CF1F2E]"></span>
        <span>Sequential Process Architecture</span>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Vertical Dotted Connector Line */}
        <div className="absolute left-2.5 top-3 bottom-3 w-px border-l-2 border-dotted border-[#CF1F2E]/50 dark:border-[#F87171]/40 pointer-events-none" />

        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Step Number Circle */}
            <div className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 border border-[#CF1F2E]/50 text-[#CF1F2E] dark:text-[#F87171] font-bold text-[10px] shadow-xs z-10">
              {step.step_number || idx + 1}
            </div>

            {/* Step Card */}
            <div className="p-3 bg-white dark:bg-[#121216] border border-zinc-200/80 dark:border-zinc-800 rounded-lg shadow-2xs hover:border-[#CF1F2E]/50 dark:hover:border-[#F87171]/30 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  {step.title}
                </span>
                
                {step.tables && step.tables.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    {step.tables.map((tbl, tIdx) => (
                      <span 
                        key={tIdx} 
                        className="px-1.5 py-0.5 rounded bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] text-[10px] border border-[#CF1F2E]/30 dark:border-[#F87171]/30 flex items-center space-x-1"
                      >
                        <Database size={9} />
                        <span>{tbl}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
