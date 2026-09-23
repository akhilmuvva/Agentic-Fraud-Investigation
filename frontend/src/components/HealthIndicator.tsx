import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHealth } from '../hooks/useHealth';

export const HealthIndicator: React.FC = () => {
  const { status, lastCheck } = useHealth(30_000);

  const cfg = {
    ok:      { color: 'var(--color-risk-low)',  label: 'API Online',    pulse: true  },
    error:   { color: 'var(--color-risk-high)', label: 'API Offline',   pulse: false },
    loading: { color: 'var(--color-text-muted)', label: 'Connecting…',  pulse: false },
  }[status];

  return (
    <div
      className="nm-pill"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}
      role="status"
      aria-live="polite"
      aria-label={`Backend: ${cfg.label}`}
      title={lastCheck ? `Last checked ${lastCheck.toLocaleTimeString()}` : undefined}
    >
      {/* Dot */}
      <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
        {cfg.pulse && (
          <span
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: cfg.color, opacity: 0.6,
              animation: 'node-glow-pulse 1.5s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        )}
        <span
          style={{
            position: 'relative', width: 8, height: 8, borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 6px ${cfg.color}99`,
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
          style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}
        >
          {cfg.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
