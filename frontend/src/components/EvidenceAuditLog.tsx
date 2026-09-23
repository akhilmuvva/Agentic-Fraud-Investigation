/**
 * EvidenceAuditLog — Expandable audit timeline for case evidence entries.
 * Formats timestamps, categorizes action types with Agent Pipeline icons,
 * parses raw dictionary text into clean prose, and provides full compliance auditability.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Evidence } from '../api/types';

interface EvidenceAuditLogProps {
  evidence: Evidence[];
}


interface ParsedEvidence {
  index: number;
  timestamp: string;
  category: string;
  icon: string;
  source: string;
  ref: string;
  description: string;
  rawClaim: string;
}

export const EvidenceAuditLog: React.FC<EvidenceAuditLogProps> = ({ evidence }) => {
  const [expanded, setExpanded] = useState(false);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parsedEntries: ParsedEvidence[] = React.useMemo(() => {
    return evidence.map((ev, i) => {
      let icon = '📋';
      let category = 'Audit Entry';
      let description = ev.claim;
      let timestamp = `00:0${i + 1}.000`;

      // Parse timestamp or claim if JSON/dict format
      if (ev.claim.includes("'timestamp':")) {
        const timeMatch = ev.claim.match(/'timestamp':\s*'([^']+)'/);
        if (timeMatch) {
          const d = new Date(timeMatch[1]);
          if (!isNaN(d.getTime())) {
            timestamp = d.toISOString().slice(11, 23);
          }
        }
      }

      if (ev.claim.includes("'trigger_text':")) {
        const triggerMatch = ev.claim.match(/'trigger_text':\s*'([^']+)'/);
        if (triggerMatch) {
          description = triggerMatch[1];
        }
      }

      // Assign icon and category based on reference
      if (ev.ref === 'trigger') {
        icon = '⚡';
        category = 'Trigger Scoring';
      } else if (ev.ref.startsWith('detect_')) {
        icon = '🕸';
        category = 'Graph Pattern';
      } else if (ev.ref.startsWith('get_')) {
        icon = '🔍';
        category = 'Context Retrieval';
      } else if (ev.ref.includes('similar')) {
        icon = '🧠';
        category = 'Vector Similarity';
      } else if (ev.ref.includes('validation')) {
        icon = '👤';
        category = 'Customer Validation';
      }

      return {
        index: i + 1,
        timestamp,
        category,
        icon,
        source: ev.source,
        ref: ev.ref,
        description,
        rawClaim: ev.claim,
      };
    });
  }, [evidence]);

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
      {/* Header Toggle */}
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
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-expanded={expanded}
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
            📋
          </div>
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>Evidence Audit Log</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {evidence.length} entries
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 2,
              }}
            >
              Deterministic audit trail · IEEE-CIS & TigerGraph
            </div>
          </div>
        </div>

        {/* Expand/Collapse Chevron Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#64748B',
          }}
        >
          <span>{expanded ? 'Hide Log' : 'View Audit Trail'}</span>
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
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </div>
        </div>
      </button>

      {/* Expanded Audit Log Timeline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{ padding: '0 28px 28px' }}>
              <div className="nm-divider" style={{ marginBottom: 18 }} />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: 460,
                  overflowY: 'auto',
                  paddingRight: 6,
                }}
              >
                {parsedEntries.map(entry => (
                  <div
                    key={entry.index}
                    style={{
                      background: '#F8FAFC',
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                    }}
                  >
                    {/* Icon container */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: '#EEF2F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {entry.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 4,
                        }}
                      >
                        {/* Timestamp */}
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#2563EB',
                            background: 'rgba(37, 99, 235, 0.08)',
                            padding: '2px 6px',
                            borderRadius: 6,
                          }}
                        >
                          {entry.timestamp}
                        </span>

                        {/* Reference tag */}
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: '#64748B',
                          }}
                        >
                          [{entry.ref}]
                        </span>

                        {/* Source badge */}
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '1px 6px',
                            borderRadius: 6,
                            background:
                              entry.source === 'graph'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(124, 58, 237, 0.1)',
                            color:
                              entry.source === 'graph' ? '#047857' : '#7C3AED',
                            fontFamily: 'JetBrains Mono, monospace',
                            marginLeft: 'auto',
                          }}
                        >
                          {entry.source}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          fontSize: 12.5,
                          color: '#334155',
                          lineHeight: 1.5,
                          margin: 0,
                          wordBreak: 'break-word',
                        }}
                      >
                        {entry.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
