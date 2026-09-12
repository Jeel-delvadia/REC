import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType, Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Network, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { fetchGraph } from '../api/client';

const STRIP = (id) => id.replace(/^party:|^rec:|^plant:/, '');

function BaseNode({ data, tone, children }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center min-w-[130px] ${tone}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !border-slate-800" />
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !border-slate-800" />
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">{data.kind}</div>
      <div className="text-xs font-bold text-slate-100 truncate">{data.label}</div>
      {children}
    </div>
  );
}

const PlantNode = ({ data }) => (
  <BaseNode data={{ ...data, kind: 'Plant' }} tone="bg-blue-500/10 border-blue-500/40" />
);

const RecNode = ({ data }) => {
  const highRisk = data.risk_band === 'high_risk' || data.risk_band === 'likely_fraud';
  const tone = data.flagged
    ? 'bg-rose-500/15 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
    : highRisk
    ? 'bg-rose-500/10 border-rose-500/50'
    : 'bg-amber-500/10 border-amber-500/40';
  return (
    <BaseNode data={{ ...data, kind: 'REC' }} tone={tone}>
      {data.risk_band && (
        <div className="text-[10px] font-mono text-slate-400 mt-0.5 capitalize">{data.risk_band.replace('_', ' ')}</div>
      )}
    </BaseNode>
  );
};

const PartyNode = ({ data }) => (
  <BaseNode data={{ ...data, kind: 'Party' }} tone="bg-purple-500/10 border-purple-500/40" />
);

const NODE_TYPES = { plant: PlantNode, rec: RecNode, party: PartyNode };

function layout(nodes) {
  const columns = { plant: [], rec: [], party: [] };
  nodes.forEach((n) => columns[n.type]?.push(n));
  const xByType = { plant: 40, rec: 340, party: 640 };
  const positioned = [];
  Object.entries(columns).forEach(([type, group]) => {
    const gap = 110;
    group.forEach((n, i) => {
      positioned.push({
        id: n.id,
        type: n.type,
        position: { x: xByType[type], y: i * gap + 20 },
        data: { label: STRIP(n.id) || n.label, risk_band: n.risk_band, flagged: n.flagged },
      });
    });
  });
  return positioned;
}

export default function ProvenanceGraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recFilter, setRecFilter] = useState(searchParams.get('rec_id') || '');

  useEffect(() => {
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSearchParams(recFilter.trim() ? { rec_id: recFilter.trim() } : {});
  };

  const handleReset = () => {
    setRecFilter('');
    setSearchParams({});
  };

  const nodes = useMemo(() => layout(graphData?.nodes || []), [graphData]);
  const edges = useMemo(
    () =>
      (graphData?.edges || []).map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: e.type === 'transfer' ? undefined : e.type,
        animated: e.flagged,
        style: {
          stroke: e.flagged ? '#f43f5e' : e.type === 'transfer' ? '#a855f7' : '#0ea5e9',
          strokeWidth: e.flagged ? 2.5 : 1.5,
          strokeDasharray: e.flagged ? '6 4' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: e.flagged ? '#f43f5e' : e.type === 'transfer' ? '#a855f7' : '#0ea5e9',
        },
      })),
    [graphData]
  );

  const nodeColor = useCallback((n) => {
    if (n.data?.flagged) return '#f43f5e';
    if (n.type === 'plant') return '#38bdf8';
    if (n.type === 'rec') return '#fbbf24';
    return '#c084fc';
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
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

      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-400" />
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

      {graphData?.flags?.length > 0 && (
        <div className="glass-panel p-4 border-l-4 border-l-rose-500 bg-rose-950/20 space-y-1.5">
          {graphData.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel p-2 relative overflow-hidden" style={{ height: 560 }}>
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
            <p className="text-sm font-semibold">Loading the ownership graph...</p>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-rose-400 text-sm">Failed to load graph: {error}</div>
        ) : nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">No graph data for this REC yet.</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background color="#334155" gap={18} />
            <Controls />
            <MiniMap nodeColor={nodeColor} maskColor="rgba(2,6,23,0.7)" pannable zoomable />
          </ReactFlow>
        )}
      </div>

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
                    <td className="py-3 px-3 font-mono font-bold text-blue-400">{e.rec_id || 'N/A'}</td>
                    <td className="py-3 px-3 text-slate-300">{STRIP(e.source)}</td>
                    <td className="py-3 px-3 text-purple-300 font-semibold">{STRIP(e.target)}</td>
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
