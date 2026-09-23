/**
 * SimilarCasesPanel — Neumorphic vector-RAG similar cases.
 * Resolves raw serialization error, formats similarity scores,
 * provides clickable case navigation, and adheres to the app design system.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { CaseDetail, SimilarCase, FraudPattern } from '../api/types';
import { PatternTag } from './PatternTag';

interface SimilarCasesPanelProps {
  caseData: CaseDetail;
}

interface NormalizedSimilarCase {
  id: string;
  score?: number;
  pattern?: FraudPattern | string;
  outcome?: string;
}

export const SimilarCasesPanel: React.FC<SimilarCasesPanelProps> = ({ caseData }) => {
  const { case: c } = caseData;
  const richCases: SimilarCase[] | undefined = (caseData as any).similar_cases;
  const stringIds: string[] = c.similar_prior_cases ?? [];

  // Normalize cases into a unified structure
  const cases: NormalizedSimilarCase[] = React.useMemo(() => {
    if (richCases && richCases.length > 0) {
      return richCases.map(sc => {
        const hasValidScore =
          typeof sc.similarity_score === 'number' &&
          !isNaN(sc.similarity_score) &&
          sc.similarity_score >= 0;
        if (!hasValidScore) {
          console.warn(`[SimilarCasesPanel] Similarity score missing or invalid for case ${sc.case_id}`);
        }
        return {
          id: sc.case_id,
          score: hasValidScore ? sc.similarity_score : undefined,
          pattern: sc.pattern,
          outcome: sc.outcome,
        };
      });
    }

    if (stringIds.length > 0) {
      return stringIds.map(id => {
        console.warn(`[SimilarCasesPanel] Similarity score missing or not serialized for similar case: ${id}`);
        return {
          id,
          score: undefined,
        };
      });
    }

    return [];
  }, [richCases, stringIds]);

  const hasScores = cases.some(item => typeof item.score === 'number');
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
            }}
          >
            🔗
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
              Similar Prior Cases
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 1,
              }}
            >
              Vector RAG · text-embedding-004
            </div>
          </div>
        </div>

        {/* Count badge */}
        {cases.length > 0 && (
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
            {cases.length} case{cases.length !== 1 ? 's' : ''} retrieved
          </span>
        )}
      </div>

      <div className="nm-divider" style={{ marginBottom: 16 }} />

      {/* No cases message */}
      {cases.length === 0 && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#64748B',
            fontSize: 13,
            fontStyle: 'italic',
            background: '#F8FAFC',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
          }}
        >
          No similar cases retrieved from vector graph.
        </div>
      )}

      {/* Clean single banner if scores are unavailable */}
      {!hasScores && cases.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(241, 245, 249, 0.8)',
            border: '1px solid #E2E8F0',
            fontSize: 11,
            color: '#64748B',
            fontFamily: 'Inter, sans-serif',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.8 }}>ℹ️</span>
          <span>Retrieved via vector similarity — scores unavailable</span>
        </div>
      )}

      {/* Similar case rows */}
      {cases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {cases.map((sc, i) => {
            const hasScore = typeof sc.score === 'number';
            const scorePct = hasScore ? Math.round(sc.score! * 100) : null;

            return (
              <motion.div
                key={sc.id}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReduced ? 0 : i * 0.06, duration: 0.25 }}
              >
                <Link
                  to={`/cases/${sc.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#93C5FD';
                    e.currentTarget.style.boxShadow =
                      '0 4px 12px rgba(59, 130, 246, 0.12), 0 1px 3px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    const chevron = e.currentTarget.querySelector('.case-row-chevron') as HTMLElement;
                    if (chevron) {
                      chevron.style.transform = 'translateX(3px)';
                      chevron.style.color = '#2563EB';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    const chevron = e.currentTarget.querySelector('.case-row-chevron') as HTMLElement;
                    if (chevron) {
                      chevron.style.transform = 'translateX(0)';
                      chevron.style.color = '#94A3B8';
                    }
                  }}
                >
                  {/* Number Badge */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 11,
                      color: '#2563EB',
                      fontFamily: 'JetBrains Mono, monospace',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Case ID and Pattern */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 800,
                          fontSize: 13.5,
                          color: '#0F172A',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {sc.id}
                      </span>
                      {sc.pattern && <PatternTag pattern={sc.pattern as FraudPattern} />}
                    </div>

                    {/* Similarity score bar (if score is available) */}
                    {hasScore && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 6,
                          maxWidth: 180,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            background: '#E2E8F0',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${scorePct}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #3B82F6 0%, #7C3AED 100%)',
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Score or Unavailable Pill */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {hasScore ? (
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 800,
                          fontSize: 12.5,
                          color: '#2563EB',
                        }}
                      >
                        {scorePct}% match
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#94A3B8',
                          fontStyle: 'italic',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        Score unavailable
                      </span>
                    )}

                    {/* Navigability chevron */}
                    <span
                      className="case-row-chevron"
                      style={{
                        fontSize: 14,
                        color: '#94A3B8',
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        display: 'inline-block',
                      }}
                    >
                      →
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
