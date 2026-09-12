import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Zap, Gauge, FileCheck2, ScanSearch, TrendingUp,
  Copy, Ghost, GaugeCircle, Repeat, ArrowRight, CheckCircle2,
  AlertTriangle, Network, Lock, Database, Users, Building2,
  ShieldAlert, ScanLine,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

const FLOW_NODES = [
  { label: 'Plant', icon: Zap },
  { label: 'Generation', icon: Gauge },
  { label: 'Meter Reading', icon: GaugeCircle },
  { label: 'REC Issued', icon: FileCheck2 },
  { label: 'Verification Engine', icon: ScanSearch },
  { label: 'Risk Score', icon: ShieldAlert },
];

const FRAUD_TYPES = [
  { icon: Copy, title: 'Double counting', body: 'The same generation event certified twice, across registries or time windows, and sold as two separate certificates.' },
  { icon: Ghost, title: 'Phantom generation', body: 'Certificates issued for energy that a physically-implausible plant capacity could never have produced.' },
  { icon: GaugeCircle, title: 'Meter tampering', body: 'Readings inconsistent with a plant’s own history, or that jump in ways no real generation curve does.' },
  { icon: Repeat, title: 'Wash trading', body: 'Certificates cycled between related holders to manufacture liquidity or launder a flagged credential.' },
];

const WORKFLOW_STEPS = [
  { step: '01', title: 'Ingest', body: 'Plant and meter data lands through the Data Hub, validated against real generation, capacity and timestamp constraints.' },
  { step: '02', title: 'Score', body: 'Five independent checks — physics plausibility, duplication, meter anomaly, ledger integrity, network pattern — produce one 0–100 risk score.' },
  { step: '03', title: 'Investigate', body: 'Auditors work a prioritized queue: the provenance graph, the SHA-256 ledger and every check’s evidence sit one click from any certificate.' },
  { step: '04', title: 'Verify', body: 'A clean certificate carries a public, QR-scannable verification record — no account needed to check it.' },
];

const ROLES = [
  { icon: Building2, title: 'Registry Admin', body: 'Full oversight: manages users, roles and the certificate registry end to end.' },
  { icon: ScanSearch, title: 'Auditor & Regulator', body: 'Works the fraud queue, reads the provenance graph, and takes action on flagged certificates.' },
  { icon: Zap, title: 'Plant Operator', body: 'Submits generation data and tracks the certificates issued against their own plant.' },
  { icon: FileCheck2, title: 'Buyer', body: 'Browses the marketplace and acquires verified RECs, each one re-checked on transfer.' },
];

const CHECKS = [
  { label: 'Physics plausibility', status: 'fail', detail: 'Declared output exceeds plant’s rated capacity for the period.' },
  { label: 'Duplicate detection', status: 'fail', detail: 'Matches a generation window already certified under a different REC.' },
  { label: 'Meter anomaly', status: 'warn', detail: 'Reading deviates from the plant’s 90-day median beyond tolerance.' },
  { label: 'Ledger integrity', status: 'pass', detail: 'Hash chain intact — no tampering detected in the record history.' },
  { label: 'Network pattern', status: 'warn', detail: 'Holder involved in two prior flagged transfers.' },
];

