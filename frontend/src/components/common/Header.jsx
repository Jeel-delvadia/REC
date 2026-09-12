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
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Ledger Status Pill */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">REC<span className="text-sky-400">Shield</span></span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  AI Audit v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">Renewable Energy Certificate Integrity</p>
            </div>
          </Link>

          {/* Quick Upload Button (Mobile) */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="md:hidden flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-sky-500 text-slate-950 font-bold"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Search Bar & Upload Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-72">
            <input
              type="text"
              placeholder="Search REC ID, plant, holder..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </form>

          <button
            onClick={() => setShowUploadModal(true)}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-cyan-400 transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload Certificate</span>
          </button>
        </div>

        {/* Navigation Bar Links */}
        <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Signed-in auditor (RS-16) - only shown once Supabase Auth is configured */}
        {authEnabled && user && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <UserCircle className="w-3.5 h-3.5 text-sky-400" /> {user.email}
            </span>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Certificate Modal */}
      {showUploadModal && (
        <UploadCertificateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(createdRecId) => {
            setNewlyCreatedRecId(createdRecId);
          }}
        />
      )}

      {/* Created REC Audit Inspection Modal */}
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
