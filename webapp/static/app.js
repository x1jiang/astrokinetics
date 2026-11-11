// ============================================================================
// AstroKinetics v3.2 — Aerospace & Clinical Crew Health Workstation Client
// 2026 NASA International Space Apps Challenge (Houston)
// - Interactive 3D Volumetric Musculoskeletal, Force-Plate & 21-Joint Hand Twin
// - 8-DOF Multivariate Mahalanobis Covariance Radar & Whitened Attribution
// - Closed-Loop Neuro-Acoustic Music Therapy, 3D Sonification & Boersma Vocal DSP
// - Connected Apple Watch (HealthKit/IMU) + Mobile Kinematics App Live API Hub
// - 1-Euro Filtered Metric 3D MediaPipe worldLandmarks + Wang POS Camera rPPG
// - Empirical NASA OSDR OSD-571 (GLDS-563 Inspiration4) Proteomics Explorer
// ============================================================================

import {
  OneEuroPoint3DFilter,
  compute3DWorldKinematics,
  computeCoco18Kinematics,
  RepetitionSegmenter,
  HandDexterityTracker,
  PosRppgProcessor,
  computeClientMahalanobis,
} from "./dsp.js?v=3.4.0";
import { NeuroAcousticEngine, NEURO_PROTOCOLS } from "./audio_engine.js?v=3.4.0";
import { Biomech3DStage } from "./biomech3d.js?v=3.4.0";

const FALLBACK_SCENARIOS = {
  nominal_lunar: {
    id: "nominal_lunar",
    mission_sol: 14,
    comm_mode: "iss_live",
    crew_member: "CDR Maya Lin (OSDR C001 Baseline)",
    telemetry: {
      heart_rate_bpm: 61,
      hrv_rmssd_ms: 61,
      spo2_pct: 98.4,
      systolic_bp_mmhg: 116,
      resp_rate_brpm: 13.5,
      sleep_hours: 7.6,
      pvt_reaction_ms: 248,
      mood_score_10: 8.4,
      private_journal_note: "Feeling sharp after morning ARED session; sleep mask blocked LED glare.",
      cabin_co2_mmhg: 1.6,
      radiation_msv_day: 0.42,
      joint_rom_deg: 117.5,
      target_rom_deg: 118,
      bilateral_symmetry_pct: 96.4,
      trunk_lean_deg: 3.1,
      postural_sway_mms: 6.2,
      cadence_rpm: 18,
      hand_tap_hz: 4.4,
      tremor_rms_mm: 0.45,
    },
  },
  hypercapnia_drift: {
    id: "hypercapnia_drift",
    mission_sol: 88,
    comm_mode: "mars_transit",
    crew_member: "MS-1 Dr. Alex Rivera (OSDR C002 Baseline)",
    telemetry: {
      heart_rate_bpm: 71,
      hrv_rmssd_ms: 48,
      spo2_pct: 96.7,
      systolic_bp_mmhg: 124,
      resp_rate_brpm: 17.4,
      sleep_hours: 6.1,
      pvt_reaction_ms: 322,
      mood_score_10: 6.2,
      private_journal_note: "Dull frontal headache on waking and mild balance drift during post-sleep check.",
      cabin_co2_mmhg: 2.85,
      radiation_msv_day: 0.52,
      joint_rom_deg: 162,
      target_rom_deg: 168,
      bilateral_symmetry_pct: 94.8,
      trunk_lean_deg: 4.4,
      postural_sway_mms: 12.6,
      cadence_rpm: 14.5,
      hand_tap_hz: 3.7,
      tremor_rms_mm: 0.72,
    },
  },
  musculoskeletal_asymmetry: {
    id: "musculoskeletal_asymmetry",
    mission_sol: 142,
    comm_mode: "mars_transit",
    crew_member: "FE-2 Jordan Vance (OSDR C003 Baseline)",
    telemetry: {
      heart_rate_bpm: 72,
      hrv_rmssd_ms: 47,
      spo2_pct: 97.9,
      systolic_bp_mmhg: 121,
      resp_rate_brpm: 15.2,
      sleep_hours: 6.7,
      pvt_reaction_ms: 274,
      mood_score_10: 6.8,
      private_journal_note: "Left hip feels stiff during ARED resistive squats; leaning right on final reps.",
      cabin_co2_mmhg: 1.9,
      radiation_msv_day: 0.58,
      joint_rom_deg: 94,
      target_rom_deg: 118,
      bilateral_symmetry_pct: 81.5,
      trunk_lean_deg: 14.6,
      postural_sway_mms: 16.4,
      cadence_rpm: 12,
      hand_tap_hz: 4.1,
      tremor_rms_mm: 0.65,
    },
  },
  spe_blackout: {
    id: "spe_blackout",
    mission_sol: 210,
    comm_mode: "solar_blackout",
    crew_member: "CDR Maya Lin (Storm Shelter Autonomous Mode)",
    telemetry: {
      heart_rate_bpm: 88,
      hrv_rmssd_ms: 29,
      spo2_pct: 95.8,
      systolic_bp_mmhg: 134,
      resp_rate_brpm: 19.6,
      sleep_hours: 4.6,
      pvt_reaction_ms: 382,
      mood_score_10: 4.2,
      private_journal_note: "Mild nausea and fine hand tremor after 36h in storm shelter; zero Earth link.",
      cabin_co2_mmhg: 2.9,
      radiation_msv_day: 3.45,
      joint_rom_deg: 98,
      target_rom_deg: 118,
      bilateral_symmetry_pct: 84.0,
      trunk_lean_deg: 11.8,
      postural_sway_mms: 22.5,
      cadence_rpm: 11,
      hand_tap_hz: 2.7,
      tremor_rms_mm: 2.45,
    },
  },
};

const COMM_SHORT_LABELS = {
  iss_live: "ISS Live",
  lunar_farside: "Lunar Far-Side",
  mars_transit: "Mars Transit",
  solar_blackout: "Solar Blackout",
};

const COMM_TOOLTIPS = {
  iss_live: "ISS / Lunar Near-Side · 0.8s Latency · Live OSDR Sync",
  lunar_farside: "Lunar Far-Side Outpost · Relay Delay · PWA Edge Active",
  mars_transit: "Mars Cruise · 18m 20s One-Way · Store-and-Forward Edge",
  solar_blackout: "SOLAR BLACKOUT · Zero Earth Link · 100% Onboard Autonomy",
};

const PROTOCOL_HUD_TITLES = {
  ared_squat: "ARED SQUAT",
  eva_upper_reach: "EVA REACH",
  fine_motor_hand: "HAND TREMOR",
  vestibular_sway: "ROMBERG SWAY",
};

const PRIVACY_NOTES = {
  astronaut_private:
    "Active View: <strong>Astronaut Private Tablet</strong> (Full personal metrics, mood &amp; journal unlocked locally).",
  cmo_operational:
    "Active View: <strong>Crew Medical Officer</strong> (Personal mood &amp; journal locked unless life-safety threshold triggers).",
  flight_surgeon_packet:
    "Active View: <strong>Flight Surgeon Store-and-Forward Packet</strong> (Privacy-filtered multivariate telemetry summary).",
};

const MEDIAPIPE_POSE_EDGES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

const HAND21_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const state = {
  scenarios: { ...FALLBACK_SCENARIOS },
  activeScenarioId: "musculoskeletal_asymmetry",
  crewMember: "FE-2 Jordan Vance (OSDR C003 Baseline)",
  missionSol: 142,
  protocol: "ared_squat",
  sourceMode: "reference_mocap",
  commMode: "mars_transit",
  privacyTier: "astronaut_private",
  telemetry: { ...FALLBACK_SCENARIOS.musculoskeletal_asymmetry.telemetry },
  latestEvaluation: null,
  motionPaused: false,

  // 3D Volumetric Musculoskeletal & Force-Plate Stage
  biomech3d: new Biomech3DStage(),

  // Empirical datasets
  osdrEmpirical: null,
  osdrSelectedCrew: "MEAN",
  osdrHoverIndex: 3, // Default highlight on R+1 Immediate Return
  referenceSample: null,
  referenceCursor: 0,
  referenceLastAdvanceMs: 0,
  referenceAutoRepCap: 3,

  // MediaPipe 3D Neural (478-pt FaceLandmarker + 21-jt HandLandmarker + 33-jt PoseLandmarker Full) + POS-rPPG DSP
  poseLandmarker: null,
  handLandmarker: null,
  faceLandmarker: null,
  mpLoading: false,
  mpError: null,
  webcamStream: null,
  localVideoUrl: null,
  localVideoName: "",
  lastVideoTime: -1,
  lastInferenceWallSec: null,
  prevWorldHip: null,
  cameraZonePref: "auto", // "auto" | "face" | "upper" | "full"
  detectedZone: "face",   // "face" | "face_hand" | "upper" | "full"
  zoneCandidate: "face",
  zoneCandidateFrames: 0,
  lastVisionCache: null,
  ocularStats: {
    blinkScore: 0.08,
    ear: 0.29,
    blinkClosed: false,
    blinkTimestamps: [],
    closedHistory: [],
    perclosPct: 4.0,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    facialSymPct: 98.2,
  },
  worldFilters: Array.from({ length: 33 }, () => new OneEuroPoint3DFilter(1.3, 0.045)),
  handTracker: new HandDexterityTracker(),
  posRppg: new PosRppgProcessor(10.0),
  latestRppgMetrics: { ready: false, bufferedSec: 0, wave: [] },
  lastRppgComputeMs: 0,

  // Repetition segmentation, smooth waveform traces & CSV buffer
  repSegmenter: new RepetitionSegmenter(55, 28),
  angleTracePrimary: [],
  angleTraceSecondary: [],
  lastTracePushMs: 0,
  csvLogBuffer: [],
  lastCsvSampleMs: 0,

  // Adaptive RAS WebAudio, Neuro-Acoustic Music Therapy, Voice DSP & Edge Mesh
  rasActive: false,
  neuroEngine: new NeuroAcousticEngine(),
  autoRxSyncEnabled: true,
  voiceRepCoachEnabled: false,
  voiceBriefingActive: false,
  speechRec: null,
  voiceCmdListening: false,
  lastAcousticDomUpdateMs: 0,
  captionDebounceTimer: null,
  liveKinFrame: { romDeg: 94, targetRomDeg: 118, symmetryPct: 81.5, trunkLeanDeg: 14.6 },

  // Connected Apple Watch + Mobile Kinematics API Workbench
  activeWorkspaceTab: "panelMissionConsole",
  activeApiPreset: "watch_vitals",
  activeSdkLang: "swift",
  edgeStreamTimer: null,
  edgeStreamTick: 0,
  ingestedPacketsCount: 0,

  pvtState: "idle",
  pvtTrials: [],
  pvtTimer: null,
  pvtGoTimestamp: 0,
};

const rppgScratchCanvas = document.createElement("canvas");
rppgScratchCanvas.width = 16;
rppgScratchCanvas.height = 16;
const rppgScratchCtx = rppgScratchCanvas.getContext("2d", { willReadFrequently: true });

// ----------------------------------------------------------------------------
// High-DPI Retina Canvas Backing-Store Helper
// ----------------------------------------------------------------------------
function formatPValue(p) {
  if (p < 0.0001) return "p < 0.0001";
  if (p > 0.9999) return "p > 0.9999";
  return `p = ${p.toFixed(4)}`;
}

function prepareHiDpiCanvas(canvas, logicalW, logicalH) {
  const dpr = Math.min(2.25, window.devicePixelRatio || 1);
  const targetW = Math.round(logicalW * dpr);
  const targetH = Math.round(logicalH * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function isDarkColorSchemeActive() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta?.content === "dark") return true;
  if (meta?.content === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ----------------------------------------------------------------------------
// 0. PWA Service Worker & Mission Sol Indicator
// ----------------------------------------------------------------------------
function registerOfflineServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  }
}

function updateMissionHeaderClock() {
  const el = document.getElementById("missionClockVal");
  if (el) {
    el.textContent = `Sol ${String(state.missionSol).padStart(3, "0")}`;
  }
}

// ----------------------------------------------------------------------------
// 1. Dialog Light-Dismiss Fallback (modern-web-guidance: light-dismiss-a-dialog)
// ----------------------------------------------------------------------------
function installDialogLightDismissFallback() {
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    });
  }
}

// ----------------------------------------------------------------------------
// 2. Color-Scheme Toggle (Header Quick Toggle + Settings Dialog Sync)
// ----------------------------------------------------------------------------
function initColorSchemeControls() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const radios = document.querySelectorAll('input[name="colorSchemePref"]');
  const systemLabel = document.getElementById("systemThemeLabel");
  const quickBtn = document.getElementById("quickThemeToggleBtn");
  const quickLbl = document.getElementById("quickThemeLabel");
  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  function syncQuickButtonLabel() {
    if (!quickLbl) return;
    const dark = isDarkColorSchemeActive();
    quickLbl.textContent = dark ? "Dark" : "Light";
  }

  function refreshThemeDependentCanvases() {
    syncQuickButtonLabel();
    renderCovarianceRadar();
    if (state.osdrEmpirical) renderOsdrCohortChart();
    renderAcousticSpectrumScope(performance.now());
  }

  function updateSystemLabel() {
    if (systemLabel) {
      systemLabel.textContent = `System (Currently ${mql.matches ? "Dark" : "Light"})`;
    }
    refreshThemeDependentCanvases();
  }

  function applyThemePreference(prefValue) {
    if (prefValue === "system") {
      try {
        localStorage.removeItem("color-scheme");
      } catch {}
      if (meta) meta.content = "light dark";
    } else {
      try {
        localStorage.setItem("color-scheme", prefValue);
      } catch {}
      if (meta) meta.content = prefValue;
    }
    radios.forEach((r) => {
      r.checked = r.value === prefValue;
    });
    refreshThemeDependentCanvases();
  }

  function syncRadiosFromStorage() {
    let stored = null;
    try {
      stored = localStorage.getItem("color-scheme");
    } catch {}
    const activeVal = stored === "light" || stored === "dark" ? stored : "system";
    radios.forEach((r) => {
      r.checked = r.value === activeVal;
    });
    if (meta) {
      meta.content = stored === "light" || stored === "dark" ? stored : "light dark";
    }
    refreshThemeDependentCanvases();
  }

  mql.addEventListener("change", updateSystemLabel);
  window.addEventListener("storage", (e) => {
    if (e.key === "color-scheme") syncRadiosFromStorage();
  });

  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) applyThemePreference(radio.value);
    });
  });

  if (quickBtn) {
    quickBtn.addEventListener("click", () => {
      const nextTheme = isDarkColorSchemeActive() ? "light" : "dark";
      applyThemePreference(nextTheme);
    });
  }

  updateSystemLabel();
  syncRadiosFromStorage();
}

// ----------------------------------------------------------------------------
// 3. Multivariate Triage Evaluation & 8-DOF Covariance Envelope Radar
// ----------------------------------------------------------------------------
function getVisionSourceIdentifier() {
  if (state.sourceMode === "reference_mocap") return "reference_mocap_recording";
  if (state.sourceMode === "live_webcam") return "live_mediapipe_3d_pos_rppg";
  if (state.sourceMode === "local_video") {
    return state.localVideoName ? `local_video_3d_ai:${state.localVideoName}` : "local_video_3d_ai";
  }
  return "parametric_digital_twin";
}

function buildPayload() {
  const vm = state.neuroEngine.latestVocalMetrics;
  return {
    crew_member: state.crewMember,
    mission_sol: state.missionSol,
    protocol: state.protocol,
    vision_source: getVisionSourceIdentifier(),
    comm_mode: state.commMode,
    privacy_tier: state.privacyTier,
    neuro_protocol: state.neuroEngine.protocolId,
    vocal_f0_hz: vm.f0Hz || 0,
    vocal_jitter_pct: vm.jitterPct || 0,
    vocal_hnr_db: vm.hnrDb || 0,
    ...state.telemetry,
  };
}

function localClientEvaluate(p) {
  const stats = computeClientMahalanobis(p);
  const romRatio = p.joint_rom_deg / Math.max(p.target_rom_deg, 1);
  const kinStatus =
    p.bilateral_symmetry_pct < 85 || p.trunk_lean_deg > 12 || romRatio < 0.83 || p.tremor_rms_mm >= 1.8
      ? "alert"
      : p.bilateral_symmetry_pct < 92 || p.trunk_lean_deg > 7 || romRatio < 0.91 || p.tremor_rms_mm >= 1.1
        ? "watch"
        : "nominal";
  const envStatus =
    p.cabin_co2_mmhg >= 3.5 || p.radiation_msv_day >= 1.5
      ? "alert"
      : p.cabin_co2_mmhg >= 2.4 || p.radiation_msv_day >= 0.8
        ? "watch"
        : "nominal";
  const cvStatus =
    p.heart_rate_bpm >= 85 || p.hrv_rmssd_ms <= 33
      ? "alert"
      : p.heart_rate_bpm >= 73 || p.hrv_rmssd_ms <= 45
        ? "watch"
        : "nominal";
  const cogStatus =
    p.pvt_reaction_ms >= 355 || p.sleep_hours < 5.2
      ? "alert"
      : p.pvt_reaction_ms >= 310 || p.sleep_hours < 6.4
        ? "watch"
        : "nominal";

  const statuses = [kinStatus, envStatus, cvStatus, cogStatus];
  const overall =
    statuses.includes("alert") || stats.p_value < 0.001
      ? "alert"
      : statuses.includes("watch") || stats.p_value < 0.05
        ? "watch"
        : "nominal";

  const topStr = stats.top_attributions
    .slice(0, 3)
    .map((a) => `${a.feature} (${a.share_pct}%)`)
    .join(", ");

  let recProtoId = "hrv_alpha";
  let recProtoTitle = "0.10 Hz Mayer-Wave HRV Baroreflex Resonance (10 Hz Alpha)";
  let recBeatHz = 10.0;
  let recTempoBpm = 60;
  if (p.radiation_msv_day >= 1.5 || p.sleep_hours < 5.3) {
    recProtoId = "delta_sleep";
    recProtoTitle = "2.5 Hz Delta Binaural + 1/f Pink-Noise Storm-Shelter Recovery";
    recBeatHz = 2.5;
    recTempoBpm = 48;
  } else if (p.cabin_co2_mmhg >= 2.8 || p.pvt_reaction_ms >= 315) {
    recProtoId = "gamma_focus";
    recProtoTitle = "40 Hz Gamma Cognitive Vigilance + Harmonic Alertness Pulse";
    recBeatHz = 40.0;
    recTempoBpm = 88;
  } else if (kinStatus !== "nominal") {
    recProtoId = "ras_motor";
    recProtoTitle = "Motor Cadence RAS Entrainment (16 Hz Beta + 3D Spatial Sonification)";
    recBeatHz = 16.0;
    recTempoBpm = Math.max(56, Math.min(96, Math.round((p.cadence_rpm + 2) * 4)));
  }

  return {
    overall_status: overall,
    readiness_score: stats.readiness_score,
    trajectory_state: `Offline edge triage · D_M = ${stats.mahalanobis_d.toFixed(2)}, ${formatPValue(stats.p_value)}`,
    multivariate_stats: stats,
    neuro_prescription: {
      recommended_protocol_id: recProtoId,
      recommended_title: recProtoTitle,
      binaural_beat_hz: recBeatHz,
      target_tempo_bpm: recTempoBpm,
    },
    domains: [
      {
        domain: "3D Musculoskeletal & Hand Dexterity",
        status: kinStatus,
        headline: `ROM ${p.joint_rom_deg.toFixed(1)}°/${p.target_rom_deg.toFixed(0)}° · Sym ${p.bilateral_symmetry_pct.toFixed(1)}% · Lean ${p.trunk_lean_deg.toFixed(1)}°`,
        metric_detail: `Sway ${p.postural_sway_mms.toFixed(1)} mm/s · Tap ${p.hand_tap_hz.toFixed(1)} Hz · Tremor ${p.tremor_rms_mm.toFixed(2)} mm`,
      },
      {
        domain: "Habitat & Radiation Exposure",
        status: envStatus,
        headline: `ppCO2 ${p.cabin_co2_mmhg.toFixed(2)} mmHg · Radiation ${p.radiation_msv_day.toFixed(2)} mSv/day`,
        metric_detail: "NASA-STD-3001 ppCO2 < 2.0 mmHg",
      },
      {
        domain: "Cardiovascular · rPPG",
        status: cvStatus,
        headline: `HR ${p.heart_rate_bpm.toFixed(0)} bpm · HRV ${p.hrv_rmssd_ms.toFixed(0)} ms · SpO2 ${p.spo2_pct.toFixed(1)}%`,
        metric_detail: `Resp ${p.resp_rate_brpm.toFixed(1)} brpm`,
      },
      {
        domain: "Cognitive & Behavioral Readiness",
        status: cogStatus,
        headline: `PVT ${p.pvt_reaction_ms.toFixed(0)} ms · Sleep ${p.sleep_hours.toFixed(1)} h`,
        metric_detail: "OSD-571 PVT nominal < 300 ms",
      },
    ],
    explainable_findings: [
      `Client-side 8-DOF Mahalanobis D_M = ${stats.mahalanobis_d.toFixed(2)} (Chi-Square ${formatPValue(stats.p_value)}); top contributors: ${topStr}.`,
    ],
    countermeasures: [
      p.radiation_msv_day >= 1.5
        ? {
            priority: "CRITICAL",
            title: "Storm-Shelter Mass Shielding & OSD-571 Oxidative/Hematologic Protocol",
            protocol:
              "Maintain crew in water-wall storm shelter; log nausea/tremor every 2h; run +24h point-of-care hemoglobin/WBC panel.",
            reference: "NASA OSDR OSD-571 + HRP Acute Radiation Risk",
          }
        : p.cabin_co2_mmhg >= 2.8 && p.pvt_reaction_ms >= 315
          ? {
              priority: p.cabin_co2_mmhg >= 3.5 ? "HIGH" : "MODERATE",
              title: "CDRA CO2 Scrubber Purge & High-Flow Bay Mixing",
              protocol:
                "Switch CDRA desiccant bed, engage inter-module duct fan high-flow mixing until ppCO2 < 2.0 mmHg, and repeat 3-trial PVT in 30 min.",
              reference: "NASA-STD-3001 Vol. 2 Atmosphere Standards",
            }
          : kinStatus !== "nominal"
            ? {
                priority: kinStatus === "alert" ? "HIGH" : "MODERATE",
                title: "Recalibrate Unilateral ARED Load & Closed-Loop RAS Cueing",
                protocol:
                  "Reduce unilateral ARED load by 15%, activate 1-Euro visual plumb feedback + Rhythmic Auditory Stimulation, and hold 60s proprioceptive stance.",
                reference: "NASA HRP Sensorimotor/Musculoskeletal Risk",
              }
            : {
                priority: "ROUTINE",
                title: "Maintain Nominal ARED & Microgravity Countermeasure Schedule",
                protocol:
                  "All channels within 95% individualized pre-flight covariance ellipsoid (p > 0.05). Continue scheduled ARED & aerobic blocks.",
                reference: "NASA-STD-3001 Nominal Operations",
              },
    ],
    downlink_packet: {
      packet_schema: "NASA-ExMC-AstroKinetics-v3.2-OfflineEdge",
      mission_sol: p.mission_sol,
      overall_status: overall.toUpperCase(),
      multivariate_statistics: stats,
      telemetry: p,
    },
  };
}

