import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, AlertTriangle, ShieldAlert,
  Network, Lock, QrCode, Building2, ScanSearch, FileCheck2, Zap, Copy, Ghost,
  GaugeCircle, Repeat, Sun, Activity, Cpu, Database, Check, X, FileText, ChevronRight, RefreshCw, ExternalLink
} from 'lucide-react';
import BrandShieldIcon from '../components/ui/BrandShieldIcon';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

// 5 Core REC Fraud Problems
const PROBLEMS = [
  {
    icon: Zap,
    title: 'Inflated Generation Claims',
    body: 'Certificates issued for MWh volume far exceeding physical solar capacity or solar irradiation ceiling.',
    color: '#D92D20',
  },
  {
    icon: GaugeCircle,
    title: 'Meter Mismatch',
    body: 'Discrepancies between official utility meter logs and the claims submitted by generator owners.',
    color: '#F04438',
  },
  {
    icon: Copy,
    title: 'Duplicate Certificates',
    body: 'Multiple certificates minted against identical generation periods or overlapping timestamps.',
    color: '#F79009',
  },
  {
    icon: Repeat,
    title: 'Double Counting',
    body: 'Single energy generation event sold to multiple corporate buyers or offset registries.',
    color: '#F79009',
  },
  {
    icon: Lock,
    title: 'Record Tampering',
    body: 'Backdated registry entries or unauthorized modifications to past transfer transaction logs.',
    color: '#D92D20',
  },
];

// 5 Verification Pillars
const PILLARS = [
  {
    step: '01',
    name: 'Physical Verification',
    tech: 'pvlib + Open-Meteo',
    desc: 'Compares metered energy with satellite-derived solar irradiance to enforce physical generation limits.',
  },
  {
    step: '02',
    name: 'AI Anomaly Detection',
    tech: 'Isolation Forest ML',
    desc: 'Detects unusual daily capacity factors and performance ratios across solar asset fleets.',
  },
  {
    step: '03',
    name: 'Duplicate Fingerprinting',
    tech: 'SHA-256 Hashing',
    desc: 'Matches generation period timestamps and meter signatures to prevent multi-registry minting.',
  },
  {
    step: '04',
    name: 'Provenance Graph Analysis',
    tech: 'NetworkX Graph Engine',
    desc: 'Scans ownership transfer chains to detect wash trading, rapid flipping, and circular resales.',
  },
  {
    step: '05',
    name: 'Cryptographic Hash Ledger',
    tech: 'SHA-256 Chain',
    desc: 'Immutably links every issuance and transfer event into an unalterable, tamper-evident audit record.',
  },
];

