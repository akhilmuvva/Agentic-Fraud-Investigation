/**
 * SimilarCasesPanel — Neumorphic vector-RAG similar cases.
 */
import React from 'react';
import type { CaseDetail, SimilarCase, FraudPattern } from '../api/types';
import { PatternTag } from './PatternTag';
import { formatConfidence } from '../lib/utils';

interface SimilarCasesPanelProps {
  caseData: CaseDetail;
}

export const SimilarCasesPanel: React.FC<SimilarCasesPanelProps> = ({ caseData }) => {
  const { case: c } = caseData;
  const richCases: SimilarCase[] | undefined = (caseData as any).similar_cases;
  const stringIds: string[] = c.similar_prior_cases ?? [];
  const hasSimilar = (richCases && richCases.length > 0) || stringIds.length > 0;

  return (
    <div className="nm-lg" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className="nm-sm" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🔗
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            Similar Prior Cases
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            Vector RAG · text-embedding-004
          </div>
        </div>
      </div>

      <div className="nm-divider" style={{ marginBottom: 20 }} />

      {!hasSimilar && (
        <div className="nm-inset" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
          No similar cases retrieved.
        </div>
      )}

      {/* Rich with similarity scores */}
      {richCases && richCases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {richCases.map((sc, i) => (
            <div key={sc.case_id} className="nm-inset-sm" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="nm-sm" style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--color-brand)', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{sc.case_id}</span>
                  <PatternTag pattern={sc.pattern as FraudPattern} />
                  <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12, color: 'var(--color-brand)' }}>
                    {formatConfidence(sc.similarity_score)}
                  </span>
                </div>
                {/* Similarity bar */}
                <div className="nm-progress-track" style={{ height: 4, marginTop: 6 }}>
                  <div
                    className="nm-progress-fill"
                    style={{ width: `${sc.similarity_score * 100}%`, background: 'linear-gradient(90deg, var(--color-brand), var(--color-purple))' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ID-only fallback */}
      {(!richCases || richCases.length === 0) && stringIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stringIds.map((id, i) => (
            <div key={id} className="nm-inset-sm" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="nm-sm" style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: 'var(--color-brand)', flexShrink: 0 }}>
                {i + 1}
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{id}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>
                similarity score not serialized
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
