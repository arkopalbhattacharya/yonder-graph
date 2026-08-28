import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export default function CodeCard({ title, code, language = 'sql', className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-mono ${className}`}>
      <div className="border-b border-zinc-200 dark:border-zinc-800/80 px-3 py-1.5 flex items-center justify-between bg-zinc-100/70 dark:bg-zinc-900/60 text-[11px]">
        <div className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400">
          <Terminal size={12} className="text-zinc-500" />
          <span className="font-medium truncate">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-0.5 rounded"
          title="Copy to clipboard"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
      </div>
      <div className="p-3 overflow-x-auto custom-scrollbar">
        <pre className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
