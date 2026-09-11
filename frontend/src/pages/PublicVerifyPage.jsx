import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle, AlertTriangle, Building, Zap, Calendar, User, ExternalLink, RefreshCw, Lock } from 'lucide-react';
import { fetchPublicVerification } from '../api/client';

export default function PublicVerifyPage() {
  const { recId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (recId) {
      loadPublicVerify();
    }
  }, [recId]);

  const loadPublicVerify = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPublicVerification(recId);
      setData(result);
    } catch (err) {
      setError(err.message || 'Certificate not found or invalid ID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 shadow-xl shadow-sky-500/20 mb-2">
            <Shield className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">RECShield Public Portal</h1>
          <p className="text-xs text-slate-400">Green Energy Certificate Authenticity Inspector</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-6 space-y-6 border-slate-800 shadow-2xl">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-sm font-semibold">Verifying cryptographic hash signature...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-3">
              <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Certificate Search Error</h3>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Authenticity Badge Banner */}
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                data.valid 
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                {data.valid ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    {data.valid ? 'AUTHENTIC & VERIFIED CERTIFICATE' : 'RISK WARNING FLAG'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono">
                    REC ID: <span className="font-bold text-white">{data.rec_id}</span>
                  </p>
                </div>
              </div>

              {/* Certificate Telemetry Details */}
              <div className="space-y-3 divide-y divide-slate-800/80 text-xs">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Building className="w-3.5 h-3.5 text-sky-400" /> Solar Plant Asset</span>
                  <span className="font-semibold text-white">{data.plant_name}</span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Plant Capacity</span>
                  <span className="font-mono text-amber-300 font-bold">{data.capacity_kw.toLocaleString()} kW</span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-emerald-400" /> Certified Volume</span>
                  <span className="font-mono text-emerald-400 font-bold">{data.energy_mwh.toLocaleString()} MWh</span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-cyan-400" /> Generation Period</span>
                  <span className="text-slate-200">{data.period_start} to {data.period_end}</span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-purple-400" /> Registered Holder</span>
                  <span className="font-semibold text-purple-300">{data.holder}</span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-sky-400" /> Risk Evaluation Band</span>
                  <span className="uppercase font-bold text-sky-400 font-mono">{data.risk_band || 'unverified'}</span>
                </div>
              </div>

              {/* AI Explanation Summary */}
              {data.explanation && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-sky-400 uppercase tracking-wider block text-[10px]">AI Verification Report Narrative</span>
                  <p className="leading-relaxed">{data.explanation}</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer link */}
        <div className="text-center">
          <Link to="/" className="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1">
            Access Full RECShield Auditor Dashboard <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
