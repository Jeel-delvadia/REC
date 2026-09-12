import React from 'react';

const TONES = {
  neutral: 'badge-neutral',
  info: 'badge-info',
  success: 'badge-genuine',
  warning: 'badge-suspicious',
  danger: 'badge-high_risk',
};

/** Generic status pill - for anything that isn't a fraud risk-band (use RiskBadge for that). */
export default function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${TONES[tone] || TONES.neutral} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}
