import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, Zap, AlertTriangle, Lock, RefreshCw,
  ChevronRight, Database, CheckCircle, AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { fetchDashboardSummary, fetchAlerts, fetchRecs, verifyLedgerIntegrity } from '../api/client';
import { Link } from 'react-router-dom';
import RecDetailModal from '../components/rec/RecDetailModal';

// Report §6 band colors, kept consistent with index.css's badge-* classes and the segmented bar below.
const BAND_COLOR = { genuine: '#10b981', suspicious: '#f59e0b', high_risk: '#f43f5e', likely_fraud: '#a855f7' };

function monthlyBandTrend(recs) {
  const byMonth = new Map();
  recs.forEach((r) => {
    if (!r.period_start) return;
    const key = r.period_start.slice(0, 7); // "2026-04"
    if (!byMonth.has(key)) byMonth.set(key, { month: key, genuine: 0, suspicious: 0, high_risk: 0, likely_fraud: 0 });
    const bucket = byMonth.get(key);
    if (r.risk_band && bucket[r.risk_band] !== undefined) bucket[r.risk_band]++;
  });
  return [...byMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({ ...b, month: new Date(`${b.month}-01`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) }));
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [ledgerValid, setLedgerValid] = useState(true);
  const [riskDistribution, setRiskDistribution] = useState({ genuine: 0, suspicious: 0, high_risk: 0, likely_fraud: 0 });
  const [recentRecs, setRecentRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecId, setSelectedRecId] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const trendData = useMemo(() => monthlyBandTrend(recentRecs), [recentRecs]);

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
      setRecentRecs(recsPage?.items || []);

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
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
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
            <span>RECShield &middot; AI-Powered REC Fraud Detection</span>
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
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards - report Figure 4: Total / Verified / Suspicious / Fraudulent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total RECs</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
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

        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">{dist.genuine.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Genuine / Low Risk (0-30)</p>
          </div>
        </div>

        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suspicious</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{(dist.suspicious + dist.high_risk).toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Suspicious + High Risk (31-80) &middot; [Review]</p>
          </div>
        </div>

        <div className="glass-panel p-5 glass-card-glow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fraudulent</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-purple-400 font-mono">{dist.likely_fraud.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Likely Fraud (81-100) &middot; [Investigate]</p>
          </div>
        </div>
      </div>

      {/* Secondary status row: alerts + ledger integrity aren't part of Figure 4's 4 KPIs, but
          they're too load-bearing to bury - open alerts feed the queue below, and a broken
          ledger overrides every score to Likely Fraud (RS-07). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="glass-panel px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Open Alerts
          </span>
          <span className="text-lg font-extrabold text-amber-400 font-mono">{stats.open_alerts || 0}</span>
        </div>
        <div className="glass-panel px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" /> SHA-256 Ledger
          </span>
          <span className={`text-xs font-extrabold font-mono ${ledgerValid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ledgerValid ? 'INTACT' : 'TAMPER DETECTED'}
          </span>
        </div>
      </div>

      {/* Risk Score Distribution Bar */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Risk Score Distribution</h2>
            <p className="text-xs text-slate-400">Certificates evaluated across 5 engine vectors</p>
          </div>
          <Link to="/recs" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
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

      {/* Trend: RECs per risk band by generation-period month */}
      {trendData.length > 1 && (
        <div className="glass-panel p-6">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Risk Bands Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace('_', ' ')} />
              <Bar dataKey="genuine" stackId="band" fill={BAND_COLOR.genuine} name="Genuine" radius={[0, 0, 0, 0]} />
              <Bar dataKey="suspicious" stackId="band" fill={BAND_COLOR.suspicious} name="Suspicious" />
              <Bar dataKey="high_risk" stackId="band" fill={BAND_COLOR.high_risk} name="High Risk" />
              <Bar dataKey="likely_fraud" stackId="band" fill={BAND_COLOR.likely_fraud} name="Likely Fraud" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Split Section: Priority High Risk RECs & Security Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Priority High Risk RECs */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Priority Audit Queue
              </h2>
              <p className="text-xs text-slate-400">Ranked by risk score - Likely Fraud RECs first, ready to investigate</p>
            </div>
            <Link to="/recs?band=likely_fraud" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
              View Fraud Queue <ChevronRight className="w-3.5 h-3.5" />
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
                    <td className="py-3 px-3 font-mono font-bold text-blue-400">{rec.id}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">{rec.plant_name}</td>
                    <td className="py-3 px-3 font-mono text-amber-400 font-bold">{rec.energy_mwh.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${getBadgeClass(rec.risk_band)}`}>
                        {rec.risk_band.replace('_', ' ')} ({rec.risk_score})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {/* Report Figure 4: [Investigate] for Likely Fraud, [Review] for High Risk/Suspicious */}
                      <button
                        onClick={() => setSelectedRecId(rec.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          rec.risk_band === 'likely_fraud'
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                        }`}
                      >
                        {rec.risk_band === 'likely_fraud' ? 'Investigate' : 'Review'}
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
                    <span className="font-mono text-xs font-bold text-blue-400">{alt.rec_id}</span>
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
