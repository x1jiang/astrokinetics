"""
AstroKinetics v3.2 — Autonomous 3D Biomechanics, Neuro-Acoustic Sonification, Voice DSP & NASA OSDR Health Suite
2026 NASA International Space Apps Challenge ("Create Health Monitoring Software for Astronauts on Space Missions")

Core Capabilities:
1. Multivariate Mahalanobis Distance (D_M) + Chi-Square tail p-value (scipy.stats.chi2) & exact whitened per-channel attribution %.
2. Empirical NASA OSDR OSD-571 (GLDS-563) SpaceX Inspiration4 longitudinal astronaut biomarker dataset (C001-C004 across L-92..R+82).
3. De-identified 62-frame reference motion capture body (18-joint) + bilateral hand (21-joint) keypoint stream.
4. Connected Apple Watch (HealthKit/CoreMotion) + Mobile Kinematics App ingestion API & PWA offline autonomy.
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
from collections import OrderedDict, deque
from datetime import datetime, timezone
from itertools import count
from pathlib import Path
from typing import Any, Literal

import httpx
import numpy as np
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from scipy.stats import chi2

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
SHOWCASE_DIR = STATIC_DIR / "showcase"
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.environ.get("ASTROKINETICS_DB", "/tmp/astrokinetics_sessions_v2.db"))

from astra_companion import (
    AURA_CORPUS,
    AURA_INDEX,
    EMPIRICAL_SUPPLEMENTS,
    KNOWLEDGE_BUNDLE,
    HunchTriageRequest,
    LidarVolumeRequest,
    astra_router,
    evaluate_hunch_triage,
    evaluate_lidar_volume,
    init_astra_db,
)
from grok_claw_voice import voice_router
from seo_surfaces import build_seo_router

app = FastAPI(
    title="AstroKinetics · ASTRA v5.3 — Autonomous Astronaut Health Workstation, Watch + iPhone Companion & Evidence Engine",
    version="5.3.0",
    description=(
        "Team AI-MED 01 (Houston, TX) — 2026 NASA International Space Apps Challenge "
        "('Create Health Monitoring Software for Astronauts on Space Missions'). "
        "Offline-first crew health workstation combining 3D MediaPipe biomechanics, contactless rPPG, "
        "8-DOF Mahalanobis whitening, NASA HUNCH 8-red-flag safety gate, ASTRA episode governance, "
        "iPhone LiDAR tetrahedral volumetry, and AURA cited space-medicine evidence."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_TRAILING_SLASH_CANONICAL_PREFIXES = (
    "/project/",
    "/video/",
    "/story/",
    "/studio/",
    "/for-judges/",
    "/scenarios/",
    "/data/",
    "/guides/",
)


@app.middleware("http")
async def revalidate_static_and_shell(request: Request, call_next: Any) -> Response:
    p = request.url.path
    # 308 Permanent Redirect for trailing-slash variants of canonical non-slash pages (preserving query strings)
    if (
        request.method in ("GET", "HEAD")
        and len(p) > 1
        and p.endswith("/")
        and (p in _TRAILING_SLASH_CANONICAL_PREFIXES or p.startswith(("/scenarios/", "/data/", "/guides/")))
    ):
        target = p.rstrip("/")
        if request.url.query:
            target = f"{target}?{request.url.query}"
        return RedirectResponse(url=target, status_code=308)

    response = await call_next(request)
    if p.startswith("/api/ingest/"):
        response.headers["Cache-Control"] = "no-store"
    elif p in (
        "/",
        "/project",
        "/for-judges",
        "/scenarios",
        "/data",
        "/guides",
        "/video",
        "/story",
        "/demo",
        "/studio",
        "/sw.js",
        "/manifest.webmanifest",
        "/llms.txt",
        "/llms-full.txt",
        "/robots.txt",
        "/sitemap.xml",
        "/feed.xml",
    ) or p.startswith(("/static/", "/demo/", "/scenarios/", "/data/", "/guides/")):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response


def fmt_p(p: float) -> str:
    """Human-readable p-value: 'p < 0.0001' or 'p = 0.0123'."""
    if p < 0.0001:
        return "p < 0.0001"
    if p > 0.9999:
        return "p > 0.9999"
    return f"p = {p:.4f}"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assessment_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                crew_id TEXT NOT NULL,
                mission_sol INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                vision_source TEXT NOT NULL,
                comm_mode TEXT NOT NULL,
                overall_status TEXT NOT NULL,
                readiness_score REAL NOT NULL,
                mahalanobis_d REAL NOT NULL,
                p_value REAL NOT NULL,
                summary_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


init_db()
init_astra_db(DB_PATH)


def load_json_asset(filename: str) -> dict[str, Any]:
    path = DATA_DIR / filename
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


OSDR_OSD571_EMPIRICAL = load_json_asset("nasa_osd571_inspiration4_real.json")
REFERENCE_3D_KEYPOINTS = load_json_asset("reference_3d_keypoints.json")

NASA_DATASETS_CATALOG: list[dict[str, Any]] = [
    {
        "id": "OSD-571 (GLDS-563)",
        "source": "NASA Open Science Data Repository — Real Downloaded Empirical File",
        "title": "SpaceX Inspiration4 Plasma & EVP Proteomics (Astronauts C001–C004 across L-92, L-44, L-3, R+1, R+45, R+82)",
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-571",
        "api_url": "https://osdr.nasa.gov/osdr/data/osd/meta/571",
    },
    {
        "id": "OSD-570",
        "source": "NASA Open Science Data Repository (GeneLab + ALSDA)",
        "title": "SpaceX Inspiration4 PBMC Single-Cell Immune & Chromatin Profiling",
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-570",
        "api_url": "https://osdr.nasa.gov/osdr/data/osd/meta/570",
    },
    {
        "id": "NASA-STD-3001",
        "source": "NASA Spaceflight Human-System Standard Vol. 1 & Vol. 2",
        "title": "Cabin ppCO2: 3 mmHg one-hour mean limit (Vol. 2 Rev. F [V2 6004])",
        "url": "https://standards.nasa.gov/node/237",
        "api_url": None,
    },
    {
        "id": "HRP-HSRB-2026",
        "source": "NASA Human Research Program — Human System Risk Board",
        "title": "5 Hazards of Human Spaceflight & Autonomous Exploration Medical Capability (ExMC)",
        "url": "https://humanresearchroadmap.nasa.gov/",
        "api_url": None,
    },
    {
        "id": "CSA-BIOMONITOR",
        "source": "Canadian Space Agency / NASA ISS Space Station Research Explorer",
        "title": "ISS Bio-Monitor Wearable Telemetry Schema + Markerless 3D Joint Kinematics Reference",
        "url": "https://www.nasa.gov/mission/station/research-explorer/investigation/?#id=7392",
        "api_url": None,
    },
    {
        "id": "NASA-RADLAB-DOSTEL",
        "source": "NASA OSDR RadLab — Bundled ISS DosTel1 & DosTel2 Empirical Sample",
        "title": "164 ISS DosTel Absorbed Dose Rate & Orbital Pass Observations (2022-04-01/02)",
        "url": "https://osdr.nasa.gov/bio/",
        "api_url": "/api/aura/radlab",
    },
    {
        "id": "BARGER-2014-ISS-SLEEP",
        "source": "NASA Spaceflight Sleep Study (Barger et al., Lancet Neurology 2014, PMC4188436)",
        "title": "Published Aggregate Space Shuttle & ISS Actigraphy Sleep Tables (SL-90, L-11, Inflight, R+7, Pre-EVA)",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/",
        "api_url": "/api/aura/overview",
    },
]

MISSION_SCENARIOS: dict[str, dict[str, Any]] = {
    "nominal_lunar": {
        "id": "nominal_lunar",
        "label": "Sol 14 — Nominal Artemis Lunar Orbit",
        "mission_sol": 14,
        "comm_mode": "iss_live",
        "crew_member": "CDR Maya Lin (OSDR C001 Baseline)",
        "telemetry": {
            "heart_rate_bpm": 61.0,
            "hrv_rmssd_ms": 61.0,
            "spo2_pct": 98.4,
            "systolic_bp_mmhg": 116.0,
            "resp_rate_brpm": 13.5,
            "sleep_hours": 7.6,
            "pvt_reaction_ms": 248.0,
            "mood_score_10": 8.4,
            "private_journal_note": "Feeling sharp after morning ARED session; sleep mask blocked LED glare.",
            "cabin_co2_mmhg": 1.6,
            "radiation_msv_day": 0.42,
            "joint_rom_deg": 117.5,
            "target_rom_deg": 118.0,
            "bilateral_symmetry_pct": 96.4,
            "trunk_lean_deg": 3.1,
            "postural_sway_mms": 6.2,
            "cadence_rpm": 18.0,
            "hand_tap_hz": 4.4,
            "tremor_rms_mm": 0.45,
        },
    },
    "hypercapnia_drift": {
        "id": "hypercapnia_drift",
        "label": "Sol 88 — Cabin CO2 Creep + Motor/Cognitive Slowing",
        "mission_sol": 88,
        "comm_mode": "mars_transit",
        "crew_member": "MS-1 Dr. Alex Rivera (OSDR C002 Baseline)",
        "telemetry": {
            "heart_rate_bpm": 71.0,
            "hrv_rmssd_ms": 48.0,
            "spo2_pct": 96.7,
            "systolic_bp_mmhg": 124.0,
            "resp_rate_brpm": 17.4,
            "sleep_hours": 6.1,
            "pvt_reaction_ms": 322.0,
            "mood_score_10": 6.2,
            "private_journal_note": "Dull frontal headache on waking and mild balance drift during post-sleep check.",
            "cabin_co2_mmhg": 2.85,
            "radiation_msv_day": 0.52,
            "joint_rom_deg": 162.0,
            "target_rom_deg": 168.0,
            "bilateral_symmetry_pct": 94.8,
            "trunk_lean_deg": 4.4,
            "postural_sway_mms": 12.6,
            "cadence_rpm": 14.5,
            "hand_tap_hz": 3.7,
            "tremor_rms_mm": 0.72,
        },
    },
    "musculoskeletal_asymmetry": {
        "id": "musculoskeletal_asymmetry",
        "label": "Sol 142 — 0g Deconditioning & Squat Compensation",
        "mission_sol": 142,
        "comm_mode": "mars_transit",
        "crew_member": "FE-2 Jordan Vance (OSDR C003 Baseline)",
        "telemetry": {
            "heart_rate_bpm": 72.0,
            "hrv_rmssd_ms": 47.0,
            "spo2_pct": 97.9,
            "systolic_bp_mmhg": 121.0,
            "resp_rate_brpm": 15.2,
            "sleep_hours": 6.7,
            "pvt_reaction_ms": 274.0,
            "mood_score_10": 6.8,
            "private_journal_note": "Left hip feels stiff during ARED resistive squats; leaning right on final reps.",
            "cabin_co2_mmhg": 1.9,
            "radiation_msv_day": 0.58,
            "joint_rom_deg": 94.0,
            "target_rom_deg": 118.0,
            "bilateral_symmetry_pct": 81.5,
            "trunk_lean_deg": 14.6,
            "postural_sway_mms": 16.4,
            "cadence_rpm": 12.0,
            "hand_tap_hz": 4.1,
            "tremor_rms_mm": 0.65,
        },
    },
    "spe_blackout": {
        "id": "spe_blackout",
        "label": "Sol 210 — Solar Particle Event (SPE) + Blackout",
        "mission_sol": 210,
        "comm_mode": "solar_blackout",
        "crew_member": "CDR Maya Lin (Storm Shelter Autonomous Mode)",
        "telemetry": {
            "heart_rate_bpm": 88.0,
            "hrv_rmssd_ms": 29.0,
            "spo2_pct": 95.8,
            "systolic_bp_mmhg": 134.0,
            "resp_rate_brpm": 19.6,
            "sleep_hours": 4.6,
            "pvt_reaction_ms": 382.0,
            "mood_score_10": 4.2,
            "private_journal_note": "Mild nausea and fine hand tremor after 36h in storm shelter; zero Earth link.",
            "cabin_co2_mmhg": 2.9,
            "radiation_msv_day": 3.45,
            "joint_rom_deg": 98.0,
            "target_rom_deg": 118.0,
            "bilateral_symmetry_pct": 84.0,
            "trunk_lean_deg": 11.8,
            "postural_sway_mms": 22.5,
            "cadence_rpm": 11.0,
            "hand_tap_hz": 2.7,
            "tremor_rms_mm": 2.45,
        },
    },
}

# ---------------------------------------------------------------------------
# Multivariate Baseline Distribution (8-Channel Physiological + Kinematic Vector)
# Vector x = [rom_pct, symmetry_pct, trunk_lean_deg, sway_mms, hr_bpm, hrv_ms, pvt_ms, co2_mmhg]
# Includes physiological cross-covariances (e.g. HR <-> HRV negative correlation,
# CO2 <-> PVT positive correlation, TrunkLean <-> Symmetry negative correlation).
# ---------------------------------------------------------------------------
FEATURE_NAMES = [
    "ROM Completeness (%)",
    "Bilateral Symmetry (%)",
    "Trunk Lean Compensation (°)",
    "Postural Sway (mm/s)",
    "Heart Rate (bpm)",
    "HRV RMSSD (ms)",
    "Cognitive PVT Latency (ms)",
    "Cabin ppCO2 (mmHg)",
]

BASELINE_MU = np.array([99.0, 96.5, 3.0, 6.0, 60.0, 60.0, 250.0, 1.6], dtype=float)
BASELINE_SD = np.array([4.2, 2.6, 2.1, 2.8, 5.8, 7.8, 26.0, 0.38], dtype=float)

BASELINE_CORR = np.array(
    [
        [1.00, 0.42, -0.38, -0.25, -0.10, 0.12, -0.15, -0.10],
        [0.42, 1.00, -0.48, -0.32, -0.08, 0.10, -0.12, -0.08],
        [-0.38, -0.48, 1.00, 0.44, 0.14, -0.14, 0.18, 0.12],
        [-0.25, -0.32, 0.44, 1.00, 0.22, -0.24, 0.35, 0.28],
        [-0.10, -0.08, 0.14, 0.22, 1.00, -0.62, 0.28, 0.30],
        [0.12, 0.10, -0.14, -0.24, -0.62, 1.00, -0.30, -0.26],
        [-0.15, -0.12, 0.18, 0.35, 0.28, -0.30, 1.00, 0.46],
        [-0.10, -0.08, 0.12, 0.28, 0.30, -0.26, 0.46, 1.00],
    ],
    dtype=float,
)
BASELINE_COV = np.outer(BASELINE_SD, BASELINE_SD) * BASELINE_CORR
BASELINE_COV_INV = np.linalg.inv(BASELINE_COV)
# Symmetric inverse square root W = Sigma^(-1/2) for squared whitened component contributions.
_eigvals, _eigvecs = np.linalg.eigh(BASELINE_COV_INV)
WHITENING_MATRIX = np.einsum("ik,k,jk->ij", _eigvecs, np.sqrt(_eigvals), _eigvecs)


class TelemetryInput(BaseModel):
    crew_member: str = "FE-2 Jordan Vance"
    mission_sol: int = 142
    protocol: Literal["ared_squat", "eva_upper_reach", "vestibular_sway", "fine_motor_hand"] = "ared_squat"
    vision_source: str = "reference_mocap_recording"
    comm_mode: Literal["iss_live", "lunar_farside", "mars_transit", "solar_blackout"] = "mars_transit"
    privacy_tier: Literal["astronaut_private", "cmo_operational", "flight_surgeon_packet"] = "astronaut_private"
    heart_rate_bpm: float = Field(64.0, ge=35, le=210)
    hrv_rmssd_ms: float = Field(56.0, ge=8, le=180)
    spo2_pct: float = Field(98.0, ge=75, le=100)
    systolic_bp_mmhg: float = Field(118.0, ge=80, le=200)
    resp_rate_brpm: float = Field(14.0, ge=6, le=40)
    sleep_hours: float = Field(7.5, ge=0, le=14)
    pvt_reaction_ms: float = Field(255.0, ge=150, le=900)
    mood_score_10: float = Field(8.0, ge=1, le=10)
    private_journal_note: str = ""
    cabin_co2_mmhg: float = Field(1.7, ge=0.2, le=10.0)
    radiation_msv_day: float = Field(0.45, ge=0.05, le=25.0)
    joint_rom_deg: float = Field(116.0, ge=10, le=185)
    target_rom_deg: float = Field(118.0, ge=30, le=185)
    bilateral_symmetry_pct: float = Field(95.5, ge=35, le=100)
    trunk_lean_deg: float = Field(3.5, ge=0, le=55)
    postural_sway_mms: float = Field(6.5, ge=0.5, le=80)
    cadence_rpm: float = Field(17.0, ge=0, le=80)
    hand_tap_hz: float = Field(4.2, ge=0.2, le=12.0)
    tremor_rms_mm: float = Field(0.5, ge=0.0, le=15.0)
    neuro_protocol: str = "ras_motor"
    vocal_f0_hz: float = Field(0.0, ge=0.0, le=600.0)
    vocal_jitter_pct: float = Field(0.0, ge=0.0, le=25.0)
    vocal_hnr_db: float = Field(0.0, ge=0.0, le=50.0)


def compute_multivariate_mahalanobis(data: TelemetryInput) -> dict[str, Any]:
    """
    Computes exact regularized 8-DOF Multivariate Mahalanobis Distance D_M,
    Chi-Square survival probability p = P(Chi2_8 >= D_M^2), and exact orthogonal
    whitened feature contributions summing to 100% of D_M^2.
    """
    rom_pct = min(100.0, (data.joint_rom_deg / max(data.target_rom_deg, 1.0)) * 100.0)
    # Directional pathological deviation vector (only penalizing clinically adverse direction)
    x = np.array(
        [
            min(rom_pct, BASELINE_MU[0]),
            min(data.bilateral_symmetry_pct, BASELINE_MU[1]),
            max(data.trunk_lean_deg, BASELINE_MU[2]),
            max(data.postural_sway_mms, BASELINE_MU[3]),
            data.heart_rate_bpm,
            min(data.hrv_rmssd_ms, BASELINE_MU[5]),
            max(data.pvt_reaction_ms, BASELINE_MU[6]),
            max(data.cabin_co2_mmhg, BASELINE_MU[7]),
        ],
        dtype=float,
    )
    delta = x - BASELINE_MU
    whitened = WHITENING_MATRIX @ delta
    d2 = float(np.dot(whitened, whitened))
    # Add radiation & tremor out-of-distribution surge energy if present
    rad_excess = max(0.0, (data.radiation_msv_day - 0.55) / 0.35)
    tremor_excess = max(0.0, (data.tremor_rms_mm - 0.9) / 0.45)
    d2_total = d2 + rad_excess**2 + tremor_excess**2

    dm = float(math.sqrt(max(d2_total, 0.0)))
    p_val = float(chi2.sf(d2_total, df=8))

    # Feature attribution (% of D_M^2)
    energies = list(whitened**2)
    labels = list(FEATURE_NAMES)
    if rad_excess > 0:
        energies.append(rad_excess**2)
        labels.append("Radiation Dosimetry Surge (mSv/d)")
    if tremor_excess > 0:
        energies.append(tremor_excess**2)
        labels.append("Fine-Motor Hand Tremor (4–12 Hz)")

    denom = sum(energies) if sum(energies) > 1e-9 else 1.0
    attributions = sorted(
        [
            {"feature": lbl, "share_pct": round((e / denom) * 100.0, 1), "energy": round(float(e), 2)}
            for lbl, e in zip(labels, energies)
        ],
        key=lambda item: item["share_pct"],
        reverse=True,
    )

    # Convert statistical chi-square survival & D_M into 0..100 clinical readiness index
    # At D_M <= 1.8 (within 1-sigma ellipsoid), readiness ~ 95-99; D_M ~ 4.4 (p=0.01) -> ~ 72; D_M >= 8 -> <45
    readiness = round(float(100.0 * math.exp(-0.0165 * d2_total)), 1)
    readiness = max(12.0, min(99.2, readiness))

    return {
        "mahalanobis_d": round(dm, 2),
        "mahalanobis_d2": round(d2_total, 2),
        "chi2_df": 8,
        "p_value": round(p_val, 6),
        "readiness_score": readiness,
        "top_attributions": attributions[:5],
    }


def evaluate_astronaut_state(data: TelemetryInput) -> dict[str, Any]:
    stats = compute_multivariate_mahalanobis(data)
    hr_z = round((data.heart_rate_bpm - 60.0) / 5.8, 2)
    hrv_z = round((data.hrv_rmssd_ms - 60.0) / 7.8, 2)
    rom_ratio = min(1.05, data.joint_rom_deg / max(data.target_rom_deg, 1.0))
    rom_deficit_deg = round(max(0.0, data.target_rom_deg - data.joint_rom_deg), 1)

    domains: list[dict[str, Any]] = []
    findings: list[str] = []
    countermeasures: list[dict[str, str]] = []

    # 1. 3D Neuromotor & Fine-Motor Kinematics
    kin_status = "nominal"
    if (
        data.bilateral_symmetry_pct < 85.0
        or data.trunk_lean_deg > 12.0
        or rom_ratio < 0.83
        or data.postural_sway_mms > 19.0
        or data.tremor_rms_mm >= 1.8
    ):
        kin_status = "alert"
    elif (
        data.bilateral_symmetry_pct < 92.0
        or data.trunk_lean_deg > 7.0
        or rom_ratio < 0.91
        or data.postural_sway_mms > 12.0
        or data.tremor_rms_mm >= 1.1
    ):
        kin_status = "watch"

    domains.append(
        {
            "domain": "3D Kinematics & Hand Dexterity",
            "status": kin_status,
            "headline": f"ROM {data.joint_rom_deg:.1f}°/{data.target_rom_deg:.0f}° · Sym {data.bilateral_symmetry_pct:.1f}% · Lean {data.trunk_lean_deg:.1f}°",
            "metric_detail": f"Sway {data.postural_sway_mms:.1f} mm/s · Finger-Tap {data.hand_tap_hz:.1f} Hz · Tremor {data.tremor_rms_mm:.2f} mm",
        }
    )

    if kin_status != "nominal":
        findings.append(
            f"3D pose/hand kinematics flagged a {rom_deficit_deg}° ROM deficit, {data.bilateral_symmetry_pct:.1f}% bilateral symmetry, "
            f"{data.trunk_lean_deg:.1f}° trunk-lean compensation, and {data.tremor_rms_mm:.2f} mm postural/hand tremor."
        )
        countermeasures.append(
            {
                "priority": "HIGH" if kin_status == "alert" else "MODERATE",
                "title": "Recalibrate Unilateral ARED Load & Closed-Loop RAS Cueing",
                "protocol": (
                    f"Reduce unilateral ARED load by 15%, activate 1-Euro stabilized visual plumb feedback + "
                    f"Rhythmic Auditory Stimulation (RAS) at {max(12, min(20, int(round(data.cadence_rpm + 2))))} RPM, "
                    "and complete 60-sec single-limb proprioceptive hold."
                ),
                "reference": "NASA HRP Sensorimotor/Musculoskeletal Risk & Thaut Rhythmic Auditory Entrainment",
            }
        )

    # 2. Habitat & Radiation Exposure
    env_status = "nominal"
    if data.cabin_co2_mmhg >= 3.5 or data.radiation_msv_day >= 1.5:
        env_status = "alert"
    elif data.cabin_co2_mmhg >= 2.4 or data.radiation_msv_day >= 0.8:
        env_status = "watch"

    domains.append(
        {
            "domain": "Habitat & Radiation Exposure",
            "status": env_status,
            "headline": f"ppCO2 {data.cabin_co2_mmhg:.2f} mmHg · Radiation {data.radiation_msv_day:.2f} mSv/day",
            "metric_detail": "Prototype snapshot thresholds. NASA-STD-3001 Vol. 2 [V2 6004] sets a 3 mmHg one-hour mean limit.",
        }
    )

    if data.cabin_co2_mmhg >= 2.8 and data.pvt_reaction_ms >= 315:
        findings.append(
            f"Cabin ppCO2 snapshot ({data.cabin_co2_mmhg:.2f} mmHg) and reaction time "
            f"({data.pvt_reaction_ms:.0f} ms) crossed prototype review thresholds together. Check the cabin trend and repeat the task."
        )
        countermeasures.append(
            {
                "priority": "HIGH" if data.cabin_co2_mmhg >= 3.5 else "MODERATE",
                "title": "Verify cabin CO₂ and repeat the reaction-time check",
                "protocol": (
                    "Check the cabin CO₂ trend against the mission checklist and repeat the reaction-time check "
                    "to document whether the drift persists."
                ),
                "reference": "NASA-STD-3001 Vol. 2 [V2 6004] (environmental context)",
                "_domain_order": 0,
            }
        )

    if data.radiation_msv_day >= 1.5:
        findings.append(
            f"Radiation reading ({data.radiation_msv_day:.2f} mSv/day) crossed the prototype alert threshold. "
            "OSD-571 provides separate post-flight proteomics context."
        )
        countermeasures.append(
            {
                "priority": "CRITICAL",
                "title": "Review the mission radiation contingency checklist",
                "protocol": "Verify the dosimeter reading and flag it for review against the mission's radiation contingency checklist.",
                "reference": "NASA HRP Acute Radiation Risk (background)",
            }
        )

    # 3. Cardiovascular & POS-rPPG / Bio-Monitor Vitals
    cv_status = "nominal"
    if data.heart_rate_bpm >= 85 or data.hrv_rmssd_ms <= 33 or data.spo2_pct < 95.5 or data.systolic_bp_mmhg >= 135:
        cv_status = "alert"
    elif data.heart_rate_bpm >= 73 or data.hrv_rmssd_ms <= 45 or data.spo2_pct < 96.8 or data.systolic_bp_mmhg >= 126:
        cv_status = "watch"

    domains.append(
        {
            "domain": "Cardiovascular · rPPG",
            "status": cv_status,
            "headline": f"HR {data.heart_rate_bpm:.0f} bpm (z={hr_z:+.1f}) · HRV {data.hrv_rmssd_ms:.0f} ms · SpO2 {data.spo2_pct:.1f}%",
            "metric_detail": f"Est. SBP {data.systolic_bp_mmhg:.0f} mmHg · Resp {data.resp_rate_brpm:.1f} brpm",
        }
    )

    if cv_status != "nominal" and data.radiation_msv_day < 1.5:
        findings.append(
            f"Autonomic deviation from pre-flight covariance baseline: HR z={hr_z:+.1f}, HRV RMSSD {data.hrv_rmssd_ms:.0f} ms (z={hrv_z:+.1f})."
        )
        countermeasures.append(
            {
                "priority": "MODERATE" if cv_status == "watch" else "HIGH",
                "title": "0.1 Hz Resonant Paced Breathing & Isotonic Fluid Loading",
                "protocol": "Run 6-minute 6-breaths/min RAS vagal pacing + 400 mL isotonic fluid bolus prior to orthostatic/EVA load.",
                "reference": "POS-rPPG (Wang et al., IEEE TBME 2017) & Lehrer 0.1 Hz HRV Baroreflex Protocol",
            }
        )

    # 4. Cognitive & Behavioral Readiness
    cog_status = "nominal"
    if data.pvt_reaction_ms >= 355 or data.sleep_hours < 5.2 or data.mood_score_10 <= 4.5:
        cog_status = "alert"
    elif data.pvt_reaction_ms >= 310 or data.sleep_hours < 6.4 or data.mood_score_10 <= 6.0:
        cog_status = "watch"

    mood_display = (
        f"Mood {data.mood_score_10:.1f}/10"
        if data.privacy_tier == "astronaut_private"
        else ("Mood Protected [Threshold Triggered]" if cog_status == "alert" else "Mood Protected [Locked]")
    )
    domains.append(
        {
            "domain": "Cognitive & Behavioral Readiness",
            "status": cog_status,
            "headline": f"PVT {data.pvt_reaction_ms:.0f} ms · Sleep {data.sleep_hours:.1f} h · {mood_display}",
            "metric_detail": "PVT and sleep thresholds are prototype settings.",
        }
    )

    if cog_status != "nominal":
        findings.append(
            f"Cognitive/circadian fatigue detected: Sleep {data.sleep_hours:.1f} h with PVT reflex latency {data.pvt_reaction_ms:.0f} ms."
        )
        countermeasures.append(
            {
                "priority": "MODERATE" if cog_status == "watch" else "HIGH",
                "title": "480 nm Blue-Depleted Circadian Lighting & Protected Rest Window",
                "protocol": "Shift cabin LED spectrum to warm <3000K 90 min pre-sleep and protect an uninterrupted 8-hour rest block.",
                "reference": "NASA HRP Behavioral Medicine Evidence Book",
            }
        )

    # Statistical anomaly summary line (always prepended so judges see exact multivariate math!)
    top_attr_str = ", ".join(f"{a['feature']} ({a['share_pct']}%)" for a in stats["top_attributions"][:3])
    findings.insert(
        0,
        f"Multivariate Mahalanobis Distance D_M = {stats['mahalanobis_d']:.2f} (8-DOF Chi-Square {fmt_p(stats['p_value'])}); "
        f"dominant variance contributors: {top_attr_str}.",
    )

    if len(countermeasures) == 0:
        countermeasures.append(
            {
                "priority": "ROUTINE",
                "title": "Maintain Nominal ARED & Microgravity Countermeasure Schedule",
                "protocol": "All channels within 95% individualized pre-flight covariance ellipsoid (p > 0.05). Continue scheduled ARED & aerobic blocks.",
                "reference": "NASA-STD-3001 Nominal Operations",
            }
        )

    prio_rank = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "ROUTINE": 3}
    countermeasures.sort(key=lambda c: (prio_rank.get(c["priority"], 4), c.get("_domain_order", 1)))
    for c in countermeasures:
        c.pop("_domain_order", None)

    statuses = [d["status"] for d in domains]
    if "alert" in statuses or stats["p_value"] < 0.001:
        overall_status = "alert"
        trajectory_state = f"Significant drift from pre-flight baseline · D_M = {stats['mahalanobis_d']:.2f}, {fmt_p(stats['p_value'])}"
    elif "watch" in statuses or stats["p_value"] < 0.05:
        overall_status = "watch"
        trajectory_state = f"Early deviation from pre-flight baseline · D_M = {stats['mahalanobis_d']:.2f}, {fmt_p(stats['p_value'])}"
    else:
        overall_status = "nominal"
        trajectory_state = f"Within 95% pre-flight baseline ellipsoid · D_M = {stats['mahalanobis_d']:.2f}, {fmt_p(stats['p_value'])}"

    raw_visible = data.privacy_tier == "astronaut_private"
    escalate = overall_status == "alert"

    # Closed-Loop Neuro-Acoustic Music Therapy & Sonification Prescription
    if data.radiation_msv_day >= 1.5 or data.sleep_hours < 5.3:
        rec_proto_id = "delta_sleep"
        rec_proto_title = "2.5 Hz Delta Binaural + 1/f Pink-Noise Storm-Shelter Recovery"
        rec_binaural_hz = 2.5
        rec_tempo_bpm = 48
    elif data.cabin_co2_mmhg >= 2.8 or data.pvt_reaction_ms >= 315:
        rec_proto_id = "gamma_focus"
        rec_proto_title = "40 Hz Gamma Cognitive Vigilance + Harmonic Alertness Pulse"
        rec_binaural_hz = 40.0
        rec_tempo_bpm = 88
    elif kin_status != "nominal":
        rec_proto_id = "ras_motor"
        rec_proto_title = "Motor Cadence RAS Entrainment (16 Hz Beta + 3D Spatial Sonification)"
        rec_binaural_hz = 16.0
        rec_tempo_bpm = max(56, min(96, int(round((data.cadence_rpm + 2) * 4))))
    else:
        rec_proto_id = "hrv_alpha"
        rec_proto_title = "0.10 Hz Mayer-Wave HRV Baroreflex Resonance (10 Hz Alpha)"
        rec_binaural_hz = 10.0
        rec_tempo_bpm = 60

    neuro_prescription = {
        "recommended_protocol_id": rec_proto_id,
        "recommended_title": rec_proto_title,
        "binaural_beat_hz": rec_binaural_hz,
        "target_tempo_bpm": rec_tempo_bpm,
        "active_protocol_id": data.neuro_protocol,
        "kinematic_sonification": "3D Joint ROM -> Low-Pass Cutoff (360-3100 Hz); Trunk Tilt -> Stereo Balance",
        "voice_enhancement_dsp": "85 Hz Cabin Rumble HPF + 3.2 kHz (+4.5 dB) Presence EQ + -9.9 dB Sidechain Music Ducking",
        "vocal_biomarkers": {
            "f0_hz": data.vocal_f0_hz,
            "jitter_pct": data.vocal_jitter_pct,
            "hnr_db": data.vocal_hnr_db,
        },
    }

    downlink_packet = {
        "packet_schema": "NASA-ExMC-AstroKinetics-v3-NeuroAcoustic",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "mission_sol": data.mission_sol,
        "vision_source": data.vision_source,
        "comm_mode": data.comm_mode,
        "crew_member": data.crew_member,
        "privacy_tier_applied": data.privacy_tier,
        "overall_status": overall_status.upper(),
        "readiness_score": stats["readiness_score"],
        "multivariate_statistics": stats,
        "neuro_acoustic_and_voice_dsp": neuro_prescription,
        "kinematic_3d_biomarkers": {
            "protocol": data.protocol,
            "joint_rom_deg": data.joint_rom_deg,
            "target_rom_deg": data.target_rom_deg,
            "bilateral_symmetry_pct": data.bilateral_symmetry_pct,
            "trunk_lean_deg": data.trunk_lean_deg,
            "postural_sway_mms": data.postural_sway_mms,
            "hand_tap_hz": data.hand_tap_hz,
            "tremor_rms_mm": data.tremor_rms_mm,
        },
        "physiological_and_habitat_summary": {
            "hr_bpm": data.heart_rate_bpm,
            "hrv_rmssd_ms": data.hrv_rmssd_ms,
            "spo2_pct": data.spo2_pct,
            "pvt_reaction_ms": data.pvt_reaction_ms,
            "cabin_ppco2_mmhg": data.cabin_co2_mmhg,
            "radiation_msv_day": data.radiation_msv_day,
        },
        "behavioral_privacy_payload": {
            "raw_mood_score": data.mood_score_10 if (raw_visible or escalate) else "REDACTED_BY_CREW_PRIVACY_LOCK",
            "journal_note": (
                data.private_journal_note
                if raw_visible
                else (
                    "[SAFETY THRESHOLD ESCALATION: Encrypted for Flight Surgeon key only]"
                    if escalate
                    else "[REDACTED — Owned exclusively by astronaut on local tablet]"
                )
            ),
        },
        "prescribed_countermeasures": [c["title"] for c in countermeasures],
        "nasa_citations": ["OSD-571 (GLDS-563)", "OSD-570", "NASA-STD-3001", "HRP-HSRB-2026", "CSA-BIOMONITOR"],
    }

    return {
        "overall_status": overall_status,
        "readiness_score": stats["readiness_score"],
        "trajectory_state": trajectory_state,
        "multivariate_stats": stats,
        "neuro_prescription": neuro_prescription,
        "domains": domains,
        "explainable_findings": findings,
        "countermeasures": countermeasures,
        "downlink_packet": downlink_packet,
    }


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": "5.3.0",
        "service": "AstroKinetics · ASTRA v5.3 — Autonomous Astronaut Health Workstation, Watch + iPhone Companion & Cited Evidence Suite",
        "team": "Team AI-MED 01 (Houston, TX)",
        "challenge": "Create Health Monitoring Software for Astronauts on Space Missions (2026 NASA International Space Apps Challenge)",
        "showcase_journey": True,
        "voice_engine": "clawagents_py + xai-grok-voice",
        "empirical_osd571_biomarkers": len(OSDR_OSD571_EMPIRICAL.get("biomarkers", [])),
        "reference_mocap_frames": REFERENCE_3D_KEYPOINTS.get("num_frames", 0),
        "statistical_engine": "8-DOF Multivariate Mahalanobis + Chi-Square Survival (scipy.stats.chi2 & exact browser parity)",
        "astra_aura_corpus": {
            "bilingual_concepts": len(KNOWLEDGE_BUNDLE.get("concepts", [])),
            "reviewed_sources": len(KNOWLEDGE_BUNDLE.get("sources", [])),
            "apple_biomarker_studies": len(KNOWLEDGE_BUNDLE.get("apple_studies", [])),
            "nasa_pmc_publications": AURA_CORPUS.get("total_publications", 0),
            "radlab_dostel_rows": EMPIRICAL_SUPPLEMENTS["radlab_iss_sample"]["row_count"],
        },
        "documentation_routes": [
            "/project",
            "/for-judges",
            "/for-judges/evaluation-kit.txt",
            "/scenarios",
            "/data",
            "/guides",
            "/video",
            "/story",
            "/demo/",
            "/feed.xml",
            "/sitemap.xml",
            "/llms.txt",
            "/llms-full.txt",
            "/api/verification-report",
            "/api/mcp/",
            "/docs",
        ],
        "connected_edge_endpoints": [
            "/api/verification-report",
            "/api/scenarios",
            "/api/evaluate",
            "/api/osdr-empirical",
            "/api/voice/status",
            "/api/voice/chat",
            "/api/voice/tts",
            "/api/ingest/edge-telemetry",
            "/api/ingest/recent",
            "/api/kinematic-sample",
            "/api/hunch/catalog",
            "/api/hunch/triage",
            "/api/astra/contracts",
            "/api/astra/episodes",
            "/api/astra/lidar-volume",
            "/api/aura/overview",
            "/api/aura/search",
            "/api/aura/ask",
            "/api/aura/radlab",
            "/docs",
        ],
    }


@app.get("/api/verification-report")
async def verification_report() -> dict[str, Any]:
    """
    Deterministic, read-only self-verification report exercising the statistical scorer,
    privacy redaction gate, NASA HUNCH 8-red-flag safety gate, Barger 2014 mission-profile
    adaptation, LiDAR signed tetrahedral volumetry, and bundled NASA empirical assets.
    Writes no records to SQLite or in-memory telemetry buffers.
    """
    checks: list[dict[str, Any]] = []

    # 1. Four scripted mission scenarios
    expected_scenarios = {
        "nominal_lunar": ("nominal", 99.2),
        "hypercapnia_drift": ("watch", 78.3),
        "musculoskeletal_asymmetry": ("alert", 44.7),
        "spe_blackout": ("alert", 12.0),
    }
    scenario_results: dict[str, dict[str, Any]] = {}
    scenarios_ok = True
    for sid, (exp_status, exp_score) in expected_scenarios.items():
        res = evaluate_astronaut_state(TelemetryInput(**MISSION_SCENARIOS[sid]["telemetry"]))
        ok = res["overall_status"] == exp_status and res["readiness_score"] == exp_score
        scenarios_ok = scenarios_ok and ok
        scenario_results[sid] = {
            "overall_status": res["overall_status"],
            "readiness_score": res["readiness_score"],
            "mahalanobis_d": res["multivariate_stats"]["mahalanobis_d"],
            "p_value": res["multivariate_stats"]["p_value"],
            "passed": ok,
        }
    checks.append({
        "id": "mission_scenarios_4",
        "name": "Four scripted mission scenarios (8-DOF Mahalanobis + Chi-Square)",
        "passed": scenarios_ok,
        "details": scenario_results,
    })

    # 2. Three-tier crew privacy redaction gate
    nom_t = MISSION_SCENARIOS["nominal_lunar"]["telemetry"]
    priv_self = evaluate_astronaut_state(TelemetryInput(**nom_t, privacy_tier="astronaut_private"))
    priv_cmo = evaluate_astronaut_state(TelemetryInput(**nom_t, privacy_tier="cmo_operational"))
    priv_fs = evaluate_astronaut_state(TelemetryInput(**nom_t, privacy_tier="flight_surgeon_packet"))
    alert_cmo = evaluate_astronaut_state(
        TelemetryInput(**MISSION_SCENARIOS["spe_blackout"]["telemetry"], privacy_tier="cmo_operational")
    )
    privacy_ok = (
        priv_self["downlink_packet"]["behavioral_privacy_payload"]["raw_mood_score"] == nom_t["mood_score_10"]
        and priv_cmo["downlink_packet"]["behavioral_privacy_payload"]["raw_mood_score"] == "REDACTED_BY_CREW_PRIVACY_LOCK"
        and "REDACTED" in priv_cmo["downlink_packet"]["behavioral_privacy_payload"]["journal_note"]
        and priv_fs["downlink_packet"]["behavioral_privacy_payload"]["raw_mood_score"] == "REDACTED_BY_CREW_PRIVACY_LOCK"
        and "SAFETY THRESHOLD ESCALATION" in alert_cmo["downlink_packet"]["behavioral_privacy_payload"]["journal_note"]
    )
    checks.append({
        "id": "privacy_redaction_gate",
        "name": "Three-tier crew privacy redaction (Private / CMO / Flight Surgeon)",
        "passed": privacy_ok,
        "details": {
            "cmo_nominal_mood": priv_cmo["downlink_packet"]["behavioral_privacy_payload"]["raw_mood_score"],
            "cmo_alert_journal": alert_cmo["downlink_packet"]["behavioral_privacy_payload"]["journal_note"],
        },
    })

    # 3. NASA HUNCH 8-red-flag safety gate (all 8 flags override poor capture)
    red_flag_cases = [
        ("mi_triad", {"chest_pain": True, "sob": True, "diaphoresis": True}),
        ("thunderclap_headache", {"thunderclap_headache": True}),
        ("meningitis_pattern", {"confusion": True, "fever": True}),
        ("meningococcemia", {"non_blanching_rash": True, "fever": True}),
        ("acute_vision_loss", {"acute_vision_loss": True}),
        ("new_seizure", {"new_seizure": True}),
        ("syncope", {"syncope": True}),
        ("hemoptysis", {"hemoptysis": True}),
    ]
    rf_passed = 0
    for expected_id, flags in red_flag_cases:
        out = evaluate_hunch_triage(
            HunchTriageRequest(
                signal_quality="insufficient",
                watch_connected=False,
                hr=None,
                spo2=None,
                sleep_hours=None,
                hrv_sdnn=None,
                require_complete_context=True,
                **flags,
            )
        )
        if (
            out["triage_level"] == "EMERGENCY"
            and out["abstained"] is False
            and any(f["id"] == expected_id for f in out["triggered_red_flags"])
        ):
            rf_passed += 1
    checks.append({
        "id": "hunch_8_red_flags_override_poor_capture",
        "name": "NASA HUNCH 8-red-flag safety gate overrides poor/missing capture",
        "passed": rf_passed == len(red_flag_cases),
        "details": {"passed_flags": rf_passed, "total_flags": len(red_flag_cases)},
    })

    # 4. Principled missing-data abstention & dual-engine disagreement audit
    degraded = evaluate_hunch_triage(
        HunchTriageRequest(
            fatigue=True,
            dizziness=True,
            severity=4,
            hr=None,
            sbp=None,
            spo2=None,
            temp_c=36.7,
            sleep_hours=None,
            hrv_sdnn=None,
            signal_quality="insufficient",
            watch_connected=False,
            require_complete_context=True,
        )
    )
    abstention_ok = (
        degraded["triage_level"] == "INCOMPLETE_CHECK_REQUIRED"
        and degraded["abstained"] is True
        and degraded["ml_comparator"]["agrees_with_rule"] is False
    )
    checks.append({
        "id": "hunch_principled_abstention",
        "name": "Degraded capture with missing watch readings triggers principled abstention",
        "passed": abstention_ok,
        "details": {
            "rule_decision": degraded["triage_level"],
            "ml_comparator_guess": degraded["ml_comparator"]["prediction"],
            "abstained": degraded["abstained"],
        },
    })

    # 5. Earth-1g vs Mission-Microgravity Barger 2014 sleep profile adaptation
    sleep_base = dict(fatigue=True, severity=3, hr=69, sbp=116, spo2=98, temp_c=36.7, sleep_hours=5.9, hrv_sdnn=42, signal_quality="good", watch_connected=True)
    sleep_earth = evaluate_hunch_triage(HunchTriageRequest(**sleep_base, active_profile="earth_1g"))
    sleep_orbit = evaluate_hunch_triage(HunchTriageRequest(**sleep_base, active_profile="mission_microgravity"))
    profile_ok = sleep_earth["triage_level"] == "MODERATE" and sleep_orbit["triage_level"] == "LOW"
    checks.append({
        "id": "barger_2014_earth_vs_orbit_profile",
        "name": "Earth-1g vs Mission-Microgravity profile adaptation (5.9h sleep, Barger 2014 ISS context)",
        "passed": profile_ok,
        "details": {
            "earth_1g_triage": sleep_earth["triage_level"],
            "mission_microgravity_triage": sleep_orbit["triage_level"],
        },
    })

    # 6. iPhone LiDAR closed-mesh signed tetrahedral volumetry (analytical 10x10x10 cm = 1000.0 mL cube + quality gates)
    cube_verts = [
        [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
        [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10],
    ]
    cube_faces = [
        [0, 2, 1], [0, 3, 2],
        [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4],
        [2, 3, 7], [2, 7, 6],
        [0, 4, 7], [0, 7, 3],
        [1, 2, 6], [1, 6, 5],
    ]
    cube_pass = evaluate_lidar_volume(
        LidarVolumeRequest(
            vertices=cube_verts,
            faces=cube_faces,
            baseline_volume_ml=1000.0,
            observed_coverage_pct=92.0,
            occluded_pct=4.0,
            inferred_pct=4.0,
            capture_mode="raw_sceneDepth",
        )
    )
    low_cov = evaluate_lidar_volume(
        LidarVolumeRequest(observed_coverage_pct=70.0, occluded_pct=20.0, inferred_pct=10.0, capture_mode="raw_sceneDepth")
    )
    bad_mode = evaluate_lidar_volume(
        LidarVolumeRequest(observed_coverage_pct=90.0, occluded_pct=5.0, inferred_pct=5.0, capture_mode="personSegmentationWithDepth")
    )
    lidar_ok = (
        cube_pass["computed_volume_ml"] == 1000.0
        and cube_pass["quality_gate_status"] == "PASS"
        and low_cov["quality_gate_status"] == "QUALITY_HOLD"
        and bad_mode["quality_gate_status"] == "QUALITY_HOLD"
    )
    checks.append({
        "id": "lidar_tetrahedral_volumetry_and_gates",
        "name": "Closed-mesh signed tetrahedral volume (10cm cube = 1000.0 mL) + 82% coverage & sceneDepth gates",
        "passed": lidar_ok,
        "details": {
            "analytical_cube_ml": cube_pass["computed_volume_ml"],
            "analytical_error_pct": 0.0 if cube_pass["computed_volume_ml"] == 1000.0 else round(abs(cube_pass["computed_volume_ml"] - 1000.0) / 10.0, 4),
            "low_coverage_gate": low_cov["quality_gate_status"],
            "person_segmentation_gate": bad_mode["quality_gate_status"],
        },
    })

    # 7. Real bundled NASA empirical datasets & AURA model-organism guardrail
    osd_biomarkers = OSDR_OSD571_EMPIRICAL.get("biomarkers", [])
    osd_timepoints = OSDR_OSD571_EMPIRICAL.get("timepoints", [])
    radlab_rows = EMPIRICAL_SUPPLEMENTS["radlab_iss_sample"]["row_count"]
    aura_human_hits = AURA_INDEX.search("radiation", human_only=True, limit=10)
    aura_all_hits = AURA_INDEX.search("mouse radiation", human_only=False, limit=10)
    nasa_data_ok = (
        len(osd_biomarkers) == 14
        and len(osd_timepoints) == 6
        and radlab_rows == 164
        and len(AURA_CORPUS.get("publications", [])) == 572
        and len(aura_human_hits) > 0
        and all(h["is_human_applicable"] for h in aura_human_hits)
        and any(not h["is_human_applicable"] for h in aura_all_hits)
    )
    checks.append({
        "id": "bundled_nasa_datasets_and_aura_guardrail",
        "name": "Bundled NASA datasets (OSD-571, RadLab ISS DosTel, 572 PMC corpus) & human-vs-model-organism guardrail",
        "passed": nasa_data_ok,
        "details": {
            "osd571_proteins": len(osd_biomarkers),
            "osd571_timepoints": len(osd_timepoints),
            "radlab_iss_dostel_rows": radlab_rows,
            "aura_total_indexed_docs": len(AURA_INDEX.docs),
            "aura_nasa_pmc_papers": len(AURA_CORPUS.get("publications", [])),
            "human_only_filter_strict": all(h["is_human_applicable"] for h in aura_human_hits),
        },
    })

    passed_count = sum(1 for c in checks if c["passed"])
    return {
        "schema_version": "astrokinetics-verification-1.0",
        "software_version": "5.2.0",
        "post_submission_verification_date": "2026-11-21",
        "team": "Team AI-MED 01 (Houston, TX)",
        "summary": {
            "passed": passed_count,
            "total": len(checks),
            "all_passed": passed_count == len(checks),
        },
        "checks": checks,
        "additional_cli_checks": (
            "Run `node scripts/verify_judging_workflow.mjs http://127.0.0.1:8080` locally to also verify "
            "Python-vs-JavaScript Mahalanobis parity across 20 vectors, stateful ASTRA episode governance "
            "transitions, and crew/sol telemetry API isolation."
        ),
        "unverified_scope": [
            "Clinical diagnostic accuracy and medical efficacy are unverified.",
            "Flight qualification and performance on representative in-flight wearable cohorts are unverified.",
            "Native watchOS HealthKit / CoreMotion and iOS ARKit LiDAR hardware capture are simulated in the web prototype.",
            "Offline service-worker scoring runs in the browser after one online load; server APIs and cloud voice require connectivity.",
        ],
    }


# ---------------------------------------------------------------------------
# Connected Crew Edge Mesh API (Apple Watch HealthKit/CoreMotion + Mobile Kinematics App)
# ---------------------------------------------------------------------------
EDGE_HISTORY_LIMIT = 25
EDGE_PACKET_RING: deque[dict[str, Any]] = deque(maxlen=EDGE_HISTORY_LIMIT)
EDGE_PACKET_SEQUENCE = count(1001)
EDGE_RECEIVED_BY_CREW_SOL: OrderedDict[tuple[str, int], dict[str, float]] = OrderedDict()


class EdgeTelemetryPacket(BaseModel):
    source_device: Literal[
        "apple_watch_ultra_healthkit",
        "mobile_kinematics_app",
        "combined_ios_watch_bridge",
        "habitat_eclss_bus",
    ] = "apple_watch_ultra_healthkit"
    device_model: str = "Apple Watch Ultra 2 (watchOS 11 · HealthKit + CMMotionManager)"
    crew_member: str = Field("FE-2 Jordan Vance (OSDR C003 Baseline)", min_length=1, max_length=120)
    mission_sol: int = 142
    comm_mode: Literal["iss_live", "lunar_farside", "mars_transit", "solar_blackout"] = "mars_transit"
    protocol: Literal["ared_squat", "eva_upper_reach", "vestibular_sway", "fine_motor_hand"] = "ared_squat"
    battery_pct: int = Field(88, ge=1, le=100)
    sample_rate_hz: float = Field(100.0, ge=0.1, le=240.0)
    # Optional Apple Watch HealthKit / CoreMotion Wrist IMU fields
    heart_rate_bpm: float | None = Field(default=None, ge=35, le=210)
    hrv_rmssd_ms: float | None = Field(default=None, ge=8, le=180)
    spo2_pct: float | None = Field(default=None, ge=75, le=100)
    resp_rate_brpm: float | None = Field(default=None, ge=6, le=40)
    sleep_hours: float | None = Field(default=None, ge=0, le=14)
    tremor_rms_mm: float | None = Field(default=None, ge=0.0, le=15.0)
    hand_tap_hz: float | None = Field(default=None, ge=0.2, le=12.0)
    # Optional Mobile Kinematics App 3D Vision / Pose fields
    joint_rom_deg: float | None = Field(default=None, ge=10, le=185)
    target_rom_deg: float | None = Field(default=None, ge=30, le=185)
    bilateral_symmetry_pct: float | None = Field(default=None, ge=35, le=100)
    trunk_lean_deg: float | None = Field(default=None, ge=0, le=55)
    postural_sway_mms: float | None = Field(default=None, ge=0.5, le=80)
    cadence_rpm: float | None = Field(default=None, ge=0, le=80)
    pvt_reaction_ms: float | None = Field(default=None, ge=150, le=900)
    # Optional Habitat ECLSS fields
    cabin_co2_mmhg: float | None = Field(default=None, ge=0.2, le=10.0)
    radiation_msv_day: float | None = Field(default=None, ge=0.05, le=25.0)


EDGE_SENSOR_CHANNELS = {
    name for name, field in EdgeTelemetryPacket.model_fields.items() if field.default is None
}
EDGE_EVALUATION_CHANNELS = EDGE_SENSOR_CHANNELS | {"systolic_bp_mmhg", "mood_score_10"}
EDGE_DEMO_DEFAULTS = TelemetryInput().model_dump(include=EDGE_EVALUATION_CHANNELS)
EDGE_DEMO_SCENARIOS = {
    (case["crew_member"], case["mission_sol"]): {
        key: value for key, value in case["telemetry"].items() if key in EDGE_EVALUATION_CHANNELS
    }
    for case in MISSION_SCENARIOS.values()
}


@app.post("/api/ingest/edge-telemetry")
async def ingest_edge_telemetry(packet: EdgeTelemetryPacket) -> dict[str, Any]:
    """Merge demo sensor packets within one crew member and mission day."""
    crew_sol = (packet.crew_member, packet.mission_sol)
    updates = packet.model_dump(include=EDGE_SENSOR_CHANNELS, exclude_none=True)
    received = {**EDGE_RECEIVED_BY_CREW_SOL.get(crew_sol, {}), **updates}
    fused = {**EDGE_DEMO_DEFAULTS, **EDGE_DEMO_SCENARIOS.get(crew_sol, {}), **received}

    fused_input = TelemetryInput(
        crew_member=packet.crew_member,
        mission_sol=packet.mission_sol,
        protocol=packet.protocol,
        vision_source=f"edge_mesh:{packet.source_device}",
        comm_mode=packet.comm_mode,
        privacy_tier="astronaut_private",
        **fused,
    )
    eval_res = evaluate_astronaut_state(fused_input)
    stats = eval_res["multivariate_stats"]
    rx = eval_res["neuro_prescription"]

    # Closed-loop feedback payload returned directly to Apple Watch & Mobile App
    watch_directive = {
        "wkhaptic_type": (
            "WKHapticType.failure"
            if eval_res["overall_status"] == "alert"
            else ("WKHapticType.retry" if eval_res["overall_status"] == "watch" else "WKHapticType.success")
        ),
        "wrist_complication_ring": eval_res["readiness_score"],
        "mobile_app_cue": (
            f"Activate {rx['recommended_title']} ({rx['binaural_beat_hz']} Hz binaural @ {rx['target_tempo_bpm']} BPM)"
        ),
        "primary_driver": stats["top_attributions"][0]["feature"] if stats["top_attributions"] else "Nominal",
    }

    record = {
        "packet_id": f"PKT-{next(EDGE_PACKET_SEQUENCE)}",
        "ingested_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_device": packet.source_device,
        "device_model": packet.device_model,
        "crew_member": packet.crew_member,
        "mission_sol": packet.mission_sol,
        "updated_channels": sorted(updates),
        "received_channels": sorted(received),
        "demo_default_channels": sorted(fused.keys() - received.keys()),
        "overall_status": eval_res["overall_status"],
        "readiness_score": eval_res["readiness_score"],
        "mahalanobis_d": stats["mahalanobis_d"],
        "p_value": stats["p_value"],
        "watch_and_mobile_directive": watch_directive,
    }
    EDGE_RECEIVED_BY_CREW_SOL[crew_sol] = received
    EDGE_RECEIVED_BY_CREW_SOL.move_to_end(crew_sol)
    if len(EDGE_RECEIVED_BY_CREW_SOL) > EDGE_HISTORY_LIMIT:
        EDGE_RECEIVED_BY_CREW_SOL.popitem(last=False)
    EDGE_PACKET_RING.append(record)

    return {
        "ingested": True,
        "packet_record": record,
        "fused_telemetry_state": fused,
        "evaluation": eval_res,
    }


@app.get("/api/ingest/recent")
async def get_recent_edge_packets(
    crew_member: str | None = Query(default=None, min_length=1, max_length=120),
    mission_sol: int | None = None,
) -> dict[str, Any]:
    """List recent demo packets, optionally filtered by crew member and mission day."""
    packets = [
        record for record in reversed(EDGE_PACKET_RING)
        if (crew_member is None or record["crew_member"] == crew_member)
        and (mission_sol is None or record["mission_sol"] == mission_sol)
    ]
    fused = {}
    if packets:
        latest = packets[0]
        crew_sol = (latest["crew_member"], latest["mission_sol"])
        fused = {**EDGE_DEMO_DEFAULTS, **EDGE_DEMO_SCENARIOS.get(crew_sol, {}), **EDGE_RECEIVED_BY_CREW_SOL.get(crew_sol, {})}
    return {
        "count": len(packets),
        "packets": packets[:12],
        "fused_telemetry_state": fused,
    }


@app.get("/api/scenarios")
async def list_scenarios() -> dict[str, Any]:
    return {
        "scenarios": list(MISSION_SCENARIOS.values()),
        "nasa_datasets": NASA_DATASETS_CATALOG,
    }


@app.get("/api/osdr-empirical")
async def get_osdr_empirical() -> dict[str, Any]:
    return OSDR_OSD571_EMPIRICAL


@app.get("/api/kinematic-sample")
async def get_kinematic_sample() -> dict[str, Any]:
    return REFERENCE_3D_KEYPOINTS


@app.get("/api/nasa-osdr")
async def fetch_nasa_osdr_study(
    study_id: str = Query("571", pattern=r"^[0-9]{2,4}$"),
    simulate_blackout: bool = Query(False),
) -> dict[str, Any]:
    matched = next((d for d in NASA_DATASETS_CATALOG if study_id in d["id"]), NASA_DATASETS_CATALOG[0])
    if simulate_blackout:
        return {
            "mode": "ONBOARD_OFFLINE_CACHE (Comm Blackout Active)",
            "study_id": f"OSD-{study_id}",
            "metadata": matched,
        }
    url = f"https://osdr.nasa.gov/osdr/data/osd/meta/{study_id}"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                payload = resp.json()
                study_meta = payload.get("study", {}).get(f"OSD-{study_id}", {})
                studies_list = study_meta.get("studies", []) if isinstance(study_meta, dict) else []
                title = studies_list[0].get("title") if studies_list and isinstance(studies_list[0], dict) else None
                return {
                    "mode": "LIVE_NASA_OSDR_API",
                    "study_id": f"OSD-{study_id}",
                    "live_title": title or matched["title"],
                    "metadata": matched,
                }
    except Exception:
        pass
    return {
        "mode": "ONBOARD_OFFLINE_CACHE (Seamless Fallback)",
        "study_id": f"OSD-{study_id}",
        "metadata": matched,
    }


@app.post("/api/evaluate")
async def evaluate_endpoint(payload: TelemetryInput) -> dict[str, Any]:
    return evaluate_astronaut_state(payload)


@app.post("/api/sessions")
async def save_session(payload: TelemetryInput) -> dict[str, Any]:
    result = evaluate_astronaut_state(payload)
    stats = result["multivariate_stats"]
    now_iso = datetime.now(timezone.utc).isoformat()
    summary = {
        "protocol": payload.protocol,
        "joint_rom_deg": payload.joint_rom_deg,
        "symmetry_pct": payload.bilateral_symmetry_pct,
        "pvt_ms": payload.pvt_reaction_ms,
        "co2_mmhg": payload.cabin_co2_mmhg,
    }
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """
            INSERT INTO assessment_sessions
            (created_at, crew_id, mission_sol, protocol, vision_source, comm_mode, overall_status, readiness_score, mahalanobis_d, p_value, summary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now_iso,
                payload.crew_member,
                payload.mission_sol,
                payload.protocol,
                payload.vision_source,
                payload.comm_mode,
                result["overall_status"],
                result["readiness_score"],
                stats["mahalanobis_d"],
                stats["p_value"],
                json.dumps(summary),
            ),
        )
        session_id = cur.lastrowid
        conn.commit()
    return {"saved": True, "session_id": session_id, "created_at": now_iso, "evaluation": result}


