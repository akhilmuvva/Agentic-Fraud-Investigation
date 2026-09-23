import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { CaseDetail } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { PatternTag } from './PatternTag';
import { SarFlag } from './SarFlag';
import { formatUSD, formatConfidence } from '../lib/utils';

interface CaseListItemProps {
  caseData: CaseDetail;
  index: number;
}

export const CaseListItem: React.FC<CaseListItemProps> = ({ caseData, index }) => {
  const navigate = useNavigate();
  const { case: c, case_id: caseId, sar, latency_s } = caseData;
  const prob = c.fraud_probability;

  const probColor =
    prob >= 0.7 ? 'var(--color-risk-high)'
    : prob >= 0.4 ? 'var(--color-risk-med)'
    : 'var(--color-risk-low)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.34, 1.56, 0.64, 1] }}
      onClick={() => navigate(`/cases/${caseId}`)}
      className="nm"
      style={{
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, transform 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-nm-lg)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-nm-md)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
      role="button"
      tabIndex={0}
      aria-label={`Case ${caseId}: ${c.verdict ?? 'unknown'}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/cases/${caseId}`); }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Risk score arc indicator */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--nm-surface)',
              boxShadow: `var(--shadow-nm-inset-sm), 0 0 0 2px ${probColor}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, color: probColor }}>
              {Math.round(prob * 100)}
            </span>
            <span style={{ fontSize: 8, color: 'var(--color-text-muted)', lineHeight: 1 }}>%</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
              {caseId}
            </span>
            <VerdictBadge verdict={c.verdict} />
            <PatternTag pattern={c.pattern} showFull />
            {sar.file && <SarFlag required size="sm" />}
          </div>

          {/* Summary */}
          {c.summary && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
              {c.summary}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Exposure */}
            <div className="nm-inset-sm" style={{ padding: '4px 10px', display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Exposure</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                {formatUSD(c.exposure_usd)}
              </span>
            </div>
            {/* Evidence count */}
            <div className="nm-inset-sm" style={{ padding: '4px 10px', display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Evidence</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                {c.evidence?.length ?? 0}
              </span>
            </div>
            {/* Latency */}
            {latency_s > 0 && (
              <div className="nm-inset-sm" style={{ padding: '4px 10px', display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Latency</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                  {latency_s.toFixed(1)}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Confidence progress */}
        <div style={{ flexShrink: 0, width: 80, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Confidence</span>
          <div className="nm-progress-track" style={{ width: 80, height: 6 }}>
            <div
              className="nm-progress-fill"
              style={{ width: `${prob * 100}%`, background: probColor, opacity: 0.8 }}
              role="progressbar"
              aria-valuenow={Math.round(prob * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: probColor }}>
            {formatConfidence(prob)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
