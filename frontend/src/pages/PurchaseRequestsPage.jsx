import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Clock, Inbox } from 'lucide-react';
import { fetchPurchaseRequests, approvePurchaseRequest, rejectPurchaseRequest } from '../api/client';
import Card from '../components/ui/Card';
import { LoadingState, EmptyState } from '../components/ui/States';

const STATUS_CLS = {
  pending: 'badge-suspicious',
  approved: 'badge-genuine',
  rejected: 'badge-likely_fraud',
};

// RS-24: the other half of the marketplace flow - an auditor/admin reviews every buyer
// request here before ownership actually transfers. Approving performs the real transfer
// (Transaction + TRANSFERRED ledger entry, on the backend); this page never does that itself.
export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    load();
  }, [filter]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPurchaseRequests(filter || undefined);
      setRequests(data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  };

  const decide = async (request, action) => {
    const note = window.prompt(`Optional note for ${action === 'approve' ? 'approving' : 'rejecting'} ${request.rec_id}:`, '') || null;
    try {
      setDecidingId(request.id);
      if (action === 'approve') {
        await approvePurchaseRequest(request.id, note);
      } else {
        await rejectPurchaseRequest(request.id, note);
      }
      await load();
    } catch (err) {
      alert(`Failed to ${action}: ${err.message}`);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Purchase Requests</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Approving transfers ownership to the buyer and records it on the ledger.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {['pending', 'approved', 'rejected', ''].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === s ? 'bg-[#e7f6ef] text-[var(--brand)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[#fef3f2] border border-[rgba(217,45,32,0.24)] text-[var(--risk-fraud)] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card padding="p-0" className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : requests.length === 0 ? (
          <EmptyState icon={Inbox} description={`No ${filter || ''} purchase requests`} />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {requests.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[var(--brand)] text-sm">{r.rec_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${STATUS_CLS[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Requested by <span className="font-mono text-[var(--text-primary)]">{r.buyer_email}</span> on {new Date(r.requested_at).toLocaleString()}
                  </p>
                  {r.note && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 italic">"{r.note}"</p>}
                  {r.decision_note && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      Decided by {r.decided_by}: {r.decision_note}
                    </p>
                  )}
                </div>
                {r.status === 'pending' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decide(r, 'approve')}
                      disabled={decidingId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(18,183,106,0.1)] hover:bg-[rgba(18,183,106,0.18)] text-[#067647] border border-[rgba(18,183,106,0.24)] text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide(r, 'reject')}
                      disabled={decidingId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(217,45,32,0.12)] hover:bg-[rgba(217,45,32,0.2)] text-[#912018] border border-[rgba(217,45,32,0.28)] text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {r.decided_at ? new Date(r.decided_at).toLocaleString() : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
