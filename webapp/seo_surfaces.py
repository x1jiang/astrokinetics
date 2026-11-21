"""
AstroKinetics · ASTRA — Auto-RSI SEO & GEO Discovery Surfaces (v5.3.0)
======================================================================
Adapted from the Admit Coach Auto-RSI SEO/GEO architecture:
1. Programmatic, non-JS server-rendered HTML hubs & detail pages with above-the-fold
   Direct-Answer boxes, 3-level BreadcrumbList + Article/Dataset/FAQPage JSON-LD,
   and automatic Light/Dark WCAG AAA contrast:
   - /for-judges & downloadable /for-judges/evaluation-kit.txt
   - /scenarios & /scenarios/{scenario_id} (4 live-computed mission scenarios)
   - /data & /data/{slug} (4 empirical NASA data notes from bundled JSON assets)
   - /guides & /guides/{slug} (4 technical deep-dive guides)
2. Dynamic /sitemap.xml, RSS 2.0 /feed.xml, and IndexNow verification endpoints.
3. Public read-only Model Context Protocol (MCP 2025-06-18) JSON-RPC endpoint at
   POST /api/mcp/ so external AI agents can query verification reports, scenarios,
   deterministic telemetry evaluation, and the 673-item NASA AURA corpus directly.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from html import escape
from typing import Any, Callable

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response

BASE_URL = "https://astrokinetics-space-health-765428358644.us-central1.run.app"
GITHUB_URL = "https://github.com/x1jiang/astrokinetics"
YOUTUBE_URL = "https://www.youtube.com/watch?v=RVlS16JRnv4"
SPACEAPPS_URL = "https://www.spaceappschallenge.org/2026/find-a-team/ai-med-01/?tab=project"

PUBLISHED_DATE = "2026-11-15"
MODIFIED_DATE = "2026-11-21"
MODIFIED_ISO = "2026-11-21T22:50:00Z"
RFC822_MODIFIED = "Sat, 21 Nov 2026 22:50:00 +0000"

# Deterministic public IndexNow key (override via INDEXNOW_KEY env var if desired)
INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "a796c85f2a03d774astrokinetics2026")

# Source freshness registry checked by scripts/geo_citation_monitor.py (< 90 days)
SOURCE_CHECKS: dict[str, dict[str, str]] = {
    "NASA-OSDR-OSD-571": {
        "checked": "2026-11-21",
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-571",
        "note": "14 longitudinal Inspiration4 plasma proteins across C001-C004 and 6 timepoints.",
    },
    "NASA-STD-3001-V2-6004": {
        "checked": "2026-11-21",
        "url": "https://standards.nasa.gov/node/237",
        "note": "Vol. 2 Rev. F [V2 6004] 3 mmHg one-hour mean cabin CO2 habitat limit.",
    },
    "NASA-RADLAB-DOSTEL": {
        "checked": "2026-11-21",
        "url": "https://osdr.nasa.gov/bio/",
        "note": "164 bundled empirical ISS DosTel1/DosTel2 observations (2022-04-01/02).",
    },
    "BARGER-2014-ISS-SLEEP": {
        "checked": "2026-11-21",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/",
        "note": "Lancet Neurology 2014 Space Shuttle & ISS actigraphy sleep study (ISS inflight 6.09 +/- 0.67 h).",
    },
    "NASA-NTRS-MARS-DELAY": {
        "checked": "2026-11-21",
        "url": "https://ntrs.nasa.gov/citations/20220013418",
        "note": "Up to 22-minute one-way / 44-minute round-trip Mars communications delay.",
    },
    "NASA-ISS-BIOMONITOR": {
        "checked": "2026-11-21",
        "url": "https://www.nasa.gov/mission/station/research-explorer/investigation/?#id=7392",
        "note": "CSA / NASA ISS Bio-Monitor wearable telemetry reference schema.",
    },
}

DATA_NOTES: dict[str, dict[str, Any]] = {
    "osd-571-inspiration4-proteomics": {
        "title": "NASA OSDR OSD-571 Inspiration4 Plasma Proteomics — Longitudinal Crew Cohort Data Note",
        "h1": "What does NASA OSDR OSD-571 show across SpaceX Inspiration4 pre-flight and return timepoints?",
        "description": "Empirical data note summarizing 14 SpaceX Inspiration4 plasma proteins across 4 crew members (C001–C004) and 6 timepoints (L-92 to R+82) bundled in AstroKinetics · ASTRA.",
        "direct_answer": "Bundled from NASA OSDR OSD-571 (GLDS-563, 1,443 screened proteins), 14 selected plasma/EVP proteins across four Inspiration4 crew members (C001–C004) show pronounced immediate post-flight (R+1) shifts in oxidative and hemolysis markers — including CAT (5.24x), PRDX2 (5.09x), HBA1 (4.36x), and HBB (4.11x) — alongside complement and ECM declines (C3 0.67x, FN1 0.17x), with recovery tracked through R+45 and R+82.",
        "source_url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-571",
        "api_url": "/api/osdr-empirical",
        "faq": [
            (
                "How does AstroKinetics · ASTRA use NASA OSDR OSD-571 data?",
                "The workstation bundles 14 longitudinal protein entries across 6 timepoints (L-92, L-44, L-3, R+1, R+45, R+82) for spaceflight research context in the Evidence viewer and /api/osdr-empirical. The separate 8-DOF Mahalanobis readiness index uses a fixed demonstration reference rather than training a clinical classifier on OSD-571.",
            ),
            (
                "Are the OSD-571 fold changes independently verified in the codebase?",
                "Yes. Every protein's preflight log10 mean and R+1 fold change in nasa_osd571_inspiration4_real.json is verified programmatically against raw non-zero log10 intensities across C001–C004 by scripts/verify_judging_workflow.mjs.",
            ),
        ],
    },
    "radlab-iss-dostel-radiation": {
        "title": "NASA OSDR RadLab ISS DosTel Radiation Telemetry — Empirical Orbital Sample Data Note",
        "h1": "What absorbed dose rates appear in the bundled NASA RadLab ISS DosTel orbital sample?",
        "description": "Empirical analysis of 164 real ISS DosTel1 and DosTel2 absorbed dose-rate, flux, and orbital pass observations bundled in AstroKinetics · ASTRA.",
        "direct_answer": "Across 164 empirical ISS observations captured from NASA OSDR RadLab (2022-04-01 23:00 to 2022-04-02 01:05 UTC, filtered above 2 uGy/h), DosTel1 recorded 77 samples averaging 6.595 uGy/h (peak 12.616 uGy/h) and DosTel2 recorded 87 samples averaging 5.948 uGy/h (peak 12.269 uGy/h) across orbital latitudes from -51.8° to +51.7°.",
        "source_url": "https://osdr.nasa.gov/bio/",
        "api_url": "/api/aura/radlab",
        "faq": [
            (
                "What radiation fields are included in /api/aura/radlab?",
                "Each of the 164 rows includes UTC timestamp, instrument (DosTel1 or DosTel2), absorbed dose rate (microgray/hour), particle flux, ISS altitude (km), geomagnetic B-field, McIlwain L-shell, latitude, and longitude.",
            ),
            (
                "Is the RadLab ISS sample a random crew exposure sample?",
                "No. As explicitly disclosed in the bundled metadata, it is a targeted 2-hour orbital pass sample filtered at absorbed_dose_rate > 2 uGy/h for engineering context, not personal astronaut dosimetry.",
            ),
        ],
    },
    "barger-2014-iss-sleep-adaptation": {
        "title": "Barger et al. (2014) NASA Shuttle & ISS Actigraphy Sleep Study — Earth vs. Orbit Reference Note",
        "h1": "Why does 5.9 hours of sleep trigger MODERATE on Earth but LOW in Orbit mode?",
        "description": "Published Space Shuttle and ISS actigraphy sleep tables from Barger et al. (Lancet Neurology 2014, PMC4188436) and how AstroKinetics · ASTRA adapts Earth-1g vs. Mission-Microgravity baselines.",
        "direct_answer": "In Barger et al. (2014, PMC4188436), actigraphy-measured astronaut total sleep time averaged 6.09 +/- 0.67 hours inflight on the ISS and 5.96 +/- 0.56 hours on Space Shuttle missions (5.94 +/- 0.96 hours before EVAs), far below the 8.5-hour scheduled block. In AstroKinetics · ASTRA's HUNCH triage engine, 5.9 hours of sleep with mild fatigue and no red flags triggers MODERATE under Earth-1g baselines but LOW (routine monitoring) under Mission-Microgravity context.",
        "source_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/",
        "api_url": "/api/hunch/catalog",
        "faq": [
            (
                "Does Orbit mode ignore severe sleep deprivation or red flags?",
                "No. All 8 NASA HUNCH emergency red flags always trigger EMERGENCY regardless of profile, and severe sleep loss (< 5.2 h) or elevated cognitive PVT latency (>= 355 ms) still triggers Alert in the workstation scorer.",
            ),
            (
                "Are individual astronaut records from Barger et al. included?",
                "No. The bundle preserves the exact published aggregate HTML tables (7 tables covering SL-90, L-11, Inflight, R+7, Night before EVA, and sleep-medication nights) with zero inferred participant-level data.",
            ),
        ],
    },
    "nasa-pmc-space-biology-corpus": {
        "title": "NASA Space Biology PMC Corpus (572 Papers) & Human-vs-Model-Organism Evidence Guardrails",
        "h1": "How does the AURA offline evidence engine separate human spaceflight guidance from rodent studies?",
        "description": "Corpus breakdown of 673 offline-indexed space-medicine items (572 NASA PMC publications, 70 reviewed sources, 16 bilingual concepts, 15 Apple Watch clinical studies) with human_only filtering.",
        "direct_answer": "AstroKinetics · ASTRA indexes 673 space-medicine items offline using deterministic bilingual BM25 retrieval — 572 NASA Space Biology PMC publications, 70 reviewed operational/clinical sources, 16 bilingual concepts, and 15 Apple Watch/iPhone clinical studies — and tags every publication by population domain so human_only=true excludes mouse, rodent, plant, microbial, and cellular papers while non-human hits display an explicit translation caveat.",
        "source_url": "https://humanresearchroadmap.nasa.gov/",
        "api_url": "/api/aura/overview",
        "faq": [
            (
                "Does the AURA evidence search require a cloud LLM or internet connection?",
                "No. The BM25 index runs deterministically in Python with zero LLM calls, returning ranked document IDs, source URLs, and explicit scientific limitations.",
            ),
            (
                "Why is separating human from model-organism papers critical in space medicine?",
                "A large share of NASA Space Biology PMC publications study mice, Drosophila, plants, or cell cultures. Mixing animal-model findings directly into human crew clinical thresholds creates unsafe medical recommendations.",
            ),
        ],
    },
}

GUIDES: dict[str, dict[str, Any]] = {
    "offline-astronaut-health-monitoring-mars-blackout": {
        "title": "Offline Astronaut Health Monitoring During 44-Minute Mars Communication Blackouts",
        "h1": "How can astronaut health software run reliably during a 44-minute Mars communication blackout?",
        "description": "Architecture guide explaining Service Worker PWA caching, exact Python-to-JavaScript 8-DOF Mahalanobis scoring parity, offline 3-tier crew privacy redaction, and <2 KB store-and-forward packets.",
        "direct_answer": "By caching the workstation shell, reference scenarios, and exact covariance whitening matrix in a Service Worker (sw.js v5.2.3), AstroKinetics · ASTRA computes identical Mahalanobis distances, chi-square survival p-values, alert tiers, and 3-tier privacy redactions in the browser offline as on the Python FastAPI server — verified across 20/20 test vectors and live Chrome offline reloads.",
        "sections": [
            (
                "Why cloud telemedicine breaks beyond low Earth orbit",
                "NASA communications modeling (NTRS 20220013418) places one-way Mars light-time delays at up to 22 minutes (44 minutes round-trip), with two-week solar-conjunction blackouts cutting Earth contact entirely. Any workflow that requires cloud inference or real-time flight-surgeon approval stalls when the crew needs rapid triage.",
            ),
            (
                "Zero-discrepancy Python and browser scoring",
                "Both webapp/app.py (scipy.stats.chi2) and webapp/static/dsp.js (exact Gamma(4, 2) closed-form survival for df=8) apply the same symmetric inverse square-root whitening matrix Sigma^(-1/2). Automated regression checks verify 20/20 exact matches across all 4 mission scenarios and 16 domain boundary cases.",
            ),
            (
                "Offline privacy governance and Space-to-Earth dual-use",
                "During an offline reload, localClientEvaluate enforces the same three crew privacy tiers (Astronaut Private, CMO Operational, Flight Surgeon Packet) so behavioral mood scores and private journal entries remain redacted in non-alert downlink packets. The exact same offline camera + wearable architecture applies directly to rural Texas clinics and disaster zones without broadband.",
            ),
        ],
        "faq": [
            (
                "How do I verify offline operation myself in Chrome?",
                "Open /?scenario=hypercapnia_drift once online, wait for the service worker to activate, switch Chrome DevTools Network to Offline, and reload. Confirm 'Offline edge triage', Watch status, and 78.3/100.",
            ),
            (
                "What still requires connectivity?",
                "Server SQLite persistence, REST telemetry packet receipts (/api/ingest/edge-telemetry), and optional xAI Grok Voice cloud chat/TTS require network connectivity.",
            ),
        ],
    },
    "mahalanobis-multivariate-triage-spaceflight": {
        "title": "8-DOF Multivariate Mahalanobis Whitening for Coupled Astronaut Health Drift",
        "h1": "Why use 8-DOF Mahalanobis whitening instead of single-sensor vital sign alarms in spaceflight?",
        "description": "Mathematical explanation of 8-channel physiological/kinematic Mahalanobis distance (D_M), symmetric Sigma^(-1/2) orthogonal attribution, and chi-square survival scoring in AstroKinetics · ASTRA.",
        "direct_answer": "Single-sensor alarms miss coupled multi-system drift — such as a 2.85 mmHg cabin CO2 rise paired with 322 ms PVT reaction-time slowing and mild postural sway — whereas 8-DOF Mahalanobis whitening (W = Sigma^(-1/2)) accounts for cross-channel physiological covariances (e.g., HR-HRV r = -0.62, CO2-PVT r = +0.46), yields an exact chi-square tail p-value, and decomposes D_M^2 into explainable per-channel variance percentages.",
        "sections": [
            (
                "The 8-channel physiological and kinematic state vector",
                "The state vector tracks ROM completeness (%), bilateral symmetry (%), trunk lean compensation (deg), postural sway (mm/s), heart rate (bpm), HRV RMSSD (ms), cognitive PVT latency (ms), and cabin ppCO2 (mmHg), plus out-of-distribution radiation (mSv/day) and 4–12 Hz hand tremor (mm) surge terms.",
            ),
            (
                "Exact closed-form Chi-Square survival in the browser",
                "Because a Chi-Square distribution with k = 8 degrees of freedom equals Gamma(shape=4, scale=2), the browser computes S(x) = exp(-x/2) * (1 + t + t^2/2 + t^3/6) for t = x/2 — eliminating approximation drift against scipy.stats.chi2.sf(x, df=8).",
            ),
            (
                "Prototype scope disclosure",
                "The covariance matrix and readiness mapping (100 * exp(-0.0165 * D_M^2), clamped to 12.0–99.2) are fixed prototype demonstration parameters, not clinically validated flight thresholds.",
            ),
        ],
        "faq": [
            (
                "How does cabin CO2 compare to NASA-STD-3001?",
                "NASA-STD-3001 Vol. 2 Rev. F [V2 6004] establishes a 3 mmHg one-hour mean cabin CO2 habitat limit. AstroKinetics labels its single-reading review triggers (2.4 / 2.85 / 3.5 mmHg) as prototype snapshot settings.",
            ),
        ],
    },
    "nasa-hunch-red-flag-safety-gate-abstention": {
        "title": "NASA HUNCH 8-Red-Flag Safety Gate & Principled Missing-Data Abstention",
        "h1": "How does AstroKinetics · ASTRA prevent unsafe false reassurance when wearable sensors fail?",
        "description": "Design and verification of the deterministic 8-red-flag NASA HUNCH emergency safety gate, INCOMPLETE_CHECK_REQUIRED missing-data abstention, and ASTRA clinician-gated episode closure.",
        "direct_answer": "Deterministic safety rules run in under 1 millisecond before any statistical model: all 8 NASA HUNCH emergency red flags return EMERGENCY even with poor signal quality and disconnected wearables, while degraded non-red-flag captures return INCOMPLETE_CHECK_REQUIRED instead of imputing normal defaults — explicitly logging disagreement with a naive ML comparator.",
        "sections": [
            (
                "All 8 deterministic emergency red flags verified",
                "Automated checks verify all 8 patterns under insufficient capture and missing watch vitals: MI triad (chest pain + SOB + diaphoresis), thunderclap headache, meningitis pattern (fever + confusion/neck stiffness), meningococcemia (fever + non-blanching rash), acute vision loss (severe SANS), new-onset seizure, syncope, and hemoptysis.",
            ),
            (
                "ASTRA longitudinal episode governance invariants",
                "In SQLite (/api/astra/episodes), dismissing a notification strictly preserves task.state='pending'; bad capture forces task.state='repeat_required'; store-and-forward sync is idempotent by event_id and never auto-sets human_reviewed; and closing an episode without human medical review returns HTTP 409 (or HTTP 422 if closure rationale is empty).",
            ),
        ],
        "faq": [
            (
                "Can the optional voice AI override a triage decision?",
                "No. Ask ASTRA (ClawAgents + xAI Grok Voice) explains findings and navigates views, while all triage classifications remain strictly with the deterministic red-flag gate and rule engine.",
            ),
        ],
    },
    "lidar-tetrahedral-volumetry-fluid-shift": {
        "title": "Closed-Mesh Signed Tetrahedral LiDAR Volumetry for Spaceflight Fluid Shift",
        "h1": "How does signed tetrahedral LiDAR volumetry track cephalad fluid shift without depth hallucinations?",
        "description": "Mathematical derivation, 0.00% analytical cube verification (1000.0 mL), and anti-hallucination ARKit quality gates in AstroKinetics · ASTRA (/api/astra/lidar-volume).",
        "direct_answer": "AstroKinetics · ASTRA computes closed oriented surface mesh volume via V = (1/6) |sum dot(v0, v1 x v2)| — verified at exactly 1000.0 mL (0.00% error) on a 10x10x10 cm analytical cube — while rejecting ARKit personSegmentationWithDepth (which hallucinates depth behind occluded limbs) and holding scans below 82% observed raw sceneDepth coverage or above 18% inferred area.",
        "sections": [
            (
                "Why surface volume matters in microgravity",
                "In microgravity, roughly 1–2 liters of fluid shift headward out of the lower extremities, contributing to calf volume reduction ('bird legs') and Spaceflight Associated Neuro-ocular Syndrome (SANS) risk. Longitudinal limb volumetry tracks directional shift against a crew member's own pre-flight baseline.",
            ),
            (
                "Strict anti-hallucination quality gates",
                "Evaluated via POST /api/astra/lidar-volume: observed coverage < 82%, inferred mesh area > 18%, or capture_mode='personSegmentationWithDepth' all return QUALITY_HOLD with explicit recapture instructions rather than silently reporting a corrupted volume delta.",
            ),
            (
                "Hardware scope disclosure",
                "The web prototype exercises the exact mathematical solver and quality gates via parametric or uploaded closed meshes; native iOS ARKit capture is not included in the browser app.",
            ),
        ],
        "faq": [
            (
                "Does limb surface volume directly measure intracranial pressure (ICP)?",
                "No. Surface volumetry tracks fluid-shift trends against personal baselines; it does not directly measure ICP or deep lean muscle strength.",
            ),
        ],
    },
}


def _shared_css() -> str:
    return """
