/**
 * src/lib/colorTokens.ts
 * Risk color tokens and verdict/pattern metadata — single source of truth.
 * All components import from here so color semantics are consistent.
 */

import type { FraudPattern, Verdict, CaseStatus, ActionType } from '../api/types';

// ---------------------------------------------------------------------------
// Verdict colors (for light theme — saturated enough to read on white)
// ---------------------------------------------------------------------------

export const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  fraud: {
    label: 'Fraud',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: '⚠',
  },
  uncertain: {
    label: 'Uncertain',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: '?',
  },
  legitimate: {
    label: 'Legitimate',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: '✓',
  },
};

// ---------------------------------------------------------------------------
// Case status colors
// ---------------------------------------------------------------------------

export const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; dot: string; text: string }
> = {
  closed_fraud: { label: 'Closed — Fraud', dot: 'bg-red-500', text: 'text-red-700' },
  closed_legit: { label: 'Closed — Legitimate', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  escalated: { label: 'Escalated', dot: 'bg-amber-500', text: 'text-amber-700' },
  pending: { label: 'Pending', dot: 'bg-slate-400', text: 'text-slate-600' },
  in_progress: { label: 'In Progress', dot: 'bg-blue-500', text: 'text-blue-700' },
};

// ---------------------------------------------------------------------------
// Pattern metadata
// ---------------------------------------------------------------------------

export const PATTERN_CONFIG: Record<
  FraudPattern,
  { label: string; bg: string; text: string; border: string; shortLabel: string }
> = {
  card_not_present_fraud: {
    label: 'Card Not Present',
    shortLabel: 'CNP',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  account_takeover: {
    label: 'Account Takeover',
    shortLabel: 'ATO',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  card_not_present_new_device: {
    label: 'CNP New Device',
    shortLabel: 'CNP+Dev',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  out_of_region_use: {
    label: 'Out of Region',
    shortLabel: 'OOR',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  card_testing: {
    label: 'Card Testing',
    shortLabel: 'TEST',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
};

// ---------------------------------------------------------------------------
// Node colors for 3D graph (hex values for Three.js material colors)
// ---------------------------------------------------------------------------

export const NODE_COLORS: Record<string, string> = {
  Transaction: '#3b82f6',   // blue
  Card: '#8b5cf6',          // violet
  Customer: '#10b981',      // emerald
  Device: '#f59e0b',        // amber
  IP: '#64748b',            // slate
  MerchCat: '#f43f5e',      // rose
};

// ---------------------------------------------------------------------------
// NBA action colors/icons
// ---------------------------------------------------------------------------

export const ACTION_CONFIG: Record<
  ActionType,
  { label: string; icon: string; severity: 'high' | 'medium' | 'low' }
> = {
  CREATE_CASE: { label: 'Create Case', icon: '📋', severity: 'low' },
  BLOCK_CARD: { label: 'Block Card', icon: '🚫', severity: 'high' },
  VERIFY_WITH_CUSTOMER: { label: 'Verify with Customer', icon: '📞', severity: 'medium' },
  CLOSE_NO_FRAUD: { label: 'Close — No Fraud', icon: '✅', severity: 'low' },
  FILE_REPORT: { label: 'File SAR Report', icon: '📄', severity: 'high' },
  MONITOR_ACCOUNT: { label: 'Monitor Account', icon: '👁', severity: 'medium' },
  ESCALATE: { label: 'Escalate', icon: '🔺', severity: 'high' },
};
