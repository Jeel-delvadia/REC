from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import RiskBand


class GraphNode(BaseModel):
    id: str
    type: Literal["plant", "rec", "party"]
    label: str
    risk_band: RiskBand | None = None
    flagged: bool = False


class GraphEdge(BaseModel):
    source: str
    target: str
    type: Literal["generated", "issued", "transfer"]
    rec_id: str | None = None
    timestamp: datetime | None = None
    flagged: bool = False


class GraphOut(BaseModel):
    focus: str | None
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    flags: list[str]
