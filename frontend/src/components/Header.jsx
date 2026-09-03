import React, { useEffect, useState } from 'react';
import { Terminal, Moon, Sun, Cpu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function Header() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.checkHealth();
        setHealth(data);
      } catch (e) {
        setHealth({ status: 'error' });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div className="h-7 w-7 rounded bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 font-mono font-bold text-xs">
          yg
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm font-semibold tracking-tight">yonder_graph</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600 hidden sm:inline">v2.1</span>
          <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800">
            oracle_wms
          </span>
        </div>
      </div>

      {/* Live System Status */}
      <div className="flex items-center space-x-4">
        {health && (
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            {/* Neo4j */}
            <div className="flex items-center space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${health.services?.neo4j === 'connected' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-rose-500'}`}></span>
              <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">neo4j</span>
            </div>

            {/* Audit DB */}
            <div className="flex items-center space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${health.services?.postgresql === 'connected' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-rose-500'}`}></span>
              <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">postgres</span>
            </div>

            {/* Active LLM */}
            {health.llm_provider && (
              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 text-[10px]">
                <Cpu size={10} className="text-[#CF1F2E]" />
                <span>{health.llm_provider.provider}</span>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800"></div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
