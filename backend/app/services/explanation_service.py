"""Turns check results into a short plain-English explanation for the auditor."""
from app.integrations import llm_client

# Report §6 classification names, for band values that otherwise read as raw API strings.
BAND_LABELS = {
    "genuine": "Genuine / Low Risk",
    "suspicious": "Suspicious",
    "high_risk": "High Risk",
    "likely_fraud": "Likely Fraud",
}

SYSTEM_PROMPT = (
    "You explain automated verification results for Renewable Energy Certificates (RECs) to a human auditor. "
    "Write 3 to 5 plain sentences with no headings or bullet points. Start with the overall risk verdict, then "
    "explain which checks drove the score, quoting the numbers you are given. Use only facts from the check "
    "results. Don't tell the auditor whether to approve or reject; that decision is theirs."
)


def build_prompt(rec: dict, score: int, band: str, checks: list[dict]) -> str:
    lines = [
        f"REC {rec['id']} from {rec['plant_name']} ({rec['capacity_kw']:,.0f} kW solar), "
        f"generation period {rec['period_start']} to {rec['period_end']}, claiming {rec['energy_mwh']} MWh.",
        f"Overall risk score: {score}/100 ({BAND_LABELS.get(band, band)}).",
        "",
        "Check results:",
    ]
    for check in checks:
        lines.append(
            f"- {check['label']}: {check['status'].upper()} "
            f"(risk {check['risk']:.2f}, weight {check['weight']} points). {check['summary']}"
        )
    return "\n".join(lines)


def template_explanation(score: int, band: str, checks: list[dict]) -> str:
    opening = f"This REC scores {score}/100 ({BAND_LABELS.get(band, band)})."
    ledger_check = next((c for c in checks if c["name"] == "ledger" and c["status"] == "fail"), None)
    if ledger_check:
        # A gate override (weight 0) outranks every weighted check regardless of risk*weight.
        opening += f" {ledger_check['summary']}"
    flagged = sorted(
        (c for c in checks if c["status"] != "pass" and c["name"] != "ledger"),
        key=lambda c: c["risk"] * c["weight"], reverse=True,
    )
    if not flagged:
        return f"{opening} All other checks passed."
    return " ".join([opening] + [f"{c['label']} ({c['status']}): {c['summary']}" for c in flagged])


def explain(rec: dict, score: int, band: str, checks: list[dict], *, use_llm: bool = True) -> tuple[str, str]:
    """Returns (text, source), where source is "llm" or "template"."""
    if use_llm:
        text = llm_client.complete(SYSTEM_PROMPT, build_prompt(rec, score, band, checks))
        if text:
            return text, "llm"
    return template_explanation(score, band, checks), "template"
