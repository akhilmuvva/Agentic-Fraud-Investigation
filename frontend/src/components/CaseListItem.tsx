import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { CaseDetail } from '../api/types';
import { VerdictBadge } from './VerdictBadge';
import { PatternTag } from './PatternTag';
import { SarFlag } from './SarFlag';
import { formatUSD } from '../lib/utils';

interface CaseListItemProps {
  caseData: CaseDetail;
  index: number;
}

const LeftRiskRingBadge: React.FC<{ prob: number }> = ({ prob }) => {
  const percent = Math.round(prob * 100);
  const color =
    prob >= 0.7 ? '#EF4444'
    : prob >= 0.4 ? '#F59E0B'
    : '#10B981';

  const radius = 17;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(prob, 0), 1));

  return (
    <div
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: '50%',
        background: `${color}0D`,
      }}
      title={`Risk probability: ${percent}%`}
    >
      <svg
        width={44}
        height={44}
        viewBox="0 0 44 44"
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={22}
          cy={22}
          r={radius}
          fill="transparent"
          stroke="var(--nm-progress-bg, rgba(148, 163, 184, 0.2))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={22}
          cy={22}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', zIndex: 1 }}>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 800,
            fontSize: 12,
            color,
            lineHeight: 1,
          }}
        >
          {percent}
        </span>
        <span style={{ fontSize: 8, fontWeight: 700, color, opacity: 0.85, lineHeight: 1 }}>%</span>
      </div>
    </div>
  );
};

export const CaseListItem: React.FC<CaseListItemProps> = ({ caseData, index }) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { case: c, case_id: caseId, sar, latency_s } = caseData;
  const prob = c.fraud_probability;

  const probColor =
    prob >= 0.7 ? '#EF4444'
    : prob >= 0.4 ? '#F59E0B'
    : '#10B981';

  const verdictColor =
    c.verdict === 'fraud' ? '#EF4444'
    : c.verdict === 'uncertain' ? '#F59E0B'
    : '#10B981';

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : Math.min(index * 0.04, 0.6),
        ease: [0.34, 1.56, 0.64, 1],
      }}
      whileHover={shouldReduceMotion ? undefined : {
        y: -2,
        boxShadow: 'var(--shadow-nm-lg)',
        borderColor: `${verdictColor}55`,
      }}
      onClick={() => navigate(`/cases/${caseId}`)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid transparent',
        background: 'var(--nm-surface)',
        boxShadow: 'var(--shadow-nm-md)',
        padding: '13px 18px 13px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Case ${caseId}: ${c.verdict ?? 'unknown'}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/cases/${caseId}`); }}
    >
      {/* Verdict Color Accent Bar (Left) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3.5,
          background: verdictColor,
          borderRadius: '16px 0 0 16px',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Left: Risk Ring Badge */}
        <LeftRiskRingBadge prob={prob} />

        {/* Center: Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              {caseId}
            </span>
            <VerdictBadge verdict={c.verdict} />
            <PatternTag pattern={c.pattern} showFull />
            {sar.file && <SarFlag required size="sm" />}
          </div>

          {/* Truncated Summary */}
          {c.summary && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginBottom: 6,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '96%',
              }}
              title={c.summary}
            >
              {c.summary}
            </p>
          )}

          {/* Condensed Inline Metadata Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ opacity: 0.7, fontSize: 10.5 }}>💰</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 10.5 }}>Exposure:</span>
              <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)', fontWeight: 700, fontSize: 11.5 }}>
                {formatUSD(c.exposure_usd)}
              </strong>
            </span>

            <span style={{ opacity: 0.35, fontSize: 8 }}>●</span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ opacity: 0.7, fontSize: 10.5 }}>📑</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 10.5 }}>Evidence:</span>
              <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)', fontWeight: 700, fontSize: 11.5 }}>
                {c.evidence?.length ?? 0}
              </strong>
            </span>

            {latency_s > 0 && (
              <>
                <span style={{ opacity: 0.35, fontSize: 8 }}>●</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ opacity: 0.7, fontSize: 10.5 }}>⚡</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 10.5 }}>Latency:</span>
                  <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)', fontWeight: 700, fontSize: 11.5 }}>
                    {latency_s.toFixed(1)}s
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Confidence horizontal indicator */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 4,
            paddingLeft: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="nm-progress-track"
              style={{
                width: 76,
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
                background: 'var(--nm-progress-bg, rgba(148, 163, 184, 0.25))',
              }}
            >
              <div
                className="nm-progress-fill"
                style={{
                  width: `${Math.round(prob * 100)}%`,
                  height: '100%',
                  background: probColor,
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}
                role="progressbar"
                aria-valuenow={Math.round(prob * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                fontWeight: 800,
                color: probColor,
                minWidth: 36,
                textAlign: 'right',
                lineHeight: 1,
              }}
            >
              {Math.round(prob * 100)}%
            </span>
          </div>
          <span
            style={{
              fontSize: 9.5,
              color: 'var(--color-text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Confidence
          </span>
        </div>
      </div>
    </motion.div>
  );
};

