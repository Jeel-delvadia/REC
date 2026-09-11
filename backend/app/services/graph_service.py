from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engines import duplicate, graph
from app.models import Plant, Rec, Transaction
from app.services.rec_service import get_rec


def graph_for(db: Session, rec_id: str | None = None) -> dict:
    """The whole ownership graph, or, for one REC, its plant, sibling RECs and ownership chain."""
    focus = get_rec(db, rec_id) if rec_id else None
    if focus:
        plants = [focus.plant]
        recs = db.scalars(select(Rec).where(Rec.plant_id == focus.plant_id).order_by(Rec.period_start)).all()
        transfers = db.scalars(
            select(Transaction).where(Transaction.rec_id == focus.id).order_by(Transaction.timestamp)
        ).all()
    else:
        plants = db.scalars(select(Plant).order_by(Plant.id)).all()
        recs = db.scalars(select(Rec).order_by(Rec.plant_id, Rec.period_start)).all()
        transfers = db.scalars(select(Transaction).order_by(Transaction.timestamp)).all()

    chain = [
        {"rec_id": t.rec_id, "from_party": t.from_party, "to_party": t.to_party, "timestamp": t.timestamp, "kind": t.kind}
        for t in transfers
    ]
    g = graph.build_graph(
        [{"id": p.id, "name": p.name} for p in plants],
        [{"id": r.id, "plant_id": r.plant_id, "risk_band": r.risk_band} for r in recs],
        chain,
    )

    flags, flagged_nodes, flagged_recs = [], set(), set()
    by_rec = defaultdict(list)
    for t in chain:
        by_rec[t["rec_id"]].append(t)
    for chain_rec_id, steps in by_rec.items():
        result = graph.analyse_chain(steps)
        if result["cycle"]:
            flagged_recs.add(chain_rec_id)
            flags.append(f"{chain_rec_id}: ownership loops back through {', '.join(result['cycle_parties'])}")
        if focus and result["rapid_resales"]:
            flags.append(
                f"{chain_rec_id}: {result['rapid_resales']} resale(s) within {graph.RAPID_RESALE_HOURS} hours"
            )

    if focus:
        for other in recs:
            if other.id != focus.id and duplicate.overlap_days(
                focus.period_start, focus.period_end, other.period_start, other.period_end
            ):
                flagged_nodes.update({f"rec:{other.id}", f"rec:{focus.id}"})
                flags.append(f"{other.id} claims the same plant's generation for overlapping dates")

    return {"focus": rec_id, **graph.to_payload(g, flagged_nodes, flagged_recs), "flags": flags}
