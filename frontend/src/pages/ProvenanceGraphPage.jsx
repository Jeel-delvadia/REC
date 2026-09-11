import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, Search, RefreshCw, AlertTriangle, Building, Zap, User, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { fetchGraph } from '../api/client';

export default function ProvenanceGraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recFilter, setRecFilter] = useState(searchParams.get('rec_id') || '');
  const [selectedNode, setSelectedNode] = useState(null);

  const canvasRef = useRef(null);

  useEffect(() => {
    loadGraph();
  }, [searchParams]);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryRecId = searchParams.get('rec_id') || null;
      const data = await fetchGraph(queryRecId);
      setGraphData(data);
    } catch (err) {
      setError(err.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (recFilter.trim()) {
      setSearchParams({ rec_id: recFilter.trim() });
    } else {
      setSearchParams({});
    }
  };

  const handleReset = () => {
    setRecFilter('');
    setSearchParams({});
  };

  // Node position calculation and canvas drawing logic
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = 550;

    ctx.clearRect(0, 0, width, height);

    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];

    if (nodes.length === 0) return;

    // Layout algorithm: Group nodes by type into columns
    const plants = nodes.filter(n => n.type === 'plant');
    const recs = nodes.filter(n => n.type === 'rec');
    const parties = nodes.filter(n => n.type === 'party');

    const nodePositions = new Map();

    // Plants column (x ~ 15%)
    plants.forEach((n, idx) => {
      const x = width * 0.15;
      const y = (height / (plants.length + 1)) * (idx + 1);
      nodePositions.set(n.id, { x, y, ...n });
    });

    // RECs column (x ~ 45%)
    recs.forEach((n, idx) => {
      const x = width * 0.45;
      const y = (height / (recs.length + 1)) * (idx + 1);
      nodePositions.set(n.id, { x, y, ...n });
    });

    // Parties column (x ~ 80%)
    parties.forEach((n, idx) => {
      const x = width * 0.80;
      const y = (height / (parties.length + 1)) * (idx + 1);
      nodePositions.set(n.id, { x, y, ...n });
    });

    // Draw Edges
    edges.forEach((edge) => {
      const src = nodePositions.get(edge.source);
      const tgt = nodePositions.get(edge.target);

      if (src && tgt) {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (edge.flagged) {
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = edge.type === 'transfer' ? '#a855f7' : '#0ea5e9';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw arrow tip
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const arrowSize = 7;
        const targetRadius = 24;
        const arrowX = tgt.x - targetRadius * Math.cos(angle);
        const arrowY = tgt.y - targetRadius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.fillStyle = edge.flagged ? '#f43f5e' : (edge.type === 'transfer' ? '#a855f7' : '#0ea5e9');
        ctx.fill();
      }
    });

    // Draw Nodes
    nodePositions.forEach((node) => {
      const radius = 22;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      if (node.flagged) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
      } else if (node.type === 'plant') {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
      } else if (node.type === 'rec') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.strokeStyle = node.risk_band === 'high' || node.risk_band === 'critical' ? '#f43f5e' : '#fbbf24';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
      }

      ctx.fill();
      ctx.stroke();

      // Node Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 18 ? node.label.substring(0, 15) + '...' : node.label, node.x, node.y + radius + 14);

      // Node Type indicator
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(node.type.toUpperCase(), node.x, node.y + radius + 25);
    });

  }, [graphData]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Network className="w-6 h-6 text-purple-400" />
            <span>Ownership Provenance & Resale Graph Visualizer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detect circular resales (wash trading) and rapid flip trading chains across REC transfers.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter REC ID (e.g. REC-00421)..."
            value={recFilter}
            onChange={(e) => setRecFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
          />
          <button type="submit" className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors">
            Filter
          </button>
          {searchParams.get('rec_id') && (
            <button type="button" onClick={handleReset} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold">
              Show Full Graph
            </button>
          )}
        </form>
      </div>

      {/* Legend & Stats Bar */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-500/20 border border-sky-400" />
            <span className="text-slate-300 font-medium">Solar Plant Node</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-400" />
            <span className="text-slate-300 font-medium">REC Node</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-400" />
            <span className="text-slate-300 font-medium">Trader / Holder Node</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-rose-500 border-t border-dashed border-rose-500" />
            <span className="text-rose-400 font-semibold">Flagged / Wash Trade Edge</span>
          </div>
        </div>

        <div className="font-mono text-slate-400 text-[11px]">
          Nodes: <span className="text-white font-bold">{graphData?.nodes?.length || 0}</span> | Edges: <span className="text-purple-400 font-bold">{graphData?.edges?.length || 0}</span>
        </div>
      </div>

      {/* Main Visualizer Canvas Container */}
      <div className="glass-panel p-4 relative overflow-hidden flex flex-col items-center">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
            <p className="text-sm font-semibold">Computing NetworkX provenance graph layout...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-rose-400 text-sm">Failed to load graph: {error}</div>
        ) : (
          <div className="w-full relative">
            <canvas ref={canvasRef} className="w-full h-[550px] block cursor-pointer" />
          </div>
        )}
      </div>

      {/* Transfer Edges Telemetry Table */}
      {graphData?.edges && graphData.edges.length > 0 && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400" /> Ownership Transfer History Ledger
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">REC ID</th>
                  <th className="py-2.5 px-3">From Entity</th>
                  <th className="py-2.5 px-3">To Entity</th>
                  <th className="py-2.5 px-3">Edge Type</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Wash Trade Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {graphData.edges.map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{e.rec_id || 'N/A'}</td>
                    <td className="py-3 px-3 text-slate-300">{e.source.replace(/^party:|^rec:|^plant:/, '')}</td>
                    <td className="py-3 px-3 text-purple-300 font-semibold">{e.target.replace(/^party:|^rec:|^plant:/, '')}</td>
                    <td className="py-3 px-3 capitalize font-mono text-slate-400">{e.type}</td>
                    <td className="py-3 px-3 text-slate-400 font-mono">{e.timestamp ? new Date(e.timestamp).toLocaleString() : 'Genesis'}</td>
                    <td className="py-3 px-3 text-right">
                      {e.flagged ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-end gap-1 ml-auto w-fit">
                          <AlertTriangle className="w-3 h-3" /> Flagged Resale
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[11px]">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
