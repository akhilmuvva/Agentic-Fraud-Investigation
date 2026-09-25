/**
 * NbaPanel — Neumorphic Next Best Action panel.
 * Sequential escalation trail, end-to-end severity color consistency,
 * distinct "WHAT CHANGED" card, and superseded initial recommendation state.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CaseDetail, ActionType } from '../api/types';
import { ACTION_CONFIG } from '../lib/colorTokens';

interface NbaPanelProps {
  caseData: CaseDetail;
}

const SEVERITY_CONFIG: Record<
  string,
  {
    text: string;
    border: string;
    bg: string;
    iconBg: string;
    tag: string;
  }
> = {
  high: {
    text: '#B91C1C',
    border: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.05)',
    iconBg: 'rgba(239, 68, 68, 0.12)',
    tag: 'High Priority',
  },
  medium: {
    text: '#B45309',
    border: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.05)',
    iconBg: 'rgba(245, 158, 11, 0.12)',
    tag: 'Investigation',
  },
  low: {
    text: '#1D4ED8',
    border: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.04)',
    iconBg: 'rgba(59, 130, 246, 0.12)',
    tag: 'Standard Routine',
  },
};

export const NbaPanel: React.FC<NbaPanelProps> = ({ caseData }) => {
  const { next_best_actions: nba } = caseData;
  const [initialExpanded, setInitialExpanded] = useState(false);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      style={{
        padding: '24px 28px',
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow:
          '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(226, 232, 240, 0.8)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: 'linear-gradient(135deg, #EEF2F6 0%, #E2E8F0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
            }}
          >
            🎯
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              Next Best Actions
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 1,
              }}
            >
              Agent policy recommendation & escalation chain
            </div>
          </div>
        </div>

        {/* Step count badge */}
        {nba.final && nba.final.length > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#475569',
            }}
          >
            {nba.final.length} sequential actions
          </span>
        )}
      </div>

      <div className="nm-divider" style={{ marginBottom: 20 }} />

      {/* Final Recommendation Chain */}
      {nba.final && nba.final.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#2563EB',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Final Recommendation Sequence</span>
            <span style={{ fontSize: 12, opacity: 0.6 }}>→</span>
          </div>

          {/* Sequential Action List with connecting rail */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Connecting Vertical Track */}
            {nba.final.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  bottom: 24,
                  left: 20,
                  width: 2,
                  background: '#E2E8F0',
                  zIndex: 0,
                }}
              />
            )}

            {nba.final.map((action, i) => {
              const cfg = ACTION_CONFIG[action.action as ActionType] ?? {
                label: action.action,
                icon: '•',
                severity: 'low',
              };
              const sev = SEVERITY_CONFIG[cfg.severity] ?? SEVERITY_CONFIG.low;

              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    background: sev.bg,
                    border: `1px solid ${sev.border}40`,
                    borderLeft: `4px solid ${sev.border}`,
                    borderRadius: 14,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                    transition: 'transform 0.15s ease',
                  }}
                  role="listitem"
                >
                  {/* Step Sequence Badge */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      border: `1.5px solid ${sev.border}`,
                      color: sev.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      flexShrink: 0,
                    }}
                  >
                    0{i + 1}
                  </div>

                  {/* Icon Box */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: sev.iconBg,
                      border: `1px solid ${sev.border}44`,
                      color: sev.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 17,
                      flexShrink: 0,
                    }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Action Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 13.5,
                          color: sev.text,
                          fontFamily: 'Space Grotesk, sans-serif',
                        }}
                      >
                        {cfg.label}
                      </span>

                      {/* Muted informative Auto/Analyst pill */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          color: '#475569',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {action.route === 'auto'
                          ? '🤖 Auto'
                          : action.route === 'L1'
                          ? '👤 L1 Analyst'
                          : '🔒 L2 Compliance'}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: '#64748B',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {action.reason}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* "WHAT CHANGED" Distinct Card Callout */}
      {nba.what_changed && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.06)',
            borderRadius: 14,
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderLeft: '4px solid #2563EB',
            padding: '14px 18px',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#2563EB',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Delta · What Changed</span>
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: '#1E3A8A',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {nba.what_changed}
          </p>
        </div>
      )}

      {/* Initial recommendation (before evidence loop) */}
      {nba.initial && nba.initial.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            paddingTop: 12,
          }}
        >
          <button
            onClick={() => setInitialExpanded(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#64748B',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              padding: '6px 8px',
              borderRadius: 8,
              transition: 'background 0.15s ease, color 0.15s ease',
              width: '100%',
              textAlign: 'left',
              outline: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.color = '#334155';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748B';
            }}
            aria-expanded={initialExpanded}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                transform: initialExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                fontSize: 10,
              }}
            >
              ▶
            </span>
            <span>Initial recommendation (before evidence loop)</span>
            <span
              style={{
                fontSize: 10,
                color: '#94A3B8',
                fontFamily: 'JetBrains Mono, monospace',
                marginLeft: 'auto',
              }}
            >
              {nba.initial.length} prior item{nba.initial.length !== 1 ? 's' : ''}
            </span>
          </button>

          {/* Expanded Superseded State */}
          <AnimatePresence>
            {initialExpanded && (
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    marginTop: 8,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontFamily: 'JetBrains Mono, monospace',
                      marginBottom: 2,
                    }}
                  >
                    <span>Superseded by Evidence Loop</span>
                  </div>

                  {nba.initial.map((action, i) => {
                    const cfg = ACTION_CONFIG[action.action as ActionType] ?? {
                      label: action.action,
                      icon: '•',
                      severity: 'low',
                    };
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 12,
                          color: '#64748B',
                          opacity: 0.75,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            textDecoration: 'line-through',
                            color: '#475569',
                          }}
                        >
                          {cfg.label}
                        </span>
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>— {action.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
