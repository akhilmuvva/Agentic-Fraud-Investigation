/**
 * src/App.tsx — Neumorphic shell
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CaseListPage } from './pages/CaseListPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { HealthIndicator } from './components/HealthIndicator';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
  >
    {children}
  </motion.div>
);

const Header: React.FC<{ dark: boolean; onToggleDark: () => void }> = ({ dark, onToggleDark }) => (
  <header
    className="sticky top-0 z-40"
    style={{
      background: 'var(--nm-bg)',
      boxShadow: '0 4px 16px var(--nm-shadow-dark), 0 -2px 8px var(--nm-shadow-light)',
    }}
  >
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 45%, #6366F1 100%)',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 15,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>TG</div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 16.5, color: 'var(--color-text)', letterSpacing: '-0.025em' }}>
            Fraud Investigation
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 1, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            TigerGraph · LangGraph · Gemini
          </div>
        </div>
      </Link>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <HealthIndicator />
        <motion.button
          onClick={onToggleDark}
          className="nm-btn"
          whileHover={{ scale: 1.05, boxShadow: 'var(--shadow-nm-lg)' }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{
            width: 40, height: 40, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, borderRadius: 12, cursor: 'pointer',
            border: '1px solid transparent',
          }}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? '☀' : '🌙'}
        </motion.button>
      </div>
    </div>
  </header>
);

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><CaseListPage /></PageTransition>} />
        <Route path="/cases/:caseId" element={<PageTransition><CaseDetailPage /></PageTransition>} />
        <Route path="*" element={
          <PageTransition>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
              <div className="nm-xl" style={{ padding: '60px 40px', display: 'inline-block' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🗺</div>
                <h2 style={{ fontSize: 22, color: 'var(--color-text)', marginBottom: 8 }}>Page Not Found</h2>
                <Link to="/" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontSize: 13 }}>← Back to dashboard</Link>
              </div>
            </div>
          </PageTransition>
        } />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: 'var(--nm-bg)' }}>
        <Header dark={dark} onToggleDark={() => setDark(d => !d)} />
        <main style={{ paddingBottom: 60 }}>
          <AnimatedRoutes />
        </main>
        <footer style={{ padding: '24px', textAlign: 'center' }}>
          <div className="nm-flat" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 20 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              TigerGraph Agentic Fraud Investigation · Read-only UI · All mutations via auditable FastAPI layer
            </span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
