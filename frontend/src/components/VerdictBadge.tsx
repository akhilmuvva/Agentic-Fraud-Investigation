import React from 'react';
import type { Verdict } from '../api/types';

const CONFIG = {
  fraud: {
    label: 'Fraud',
    icon: '⚠',
    color: '#B91C1C',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: '1.5px solid #EF4444',
    shadow: '0 2px 8px rgba(239, 68, 68, 0.18)',
  },
  uncertain: {
    label: 'Uncertain',
    icon: '?',
    color: '#B45309',
    bg: 'rgba(245, 158, 11, 0.13)',
    border: '1.5px solid #F59E0B',
    shadow: '0 2px 8px rgba(245, 158, 11, 0.18)',
  },
  legitimate: {
    label: 'Legitimate',
    icon: '✓',
    color: '#047857',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '1.5px solid #10B981',
    shadow: '0 2px 8px rgba(16, 185, 129, 0.18)',
  },
};

interface VerdictBadgeProps {
  verdict: Verdict | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ verdict, size = 'md' }) => {
  const cfg = verdict ? CONFIG[verdict] : null;
  const pxMap = { sm: '4px 10px', md: '5px 14px', lg: '6px 16px' };
  const fsMap = { sm: 11, md: 12, lg: 13.5 };

  if (!cfg) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: pxMap[size],
          fontSize: fsMap[size],
          fontWeight: 600,
          color: '#64748B',
          background: '#F1F5F9',
          border: '1px solid #CBD5E1',
          borderRadius: 20,
        }}
      >
        — Unknown
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: pxMap[size],
        fontSize: fsMap[size],
        fontWeight: 800,
        color: cfg.color,
        background: cfg.bg,
        border: cfg.border,
        boxShadow: cfg.shadow,
        borderRadius: 20,
        letterSpacing: '0.01em',
        transition: 'transform 0.15s ease',
      }}
      role="status"
      aria-label={`Verdict: ${cfg.label}`}
    >
      <span style={{ fontWeight: 900, fontSize: size === 'lg' ? 15 : 13 }}>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
};

