import React from 'react';

/**
 * Minimal table shell: consistent header/row styling so every data grid in the app looks the
 * same without re-deriving text sizes and border colors per page. `columns` is
 * [{ key, header, align, render }] - `render(row)` overrides plain `row[key]` when a cell needs
 * more than text (badges, links, buttons).
 */
export default function DataTable({ columns, rows, rowKey = 'id', onRowClick }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] ${col.align === 'right' ? 'text-right' : ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-[var(--surface-sunken)] transition-colors' : ''}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-2.5 px-3 text-[var(--text-primary)] ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