const STACK = ['FastAPI', 'PostgreSQL', 'SHA-256 Ledger', 'React', 'Supabase Auth'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
              <ShieldCheck className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-tight">RECShield</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--text-secondary)]">
            <a href="#problem" className="hover:text-[var(--text-primary)] transition-colors">The problem</a>
            <a href="#how-it-works" className="hover:text-[var(--text-primary)] transition-colors">How it works</a>
            <a href="#roles" className="hover:text-[var(--text-primary)] transition-colors">Who it's for</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost px-3.5 py-2 text-sm">Sign in</Link>
            <Link to="/login?mode=signup" className="btn btn-primary px-3.5 py-2 text-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <span className="badge-info inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5">
              <Lock className="w-3 h-3" /> Certificate integrity, verified on-chain of custody
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.1]" style={{ textWrap: 'balance' }}>
              Stop renewable energy fraud before it reaches the grid.
            </h1>
            <p className="text-base text-[var(--text-secondary)] mt-5 max-w-lg leading-relaxed">
              RECShield scores every Renewable Energy Certificate against physics plausibility,
              duplication, meter tampering and wash trading &mdash; then gives auditors a
              tamper-evident ledger and provenance graph to act on what it finds.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <Link to="/login?mode=signup" className="btn btn-primary px-5 py-2.5 text-sm">
                Get started <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works" className="btn btn-secondary px-5 py-2.5 text-sm">
                See how it works
              </a>
            </div>
            <div className="flex items-center gap-5 mt-8 text-xs text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--risk-genuine)]" /> SHA-256 hash-chained ledger</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--risk-genuine)]" /> Public QR verification</span>
            </div>
          </motion.div>

          {/* Flow visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="card p-6 lg:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-5">Every certificate's path</p>
            <div className="flex flex-col gap-0">
              {FLOW_NODES.map((node, i) => {
                const Icon = node.icon;
                const isLast = i === FLOW_NODES.length - 1;
                return (
                  <div key={node.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.12, duration: 0.35 }}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isLast ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.div>
                      {!isLast && (
                        <motion.div
                          initial={{ scaleY: 0 }}
                          whileInView={{ scaleY: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.12, duration: 0.3 }}
                          style={{ transformOrigin: 'top' }}
                          className="w-px flex-1 min-h-[18px] bg-[var(--border-strong)]"
                        />
                      )}
                    </div>
                    <div className={isLast ? 'pb-0' : 'pb-4'}>
                      <p className={`text-sm font-semibold pt-1.5 ${isLast ? 'text-[var(--brand)]' : 'text-[var(--text-primary)]'}`}>{node.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem section */}
      <section id="problem" className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <Reveal className="max-w-xl mb-10">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">The problem</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-2" style={{ textWrap: 'balance' }}>
            REC fraud is quiet, and registries weren't built to catch it.
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed">
            A certificate registry records what was submitted &mdash; it doesn't ask whether the
            physics behind it hold up. That gap is where four fraud patterns live.
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4">
          {FRAUD_TYPES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="card p-5 h-full">
                <div className="w-9 h-9 rounded-lg bg-[#fef3f2] text-[var(--risk-fraud)] flex items-center justify-center mb-3">
                  <f.icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{f.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <Reveal className="max-w-xl mb-10">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">How it works</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-2" style={{ textWrap: 'balance' }}>
            From raw meter data to a defensible verdict.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 0.06}>
              <div className="card p-5 h-full">
                <span className="text-2xl font-extrabold text-[var(--border-strong)] tabular-nums">{s.step}</span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mt-2">{s.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Risk score demo */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Risk scoring</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-2" style={{ textWrap: 'balance' }}>
              One score, five checks, no black box.
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed max-w-md">
              Every certificate carries a 0&ndash;100 score built from checks an auditor can open
              and read individually &mdash; never a single opaque number with no evidence behind it.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--risk-genuine)]" /> Genuine &middot; 0&ndash;30</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--risk-suspicious)]" /> Suspicious &middot; 31&ndash;60</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--risk-high)]" /> High risk &middot; 61&ndash;80</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--risk-fraud)]" /> Likely fraud &middot; 81&ndash;100</span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Sample assessment &middot; REC-2026-04812</p>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-[var(--risk-fraud)] tabular-nums">91</span>
                <span className="text-sm text-[var(--text-tertiary)]">/ 100</span>
                <span className="badge-likely_fraud ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase">
                  <ShieldAlert className="w-3.5 h-3.5" /> Likely fraud
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {CHECKS.map((c) => (
                  <div key={c.label} className="flex items-start gap-3">
                    {c.status === 'pass' ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--risk-genuine)] shrink-0 mt-0.5" />
                    ) : c.status === 'warn' ? (
                      <AlertTriangle className="w-4 h-4 text-[var(--risk-suspicious)] shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-[var(--risk-fraud)] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{c.label}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Provenance + ledger */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 gap-4">
          <Reveal>
            <div className="card p-6 h-full">
              <div className="w-9 h-9 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] flex items-center justify-center mb-3">
                <Network className="w-4 h-4 text-[var(--brand)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Provenance graph</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed max-w-sm">
                Every plant, meter, certificate and holder as one connected graph &mdash; wash
                trading and shared-actor patterns that a flat table hides become visible at a glance.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="card p-6 h-full">
              <div className="w-9 h-9 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] flex items-center justify-center mb-3">
                <Lock className="w-4 h-4 text-[var(--brand)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">SHA-256 hash-chained ledger</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed max-w-sm">
                Every state change is appended to a hash-chained record. Alter one entry and the
                chain breaks visibly &mdash; integrity is checkable, not assumed.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <Reveal className="max-w-xl mb-10">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Who it's for</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-2" style={{ textWrap: 'balance' }}>
            One platform, scoped to each role.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.06}>
              <div className="card p-5 h-full">
                <div className="w-9 h-9 rounded-lg bg-[#e7f6ef] text-[var(--brand)] flex items-center justify-center mb-3">
                  <r.icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{r.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{r.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <Reveal className="card p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Built on</span>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md leading-relaxed">
              A FastAPI + PostgreSQL engine, a SHA-256 hash-chained audit ledger, and Supabase-backed
              authentication with row-level role scoping.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span key={s} className="badge-neutral inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold">{s}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 pb-20">
        <Reveal>
          <div className="rounded-2xl bg-[var(--brand)] px-8 py-14 text-center flex flex-col items-center">
            <ScanLine className="w-9 h-9 text-white/80 mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight max-w-lg" style={{ textWrap: 'balance' }}>
              Bring certificate integrity to your registry.
            </h2>
            <p className="text-sm text-white/80 mt-3 max-w-md">
              Set up a Registry Admin account and start scoring certificates against real risk checks today.
            </p>
            <Link to="/login?mode=signup" className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[var(--brand)] text-sm font-semibold hover:bg-white/90 transition-colors">
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-4 lg:px-8">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-tertiary)]">
          <span>RECShield Platform &copy; 2026. Renewable Energy Certificate Fraud Auditing System.</span>
          <span className="font-mono">FastAPI Engine + React + SHA-256 Ledger</span>
        </div>
      </footer>
    </div>
  );
}
