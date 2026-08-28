/**
 * Yonder Graph URL Routing & Navigation Helper
 * 
 * Maps application tabs and chat sessions to browser URLs:
 * - /ask -> Ask Copilot
 * - /ask/:sessionId -> Specific Ask chat session
 * - /resolve -> Resolve Copilot
 * - /resolve/:sessionId -> Specific Resolve chat session
 * - /chat/:sessionId -> Direct session link (auto-detects persona)
 * - /graph -> Knowledge Graph Visualizer
 * - /agents -> Agent Telemetry & Squad Dashboard
 * - /studio -> Knowledge Studio
 * - /governance -> Governance & Safety Policies
 */

export function parseCurrentUrl() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const segments = path ? path.split('/') : [];

  const main = segments[0]?.toLowerCase() || '';
  const param = segments[1] || null;

  if (main === 'ask') {
    return { tab: 'ask', sessionId: param };
  }
  if (main === 'resolve') {
    return { tab: 'resolve', sessionId: param };
  }
  if (main === 'chat' || main === 'session' || main === 'c') {
    return { tab: null, sessionId: param };
  }
  if (main === 'graph') {
    return { tab: 'graph', sessionId: null };
  }
  if (main === 'agents') {
    return { tab: 'agents', sessionId: null };
  }
  if (main === 'studio') {
    return { tab: 'studio', sessionId: null };
  }
  if (main === 'governance') {
    return { tab: 'governance', sessionId: null };
  }

  return { tab: null, sessionId: null };
}

export function buildUrl(tab, sessionId) {
  if (tab === 'ask') {
    return sessionId ? `/ask/${sessionId}` : '/ask';
  }
  if (tab === 'resolve') {
    return sessionId ? `/resolve/${sessionId}` : '/resolve';
  }
  if (tab === 'graph') return '/graph';
  if (tab === 'agents') return '/agents';
  if (tab === 'studio') return '/studio';
  if (tab === 'governance') return '/governance';
  return '/';
}

export function syncUrl(tab, sessionId, replace = false) {
  const targetUrl = buildUrl(tab, sessionId);
  if (window.location.pathname !== targetUrl) {
    if (replace) {
      window.history.replaceState({ tab, sessionId }, '', targetUrl);
    } else {
      window.history.pushState({ tab, sessionId }, '', targetUrl);
    }
  }
}
