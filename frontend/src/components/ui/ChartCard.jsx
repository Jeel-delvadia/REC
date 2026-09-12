import React from 'react';
import Card from './Card';

/** Wraps any chart/table body with a consistent title row - name, optional subtitle, and a
 * right-aligned actions slot (filters, a "view all" link) so every data panel in the app reads
 * the same way before you even look at what it contains. */
export default function ChartCard({ title, subtitle, actions, children, padding = 'p-6', className = '' }) {
  return (
    <Card padding={padding} className={className}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            {title && <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>}
            {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}
