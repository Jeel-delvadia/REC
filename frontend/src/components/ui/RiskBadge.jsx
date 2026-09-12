import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, ShieldAlert } from 'lucide-react';

// Report §6 band names - the one place this mapping lives, mirrored (not duplicated) from
// backend/app/services/risk_service.py's BANDS. The frontend never recomputes a threshold,
// only labels whatever band the backend already decided.
const BAND = {
  genuine: { label: 'Genuine', cls: 'badge-genuine', icon: CheckCircle2 },
  suspicious: { label: 'Suspicious', cls: 'badge-suspicious', icon: AlertTriangle },
  high_risk: { label: 'High Risk', cls: 'badge-high_risk', icon: AlertOctagon },
  likely_fraud: { label: 'Likely Fraud', cls: 'badge-likely_fraud', icon: ShieldAlert },
};

/**
 * The one risk-band badge used everywhere a REC's band shows - dashboard queue, explorer table,
 * detail page, public verify page. `score` is optional (e.g. a bare band chip in a legend).
 */
export default function RiskBadge({ band, score, size = 'md' }) {
  const meta = BAND[band];
  if (!meta) {
    return <span className="badge-neutral inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold">Not verified</span>;
  }
  const Icon = meta.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${meta.cls} ${padding}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {score !== undefined && score !== null ? `${score} · ${meta.label}` : meta.label}
    </span>
  );
}
