import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import CopilotChat from './components/CopilotChat';
import GraphVisualizer from './components/GraphVisualizer';
import AgentDashboard from './components/AgentDashboard';
import KnowledgeStudio from './components/KnowledgeStudio';
import GovernanceViewer from './components/GovernanceViewer';
import SentinelView from './components/SentinelView';
import MetricsDashboard from './components/MetricsDashboard';
import { PanelLeftOpen } from 'lucide-react';
import { api } from './services/api';
import { useSettings } from './context/SettingsContext';
import { parseCurrentUrl, syncUrl } from './utils/navigation';

export default function App() {
  const { enableAskMode, enableSentinel } = useSettings();

  // Initial state derived directly from current URL
  const [activeTab, setActiveTab] = useState(() => {
    const { tab } = parseCurrentUrl();
    if (tab) {
      if (tab === 'ask' && !enableAskMode) return 'resolve';
      if (tab === 'sentinel' && !enableSentinel) return 'resolve';
      return tab;
    }
    return enableAskMode ? 'ask' : 'resolve';
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const { sessionId } = parseCurrentUrl();
    return sessionId || crypto.randomUUID();
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchSessions = async () => {
    try {
      const data = await api.getChatSessions();
      setSessions(data || []);
    } catch (err) {
      console.warn("Could not load chat sessions:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [refreshTrigger]);

  // Sync initial URL on mount if at root '/' or '/chat/:sessionId'
  useEffect(() => {
    const { tab, sessionId } = parseCurrentUrl();
    
    // If user hit /chat/:sessionId or /session/:sessionId without persona prefix
    if (!tab && sessionId) {
      api.getChatSession(sessionId)
        .then(data => {
          const persona = (data?.persona === 'ask' && enableAskMode) ? 'ask' : 'resolve';
          setActiveTab(persona);
          setActiveSessionId(sessionId);
          syncUrl(persona, sessionId, true);
        })
        .catch(() => {
          const fallback = enableAskMode ? 'ask' : 'resolve';
          setActiveTab(fallback);
          setActiveSessionId(sessionId);
          syncUrl(fallback, sessionId, true);
        });
      return;
    }

    if (!tab) {
      const defaultTab = enableAskMode ? 'ask' : 'resolve';
      syncUrl(defaultTab, null, true);
    }
  }, [enableAskMode]);

  useEffect(() => {
    if (!enableAskMode && activeTab === 'ask') {
      setActiveTab('resolve');
      syncUrl('resolve', activeSessionId, true);
    }
  }, [enableAskMode, activeTab, activeSessionId]);

  useEffect(() => {
    if (!enableSentinel && activeTab === 'sentinel') {
      setActiveTab('resolve');
      syncUrl('resolve', activeSessionId, true);
    }
  }, [enableSentinel, activeTab, activeSessionId]);

  // Browser Back / Forward navigation listener
  useEffect(() => {
    const handlePopState = () => {
      const { tab, sessionId } = parseCurrentUrl();
      if (tab) {
        if (tab === 'ask' && !enableAskMode) {
          setActiveTab('resolve');
        } else if (tab === 'sentinel' && !enableSentinel) {
          setActiveTab('resolve');
        } else {
          setActiveTab(tab);
        }
      }
      if (sessionId) {
        setActiveSessionId(sessionId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enableAskMode, enableSentinel]);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    const isChat = newTab === 'ask' || newTab === 'resolve';
    syncUrl(newTab, isChat ? activeSessionId : null);
  }, [activeSessionId]);

  const handleSelectSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
    const sessionObj = sessions.find(s => s.session_id === sessionId);
    let targetPersona = activeTab === 'ask' || activeTab === 'resolve' ? activeTab : (enableAskMode ? 'ask' : 'resolve');
    
    if (sessionObj && (sessionObj.persona === 'ask' || sessionObj.persona === 'resolve')) {
      targetPersona = (sessionObj.persona === 'ask' && !enableAskMode) ? 'resolve' : sessionObj.persona;
    }
    setActiveTab(targetPersona);
    syncUrl(targetPersona, sessionId);
  }, [sessions, activeTab, enableAskMode]);

  const handleNewChat = useCallback(() => {
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
    const targetTab = (activeTab === 'ask' || activeTab === 'resolve') ? activeTab : (enableAskMode ? 'ask' : 'resolve');
    setActiveTab(targetTab);
    syncUrl(targetTab, newId);
  }, [activeTab, enableAskMode]);

  const handleTogglePin = async (sessionId, currentPinned, e) => {
    e.stopPropagation();
    try {
      await api.togglePinSession(sessionId, !currentPinned);
      fetchSessions();
    } catch (err) {
      console.error("Pin toggle failed:", err);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await api.deleteChatSession(sessionId);
      if (sessionId === activeSessionId) {
        handleNewChat();
      }
      fetchSessions();
    } catch (err) {
      console.error("Delete session failed:", err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light dark:bg-[#09090b] text-text-primary-light dark:text-text-primary-dark font-mono">
      
      {/* ── Unified Left Pane ── */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onTogglePin={handleTogglePin}
        onDeleteSession={handleDeleteSession}
      />

      {/* ── Main Immersive Workspace ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Floating Sidebar Re-open button when collapsed */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute left-3 top-3 z-30 p-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs transition-colors"
            title="Open Sidebar"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}

        {/* Dynamic Workspace Views */}
        <main className="flex-1 overflow-hidden relative">
          {/* Ask Copilot Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'ask' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <CopilotChat 
              isActive={activeTab === 'ask'} 
              initialPersona="ask" 
              sessionId={activeSessionId}
              onSessionUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          </div>

          {/* Resolve Copilot Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'resolve' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <CopilotChat 
              isActive={activeTab === 'resolve'} 
              initialPersona="resolve" 
              sessionId={activeSessionId}
              onSessionUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          </div>

          {/* Predictive Sentinel Tab (Experimental) */}
          {enableSentinel && (
            <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'sentinel' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <SentinelView 
                isActive={activeTab === 'sentinel'} 
                onNavigateToSession={(sessionId) => {
                  handleSelectSession(sessionId);
                }}
              />
            </div>
          )}

          {/* Knowledge Graph Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'graph' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <GraphVisualizer isActive={activeTab === 'graph'} />
          </div>

          {/* Agent Telemetry Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'agents' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <AgentDashboard isActive={activeTab === 'agents'} />
          </div>

          {/* Knowledge Studio Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'studio' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <KnowledgeStudio isActive={activeTab === 'studio'} />
          </div>

          {/* Governance Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'governance' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <GovernanceViewer isActive={activeTab === 'governance'} />
          </div>

          {/* Metrics & ROI Analytics Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'metrics' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <MetricsDashboard isActive={activeTab === 'metrics'} />
          </div>
        </main>
      </div>
    </div>
  );
}
