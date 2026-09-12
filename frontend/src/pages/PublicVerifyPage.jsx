import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle, AlertTriangle, Building, Zap, Calendar, User, ExternalLink, RefreshCw, Lock } from 'lucide-react';
import { fetchPublicVerification } from '../api/client';

// Same band language as the auditor-facing badges (index.css's badge-*), so a public verifier
// and an internal auditor read the same risk word as the same color - checklist item "risk
// color consistency" applies just as much to the public page as the dashboard.
const BAND_TEXT = {
  genuine: 'text-[var(--risk-genuine)]',
  suspicious: 'text-[var(--risk-suspicious)]',
  high_risk: 'text-[var(--risk-high)]',
  likely_fraud: 'text-[var(--risk-fraud)]',
};

export default function PublicVerifyPage() {
  const { recId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (recId) {
      loadPublicVerify();
    }
  }, [recId]);

  const loadPublicVerify = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPublicVerification(recId);
      setData(result);
    } catch (err) {
      setError(err.message || 'Certificate not found or invalid ID');
    } finally {
      setLoading(false);
    }
  };

  // Bug found while running the app: this used to read `data.valid`, a field the
  // /public/verify endpoint has never actually returned (confirmed against the live response),
  // so the banner always fell through to "flagged" regardless of the real result. Authenticity
  // here is real ledger integrity plus not being in the two risk-flagged bands - both fields
  // the endpoint genuinely returns, and both already shown elsewhere on this page.
  const isAuthentic = data && data.ledger_valid && data.risk_band !== 'high_risk' && data.risk_band !== 'likely_fraud';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--brand)] mb-2">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">RECShield</h1>
          <p className="text-xs text-[var(--text-tertiary)]">Certificate verification</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-[var(--brand)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Verifying signature&hellip;</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-3">
              <div className="inline-flex p-3 rounded-full bg-[#fef3f2] text-[var(--risk-fraud)]">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Certificate not found</h3>
              <p className="text-xs text-[var(--text-tertiary)]">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Authenticity Banner - the one legitimately loud, colored element on this page,
                  since it's the actual verdict a scanner came here for. */}
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                isAuthentic
                  ? 'bg-[rgba(18,183,106,0.08)] border-[rgba(18,183,106,0.24)] text-[#067647]'
                  : 'bg-[#fef3f2] border-[rgba(217,45,32,0.24)] text-[#912018]'
              }`}>
                {isAuthentic ? (
                  <CheckCircle className="w-6 h-6 text-[var(--risk-genuine)] shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-[var(--risk-fraud)] shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-semibold">
                    {isAuthentic ? 'Authentic & verified' : 'Verification flagged'}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5 font-mono">{data.rec_id}</p>
                </div>
              </div>

              {/* Certificate Details - plain field labels, neutral icons; color is spent only
                  on the risk band value below, which is the one field that actually means
                  something risk-wise. */}
              <div className="space-y-0 divide-y divide-[var(--border)] text-xs">
                <div className="py-3 flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> Solar plant</span>
                  <span className="font-medium text-[var(--text-primary)]">{data.plant_name}</span>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Plant capacity</span>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)]">{data.capacity_kw.toLocaleString()} kW</span>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Certified volume</span>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)]">{data.energy_mwh.toLocaleString()} MWh</span>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Generation period</span>
                  <span className="text-[var(--text-secondary)]">{data.period_start} &rarr; {data.period_end}</span>
                </div>

                {/* Bug found while running the app: this row read `data.holder` and the block
                    below read `data.explanation` - neither field exists on this endpoint's
                    response (confirmed against the live payload), so both silently showed
                    nothing. Swapped the holder row for issuing_authority, a field the endpoint
                    genuinely returns, and dropped the explanation block entirely rather than
                    leave dead markup referencing data that will never arrive. */}
                {data.issuing_authority && (
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Issuing authority</span>
                    <span className="font-medium text-[var(--text-primary)] text-right">{data.issuing_authority}</span>
                  </div>
                )}

                <div className="py-3 flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)] flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Risk band</span>
                  <span className={`uppercase font-semibold font-mono ${data.risk_band ? BAND_TEXT[data.risk_band] : 'text-[var(--text-tertiary)]'}`}>
                    {data.risk_band ? data.risk_band.replace('_', ' ') : 'unverified'}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer link */}
        <div className="text-center">
          <Link to="/" className="text-xs text-[var(--brand)] hover:text-[var(--brand-secondary)] font-medium inline-flex items-center gap-1">
            Auditor sign-in <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
