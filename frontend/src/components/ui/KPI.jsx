import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Card from './Card';

/** Animates a number counting up to its target on mount/change - subtle, not a gimmick, and
 * respects prefers-reduced-motion via a plain instant set instead of a tween in that case. */
function AnimatedNumber({ value }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6, ease: 'easeOut' });
    return controls.stop;
  }, [value]);

  useEffect(() => rounded.on('change', setDisplay), [rounded]);
  return <>{display}</>;
}

/**
 * One KPI tile: a hero number, a label, and an optional trend line. Cards are deliberately NOT
 * visually identical to each other - `tone` lets a specific KPI (e.g. "Fraudulent") carry a
 * risk color on its number without every tile in the row looking the same.
 */
export default function KPI({ label, value, icon: Icon, trend, tone = 'default', context }) {
  const toneClass = {
    default: 'text-[var(--text-primary)]',
    genuine: 'text-[var(--risk-genuine)]',
    suspicious: 'text-[var(--risk-suspicious)]',
    danger: 'text-[var(--risk-fraud)]',
    info: 'text-[var(--info)]',
  }[tone] || 'text-[var(--text-primary)]';

  const isNumeric = typeof value === 'number';
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : ArrowUpRight;
  const trendColor = trend?.direction === 'down' ? 'text-[var(--risk-fraud)]' : 'text-[var(--risk-genuine)]';

  return (
    <Card padding="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className={`mt-3 text-3xl font-extrabold tabular-nums tracking-tight ${toneClass}`}>
        {isNumeric ? <AnimatedNumber value={value} /> : value}
      </div>
      {(trend || context) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {trend && (
            <span className={`flex items-center gap-0.5 font-semibold ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          <span className="text-[var(--text-tertiary)]">{context || trend?.context}</span>
        </div>
      )}
    </Card>
  );
}
