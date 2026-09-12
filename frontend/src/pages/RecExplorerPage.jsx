import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database, Search, RefreshCw, ChevronLeft, ChevronRight, PlusCircle,
} from 'lucide-react';
import { fetchRecs } from '../api/client';
import RecDetailModal from '../components/rec/RecDetailModal';
import UploadCertificateModal from '../components/rec/UploadCertificateModal';
import { useAuth } from '../lib/AuthContext';
import { canIssueOrIngest } from '../lib/permissions';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import RiskBadge from '../components/ui/RiskBadge';
import DataTable from '../components/ui/DataTable';
import { LoadingState, EmptyState } from '../components/ui/States';

export default function RecExplorerPage() {
  const { role } = useAuth();
  const canUpload = canIssueOrIngest(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [recs, setRecs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRecId, setSelectedRecId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Filters state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [band, setBand] = useState(searchParams.get('band') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [minScore, setMinScore] = useState(searchParams.get('min_score') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    loadRecs();
  }, [searchParams, page]);

  const loadRecs = async () => {
    try {
      setLoading(true);
      const data = await fetchRecs({
        search: searchParams.get('search') || '',
        band: searchParams.get('band') || '',
        status: searchParams.get('status') || '',
        min_score: searchParams.get('min_score') || '',
        date_from: searchParams.get('date_from') || '',
        date_to: searchParams.get('date_to') || '',
        limit,
        offset: (page - 1) * limit,
      });

      setRecs(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load RECs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    const params = {};
    if (search) params.search = search;
    if (band) params.band = band;
    if (status) params.status = status;
    if (minScore) params.min_score = minScore;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    setSearchParams(params);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setBand('');
    setStatus('');
    setMinScore('');
    setDateFrom('');
    setDateTo('');
    setSearchParams({});
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const fieldClass = 'w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/25 rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition-colors';

  const columns = [
    { key: 'id', header: 'REC ID', render: (r) => <span className="font-mono font-semibold text-[var(--brand)]">{r.id}</span> },
    {
      key: 'plant', header: 'Plant', render: (r) => (
        <div>
          <div className="font-medium text-[var(--text-primary)]">{r.plant_name}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{r.plant_id}</div>
        </div>
      ),
    },
    { key: 'energy_mwh', header: 'Energy', render: (r) => <span className="font-mono tabular-nums">{r.energy_mwh.toLocaleString()} MWh</span> },
    { key: 'period', header: 'Period', render: (r) => <span className="text-[var(--text-secondary)]">{r.period_start} &rarr; {r.period_end}</span> },
    { key: 'holder', header: 'Holder', render: (r) => <span className="max-w-[160px] truncate block text-[var(--text-secondary)]">{r.holder}</span> },
    { key: 'risk_band', header: 'Risk', render: (r) => <RiskBadge band={r.risk_band} score={r.risk_score} size="sm" /> },
    { key: 'status', header: 'Status', render: (r) => <span className="capitalize text-[var(--text-secondary)]">{r.status}</span> },
    {
      key: 'action', header: '', align: 'right',
      render: (r) => <Button variant="secondary" size="sm" onClick={() => setSelectedRecId(r.id)}>Inspect</Button>,
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">REC Explorer</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Search, filter, and inspect every certificate in the registry.
          </p>
        </div>

        {canUpload && (
          <Button variant="primary" size="md" icon={PlusCircle} onClick={() => setShowUploadModal(true)}>
            Issue Certificate
          </Button>
        )}
      </div>

      {/* Filter Controls Bar */}
      <Card padding="p-4">
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
          <div className="xl:col-span-2">
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="REC ID, plant, holder..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${fieldClass} pl-8`}
              />
              <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Risk Band</label>
            <select value={band} onChange={(e) => setBand(e.target.value)} className={`${fieldClass} capitalize`}>
              <option value="">All Risk Bands</option>
              <option value="genuine">Genuine (0-30)</option>
              <option value="suspicious">Suspicious (31-60)</option>
              <option value="high_risk">High Risk (61-80)</option>
              <option value="likely_fraud">Likely Fraud (81-100)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Audit Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${fieldClass} capitalize`}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="reported">Reported</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Min Risk Score</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 50"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className={`${fieldClass} font-mono`}
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Period From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Period To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={fieldClass} />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 md:col-span-1 xl:col-span-7">
            <button type="submit" className="btn btn-primary flex-1 py-1.5 px-3 text-xs justify-center">
              Apply Filters
            </button>
            <button type="button" onClick={handleResetFilters} className="btn btn-secondary py-1.5 px-3 text-xs">
              Reset
            </button>
          </div>
        </form>
      </Card>

      {/* Main RECs Data Table */}
      <Card padding="p-0" className="overflow-hidden">
        {loading ? (
          <LoadingState label="Loading certificates…" />
        ) : recs.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No certificates match this filter"
            action={
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>Clear filters</Button>
                {canUpload && <Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>Issue a certificate</Button>}
              </div>
            }
          />
        ) : (
          <div className="p-1">
            <DataTable columns={columns} rows={recs} onRowClick={(r) => setSelectedRecId(r.id)} />
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
            <span className="text-xs text-[var(--text-secondary)]">
              Page <span className="font-bold text-[var(--text-primary)] tabular-nums">{page}</span> of <span className="font-bold text-[var(--text-primary)] tabular-nums">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* REC Upload Certificate Modal */}
      {showUploadModal && (
        <UploadCertificateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newRecId) => {
            loadRecs();
            setSelectedRecId(newRecId);
          }}
        />
      )}

      {/* REC Detail Modal */}
      {selectedRecId && (
        <RecDetailModal
          recId={selectedRecId}
          onClose={() => setSelectedRecId(null)}
          onActionSuccess={loadRecs}
        />
      )}
    </div>
  );
}
