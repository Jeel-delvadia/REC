from pydantic import BaseModel

from app.schemas.data_quality import DataQualityReportOut


class IngestRequest(BaseModel):
    reset: bool = True  # wipe existing data (including the ledger) before loading
    verify: bool = True  # score every REC after loading, using rule-based explanations


class IngestResult(BaseModel):
    plants: int
    meters: int = 0
    generation: int
    recs: int
    transactions: int
    verified: int
    errors: list[str] = []
    # RS-20 (§9.6): batch/aggregate data-quality findings, separate from the per-row `errors`
    # above (which are Pydantic shape/range rejections) - see app/engines/data_quality.py.
    data_quality: DataQualityReportOut
