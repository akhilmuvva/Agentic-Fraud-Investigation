/**
 * CaseListPage.tsx — Full neumorphic case list with filters, stats, and investigation drawer.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useCases } from '../hooks/useCases';
import { CaseListItem } from '../components/CaseListItem';
import { SkeletonCard } from '../components/SkeletonCard';
import { AgentPipelineView } from '../components/AgentPipelineView';
import { VerdictBadge } from '../components/VerdictBadge';
import { PatternTag } from '../components/PatternTag';
import { postInvestigate, ApiClientError } from '../api/client';
import type { InvestigateRequest, FraudPattern, Verdict, CaseDetail } from '../api/types';
import { useNavigate } from 'react-router-dom';
import { formatUSD } from '../lib/utils';
import { FilterBar } from '../components/FilterBar';

const FRAUD_PATTERNS: FraudPattern[] = [
  'card_not_present_fraud',
  'account_takeover',
  'card_not_present_new_device',
  'out_of_region_use',
  'card_testing',
];
const VERDICTS: Verdict[] = ['fraud', 'uncertain', 'legitimate'];

/* ── Animation helpers for KPI Stat Row ─────────────────────── */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

const CountUpNumber: React.FC<{ target: number; delayMs?: number; duration?: number }> = ({
  target,
  delayMs = 0,
  duration = 750,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [val, setVal] = useState(shouldReduceMotion ? target : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVal(target);
      return;
    }
    let startTime: number | null = null;
    let animId: number;
    const timer = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuad(progress);
        setVal(Math.round(eased * target));
        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          setVal(target);
        }
      };
      animId = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, delayMs, duration, shouldReduceMotion]);

  return <>{val}</>;
};

const CountUpExposure: React.FC<{ target: number; delayMs?: number; duration?: number }> = ({
  target,
  delayMs = 0,
  duration = 850,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [val, setVal] = useState(shouldReduceMotion ? target : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVal(target);
      return;
    }
    let startTime: number | null = null;
    let animId: number;
    const timer = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuad(progress);
        setVal(eased * target);
        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          setVal(target);
        }
      };
      animId = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, delayMs, duration, shouldReduceMotion]);

  return <>{formatUSD(val)}</>;
};

