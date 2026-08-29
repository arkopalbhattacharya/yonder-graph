/**
 * Yonder Graph API Client
 */

const API_BASE = '/api';

async function fetchWithHandle(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || 'API Request Failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${url}):`, error);
    throw error;
  }
}

export const api = {
  // ── Health ──
  checkHealth: () => fetchWithHandle(`${API_BASE}/health`),
  
  // ── Triage ──
  runTriage: (query, sessionId = null, persona = 'ask', signal = null) => 
    fetchWithHandle(`${API_BASE}/triage`, {
      method: 'POST',
      body: JSON.stringify({ query, session_id: sessionId, persona }),
      signal: signal || undefined,
    }),
  consolidateSQL: (steps, sessionId = null, signal = null) =>
    fetchWithHandle(`${API_BASE}/triage/consolidate-sql`, {
      method: 'POST',
      body: JSON.stringify({ steps, session_id: sessionId }),
      signal: signal || undefined,
    }),
    
  // ── Graph ──
  getGraphSchema: () => fetchWithHandle(`${API_BASE}/graph/schema`),
  getSubgraph: (table, depth = 2) => fetchWithHandle(`${API_BASE}/graph/subgraph?table=${table}&depth=${depth}`),
  getNodeLabels: () => fetchWithHandle(`${API_BASE}/graph/labels`),
  getTables: () => fetchWithHandle(`${API_BASE}/graph/tables`),
  getSOPs: (domain = null) => fetchWithHandle(`${API_BASE}/graph/sops${domain ? `?domain=${domain}` : ''}`),
  
  // ── Audit & Telemetry ──
  getAuditLogs: (page = 1, pageSize = 50, filters = {}) => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (filters.agent) params.append('agent_name', filters.agent);
    if (filters.status) params.append('status', filters.status);
    return fetchWithHandle(`${API_BASE}/audit/logs?${params.toString()}`);
  },
  getAuditStats: () => fetchWithHandle(`${API_BASE}/audit/stats`),
  getDashboardMetrics: () => fetchWithHandle(`${API_BASE}/audit/dashboard-metrics`),
  
  // ── Feedback & Corrections ──
  submitFeedback: (payload) => 
    fetchWithHandle(`${API_BASE}/feedback/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitCorrection: (payload) => 
    fetchWithHandle(`${API_BASE}/feedback/correct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    
  // ── HITL (Staged Reviews) ──
  getPendingReviews: () => fetchWithHandle(`${API_BASE}/hitl/pending`),
  processReview: (payload) => 
    fetchWithHandle(`${API_BASE}/hitl/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    
  // ── Governance ──
  getGovernancePolicy: () => fetchWithHandle(`${API_BASE}/governance/policy`),
  getGovernanceInterceptions: (page = 1, pageSize = 25, filters = {}) => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (filters.status) params.append('status', filters.status);
    if (filters.risk_level) params.append('risk_level', filters.risk_level);
    return fetchWithHandle(`${API_BASE}/governance/interceptions?${params.toString()}`);
  },

  // ── Chat History & Sessions ──
  getChatSessions: () => fetchWithHandle(`${API_BASE}/chat/sessions`),
  getChatSession: (sessionId) => 
    fetchWithHandle(`${API_BASE}/chat/sessions/${sessionId}`),
  createChatSession: (payload = {}) => 
    fetchWithHandle(`${API_BASE}/chat/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getChatSessionDetail: (sessionId) => 
    fetchWithHandle(`${API_BASE}/chat/sessions/${sessionId}`),
  togglePinSession: (sessionId, isPinned) => 
    fetchWithHandle(`${API_BASE}/chat/sessions/${sessionId}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: isPinned }),
    }),
  deleteChatSession: (sessionId) => 
    fetchWithHandle(`${API_BASE}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  // ── Document Ingestion & Enrichment Agent ──
  uploadAndEnrichDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/ingest/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || 'Failed to upload and ingest document');
    }
    return data;
  },

  // ── Predictive Supply Chain Sentinel ──
  getSentinelStatus: () => fetchWithHandle(`${API_BASE}/sentinel/status`),
  testOracleConnection: (payload) =>
    fetchWithHandle(`${API_BASE}/sentinel/test-connection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  connectOracle: (payload) =>
    fetchWithHandle(`${API_BASE}/sentinel/connect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disconnectOracle: () =>
    fetchWithHandle(`${API_BASE}/sentinel/disconnect`, {
      method: 'POST',
    }),
  getSentinelAlerts: () => fetchWithHandle(`${API_BASE}/sentinel/alerts`),
  runSentinelScan: () =>
    fetchWithHandle(`${API_BASE}/sentinel/scan`, {
      method: 'POST',
    }),
  autoTriageAlert: (alertId) =>
    fetchWithHandle(`${API_BASE}/sentinel/auto-triage/${alertId}`, {
      method: 'POST',
    }),
  dismissAlert: (alertId) =>
    fetchWithHandle(`${API_BASE}/sentinel/dismiss-alert`, {
      method: 'POST',
      body: JSON.stringify({ alert_id: alertId }),
    }),
  updateScannerSettings: (payload) =>
    fetchWithHandle(`${API_BASE}/sentinel/settings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
