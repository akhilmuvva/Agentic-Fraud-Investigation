/**
 * CaseListPage.tsx — Full neumorphic case list with filters, stats, and investigation drawer.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const FRAUD_PATTERNS: FraudPattern[] = [
  'card_not_present_fraud',
  'account_takeover',
  'card_not_present_new_device',
  'out_of_region_use',
  'card_testing',
];
const VERDICTS: Verdict[] = ['fraud', 'uncertain', 'legitimate'];

/* ── Stats Row ─────────────────────────────────────────────── */
const StatsRow: React.FC<{ cases: CaseDetail[] }> = ({ cases }) => {
  const stats = [
    { label: 'Total Cases',      value: cases.length,                                       suffix: '', accent: false },
    { label: 'Fraud Confirmed',  value: cases.filter(c => c.case.verdict === 'fraud').length, suffix: '', accent: true  },
    { label: 'SAR Filed',        value: cases.filter(c => c.sar.file).length,                suffix: '', accent: true  },
    { label: 'Avg Confidence',   value: cases.length ? Math.round(cases.reduce((s, c) => s + c.case.fraud_probability, 0) / cases.length * 100) : 0, suffix: '%', accent: false },
    { label: 'Total Exposure',   value: formatUSD(cases.reduce((s, c) => s + (c.case.exposure_usd || 0), 0)), suffix: '', accent: false, isStr: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginBottom: 28 }}>
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="nm-inset"
          style={{ padding: '20px 16px', textAlign: 'center' }}
        >
          <div
            style={{
              fontFamily: 'Space Grotesk, monospace',
              fontSize: (s as any).isStr ? 18 : 28,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: s.accent && Number(s.value) > 0 ? 'var(--color-risk-high)' : 'var(--color-text)',
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            {s.value}{s.suffix}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
        </motion.div>
      ))}
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

/* ── Filter pill button ─────────────────────────────────────── */
const FilterBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }> = ({ active, onClick, children, danger }) => (
  <button
    onClick={onClick}
    style={{
      background: 'var(--nm-surface)',
      boxShadow: active ? `var(--shadow-nm-inset-sm), 0 0 0 2px ${danger ? 'var(--color-risk-high)' : 'var(--color-brand)'}55` : 'var(--shadow-nm-sm)',
      borderRadius: 20, border: 'none', padding: '5px 12px', cursor: 'pointer',
      transition: 'box-shadow 0.18s ease',
      opacity: active ? 1 : 0.75,
    }}
    onMouseEnter={e => !active && ((e.currentTarget as HTMLElement).style.opacity = '1')}
    onMouseLeave={e => !active && ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
    aria-pressed={active}
  >
    {children}
  </button>
);

/* ── Main CaseListPage ──────────────────────────────────────── */
export const CaseListPage: React.FC = () => {
  const { cases, loading, error, refetch } = useCases();
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer]       = useState(false);
  const [patternFilter, setPatternFilter] = useState<FraudPattern | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | null>(null);
  const [sarFilter, setSarFilter]         = useState<boolean | null>(null);

  const filtered = useMemo(() => cases.filter(c => {
    if (patternFilter && c.case.pattern !== patternFilter) return false;
    if (verdictFilter && c.case.verdict !== verdictFilter) return false;
    if (sarFilter !== null && c.sar.file !== sarFilter) return false;
    return true;
  }), [cases, patternFilter, verdictFilter, sarFilter]);

  const hasFilters = patternFilter || verdictFilter || sarFilter !== null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em', marginBottom: 4 }}>
            Fraud Investigations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            TigerGraph · LangGraph · Gemini 2.0 Flash
          </p>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="nm-btn-brand"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <span style={{ fontSize: 16 }}>+</span> New Investigation
        </button>
      </div>

      {/* Stats */}
      {!loading && cases.length > 0 && <StatsRow cases={cases} />}

      {/* Filters */}
      <div className="nm-inset" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Filter</span>

        {FRAUD_PATTERNS.map(p => (
          <FilterBtn key={p} active={patternFilter === p} onClick={() => setPatternFilter(patternFilter === p ? null : p)}>
            <PatternTag pattern={p} showFull={false} />
          </FilterBtn>
        ))}

        <div style={{ width: 1, height: 20, background: 'var(--nm-shadow-dark)', opacity: 0.5, margin: '0 4px' }} />

        {VERDICTS.map(v => (
          <FilterBtn key={v} active={verdictFilter === v} onClick={() => setVerdictFilter(verdictFilter === v ? null : v)}>
            <VerdictBadge verdict={v} size="sm" />
          </FilterBtn>
        ))}

        <div style={{ width: 1, height: 20, background: 'var(--nm-shadow-dark)', opacity: 0.5, margin: '0 4px' }} />

        <FilterBtn active={sarFilter === true} onClick={() => setSarFilter(sarFilter === true ? null : true)} danger>
          <span style={{ fontSize: 11, fontWeight: 700, color: sarFilter ? 'var(--color-risk-high)' : 'var(--color-text-secondary)' }}>⚑ SAR Required</span>
        </FilterBtn>

        {hasFilters && (
          <button onClick={() => { setPatternFilter(null); setVerdictFilter(null); setSarFilter(null); }}
            style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Clear all
          </button>
        )}

        {!loading && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {filtered.length} / {cases.length}
          </span>
        )}
      </div>

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
