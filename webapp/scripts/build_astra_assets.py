#!/usr/bin/env python3
"""
Builds compact, offline-ready ASTRA, NASA HUNCH, and AURA knowledge assets
from CarlosJaimes/ASTRA-Space-Health-Companion (/tmp/astra_companion_src)
into webapp/data/*.json without copying raw PDFs, HTML dumps, or heavy artifacts.
"""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SRC_ROOT = Path("/tmp/astra_companion_src")
OUT_DIR = Path(__file__).resolve().parent.parent / "data"

PMCID_RE = re.compile(r"PMC(\d+)", re.IGNORECASE)


def _clean_text(val: Any) -> str:
    if val is None:
        return ""
    return re.sub(r"\s+", " ", str(val)).strip()


def _infer_population_domain(title: str, abstract: str, organisms: list[str]) -> str:
    org_set = {str(o).lower() for o in (organisms or [])}
    blob = f"{title} {abstract}".lower()
    if "human" in org_set or any(k in blob for k in ("astronaut", "crewmember", "cosmonaut", "human", "twins study", "inspiration4", "bed rest", "head-down tilt")):
        if not any(k in blob for k in ("mouse", "mice", "murine", "rodent", "bion-m", "rat ", "rats ")) or "human" in blob:
            return "human"
    if org_set & {"mouse", "rat", "rodent"} or any(k in blob for k in ("mouse", "mice", "murine", "rodent", "bion-m", "rat ", "rats ")):
        return "rodent"
    if org_set & {"arabidopsis", "plant"} or any(k in blob for k in ("arabidopsis", "plant", "seedling", "root", "gravitropism", "chloroplast", "soybean", "wheat", "brassica")):
        return "plant"
    if org_set & {"drosophila"} or any(k in blob for k in ("drosophila", "caenorhabditis", "c. elegans", "zebrafish")):
        return "invertebrate_model"
    if any(k in blob for k in ("bacteria", "escherichia", "bacillus", "pseudomonas", "staphylococcus", "candida", "yeast", "saccharomyces", "biofilm", "microbiome", "cell culture", "fibroblast", "osteoblast", "chondrocyte")):
        return "microbe_or_cell"
    return "space_biology_general"


