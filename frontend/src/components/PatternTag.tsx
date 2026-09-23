import React from 'react';
import type { FraudPattern } from '../api/types';

const PATTERN_CFG: Record<FraudPattern, { label: string; short: string; accent: string }> = {
  card_not_present_fraud:    { label: 'Card Not Present',  short: 'CNP',     accent: '#E05252' },
  account_takeover:          { label: 'Account Takeover',  short: 'ATO',     accent: '#D97706' },
  card_not_present_new_device:{ label: 'CNP New Device',  short: 'CNP+Dev', accent: '#7C3AED' },
  out_of_region_use:         { label: 'Out of Region',     short: 'OOR',     accent: '#2563EB' },
  card_testing:              { label: 'Card Testing',      short: 'TEST',    accent: '#DB2777' },
};

interface PatternTagProps {
  pattern: FraudPattern | string;
  showFull?: boolean;
}

export const PatternTag: React.FC<PatternTagProps> = ({ pattern, showFull = false }) => {
  const cfg = PATTERN_CFG[pattern as FraudPattern];
  const accent = cfg?.accent ?? '#5C6B85';
  const label  = cfg ? (showFull ? cfg.label : cfg.short) : pattern;

  return (
    <span
      className="nm-pill"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.01em',
        color: accent,
        boxShadow: `var(--shadow-nm-concave), 0 0 0 1px ${accent}22`,
      }}
      aria-label={`Pattern: ${cfg?.label ?? pattern}`}
      title={cfg?.label}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} aria-hidden="true" />
      {label}
    </span>
  );
};
