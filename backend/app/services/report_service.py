"""The public verification view and the downloadable audit report (RS-15: a PDF, via ReportLab).

QR rendering moved client-side (RS-14, qrcode.react) - it only ever encoded public_url()
below, which the frontend already gets from these two responses, so there's nothing server-side
left to generate. public_url() stays here: both public_verification() and build_report() return it.
"""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.services import audit_service, rec_service

# report §6 band -> (display label, accent color) for the PDF's risk banner and check rows.
_BAND_STYLE = {
    "genuine": ("GENUINE / LOW RISK", colors.HexColor("#059669")),
    "suspicious": ("SUSPICIOUS", colors.HexColor("#d97706")),
    "high_risk": ("HIGH RISK", colors.HexColor("#e11d48")),
    "likely_fraud": ("LIKELY FRAUD", colors.HexColor("#7c3aed")),
}
_STATUS_MARK = {"pass": "PASS", "warn": "WARN", "fail": "FAIL"}


def public_url(rec_id: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verify/{rec_id}"


def public_verification(db: Session, rec_id: str) -> dict:
    rec = rec_service.get_rec(db, rec_id)
    plant = rec.plant
    return {
        "rec_id": rec.id,
        "plant_name": plant.name,
        # Prefer the human-readable place name (RS-19); fall back to coordinates for plants
        # seeded before that column existed, or created without a location string.
        "plant_location": plant.location or f"{plant.latitude:.2f}, {plant.longitude:.2f}",
        "capacity_kw": plant.capacity_kw,
        "energy_mwh": rec.energy_mwh,
        "period_start": rec.period_start,
        "period_end": rec.period_end,
        "status": rec.status,
        "risk_score": rec.risk_score,
        "risk_band": rec.risk_band,
        "verified_at": rec.verified_at,
        "ledger_hash": audit_service.latest_hash(db, rec.id),
        "ledger_valid": audit_service.verify_ledger(db)["valid"],
        "verify_url": public_url(rec.id),
        "rec_type": rec.rec_type,
        "issuing_authority": rec.issuing_authority,
        "generation_date": rec.generation_date,
        "rec_issued": rec.rec_issued,
        "certificate_status": rec.certificate_status,
    }


def build_report(db: Session, rec_id: str) -> dict:
    return {
        "generated_at": utcnow(),
        "public_url": public_url(rec_id),
        "rec": rec_service.get_detail(db, rec_id),
        "history": audit_service.history(db, rec_id),
        "ledger": audit_service.verify_ledger(db),
    }


def build_pdf(db: Session, rec_id: str) -> bytes:
    """A downloadable audit report (report §3 outputs, §10): the REC's details, every check,
    the explanation, the ledger's own history for this REC, and chain-wide integrity."""
    data = build_report(db, rec_id)
    rec = data["rec"]
    verification = rec["verification"]  # a VerificationResult ORM object, or None

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("RSTitle", parent=styles["Title"], fontSize=18, spaceAfter=4)
    h2_style = ParagraphStyle("RSH2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("RSBody", parent=styles["BodyText"], leading=14)
    mono_style = ParagraphStyle("RSMono", parent=styles["Code"], fontSize=7, leading=9)

    story = [
        Paragraph("RECShield &mdash; Verification Report", title_style),
        Paragraph(f"REC {rec['id']} &middot; generated {data['generated_at']:%Y-%m-%d %H:%M} UTC", body_style),
        Spacer(1, 10),
    ]

    if rec["risk_band"] is not None:
        label, accent = _BAND_STYLE.get(rec["risk_band"], (rec["risk_band"].upper(), colors.grey))
        banner = Table(
            [[Paragraph(f"<b>Risk Score {rec['risk_score']}/100 &middot; {label}</b>", body_style)]],
            colWidths=[6.5 * inch],
        )
        banner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), accent),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(banner)
    else:
        story.append(Paragraph("<i>Not yet verified.</i>", body_style))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Certificate", h2_style))
    facts = [
        ["Plant", f"{rec['plant'].name} ({rec['plant'].capacity_kw:,.0f} kW, {rec['plant'].technology})"],
        ["Generation period", f"{rec['period_start']} to {rec['period_end']}"],
        ["Claimed energy", f"{rec['energy_mwh']} MWh"],
        ["Holder", rec["holder"]],
        ["Status", rec["status"]],
    ]
    fact_table = Table(facts, colWidths=[1.6 * inch, 4.9 * inch])
    fact_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(fact_table)

    if verification is not None:
        story.append(Paragraph("Verification Checks", h2_style))
        rows = [["Check", "Status", "Sub-score", "Summary"]]
        for check in verification.checks:
            weight_note = "gate" if check["weight"] == 0 else f"{check['weight']} pts"
            rows.append([
                check["label"],
                _STATUS_MARK.get(check["status"], check["status"]),
                f"{check['risk'] * 100:.0f}/100 ({weight_note})",
                Paragraph(check["summary"], body_style),
            ])
        check_table = Table(rows, colWidths=[1.3 * inch, 0.65 * inch, 1.15 * inch, 3.4 * inch], repeatRows=1)
        style = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        for i, check in enumerate(verification.checks, start=1):
            if check["status"] == "fail":
                style.append(("TEXTCOLOR", (1, i), (1, i), colors.HexColor("#dc2626")))
            elif check["status"] == "warn":
                style.append(("TEXTCOLOR", (1, i), (1, i), colors.HexColor("#d97706")))
        check_table.setStyle(TableStyle(style))
        story.append(check_table)

        story.append(Paragraph("Why", h2_style))
        story.append(Paragraph(verification.explanation, body_style))
        story.append(Paragraph(f"<i>Source: {verification.explanation_source}</i>", body_style))

    story.append(Paragraph("Ledger Integrity", h2_style))
    ledger = data["ledger"]
    story.append(Paragraph(
        f"Chain-wide: <b>{'INTACT' if ledger['valid'] else 'BROKEN at entry #' + str(ledger['broken_at'])}</b> "
        f"({ledger['entries_checked']} entries checked).",
        body_style,
    ))

    if data["history"]:
        story.append(Paragraph("Audit History", h2_style))
        rows = [["When (UTC)", "Event", "Hash"]]
        for entry in data["history"]:
            rows.append([entry.created_at.strftime("%Y-%m-%d %H:%M"), entry.event_type, Paragraph(entry.hash, mono_style)])
        history_table = Table(rows, colWidths=[1.3 * inch, 1.3 * inch, 3.9 * inch], repeatRows=1)
        history_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ]))
        story.append(history_table)

    story.append(Spacer(1, 14))
    story.append(Paragraph(f"Public verification: {data['public_url']}", body_style))
    story.append(Paragraph(
        "This score indicates fraud risk for investigation, not a legal finding of fraud.",
        ParagraphStyle("RSFootnote", parent=body_style, fontSize=8, textColor=colors.grey),
    ))

    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=LETTER,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    ).build(story)
    return buffer.getvalue()
