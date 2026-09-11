import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, AlertTriangle, RefreshCw, CheckCircle, Database, Hash, Clock } from 'lucide-react';
import { verifyLedgerIntegrity } from '../api/client';

export default function LedgerPage() {
  const [ledgerStatus, setLedgerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    runLedgerCheck();
  }, []);

  const runLedgerCheck = async () => {
    try {
      setVerifying(true);
      setError(null);
      const data = await verifyLedgerIntegrity();
      setLedgerStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to verify ledger integrity');
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Lock className="w-6 h-6 text-purple-400" />
            <span>Immutable Cryptographic SHA-256 Ledger Audit</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every REC issuance, transfer, and verification event is linked by cryptographic hash chaining.
          </p>
        </div>

        <button
          onClick={runLedgerCheck}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'Verifying Hashes...' : 'Re-Run Cryptographic Verification'}</span>
        </button>
      </div>

      {/* Ledger Status Banner */}
      <div className={`glass-panel p-6 border-l-4 ${
        ledgerStatus?.valid ? 'border-l-emerald-500 bg-emerald-950/20' : 'border-l-rose-500 bg-rose-950/20'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${ledgerStatus?.valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {ledgerStatus?.valid ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">
                  Cryptographic Chain Status: <span className={ledgerStatus?.valid ? 'text-emerald-400' : 'text-rose-400'}>
                    {ledgerStatus?.valid ? 'VALID & UNTAMPERED' : 'CHAIN BROKEN'}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Checked <span className="font-mono font-bold text-slate-200">{ledgerStatus?.entries_checked || 0}</span> ledger entries sequentially against SHA-256 digest trees.
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs">
            <span className="text-slate-500 block">Head Hash Digest:</span>
            <span className="text-purple-300 font-semibold truncate block max-w-xs">{ledgerStatus?.head_hash || 'Genesis'}</span>
          </div>
        </div>
      </div>

      {/* SHA-256 Explanation Info */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Hash className="w-4 h-4 text-sky-400" /> How Cryptographic Audit Protection Works
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="font-bold text-sky-400 font-mono">1. SHA-256 Digesting</span>
            <p className="text-slate-400">Each event payload (issuance, transfer, verification) is serialized and hashed deterministically.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="font-bold text-purple-400 font-mono">2. Previous Hash Linkage</span>
            <p className="text-slate-400">Entry #N includes the SHA-256 hash of Entry #(N-1). Altering any past block invalidates all downstream hashes.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="font-bold text-emerald-400 font-mono">3. Automated Verification</span>
            <p className="text-slate-400">Auditors can re-verify the full ledger on demand, ensuring zero backdated claims or unauthorized edits.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
