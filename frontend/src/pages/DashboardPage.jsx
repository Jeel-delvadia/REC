import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, Database, CheckCircle2, AlertCircle, Inbox, Lock, AlertTriangle,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { fetchDashboardSummary, fetchAlerts, fetchRecs, verifyLedgerIntegrity } from '../api/client';
import RecDetailModal from '../components/rec/RecDetailModal';
import Card from '../components/ui/Card';
import KPI from '../components/ui/KPI';
import ChartCard from '../components/ui/ChartCard';
import RiskBadge from '../components/ui/RiskBadge';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';

// Report §6 band colors - mirrors index.css's --risk-* tokens (CSS vars can't be read by
// recharts' inline fill prop, so the hexes are duplicated here rather than computed).
const BAND_COLOR = { genuine: '#12b76a', suspicious: '#f79009', high_risk: '#f04438', likely_fraud: '#d92d20' };

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

  if (loading) return <LoadingState label="Gathering fraud detection summary…" />;
  if (error) return <ErrorState message={error} onRetry={loadDashboardData} />;

  const stats = summary?.stats || {};
  const highRiskList = summary?.high_risk || [];

  const dist = riskDistribution;
  const totalDist = (dist.genuine + dist.suspicious + dist.high_risk + dist.likely_fraud) || 1;

  const queueColumns = [
    { key: 'id', header: 'REC ID', render: (r) => <span className="font-mono font-semibold text-[var(--brand)]">{r.id}</span> },
    { key: 'plant_name', header: 'Plant' },
    { key: 'energy_mwh', header: 'MWh', render: (r) => <span className="font-mono tabular-nums">{r.energy_mwh.toLocaleString()}</span> },
    { key: 'risk_band', header: 'Risk', render: (r) => <RiskBadge band={r.risk_band} score={r.risk_score} size="sm" /> },
    {
      key: 'action', header: '', align: 'right',
      render: (r) => (
        <Button variant={r.risk_band === 'likely_fraud' ? 'danger' : 'secondary'} size="sm" onClick={() => setSelectedRecId(r.id)}>
          {r.risk_band === 'likely_fraud' ? 'Investigate' : 'Review'}
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* Page header - brand identity lives in the shell already; this names the page's job. */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Fraud Detection Overview</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-full">
            Physics plausibility, double counting, meter anomalies & wash trading, monitored across every certificate.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadDashboardData}>
          Refresh
        </Button>
      </div>

      {/* KPI row - the headline numbers answer "what's happening" at a glance. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total RECs" value={stats.total_recs || 0} icon={Database} context={`${(stats.total_mwh || 0).toLocaleString()} MWh certified`} />
        <KPI label="Verified Genuine" value={dist.genuine} icon={CheckCircle2} tone="genuine" context="Score 0–30" />
        <KPI label="Needs Review" value={dist.suspicious + dist.high_risk} icon={AlertCircle} tone="suspicious" context="Score 31–80" />
        <KPI label="Likely Fraud" value={dist.likely_fraud} icon={ShieldAlert} tone="danger" context="Score 81–100 · investigate now" />
      </div>

      {/* System status strip - a trust signal ("can I believe the numbers above?"), not a KPI. */}
      <Card padding="px-5 py-3.5" className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs">
        <div className="flex items-center gap-2">
          <Lock className={`w-3.5 h-3.5 ${ledgerValid ? 'text-[var(--risk-genuine)]' : 'text-[var(--risk-fraud)]'}`} />
          <span className="text-[var(--text-secondary)]">Ledger integrity</span>
          <span className={`font-bold ${ledgerValid ? 'text-[var(--risk-genuine)]' : 'text-[var(--risk-fraud)]'}`}>
            {ledgerValid ? 'Intact' : 'Tamper detected'}
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--risk-suspicious)]" />
          <span className="text-[var(--text-secondary)]">Open alerts</span>
          <span className="font-bold text-[var(--risk-suspicious)]">{stats.open_alerts || 0}</span>
        </div>
      </Card>

      {/* Risk Score Distribution */}
      <ChartCard
        title="Risk score distribution"
        subtitle="Every certificate, scored across five engine checks"
        actions={<Link to="/recs" className="text-xs text-[var(--brand)] hover:text-[var(--brand-secondary)] font-medium flex items-center gap-1">View all <ChevronRight className="w-3.5 h-3.5" /></Link>}
      >
        <div className="w-full h-3 bg-[var(--surface-sunken)] rounded-full overflow-hidden flex">
          <div style={{ width: `${(dist.genuine / totalDist) * 100}%`, background: BAND_COLOR.genuine }} className="h-full transition-all" title={`Genuine: ${dist.genuine}`} />
          <div style={{ width: `${(dist.suspicious / totalDist) * 100}%`, background: BAND_COLOR.suspicious }} className="h-full transition-all" title={`Suspicious: ${dist.suspicious}`} />
          <div style={{ width: `${(dist.high_risk / totalDist) * 100}%`, background: BAND_COLOR.high_risk }} className="h-full transition-all" title={`High Risk: ${dist.high_risk}`} />
          <div style={{ width: `${(dist.likely_fraud / totalDist) * 100}%`, background: BAND_COLOR.likely_fraud }} className="h-full transition-all" title={`Likely Fraud: ${dist.likely_fraud}`} />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
          {[
            ['Genuine', dist.genuine, BAND_COLOR.genuine],
            ['Suspicious', dist.suspicious, BAND_COLOR.suspicious],
            ['High risk', dist.high_risk, BAND_COLOR.high_risk],
            ['Likely fraud', dist.likely_fraud, BAND_COLOR.likely_fraud],
          ].map(([label, val, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-[var(--text-secondary)]">{label} <span className="text-[var(--text-primary)] font-medium tabular-nums">{val}</span></span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Trend: RECs per risk band by generation-period month */}
      {trendData.length > 1 && (
        <ChartCard title="Risk bands over time">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaf0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#98a2b3', fontSize: 11 }} axisLine={{ stroke: '#e6eaf0' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#98a2b3', fontSize: 11 }} axisLine={{ stroke: '#e6eaf0' }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e6eaf0', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#172033' }}
                cursor={{ fill: 'rgba(23,32,51,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace('_', ' ')} />
              <Bar dataKey="genuine" stackId="band" fill={BAND_COLOR.genuine} name="Genuine" />
              <Bar dataKey="suspicious" stackId="band" fill={BAND_COLOR.suspicious} name="Suspicious" />
              <Bar dataKey="high_risk" stackId="band" fill={BAND_COLOR.high_risk} name="High Risk" />
              <Bar dataKey="likely_fraud" stackId="band" fill={BAND_COLOR.likely_fraud} name="Likely Fraud" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Priority Audit Queue answers "what's suspicious"; clicking a row answers "why" (the
          detail modal's check list) and "what to do next" (its action panel). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <ChartCard
          title="Priority audit queue"
          subtitle="Highest risk score first · ready to investigate"
          actions={<Link to="/recs?band=likely_fraud" className="text-xs text-[var(--brand)] hover:text-[var(--brand-secondary)] font-medium flex items-center gap-1">Fraud queue <ChevronRight className="w-3.5 h-3.5" /></Link>}
          className="lg:col-span-2"
        >
          {highRiskList.length === 0 ? (
            <EmptyState icon={ShieldCheck} description="Nothing above the review threshold right now." />
          ) : (
            <DataTable columns={queueColumns} rows={highRiskList} />
          )}
        </ChartCard>

        {/* Right: Recent Security Alerts Feed */}
        <ChartCard title="Fraud alerts" actions={<span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] font-semibold">Live</span>}>
          <div className="space-y-2.5">
            {alerts.length > 0 ? (
              alerts.map((alt) => (
                <button
                  key={alt.id}
                  onClick={() => setSelectedRecId(alt.rec_id)}
                  className="w-full text-left p-3 rounded-lg bg-[var(--surface-sunken)] hover:bg-[#eef1f6] transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--brand)]">{alt.rec_id}</span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      alt.severity === 'likely_fraud' || alt.severity === 'ledger_integrity' ? 'badge-likely_fraud' : 'badge-suspicious'
                    }`}>
                      {alt.severity.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{alt.message || alt.title}</p>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono block">
                    {new Date(alt.created_at).toLocaleTimeString()}
                  </span>
                </button>
              ))
            ) : (
              <EmptyState icon={Inbox} description="No unacknowledged alerts" />
            )}
          </div>
        </ChartCard>

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