let evalDebounce = null;
function scheduleEvaluation() {
  syncKinematicStripFromTelemetry();
  renderCovarianceRadar();
  clearTimeout(evalDebounce);
  evalDebounce = setTimeout(runEvaluation, 80);
}

async function runEvaluation() {
  const payload = buildPayload();
  try {
    const resp = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    state.latestEvaluation = result;
    renderEvaluation(result);
  } catch {
    const fallback = localClientEvaluate(payload);
    state.latestEvaluation = fallback;
    renderEvaluation(fallback);
  }
}

function statusBadgeMarkup(status) {
  if (status === "nominal") {
    return `<span class="badge badge-nominal"><span aria-hidden="true">✓</span> Nominal</span>`;
  }
  if (status === "watch") {
    return `<span class="badge badge-watch"><span aria-hidden="true">▲</span> Watch</span>`;
  }
  return `<span class="badge badge-alert"><span aria-hidden="true">◆</span> Alert</span>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function formatCompactRxTag(rx) {
  if (!rx) return "Rx: 16 Hz Motor RAS";
  const id = rx.recommended_protocol_id;
  if (id === "ras_motor") return `Rx: ${rx.binaural_beat_hz} Hz Motor RAS`;
  if (id === "hrv_alpha") return `Rx: ${rx.binaural_beat_hz} Hz Alpha HRV`;
  if (id === "gamma_focus") return `Rx: ${rx.binaural_beat_hz} Hz Gamma Focus`;
  if (id === "delta_sleep") return `Rx: ${rx.binaural_beat_hz} Hz Shelter Delta`;
  return `Rx: ${rx.binaural_beat_hz} Hz · ${rx.target_tempo_bpm} BPM`;
}

function renderEvaluation(res) {
  const heroCard = document.getElementById("readinessHeroCard");
  if (heroCard) heroCard.dataset.severity = res.overall_status;

  updateMissionHeaderClock();

  const crewShort = state.crewMember.replace(" Baseline", "");
  document.getElementById("crewHeaderLabel").textContent =
    `${crewShort} · Sol ${String(state.missionSol).padStart(3, "0")}`;
  document.getElementById("trajectoryText").textContent = res.trajectory_state;

  const score = Math.max(0, Math.min(100, Number(res.readiness_score)));
  document.getElementById("readinessScoreVal").textContent = score.toFixed(1);

  // Update 270-deg SVG radial arc (arc length = 216.8 for r=46, 270 deg)
  const arcEl = document.getElementById("readinessArcFill");
  if (arcEl) {
    const arcLen = 216.8;
    arcEl.setAttribute("stroke-dashoffset", (arcLen * (1 - score / 100)).toFixed(2));
  }

  const overallBadge = document.getElementById("overallStatusBadge");
  if (res.overall_status === "nominal") {
    overallBadge.className = "badge badge-nominal";
    overallBadge.innerHTML = `<span aria-hidden="true">✓</span> Nominal Readiness`;
  } else if (res.overall_status === "watch") {
    overallBadge.className = "badge badge-watch";
    overallBadge.innerHTML = `<span aria-hidden="true">▲</span> Covariance Watch`;
  } else {
    overallBadge.className = "badge badge-alert";
    overallBadge.innerHTML = `<span aria-hidden="true">◆</span> Action Required`;
  }

  const mStats = res.multivariate_stats;
  if (mStats) {
    const pFormatted = escapeHtml(formatPValue(mStats.p_value));
    document.getElementById("mahalanobisMetaText").innerHTML =
      `D<sub>M</sub> = <strong>${mStats.mahalanobis_d.toFixed(2)}</strong> · &chi;&sup2;<sub>8</sub> = ${mStats.mahalanobis_d2.toFixed(1)} · <strong>${pFormatted}</strong>`;

    document.getElementById("attributionBars").innerHTML = (mStats.top_attributions || [])
      .map(
        (attr) => `
        <div class="attr-row">
          <div class="attr-row-head">
            <span>${escapeHtml(attr.feature)}</span>
            <strong class="mono">${attr.share_pct.toFixed(1)}%</strong>
          </div>
          <div class="attr-track" role="presentation">
            <div class="attr-fill" style="inline-size: ${Math.max(3, Math.min(100, attr.share_pct))}%"></div>
          </div>
        </div>
      `
      )
      .join("");
  }

  document.getElementById("domainCardsList").innerHTML = res.domains
    .map(
      (d) => `
      <div class="domain-item" data-status="${escapeHtml(d.status)}">
        <div class="domain-top">
          <span class="domain-title">${escapeHtml(d.domain)}</span>
          ${statusBadgeMarkup(d.status)}
        </div>
        <div class="domain-headline">${escapeHtml(d.headline)}</div>
        <div class="domain-sub">${escapeHtml(d.metric_detail)}</div>
      </div>
    `
    )
    .join("");

  document.getElementById("findingsList").innerHTML = res.explainable_findings
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join("");

  document.getElementById("countermeasuresList").innerHTML = res.countermeasures
    .map((c) => {
      const pClass =
        c.priority === "CRITICAL" || c.priority === "HIGH"
          ? "badge-alert"
          : c.priority === "MODERATE"
            ? "badge-watch"
            : "badge-nominal";
      const glyph = c.priority === "ROUTINE" ? "✓" : c.priority === "MODERATE" ? "▲" : "◆";
      return `
        <div class="cm-item">
          <div class="cm-top">
            <strong>${escapeHtml(c.title)}</strong>
            <span class="badge ${pClass}"><span aria-hidden="true">${glyph}</span> ${escapeHtml(c.priority)}</span>
          </div>
          <div>${escapeHtml(c.protocol)}</div>
          <div class="cm-ref">REF // ${escapeHtml(c.reference)}</div>
        </div>
      `;
    })
    .join("");

  // Populate Above-the-Fold Prescribed Countermeasure Directive Banner inside Readiness Hero Card
  const topCm = res.countermeasures?.[0];
  if (topCm) {
    const prioEl = document.getElementById("heroDirectivePriority");
    const titleEl = document.getElementById("heroDirectiveTitle");
    const actEl = document.getElementById("heroDirectiveAction");
    if (prioEl) {
      const pClass =
        topCm.priority === "CRITICAL" || topCm.priority === "HIGH"
          ? "badge badge-alert"
          : topCm.priority === "MODERATE"
            ? "badge badge-watch"
            : "badge badge-nominal";
      const glyph = topCm.priority === "ROUTINE" ? "✓" : topCm.priority === "MODERATE" ? "▲" : "◆";
      prioEl.className = pClass;
      prioEl.textContent = `${glyph} ${topCm.priority}`;
    }
    if (titleEl) titleEl.textContent = topCm.title;
    if (actEl) actEl.textContent = topCm.protocol;
  }

  document.getElementById("privacyFooterNote").innerHTML = PRIVACY_NOTES[state.privacyTier];

  const commTextEl = document.getElementById("commStatusText");
  if (commTextEl) {
    commTextEl.textContent = COMM_SHORT_LABELS[state.commMode] || "Mars Transit";
  }
  const commBanner = document.getElementById("commStatusBanner");
  if (commBanner) {
    commBanner.title = COMM_TOOLTIPS[state.commMode] || "";
    const commLed = commBanner.querySelector(".led");
    if (commLed) {
      commLed.className =
        state.commMode === "solar_blackout"
          ? "led led-alert"
          : state.commMode === "mars_transit" || state.commMode === "lunar_farside"
            ? "led led-watch"
            : "led led-ok";
    }
  }

  document.getElementById("pvtBadge").textContent = `${Math.round(state.telemetry.pvt_reaction_ms)} ms`;
  document.getElementById("packetPre").textContent = JSON.stringify(res.downlink_packet, null, 2);

  // Sync Neuro-Acoustic Prescription (both Tab 2 badge & Command Ribbon quick tag)
  if (res.neuro_prescription) {
    const rx = res.neuro_prescription;
    const rxEl = document.getElementById("neuroRxText");
    if (rxEl) {
      rxEl.textContent = `Auto-Rx: ${rx.recommended_title.split("(")[0].trim()} (${rx.binaural_beat_hz} Hz · ${rx.target_tempo_bpm} BPM)`;
    }
    const quickRxEl = document.getElementById("quickRxSummary");
    if (quickRxEl) {
      quickRxEl.textContent = formatCompactRxTag(rx);
    }
    if (
      state.autoRxSyncEnabled &&
      rx.recommended_protocol_id &&
      state.neuroEngine.protocolId !== rx.recommended_protocol_id
    ) {
      selectNeuroProtocol(rx.recommended_protocol_id, false);
    }
  }
  syncConnectedMeshReadouts(res);
  renderCovarianceRadar();
}

// ----------------------------------------------------------------------------
// High-DPI 8-Axis Multivariate Covariance Envelope Radar Plot
// ----------------------------------------------------------------------------
function renderCovarianceRadar() {
  const canvas = document.getElementById("covarianceRadarCanvas");
  if (!canvas) return;
  const W = 270;
  const H = 215;
  const ctx = prepareHiDpiCanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const dark = isDarkColorSchemeActive();
  const gridCol = dark ? "rgba(148, 163, 184, 0.2)" : "rgba(100, 116, 139, 0.22)";
  const labelCol = dark ? "#cbd5e1" : "#334155";
  const nomStroke = dark ? "#34d399" : "#12804f";
  const nomFill = dark ? "rgba(52, 211, 153, 0.09)" : "rgba(18, 128, 79, 0.08)";

  const t = state.telemetry;
  const romPct = Math.min(100, (t.joint_rom_deg / Math.max(t.target_rom_deg, 1)) * 100);

  // Normalized adverse z-deviations (0 = baseline ideal, 2.0 = 95% nominal boundary, 4.4 = outer ring)
  const axes = [
    { label: "ROM", z: Math.max(0, (99.0 - romPct) / 4.2) },
    { label: "SYM", z: Math.max(0, (96.5 - t.bilateral_symmetry_pct) / 2.6) },
    { label: "TILT", z: Math.max(0, (t.trunk_lean_deg - 3.0) / 2.1) },
    { label: "SWAY", z: Math.max(0, (t.postural_sway_mms - 6.0) / 2.8) },
    { label: "HR", z: Math.max(0, Math.abs(t.heart_rate_bpm - 60.0) / 5.8) },
    { label: "HRV", z: Math.max(0, (60.0 - t.hrv_rmssd_ms) / 7.8) },
    { label: "PVT", z: Math.max(0, (t.pvt_reaction_ms - 250.0) / 26.0) },
    { label: "CO2", z: Math.max(0, (t.cabin_co2_mmhg - 1.6) / 0.38) },
  ];

  const cx = W / 2;
  const cy = H / 2 + 2;
  const maxR = 76;
  const maxZ = 4.4;
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;

  [1.0, 2.0, 3.5, maxZ].forEach((zRing) => {
    const r = (zRing / maxZ) * maxR;
    ctx.beginPath();
    for (let i = 0; i < axes.length; i++) {
      const a = angleFor(i);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (zRing === 2.0) {
      ctx.fillStyle = nomFill;
      ctx.fill();
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = nomStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  axes.forEach((ax, i) => {
    const a = angleFor(i);
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    ctx.stroke();

    const lx = cx + Math.cos(a) * (maxR + 17);
    const ly = cy + Math.sin(a) * (maxR + 14);
    ctx.fillStyle = ax.z > 2.0 ? (dark ? "#fda4af" : "#b91c1c") : labelCol;
    ctx.fillText(ax.label, lx, ly);
  });

  const maxActiveZ = Math.max(...axes.map((a) => a.z));
  const polyStroke =
    maxActiveZ > 2.3 ? (dark ? "#fb7185" : "#c81e1e") : maxActiveZ > 1.5 ? "#f59e0b" : (dark ? "#58a6ff" : "#0b57d0");
  const polyFill =
    maxActiveZ > 2.3
      ? "rgba(244, 63, 94, 0.22)"
      : maxActiveZ > 1.5
        ? "rgba(245, 158, 11, 0.2)"
        : "rgba(56, 189, 248, 0.2)";

  ctx.beginPath();
  axes.forEach((ax, i) => {
    const clampedZ = Math.min(maxZ, Math.max(0.55, ax.z + 0.45));
    const r = (clampedZ / maxZ) * maxR;
    const a = angleFor(i);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = polyFill;
  ctx.fill();
  ctx.strokeStyle = polyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  axes.forEach((ax, i) => {
    const clampedZ = Math.min(maxZ, Math.max(0.55, ax.z + 0.45));
    const r = (clampedZ / maxZ) * maxR;
    const a = angleFor(i);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.fillStyle = ax.z > 2.0 ? (dark ? "#fb7185" : "#c81e1e") : polyStroke;
    ctx.beginPath();
    ctx.arc(px, py, ax.z > 2.0 ? 3.6 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ----------------------------------------------------------------------------
// 4. Sync Sliders, Radios & Live Telemetry Strip
// ----------------------------------------------------------------------------
const SLIDER_VALUE_TEXT = {
  inRom: (v) => `${Math.round(v)} degrees`,
  inSym: (v) => `${Number(v).toFixed(1)} percent`,
  inTrunk: (v) => `${Number(v).toFixed(1)} degrees`,
  inTremor: (v) => `${Number(v).toFixed(2)} millimeters`,
  inCo2: (v) => `${Number(v).toFixed(1)} millimeters mercury`,
  inRad: (v) => `${Number(v).toFixed(2)} millisieverts per day`,
  inHr: (v) => `${Math.round(v)} beats per minute`,
  inAudioGain: (v) => `${Math.round(v)} percent`,
  inBinauralHz: (v) => `${Number(v).toFixed(1)} Hertz`,
  inKinCoupling: (v) => `${Math.round(v)} percent`,
  inNeuroTempo: (v) => `${Math.round(v)} beats per minute`,
};

function syncSliderCssProps(input) {
  if (!input) return;
  input.style.setProperty("--attr-min", input.min || 0);
  input.style.setProperty("--attr-max", input.max || 100);
  input.style.setProperty("--control-value", input.value);
  const fmt = SLIDER_VALUE_TEXT[input.id];
  if (fmt) {
    input.setAttribute("aria-valuetext", fmt(Number(input.value)));
  }
}

function syncSlidersFromTelemetry() {
  const t = state.telemetry;
  const setSlider = (inId, outId, val, decimals = 0) => {
    const input = document.getElementById(inId);
    const output = document.getElementById(outId);
    if (input) {
      input.value = val;
      syncSliderCssProps(input);
    }
    if (output) output.textContent = Number(val).toFixed(decimals);
  };
  setSlider("inRom", "outRom", Math.round(t.joint_rom_deg), 0);
  setSlider("inSym", "outSym", t.bilateral_symmetry_pct, 1);
  setSlider("inTrunk", "outTrunk", t.trunk_lean_deg, 1);
  setSlider("inTremor", "outTremor", t.tremor_rms_mm, 2);
  setSlider("inCo2", "outCo2", t.cabin_co2_mmhg, 1);
  setSlider("inRad", "outRad", t.radiation_msv_day, 2);
  setSlider("inHr", "outHr", Math.round(t.heart_rate_bpm), 0);
  const outHrv = document.getElementById("outHrv");
  if (outHrv) outHrv.textContent = Math.round(t.hrv_rmssd_ms);

  // Sync inline What-If Digital Twin quick perturbation bar
  const qRom = document.getElementById("quickTwinRom");
  const qRomOut = document.getElementById("quickTwinRomOut");
  if (qRom) qRom.value = Math.round(t.joint_rom_deg);
  if (qRomOut) qRomOut.textContent = `${Math.round(t.joint_rom_deg)}°`;

  const qSym = document.getElementById("quickTwinSym");
  const qSymOut = document.getElementById("quickTwinSymOut");
  if (qSym) qSym.value = t.bilateral_symmetry_pct;
  if (qSymOut) qSymOut.textContent = `${Number(t.bilateral_symmetry_pct).toFixed(1)}%`;

  const qLean = document.getElementById("quickTwinLean");
  const qLeanOut = document.getElementById("quickTwinLeanOut");
  if (qLean) qLean.value = t.trunk_lean_deg;
  if (qLeanOut) qLeanOut.textContent = `${Number(t.trunk_lean_deg).toFixed(1)}°`;
}

function syncKinematicStripFromTelemetry() {
  const t = state.telemetry;
  document.getElementById("liveRomVal").innerHTML =
    `${t.joint_rom_deg.toFixed(1)}° <small>/ ${t.target_rom_deg.toFixed(0)}°</small>`;
  document.getElementById("liveSymVal").textContent = `${t.bilateral_symmetry_pct.toFixed(1)}%`;
  document.getElementById("liveTrunkVal").innerHTML =
    `${t.trunk_lean_deg.toFixed(1)}° · ${t.postural_sway_mms.toFixed(1)} <small>mm/s</small>`;
  document.getElementById("liveHandVal").innerHTML =
    `${t.hand_tap_hz.toFixed(1)} <small>Hz</small> · ${t.tremor_rms_mm.toFixed(2)} <small>mm</small>`;

  const rppgLabel = document.getElementById("liveRppgLabel");
  const rppgVal = document.getElementById("liveRppgVal");
  const isVideoAi = state.sourceMode === "live_webcam" || state.sourceMode === "local_video";

  if (isVideoAi) {
    if (state.latestRppgMetrics.ready) {
      const m = state.latestRppgMetrics;
      const snrSign = m.snrDb >= 0 ? "+" : "";
      rppgLabel.textContent = "POS rPPG (Live)";
      rppgVal.innerHTML = `${m.bpm} <small>bpm · ${m.hrvRmssdMs}ms · ${snrSign}${m.snrDb}dB</small>`;
    } else {
      rppgLabel.textContent = "POS rPPG Window";
      rppgVal.innerHTML = `${state.latestRppgMetrics.bufferedSec.toFixed(1)}s <small>/ 4.5s</small>`;
    }
  } else {
    rppgLabel.textContent = "Cardio Vitals";
    rppgVal.innerHTML = `${Math.round(t.heart_rate_bpm)} <small>bpm · ${Math.round(t.hrv_rmssd_ms)}ms</small>`;
  }
}

function applyScenario(scenarioId, userClickedCard = false) {
  const sc = state.scenarios[scenarioId];
  if (!sc) return;
  state.activeScenarioId = scenarioId;
  state.crewMember = sc.crew_member;
  state.missionSol = sc.mission_sol;
  state.commMode = sc.comm_mode;
  state.telemetry = { ...sc.telemetry };

  const commSelect = document.getElementById("commModeSelect");
  if (commSelect) commSelect.value = state.commMode;

  if (scenarioId === "hypercapnia_drift") {
    state.protocol = "vestibular_sway";
  } else if (scenarioId === "spe_blackout") {
    state.protocol = "fine_motor_hand";
  } else {
    state.protocol = "ared_squat";
  }
  document.querySelectorAll('input[name="protocolRadio"]').forEach((r) => {
    r.checked = r.value === state.protocol;
  });

  // When the user clicks a Mission Scenario card, exit Live Camera/Video so webcam inference
  // does not overwrite the scenario telemetry, and switch to What-If Twin + 1g Baseline Ghost
  // with a scenario-tailored 3D camera view so each scenario looks unmistakably distinct.
  if (userClickedCard) {
    if (state.sourceMode === "live_webcam" || state.sourceMode === "local_video") {
      stopActiveVideoStreams();
    }
    state.sourceMode = "parametric_twin";
    syncSourceRadios("parametric_twin");
    syncContextualModeBars();
    const scenNames = {
      nominal_lunar: "Sol 014 Nominal Twin vs. 1g Ghost",
      hypercapnia_drift: "Sol 088 Cabin CO2 Sway Twin",
      musculoskeletal_asymmetry: "Sol 142 Squat Lean vs. 1g Ghost",
      spe_blackout: "Sol 210 SPE Storm & Tremor Twin",
    };
    updateVisionBadge(scenNames[scenarioId] || "What-If 3D Digital Twin");
  }

  state.biomech3d.setScenarioCamera(scenarioId);
  sync3DCameraToolbarUi();
  state.biomech3d.resetTrails();
  configureRepSegmenterForMode();

  state.liveKinFrame = {
    romDeg: state.telemetry.joint_rom_deg,
    targetRomDeg: state.telemetry.target_rom_deg,
    symmetryPct: state.telemetry.bilateral_symmetry_pct,
    trunkLeanDeg: state.telemetry.trunk_lean_deg,
  };
  syncSlidersFromTelemetry();
  applyApiPreset(state.activeApiPreset);
  scheduleEvaluation();
}

// ----------------------------------------------------------------------------
// 5. Segmented Repetition Table & CSV Export
// ----------------------------------------------------------------------------
function configureRepSegmenterForMode() {
  state.repSegmenter.reset();
  state.angleTracePrimary = [];
  state.angleTraceSecondary = [];
  if (state.protocol === "eva_upper_reach") {
    state.repSegmenter.setThresholds(78, 36);
  } else if (state.protocol === "ared_squat") {
    state.repSegmenter.setThresholds(58, 28);
  } else {
    state.repSegmenter.setThresholds(48, 34);
  }
  renderRepTable();
}

function getShortSourceLabel() {
  if (state.sourceMode === "reference_mocap") return "Reference 3D Motion";
  if (state.sourceMode === "live_webcam") return "Live 3D Camera";
  if (state.sourceMode === "local_video") return "Local Video 3D AI";
  return "3D Digital Twin";
}

function renderRepTable() {
  const tbody = document.getElementById("repTableBody");
  if (!tbody) return;
  const reps = state.repSegmenter.reps;
  if (reps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <th scope="row">Awaiting</th>
        <td>${escapeHtml(getShortSourceLabel())}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = [...reps]
    .reverse()
    .slice(0, 8)
    .map(
      (r) => `
      <tr>
        <th scope="row">#${String(r.rep).padStart(2, "0")}</th>
        <td>${escapeHtml(r.source || getShortSourceLabel())}</td>
        <td class="mono"><strong>${r.peakRomDeg.toFixed(1)}°</strong></td>
        <td class="mono">${r.leftPeakDeg.toFixed(1)}° / ${r.rightPeakDeg.toFixed(1)}°</td>
        <td class="mono">${r.symmetryPct.toFixed(1)}%</td>
        <td class="mono">${r.maxTrunkLeanDeg.toFixed(1)}°</td>
        <td class="mono">${r.durationSec.toFixed(2)}s</td>
      </tr>
    `
    )
    .join("");
}

function recordCsvSample(sample) {
  const now = performance.now();
  if (now - state.lastCsvSampleMs < 100) return;
  state.lastCsvSampleMs = now;
  state.csvLogBuffer.push({
    timestamp_utc: new Date().toISOString(),
    mission_sol: state.missionSol,
    source_mode: getVisionSourceIdentifier(),
    protocol: state.protocol,
    primary_rom_deg: Number(sample.primaryRom.toFixed(2)),
    left_deg: Number(sample.leftDeg.toFixed(2)),
    right_deg: Number(sample.rightDeg.toFixed(2)),
    symmetry_pct: Number(sample.symmetryPct.toFixed(2)),
    trunk_lean_deg: Number(sample.trunkLeanDeg.toFixed(2)),
    sway_mms: Number(sample.swayMms.toFixed(2)),
    hand_tap_hz: Number(state.telemetry.hand_tap_hz.toFixed(2)),
    tremor_rms_mm: Number(state.telemetry.tremor_rms_mm.toFixed(2)),
    hr_bpm: Number(state.telemetry.heart_rate_bpm.toFixed(1)),
    hrv_rmssd_ms: Number(state.telemetry.hrv_rmssd_ms.toFixed(1)),
  });
  if (state.csvLogBuffer.length > 1200) state.csvLogBuffer.shift();
}

function exportKinematicsCsv() {
  if (state.csvLogBuffer.length === 0) return;
  const cols = Object.keys(state.csvLogBuffer[0]);
  const lines = [
    cols.join(","),
    ...state.csvLogBuffer.map((row) => cols.map((c) => JSON.stringify(row[c] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `astrokinetics_sol${state.missionSol}_${state.sourceMode}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ----------------------------------------------------------------------------
// 6. Adaptive Multi-Zone MediaPipe 3D Vision (478-pt FaceMesh + 21-pt Hand + 33-pt Pose)
// ----------------------------------------------------------------------------
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
];
const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144, 33];
const LEFT_EYE_IDX = [362, 385, 387, 263, 373, 380, 362];
const RIGHT_BROW_IDX = [46, 53, 52, 65, 55];
const LEFT_BROW_IDX = [276, 283, 282, 295, 285];
const LIPS_OUTER_IDX = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const NOSE_BRIDGE_IDX = [168, 6, 197, 195, 5, 4];

