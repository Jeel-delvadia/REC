import React from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import Button from './Button';

/** The three states almost every data-driven page needs - one implementation each, so a
 * loading spinner or an error banner never has to be hand-rolled per page again. */

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-secondary)]">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="w-10 h-10 rounded-full bg-[#fef3f2] text-[var(--risk-fraud)] flex items-center justify-center">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">Something went wrong</p>
      {message && <p className="text-xs text-[var(--text-secondary)] max-w-sm">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="empty-state">
      <Icon className="w-7 h-7 text-[var(--text-tertiary)]" />
      {title && <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>}
      {description && <p className="text-xs text-[var(--text-secondary)]">{description}</p>}
      {action}
    </div>
  );
}
