/**
 * DecisionPanel — Neumorphic Gemini reasoning panel.
 */
import React, { useState } from 'react';
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
  const confidence  = (caseData as any).confidence ?? c.fraud_probability;

  const probColor =
    c.fraud_probability >= 0.7 ? 'var(--color-risk-high)'
    : c.fraud_probability >= 0.4 ? 'var(--color-risk-med)'
    : 'var(--color-risk-low)';

  return (
    <div className="nm-lg" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s ease', borderRadius: 'var(--radius-lg)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-expanded={expanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Neumorphic icon */}
          <div className="nm-sm" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            ⚡
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
              Gemini Decision
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              gemini-2.0-flash · vertex AI
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <VerdictBadge verdict={c.verdict} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 800, color: probColor }}>
              {formatConfidence(confidence)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>confidence</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 24px 24px' }}>
          {/* Divider */}
          <div className="nm-divider" style={{ marginBottom: 20 }} />

          {/* Confidence bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Fraud Probability</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: probColor }}>
                {formatConfidence(c.fraud_probability)}
              </span>
            </div>
            <div className="nm-progress-track">
              <div
                className="nm-progress-fill"
                style={{
                  width: `${c.fraud_probability * 100}%`,
                  background: `linear-gradient(90deg, ${probColor} 0%, ${probColor}BB 100%)`,
                  boxShadow: `0 0 8px ${probColor}66`,
                }}
                role="progressbar"
                aria-valuenow={Math.round(c.fraud_probability * 100)}
                aria-valuemin={0} aria-valuemax={100}
              />
            </div>
          </div>

          {/* Three mini stat boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Tool Calls', value: caseData.tool_calls, unit: '' },
              { label: 'Tokens',     value: caseData.tokens?.toLocaleString(), unit: '' },
              { label: 'Latency',    value: caseData.latency_s?.toFixed(1), unit: 's' },
            ].filter(s => s.value).map(s => (
              <div key={s.label} className="nm-inset" style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 20, color: 'var(--color-text)' }}>
                  {s.value}{s.unit}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Explanation prose */}
          {explanation ? (
            <div className="nm-inset" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Reasoning Narrative
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.75 }}>
                {explanation.split('\n').map((p: string, i: number) =>
                  p.trim() ? <p key={i} style={{ marginBottom: 8 }}>{p}</p> : null
                )}
              </div>
            </div>
          ) : (
            <div className="nm-inset" style={{ padding: '14px 18px', color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Gemini explanation not available in this response.
            </div>
          )}

          {/* Stop reason */}
          {caseData.stop_reason && (
            <div className="nm-inset-sm" style={{ padding: '10px 14px', marginTop: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Stop Reason
              </span>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>{caseData.stop_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
