import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, CheckCircle2, AlertTriangle, PlusCircle, LogOut, ChevronDown } from 'lucide-react';
import { verifyLedgerIntegrity } from '../../api/client';
import { useAuth } from '../../lib/AuthContext';
import { canIssueOrIngest, ROLE_LABELS } from '../../lib/permissions';
import Button from '../ui/Button';
import UploadCertificateModal from '../rec/UploadCertificateModal';
import RecDetailModal from '../rec/RecDetailModal';

/**
 * Top bar of the app shell: mobile menu toggle, global search, ledger-integrity pill,
 * upload action, account menu. Everything Header.jsx used to render in its top row - the
 * nav links moved into Sidebar.jsx, this keeps only the account/utility strip.
 */
export default function TopHeader({ onOpenMobileSidebar, showOversightTools }) {
  const navigate = useNavigate();
  const { enabled: authEnabled, user, role, signOut } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [ledgerValid, setLedgerValid] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newlyCreatedRecId, setNewlyCreatedRecId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (role === null) return;
    if (!showOversightTools) {
      setLedgerValid(null);
      return;
    }
    checkLedger();
  }, [role, showOversightTools]);

  const checkLedger = async () => {
    try {
      const res = await verifyLedgerIntegrity();
      setLedgerValid(res.valid);
    } catch {
      setLedgerValid(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/recs?search=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)] px-4 lg:px-6 flex items-center gap-3">
      <button
        onClick={onOpenMobileSidebar}
        className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>

      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md hidden sm:block">
        <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search REC ID, plant, holder…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-[var(--surface-sunken)] border border-[var(--border)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/25 rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none transition-colors"
        />
      </form>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        {ledgerValid !== null && (
          <span
            title="SHA-256 ledger integrity"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
              ledgerValid ? 'badge-genuine' : 'badge-likely_fraud'
            }`}
          >
            {ledgerValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{ledgerValid ? 'Ledger Intact' : 'Tamper Detected'}</span>
          </span>
        )}

        {canIssueOrIngest(role) && (
          <Button variant="primary" size="sm" icon={PlusCircle} onClick={() => setShowUploadModal(true)}>
            <span className="hidden sm:inline">Upload Certificate</span>
          </Button>
        )}

        {authEnabled && user && (
          <div className="relative pl-2 ml-1 border-l border-[var(--border)]">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-sunken)] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="hidden md:block text-left leading-tight">
                <p className="text-xs font-semibold text-[var(--text-primary)] max-w-[140px] truncate">{user.email}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">{ROLE_LABELS[role] || role}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] hidden md:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 card p-1.5 z-50">
                <div className="px-2.5 py-2 md:hidden border-b border-[var(--border)] mb-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.email}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{ROLE_LABELS[role] || role}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium text-[var(--risk-fraud)] hover:bg-[#fef3f2] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadCertificateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(createdRecId) => setNewlyCreatedRecId(createdRecId)}
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
