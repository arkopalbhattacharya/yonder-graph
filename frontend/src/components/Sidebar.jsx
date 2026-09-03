import React, { useEffect, useState, useRef } from 'react';
import { 
  PanelLeftClose,
  Pin,
  Trash2,
  MessageSquare,
  Clock,
  Moon,
  Sun,
  User,
  Bell,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  ChevronUp,
  FlaskConical,
  Radar,
  Info,
  ShieldAlert,
  AlertTriangle,
  X,
  Zap,
  Lock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  setIsCollapsed, 
  sessions = [], 
  activeSessionId, 
  onSelectSession, 
  onNewChat, 
  onTogglePin, 
  onDeleteSession 
}) {
  const { isDarkMode, toggleTheme } = useTheme();
  const { 
    enableAskMode = false, 
    toggleAskMode = () => {}, 
    enableFileUpload = false, 
    toggleFileUpload = () => {}, 
    enableShowReasoning = false, 
    toggleShowReasoning = () => {}, 
    enableSentinel = false, 
    toggleSentinel = () => {},
    enableChatFollowup = false,
    toggleChatFollowup = () => {},
  } = useSettings() || {};
  const [health, setHealth] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSentinelInfoOpen, setIsSentinelInfoOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Check health and pending human reviews
  const fetchStatus = async () => {
    try {
      const [healthData, reviewsData] = await Promise.all([
        api.checkHealth().catch(() => ({ status: 'error' })),
        api.getPendingReviews().catch(() => []),
      ]);
      setHealth(healthData);
      setPendingReviews(reviewsData || []);
    } catch (err) {
      console.warn("Status fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const navItems = [
    { id: 'graph', label: 'graph' },
    { id: 'agents', label: 'agents' },
    { id: 'studio', label: 'studio' },
    { id: 'governance', label: 'governance' },
    { id: 'metrics', label: 'metrics' },
  ];

  const pinnedSessions = sessions.filter(s => s.is_pinned).slice(0, 5);
  const recentSessions = sessions.filter(s => !s.is_pinned).slice(0, 5);
  const pendingCount = pendingReviews.length;

  const handleNavigateToReview = () => {
    setActiveTab('studio');
    setIsUserMenuOpen(false);
  };

  return (
    <aside 
      className={`h-screen flex flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#141418] backdrop-blur transition-all duration-200 flex-shrink-0 z-40 font-mono text-xs ${
        isCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-56 sm:w-64'
      }`}
    >
      {/* ── Brand & Collapse Header ── */}
      <div className="p-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#CF1F2E] flex items-center justify-center text-white font-black text-xs shadow-xs">
            yg
          </div>
          <div>
            <div className="font-mono font-extrabold text-sm sm:text-[15px] text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
              yonder_graph
            </div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
              enterprise wms graph-rag
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* ── Top New Chat Button ── */}
      <div className="p-2.5 pb-1 flex-shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center py-2 px-3 rounded-lg bg-[#CF1F2E] hover:bg-[#B71825] active:bg-[#9B2C2C] dark:bg-[#CF1F2E] dark:hover:bg-[#E53E3E] text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <span>+ new chat</span>
        </button>
      </div>

      {/* ── Sidebar Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4 custom-scrollbar">
        {/* Pinned Section */}
        {pinnedSessions.length > 0 && (
          <div>
            <div className="px-2 py-1 flex items-center space-x-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Pin size={10} className="fill-current" />
              <span>Pinned ({pinnedSessions.length})</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {pinnedSessions.map((s) => (
                <SessionItem 
                  key={s.session_id} 
                  session={s} 
                  isActive={s.session_id === activeSessionId}
                  onSelect={() => onSelectSession(s.session_id)}
                  onTogglePin={(e) => onTogglePin(s.session_id, s.is_pinned, e)}
                  onDelete={(e) => onDeleteSession(s.session_id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Section */}
        <div>
          <div className="px-2 py-1 flex items-center space-x-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            <Clock size={10} />
            <span>Recent</span>
          </div>
          <div className="space-y-0.5 mt-1">
            {recentSessions.length === 0 && pinnedSessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-zinc-400 dark:text-zinc-600 text-[11px]">
                No conversation history
              </div>
            ) : (
              recentSessions.map((s) => (
                <SessionItem 
                  key={s.session_id} 
                  session={s} 
                  isActive={s.session_id === activeSessionId}
                  onSelect={() => onSelectSession(s.session_id)}
                  onTogglePin={(e) => onTogglePin(s.session_id, s.is_pinned, e)}
                  onDelete={(e) => onDeleteSession(s.session_id, e)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── AUTONOMY Section (Highlighted Sentinel in Red Accent - Experimental) ── */}
        {enableSentinel && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <div className="flex items-center space-x-1.5">
                <Radar size={11} className="animate-pulse text-rose-500" />
                <span>AUTONOMY</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                ALPHA
              </span>
            </div>

            <div className="mt-1 group relative">
              <div
                onClick={() => setActiveTab('sentinel')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all font-mono text-xs cursor-pointer border ${
                  activeTab === 'sentinel'
                    ? 'bg-gradient-to-r from-rose-500/15 via-red-500/10 to-rose-500/15 border-rose-500/50 text-rose-950 dark:text-rose-200 font-bold shadow-xs'
                    : 'border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 hover:border-rose-500/40'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="flex h-2 w-2 relative flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="font-extrabold tracking-tight">SENTINEL</span>
                </div>

                {/* Hover Info Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSentinelInfoOpen(true);
                  }}
                  className="p-1 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 opacity-60 hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
                  title="Sentinel IT Details & Cautionary Briefing"
                >
                  <Info size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation Links (under Autonomy) ── */}
        <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const hasNotification = item.id === 'studio' && pendingCount > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-all font-mono text-xs cursor-pointer ${
                    isActive
                      ? 'bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] font-semibold shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {hasNotification && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Partnership Monospace Brand Label ── */}
      <div className="px-3 py-1.5 flex items-center justify-center select-none flex-shrink-0">
        <span className="font-mono text-[9px] font-bold tracking-[0.28em] text-zinc-400 dark:text-zinc-600 uppercase">
          MICHAELS x TCS
        </span>
      </div>

      {/* ── Footer: User Profile & Notification Center ── */}
      <div className="relative p-2.5 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#0e0e11]/80" ref={userMenuRef}>
        
        {/* User Profile Trigger Button */}
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all ${
            isUserMenuOpen 
              ? 'bg-zinc-200/80 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-xs' 
              : 'bg-white dark:bg-[#111114] border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center space-x-2.5 truncate">
            {/* User Avatar with Notification Badge */}
            <div className="relative flex-shrink-0">
              <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                <User size={14} />
              </div>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-xs animate-pulse">
                  {pendingCount}
                </span>
              )}
            </div>

            <div className="text-left truncate">
              <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                it.ops_sme
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                {pendingCount > 0 ? `${pendingCount} review${pendingCount > 1 ? 's' : ''} pending` : 'all systems nominal'}
              </div>
            </div>
          </div>

          <ChevronUp size={13} className={`text-zinc-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* ── User Profile & Settings Popover Menu ── */}
        {isUserMenuOpen && (
          <div className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-3 space-y-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 font-mono text-xs">
            
            {/* Profile Info Card */}
            <div className="pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                <User size={16} />
              </div>
              <div>
                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">IT Operations SME</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">tier1.approver@yonder.wms</div>
              </div>
            </div>

            {/* Notification / HITL Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center space-x-1">
                  <Bell size={10} className={pendingCount > 0 ? "text-amber-500" : ""} />
                  <span>Human Review Queue</span>
                </span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                    {pendingCount} flagged
                  </span>
                )}
              </div>

              {pendingCount > 0 ? (
                <div className="space-y-1">
                  {pendingReviews.slice(0, 2).map((item, i) => (
                    <div 
                      key={i}
                      onClick={handleNavigateToReview}
                      className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-amber-700 dark:text-amber-300 truncate max-w-[130px]">
                          {item.source_file}
                        </span>
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          {item.evaluation?.confidence_score}%
                        </span>
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5 flex items-center justify-between">
                        <span>Flagged by Enrichment Agent</span>
                        <span className="text-amber-600 dark:text-amber-400 flex items-center">
                          Review <ExternalLink size={9} className="ml-0.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                  {pendingCount > 2 && (
                    <button 
                      onClick={handleNavigateToReview}
                      className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 pt-1"
                    >
                      +{pendingCount - 2} more in SME Review Queue →
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 flex items-center space-x-1.5 text-zinc-500 text-[11px]">
                  <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                  <span>All knowledge entries verified</span>
                </div>
              )}
            </div>

            {/* ── Experimental Features ── */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center space-x-1">
                  <FlaskConical size={11} className="text-purple-500" />
                  <span>Experimental Features</span>
                </span>
              </div>

              {/* Ask Mode Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <div className="pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                    <span>Ask Mode</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                      BETA
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                    AskProcessAgent for schema mappings & flows
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleAskMode}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                    enableAskMode ? 'bg-[#CF1F2E] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableAskMode ? "Disable Ask Mode" : "Enable Ask Mode"}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              {/* File Upload Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <div className="pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                    <span>Document Upload</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                      BETA
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                    Upload documents to enrich knowledge graph
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFileUpload}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                    enableFileUpload ? 'bg-[#CF1F2E] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableFileUpload ? "Disable Document Upload" : "Enable Document Upload"}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              {/* Show Reasoning Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <div className="pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                    <span>Agent Reasoning</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                      BETA
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                    Show cognitive reasoning behind Resolve responses
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleShowReasoning}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                    enableShowReasoning ? 'bg-[#CF1F2E] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableShowReasoning ? "Disable Agent Reasoning" : "Enable Agent Reasoning"}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              {/* Sentinel Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <div className="pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                    <span>Sentinel</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800">
                      ALPHA
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                    Autonomous 24/7 proactive WMS health scanner
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleSentinel}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                    enableSentinel ? 'bg-[#CF1F2E] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableSentinel ? "Disable Sentinel" : "Enable Sentinel"}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              {/* Chat Follow-ups Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <div className="pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                    <span>Chat Follow-ups</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                      BETA
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-tight">
                    Multi-turn follow-up queries with session context management
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleChatFollowup}
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                    enableChatFollowup ? 'bg-[#CF1F2E] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableChatFollowup ? "Disable Chat Follow-ups" : "Enable Chat Follow-ups"}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>
            </div>

            {/* Theme Toggle Button */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">Appearance</span>
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors"
                title="Toggle Light / Dark Theme"
              >
                {isDarkMode ? (
                  <>
                    <Moon size={12} className="text-purple-400" />
                    <span className="text-[11px]">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun size={12} className="text-amber-500" />
                    <span className="text-[11px]">Light</span>
                  </>
                )}
              </button>
            </div>

            {/* System Status Indicators */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${health?.services?.neo4j === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>neo4j</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${health?.services?.postgresql === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>pg</span>
                </div>
              </div>

              {health?.llm_provider && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {health.llm_provider.provider}
                </span>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Sentinel IT Architecture & Cautionary Modal ── */}
      {isSentinelInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 custom-scrollbar">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Radar size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                    Predictive Sentinel Engine
                  </h3>
                  <div className="text-[10px] text-zinc-400 font-medium">
                    IT Architecture, Sweep Mechanics & Operational Caution
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsSentinelInfoOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 1. What It Is */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                <Zap size={13} className="text-indigo-500" />
                <span>1. What It Is</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                The Sentinel is an <strong>autonomous, 24/7 background diagnostic daemon</strong> (the 10th agent in the squad). Instead of waiting for warehouse floor pickers or support engineers to report stalled orders, Sentinel continuously sweeps connected Oracle WMS tables to detect operational bottlenecks in real time.
              </p>
            </div>

            {/* 2. What It Does */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>2. What It Does</span>
              </div>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1.5 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60">
                <li className="flex items-start space-x-1.5">
                  <span className="text-[#CF1F2E] font-bold">•</span>
                  <span><strong>Outbound Waves:</strong> Detects allocation shortfalls in <code className="text-zinc-800 dark:text-zinc-200 font-bold">PCKWAV</code> & <code className="text-zinc-800 dark:text-zinc-200 font-bold">ORD_LINE</code> before pickers stall.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span><strong>Inbound Docks:</strong> Flags stagnant trailers checked into <code className="text-zinc-800 dark:text-zinc-200 font-bold">RCVTRK</code> for &gt;4h without active receiving lines.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-purple-500 font-bold">•</span>
                  <span><strong>Inventory Holds:</strong> Identifies high-velocity SKUs locked on hold in <code className="text-zinc-800 dark:text-zinc-200 font-bold">INVDTL</code> blocking active demand.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span><strong>Autonomous Pre-Triage:</strong> Upon anomaly detection, automatically runs the 7-agent squad in background to generate complete L1/L2/L3 investigation steps in 1.2s.</span>
                </li>
              </ul>
            </div>

            {/* 3. Why It Should Be Used With Caution */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle size={13} />
                <span>3. Operational Caution & IT Advisory</span>
              </div>
              <div className="text-[11px] text-amber-900 dark:text-amber-300/90 leading-relaxed bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-500/30 space-y-1.5">
                <p>
                  <strong>• Live Database Queries:</strong> Continuous background sweeps execute read queries against your Oracle WMS host at the configured interval (e.g. every 60s).
                </p>
                <p>
                  <strong>• Recommended Target:</strong> Always point Sentinel to an <strong>Oracle Active Data Guard Read Replica</strong> or a <strong>Dedicated Dev/Test Instance</strong>. Avoid pointing sweeps to primary master OLTP nodes under heavy peak warehouse shifts without DBA query index reviews.
                </p>
                <p>
                  <strong>• Human-in-the-Loop (HITL):</strong> While Sentinel diagnostic reads are 100% automated and safe, elevated remediation fixes (Tier 3/4 MOCA state adjustments) must still be reviewed by human engineers.
                </p>
              </div>
            </div>

            {/* 4. Zero-Mutation Guarantee */}
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-300 text-[10.5px] space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <Lock size={12} className="text-emerald-600 dark:text-emerald-400" />
                <span>Zero-Mutation Guarantee</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-400/90">
                Protected by 4-layer defense in depth: Pre-execution AST validation, session-level <code className="bg-emerald-500/20 px-1 py-0.2 rounded">SET TRANSACTION READ ONLY</code>, and strict DB role <code className="font-bold">GRANT SELECT</code> air gap. All write operations are impossible.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <button
                onClick={() => setIsSentinelInfoOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setIsSentinelInfoOpen(false);
                  setActiveTab('sentinel');
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Radar size={13} />
                <span>Open Sentinel View</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </aside>
  );
}

function SessionItem({ session, isActive, onSelect, onTogglePin, onDelete }) {
  return (
    <div
      onClick={onSelect}
      className={`group px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-start justify-between text-xs ${
        isActive
          ? 'bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] font-semibold shadow-2xs'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200'
      }`}
    >
      <div className="flex-1 mr-1.5 text-left leading-snug whitespace-normal break-words">
        <span className="text-[11px] break-words inline-block leading-snug">
          {session.title}
        </span>
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
        <button
          onClick={onTogglePin}
          className={`p-1 rounded hover:bg-zinc-300/60 dark:hover:bg-zinc-800 ${
            session.is_pinned ? 'text-amber-500 opacity-100' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
          title={session.is_pinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin size={10} className={session.is_pinned ? 'fill-current' : ''} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-zinc-300/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400"
          title="Delete Conversation"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
