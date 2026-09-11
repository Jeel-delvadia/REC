import React, { useState, useEffect } from 'react';
import { X, Upload, PlusCircle, Building, Calendar, Zap, User, FileText, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { fetchPlants, createRec } from '../../api/client';

export default function UploadCertificateModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'csv'
  const [plants, setPlants] = useState([]);
  const [loadingPlants, setLoadingPlants] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [customRecId, setCustomRecId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-07-01');
  const [periodEnd, setPeriodEnd] = useState('2026-07-15');
  const [energyMwh, setEnergyMwh] = useState('250.0');
  const [holder, setHolder] = useState('Acme Sustainability Offsets');

  // CSV Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);

  useEffect(() => {
    loadPlants();
  }, []);

  const loadPlants = async () => {
    try {
      setLoadingPlants(true);
      const data = await fetchPlants();
      setPlants(data || []);
      if (data && data.length > 0) {
        setPlantId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load plants:', err);
    } finally {
      setLoadingPlants(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!plantId) {
      alert('Please select a plant');
      return;
    }
    if (!periodStart || !periodEnd) {
      alert('Please select generation period dates');
      return;
    }
    if (!energyMwh || parseFloat(energyMwh) <= 0) {
      alert('Please enter valid energy in MWh');
      return;
    }
    if (!holder.trim()) {
      alert('Please enter certificate holder name');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const created = await createRec({
        id: customRecId.trim() || undefined,
        plant_id: plantId,
        period_start: periodStart,
        period_end: periodEnd,
        energy_mwh: parseFloat(energyMwh),
        holder: holder.trim(),
      });

      if (onSuccess) {
        onSuccess(created.id);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue and verify REC certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const headers = lines[0].split(',');
          const rows = lines.slice(1, 6).map(l => {
            const vals = l.split(',');
            return headers.reduce((acc, h, i) => {
              acc[h.trim()] = vals[i] ? vals[i].trim() : '';
              return acc;
            }, {});
          });
          setCsvPreview(rows);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile || csvPreview.length === 0) {
      alert('Please upload a valid CSV file');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      // Issue preview rows sequentially
      let lastCreatedId = null;
      for (const row of csvPreview) {
        if (row.plant_id && row.period_start && row.period_end && row.energy_mwh && row.holder) {
          const created = await createRec({
            id: row.id || undefined,
            plant_id: row.plant_id,
            period_start: row.period_start,
            period_end: row.period_end,
            energy_mwh: parseFloat(row.energy_mwh),
            holder: row.holder,
          });
          lastCreatedId = created.id;
        }
      }

      if (onSuccess && lastCreatedId) {
        onSuccess(lastCreatedId);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to process CSV certificate batch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-modal-enter">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Issue & Verify Certificate</h2>
              <p className="text-xs text-slate-400">Upload green energy telemetry and trigger AI 5-Point Audit</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 pb-2.5 text-xs font-bold border-b-2 transition-all px-2 ${
              activeTab === 'form'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Form Certificate Issuance</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 pb-2.5 text-xs font-bold border-b-2 transition-all px-2 ${
              activeTab === 'csv'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Batch Upload</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'form' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Solar Plant Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-sky-400" /> Solar Plant Asset *
                  </label>
                  {loadingPlants ? (
                    <div className="p-2 text-xs text-slate-500">Loading plants list...</div>
                  ) : (
                    <select
                      value={plantId}
                      onChange={(e) => setPlantId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                    >
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.capacity_kw.toLocaleString()} kW) - {p.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Custom REC ID (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-400" /> REC ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated (e.g. REC-00501)"
                    value={customRecId}
                    onChange={(e) => setCustomRecId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Generation Period Start *
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Generation Period End *
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                {/* Energy MWh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Certified Volume (MWh) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 250.0"
                    value={energyMwh}
                    onChange={(e) => setEnergyMwh(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>

                {/* Holder */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" /> Registered Holder / Buyer *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Evergreen Energy Ltd"
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Issuing Certificate & Running AI Verification Suite...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Issue Certificate & Run AI Verification Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCsvSubmit} className="space-y-4">
              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center space-y-3">
                <FileSpreadsheet className="w-8 h-8 text-sky-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-200">Upload REC Telemetry CSV File</p>
                  <p className="text-[11px] text-slate-400">CSV file with columns: id, plant_id, period_start, period_end, energy_mwh, holder</p>
                </div>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose CSV File</span>
                </label>

                {csvFile && (
                  <p className="text-xs text-emerald-400 font-mono font-semibold">
                    Loaded file: {csvFile.name} ({csvPreview.length} rows preview)
                  </p>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Parsed CSV Preview</h4>
                  <div className="overflow-x-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800">
                          <th className="p-1.5">Plant ID</th>
                          <th className="p-1.5">Period Start</th>
                          <th className="p-1.5">Period End</th>
                          <th className="p-1.5 font-mono">Energy MWh</th>
                          <th className="p-1.5">Holder</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 text-sky-400 font-mono">{row.plant_id}</td>
                            <td className="p-1.5 text-slate-300">{row.period_start}</td>
                            <td className="p-1.5 text-slate-300">{row.period_end}</td>
                            <td className="p-1.5 text-amber-400 font-mono font-bold">{row.energy_mwh}</td>
                            <td className="p-1.5 text-purple-300">{row.holder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || csvPreview.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Batch & Running AI Verification Suite...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Batch & Run AI Verification Audit</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
