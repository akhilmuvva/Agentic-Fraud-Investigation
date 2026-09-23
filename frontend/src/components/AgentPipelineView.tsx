/**
 * AgentPipelineView — Neumorphic 8-node pipeline with traveling pulse.
 * Timing is ESTIMATED (~14.5s / 8 nodes). Clearly labeled.
 */
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NODES = [
  { id: 'ingest_case',       label: 'Ingest',         icon: '📥', desc: 'Load & validate input' },
  { id: 'retrieve_context',  label: 'Context',         icon: '🔍', desc: 'Graph neighbourhood' },
  { id: 'match_patterns',    label: 'Patterns',        icon: '🕸',  desc: '5 GSQL pattern queries' },
  { id: 'retrieve_similar',  label: 'Similar',         icon: '🧠', desc: 'Vector RAG (text-embedding-004)' },
  { id: 'decision',          label: 'Decision',        icon: '⚡', desc: 'Gemini LLM reasoning' },
  { id: 'next_best_action',  label: 'NBA',             icon: '🎯', desc: 'NBA before/after' },
  { id: 'write_to_graph',    label: 'Write Graph',     icon: '💾', desc: 'Persist verdict to TigerGraph' },
  { id: 'format_output',     label: 'Output',          icon: '✅', desc: 'Final state' },
] as const;

const NODE_DURATION_MS = 1800;

interface AgentPipelineViewProps {
  isRunning: boolean;
  latencyS?: number;
  className?: string;
}

export const AgentPipelineView: React.FC<AgentPipelineViewProps> = ({ isRunning, latencyS, className }) => {
  const [activeIdx, setActiveIdx]     = useState(-1);
  const [doneSet, setDoneSet]         = useState<Set<number>>(new Set());
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      setActiveIdx(0); setDoneSet(new Set());
      let i = 0;
      intervalRef.current = setInterval(() => {
        i++;
        if (i < NODES.length) { setActiveIdx(i); setDoneSet(prev => new Set([...prev, i - 1])); }
        else { clearInterval(intervalRef.current!); setActiveIdx(-1); setDoneSet(new Set(NODES.map((_, j) => j))); }
      }, NODE_DURATION_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (latencyS !== undefined) { setActiveIdx(-1); setDoneSet(new Set(NODES.map((_, j) => j))); }
      else { setActiveIdx(-1); setDoneSet(new Set()); }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, latencyS]);

  return (
    <div
      className={`nm-lg ${className ?? ''}`}
      style={{ padding: '20px 24px' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            🤖 Agent Pipeline
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8, fontFamily: 'JetBrains Mono, monospace' }}>
            LangGraph 8-node state machine
          </span>
        </div>
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.span key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-risk-med)', fontFamily: 'JetBrains Mono, monospace' }}
            >
              ⏱ Investigating… (estimated timing)
            </motion.span>
          ) : latencyS !== undefined ? (
            <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-risk-low)' }}
            >
              ✓ Completed in {latencyS.toFixed(1)}s
            </motion.span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Idle</span>
          )}
        </AnimatePresence>
      </div>

      {/* Pipeline row */}
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0, paddingBottom: 4 }}>
        {NODES.map((node, i) => {
          const isActive = activeIdx === i;
          const isDone   = doneSet.has(i);

          return (
            <React.Fragment key={node.id}>
              {/* Node */}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}
                title={node.desc}
              >
                {/* Circle */}
                <div
                  style={{
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    background: 'var(--nm-surface)',
                    boxShadow: isActive
                      ? `var(--shadow-nm-md), 0 0 0 2px var(--color-brand)`
                      : isDone
                      ? `var(--shadow-nm-sm), 0 0 0 2px var(--color-risk-low)44`
                      : `var(--shadow-nm-sm)`,
                    transition: 'box-shadow 0.3s ease',
                    position: 'relative',
                  }}
                  aria-label={`${node.label}: ${isActive ? 'running' : isDone ? 'complete' : 'pending'}`}
                >
                  {isDone ? (
                    <span style={{ color: 'var(--color-risk-low)', fontWeight: 800, fontSize: 16 }}>✓</span>
                  ) : (
                    <span>{node.icon}</span>
                  )}
                  {/* Active pulse ring */}
                  {isActive && (
                    <motion.span
                      style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid var(--color-brand)` }}
                      initial={{ opacity: 0.8, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.6 }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {/* Label */}
                <span style={{
                  fontSize: 10, fontWeight: 700, textAlign: 'center', maxWidth: 60, lineHeight: 1.2,
                  color: isActive ? 'var(--color-brand)' : isDone ? 'var(--color-risk-low)' : 'var(--color-text-muted)',
                  transition: 'color 0.3s ease',
                }}>
                  {node.label}
                </span>
              </motion.div>

              {/* Connector */}
              {i < NODES.length - 1 && (
                <div style={{ width: 32, height: 3, position: 'relative', flexShrink: 0, marginBottom: 22 }}>
                  {/* Track */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 2,
                    background: 'var(--nm-surface)',
                    boxShadow: 'var(--shadow-nm-inset-sm)',
                  }} />
                  {/* Progress fill */}
                  <AnimatePresence>
                    {(doneSet.has(i) && doneSet.has(i + 1)) && (
                      <motion.div
                        key={`fill-${i}`}
                        style={{ position: 'absolute', inset: 0, borderRadius: 2, background: 'var(--color-risk-low)', opacity: 0.7 }}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                    {isRunning && activeIdx === i + 1 && (
                      <motion.div
                        key={`travel-${i}`}
                        style={{ position: 'absolute', inset: 0, borderRadius: 2, background: 'var(--color-brand)', transformOrigin: 'left' }}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        aria-hidden="true"
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {isRunning && (
        <p style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          Note: per-node timing is estimated — the agent runs as a single synchronous call.
        </p>
      )}
    </div>
  );
};
