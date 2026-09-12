import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Play, ClipboardCheck, ChevronDown, ChevronUp, Info, AlertCircle } from 'lucide-react';
import { triggerDataIngest, fetchLatestDataQualityReport } from '../api/client';
import Card from '../components/ui/Card';

// RS-20 (§9.6): a data-quality score is "how much can I trust this batch," not "how likely
// is this fraud" - a different axis from the risk bands, so it gets its own label set even
// though it reuses the same badge color language (badge-genuine/suspicious/high_risk/
// likely_fraud from index.css) for visual consistency with the rest of the dashboard.
function dqBand(score) {
  if (score >= 90) return { label: 'Excellent', cls: 'badge-genuine' };
  if (score >= 75) return { label: 'Good', cls: 'badge-genuine' };
  if (score >= 50) return { label: 'Needs review', cls: 'badge-suspicious' };
  if (score >= 25) return { label: 'Poor', cls: 'badge-high_risk' };
  return { label: 'Critical', cls: 'badge-likely_fraud' };
}

const SEVERITY_ICON = { fail: AlertTriangle, warn: AlertCircle, info: Info };
const SEVERITY_COLOR = { fail: 'text-[var(--risk-fraud)]', warn: 'text-[var(--risk-suspicious)]', info: 'text-[var(--text-tertiary)]' };

function DataQualityCard({ report }) {
  const [expanded, setExpanded] = useState(true);
  if (!report) return null;
  const band = dqBand(report.score);
  return (
    <Card padding="p-5" className="space-y-3">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded((e) => !e)}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[var(--text-tertiary)]" /> Data quality
        </h3>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${band.cls}`}>
            {report.score}/100 &middot; {band.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
        </div>
      </button>
      {expanded && (
        report.issues.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No issues in the last ingest &mdash; no duplicate IDs, no dangling references, no statistical outliers, complete fields, fresh data.</p>
        ) : (
          <div className="space-y-1.5">
            {report.issues.map((issue, i) => {
              const Icon = SEVERITY_ICON[issue.severity] || Info;
              return (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-xs">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${SEVERITY_COLOR[issue.severity]}`} />
                  <div>
                    <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase">{issue.file} &middot; {issue.rule}</span>
                    <p className="text-[var(--text-secondary)]">{issue.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </Card>
  );
}

export default function IngestPage() {
  const [reset, setReset] = useState(true);
  const [verify, setVerify] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dqReport, setDqReport] = useState(null);

  useEffect(() => {
    // Show the last ingest's report even before anyone clicks the button again this session -
    // a fresh page load shouldn't hide data quality history that already exists.
    fetchLatestDataQualityReport().then(setDqReport).catch(() => {});
  }, []);

  const handleIngest = async () => {
    try {
      setRunning(true);
      setError(null);
      setResult(null);
      const res = await triggerDataIngest(reset, verify);
      setResult(res);
      setDqReport(res.data_quality || null);
    } catch (err) {
      setError(err.message || 'Data ingestion failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Data Hub</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Seed simulated telemetry and run verification across the full dataset.
        </p>
      </div>

      {/* Control Card */}
      <Card padding="p-6" className="space-y-5">
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reset}
              onChange={(e) => setReset(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)] block">Reset before loading</span>
              <span className="text-xs text-[var(--text-secondary)]">Clears existing tables and re-seeds from the simulated telemetry CSVs.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={verify}
              onChange={(e) => setVerify(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-[var(--brand)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)] block">Verify after loading</span>
              <span className="text-xs text-[var(--text-secondary)]">Runs physics, meter, duplicate, anomaly and provenance checks on every REC.</span>
            </div>
          </label>
        </div>

        <button onClick={handleIngest} disabled={running} className="w-full btn btn-primary py-2.5 text-sm justify-center disabled:opacity-50">
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Ingesting&hellip;</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run ingestion</span>
            </>
          )}
        </button>

        {/* Results Box */}
        {result && (
          <div className="p-4 rounded-xl badge-genuine space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle className="w-4 h-4" /> Ingestion complete
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono pt-1">
              <div>Plants <span className="block text-sm font-semibold tabular-nums">{result.plants}</span></div>
              <div>Meter days <span className="block text-sm font-semibold tabular-nums">{result.generation}</span></div>
              <div>RECs <span className="block text-sm font-semibold tabular-nums">{result.recs}</span></div>
              <div>Transfers <span className="block text-sm font-semibold tabular-nums">{result.transactions}</span></div>
              <div>Verified <span className="block text-sm font-semibold tabular-nums">{result.verified}</span></div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl badge-likely_fraud text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      <DataQualityCard report={dqReport} />
    </div>
  );
}