const UPPER_BODY_POSE_EDGES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];
const TORSO_POSE_EDGES = [
  [11, 23],
  [12, 24],
  [23, 24],
];
const LOWER_BODY_POSE_EDGES = [
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const ZONE_DISPLAY_LABELS = {
  scanning: "Auto: Scanning Frame...",
  face_rppg: "Face & Ocular rPPG (478-pt)",
  face_hands: "Face rPPG + 21-Joint Hands",
  hands_only: "21-Joint Hand Tremor",
  upper_body: "Upper-Body 3D + Hands",
  full_body: "Full-Body 3D Kinematics",
};

function updateVisionBadge(text) {
  const badge = document.getElementById("visionSourceBadge");
  if (badge) {
    badge.innerHTML = `<span class="provenance-dot" aria-hidden="true"></span><span>${escapeHtml(text)}</span>`;
  }
}

function updateDetectedZoneBadge(zoneKey) {
  const el = document.getElementById("detectedZoneBadge");
  if (!el) return;
  const prefix = state.cameraZonePref === "auto" ? "Auto-Detected: " : "Locked Zone: ";
  const label = ZONE_DISPLAY_LABELS[zoneKey] || "Auto: Scanning Frame...";
  el.textContent = zoneKey === "scanning" ? label : `${prefix}${label}`;
}

function syncContextualModeBars() {
  const isCamOrVid = state.sourceMode === "live_webcam" || state.sourceMode === "local_video";
  const isTwin = state.sourceMode === "parametric_twin";

  const camZoneBar = document.getElementById("cameraZoneBar");
  if (camZoneBar) camZoneBar.hidden = !isCamOrVid;

  const twinBar = document.getElementById("twinPerturbBar");
  if (twinBar) twinBar.hidden = !isTwin;

  const cam3dBar = document.getElementById("cam3dPillBar");
  if (cam3dBar) cam3dBar.hidden = isCamOrVid;

  const ghostBtn = document.getElementById("toggleGhostBtn");
  if (ghostBtn) {
    ghostBtn.hidden = !isTwin;
    ghostBtn.setAttribute("aria-pressed", String(Boolean(state.biomech3d.showBaselineGhost)));
  }
}

async function ensureMediaPipeModelsLoaded() {
  if (state.poseLandmarker && state.handLandmarker && state.faceLandmarker) return true;
  if (state.mpLoading) return false;
  state.mpLoading = true;
  updateVisionBadge("Loading 3D FaceMesh + Pose + Hand WASM...");

  try {
    const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm");
    const { FilesetResolver, PoseLandmarker, HandLandmarker, FaceLandmarker } = visionModule;
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
    );

    const createWithDelegate = async (delegate) => {
      const [face, pose, hand] = await Promise.all([
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate,
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.52,
          minFacePresenceConfidence: 0.52,
          minTrackingConfidence: 0.52,
        }),
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate,
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.58,
          minPosePresenceConfidence: 0.58,
          minTrackingConfidence: 0.58,
        }),
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate,
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.52,
          minHandPresenceConfidence: 0.52,
          minTrackingConfidence: 0.52,
        }),
      ]);
      return { face, pose, hand };
    };

    try {
      const models = await createWithDelegate("GPU");
      state.faceLandmarker = models.face;
      state.poseLandmarker = models.pose;
      state.handLandmarker = models.hand;
    } catch {
      const models = await createWithDelegate("CPU");
      state.faceLandmarker = models.face;
      state.poseLandmarker = models.pose;
      state.handLandmarker = models.hand;
    }
    state.mpLoading = false;
    return true;
  } catch (err) {
    state.mpLoading = false;
    state.mpError = err?.message || "WASM load blocked";
    return false;
  }
}

function stopActiveVideoStreams() {
  const video = document.getElementById("webcamVideo");
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((t) => t.stop());
    state.webcamStream = null;
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    video.hidden = true;
  }
  state.lastVideoTime = -1;
  state.prevWorldHip = null;
  state.lastVisionCache = null;
  state.detectedZone = "scanning";
  state.zoneCandidate = "scanning";
  state.zoneCandidateFrames = 0;
  state.posRppg.reset();
  state.latestRppgMetrics = { ready: false, bufferedSec: 0, wave: [] };
}

function syncSourceRadios(mode) {
  document.querySelectorAll('input[name="sourceModeRadio"]').forEach((r) => {
    r.checked = r.value === mode;
  });
}

async function setSourceMode(newMode) {
  stopActiveVideoStreams();
  state.sourceMode = newMode;
  syncSourceRadios(newMode);
  syncContextualModeBars();
  sync3DCameraToolbarUi();
  state.biomech3d.resetTrails();
  configureRepSegmenterForMode();

  if (newMode === "reference_mocap") {
    updateVisionBadge("Recorded 62f Mocap Clip (30 FPS)");
    scheduleEvaluation();
    return;
  }

  if (newMode === "parametric_twin") {
    updateVisionBadge("What-If 3D Twin vs. 1g Baseline Ghost");
    scheduleEvaluation();
    return;
  }

  if (newMode === "live_webcam") {
    updateDetectedZoneBadge("scanning");
    const ok = await ensureMediaPipeModelsLoaded();
    if (!ok) {
      await setSourceMode("reference_mocap");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 600 }, facingMode: "user" },
        audio: false,
      });
      const video = document.getElementById("webcamVideo");
      state.webcamStream = stream;
      video.srcObject = stream;
      video.loop = false;
      await video.play();
      updateVisionBadge("Live Auto-Zone: FaceMesh + Pose + Hand");
      scheduleEvaluation();
    } catch {
      state.sourceMode = "reference_mocap";
      syncSourceRadios("reference_mocap");
      syncContextualModeBars();
      updateVisionBadge("Camera Blocked · Recorded 62f Mocap");
      configureRepSegmenterForMode();
      scheduleEvaluation();
    }
    return;
  }

  if (newMode === "local_video") {
    updateDetectedZoneBadge("scanning");
    const ok = await ensureMediaPipeModelsLoaded();
    if (!ok) {
      await setSourceMode("reference_mocap");
      return;
    }
    if (state.localVideoUrl) {
      const video = document.getElementById("webcamVideo");
      video.src = state.localVideoUrl;
      video.loop = true;
      video.muted = true;
      await video.play().catch(() => {});
      updateVisionBadge(`Video AI: ${state.localVideoName.slice(0, 22)}`);
    } else {
      updateVisionBadge("Choose local .mp4 / .webm clip");
    }
    scheduleEvaluation();
  }
}

async function handleLocalVideoSelected(file) {
  if (!file) return;
  if (state.localVideoUrl) URL.revokeObjectURL(state.localVideoUrl);
  state.localVideoUrl = URL.createObjectURL(file);
  state.localVideoName = file.name;
  const btnLbl = document.getElementById("videoFileBtnLabel");
  if (btnLbl) {
    btnLbl.textContent = file.name.length > 14 ? `${file.name.slice(0, 12)}…` : file.name;
  }
  await setSourceMode("local_video");
}

// ----------------------------------------------------------------------------
// 7. Aspect-Ratio Cover Projection, Multi-Zone Framing & 3-Zone FaceMesh rPPG
// ----------------------------------------------------------------------------
function computeVideoCoverTransform(video, W, H, isMirrored) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 400;
  const videoAspect = vw / vh;
  const canvasAspect = W / H;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (videoAspect > canvasAspect) {
    sw = vh * canvasAspect;
    sx = (vw - sw) * 0.5;
  } else {
    sh = vw / canvasAspect;
    sy = (vh - sh) * 0.5;
  }
  return { vw, vh, sx, sy, sw, sh, W, H, isMirrored };
}

function mapNormPtToCanvas(pt, xf) {
  const vx = pt.x * xf.vw;
  const vy = pt.y * xf.vh;
  let nx = (vx - xf.sx) / xf.sw;
  const ny = (vy - xf.sy) / xf.sh;
  if (xf.isMirrored) nx = 1 - nx;
  return { x: nx * xf.W, y: ny * xf.H };
}

function isLmValid(lm, idx, minVis = 0.62) {
  if (!lm || !lm[idx]) return false;
  const p = lm[idx];
  const v = p.visibility ?? 1;
  return v >= minVis && p.x >= 0.015 && p.x <= 0.985 && p.y >= 0.015 && p.y <= 0.975;
}

function analyzePoseAnatomy(poseLm2d) {
  if (!poseLm2d || poseLm2d.length < 29) {
    return { hasShoulders: false, hasUpperArms: false, hasHips: false, hasKnees: false };
  }
  const shL = isLmValid(poseLm2d, 11, 0.64);
  const shR = isLmValid(poseLm2d, 12, 0.64);
  if (!shL || !shR) {
    return { hasShoulders: false, hasUpperArms: false, hasHips: false, hasKnees: false };
  }

  const p11 = poseLm2d[11], p12 = poseLm2d[12];
  const shoulderSpan = Math.hypot(p11.x - p12.x, p11.y - p12.y);
  const midShoulderY = (p11.y + p12.y) * 0.5;
  const noseY = poseLm2d[0] ? poseLm2d[0].y : midShoulderY - 0.15;

  // Reject hallucinated shoulders collapsed onto the face or below bottom margin
  const hasShoulders = shoulderSpan >= 0.12 && midShoulderY > noseY + 0.05 && midShoulderY < 0.90;
  if (!hasShoulders) {
    return { hasShoulders: false, hasUpperArms: false, hasHips: false, hasKnees: false };
  }

  const elbL = isLmValid(poseLm2d, 13, 0.58) && Math.hypot(poseLm2d[13].x - p11.x, poseLm2d[13].y - p11.y) > 0.065;
  const elbR = isLmValid(poseLm2d, 14, 0.58) && Math.hypot(poseLm2d[14].x - p12.x, poseLm2d[14].y - p12.y) > 0.065;
  const hasUpperArms = (elbL || elbR) && midShoulderY < 0.80;

  const hipL = isLmValid(poseLm2d, 23, 0.65);
  const hipR = isLmValid(poseLm2d, 24, 0.65);
  const midHipY = hipL && hipR ? (poseLm2d[23].y + poseLm2d[24].y) * 0.5 : -1;
  const torsoHeight = midHipY - midShoulderY;
  const hasHips = hipL && hipR && torsoHeight >= 0.14 && midHipY < 0.92;

  const kneL = hasHips && isLmValid(poseLm2d, 25, 0.68) && poseLm2d[25].y > midHipY + 0.09;
  const kneR = hasHips && isLmValid(poseLm2d, 26, 0.68) && poseLm2d[26].y > midHipY + 0.09;
  const hasKnees = kneL || kneR;

  return { hasShoulders, hasUpperArms, hasHips, hasKnees, elbL, elbR, kneL, kneR };
}

function classifyActiveVisionZone(hasFace, hasHands, anatomy) {
  if (state.cameraZonePref === "face_rppg") {
    return hasHands ? "face_hands" : "face_rppg";
  }
  if (state.cameraZonePref === "upper_body") {
    return anatomy.hasShoulders ? "upper_body" : hasFace ? "face_rppg" : "scanning";
  }
  if (state.cameraZonePref === "full_body") {
    return anatomy.hasKnees ? "full_body" : anatomy.hasShoulders ? "upper_body" : hasFace ? "face_rppg" : "scanning";
  }

  // Automatic Multi-Zone Decision Tree:
  let rawZone = "scanning";
  if (anatomy.hasKnees) {
    rawZone = "full_body";
  } else if (anatomy.hasUpperArms) {
    rawZone = "upper_body";
  } else if (hasFace && hasHands) {
    rawZone = "face_hands";
  } else if (hasFace) {
    rawZone = "face_rppg";
  } else if (hasHands) {
    rawZone = "hands_only";
  } else if (anatomy.hasShoulders) {
    rawZone = "upper_body";
  }

  // 4-frame hysteresis debounce for rock-solid UI transitions
  if (rawZone === state.detectedZone) {
    state.zoneCandidate = rawZone;
    state.zoneCandidateFrames = 0;
  } else if (rawZone === state.zoneCandidate) {
    state.zoneCandidateFrames += 1;
    if (state.zoneCandidateFrames >= 4 || state.detectedZone === "scanning") {
      state.detectedZone = rawZone;
      state.zoneCandidateFrames = 0;
    }
  } else {
    state.zoneCandidate = rawZone;
    state.zoneCandidateFrames = 1;
  }
  return state.detectedZone;
}

function samplePatchMeanRgb(video, normCx, normCy, normW, normH) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 400;
  const x0 = clampNum(normCx - normW * 0.5, 0.01, 0.98 - normW);
  const y0 = clampNum(normCy - normH * 0.5, 0.01, 0.98 - normH);
  rppgScratchCtx.drawImage(
    video,
    x0 * vw,
    y0 * vh,
    Math.max(6, normW * vw),
    Math.max(6, normH * vh),
    0,
    0,
    16,
    16
  );
  const data = rppgScratchCtx.getImageData(0, 0, 16, 16).data;
  let rS = 0, gS = 0, bS = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Exclude saturated glare (eyeglasses reflections) and deep shadow pixels
    if (r > 28 && r < 245 && g > 20 && g < 242 && b > 16 && b < 240 && r >= g * 0.85) {
      rS += r;
      gS += g;
      bS += b;
      n++;
    }
  }
  return {
    valid: n >= 28,
    r: n ? rS / n : 0,
    g: n ? gS / n : 0,
    b: n ? bS / n : 0,
    box: { cx: x0 + normW * 0.5, cy: y0 + normH * 0.5, w: normW, h: normH },
  };
}

function extractThreeZoneFaceRppgAndOcular(video, faceLm, blendshapes, tSec) {
  if (!faceLm || faceLm.length < 468) return null;

  // 1. Inter-ocular distance for scale-invariant anatomical ROI sizing
  const pEyeR = faceLm[33], pEyeL = faceLm[263];
  const iod = Math.max(0.04, Math.hypot(pEyeL.x - pEyeR.x, pEyeL.y - pEyeR.y));

  // 3 anatomical skin patches that completely avoid eyeglasses frames & mouth motion:
  // Forehead glabella/suprabrow (#151 & #9), Right Malar Cheek (#101 & #50), Left Malar Cheek (#330 & #280)
  const fhX = (faceLm[151].x + faceLm[10].x) * 0.5;
  const fhY = (faceLm[151].y + faceLm[10].y) * 0.5;
  const rCheekX = (faceLm[101].x + faceLm[50].x + faceLm[118].x) / 3;
  const rCheekY = (faceLm[101].y + faceLm[50].y + faceLm[118].y) / 3;
  const lCheekX = (faceLm[330].x + faceLm[280].x + faceLm[347].x) / 3;
  const lCheekY = (faceLm[330].y + faceLm[280].y + faceLm[347].y) / 3;

  const pForehead = samplePatchMeanRgb(video, fhX, fhY, iod * 0.56, iod * 0.28);
  const pRCheek = samplePatchMeanRgb(video, rCheekX, rCheekY, iod * 0.34, iod * 0.26);
  const pLCheek = samplePatchMeanRgb(video, lCheekX, lCheekY, iod * 0.34, iod * 0.26);

  const patches = [
    { label: "FOREHEAD", ...pForehead },
    { label: "R-MALAR", ...pRCheek },
    { label: "L-MALAR", ...pLCheek },
  ];
  const validPatches = patches.filter((p) => p.valid);
  if (validPatches.length > 0) {
    const rMean = validPatches.reduce((s, p) => s + p.r, 0) / validPatches.length;
    const gMean = validPatches.reduce((s, p) => s + p.g, 0) / validPatches.length;
    const bMean = validPatches.reduce((s, p) => s + p.b, 0) / validPatches.length;
    state.posRppg.pushRgbSample(tSec, rMean, gMean, bMean);
  }

  if (performance.now() - state.lastRppgComputeMs > 450) {
    state.lastRppgComputeMs = performance.now();
    state.latestRppgMetrics = state.posRppg.computeMetrics();
    if (state.latestRppgMetrics.ready && state.latestRppgMetrics.snrDb >= -2.5) {
      state.telemetry.heart_rate_bpm = Number(
        (state.telemetry.heart_rate_bpm * 0.72 + state.latestRppgMetrics.bpm * 0.28).toFixed(1)
      );
      state.telemetry.hrv_rmssd_ms = Number(
        (state.telemetry.hrv_rmssd_ms * 0.72 + state.latestRppgMetrics.hrvRmssdMs * 0.28).toFixed(1)
      );
    }
  }

  // 2. Ocular Soukupova-Cech 6-pt Eye Aspect Ratio (EAR), PERCLOS Drowsiness & Blink Rate
  const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const earRight =
    (dist2d(faceLm[160], faceLm[144]) + dist2d(faceLm[158], faceLm[153])) /
    Math.max(1e-4, 2 * dist2d(faceLm[33], faceLm[133]));
  const earLeft =
    (dist2d(faceLm[385], faceLm[380]) + dist2d(faceLm[387], faceLm[373])) /
    Math.max(1e-4, 2 * dist2d(faceLm[362], faceLm[263]));
  let ear = clampNum((earRight + earLeft) * 0.5, 0.06, 0.45);

  // Fuse blendshape blink score if present for eyeglass robustness
  if (blendshapes && blendshapes.length > 0) {
    const cats = blendshapes[0].categories || [];
    const bL = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const bR = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    const blinkScore = (bL + bR) * 0.5;
    if (blinkScore > 0.48) ear = Math.min(ear, 0.15);
  }

  const oc = state.ocularStats;
  oc.totalFrames += 1;
  const closed = ear < 0.185;
  if (closed) oc.closedFrames += 1;
  if (closed && !oc.eyeClosed) {
    oc.eyeClosed = true;
  } else if (!closed && oc.eyeClosed) {
    oc.eyeClosed = false;
    oc.blinkCount += 1;
  }
  if (oc.totalFrames > 360) {
    oc.totalFrames = Math.round(oc.totalFrames * 0.5);
    oc.closedFrames = Math.round(oc.closedFrames * 0.5);
  }
  oc.ear = Number((oc.ear * 0.65 + ear * 0.35).toFixed(3));
  oc.perclosPct = Number(clampNum((oc.closedFrames / Math.max(1, oc.totalFrames)) * 100, 0, 100).toFixed(1));

  // 3. 3D Cranio-Facial Pose (Roll, Yaw, Pitch) & Neurological Facial Symmetry (%)
  const dxEye = pEyeL.x - pEyeR.x;
  const dyEye = pEyeL.y - pEyeR.y;
  const rollDeg = clampNum((Math.atan2(dyEye, Math.max(1e-4, dxEye)) * 180) / Math.PI, -45, 45);
  const eyeMidX = (pEyeL.x + pEyeR.x) * 0.5;
  const eyeMidY = (pEyeL.y + pEyeR.y) * 0.5;
  const noseTip = faceLm[4];
  const chin = faceLm[152];
  const faceH = Math.max(0.06, dist2d(faceLm[10], chin));
  const yawDeg = clampNum(((noseTip.x - eyeMidX) / iod) * 58, -50, 50);
  const pitchDeg = clampNum((((noseTip.y - eyeMidY) / faceH) - 0.34) * 115, -45, 45);

  // Mouth-corner & brow elevation symmetry relative to facial midline
  const mouthL = faceLm[291], mouthR = faceLm[61];
  const browL = faceLm[282], browR = faceLm[52];
  const mouthAsym = Math.abs(dist2d(mouthL, chin) - dist2d(mouthR, chin)) / faceH;
  const browAsym = Math.abs(dist2d(browL, pEyeL) - dist2d(browR, pEyeR)) / iod;
  const faceSymPct = clampNum(100 - (mouthAsym * 95 + browAsym * 40), 72, 99.8);

  oc.yawDeg = Number(yawDeg.toFixed(1));
  oc.pitchDeg = Number(pitchDeg.toFixed(1));
  oc.rollDeg = Number(rollDeg.toFixed(1));
  oc.faceSymPct = Number(faceSymPct.toFixed(1));

  return {
    patches,
    ear: oc.ear,
    perclosPct: oc.perclosPct,
    blinkCount: oc.blinkCount,
    yawDeg: oc.yawDeg,
    pitchDeg: oc.pitchDeg,
    rollDeg: oc.rollDeg,
    faceSymPct: oc.faceSymPct,
  };
}