// 5 Auditor Workflow Steps
const WORKFLOW = [
  { step: '1', label: 'Detect', desc: 'Automated 5-check engine scans incoming generation & certificate streams for anomalies.' },
  { step: '2', label: 'Explain', desc: 'AI narrative synthesis explains physical, statistical, and ledger discrepancies in clear prose.' },
  { step: '3', label: 'Investigate', desc: 'Auditor inspects ownership graphs, satellite solar irradiance logs, and meter data.' },
  { step: '4', label: 'Respond', desc: 'Auditor executes binding actions: Approve, Request Verification, Reject, or Report Fraud.' },
  { step: '5', label: 'Record', desc: 'All decisions and SHA-256 block hashes are recorded on the immutable verification ledger.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('physics');

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans antialiased selection:bg-[#087F5B] selection:text-white">
      
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-[#F7F9FC]/90 backdrop-blur-md border-b border-[#E6EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E6EAF0] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <BrandShieldIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-[#172033] tracking-tight">REC<span className="text-[#087F5B]">Shield</span></span>
              <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#087F5B]/10 text-[#087F5B] border border-[#087F5B]/20">
                Enterprise AI
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#667085]">
            <a href="#verification-pipeline" className="hover:text-[#172033] transition-colors">Verification Engine</a>
            <a href="#problems" className="hover:text-[#172033] transition-colors">Fraud Detection</a>
            <a href="#risk-demo" className="hover:text-[#172033] transition-colors">Risk Score Demo</a>
            <a href="#workflow" className="hover:text-[#172033] transition-colors">Auditor Workflow</a>
            <a href="#technology" className="hover:text-[#172033] transition-colors">Tech Stack</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link to="/verify/REC-00421" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg text-[#172033] bg-white border border-[#E6EAF0] hover:bg-[#F7F9FC] transition-all shadow-xs">
              <QrCode className="w-3.5 h-3.5 text-[#087F5B]" />
              <span>Verify a REC</span>
            </Link>

            <Link to="/dashboard" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg text-white bg-[#087F5B] hover:bg-[#066a4c] transition-all shadow-sm shadow-[#087F5B]/20">
              <span>Explore Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            {/* Pill Tag */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E6EAF0] text-xs font-semibold text-[#087F5B] shadow-xs"
            >
              <BrandShieldIcon className="w-4 h-4" />
              <span>AI Verification Infrastructure for Renewable Energy Certificates</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#172033] tracking-tight leading-[1.05]"
            >
              Verify the energy. <br className="hidden sm:inline" />
              <span className="text-[#087F5B]">Trust the certificate.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto"
            >
              RECShield cross-evaluates every certificate against satellite solar irradiance physics, utility meter logs, Isolation Forest ML models, and SHA-256 hash-chained ownership ledgers.
            </motion.p>

            {/* Action Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-4 pt-2"
            >
              <Link to="/dashboard" className="px-6 py-3.5 rounded-xl bg-[#087F5B] hover:bg-[#066a4c] text-white font-bold text-sm flex items-center gap-2.5 shadow-md shadow-[#087F5B]/25 transition-all">
                <span>Explore Auditor Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link to="/verify/REC-00421" className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#F7F9FC] text-[#172033] font-bold text-sm border border-[#E6EAF0] flex items-center gap-2 shadow-xs transition-all">
                <QrCode className="w-4 h-4 text-[#087F5B]" />
                <span>Verify a REC (Public Scan)</span>
              </Link>
            </motion.div>
          </div>

          {/* Animated Verification Pipeline Visualization */}
          <div id="verification-pipeline" className="mt-16 max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6EAF0] pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#172033] uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#087F5B]" /> Live REC Telemetry & AI Verification Pipeline
                  </h3>
                  <p className="text-xs text-[#667085] mt-0.5">End-to-end data flow from physical PV panel generation to cryptographic ledger audit</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#12B76A] animate-ping" />
                  <span className="text-[11px] font-mono text-[#087F5B] font-bold">Engine Active</span>
                </div>
              </div>

              {/* Pipeline Nodes Flow */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative">
                
                {/* Node 1: Plant */}
                <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl p-3.5 text-center space-y-2 relative group hover:border-[#087F5B] transition-colors">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] font-semibold uppercase block">Asset</span>
                    <span className="text-xs font-bold text-[#172033] block truncate">Solar Plant</span>
                    <span className="text-[10px] font-mono text-sky-700 font-semibold">5,000 kW</span>
                  </div>
                </div>

                {/* Node 2: Generation */}
                <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl p-3.5 text-center space-y-2 relative group hover:border-[#087F5B] transition-colors">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] font-semibold uppercase block">Satellite</span>
                    <span className="text-xs font-bold text-[#172033] block truncate">PV Solar kWh</span>
                    <span className="text-[10px] font-mono text-amber-700 font-semibold">6.5 kWh/m²</span>
                  </div>
                </div>

                {/* Node 3: Meter */}
                <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl p-3.5 text-center space-y-2 relative group hover:border-[#087F5B] transition-colors">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-teal-50 text-[#087F5B] flex items-center justify-center">
                    <GaugeCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] font-semibold uppercase block">Telemetry</span>
                    <span className="text-xs font-bold text-[#172033] block truncate">Utility Meter</span>
                    <span className="text-[10px] font-mono text-[#087F5B] font-semibold">72 MWh Meter</span>
                  </div>
                </div>

                {/* Node 4: REC */}
                <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl p-3.5 text-center space-y-2 relative group hover:border-[#087F5B] transition-colors">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] font-semibold uppercase block">Certificate</span>
                    <span className="text-xs font-bold text-[#172033] block truncate">Issued REC</span>
                    <span className="text-[10px] font-mono text-purple-700 font-semibold">180 MWh Claim</span>
                  </div>
                </div>

                {/* Node 5: AI Engine */}
                <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl p-3.5 text-center space-y-2 relative group hover:border-[#087F5B] transition-colors">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] font-semibold uppercase block">AI Suite</span>
                    <span className="text-xs font-bold text-[#172033] block truncate">Audit Engine</span>
                    <span className="text-[10px] font-mono text-indigo-700 font-semibold">5 Vectors</span>
                  </div>
                </div>

                {/* Node 6: Risk Score Result */}
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-center space-y-2">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                    91
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-600 font-semibold uppercase block">Verdict</span>
                    <span className="text-xs font-extrabold text-[#D92D20] block">LIKELY FRAUD</span>
                    <span className="text-[10px] font-mono text-rose-700 font-bold">Score 91/100</span>
                  </div>
                </div>

              </div>

            </motion.div>
          </div>

        </div>
      </section>

      {/* Problem Section */}
      <section id="problems" className="py-20 bg-white border-y border-[#E6EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <Reveal className="max-w-3xl mx-auto text-center space-y-3 mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#D92D20]">The Registry Integrity Gap</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172033] tracking-tight">
              "A certificate can exist without the generation being trustworthy."
            </h2>
            <p className="text-sm text-[#667085]">
              Traditional registries track certificate ownership, but fail to verify whether physical solar assets produced the claimed power.
            </p>
          </Reveal>

          {/* 5 Problem Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PROBLEMS.map((prob, idx) => {
              const Icon = prob.icon;
              return (
                <Reveal key={prob.title} delay={idx * 0.05} className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-2xl p-5 space-y-3 hover:border-slate-400 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E6EAF0] flex items-center justify-center shadow-xs" style={{ color: prob.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172033]">{prob.title}</h3>
                  <p className="text-xs text-[#667085] leading-relaxed">{prob.body}</p>
                </Reveal>
              );
            })}
          </div>

        </div>
      </section>

      {/* How RECShield Works - 5 Pillars */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <Reveal className="max-w-2xl mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">Core Verification Architecture</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172033] tracking-tight mt-2">
              How RECShield Engine Operates
            </h2>
            <p className="text-sm text-[#667085] mt-1">
              Cross-evaluating physical, statistical, and cryptographic telemetry in real-time.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {PILLARS.map((pil, idx) => (
              <Reveal key={pil.name} delay={idx * 0.05} className="bg-white border border-[#E6EAF0] rounded-2xl p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold text-[#087F5B] font-mono">{pil.step}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#087F5B]/10 text-[#087F5B]">{pil.tech}</span>
                </div>
                <h3 className="text-sm font-bold text-[#172033]">{pil.name}</h3>
                <p className="text-xs text-[#667085] leading-relaxed">{pil.desc}</p>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* Live Risk Score Demonstration */}
      <section id="risk-demo" className="py-20 bg-white border-y border-[#E6EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Narrative */}
            <Reveal className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-[#D92D20]">
                <ShieldAlert className="w-4 h-4 text-[#D92D20]" />
                <span>Forensic Fraud Score Engine</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172033] tracking-tight">
                Explainable 0–100 Fraud Risk Scoring
              </h2>
              
              <p className="text-sm text-[#667085] leading-relaxed">
                RECShield does not output black-box predictions. Every certificate receives a transparent 5-vector audit card comparing claimed energy against actual physical satellite irradiance and utility meter logs.
              </p>

              <div className="space-y-3 text-xs font-medium text-[#172033]">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Physics limit checking with pvlib satellite irradiance</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Isolation Forest machine learning meter anomaly detection</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Immutable SHA-256 hash chain audit trail verification</span>
                </div>
              </div>

              <div className="pt-2">
                <Link to="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#087F5B] text-white font-bold text-xs hover:bg-[#066a4c] transition-colors shadow-sm">
                  <span>Inspect Live Audit Queue</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>

            {/* Right: Demo Risk Card (91/100 LIKELY FRAUD) */}
            <Reveal delay={0.15}>
              <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E6EAF0]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#667085]">REC-00421</span>
                    <h4 className="text-sm font-bold text-[#172033]">Charanka Block B • Solar PV</h4>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-[#D92D20] border border-rose-200">
                    91 / 100 LIKELY FRAUD
                  </span>
                </div>

                {/* Checks status list */}
                <div className="space-y-2.5 text-xs font-semibold">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6EAF0]">
                    <span className="flex items-center gap-2 text-[#172033]"><X className="w-4 h-4 text-[#D92D20]" /> Physics Verification</span>
                    <span className="px-2.5 py-0.5 rounded bg-rose-100 text-[#D92D20] font-mono text-[11px] font-bold">FAILED (2.4x)</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6EAF0]">
                    <span className="flex items-center gap-2 text-[#172033]"><X className="w-4 h-4 text-[#D92D20]" /> Meter Match</span>
                    <span className="px-2.5 py-0.5 rounded bg-rose-100 text-[#D92D20] font-mono text-[11px] font-bold">FAILED (2.5x)</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6EAF0]">
                    <span className="flex items-center gap-2 text-[#172033]"><X className="w-4 h-4 text-[#D92D20]" /> Duplicate Check</span>
                    <span className="px-2.5 py-0.5 rounded bg-rose-100 text-[#D92D20] font-mono text-[11px] font-bold">FAILED (Overlap)</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6EAF0]">
                    <span className="flex items-center gap-2 text-[#172033]"><AlertTriangle className="w-4 h-4 text-[#F79009]" /> Historical Pattern</span>
                    <span className="px-2.5 py-0.5 rounded bg-amber-100 text-[#B54708] font-mono text-[11px] font-bold">WARNING</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6EAF0]">
                    <span className="flex items-center gap-2 text-[#172033]"><Check className="w-4 h-4 text-[#12B76A]" /> Ledger Integrity</span>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-[#067647] font-mono text-[11px] font-bold">INTACT</span>
                  </div>
                </div>

                {/* Evidence summary */}
                <div className="p-3.5 rounded-xl bg-white border border-[#E6EAF0] text-xs text-[#667085] space-y-1 font-mono">
                  <span className="font-bold text-[#172033] uppercase text-[10px]">Evidence Telemetry Comparison:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>Claimed: <span className="text-[#D92D20] font-bold">180 MWh</span></div>
                    <div>Expected: <span className="text-[#172033] font-bold">74 MWh</span></div>
                    <div>Metered: <span className="text-[#172033] font-bold">72 MWh</span></div>
                    <div>Ceiling: <span className="text-[#172033] font-bold">100 MWh</span></div>
                  </div>
                </div>

              </div>
            </Reveal>

          </div>

        </div>
      </section>

      {/* Auditor Workflow */}
      <section id="workflow" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <Reveal className="max-w-2xl mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">Operational Execution</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172033] tracking-tight mt-2">
              The 5-Step Auditor Workflow
            </h2>
            <p className="text-sm text-[#667085] mt-1">
              Standardized, defensible investigation pipeline for registry compliance officers.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {WORKFLOW.map((wf, idx) => (
              <Reveal key={wf.step} delay={idx * 0.05} className="bg-white border border-[#E6EAF0] rounded-2xl p-5 space-y-2 shadow-xs">
                <span className="w-7 h-7 rounded-full bg-[#087F5B] text-white font-extrabold text-xs flex items-center justify-center font-mono">
                  {wf.step}
                </span>
                <h3 className="text-sm font-extrabold text-[#172033]">{wf.label}</h3>
                <p className="text-xs text-[#667085] leading-relaxed">{wf.desc}</p>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="py-16 bg-white border-y border-[#E6EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#087F5B]">Enterprise Stack</span>
          <h2 className="text-2xl font-extrabold text-[#172033]">Powered by Industry Standard Open Energy Libraries</h2>
          
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
            {['pvlib solar', 'Open-Meteo API', 'Isolation Forest ML', 'SHA-256 Hash Chain', 'FastAPI Engine', 'PostgreSQL / SQLite', 'React + Vite'].map((tech) => (
              <span key={tech} className="px-4 py-2 rounded-full bg-[#F7F9FC] border border-[#E6EAF0] text-xs font-bold text-[#172033] shadow-xs">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="bg-[#087F5B] text-white rounded-3xl p-8 sm:p-14 text-center space-y-6 shadow-lg shadow-[#087F5B]/20">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto">
              <BrandShieldIcon className="w-11 h-11" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto">
              "Don't just verify the certificate. Verify the generation behind it."
            </h2>
            <p className="text-sm text-white/80 max-w-xl mx-auto leading-relaxed">
              Equip your registry and auditors with physical solar telemetry verification, AI anomaly detection, and cryptographic hash chain protection.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link to="/dashboard" className="px-6 py-3 rounded-xl bg-white text-[#087F5B] font-extrabold text-sm hover:bg-white/90 transition-colors shadow-sm">
                Explore Auditor Dashboard
              </Link>
              <Link to="/verify/REC-00421" className="px-6 py-3 rounded-xl bg-[#066a4c] text-white font-bold text-sm hover:bg-[#05573e] transition-colors border border-white/20">
                Scan QR Verification
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E6EAF0] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#667085]">
          <div className="flex items-center gap-2">
            <BrandShieldIcon className="w-4 h-4" />
            <span className="font-bold text-[#172033]">RECShield Platform</span>
            <span>&copy; 2026 Renewable Energy Certificate Fraud Auditing Infrastructure.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <Link to="/dashboard" className="hover:text-[#172033]">Dashboard</Link>
            <Link to="/verify/REC-00421" className="hover:text-[#172033]">Public Verify</Link>
            <span className="text-[#087F5B] font-bold">SHA-256 Ledger Verified</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
