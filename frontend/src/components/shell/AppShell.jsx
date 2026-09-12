import React, { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { canViewOversightTools } from '../../lib/permissions';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

/**
 * The persistent app shell: collapsible left Sidebar + TopHeader + routed content.
 * Replaces the old single top Header bar (RS-25 redesign). Collapse state and mobile-drawer
 * state live here since both the sidebar itself and the toggle button in TopHeader need them.
 */
export default function AppShell({ children }) {
  const { role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader onOpenMobileSidebar={() => setMobileOpen(true)} showOversightTools={canViewOversightTools(role)} />

        <main className="flex-1 min-w-0 px-4 lg:px-8 py-6">{children}</main>

        <footer className="border-t border-[var(--border)] py-5 px-4 lg:px-8 text-center text-xs text-[var(--text-tertiary)]">
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>RECShield Platform &copy; 2026. Renewable Energy Certificate Fraud Auditing System.</span>
            <span className="font-mono text-[11px]">FastAPI Engine + React + SHA-256 Ledger</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
