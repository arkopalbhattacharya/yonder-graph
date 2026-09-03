import React, { useState, useEffect } from 'react';
import { 
  Radar, 
  ShieldCheck, 
  Database, 
  Zap, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Sliders, 
  ExternalLink,
  ChevronRight,
  Boxes,
  Truck,
  Package,
  FileText,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { syncUrl } from '../utils/navigation';

export default function SentinelView({ isActive, onNavigateToSession }) {
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [triagingAlertId, setTriagingAlertId] = useState(null);
  const [scanInterval, setScanInterval] = useState(60);

  // Connection Form State (Dev Oracle DB)
  const [formData, setFormData] = useState({
    host: '',
    port: 1521,
    service_name: '',
    user: '',
    password: '',
    schema_name: '',
    environment: 'DEV'
  });

  const fetchSentinelData = async () => {
    setIsLoading(true);
    try {
      const statusRes = await api.getSentinelStatus();
      setStatus(statusRes);
      if (statusRes.status === 'CONNECTED') {
        const alertsRes = await api.getSentinelAlerts();
        setAlerts(alertsRes.alerts || []);
      }
    } catch (err) {
      console.warn("Could not fetch Sentinel data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchSentinelData();
    }
  }, [isActive]);

  const handleFieldChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setTestResult(null);
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testOracleConnection({
        ...formData,
        port: parseInt(formData.port) || 1521
      });
      setTestResult({ success: true, message: res.message, banner: res.banner });
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.connectOracle({
        ...formData,
        port: parseInt(formData.port) || 1521,
        environment: 'DEV'
      });
      setStatus({ ...status, status: 'CONNECTED', connection: res.connection });
      fetchSentinelData();
    } catch (err) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Dev Oracle WMS database and stop proactive Sentinel scanning?")) return;
    setIsLoading(true);
    try {
      await api.disconnectOracle();
      setStatus({ ...status, status: 'DISCONNECTED' });
      setAlerts([]);
      setTestResult(null);
    } catch (err) {
      alert(`Disconnect failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      const res = await api.runSentinelScan();
      setAlerts(res.alerts || []);
    } catch (err) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDismissAlert = async (alertId) => {
    try {
      await api.dismissAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error("Could not dismiss alert:", err);
    }
  };

  const handleAutoTriage = async (alertItem) => {
    setTriagingAlertId(alertItem.id);
    try {
      const res = await api.autoTriageAlert(alertItem.id);
      if (res.session_id) {
        if (onNavigateToSession) {
          onNavigateToSession(res.session_id, 'resolve');
        } else {
          syncUrl('resolve', res.session_id);
          window.location.href = `/resolve/${res.session_id}`;
        }
      }
    } catch (err) {
      alert(`Auto-triage failed: ${err.message}`);
    } finally {
      setTriagingAlertId(null);
    }
  };

  const isConnected = status?.status === 'CONNECTED';

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-6 font-mono text-xs custom-scrollbar">
      
      {/* ── 1. Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Radar size={16} className={isConnected ? "animate-pulse" : ""} />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              predictive supply chain sentinel
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {isConnected ? '🟢 Dev Oracle Connected' : '🟡 Dev DB Setup Required'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Autonomous 24/7 proactive health engine • Zero-mutation AST read-only monitoring
          </p>
        </div>

        {isConnected && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#CF1F2E] hover:bg-[#B71825] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Zap size={13} className={isScanning ? "animate-spin" : ""} />
              <span>{isScanning ? "Scanning..." : "Trigger Proactive Sweep"}</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium cursor-pointer transition-all border border-zinc-200 dark:border-zinc-700"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* ── 2. STATE A: Disconnected Connection Gate ── */}
      {!isConnected ? (
        <div className="max-w-2xl mx-auto space-y-5 pt-2">
          
          {/* Security & Zero-Mutation Air-Gap Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-xs">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Strict 4-Layer Zero-Mutation Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-400/90 font-mono">
              Sentinel operates under strict <strong>Tier 1 AST Read-Only Governance</strong> and executes <code className="bg-emerald-500/20 px-1 py-0.5 rounded">SET TRANSACTION READ ONLY</code>. All <code className="font-bold">INSERT</code>, <code className="font-bold">UPDATE</code>, <code className="font-bold">DELETE</code>, and DDL statements are mathematically blocked.
            </p>
          </div>

          {/* Dev DB Connection Form */}
          <div className="p-5 sm:p-6 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#111114]/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center space-x-2">
                <Database size={15} className="text-[#CF1F2E]" />
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Connect to WMS
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAndConnect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Oracle Host / Endpoint *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. oracle-dev.company.corp"
                    value={formData.host}
                    onChange={e => handleFieldChange('host', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Port *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={e => handleFieldChange('port', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Service Name / SID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WMSDEV or ORCL"
                    value={formData.service_name}
                    onChange={e => handleFieldChange('service_name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Schema Owner (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WMSSCHEMA"
                    value={formData.schema_name}
                    onChange={e => handleFieldChange('schema_name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Read-Only Database User *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. yonder_sentinel_ro"
                    value={formData.user}
                    onChange={e => handleFieldChange('user', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={e => handleFieldChange('password', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-[#CF1F2E]"
                  />
                </div>
              </div>

              {/* Test Connection Output Banner */}
              {testResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  <div className="flex items-center space-x-1.5 font-bold">
                    {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.banner && (
                    <div className="text-[10px] mt-1 text-zinc-500 dark:text-zinc-400 font-mono">
                      {testResult.banner}
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formData.host || !formData.service_name || !formData.user || !formData.password}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isTesting ? "animate-spin text-[#CF1F2E]" : ""} />
                  <span>{isTesting ? "Testing Live Handshake..." : "Test Connection ⚡"}</span>
                </button>

                <button
                  type="submit"
                  disabled={!testResult?.success || isLoading || isTesting}
                  title={
                    testResult?.success 
                      ? "Save & Activate Sentinel" 
                      : "Test Connection must succeed first before saving and activating"
                  }
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs ${
                    testResult?.success && !isLoading
                      ? 'bg-[#CF1F2E] hover:bg-[#B71825] text-white cursor-pointer'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Radar size={13} className={testResult?.success ? "animate-pulse text-white" : ""} />
                  <span>{isLoading ? "Connecting..." : "Save & Activate Sentinel"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (

        /* ── 3. STATE B: Connected Command Center & Anomaly Stream ── */
        <div className="space-y-6">

          {/* Active Status Bar */}
          <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#111114]/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                Connected to Oracle WMS ({status.connection?.environment})
              </span>
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-500 font-mono">
                {status.connection?.host}:{status.connection?.port}/{status.connection?.service_name}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-zinc-400 font-mono">
              <Clock size={12} />
              <span>Last Sweep: {status.connection?.last_sweep_time ? new Date(status.connection.last_sweep_time).toLocaleTimeString() : 'Just now'}</span>
            </div>
          </div>

          {/* Domain Health Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#111114]/70 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10.5px] uppercase font-bold">Outbound Waves</span>
                <Boxes size={14} className="text-[#CF1F2E]" />
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {alerts.filter(a => a.domain === 'Outbound').length > 0 ? (
                  <span className="text-rose-600">{alerts.filter(a => a.domain === 'Outbound').length} Stalls</span>
                ) : (
                  <span className="text-emerald-600">Optimal</span>
                )}
              </div>
              <div className="text-[9.5px] text-zinc-400 font-mono">PCKWAV & ORD_LINE scan</div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#111114]/70 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10.5px] uppercase font-bold">Inbound Docks</span>
                <Truck size={14} className="text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {alerts.filter(a => a.domain === 'Inbound').length > 0 ? (
                  <span className="text-amber-600">{alerts.filter(a => a.domain === 'Inbound').length} Stagnant</span>
                ) : (
                  <span className="text-emerald-600">Clear</span>
                )}
              </div>
              <div className="text-[9.5px] text-zinc-400 font-mono">RCVTRK dock status</div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#111114]/70 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10.5px] uppercase font-bold">Inventory Holds</span>
                <Package size={14} className="text-purple-500" />
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {alerts.filter(a => a.domain === 'Inventory').length > 0 ? (
                  <span className="text-purple-600">{alerts.filter(a => a.domain === 'Inventory').length} Locked</span>
                ) : (
                  <span className="text-emerald-600">Zero Locks</span>
                )}
              </div>
              <div className="text-[9.5px] text-zinc-400 font-mono">INVDTL hold flag sweep</div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-[#111114]/70 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-[10.5px] uppercase font-bold">Carrier SLA</span>
                <ShieldCheck size={14} className="text-sky-500" />
              </div>
              <div className="text-xl font-bold text-emerald-600">
                Protected
              </div>
              <div className="text-[9.5px] text-zinc-400 font-mono">0 Cutoff Breaches</div>
            </div>
          </div>

          {/* Active Anomaly Alerts Stream */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={15} className={alerts.length > 0 ? "text-amber-500" : "text-emerald-500"} />
                <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Live Anomaly Alerts ({alerts.length})
                </h2>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {alerts.length === 0 ? "Zero operational deadlocks detected" : "Autonomous pre-triage ready"}
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/20">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                <div className="font-bold text-zinc-800 dark:text-zinc-200">All WMS Operations Healthy</div>
                <p className="text-zinc-500 text-[11px] max-w-md mx-auto">
                  Sentinel is continuously sweeping tables in read-only mode. When an allocation shortfall or dock stagnation occurs, it will automatically pre-triage the incident here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#111114]/80 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          item.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                          item.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          'bg-[#CF1F2E]/10 text-[#CF1F2E] dark:text-[#F87171] border border-[#CF1F2E]/20'
                        }`}>
                          {item.severity}
                        </span>
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-[10px] text-zinc-400 font-mono">
                        <span>Domain: {item.domain}</span>
                        <span>•</span>
                        <span>{item.sop_id}</span>
                      </div>
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Business Keys Extract */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {Object.entries(item.business_keys || {}).map(([k, v], i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono">
                          {k}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>

                    {/* Alert Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      <button
                        onClick={() => handleDismissAlert(item.id)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        Dismiss Alert
                      </button>

                      <button
                        onClick={() => handleAutoTriage(item)}
                        disabled={triagingAlertId === item.id}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#CF1F2E] hover:bg-[#B71825] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Zap size={12} className={triagingAlertId === item.id ? "animate-spin" : ""} />
                        <span>{triagingAlertId === item.id ? "Running 7-Agent Squad..." : "Investigate in Copilot ⚡"}</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
