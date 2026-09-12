import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, CheckCircle, AlertTriangle, AlertCircle, Sparkles,
  RotateCw, Flag, Check, ChevronDown, ChevronUp, FileText, QrCode,
  ExternalLink, Lock, History, User, Building, Calendar, Zap, Activity, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchRecDetail, verifyRec, submitAuditAction, fetchRecReport, assignBuyer } from '../../api/client';
import { useAuth } from '../../lib/AuthContext';
import { canTakeAuditActions, canViewOversightTools } from '../../lib/permissions';
import { Link } from 'react-router-dom';
import RiskBadge from '../ui/RiskBadge';
import BrandShieldIcon from '../ui/BrandShieldIcon';

export default function RecDetailModal({ recId, onClose, onActionSuccess }) {
  // RS-16: once Supabase Auth is configured, the signed-in email is who acted - no free-text
  // name to spoof. Before that (authEnabled === false), fall back to the old manual field so
  // the app still works without Supabase wired up.
  const { enabled: authEnabled, user, role } = useAuth();
  // RS-21 (§9.5): registry_admin/auditor only - the backend already 403s these calls for
  // regulator/plant_operator/buyer, so hide the controls rather than let them click into an error.
  const canAct = canTakeAuditActions(role);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  // RS-23: links this REC to a buyer's own account (separate from the free-text `holder`
  // display name) so it shows up in that buyer's scoped dashboard/REC Explorer.
  const [buyerEmailInput, setBuyerEmailInput] = useState('');
  const [assigningBuyer, setAssigningBuyer] = useState(false);
  const [buyerAssignError, setBuyerAssignError] = useState('');

  // Auditor Action Form state (auditorName only used when authEnabled is false)
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

  const handleAssignBuyer = async () => {
    if (!buyerEmailInput.trim()) return;
    try {
      setAssigningBuyer(true);
      setBuyerAssignError('');
      await assignBuyer(recId, buyerEmailInput.trim());
      setBuyerEmailInput('');
      await loadDetail();
    } catch (err) {
      setBuyerAssignError(err.message || 'Failed to assign buyer');
    } finally {
      setAssigningBuyer(false);
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
    if (authEnabled && !user) {
      setActionError('Your session has expired - please sign in again.');
      return;
    }
    if (!authEnabled && !auditorName.trim()) {
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
      // The backend derives the auditor from the session token (attached by api/client.js)
      // whenever authEnabled - `auditor` here is only read as a fallback when it's not.
      await submitAuditAction(recId, { action: actionType, auditor: authEnabled ? undefined : auditorName, note: actionNote || null });
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

  // Backend CheckStatus is pass | warn | fail (report §6: below 40 / 40-79 / 80+).
  const getCheckStatusIcon = (status) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-[var(--risk-genuine)]" />;
    if (status === 'warn') return <AlertCircle className="w-4 h-4 text-[var(--risk-suspicious)]" />;
    return <AlertTriangle className="w-4 h-4 text-[var(--risk-fraud)]" />;
  };

  if (!recId) return null;

  const secondaryBtn = 'btn btn-secondary px-3.5 py-1.5 text-xs';

  // Portaled to document.body for the same reason as UploadCertificateModal: this component is
  // mounted from several places (TopHeader, DashboardPage, RecExplorerPage), and a
  // position:fixed modal shouldn't depend on whichever ancestor happens to render it.
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--brand)] flex items-center justify-center shrink-0">
              <BrandShieldIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-mono tracking-tight">{recId}</h2>
                {detail && <RiskBadge band={detail.risk_band} score={detail.risk_score} />}
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Verification result & audit trail</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-3">
              <RotateCw className="w-7 h-7 animate-spin text-[var(--brand)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Loading verification details&hellip;</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-[#fef3f2] border border-[rgba(217,45,32,0.24)] text-[var(--risk-fraud)] text-sm">
              {error}
            </div>
          ) : detail ? (
            <>
              {/* Quick Summary Grid - plain field labels, not risk signals, so every icon here
                  is a neutral tone. Color is reserved for things that are actually suspicious
                  (the risk badge above, the check statuses below). */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)]">
                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5"><Building className="w-3 h-3" /> Solar Plant</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 truncate">{detail.plant_name}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">{detail.plant_id}</p>
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5"><Zap className="w-3 h-3" /> Certified Energy</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 font-mono tabular-nums">{detail.energy_mwh.toLocaleString()} MWh</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">{(detail.energy_mwh * 1000).toLocaleString()} kWh</p>
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Generation Period</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{detail.period_start} &rarr; {detail.period_end}</p>
                </div>

                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5"><User className="w-3 h-3" /> Current Holder</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 truncate">{detail.holder}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Status: <span className="capitalize text-[var(--text-secondary)]">{detail.status}</span></p>
                </div>
              </div>

              {/* Action Toolbar - the primary action (re-run) stays accent-colored since it's
                  the one thing worth drawing the eye to; everything else here is a neutral,
                  equal-weight secondary action. */}
              <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* RS-21 (§9.5): re-running verification is registry_admin/auditor only
                      server-side - hidden rather than left to fail with a 403 on click. */}
                  {canAct && (
                    <button
                      onClick={handleRunVerify}
                      disabled={verifying}
                      className="btn btn-primary px-3.5 py-1.5 text-xs disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                      <span>{verifying ? 'Verifying…' : 'Re-run verification'}</span>
                    </button>
                  )}

                  {canViewOversightTools(role) && (
                    <Link to={`/graph?rec_id=${detail.id}`} onClick={onClose} className={secondaryBtn}>
                      <Activity className="w-3.5 h-3.5" />
                      <span>Provenance graph</span>
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={handleDownloadReport} disabled={downloadingReport} className={`${secondaryBtn} disabled:opacity-50`}>
                    <Download className={`w-3.5 h-3.5 ${downloadingReport ? 'animate-pulse' : ''}`} />
                    <span>{downloadingReport ? 'Building PDF…' : 'Download report'}</span>
                  </button>

                  <button onClick={() => setShowQrModal(true)} className={secondaryBtn}>
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR code</span>
                  </button>

                  <Link to={`/verify/${detail.id}`} target="_blank" className={secondaryBtn}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Public portal</span>
                  </Link>
                </div>
              </div>

              {/* 5-Point Verification Risk Check Matrix - this is the "why" a reader came here
                  for: each row states what was checked, whether it passed, and the numbers
                  behind that call, expandable for the raw evidence. */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Verification checks</h3>

                {detail.verification ? (
                  <div className="space-y-2.5">
                    {detail.verification.checks.map((check) => {
                      const isExpanded = expandedCheck === check.name;
                      return (
                        <div key={check.name} className="rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] overflow-hidden transition-colors">
                          <div
                            onClick={() => setExpandedCheck(isExpanded ? null : check.name)}
                            className="flex items-center justify-between gap-3 p-3.5 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {getCheckStatusIcon(check.status)}
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{check.label}</h4>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{check.summary}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                  {check.weight === 0 ? 'Gate' : `${check.weight} pts`}
                                </span>
                                <p className="text-xs font-mono font-semibold text-[var(--text-secondary)] tabular-nums">{(check.risk * 100).toFixed(0)}/100</p>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
                            </div>
                          </div>

                          {/* Expanded JSON details */}
                          {isExpanded && check.details && (
                            <div className="p-3.5 border-t border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
                              {check.reason_code && (
                                <p className="text-[11px] mb-2">
                                  <span className="text-[var(--text-tertiary)] font-sans">reason code&nbsp;</span>
                                  <span className="text-[var(--text-secondary)]">{check.reason_code}</span>
                                </p>
                              )}
                              <p className="text-[11px] text-[var(--text-tertiary)] font-sans mb-2">Underlying numbers</p>
                              <pre className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-x-auto text-[11px] text-[var(--text-secondary)]">
                                {JSON.stringify(check.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                    <p className="text-xs text-[var(--text-tertiary)]">No verification saved yet{canAct ? ' — run it above' : ''}.</p>
                  </div>
                )}
              </div>

              {/* Explanation - the plain-English "why", one level up from the raw check list. */}
              {detail.verification && detail.verification.explanation && (
                <div className="p-4 rounded-xl bg-[rgba(59,130,246,0.05)] border border-[rgba(59,130,246,0.18)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--info)]" />
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">Why this score</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-tertiary)] font-mono ml-auto">{detail.verification.explanation_source || 'engine'}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {detail.verification.explanation}
                  </p>
                </div>
              )}

              {/* Buyer Account Link (RS-23) - links this REC to a buyer's own account by email
                  so it shows up in their scoped dashboard/REC Explorer. Auditor-only, same as
                  the decision panel below. */}
              {canAct && (
                <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5 shrink-0">
                    <User className="w-3.5 h-3.5" /> Buyer account
                  </span>
                  {detail.buyer_email ? (
                    <span className="text-xs font-mono text-[var(--text-primary)]">{detail.buyer_email}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">Not linked yet</span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="email"
                      value={buyerEmailInput}
                      onChange={(e) => setBuyerEmailInput(e.target.value)}
                      placeholder="buyer@example.com"
                      className="bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none w-48"
                    />
                    <button
                      onClick={handleAssignBuyer}
                      disabled={assigningBuyer || !buyerEmailInput.trim()}
                      className="btn btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {assigningBuyer ? 'Linking...' : detail.buyer_email ? 'Reassign' : 'Link'}
                    </button>
                  </div>
                  {buyerAssignError && (
                    <p className="w-full text-xs text-[var(--risk-fraud)]">{buyerAssignError}</p>
                  )}
                </div>
              )}

              {/* Auditor Decision Panel - the "what to do next" step. RS-21 (§9.5):
                  registry_admin/auditor only - every action here is 403'd server-side for
                  other roles. Given its own filled surface since it's the one place on this
                  screen a decision actually gets made. */}
              {canAct && (
              <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)]">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Record a decision</h4>

                {actionSuccessMsg && (
                  <div className="mb-3 p-2.5 rounded-lg badge-genuine text-xs font-semibold">
                    {actionSuccessMsg}
                  </div>
                )}
                {actionError && (
                  <div className="mb-3 p-2.5 rounded-lg badge-likely_fraud text-xs font-semibold">
                    {actionError}
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">Auditor</label>
                  {authEnabled ? (
                    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[var(--brand)]" />
                      {user?.email || 'not signed in'}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none"
                      placeholder="Enter name"
                    />
                  )}
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] text-[var(--text-secondary)] font-medium mb-1">
                    Investigation Note <span className="text-[var(--text-tertiary)]">(required for everything except Approve)</span>
                  </label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    rows={2}
                    className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none resize-none"
                    placeholder="What did you find? What evidence backs this decision?"
                  />
                </div>

                {/* Report §9 Figure 3: Approve / Request Verification / Reject / Report Fraud */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleAuditSubmit('approve')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[rgba(18,183,106,0.1)] hover:bg-[rgba(18,183,106,0.18)] text-[#067647] border border-[rgba(18,183,106,0.24)] text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{submittingAction === 'approve' ? 'Submitting...' : 'Approve'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('request_verification')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[rgba(59,130,246,0.1)] hover:bg-[rgba(59,130,246,0.18)] text-[#1d4ed8] border border-[rgba(59,130,246,0.24)] text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>{submittingAction === 'request_verification' ? 'Submitting...' : 'Request Verification'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('reject')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[rgba(247,144,9,0.1)] hover:bg-[rgba(247,144,9,0.18)] text-[#b54708] border border-[rgba(247,144,9,0.24)] text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Flag className="w-4 h-4" />
                    <span>{submittingAction === 'reject' ? 'Submitting...' : 'Reject'}</span>
                  </button>

                  <button
                    onClick={() => handleAuditSubmit('report')}
                    disabled={!!submittingAction}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[rgba(217,45,32,0.12)] hover:bg-[rgba(217,45,32,0.2)] text-[#912018] border border-[rgba(217,45,32,0.28)] text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{submittingAction === 'report' ? 'Submitting...' : 'Report Fraud'}</span>
                  </button>
                </div>
              </div>
              )}

              {/* Action History */}
              {detail.actions && detail.actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <History className="w-4 h-4 text-[var(--text-tertiary)]" /> Action history
                  </h4>
                  <div className="space-y-1.5">
                    {detail.actions.map((act) => (
                      <div key={act.id} className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-xs flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-semibold text-[var(--text-primary)] capitalize">{act.action.replace('_', ' ')}</span>
                          <span className="text-[var(--text-tertiary)]"> by </span>
                          <span className="text-[var(--text-secondary)]">{act.auditor}</span>
                          {act.note && <p className="text-[var(--text-tertiary)] mt-0.5 truncate">{act.note}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-mono">{recId}</h3>
            <p className="text-xs text-[var(--text-tertiary)]">Scan with a phone camera to open the public verification page.</p>
            <div className="w-44 h-44 mx-auto bg-white p-3 rounded-lg flex items-center justify-center border border-[var(--border)]">
              <QRCodeSVG value={publicUrl} size={152} bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] font-mono break-all">{publicUrl}</p>
            {window.location.hostname === 'localhost' && (
              <p className="text-[10px] text-[var(--risk-suspicious)]">
                Points at localhost - a phone on another network can't reach it. Serve with <code className="font-mono">vite --host</code> and use your LAN IP instead.
              </p>
            )}
            <button
              onClick={() => setShowQrModal(false)}
              className="btn btn-secondary w-full py-2 text-xs justify-center"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
