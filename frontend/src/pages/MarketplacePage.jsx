import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Store } from 'lucide-react';
import { fetchMarketplace, requestPurchase, fetchPurchaseRequests } from '../api/client';
import Card from '../components/ui/Card';
import RiskBadge from '../components/ui/RiskBadge';
import { LoadingState, EmptyState } from '../components/ui/States';

const STATUS_META = {
  pending: { label: 'Pending review', icon: Clock, cls: 'text-[var(--risk-suspicious)]' },
  approved: { label: 'Approved', icon: CheckCircle, cls: 'text-[var(--risk-genuine)]' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'text-[var(--risk-fraud)]' },
};

// RS-24: a buyer browses unclaimed RECs and requests one - an auditor/admin has to approve it
// before ownership actually transfers (see PurchaseRequestsPage.jsx), same "nothing changes
// without a human check" principle as every other state change in this app.
export default function MarketplacePage() {
  const [listings, setListings] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestingId, setRequestingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listingData, requestData] = await Promise.all([fetchMarketplace(), fetchPurchaseRequests()]);
      setListings(listingData);
      setMyRequests(requestData);
    } catch (err) {
      setError(err.message || 'Failed to load the marketplace');
    } finally {
      setLoading(false);
    }
  };

  const requestedRecIds = new Set(myRequests.filter((r) => r.status === 'pending').map((r) => r.rec_id));

  const handleRequest = async (recId) => {
    // Matches PurchaseRequestsPage's approve/reject pattern - an optional one-line note via
    // a native prompt, rather than a text input sitting in every single table row for a field
    // most requests won't use.
    const note = window.prompt(`Optional note for your request on ${recId}:`, '');
    if (note === null) return; // cancelled
    try {
      setRequestingId(recId);
      await requestPurchase(recId, note || null);
      await load();
    } catch (err) {
      alert(`Could not submit request: ${err.message}`);
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) return <LoadingState label="Loading available certificates…" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Marketplace</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Certificates not yet linked to a buyer. Request one and an auditor reviews the transfer before it's yours.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[#fef3f2] border border-[rgba(217,45,32,0.24)] text-[var(--risk-fraud)] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* My Requests */}
      {myRequests.length > 0 && (
        <Card padding="p-5" className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">My requests</h2>
          <div className="space-y-1.5">
            {myRequests.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-xs">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-[var(--brand)]">{r.rec_id}</span>
                    {r.note && <p className="text-[var(--text-tertiary)] mt-0.5 truncate">"{r.note}"</p>}
                    {r.decision_note && <p className="text-[var(--text-tertiary)] mt-0.5 truncate">Admin: {r.decision_note}</p>}
                  </div>
                  <span className={`flex items-center gap-1.5 font-medium shrink-0 ${meta.cls}`}>
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Available listings */}
      <Card padding="p-0" className="overflow-hidden">
        {listings.length === 0 ? (
          <EmptyState icon={Store} title="Nothing available right now" description="Every certificate is already linked to a buyer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] text-[11px]">
                  <th className="py-2.5 px-4 font-medium">REC ID</th>
                  <th className="py-2.5 px-4 font-medium">Plant</th>
                  <th className="py-2.5 px-4 font-medium">Energy</th>
                  <th className="py-2.5 px-4 font-medium">Period</th>
                  <th className="py-2.5 px-4 font-medium">Risk</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {listings.map((rec) => {
                  const alreadyRequested = requestedRecIds.has(rec.id);
                  return (
                    <tr key={rec.id} className="hover:bg-[var(--surface-sunken)] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--brand)]">{rec.id}</td>
                      <td className="py-3 px-4 text-[var(--text-primary)]">{rec.plant_name}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[var(--text-secondary)]">{rec.energy_mwh.toLocaleString()} MWh</td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{rec.period_start} &rarr; {rec.period_end}</td>
                      <td className="py-3 px-4">
                        {rec.risk_band ? (
                          <RiskBadge band={rec.risk_band} score={rec.risk_score} size="sm" />
                        ) : (
                          <span className="text-[var(--text-tertiary)] text-[11px]">Not verified</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {alreadyRequested ? (
                          <span className="text-[11px] text-[var(--risk-suspicious)] font-medium">Pending</span>
                        ) : (
                          <button
                            onClick={() => handleRequest(rec.id)}
                            disabled={requestingId === rec.id}
                            className="btn btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            {requestingId === rec.id ? 'Requesting…' : 'Request'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
