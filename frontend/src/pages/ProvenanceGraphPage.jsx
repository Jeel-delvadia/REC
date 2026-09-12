import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType, Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { fetchGraph } from '../api/client';
import Card from '../components/ui/Card';
import { LoadingState, EmptyState } from '../components/ui/States';

const STRIP = (id) => id.replace(/^party:|^rec:|^plant:/, '');

// The graph canvas is a deliberate dark surface (xyflow's own dark colorMode) rather than the
// app's usual light card interior - node/edge colors here are tuned for contrast against it,
// matching the same "dark canvas inside a light card" pattern data-viz tools like this use.
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
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Provenance Graph</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Circular resales and rapid flip-trading chains across ownership transfers.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder="REC ID, e.g. REC-00421"
            value={recFilter}
            onChange={(e) => setRecFilter(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none font-mono w-44 transition-colors"
          />
          <button type="submit" className="btn btn-primary px-3 py-1.5 text-xs">Filter</button>
          {searchParams.get('rec_id') && (
            <button type="button" onClick={handleReset} className="btn btn-secondary px-3 py-1.5 text-xs">Clear</button>
          )}
        </form>
      </div>

      <Card padding="p-4" className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-[var(--text-secondary)]">Solar plant</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[var(--text-secondary)]">REC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span className="text-[var(--text-secondary)]">Trader / holder</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 border-t-2 border-dashed border-rose-500" />
            <span className="text-[var(--risk-fraud)] font-medium">Flagged / wash trade</span>
          </div>
        </div>
        <div className="font-mono text-[var(--text-tertiary)] text-[11px]">
          {graphData?.nodes?.length || 0} nodes &middot; {graphData?.edges?.length || 0} edges
        </div>
      </Card>

      {graphData?.flags?.length > 0 && (
        <Card padding="p-4" className="border-l-2 !border-l-[var(--risk-fraud)] space-y-1.5">
          {graphData.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--risk-fraud)]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{flag}</span>
            </div>
          ))}
        </Card>
      )}

      <Card padding="p-2" className="relative overflow-hidden" style={{ height: 560 }}>
        {loading ? (
          <LoadingState label="Loading the ownership graph…" />
        ) : error ? (
          <div className="h-full flex items-center justify-center text-[var(--risk-fraud)] text-sm">Failed to load graph: {error}</div>
        ) : nodes.length === 0 ? (
          <EmptyState description="No graph data for this REC yet." />
        ) : (
          <div className="h-full rounded-lg overflow-hidden bg-[#0b1220]">
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
          </div>
        )}
      </Card>

      {graphData?.edges && graphData.edges.length > 0 && (
        <Card padding="p-6" className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" /> Transfer history
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] text-[11px]">
                  <th className="py-2.5 px-3 font-medium">REC ID</th>
                  <th className="py-2.5 px-3 font-medium">From</th>
                  <th className="py-2.5 px-3 font-medium">To</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Timestamp</th>
                  <th className="py-2.5 px-3 font-medium text-right">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {graphData.edges.map((e, idx) => (
                  <tr key={idx} className="hover:bg-[var(--surface-sunken)] transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-[var(--brand)]">{e.rec_id || 'N/A'}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{STRIP(e.source)}</td>
                    <td className="py-3 px-3 text-[#7e22ce] font-medium">{STRIP(e.target)}</td>
                    <td className="py-3 px-3 capitalize font-mono text-[var(--text-tertiary)]">{e.type}</td>
                    <td className="py-3 px-3 text-[var(--text-tertiary)] font-mono">{e.timestamp ? new Date(e.timestamp).toLocaleString() : 'Genesis'}</td>
                    <td className="py-3 px-3 text-right">
                      {e.flagged ? (
                        <span className="badge-likely_fraud px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Flagged
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)] text-[11px]">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
