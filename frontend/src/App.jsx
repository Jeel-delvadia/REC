import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { canIssueOrIngest, canManageUsers, canViewOversightTools, canBrowseMarketplace, canReviewPurchaseRequests } from './lib/permissions';
import AppShell from './components/shell/AppShell';
import DashboardPage from './pages/DashboardPage';
import RecExplorerPage from './pages/RecExplorerPage';
import ProvenanceGraphPage from './pages/ProvenanceGraphPage';
import LedgerPage from './pages/LedgerPage';
import IngestPage from './pages/IngestPage';
import AdminUsersPage from './pages/AdminUsersPage';
import MarketplacePage from './pages/MarketplacePage';
import PurchaseRequestsPage from './pages/PurchaseRequestsPage';
import PublicVerifyPage from './pages/PublicVerifyPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';

// RS-21 (§9.5): frontend-side route guard. The real enforcement is server-side (every
// endpoint these pages call is role-gated already) - this exists purely so a plant_operator
// or buyer who types /ledger into the address bar gets a clear "not for your role" message
// instead of a page that loads its shell and then silently fails every fetch with a 403.
function RoleGate({ allowed, children }) {
  const { role } = useAuth();
  if (role === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[var(--text-secondary)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }
  if (!allowed(role)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3 px-4">
        <ShieldAlert className="w-10 h-10 text-[var(--risk-suspicious)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">This page isn't available for your role</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm">Your account doesn't have access to this section of RECShield. Contact a registry admin if you believe this is wrong.</p>
      </div>
    );
  }
  return children;
}

// RS-16: the auditor platform needs a signed-in session; the public verify page (the QR scan
// target) never should. `enabled` is false when VITE_SUPABASE_URL/ANON_KEY aren't set, so a
// checkout without Supabase configured behaves exactly as before - no login screen at all.
function AuditorGate({ children }) {
  const { enabled, loading, user } = useAuth();
  if (!enabled) return children;
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-secondary)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
        <span className="text-sm">Checking session...</span>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

// RS-25: "/" is the public marketing page for a signed-out visitor, but a signed-in user (or a
// dev checkout with Supabase unconfigured, where there's no concept of "signed out" at all)
// should land straight on their dashboard instead of the pitch they already converted from.
function HomeRoute() {
  return <LandingPage />;
}


function AuditorPlatform() {
  return (
    <AuditorGate>
      <AppShell>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/recs" element={<RecExplorerPage />} />
          <Route path="/graph" element={<RoleGate allowed={canViewOversightTools}><ProvenanceGraphPage /></RoleGate>} />
          <Route path="/ledger" element={<RoleGate allowed={canViewOversightTools}><LedgerPage /></RoleGate>} />
          <Route path="/ingest" element={<RoleGate allowed={canIssueOrIngest}><IngestPage /></RoleGate>} />
          <Route path="/admin" element={<RoleGate allowed={canManageUsers}><AdminUsersPage /></RoleGate>} />
          <Route path="/marketplace" element={<RoleGate allowed={canBrowseMarketplace}><MarketplacePage /></RoleGate>} />
          <Route path="/purchase-requests" element={<RoleGate allowed={canReviewPurchaseRequests}><PurchaseRequestsPage /></RoleGate>} />
        </Routes>
      </AppShell>
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

          {/* Public marketing landing page */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/landing" element={<LandingPage />} />


          {/* Sign in / sign up - its own route now (previously rendered inline by AuditorGate) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Auditor platform - gated behind Supabase Auth once it's configured */}
          <Route path="/*" element={<AuditorPlatform />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
