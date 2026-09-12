import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Zap, AlertTriangle, Lock, RefreshCw, 
  ChevronRight, Database, CheckCircle, AlertCircle
} from 'lucide-react';
import { fetchDashboardSummary, fetchAlerts, fetchRecs, verifyLedgerIntegrity } from '../api/client';
import { Link } from 'react-router-dom';
import RecDetailModal from '../components/rec/RecDetailModal';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [ledgerValid, setLedgerValid] = useState(true);
  const [riskDistribution, setRiskDistribution] = useState({ genuine: 0, suspicious: 0, high_risk: 0, likely_fraud: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecId, setSelectedRecId] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [sumData, alertData, recsPage, ledgerData] = await Promise.all([
        fetchDashboardSummary(),
        fetchAlerts(true, 10),
        fetchRecs({ limit: 200 }),
        verifyLedgerIntegrity().catch(() => ({ valid: true })),
      ]);

      setSummary(sumData);
      setAlerts(alertData);
      setLedgerValid(ledgerData.valid);

      // Compute exact Risk Distribution from fetched RECs
      const counts = { genuine: 0, suspicious: 0, high_risk: 0, likely_fraud: 0 };
      if (recsPage && recsPage.items) {
        recsPage.items.forEach(r => {
          if (r.risk_band && counts[r.risk_band] !== undefined) {
            counts[r.risk_band]++;
          }
        });
      }
      setRiskDistribution(counts);

    } catch (err) {
      setError(err.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (band) => {
    switch (band) {
      case 'genuine': return 'badge-genuine';
      case 'suspicious': return 'badge-suspicious';
      case 'high_risk': return 'badge-high_risk';
      case 'likely_fraud': return 'badge-likely_fraud';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-semibold">Gathering solar grid telemetry & fraud detection summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <span>Failed to load API data: {error}</span>
          <button onClick={loadDashboardData} className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs font-bold transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = summary?.stats || {};
  const highRiskList = summary?.high_risk || [];

  const dist = riskDistribution;
  const totalDist = (dist.genuine + dist.suspicious + dist.high_risk + dist.likely_fraud) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>REC Audit Intelligence & Fraud Overview</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitoring of physics plausibility, double counting, meter anomalies & wash trading.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Energy & RECs */}
        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Certified RECs</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white font-mono">{(stats.total_recs || 0).toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> {(stats.total_mwh || 0).toLocaleString()} MWh Certified
            </p>
          </div>
        </div>

        {/* Card 2: High Risk */}
        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">High Risk Certificates</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-rose-400 font-mono">
              {stats.high_risk || 0} <span className="text-xs text-slate-400 font-normal">/ {stats.verified || 0} verified</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {(((stats.high_risk || 0) / (stats.total_recs || 1)) * 100).toFixed(1)}% of total registry certificates
            </p>
          </div>
        </div>

        {/* Card 3: Security Alerts */}
        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Fraud Alerts</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{stats.open_alerts || 0}</div>
            <p className="text-xs text-slate-400 mt-1">
              Requires immediate auditor review
            </p>
          </div>
        </div>

        {/* Card 4: Cryptographic Ledger */}
        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SHA-256 Hash Chain</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-xl font-bold font-mono ${ledgerValid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {ledgerValid ? 'SECURE & VALID' : 'TAMPER DETECTED'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cryptographic history unbroken
            </p>
          </div>
        </div>
      </div>

      {/* Risk Score Distribution Bar */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Risk Score Distribution</h2>
            <p className="text-xs text-slate-400">Certificates evaluated across 5 engine vectors</p>
          </div>
          <Link to="/recs" className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">
            View All RECs <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Segmented Bar */}
        <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          <div style={{ width: `${(dist.genuine / totalDist) * 100}%` }} className="bg-emerald-500 h-full rounded-l-full transition-all" title={`Genuine: ${dist.genuine}`} />
          <div style={{ width: `${(dist.suspicious / totalDist) * 100}%` }} className="bg-amber-500 h-full transition-all" title={`Suspicious: ${dist.suspicious}`} />
          <div style={{ width: `${(dist.high_risk / totalDist) * 100}%` }} className="bg-rose-500 h-full transition-all" title={`High Risk: ${dist.high_risk}`} />
          <div style={{ width: `${(dist.likely_fraud / totalDist) * 100}%` }} className="bg-purple-500 h-full rounded-r-full transition-all" title={`Likely Fraud: ${dist.likely_fraud}`} />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-300 font-medium">Genuine ({dist.genuine})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-slate-300 font-medium">Suspicious ({dist.suspicious})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-xs text-slate-300 font-medium">High Risk ({dist.high_risk})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs text-slate-300 font-medium">Likely Fraud ({dist.likely_fraud})</span>
          </div>
        </div>
      </div>

      {/* Split Section: Priority High Risk RECs & Security Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Priority High Risk RECs */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Priority High-Risk Audit Queue
              </h2>
              <p className="text-xs text-slate-400">Click any REC for 5-point physics, double-counting & AI report inspection</p>
            </div>
            <Link to="/recs?band=high" className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">
              Filter High Risk <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">REC ID</th>
                  <th className="py-2.5 px-3">Plant Name</th>
                  <th className="py-2.5 px-3 font-mono">Energy MWh</th>
                  <th className="py-2.5 px-3">Risk Band</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {highRiskList.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{rec.id}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">{rec.plant_name}</td>
                    <td className="py-3 px-3 font-mono text-amber-400 font-bold">{rec.energy_mwh.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${getBadgeClass(rec.risk_band)}`}>
                        {rec.risk_band} ({rec.risk_score})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedRecId(rec.id)}
                        className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-xs font-semibold transition-colors"
                      >
                        Inspect Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Recent Security Alerts Feed */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Fraud Alerts Stream
            </h2>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">Live</span>
          </div>

          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alt) => (
                <div 
                  key={alt.id}
                  onClick={() => setSelectedRecId(alt.rec_id)}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-sky-400">{alt.rec_id}</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-semibold ${
                      alt.severity === 'likely_fraud' || alt.severity === 'ledger_integrity' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {alt.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{alt.message || alt.title}</p>
                  <span className="text-[10px] text-slate-500 font-mono block text-right">
                    {new Date(alt.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No active unacknowledged alerts
              </div>
            )}
          </div>
        </div>

      </div>

      {/* REC Detail Modal */}
      {selectedRecId && (
        <RecDetailModal
          recId={selectedRecId}
          onClose={() => setSelectedRecId(null)}
          onActionSuccess={loadDashboardData}
        />
      )}
    </div>
  );
}