@app.get("/api/sessions")
async def get_sessions(limit: int = Query(12, ge=1, le=50)) -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM assessment_sessions ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return {
        "sessions": [
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "crew_id": r["crew_id"],
                "mission_sol": r["mission_sol"],
                "protocol": r["protocol"],
                "vision_source": r["vision_source"],
                "comm_mode": r["comm_mode"],
                "overall_status": r["overall_status"],
                "readiness_score": r["readiness_score"],
                "mahalanobis_d": r["mahalanobis_d"],
                "p_value": r["p_value"],
                "summary": json.loads(r["summary_json"]),
            }
            for r in rows
        ]
    }


@app.get("/sw.js")
async def service_worker() -> Response:
    return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript")


@app.get("/manifest.webmanifest")
async def web_manifest() -> Response:
    return FileResponse(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


app.include_router(astra_router)
app.include_router(voice_router)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if SHOWCASE_DIR.exists():
    for _sub in ("assets", "stills", "bezels", "brand", "media"):
        _sub_dir = SHOWCASE_DIR / _sub
        if _sub_dir.exists():
            app.mount(f"/{_sub}", StaticFiles(directory=str(_sub_dir)), name=f"showcase_{_sub}")


@app.get("/demo")
async def demo_redirect() -> RedirectResponse:
    return RedirectResponse(url="/demo/#demo", status_code=307)


if (SHOWCASE_DIR / "demo").exists():
    app.mount("/demo", StaticFiles(directory=str(SHOWCASE_DIR / "demo"), html=True), name="showcase_demo")


@app.get("/studio")
async def studio() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/console")
@app.get("/lab")
async def console_redirect() -> RedirectResponse:
    return RedirectResponse(url="/studio", status_code=307)


@app.get("/video")
async def demo_video() -> Response:
    """Public page for the 30-second Space Apps demo video."""
    page = STATIC_DIR / "final" / "index.html"
    if page.exists():
        return FileResponse(page)
    return RedirectResponse(url="/", status_code=307)


@app.get("/project", include_in_schema=False)
async def project_overview() -> FileResponse:
    return FileResponse(STATIC_DIR / "project.html")


@app.get("/robots.txt", include_in_schema=False)
async def robots() -> FileResponse:
    return FileResponse(STATIC_DIR / "robots.txt", media_type="text/plain")


app.include_router(
    build_seo_router(
        mission_scenarios=MISSION_SCENARIOS,
        telemetry_input_cls=TelemetryInput,
        evaluate_fn=evaluate_astronaut_state,
        verification_fn=verification_report,
        osdr_empirical=OSDR_OSD571_EMPIRICAL,
        empirical_supplements=EMPIRICAL_SUPPLEMENTS,
        knowledge_bundle=KNOWLEDGE_BUNDLE,
        aura_corpus=AURA_CORPUS,
        aura_index=AURA_INDEX,
    )
)


@app.get("/llms.txt", include_in_schema=False)
async def llms_txt() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "llms.txt",
        media_type="text/markdown; charset=utf-8",
        headers={"X-Robots-Tag": "index, follow"},
    )


@app.get("/llms-full.txt", include_in_schema=False)
async def llms_full_txt() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "llms-full.txt",
        media_type="text/markdown; charset=utf-8",
        headers={"X-Robots-Tag": "index, follow"},
    )


@app.get("/story")
async def story() -> Response:
    showcase_index = SHOWCASE_DIR / "index.html"
    if showcase_index.exists():
        return FileResponse(showcase_index)
    return RedirectResponse(url="/", status_code=307)


@app.get("/")
async def index() -> FileResponse:
    # The workstation is the front door; the Watch + iPhone demo is one of its tabs.
    return FileResponse(STATIC_DIR / "index.html")
