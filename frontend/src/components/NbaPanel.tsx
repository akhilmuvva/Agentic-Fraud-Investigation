/**
 * NbaPanel — Neumorphic Next Best Action panel.
 */
import React from 'react';
import type { CaseDetail, ActionType } from '../api/types';
import { ACTION_CONFIG } from '../lib/colorTokens';

interface NbaPanelProps {
  caseData: CaseDetail;
}

const SEVERITY_COLORS: Record<string, { text: string; border: string; glow: string }> = {
  high:   { text: 'var(--color-risk-high)', border: 'var(--color-risk-high)', glow: 'var(--color-risk-high-glow)' },
  medium: { text: 'var(--color-risk-med)',  border: 'var(--color-risk-med)',  glow: 'var(--color-risk-med-glow)'  },
  low:    { text: 'var(--color-text-secondary)', border: 'var(--nm-shadow-dark)', glow: 'transparent' },
};

export const NbaPanel: React.FC<NbaPanelProps> = ({ caseData }) => {
  const { next_best_actions: nba } = caseData;

  return (
    <div className="nm-lg" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className="nm-sm" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🎯
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            Next Best Actions
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Agent policy recommendation
          </div>
        </div>
      </div>

      <div className="nm-divider" style={{ marginBottom: 20 }} />

      {/* Final actions */}
      {nba.final && nba.final.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Final Recommendation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nba.final.map((action, i) => {
              const cfg  = ACTION_CONFIG[action.action as ActionType] ?? { label: action.action, icon: '•', severity: 'low' };
              const sev  = SEVERITY_COLORS[cfg.severity];
              return (
                <div
                  key={i}
                  className="nm-inset"
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: `var(--shadow-nm-inset-sm), 0 0 0 1px ${sev.border}33` }}
                  role="listitem"
                >
                  {/* Icon box */}
                  <div
                    className="nm-sm"
                    style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      boxShadow: `var(--shadow-nm-sm), 0 0 0 1px ${sev.border}44`,
                    }}
                  >
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: sev.text }}>{cfg.label}</span>
                      <span className="nm-pill" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--color-text-muted)' }}>
                        {action.route === 'auto' ? '🤖 Auto' : action.route === 'L1' ? '👤 L1 Analyst' : '🔒 L2 Compliance'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{action.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* What changed */}
      {nba.what_changed && (
        <div className="nm-inset-sm" style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--color-brand)', borderRadius: '0 10px 10px 0' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
            What Changed
          </span>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>{nba.what_changed}</p>
        </div>
      )}

      {/* Initial actions (collapsed) */}
      {nba.initial && nba.initial.length > 0 && (
        <details>
          <summary style={{ fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
            Initial recommendation (before evidence loop) ▸
          </summary>
          <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--nm-shadow-dark)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nba.initial.map((action, i) => {
              const cfg = ACTION_CONFIG[action.action as ActionType] ?? { label: action.action, icon: '•', severity: 'low' };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontWeight: 600 }}>{cfg.label}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>— {action.reason}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
};
