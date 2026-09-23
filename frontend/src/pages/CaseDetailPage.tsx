/**
 * CaseDetailPage.tsx — Full neumorphic case detail view.
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCaseDetail } from '../hooks/useCaseDetail';
import { VerdictBadge } from '../components/VerdictBadge';
import { PatternTag } from '../components/PatternTag';
import { SarFlag } from '../components/SarFlag';
import { CaseGraphExplorer } from '../components/CaseGraphExplorer';
import { SimilarCasesPanel } from '../components/SimilarCasesPanel';
import { DecisionPanel } from '../components/DecisionPanel';
import { NbaPanel } from '../components/NbaPanel';
import { AgentPipelineView } from '../components/AgentPipelineView';
import { SkeletonDetailPanel } from '../components/SkeletonCard';
import { EvidenceAuditLog } from '../components/EvidenceAuditLog';
import { formatUSD, formatConfidence, toTitleCase } from '../lib/utils';
import { PATTERN_CONFIG } from '../lib/colorTokens';
import type { FraudPattern } from '../api/types';

/* ── Patterns Panel ─────────────────────────────────────────── */
const PatternsPanel: React.FC<{ caseData: NonNullable<ReturnType<typeof useCaseDetail>['caseData']> }> = ({ caseData }) => {
  const { case: c } = caseData;
  const patternResults = c.evidence
    .filter(ev => ev.ref.startsWith('detect_'))
    .map(ev => ({
      patternName: ev.ref.replace('detect_', '') as FraudPattern,
      matched: ev.claim.includes('matched=True'),
      claim: ev.claim,
    }));

  const riskColors: Record<string, string> = {
    card_not_present_fraud:      '#E05252',
    account_takeover:            '#D97706',
    card_not_present_new_device: '#7C3AED',
    out_of_region_use:           '#2563EB',
    card_testing:                '#DB2777',
  };

  const matchedCount = patternResults.filter(p => p.matched).length;

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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
              flexShrink: 0,
            }}
          >
            🕸
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
              Fraud Pattern Scan
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 1,
              }}
            >
              5 GSQL pattern queries · TigerGraph
            </div>
          </div>
        </div>

        {/* Live summary badge */}
        {patternResults.length > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              background: matchedCount > 0 ? 'rgba(239, 68, 68, 0.1)' : '#F1F5F9',
              border: `1px solid ${matchedCount > 0 ? 'rgba(239, 68, 68, 0.25)' : '#CBD5E1'}`,
              color: matchedCount > 0 ? '#B91C1C' : '#475569',
            }}
          >
            {matchedCount} of {patternResults.length} matched
          </span>
        )}
      </div>

      <div className="nm-divider" style={{ marginBottom: 16 }} />

      {patternResults.length === 0 ? (
        <div
          style={{
            padding: '16px',
            fontSize: 13,
            color: '#64748B',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#F8FAFC',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
          }}
        >
          <span>Pattern evidence not in response. Primary: </span>
          <PatternTag pattern={c.pattern} showFull />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {patternResults.map(({ patternName, matched, claim }, idx) => {
            const accent = riskColors[patternName] ?? '#475569';
            const riskMatch = claim.match(/(\d+) risk indicators/);
            const riskCount = riskMatch ? parseInt(riskMatch[1]) : 0;

            return (
              <motion.div
                key={patternName}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReduced ? 0 : idx * 0.06, duration: 0.25 }}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 14,
                  background: matched ? `${accent}10` : '#F8FAFC',
                  border: matched ? `1px solid ${accent}40` : '1px solid #E2E8F0',
                  borderLeft: matched ? `4px solid ${accent}` : '4px solid #CBD5E1',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  transition: 'all 0.2s ease',
                }}
                role="listitem"
                aria-label={`${patternName}: ${matched ? 'matched' : 'not matched'}`}
              >
                {/* Status Dot / Icon */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: matched ? `${accent}22` : '#EEF2F6',
                    border: `1.5px solid ${matched ? accent : '#CBD5E1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: matched ? 12 : 10,
                    fontWeight: 900,
                    color: matched ? accent : '#94A3B8',
                  }}
                >
                  {matched ? '✓' : '○'}
                </div>

                {/* Pattern Tag & Signals */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PatternTag pattern={patternName} showFull />
                    {matched && riskCount > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: '#FFFFFF',
                          border: `1px solid ${accent}33`,
                          color: accent,
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                        }}
                      >
                        {riskCount} signal{riskCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {!matched && (
                      <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>
                        not triggered
                      </span>
                    )}
                  </div>
                </div>

                {/* Right MATCH / MISS badge */}
                <div style={{ flexShrink: 0 }}>
                  {matched ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: `${accent}20`,
                        border: `1px solid ${accent}55`,
                        color: accent,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                    >
                      <span>✓</span>
                      <span>MATCH</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        color: '#64748B',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      <span>○</span>
                      <span>MISS</span>
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};


/* ── SAR Panel ──────────────────────────────────────────────── */
const SarPanel: React.FC<{ caseData: NonNullable<ReturnType<typeof useCaseDetail>['caseData']> }> = ({ caseData }) => {
  const { sar } = caseData;
  if (!sar.file) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="nm-lg"
      style={{ padding: '24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div className="nm-sm" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, boxShadow: `var(--shadow-nm-sm), 0 0 0 1px var(--color-risk-high)44` }}>
          ⚑
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--color-risk-high)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            SAR Filing Required
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{sar.reason}</p>
        </div>
        <SarFlag required size="lg" showNegative={false} />
      </div>

      {sar.narrative && (
        <div className="nm-inset" style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-risk-high)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            SAR Narrative
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{sar.narrative}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div className="nm-inset-sm" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Amount</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 18, color: 'var(--color-risk-high)' }}>
            {formatUSD(sar.total_amount_usd)}
          </div>
        </div>
        {sar.subjects.length > 0 && (
          <div className="nm-inset-sm" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>Subjects</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sar.subjects.map(s => (
                <span key={s} className="nm-pill" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--color-risk-high)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {sar.activity_dates.length > 0 && (
          <div className="nm-inset-sm" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>Activity Dates</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.6 }}>
              {sar.activity_dates.join(' → ')}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ── Confidence Progress Ring ───────────────────────────────── */
const ConfidenceRing: React.FC<{
  probability: number;
  color: string;
  prefersReduced?: boolean;
}> = ({ probability, color, prefersReduced = false }) => {
  const size = 68;
  const strokeWidth = 5.5;
  const radius = (size - strokeWidth) / 2; // (68 - 5.5) / 2 = 31.25
  const circumference = 2 * Math.PI * radius; // ~196.35
  const targetOffset = circumference - probability * circumference;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          initial={prefersReduced ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: prefersReduced ? 0 : 0.85, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </svg>
      {/* Centered Percentage */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 16,
            fontWeight: 800,
            color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {formatConfidence(probability)}
        </span>
      </div>
    </div>
  );
};

/* ── Main CaseDetailPage ────────────────────────────────────── */
export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { caseData, loading, error, notFound } = useCaseDetail(caseId);
  const [activeTab, setActiveTab] = useState<'graph' | 'details'>('graph');

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (loading) {
    return (
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SkeletonDetailPanel />
        <SkeletonDetailPanel />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div className="nm-xl" style={{ padding: '60px 40px', display: 'inline-block' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
            Case Not Found
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Case <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{caseId}</span> does not exist.
          </p>
          <Link to="/" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontSize: 13 }}>← Back to case list</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 24px' }}>
        <div className="nm-inset" style={{ padding: '16px 20px', boxShadow: `var(--shadow-nm-inset-sm), 0 0 0 1px var(--color-risk-high)44`, fontSize: 13, color: 'var(--color-risk-high)' }} role="alert">
          <strong>Error:</strong> {error}
        </div>
        <Link to="/" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontSize: 13, marginTop: 12, display: 'inline-block' }}>← Back</Link>
      </div>
    );
  }

  if (!caseData) return null;
  const { case: c } = caseData;
  const probColor =
    c.fraud_probability >= 0.7
      ? '#E05252'
      : c.fraud_probability >= 0.4
      ? '#D97706'
      : '#059669';

  return (
    <div
      style={{
        maxWidth: 1060,
        margin: '0 auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Breadcrumb */}
      <Link
        to="/"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          transition: 'color 0.15s',
          width: 'fit-content',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
      >
        ← All Investigations
      </Link>

      {/* Primary Case Summary Card */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          padding: '30px 34px',
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow:
            '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Left Column: ID, Verdict, Tags, Summary */}
          <div style={{ flex: 1, minWidth: 280 }}>
            {/* Small uppercase label above Case ID */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#64748B',
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 3,
              }}
            >
              Case ID
            </div>

            {/* Header row: Case ID + Verdict badge + SAR badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <h1
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {caseData.case_id}
              </h1>
              <VerdictBadge verdict={c.verdict} size="lg" />
              <SarFlag required={caseData.sar.file} size="md" />
            </div>

            {/* Tags row: Pattern tag + Status tag */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <PatternTag pattern={c.pattern} showFull />
              {/* Neutral distinct status tag */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#475569',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 20,
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      c.status === 'escalated'
                        ? '#D97706'
                        : c.status.startsWith('closed')
                        ? '#059669'
                        : '#3B82F6',
                  }}
                />
                <span>{toTitleCase(c.status)}</span>
              </span>
            </div>

            {/* Summary prose constrained for optimal reading */}
            {c.summary && (
              <p
                style={{
                  fontSize: 13.5,
                  color: '#475569',
                  lineHeight: 1.75,
                  maxWidth: 620,
                  margin: 0,
                }}
              >
                {c.summary}
              </p>
            )}
          </div>

          {/* Right Column: Confidence and Exposure Metric Cards */}
          <div style={{ display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {/* Confidence Tile */}
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 16,
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 124,
                gap: 8,
              }}
            >
              <ConfidenceRing
                probability={c.fraud_probability}
                color={probColor}
                prefersReduced={prefersReduced}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#64748B',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                Confidence
              </span>
            </div>

            {/* Exposure Tile */}
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 16,
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 134,
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(37, 99, 235, 0.09)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                $
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                {formatUSD(c.exposure_usd)}
              </div>
              <span
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
                Exposure
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Agent Execution Pipeline Card */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: prefersReduced ? 0 : 0.1, ease: 'easeOut' }}
      >
        <AgentPipelineView isRunning={false} latencyS={caseData.latency_s} />
      </motion.div>

      {/* SAR Panel (if filing required) */}
      {caseData.sar.file && <SarPanel caseData={caseData} />}

      {/* Segmented Control Tabs */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: prefersReduced ? 0 : 0.18 }}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <div
          role="tablist"
          aria-label="Investigation view modes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#E2E8F0',
            padding: 4,
            borderRadius: 14,
            boxShadow: 'inset 0 2px 4px rgba(15, 23, 42, 0.06)',
            position: 'relative',
            width: '100%',
            maxWidth: 420,
          }}
        >
          {(['graph', 'details'] as const).map(tabKey => {
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                role="tab"
                id={`tab-${tabKey}`}
                aria-selected={isActive}
                aria-controls={`panel-${tabKey}`}
                tabIndex={0}
                onClick={() => setActiveTab(tabKey)}
                onKeyDown={e => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    setActiveTab(tabKey === 'graph' ? 'details' : 'graph');
                  }
                }}
                style={{
                  flex: 1,
                  position: 'relative',
                  padding: '10px 20px',
                  fontSize: 13.5,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#0F172A' : '#64748B',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 10,
                  transition: 'color 0.2s ease',
                  zIndex: 2,
                  outline: 'none',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabSegment"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: '#FFFFFF',
                      borderRadius: 10,
                      boxShadow:
                        '0 2px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
                      zIndex: -1,
                    }}
                  >
                    {/* Thin accent-colored underline */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '20%',
                        right: '20%',
                        height: 2.5,
                        background: '#2563EB',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  </motion.div>
                )}
                <span style={{ fontSize: 16, opacity: isActive ? 1 : 0.65 }}>
                  {tabKey === 'graph' ? '🕸' : '📋'}
                </span>
                <span>{tabKey === 'graph' ? 'Graph View' : 'Analysis Details'}</span>
              </button>
            );
          })}
        </div>
      </motion.div>


      {/* Graph tab */}
      {activeTab === 'graph' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="tabpanel">
          <CaseGraphExplorer caseData={caseData} />
        </motion.div>
      )}

      {/* Details tab */}
      {activeTab === 'details' && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          role="tabpanel"
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {/* Row 1: Fraud Pattern Scan & Similar Prior Cases */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: prefersReduced ? 0 : 0.04 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 20,
              alignItems: 'stretch',
            }}
          >
            <PatternsPanel caseData={caseData} />
            <SimilarCasesPanel caseData={caseData} />
          </motion.div>

          {/* Gemini Decision Card */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: prefersReduced ? 0 : 0.1 }}
          >
            <DecisionPanel caseData={caseData} />
          </motion.div>

          {/* Next Best Actions Card */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: prefersReduced ? 0 : 0.16 }}
          >
            <NbaPanel caseData={caseData} />
          </motion.div>

          {/* Evidence Audit Log Card */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: prefersReduced ? 0 : 0.22 }}
          >
            <EvidenceAuditLog evidence={c.evidence} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};



