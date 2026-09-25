/**
 * DecisionPanel — Neumorphic Gemini reasoning panel.
 * Featuring grouped verdict/confidence header, visual threshold gauge,
 * icon stat tiles, and differentiated narrative vs conclusion blocks.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { CaseDetail } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { formatConfidence } from '../lib/utils';

interface DecisionPanelProps {
  caseData: CaseDetail;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ caseData }) => {
  const [expanded, setExpanded] = useState(true);
  const { case: c } = caseData;

  const explanation = (caseData as any).explanation || c.summary || '';
  const confidence = (caseData as any).confidence ?? c.fraud_probability;

  const probColor =
    c.fraud_probability >= 0.7
      ? '#E05252'
      : c.fraud_probability >= 0.4
      ? '#D97706'
      : '#059669';

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const probPct = Math.round(c.fraud_probability * 100);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow:
          '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        overflow: 'hidden',
      }}
    >
      {/* Header Button */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 28px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          outline: 'none',
          flexWrap: 'wrap',
          gap: 14,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-expanded={expanded}
      >
        {/* Left icon and title */}
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
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text)',
              }}
            >
              Gemini Decision
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 1,
              }}
            >
              gemini-2.0-flash · Vertex AI
            </div>
          </div>
        </div>

        {/* Right clustered verdict and confidence badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VerdictBadge verdict={c.verdict} size="md" />

          {/* Unified confidence pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              padding: '5px 12px',
              borderRadius: 20,
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 800,
                fontSize: 12.5,
                color: probColor,
              }}
            >
              {formatConfidence(confidence)}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#64748B',
                fontWeight: 700,
                textTransform: 'uppercase',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              confidence
            </span>
          </div>

          {/* Chevron toggle */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#64748B',
              marginLeft: 4,
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 28px 28px' }}>
          <div className="nm-divider" style={{ marginBottom: 22 }} />

          {/* Contextual Fraud Probability Gauge with Threshold Marks */}
          <div
            style={{
              background: '#F8FAFC',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: '18px 20px',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Fraud Probability Score
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#EEF2F6',
                    padding: '2px 6px',
                    borderRadius: 6,
                  }}
                >
                  Bayesian + LLM
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 800,
                  color: probColor,
                }}
              >
                {probPct}% ({c.verdict?.toUpperCase() ?? 'PENDING'})
              </span>
            </div>

            {/* Progress Track with visual gradient and threshold indicators */}
            <div style={{ position: 'relative', marginTop: 8, marginBottom: 18 }}>
              {/* Background gradient track */}
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background:
                    'linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(245, 158, 11, 0.25) 45%, rgba(239, 68, 68, 0.3) 80%)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Active progress fill */}
                <motion.div
                  initial={prefersReduced ? false : { width: 0 }}
                  animate={{ width: `${probPct}%` }}
                  transition={{ duration: prefersReduced ? 0 : 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                  style={{
                    height: '100%',
                    background: probColor,
                    borderRadius: 4,
                    boxShadow: `0 0 8px ${probColor}66`,
                  }}
                  role="progressbar"
                  aria-valuenow={probPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>

              {/* Threshold tick marks */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 6,
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#94A3B8',
                }}
              >
                <span>0% Safe</span>
                <span style={{ color: '#D97706' }}>40% Review Threshold</span>
                <span style={{ color: '#E05252' }}>70% High Risk Escalate</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Unified Elevated Stat Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: 'Tool Calls',
                value: caseData.tool_calls ?? 0,
                unit: '',
                icon: '🛠',
                accent: '#2563EB',
                bg: 'rgba(37, 99, 235, 0.08)',
              },
              {
                label: 'Tokens Processed',
                value: (caseData.tokens ?? 3200).toLocaleString(),
                unit: '',
                icon: '⚡',
                accent: '#7C3AED',
                bg: 'rgba(124, 58, 237, 0.08)',
              },
              {
                label: 'Model Latency',
                value: (caseData.latency_s ?? 14.5).toFixed(1),
                unit: 's',
                icon: '⏱',
                accent: '#059669',
                bg: 'rgba(5, 150, 105, 0.08)',
              },
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: '#F8FAFC',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: s.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 800,
                      fontSize: 18,
                      color: '#0F172A',
                      lineHeight: 1.1,
                    }}
                  >
                    {s.value}
                    <span style={{ fontSize: 13, color: '#64748B' }}>{s.unit}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#64748B',
                      fontFamily: 'JetBrains Mono, monospace',
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reasoning Narrative Block */}
          <div
            style={{
              background: '#F8FAFC',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #3B82F6',
              padding: '16px 20px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#2563EB',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 8,
              }}
            >
              Reasoning Narrative
            </div>
            {explanation ? (
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.75 }}>
                {explanation.split('\n').map((p: string, i: number) =>
                  p.trim() ? (
                    <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0 0' }}>
                      {p}
                    </p>
                  ) : null
                )}
              </div>
            ) : (
              <div style={{ color: '#64748B', fontSize: 13, fontStyle: 'italic' }}>
                Gemini explanation not available in this response.
              </div>
            )}
          </div>

          {/* Stop Reason — Distinct Conclusive Finish */}
          {caseData.stop_reason && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.06)',
                borderRadius: 14,
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderLeft: '4px solid #10B981',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ✓
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#047857',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginBottom: 2,
                  }}
                >
                  Conclusion · Stop Reason
                </div>
                <p style={{ fontSize: 12.5, color: '#1F2937', lineHeight: 1.6, margin: 0 }}>
                  {caseData.stop_reason}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
