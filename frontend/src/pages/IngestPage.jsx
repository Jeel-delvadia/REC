import React, { useState } from 'react';
import { RefreshCw, Database, CheckCircle, AlertTriangle, Play, ShieldAlert, Cpu } from 'lucide-react';
import { triggerDataIngest } from '../api/client';

export default function IngestPage() {
  const [reset, setReset] = useState(true);
  const [verify, setVerify] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleIngest = async () => {
    try {
      setRunning(true);
      setError(null);
      setResult(null);
      const res = await triggerDataIngest(reset, verify);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Data ingestion failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-400" />
          <span>Data Management & Telemetry Ingestion Hub</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Seed simulated solar generation telemetry, train isolation forest anomaly models, and trigger verification audits.
        </p>
      </div>

      {/* Control Card */}
      <div className="glass-panel p-6 space-y-6">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" /> Demo Dataset Seeding Controller
        </h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reset}
              onChange={(e) => setReset(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-200 block">Reset & Wipe Database Tables</span>
              <span className="text-[11px] text-slate-400">Clears current SQLite tables and re-seeds from CSV simulated telemetry data.</span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={verify}
              onChange={(e) => setVerify(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-200 block">Automated AI Batch Verification</span>
              <span className="text-[11px] text-slate-400">Automatically executes physics, double counting, anomaly, and provenance checks for every REC.</span>
            </div>
          </label>
        </div>

        <button
          onClick={handleIngest}
          disabled={running}
          className="w-full py-3 btn-primary rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Ingesting CSV Data & Running AI Verification Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Trigger Data Ingestion & Audit Pipeline</span>
            </>
          )}
        </button>

        {/* Results Box */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Data Ingestion Completed Successfully!
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono pt-2 text-slate-200">
              <div>Plants: <span className="text-blue-400 font-bold">{result.plants}</span></div>
              <div>Meter Days: <span className="text-blue-400 font-bold">{result.generation}</span></div>
              <div>RECs: <span className="text-amber-400 font-bold">{result.recs}</span></div>
              <div>Transfers: <span className="text-purple-400 font-bold">{result.transactions}</span></div>
              <div>Verified: <span className="text-emerald-400 font-bold">{result.verified}</span></div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
