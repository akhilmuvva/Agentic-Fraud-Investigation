import React from 'react';
import type { Verdict } from '../api/types';

const CONFIG = {
  fraud:      { label: 'Fraud',       icon: '⚠', color: 'var(--color-risk-high)',  glow: 'var(--color-risk-high-glow)' },
  uncertain:  { label: 'Uncertain',   icon: '?',  color: 'var(--color-risk-med)',   glow: 'var(--color-risk-med-glow)'  },
  legitimate: { label: 'Legitimate',  icon: '✓',  color: 'var(--color-risk-low)',   glow: 'var(--color-risk-low-glow)'  },
};

interface VerdictBadgeProps {
  verdict: Verdict | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ verdict, size = 'md' }) => {
  const cfg = verdict ? CONFIG[verdict] : null;
  const pxMap = { sm: '4px 10px', md: '6px 14px', lg: '8px 18px' };
  const fsMap = { sm: 11, md: 12, lg: 14 };

  if (!cfg) return (
    <span className="nm-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: pxMap[size], fontSize: fsMap[size], fontWeight: 600, color: 'var(--color-text-muted)' }}>
      — Unknown
    </span>
  );

  return (
    <span
      className="nm-pill"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: pxMap[size], fontSize: fsMap[size], fontWeight: 700,
        color: cfg.color,
        boxShadow: `var(--shadow-nm-concave), 0 0 0 1px ${cfg.glow}`,
      }}
      role="status"
      aria-label={`Verdict: ${cfg.label}`}
    >
      <span style={{ fontWeight: 800 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};
