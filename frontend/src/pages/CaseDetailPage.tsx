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

  return (
    <div className="nm-lg" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className="nm-sm" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🕸
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            Fraud Pattern Scan
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            5 GSQL pattern queries · TigerGraph
          </div>
        </div>
      </div>

      <div className="nm-divider" style={{ marginBottom: 20 }} />

      {patternResults.length === 0 ? (
        <div className="nm-inset" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Pattern evidence not in response. Primary: </span>
          <PatternTag pattern={c.pattern} showFull />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {patternResults.map(({ patternName, matched, claim }) => {
            const accent = riskColors[patternName] ?? '#5C6B85';
            const riskMatch = claim.match(/(\d+) risk indicators/);
            const riskCount = riskMatch ? parseInt(riskMatch[1]) : 0;

            return (
              <div
                key={patternName}
                className={matched ? 'nm-inset-sm' : 'nm-flat'}
                style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  opacity: matched ? 1 : 0.5,
                  boxShadow: matched
                    ? `var(--shadow-nm-inset-sm), 0 0 0 1px ${accent}33`
                    : 'var(--shadow-nm-flat)',
                }}
                role="listitem"
                aria-label={`${patternName}: ${matched ? 'matched' : 'not matched'}`}
              >
                {/* Status dot */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--nm-surface)',
                  boxShadow: matched ? `var(--shadow-nm-sm), 0 0 0 2px ${accent}66, 0 0 10px ${accent}33` : 'var(--shadow-nm-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {matched ? '🔴' : '⚪'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PatternTag pattern={patternName} showFull />
                    {matched && riskCount > 0 && (
                      <span className="nm-pill" style={{ fontSize: 10, padding: '2px 8px', color: accent, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                        {riskCount} signal{riskCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {!matched && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>not triggered</span>}
                  </div>
                </div>
                {/* Right: matched indicator */}
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, color: matched ? accent : 'var(--color-text-muted)', flexShrink: 0 }}>
                  {matched ? '● MATCH' : '○ MISS'}
                </div>
              </div>
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
      style={{ padding: '24px', boxShadow: `var(--shadow-nm-md), 0 0 0 2px var(--color-risk-high)44, 0 0 20px var(--color-risk-high-glow)` }}
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

/* ── Main CaseDetailPage ────────────────────────────────────── */
export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { caseData, loading, error, notFound } = useCaseDetail(caseId);
  const [activeTab, setActiveTab] = useState<'graph' | 'details'>('graph');

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
  const probColor = c.fraud_probability >= 0.7 ? 'var(--color-risk-high)' : c.fraud_probability >= 0.4 ? 'var(--color-risk-med)' : 'var(--color-risk-low)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Breadcrumb */}
      <Link to="/" style={{ fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
        ← All Investigations
      </Link>

      {/* Header card */}
      <div className="nm-xl" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <h1 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                {caseData.case_id}
              </h1>
              <VerdictBadge verdict={c.verdict} size="lg" />
              <SarFlag required={caseData.sar.file} size="md" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <PatternTag pattern={c.pattern} showFull />
              <span className="nm-pill" style={{ fontSize: 10, padding: '3px 10px', color: 'var(--color-text-muted)' }}>
                {toTitleCase(c.status)}
              </span>
            </div>
            {c.summary && (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: 560 }}>{c.summary}</p>
            )}
          </div>

          {/* Metric boxes */}
          <div style={{ display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
            <div className="nm-inset" style={{ padding: '18px 24px', textAlign: 'center', minWidth: 110 }}>
              <div style={{ fontFamily: 'Space Grotesk, monospace', fontSize: 32, fontWeight: 800, color: probColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {formatConfidence(c.fraud_probability)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6, fontWeight: 600 }}>Confidence</div>
              <div className="nm-progress-track" style={{ marginTop: 8, height: 5 }}>
                <div className="nm-progress-fill" style={{ width: `${c.fraud_probability * 100}%`, background: probColor }} />
              </div>
            </div>
            <div className="nm-inset" style={{ padding: '18px 24px', textAlign: 'center', minWidth: 110 }}>
              <div style={{ fontFamily: 'Space Grotesk, monospace', fontSize: 26, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {formatUSD(c.exposure_usd)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6, fontWeight: 600 }}>Exposure</div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Pipeline */}
      <AgentPipelineView isRunning={false} latencyS={caseData.latency_s} />

      {/* SAR */}
      {caseData.sar.file && <SarPanel caseData={caseData} />}

      {/* Tabs */}
      <div className="nm-tab-bar">
        <button className={`nm-tab ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')} role="tab" aria-selected={activeTab === 'graph'}>
          🕸 Graph View
        </button>
        <button className={`nm-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')} role="tab" aria-selected={activeTab === 'details'}>
          📋 Analysis Details
        </button>
      </div>

      {/* Graph tab */}
      {activeTab === 'graph' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="tabpanel">
          <CaseGraphExplorer caseData={caseData} />
        </motion.div>
      )}

      {/* Details tab */}
      {activeTab === 'details' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <PatternsPanel caseData={caseData} />
            <SimilarCasesPanel caseData={caseData} />
          </div>
          <DecisionPanel caseData={caseData} />
          <NbaPanel caseData={caseData} />

          {/* Evidence audit log */}
          <details className="nm-lg" style={{ overflow: 'hidden' }}>
            <summary style={{ padding: '18px 24px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Evidence Audit Log
              <span className="nm-pill" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--color-text-muted)' }}>
                {c.evidence.length} entries
              </span>
            </summary>
            <div style={{ padding: '0 24px 20px', maxHeight: 280, overflowY: 'auto' }}>
              <div className="nm-divider" style={{ marginBottom: 14 }} />
              {c.evidence.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--nm-shadow-dark)', opacity: 0.9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: ev.source === 'graph' ? 'var(--color-brand)' : 'var(--color-text-muted)', boxShadow: `0 0 4px ${ev.source === 'graph' ? 'var(--color-brand)' : 'transparent'}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--color-text-muted)', marginRight: 8 }}>[{ev.ref}]</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{ev.claim.slice(0, 130)}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </motion.div>
      )}
    </motion.div>
  );
};
