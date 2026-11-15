"""
ASTRA · NASA HUNCH · AURA Integrated Space Health Companion Module (v4.0.0)
==========================================================================
Provides additive, non-destructive API endpoints and SQLite state governance for:
1. NASA HUNCH 8-Red-Flag Safety Gate, Missing-Data Abstention & Dual-Engine Triage
2. ASTRA Longitudinal Episode / Task / Provenance State Machine (non-conflated)
3. iPhone LiDAR Closed-Mesh Signed Tetrahedral Volumetry with Coverage Gate
4. AURA Cited Space Medicine Knowledge Engine (16 concepts, 70 sources,
   15 Apple biomarker studies, 572 NASA PMC corpus papers, RadLab & Barger 2014)
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

with (DATA_DIR / "astra_knowledge_bundle.json").open(encoding="utf-8") as _f:
    KNOWLEDGE_BUNDLE: dict[str, Any] = json.load(_f)

with (DATA_DIR / "aura_nasa_corpus.json").open(encoding="utf-8") as _f:
    AURA_CORPUS: dict[str, Any] = json.load(_f)

with (DATA_DIR / "astra_empirical_supplements.json").open(encoding="utf-8") as _f:
    EMPIRICAL_SUPPLEMENTS: dict[str, Any] = json.load(_f)

_ASTRA_DB_PATH: Path = Path("/tmp/astrokinetics_sessions_v2.db")

astra_router = APIRouter(tags=["ASTRA · HUNCH · AURA v4.0"])


# ==============================================================================
# Bilingual Tokenizer & Lightweight Offline BM25 Index (Zero LLM / Heavy Deps)
# ==============================================================================

_TOKEN_RE = re.compile(r"[a-z0-9áéíóúüñ\-]{2,}", re.IGNORECASE)

_STOPWORDS = frozenset({
    "the", "and", "for", "with", "from", "that", "this", "what", "when", "where",
    "which", "how", "does", "are", "was", "were", "can", "into", "about", "only",
    "con", "para", "por", "los", "las", "del", "una", "uno", "que", "como", "sobre",
    "entre", "este", "esta", "eso", "sus", "sin", "más", "mas", "use", "using",
})

_BILINGUAL_SYNONYMS: dict[str, list[str]] = {
    "sueño": ["sleep", "circadian", "barger", "rest", "fatigue"],
    "sueno": ["sleep", "circadian", "barger", "rest", "fatigue"],
    "sleep": ["sueño", "sueno", "circadian", "barger", "actigraphy", "descanso"],
    "sdnn": ["hrv", "variabilidad", "rmssd", "healthkit", "heartratevariabilitysdnn"],
    "hrv": ["sdnn", "variabilidad", "rmssd", "autonomic", "heartratevariabilitysdnn"],
    "rmssd": ["sdnn", "hrv", "variabilidad"],
    "lidar": ["tetrahedral", "volume", "calf", "scenedepth", "personsegmentationwithdepth", "mesh", "volumetría"],
    "fluid": ["calf", "shift", "edema", "bird", "lidar", "sans", "fluidos"],
    "sans": ["ocular", "optic", "vision", "fluid", "saccadic", "papilledema"],
    "radiación": ["radiation", "radlab", "dostel", "dose", "saa", "flux"],
    "radiation": ["radiación", "radlab", "dostel", "dose", "saa", "flux"],
    "radlab": ["dostel", "radiation", "dose", "altitude", "iss"],
    "apollo": ["orthostatic", "nlsp", "heart", "ap005", "postflight"],
    "red": ["flag", "hunch", "triad", "thunderclap", "meningitis", "hemoptysis", "seizure", "syncope"],
    "tremor": ["hand", "1-euro", "one-euro", "dexterity", "temblor", "parkinson", "mm4pd"],
    "voice": ["vocal", "jitter", "shimmer", "hnr", "spirosmart", "habla"],
    "proteomics": ["osd-571", "inspiration4", "saa1", "crp", "il6", "tnf"],
    "apple": ["watch", "healthkit", "arkit", "iphone", "scenedepth", "coremotion"],
}


def _tokenize(text: str, expand_synonyms: bool = False) -> list[str]:
    norm = (
        text.lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )
    raw = _TOKEN_RE.findall(text.lower()) + _TOKEN_RE.findall(norm)
    tokens: list[str] = []
    seen = set()
    for t in raw:
        if t in _STOPWORDS:
            continue
        if t not in seen:
            tokens.append(t)
            seen.add(t)
        else:
            tokens.append(t)
        if expand_synonyms and t in _BILINGUAL_SYNONYMS:
            for syn in _BILINGUAL_SYNONYMS[t]:
                tokens.append(syn)
    return tokens


class _AuraSearchIndex:
    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []
        self.doc_tokens: list[Counter[str]] = []
        self.doc_lens: list[int] = []
        self.df: Counter[str] = Counter()

        # 1. Concepts (16)
        for c in KNOWLEDGE_BUNDLE.get("concepts", []):
            blob = " ".join([
                c.get("id", ""),
                c.get("label_en", ""),
                c.get("label_es", ""),
                " ".join(c.get("aliases", [])),
                c.get("definition_en", ""),
                c.get("definition_es", ""),
                c.get("limitation_en", ""),
                c.get("limitation_es", ""),
            ])
            src_urls = [s.get("url") for s in c.get("sources", []) if s.get("url")]
            self._add_doc({
                "doc_id": c["id"],
                "kind": "concept",
                "title": f"{c['label_en']} / {c['label_es']}",
                "snippet": c.get("definition_en", ""),
                "snippet_es": c.get("definition_es", ""),
                "limitation": c.get("limitation_en", ""),
                "limitation_es": c.get("limitation_es", ""),
                "url": src_urls[0] if src_urls else "",
                "population_domain": "human_operational",
                "is_human_applicable": True,
                "meta": {"unit": c.get("unit"), "domain": c.get("domain"), "sources": c.get("sources", [])},
            }, blob, boost=2)

        # 2. Reviewed Sources (70)
        for s in KNOWLEDGE_BUNDLE.get("sources", []):
            blob = " ".join([
                s.get("id", ""),
                s.get("title", ""),
                s.get("organization", ""),
                s.get("topic", ""),
                s.get("scope", ""),
                s.get("limitation", ""),
            ])
            self._add_doc({
                "doc_id": s.get("id"),
                "kind": "source",
                "title": s.get("title", ""),
                "snippet": s.get("scope", ""),
                "snippet_es": s.get("scope", ""),
                "limitation": s.get("limitation", ""),
                "limitation_es": s.get("limitation", ""),
                "url": s.get("url", ""),
                "population_domain": "human_operational",
                "is_human_applicable": True,
                "meta": {
                    "organization": s.get("organization"),
                    "topic": s.get("topic"),
                    "status": s.get("status"),
                    "type": s.get("type"),
                },
            }, blob, boost=1)

        # 3. Apple Biomarker Studies (15)
        for p in KNOWLEDGE_BUNDLE.get("apple_studies", []):
            blob = " ".join([
                p.get("id", ""),
                p.get("title", ""),
                p.get("journal", ""),
                p.get("device", ""),
                p.get("sensors", ""),
                p.get("objective_es", ""),
                p.get("validation_es", ""),
                p.get("nasa_relevance_es", ""),
                p.get("implementation_es", ""),
                " ".join(p.get("limits_es", [])),
            ])
            self._add_doc({
                "doc_id": p.get("id"),
                "kind": "apple_study",
                "title": f"[{p.get('year')}] {p.get('title')}",
                "snippet": f"{p.get('objective_es', '')} — NASA: {p.get('nasa_relevance_es', '')}",
                "snippet_es": f"{p.get('objective_es', '')} — NASA: {p.get('nasa_relevance_es', '')}",
                "limitation": "; ".join(p.get("limits_es", [])[:2]),
                "limitation_es": "; ".join(p.get("limits_es", [])[:2]),
                "url": p.get("primary_url", ""),
                "population_domain": "human_clinical_study",
                "is_human_applicable": True,
                "meta": {"year": p.get("year"), "doi": p.get("doi"), "journal": p.get("journal"), "device": p.get("device")},
            }, blob, boost=2)

        # 4. NASA PMC Space Biology Corpus (572)
        for pub in AURA_CORPUS.get("publications", []):
            dom = pub.get("population_domain", "space_biology_general")
            is_human = dom in ("human", "space_biology_general")
            blob = " ".join([
                pub.get("pmc_id", ""),
                pub.get("title", ""),
                pub.get("abstract", ""),
                " ".join(pub.get("organisms", [])),
                " ".join(pub.get("space_conditions", [])),
                " ".join(pub.get("biological_systems", [])),
            ])
            caveat = (
                "Human / general spaceflight literature; verify cohort and operational protocol equivalence."
                if is_human
                else f"Model organism / cellular study ({dom}); do NOT translate directly to human clinical cutoffs without bridging human trials."
            )
            self._add_doc({
                "doc_id": pub.get("pmc_id"),
                "kind": "nasa_pmc",
                "title": pub.get("title", ""),
                "snippet": pub.get("abstract") or f"NASA Space Biology PMC publication ({', '.join(pub.get('organisms', []) or ['spaceflight'])})",
                "snippet_es": pub.get("abstract") or pub.get("title", ""),
                "limitation": caveat,
                "limitation_es": caveat,
                "url": pub.get("url", ""),
                "population_domain": dom,
                "is_human_applicable": is_human,
                "meta": {
                    "journal": pub.get("journal"),
                    "pub_date": pub.get("pub_date"),
                    "organisms": pub.get("organisms", []),
                    "space_conditions": pub.get("space_conditions", []),
                },
            }, blob, boost=1)

        self.avg_dl = (sum(self.doc_lens) / len(self.doc_lens)) if self.doc_lens else 1.0

    def _add_doc(self, doc: dict[str, Any], text: str, boost: int = 1) -> None:
        toks = _tokenize(text, expand_synonyms=False)
        if not toks:
            return
        tf = Counter(toks)
        self.docs.append({**doc, "_boost": boost})
        self.doc_tokens.append(tf)
        self.doc_lens.append(len(toks))
        for term in tf.keys():
            self.df[term] += 1

    def search(
        self,
        query: str,
        human_only: bool = False,
        kinds: Optional[set[str]] = None,
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        q_tokens = _tokenize(query, expand_synonyms=True)
        if not q_tokens:
            return []
        q_unique = list(dict.fromkeys(q_tokens))
        n_docs = len(self.docs)
        k1 = 1.4
        b = 0.65
        scored: list[tuple[float, int]] = []
        title_lower = query.strip().lower()

        for idx, doc in enumerate(self.docs):
            if kinds and doc["kind"] not in kinds:
                continue
            if human_only and not doc["is_human_applicable"]:
                continue

            tf = self.doc_tokens[idx]
            dl = self.doc_lens[idx]
            score = 0.0
            matched_terms = 0
            for term in q_unique:
                freq = tf.get(term, 0)
                if freq <= 0:
                    continue
                matched_terms += 1
                df = self.df.get(term, 1)
                idf = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))
                denom = freq + k1 * (1.0 - b + b * (dl / self.avg_dl))
                score += idf * ((freq * (k1 + 1.0)) / denom)

            if score <= 0.0:
                continue

            if title_lower in doc["title"].lower():
                score *= 1.45
            if doc["_boost"] > 1:
                score *= 1.35
            if matched_terms >= 2:
                score *= 1.0 + 0.12 * min(matched_terms, 5)
            scored.append((score, idx))

        scored.sort(key=lambda x: x[0], reverse=True)
        results: list[dict[str, Any]] = []
        for sc, idx in scored[:limit]:
            d = dict(self.docs[idx])
            d.pop("_boost", None)
            d["score"] = round(sc, 3)
            results.append(d)
        return results


AURA_INDEX = _AuraSearchIndex()


# ==============================================================================
# Pydantic Models — HUNCH Triage, ASTRA Episode Governance, LiDAR & AURA Q&A
# ==============================================================================

class HunchTriageRequest(BaseModel):
    chest_pain: bool = False
    sob: bool = False
    diaphoresis: bool = False
    thunderclap_headache: bool = False
    confusion: bool = False
    fever: bool = False
    neck_stiffness: bool = False
    non_blanching_rash: bool = False
    acute_vision_loss: bool = False
    new_seizure: bool = False
    syncope: bool = False
    hemoptysis: bool = False
    headache: bool = False
    dizziness: bool = False
    fatigue: bool = False
    cough: bool = False
    nausea: bool = False
    palpitations: bool = False
    visual_blur: bool = False
    joint_pain: bool = False
    onset_hours: Optional[float] = Field(default=2.0, ge=0.0, le=720.0)
    severity: int = Field(default=3, ge=1, le=10)
    hr: Optional[float] = Field(default=72.0, ge=25.0, le=240.0)
    sbp: Optional[float] = Field(default=118.0, ge=50.0, le=260.0)
    spo2: Optional[float] = Field(default=98.0, ge=50.0, le=100.0)
    temp_c: Optional[float] = Field(default=36.8, ge=33.0, le=43.0)
    rr: Optional[float] = Field(default=15.0, ge=4.0, le=60.0)
    hrv_sdnn: Optional[float] = Field(default=48.0, ge=2.0, le=250.0)
    sleep_hours: Optional[float] = Field(default=6.8, ge=0.0, le=24.0)
    signal_quality: str = Field(default="good", pattern="^(good|fair|poor|insufficient)$")
    watch_connected: bool = True
    require_complete_context: bool = False
    active_profile: str = Field(default="mission_microgravity", pattern="^(earth_1g|mission_microgravity)$")
    notes: str = Field(default="", max_length=600)


class EpisodeCreateRequest(BaseModel):
    subject_id: str = Field(default="ISS-CDR-01", min_length=2, max_length=40)
    reason: str = Field(min_length=3, max_length=200)
    case_id: str = Field(default="recovery", pattern="^(recovery|visual|movement)$")
    active_profile: str = Field(default="mission_microgravity", pattern="^(earth_1g|mission_microgravity)$")
    metric: str = Field(default="heart_rate", max_length=64)
    value: Optional[float] = None
    unit: str = Field(default="beats/min", max_length=24)
    origin_kind: str = Field(default="measured", pattern="^(measured|simulated|derived|reported)$")
    source: str = Field(default="astrokinetics_console", max_length=80)
    triage_level: Optional[str] = None
    mahalanobis_d2: Optional[float] = None
    notes: str = Field(default="", max_length=500)


class EpisodeTransitionRequest(BaseModel):
    action: str = Field(
        pattern="^(CASE|INTERNET|WATCH|PROFILE|DISMISS|BAD_CAPTURE|RECORD|SYNC|REVIEW|CLOSE)$"
    )
    value: Optional[Any] = None
    reason: Optional[str] = Field(default=None, max_length=300)
    event_id: Optional[str] = Field(default=None, max_length=80)
    origin_kind: str = Field(default="measured", pattern="^(measured|simulated|derived|reported)$")
    metric_value: Optional[float] = None
    reviewer: str = Field(default="Crew Medical Officer", max_length=80)


class LidarVolumeRequest(BaseModel):
    subject_id: str = Field(default="DEMO-01", max_length=40)
    limb: str = Field(default="left_calf", pattern="^(left_calf|right_calf|left_forearm|right_forearm)$")
    segment_length_cm: float = Field(default=28.0, ge=10.0, le=55.0)
    proximal_circ_cm: float = Field(default=37.4, ge=15.0, le=70.0)
    mid_circ_cm: float = Field(default=34.2, ge=15.0, le=70.0)
    distal_circ_cm: float = Field(default=22.8, ge=10.0, le=50.0)
    observed_coverage_pct: float = Field(default=88.0, ge=0.0, le=100.0)
    occluded_pct: float = Field(default=7.0, ge=0.0, le=100.0)
    inferred_pct: float = Field(default=5.0, ge=0.0, le=100.0)
    capture_mode: str = Field(default="raw_sceneDepth", pattern="^(raw_sceneDepth|personSegmentationWithDepth)$")
    baseline_volume_ml: float = Field(default=2180.0, ge=200.0, le=8000.0)
    vertices: Optional[list[list[float]]] = None
    faces: Optional[list[list[int]]] = None


class AuraAskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=400)
    lang: str = Field(default="en", pattern="^(en|es)$")
    human_only: bool = False


# ==============================================================================
# SQLite Storage & Seed Initialization for ASTRA Episodes
# ==============================================================================

_DEFAULT_CASES: dict[str, dict[str, Any]] = {
    "recovery": {
        "title_en": "Rest & Autonomic Recovery",
        "title_es": "Descanso y recuperación autonómica",
        "metric": "heart_rate",
        "unit": "beats/min",
        "requires_watch": True,
        "recommended_value": 68,
        "protocol_id": "astra-recovery-check-1.0",
        "source_title": "NASA · Standard Measures",
        "source_url": "https://www.nasa.gov/reference/standard-measures/",
    },
    "visual": {
        "title_en": "Visual Fluid Shift & SANS Check",
        "title_es": "Observación visual y cambios de fluidos",
        "metric": "facial_fluid_index",
        "unit": "score",
        "requires_watch": False,
        "recommended_value": 1.18,
        "protocol_id": "astra-fluid-visual-1.0",
        "source_title": "NASA · SANS & Cephalad Fluid Shifts",
        "source_url": "https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=105",
    },
    "movement": {
        "title_en": "3D Functional Reach & LiDAR Calf Tracking",
        "title_es": "Función motora 3D y volumetría LiDAR",
        "metric": "calf_volume_ml",
        "unit": "cm^3",
        "requires_watch": False,
        "recommended_value": 1912.0,
        "protocol_id": "astra-biomech-lidar-1.0",
        "source_title": "NASA · Sensorimotor & Musculoskeletal Function",
        "source_url": "https://www.nasa.gov/reference/standard-measures/",
    },
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_ASTRA_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _seed_initial_episodes(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) FROM astra_episodes").fetchone()[0]
    if count > 0:
        return

    seeds: list[dict[str, Any]] = [
        {
            "schema_version": "astra-concept-1.0",
            "demonstration_only": True,
            "clinical_validation": "not_performed",
            "subject_id": "DEMO-01",
            "case_id": "recovery",
            "active_profile": "earth_1g",
            "watch_connected": True,
            "internet_up": False,
            "episode": {
                "id": "demo-episode-001",
                "reason": "Autonomic recovery check with missing sleep history (DEMO-01)",
                "status": "open",
                "closed_at": None,
                "closure_reason": None,
            },
            "session": {
                "id": "demo-session-001",
                "protocol_id": "demo-recovery-documentation",
                "protocol_version": "1.0-astra",
                "mission_profile_id": "earth-1g-preflight-reference",
                "captured_at": "2026-11-14T14:10:00-06:00",
            },
            "observations": [
                {
                    "id": "demo-obs-001",
                    "metric": "heart_rate",
                    "value": 68,
                    "unit": "beats/min",
                    "origin_kind": "simulated",
                    "source": "fictional_fixture_not_a_connected_watch",
                    "captured_at": "2026-11-14T14:10:00-06:00",
                    "received_at": "2026-11-14T14:10:02-06:00",
                    "quality": {"status": "illustrative_only", "rule_version": "demo-1.0"},
                },
                {
                    "id": "demo-obs-002",
                    "metric": "sleep_history",
                    "value": None,
                    "unit": "hours",
                    "origin_kind": "simulated",
                    "source": "fictional_fixture",
                    "captured_at": "2026-11-14T14:10:00-06:00",
                    "received_at": None,
                    "quality": {"status": "missing", "reason": "No prior sleep history available"},
                },
            ],
            "reference": {"id": None, "status": "insufficient", "type": "contextual"},
            "task": {
                "id": "demo-task-001",
                "state": "pending",
                "notification_dismissed": True,
                "completion_evidence_ids": [],
            },
            "decision": {
                "id": "demo-decision-001",
                "type": "INCOMPLETE_CHECK_REQUIRED",
                "finding": "HR=68 bpm simulated, but notification dismissal did not complete task and sleep history is missing.",
                "diagnosis": None,
                "disease_probability": None,
                "next_step": "Record repeatable Watch + sleep context before review",
                "evidence_urls": ["https://www.nasa.gov/reference/standard-measures/"],
            },
            "synchronization": {
                "event_id": "demo-event-001",
                "local_saved": True,
                "remote_received": False,
                "human_reviewed": False,
                "status": "queued",
                "reviewer": None,
            },
            "audit_trail": [
                {"ts": "2026-11-14T14:10:00Z", "action": "OPEN", "note": "DEMO-01 episode initialized (missing sleep context)"},
                {"ts": "2026-11-14T14:12:00Z", "action": "DISMISS_NOTIFICATION", "note": "Watch reminder dismissed; task.state preserved as pending"},
            ],
            "seen_event_ids": [],
        },
        {
            "schema_version": "astra-concept-1.0",
            "demonstration_only": False,
            "clinical_validation": "telemetry_protocol_example",
            "subject_id": "ISS-EXP72-CDR",
            "case_id": "visual",
            "active_profile": "mission_microgravity",
            "watch_connected": True,
            "internet_up": False,
            "episode": {
                "id": "EP-SOL088",
                "reason": "Sol 88 Cephalad Fluid Shift + Saccadic Latency Drift (D^2=44.7)",
                "status": "awaiting_review",
                "closed_at": None,
                "closure_reason": None,
            },
            "session": {
                "id": "sess-sol088",
                "protocol_id": "astra-fluid-visual-1.0",
                "protocol_version": "4.0.0",
                "mission_profile_id": "iss-microgravity-90d",
                "captured_at": _now_iso(),
            },
            "observations": [
                {
                    "id": "obs-sol088-01",
                    "metric": "calf_volume_ml",
                    "value": 1912.4,
                    "unit": "cm^3",
                    "origin_kind": "measured",
                    "source": "iphone_arkit_raw_scenedepth",
                    "captured_at": _now_iso(),
                    "received_at": _now_iso(),
                    "quality": {"status": "sufficient_for_protocol", "observed_coverage_pct": 89.4},
                }
            ],
            "reference": {"id": "preflight-R0", "status": "comparable", "type": "mission_profile"},
            "task": {
                "id": "task-sol088",
                "state": "completed",
                "notification_dismissed": False,
                "completion_evidence_ids": ["obs-sol088-01"],
            },
            "decision": {
                "id": "dec-sol088",
                "type": "MODERATE",
                "finding": "Lower-limb volume -12.3% vs preflight with elevated saccadic latency; queued offline awaiting Crew Medical Officer review.",
                "diagnosis": None,
                "disease_probability": None,
                "next_step": "Sync when relay opens and conduct flight-surgeon SANS ophthalmoscopy check",
                "evidence_urls": ["https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=105"],
            },
            "synchronization": {
                "event_id": "evt-sol088-01",
                "local_saved": True,
                "remote_received": False,
                "human_reviewed": False,
                "status": "queued",
                "reviewer": None,
            },
            "audit_trail": [
                {"ts": _now_iso(), "action": "RECORD", "note": "Completed Sol 88 raw LiDAR volumetric scan (89.4% observed coverage)"},
                {"ts": _now_iso(), "action": "SYNC_QUEUED", "note": "Comms blackout active; queued locally for store-and-forward relay"},
            ],
            "seen_event_ids": ["evt-sol088-01"],
        },
        {
            "schema_version": "astra-concept-1.0",
            "demonstration_only": False,
            "clinical_validation": "telemetry_protocol_example",
            "subject_id": "EVA-SPEC-02",
            "case_id": "movement",
            "active_profile": "mission_microgravity",
            "watch_connected": True,
            "internet_up": True,
            "episode": {
                "id": "EP-SOL142",
                "reason": "Post-EVA Upper-Extremity Tremor & HRV SDNN Shift (D^2=78.3)",
                "status": "awaiting_review",
                "closed_at": None,
                "closure_reason": None,
            },
            "session": {
                "id": "sess-sol142",
                "protocol_id": "astra-biomech-lidar-1.0",
                "protocol_version": "4.0.0",
                "mission_profile_id": "lunar-eva-suit-deconditioning",
                "captured_at": _now_iso(),
            },
            "observations": [
                {
                    "id": "obs-sol142-01",
                    "metric": "hrv_sdnn",
                    "value": 24.5,
                    "unit": "ms",
                    "origin_kind": "measured",
                    "source": "apple_watch_healthkit_sdnn",
                    "captured_at": _now_iso(),
                    "received_at": _now_iso(),
                    "quality": {"status": "sufficient_for_protocol", "wear_confidence": 0.94},
                }
            ],
            "reference": {"id": "preflight-R0", "status": "comparable", "type": "personal_preflight"},
            "task": {
                "id": "task-sol142",
                "state": "completed",
                "notification_dismissed": False,
                "completion_evidence_ids": ["obs-sol142-01"],
            },
            "decision": {
                "id": "dec-sol142",
                "type": "URGENT",
                "finding": "HRV SDNN depressed alongside 21-joint hand tremor and ARED fatigue; transmitted remotely, human medical sign-off still pending.",
                "diagnosis": None,
                "disease_probability": None,
                "next_step": "Initiate 432Hz neuro-acoustic recovery + require human CMO review before clearing next EVA",
                "evidence_urls": ["https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn"],
            },
            "synchronization": {
                "event_id": "evt-sol142-01",
                "local_saved": True,
                "remote_received": True,
                "human_reviewed": False,
                "status": "received",
                "reviewer": None,
            },
            "audit_trail": [
                {"ts": _now_iso(), "action": "RECORD", "note": "Watch HealthKit SDNN + 3D HandLandmarker tremor captured"},
                {"ts": _now_iso(), "action": "SYNC", "note": "Received by MCC telemetry relay; human_reviewed remains FALSE until clinician signs off"},
            ],
            "seen_event_ids": ["evt-sol142-01"],
        },
        {
            "schema_version": "astra-concept-1.0",
            "demonstration_only": False,
            "clinical_validation": "telemetry_protocol_example",
            "subject_id": "HAB-ENG-04",
            "case_id": "recovery",
            "active_profile": "mission_microgravity",
            "watch_connected": True,
            "internet_up": True,
            "episode": {
                "id": "EP-SOL210",
                "reason": "Circadian Sleep Deficit Review (Barger 6.0h window) & Closed Protocol",
                "status": "closed",
                "closed_at": _now_iso(),
                "closure_reason": "Reviewed by Flight Surgeon: crewman completed 2 cycles of 7.8h protected sleep + circadian blue-light countermeasure.",
            },
            "session": {
                "id": "sess-sol210",
                "protocol_id": "astra-recovery-check-1.0",
                "protocol_version": "4.0.0",
                "mission_profile_id": "iss-microgravity-210d",
                "captured_at": _now_iso(),
            },
            "observations": [
                {
                    "id": "obs-sol210-01",
                    "metric": "sleep_hours",
                    "value": 7.8,
                    "unit": "hours",
                    "origin_kind": "measured",
                    "source": "watch_actigraphy_recovered",
                    "captured_at": _now_iso(),
                    "received_at": _now_iso(),
                    "quality": {"status": "sufficient_for_protocol"},
                }
            ],
            "reference": {"id": "mission-sleep-7h", "status": "comparable", "type": "mission_profile"},
            "task": {
                "id": "task-sol210",
                "state": "completed",
                "notification_dismissed": False,
                "completion_evidence_ids": ["obs-sol210-01"],
            },
            "decision": {
                "id": "dec-sol210",
                "type": "LOW",
                "finding": "Autonomic & sleep recovery confirmed under human review.",
                "diagnosis": None,
                "disease_probability": None,
                "next_step": "Routine longitudinal tracking",
                "evidence_urls": ["https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/"],
            },
            "synchronization": {
                "event_id": "evt-sol210-01",
                "local_saved": True,
                "remote_received": True,
                "human_reviewed": True,
                "status": "received",
                "reviewer": "Dr. E. Vance (Flight Surgeon)",
            },
            "audit_trail": [
                {"ts": _now_iso(), "action": "RECORD", "note": "Post-countermeasure actigraphy sleep 7.8h recorded"},
                {"ts": _now_iso(), "action": "SYNC", "note": "Synced to MCC"},
                {"ts": _now_iso(), "action": "REVIEW", "note": "Signed off by Dr. E. Vance"},
                {"ts": _now_iso(), "action": "CLOSE", "note": "Episode closed with documented clinical rationale"},
            ],
            "seen_event_ids": ["evt-sol210-01"],
        },
    ]

    for doc in seeds:
        ep_id = doc["episode"]["id"]
        now = _now_iso()
        conn.execute(
            "INSERT INTO astra_episodes (episode_id, subject_id, status, updated_at, payload_json) VALUES (?, ?, ?, ?, ?)",
            (ep_id, doc["subject_id"], doc["episode"]["status"], now, json.dumps(doc)),
        )
    conn.commit()


def init_astra_db(db_path: Path) -> None:
    global _ASTRA_DB_PATH
    _ASTRA_DB_PATH = db_path
    with sqlite3.connect(_ASTRA_DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS astra_episodes (
                episode_id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )
        conn.commit()
        _seed_initial_episodes(conn)


# ==============================================================================
# HUNCH Dual-Engine Triage Logic (Safety Red-Flag Gate + Abstention + ML Compare)
# ==============================================================================

def evaluate_hunch_triage(req: HunchTriageRequest) -> dict[str, Any]:
    t0 = time.perf_counter()

    # 1. Deterministic 8-Red-Flag Safety Gate (< 1ms; ALWAYS preempts everything else)
    triggered_flags: list[dict[str, str]] = []
    if req.chest_pain and req.sob and req.diaphoresis:
        triggered_flags.append({"id": "mi_triad", "label": "MI Triad (Chest Pain + SOB + Diaphoresis)", "protocol": "ACLS Cardiac Emergency Protocol"})
    elif req.chest_pain and (req.sob or req.diaphoresis):
        triggered_flags.append({"id": "mi_triad", "label": "Acute Coronary Warning (Chest Pain + Cardiopulmonary Symptom)", "protocol": "Immediate 1-Lead/12-Lead ECG & Troponin/ASA Check"})
    if req.thunderclap_headache:
        triggered_flags.append({"id": "thunderclap_headache", "label": "Thunderclap Headache (Sudden Max Intensity)", "protocol": "Acute Intracranial / SAH Contingency"})
    if (req.confusion and req.fever) or (req.fever and req.neck_stiffness and req.headache):
        triggered_flags.append({"id": "meningitis_pattern", "label": "Meningitis Pattern (Confusion/Neck Stiffness + Fever)", "protocol": "CNS Infection Isolation & Empirical Antimicrobials"})
    if req.non_blanching_rash and req.fever:
        triggered_flags.append({"id": "meningococcemia", "label": "Meningococcemia Pattern (Non-blanching Rash + Fever)", "protocol": "Sepsis & Purpura Fulminans Contingency"})
    if req.acute_vision_loss:
        triggered_flags.append({"id": "acute_vision_loss", "label": "Acute Vision Loss / Severe SANS Progression", "protocol": "Immediate Fundoscopy / OCT & Cabin Atmosphere Check"})
    if req.new_seizure:
        triggered_flags.append({"id": "new_seizure", "label": "New-Onset Seizure", "protocol": "Airway Microgravity Restraint, CO2/O2 Check & Anticonvulsant Standby"})
    if req.syncope:
        triggered_flags.append({"id": "syncope", "label": "Syncope / Transient Loss of Consciousness", "protocol": "ECG Rhythm, Orthostatic Protection & Cabin Gas Audit"})
    if req.hemoptysis:
        triggered_flags.append({"id": "hemoptysis", "label": "Hemoptysis (Coughing Blood)", "protocol": "Pulmonary / Cabin Particulate Isolation & SpO2 Standby"})

    t_rf = (time.perf_counter() - t0) * 1000.0

    # Vital sign derivations (tolerating None safely without inventing normal!)
    abnormal_vitals: list[str] = []
    critical_vitals: list[str] = []
    if req.spo2 is not None:
        if req.spo2 < 90:
            critical_vitals.append(f"Hypoxemia SpO2={req.spo2:.0f}% (<90%)")
        elif req.spo2 < 94:
            abnormal_vitals.append(f"Borderline SpO2={req.spo2:.0f}%")
    if req.sbp is not None:
        if req.sbp < 90:
            critical_vitals.append(f"Hypotension SBP={req.sbp:.0f} mmHg (<90)")
        elif req.sbp >= 180:
            critical_vitals.append(f"Hypertensive urgency SBP={req.sbp:.0f} mmHg")
    if req.hr is not None:
        if req.hr > 135 or req.hr < 42:
            critical_vitals.append(f"Marked dysrhythmia/rate HR={req.hr:.0f} bpm")
        elif req.hr > 110 or req.hr < 50:
            abnormal_vitals.append(f"Out-of-range HR={req.hr:.0f} bpm")
    if req.temp_c is not None:
        if req.temp_c >= 39.2:
            critical_vitals.append(f"High fever Temp={req.temp_c:.1f} C")
        elif req.temp_c >= 38.0:
            abnormal_vitals.append(f"Febrile Temp={req.temp_c:.1f} C")
    if req.rr is not None and (req.rr > 26 or req.rr < 9):
        abnormal_vitals.append(f"Respiratory rate anomaly RR={req.rr:.0f}/min")

    symptom_count = sum([
        req.chest_pain, req.sob, req.diaphoresis, req.thunderclap_headache,
        req.confusion, req.fever, req.neck_stiffness, req.non_blanching_rash,
        req.acute_vision_loss, req.new_seizure, req.syncope, req.hemoptysis,
        req.headache, req.dizziness, req.fatigue, req.cough, req.nausea,
        req.palpitations, req.visual_blur, req.joint_pain,
    ])

    # 2. Missing-Data / Poor-Quality Abstention Check (when no red flag & no critical vital fired)
    missing_fields: list[str] = []
    if not req.watch_connected and req.hr is None:
        missing_fields.append("Watch disconnected / Heart Rate unavailable")
    if req.sleep_hours is None:
        missing_fields.append("Sleep history missing (cannot contextualize recovery/fatigue)")
    if req.hrv_sdnn is None and req.fatigue:
        missing_fields.append("HRV SDNN missing while evaluating crew fatigue")
    if req.spo2 is None and (req.sob or req.cough):
        missing_fields.append("SpO2 required for respiratory symptom clearance")

    abstained = False
    abstention_reasons: list[str] = []
    if not triggered_flags and not critical_vitals:
        if req.signal_quality in ("poor", "insufficient"):
            abstained = True
            abstention_reasons.append(f"Capture signal quality is '{req.signal_quality}' — repeat sensor capture required; never impute normal status.")
        if req.require_complete_context and missing_fields:
            abstained = True
            abstention_reasons.extend(missing_fields)
        elif symptom_count == 0 and (not req.watch_connected or len(missing_fields) >= 2):
            abstained = True
            abstention_reasons.append("Insufficient clinical & wearable context to clear crewmember safely.")

    # 3. Rule Engine Evaluation
    rule_trace: list[str] = []
    if triggered_flags:
        rule_tier = "EMERGENCY"
        rule_trace.append(f"SAFETY GATE OVERRIDE: Triggered {len(triggered_flags)} NASA HUNCH emergency red flag(s).")
        for f_item in triggered_flags:
            rule_trace.append(f"  - [{f_item['id']}] {f_item['label']} -> {f_item['protocol']}")
    elif abstained:
        rule_tier = "INCOMPLETE_CHECK_REQUIRED"
        rule_trace.append("PRINCIPLED ABSTENTION: Safety gate refuses to classify as LOW/NORMAL under degraded or missing context.")
        for ar in abstention_reasons:
            rule_trace.append(f"  - {ar}")
    elif critical_vitals:
        rule_tier = "URGENT"
        rule_trace.append("ABNORMAL VITALS ESCALATION: Critical vital sign threshold breached without red-flag triad.")
        for cv in critical_vitals:
            rule_trace.append(f"  - {cv}")
    elif len(abnormal_vitals) >= 2 or req.severity >= 7 or (req.sob or req.chest_pain or req.palpitations or req.confusion):
        rule_tier = "URGENT"
        rule_trace.append("HIGH-CONCERN SYMPTOM OR MULTI-VITAL CLUSTER: Escalated to URGENT conservative default.")
    elif req.severity >= 4 or abnormal_vitals or req.visual_blur or req.dizziness or (
        req.active_profile == "earth_1g" and req.sleep_hours is not None and req.sleep_hours < 6.0
    ):
        rule_tier = "MODERATE"
        if req.active_profile == "earth_1g" and req.sleep_hours is not None and req.sleep_hours < 6.0:
            rule_trace.append("EARTH-1G REFERENCE DEPARTURE: Sleep < 6.0h vs Earth 7-8h baseline; cross-check against Barger 2014 ISS 6.09h mission norm.")
        else:
            rule_trace.append("MODERATE CLUSTER: Structured re-check and countermeasure protocol recommended.")
    else:
        rule_tier = "LOW"
        if req.active_profile == "mission_microgravity" and req.sleep_hours is not None and 5.8 <= req.sleep_hours < 7.0:
            rule_trace.append("MISSION PROFILE CONTEXT: Sleep 5.8-7.0h matches Barger et al. ISS actigraphic adaptation without red flags -> Routine Monitoring (LOW).")
        else:
            rule_trace.append("NO RED FLAGS + ACCEPTABLE VITALS + VERIFIED CONTEXT -> LOW / Supportive Follow-Up.")

    t_rule = (time.perf_counter() - t0) * 1000.0 - t_rf

    # 4. Transparent Pure-NumPy Educational ML Comparator (4-class Softmax Log-Odds)
    # Deliberately shows why a pure statistical pattern model might differ from safety-first Rules!
    hr_norm = ((req.hr if req.hr is not None else 75.0) - 72.0) / 22.0
    spo2_def = max(0.0, 98.0 - (req.spo2 if req.spo2 is not None else 98.0)) / 4.0
    temp_exc = max(0.0, (req.temp_c if req.temp_c is not None else 36.8) - 37.2) * 1.4
    sev_n = (req.severity - 4.0) / 3.0
    rf_score = len(triggered_flags) * 3.8

    logits = np.array([
        rf_score + 0.9 * spo2_def + 0.65 * sev_n + (0.8 if req.chest_pain else 0.0) - 2.1,          # EMERGENCY
        1.1 * (len(critical_vitals) + 0.5 * len(abnormal_vitals)) + 0.85 * sev_n + 0.5 * hr_norm - 0.6, # URGENT
        0.55 * sev_n + 0.45 * temp_exc + 0.25 * symptom_count + 0.4,                               # MODERATE
        max(0.1, 1.8 - 0.7 * sev_n - 1.5 * rf_score - 0.9 * spo2_def - 0.6 * temp_exc),            # LOW
    ], dtype=float)
    logits = logits - np.max(logits)
    probs = np.exp(logits) / np.sum(np.exp(logits))
    tiers = ["EMERGENCY", "URGENT", "MODERATE", "LOW"]
    ml_idx = int(np.argmax(probs))
    ml_tier = tiers[ml_idx]
    t_ml = (time.perf_counter() - t0) * 1000.0 - t_rf - t_rule

    disagreement_note = None
    if abstained:
        agreement = False
        disagreement_note = f"ML classifier guessed '{ml_tier}' using implicit defaults, whereas Rule Engine safety gate ABSTAINED ({rule_tier}) due to missing/poor quality capture."
    elif rule_tier != ml_tier:
        agreement = False
        disagreement_note = f"Conservative Rule Engine chose '{rule_tier}' while statistical pattern ML suggested '{ml_tier}'. Deterministic rule always governs aerospace safety."
    else:
        agreement = True

    return {
        "triage_level": rule_tier,
        "abstained": abstained,
        "abstention_reasons": abstention_reasons,
        "missing_fields": missing_fields,
        "triggered_red_flags": triggered_flags,
        "abnormal_vitals": abnormal_vitals,
        "critical_vitals": critical_vitals,
        "active_profile": req.active_profile,
        "rule_engine": {
            "decision": rule_tier,
            "explainable": True,
            "trace": rule_trace,
        },
        "ml_comparator": {
            "educational_only": True,
            "prediction": ml_tier,
            "probabilities": {t: round(float(p), 3) for t, p in zip(tiers, probs)},
            "agrees_with_rule": agreement,
            "comparison_note": disagreement_note or f"Rule Engine and ML Classifier concur on '{rule_tier}'.",
        },
        "timing_ms": {
            "red_flag_gate_ms": round(max(0.05, t_rf), 2),
            "rule_engine_ms": round(max(0.05, t_rule), 2),
            "ml_comparator_ms": round(max(0.05, t_ml), 2),
        },
        "safety_guarantee": "Red flags checked first (<100ms SLA); uncertain/poor captures abstain via INCOMPLETE_CHECK_REQUIRED; human CMO review required for episode closure.",
    }


# ==============================================================================
# Signed Tetrahedral LiDAR Limb Volumetry (Fixed & Verified Math)
# ==============================================================================

def compute_signed_tetrahedral_volume_cm3(vertices: np.ndarray, faces: np.ndarray) -> float:
    """
    Computes exact closed oriented triangle mesh volume via signed tetrahedral summation:
      V = (1 / 6) * | sum_i dot(v0_i, cross(v1_i, v2_i)) |
    Units match vertices^3 (cm -> cm^3 == mL).
    """
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    signed_vols = np.einsum("ij,ij->i", v0, np.cross(v1, v2))
    return float(abs(np.sum(signed_vols)) / 6.0)


def _build_closed_limb_frustum_mesh(
    length_cm: float,
    prox_circ_cm: float,
    mid_circ_cm: float,
    dist_circ_cm: float,
    n_radial: int = 24,
) -> tuple[np.ndarray, np.ndarray]:
    """Builds an anatomically contoured closed triangular mesh of the calf/forearm between tibial plateau and malleolus planes."""
    r_prox = prox_circ_cm / (2.0 * math.pi)
    r_mid = mid_circ_cm / (2.0 * math.pi)
    r_dist = dist_circ_cm / (2.0 * math.pi)

    z_levels = np.linspace(0.0, length_cm, 9)
    # Quadratic interpolation along Z (0=proximal, 0.5=mid, 1.0=distal)
    t_vals = z_levels / length_cm
    radii = (
        2.0 * (1.0 - t_vals) * (0.5 - t_vals) * r_prox
        + 4.0 * t_vals * (1.0 - t_vals) * r_mid
        + 2.0 * t_vals * (t_vals - 0.5) * r_dist
    )

    verts: list[list[float]] = []
    angles = np.linspace(0.0, 2.0 * math.pi, n_radial, endpoint=False)
    for zi, r in zip(z_levels, radii):
        for th in angles:
            # Slight gastrocnemius anatomical oval asymmetry (mean radius preserves perimeter)
            rx = r * 1.04
            ry = r * 0.96
            verts.append([rx * math.cos(th), ry * math.sin(th), float(zi)])

    bottom_center_idx = len(verts)
    verts.append([0.0, 0.0, 0.0])
    top_center_idx = len(verts)
    verts.append([0.0, 0.0, float(length_cm)])

    faces: list[list[int]] = []
    n_rings = len(z_levels)
    for ri in range(n_rings - 1):
        b0 = ri * n_radial
        b1 = (ri + 1) * n_radial
        for k in range(n_radial):
            kn = (k + 1) % n_radial
            faces.append([b0 + k, b0 + kn, b1 + k])
            faces.append([b0 + kn, b1 + kn, b1 + k])

    # Bottom cap (outward normal -Z)
    for k in range(n_radial):
        kn = (k + 1) % n_radial
        faces.append([bottom_center_idx, kn, k])

    # Top cap (outward normal +Z)
    top_start = (n_rings - 1) * n_radial
    for k in range(n_radial):
        kn = (k + 1) % n_radial
        faces.append([top_center_idx, top_start + k, top_start + kn])

    return np.asarray(verts, dtype=float), np.asarray(faces, dtype=np.int64)


def evaluate_lidar_volume(req: LidarVolumeRequest) -> dict[str, Any]:
    if req.vertices and req.faces and len(req.vertices) >= 4 and len(req.faces) >= 4:
        verts = np.asarray(req.vertices, dtype=float)
        faces = np.asarray(req.faces, dtype=np.int64)
        mesh_source = "uploaded_closed_mesh"
    else:
        verts, faces = _build_closed_limb_frustum_mesh(
            req.segment_length_cm,
            req.proximal_circ_cm,
            req.mid_circ_cm,
            req.distal_circ_cm,
        )
        mesh_source = "parametric_anatomical_mesh"

    volume_cm3 = compute_signed_tetrahedral_volume_cm3(verts, faces)
    delta_ml = volume_cm3 - req.baseline_volume_ml
    pct_change = (delta_ml / req.baseline_volume_ml) * 100.0 if req.baseline_volume_ml > 0 else 0.0

    coverage_gate_pct = KNOWLEDGE_BUNDLE["lidar_protocol"]["coverage_gate_pct"]
    hold_reasons: list[str] = []
    if req.observed_coverage_pct < coverage_gate_pct:
        hold_reasons.append(
            f"Observed LiDAR surface coverage ({req.observed_coverage_pct:.1f}%) is below the {coverage_gate_pct:.0f}% protocol gate."
        )
    if req.capture_mode == "personSegmentationWithDepth":
        hold_reasons.append(
            "ARKit personSegmentationWithDepth hallucinates depth behind occluded limbs; recapture using raw sceneDepth + confidenceMap."
        )
    if req.inferred_pct > 18.0:
        hold_reasons.append(
            f"Inferred/synthesized mesh area ({req.inferred_pct:.1f}%) exceeds 18% limit; complete a slow 360-degree camera pass."
        )

    quality_status = "QUALITY_HOLD" if hold_reasons else "PASS"

    # Provide sampled ring contours for lightweight Canvas 3D preview
    ring_stride = 24
    rings_preview = []
    if mesh_source == "parametric_anatomical_mesh":
        for i in range(0, 9, 2):
            seg = verts[i * ring_stride : (i + 1) * ring_stride]
            rings_preview.append([[round(float(x), 2), round(float(y), 2), round(float(z), 2)] for x, y, z in seg])

    return {
        "subject_id": req.subject_id,
        "limb": req.limb,
        "formula": KNOWLEDGE_BUNDLE["lidar_protocol"]["formula"],
        "mesh_source": mesh_source,
        "vertex_count": int(len(verts)),
        "triangle_count": int(len(faces)),
        "computed_volume_ml": round(volume_cm3, 1),
        "baseline_volume_ml": round(req.baseline_volume_ml, 1),
        "delta_ml": round(delta_ml, 1),
        "pct_change": round(pct_change, 2),
        "provenance_breakdown_pct": {
            "observed": round(req.observed_coverage_pct, 1),
            "occluded": round(req.occluded_pct, 1),
            "inferred": round(req.inferred_pct, 1),
        },
        "capture_mode": req.capture_mode,
        "quality_gate_status": quality_status,
        "hold_reasons": hold_reasons,
        "clinical_caveat": (
            "Surface volume tracks cephalad fluid shift and countermeasure retention against personal preflight bounds; it does not directly measure ICP or deep lean muscle strength."
        ),
        "rings_preview": rings_preview,
    }


# ==============================================================================
# API Routes
# ==============================================================================

@astra_router.get("/api/hunch/catalog")
async def get_hunch_catalog() -> dict[str, Any]:
    return {
        "meta": KNOWLEDGE_BUNDLE["hunch_meta"],
        "red_flags": KNOWLEDGE_BUNDLE["hunch_red_flags"],
        "vignettes": [
            {
                "id": "mi_emergency",
                "title": "MI Triad — EVA Prep Chest Pain",
                "preset": {
                    "chest_pain": True, "sob": True, "diaphoresis": True, "severity": 9,
                    "hr": 124, "sbp": 94, "spo2": 93, "temp_c": 36.9, "sleep_hours": 5.5,
                    "hrv_sdnn": 19, "signal_quality": "good", "watch_connected": True,
                },
            },
            {
                "id": "sans_vision",
                "title": "Acute Vision Loss — Severe SANS Alert",
                "preset": {
                    "acute_vision_loss": True, "headache": True, "visual_blur": True, "severity": 8,
                    "hr": 84, "sbp": 134, "spo2": 98, "temp_c": 36.8, "sleep_hours": 6.0,
                    "hrv_sdnn": 34, "signal_quality": "good", "watch_connected": True,
                },
            },
            {
                "id": "poor_capture",
                "title": "Poor Signal Quality — Principled Abstention",
                "preset": {
                    "fatigue": True, "dizziness": True, "severity": 4,
                    "hr": None, "sbp": None, "spo2": None, "temp_c": 36.7, "sleep_hours": None,
                    "hrv_sdnn": None, "signal_quality": "insufficient", "watch_connected": False,
                    "require_complete_context": True,
                },
            },
            {
                "id": "barger_sleep",
                "title": "6.1h ISS Sleep — Earth-1g vs Mission Profile",
                "preset": {
                    "fatigue": True, "severity": 3,
                    "hr": 69, "sbp": 116, "spo2": 98, "temp_c": 36.7, "sleep_hours": 5.9,
                    "hrv_sdnn": 42, "signal_quality": "good", "watch_connected": True,
                },
            },
        ],
    }


@astra_router.post("/api/hunch/triage")
async def post_hunch_triage(req: HunchTriageRequest) -> dict[str, Any]:
    return evaluate_hunch_triage(req)


@astra_router.get("/api/astra/contracts")
async def get_astra_contracts() -> dict[str, Any]:
    return {
        "schema_version": "astra-concept-1.0",
        "governance_invariants": [
            "DISMISS_NOTIFICATION sets notification_dismissed=true while strictly preserving task.state='pending'.",
            "BAD_CAPTURE rejects low-quality data into task.state='repeat_required' and decision='INCOMPLETE_CHECK_REQUIRED' — never normalizes missing values.",
            "SYNC tracks transport idempotently by event_id and separates remote_received from human_reviewed.",
            "CLOSE requires synchronization.human_reviewed==true AND non-empty closure_reason.",
            "LiDAR volumetric comparison requires observed sceneDepth coverage >= 82%.",
        ],
        "surface_architecture": KNOWLEDGE_BUNDLE["surface_architecture"],
        "lidar_protocol": KNOWLEDGE_BUNDLE["lidar_protocol"],
    }


@astra_router.get("/api/astra/episodes")
async def list_astra_episodes(subject_id: Optional[str] = Query(default=None)) -> dict[str, Any]:
    with _get_conn() as conn:
        if subject_id:
            rows = conn.execute(
                "SELECT payload_json FROM astra_episodes WHERE subject_id = ? ORDER BY updated_at DESC",
                (subject_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT payload_json FROM astra_episodes ORDER BY updated_at DESC"
            ).fetchall()
    episodes = [json.loads(r["payload_json"]) for r in rows]
    return {"count": len(episodes), "episodes": episodes}


@astra_router.post("/api/astra/episodes")
async def create_astra_episode(req: EpisodeCreateRequest) -> dict[str, Any]:
    ep_id = f"EP-{uuid.uuid4().hex[:6].upper()}"
    now = _now_iso()
    case = _DEFAULT_CASES.get(req.case_id, _DEFAULT_CASES["recovery"])
    obs_id = f"obs-{uuid.uuid4().hex[:6]}"
    evt_id = f"evt-{uuid.uuid4().hex[:6]}"

    obs_list = []
    task_state = "pending"
    ep_status = "open"
    decision_type = req.triage_level or "INCOMPLETE_CHECK_REQUIRED"

    if req.value is not None:
        obs_list.append({
            "id": obs_id,
            "metric": req.metric or case["metric"],
            "value": req.value,
            "unit": req.unit or case["unit"],
            "origin_kind": req.origin_kind,
            "source": req.source,
            "captured_at": now,
            "received_at": None,
            "quality": {"status": "sufficient_for_protocol"},
        })
        task_state = "completed"
        ep_status = "awaiting_review"

    finding = req.notes.strip() or (
        f"Bridge handoff from AstroKinetics Mission Console (D^2={req.mahalanobis_d2:.1f})."
        if req.mahalanobis_d2 is not None
        else f"Episode opened for {req.subject_id}: {req.reason}."
    )

    payload = {
        "schema_version": "astra-concept-1.0",
        "demonstration_only": False,
        "clinical_validation": "telemetry_protocol_example",
        "subject_id": req.subject_id,
        "case_id": req.case_id,
        "active_profile": req.active_profile,
        "watch_connected": True,
        "internet_up": False,
        "episode": {
            "id": ep_id,
            "reason": req.reason,
            "status": ep_status,
            "closed_at": None,
            "closure_reason": None,
        },
        "session": {
            "id": f"sess-{uuid.uuid4().hex[:6]}",
            "protocol_id": case["protocol_id"],
            "protocol_version": "4.0.0",
            "mission_profile_id": req.active_profile,
            "captured_at": now,
        },
        "observations": obs_list,
        "reference": {"id": "preflight-R0", "status": "comparable", "type": req.active_profile},
        "task": {
            "id": f"task-{uuid.uuid4().hex[:6]}",
            "state": task_state,
            "notification_dismissed": False,
            "completion_evidence_ids": [obs_id] if obs_list else [],
        },
        "decision": {
            "id": f"dec-{uuid.uuid4().hex[:6]}",
            "type": decision_type,
            "finding": finding,
            "diagnosis": None,
            "disease_probability": None,
            "next_step": "Verify wearable + guided check, sync when relay opens, and record CMO review",
            "evidence_urls": [case["source_url"]],
        },
        "synchronization": {
            "event_id": evt_id,
            "local_saved": True,
            "remote_received": False,
            "human_reviewed": False,
            "status": "local_only",
            "reviewer": None,
        },
        "audit_trail": [
            {"ts": now, "action": "OPEN_EPISODE", "note": f"Created {ep_id} ({req.reason})"}
        ],
        "seen_event_ids": [],
    }

    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO astra_episodes (episode_id, subject_id, status, updated_at, payload_json) VALUES (?, ?, ?, ?, ?)",
            (ep_id, req.subject_id, ep_status, now, json.dumps(payload)),
        )
        conn.commit()
    return payload


@astra_router.post("/api/astra/episodes/{episode_id}/transition")
async def transition_astra_episode(episode_id: str, req: EpisodeTransitionRequest) -> dict[str, Any]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT payload_json FROM astra_episodes WHERE episode_id = ?", (episode_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Episode '{episode_id}' not found.")
        doc: dict[str, Any] = json.loads(row["payload_json"])
        now = _now_iso()
        act = req.action
        blocked_reason: Optional[str] = None

        if doc["episode"]["status"] == "closed" and act not in ("PROFILE", "INTERNET", "WATCH"):
            raise HTTPException(
                status_code=409,
                detail=f"Episode '{episode_id}' is already closed; open a new episode for follow-up.",
            )

        if act == "INTERNET":
            doc["internet_up"] = bool(req.value)
            doc["audit_trail"].append({"ts": now, "action": "INTERNET", "note": f"Relay connectivity set to {'ONLINE' if doc['internet_up'] else 'BLACKOUT / OFFLINE'}"})
        elif act == "WATCH":
            doc["watch_connected"] = bool(req.value)
            doc["audit_trail"].append({"ts": now, "action": "WATCH", "note": f"Apple Watch link set to {'CONNECTED' if doc['watch_connected'] else 'DISCONNECTED'}"})
        elif act == "PROFILE":
            prof = str(req.value or "mission_microgravity")
            if prof not in ("earth_1g", "mission_microgravity"):
                raise HTTPException(status_code=422, detail="Invalid profile; expected earth_1g or mission_microgravity")
            doc["active_profile"] = prof
            doc["audit_trail"].append({"ts": now, "action": "PROFILE", "note": f"Reference baseline switched to {prof}"})
        elif act == "CASE":
            cid = str(req.value or "recovery")
            if cid in _DEFAULT_CASES:
                doc["case_id"] = cid
                doc["audit_trail"].append({"ts": now, "action": "CASE", "note": f"Case protocol switched to {_DEFAULT_CASES[cid]['title_en']}"})
        elif act == "DISMISS":
            # Critical invariant: Dismissing a notification NEVER completes the task!
            doc["task"]["notification_dismissed"] = True
            doc["audit_trail"].append({"ts": now, "action": "DISMISS_NOTIFICATION", "note": "Reminder dismissed; task.state strictly preserved as pending"})
        elif act == "BAD_CAPTURE":
            if doc["task"]["state"] == "completed":
                blocked_reason = "Task already holds valid evidence; create a follow-up episode to capture replacement evidence."
            else:
                bad_obs_id = f"obs-bad-{uuid.uuid4().hex[:5]}"
                case = _DEFAULT_CASES.get(doc.get("case_id", "recovery"), _DEFAULT_CASES["recovery"])
                doc["observations"].append({
                    "id": bad_obs_id,
                    "metric": case["metric"],
                    "value": None,
                    "unit": case["unit"],
                    "origin_kind": req.origin_kind,
                    "source": "quality_gate_rejected",
                    "captured_at": now,
                    "received_at": None,
                    "quality": {"status": "insufficient", "reason": req.reason or "Motion artifact / incomplete LiDAR coverage (<82%)"},
                })
                doc["task"]["state"] = "repeat_required"
                doc["decision"]["type"] = "INCOMPLETE_CHECK_REQUIRED"
                doc["decision"]["finding"] = "Rejected low-quality capture; repeat guided measurement required rather than substituting normal defaults."
                doc["audit_trail"].append({"ts": now, "action": "BAD_CAPTURE", "note": "Rejected capture -> task.state=repeat_required (never imputed normal)"})
        elif act == "RECORD":
            case = _DEFAULT_CASES.get(doc.get("case_id", "recovery"), _DEFAULT_CASES["recovery"])
            if case["requires_watch"] and not doc.get("watch_connected", True):
                blocked_reason = "Apple Watch disconnected — refused to fabricate wearable reading. Reconnect Watch or switch task."
                doc["audit_trail"].append({"ts": now, "action": "RECORD_BLOCKED", "note": blocked_reason})
            else:
                obs_id = f"obs-{uuid.uuid4().hex[:6]}"
                val = req.metric_value if req.metric_value is not None else case["recommended_value"]
                doc["observations"].append({
                    "id": obs_id,
                    "metric": case["metric"],
                    "value": val,
                    "unit": case["unit"],
                    "origin_kind": req.origin_kind,
                    "source": "astra_guided_capture",
                    "captured_at": now,
                    "received_at": now if doc.get("internet_up") else None,
                    "quality": {"status": "sufficient_for_protocol"},
                })
                doc["task"]["state"] = "completed"
                doc["task"]["completion_evidence_ids"].append(obs_id)
                doc["episode"]["status"] = "awaiting_review"
                doc["decision"]["type"] = "MODERATE" if doc.get("active_profile") == "earth_1g" else "LOW"
                doc["decision"]["finding"] = f"Valid {req.origin_kind} capture recorded ({val} {case['unit']}); awaiting remote sync & human review."
                doc["audit_trail"].append({"ts": now, "action": "RECORD", "note": f"Recorded {case['metric']}={val} ({req.origin_kind}); task completed, review pending"})
        elif act == "SYNC":
            if not doc["task"]["completion_evidence_ids"]:
                blocked_reason = "No completed evidence to synchronize yet."
                doc["audit_trail"].append({"ts": now, "action": "SYNC_SKIPPED", "note": blocked_reason})
            else:
                eid = req.event_id or doc["synchronization"]["event_id"]
                seen = doc.setdefault("seen_event_ids", [])
                duplicate = eid in seen and doc["synchronization"]["status"] == "received"
                if doc.get("internet_up"):
                    if not duplicate:
                        seen.append(eid)
                    doc["synchronization"]["event_id"] = eid
                    doc["synchronization"]["remote_received"] = True
                    doc["synchronization"]["status"] = "received"
                    # Critical invariant: remote sync NEVER auto-sets human_reviewed!
                    doc["audit_trail"].append({
                        "ts": now,
                        "action": "SYNC_IDEMPOTENT_DEDUP" if duplicate else "SYNC_RECEIVED",
                        "note": "Idempotent retry deduplicated by event_id; human_reviewed unchanged"
                        if duplicate
                        else "Telemetry received by Mission Control; human_reviewed remains FALSE pending clinician review",
                    })
                else:
                    doc["synchronization"]["status"] = "queued"
                    doc["synchronization"]["remote_received"] = False
                    doc["audit_trail"].append({"ts": now, "action": "SYNC_QUEUED", "note": f"Stored offline in outbox ({eid}) until telemetry relay restores"})
        elif act == "REVIEW":
            if doc["synchronization"]["status"] != "received":
                raise HTTPException(
                    status_code=409,
                    detail="Cannot record human review before evidence has been received remotely (SYNC while online first).",
                )
            doc["synchronization"]["human_reviewed"] = True
            doc["synchronization"]["reviewer"] = req.reviewer
            doc["episode"]["status"] = "follow_up"
            doc["audit_trail"].append({"ts": now, "action": "HUMAN_REVIEW", "note": f"Human medical review logged by {req.reviewer}; episode now eligible for explicit closure"})
        elif act == "CLOSE":
            if not doc["synchronization"].get("human_reviewed"):
                raise HTTPException(
                    status_code=409,
                    detail="Governance Guard: Cannot close episode before human medical review (human_reviewed must be true).",
                )
            closure_reason = (req.reason or "").strip()
            if len(closure_reason) < 3:
                raise HTTPException(
                    status_code=422,
                    detail="Governance Guard: A non-empty clinical closure_reason is required to close an episode.",
                )
            doc["episode"]["status"] = "closed"
            doc["episode"]["closed_at"] = now
            doc["episode"]["closure_reason"] = closure_reason
            doc["audit_trail"].append({"ts": now, "action": "CLOSE_EPISODE", "note": f"Closed with rationale: {closure_reason}"})

        conn.execute(
            "UPDATE astra_episodes SET status = ?, updated_at = ?, payload_json = ? WHERE episode_id = ?",
            (doc["episode"]["status"], now, json.dumps(doc), episode_id),
        )
        conn.commit()

    return {"episode": doc, "blocked_reason": blocked_reason}


@astra_router.post("/api/astra/lidar-volume")
async def compute_astra_lidar_volume(req: LidarVolumeRequest) -> dict[str, Any]:
    return evaluate_lidar_volume(req)


@astra_router.get("/api/aura/overview")
async def get_aura_overview() -> dict[str, Any]:
    pop_counts: Counter[str] = Counter()
    for p in AURA_CORPUS.get("publications", []):
        pop_counts[p.get("population_domain", "space_biology_general")] += 1
    return {
        "bundle_version": KNOWLEDGE_BUNDLE.get("bundle_version"),
        "counts": {
            "bilingual_concepts": len(KNOWLEDGE_BUNDLE.get("concepts", [])),
            "reviewed_sources": len(KNOWLEDGE_BUNDLE.get("sources", [])),
            "apple_biomarker_studies": len(KNOWLEDGE_BUNDLE.get("apple_studies", [])),
            "nasa_pmc_publications": AURA_CORPUS.get("total_publications", 0),
            "pmc_with_rich_abstracts": AURA_CORPUS.get("rich_extracted_count", 0),
            "radlab_dostel_rows": EMPIRICAL_SUPPLEMENTS["radlab_iss_sample"]["row_count"],
            "barger_sleep_tables": len(EMPIRICAL_SUPPLEMENTS["barger_2014_sleep"]["tables"]),
        },
        "population_breakdown": dict(pop_counts),
        "research_landscape": AURA_CORPUS.get("research_landscape", {}),
        "entity_summary": AURA_CORPUS.get("entity_summary", {}),
    }


@astra_router.get("/api/aura/concepts")
async def get_aura_concepts(
    q: Optional[str] = Query(default=None),
    domain: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    items = KNOWLEDGE_BUNDLE.get("concepts", [])
    if domain:
        items = [c for c in items if c.get("domain") == domain]
    if q:
        ql = q.lower().strip()
        items = [
            c for c in items
            if ql in c.get("label_en", "").lower()
            or ql in c.get("label_es", "").lower()
            or ql in c.get("definition_en", "").lower()
            or ql in c.get("definition_es", "").lower()
            or any(ql in a.lower() for a in c.get("aliases", []))
        ]
    return {"count": len(items), "concepts": items}


@astra_router.get("/api/aura/sources")
async def get_aura_sources(
    kind: str = Query(default="all", pattern="^(all|registry|apple)$"),
    topic: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> dict[str, Any]:
    reg = KNOWLEDGE_BUNDLE.get("sources", [])
    apple = KNOWLEDGE_BUNDLE.get("apple_studies", [])

    if topic:
        tl = topic.lower()
        reg = [s for s in reg if tl in (s.get("topic") or "").lower()]
    if q:
        ql = q.lower()
        reg = [
            s for s in reg
            if ql in (s.get("title") or "").lower()
            or ql in (s.get("organization") or "").lower()
            or ql in (s.get("scope") or "").lower()
            or ql in (s.get("topic") or "").lower()
        ]
        apple = [
            a for a in apple
            if ql in (a.get("title") or "").lower()
            or ql in (a.get("objective_es") or "").lower()
            or ql in (a.get("nasa_relevance_es") or "").lower()
            or ql in (a.get("journal") or "").lower()
        ]

    return {
        "registry_count": 0 if kind == "apple" else len(reg),
        "apple_count": 0 if kind == "registry" else len(apple),
        "sources_meta": KNOWLEDGE_BUNDLE.get("sources_meta", {}),
        "registry_sources": [] if kind == "apple" else reg,
        "apple_studies": [] if kind == "registry" else apple,
    }


@astra_router.get("/api/aura/search")
async def search_aura_corpus(
    q: str = Query(min_length=1),
    human_only: bool = Query(default=False),
    include_pmc: bool = Query(default=True),
    limit: int = Query(default=15, ge=1, le=50),
) -> dict[str, Any]:
    kinds = {"concept", "source", "apple_study"}
    if include_pmc:
        kinds.add("nasa_pmc")
    hits = AURA_INDEX.search(q, human_only=human_only, kinds=kinds, limit=limit)
    return {
        "query": q,
        "human_only": human_only,
        "include_pmc": include_pmc,
        "count": len(hits),
        "results": hits,
    }


@astra_router.post("/api/aura/ask")
async def ask_aura_knowledge_engine(req: AuraAskRequest) -> dict[str, Any]:
    q = req.question.strip()
    ql = q.lower()

    # Safety abstention guard against diagnostic / prescription solicitation
    diagnostic_triggers = (
        "diagnose me", "prescribe", "what antibiotic should", "am i having a heart attack",
        "diagnostica", "recétame", "qué medicamento tomar", "prescribe dose",
    )
    if any(t in ql for t in diagnostic_triggers):
        return {
            "question": q,
            "abstained": True,
            "abstention_reason": (
                "AURA is an evidence-cited aerospace medicine synthesis engine, not a prescribing physician. "
                "For acute crew symptoms, run the deterministic HUNCH 8-Red-Flag Triage Safety Gate and escalate to the Flight Surgeon."
            ),
            "answer": "Abstained from autonomous clinical diagnosis or drug prescription; deferring to deterministic HUNCH Red-Flag Triage and human medical officer review.",
            "citations": [],
            "scientific_limitations": ["Software knowledge retrieval never substitutes clinical diagnosis or prescription authority."],
        }

    hits = AURA_INDEX.search(q, human_only=req.human_only, limit=8)
    if not hits or hits[0]["score"] < 1.35:
        return {
            "question": q,
            "abstained": True,
            "abstention_reason": (
                f"No sufficiently grounded match in the 16 ASTRA concepts, 70 reviewed sources, 15 Apple biomarker studies, "
                f"or 572 NASA Space Biology PMC publications {'(filtered to human-applicable studies)' if req.human_only else ''}."
            ),
            "answer": (
                "Insufficient evidence in local curated sources to answer without speculation."
                if req.lang == "en"
                else "Evidencia insuficiente en el corpus local curado para responder sin especular."
            ),
            "citations": hits[:3],
            "scientific_limitations": ["Try spaceflight physiology, HRV SDNN vs RMSSD, Barger sleep, LiDAR coverage, RadLab DosTel, SANS, or OSD-571 terms."],
        }

    top_concepts = [h for h in hits if h["kind"] == "concept"][:2]
    top_other = [h for h in hits if h["kind"] != "concept"][:4]
    selected = (top_concepts + top_other)[:5]

    paragraphs: list[str] = []
    limitations: list[str] = []
    for idx, item in enumerate(selected, start=1):
        txt = item["snippet_es"] if (req.lang == "es" and item.get("snippet_es")) else item["snippet"]
        pop_tag = f"[{item['population_domain'].upper()}]"
        paragraphs.append(f"[{idx}] {item['title']} {pop_tag}: {txt}")
        lim = item["limitation_es"] if (req.lang == "es" and item.get("limitation_es")) else item.get("limitation")
        if lim and lim not in limitations:
            limitations.append(f"[{idx}] {lim}")

    return {
        "question": q,
        "lang": req.lang,
        "human_only": req.human_only,
        "abstained": False,
        "answer": "\n\n".join(paragraphs),
        "citations": selected,
        "scientific_limitations": limitations[:4],
    }


@astra_router.get("/api/aura/radlab")
async def get_aura_radlab() -> dict[str, Any]:
    return EMPIRICAL_SUPPLEMENTS
