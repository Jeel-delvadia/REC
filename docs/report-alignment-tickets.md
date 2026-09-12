# Report alignment tickets

Decision (12 Sep 2026): the code changes to match the report (*RECShield_Hackathon_Report*). The report stays as written.

Each `RS-xx` section below is one ticket. Paste it into a GitHub issue with the heading as the title.

## Order and streams

RS-01 and RS-02 change contracts that everything else builds on: band names and the REC/meter schema. Land them first, as small PRs.

| Stream | Tickets, in order |
|---|---|
| Backend core | RS-01 → RS-07 → RS-08 → RS-09 → RS-10 |
| Data, physics, ML | RS-02 → RS-03 → RS-04 → RS-05 → RS-06 |
| Frontend and report | RS-11 → RS-12 → RS-13 → RS-14 → RS-15 (start RS-11 once RS-01's band keys are merged) |
| Last | RS-16 → RS-17 → RS-18 |

Sizes are relative: S, M, L.

---

## RS-01 Scoring model: report weights, bands and labels

**Report:** §6, §9 Figure 3, §10 · **Size:** S · **Depends on:** nothing. Merge first.

**Now:** weights 30/25/25/10/10. Bands 0–39 / 40–59 / 60–79 / 80–100 (`low` / `medium` / `high` / `critical`). A rule lifts any near-certain physics, meter or duplicate failure to at least 65. Check status is ✗ at risk ≥ 0.6 and ⚠ at ≥ 0.2. The frontend hardcodes the old ranges (`RecExplorerPage.jsx:140-142`).

**Do:**
- Weights: physics 30, meter 25, duplicate 25, historical anomaly 15, transaction 5. Read them from settings (`.env`), as the report says they're "stored in configuration and tunable".
- Sub-scores run 0–100. `score = Σ weight × sub_score / 100`, rounded.
- Bands, with API keys fixed now so the frontend can build against them:

  | Key | Score | Label |
  |---|---|---|
  | `genuine` | 0–30 | Genuine / Low Risk |
  | `suspicious` | 31–60 | Suspicious |
  | `high_risk` | 61–80 | High Risk |
  | `likely_fraud` | 81–100 | Likely Fraud |

- Check status: ✓ below 40, ⚠ 40–79, ✗ 80 and above.
- Remove the minimum-65 rule, which the report doesn't have. The ledger-integrity override is RS-07.
- Each check also returns a reason code (for example `PHYSICS_CLAIM_ABOVE_ESTIMATE`) with its numbers (§9, "structured reason codes").
- Update `schemas/common.py`, `risk_service.py`, the tests, and every frontend file that switches on band names.

**Done when:** REC-00421's sub-scores 100/100/100/73/0 give 91 and `likely_fraud`. A score of 64 gives `high_risk`. No threshold numbers remain in the frontend.

**Known consequence of matching the report:** with no minimum, a REC that fails only one check scores at most 30 and is labelled Genuine. For example, a claim of twice the meter reading with nothing else wrong scores 25. The failed check still shows ✗ on the detail view. Be ready for this question from the judges.

---

## RS-02 Data model: meters and hourly intervals

**Report:** §3 inputs, §5 (one-hour interval), §7 (`meter_id` in the fingerprint) · **Size:** M · **Depends on:** nothing. Merge early.

**Now:** `Generation` holds one row per plant per day. `Rec` covers `period_start`/`period_end` dates. There are no meters and no issuer.

**Do:**
- Add a `Meter` table (`id`, `plant_id`).
- Generation rows become hourly: `meter_id`, `interval_start`, `interval_end`, `energy_mwh`.
- `Rec` gets `meter_id`, `interval_start`/`interval_end` (datetimes), `issuer` and `fingerprint` (filled by RS-05), and keeps `energy_mwh`.
- Update the schemas, ingest CSV columns, `RecCreate` and the create-REC form, search, and the tests.

**Done when:** the API serves hourly RECs with meter IDs and the frontend shows interval start and end times.

---

## RS-03 Synthetic Fraud Simulator: hourly data, fraud on demand, the report's demo records

**Report:** §12 #8, §13, §14 (pandas, NumPy), §15, Figures 2 and 4 · **Size:** L · **Depends on:** RS-02

**Now:** `scripts/seed_data.py` writes 15-day RECs with the stdlib `csv` module. Its REC-00421 is a 2 MW plant's duplicate certificate with circular trading, not the report's record.

**Do:**
- Generate hourly meter data with pandas and NumPy. Honest generation should come from the same weather and pvlib model as RS-04, so honest RECs pass the physics check.
- Make fraud types selectable on demand (CLI flag and/or a `POST /ingest` option): inflated claim, meter mismatch, duplicate / over-issuance, circular transfer, tampered record.
- Include these fixed demo records:
  - **REC-00421:** Plant A, 100 MW, one-hour interval, claimed 180 MWh, meter 72 MWh, physics estimate ≈74 MWh. History is ISSUED then TRANSFERRED (Owner X → Owner Y), with no circular transfer. Historical anomaly sub-score ≈73.
  - **§7 pair:** Plant A, Meter M-01, 1 April 12:00–13:00, 72 MWh. REC-001 goes to Buyer X and REC-002 to Buyer Y, both with the same fingerprint.
  - **Figure 4 dashboard, roughly:** about 1,250 RECs, with REC-00418 scoring ≈87 and REC-00392 ≈64.
- Cache the weather data used to a CSV, so the demo doesn't depend on Open-Meteo being up.

**Done when:** one command fills the dashboard, and REC-00421 scores 91 with the §9 check pattern ✗ ✗ ✗ ⚠ ✓.

---

## RS-04 Physics engine: pvlib with hourly Open-Meteo weather

**Report:** cover, §5, §14 · **Size:** L · **Depends on:** RS-02

**Now:** `engines/physics.py` multiplies capacity × daily irradiation × 0.8. Open-Meteo is used only to backfill daily `shortwave_radiation_sum`. The check compares *metered* energy with the estimate, not the claim.

**Do:**
- `integrations/open_meteo.py`: fetch hourly GHI, DNI, DHI and air temperature for the plant's coordinates and the claim interval.
- `engines/physics.py` (still no HTTP or database): pvlib solar position, then plane-of-array irradiance, then a PVWatts-style estimate from capacity and assumed system losses. Sum to expected generation, with a hard ceiling of capacity × hours.
- Compare claimed vs expected vs meter within a configurable tolerance (default ±20%). The physics sub-score is driven by the claim against the estimate and the ceiling (§6: "Claimed generation above physics estimate / capacity ceiling"). Also report whether the meter agrees with physics (§5: "Meter is consistent").
- Add `pvlib` and `pandas` to `requirements.txt`.

**Done when:** REC-00421 shows a 100 MWh ceiling, 180 MWh claimed (2.4× the estimate), 72 MWh metered, an estimate of ≈74 MWh, and the meter within 3% of the estimate.

---

## RS-05 Duplicate detection: SHA-256 generation fingerprint and over-issuance

**Report:** §7 · **Size:** M · **Depends on:** RS-02

**Now:** `engines/duplicate.py` only checks date overlap between RECs from the same plant. There's no fingerprint.

**Do:**
- `fingerprint = SHA-256(plant_id | meter_id | interval_start | interval_end | quantity_MWh)`, stored on the REC. Fix the exact text formatting of times and quantities in code, so the same event always hashes the same way.
- The first REC with a fingerprint is registered. Any later REC with the same fingerprint is double counting: duplicate sub-score 100.
- Over-issuance: the total MWh certified by all RECs, this one included, for the same plant, meter and overlapping interval must not exceed metered generation.
- Show which REC first registered the fingerprint.

**Done when:** REC-002 is flagged against REC-001 (§7 table), and REC-00421 (180 MWh against a 72 MWh meter) gets a duplicate sub-score of 100.

---

## RS-06 Isolation Forest: report features, trained on normal data, 0–100 score

**Report:** §6 · **Size:** M · **Depends on:** RS-03, RS-04

**Now:** two per-day features (capacity factor, performance ratio), trained on every simulated day including injected fraud. The check reports the fraction of anomalous days.

**Do:**
- One row per REC with the six §6 features:
  - claimed-to-expected ratio
  - claimed-to-meter ratio
  - capacity utilisation for the interval
  - deviation from the plant's own profile for that hour and season
  - issuance volume and frequency per plant
  - delay between the end of the generation interval and issuance
- Train only on the simulator's normal records, without any injected fraud.
- Normalise the model's `decision_function` into a 0–100 sub-score (historical anomaly, weight 15).

**Done when:** REC-00421's historical anomaly sub-score is ≈73 (⚠ Warning), and honest RECs mostly score below 40.

---

## RS-07 Ledger: report hash format, event types, integrity gate

**Report:** §6 (gate), §8, §9 Figure 3, §15 step 5 · **Size:** M · **Depends on:** RS-01

**Now:**
- The hash is SHA-256 of one JSON object that includes the previous hash.
- Event types are `issued`, `transferred`, `verified`, `approved`, `rejected`, `reported` and `note`.
- `/ledger/verify` reports a break, but nothing acts on it.
- Editing a REC row in the database (for example `energy_mwh`) isn't detected at all, because only ledger rows are hashed. Demo step 5 would fail today.

**Do:**
- `hash_n = SHA-256(hash_{n-1} + canonical JSON of record_n)`.
- Event types ISSUED, TRANSFERRED, VERIFIED and AUDITOR_ACTION, with the action name in the payload.
- Per-REC integrity check: the REC's ledger entries verify, *and* the REC's current quantity and holder match what the ledger recorded (the ISSUED quantity and the last TRANSFERRED owner).
- Show the result as the "Ledger Integrity" row (✓ Intact / ✗). A mismatch forces the REC to `likely_fraud` whatever its score, and raises an alert.

**Done when:** changing a REC's `energy_mwh` or `holder` directly in the database and re-verifying gives Ledger Integrity ✗, Likely Fraud, and an alert that names the first bad record.

---

## RS-08 Auditor actions: Request Verification and Report Fraud escalation

**Report:** §9 action table, Figure 3 · **Size:** S · **Depends on:** RS-07 (event types)

**Now:** the actions are approve, reject, report and note. "report" only changes the status.

**Do:**
- **Request Verification** (new): sets status to pending and stores a request for evidence from the issuer or generator.
- **Approve:** marks the REC as verified by the auditor and closes its alerts. It already does this; keep it.
- **Report Fraud:** creates an escalation record with the evidence and reasons attached (a snapshot of the latest checks and explanation).
- The investigation note goes with any action. A note on its own is still allowed.
- Every action is written to the ledger as AUDITOR_ACTION.

**Done when:** all four Figure 3 buttons work and each appears in the audit history.

---

## RS-09 Alerts: Likely Fraud, ledger failures, circular transfers

**Report:** §6 (score bands, transaction row), §8, §10 · **Size:** S · **Depends on:** RS-01, RS-07

**Now:** alerts are raised only for the `high` and `critical` bands.

**Do:**
- Raise alerts for Likely Fraud (81 and above).
- Raise alerts for ledger integrity failures.
- Raise a separate alert for any circular transfer, even when the score is low.
- High Risk (61–80) no longer alerts. It's prioritised in the Review list instead (RS-11).

**Done when:** each of the three alert types appears on the Alerts page from simulator data.

---

## RS-10 Ingestion validation (data quality)

**Report:** §4 row 5, §13 ("Data Quality Engine: folded in") · **Size:** S · **Depends on:** RS-02

**Now:** `ingest_service.py` parses the CSVs with `float()` and `fromisoformat()` and checks nothing else.

**Do:**
- Validate every row with Pydantic: required fields, units, interval start before end, capacity > 0, non-negative energy, and known plant and meter IDs.
- Skip invalid rows and return a list of errors per file from `POST /ingest`.
- Don't reject a row just because a claim exceeds capacity. That's fraud, and the physics check has to be the one to catch it.

**Done when:** a CSV with a malformed row loads everything else and reports the bad row.

---

## RS-11 Dashboard: report KPIs, Review/Investigate list, date filter, Recharts

**Report:** §10 (Figure 4 and table), §14 · **Size:** M · **Depends on:** RS-01

**Now:** the dashboard shows a low/medium/high/critical distribution. There's no date filter and no charting library.

**Do:**
- KPI cards: Total, Verified (0–30), Suspicious (31–80), Fraudulent (81–100). The counts come from the API, per band.
- High-risk list ranked by score, with [Investigate] for Likely Fraud and [Review] for High Risk and Suspicious.
- Search and filter by ID, plant, risk band, status and date. Add `date_from` and `date_to` to `GET /recs`.
- A trend chart built with Recharts, for example RECs per band over time.
- Header title: "RECShield · AI-Powered REC Fraud Detection".

**Done when:** the dashboard matches Figure 4's layout with simulator data.

---

## RS-12 REC detail view as in Figure 3

**Report:** §9 Figure 3 · **Size:** S · **Depends on:** RS-01, RS-07, RS-08

**Do:**
- Header: "REC-xxxxx · Verification Result" with "Risk Score N/100 · LABEL".
- Check rows: Physics Verification, Meter Verification, Duplicate Check, Historical Pattern, Ledger Integrity, each with ✓ / ⚠ / ✗. Show transaction risk as well.
- A WHY panel with the explanation.
- Buttons Approve, Request Verification, Reject and Report Fraud, an Investigation Note field, and Submit Action.

**Done when:** REC-00421's detail view matches Figure 3.

---

## RS-13 Graph view with React Flow

**Report:** §7, §10, §14 · **Size:** M · **Depends on:** nothing (the API already exists)

**Now:** `ProvenanceGraphPage.jsx` draws on a canvas.

**Do:** rebuild the page with React Flow (`@xyflow/react`). Show a REC's owner-to-owner transfer path and highlight any detected cycle.

**Done when:** a simulated circular-transfer REC shows its A → B → C → A loop highlighted.

---

## RS-14 QR code with qrcode.react; public page as in §11

**Report:** §10, §11 Scenario A, §14, §15 step 6 · **Size:** S · **Depends on:** RS-01, RS-07

**Now:** the QR SVG is generated by the backend (`report_service.qr_svg`). `PUBLIC_BASE_URL` points to `localhost`, which a phone can't open.

**Do:**
- Render the QR code in the frontend with `qrcode.react`, and remove the backend QR endpoint.
- The public page shows status and ledger integrity. A Genuine REC shows "Verified" without needing auditor approval.
- For the demo, set `PUBLIC_BASE_URL` to the laptop's LAN address (or the deployed URL), run Vite with `--host`, and test from a phone on the same network.

**Done when:** scanning the QR with a phone opens the public page for that REC.

---

## RS-15 PDF report with ReportLab

**Report:** §3 outputs, §10, §14 · **Size:** M · **Depends on:** RS-12 (report content)

**Now:** `GET /recs/{id}/report` returns JSON.

**Do:**
- Generate the PDF with ReportLab: REC details, risk score and band, every check, the explanation, audit history with hashes, ledger integrity, and the public URL or QR code.
- Return it as `application/pdf`. The frontend's "Download report" button saves the file.

**Done when:** downloading REC-00421's report gives a readable PDF containing all of the above.

---

## RS-16 Supabase: Postgres and auditor login

**Report:** §3 (two roles), §4 row 4, §13 ("cut to 2 roles"), §14 · **Size:** L · **Depends on:** a stable backend

**Now:** SQLite locally and no authentication at all.

**Do:**
- Point `DATABASE_URL` at the Supabase Postgres connection string. The current SQLAlchemy code works with it unchanged.
- Auditor login with Supabase Auth in the frontend. The backend verifies the Supabase JWT on every auditor route. Public Verifier routes (the QR page and `/public/verify/{id}`) stay open.
- The auditor name on actions comes from the logged-in user instead of a text field.

**Done when:** auditor pages need a login and the public verification page doesn't.

---

## RS-17 Deployment (optional)

**Report:** §14 · **Size:** M · **Depends on:** RS-16

Frontend on Vercel, API on Render, database on Supabase. This also gives RS-14 a URL a phone can reach from anywhere.

---

## RS-18 Demo rehearsal: §15 live flow end to end

**Report:** §15 · **Size:** S · **Depends on:** all of the above

Run the six steps in order and write down the exact commands and clicks for each:

1. Run the simulator.
2. The dashboard fills with counts and high-risk RECs.
3. Open REC-00421 and walk through its checks and the WHY panel.
4. Submit Report Fraud with a note, and show it in the audit history.
5. Edit a record directly in the database, and show ledger integrity failing.
6. Scan the QR code on a phone to open the public verification page.

**Done when:** someone other than the author runs all six steps from the written notes without help.
