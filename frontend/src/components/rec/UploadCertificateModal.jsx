import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Upload, PlusCircle, Building, Calendar, Zap, User, FileText, CheckCircle, RefreshCw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { fetchPlants, createRec } from '../../api/client';
import BrandShieldIcon from '../ui/BrandShieldIcon';

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

  const fieldClass = 'w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/25 rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition-colors';

  // Portaled to document.body: mounted from TopHeader (and also from RecExplorerPage), a
  // position:fixed modal must not depend on an ancestor's styling.
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--brand)] flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Issue certificate</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Runs the 5-point verification audit automatically</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-sunken)] px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 pb-2.5 text-xs font-bold border-b-2 transition-all px-2 ${
              activeTab === 'form'
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manual entry</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 pb-2.5 text-xs font-bold border-b-2 transition-all px-2 ${
              activeTab === 'csv'
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV upload</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#fef3f2] border border-[rgba(217,45,32,0.24)] text-[var(--risk-fraud)] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'form' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Solar Plant Picker */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Solar plant *
                  </label>
                  {loadingPlants ? (
                    <div className="p-2 text-xs text-[var(--text-tertiary)]">Loading plants list...</div>
                  ) : (
                    <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className={fieldClass}>
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
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> REC ID (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated (e.g. REC-00501)"
                    value={customRecId}
                    onChange={(e) => setCustomRecId(e.target.value)}
                    className={`${fieldClass} font-mono`}
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Period start *
                  </label>
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={fieldClass} />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Period end *
                  </label>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={fieldClass} />
                </div>

                {/* Energy MWh */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Energy (MWh) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 250.0"
                    value={energyMwh}
                    onChange={(e) => setEnergyMwh(e.target.value)}
                    className={`${fieldClass} font-mono`}
                  />
                </div>

                {/* Holder */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Holder *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Evergreen Energy Ltd"
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    className={fieldClass}
                  />
                </div>

              </div>

              <div className="pt-2">
                <button type="submit" disabled={submitting} className="w-full btn btn-primary py-3 text-xs justify-center disabled:opacity-50">
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Issuing &amp; verifying&hellip;</span>
                    </>
                  ) : (
                    <>
                      <BrandShieldIcon className="w-4 h-4" />
                      <span>Issue & verify</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCsvSubmit} className="space-y-4">
              <div className="p-4 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] text-center space-y-3">
                <FileSpreadsheet className="w-7 h-7 text-[var(--text-tertiary)] mx-auto" />
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">Upload telemetry CSV</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">CSV file with columns: id, plant_id, period_start, period_end, energy_mwh, holder</p>
                </div>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="btn btn-secondary inline-flex px-4 py-2 text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose CSV File</span>
                </label>

                {csvFile && (
                  <p className="text-xs text-[var(--risk-genuine)] font-mono font-semibold">
                    Loaded file: {csvFile.name} ({csvPreview.length} rows preview)
                  </p>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Preview ({csvPreview.length} rows)</h4>
                  <div className="overflow-x-auto p-2 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)]">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-[var(--text-tertiary)] border-b border-[var(--border)]">
                          <th className="p-1.5 font-medium">Plant ID</th>
                          <th className="p-1.5 font-medium">Period start</th>
                          <th className="p-1.5 font-medium">Period end</th>
                          <th className="p-1.5 font-medium">Energy MWh</th>
                          <th className="p-1.5 font-medium">Holder</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 text-[var(--brand)] font-mono">{row.plant_id}</td>
                            <td className="p-1.5 text-[var(--text-secondary)]">{row.period_start}</td>
                            <td className="p-1.5 text-[var(--text-secondary)]">{row.period_end}</td>
                            <td className="p-1.5 text-[var(--text-primary)] font-mono">{row.energy_mwh}</td>
                            <td className="p-1.5 text-[var(--text-primary)]">{row.holder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting || csvPreview.length === 0} className="w-full btn btn-primary py-3 text-xs justify-center disabled:opacity-50">
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing batch&hellip;</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & verify batch</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
