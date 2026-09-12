import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, LayoutDashboard, FileCheck2, Network, Lock, RefreshCw,
  ShoppingBag, ClipboardCheck, Users, ChevronLeft, X,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  canIssueOrIngest, canManageUsers, canViewOversightTools,
  canBrowseMarketplace, canReviewPurchaseRequests,
} from '../../lib/permissions';

/**
 * The app shell's left sidebar. RS-25 (UI redesign): replaces the old two-row top Header nav.
 * Every role check here is the exact same permission function Header.jsx used - this only
 * changes where the nav lives, never who's allowed to see what (that's still decided by the
 * backend on every request regardless of what this file shows).
 */
export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const { role } = useAuth();

  const showOversight = canViewOversightTools(role);

  // Grouped to mirror how an auditor actually works: look at things (Overview/Certificates),
  // investigate (Graph/Ledger), operate the registry (Data Hub/Marketplace/Requests), administer.
  const groups = [
    {
      label: 'Workspace',
      items: [
        { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, show: true },
        { path: '/recs', label: 'Certificates', icon: FileCheck2, show: true },
      ],
    },
    {
      label: 'Investigate',
      items: [
        { path: '/graph', label: 'Graph Analysis', icon: Network, show: showOversight },
        { path: '/ledger', label: 'Audit History', icon: Lock, show: showOversight },
      ],
    },
    {
      label: 'Registry',
      items: [
        { path: '/ingest', label: 'Data Hub', icon: RefreshCw, show: canIssueOrIngest(role) },
        { path: '/marketplace', label: 'Marketplace', icon: ShoppingBag, show: canBrowseMarketplace(role) },
        { path: '/purchase-requests', label: 'Purchase Requests', icon: ClipboardCheck, show: canReviewPurchaseRequests(role) },
      ],
    },
    {
      label: 'System',
      items: [
        { path: '/admin', label: 'User Management', icon: Users, show: canManageUsers(role) },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={onCloseMobile}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#e7f6ef] text-[var(--brand)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--brand)]"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const body = (
    <div className={`h-full flex flex-col bg-[var(--surface)] border-r border-[var(--border)] ${collapsed ? 'w-[76px]' : 'w-64'} transition-[width] duration-200`}>
      {/* Brand */}
      <div className={`h-16 flex items-center shrink-0 border-b border-[var(--border)] ${collapsed ? 'justify-center px-2' : 'px-5 justify-between'}`}>
        <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-[18px] h-[18px] text-white" />
          </div>
          {!collapsed && <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-tight truncate">RECShield</span>}
        </Link>
        {/* Mobile close */}
        <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => <NavLink key={item.path} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle - desktop only */}
      <div className="hidden lg:block p-3 border-t border-[var(--border)]">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always in flow */}
      <div className="hidden lg:block shrink-0">{body}</div>

      {/* Mobile/tablet: drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="w-64 h-full">{body}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