// ----------------------------------------------------------------------------
// 8. High-DPI Aerospace HUD, 3D Stage & Multi-Zone Live Neural Overlays
// ----------------------------------------------------------------------------
function drawAerospaceHudFrame(ctx, W, H, titleLeft, titleRight) {
  const bLen = 13;
  const m = 10;
  ctx.strokeStyle = "rgba(88, 166, 255, 0.42)";
  ctx.lineWidth = 1.4;
  const corners = [
    [m, m + bLen, m, m, m + bLen, m],
    [W - m - bLen, m, W - m, m, W - m, m + bLen],
    [m, H - m - bLen, m, H - m, m + bLen, H - m],
    [W - m - bLen, H - m, W - m, H - m, W - m, H - m - bLen],
  ];
  corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  });

  ctx.save();
  ctx.fillStyle = "rgba(8, 14, 28, 0.86)";
  ctx.beginPath();
  ctx.roundRect(18, 14, W - 36, 28, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(88, 166, 255, 0.26)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '700 10.5px "JetBrains Mono", ui-monospace, monospace';
  const rightBudget = titleRight ? Math.min(250, ctx.measureText(titleRight).width + 18) : 0;
  const leftMaxW = W - 64 - rightBudget;

  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "left";
  ctx.fillText(titleLeft, 28, 32, Math.max(180, leftMaxW));

  if (titleRight) {
    ctx.fillStyle = "#6ee7b7";
    ctx.textAlign = "right";
    ctx.fillText(titleRight, W - 28, 32, 245);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function drawGoniometerArc(ctx, pA, pVertex, pC, radius, strokeColor, fillColor, labelText, labelOffsetX = -115, W = 840, H = 525) {
  if (!pA || !pVertex || !pC) return;
  const a1 = Math.atan2(pA.y - pVertex.y, pA.x - pVertex.x);
  const a2 = Math.atan2(pC.y - pVertex.y, pC.x - pVertex.x);

  let diff = a2 - a1;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  const ccw = diff < 0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pVertex.x, pVertex.y);
  ctx.arc(pVertex.x, pVertex.y, radius, a1, a2, ccw);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pVertex.x, pVertex.y, radius, a1, a2, ccw);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const px = clampNum(pVertex.x + labelOffsetX, 20, W - 126);
  const py = clampNum(pVertex.y - 16, 48, H - 120);
  ctx.fillStyle = "rgba(8, 15, 30, 0.9)";
  ctx.fillRect(px, py, 106, 20);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, 106, 20);

  ctx.fillStyle = strokeColor;
  ctx.font = '700 10.5px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(labelText, px + 6, py + 13.5, 96);
  ctx.restore();
}

function pushAngleTraces(pDeg, sDeg, nowMs) {
  if (state.motionPaused || prefersReducedMotion()) return;
  if (nowMs - state.lastTracePushMs < 33) return;
  state.lastTracePushMs = nowMs;
  state.angleTracePrimary.push(pDeg);
  state.angleTraceSecondary.push(sDeg);
  if (state.angleTracePrimary.length > 180) {
    state.angleTracePrimary.shift();
    state.angleTraceSecondary.shift();
  }
}

function drawScrollingWaveformStrip(ctx, W, H, labelPrimary, labelSecondary, rppgWave = null) {
  const boxX = 18;
  const boxY = H - 92;
  const boxW = W - 36;
  const boxH = 76;

  ctx.save();
  ctx.fillStyle = "rgba(7, 13, 26, 0.88)";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(88, 166, 255, 0.26)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.11)";
  ctx.beginPath();
  ctx.moveTo(boxX + 10, boxY + boxH * 0.56);
  ctx.lineTo(boxX + boxW - 10, boxY + boxH * 0.56);
  ctx.stroke();

  ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = "#58a6ff";
  ctx.textAlign = "left";
  ctx.fillText(`● ${labelPrimary}`, boxX + 12, boxY + 15, 240);
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(`● ${labelSecondary}`, boxX + 264, boxY + 15, 240);

  if (rppgWave && rppgWave.length > 10) {
    ctx.fillStyle = "#34d399";
    ctx.fillText("● 3-ZONE POS-rPPG PULSE WAVE", boxX + 518, boxY + 15, 265);
  }

  const plotTrace = (arr, color, minVal, maxVal) => {
    if (!arr || arr.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < arr.length; i++) {
      const px = boxX + 12 + (i / 180) * (boxW - 24);
      const norm = Math.max(0, Math.min(1, (arr[i] - minVal) / Math.max(1, maxVal - minVal)));
      const py = boxY + boxH - 9 - norm * (boxH - 30);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };

  plotTrace(state.angleTracePrimary, "#58a6ff", 0, 165);
  plotTrace(state.angleTraceSecondary, "#fbbf24", 0, 165);
  if (rppgWave && rppgWave.length > 10) {
    plotTrace(rppgWave, "#34d399", -1.15, 1.15);
  }
  ctx.restore();
}

function render3DBiomechanicalStageFrame(ctx, W, H, nowMs, isReferenceMode) {
  const reduced = prefersReducedMotion();
  let body18 = null;
  let hands21 = null;
  let empKin = null;
  let frameSuffix = "";
  const totalFrames = state.referenceSample?.frames?.length || 62;

  if (isReferenceMode && state.referenceSample?.frames?.length) {
    const sample = state.referenceSample;
    const fps = sample.fps || 30;
    if (!state.motionPaused && !reduced && nowMs - state.referenceLastAdvanceMs >= 1000 / fps) {
      state.referenceLastAdvanceMs = nowMs;
      state.referenceCursor = (state.referenceCursor + 1) % sample.frames.length;
    }
    const frame = sample.frames[state.referenceCursor];
    body18 = frame.body18 || [];
    hands21 = frame.hands21 || [];
    empKin = computeCoco18Kinematics(body18, hands21);
    frameSuffix = ` · FRAME ${String(state.referenceCursor + 1).padStart(2, "0")}/${sample.frames.length}`;
  }

  const pose = state.biomech3d.renderStage(ctx, W, H, {
    protocol: state.protocol,
    telemetry: state.telemetry,
    empKin,
    body18,
    hands21,
    nowMs,
    paused: state.motionPaused || reduced,
    reducedMotion: reduced,
    isDigitalTwin: !isReferenceMode,
    scenarioId: state.activeScenarioId,
    frameIndex: state.referenceCursor,
    totalFrames,
  });

  const isLowerBody = state.protocol === "ared_squat" || state.protocol === "vestibular_sway";
  const rightDeg = isLowerBody ? pose.angles.rKneeFlexDeg : pose.angles.rShoElevDeg;
  const leftDeg = isLowerBody ? pose.angles.lKneeFlexDeg : pose.angles.lShoElevDeg;
  const secondaryWaveDeg = isLowerBody ? pose.angles.lKneeFlexDeg : pose.angles.rElbFlexDeg;

  const primaryLabel = isLowerBody
    ? `R-KNEE FLEX (${pose.angles.rKneeFlexDeg.toFixed(1)}° · ${Math.round(pose.muscles.quadR * 100)}% MVC)`
    : `R-SHOULDER (${pose.angles.rShoElevDeg.toFixed(1)}° · ${Math.round(pose.muscles.deltoidR * 100)}% MVC)`;
  const secondaryLabel = isLowerBody
    ? `L-KNEE FLEX (${pose.angles.lKneeFlexDeg.toFixed(1)}° · ${Math.round(pose.muscles.quadL * 100)}% MVC)`
    : `R-ELBOW FLEX (${pose.angles.rElbFlexDeg.toFixed(1)}° · ${Math.round(pose.muscles.bicepsR * 100)}% MVC)`;

  state.liveKinFrame = {
    romDeg: Math.max(25, Math.min(180, Math.max(rightDeg, leftDeg))),
    targetRomDeg: state.telemetry.target_rom_deg,
    symmetryPct: state.telemetry.bilateral_symmetry_pct,
    trunkLeanDeg: state.telemetry.trunk_lean_deg,
  };

  pushAngleTraces(rightDeg, secondaryWaveDeg, nowMs);

  if (!state.motionPaused && !reduced) {
    if (state.repSegmenter.reps.length < state.referenceAutoRepCap) {
      const rep = state.repSegmenter.update(nowMs / 1000, leftDeg, rightDeg, pose.angles.leanDeg);
      if (rep) {
        rep.source = getShortSourceLabel();
        renderRepTable();
        onRepCompleted(rep);
      }
    }
    recordCsvSample({
      primaryRom: Math.max(leftDeg, rightDeg),
      leftDeg,
      rightDeg,
      symmetryPct: state.telemetry.bilateral_symmetry_pct,
      trunkLeanDeg: pose.angles.leanDeg,
      swayMms: state.telemetry.postural_sway_mms,
    });
  }

  const protoName = PROTOCOL_HUD_TITLES[state.protocol] || "3D BIOMECHANICS";
  const scenUpper = (state.scenarios[state.activeScenarioId]?.name || "").toUpperCase();
  const leftHudTitle = isReferenceMode
    ? `RECORDED 62F MOCAP BENCHMARK · ${protoName}${frameSuffix}`
    : `WHAT-IF DIGITAL TWIN · ${scenUpper || protoName}`;
  const rightHudTitle = state.motionPaused
    ? "PAUSED // DRAG 3D"
    : !isReferenceMode && state.biomech3d.showBaselineGhost
      ? "CYAN = 1G BASELINE GHOST"
      : state.biomech3d.autoOrbit
        ? "360° TURNTABLE · %MVC"
        : "DRAG TO ORBIT 3D · 60 FPS";

  drawAerospaceHudFrame(ctx, W, H, leftHudTitle, rightHudTitle);
  drawScrollingWaveformStrip(ctx, W, H, primaryLabel, secondaryLabel);
}

