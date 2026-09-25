/**
 * AgentPipelineView — Visual process trace for the LangGraph 8-node agent pipeline.
 * Features a continuous background track with animated progress fill,
 * tactile step node badges with distinct icons, pop-in animations,
 * and a success badge for completed execution.
 */
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NODES = [
  { id: 'ingest_case',      label: 'Ingest',      icon: '📥', desc: 'Load & validate transaction' },
  { id: 'retrieve_context', label: 'Context',     icon: '🔍', desc: 'Extract graph neighborhood' },
  { id: 'match_patterns',   label: 'Patterns',    icon: '🕸', desc: '5 GSQL graph pattern queries' },
  { id: 'retrieve_similar', label: 'Similar',     icon: '🧠', desc: 'Vector similarity RAG' },
  { id: 'decision',         label: 'Decision',    icon: '⚡', desc: 'Gemini 2.0 Flash reasoning' },
  { id: 'next_best_action', label: 'NBA',         icon: '🎯', desc: 'Policy-based actions' },
  { id: 'write_to_graph',   label: 'Write Graph', icon: '💾', desc: 'Persist verdict to TigerGraph' },
  { id: 'format_output',    label: 'Output',      icon: '✅', desc: 'Final defensible dossier' },
] as const;

const NODE_DURATION_MS = 1600;

interface AgentPipelineViewProps {
  isRunning: boolean;
  latencyS?: number;
  className?: string;
}

export const AgentPipelineView: React.FC<AgentPipelineViewProps> = ({
  isRunning,
  latencyS,
  className,
}) => {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (isRunning) {
      setActiveIdx(0);
      setDoneSet(new Set());
      let i = 0;
      intervalRef.current = setInterval(() => {
        i++;
        if (i < NODES.length) {
          setActiveIdx(i);
          setDoneSet(prev => new Set([...prev, i - 1]));
        } else {
          clearInterval(intervalRef.current!);
          setActiveIdx(-1);
          setDoneSet(new Set(NODES.map((_, j) => j)));
        }
      }, NODE_DURATION_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (latencyS !== undefined) {
        if (prefersReduced) {
          setActiveIdx(-1);
          setDoneSet(new Set(NODES.map((_, j) => j)));
        } else {
          // Staggered reveal on initial mount
          NODES.forEach((_, idx) => {
            setTimeout(() => {
              setDoneSet(prev => new Set([...prev, idx]));
            }, idx * 75);
          });
        }
      } else {
        setActiveIdx(-1);
        setDoneSet(new Set());
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, latencyS, prefersReduced]);

  const completedCount = doneSet.size;
  const progressRatio = Math.min(1, completedCount / (NODES.length - 1));

  return (
    <div
      className={`nm-xl ${className ?? ''}`}
      style={{
        padding: '24px 28px',
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow:
          '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(226, 232, 240, 0.8)',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
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
            🤖
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Agent Execution Pipeline
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                marginTop: 1,
              }}
            >
              LangGraph 8-node state machine · TigerGraph Savanna
            </div>
          </div>
        </div>

        {/* Right Status Badge */}
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(217, 119, 6, 0.12)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                color: '#B45309',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                ⚙
              </motion.span>
              <span>Investigating in graph...</span>
            </motion.div>
          ) : latencyS !== undefined ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(5, 150, 105, 0.12)',
                border: '1px solid rgba(5, 150, 105, 0.32)',
                color: '#047857',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <span style={{ fontSize: 13 }}>✓</span>
              <span>Completed in {latencyS.toFixed(1)}s</span>
            </motion.div>
          ) : (
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Standby
            </span>
          )}
        </AnimatePresence>
      </div>

      {/* Process Trace Rail with Nodes */}
      <div style={{ position: 'relative', padding: '10px 0 6px', overflowX: 'auto' }}>
        {/* Continuous Track Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            position: 'relative',
            minWidth: 700,
          }}
        >
          {/* Continuous Rail Line behind nodes */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 24,
              right: 24,
              height: 4,
              background: '#EEF2F6',
              borderRadius: 4,
              zIndex: 1,
            }}
          >
            {/* Animated Completed Fill */}
            <motion.div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                borderRadius: 4,
                transformOrigin: 'left',
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progressRatio }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </div>

          {/* Step Nodes */}
          {NODES.map((node, i) => {
            const isActive = activeIdx === i;
            const isDone = doneSet.has(i);

            return (
              <motion.div
                key={node.id}
                title={`${node.label}: ${node.desc}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative',
                  zIndex: 2,
                  width: 72,
                }}
              >
                {/* Node Badge */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.15 : isDone ? 1.05 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDone
                      ? '#10B981'
                      : isActive
                      ? '#3B82F6'
                      : '#FFFFFF',
                    border: isDone
                      ? '2.5px solid #FFFFFF'
                      : isActive
                      ? '2.5px solid #FFFFFF'
                      : '2px solid #CBD5E1',
                    boxShadow: isDone
                      ? '0 4px 12px rgba(16, 185, 129, 0.35), 0 1px 3px rgba(0,0,0,0.1)'
                      : isActive
                      ? '0 4px 14px rgba(59, 130, 246, 0.4)'
                      : '0 2px 6px rgba(15, 23, 42, 0.06)',
                    color: isDone || isActive ? '#FFFFFF' : '#475569',
                    fontSize: isDone ? 15 : 16,
                    fontWeight: 800,
                    position: 'relative',
                    transition: 'background 0.25s ease, border-color 0.25s ease',
                  }}
                >
                  {isDone ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                    >
                      ✓
                    </motion.span>
                  ) : (
                    <span>{node.icon}</span>
                  )}

                  {/* Active Ring Pulse */}
                  {isActive && (
                    <motion.div
                      style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        border: '2px solid #3B82F6',
                      }}
                      animate={{ opacity: [0.8, 0], scale: [1, 1.45] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </motion.div>

                {/* Step Text Label */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: isDone || isActive ? 700 : 600,
                      color: isDone
                        ? '#047857'
                        : isActive
                        ? '#1D4ED8'
                        : '#64748B',
                      lineHeight: 1.2,
                      fontFamily: 'Inter, sans-serif',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {node.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: '#94A3B8',
                      fontFamily: 'JetBrains Mono, monospace',
                      marginTop: 2,
                    }}
                  >
                    0{i + 1}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
