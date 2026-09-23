/**
 * FilterBar.tsx — High-contrast, interactive filter bar for the Case List.
 * Provides distinct active/unselected states with color tinting, close '×' icons,
 * spring-eased pop animation, clear grouping, a dedicated SAR toggle switch,
 * and live result count feedback with a clear-all trigger.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FraudPattern, Verdict } from '../api/types';

export const FRAUD_PATTERNS: FraudPattern[] = [
  'card_not_present_fraud',
  'account_takeover',
  'card_not_present_new_device',
  'out_of_region_use',
  'card_testing',
];

export const VERDICTS: Verdict[] = ['fraud', 'uncertain', 'legitimate'];

// Visual configuration for pattern pills
const PATTERN_CONFIG: Record<
  FraudPattern,
  {
    short: string;
    label: string;
    color: string;
    darkColor: string;
    bgTint: string;
    border: string;
  }
> = {
  card_not_present_fraud: {
    short: 'CNP',
    label: 'Card Not Present',
    color: '#E05252',
    darkColor: '#B91C1C',
    bgTint: 'rgba(224, 82, 82, 0.16)',
    border: '#E05252',
  },
  account_takeover: {
    short: 'ATO',
    label: 'Account Takeover',
    color: '#D97706',
    darkColor: '#B45309',
    bgTint: 'rgba(217, 119, 6, 0.16)',
    border: '#D97706',
  },
  card_not_present_new_device: {
    short: 'CNP+Dev',
    label: 'CNP New Device',
    color: '#7C3AED',
    darkColor: '#6D28D9',
    bgTint: 'rgba(124, 58, 237, 0.16)',
    border: '#7C3AED',
  },
  out_of_region_use: {
    short: 'OOR',
    label: 'Out of Region',
    color: '#2563EB',
    darkColor: '#1D4ED8',
    bgTint: 'rgba(37, 99, 235, 0.16)',
    border: '#2563EB',
  },
  card_testing: {
    short: 'TEST',
    label: 'Card Testing',
    color: '#DB2777',
    darkColor: '#BE185D',
    bgTint: 'rgba(219, 39, 119, 0.16)',
    border: '#DB2777',
  },
};

// Visual configuration for verdict pills
const VERDICT_CONFIG: Record<
  Verdict,
  {
    label: string;
    icon: string;
    color: string;
    darkColor: string;
    bgTint: string;
    border: string;
  }
> = {
  fraud: {
    label: 'Fraud',
    icon: '⚠',
    color: '#E05252',
    darkColor: '#B91C1C',
    bgTint: 'rgba(224, 82, 82, 0.16)',
    border: '#E05252',
  },
  uncertain: {
    label: 'Uncertain',
    icon: '?',
    color: '#D97706',
    darkColor: '#B45309',
    bgTint: 'rgba(217, 119, 6, 0.16)',
    border: '#D97706',
  },
  legitimate: {
    label: 'Legitimate',
    icon: '✓',
    color: '#059669',
    darkColor: '#047857',
    bgTint: 'rgba(5, 150, 105, 0.16)',
    border: '#059669',
  },
};

export interface FilterBarProps {
  selectedPatterns: FraudPattern[];
  onTogglePattern: (pattern: FraudPattern) => void;
  selectedVerdicts: Verdict[];
  onToggleVerdict: (verdict: Verdict) => void;
  sarRequired: boolean;
  onToggleSar: () => void;
  filteredCount: number;
  totalCount: number;
  onClearAll: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedPatterns,
  onTogglePattern,
  selectedVerdicts,
  onToggleVerdict,
  sarRequired,
  onToggleSar,
  filteredCount,
  totalCount,
  onClearAll,
}) => {
  const hasActiveFilters =
    selectedPatterns.length > 0 || selectedVerdicts.length > 0 || sarRequired;

  const isNarrowed = hasActiveFilters && filteredCount < totalCount;

  return (
    <div
      className="nm-inset"
      style={{
        padding: '16px 20px',
        marginBottom: 24,
        borderRadius: 18,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      {/* Left controls: Groups & Dividers */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Main FILTER badge */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginRight: 2,
          }}
        >
          FILTER
        </div>

        {/* 1. PATTERN GROUP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginRight: 2,
            }}
          >
            PATTERN <span style={{ textTransform: 'lowercase', fontStyle: 'italic', fontWeight: 500 }}>(any)</span>
          </span>

          {FRAUD_PATTERNS.map(pattern => {
            const isSelected = selectedPatterns.includes(pattern);
            const cfg = PATTERN_CONFIG[pattern];

            return (
              <motion.button
                key={pattern}
                onClick={() => onTogglePattern(pattern)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                animate={
                  isSelected
                    ? { scale: [1, 1.06, 1], transition: { duration: 0.22 } }
                    : { scale: 1 }
                }
                title={cfg.label}
                aria-pressed={isSelected}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: isSelected ? '4px 10px 4px 9px' : '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? cfg.darkColor : '#475569',
                  background: isSelected ? cfg.bgTint : '#FFFFFF',
                  border: isSelected
                    ? `1.5px solid ${cfg.border}`
                    : '1px solid rgba(203, 213, 225, 0.85)',
                  boxShadow: isSelected
                    ? `0 2px 8px -1px ${cfg.color}33, inset 0 1px 2px rgba(255,255,255,0.6)`
                    : '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-brand)`;
                }}
                onBlur={e => {
                  e.currentTarget.style.boxShadow = isSelected
                    ? `0 2px 8px -1px ${cfg.color}33`
                    : '0 2px 4px -1px rgba(15, 23, 42, 0.06)';
                }}
              >
                {/* Dot indicator */}
                <span
                  style={{
                    width: isSelected ? 7 : 6,
                    height: isSelected ? 7 : 6,
                    borderRadius: '50%',
                    background: cfg.color,
                    opacity: isSelected ? 1 : 0.65,
                    boxShadow: isSelected ? `0 0 0 2px ${cfg.color}44` : 'none',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  aria-hidden="true"
                />

                <span>{cfg.short}</span>

                {/* Close '×' icon when selected */}
                {isSelected && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: `${cfg.color}28`,
                      fontSize: 10,
                      fontWeight: 800,
                      color: cfg.darkColor,
                      marginLeft: 1,
                      lineHeight: 1,
                    }}
                    aria-label="Remove filter"
                  >
                    ×
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Strong Vertical Divider */}
        <div
          style={{
            width: 1.5,
            height: 24,
            background: 'rgba(195, 203, 216, 0.85)',
            margin: '0 2px',
          }}
          aria-hidden="true"
        />

        {/* 2. VERDICT GROUP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginRight: 2,
            }}
          >
            VERDICT
          </span>

          {VERDICTS.map(verdict => {
            const isSelected = selectedVerdicts.includes(verdict);
            const cfg = VERDICT_CONFIG[verdict];

            return (
              <motion.button
                key={verdict}
                onClick={() => onToggleVerdict(verdict)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                animate={
                  isSelected
                    ? { scale: [1, 1.06, 1], transition: { duration: 0.22 } }
                    : { scale: 1 }
                }
                aria-pressed={isSelected}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: isSelected ? '4px 11px 4px 10px' : '4px 11px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  fontFamily: 'Inter, sans-serif',
                  color: isSelected ? cfg.darkColor : '#475569',
                  background: isSelected ? cfg.bgTint : '#FFFFFF',
                  border: isSelected
                    ? `1.5px solid ${cfg.border}`
                    : '1px solid rgba(203, 213, 225, 0.85)',
                  boxShadow: isSelected
                    ? `0 2px 8px -1px ${cfg.color}33, inset 0 1px 2px rgba(255,255,255,0.6)`
                    : '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-brand)`;
                }}
                onBlur={e => {
                  e.currentTarget.style.boxShadow = isSelected
                    ? `0 2px 8px -1px ${cfg.color}33`
                    : '0 2px 4px -1px rgba(15, 23, 42, 0.06)';
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 11, color: cfg.color }}>
                  {cfg.icon}
                </span>

                <span>{cfg.label}</span>

                {/* Close '×' icon when selected */}
                {isSelected && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: `${cfg.color}28`,
                      fontSize: 10,
                      fontWeight: 800,
                      color: cfg.darkColor,
                      marginLeft: 1,
                      lineHeight: 1,
                    }}
                    aria-label="Remove filter"
                  >
                    ×
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Strong Vertical Divider */}
        <div
          style={{
            width: 1.5,
            height: 24,
            background: 'rgba(195, 203, 216, 0.85)',
            margin: '0 2px',
          }}
          aria-hidden="true"
        />

        {/* 3. SAR REQUIRED TOGGLE SWITCH */}
        <div
          onClick={onToggleSar}
          role="switch"
          aria-checked={sarRequired}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleSar();
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px 3px 6px',
            borderRadius: 20,
            background: sarRequired ? 'rgba(224, 82, 82, 0.12)' : '#FFFFFF',
            border: sarRequired
              ? '1.5px solid #E05252'
              : '1px solid rgba(203, 213, 225, 0.85)',
            boxShadow: sarRequired
              ? '0 2px 8px -1px rgba(224, 82, 82, 0.25)'
              : '0 2px 4px -1px rgba(15, 23, 42, 0.06)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.18s ease',
            outline: 'none',
          }}
          onFocus={e => {
            e.currentTarget.style.boxShadow = `0 0 0 2px var(--color-brand)`;
          }}
          onBlur={e => {
            e.currentTarget.style.boxShadow = sarRequired
              ? '0 2px 8px -1px rgba(224, 82, 82, 0.25)'
              : '0 2px 4px -1px rgba(15, 23, 42, 0.06)';
          }}
        >
          {/* Switch track & knob */}
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 12,
              background: sarRequired ? '#E05252' : '#CBD5E1',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s ease',
            }}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                marginLeft: sarRequired ? 14 : 0,
              }}
            />
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: sarRequired ? 700 : 500,
              color: sarRequired ? '#B91C1C' : '#475569',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ color: '#E05252', fontSize: 12 }}>⚑</span>
            SAR Required
          </span>
        </div>
      </div>

      {/* Right side: Clear All & Live Result Count Feedback */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginLeft: 'auto',
        }}
      >
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              onClick={onClearAll}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#EF4444',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: '4px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease',
              }}
              whileHover={{ background: 'rgba(239, 68, 68, 0.16)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span>✕</span> Reset filters
            </motion.button>
          )}
        </AnimatePresence>

        {/* Dynamic Count Feedback Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: isNarrowed ? 'rgba(79, 126, 247, 0.08)' : '#FFFFFF',
            border: isNarrowed
              ? '1px solid rgba(79, 126, 247, 0.3)'
              : '1px solid rgba(226, 232, 240, 0.8)',
            padding: '4px 10px',
            borderRadius: 12,
            transition: 'all 0.2s ease',
          }}
        >
          <motion.span
            key={filteredCount}
            initial={{ scale: 1.25, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              fontWeight: 800,
              color: isNarrowed ? 'var(--color-brand)' : '#334155',
            }}
          >
            {filteredCount}
          </motion.span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: '#94A3B8',
            }}
          >
            / {totalCount} cases
          </span>
        </div>
      </div>
    </div>
  );
};
