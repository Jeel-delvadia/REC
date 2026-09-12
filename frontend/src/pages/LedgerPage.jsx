import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Hash } from 'lucide-react';
import { verifyLedgerIntegrity } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

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
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">SHA-256 Ledger</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Every issuance, transfer, and verification is linked by cryptographic hash chaining.
          </p>
        </div>

        <Button variant="primary" size="md" icon={RefreshCw} onClick={runLedgerCheck} disabled={verifying}>
          {verifying ? 'Verifying…' : 'Re-verify chain'}
        </Button>
      </div>

      {/* Ledger Status Banner - the one place on this page a color-coded left border earns its
          keep, since it's a real pass/fail trust signal, not decoration. */}
      <Card padding="p-6" className={`border-l-2 ${ledgerStatus?.valid ? '!border-l-[var(--risk-genuine)]' : '!border-l-[var(--risk-fraud)]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] flex items-center justify-center shrink-0 ${ledgerStatus?.valid ? 'text-[var(--risk-genuine)]' : 'text-[var(--risk-fraud)]'}`}>
              {ledgerStatus?.valid ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Chain status: <span className={ledgerStatus?.valid ? 'text-[var(--risk-genuine)]' : 'text-[var(--risk-fraud)]'}>
                  {ledgerStatus?.valid ? 'Valid & untampered' : 'Broken'}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {ledgerStatus?.entries_checked || 0} entries checked against their SHA-256 digests
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs">
            <span className="text-[var(--text-tertiary)] block">Head hash</span>
            <span className="text-[var(--text-secondary)] truncate block max-w-xs">{ledgerStatus?.head_hash || 'Genesis'}</span>
          </div>
        </div>
      </Card>

      {/* SHA-256 Explanation - three steps in one sequence, so one consistent accent rather
          than three unrelated colors standing in for "step number". */}
      <Card padding="p-6" className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Hash className="w-4 h-4 text-[var(--text-tertiary)]" /> How this protects the audit trail
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--text-secondary)]">
          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1.5">
            <span className="font-semibold text-[var(--text-primary)] block">1. SHA-256 digesting</span>
            <p>Each event payload is serialized and hashed deterministically.</p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1.5">
            <span className="font-semibold text-[var(--text-primary)] block">2. Previous-hash linkage</span>
            <p>Entry N includes the hash of entry N-1 - altering any past entry breaks every hash after it.</p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1.5">
            <span className="font-semibold text-[var(--text-primary)] block">3. On-demand verification</span>
            <p>Auditors re-verify the full chain any time, catching backdated or unauthorized edits.</p>
          </div>
        </div>
      </Card>

    </div>
  );
}
