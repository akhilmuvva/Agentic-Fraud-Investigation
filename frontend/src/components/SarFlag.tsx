import React from 'react';

interface SarFlagProps {
  required: boolean | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showNegative?: boolean;
}

export const SarFlag: React.FC<SarFlagProps> = ({ required, size = 'md', showNegative = true }) => {
  const fsMap = { sm: 10, md: 11, lg: 13 };
  const pxMap = { sm: '3px 8px', md: '5px 12px', lg: '6px 16px' };

  if (!required) {
    if (!showNegative) return null;
    return (
      <span
        className="nm-pill"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: pxMap[size], fontSize: fsMap[size], fontWeight: 600, color: 'var(--color-text-muted)' }}
        aria-label="SAR not required"
      >
        SAR: No
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: pxMap[size], fontSize: fsMap[size], fontWeight: 800,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--color-risk-high)',
        background: 'var(--nm-surface)',
        boxShadow: `var(--shadow-nm-concave), 0 0 0 2px var(--color-risk-high)33`,
        borderRadius: 8,
        transform: 'rotate(-1deg)',
      }}
      role="status"
      aria-label="SAR filing required"
    >
      <span>⚑</span>
      SAR Required
    </span>
  );
};