:root {
  color-scheme: light dark;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --bg: #f4f6fb;
  --surface: #ffffff;
  --elevated: #eef3fa;
  --text: #0f172a;
  --muted: #334155;
  --line: #d6e0ec;
  --accent: #0b57d0;
  --accent-soft: #e8f0fe;
  --ok-bg: #e6f7ef;
  --ok-fg: #08663c;
  --warn-bg: #fef4db;
  --warn-fg: #854d00;
  --alert-bg: #fee9eb;
  --alert-fg: #9f1239;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #080d17;
    --surface: #101929;
    --elevated: #162338;
    --text: #edf4ff;
    --muted: #b7c6d9;
    --line: #26364d;
    --accent: #7dd3fc;
    --accent-soft: #122849;
    --ok-bg: #0d2e22;
    --ok-fg: #6ee7b7;
    --warn-bg: #352407;
    --warn-fg: #fcd34d;
    --alert-bg: #3a121b;
    --alert-fg: #fda4af;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.62; }
a { color: var(--accent); text-underline-offset: 0.2em; }
code { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.88em; background: var(--elevated); padding: 0.1em 0.35em; border-radius: 4px; }
.wrap { width: min(1080px, calc(100% - 36px)); margin-inline: auto; }
header.site-hdr { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 18px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; color: var(--text); text-decoration: none; }
header.site-hdr nav { display: flex; flex-wrap: wrap; gap: 10px 16px; font-size: 0.9rem; font-weight: 600; }
.crumbs { display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.84rem; color: var(--muted); margin: 18px 0 8px; padding: 0; list-style: none; }
.crumbs li + li::before { content: "/"; margin-right: 6px; opacity: 0.6; }
.eyebrow { color: var(--accent); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 8px; }
h1 { margin: 0 0 14px; font-size: clamp(1.75rem, 4vw, 2.75rem); line-height: 1.15; letter-spacing: -0.03em; }
h2 { margin: 28px 0 10px; font-size: clamp(1.25rem, 2.5vw, 1.65rem); line-height: 1.22; letter-spacing: -0.02em; }
h3 { margin: 18px 0 6px; font-size: 1.05rem; }
p, li { color: var(--muted); }
strong { color: var(--text); }
.direct-answer {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  padding: 16px 18px;
  margin: 16px 0 22px;
}
.direct-answer p { margin: 0; color: var(--text); font-size: 1.02rem; }
.meta-row { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 0.84rem; color: var(--muted); margin-bottom: 18px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 24px; }
.btn { display: inline-block; padding: 9px 15px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font-weight: 700; text-decoration: none; font-size: 0.9rem; }
.btn.primary { background: var(--accent); color: #ffffff; border-color: var(--accent); }
@media (prefers-color-scheme: dark) { .btn.primary { color: #051320; } }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 18px 0; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.card h3 { margin-top: 0; }
.table-wrap { overflow-x: auto; margin: 16px 0 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { background: var(--elevated); color: var(--text); font-weight: 700; }
.pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
.pill-nominal { background: var(--ok-bg); color: var(--ok-fg); }
.pill-watch { background: var(--warn-bg); color: var(--warn-fg); }
.pill-alert { background: var(--alert-bg); color: var(--alert-fg); }
.scope-box { background: var(--elevated); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 22px 0; font-size: 0.9rem; }
.faq-list dt { font-weight: 700; color: var(--text); margin-top: 14px; }
.faq-list dd { margin: 4px 0 0; color: var(--muted); }
.qr-mini { display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 12px; margin: 20px 0; }
.qr-mini a { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; text-decoration: none; color: var(--text); }
.qr-mini img { background: #ffffff; border: 1px solid var(--line); border-radius: 6px; padding: 3px; flex-shrink: 0; }
.qr-mini span { display: grid; font-size: 0.84rem; }
.qr-mini small { color: var(--muted); font-size: 0.75rem; }
footer.site-ftr { border-top: 1px solid var(--line); margin-top: 34px; padding: 20px 0 36px; display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 0.88rem; }
"""


def _breadcrumb_ld(items: list[tuple[str, str]]) -> dict[str, Any]:
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": idx,
                "name": name,
                "item": f"{BASE_URL}{path}" if path.startswith("/") else path,
            }
            for idx, (name, path) in enumerate(items, start=1)
        ],
    }


def _website_ld() -> dict[str, Any]:
    return {
        "@type": "WebSite",
        "@id": f"{BASE_URL}/#website",
        "name": "AstroKinetics · ASTRA (Team AI-MED 01, Houston)",
        "url": f"{BASE_URL}/",
        "inLanguage": "en",
        "publisher": {
            "@type": "Organization",
            "name": "Team AI-MED 01",
            "location": {
                "@type": "Place",
                "name": "Houston, Texas",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Houston",
                    "addressRegion": "TX",
                    "addressCountry": "US",
                },
            },
        },
        "potentialAction": {
            "@type": "SearchAction",
            "target": f"{BASE_URL}/api/aura/search?q={{search_term_string}}&human_only=true",
            "query-input": "required name=search_term_string",
        },
    }


def _render_page(
    *,
    path: str,
    title: str,
    description: str,
    crumbs: list[tuple[str, str]],
    body_html: str,
    extra_graph: list[dict[str, Any]] | None = None,
    faq_pairs: list[tuple[str, str]] | None = None,
) -> HTMLResponse:
    canonical = f"{BASE_URL}{path}"
    graph: list[dict[str, Any]] = [_website_ld(), _breadcrumb_ld(crumbs)]
    if extra_graph:
        graph.extend(extra_graph)
    if faq_pairs:
        graph.append(
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faq_pairs
                ],
            }
        )
    ld_json = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)
    crumbs_html = "".join(
        f'<li><a href="{escape(p)}">{escape(n)}</a></li>'
        if i < len(crumbs) - 1
        else f'<li aria-current="page">{escape(n)}</li>'
        for i, (n, p) in enumerate(crumbs)
    )
    faq_html = ""
    if faq_pairs:
        items = "".join(
            f"<dt>{escape(q)}</dt><dd>{escape(a)}</dd>" for q, a in faq_pairs
        )
        faq_html = f'<section aria-labelledby="faq-h"><h2 id="faq-h">Frequently asked questions</h2><dl class="faq-list">{items}</dl></section>'

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | AstroKinetics · ASTRA (Team AI-MED 01, Houston)</title>
  <meta name="description" content="{escape(description)}">
  <meta property="article:published_time" content="{PUBLISHED_DATE}T23:59:00Z">
  <meta property="article:modified_time" content="{MODIFIED_ISO}">
  <link rel="canonical" href="{escape(canonical)}">
  <link rel="alternate" type="text/markdown" href="/llms.txt" title="AI-readable project dossier (llms.txt)">
  <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="AstroKinetics · ASTRA Updates & Verification Feed">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{escape(title)} | AstroKinetics · ASTRA">
  <meta property="og:description" content="{escape(description)}">
  <meta property="og:url" content="{escape(canonical)}">
  <meta property="og:image" content="{BASE_URL}/static/final/demo-poster.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/static/showcase/brand/ai-med.svg" type="image/svg+xml">
  <style>{_shared_css()}</style>
  <script type="application/ld+json">{ld_json}</script>
</head>
<body>
  <div class="wrap">
    <header class="site-hdr">
      <a class="brand" href="/"><img src="/static/showcase/brand/ai-med.svg" width="32" height="27" alt="">AstroKinetics · ASTRA</a>
      <nav aria-label="Primary navigation">
        <a href="/">Workstation</a>
        <a href="/project">Overview</a>
        <a href="/for-judges">Judge Kit</a>
        <a href="/scenarios">Scenarios</a>
        <a href="/data">NASA Data</a>
        <a href="/guides">Guides</a>
        <a href="/video">29s Demo</a>
        <a href="/llms.txt">llms.txt</a>
      </nav>
    </header>
    <nav aria-label="Breadcrumb"><ol class="crumbs">{crumbs_html}</ol></nav>
    <main>
      {body_html}
      {faq_html}
      <div class="scope-box">
        <strong>Evidence scope &amp; verification note (<time datetime="{MODIFIED_DATE}">November 21, 2026</time>):</strong>
        Built in Houston, Texas by <strong>Team AI-MED 01</strong> for the 2026 NASA International Space Apps Challenge (<em>Create Health Monitoring Software for Astronauts on Space Missions</em>). Automated checks verify software parity, safety rules, privacy redaction, mathematical volumetry, and bundled NASA data integrity. Clinical diagnostic accuracy, flight qualification, in-flight validation, and native watchOS/iOS hardware capture remain unverified.
      </div>
      <div class="qr-mini" aria-label="Scannable 2D QR codes">
        <a href="/"><img src="/static/qr/qr-live-app.svg" width="64" height="64" alt="QR for Live Workstation" loading="lazy"><span><strong>Live App</strong><small>Workstation</small></span></a>
        <a href="/project"><img src="/static/qr/qr-project.svg" width="64" height="64" alt="QR for Overview and Verification" loading="lazy"><span><strong>Overview</strong><small>/project</small></span></a>
        <a href="{YOUTUBE_URL}" target="_blank" rel="noopener"><img src="/static/qr/qr-youtube-demo.svg" width="64" height="64" alt="QR for 29s YouTube Demo" loading="lazy"><span><strong>YouTube</strong><small>29s Demo</small></span></a>
        <a href="{GITHUB_URL}" target="_blank" rel="noopener"><img src="/static/qr/qr-github.svg" width="64" height="64" alt="QR for GitHub MIT Repo" loading="lazy"><span><strong>GitHub</strong><small>MIT Source</small></span></a>
      </div>
    </main>
    <footer class="site-ftr">
      <a href="/">Workstation</a>
      <a href="/project">Overview &amp; verification</a>
      <a href="/for-judges">Judge evaluation kit</a>
      <a href="/scenarios">4 mission scenarios</a>
      <a href="/data">NASA data notes</a>
      <a href="/guides">Technical guides</a>
      <a href="/api/verification-report">Live verification JSON</a>
      <a href="/feed.xml">RSS feed</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="{YOUTUBE_URL}" target="_blank" rel="noopener">YouTube demo</a>
      <a href="{GITHUB_URL}" target="_blank" rel="noopener">GitHub (MIT)</a>
      <a href="{SPACEAPPS_URL}" target="_blank" rel="noopener">NASA Space Apps page</a>
    </footer>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html, headers={"Cache-Control": "no-cache, must-revalidate"})


def build_seo_router(
    *,
    mission_scenarios: dict[str, dict[str, Any]],
    telemetry_input_cls: Any,
    evaluate_fn: Callable[[Any], dict[str, Any]],
    verification_fn: Callable[[], Any],
    osdr_empirical: dict[str, Any],
    empirical_supplements: dict[str, Any],
    knowledge_bundle: dict[str, Any],
    aura_corpus: dict[str, Any],
    aura_index: Any,
) -> APIRouter:
    router = APIRouter(tags=["SEO · GEO · Public MCP"])

    # ------------------------------------------------------------------
    # 1. /for-judges & downloadable /for-judges/evaluation-kit.txt
    # ------------------------------------------------------------------
    @router.get("/for-judges", include_in_schema=False)
    async def for_judges_page() -> HTMLResponse:
        body = f"""
        <p class="eyebrow">2-Minute Judge &amp; Educator Verification Kit · Team AI-MED 01 · Houston, TX</p>
        <h1>How can a judge verify AstroKinetics · ASTRA across all five NASA criteria in 2 minutes?</h1>
        <div class="direct-answer">
          <p><strong>Run four read-only checks directly in any browser without installing software or signing in:</strong> open the <a href="/api/verification-report">live verification API</a> (7/7 passing), load the <a href="/?scenario=hypercapnia_drift">Cabin CO₂ Drift scenario</a> online and after an offline DevTools reload (identical 78.3/100 Watch score), inspect <a href="/data">four empirical NASA data notes</a>, and watch the <a href="/video">29-second live demo</a> (<a href="{YOUTUBE_URL}" target="_blank" rel="noopener">YouTube</a>).</p>
        </div>
        <div class="meta-row">
          <span>Publisher: <strong>Team AI-MED 01 (Houston, Texas)</strong></span>
          <span>Event: <strong>2026 NASA International Space Apps Challenge</strong></span>
          <span>Updated: <time datetime="{MODIFIED_DATE}">November 21, 2026</time></span>
        </div>
        <div class="actions">
          <a class="btn primary" href="/for-judges/evaluation-kit.txt">Download Judge Checklist (.txt)</a>
          <a class="btn" href="/api/verification-report">Run Live Verification JSON</a>
          <a class="btn" href="/?scenario=hypercapnia_drift">Launch Cabin CO₂ Case</a>
          <a class="btn" href="/project">Full Project Overview</a>
        </div>
        <h2>NASA Space Apps 5-Criterion Evidence Map</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Judging Criterion</th><th>Verifiable Evidence in AstroKinetics · ASTRA</th><th>Direct Link</th></tr></thead>
            <tbody>
              <tr>
                <th>1. Impact</th>
                <td>Addresses up to 44-minute Mars round-trip delays and solar-conjunction blackouts (NTRS 20220013418) with zero-cloud browser inference and &lt;2 KB privacy-redacted store-and-forward packets; dual-use in rural Texas clinics and home tele-rehab.</td>
                <td><a href="/guides/offline-astronaut-health-monitoring-mars-blackout">Offline blackout guide</a></td>
              </tr>
              <tr>
                <th>2. Creativity</th>
                <td>Unifies on-device 3D MediaPipe kinematics + Wang POS rPPG, Earth-to-Orbit personal baseline switching, 8-DOF Mahalanobis whitening (Σ<sup>−1/2</sup>), deterministic HUNCH 8-red-flag safety gate + abstention, ASTRA episode governance, closed-mesh LiDAR volumetry, and 3D Crew Body Map.</td>
                <td><a href="/guides/mahalanobis-multivariate-triage-spaceflight">Mahalanobis guide</a></td>
              </tr>
              <tr>
                <th>3. Validity</th>
                <td>7/7 live read-only checks on <code>/api/verification-report</code> and 7/7 local automated suites (20/20 server/offline math parity, 4/4 privacy redaction, 10/10 HUNCH &amp; Barger profile, 6/6 ASTRA episode invariants, 3/3 LiDAR 1000.0 mL + quality gates, 5/5 crew/sol telemetry isolation, 5/5 NASA data math). Clinical &amp; hardware limits explicitly disclosed.</td>
                <td><a href="/api/verification-report">/api/verification-report</a></td>
              </tr>
              <tr>
                <th>4. Relevance</th>
                <td>Directly implements the challenge's Gather → Evaluate → Act loop using 8 bundled/cited NASA resources: OSDR OSD-571 (14 Inspiration4 proteins), RadLab ISS DosTel (164 rows), NASA-STD-3001 Vol. 2 Rev. F [V2 6004], 572 NASA PMC papers (human-vs-rodent guardrails), Barger 2014 ISS sleep study, NLSP AP005/DSO 484, HUNCH rules, and ISS Bio-Monitor schema.</td>
                <td><a href="/data">NASA Data Hub</a></td>
              </tr>
              <tr>
                <th>5. Presentation</th>
                <td>Zero-install live workstation, 29s captioned demo (<a href="/video">/video</a> &amp; <a href="{YOUTUBE_URL}">YouTube</a>), 6-language UI (EN/ES/FR/JA/ZH/DE), light/dark themes, offline 2D QR codes, MIT repo, public MCP endpoint (<code>/api/mcp/</code>), and machine-readable <code>/llms.txt</code>.</td>
                <td><a href="/video">/video &amp; transcript</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2>2-Minute Live Click-Through Protocol</h2>
        <ol>
          <li><strong>0:00–0:30 · Four scenarios + offline check:</strong> Visit <a href="/scenarios">the 4 mission scenarios</a> or click directly into <a href="/?scenario=hypercapnia_drift">Cabin CO₂ Drift</a> (78.3/100 Watch). Toggle Chrome DevTools Offline and reload to verify identical offline edge triage.</li>
          <li><strong>0:30–1:00 · Red-flag-first safety &amp; abstention:</strong> Open <a href="/?tab=triage">Triage</a> or inspect <a href="/guides/nasa-hunch-red-flag-safety-gate-abstention">the HUNCH safety guide</a> to confirm emergency red flags override poor capture while degraded non-red-flag scans abstain.</li>
          <li><strong>1:00–1:30 · Real bundled NASA data:</strong> Inspect <a href="/data/osd-571-inspiration4-proteomics">OSD-571 proteomics</a>, <a href="/data/radlab-iss-dostel-radiation">RadLab ISS DosTel</a>, and <a href="/data/nasa-pmc-space-biology-corpus">the 673-item AURA corpus</a> with <code>human_only=true</code> filtering.</li>
          <li><strong>1:30–2:00 · API &amp; machine verification:</strong> Open <a href="/api/verification-report"><code>/api/verification-report</code></a> or query <code>POST /api/mcp/</code> to confirm live deterministic outputs.</li>
        </ol>
        """
        return _render_page(
            path="/for-judges",
            title="Judge & Educator 2-Minute Verification Kit",
            description="2-minute evaluation protocol, downloadable checklist, and 5-criterion NASA Space Apps 2026 evidence map for AstroKinetics · ASTRA (Team AI-MED 01, Houston).",
            crumbs=[("Home", "/"), ("Judge Evaluation Kit", "/for-judges")],
            body_html=body,
            extra_graph=[
                {
                    "@type": "TechArticle",
                    "headline": "AstroKinetics · ASTRA — 2-Minute Judge & Educator Evaluation Kit",
                    "datePublished": PUBLISHED_DATE,
                    "dateModified": MODIFIED_DATE,
                    "author": {"@type": "Organization", "name": "Team AI-MED 01"},
                    "url": f"{BASE_URL}/for-judges",
                }
            ],
            faq_pairs=[
                (
                    "Is any login or API key required to inspect AstroKinetics · ASTRA?",
                    "No. Every workstation tab, all 4 mission scenarios, all bundled NASA datasets, /api/verification-report, /llms.txt, and the read-only /api/mcp/ endpoint are publicly accessible without login.",
                ),
                (
                    "What is the quickest way for an AI judging agent to verify the portal?",
                    "Fetch /llms.txt for the structured index and GET /api/verification-report (or POST /api/mcp/) to execute 7 live read-only mathematical, safety, privacy, and NASA-data integrity checks.",
                ),
            ],
        )

    @router.get("/for-judges/evaluation-kit.txt", include_in_schema=False)
    async def judge_kit_download() -> PlainTextResponse:
        txt = f"""ASTROKINETICS · ASTRA — 2-MINUTE JUDGE VERIFICATION CHECKLIST
Team AI-MED 01 · Houston, Texas · 2026 NASA International Space Apps Challenge
Challenge: Create Health Monitoring Software for Astronauts on Space Missions
Updated: {MODIFIED_DATE} (v5.3.0)

PRIMARY LINKS
- Live Workstation:       {BASE_URL}/
- Overview & Verification:{BASE_URL}/project
- Judge Evaluation Kit:   {BASE_URL}/for-judges
- Live Verification JSON: {BASE_URL}/api/verification-report
- 29s Demo (Portal):      {BASE_URL}/video
- 29s Demo (YouTube):     {YOUTUBE_URL}
- AI Dossier (llms.txt):  {BASE_URL}/llms.txt
- Public MCP Endpoint:    {BASE_URL}/api/mcp/
- GitHub Repository (MIT):{GITHUB_URL}
- NASA Space Apps Page:   {SPACEAPPS_URL}

QUICK 5-STEP VERIFICATION
1. Check GET /api/verification-report -> confirm 7/7 checks pass (scenarios, privacy redaction, 8 HUNCH red flags, missing-data abstention, Barger 2014 Earth vs Orbit sleep profile, 1000.0 mL LiDAR analytical cube + 82% coverage gate, bundled NASA datasets & human-only AURA guardrail).
2. Open {BASE_URL}/?scenario=hypercapnia_drift -> confirm Watch (78.3/100), D_M = 3.85. Switch Chrome DevTools to Offline and reload -> confirm identical 78.3/100 Watch status under "Offline edge triage".
3. Open {BASE_URL}/data/osd-571-inspiration4-proteomics and /data/radlab-iss-dostel-radiation -> inspect 14 bundled SpaceX Inspiration4 proteins and 164 real ISS DosTel radiation rows.
4. Open {BASE_URL}/?tab=triage -> test MI Triad red flag overriding poor capture, and poor capture without red flags returning INCOMPLETE_CHECK_REQUIRED.
5. Run locally (Node 24): node webapp/scripts/verify_judging_workflow.mjs http://127.0.0.1:8080 (7/7 suites).

EXPLICIT SCOPE LIMITS
Software verification uses simulated telemetry and a fixed demonstration reference.
Clinical diagnostic accuracy, flight qualification, in-flight cohort validation, and native watchOS/iOS hardware capture remain unverified.
"""
        return PlainTextResponse(
            content=txt,
            headers={
                "Content-Disposition": 'attachment; filename="astrokinetics-judge-evaluation-kit.txt"',
                "Cache-Control": "no-cache, must-revalidate",
            },
        )

    # ------------------------------------------------------------------
    # 2. /scenarios hub & /scenarios/{scenario_id} detail pages
    # ------------------------------------------------------------------
    @router.get("/scenarios", include_in_schema=False)
    async def scenarios_hub() -> HTMLResponse:
        rows = []
        cards = []
        for sid, sc in mission_scenarios.items():
            res = evaluate_fn(telemetry_input_cls(**sc["telemetry"]))
            st = res["overall_status"]
            ms = res["multivariate_stats"]
            top_driver = ms["top_attributions"][0]["feature"] if ms["top_attributions"] else "Nominal"
            rows.append(
                f'<tr><th><a href="/scenarios/{escape(sid)}">{escape(sc["label"])}</a></th>'
                f'<td><span class="pill pill-{escape(st)}">{escape(st)}</span></td>'
                f'<td><strong>{res["readiness_score"]:.1f} / 100</strong></td>'
                f'<td>{ms["mahalanobis_d"]:.2f}</td>'
                f'<td>{escape(top_driver)}</td>'
                f'<td><a href="/?scenario={escape(sid)}">Run live</a></td></tr>'
            )
            cards.append(
                f'<article class="card"><h3><a href="/scenarios/{escape(sid)}">{escape(sc["label"])}</a></h3>'
                f'<p><span class="pill pill-{escape(st)}">{escape(st)}</span> · Demo index <strong>{res["readiness_score"]:.1f}/100</strong> · D<sub>M</sub> = {ms["mahalanobis_d"]:.2f}</p>'
                f'<p>Crew: {escape(sc["crew_member"])} · Link: <code>{escape(sc["comm_mode"])}</code></p>'
                f'<p><a href="/scenarios/{escape(sid)}">Read breakdown</a> · <a href="/?scenario={escape(sid)}">Launch 3D twin</a></p></article>'
            )
        body = f"""
        <p class="eyebrow">Four Scripted Mission Scenarios · Exact Server &amp; Offline Browser Parity</p>
        <h1>How does AstroKinetics · ASTRA score all four scripted spaceflight health scenarios?</h1>
        <div class="direct-answer">
          <p><strong>Every scenario runs through the same 8-DOF Mahalanobis whitening engine on both the Python server and cached offline browser:</strong> Nominal Lunar Orbit scores <strong>99.2/100 (Nominal)</strong>, Cabin CO₂ Drift scores <strong>78.3/100 (Watch)</strong>, 0g Squat Compensation scores <strong>44.7/100 (Alert)</strong>, and Solar Particle Event Blackout scores <strong>12.0/100 (Alert)</strong>.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Scenario</th><th>Status</th><th>Demo Index</th><th>D<sub>M</sub></th><th>Top Variance Driver</th><th>Interactive</th></tr></thead>
            <tbody>{"".join(rows)}</tbody>
          </table>
        </div>
        <div class="grid">{"".join(cards)}</div>
        """
        return _render_page(
            path="/scenarios",
            title="Four Scripted Astronaut Health Mission Scenarios",
            description="Live-computed 8-DOF Mahalanobis scores, alert levels, and top variance drivers across all four AstroKinetics · ASTRA mission scenarios.",
            crumbs=[("Home", "/"), ("Mission Scenarios", "/scenarios")],
            body_html=body,
        )

    @router.get("/scenarios/{scenario_id}", include_in_schema=False)
    async def scenario_detail(scenario_id: str) -> HTMLResponse:
        sc = mission_scenarios.get(scenario_id)
        if not sc:
            raise HTTPException(status_code=404, detail="Unknown mission scenario")
        t = sc["telemetry"]
        res = evaluate_fn(telemetry_input_cls(**t))
        ms = res["multivariate_stats"]
        st = res["overall_status"]
        attr_rows = "".join(
            f'<tr><th>{escape(a["feature"])}</th><td>{a["share_pct"]:.1f}%</td><td>{a["energy"]:.2f}</td></tr>'
            for a in ms["top_attributions"]
        )
        domain_rows = "".join(
            f'<tr><th>{escape(d["domain"])}</th><td><span class="pill pill-{escape(d["status"])}">{escape(d["status"])}</span></td><td>{escape(d["headline"])}</td><td>{escape(d["metric_detail"])}</td></tr>'
            for d in res["domains"]
        )
        cm_items = "".join(
            f'<li><strong>[{escape(c["priority"])}] {escape(c["title"])}:</strong> {escape(c["protocol"])} <em>({escape(c["reference"])})</em></li>'
            for c in res["countermeasures"]
        )
        other_links = " · ".join(
            f'<a href="/scenarios/{escape(oid)}">{escape(osc["label"])}</a>'
            for oid, osc in mission_scenarios.items()
            if oid != scenario_id
        )
        body = f"""
        <p class="eyebrow">Mission Scenario Case Study · Sol {sc["mission_sol"]} · {escape(sc["comm_mode"])}</p>
        <h1>{escape(sc["label"])} — Simulated Crew Health Evaluation</h1>
        <div class="direct-answer">
          <p><strong>Status: <span class="pill pill-{escape(st)}">{escape(st)}</span> · Demo Readiness Index: {res["readiness_score"]:.1f}/100 · Mahalanobis D<sub>M</sub> = {ms["mahalanobis_d"]:.2f} (p = {ms["p_value"]:.6f}).</strong> Top variance contributor: <strong>{escape(ms["top_attributions"][0]["feature"])} ({ms["top_attributions"][0]["share_pct"]:.1f}%)</strong>. Identical output is verified online and after an offline browser reload.</p>
        </div>
        <div class="actions">
          <a class="btn primary" href="/?scenario={escape(scenario_id)}">Run this scenario in the Live 3D Workstation</a>
          <a class="btn" href="/scenarios">Compare all 4 scenarios</a>
          <a class="btn" href="/api/scenarios">Inspect JSON inputs</a>
        </div>
        <h2>Domain-by-domain evaluation</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Domain</th><th>Status</th><th>Simulated Readings</th><th>Context</th></tr></thead>
            <tbody>{domain_rows}</tbody>
          </table>
        </div>
        <h2>Top whitened Mahalanobis variance drivers (% of D<sub>M</sub><sup>2</sup>)</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Channel</th><th>Share of D<sub>M</sub><sup>2</sup></th><th>Whitened Energy</th></tr></thead>
            <tbody>{attr_rows}</tbody>
          </table>
        </div>
        <h2>Prototype follow-up prompts</h2>
        <ul>{cm_items}</ul>
        <h2>Compare other mission scenarios</h2>
        <p>{other_links}</p>
        """
        return _render_page(
            path=f"/scenarios/{scenario_id}",
            title=f"{sc['label']} — Scenario Breakdown",
            description=f"Live-computed 8-DOF Mahalanobis evaluation for {sc['label']}: {st.upper()} ({res['readiness_score']:.1f}/100, D_M={ms['mahalanobis_d']:.2f}) with domain findings and NASA context.",
            crumbs=[("Home", "/"), ("Mission Scenarios", "/scenarios"), (sc["label"], f"/scenarios/{scenario_id}")],
            body_html=body,
            extra_graph=[
                {
                    "@type": "TechArticle",
                    "headline": f"{sc['label']} — AstroKinetics · ASTRA Scenario Breakdown",
                    "datePublished": PUBLISHED_DATE,
                    "dateModified": MODIFIED_DATE,
                    "author": {"@type": "Organization", "name": "Team AI-MED 01"},
                    "url": f"{BASE_URL}/scenarios/{scenario_id}",
                }
            ],
        )

    # ------------------------------------------------------------------
    # 3. /data hub & /data/{slug} empirical NASA data notes
    # ------------------------------------------------------------------
    @router.get("/data", include_in_schema=False)
    async def data_hub() -> HTMLResponse:
        cards = "".join(
            f'<article class="card"><h3><a href="/data/{escape(slug)}">{escape(note["title"])}</a></h3>'
            f'<p>{escape(note["direct_answer"])}</p>'
            f'<p><a href="/data/{escape(slug)}">Read data note</a> · <a href="{escape(note["api_url"])}">JSON API</a> · <a href="{escape(note["source_url"])}" target="_blank" rel="noopener">Official source</a></p></article>'
            for slug, note in DATA_NOTES.items()
        )
        body = f"""
        <p class="eyebrow">Bundled NASA Empirical Datasets · Verified November 21, 2026</p>
        <h1>Which empirical NASA datasets are bundled and verifiable inside AstroKinetics · ASTRA?</h1>
        <div class="direct-answer">
          <p><strong>Four empirical NASA and spaceflight research assets are bundled directly into the live application and exposed via read-only JSON APIs:</strong> 14 SpaceX Inspiration4 plasma proteins (NASA OSDR OSD-571), 164 ISS DosTel radiation observations (NASA RadLab), 7 Space Shuttle/ISS actigraphy sleep tables (Barger et al., 2014), and 673 offline-searchable evidence records (including 572 NASA Space Biology PMC publications with human-vs-model-organism guardrails).</p>
        </div>
        <div class="grid">{cards}</div>
        """
        return _render_page(
            path="/data",
            title="Bundled NASA Spaceflight Datasets & Empirical Data Notes",
            description="Inspect empirical NASA datasets bundled in AstroKinetics · ASTRA: OSDR OSD-571 Inspiration4 proteomics, RadLab ISS DosTel radiation, Barger 2014 ISS sleep tables, and 572 NASA PMC publications.",
            crumbs=[("Home", "/"), ("NASA Data Notes", "/data")],
            body_html=body,
        )

    @router.get("/data/{slug}", include_in_schema=False)
    async def data_note_detail(slug: str) -> HTMLResponse:
        note = DATA_NOTES.get(slug)
        if not note:
            raise HTTPException(status_code=404, detail="Unknown data note")

        detail_table = ""
        if slug == "osd-571-inspiration4-proteomics":
            rows = "".join(
                f'<tr><th>{escape(b["gene"])}</th><td>{escape(b["clinical_label"])}</td>'
                f'<td>{b["preflight_log10_mean"]:.3f}</td><td>{b["immediate_postflight_log10_mean"]:.3f}</td>'
                f'<td><strong>{b["postflight_fold_change"]:.2f}x</strong></td><td>{b["postflight_z_score"]:+.2f}</td></tr>'
                for b in osdr_empirical.get("biomarkers", [])
            )
            detail_table = f"""
            <h2>All 14 bundled SpaceX Inspiration4 plasma proteins (C001–C004)</h2>
            <div class="table-wrap"><table>
              <thead><tr><th>Gene</th><th>Biological Role</th><th>Pre-flight log<sub>10</sub> Mean</th><th>R+1 log<sub>10</sub> Mean</th><th>R+1 Fold Change</th><th>Post-flight z-score</th></tr></thead>
              <tbody>{rows}</tbody>
            </table></div>
            """
        elif slug == "radlab-iss-dostel-radiation":
            rl = empirical_supplements["radlab_iss_sample"]
            summary_rows = "".join(
                f'<tr><th>{escape(inst)}</th><td>{vals["samples"]}</td><td>{vals["mean_uGy_h"]:.3f} µGy/h</td><td>{vals["peak_uGy_h"]:.3f} µGy/h</td><td>{vals["min_uGy_h"]:.3f} µGy/h</td></tr>'
                for inst, vals in rl["instrument_summary"].items()
            )
            sample_rows = "".join(
                f'<tr><td>{escape(r["t"])}</td><td>{escape(r["inst"])}</td><td>{r["dose"]:.3f}</td><td>{r["alt"]:.1f} km</td><td>{r["lat"]:.2f}°, {r["lon"]:.2f}°</td><td>{r["l"]:.2f}</td></tr>'
                for r in rl["records"][:10]
            )
            detail_table = f"""
            <h2>ISS DosTel1 &amp; DosTel2 summary (164 rows)</h2>
            <div class="table-wrap"><table>
              <thead><tr><th>Instrument</th><th>Samples</th><th>Mean Dose Rate</th><th>Peak Dose Rate</th><th>Min Dose Rate</th></tr></thead>
              <tbody>{summary_rows}</tbody>
            </table></div>
            <h2>First 10 orbital telemetry rows from /api/aura/radlab</h2>
            <div class="table-wrap"><table>
              <thead><tr><th>UTC Timestamp</th><th>Instrument</th><th>Dose (µGy/h)</th><th>Altitude</th><th>Lat, Lon</th><th>L-shell</th></tr></thead>
              <tbody>{sample_rows}</tbody>
            </table></div>
            """
        elif slug == "barger-2014-iss-sleep-adaptation":
            t1 = empirical_supplements["barger_2014_sleep"]["tables"][0]["rows"]
            head = "".join(f"<th>{escape(c)}</th>" for c in t1[0])
            body_rows = "".join(
                "<tr>" + "".join(f"<td>{escape(c)}</td>" for c in r) + "</tr>"
                for r in t1[1:]
            )
            detail_table = f"""
            <h2>Published Table 1 — Space Shuttle &amp; ISS Mission Sleep Outcomes (PMC4188436)</h2>
            <div class="table-wrap"><table>
              <thead><tr>{head}</tr></thead>
              <tbody>{body_rows}</tbody>
            </table></div>
            """
        elif slug == "nasa-pmc-space-biology-corpus":
            pop_counts: dict[str, int] = {}
            for pub in aura_corpus.get("publications", []):
                dom = pub.get("population_domain", "space_biology_general")
                pop_counts[dom] = pop_counts.get(dom, 0) + 1
            pop_rows = "".join(
                f"<tr><th>{escape(k)}</th><td>{v}</td><td>{'Included in human_only=true' if k in ('human', 'space_biology_general') else 'Excluded in human_only=true (caveat required)'}</td></tr>"
                for k, v in sorted(pop_counts.items(), key=lambda kv: -kv[1])
            )
            detail_table = f"""
            <h2>AURA indexed document counts ({len(aura_index.docs)} total offline documents)</h2>
            <div class="table-wrap"><table>
              <thead><tr><th>Collection</th><th>Count</th><th>Role</th></tr></thead>
              <tbody>
                <tr><th>NASA Space Biology PMC Publications</th><td>{aura_corpus.get('total_publications', 0)}</td><td>Peer-reviewed spaceflight literature tagged by organism/domain</td></tr>
                <tr><th>Reviewed Space-Medicine Sources</th><td>{len(knowledge_bundle.get('sources', []))}</td><td>Operational NASA standards, HRP evidence books, and clinical guidance</td></tr>
                <tr><th>Bilingual Space-Medicine Concepts</th><td>{len(knowledge_bundle.get('concepts', []))}</td><td>EN/ES operational definitions with explicit scientific limitations</td></tr>
                <tr><th>Apple Watch / iPhone Biomarker Studies</th><td>{len(knowledge_bundle.get('apple_studies', []))}</td><td>Peer-reviewed human wearable validation studies</td></tr>
              </tbody>
            </table></div>
            <h2>Population-domain guardrail breakdown across 572 PMC papers</h2>
            <div class="table-wrap"><table>
              <thead><tr><th>Population Domain</th><th>Papers</th><th>Guardrail Behavior</th></tr></thead>
              <tbody>{pop_rows}</tbody>
            </table></div>
            """

        body = f"""
        <p class="eyebrow">Empirical NASA Data Note · Checked <time datetime="{MODIFIED_DATE}">November 21, 2026</time></p>
        <h1>{escape(note["h1"])}</h1>
        <div class="direct-answer"><p>{escape(note["direct_answer"])}</p></div>
        <div class="actions">
          <a class="btn primary" href="{escape(note['api_url'])}">Inspect Live JSON API</a>
          <a class="btn" href="{escape(note['source_url'])}" target="_blank" rel="noopener">Official NASA / Primary Source</a>
          <a class="btn" href="/?tab=evidence">Open Evidence Tab</a>
          <a class="btn" href="/data">All NASA Data Notes</a>
        </div>
        {detail_table}
        """
        return _render_page(
            path=f"/data/{slug}",
            title=note["title"],
            description=note["description"],
            crumbs=[("Home", "/"), ("NASA Data Notes", "/data"), (note["title"], f"/data/{slug}")],
            body_html=body,
            extra_graph=[
                {
                    "@type": "Dataset",
                    "name": note["title"],
                    "description": note["description"],
                    "url": f"{BASE_URL}/data/{slug}",
                    "isBasedOn": note["source_url"],
                    "dateModified": MODIFIED_DATE,
                    "license": "https://spdx.org/licenses/MIT.html",
                    "creator": {"@type": "Organization", "name": "Team AI-MED 01"},
                }
            ],
            faq_pairs=note["faq"],
        )

    # ------------------------------------------------------------------
    # 4. /guides hub & /guides/{slug} technical guides
    # ------------------------------------------------------------------
    @router.get("/guides", include_in_schema=False)
    async def guides_hub() -> HTMLResponse:
        cards = "".join(
            f'<article class="card"><h3><a href="/guides/{escape(slug)}">{escape(g["title"])}</a></h3>'
            f'<p>{escape(g["direct_answer"])}</p>'
            f'<p><a href="/guides/{escape(slug)}">Read full technical guide</a></p></article>'
            for slug, g in GUIDES.items()
        )
        body = f"""
        <p class="eyebrow">Technical Architecture &amp; Space-Medicine Guides · Team AI-MED 01</p>
        <h1>How are AstroKinetics · ASTRA’s offline scoring, safety gates, and volumetry engineered?</h1>
        <div class="direct-answer">
          <p><strong>Four concise technical guides document the deterministic math and safety architecture behind AstroKinetics · ASTRA:</strong> offline Mars-blackout PWA parity, 8-DOF Mahalanobis covariance whitening, the NASA HUNCH 8-red-flag gate with missing-data abstention, and closed-mesh signed tetrahedral LiDAR volumetry.</p>
        </div>
        <div class="grid">{cards}</div>
        """
        return _render_page(
            path="/guides",
            title="Astronaut Health Software Architecture & Verification Guides",
            description="Technical guides covering offline Mars blackout triage, 8-DOF Mahalanobis whitening, NASA HUNCH safety gates, and signed tetrahedral LiDAR volumetry.",
            crumbs=[("Home", "/"), ("Technical Guides", "/guides")],
            body_html=body,
        )

    @router.get("/guides/{slug}", include_in_schema=False)
    async def guide_detail(slug: str) -> HTMLResponse:
        g = GUIDES.get(slug)
        if not g:
            raise HTTPException(status_code=404, detail="Unknown guide")
        sections_html = "".join(
            f"<h2>{escape(h)}</h2><p>{escape(p)}</p>" for h, p in g["sections"]
        )
        other_guides = " · ".join(
            f'<a href="/guides/{escape(oslug)}">{escape(og["title"])}</a>'
            for oslug, og in GUIDES.items()
            if oslug != slug
        )
        body = f"""
        <p class="eyebrow">Technical Guide · AstroKinetics · ASTRA · Houston, TX</p>
        <h1>{escape(g["h1"])}</h1>
        <div class="direct-answer"><p>{escape(g["direct_answer"])}</p></div>
        <div class="actions">
          <a class="btn primary" href="/">Open Live Workstation</a>
          <a class="btn" href="/api/verification-report">Live Verification JSON</a>
          <a class="btn" href="/for-judges">Judge Evaluation Kit</a>
        </div>
        {sections_html}
        <h2>Related technical guides</h2>
        <p>{other_guides}</p>
        """
        return _render_page(
            path=f"/guides/{slug}",
            title=g["title"],
            description=g["description"],
            crumbs=[("Home", "/"), ("Technical Guides", "/guides"), (g["title"], f"/guides/{slug}")],
            body_html=body,
            extra_graph=[
                {
                    "@type": "TechArticle",
                    "headline": g["title"],
                    "description": g["description"],
                    "datePublished": PUBLISHED_DATE,
                    "dateModified": MODIFIED_DATE,
                    "author": {"@type": "Organization", "name": "Team AI-MED 01"},
                    "url": f"{BASE_URL}/guides/{slug}",
                }
            ],
            faq_pairs=g["faq"],
        )

    # ------------------------------------------------------------------
    # 5. Dynamic /sitemap.xml, RSS 2.0 /feed.xml, and IndexNow verification
    # ------------------------------------------------------------------
    @router.get("/sitemap.xml", include_in_schema=False)
    async def dynamic_sitemap() -> Response:
        urls: list[tuple[str, str, str]] = [
            ("/", MODIFIED_DATE, "1.0"),
            ("/project", MODIFIED_DATE, "0.95"),
            ("/for-judges", MODIFIED_DATE, "0.95"),
            ("/scenarios", MODIFIED_DATE, "0.90"),
            ("/data", MODIFIED_DATE, "0.90"),
            ("/guides", MODIFIED_DATE, "0.90"),
            ("/video", MODIFIED_DATE, "0.85"),
            ("/story", MODIFIED_DATE, "0.75"),
            ("/demo/", MODIFIED_DATE, "0.75"),
            ("/llms.txt", MODIFIED_DATE, "0.85"),
            ("/llms-full.txt", MODIFIED_DATE, "0.80"),
            ("/feed.xml", MODIFIED_DATE, "0.70"),
        ]
        for sid in mission_scenarios:
            urls.append((f"/scenarios/{sid}", MODIFIED_DATE, "0.85"))
        for slug in DATA_NOTES:
            urls.append((f"/data/{slug}", MODIFIED_DATE, "0.85"))
        for slug in GUIDES:
            urls.append((f"/guides/{slug}", MODIFIED_DATE, "0.85"))

        entries = "".join(
            f"  <url><loc>{BASE_URL}{p}</loc><lastmod>{lm}</lastmod><priority>{pr}</priority></url>\n"
            for p, lm, pr in urls
        )
        xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}</urlset>\n'
        return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "no-cache, must-revalidate"})

    @router.get("/feed.xml", include_in_schema=False)
    async def rss_feed() -> Response:
        items_spec = [
            ("/for-judges", "2-Minute Judge & Educator Verification Kit", "5-criterion NASA Space Apps evidence map, live verification JSON, and downloadable judge checklist."),
            ("/project", "AstroKinetics · ASTRA v5.3 Overview & Software Verification", "7/7 live read-only checks, 20/20 offline parity checks, and honest scope disclosures."),
            ("/scenarios", "Four Scripted Spaceflight Mission Scenarios", "Nominal Lunar Orbit (99.2), Cabin CO2 Drift (78.3), 0g Squat Compensation (44.7), SPE Blackout (12.0)."),
            ("/data/osd-571-inspiration4-proteomics", "NASA OSDR OSD-571 Inspiration4 Proteomics Data Note", "14 longitudinal plasma proteins across C001-C004 and 6 flight timepoints."),
            ("/data/radlab-iss-dostel-radiation", "NASA RadLab ISS DosTel Radiation Telemetry Data Note", "164 empirical ISS DosTel1/DosTel2 absorbed dose-rate observations."),
            ("/data/barger-2014-iss-sleep-adaptation", "Barger et al. (2014) ISS Sleep Adaptation Data Note", "Earth-1g vs Mission-Microgravity sleep baseline context from PMC4188436."),
            ("/data/nasa-pmc-space-biology-corpus", "NASA Space Biology PMC Corpus & Human-vs-Rodent Guardrails", "673 offline-indexed space-medicine records with strict human_only filtering."),
            ("/guides/offline-astronaut-health-monitoring-mars-blackout", "Guide: Offline Astronaut Health Monitoring During Mars Blackouts", "Service Worker caching, exact Python/JS parity, and offline privacy redaction."),
            ("/guides/mahalanobis-multivariate-triage-spaceflight", "Guide: 8-DOF Multivariate Mahalanobis Whitening", "Coupled multi-sensor drift attribution and closed-form Chi-Square survival."),
            ("/guides/nasa-hunch-red-flag-safety-gate-abstention", "Guide: NASA HUNCH 8-Red-Flag Gate & Missing-Data Abstention", "Red flags override poor capture; degraded scans abstain instead of imputing normal."),
            ("/guides/lidar-tetrahedral-volumetry-fluid-shift", "Guide: Closed-Mesh Signed Tetrahedral LiDAR Volumetry", "0.00% analytical error on 1000.0 mL cube plus 82% coverage and anti-hallucination gates."),
        ]
        items_xml = "".join(
            f"    <item>\n"
            f"      <title>{escape(t)}</title>\n"
            f"      <link>{BASE_URL}{p}</link>\n"
            f"      <guid>{BASE_URL}{p}</guid>\n"
            f"      <pubDate>{RFC822_MODIFIED}</pubDate>\n"
            f"      <description>{escape(d)}</description>\n"
            f"    </item>\n"
            for p, t, d in items_spec
        )
        rss = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0">\n'
            "  <channel>\n"
            "    <title>AstroKinetics · ASTRA (Team AI-MED 01, Houston) — Updates &amp; Verification Feed</title>\n"
            f"    <link>{BASE_URL}/</link>\n"
            "    <description>Offline-first astronaut health monitoring workstation, empirical NASA data notes, and automated software verification updates.</description>\n"
            "    <language>en-us</language>\n"
            f"    <lastBuildDate>{RFC822_MODIFIED}</lastBuildDate>\n"
            f"{items_xml}"
            "  </channel>\n"
            "</rss>\n"
        )
        return Response(content=rss, media_type="application/rss+xml; charset=utf-8", headers={"Cache-Control": "no-cache, must-revalidate"})

    @router.get("/indexnow.txt", include_in_schema=False)
    @router.get(f"/{INDEXNOW_KEY}.txt", include_in_schema=False)
    async def indexnow_key_file() -> PlainTextResponse:
        return PlainTextResponse(content=INDEXNOW_KEY, headers={"Cache-Control": "no-cache, must-revalidate"})

    # ------------------------------------------------------------------
    # 6. Public Read-Only MCP Endpoint (JSON-RPC 2.0 · MCP 2025-06-18)
    # ------------------------------------------------------------------
    MCP_TOOLS = [
        {
            "name": "get_verification_report",
            "description": "Run and return the live 7-group deterministic software, privacy, safety, LiDAR, and NASA-data verification report.",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        },
        {
            "name": "list_mission_scenarios",
            "description": "List all 4 scripted spaceflight mission scenarios with their live-computed Mahalanobis D_M, readiness score, and alert tier.",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        },
        {
            "name": "evaluate_telemetry",
            "description": "Evaluate an 8-DOF astronaut telemetry snapshot (heart_rate_bpm, hrv_rmssd_ms, cabin_co2_mmhg, pvt_reaction_ms, joint_rom_deg, etc.) using the deterministic Mahalanobis engine.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "cabin_co2_mmhg": {"type": "number"},
                    "pvt_reaction_ms": {"type": "number"},
                    "heart_rate_bpm": {"type": "number"},
                    "hrv_rmssd_ms": {"type": "number"},
                    "radiation_msv_day": {"type": "number"},
                    "joint_rom_deg": {"type": "number"},
                    "bilateral_symmetry_pct": {"type": "number"},
                    "privacy_tier": {"type": "string", "enum": ["astronaut_private", "cmo_operational", "flight_surgeon_packet"]},
                },
            },
        },
        {
            "name": "search_nasa_evidence",
            "description": "Search the 673-document offline AURA NASA space-medicine corpus via deterministic BM25 with optional human_only=true guardrail.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "human_only": {"type": "boolean", "default": True},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
        {
            "name": "get_nasa_datasets_summary",
            "description": "Return counts, URLs, and check dates for all bundled empirical NASA datasets (OSD-571, RadLab ISS DosTel, Barger 2014, 572 NASA PMC corpus).",
            "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    ]

    @router.post("/api/mcp/", include_in_schema=False)
    @router.post("/api/mcp", include_in_schema=False)
    async def public_mcp_endpoint(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except Exception:
            return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}, status_code=400)

        req_id = payload.get("id")
        method = payload.get("method")
        params = payload.get("params") or {}

        if method == "initialize":
            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2025-06-18",
                        "capabilities": {"tools": {}},
                        "serverInfo": {
                            "name": "AstroKinetics · ASTRA Space Health Data",
                            "version": "5.3.0",
                        },
                    },
                }
            )
        if method == "notifications/initialized":
            return JSONResponse({"jsonrpc": "2.0", "id": req_id, "result": {}})
        if method == "tools/list":
            return JSONResponse({"jsonrpc": "2.0", "id": req_id, "result": {"tools": MCP_TOOLS}})
        if method == "tools/call":
            tname = params.get("name")
            targs = params.get("arguments") or {}
            if tname == "get_verification_report":
                result_obj = await verification_fn()
            elif tname == "list_mission_scenarios":
                result_obj = {
                    sid: {
                        "label": sc["label"],
                        "mission_sol": sc["mission_sol"],
                        "comm_mode": sc["comm_mode"],
                        "evaluation": {
                            k: evaluate_fn(telemetry_input_cls(**sc["telemetry"]))[k]
                            for k in ("overall_status", "readiness_score", "multivariate_stats")
                        },
                    }
                    for sid, sc in mission_scenarios.items()
                }
            elif tname == "evaluate_telemetry":
                result_obj = evaluate_fn(telemetry_input_cls(**targs))
            elif tname == "search_nasa_evidence":
                q = str(targs.get("query", "")).strip()
                if not q:
                    return JSONResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32602, "message": "query is required"}}, status_code=400)
                hits = aura_index.search(q, human_only=bool(targs.get("human_only", True)), limit=max(1, min(15, int(targs.get("limit", 5)))))
                result_obj = {"query": q, "human_only": bool(targs.get("human_only", True)), "count": len(hits), "results": hits}
            elif tname == "get_nasa_datasets_summary":
                result_obj = {
                    "sources_checked": SOURCE_CHECKS,
                    "osd571_proteins": len(osdr_empirical.get("biomarkers", [])),
                    "radlab_iss_dostel_rows": empirical_supplements["radlab_iss_sample"]["row_count"],
                    "barger_sleep_tables": len(empirical_supplements["barger_2014_sleep"]["tables"]),
                    "aura_total_docs": len(aura_index.docs),
                    "nasa_pmc_publications": aura_corpus.get("total_publications", 0),
                }
            else:
                return JSONResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown tool: {tname}"}}, status_code=404)

            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(result_obj, ensure_ascii=False)}],
                        "isError": False,
                    },
                }
            )

        return JSONResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}, status_code=404)

    return router
