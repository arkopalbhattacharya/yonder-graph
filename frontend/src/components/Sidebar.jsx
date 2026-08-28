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
  FlaskConical
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
  const { enableAskMode, toggleAskMode, enableFileUpload, toggleFileUpload, enableShowReasoning, toggleShowReasoning } = useSettings();
  const [health, setHealth] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Check health and pending human reviews
  const fetchStatus = async () => {
    try {
      const [healthData, reviewsData] = await Promise.all([
        api.checkHealth().catch(() => ({ status: 'error' })),
        api.getPendingReviews().catch(() => ({ pending_reviews: [] }))
      ]);
      setHealth(healthData);
      setPendingReviews(reviewsData?.pending_reviews || []);
    } catch (e) {
      console.warn("Status fetch failed", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
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
  ];

  const pinnedSessions = sessions.filter(s => s.is_pinned);
  const recentSessions = sessions.filter(s => !s.is_pinned);
  const pendingCount = pendingReviews.length;

  const handleNavigateToReview = () => {
    setActiveTab('studio');
    setIsUserMenuOpen(false);
  };

  return (
    <aside 
      className={`h-screen flex flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0c0f] backdrop-blur transition-all duration-200 flex-shrink-0 z-40 font-mono text-xs ${
        isCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-56 sm:w-64'
      }`}
    >
      {/* ── Brand & Collapse Header ── */}
      <div className="p-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 font-black text-xs shadow-xs">
            yg
          </div>
          <div>
            <div className="font-extrabold text-sm sm:text-[15px] text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
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
          className="w-full flex items-center justify-center py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
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

        {/* ── Navigation Links (under Recent, header removed, ask/resolve removed) ── */}
        <div className="pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/60">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const hasNotification = item.id === 'studio' && pendingCount > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-all font-mono text-xs ${
                    isActive
                      ? 'bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
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
                    enableAskMode ? 'bg-blue-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
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
                    enableFileUpload ? 'bg-blue-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
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
                    enableShowReasoning ? 'bg-blue-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                  title={enableShowReasoning ? "Disable Agent Reasoning" : "Enable Agent Reasoning"}
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
    </aside>
  );
}

function SessionItem({ session, isActive, onSelect, onTogglePin, onDelete }) {
  return (
    <div
      onClick={onSelect}
      className={`group px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-start justify-between text-xs ${
        isActive
          ? 'bg-zinc-200/80 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
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
