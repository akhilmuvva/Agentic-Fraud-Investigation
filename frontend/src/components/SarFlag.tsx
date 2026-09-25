import React from 'react';

interface SarFlagProps {
  required: boolean | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showNegative?: boolean;
}

export const SarFlag: React.FC<SarFlagProps> = ({ required, size = 'md', showNegative = true }) => {
  const fsMap = { sm: 10.5, md: 11.5, lg: 12.5 };
  const pxMap = { sm: '3px 8px', md: '5px 12px', lg: '6px 14px' };

  if (!required) {
    if (!showNegative) return null;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: pxMap[size],
          fontSize: fsMap[size],
          fontWeight: 600,
          color: '#64748B',
          background: '#F8FAFC',
          border: '1px solid #CBD5E1',
          borderRadius: 20,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}
        aria-label="SAR not required"
      >
        <span style={{ fontSize: 10, opacity: 0.6 }}>○</span>
        <span>SAR: No</span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: pxMap[size],
        fontSize: fsMap[size],
        fontWeight: 800,
        letterSpacing: '0.02em',
        color: '#B91C1C',
        background: 'rgba(239, 68, 68, 0.14)',
        border: '1.5px solid #EF4444',
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
        borderRadius: 20,
      }}
      role="status"
      aria-label="SAR filing required"
    >
      <span style={{ fontSize: 12 }}>⚑</span>
      <span>SAR: Yes</span>
    </span>
  );
};

