import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Database, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, 
  Building, Zap, Calendar, User, ShieldCheck, ShieldAlert, PlusCircle, Upload
} from 'lucide-react';
import { fetchRecs } from '../api/client';
import RecDetailModal from '../components/rec/RecDetailModal';
import UploadCertificateModal from '../components/rec/UploadCertificateModal';

export default function RecExplorerPage() {
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
  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    loadRecs();
  }, [searchParams, page]);

  const loadRecs = async () => {
    try {
      setLoading(true);
      const s = searchParams.get('search') || '';
      const b = searchParams.get('band') || '';
      const st = searchParams.get('status') || '';
      const ms = searchParams.get('min_score') || '';

      const data = await fetchRecs({
        search: s,
        band: b,
        status: st,
        min_score: ms,
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
    setSearchParams(params);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setBand('');
    setStatus('');
    setMinScore('');
    setSearchParams({});
    setPage(1);
  };

  const getBadgeClass = (b) => {
    switch (b) {
      case 'low': return 'badge-low';
      case 'medium': return 'badge-medium';
      case 'high': return 'badge-high';
      case 'critical': return 'badge-critical';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Database className="w-6 h-6 text-sky-400" />
            <span>Renewable Energy Certificate Registry Explorer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, issue, and inspect verified green energy certificates across solar assets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-sky-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload / Issue Certificate</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <form onSubmit={handleApplyFilters} className="glass-panel p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Search Keywords</label>
          <div className="relative">
            <input
              type="text"
              placeholder="REC ID, plant, holder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Risk Band</label>
          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none capitalize"
          >
            <option value="">All Risk Bands</option>
            <option value="low">Low Risk (0-39)</option>
            <option value="medium">Medium Risk (40-59)</option>
            <option value="high">High Risk (60-79)</option>
            <option value="critical">Critical Risk (80-100)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Audit Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none capitalize"
          >
            <option value="">All Statuses</option>
            <option value="unverified">Unverified</option>
            <option value="verified">Verified</option>
            <option value="flagged">Flagged</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1">Min Risk Score</label>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="e.g. 50"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Main RECs Data Table */}
      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            <p className="text-sm font-semibold">Querying certificates database...</p>
          </div>
        ) : recs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <p className="text-sm font-semibold text-slate-300">No certificates match your query filter</p>
            <p className="text-xs text-slate-500">Try clearing filters or issuing a new certificate.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={handleResetFilters} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">
                Clear All Filters
              </button>
              <button onClick={() => setShowUploadModal(true)} className="px-4 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                Upload New Certificate
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">REC ID</th>
                  <th className="py-3 px-4">Plant Name</th>
                  <th className="py-3 px-4 font-mono">Energy MWh</th>
                  <th className="py-3 px-4">Period Dates</th>
                  <th className="py-3 px-4">Current Holder</th>
                  <th className="py-3 px-4">Risk Score / Band</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recs.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{rec.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{rec.plant_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {rec.plant_id}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      {rec.energy_mwh.toLocaleString()} MWh
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {rec.period_start} to {rec.period_end}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-purple-300 max-w-[160px] truncate">
                      {rec.holder}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${getBadgeClass(rec.risk_band)}`}>
                        {rec.risk_band || 'unverified'} ({rec.risk_score ?? 'N/A'})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center capitalize font-semibold text-slate-300">
                      {rec.status}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedRecId(rec.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all shadow-sm group-hover:border-sky-400"
                      >
                        Inspect Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
            <span className="text-xs text-slate-400">
              Page <span className="font-bold text-white">{page}</span> of <span className="font-bold text-white">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