function drawFaceMeshContour(ctx, faceLm, indices, xf, strokeStyle, lineWidth = 1.35) {
  if (!faceLm || indices.length < 2) return;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  indices.forEach((idx, k) => {
    const p = mapNormPtToCanvas(faceLm[idx], xf);
    if (k === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawFaceAndOcularOverlay(ctx, W, H, faceLm, faceBio, xf) {
  if (!faceLm) return;

  // Precision 478-pt biometric mesh contours (clean aerospace HUD lines, zero face clutter!)
  drawFaceMeshContour(ctx, faceLm, FACE_OVAL_IDX, xf, "rgba(56, 189, 248, 0.58)", 1.5);
  drawFaceMeshContour(ctx, faceLm, RIGHT_BROW_IDX, xf, "rgba(125, 211, 252, 0.65)", 1.3);
  drawFaceMeshContour(ctx, faceLm, LEFT_BROW_IDX, xf, "rgba(125, 211, 252, 0.65)", 1.3);
  drawFaceMeshContour(ctx, faceLm, NOSE_BRIDGE_IDX, xf, "rgba(56, 189, 248, 0.48)", 1.2);
  drawFaceMeshContour(ctx, faceLm, RIGHT_EYE_IDX, xf, "#34d399", 1.7);
  drawFaceMeshContour(ctx, faceLm, LEFT_EYE_IDX, xf, "#34d399", 1.7);
  drawFaceMeshContour(ctx, faceLm, LIPS_OUTER_IDX, xf, "rgba(96, 165, 250, 0.52)", 1.25);

  // Subtle fiducial micro-dots on key cranio-facial anchors
  [10, 152, 33, 133, 362, 263, 4, 61, 291].forEach((idx) => {
    const p = mapNormPtToCanvas(faceLm[idx], xf);
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw 3-zone anatomical rPPG skin ROIs (Forehead + Malar Cheeks, avoiding glasses & lips)
  if (faceBio?.patches) {
    faceBio.patches.forEach((patch) => {
      const pTopLeft = mapNormPtToCanvas(
        { x: patch.box.cx - patch.box.w * 0.5, y: patch.box.cy - patch.box.h * 0.5 },
        xf
      );
      const pBotRight = mapNormPtToCanvas(
        { x: patch.box.cx + patch.box.w * 0.5, y: patch.box.cy + patch.box.h * 0.5 },
        xf
      );
      const rx = Math.min(pTopLeft.x, pBotRight.x);
      const ry = Math.min(pTopLeft.y, pBotRight.y);
      const rw = Math.abs(pBotRight.x - pTopLeft.x);
      const rh = Math.abs(pBotRight.y - pTopLeft.y);

      ctx.save();
      ctx.strokeStyle = patch.valid ? "#34d399" : "rgba(148, 163, 184, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();

      if (patch.label === "FOREHEAD") {
        ctx.save();
        const tagY = Math.max(46, ry - 17);
        ctx.fillStyle = "rgba(6, 12, 24, 0.86)";
        ctx.fillRect(rx, tagY, 108, 15);
        ctx.fillStyle = "#6ee7b7";
        ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText("3-ZONE POS-rPPG", rx + 5, tagY + 10.5);
        ctx.restore();
      }
    });
  }

  // Cranio-Facial & Ocular Biometric Telemetry Card (top-right)
  if (faceBio) {
    const cardW = 224;
    const cardH = 114;
    const cx = W - cardW - 20;
    const cy = 52;
    ctx.save();
    ctx.fillStyle = "rgba(7, 13, 26, 0.86)";
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("CRANIO-FACIAL & OCULAR BIO", cx + 10, cy + 16);

    const rppgTxt = state.latestRppgMetrics.ready
      ? `${Math.round(state.telemetry.heart_rate_bpm)} bpm · HRV ${Math.round(state.telemetry.hrv_rmssd_ms)} ms`
      : `Buffering rPPG (${Math.min(100, Math.round(((state.latestRppgMetrics.bufferedSec || 0) / 3.5) * 100))}%)`;

    const rows = [
      ["POS-rPPG", rppgTxt, "#6ee7b7"],
      ["Ocular EAR", `${faceBio.ear.toFixed(2)} · PERCLOS ${faceBio.perclosPct.toFixed(0)}%`, "#e2e8f0"],
      ["Blink / Sym", `${faceBio.blinkCount} blinks · Sym ${faceBio.faceSymPct.toFixed(1)}%`, "#e2e8f0"],
      [
        "Head 3D",
        `Y ${faceBio.yawDeg >= 0 ? "+" : ""}${faceBio.yawDeg.toFixed(0)}° P ${faceBio.pitchDeg >= 0 ? "+" : ""}${faceBio.pitchDeg.toFixed(0)}° R ${faceBio.rollDeg >= 0 ? "+" : ""}${faceBio.rollDeg.toFixed(0)}°`,
        "#fbbf24",
      ],
    ];
    ctx.font = '600 9.5px "JetBrains Mono", ui-monospace, monospace';
    rows.forEach(([k, v, col], idx) => {
      const ry = cy + 35 + idx * 19;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(k, cx + 10, ry);
      ctx.fillStyle = col;
      ctx.textAlign = "right";
      ctx.fillText(v, cx + cardW - 10, ry, 138);
      ctx.textAlign = "left";
    });
    ctx.restore();
  }
}

function drawHandSkeletonOverlay(ctx, W, H, handsList, xf) {
  if (!handsList || handsList.length === 0) return;
  handsList.forEach((hLm, hIdx) => {
    const col = hIdx === 0 ? "#fbbf24" : "#38bdf8";
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.1;
    HAND21_EDGES.forEach(([a, b]) => {
      const pa = mapNormPtToCanvas(hLm[a], xf);
      const pb = mapNormPtToCanvas(hLm[b], xf);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });
    // Thumb-index pinch caliper (landmarks 4 and 8)
    const p4 = mapNormPtToCanvas(hLm[4], xf);
    const p8 = mapNormPtToCanvas(hLm[8], xf);
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = "#34d399";
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p8.x, p8.y);
    ctx.stroke();
    ctx.setLineDash([]);

    hLm.forEach((pt, jIdx) => {
      const p = mapNormPtToCanvas(pt, xf);
      ctx.fillStyle = jIdx === 4 || jIdx === 8 ? "#34d399" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(p.x, p.y, jIdx === 4 || jIdx === 8 ? 3.5 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });

  // Hand tremor & tap readout pill
  ctx.save();
  const bx = 20, by = 52;
  ctx.fillStyle = "rgba(7, 13, 26, 0.86)";
  ctx.beginPath();
  ctx.roundRect(bx, by, 212, 42, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.stroke();
  ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("21-JOINT HAND NEUROMOTOR", bx + 10, by + 16);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(
    `Tap ${state.telemetry.hand_tap_hz.toFixed(1)} Hz · Tremor ${state.telemetry.tremor_rms_mm.toFixed(2)} mm`,
    bx + 10,
    by + 33
  );
  ctx.restore();
}

function drawVerifiedBodyPoseOverlay(ctx, W, H, lm2d, anatomy, kin3d, zone, xf) {
  if (!lm2d || !anatomy?.hasShoulders) return;
  const allowLower = zone === "full_body" && anatomy.hasKnees;

  const drawEdges = (edges, color, minV = 0.6) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    edges.forEach(([i, j]) => {
      if (!isLmValid(lm2d, i, minV) || !isLmValid(lm2d, j, minV)) return;
      const pa = mapNormPtToCanvas(lm2d[i], xf);
      const pb = mapNormPtToCanvas(lm2d[j], xf);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });
    ctx.restore();
  };

  // Always draw verified upper-body bones; only draw torso/legs if anatomically verified in frame!
  drawEdges(UPPER_BODY_POSE_EDGES, "#34d399", 0.58);
  if (anatomy.hasHips) {
    drawEdges(TORSO_POSE_EDGES, "rgba(56, 189, 248, 0.85)", 0.64);
  }
  if (allowLower) {
    drawEdges(LOWER_BODY_POSE_EDGES, "#34d399", 0.66);
  }

  // Never draw raw Pose face dots (0..10) — FaceLandmarker 478-pt handles the face cleanly!
  const allowedIndices = allowLower
    ? [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    : anatomy.hasHips
      ? [11, 12, 13, 14, 15, 16, 23, 24]
      : [11, 12, 13, 14, 15, 16];

  allowedIndices.forEach((idx) => {
    if (!isLmValid(lm2d, idx, 0.58)) return;
    const p = mapNormPtToCanvas(lm2d[idx], xf);
    const isMajor = idx === 11 || idx === 12 || idx === 25 || idx === 26;
    ctx.fillStyle = isMajor ? "#fbbf24" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(p.x, p.y, isMajor ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!kin3d) return;

  if (allowLower && isLmValid(lm2d, 24, 0.65) && isLmValid(lm2d, 26, 0.68) && isLmValid(lm2d, 28, 0.55)) {
    const pHip = mapNormPtToCanvas(lm2d[24], xf);
    const pKne = mapNormPtToCanvas(lm2d[26], xf);
    const pAnk = mapNormPtToCanvas(lm2d[28], xf);
    drawGoniometerArc(
      ctx,
      pHip,
      pKne,
      pAnk,
      24,
      "#fbbf24",
      "rgba(251,191,36,0.22)",
      `R-KNEE ${kin3d.rKneeFlex.toFixed(1)}°`,
      16,
      W,
      H
    );
  } else if (isLmValid(lm2d, 12, 0.62) && isLmValid(lm2d, 14, 0.58)) {
    const pSho = mapNormPtToCanvas(lm2d[12], xf);
    const pElb = mapNormPtToCanvas(lm2d[14], xf);
    // Reference vertical trunk vector if hip is off-screen
    const pTrunkRef = isLmValid(lm2d, 24, 0.64)
      ? mapNormPtToCanvas(lm2d[24], xf)
      : { x: pSho.x, y: Math.min(H - 96, pSho.y + 110) };
    drawGoniometerArc(
      ctx,
      pTrunkRef,
      pSho,
      pElb,
      24,
      "#34d399",
      "rgba(52,211,153,0.22)",
      `R-SHO ${kin3d.rShoulderElev.toFixed(1)}°`,
      -122,
      W,
      H
    );
    if (isLmValid(lm2d, 16, 0.56)) {
      const pWri = mapNormPtToCanvas(lm2d[16], xf);
      drawGoniometerArc(
        ctx,
        pSho,
        pElb,
        pWri,
        21,
        "#fbbf24",
        "rgba(251,191,36,0.20)",
        `R-ELB ${kin3d.rElbowFlex.toFixed(1)}°`,
        16,
        W,
        H
      );
    }
  }
}

function renderVideoNeuralFrame(ctx, W, H, nowMs) {
  const video = document.getElementById("webcamVideo");
  if (!video || video.readyState < 2) {
    ctx.fillStyle = "#060b16";
    ctx.fillRect(0, 0, W, H);
    drawAerospaceHudFrame(ctx, W, H, "ADAPTIVE MULTI-ZONE 3D VISION (FACEMESH + POSE + HAND)", "STANDBY");
    ctx.fillStyle = "#cbd5e1";
    ctx.font = '600 13.5px "Inter", system-ui, sans-serif';
    const msg =
      state.sourceMode === "local_video" && !state.localVideoUrl
        ? "Click 'Video File' above to analyze a local .mp4/.webm clip 100% on-device."
        : "Acquiring camera feed & loading 478-pt FaceMesh + 3D Pose + 21-pt Hand WASM...";
    ctx.fillText(msg, 36, H / 2);
    return;
  }

  const isMirrored = state.sourceMode === "live_webcam";
  const xf = computeVideoCoverTransform(video, W, H, isMirrored);

  // Draw distortion-free aspect-ratio-covered video (horizontally mirrored for selfie webcam)
  ctx.save();
  if (isMirrored) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, xf.sx, xf.sy, xf.sw, xf.sh, 0, 0, W, H);
  ctx.restore();

  ctx.fillStyle = "rgba(5, 10, 20, 0.20)";
  ctx.fillRect(0, 0, W, H);

  const tSec = nowMs / 1000;
  // Run neural inference on new video frames (~30 Hz), cache results for flicker-free 60 Hz overlay rendering
  if (!state.motionPaused && state.poseLandmarker && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    const dtSec = state.lastInferenceWallSec
      ? Math.max(0.008, Math.min(0.2, tSec - state.lastInferenceWallSec))
      : 0.033;
    state.lastInferenceWallSec = tSec;

    const faceRes = state.faceLandmarker ? state.faceLandmarker.detectForVideo(video, nowMs) : null;
    const poseRes = state.poseLandmarker.detectForVideo(video, nowMs + 0.05);
    const handRes = state.handLandmarker ? state.handLandmarker.detectForVideo(video, nowMs + 0.1) : null;

    const faceLm = faceRes?.faceLandmarks?.[0] || null;
    const blendshapes = faceRes?.faceBlendshapes || null;
    const poseLm2d = poseRes?.landmarks?.[0] || null;
    const rawWorld = poseRes?.worldLandmarks?.[0] || poseLm2d;
    const handsList = handRes?.landmarks || [];

    const anatomy = analyzePoseAnatomy(poseLm2d);
    const zone = classifyActiveVisionZone(Boolean(faceLm), handsList.length > 0, anatomy);
    updateDetectedZoneBadge(zone);

    let faceBio = null;
    if (faceLm) {
      faceBio = extractThreeZoneFaceRppgAndOcular(video, faceLm, blendshapes, tSec);
    } else if (poseLm2d && isLmValid(poseLm2d, 0, 0.55)) {
      // Fallback forehead patch when face is far away in full-body view
      const pNose = poseLm2d[0];
      const patch = samplePatchMeanRgb(video, pNose.x, Math.max(0.04, pNose.y - 0.05), 0.07, 0.045);
      if (patch.valid) state.posRppg.pushRgbSample(tSec, patch.r, patch.g, patch.b);
    }

    let kin3d = null;
    if (poseLm2d && rawWorld && anatomy.hasShoulders) {
      const filteredWorld = rawWorld.map((pt, idx) => state.worldFilters[idx].filter(pt, tSec));
      kin3d = compute3DWorldKinematics(filteredWorld, state.prevWorldHip, dtSec);
      if (anatomy.hasHips) state.prevWorldHip = kin3d.midHip;
    }

    if (handsList.length > 0) {
      const dex = state.handTracker.update(handsList[0], tSec);
      if (dex) {
        state.telemetry.hand_tap_hz = dex.tapHz;
        state.telemetry.tremor_rms_mm = dex.tremorRmsMm;
      }
    }

    let hudLeft = "AUTO-ZONE BIOMETRIC SCAN · ALIGN FACE, HANDS, OR BODY";
    let hudRight = "ZERO-CLOUD EDGE AI";
    let waveLabelA = "OCULAR EAR (×300)";
    let waveLabelB = "HEAD TILT (°)";
    let traceA = (state.ocularStats.ear || 0.28) * 300;
    let traceB = Math.abs(state.ocularStats.rollDeg || 0) * 3;

    if (zone === "full_body" && kin3d) {
      const leftDeg = kin3d.lKneeFlex;
      const rightDeg = kin3d.rKneeFlex;
      const primaryRom = Math.max(leftDeg, rightDeg);
      const sym = 100 * (1 - Math.abs(leftDeg - rightDeg) / Math.max(leftDeg, rightDeg, 15));

      state.telemetry.joint_rom_deg = Number(clampNum(primaryRom, 25, 180).toFixed(1));
      state.telemetry.bilateral_symmetry_pct = Number(clampNum(sym, 45, 100).toFixed(1));
      state.telemetry.trunk_lean_deg = Number(clampNum(kin3d.trunkLeanDeg, 0, 45).toFixed(1));
      state.telemetry.postural_sway_mms = Number(
        (state.telemetry.postural_sway_mms * 0.8 + kin3d.swayMmPerSec * 0.2).toFixed(1)
      );

      traceA = leftDeg;
      traceB = rightDeg;
      waveLabelA = `L-KNEE 3D (${leftDeg.toFixed(1)}°)`;
      waveLabelB = `R-KNEE 3D (${rightDeg.toFixed(1)}°)`;
      hudLeft = `FULL-BODY 3D WORLDPOSE · KNEE L ${leftDeg.toFixed(1)}° / R ${rightDeg.toFixed(1)}°`;
      hudRight = `TRUNK TILT ${kin3d.trunkLeanDeg.toFixed(1)}°`;

      const rep = state.repSegmenter.update(tSec, leftDeg, rightDeg, kin3d.trunkLeanDeg);
      if (rep) {
        rep.source = "Live Full-Body 3D";
        renderRepTable();
        onRepCompleted(rep);
      }
    } else if (zone === "upper_body" && kin3d) {
      const leftDeg = kin3d.lShoulderElev;
      const rightDeg = kin3d.rShoulderElev;
      const primaryRom = Math.max(leftDeg, rightDeg);
      const sym = 100 * (1 - Math.abs(leftDeg - rightDeg) / Math.max(leftDeg, rightDeg, 15));

      state.telemetry.joint_rom_deg = Number(clampNum(primaryRom, 25, 180).toFixed(1));
      state.telemetry.bilateral_symmetry_pct = Number(clampNum(sym, 45, 100).toFixed(1));
      if (anatomy.hasHips) {
        state.telemetry.trunk_lean_deg = Number(clampNum(kin3d.trunkLeanDeg, 0, 45).toFixed(1));
      }

      traceA = rightDeg;
      traceB = kin3d.rElbowFlex;
      waveLabelA = `R-SHOULDER 3D (${rightDeg.toFixed(1)}°)`;
      waveLabelB = `R-ELBOW 3D (${kin3d.rElbowFlex.toFixed(1)}°)`;
      hudLeft = `UPPER-BODY 3D · SHOULDER L ${leftDeg.toFixed(1)}° / R ${rightDeg.toFixed(1)}°`;
      hudRight = `ELBOW R ${kin3d.rElbowFlex.toFixed(1)}°`;

      const rep = state.repSegmenter.update(tSec, leftDeg, rightDeg, state.telemetry.trunk_lean_deg);
      if (rep) {
        rep.source = "Live Upper-Body 3D";
        renderRepTable();
        onRepCompleted(rep);
      }
    } else if ((zone === "face_rppg" || zone === "face_hands") && faceBio) {
      state.telemetry.bilateral_symmetry_pct = faceBio.faceSymPct;
      state.telemetry.trunk_lean_deg = Number(clampNum(Math.abs(faceBio.rollDeg), 0, 35).toFixed(1));
      traceA = clampNum(faceBio.ear * 380, 15, 160);
      traceB = clampNum(Math.abs(faceBio.yawDeg) * 2.2 + Math.abs(faceBio.rollDeg) * 2.0, 4, 155);
      waveLabelA = `OCULAR EAR (${faceBio.ear.toFixed(2)} · PERCLOS ${faceBio.perclosPct.toFixed(0)}%)`;
      waveLabelB =
        handsList.length > 0
          ? `HAND TREMOR (${state.telemetry.tremor_rms_mm.toFixed(2)} mm)`
          : `CRANIAL POSE (YAW ${faceBio.yawDeg.toFixed(0)}° / ROLL ${faceBio.rollDeg.toFixed(0)}°)`;
      hudLeft =
        zone === "face_hands"
          ? "FACE 478-PT rPPG + 21-JOINT HAND TREMOR ASSAY"
          : "CLOSE-UP CRANIO-FACIAL 478-PT MESH & 3-ZONE POS-rPPG";
      hudRight = state.latestRppgMetrics.ready
        ? `HR ${Math.round(state.telemetry.heart_rate_bpm)} BPM · SYM ${faceBio.faceSymPct.toFixed(1)}%`
        : `FACIAL SYM ${faceBio.faceSymPct.toFixed(1)}%`;
    } else if (zone === "hands_only") {
      traceA = clampNum(state.telemetry.hand_tap_hz * 22, 5, 160);
      traceB = clampNum(state.telemetry.tremor_rms_mm * 35, 5, 160);
      waveLabelA = `FINGER TAP (${state.telemetry.hand_tap_hz.toFixed(1)} Hz)`;
      waveLabelB = `TREMOR RMS (${state.telemetry.tremor_rms_mm.toFixed(2)} mm)`;
      hudLeft = "21-JOINT FINE-MOTOR DEXTERITY & TREMOR SCANNER";
      hudRight = `TAP ${state.telemetry.hand_tap_hz.toFixed(1)} HZ`;
    }

    state.liveKinFrame = {
      romDeg: state.telemetry.joint_rom_deg,
      targetRomDeg: state.telemetry.target_rom_deg,
      symmetryPct: state.telemetry.bilateral_symmetry_pct,
      trunkLeanDeg: state.telemetry.trunk_lean_deg,
    };

    pushAngleTraces(traceA, traceB, nowMs);
    recordCsvSample({
      primaryRom: state.telemetry.joint_rom_deg,
      leftDeg: traceA,
      rightDeg: traceB,
      symmetryPct: state.telemetry.bilateral_symmetry_pct,
      trunkLeanDeg: state.telemetry.trunk_lean_deg,
      swayMms: state.telemetry.postural_sway_mms,
    });
    syncSlidersFromTelemetry();
    scheduleEvaluation();

    state.lastVisionCache = {
      zone,
      faceLm,
      faceBio,
      poseLm2d,
      anatomy,
      kin3d,
      handsList,
      hudLeft,
      hudRight,
      waveLabelA,
      waveLabelB,
    };
  }

  // Render cached multi-zone overlays on EVERY 60 FPS animation frame (eliminating 30 Hz flicker!)
  const vc = state.lastVisionCache;
  if (vc) {
    if (vc.zone === "full_body" || vc.zone === "upper_body") {
      drawVerifiedBodyPoseOverlay(ctx, W, H, vc.poseLm2d, vc.anatomy, vc.kin3d, vc.zone, xf);
    }
    if (vc.faceLm) {
      drawFaceAndOcularOverlay(ctx, W, H, vc.faceLm, vc.faceBio, xf);
    }
    if (vc.handsList && vc.handsList.length > 0) {
      drawHandSkeletonOverlay(ctx, W, H, vc.handsList, xf);
    }
    drawAerospaceHudFrame(ctx, W, H, vc.hudLeft, vc.hudRight);
    drawScrollingWaveformStrip(ctx, W, H, vc.waveLabelA, vc.waveLabelB, state.latestRppgMetrics.wave);
  } else {
    drawAerospaceHudFrame(ctx, W, H, "AUTO-DETECTING FRAMING ZONE (FACE / UPPER-BODY / FULL-BODY)", "READY");
    drawScrollingWaveformStrip(ctx, W, H, "PRIMARY CHANNEL", "SECONDARY CHANNEL", state.latestRppgMetrics.wave);
  }
}

function sync3DCameraToolbarUi() {
  const b3d = state.biomech3d;
  const setPressed = (id, active) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-pressed", String(Boolean(active)));
  };
  setPressed("camIsoBtn", !b3d.autoOrbit && b3d.cameraPreset === "iso");
  setPressed("camFrontBtn", !b3d.autoOrbit && b3d.cameraPreset === "front");
  setPressed("camSideBtn", !b3d.autoOrbit && b3d.cameraPreset === "side");
  setPressed("camOrbitBtn", b3d.autoOrbit);
  setPressed("toggleMuscleEmgBtn", b3d.showMuscleHeatmap);
  setPressed("toggleGhostBtn", b3d.showBaselineGhost);
}

function init3DCameraToolbar() {
  const canvas = document.getElementById("kinematicCanvas");
  if (canvas) {
    state.biomech3d.attachControls(canvas);
    canvas.addEventListener("pointerdown", () => {
      state.biomech3d.cameraPreset = "custom";
      sync3DCameraToolbarUi();
    });
    canvas.addEventListener("dblclick", () => {
      sync3DCameraToolbarUi();
    });
  }

  const bindPreset = (id, preset) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      state.biomech3d.setPreset(preset);
      sync3DCameraToolbarUi();
    });
  };
  bindPreset("camIsoBtn", "iso");
  bindPreset("camFrontBtn", "front");
  bindPreset("camSideBtn", "side");
  bindPreset("camOrbitBtn", "orbit");

  const emgBtn = document.getElementById("toggleMuscleEmgBtn");
  if (emgBtn) {
    emgBtn.addEventListener("click", () => {
      state.biomech3d.showMuscleHeatmap = !state.biomech3d.showMuscleHeatmap;
      sync3DCameraToolbarUi();
    });
  }

  const ghostBtn = document.getElementById("toggleGhostBtn");
  if (ghostBtn) {
    ghostBtn.addEventListener("click", () => {
      state.biomech3d.showBaselineGhost = !state.biomech3d.showBaselineGhost;
      sync3DCameraToolbarUi();
    });
  }

  // Camera framing zone override pills (Auto-Detect / Face & rPPG / Upper Body + Hands / Full Body 3D)
  document.querySelectorAll('input[name="cameraZoneRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.cameraZonePref = radio.value;
      if (radio.value !== "auto") {
        state.detectedZone = radio.value;
      }
      updateDetectedZoneBadge(state.detectedZone);
    });
  });

  // Inline What-If Digital Twin quick perturbation sliders + Match 1g Baseline button
  const bindQuickTwinSlider = (inId, outId, key, suffix, decimals = 0) => {
    const el = document.getElementById(inId);
    const out = document.getElementById(outId);
    if (!el || !out) return;
    el.addEventListener("input", () => {
      const v = Number(el.value);
      state.telemetry[key] = v;
      out.textContent = `${v.toFixed(decimals)}${suffix}`;
      syncSlidersFromTelemetry();
      scheduleEvaluation();
    });
  };
  bindQuickTwinSlider("quickTwinRom", "quickTwinRomOut", "joint_rom_deg", "°", 0);
  bindQuickTwinSlider("quickTwinSym", "quickTwinSymOut", "bilateral_symmetry_pct", "%", 0);
  bindQuickTwinSlider("quickTwinLean", "quickTwinLeanOut", "trunk_lean_deg", "°", 0);

  const resetTwinBtn = document.getElementById("resetTwinBaselineBtn");
  if (resetTwinBtn) {
    resetTwinBtn.addEventListener("click", () => {
      state.telemetry.joint_rom_deg = state.telemetry.target_rom_deg || 118;
      state.telemetry.bilateral_symmetry_pct = 98.5;
      state.telemetry.trunk_lean_deg = 1.8;
      state.telemetry.postural_sway_mms = 4.2;
      state.telemetry.tremor_rms_mm = 0.35;
      syncSlidersFromTelemetry();
      scheduleEvaluation();
    });
  }

  syncContextualModeBars();
  sync3DCameraToolbarUi();
}

function startStudioLoop() {
  const canvas = document.getElementById("kinematicCanvas");
  const W = 840;
  const H = 525;

  function frame(nowMs) {
    if (!state.activeWorkspaceTab || state.activeWorkspaceTab === "panelMissionConsole") {
      const ctx = prepareHiDpiCanvas(canvas, W, H);
      if (state.sourceMode === "reference_mocap") {
        render3DBiomechanicalStageFrame(ctx, W, H, nowMs, true);
      } else if (state.sourceMode === "live_webcam" || state.sourceMode === "local_video") {
        renderVideoNeuralFrame(ctx, W, H, nowMs);
      } else {
        render3DBiomechanicalStageFrame(ctx, W, H, nowMs, false);
      }
    }

    state.neuroEngine.updateFromKinematics({
      ...state.liveKinFrame,
      nowMs,
    });

    if (state.activeWorkspaceTab === "panelNeuroLab") {
      renderAcousticSpectrumScope(nowMs);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------------------
// 9. High-DPI Empirical NASA OSDR OSD-571 Longitudinal Chart + Hover Crosshair
// ----------------------------------------------------------------------------
const CHART_GENES = [
  { gene: "CAT", color: "#fb7185", label: "CAT (5.24x ROS)" },
  { gene: "PRDX2", color: "#fb923c", label: "PRDX2 (5.09x Rad)" },
  { gene: "HBA1", color: "#facc15", label: "HBA1 (4.36x Hemolysis)" },
  { gene: "TLN1", color: "#34d399", label: "TLN1 (2.36x Cytoskel)" },
  { gene: "C3", color: "#60a5fa", label: "C3 (0.67x Immune)" },
  { gene: "FN1", color: "#c084fc", label: "FN1 (0.17x ECM)" },
];

function getBiomarkerSeriesForCrew(bm, crewSel) {
  const suffixes = ["_1", "_2", "_3", "_4", "_5", "_6"];
  const crews = crewSel === "MEAN" ? ["C001", "C002", "C003", "C004"] : [crewSel];
  return suffixes.map((sfx) => {
    const vals = crews
      .map((c) => bm.log10_intensities?.[`${c}${sfx}`])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
}

function updateOsdrHoverReadout(tpIdx) {
  const data = state.osdrEmpirical;
  const readout = document.getElementById("osdrHoverReadout");
  if (!data || !readout) return;
  const tp = data.timepoints?.[tpIdx];
  if (!tp) return;

  const parts = CHART_GENES.map((cg) => {
    const bm = (data.biomarkers || []).find((b) => b.gene === cg.gene);
    if (!bm) return null;
    const series = getBiomarkerSeriesForCrew(bm, state.osdrSelectedCrew);
    const preVals = series.slice(0, 3).filter((v) => v !== null);
    const val = series[tpIdx];
    if (!preVals.length || val === null) return null;
    const preMean = preVals.reduce((a, b) => a + b, 0) / preVals.length;
    const fold = Math.pow(10, val - preMean);
    return `${cg.gene} ${fold.toFixed(2)}x`;
  }).filter(Boolean);

  const crewLabel = state.osdrSelectedCrew === "MEAN" ? "Cohort Mean" : state.osdrSelectedCrew;
  readout.textContent = `[${tp.code} · ${tp.phase} · ${crewLabel}]  ${parts.join(" · ")}`;
}

function renderOsdrCohortChart() {
  const data = state.osdrEmpirical;
  const canvas = document.getElementById("osdrChartCanvas");
  if (!data || !canvas) return;
  const W = 680;
  const H = 225;
  const ctx = prepareHiDpiCanvas(canvas, W, H);

  ctx.fillStyle = "#070d1a";
  ctx.fillRect(0, 0, W, H);

  const padL = 54, padR = 26, padT = 38, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const tps = data.timepoints || [];

  const r1X = padL + (3 / 5) * plotW;
  ctx.fillStyle = "rgba(251, 113, 133, 0.13)";
  ctx.fillRect(r1X - 26, padT, 52, plotH);

  if (state.osdrHoverIndex >= 0 && state.osdrHoverIndex < tps.length) {
    const hx = padL + (state.osdrHoverIndex / 5) * plotW;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx, padT);
    ctx.lineTo(hx, padT + plotH);
    ctx.stroke();
    ctx.restore();
  }

  const yTicks = [-1.0, -0.5, 0.0, 0.5, 1.0];
  ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
  yTicks.forEach((yv) => {
    const py = padT + ((1.0 - yv) / 2.0) * plotH;
    ctx.strokeStyle = yv === 0 ? "rgba(226, 232, 240, 0.42)" : "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = yv === 0 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(W - padR, py);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${yv > 0 ? "+" : ""}${yv.toFixed(1)}`, 12, py + 3.5);
  });

  tps.forEach((tp, idx) => {
    const px = padL + (idx / Math.max(1, tps.length - 1)) * plotW;
    const isActive = idx === state.osdrHoverIndex;
    ctx.fillStyle = tp.code === "R+1" ? "#fda4af" : isActive ? "#ffffff" : "#cbd5e1";
    ctx.font =
      tp.code === "R+1" || isActive
        ? '700 10.5px "JetBrains Mono", ui-monospace, monospace'
        : '600 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(tp.code, px - 14, H - 10);
  });

  CHART_GENES.forEach((cg, gIdx) => {
    const bm = (data.biomarkers || []).find((b) => b.gene === cg.gene);
    if (!bm) return;
    const series = getBiomarkerSeriesForCrew(bm, state.osdrSelectedCrew);
    const preVals = series.slice(0, 3).filter((v) => v !== null);
    if (preVals.length === 0) return;
    const preMean = preVals.reduce((a, b) => a + b, 0) / preVals.length;

    ctx.strokeStyle = cg.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let started = false;
    series.forEach((val, idx) => {
      if (val === null) return;
      const delta = Math.max(-1.08, Math.min(1.08, val - preMean));
      const px = padL + (idx / 5) * plotW;
      const py = padT + ((1.0 - delta) / 2.0) * plotH;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();

    series.forEach((val, idx) => {
      if (val === null) return;
      const delta = Math.max(-1.08, Math.min(1.08, val - preMean));
      const px = padL + (idx / 5) * plotW;
      const py = padT + ((1.0 - delta) / 2.0) * plotH;
      const highlight = idx === state.osdrHoverIndex || idx === 3;
      ctx.fillStyle = cg.color;
      ctx.beginPath();
      ctx.arc(px, py, highlight ? 4.3 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    const lx = 14 + (gIdx % 3) * 222;
    const ly = gIdx < 3 ? 14 : 27;
    ctx.fillStyle = cg.color;
    ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(`● ${cg.label}`, lx, ly);
  });

  updateOsdrHoverReadout(state.osdrHoverIndex);
}

function renderOsdrCohortTable() {
  const data = state.osdrEmpirical;
  const tbody = document.getElementById("osdrTableBody");
  if (!data || !tbody) return;

  tbody.innerHTML = (data.biomarkers || [])
    .map((bm) => {
      const series = getBiomarkerSeriesForCrew(bm, state.osdrSelectedCrew);
      const preVals = series.slice(0, 3).filter((v) => v !== null);
      const preMean = preVals.length ? preVals.reduce((a, b) => a + b, 0) / preVals.length : bm.preflight_log10_mean;
      const r1Val = series[3] !== null ? series[3] : bm.immediate_postflight_log10_mean;
      const fold = Math.pow(10, r1Val - preMean);

      const badgeCls = fold >= 2.0 ? "badge-alert" : fold <= 0.5 ? "badge-watch" : "badge-nominal";
      const glyph = fold >= 2.0 ? "▲" : fold <= 0.5 ? "▼" : "●";

      return `
        <tr>
          <th scope="row"><code>${escapeHtml(bm.gene)}</code></th>
          <td>${escapeHtml(bm.clinical_label)}</td>
          <td class="mono">${preMean.toFixed(3)}</td>
          <td class="mono">${r1Val.toFixed(3)}</td>
          <td><span class="badge ${badgeCls}"><span aria-hidden="true">${glyph}</span> ${fold.toFixed(2)}x</span></td>
        </tr>
      `;
    })
    .join("");
}

// ----------------------------------------------------------------------------
// 10A. Freeze-Frame, Closed-Loop Neuro-Acoustic Music Therapy, 3D Sonification,
//      64-Band FFT + Lissajous Phase Scope, AI Voice Flight Surgeon & Vocal DSP
// ----------------------------------------------------------------------------
function toggleFreezeFrame() {
  state.motionPaused = !state.motionPaused;
  const btn = document.getElementById("pauseMotionBtn");
  const lbl = document.getElementById("pauseMotionLabel");
  const video = document.getElementById("webcamVideo");
  if (btn) btn.setAttribute("aria-pressed", String(state.motionPaused));
  if (lbl) lbl.textContent = state.motionPaused ? "Resume" : "Freeze";
  if (video && state.sourceMode === "local_video") {
    if (state.motionPaused) video.pause();
    else video.play().catch(() => {});
  }
}

function setAcousticCaption(text, immediate = false) {
  if (document.querySelector("dialog[open]")) return;
  const el = document.getElementById("acousticTranscriptText");
  if (!el) return;
  clearTimeout(state.captionDebounceTimer);
  if (immediate) {
    el.textContent = text;
    return;
  }
  state.captionDebounceTimer = setTimeout(() => {
    if (!document.querySelector("dialog[open]")) {
      el.textContent = text;
    }
  }, 300);
}

function syncAudioButtonsUi() {
  const playing = state.neuroEngine.isPlaying;
  const voiceMode = state.neuroEngine.voiceMode;

  const playBtn = document.getElementById("toggleNeuroPlayBtn");
  const playLbl = document.getElementById("neuroPlayBtnLabel");
  if (playBtn) playBtn.setAttribute("aria-pressed", String(playing));
  if (playLbl) {
    playLbl.textContent = playing ? "Stop Audio Engine" : "Engage Audio Engine";
  }

  const quickPlayBtn = document.getElementById("quickNeuroPlayBtn");
  const quickPlayLbl = document.getElementById("quickNeuroPlayLabel");
  if (quickPlayBtn) quickPlayBtn.setAttribute("aria-pressed", String(playing));
  if (quickPlayLbl) {
    quickPlayLbl.textContent = playing ? "Stop Therapy" : "Play Therapy";
  }

  const rasBtn = document.getElementById("toggleRasBtn");
  const rasLbl = document.getElementById("rasBtnLabel");
  if (rasBtn) rasBtn.setAttribute("aria-pressed", String(playing));
  if (rasLbl) {
    rasLbl.textContent = playing ? `RAS ${Math.round(state.neuroEngine.tempoBpm)} BPM` : "RAS Pacer";
  }

  const micBtn = document.getElementById("micVocalBtn");
  const micLbl = document.getElementById("micVocalLabel");
  if (micBtn) micBtn.setAttribute("aria-pressed", String(voiceMode === "mic"));
  if (micLbl) micLbl.textContent = voiceMode === "mic" ? "Stop Mic Vocal DSP" : "Live Mic Vocal DSP";

  const synthBtn = document.getElementById("synthVocalBtn");
  const synthLbl = document.getElementById("synthVocalLabel");
  if (synthBtn) synthBtn.setAttribute("aria-pressed", String(voiceMode === "synthetic"));
  if (synthLbl) synthLbl.textContent = voiceMode === "synthetic" ? "Vocal Assay Running..." : "Formant Vocal Test";
}

function selectNeuroProtocol(protocolId, manual = true) {
  if (!NEURO_PROTOCOLS[protocolId]) return;
  if (manual && state.autoRxSyncEnabled) {
    state.autoRxSyncEnabled = false;
    const autoBtn = document.getElementById("toggleAutoRxSyncBtn");
    if (autoBtn) autoBtn.setAttribute("aria-pressed", "false");
  }

  state.neuroEngine.setProtocol(protocolId);
  const proto = NEURO_PROTOCOLS[protocolId];

  document.querySelectorAll('input[name="neuroProtocolRadio"]').forEach((r) => {
    r.checked = r.value === protocolId;
  });

  const inBeat = document.getElementById("inBinauralHz");
  const outBeat = document.getElementById("outBinauralHz");
  if (inBeat) {
    inBeat.value = proto.binauralBeatHz;
    syncSliderCssProps(inBeat);
  }
  if (outBeat) outBeat.textContent = proto.binauralBeatHz.toFixed(1);

  const inTempo = document.getElementById("inNeuroTempo");
  const outTempo = document.getElementById("outNeuroTempo");
  if (inTempo) {
    inTempo.value = proto.defaultBpm;
    syncSliderCssProps(inTempo);
  }
  if (outTempo) outTempo.textContent = Math.round(proto.defaultBpm);

  const quickRxEl = document.getElementById("quickRxSummary");
  if (quickRxEl && manual) {
    quickRxEl.textContent = `Rx: ${proto.binauralBeatHz} Hz ${proto.name}`;
  }

  syncAudioButtonsUi();
  if (manual) {
    setAcousticCaption(
      `[Protocol selected] ${proto.name}: ${proto.subtitle}. Dichotic carrier ${proto.carrierHz.toFixed(1)} / ${(proto.carrierHz + proto.binauralBeatHz).toFixed(1)} Hz at ${proto.defaultBpm} BPM.`
    );
    scheduleEvaluation();
  }
}

function toggleNeuroPlay() {
  if (state.neuroEngine.isPlaying) {
    state.neuroEngine.stop();
    state.rasActive = false;
    syncAudioButtonsUi();
    setAcousticCaption(
      "[Neuro-acoustic synthesizer paused] 3D joint-ROM resonance filter and Mayer breathing guide remain armed.",
      true
    );
    return;
  }

  state.neuroEngine.start();
  state.rasActive = true;
  syncAudioButtonsUi();
  const proto = NEURO_PROTOCOLS[state.neuroEngine.protocolId] || NEURO_PROTOCOLS.ras_motor;
  setAcousticCaption(
    `[Generative music therapy active] Playing ${proto.name} (${proto.binauralBeatHz.toFixed(1)} Hz dichotic binaural beat at ${Math.round(state.neuroEngine.tempoBpm)} BPM) with 3D joint-ROM resonant filter (${state.neuroEngine.currentFilterCutoffHz} Hz) and 1/f pink-noise Mayer wave.`,
    true
  );
}

function toggleRasAudio() {
  if (!state.neuroEngine.isPlaying) {
    const targetBpm = Math.max(48, Math.min(124, Math.round((state.telemetry.cadence_rpm + 2) * 4)));
    selectNeuroProtocol("ras_motor", false);
    state.neuroEngine.setTempoBpm(targetBpm);
    const inTempo = document.getElementById("inNeuroTempo");
    const outTempo = document.getElementById("outNeuroTempo");
    if (inTempo) {
      inTempo.value = targetBpm;
      syncSliderCssProps(inTempo);
    }
    if (outTempo) outTempo.textContent = targetBpm;
  }
  toggleNeuroPlay();
}

function onRepCompleted(rep) {
  if (!rep) return;
  state.neuroEngine.triggerRepCompletionChime(rep.symmetryPct);

  const chimeDesc =
    rep.symmetryPct >= 88
      ? "C5-E5-G5-D6 major-9th consonance chime"
      : "A4-D5-E5 suspended asymmetry cue";

  if (state.voiceRepCoachEnabled && "speechSynthesis" in window && !state.voiceBriefingActive) {
    const postureTip = rep.maxTrunkLeanDeg > 11 ? " Center trunk." : " Clean alignment.";
    const phrase = `Cycle ${rep.rep}. Symmetry ${Math.round(rep.symmetryPct)} percent.${postureTip}`;
    setAcousticCaption(`[Cycle #${rep.rep} ${chimeDesc} + Voice Coach] "${phrase}"`);
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(phrase);
      utt.rate = 1.06;
      utt.pitch = 1.0;
      utt.onstart = () => state.neuroEngine.setTtsDucking(true);
      utt.onend = () => state.neuroEngine.setTtsDucking(false);
      utt.onerror = () => state.neuroEngine.setTtsDucking(false);
      window.speechSynthesis.speak(utt);
    } catch {}
  } else if (state.neuroEngine.isPlaying) {
    setAcousticCaption(
      `[Cycle #${rep.rep} completed] Played ${chimeDesc} (Peak ROM ${rep.peakRomDeg.toFixed(1)} deg, Symmetry ${rep.symmetryPct.toFixed(1)}%).`
    );
  }
}

function speakFlightSurgeonBriefing() {
  const speakBtn = document.getElementById("speakBriefingBtn");
  const speakLbl = document.getElementById("speakBriefingLabel");
  const topBtn = document.getElementById("topbarVoiceBriefBtn");

  const setBriefingUi = (active) => {
    state.voiceBriefingActive = active;
    if (speakBtn) speakBtn.setAttribute("aria-pressed", String(active));
    if (topBtn) topBtn.setAttribute("aria-pressed", String(active));
    if (speakLbl) speakLbl.textContent = active ? "Stop Briefing" : "Flight Surgeon Voice";
    state.neuroEngine.setTtsDucking(active);
  };

  if (state.voiceBriefingActive) {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setBriefingUi(false);
    setAcousticCaption("[Flight Surgeon Voice Briefing stopped] Music therapy sidechain restored to 0 dB.", true);
    return;
  }

  const ev = state.latestEvaluation;
  const crewShort = state.crewMember.split("(")[0].trim();
  const score = ev ? Number(ev.readiness_score).toFixed(1) : "85.0";
  const dm = ev?.multivariate_stats ? ev.multivariate_stats.mahalanobis_d.toFixed(2) : "1.20";
  const driver = ev?.multivariate_stats?.top_attributions?.[0]?.feature || "Bilateral Symmetry";
  const cmTitle = ev?.countermeasures?.[0]?.title || "Maintain scheduled ARED protocol";
  const rxTitle = ev?.neuro_prescription?.recommended_title || "Motor Cadence 16 Hertz Beta RAS";
  const statusWord = ev ? ev.overall_status.toUpperCase() : "WATCH";

  const spokenText =
    `AstroKinetics Flight Surgeon Briefing for ${crewShort}, Sol ${state.missionSol}. ` +
    `Readiness index ${score} out of 100, status ${statusWord}. ` +
    `Eight-degree-of-freedom Mahalanobis distance ${dm}, led by ${driver}. ` +
    `Action: ${cmTitle}. Prescribed neuro-acoustic protocol: ${rxTitle}.`;

  setAcousticCaption(
    `[Flight Surgeon Voice · -10 dB Sidechain Ducking] "${spokenText}"`,
    true
  );

  if (!("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(spokenText);
    utt.rate = 1.01;
    utt.pitch = 0.98;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferred = voices.find(
      (v) => /en(-|_)(US|GB)/i.test(v.lang) && /Samantha|Daniel|Alex|Google|Natural/i.test(v.name)
    );
    if (preferred) utt.voice = preferred;

    setBriefingUi(true);
    utt.onend = () => setBriefingUi(false);
    utt.onerror = () => setBriefingUi(false);
    window.speechSynthesis.speak(utt);
  } catch {
    setBriefingUi(false);
  }
}

function toggleVoiceCommand() {
  const btn = document.getElementById("voiceCmdBtn");
  const lbl = document.getElementById("voiceCmdLabel");
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRec) {
    setAcousticCaption(
      "[Hands-Free Voice Command] Web SpeechRecognition API is unavailable in this browser engine; use Chrome/Edge or direct console controls.",
      true
    );
    return;
  }

  if (state.voiceCmdListening && state.speechRec) {
    state.voiceCmdListening = false;
    try {
      state.speechRec.stop();
    } catch {}
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (lbl) lbl.textContent = "Voice Command";
    return;
  }

  const rec = new SpeechRec();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  state.speechRec = rec;
  state.voiceCmdListening = true;
  if (btn) btn.setAttribute("aria-pressed", "true");
  if (lbl) lbl.textContent = "Listening...";
  setAcousticCaption(
    '[Hands-Free Voice Command] Say "start music", "stop music", "motor cadence", "alpha breathing", "gamma vigilance", "delta shelter", "flight briefing", or "log check-in".',
    true
  );

  rec.onresult = (event) => {
    const cmd = String(event.results?.[0]?.[0]?.transcript || "").toLowerCase().trim();
    let actionTaken = "Command logged";
    if (cmd.includes("start") || cmd.includes("engage") || cmd.includes("play")) {
      if (!state.neuroEngine.isPlaying) toggleNeuroPlay();
      actionTaken = "Engaged Neuro-Acoustic Engine";
    } else if (cmd.includes("stop") || cmd.includes("mute") || cmd.includes("quiet")) {
      if (state.neuroEngine.isPlaying) toggleNeuroPlay();
      actionTaken = "Paused Neuro-Acoustic Engine";
    } else if (cmd.includes("alpha") || cmd.includes("breath") || cmd.includes("hrv")) {
      selectNeuroProtocol("hrv_alpha", true);
      actionTaken = "Switched to 0.1Hz HRV Alpha Resonance";
    } else if (cmd.includes("gamma") || cmd.includes("vigilance") || cmd.includes("focus")) {
      selectNeuroProtocol("gamma_focus", true);
      actionTaken = "Switched to 40Hz Gamma Vigilance";
    } else if (cmd.includes("delta") || cmd.includes("shelter") || cmd.includes("sleep")) {
      selectNeuroProtocol("delta_sleep", true);
      actionTaken = "Switched to 2.5Hz Delta Storm-Shelter";
    } else if (cmd.includes("ras") || cmd.includes("motor") || cmd.includes("cadence")) {
      selectNeuroProtocol("ras_motor", true);
      actionTaken = "Switched to Motor Cadence 16Hz Beta RAS";
    } else if (cmd.includes("brief") || cmd.includes("surgeon") || cmd.includes("status")) {
      speakFlightSurgeonBriefing();
      actionTaken = "Triggered Flight Surgeon Voice Briefing";
    } else if (cmd.includes("log") || cmd.includes("save") || cmd.includes("commit")) {
      logCurrentSession();
      actionTaken = "Committed Sol Check-In Log";
    } else if (cmd.includes("api") || cmd.includes("watch") || cmd.includes("mobile")) {
      activateWorkspaceTab("tabEdgeApi", true);
      actionTaken = "Opened Connected Watch + Mobile API Tab";
    }
    setAcousticCaption(`[Voice Command Heard: "${cmd}"] -> ${actionTaken}.`, true);
  };

  rec.onerror = (e) => {
    setAcousticCaption(`[Voice Command] Recognition ended (${e.error || "no speech detected"}).`, true);
  };

  rec.onend = () => {
    state.voiceCmdListening = false;
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (lbl) lbl.textContent = "Voice Command";
  };

  try {
    rec.start();
  } catch {
    state.voiceCmdListening = false;
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (lbl) lbl.textContent = "Voice Command";
  }
}

async function toggleMicVocalAssay() {
  if (state.neuroEngine.voiceMode === "mic") {
    state.neuroEngine.stopVoiceAssay(true);
    syncAudioButtonsUi();
    setAcousticCaption(
      "[Live Mic Vocal DSP stopped] Last measured F0, glottal jitter, and HNR retained in telemetry.",
      true
    );
    scheduleEvaluation();
    return;
  }

  const res = await state.neuroEngine.startMicrophoneVoiceAssay();
  syncAudioButtonsUi();
  if (res.ok) {
    setAcousticCaption(
      "[Live Mic Vocal DSP active] 85 Hz cabin rumble HPF + 3.2 kHz (+4.5 dB) presence EQ + 4:1 compressor online. Sustain vowel /a/ for Boersma F0, Jitter, and HNR extraction.",
      true
    );
  } else {
    setAcousticCaption(
      `[Microphone unavailable: ${res.error}] Click "Formant Vocal Test" to run Klatt 3-formant synthetic vocal tract calibration.`,
      true
    );
  }
}

function runSyntheticVocalAssay() {
  if (state.neuroEngine.voiceMode === "synthetic") {
    state.neuroEngine.stopVoiceAssay(true);
    syncAudioButtonsUi();
    scheduleEvaluation();
    return;
  }

  const t = state.telemetry;
  const stress01 = Math.min(
    0.95,
    Math.max(
      0.08,
      (t.tremor_rms_mm - 0.35) * 0.22 +
        Math.max(0, t.cabin_co2_mmhg - 1.8) * 0.14 +
        Math.max(0, t.radiation_msv_day - 0.5) * 0.15
    )
  );
  const f0TargetHz = Math.round(132 + stress01 * 42);
  state.neuroEngine.startSyntheticVocalCalibration({
    f0TargetHz,
    stressLevel01: stress01,
    durationMs: 4600,
  });
  syncAudioButtonsUi();
  setAcousticCaption(
    `[Klatt 3-Formant Vocal Assay · 730/1090/2440 Hz] Synthesizing sustained /a/ vowel (target F0 ${f0TargetHz} Hz, stress coupling ${(stress01 * 100).toFixed(0)}%) through 85 Hz HPF, +4.5 dB @ 3.2 kHz Presence EQ & Boersma autocorrelation.`,
    true
  );

  setTimeout(() => {
    syncAudioButtonsUi();
    scheduleEvaluation();
  }, 1100);
  setTimeout(() => {
    syncAudioButtonsUi();
    scheduleEvaluation();
  }, 4750);
}

function renderAcousticSpectrumScope(nowMs) {
  const canvas = document.getElementById("acousticSpectrumCanvas");
  if (!canvas) return;
  const W = 640;
  const H = 232;
  const ctx = prepareHiDpiCanvas(canvas, W, H);

  const frame = state.neuroEngine.sampleTelemetryFrame();

  ctx.fillStyle = "#060b16";
  ctx.fillRect(0, 0, W, H);

  const spX = 36;
  const spY = 24;
  const spW = 376;
  const spH = 158;

  ctx.strokeStyle = "rgba(88, 166, 255, 0.11)";
  ctx.lineWidth = 1;
  for (let r = 0; r <= 4; r++) {
    const gy = spY + (r / 4) * spH;
    ctx.beginPath();
    ctx.moveTo(spX, gy);
    ctx.lineTo(spX + spW, gy);
    ctx.stroke();
  }

  const fMin = 55;
  const fMax = 8000;
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  const freqToX = (f) => spX + ((Math.log10(Math.max(fMin, Math.min(fMax, f))) - logMin) / (logMax - logMin)) * spW;

  const freqTicks = [100, 220, 500, 1000, 2000, 4000, 8000];
  ctx.fillStyle = "#64748b";
  ctx.font = '600 9.5px "JetBrains Mono", ui-monospace, monospace';
  freqTicks.forEach((ft) => {
    const tx = freqToX(ft);
    ctx.beginPath();
    ctx.moveTo(tx, spY);
    ctx.lineTo(tx, spY + spH);
    ctx.stroke();
    const lbl = ft >= 1000 ? `${ft / 1000}k` : `${ft}`;
    ctx.fillText(lbl, tx - 9, spY + spH + 13);
  });

  ctx.fillStyle = "#64748b";
  ctx.fillText("0dB", 6, spY + 8);
  ctx.fillText("-30", 6, spY + spH / 2 + 3);
  ctx.fillText("-60", 6, spY + spH);

  const numBands = 56;
  const sr = state.neuroEngine.ctx?.sampleRate || 48000;
  const binCount = frame.freqData.length || 512;
  const liveActive = frame.isPlaying || frame.voiceMode !== "idle";

  for (let b = 0; b < numBands; b++) {
    const f0 = fMin * Math.pow(fMax / fMin, b / numBands);
    const f1 = fMin * Math.pow(fMax / fMin, (b + 1) / numBands);
    const fCenter = Math.sqrt(f0 * f1);
    let mag01 = 0;

    if (liveActive) {
      const idx0 = Math.max(1, Math.floor((f0 / (sr / 2)) * binCount));
      const idx1 = Math.min(binCount - 1, Math.max(idx0, Math.ceil((f1 / (sr / 2)) * binCount)));
      let peak = 0;
      for (let k = idx0; k <= idx1; k++) {
        if (frame.freqData[k] > peak) peak = frame.freqData[k];
      }
      mag01 = peak / 255;
    } else {
      const fc = frame.filterCutoffHz;
      const ratio = fCenter / Math.max(80, fc);
      const lpfGain = 1 / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / 2.1, 2));
      const carrierBump =
        0.58 * Math.exp(-Math.pow((fCenter - frame.carrierLeftHz) / 26, 2)) +
        0.52 * Math.exp(-Math.pow((fCenter - frame.carrierRightHz) / 28, 2));
      const arpHarmonics =
        0.34 * Math.exp(-Math.pow((fCenter - 440) / 75, 2)) +
        0.28 * Math.exp(-Math.pow((fCenter - 880) / 150, 2)) +
        0.22 * Math.exp(-Math.pow((fCenter - 1320) / 230, 2)) +
        0.16 * Math.exp(-Math.pow((fCenter - 2200) / 420, 2));
      const pinkFloor = 0.14 * Math.pow(120 / fCenter, 0.28) * (0.7 + 0.3 * frame.breathPhase01);
      mag01 = Math.min(0.92, (carrierBump + (arpHarmonics + pinkFloor) * Math.min(1.4, lpfGain)) * 0.72);
    }

    const bx = spX + (b / numBands) * spW + 1;
    const bw = Math.max(2.5, spW / numBands - 2.2);
    const bh = Math.max(2, mag01 * (spH - 8));
    const by = spY + spH - bh;

    const pastCutoff = fCenter > frame.filterCutoffHz;
    ctx.fillStyle = liveActive
      ? pastCutoff
        ? "rgba(96, 165, 250, 0.42)"
        : "rgba(52, 211, 153, 0.82)"
      : pastCutoff
        ? "rgba(88, 166, 255, 0.16)"
        : "rgba(56, 189, 248, 0.34)";
    ctx.fillRect(bx, by, bw, bh);
  }

  const xCarrierL = freqToX(frame.carrierLeftHz);
  const xCarrierR = freqToX(frame.carrierRightHz);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(xCarrierL, spY + 4);
  ctx.lineTo(xCarrierL, spY + spH);
  ctx.moveTo(xCarrierR, spY + 4);
  ctx.lineTo(xCarrierR, spY + spH);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#e9d5ff";
  ctx.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(`Δf ${frame.binauralBeatHz.toFixed(1)}Hz`, Math.min(spX + spW - 68, xCarrierR + 7), spY + 13);

  const fc = frame.filterCutoffHz;
  const Q = 2.1;
  ctx.beginPath();
  for (let px = 0; px <= spW; px += 3) {
    const f = fMin * Math.pow(fMax / fMin, px / spW);
    const wRatio = f / Math.max(80, fc);
    const hMag = 1 / Math.sqrt(Math.pow(1 - wRatio * wRatio, 2) + Math.pow(wRatio / Q, 2));
    const db = Math.max(-36, Math.min(9, 20 * Math.log10(Math.max(1e-3, hMag))));
    const normY = (9 - db) / 45;
    const cy = spY + 8 + Math.max(0, Math.min(1, normY)) * (spH - 14);
    if (px === 0) ctx.moveTo(spX + px, cy);
    else ctx.lineTo(spX + px, cy);
  }
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const xFc = freqToX(fc);
  const resDb = Math.max(-36, Math.min(9, 20 * Math.log10(Q)));
  const yFc = spY + 8 + ((9 - resDb) / 45) * (spH - 14);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(xFc, yFc, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(`f_c ${fc}Hz`, Math.min(spX + spW - 70, xFc + 10), Math.max(spY + 13, yFc + 2));

  ctx.fillStyle = "#cbd5e1";
  ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(
    frame.duckingActive
      ? "SPECTRUM + 3D ROM FILTER |H(f)| · [-10dB VOICE SIDECHAIN DUCK]"
      : "64-BAND LOG-FFT + 3D JOINT-ROM FILTER |H(f)|",
    spX,
    15
  );

  const barY = H - 22;
  const barH = 9;
  ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
  ctx.fillRect(spX, barY, spW, barH);
  const breathGrad = ctx.createLinearGradient(spX, 0, spX + spW, 0);
  breathGrad.addColorStop(0, "#38bdf8");
  breathGrad.addColorStop(1, "#34d399");
  ctx.fillStyle = breathGrad;
  ctx.fillRect(spX, barY, Math.max(4, frame.breathPhase01 * spW), barH);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.strokeRect(spX, barY, spW, barH);

  const vsCx = 532;
  const vsCy = 102;
  const vsR = 68;

  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("STEREO LISSAJOUS PHASE", 458, 15);

  ctx.strokeStyle = "rgba(88, 166, 255, 0.22)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(vsCx, vsCy, vsR, 0, Math.PI * 2);
  ctx.arc(vsCx, vsCy, vsR * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(vsCx - vsR, vsCy);
  ctx.lineTo(vsCx + vsR, vsCy);
  ctx.moveTo(vsCx, vsCy - vsR);
  ctx.lineTo(vsCx, vsCy + vsR);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = '600 9px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText("M", vsCx - 3, vsCy - vsR - 4);
  ctx.fillText("L", vsCx - vsR - 10, vsCy + 3);
  ctx.fillText("R", vsCx + vsR + 4, vsCy + 3);

  ctx.beginPath();
  if (liveActive) {
    const L = frame.leftTimeData;
    const R = frame.rightTimeData;
    const len = Math.min(L.length, R.length, 256);
    for (let i = 0; i < len; i++) {
      const lVal = Math.max(-1, Math.min(1, L[i] * 2.8));
      const rVal = Math.max(-1, Math.min(1, R[i] * 2.8));
      const side = (rVal - lVal) * 0.707;
      const mid = (lVal + rVal) * 0.707;
      const px = vsCx + side * (vsR - 6);
      const py = vsCy - mid * (vsR - 6);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1.6;
  } else {
    const tSec = prefersReducedMotion() ? 1.0 : nowMs / 1000;
    const pan = frame.stereoPan;
    const gL = Math.sqrt(Math.max(0.1, 0.5 * (1 - pan)));
    const gR = Math.sqrt(Math.max(0.1, 0.5 * (1 + pan)));
    const phaseDelta = 2 * Math.PI * (frame.binauralBeatHz * 0.08) * tSec;
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * Math.PI * 2;
      const lVal = Math.sin(th) * gL;
      const rVal = Math.sin(th + phaseDelta) * gR;
      const side = (rVal - lVal) * 0.68;
      const mid = (lVal + rVal) * 0.68;
      const px = vsCx + side * (vsR - 10);
      const py = vsCy - mid * (vsR - 10);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(56, 189, 248, 0.68)";
    ctx.lineWidth = 1.6;
  }
  ctx.stroke();

  const panBarX = 454;
  const panBarW = 156;
  const panBarY = H - 22;
  ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
  ctx.fillRect(panBarX, panBarY, panBarW, barH);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.strokeRect(panBarX, panBarY, panBarW, barH);
  const centerPanX = panBarX + panBarW / 2;
  const panPx = centerPanX + frame.stereoPan * (panBarW / 2 - 4);
  ctx.fillStyle = Math.abs(frame.stereoPan) > 0.35 ? "#fbbf24" : "#34d399";
  ctx.fillRect(Math.min(centerPanX, panPx), panBarY + 1, Math.max(3, Math.abs(panPx - centerPanX)), barH - 2);

  if (nowMs - state.lastAcousticDomUpdateMs > 95) {
    state.lastAcousticDomUpdateMs = nowMs;

    const acCarrier = document.getElementById("acCarrierVal");
    if (acCarrier) {
      acCarrier.innerHTML = `${frame.carrierLeftHz.toFixed(1)} / ${frame.carrierRightHz.toFixed(1)} <small>Hz</small>`;
    }
    const acCutoff = document.getElementById("acCutoffVal");
    if (acCutoff) {
      acCutoff.innerHTML = `${frame.filterCutoffHz.toLocaleString("en-US")} <small>Hz</small>`;
    }
    const acPan = document.getElementById("acPanVal");
    if (acPan) {
      const dir = frame.stereoPan > 0.04 ? "R" : frame.stereoPan < -0.04 ? "L" : "C";
      const sign = frame.stereoPan > 0 ? "+" : "";
      acPan.innerHTML = `${sign}${frame.stereoPan.toFixed(2)} <small>${dir}</small>`;
    }
    const acBreath = document.getElementById("acBreathVal");
    if (acBreath) {
      const cycleSec = (nowMs % 10000) / 1000;
      const inhaling = cycleSec < 4.0;
      const rem = inhaling ? (4.0 - cycleSec).toFixed(1) : (10.0 - cycleSec).toFixed(1);
      acBreath.innerHTML = `${inhaling ? "INHALE" : "EXHALE"} <small>${rem}s</small>`;
    }

    const scopeTag = document.getElementById("acousticScopeStatusTag");
    if (scopeTag) {
      if (frame.duckingActive) {
        scopeTag.textContent = "VOICE OVERRIDE · -10dB SIDECHAIN";
      } else if (frame.isPlaying) {
        scopeTag.textContent = `LIVE DSP · ${frame.protocol.name.toUpperCase()}`;
      } else if (frame.voiceMode !== "idle") {
        scopeTag.textContent = `VOCAL ASSAY (${frame.voiceMode.toUpperCase()})`;
      } else {
        scopeTag.textContent = "PRE-ARMED · 3D ROM COUPLED";
      }
    }

    const vm = frame.vocalMetrics;
    if (vm && vm.f0Hz > 0) {
      const f0El = document.getElementById("vocalF0Val");
      const jitEl = document.getElementById("vocalJitterVal");
      const hnrEl = document.getElementById("vocalHnrVal");
      const strEl = document.getElementById("vocalStressVal");
      if (f0El) f0El.innerHTML = `${vm.f0Hz.toFixed(1)} <small>Hz</small>`;
      if (jitEl) jitEl.innerHTML = `${vm.jitterPct.toFixed(2)} <small>%</small>`;
      if (hnrEl) hnrEl.innerHTML = `${vm.hnrDb.toFixed(1)} <small>dB</small>`;
      if (strEl) {
        const tier = vm.stressIndex >= 52 ? "ELEVATED" : vm.stressIndex >= 30 ? "MODERATE" : "NOMINAL";
        strEl.innerHTML = `${vm.stressIndex}<small>/100 ${tier}</small>`;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 10B. 3-Tab WAI-ARIA Workspace Switcher (with View Transitions) +
//      Connected Apple Watch, Mobile Kinematics App & Live REST API Workbench
// ----------------------------------------------------------------------------
function activateWorkspaceTab(tabId, moveFocus = false, useTransition = true) {
  const applyDomSwitch = () => {
    const tabs = Array.from(document.querySelectorAll('.workspace-tablist [role="tab"]'));
    tabs.forEach((tab) => {
      const isTarget = tab.id === tabId;
      tab.setAttribute("aria-selected", String(isTarget));
      if (isTarget) {
        tab.removeAttribute("tabindex");
      } else {
        tab.setAttribute("tabindex", "-1");
      }
      const panelId = tab.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) {
        panel.hidden = !isTarget;
        if (isTarget) state.activeWorkspaceTab = panelId;
      }
      if (isTarget && moveFocus) {
        tab.focus();
      }
    });

    if (state.activeWorkspaceTab === "panelMissionConsole") {
      renderCovarianceRadar();
      if (state.osdrEmpirical) renderOsdrCohortChart();
    } else if (state.activeWorkspaceTab === "panelNeuroLab") {
      renderAcousticSpectrumScope(performance.now());
    }
  };

  if (useTransition && document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(applyDomSwitch);
  } else {
    applyDomSwitch();
  }
}

function initWorkspaceTabs() {
  const tablist = document.querySelector(".workspace-tablist");
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateWorkspaceTab(tab.id, false, true));
  });

  // WAI-ARIA Authoring Practices keyboard navigation: ArrowRight, ArrowLeft, Home, End
  tablist.addEventListener("keydown", (e) => {
    const currentIdx = tabs.indexOf(document.activeElement);
    if (currentIdx === -1) return;
    let nextIdx = -1;
    if (e.key === "ArrowRight") {
      nextIdx = (currentIdx + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = tabs.length - 1;
    }
    if (nextIdx !== -1) {
      e.preventDefault();
      activateWorkspaceTab(tabs[nextIdx].id, true, true);
    }
  });

  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (requestedTab === "neuro" || requestedTab === "audio" || requestedTab === "voice") {
    activateWorkspaceTab("tabNeuroLab", false, false);
  } else if (requestedTab === "api" || requestedTab === "edge" || requestedTab === "watch") {
    activateWorkspaceTab("tabEdgeApi", false, false);
  }
}

function syncConnectedMeshReadouts(res) {
  const t = state.telemetry;
  const watchTxt = document.getElementById("meshWatchText");
  if (watchTxt) {
    watchTxt.textContent = `${Math.round(t.heart_rate_bpm)} bpm · HRV ${Math.round(t.hrv_rmssd_ms)} ms`;
  }
  const mobTxt = document.getElementById("meshMobileText");
  if (mobTxt) {
    mobTxt.textContent = `ROM ${t.joint_rom_deg.toFixed(0)}° · Sym ${t.bilateral_symmetry_pct.toFixed(1)}%`;
  }

  const score = res ? Number(res.readiness_score).toFixed(1) : "44.7";
  const ringEl = document.getElementById("watchRingScoreVal");
  if (ringEl) ringEl.textContent = score;

  const wLine1 = document.getElementById("watchLiveMetricsLine1");
  if (wLine1) wLine1.textContent = `HR: ${Math.round(t.heart_rate_bpm)} bpm · HRV: ${Math.round(t.hrv_rmssd_ms)} ms`;
  const wLine2 = document.getElementById("watchLiveMetricsLine2");
  if (wLine2) wLine2.textContent = `SpO2: ${t.spo2_pct.toFixed(1)}% · Tremor: ${t.tremor_rms_mm.toFixed(2)} mm`;

  const wHap = document.getElementById("watchHapticReadout");
  if (wHap && res) {
    const hap =
      res.overall_status === "alert"
        ? "WKHapticType.failure"
        : res.overall_status === "watch"
          ? "WKHapticType.retry"
          : "WKHapticType.success";
    wHap.textContent = `HAPTIC: ${hap}`;
  }

  const mobNode = document.getElementById("mobileNodeReadout");
  if (mobNode) {
    mobNode.innerHTML = `
      <div><span>Protocol</span> <strong>${escapeHtml(state.protocol)}</strong></div>
      <div><span>3D Joint ROM</span> <strong>${t.joint_rom_deg.toFixed(1)}° / ${t.target_rom_deg.toFixed(0)}°</strong></div>
      <div><span>L/R Symmetry</span> <strong>${t.bilateral_symmetry_pct.toFixed(1)}%</strong></div>
      <div><span>3D Trunk Lean</span> <strong>${t.trunk_lean_deg.toFixed(1)}° · ${Math.round(t.cadence_rpm)} RPM</strong></div>
    `;
  }

  const eclssNode = document.getElementById("eclssNodeReadout");
  if (eclssNode) {
    eclssNode.innerHTML = `
      <div><span>Cabin ppCO2</span> <strong>${t.cabin_co2_mmhg.toFixed(2)} mmHg</strong></div>
      <div><span>Radiation</span> <strong>${t.radiation_msv_day.toFixed(2)} mSv/day</strong></div>
      <div><span>Comm Link</span> <strong>${escapeHtml(state.commMode)}</strong></div>
      <div><span>NASA Limit</span> <strong>&lt;2.0 mmHg CO2</strong></div>
    `;
  }

  if (res) {
    const hubBadge = document.getElementById("hubSeverityBadge");
    if (hubBadge) {
      if (res.overall_status === "nominal") {
        hubBadge.className = "badge badge-nominal";
        hubBadge.innerHTML = `<span aria-hidden="true">✓</span> Nominal Hub`;
      } else if (res.overall_status === "watch") {
        hubBadge.className = "badge badge-watch";
        hubBadge.innerHTML = `<span aria-hidden="true">▲</span> Watch Hub`;
      } else {
        hubBadge.className = "badge badge-alert";
        hubBadge.innerHTML = `<span aria-hidden="true">◆</span> Alert Hub`;
      }
    }
    const dm = res.multivariate_stats?.mahalanobis_d ?? 0;
    const pv = res.multivariate_stats?.p_value ?? 1;
    const pTxt = pv < 0.0001 ? "<0.0001" : pv.toFixed(4);
    const hubDm = document.getElementById("hubMahalanobisVal");
    if (hubDm) hubDm.textContent = `${dm.toFixed(2)} (${pTxt})`;

    const hubDrv = document.getElementById("hubDriverVal");
    if (hubDrv) hubDrv.textContent = res.multivariate_stats?.top_attributions?.[0]?.feature || "Nominal";

    const hubRx = document.getElementById("hubAudioRxVal");
    if (hubRx && res.neuro_prescription) {
      hubRx.textContent = `${res.neuro_prescription.binaural_beat_hz} Hz · ${res.neuro_prescription.target_tempo_bpm} BPM`;
    }
  }
}

function buildApiPresetPayload(presetId) {
  const t = state.telemetry;
  const base = {
    crew_member: state.crewMember,
    mission_sol: state.missionSol,
    comm_mode: state.commMode,
    protocol: state.protocol,
  };

  if (presetId === "mobile_kinematics") {
    return {
      source_device: "mobile_kinematics_app",
      device_model: "iPhone 16 Pro · Mobile 3D Pose & Kinematics App (60 FPS)",
      ...base,
      battery_pct: 91,
      sample_rate_hz: 60.0,
      joint_rom_deg: Number(t.joint_rom_deg.toFixed(1)),
      target_rom_deg: Number(t.target_rom_deg.toFixed(0)),
      bilateral_symmetry_pct: Number(t.bilateral_symmetry_pct.toFixed(1)),
      trunk_lean_deg: Number(t.trunk_lean_deg.toFixed(1)),
      postural_sway_mms: Number(t.postural_sway_mms.toFixed(1)),
      cadence_rpm: Number(t.cadence_rpm.toFixed(1)),
      pvt_reaction_ms: Math.round(t.pvt_reaction_ms),
    };
  }
  if (presetId === "combined_bridge") {
    return {
      source_device: "combined_ios_watch_bridge",
      device_model: "WatchConnectivity Bridge (Apple Watch Ultra 2 + iOS Kinematics App)",
      ...base,
      battery_pct: 86,
      sample_rate_hz: 100.0,
      heart_rate_bpm: Math.round(t.heart_rate_bpm),
      hrv_rmssd_ms: Math.round(t.hrv_rmssd_ms),
      spo2_pct: Number(t.spo2_pct.toFixed(1)),
      tremor_rms_mm: Number(t.tremor_rms_mm.toFixed(2)),
      joint_rom_deg: Number(t.joint_rom_deg.toFixed(1)),
      target_rom_deg: Number(t.target_rom_deg.toFixed(0)),
      bilateral_symmetry_pct: Number(t.bilateral_symmetry_pct.toFixed(1)),
      trunk_lean_deg: Number(t.trunk_lean_deg.toFixed(1)),
    };
  }
  if (presetId === "spe_watch_alert") {
    return {
      source_device: "habitat_eclss_bus",
      device_model: "Habitat CDRA CO2 + TEPC Dosimeter + Watch Storm Alert",
      crew_member: state.crewMember,
      mission_sol: state.missionSol,
      comm_mode: "solar_blackout",
      protocol: "fine_motor_hand",
      battery_pct: 99,
      sample_rate_hz: 10.0,
      cabin_co2_mmhg: 3.15,
      radiation_msv_day: 3.45,
      heart_rate_bpm: 89,
      hrv_rmssd_ms: 28,
      tremor_rms_mm: 2.38,
    };
  }
  return {
    source_device: "apple_watch_ultra_healthkit",
    device_model: "Apple Watch Ultra 2 (watchOS 11 · HealthKit + 100 Hz CMMotionManager)",
    ...base,
    battery_pct: 88,
    sample_rate_hz: 100.0,
    heart_rate_bpm: Math.round(t.heart_rate_bpm),
    hrv_rmssd_ms: Math.round(t.hrv_rmssd_ms),
    spo2_pct: Number(t.spo2_pct.toFixed(1)),
    resp_rate_brpm: Number(t.resp_rate_brpm.toFixed(1)),
    sleep_hours: Number(t.sleep_hours.toFixed(1)),
    tremor_rms_mm: Number(t.tremor_rms_mm.toFixed(2)),
    hand_tap_hz: Number(t.hand_tap_hz.toFixed(1)),
  };
}

function applyApiPreset(presetId) {
  state.activeApiPreset = presetId;
  document.querySelectorAll('input[name="apiPresetRadio"]').forEach((r) => {
    r.checked = r.value === presetId;
  });
  const editor = document.getElementById("apiRequestEditor");
  if (editor) {
    editor.value = JSON.stringify(buildApiPresetPayload(presetId), null, 2);
  }
}

function renderEdgePacketTable(packets) {
  const tbody = document.getElementById("edgePacketTableBody");
  if (!tbody || !Array.isArray(packets) || packets.length === 0) return;

  const shortSource = {
    apple_watch_ultra_healthkit: "Apple Watch Ultra 2",
    mobile_kinematics_app: "Mobile Kinematics App",
    combined_ios_watch_bridge: "Watch + iOS Bridge",
    habitat_eclss_bus: "Habitat ECLSS Bus",
  };

  tbody.innerHTML = packets
    .slice(0, 8)
    .map(
      (p) => `
      <tr>
        <th scope="row" class="mono">${escapeHtml(p.packet_id)}</th>
        <td>${escapeHtml(shortSource[p.source_device] || p.source_device)}</td>
        <td class="mono">${p.updated_channels.length} ch (${escapeHtml(p.updated_channels.slice(0, 2).join(", "))})</td>
        <td class="mono">D<sub>M</sub>=${Number(p.mahalanobis_d).toFixed(2)} (${Number(p.readiness_score).toFixed(1)})</td>
        <td class="mono">${escapeHtml(p.watch_and_mobile_directive?.wkhaptic_type || "WKHapticType.success")}</td>
      </tr>
    `
    )
    .join("");
}

async function executeEdgeIngestPost(customPayloadObj = null) {
  const editor = document.getElementById("apiRequestEditor");
  const badge = document.getElementById("apiResponseBadge");
  const respPre = document.getElementById("apiResponsePre");
  const rttEl = document.getElementById("apiLatencyVal");

  let payloadObj = customPayloadObj;
  if (!payloadObj) {
    try {
      payloadObj = JSON.parse(editor ? editor.value : "{}");
    } catch (err) {
      if (badge) {
        badge.className = "status-pill status-alert mono";
        badge.textContent = "JSON Syntax Error";
      }
      if (respPre) respPre.textContent = `Invalid JSON in request editor:\n${err.message}`;
      return;
    }
  } else if (editor) {
    editor.value = JSON.stringify(payloadObj, null, 2);
  }

  const t0 = performance.now();
  try {
    const resp = await fetch("/api/ingest/edge-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadObj),
    });
    const rttMs = Math.round(performance.now() - t0);
    const data = await resp.json();

    if (rttEl) rttEl.textContent = `RTT: ${rttMs} ms`;
    if (badge) {
      badge.className = resp.ok ? "status-pill status-nominal mono" : "status-pill status-alert mono";
      badge.textContent = `HTTP ${resp.status} ${resp.ok ? "Fused" : "Error"}`;
    }

    if (!resp.ok) {
      if (respPre) respPre.textContent = JSON.stringify(data, null, 2);
      return;
    }

    const compactResponse = {
      ingested: data.ingested,
      packet_record: data.packet_record,
      multivariate_stats: data.evaluation?.multivariate_stats,
      neuro_prescription: data.evaluation?.neuro_prescription,
    };
    if (respPre) respPre.textContent = JSON.stringify(compactResponse, null, 2);

    if (data.fused_telemetry_state) {
      state.telemetry = { ...state.telemetry, ...data.fused_telemetry_state };
    }
    if (payloadObj.comm_mode) {
      state.commMode = payloadObj.comm_mode;
      const commSel = document.getElementById("commModeSelect");
      if (commSel) commSel.value = state.commMode;
    }
    if (payloadObj.protocol) {
      state.protocol = payloadObj.protocol;
      document.querySelectorAll('input[name="protocolRadio"]').forEach((r) => {
        r.checked = r.value === state.protocol;
      });
    }

    state.ingestedPacketsCount += 1;
    const pktCountEl = document.getElementById("fusedPacketCountVal");
    if (pktCountEl) pktCountEl.textContent = `${state.ingestedPacketsCount} packets`;
    const tabBadge = document.getElementById("edgeTabPacketBadge");
    if (tabBadge) tabBadge.textContent = `${state.ingestedPacketsCount}`;

    syncSlidersFromTelemetry();
    syncKinematicStripFromTelemetry();
    if (data.evaluation) {
      state.latestEvaluation = data.evaluation;
      renderEvaluation(data.evaluation);
    }

    const recentResp = await fetch("/api/ingest/recent");
    if (recentResp.ok) {
      const recentData = await recentResp.json();
      renderEdgePacketTable(recentData.packets);
    }
  } catch {
    if (badge) {
      badge.className = "status-pill status-watch mono";
      badge.textContent = "Offline Edge Sim";
    }
    if (respPre) {
      respPre.textContent = JSON.stringify(
        {
          ingested_locally: true,
          note: "PWA offline edge fallback fused incoming wearable/mobile telemetry locally.",
          payload: payloadObj,
        },
        null,
        2
      );
    }
  }
}

function pushSingleSimulatedEdgeBurst(mode = "bridge") {
  const t = state.telemetry;
  const jitter = (amp) => (Math.random() - 0.5) * 2 * amp;
  if (mode === "watch") {
    executeEdgeIngestPost({
      ...buildApiPresetPayload("watch_vitals"),
      heart_rate_bpm: Math.round(Math.max(50, Math.min(135, t.heart_rate_bpm + jitter(2.2)))),
      hrv_rmssd_ms: Math.round(Math.max(18, Math.min(90, t.hrv_rmssd_ms + jitter(2.5)))),
      tremor_rms_mm: Number(Math.max(0.15, t.tremor_rms_mm + jitter(0.08)).toFixed(2)),
    });
  } else if (mode === "mobile") {
    executeEdgeIngestPost({
      ...buildApiPresetPayload("mobile_kinematics"),
      joint_rom_deg: Number(Math.max(45, Math.min(175, state.liveKinFrame.romDeg || t.joint_rom_deg)).toFixed(1)),
      bilateral_symmetry_pct: Number(Math.max(55, Math.min(100, t.bilateral_symmetry_pct + jitter(1.1))).toFixed(1)),
      trunk_lean_deg: Number(Math.max(0.5, Math.min(32, t.trunk_lean_deg + jitter(0.6))).toFixed(1)),
    });
  } else if (mode === "eclss") {
    executeEdgeIngestPost({
      source_device: "habitat_eclss_bus",
      device_model: "Spacecraft CDRA CO2 Scrubber + TEPC Dosimeter",
      crew_member: state.crewMember,
      mission_sol: state.missionSol,
      comm_mode: state.commMode,
      protocol: state.protocol,
      battery_pct: 100,
      sample_rate_hz: 2.0,
      cabin_co2_mmhg: Number(Math.max(0.6, t.cabin_co2_mmhg + jitter(0.08)).toFixed(2)),
      radiation_msv_day: Number(Math.max(0.2, t.radiation_msv_day + jitter(0.04)).toFixed(2)),
    });
  } else {
    executeEdgeIngestPost({
      ...buildApiPresetPayload("combined_bridge"),
      heart_rate_bpm: Math.round(Math.max(50, Math.min(135, t.heart_rate_bpm + jitter(2.0)))),
      hrv_rmssd_ms: Math.round(Math.max(18, Math.min(90, t.hrv_rmssd_ms + jitter(2.0)))),
      joint_rom_deg: Number(Math.max(45, Math.min(175, t.joint_rom_deg + jitter(2.5))).toFixed(1)),
      bilateral_symmetry_pct: Number(Math.max(55, Math.min(100, t.bilateral_symmetry_pct + jitter(1.2))).toFixed(1)),
    });
  }
}

function toggleLiveEdgeStream() {
  const btn = document.getElementById("toggleEdgeStreamBtn");
  const lbl = document.getElementById("edgeStreamBtnLabel");
  if (state.edgeStreamTimer) {
    clearInterval(state.edgeStreamTimer);
    state.edgeStreamTimer = null;
    if (btn) btn.setAttribute("aria-pressed", "false");
    if (lbl) lbl.textContent = "Start 1 Hz Live Stream";
    return;
  }

  if (btn) btn.setAttribute("aria-pressed", "true");
  if (lbl) lbl.textContent = "Stop 1 Hz Live Stream";

  const modes = ["watch", "mobile", "eclss"];
  pushSingleSimulatedEdgeBurst("watch");
  state.edgeStreamTimer = setInterval(() => {
    state.edgeStreamTick = (state.edgeStreamTick + 1) % modes.length;
    pushSingleSimulatedEdgeBurst(modes[state.edgeStreamTick]);
  }, 1350);
}

function renderSdkCodeSnippet(lang) {
  state.activeSdkLang = lang;
  document.querySelectorAll('input[name="sdkLangRadio"]').forEach((r) => {
    r.checked = r.value === lang;
  });
  const pre = document.getElementById("sdkCodePre");
  if (!pre) return;

  const baseUrl =
    window.location.origin && window.location.origin.startsWith("http")
      ? window.location.origin
      : "https://astrokinetics-space-health-765428358644.us-central1.run.app";
  const endpoint = `${baseUrl}/api/ingest/edge-telemetry`;

  if (lang === "curl") {
    pre.textContent = `# Stream Apple Watch HealthKit + Mobile 3D Kinematics into AstroKinetics v3.2
curl -sS -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_device": "combined_ios_watch_bridge",
    "device_model": "Apple Watch Ultra 2 + iOS 3D Kinematics App",
    "crew_member": "FE-2 Jordan Vance (OSDR C003 Baseline)",
    "mission_sol": 142,
    "comm_mode": "mars_transit",
    "protocol": "ared_squat",
    "heart_rate_bpm": 74,
    "hrv_rmssd_ms": 46,
    "spo2_pct": 98.1,
    "tremor_rms_mm": 0.62,
    "joint_rom_deg": 96.5,
    "target_rom_deg": 118.0,
    "bilateral_symmetry_pct": 83.2,
    "trunk_lean_deg": 13.4
  }'`;
    return;
  }

  if (lang === "python") {
    pre.textContent = `# Python Bridge for Your Existing Mobile Kinematics / Wearable Pipeline
import httpx

ENDPOINT = "${endpoint}"

def push_kinematics_and_watch_frame(rom_deg: float, sym_pct: float, lean_deg: float, hr_bpm: float, hrv_ms: float):
    payload = {
        "source_device": "combined_ios_watch_bridge",
        "device_model": "Custom Kinematics App + Apple Watch HealthKit",
        "crew_member": "FE-2 Jordan Vance (OSDR C003 Baseline)",
        "mission_sol": 142,
        "protocol": "ared_squat",
        "joint_rom_deg": rom_deg,
        "target_rom_deg": 118.0,
        "bilateral_symmetry_pct": sym_pct,
        "trunk_lean_deg": lean_deg,
        "heart_rate_bpm": hr_bpm,
        "hrv_rmssd_ms": hrv_ms,
    }
    r = httpx.post(ENDPOINT, json=payload, timeout=5.0)
    res = r.json()
    directive = res["packet_record"]["watch_and_mobile_directive"]
    print(f"Fused D_M={res['packet_record']['mahalanobis_d']:.2f} -> {directive['mobile_app_cue']}")
    return res`;
    return;
  }

  pre.textContent = `// Swift (iOS / watchOS 11): Stream Apple Watch HealthKit + Mobile Kinematics App
import Foundation
import WatchKit

struct AstroEdgePacket: Codable {
    let source_device: String
    let device_model: String
    let crew_member: String
    let mission_sol: Int
    let protocol_name: String
    let heart_rate_bpm: Double?
    let hrv_rmssd_ms: Double?
    let tremor_rms_mm: Double?
    let joint_rom_deg: Double?
    let bilateral_symmetry_pct: Double?
    let trunk_lean_deg: Double?

    enum CodingKeys: String, CodingKey {
        case source_device, device_model, crew_member, mission_sol
        case protocol_name = "protocol"
        case heart_rate_bpm, hrv_rmssd_ms, tremor_rms_mm
        case joint_rom_deg, bilateral_symmetry_pct, trunk_lean_deg
    }
}

func streamToAstroKineticsHub(packet: AstroEdgePacket) async throws {
    let url = URL(string: "${endpoint}")!
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(packet)

    let (data, _) = try await URLSession.shared.data(for: req)
    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
       let rec = json["packet_record"] as? [String: Any],
       let dir = rec["watch_and_mobile_directive"] as? [String: Any],
       let haptic = dir["wkhaptic_type"] as? String {
        // Closed-loop wrist haptic cue straight from 8-DOF Mahalanobis triage!
        if haptic.contains("failure") { WKInterfaceDevice.current().play(.failure) }
        else if haptic.contains("retry") { WKInterfaceDevice.current().play(.retry) }
        else { WKInterfaceDevice.current().play(.success) }
    }
}`;
}

function handlePvtClick() {
  const pad = document.getElementById("pvtPadBtn");
  const label = document.getElementById("pvtPadLabel");
  const status = document.getElementById("pvtStatusText");

  const armTrial = () => {
    state.pvtState = "waiting";
    pad.dataset.state = "waiting";
    label.textContent = `Hold Steady · Trial ${state.pvtTrials.length + 1} / 3`;
    status.textContent = "Wait for the emerald trigger signal before tapping.";
    const delayMs = 1300 + Math.random() * 1900;
    state.pvtTimer = setTimeout(() => {
      state.pvtState = "go";
      state.pvtGoTimestamp = performance.now();
      pad.dataset.state = "go";
      label.textContent = "TAP NOW!";
    }, delayMs);
  };

  if (state.pvtState === "idle") {
    state.pvtTrials = [];
    armTrial();
  } else if (state.pvtState === "waiting") {
    clearTimeout(state.pvtTimer);
    status.textContent = "Premature tap detected — re-arming trial...";
    armTrial();
  } else if (state.pvtState === "go") {
    const rt = Math.round(performance.now() - state.pvtGoTimestamp);
    state.pvtTrials.push(rt);
    if (state.pvtTrials.length < 3) {
      status.textContent = `Trial ${state.pvtTrials.length} latency: ${rt} ms.`;
      armTrial();
    } else {
      const meanRt = Math.round(state.pvtTrials.reduce((a, b) => a + b, 0) / state.pvtTrials.length);
      state.pvtState = "idle";
      delete pad.dataset.state;
      label.textContent = `Mean PVT: ${meanRt} ms (Tap to Retest)`;
      status.textContent = `Trials [${state.pvtTrials.join(", ")} ms] committed to 8-DOF Mahalanobis vector.`;
      state.telemetry.pvt_reaction_ms = meanRt;
      scheduleEvaluation();
    }
  }
}

// ----------------------------------------------------------------------------
// 11. Live NASA OSDR API Verification & Persistent Sol History
// ----------------------------------------------------------------------------
async function verifyLiveNasaOsdr() {
  const box = document.getElementById("osdrApiResult");
  box.hidden = false;
  box.textContent = "Querying NASA Open Science Data Repository (OSD-571 Inspiration4 metadata)...";
  const blackout = state.commMode === "solar_blackout";
  try {
    const resp = await fetch(`/api/nasa-osdr?study_id=571&simulate_blackout=${blackout}`);
    const data = await resp.json();
    box.innerHTML = `<strong>${escapeHtml(data.mode)}</strong> · <code>${escapeHtml(data.study_id)}</code>: ${escapeHtml(data.live_title || data.metadata?.title || "")}`;
  } catch {
    box.innerHTML = `<strong>PWA_OFFLINE_CACHE</strong> · <code>OSD-571 (GLDS-563)</code>: 14 Inspiration4 astronaut proteins available offline.`;
  }
}

async function logCurrentSession() {
  const btn = document.getElementById("logSessionBtn");
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Saving Sol Log...";
  try {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    await refreshSessionsList();
  } catch {
    const box = document.getElementById("sessionHistoryBox");
    box.innerHTML = `<p class="muted-sub empty-pad">Committed to local PWA session buffer (Sol ${state.missionSol}).</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = prevHtml;
  }
}

async function refreshSessionsList() {
  try {
    const resp = await fetch("/api/sessions?limit=8");
    if (!resp.ok) return;
    const data = await resp.json();
    const box = document.getElementById("sessionHistoryBox");
    if (!data.sessions || data.sessions.length === 0) return;

    box.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Sol</th>
            <th scope="col">Severity</th>
            <th scope="col">Readiness</th>
            <th scope="col">D<sub>M</sub> (&chi;&sup2; p)</th>
            <th scope="col">Provenance</th>
          </tr>
        </thead>
        <tbody>
          ${data.sessions
            .map(
              (s) => `
              <tr>
                <th scope="row">Sol ${String(s.mission_sol).padStart(3, "0")}</th>
                <td>${statusBadgeMarkup(s.overall_status)}</td>
                <td class="mono"><strong>${Number(s.readiness_score).toFixed(1)}</strong>/100</td>
                <td class="mono">D<sub>M</sub>=${Number(s.mahalanobis_d).toFixed(2)} (p=${Number(s.p_value).toFixed(3)})</td>
                <td><code>${escapeHtml(s.vision_source)}</code></td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch {}
}

// ----------------------------------------------------------------------------
// 12. Bootstrap & Event Listeners
// ----------------------------------------------------------------------------
async function bootstrap() {
  registerOfflineServiceWorker();
  updateMissionHeaderClock();
  installDialogLightDismissFallback();
  initColorSchemeControls();
  initWorkspaceTabs();
  init3DCameraToolbar();

  const [scenRes, osdrRes, kinSampleRes] = await Promise.allSettled([
    fetch("/api/scenarios").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/osdr-empirical").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/kinematic-sample").then((r) => (r.ok ? r.json() : null)),
  ]);

  if (scenRes.status === "fulfilled" && scenRes.value?.scenarios) {
    scenRes.value.scenarios.forEach((s) => {
      state.scenarios[s.id] = s;
    });
  }
  if (osdrRes.status === "fulfilled" && osdrRes.value?.biomarkers) {
    state.osdrEmpirical = osdrRes.value;
    renderOsdrCohortChart();
    renderOsdrCohortTable();
  }
  if (kinSampleRes.status === "fulfilled" && kinSampleRes.value?.frames) {
    state.referenceSample = kinSampleRes.value;
  }

  // Scenario choice cards — switch cleanly to What-If Twin + 1g Baseline Ghost with scenario 3D camera
  document.querySelectorAll('input[name="missionScenario"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) applyScenario(radio.value, true);
    });
  });

  // Segmented Source Mode & Exercise Protocol radio pills
  document.querySelectorAll('input[name="sourceModeRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) setSourceMode(radio.value);
    });
  });
  document.querySelectorAll('input[name="protocolRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.protocol = radio.value;
      state.telemetry.target_rom_deg = state.protocol === "eva_upper_reach" ? 168 : 118;
      state.biomech3d.resetTrails();
      configureRepSegmenterForMode();
      scheduleEvaluation();
    });
  });

  // Neuro-Acoustic Music Therapy, 3D Sonification & Voice Biomarker DSP bindings
  document.getElementById("toggleNeuroPlayBtn").addEventListener("click", toggleNeuroPlay);
  document.getElementById("quickNeuroPlayBtn").addEventListener("click", toggleNeuroPlay);

  document.querySelectorAll('input[name="neuroProtocolRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) selectNeuroProtocol(radio.value, true);
    });
  });

  document.getElementById("toggleAutoDuckBtn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    state.neuroEngine.autoDuckEnabled = !state.neuroEngine.autoDuckEnabled;
    btn.setAttribute("aria-pressed", String(state.neuroEngine.autoDuckEnabled));
    state.neuroEngine.applySidechainDucking();
    setAcousticCaption(
      state.neuroEngine.autoDuckEnabled
        ? "[Sidechain Ducking enabled] Music bus attenuates -10 dB automatically during Flight Surgeon or live vocal speech."
        : "[Sidechain Ducking bypassed] Music bus remains at full gain during speech.",
      true
    );
  });

  document.getElementById("toggleAutoRxSyncBtn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    state.autoRxSyncEnabled = !state.autoRxSyncEnabled;
    btn.setAttribute("aria-pressed", String(state.autoRxSyncEnabled));
    if (state.autoRxSyncEnabled && state.latestEvaluation?.neuro_prescription?.recommended_protocol_id) {
      selectNeuroProtocol(state.latestEvaluation.neuro_prescription.recommended_protocol_id, false);
    }
    setAcousticCaption(
      state.autoRxSyncEnabled
        ? "[Auto-Rx Protocol Sync enabled] 8-DOF Mahalanobis triage automatically selects the optimal binaural & NMT music protocol."
        : "[Manual Protocol Lock] Neuro-acoustic protocol locked to manual crew selection.",
      true
    );
  });

  const bindAudioSlider = (inId, outId, decimals, onVal) => {
    const el = document.getElementById(inId);
    const out = document.getElementById(outId);
    if (!el || !out) return;
    syncSliderCssProps(el);
    el.addEventListener("input", () => {
      const v = Number(el.value);
      out.textContent = v.toFixed(decimals);
      syncSliderCssProps(el);
      onVal(v);
    });
  };
  bindAudioSlider("inAudioGain", "outAudioGain", 0, (v) => state.neuroEngine.setMasterVolume(v / 100));
  bindAudioSlider("inBinauralHz", "outBinauralHz", 1, (v) => state.neuroEngine.setBinauralBeatHz(v));
  bindAudioSlider("inKinCoupling", "outKinCoupling", 0, (v) => state.neuroEngine.setKinematicCoupling(v / 100));
  bindAudioSlider("inNeuroTempo", "outNeuroTempo", 0, (v) => {
    state.neuroEngine.setTempoBpm(v);
    syncAudioButtonsUi();
  });

  document.getElementById("speakBriefingBtn").addEventListener("click", speakFlightSurgeonBriefing);
  document.getElementById("topbarVoiceBriefBtn").addEventListener("click", speakFlightSurgeonBriefing);
  document.getElementById("voiceCmdBtn").addEventListener("click", toggleVoiceCommand);
  document.getElementById("micVocalBtn").addEventListener("click", toggleMicVocalAssay);
  document.getElementById("synthVocalBtn").addEventListener("click", runSyntheticVocalAssay);
  document.getElementById("voiceRepCoachBtn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    state.voiceRepCoachEnabled = !state.voiceRepCoachEnabled;
    btn.setAttribute("aria-pressed", String(state.voiceRepCoachEnabled));
    setAcousticCaption(
      state.voiceRepCoachEnabled
        ? "[Spoken Cycle Coach armed] Each segmented repetition triggers spoken L/R symmetry & trunk-tilt voice coaching."
        : "[Spoken Cycle Coach muted] Harmonic consonance chimes remain active on cycle completion.",
      true
    );
  });

  // Tab 3 & Connected Apple Watch + Mobile Kinematics Mesh bindings
  document.getElementById("quickMeshSyncBtn").addEventListener("click", () => pushSingleSimulatedEdgeBurst("bridge"));
  document.getElementById("toggleEdgeStreamBtn").addEventListener("click", toggleLiveEdgeStream);
  document.getElementById("pushWatchPacketBtn").addEventListener("click", () => pushSingleSimulatedEdgeBurst("watch"));
  document.getElementById("pushMobilePacketBtn").addEventListener("click", () => pushSingleSimulatedEdgeBurst("mobile"));
  document.getElementById("pushEclssPacketBtn").addEventListener("click", () => pushSingleSimulatedEdgeBurst("eclss"));
  document.getElementById("jumpToConsoleFromApiBtn").addEventListener("click", () => {
    activateWorkspaceTab("tabMissionConsole", true, true);
  });
  document.getElementById("sendApiPostBtn").addEventListener("click", () => executeEdgeIngestPost(null));

  document.querySelectorAll('input[name="apiPresetRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) applyApiPreset(radio.value);
    });
  });
  document.querySelectorAll('input[name="sdkLangRadio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) renderSdkCodeSnippet(radio.value);
    });
  });

  document.getElementById("copySdkCodeBtn").addEventListener("click", async () => {
    const text = document.getElementById("sdkCodePre").textContent;
    const btn = document.getElementById("copySdkCodeBtn");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = "Copy Snippet";
      }, 1500);
    } catch {}
  });

  // Local video file input
  document.getElementById("videoFileInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleLocalVideoSelected(file);
  });

  // Instrument toolbar buttons
  document.getElementById("pauseMotionBtn").addEventListener("click", toggleFreezeFrame);
  document.getElementById("toggleRasBtn").addEventListener("click", toggleRasAudio);
  document.getElementById("exportCsvBtn").addEventListener("click", exportKinematicsCsv);
  document.getElementById("resetRepsBtn").addEventListener("click", () => {
    state.referenceAutoRepCap = state.repSegmenter.reps.length + 5;
    configureRepSegmenterForMode();
  });
  document.getElementById("pvtPadBtn").addEventListener("click", handlePvtClick);
  document.getElementById("verifyOsdrBtn").addEventListener("click", verifyLiveNasaOsdr);
  document.getElementById("logSessionBtn").addEventListener("click", logCurrentSession);

  // Interactive hover crosshair on Empirical OSDR Longitudinal Chart
  const osdrCanvas = document.getElementById("osdrChartCanvas");
  osdrCanvas.addEventListener("pointermove", (e) => {
    if (!state.osdrEmpirical) return;
    const rect = osdrCanvas.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 680;
    const idx = Math.max(0, Math.min(5, Math.round(((relX - 54) / (680 - 54 - 26)) * 5)));
    if (idx !== state.osdrHoverIndex) {
      state.osdrHoverIndex = idx;
      renderOsdrCohortChart();
    }
  });

  document.getElementById("osdrCrewSelect").addEventListener("change", (e) => {
    state.osdrSelectedCrew = e.target.value;
    renderOsdrCohortChart();
    renderOsdrCohortTable();
  });

  // Precision sliders
  const bindSlider = (inId, outId, key, decimals = 0, extraFn = null) => {
    const el = document.getElementById(inId);
    const out = document.getElementById(outId);
    syncSliderCssProps(el);
    el.addEventListener("input", () => {
      const v = Number(el.value);
      state.telemetry[key] = v;
      out.textContent = v.toFixed(decimals);
      syncSliderCssProps(el);
      if (extraFn) extraFn(v);
      scheduleEvaluation();
    });
  };
  bindSlider("inRom", "outRom", "joint_rom_deg", 0);
  bindSlider("inSym", "outSym", "bilateral_symmetry_pct", 1);
  bindSlider("inTrunk", "outTrunk", "trunk_lean_deg", 1);
  bindSlider("inTremor", "outTremor", "tremor_rms_mm", 2);
  bindSlider("inCo2", "outCo2", "cabin_co2_mmhg", 1);
  bindSlider("inRad", "outRad", "radiation_msv_day", 2);
  bindSlider("inHr", "outHr", "heart_rate_bpm", 0, (hr) => {
    const estHrv = Math.max(18, Math.min(82, Math.round(105 - hr * 0.8)));
    state.telemetry.hrv_rmssd_ms = estHrv;
    document.getElementById("outHrv").textContent = estHrv;
  });

  // Top-Layer Modal Dialogs
  const settingsDialog = document.getElementById("settingsDialog");
  const packetDialog = document.getElementById("packetDialog");
  document.getElementById("openSettingsBtn").addEventListener("click", () => settingsDialog.showModal());
  document.getElementById("openPacketBtn").addEventListener("click", () => packetDialog.showModal());

  document.getElementById("privacyTierSelect").addEventListener("change", (e) => {
    state.privacyTier = e.target.value;
    scheduleEvaluation();
  });
  document.getElementById("commModeSelect").addEventListener("change", (e) => {
    state.commMode = e.target.value;
    scheduleEvaluation();
  });

  document.getElementById("copyPacketBtn").addEventListener("click", async () => {
    const text = document.getElementById("packetPre").textContent;
    const btn = document.getElementById("copyPacketBtn");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied JSON Payload";
      setTimeout(() => {
        btn.textContent = "Copy JSON Payload";
      }, 1500);
    } catch {}
  });

  renderSdkCodeSnippet("swift");
  applyApiPreset("watch_vitals");
  const apiRespPre = document.getElementById("apiResponsePre");
  if (apiRespPre) {
    apiRespPre.textContent = JSON.stringify(
      {
        endpoint: "POST /api/ingest/edge-telemetry",
        status: "ARMED_FOR_LIVE_INGEST",
        supported_devices: [
          "apple_watch_ultra_healthkit",
          "mobile_kinematics_app",
          "combined_ios_watch_bridge",
          "habitat_eclss_bus",
        ],
        tip: "Click 'Execute Live POST /api/ingest/edge-telemetry' or 'Start 1 Hz Live Stream' to fuse real HTTP packets.",
      },
      null,
      2
    );
  }

  configureRepSegmenterForMode();
  const urlParams = new URLSearchParams(window.location.search);
  const initScen = urlParams.get("scenario");
  const initMode = urlParams.get("mode");
  const chosenScenario = initScen && state.scenarios[initScen] ? initScen : "musculoskeletal_asymmetry";
  document.querySelectorAll('input[name="missionScenario"]').forEach((r) => {
    r.checked = r.value === chosenScenario;
  });
  if (initMode === "parametric_twin" || initMode === "reference_mocap") {
    state.sourceMode = initMode;
    syncSourceRadios(initMode);
  }
  applyScenario(chosenScenario, initMode === "parametric_twin" || Boolean(initScen && initMode !== "reference_mocap"));
  if (state.sourceMode === "reference_mocap") {
    updateVisionBadge("Recorded 62f Mocap Clip (30 FPS)");
  }
  syncContextualModeBars();
  refreshSessionsList();

  fetch("/api/ingest/recent")
    .then((r) => (r.ok ? r.json() : null))
    .then((recent) => {
      if (!recent || !Array.isArray(recent.packets) || recent.packets.length === 0) return;
      state.ingestedPacketsCount = recent.count || recent.packets.length;
      const pktCountEl = document.getElementById("fusedPacketCountVal");
      if (pktCountEl) pktCountEl.textContent = `${state.ingestedPacketsCount} packets`;
      const tabBadge = document.getElementById("edgeTabPacketBadge");
      if (tabBadge) tabBadge.textContent = `${state.ingestedPacketsCount}`;
      renderEdgePacketTable(recent.packets);
      if (apiRespPre) {
        apiRespPre.textContent = JSON.stringify(
          {
            latest_ingested_packet: recent.packets[0],
            active_hub_channels: Object.keys(recent.fused_telemetry_state || {}).length,
          },
          null,
          2
        );
      }
    })
    .catch(() => {});

  startStudioLoop();
}

bootstrap();
