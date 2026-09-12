from pydantic import BaseModel


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
