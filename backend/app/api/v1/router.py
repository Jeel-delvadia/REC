from fastapi import APIRouter

from app.api.v1.endpoints import actions, alerts, dashboard, graph, ingest, ledger, recs, reports

api_router = APIRouter()

for module in (dashboard, recs, actions, ledger, alerts, graph, reports, ingest):
    api_router.include_router(module.router)
