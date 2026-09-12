import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Database, Network, Lock, Search, RefreshCw, CheckCircle, AlertTriangle, PlusCircle, LogOut, UserCircle } from 'lucide-react';
import { verifyLedgerIntegrity } from '../../api/client';
import { useAuth } from '../../lib/AuthContext';
import UploadCertificateModal from '../rec/UploadCertificateModal';
import RecDetailModal from '../rec/RecDetailModal';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enabled: authEnabled, user, signOut } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [ledgerValid, setLedgerValid] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newlyCreatedRecId, setNewlyCreatedRecId] = useState(null);

  useEffect(() => {
    checkLedger();
  }, []);

  const checkLedger = async () => {
    try {
      setIsVerifying(true);
      const res = await verifyLedgerIntegrity();
      setLedgerValid(res.valid);
    } catch {
      setLedgerValid(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/recs?search=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/recs', label: 'REC Explorer', icon: Database },
    { path: '/graph', label: 'Provenance Graph', icon: Network },
    { path: '/ledger', label: 'SHA-256 Ledger', icon: Lock },
    { path: '/ingest', label: 'Data Hub', icon: RefreshCw },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0a0e16]/95 border-b border-slate-800/80">
      {/* Row 1: brand, ledger status, search, upload, account - all fixed-height so it never
          fights the nav row below for space (that competition was why nav labels used to
          truncate to "Provenan...": everything was jammed into one flex row on desktop). */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white leading-none">REC<span className="text-blue-400">Shield</span></span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">Certificate Integrity Platform</p>
          </div>
        </Link>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md hidden md:block">
          <input
            type="text"
            placeholder="Search REC ID, plant, holder..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2 shrink-0">
          {ledgerValid !== null && (
            <span
              title="SHA-256 ledger integrity"
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${
                ledgerValid
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
              }`}
            >
              {ledgerValid ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{ledgerValid ? 'Ledger Intact' : 'Tamper Detected'}</span>
            </span>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-colors shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Certificate</span>
          </button>

          {authEnabled && user && (
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-slate-800">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono max-w-[160px] truncate">
                <UserCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> {user.email}
              </span>
              <button
                onClick={() => signOut()}
                title="Sign out"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: primary navigation - its own full-width row so five labels always have room
          to render fully instead of being squeezed against the search bar and upload button. */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-2">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-slate-900 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-500/12 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile-only search, since row 1 hides it below md */}
      <form onSubmit={handleSearchSubmit} className="relative px-4 pb-3 md:hidden">
        <input
          type="text"
          placeholder="Search REC ID, plant, holder..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-7 top-[1.35rem]" />
      </form>

      {/* Both modals portal themselves to document.body internally (see UploadCertificateModal
          and RecDetailModal), so they render correctly no matter what ancestor mounts them -
          including this header, whose own blur/gradient styling used to trap them via
          backdrop-filter's containing-block effect on position:fixed descendants. */}
      {showUploadModal && (
        <UploadCertificateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(createdRecId) => {
            setNewlyCreatedRecId(createdRecId);
          }}
        />
      )}

      {newlyCreatedRecId && (
        <RecDetailModal
          recId={newlyCreatedRecId}
          onClose={() => setNewlyCreatedRecId(null)}
          onActionSuccess={() => checkLedger()}
        />
      )}
    </header>
  );
}