const InlineConfidenceArc: React.FC<{ confidence: number; delayMs?: number }> = ({
  confidence,
  delayMs = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const radius = 14;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius; // ~87.96
  const targetOffset = circumference * (1 - Math.min(Math.max(confidence, 0), 1));
  const [offset, setOffset] = useState(shouldReduceMotion ? targetOffset : circumference);

  useEffect(() => {
    if (shouldReduceMotion) {
      setOffset(targetOffset);
      return;
    }
    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [targetOffset, delayMs, shouldReduceMotion]);

  const color =
    confidence >= 0.7 ? '#EF4444'
    : confidence >= 0.4 ? '#F59E0B'
    : '#10B981';

  return (
    <svg width={32} height={32} viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle
        cx={16}
        cy={16}
        r={radius}
        fill="transparent"
        stroke="var(--nm-progress-bg, rgba(148, 163, 184, 0.2))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={16}
        cy={16}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: shouldReduceMotion ? 'none' : 'stroke-dashoffset 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </svg>
  );
};

/* ── Stats Row ─────────────────────────────────────────────── */
const StatsRow: React.FC<{ cases: CaseDetail[] }> = ({ cases }) => {
  const shouldReduceMotion = useReducedMotion();
  const totalCases = cases.length;
  const fraudCount = cases.filter(c => c.case.verdict === 'fraud').length;
  const sarCount = cases.filter(c => c.sar.file).length;
  const avgConfidence = totalCases
    ? cases.reduce((s, c) => s + c.case.fraud_probability, 0) / totalCases
    : 0;
  const avgConfidencePercent = Math.round(avgConfidence * 100);
  const totalExposure = cases.reduce((s, c) => s + (c.case.exposure_usd || 0), 0);

  const tiles = [
    {
      id: 'total',
      label: 'Total Cases',
      accentColor: '#94A3B8',
      icon: <span style={{ fontSize: 13, opacity: 0.65 }}>📁</span>,
      renderValue: (delay: number) => (
        <span style={{ color: 'var(--color-text)' }}>
          <CountUpNumber target={totalCases} delayMs={delay} />
        </span>
      ),
    },
    {
      id: 'fraud',
      label: 'Fraud Confirmed',
      accentColor: '#EF4444',
      icon: <span style={{ fontSize: 13, color: '#EF4444' }}>⚠</span>,
      renderValue: (delay: number) => (
        <span style={{ color: '#DC2626' }}>
          <CountUpNumber target={fraudCount} delayMs={delay} />
        </span>
      ),
    },
    {
      id: 'sar',
      label: 'SAR Filed',
      accentColor: '#F59E0B',
      icon: <span style={{ fontSize: 13, color: '#F59E0B' }}>⚑</span>,
      renderValue: (delay: number) => (
        <span style={{ color: '#D97706' }}>
          <CountUpNumber target={sarCount} delayMs={delay} />
        </span>
      ),
    },
    {
      id: 'confidence',
      label: 'Avg Confidence',
      accentColor: '#8B5CF6',
      icon: <span style={{ fontSize: 13, color: '#8B5CF6' }}>🎯</span>,
      renderValue: (delay: number) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <InlineConfidenceArc confidence={avgConfidence} delayMs={delay} />
          <span style={{ color: 'var(--color-text)' }}>
            <CountUpNumber target={avgConfidencePercent} delayMs={delay} />%
          </span>
        </div>
      ),
    },
    {
      id: 'exposure',
      label: 'Total Exposure',
      accentColor: '#3B82F6',
      icon: <span style={{ fontSize: 13, color: '#3B82F6', fontWeight: 800 }}>$</span>,
      renderValue: (delay: number) => (
        <span style={{ color: 'var(--color-text)', fontSize: 20 }}>
          <CountUpExposure target={totalExposure} delayMs={delay} />
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
      {tiles.map((tile, i) => {
        const delay = i * 80;
        return (
          <motion.div
            key={tile.id}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.4,
              delay: shouldReduceMotion ? 0 : i * 0.08,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            whileHover={shouldReduceMotion ? undefined : {
              y: -2.5,
              boxShadow: 'var(--shadow-nm-lg)',
            }}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 16,
              background: 'var(--nm-surface)',
              boxShadow: 'var(--shadow-nm-md)',
              padding: '16px 14px 18px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 96,
            }}
          >
            {/* Top accent bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: tile.accentColor,
              }}
            />

            {/* Top header row: Label + Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              {tile.icon}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {tile.label}
              </span>
            </div>

            {/* Value */}
            <div
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {tile.renderValue(delay)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ── New Investigation Drawer ───────────────────────────────── */
const NmField: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

interface DrawerProps { onClose: () => void; onComplete: (id: string) => void; }
const NewInvestigationDrawer: React.FC<DrawerProps> = ({ onClose, onComplete }) => {
  const [form, setForm] = useState<InvestigateRequest>({
    case_id: '', trigger_type: 'risk_score', trigger_text: '',
    flagged_txn_id: '', card_id: '', customer_id: '', risk_score: 0.5,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyS, setLatencyS] = useState<number | undefined>();
  const set = (k: keyof InvestigateRequest, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setIsRunning(true);
    const t0 = Date.now();
    try {
      await postInvestigate(form);
      setLatencyS((Date.now() - t0) / 1000);
      setIsRunning(false);
      setTimeout(() => onComplete(form.case_id), 1200);
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof ApiClientError ? err.message : 'Investigation failed');
    }
  };

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        style={{ position: 'absolute', inset: 0, background: 'rgba(26, 31, 46, 0.6)' }}
        onClick={onClose} aria-hidden="true"
      />
      {/* Drawer */}
      <motion.div
        className="nm-xl"
        initial={{ y: 48, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 48, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        role="dialog" aria-modal="true" aria-label="New Investigation"
      >
        {/* Header */}
        <div style={{ padding: '22px 26px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--nm-shadow-dark)' }}>
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>
              New Investigation
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              POST /investigate → LangGraph 8-node pipeline
            </div>
          </div>
          <button onClick={onClose} disabled={isRunning} className="nm-btn" style={{ width: 36, height: 36, padding: 0, borderRadius: 10, fontSize: 16 }}>
            ✕
          </button>
        </div>

        {/* Pipeline animation */}
        <div style={{ padding: '18px 26px 0', flexShrink: 0 }}>
          <AgentPipelineView isRunning={isRunning} latencyS={latencyS} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 26px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <NmField label="Case ID *" htmlFor="f_case_id">
              <input id="f_case_id" required value={form.case_id} onChange={e => set('case_id', e.target.value)} placeholder="HHG-021" className="nm-input" disabled={isRunning} />
            </NmField>
            <NmField label="Flagged Txn ID *" htmlFor="f_txn_id">
              <input id="f_txn_id" required value={form.flagged_txn_id} onChange={e => set('flagged_txn_id', e.target.value)} placeholder="3514030" className="nm-input" style={{ fontFamily: 'JetBrains Mono, monospace' }} disabled={isRunning} />
            </NmField>
            <NmField label="Card ID *" htmlFor="f_card_id">
              <input id="f_card_id" required value={form.card_id} onChange={e => set('card_id', e.target.value)} placeholder="C12382-K1" className="nm-input" style={{ fontFamily: 'JetBrains Mono, monospace' }} disabled={isRunning} />
            </NmField>
            <NmField label="Customer ID *" htmlFor="f_cust_id">
              <input id="f_cust_id" required value={form.customer_id} onChange={e => set('customer_id', e.target.value)} placeholder="C12382" className="nm-input" style={{ fontFamily: 'JetBrains Mono, monospace' }} disabled={isRunning} />
            </NmField>
          </div>

          <NmField label="Trigger Type *" htmlFor="f_trigger">
            <select id="f_trigger" value={form.trigger_type} onChange={e => set('trigger_type', e.target.value)} className="nm-input" style={{ appearance: 'none' }} disabled={isRunning}>
              <option value="risk_score">Risk Score Alert</option>
              <option value="customer_report">Customer Report</option>
              <option value="analyst_request">Analyst Request</option>
            </select>
          </NmField>

          <NmField label="Trigger Description *" htmlFor="f_trigger_text">
            <textarea id="f_trigger_text" required value={form.trigger_text} onChange={e => set('trigger_text', e.target.value)} placeholder="Describe the fraud signal or alert…" className="nm-input" style={{ minHeight: 80, resize: 'vertical' }} disabled={isRunning} />
          </NmField>

          <NmField label={`Initial Risk Score: ${form.risk_score.toFixed(2)}`} htmlFor="f_risk_score">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--color-risk-low)', fontWeight: 700 }}>0.0</span>
              <input id="f_risk_score" type="range" min={0} max={1} step={0.01} value={form.risk_score} onChange={e => set('risk_score', parseFloat(e.target.value))} style={{ flex: 1 }} disabled={isRunning} />
              <span style={{ fontSize: 11, color: 'var(--color-risk-high)', fontWeight: 700 }}>1.0</span>
              <div className="nm-inset-sm" style={{ padding: '4px 10px', minWidth: 48, textAlign: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, color: form.risk_score >= 0.7 ? 'var(--color-risk-high)' : form.risk_score >= 0.4 ? 'var(--color-risk-med)' : 'var(--color-risk-low)' }}>
                  {form.risk_score.toFixed(2)}
                </span>
              </div>
            </div>
          </NmField>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--nm-surface)', boxShadow: `var(--shadow-nm-inset-sm), 0 0 0 1px var(--color-risk-high)44`, fontSize: 13, color: 'var(--color-risk-high)' }} role="alert">
              ⚠ {error}
            </div>
          )}

          <button type="submit" disabled={isRunning} className="nm-btn-brand" style={{ width: '100%', fontSize: 14, padding: '13px 0' }}>
            {isRunning ? '⏳ Investigating…' : '🚀 Run Investigation'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ── Main CaseListPage ──────────────────────────────────────── */
export const CaseListPage: React.FC = () => {
  const { cases, loading, error, refetch } = useCases();
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer]             = useState(false);
  const [selectedPatterns, setSelectedPatterns] = useState<FraudPattern[]>([]);
  const [selectedVerdicts, setSelectedVerdicts] = useState<Verdict[]>([]);
  const [sarRequired, setSarRequired]           = useState<boolean>(false);

  const togglePattern = (pattern: FraudPattern) => {
    setSelectedPatterns(prev =>
      prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern]
    );
  };

  const toggleVerdict = (verdict: Verdict) => {
    setSelectedVerdicts(prev =>
      prev.includes(verdict) ? prev.filter(v => v !== verdict) : [...prev, verdict]
    );
  };

  const toggleSar = () => setSarRequired(prev => !prev);

  const clearAllFilters = () => {
    setSelectedPatterns([]);
    setSelectedVerdicts([]);
    setSarRequired(false);
  };

  const filtered = useMemo(() => cases.filter(c => {
    if (selectedPatterns.length > 0 && !selectedPatterns.includes(c.case.pattern as FraudPattern)) return false;
    if (selectedVerdicts.length > 0 && !selectedVerdicts.includes(c.case.verdict as Verdict)) return false;
    if (sarRequired && !c.sar.file) return false;
    return true;
  }), [cases, selectedPatterns, selectedVerdicts, sarRequired]);

  const shouldReduceMotion = useReducedMotion();

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Fraud Investigations
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 10.5,
              color: 'var(--color-text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            TigerGraph · LangGraph · Gemini 2.0 Flash
          </p>
        </div>

        <motion.button
          onClick={() => setShowDrawer(true)}
          className="nm-btn-brand"
          initial="rest"
          whileHover={shouldReduceMotion ? undefined : 'hover'}
          whileTap={shouldReduceMotion ? undefined : 'tap'}
          variants={{
            rest: { y: 0 },
            hover: { y: -2, boxShadow: '0 8px 24px rgba(107, 92, 246, 0.45)' },
            tap: { y: 0, scale: 0.98 },
          }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            cursor: 'pointer',
            padding: '10px 18px',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <motion.span
            variants={{
              rest: { rotate: 0 },
              hover: { rotate: 90, scale: 1.15 },
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            style={{ display: 'inline-block', fontSize: 17, lineHeight: 1, fontWeight: 700 }}
          >
            +
          </motion.span>
          <span>New Investigation</span>
        </motion.button>
      </div>

      {/* Stats */}
      {!loading && cases.length > 0 && <StatsRow cases={cases} />}

      {/* Interactive Filter Bar (Staggered load) */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.35, delay: shouldReduceMotion ? 0 : 0.22 }}
      >
        <FilterBar
          selectedPatterns={selectedPatterns}
          onTogglePattern={togglePattern}
          selectedVerdicts={selectedVerdicts}
          onToggleVerdict={toggleVerdict}
          sarRequired={sarRequired}
          onToggleSar={toggleSar}
          filteredCount={filtered.length}
          totalCount={cases.length}
          onClearAll={clearAllFilters}
        />
      </motion.div>

      {/* Error */}
      {error && (
        <div className="nm-inset" style={{ padding: '14px 18px', marginBottom: 16, boxShadow: `var(--shadow-nm-inset-sm), 0 0 0 1px var(--color-risk-high)44`, fontSize: 13, color: 'var(--color-risk-high)' }} role="alert">
          <strong>Error loading cases:</strong> {error}
          <button onClick={refetch} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-risk-high)' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-live="polite" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="nm-inset-lg" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
            {cases.length === 0 ? 'No cases yet' : 'No matching cases'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {cases.length === 0 ? 'Start a new investigation above.' : 'Try adjusting your filters.'}
          </div>
        </div>
      )}

      {/* Case list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((c, i) => <CaseListItem key={c.case_id} caseData={c} index={i} />)}
        </div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {showDrawer && (
          <NewInvestigationDrawer
            onClose={() => setShowDrawer(false)}
            onComplete={id => { setShowDrawer(false); refetch(); navigate(`/cases/${id}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
