"""REC ownership graph with NetworkX: plant -> REC -> first holder -> later holders.

Pure functions over plain dicts. No database, no HTTP.
"""
import networkx as nx

RAPID_RESALE_HOURS = 24


def build_graph(plants: list[dict], recs: list[dict], transfers: list[dict]) -> nx.MultiDiGraph:
    """plants: {"id", "name"}; recs: {"id", "plant_id", "risk_band"};
    transfers: {"rec_id", "from_party", "to_party", "timestamp", "kind"}."""
    g = nx.MultiDiGraph()
    for plant in plants:
        g.add_node(f"plant:{plant['id']}", type="plant", label=plant["name"])
    for rec in recs:
        node = f"rec:{rec['id']}"
        g.add_node(node, type="rec", label=rec["id"], risk_band=rec.get("risk_band"))
        g.add_edge(f"plant:{rec['plant_id']}", node, type="generated")
    for t in transfers:
        target = f"party:{t['to_party']}"
        g.add_node(target, type="party", label=t["to_party"])
        if t["kind"] == "issue":
            source, edge_type = f"rec:{t['rec_id']}", "issued"
        else:
            source, edge_type = f"party:{t['from_party']}", "transfer"
            g.add_node(source, type="party", label=t["from_party"])
        g.add_edge(source, target, type=edge_type, rec_id=t["rec_id"], timestamp=t["timestamp"])
    return g


def analyse_chain(transfers: list[dict]) -> dict:
    """Look for wash trading in one REC's ownership chain: circular resale and rapid flipping."""
    owners = nx.DiGraph()
    owners.add_edges_from((t["from_party"], t["to_party"]) for t in transfers if t["kind"] == "transfer")
    cycle_parties = sorted({party for cycle in nx.simple_cycles(owners) for party in cycle})
    times = sorted(t["timestamp"] for t in transfers)
    rapid = sum(1 for a, b in zip(times, times[1:]) if (b - a).total_seconds() < RAPID_RESALE_HOURS * 3600)
    return {
        "transfers": sum(1 for t in transfers if t["kind"] == "transfer"),
        "cycle": bool(cycle_parties),
        "cycle_parties": cycle_parties,
        "rapid_resales": rapid,
    }


def to_payload(g: nx.MultiDiGraph, flagged_nodes=frozenset(), flagged_recs=frozenset()) -> dict:
    """Serialise for the API. Transfer edges of any REC in `flagged_recs` are marked flagged."""
    nodes = [
        {
            "id": node,
            "type": data.get("type", "party"),
            "label": data.get("label", node),
            "risk_band": data.get("risk_band"),
            "flagged": node in flagged_nodes,
        }
        for node, data in g.nodes(data=True)
    ]
    edges = [
        {
            "source": u,
            "target": v,
            "type": data["type"],
            "rec_id": data.get("rec_id"),
            "timestamp": data.get("timestamp"),
            "flagged": data["type"] == "transfer" and data.get("rec_id") in flagged_recs,
        }
        for u, v, data in g.edges(data=True)
    ]
    return {"nodes": nodes, "edges": edges}
