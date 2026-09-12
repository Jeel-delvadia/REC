import React, { useState, useEffect } from 'react';
import { 
  X, Shield, CheckCircle, AlertTriangle, AlertCircle, Sparkles, 
  RotateCw, Flag, Check, ChevronDown, ChevronUp, FileText, QrCode,
  ExternalLink, Lock, History, User, Building, Calendar, Zap, Activity, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchRecDetail, verifyRec, submitAuditAction, fetchRecReport } from '../../api/client';
import { Link } from 'react-router-dom';

export default function RecDetailModal({ recId, onClose, onActionSuccess }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  
  // Auditor Action Form state
  const [auditorName, setAuditorName] = useState('Senior Auditor');
  const [actionNote, setActionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(null); // holds the action in flight
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionError, setActionError] = useState('');

  // Expandable state
  const [expandedCheck, setExpandedCheck] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  // RS-14: rendered client-side with qrcode.react - the frontend already knows its own origin,
  // so the QR just points at the public verify route it serves itself. No backend call needed.
  const publicUrl = recId ? `${window.location.origin}/verify/${recId}` : '';

  useEffect(() => {
    if (recId) {
      loadDetail();
    }
  }, [recId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecDetail(recId);
      setDetail(data);
    } catch (err) {
      setError(err.message || 'Failed to load REC details');
    } finally {
      setLoading(false);
    }
  };

  const handleRunVerify = async () => {
    try {
      setVerifying(true);
      await verifyRec(recId);
      await loadDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Backend ActionType is approve | reject | report | note | request_verification (schemas/common.py).
  // A note is required for every action except approve.
  const ACTION_LABELS = {
    approve: 'Approve',
    request_verification: 'Request Verification',
    reject: 'Reject',
    report: 'Report Fraud',
  };

  const handleAuditSubmit = async (actionType) => {
    if (!auditorName.trim()) {
      setActionError('Enter an auditor name first.');
      return;
    }
    if (actionType !== 'approve' && !actionNote.trim()) {
      setActionError(`A note is required to ${actionType.replace('_', ' ')} this REC.`);
      return;
    }
    try {
      setSubmittingAction(actionType);
      setActionError('');
      setActionSuccessMsg('');
      await submitAuditAction(recId, { action: actionType, auditor: auditorName, note: actionNote || null });
      setActionSuccessMsg(`Recorded: ${ACTION_LABELS[actionType]}`);
      setActionNote('');
      await loadDetail();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      setActionError(err.message || `Failed to submit ${actionType}`);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      const blob = await fetchRecReport(recId); // RS-15: PDF, via ReportLab
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${recId}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not download report: ${err.message}`);
    } finally {
      setDownloadingReport(false);
    }
  };

  // Report §6/§9: "Risk Score N/100 · LABEL".
  const BAND_META = {
    genuine: { label: 'Genuine', icon: CheckCircle, cls: 'badge-genuine' },
    suspicious: { label: 'Suspicious', icon: AlertCircle, cls: 'badge-suspicious' },
    high_risk: { label: 'High Risk', icon: AlertTriangle, cls: 'badge-high_risk' },
    likely_fraud: { label: 'Likely Fraud', icon: AlertTriangle, cls: 'badge-likely_fraud' },
  };

  const getRiskBandBadge = (band, score) => {
    const meta = BAND_META[band];
    if (!meta) return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">Not Yet Verified</span>;
    const Icon = meta.icon;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${meta.cls} flex items-center gap-1.5`}>
        <Icon className="w-3.5 h-3.5" /> Risk Score {score}/100 &middot; {meta.label}
      </span>
    );
  };

  // Backend CheckStatus is pass | warn | fail (report §6: below 40 / 40-79 / 80+).
  const getCheckStatusIcon = (status) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === 'warn') return <AlertCircle className="w-4 h-4 text-amber-400" />;
    return <AlertTriangle className="w-4 h-4 text-rose-400" />;
  };

  if (!recId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-modal-enter">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-white font-mono tracking-tight">{recId} &middot; Verification Result</h2>
                {detail && getRiskBandBadge(detail.risk_band, detail.risk_score)}
              </div>
              <p className="text-xs text-slate-400">Detailed Verification & Cryptographic Audit Trail</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RotateCw className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-sm font-medium">Analyzing REC data and running AI engine verification...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              {error}
            </div>
          ) : detail ? (
            <>
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium"><Building className="w-3 h-3 text-sky-400" /> Solar Plant</span>
                  <p className="text-sm font-bold text-white mt-0.5 truncate">{detail.plant_name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {detail.plant_id}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium"><Zap className="w-3 h-3 text-amber-400" /> Certified Energy</span>
                  <p className="text-sm font-bold text-amber-400 mt-0.5 font-mono">{detail.energy_mwh.toLocaleString()} MWh</p>
                  <p className="text-[11px] text-slate-500 font-mono">{(detail.energy_mwh * 1000).toLocaleString()} kWh</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium"><Calendar className="w-3 h-3 text-cyan-400" /> Generation Period</span>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{detail.period_start} to {detail.period_end}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium"><User className="w-3 h-3 text-purple-400" /> Current Holder</span>
                  <p className="text-sm font-semibold text-purple-300 mt-0.5 truncate">{detail.holder}</p>
                  <p className="text-[11px] text-slate-500">Status: <span className="font-semibold capitalize text-slate-300">{detail.status}</span></p>
                </div>
              </div>

              {/* Action Toolbar Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunVerify}
                    disabled={verifying}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>{verifying ? 'Running AI Engine...' : 'Re-Run Verification'}</span>
                  </button>

                  <Link
                    to={`/graph?rec_id=${detail.id}`}
                    onClick={onClose}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>View Provenance Graph</span>
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadReport}
                    disabled={downloadingReport}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 text-emerald-400 ${downloadingReport ? 'animate-pulse' : ''}`} />
                    <span>{downloadingReport ? 'Building PDF...' : 'Download Report'}</span>
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>QR Verification Code</span>
                  </button>

                  <Link
                    to={`/verify/${detail.id}`}
                    target="_blank"
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Public Portal</span>
                  </Link>
                </div>
              </div>

              {/* 5-Point Verification Risk Check Matrix */}
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" /> Verification Checks
                </h3>

                {detail.verification ? (
                  <div className="space-y-3">
                    {detail.verification.checks.map((check) => {
                      const isExpanded = expandedCheck === check.name;
                      return (
                        <div key={check.name} className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden transition-all hover:border-slate-700">
                          <div
                            onClick={() => setExpandedCheck(isExpanded ? null : check.name)}
                            className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              {getCheckStatusIcon(check.status)}
                              <div>
                                <h4 className="text-xs font-bold text-white">{check.label}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{check.summary}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                  {check.weight === 0 ? 'Gate (not weighted)' : `Weight ${check.weight} pts`}
                                </span>
                                <p className="text-xs font-mono font-bold text-slate-300">Sub-score: {(check.risk * 100).toFixed(0)}/100</p>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                          </div>

                          {/* Expanded JSON details */}
                          {isExpanded && check.details && (
                            <div className="p-3.5 bg-slate-900/90 border-t border-slate-800/80 text-xs font-mono text-slate-300">
                              {check.reason_code && (
                                <p className="text-[11px] mb-2">
                                  <span className="text-slate-500 font-sans">reason code&nbsp;</span>
                                  <span className="text-amber-400">{check.reason_code}</span>
                                </p>
                              )}
                              <p className="text-[11px] text-sky-400 font-sans font-semibold mb-2">Underlying numbers:</p>
                              <pre className="p-2.5 rounded-lg bg-slate-950 overflow-x-auto text-[11px] text-slate-300">
                                {JSON.stringify(check.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                    No verification analysis saved for this REC yet. Click "Re-Run Verification" above.
                  </div>
                )}
              </div>

              {/* AI Narrative Explanation Box */}
              {detail.verification && detail.verification.explanation && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-purple-950/20 to-slate-900 border border-sky-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider">AI Automated Audit Verdict</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Source: {detail.verification.explanation_source || 'engine'}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {detail.verification.explanation}
                  </p>
                </div>
              )}

              {/* Auditor Decision Panel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" /> Auditor Action & Compliance Review
                </h4>

                {actionSuccessMsg && (
                  <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    {actionSuccessMsg}
                  </div>
                )}
                {actionError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                    {actionError}
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-[11px] text-slate-400 font-medium mb-1">Auditor Name</label>
                  <input
                    type="text"
                    value={auditorName}
                    onChange={(e) => setAuditorName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                    placeholder="Enter name"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] text-slate-400 font-medium mb-1">
                    Investigation Note <span className="text-slate-600">(required for everything except Approve)</span>
                  </label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none resize-none"
                    placeholder="What did you find? What evidence backs this decision?"
                  />
                </div>

                {/* Report §9 Figure 3: Approve / Request Verification / Reject / Report Fraud */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleAuditSubmit('approve')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{submittingAction === 'approve' ? 'Submitting...' : 'Approve'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('request_verification')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>{submittingAction === 'request_verification' ? 'Submitting...' : 'Request Verification'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('reject')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Flag className="w-4 h-4" />
                    <span>{submittingAction === 'reject' ? 'Submitting...' : 'Reject'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('report')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{submittingAction === 'report' ? 'Submitting...' : 'Report Fraud'}</span>
                  </button>
                </div>
              </div>

              {/* Cryptographic Ledger History */}
              {detail.actions && detail.actions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-400" /> Auditor Action History
                  </h4>
                  <div className="space-y-2">
                    {detail.actions.map((act) => (
                      <div key={act.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-200 capitalize">{act.action}</span> by <span className="text-sky-400">{act.auditor}</span>
                          {act.note && <p className="text-slate-400 text-[11px] mt-0.5">{act.note}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

      </div>

      {/* QR Code SVG Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <h3 className="text-lg font-bold text-white font-mono">{recId} QR Verification</h3>
            <p className="text-xs text-slate-400">Scan this code with a mobile camera to view public verification proof.</p>
            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-xl shadow-inner flex items-center justify-center">
              <QRCodeSVG value={publicUrl} size={168} bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
            <p className="text-[10px] text-slate-500 font-mono break-all">{publicUrl}</p>
            {window.location.hostname === 'localhost' && (
              <p className="text-[10px] text-amber-400">
                This points at localhost - a phone on another network can't reach it. Serve the
                frontend with <code className="font-mono">vite --host</code> and open this page
                via your machine's LAN IP instead.
              </p>
            )}
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Close QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
