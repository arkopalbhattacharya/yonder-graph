import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import CopilotChat from './components/CopilotChat';
import GraphVisualizer from './components/GraphVisualizer';
import AgentDashboard from './components/AgentDashboard';
import KnowledgeStudio from './components/KnowledgeStudio';
import GovernanceViewer from './components/GovernanceViewer';
import MetricsDashboard from './components/MetricsDashboard';
import { PanelLeftOpen } from 'lucide-react';
import { api } from './services/api';
import { useSettings } from './context/SettingsContext';
import { parseCurrentUrl, syncUrl } from './utils/navigation';

export default function App() {
  const { enableAskMode } = useSettings();
  const [activeTab, setActiveTab] = useState(() => enableAskMode ? 'ask' : 'resolve');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => crypto.randomUUID());
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

  // If ask mode gets disabled and user is currently on 'ask' tab, auto-switch to 'resolve'
  useEffect(() => {
    if (!enableAskMode && activeTab === 'ask') {
      setActiveTab('resolve');
    }
  }, [enableAskMode, activeTab]);

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    const sessionObj = sessions.find(s => s.session_id === sessionId);
    if (sessionObj && (sessionObj.persona === 'ask' || sessionObj.persona === 'resolve')) {
      if (sessionObj.persona === 'ask' && !enableAskMode) {
        setActiveTab('resolve');
      } else {
        setActiveTab(sessionObj.persona);
      }
    }
  };

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
    if (activeTab !== 'ask' && activeTab !== 'resolve') {
      setActiveTab(enableAskMode ? 'ask' : 'resolve');
    }
  };

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
        setActiveTab={setActiveTab}
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

          {/* Metrics & ROI Analytics Tab */}
          <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'metrics' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <MetricsDashboard isActive={activeTab === 'metrics'} />
          </div>

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
        </main>
      </div>
    </div>
  );
}