def build_knowledge_bundle() -> dict[str, Any]:
    seed_path = SRC_ROOT / "packages/knowledge/seed_concepts.json"
    with seed_path.open(encoding="utf-8") as f:
        seed_raw = json.load(f)

    seed_en_overrides = {
        "astra.heart_rate": {
            "definition_en": "Number of beats per minute in an identified measurement. Comparing longitudinal records requires preserved timestamp, sensor source, and activity context.",
            "limitation_en": "An isolated reading or shift from personal baseline never establishes pathology on its own. Availability depends on device permissions and wear state.",
        },
        "astra.hrv_sdnn": {
            "definition_en": "Beat-to-beat variability computed in Apple HealthKit (HKQuantityTypeIdentifier.heartRateVariabilitySDNN) as the standard deviation of normal-to-normal (NN) inter-beat intervals.",
            "limitation_en": "SDNN is NOT RMSSD. Never substitute one for the other or present an isolated SDNN drop as a diagnostic marker of stress or clinical disease.",
        },
        "astra.sleep_context": {
            "definition_en": "Rest duration, circadian timing, and schedule regularity provide critical context before interpreting autonomic recovery, fatigue, or cognitive performance in crew operations.",
            "limitation_en": "Sleep staging from consumer wearables or self-reported fatigue is contextual evidence—distinguish direct measurements, algorithmic estimates, and crew self-reports.",
        },
    }

    concepts: list[dict[str, Any]] = []
    for c in seed_raw.get("concepts", []):
        cid = c["id"]
        extra = seed_en_overrides.get(cid, {})
        concepts.append({
            "id": cid,
            "label_en": c.get("label_en", cid),
            "label_es": c.get("label_es", cid),
            "aliases": c.get("aliases", []),
            "unit": c.get("unit"),
            "domain": "autonomic_wearable",
            "definition_en": extra.get("definition_en", c.get("definition_es", "")),
            "definition_es": c.get("definition_es", ""),
            "limitation_en": extra.get("limitation_en", c.get("limitation_es", "")),
            "limitation_es": c.get("limitation_es", ""),
            "sources": c.get("sources", []),
        })

    extended_concepts = [
        {
            "id": "astra.fluid_shift",
            "label_en": "Cephalad fluid shift & lower-limb volume loss",
            "label_es": "Desplazamiento cefálico de fluidos y pérdida de volumen en piernas",
            "aliases": ["fluid shift", "bird legs", "calf volume", "puffy face", "desplazamiento de fluidos", "edema facial", "piernas"],
            "unit": "mL / %",
            "domain": "fluid_musculoskeletal",
            "definition_en": "Redistribution of ~1.5-2.0 L of intravascular and interstitial fluid toward the head and thorax in microgravity due to loss of the Earth hydrostatic column, producing lower-extremity volume reduction and facial fullness.",
            "definition_es": "Redistribución de fluidos hacia cabeza y tórax en microgravedad al desaparecer la columna hidrostática terrestre, causando edema facial y pérdida de volumen en extremidades inferiores.",
            "limitation_en": "Circumference or surface LiDAR volume changes document anatomical redistribution and countermeasure tracking; they do not independently quantify cardiac preload or ICP without clinical imaging.",
            "limitation_es": "Los cambios de volumen superficial o circunferencia documentan redistribución anatómica; no miden presión intracraneal ni precarga por sí solos.",
            "sources": [
                {"title": "NASA Human Research Roadmap: SANS & Fluid Shifts", "url": "https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=105"},
                {"title": "NASA Standard Measures Reference", "url": "https://www.nasa.gov/reference/standard-measures/"},
            ],
        },
        {
            "id": "astra.sans_ocular",
            "label_en": "Spaceflight-Associated Neuro-ocular Syndrome (SANS)",
            "label_es": "Síndrome neuro-ocular asociado al vuelo espacial (SANS)",
            "aliases": ["sans", "optic disc", "papilledema", "saccadic", "ocular", "vision loss", "visión", "disco óptico"],
            "unit": "ms / deg",
            "domain": "neuro_ocular",
            "definition_en": "Microgravity-related ocular and neuro-ophthalmic changes including hyperopic shift, globe flattening, choroidal folds, and optic disc edema linked to chronic cephalad fluid shifts.",
            "definition_es": "Cambios neuro-oftálmicos por microgravedad (edema del disco óptico, aplanamiento del globo ocular, pliegues coroideos) asociados al desplazamiento cefálico crónico de fluidos.",
            "limitation_en": "High-frequency saccadic latency or subjective blurry vision screens warrant documented clinical ophthalmoscopy, OCT, or Fundoscope confirmation—software telemetry cannot diagnose SANS.",
            "limitation_es": "La latencia sacádica o síntomas visuales requieren confirmación con oftalmoscopía/OCT clínica; la telemetría no diagnostica SANS.",
            "sources": [
                {"title": "NASA Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)", "url": "https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=105"},
                {"title": "Mader et al. / NASA HRP Evidence Report", "url": "https://humanresearchroadmap.nasa.gov/"},
            ],
        },
        {
            "id": "astra.orthostatic_intolerance",
            "label_es": "Intolerancia ortostática post-vuelo",
            "label_en": "Post-flight / gravitational transition orthostatic intolerance",
            "aliases": ["orthostatic", "syncope", "intolerancia ortostática", "mareo", "fainting", "apollo heart rate"],
            "unit": "beats/min / mmHg",
            "domain": "cardiovascular",
            "definition_en": "Deconditioning of arterial baroreflexes and reduced plasma volume after weightlessness that impair blood pressure regulation upon returning to 1g or planetary gravity.",
            "definition_es": "Desacondicionamiento barorreflejo y reducción del volumen plasmático tras microgravedad que dificultan mantener la presión arterial al regresar a gravedad.",
            "limitation_en": "Heart-rate elevations from historic Apollo orthostatic tables or wearable logs must be interpreted against mission phase and hydration; watch HR alone cannot measure blood pressure.",
            "limitation_es": "La frecuencia cardíaca por sí sola (tablas históricas Apollo o reloj) no mide presión arterial ni confirma síncope ortostático sin contexto.",
            "sources": [
                {"title": "NASA NLSP AP005 Apollo Heart Rate vs Controls", "url": "https://nlsp.nasa.gov/search/data/details/IDP-LSDA_DATASET-0000000000000227?dataType=DATASETS"},
                {"title": "NASA Orthostatic Intolerance Risk", "url": "https://humanresearchroadmap.nasa.gov/"},
            ],
        },
        {
            "id": "astra.lidar_calf_volume",
            "label_en": "Closed-mesh signed tetrahedral LiDAR volumetry",
            "label_es": "Volumetría LiDAR por malla cerrada tetraédrica",
            "aliases": ["lidar", "tetrahedral", "calf volume", "mesh coverage", "arkit", "scenedepth", "volumetría"],
            "unit": "cm^3 (mL)",
            "domain": "fluid_musculoskeletal",
            "definition_en": "Computation of lower-limb segment volume from a closed oriented triangle mesh using signed tetrahedral summation V = |sum a · (b × c)| / 6 bounded by anatomical tibial plateau and malleolus planes, gated by observed LiDAR coverage >= 82%.",
            "definition_es": "Cálculo geométrico de volumen segmentario mediante suma tetraédrica firmada V = |sum a · (b × c)| / 6 sobre malla triangular cerrada acotada por planos anatómicos, condicionada a cobertura observada >= 82%.",
            "limitation_en": "ARKit personSegmentationWithDepth can hallucinate smooth surfaces over uncaptured back arcs; production capture must distinguish directly observed depth from occluded/inferred regions using raw sceneDepth + confidenceMap.",
            "limitation_es": "personSegmentationWithDepth puede interpolar caras no vistas; se debe separar cobertura observada real de oclusión con sceneDepth y confidenceMap antes de comparar sesiones.",
            "sources": [
                {"title": "Apple ARKit sceneDepth & confidenceMap", "url": "https://developer.apple.com/documentation/arkit/arframedata/scenedepth"},
                {"title": "Zhang & Chen (2001) Efficient Feature Extraction for 2D/3D Objects in Mesh Representation", "url": "https://ieeexplore.ieee.org/document/958278"},
            ],
        },
        {
            "id": "astra.circadian_phase",
            "label_en": "Circadian phase shifting & ISS sleep deficit",
            "label_es": "Desajuste circadiano y déficit de sueño en ISS",
            "aliases": ["circadian", "barger", "sleep deficiency", "melatonin", "dso-484", "acrophase", "circadiano"],
            "unit": "hours / deg",
            "domain": "behavioral_circadian",
            "definition_en": "90-minute orbital light/dark cycles and operational shifts desynchronize the suprachiasmatic pacemaker; Barger et al. (2014, Lancet Neurology) documented actigraphic ISS mean sleep of 6.09 h vs 8.5 h scheduled.",
            "definition_es": "Los ciclos orbitales de 90 min y cambios de turno desincronizan el ritmo circadiano; Barger et al. (2014) midieron 6.09 h medias por actigrafía en ISS.",
            "limitation_en": "DSO-484 circadian acrophases and Barger 2014 tables summarize cohort averages; individual crew fatigue and alertness require multi-night trends plus subjective diary checks.",
            "limitation_es": "Las tablas DSO-484 y Barger 2014 reflejan promedios de cohorte; evaluar fatiga individual exige series repetidas y contexto operativo.",
            "sources": [
                {"title": "Barger et al. (2014) Prevalence of sleep deficiency in spaceflight (PMC4188436)", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/"},
                {"title": "NASA Risk from Inadequate Sleep and Irregular Schedules", "url": "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/"},
            ],
        },
        {
            "id": "astra.radiation_dosimetry",
            "label_en": "ISS RadLab absorbed radiation dosimetry (DosTel)",
            "label_es": "Dosimetría de radiación ionizante ISS RadLab (DosTel)",
            "aliases": ["radlab", "dostel", "radiation", "saa", "south atlantic anomaly", "dose rate", "radiación"],
            "unit": "uGy/h",
            "domain": "space_environment",
            "definition_en": "Empirical ionizing radiation flux and absorbed dose-rate measurements across LEO altitudes (~390-420 km) and South Atlantic Anomaly passages captured by DosTel1/DosTel2 sensors and indexed via NASA RadLab.",
            "definition_es": "Mediciones empíricas de tasa de dosis absorbida y flujo en órbita baja terrestre (~390-420 km) y paso por la Anomalía del Atlántico Sur mediante instrumentos DosTel1/DosTel2 en RadLab.",
            "limitation_en": "External station absorbed dose rate reflects environmental exposure profiles; biological radiation damage estimation requires cumulative tissue-weighted mission logs and biomarkers.",
            "limitation_es": "La tasa de dosis externa mide exposición ambiental; el riesgo biológico individual requiere dosis acumulada ponderada por tejido.",
            "sources": [
                {"title": "NASA RadLab Space Radiation Data Portal", "url": "https://radlab.nasa.gov/"},
                {"title": "NASA Space Radiation Cancer & CNS Risks", "url": "https://humanresearchroadmap.nasa.gov/"},
            ],
        },
        {
            "id": "astra.proteomic_stress",
            "label_en": "OSD-571 Inspiration4 longitudinal proteomics & immune drift",
            "label_es": "Proteómica longitudinal y deriva inmune OSD-571 (Inspiration4)",
            "aliases": ["osd-571", "proteomics", "inspiration4", "saa1", "crp", "il6", "tnf", "bdnf", "osdr"],
            "unit": "log2FC / z-score",
            "domain": "multi_omics",
            "definition_en": "Spaceflight induces acute inflammatory/acute-phase response proteins (SAA1, CRP, IL6, TNF) and extracellular-matrix/bone turnover shifts (MMP9, BGLAP), followed by structured recovery intervals (R+1 to R+82).",
            "definition_es": "El vuelo espacial induce elevaciones transitorias de marcadores inflamatorios (SAA1, CRP, IL6, TNF) y remodelado óseo/tisular observados longitudinalmente en la cohorte Inspiration4 (OSD-571).",
            "limitation_en": "Inspiration4 represents a 3-day LEO commercial flight (N=4) evaluated vs individual pre-flight baselines; extrapolation to multi-year Mars transit requires uncertainty bounds.",
            "limitation_es": "Inspiration4 corresponde a 3 días en LEO (N=4); la extrapolación a tránsito marciano prolongado requiere cautela y cohortes adicionales.",
            "sources": [
                {"title": "NASA OSDR OSD-571 Inspiration4 Proteomics", "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-571"},
                {"title": "Overbey et al. (2024) Nature — Inspiration4 cohort", "url": "https://www.nature.com/articles/s41586-024-07639-y"},
            ],
        },
        {
            "id": "astra.tremor_dexterity",
            "label_en": "1-Euro 3D WorldPose & 21-joint tremor / dexterity DSP",
            "label_es": "Cinemática 3D 1-Euro y temblor / destreza manual 21-articulaciones",
            "aliases": ["tremor", "1-euro", "one-euro", "dexterity", "pinch", "worldpose", "kinematics", "temblor"],
            "unit": "deg / Hz / mm",
            "domain": "neuromuscular_biomech",
            "definition_en": "Adaptive velocity-dependent low-pass filtering (Casiez et al., 2012 1-Euro filter) over 3D joint coordinates and 21-point hand landmarks extracts tremor band amplitude (3-12 Hz), range-of-motion deficit, and repetitive task stability.",
            "definition_es": "Filtrado adaptativo 1-Euro sobre poses 3D y 21 puntos de la mano para cuantificar amplitud de temblor (3-12 Hz), déficit de rango articular y asimetría funcional.",
            "limitation_en": "Monocular webcam depth has greater Z-axis variance than multi-camera Vicon/OpenCap stereoscopy; standardized camera distance and lighting checks are required before claiming progression.",
            "limitation_es": "La profundidad monocular tiene mayor varianza en el eje Z que sistemas multicámara; exige encuadre y calidad estandarizada.",
            "sources": [
                {"title": "OpenCap: Human movement dynamics from smartphone videos (PLOS Comp Biol 2023)", "url": "https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462"},
                {"title": "Casiez et al. (2012) 1€ Filter CHI", "url": "https://gery.casiez.net/1euro/"},
            ],
        },
        {
            "id": "astra.rppg_pos",
            "label_en": "Plane-Orthogonal-to-Skin (POS) contact-free rPPG",
            "label_es": "Fotopletismografía remota sin contacto POS (rPPG)",
            "aliases": ["rppg", "pos", "photoplethysmography", "wang 2017", "camera hr"],
            "unit": "beats/min",
            "domain": "autonomic_wearable",
            "definition_en": "Wang et al. (2017) linear chrominance projection over facial ROI skin pixels orthogonal to specular motion artifacts, recovering pulse rate in 0.7-3.5 Hz without physical contact.",
            "definition_es": "Proyección cromática POS de Wang et al. (2017) sobre píxeles faciales ortogonales al brillo especular para estimar pulso sin contacto.",
            "limitation_en": "Motion blur, low illuminance, or partial ROI occlusion degrades SNR; always compare against Apple Watch / pulse-ox reference and gate low-quality frames.",
            "limitation_es": "Sensible a movimiento y baja iluminación; requiere control de calidad de señal y confirmación con sensor de contacto.",
            "sources": [
                {"title": "Wang et al. (2017) Algorithmic Principles of Remote PPG (IEEE TBME)", "url": "https://ieeexplore.ieee.org/document/7565547"},
                {"title": "Apple HealthKit Heart Rate Documentation", "url": "https://developer.apple.com/documentation/healthkit"},
            ],
        },
        {
            "id": "astra.mahalanobis_multivariate",
            "label_en": "8-DOF Multivariate Mahalanobis covariance departure",
            "label_es": "Distancia multivariada de Mahalanobis (8 grados de libertad)",
            "aliases": ["mahalanobis", "chi-square", "chi2", "multivariate", "baseline departure", "covarianza"],
            "unit": "D^2 / p-val",
            "domain": "biostatistics",
            "definition_en": "Joint covariance distance D^2 = (x - mu)^T Sigma^-1 (x - mu) across 8 biomechanical/autonomic metrics vs personal pre-flight or mission reference, yielding chi-square survival p-values (p < 0.001 alert threshold).",
            "definition_es": "Distancia conjunta D^2 evaluando covarianza de 8 biomarcadores frente a referencia personal o de misión con significancia chi-cuadrado (p < 0.001).",
            "limitation_en": "A statistically significant departure from an Earth-1g baseline triggers mission-profile verification and human medical review—it is never an autonomous clinical diagnosis.",
            "limitation_es": "Una desviación respecto a la línea base terrestre activa evaluación contra perfil de misión y revisión humana, nunca un diagnóstico automático.",
            "sources": [
                {"title": "NASA Standard Measures Reference", "url": "https://www.nasa.gov/reference/standard-measures/"},
                {"title": "AstroKinetics Statistical Engine Spec", "url": "https://astrokinetics-space-health-765428358644.us-central1.run.app/docs"},
            ],
        },
        {
            "id": "astra.triage_red_flags",
            "label_en": "NASA HUNCH 8 Emergency Red-Flag Safety Gate",
            "label_es": "Puerta de seguridad de 8 banderas rojas NASA HUNCH",
            "aliases": ["red flag", "hunch", "mi triad", "thunderclap", "meningitis", "meningococcemia", "hemoptysis", "seizure", "emergency triage"],
            "unit": "TriageTier",
            "domain": "safety_triage",
            "definition_en": "Deterministic pre-emptive safety check evaluating 8 life-threatening clinical patterns (MI Triad, Thunderclap Headache, Meningitis, Meningococcemia, Acute Vision Loss, New Seizure, Syncope, Hemoptysis) prior to any ML classifier.",
            "definition_es": "Verificación determinista previa que evalúa 8 patrones clínicos de riesgo vital antes de cualquier modelo estadístico o ML para garantizar escalamiento seguro offline.",
            "limitation_en": "Screening triage accelerates emergency stabilization under communication blackout/delay; definitive medical directives require crew medical officer / flight surgeon oversight when reachable.",
            "limitation_es": "El triaje autónomo prioriza respuesta inmediata ante retardo de comunicaciones; no sustituye evaluación médica definitiva.",
            "sources": [
                {"title": "NASA HUNCH Medical Triage System Safety Spec", "url": "https://github.com/CarlosJaimes/ASTRA-Space-Health-Companion"},
                {"title": "NASA-STD-3001 Vol 1/2 Crew Health", "url": "https://www.nasa.gov/reference/nasa-std-3001/"},
            ],
        },
        {
            "id": "astra.abstention_quality_gate",
            "label_en": "Principled abstention & non-conflated episode state governance",
            "label_es": "Abstención por baja calidad y gobernanza no colapsada de episodios",
            "aliases": ["abstention", "bad capture", "dismiss", "sync", "human review", "quality hold", "calidad insuficiente"],
            "unit": "StateEnum",
            "domain": "system_governance",
            "definition_en": "Core safety invariant ensuring missing context or rejected captures return INCOMPLETE_CHECK_REQUIRED rather than normal values, notification dismissal preserves pending tasks, and network receipt never auto-marks human medical review.",
            "definition_es": "Invariante de seguridad que separa aviso descartado de tarea completada, recepción de red de revisión humana, y obliga a repetir capturas de calidad insuficiente sin inventar normalidad.",
            "limitation_en": "Requires strict enforcement at backend schema and state-transition boundaries across Watch, iPhone, and Web workstation surfaces.",
            "limitation_es": "Exige cumplimiento estricto en esquemas y máquinas de estado entre Watch, iPhone y consola web.",
            "sources": [
                {"title": "ASTRA Companion Contracts & Safety Architecture", "url": "https://github.com/CarlosJaimes/ASTRA-Space-Health-Companion"},
            ],
        },
        {
            "id": "astra.postflight_sensorimotor",
            "label_en": "Sensorimotor neuro-vestibular & vocal fatigue markers",
            "label_es": "Marcadores sensorimotores neuro-vestibulares y fatiga vocal",
            "aliases": ["vestibular", "ataxia", "vocal jitter", "shimmer", "hnr", "sensorimotor", "speech", "habla"],
            "unit": "Hz / dB / ratio",
            "domain": "neuro_acoustic",
            "definition_en": "Microgravity vestibular adaptation alters gaze stabilization (saccades), postural ataxia, and laryngeal neuromuscular coordination measurable through acoustic F0 perturbation, jitter, shimmer, and HNR.",
            "definition_es": "La adaptación vestibular altera estabilidad de la mirada, ataxia postural y control neuromuscular laríngeo medible por perturbación F0, jitter, shimmer y HNR.",
            "limitation_en": "Cabin fan noise and microphone distance alter vocal acoustics unless normalized against cabin SNR and paired with neuro-cognitive context.",
            "limitation_es": "El ruido ambiental de cabina y distancia del micrófono afectan la acústica vocal y deben normalizarse.",
            "sources": [
                {"title": "NASA Risk of Altered Sensorimotor/Vestibular Function", "url": "https://humanresearchroadmap.nasa.gov/"},
                {"title": "SpiroSmart / Mobile Acoustic Pulmonary & Vocal Biomarkers", "url": "https://ubicomplab.cs.washington.edu/"},
            ],
        },
    ]
    concepts.extend(extended_concepts)

    # 70 verified AURA sources from bases/astra_jaramillo/knowledge-base/sources.json
    sources_path = SRC_ROOT / "bases/astra_jaramillo/knowledge-base/sources.json"
    with sources_path.open(encoding="utf-8") as f:
        sources_raw = json.load(f)

    sources_list: list[dict[str, Any]] = []
    for s in sources_raw.get("sources", []):
        sources_list.append({
            "id": s.get("id"),
            "title": _clean_text(s.get("title")),
            "url": _clean_text(s.get("url")),
            "organization": _clean_text(s.get("organization")),
            "topic": _clean_text(s.get("topic")),
            "status": _clean_text(s.get("status")),
            "type": _clean_text(s.get("type")),
            "publishedOn": _clean_text(s.get("publishedOn")),
            "scope": _clean_text(s.get("scope")),
            "limitation": _clean_text(s.get("limitation")),
        })

    # 15 Apple digital health / mobile biomarker validation studies
    bib_path = SRC_ROOT / "resources/11_biblioteca_salud_apple/biblioteca.json"
    with bib_path.open(encoding="utf-8") as f:
        bib_raw = json.load(f)

    apple_studies: list[dict[str, Any]] = []
    for p in bib_raw.get("projects", []):
        ev = p.get("evaluation") or {}
        urls = p.get("urls") or []
        repos = p.get("repositories") or p.get("repos") or []
        apple_studies.append({
            "id": p.get("id"),
            "title": _clean_text(p.get("title")),
            "year": p.get("year"),
            "doi": _clean_text(p.get("doi")),
            "journal": _clean_text(p.get("journal")),
            "primary_url": urls[0] if urls else "",
            "repos": repos[:3] if isinstance(repos, list) else [],
            "device": _clean_text(ev.get("dispositivo")),
            "sensors": _clean_text(ev.get("sensores")),
            "objective_es": _clean_text(ev.get("objetivo")),
            "validation_es": _clean_text(ev.get("validacion")),
            "evidence_level_es": _clean_text(ev.get("nivel")),
            "limits_es": [ _clean_text(x) for x in (ev.get("limites") or []) ],
            "implementation_es": _clean_text(ev.get("implementacion")),
            "nasa_relevance_es": _clean_text(ev.get("nasa")),
            "reproduction_steps_es": [ _clean_text(x) for x in (ev.get("reproduccion") or []) ],
        })

    hunch_red_flags = [
        {"id": "mi_triad", "name": "MI Triad (Acute Coronary Syndrome)", "trigger": "Chest pain + Shortness of breath + Diaphoresis (sweating)", "tier": "EMERGENCY", "action": "Activate acute cardiac emergency checklist, continuous ECG/SpO2, aspirin/nitro protocol per Chief Medical Officer.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "thunderclap_headache", "name": "Thunderclap Headache", "trigger": "Sudden, severe 'worst headache of life' onset", "tier": "EMERGENCY", "action": "Rule out subarachnoid hemorrhage / acute intracranial event; stabilize head/BP, immediate evacuation/telemed review.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "meningitis_pattern", "name": "Meningitis Pattern", "trigger": "Altered mental status / confusion + Fever (+ neck stiffness)", "tier": "EMERGENCY", "action": "Isolate, empirical antimicrobial protocol review, airway protection & neuro-checks q15m.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "meningococcemia", "name": "Meningococcemia / Purpura", "trigger": "Non-blanching petechial/purpuric rash + Fever", "tier": "EMERGENCY", "action": "Immediate sepsis isolation & broad-spectrum IV/IM antibiotic contingency.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "acute_vision_loss", "name": "Acute Vision Loss / Severe SANS", "trigger": "Sudden monocular or binocular visual acuity loss", "tier": "EMERGENCY", "action": "Perform spaceflight ophthalmoscope / OCT exam, check ICP/SANS protocol & hypoxia.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "new_seizure", "name": "New-Onset Seizure", "trigger": "Witnessed seizure activity / post-ictal unresponsiveness", "tier": "EMERGENCY", "action": "Protect airway/restrain safely in microgravity, check CO2/O2 cabin levels, anticonvulsant standby.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "syncope", "name": "Syncope / Unexplained Loss of Consciousness", "trigger": "Transient loss of consciousness or severe orthostatic collapse", "tier": "EMERGENCY", "action": "Verify cabin atmosphere, 1-lead ECG rhythm check, orthostatic hydration & supine positioning.", "sla_ms": "< 100ms deterministic gate"},
        {"id": "hemoptysis", "name": "Hemoptysis", "trigger": "Coughing up frank blood", "tier": "EMERGENCY", "action": "Isolate respiratory exposure / cabin particulate check, pulse oximetry, immediate medical escalation.", "sla_ms": "< 100ms deterministic gate"},
    ]

    lidar_protocol = {
        "formula": "V = (1 / 6) * | sum_i (v0_i . (v1_i x v2_i)) |",
        "coverage_gate_pct": 82.0,
        "reference_bounds": ["Tibial Plateau (Proximal Plane)", "Lateral/Medial Malleolus (Distal Plane)"],
        "provenance_classes": [
            {"kind": "observed", "description": "Vertices covered directly by filtered ARKit sceneDepth + confidenceMap >= medium from multiple orbital angles."},
            {"kind": "occluded", "description": "Rear/medial arc triangles lacking valid direct LiDAR hits during single-pass capture."},
            {"kind": "inferred", "description": "Geometric cap closures or smoothed surfaces; must be flagged if inferred > 18% of surface area."},
        ],
        "arkit_warning": "Do NOT rely on Apple ARKit personSegmentationWithDepth alone for clinical volumetry: it hallucinates continuous depth over unseen limbs and inflates agreement artificially. Use raw sceneDepth + confidenceMap.",
    }

    surface_architecture = [
        {"surface": "Apple Watch / Wearable Node", "owns": "Passive HR/SDNN/sleep reminders, quick symptom check-in, tactile task alerts, local ring buffer when offline.", "does_not_own": "Heavy 3D rendering, episode closure, diagnostic conclusions, or confusing notification dismissal with clinical completion."},
        {"surface": "iPhone Capture & Field Companion", "owns": "Guided RGB comparison capture, raw ARKit sceneDepth LiDAR calf volumetry, HealthKit authorization boundary, queued store-and-forward JSON events.", "does_not_own": "SILENT imputation of missing sleep/watch data or unverified ML overrides of HUNCH red flags."},
        {"surface": "AstroKinetics Web Mission Workstation", "owns": "8-DOF Mahalanobis digital twin, Neuro-Acoustic therapy & vocal DSP, HUNCH dual-engine explainable triage, Longitudinal Episode review/closure, AURA cited research.", "does_not_own": "Auto-closing episodes on sync receipt or masking animal/cell studies as human clinical cutoffs."},
    ]

    return {
        "bundle_version": "4.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "concepts": concepts,
        "sources_meta": {
            "registry_version": sources_raw.get("registryVersion"),
            "review_date": sources_raw.get("reviewDate"),
            "criterion": sources_raw.get("criterion"),
            "total": len(sources_list),
        },
        "sources": sources_list,
        "apple_studies_meta": {
            "updated_at": bib_raw.get("updated_at"),
            "scope": bib_raw.get("scope"),
            "total": len(apple_studies),
        },
        "apple_studies": apple_studies,
        "hunch_meta": {
            "red_flag_count": len(hunch_red_flags),
            "vignettes_tested": 15,
            "safety_tests_passed": "12/12 (100%)",
            "rule_ml_agreement_pct": 87.0,
            "red_flag_sla_ms": "< 100ms",
        },
        "hunch_red_flags": hunch_red_flags,
        "lidar_protocol": lidar_protocol,
        "surface_architecture": surface_architecture,
    }


def build_aura_corpus() -> dict[str, Any]:
    nc_path = SRC_ROOT / "bases/aura_graph/data/processed/nasa_complete_dataset_20250916_100115.json"
    csv_path = SRC_ROOT / "bases/aura_graph/SB_publication_PMC.csv"

    with nc_path.open(encoding="utf-8") as f:
        nc_raw = json.load(f)

    rich_by_pmc: dict[str, dict[str, Any]] = {}
    for pub in nc_raw.get("publications", []):
        pmcid_num = str(pub.get("pmc_id") or "").strip().lstrip("PMCpmc")
        if pmcid_num:
            rich_by_pmc[pmcid_num] = pub

    papers: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            title = _clean_text(row.get("Title"))
            url = _clean_text(row.get("Link"))
            if not title:
                continue
            m = PMCID_RE.search(url)
            pmcid_num = m.group(1) if m else ""
            pmcid_key = f"PMC{pmcid_num}" if pmcid_num else title[:32]
            if pmcid_key in seen_ids:
                continue
            seen_ids.add(pmcid_key)

            rich = rich_by_pmc.get(pmcid_num, {})
            abstract = _clean_text(rich.get("abstract"))
            if len(abstract) > 650:
                abstract = abstract[:647].rstrip() + "..."
            entities = rich.get("space_biology_entities") or {}
            organisms = [str(x) for x in (entities.get("organisms") or [])]
            space_conditions = [str(x) for x in (entities.get("space_conditions") or [])]
            biological_systems = [str(x) for x in (entities.get("biological_systems") or [])]
            pub_info = rich.get("publication_info") or {}
            pop_domain = _infer_population_domain(title, abstract, organisms)

            papers.append({
                "pmc_id": pmcid_key,
                "title": title,
                "url": url,
                "doi": _clean_text(rich.get("doi")),
                "journal": _clean_text(pub_info.get("journal")),
                "pub_date": _clean_text(pub_info.get("publication_date")),
                "abstract": abstract,
                "organisms": organisms,
                "space_conditions": space_conditions,
                "biological_systems": biological_systems,
                "population_domain": pop_domain,
                "has_full_abstract": bool(abstract),
            })

    return {
        "corpus_version": "4.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_publications": len(papers),
        "rich_extracted_count": sum(1 for p in papers if p["has_full_abstract"]),
        "entity_summary": nc_raw.get("entity_summary", {}),
        "research_landscape": {
            "publication_timeline": nc_raw.get("research_landscape", {}).get("publication_timeline", {}),
            "journal_distribution": dict(
                sorted(
                    (nc_raw.get("research_landscape", {}).get("journal_distribution") or {}).items(),
                    key=lambda kv: kv[1],
                    reverse=True,
                )[:12]
            ),
        },
        "publications": papers,
    }


def build_empirical_supplements() -> dict[str, Any]:
    radlab_path = SRC_ROOT / "resources/08_muestras_de_datos/radlab_ejemplo_documentado.json"
    with radlab_path.open(encoding="utf-8") as f:
        radlab = json.load(f)

    # Compact records preserving every quantitative field
    compact_records = []
    dostel_stats: dict[str, list[float]] = {}
    for r in radlab.get("records", []):
        inst = str(r.get("instrument_id") or r.get("instrument") or "DosTel")
        dose = float(r.get("absorbed_dose_rate") or 0.0)
        dostel_stats.setdefault(inst, []).append(dose)
        compact_records.append({
            "t": r.get("timestamp"),
            "inst": inst,
            "dose": round(dose, 4),
            "alt": round(float(r.get("altitude") or 0.0), 2),
            "b": round(float(r.get("b") or 0.0), 4),
            "l": round(float(r.get("l") or 0.0), 3),
            "flux": round(float(r.get("flux") or 0.0), 4),
            "lat": round(float(r.get("latitude") or 0.0), 2),
            "lon": round(float(r.get("longitude") or 0.0), 2),
        })

    inst_summary = {}
    for k, vals in dostel_stats.items():
        if vals:
            inst_summary[k] = {
                "samples": len(vals),
                "mean_uGy_h": round(sum(vals) / len(vals), 3),
                "peak_uGy_h": round(max(vals), 3),
                "min_uGy_h": round(min(vals), 3),
            }

    barger_path = SRC_ROOT / "bases/astra_jaramillo/knowledge-base/files/publications/sleep-hrv/barger-2014-published-tables.json"
    with barger_path.open(encoding="utf-8") as f:
        barger = json.load(f)

    manifest_path = SRC_ROOT / "bases/astra_jaramillo/knowledge-base/files/datasets/nasa/download-manifest.json"
    with manifest_path.open(encoding="utf-8") as f:
        manifest = json.load(f)

    return {
        "radlab_iss_sample": {
            "source_id": radlab.get("source_id"),
            "source_url": radlab.get("source_url"),
            "captured_date": radlab.get("captured_date"),
            "scope": radlab.get("scope"),
            "units": radlab.get("units"),
            "row_count": len(compact_records),
            "instrument_summary": inst_summary,
            "records": compact_records,
        },
        "barger_2014_sleep": {
            "source_id": barger.get("source_id"),
            "source_url": barger.get("source_url"),
            "data_level": barger.get("data_level"),
            "derivation": barger.get("derivation"),
            "table_1_notes": barger.get("table_1_notes"),
            "tables": barger.get("tables", []),
        },
        "nasa_nlsp_manifest": {
            "verified_at": manifest.get("verified_at"),
            "scope": manifest.get("scope"),
            "datasets": [
                {
                    "filename": item.get("filename"),
                    "dataset_catalog": item.get("dataset_catalog"),
                    "title": item.get("title"),
                    "study": item.get("study"),
                    "method": item.get("method"),
                    "limitations": item.get("limitations"),
                    "catalog_url": item.get("catalog_url"),
                    "processing_level": item.get("processing_level"),
                }
                for item in manifest.get("files", [])
            ],
        },
    }


def main() -> None:
    if not SRC_ROOT.exists():
        raise SystemExit(f"Source directory not found: {SRC_ROOT}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bundle = build_knowledge_bundle()
    corpus = build_aura_corpus()
    supplements = build_empirical_supplements()

    files = [
        (OUT_DIR / "astra_knowledge_bundle.json", bundle),
        (OUT_DIR / "aura_nasa_corpus.json", corpus),
        (OUT_DIR / "astra_empirical_supplements.json", supplements),
    ]
    for path, payload in files:
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        size_kb = path.stat().st_size / 1024
        print(f"Wrote {path.name}: {size_kb:.1f} KB")

    print(
        f"Summary: concepts={len(bundle['concepts'])}, sources={len(bundle['sources'])}, "
        f"apple_studies={len(bundle['apple_studies'])}, pmc_papers={corpus['total_publications']}, "
        f"radlab_rows={supplements['radlab_iss_sample']['row_count']}"
    )


if __name__ == "__main__":
    main()
