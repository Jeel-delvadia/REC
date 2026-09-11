import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/common/Header';
import DashboardPage from './pages/DashboardPage';
import RecExplorerPage from './pages/RecExplorerPage';
import ProvenanceGraphPage from './pages/ProvenanceGraphPage';
import LedgerPage from './pages/LedgerPage';
import IngestPage from './pages/IngestPage';
import PublicVerifyPage from './pages/PublicVerifyPage';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public standalone verification layout without main dashboard header */}
        <Route path="/verify/:recId" element={<PublicVerifyPage />} />

        {/* Auditor Platform layout with Header */}
        <Route
          path="*"
          element={
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
          }
        />
      </Routes>
    </Router>
  );
}
