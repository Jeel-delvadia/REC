import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Header from './components/common/Header';
import DashboardPage from './pages/DashboardPage';
import RecExplorerPage from './pages/RecExplorerPage';
import ProvenanceGraphPage from './pages/ProvenanceGraphPage';
import LedgerPage from './pages/LedgerPage';
import IngestPage from './pages/IngestPage';
import PublicVerifyPage from './pages/PublicVerifyPage';
import LoginPage from './pages/LoginPage';

// RS-16: the auditor platform needs a signed-in session; the public verify page (the QR scan
// target) never should. `enabled` is false when VITE_SUPABASE_URL/ANON_KEY aren't set, so a
// checkout without Supabase configured behaves exactly as before - no login screen at all.
function AuditorGate({ children }) {
  const { enabled, loading, user } = useAuth();
  if (!enabled) return children;
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
        <span className="text-sm">Checking session...</span>
      </div>
    );
  }
  return user ? children : <LoginPage />;
}

function AuditorPlatform() {
  return (
    <AuditorGate>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 pb-12">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/recs" element={<RecExplorerPage />} />
            <Route path="/graph" element={<ProvenanceGraphPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/ingest" element={<IngestPage />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>RECShield Platform &copy; 2026. Renewable Energy Certificate Fraud Auditing System.</span>
            <span className="font-mono text-[11px] text-slate-600">FastAPI Engine + React + SHA-256 Ledger</span>
          </div>
        </footer>
      </div>
    </AuditorGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public standalone verification layout - no login, ever */}
          <Route path="/verify/:recId" element={<PublicVerifyPage />} />

          {/* Auditor platform - gated behind Supabase Auth once it's configured */}
          <Route path="*" element={<AuditorPlatform />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
