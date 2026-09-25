import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useHealth } from '../hooks/useHealth';

export const HealthIndicator: React.FC = () => {
  const { status, lastCheck } = useHealth(30_000);
  const shouldReduceMotion = useReducedMotion();

  const cfg = {
    ok: {
      color: '#059669',
      borderColor: 'rgba(5, 150, 105, 0.28)',
      label: 'API Online',
      pulse: true,
    },
    error: {
      color: '#DC2626',
      borderColor: 'rgba(220, 38, 38, 0.35)',
      label: 'API Offline',
      pulse: true,
    },
    loading: {
      color: 'var(--color-text-muted)',
      borderColor: 'rgba(148, 163, 184, 0.25)',
      label: 'Connecting…',
      pulse: false,
    },
  }[status];

  return (
    <div
      className="nm-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: 'var(--nm-surface)',
        border: `1px solid ${cfg.borderColor}`,
        boxShadow: 'var(--shadow-nm-sm)',
        transition: 'border-color 0.3s ease',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Backend: ${cfg.label}`}
      title={lastCheck ? `Last checked ${lastCheck.toLocaleTimeString()}` : undefined}
    >
      {/* Live Pulsing Dot */}
      <span style={{ position: 'relative', display: 'flex', width: 9, height: 9, alignItems: 'center', justifyContent: 'center' }}>
        {cfg.pulse && !shouldReduceMotion && (
          <motion.span
            animate={{ scale: [1, 2.2, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cfg.color,
              pointerEvents: 'none',
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 6px ${cfg.color}88`,
          }}
          aria-hidden="true"
        />
      </span>

      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 3 }}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: cfg.color,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.02em',
          }}
        >
          {cfg.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
