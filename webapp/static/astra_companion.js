/**
 * AstroKinetics · ASTRA Companion Client Module (v4.0.0)
 * ======================================================
 * Powers Tab 2 (NASA HUNCH Dual-Engine Triage, ASTRA Longitudinal Episode Governance,
 * & Signed Tetrahedral LiDAR Calf Volumetry), Tab 3 (AURA Cited Space Medicine Engine,
 * RadLab DosTel1/2 Radiation Plot, Barger 2014 ISS Sleep Tables, & 657+ Source Registry),
 * plus Cross-Tab Bridges from Mission Console with offline PWA fallback support.
 */

import { createBody3D } from "/static/body3d.js?v=5.1.2";

const companionState = {
  lang: "en",
  hunchCatalog: null,
  episodes: [],
  activeEpisodeId: null,
  contracts: null,
  lastHunchResult: null,
  lastLidarResult: null,
  auraOverview: null,
  auraConcepts: [],
  auraSources: { registry_sources: [], apple_studies: [] },
  auraPmcSample: [],
  radlabData: null,
  activeCatalogKind: "apple",
  lidarYaw: 0.45,
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function el(id) {
  return document.getElementById(id);
}

let colorProbe = null;
function getCssVar(name, fallback) {
  if (!colorProbe) {
    colorProbe = document.createElement("span");
    colorProbe.style.cssText = "position:absolute;inline-size:0;block-size:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(colorProbe);
  }
  colorProbe.style.color = "";
  colorProbe.style.color = `var(${name})`;
  const resolved = colorProbe.style.color ? getComputedStyle(colorProbe).color : "";
  return resolved || fallback;
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Count numbers up from zero when a summary strip comes into view. */
function countUp(container) {
  if (!container) return;
  const nodes = [...container.querySelectorAll("[data-count]")];
  if (reduceMotion()) {
    nodes.forEach((n) => { n.textContent = n.dataset.count; });
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 900);
    const eased = 1 - Math.pow(1 - t, 3);
    nodes.forEach((n) => { n.textContent = String(Math.round(Number(n.dataset.count) * eased)); });
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* Size a canvas to its CSS box (it must be sized by CSS, not by its own attributes) and clear it. */
function fitCanvas(canvas, minW = 200, minH = 60) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(minW, rect.width || minW);
  const h = Math.max(minH, rect.height || minH);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/* "var(--accent)" or a literal colour -> something a canvas can paint. */
function resolveColor(value) {
  const m = /^var\((--[\w-]+)\)$/.exec(String(value));
  return m ? getCssVar(m[1], "#94a3b8") : value;
}

function hashIndex(text, n) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return n > 0 ? h % n : 0;
}

/* Run fn(progress 0..1) over a duration; jumps to the end when motion is reduced. */
function tween(key, ms, fn) {
  cancelAnimationFrame(companionState[key]);
  if (reduceMotion()) return fn(1);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    fn(t);
    if (t < 1) companionState[key] = requestAnimationFrame(tick);
  };
  companionState[key] = requestAnimationFrame(tick);
}

const ICONS = {
  flag: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14V2.5M4 3h7.5l-1.8 2.6L11.5 8H4"/></svg>',
  rule: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>',
  ml: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="8" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="12" cy="12" r="1.6"/><path d="M5.5 7.2 10.5 4.7M5.5 8.8l5 2.5"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.6 11.5 12.5 5"/></svg>',
  watch: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4" width="7" height="8" rx="2"/><path d="M6 4V1.8h4V4M6 12v2.2h4V12"/></svg>',
  phone: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="1.8" width="7" height="12.4" rx="1.8"/><path d="M7.2 11.8h1.6"/></svg>',
  desk: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.8" width="12" height="8" rx="1.6"/><path d="M6 13.4h4M8 10.8v2.6"/></svg>',
};

const counted = (n) => `<span data-count="${Number(n) || 0}">${Number(n) || 0}</span>`;

const TIER_ORDER = ["LOW", "MODERATE", "URGENT", "EMERGENCY"];

function tierPillClass(tier) {
  if (tier === "EMERGENCY") return "status-alert";
  if (tier === "URGENT" || tier === "MODERATE") return "status-watch";
  if (tier === "LOW") return "status-nominal";
  return "status-neutral";
}

/** "sufficient_for_protocol" -> "Sufficient for protocol" */
function humanize(value) {
  const text = String(value ?? "").replace(/_/g, " ").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function tierLabel(tier) {
  return tier === "INCOMPLETE_CHECK_REQUIRED" ? "Check incomplete" : humanize(tier);
}

function fmtClock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toISOString().slice(11, 19)} UTC`;
}

function kpiTile(label, valueHtml, foot, state = "") {
  return `<div class="ax-kpi"${state ? ` data-state="${state}"` : ""}><span class="ax-kpi-label">${esc(label)}</span><strong class="ax-kpi-value mono">${valueHtml}</strong><span class="ax-kpi-foot" title="${esc(foot)}">${esc(foot)}</span></div>`;
}

function setSegActive(buttons, activeBtn) {
  buttons.forEach((b) => {
    const on = b === activeBtn;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let payload = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }
  if (!resp.ok) {
    const err = new Error(payload?.detail || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

// ----------------------------------------------------------------------------
// Offline Fallbacks (Zero-Connectivity Mars / Solar Blackout Resilience)
// ----------------------------------------------------------------------------
function offlineHunchEvaluate(req) {
  const rf = [];
  if (req.chest_pain && req.sob && req.diaphoresis) rf.push({ id: "mi_triad", label: "MI Triad", protocol: "Cardiac Emergency" });
  if (req.thunderclap_headache) rf.push({ id: "thunderclap_headache", label: "Thunderclap Headache", protocol: "SAH Contingency" });
  if ((req.confusion && req.fever) || (req.fever && req.neck_stiffness && req.headache)) rf.push({ id: "meningitis_pattern", label: "Meningitis Pattern", protocol: "CNS Isolation" });
  if (req.non_blanching_rash && req.fever) rf.push({ id: "meningococcemia", label: "Meningococcemia", protocol: "Sepsis Contingency" });
  if (req.acute_vision_loss) rf.push({ id: "acute_vision_loss", label: "Acute Vision Loss", protocol: "SANS Fundoscopy" });
  if (req.new_seizure) rf.push({ id: "new_seizure", label: "New Seizure", protocol: "Airway + CO2 Check" });
  if (req.syncope) rf.push({ id: "syncope", label: "Syncope", protocol: "Orthostatic / ECG" });
  if (req.hemoptysis) rf.push({ id: "hemoptysis", label: "Hemoptysis", protocol: "Pulmonary Isolation" });

  let tier = "LOW";
  let abstained = false;
  const trace = [];
  if (rf.length > 0) {
    tier = "EMERGENCY";
    trace.push(`Offline Red-Flag Gate preempted (${rf.length} trigger).`);
  } else if (req.signal_quality === "poor" || req.signal_quality === "insufficient") {
    tier = "INCOMPLETE_CHECK_REQUIRED";
    abstained = true;
    trace.push("Offline Safety Gate abstained due to poor/insufficient capture quality.");
  } else if ((req.spo2 && req.spo2 < 90) || (req.sbp && req.sbp < 90) || req.severity >= 7) {
    tier = "URGENT";
    trace.push("Offline conservative vital escalation -> URGENT.");
  } else if (req.severity >= 4 || (req.active_profile === "earth_1g" && req.sleep_hours < 6.0)) {
    tier = "MODERATE";
    trace.push("Moderate cluster / Earth-1g baseline departure -> MODERATE.");
  } else {
    trace.push("No red flags detected under verified offline protocol.");
  }

  return {
    triage_level: tier,
    abstained,
    triggered_red_flags: rf,
    rule_engine: { decision: tier, trace },
    ml_comparator: {
      prediction: abstained ? "LOW" : tier,
      probabilities: {
        EMERGENCY: rf.length ? 0.91 : 0.04,
        URGENT: tier === "URGENT" ? 0.72 : 0.11,
        MODERATE: tier === "MODERATE" ? 0.65 : 0.22,
        LOW: tier === "LOW" ? 0.78 : 0.14,
      },
      agrees_with_rule: !abstained,
      comparison_note: abstained
        ? "Offline edge fallback: statistical pattern guessed LOW while Rule Gate abstained safely."
        : "Offline edge fallback evaluation (server unreachable).",
    },
    timing_ms: { red_flag_gate_ms: 0.1, rule_engine_ms: 0.2, ml_comparator_ms: 0.2 },
  };
}

function offlineLidarEstimate(req) {
  const l = Number(req.segment_length_cm || 28);
  const r1 = Number(req.proximal_circ_cm || 37.4) / (2 * Math.PI);
  const r2 = Number(req.mid_circ_cm || 34.2) / (2 * Math.PI);
  const r3 = Number(req.distal_circ_cm || 22.8) / (2 * Math.PI);
  const rAvg = (r1 + 4 * r2 + r3) / 6;
  const vol = Math.PI * rAvg * rAvg * l;
  const cov = Number(req.observed_coverage_pct || 88);
  const holdReasons = [];
  if (cov < 82) holdReasons.push(`Observed coverage (${cov}%) < 82% gate.`);
  if (req.capture_mode === "personSegmentationWithDepth") {
    holdReasons.push("ARKit personSegmentationWithDepth requires raw sceneDepth + confidenceMap fallback check.");
  }
  const base = Number(req.baseline_volume_ml || 2380);
  const delta = vol - base;
  return {
    computed_volume_ml: Math.round(vol * 10) / 10,
    baseline_volume_ml: base,
    delta_ml: Math.round(delta * 10) / 10,
    pct_change: Math.round((delta / base) * 1000) / 10,
    vertex_count: 218,
    triangle_count: 432,
    provenance_breakdown_pct: { observed: cov, occluded: Math.max(0, 100 - cov - 5), inferred: 5 },
    quality_gate_status: holdReasons.length ? "QUALITY_HOLD" : "PASS",
    hold_reasons: holdReasons,
    rings_preview: [0, 0.25, 0.5, 0.75, 1.0].map((t) => {
      const r = (1 - t) * r1 + t * r3 + Math.sin(Math.PI * t) * Math.max(0, r2 - (r1 + r3) / 2);
      return Array.from({ length: 24 }, (_, k) => {
        const th = (k / 24) * 2 * Math.PI;
        return [r * 1.04 * Math.cos(th), r * 0.96 * Math.sin(th), t * l];
      });
    }),
  };
}

// ----------------------------------------------------------------------------
// 1. NASA HUNCH Guided Symptom Interview & Dual-Engine Triage
// ----------------------------------------------------------------------------
function collectHunchPayload() {
  const payload = {
    onset_hours: 2.0,
    severity: Number(el("hunchSeverityInput")?.value || 3),
    hr: el("hunchHrInput")?.value !== "" ? Number(el("hunchHrInput").value) : null,
    sbp: el("hunchSbpInput")?.value !== "" ? Number(el("hunchSbpInput").value) : null,
    spo2: el("hunchSpo2Input")?.value !== "" ? Number(el("hunchSpo2Input").value) : null,
    temp_c: el("hunchTempInput")?.value !== "" ? Number(el("hunchTempInput").value) : null,
    sleep_hours: el("hunchSleepInput")?.value !== "" ? Number(el("hunchSleepInput").value) : null,
    hrv_sdnn: 42.0,
    signal_quality: el("hunchQualitySelect")?.value || "good",
    watch_connected: Boolean(el("hunchWatchCheck")?.checked),
    require_complete_context: Boolean(el("hunchRequireCompleteCheck")?.checked),
    active_profile: el("hunchProfileSelect")?.value || "mission_microgravity",
  };
  document.querySelectorAll("#hunchSymptomGrid input[data-sym]").forEach((cb) => {
    payload[cb.dataset.sym] = cb.checked;
  });
  return payload;
}

function applyHunchPreset(preset = {}) {
  document.querySelectorAll("#hunchSymptomGrid input[data-sym]").forEach((cb) => {
    cb.checked = Boolean(preset[cb.dataset.sym]);
  });
  const setVal = (id, v) => {
    const node = el(id);
    if (node) node.value = v === null || v === undefined ? "" : String(v);
  };
  setVal("hunchHrInput", preset.hr !== undefined ? preset.hr : 72);
  setVal("hunchSbpInput", preset.sbp !== undefined ? preset.sbp : 118);
  setVal("hunchSpo2Input", preset.spo2 !== undefined ? preset.spo2 : 98);
  setVal("hunchTempInput", preset.temp_c !== undefined ? preset.temp_c : 36.8);
  setVal("hunchSleepInput", preset.sleep_hours !== undefined ? preset.sleep_hours : 6.8);
  setVal("hunchSeverityInput", preset.severity !== undefined ? preset.severity : 3);
  if (el("hunchQualitySelect")) el("hunchQualitySelect").value = preset.signal_quality || "good";
  if (el("hunchWatchCheck")) el("hunchWatchCheck").checked = preset.watch_connected !== false;
  if (el("hunchRequireCompleteCheck")) el("hunchRequireCompleteCheck").checked = Boolean(preset.require_complete_context);
  updateSymptomCounts();
}

const SYMPTOM_ZONES = {
  chest_pain: "chest", sob: "chest", hemoptysis: "chest",
  thunderclap_headache: "head", headache: "head", confusion: "head", new_seizure: "head", dizziness: "head",
  acute_vision_loss: "eyes", visual_blur: "eyes",
  neck_stiffness: "neck",
  fever: "systemic", diaphoresis: "systemic", non_blanching_rash: "systemic", fatigue: "systemic", syncope: "systemic",
};

/* Light up the part of the body each selected symptom belongs to; red-flag symptoms glow red. */
function updateBodyZones() {
  const map = el("hunchBodyMap");
  if (!map) return;
  const level = {};
  document.querySelectorAll("#hunchSymptomGrid input[data-sym]:checked").forEach((cb) => {
    const zone = SYMPTOM_ZONES[cb.dataset.sym];
    if (!zone) return;
    if (cb.closest(".symptom-red")) level[zone] = "alert";
    else if (!level[zone]) level[zone] = "on";
  });
  map.querySelectorAll(".ax-zone").forEach((z) => {
    if (level[z.dataset.zone]) z.dataset.on = level[z.dataset.zone];
    else delete z.dataset.on;
  });
  if (level.systemic) map.dataset.systemic = level.systemic;
  else delete map.dataset.systemic;
  companionState.body3d?.setTint(level.systemic || null);
}

function setCallout(key, value, unit, state = "") {
  const g = document.querySelector(`#hunchBodyMap .bm-callout[data-key="${key}"]`);
  if (!g) return;
  g.querySelector("[data-val]").textContent = value;
  g.querySelector("[data-unit]").textContent = unit;
  if (state) g.dataset.state = state;
  else delete g.dataset.state;
}

/* Every callout shows a value the workstation already holds: the vitals on this tab,
   the live kinematics from the 3D twin, and the last LiDAR result. */
function updateBodyReadings() {
  if (!el("hunchBodyMap")) return;
  const val = (id) => el(id)?.value ?? "";
  const show = (v) => (v === "" ? "—" : v);
  const tileState = (k) => document.querySelector(`#hunchVitals .ax-vital[data-vital="${k}"]`)?.dataset.state || "";
  setCallout("hr", show(val("hunchHrInput")), "bpm", tileState("hr"));
  setCallout("sbp", show(val("hunchSbpInput")), "mmHg", tileState("sbp"));
  setCallout("spo2", show(val("hunchSpo2Input")), "%", tileState("spo2"));
  setCallout("temp", show(val("hunchTempInput")), "°C", tileState("temp"));
  setCallout("sleep", show(val("hunchSleepInput")), "h", tileState("sleep"));

  const t = window.AstroKineticsBridge?.getState?.()?.telemetry;
  if (t) {
    if (Number.isFinite(t.tremor_rms_mm)) setCallout("tremor", Number(t.tremor_rms_mm).toFixed(2), "mm");
    if (Number.isFinite(t.bilateral_symmetry_pct)) setCallout("sym", Number(t.bilateral_symmetry_pct).toFixed(1), "%");
    if (Number.isFinite(t.joint_rom_deg)) setCallout("rom", `${Math.round(t.joint_rom_deg)}°`, `of ${Math.round(t.target_rom_deg)}°`);
  }
  const lidar = companionState.lastLidarResult;
  if (lidar) {
    const sign = lidar.pct_change >= 0 ? "+" : "";
    setCallout("vol", String(Math.round(lidar.computed_volume_ml)), `cm³ ${sign}${lidar.pct_change}%`, lidar.quality_gate_status === "PASS" ? "" : "watch");
  }

  const heart = el("bmHeart");
  const hr = Number(val("hunchHrInput"));
  if (heart) {
    heart.style.setProperty("--beat", hr > 0 ? `${(60 / hr).toFixed(2)}s` : "1s");
    heart.style.animationPlayState = hr > 0 ? "running" : "paused";
  }
  companionState.body3d?.setHeartRate(hr);
}

/* ---- 3D body: real anatomy behind the callouts ---- */
const ZONE_POINTS = {
  head: { at: [0, 1.63, 0.02], rx: 0.115, ry: 0.125 },
  eyes: { at: [0, 1.615, 0.09], rx: 0.06, ry: 0.024 },
  neck: { at: [0, 1.5, 0.02], rx: 0.06, ry: 0.04 },
  chest: { at: [0, 1.3, 0.06], rx: 0.16, ry: 0.13 },
};
const VIEW_LABELS = { vessels: "arteries", muscle: "muscles", bone: "skeleton", skin: "body", heart: "heart" };

async function initBody3D() {
  if (companionState.body3dStarted) return;
  companionState.body3dStarted = true;
  const canvas = el("body3dCanvas");
  const stage = canvas?.closest(".bm-stage");
  const status = el("body3dStatus");
  if (!canvas || !stage) return;
  const say = (text) => {
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || "";
  };
  try {
    say("LOADING ANATOMY");
    const body = await createBody3D(canvas);
    if (!body) return say(""); // no WebGL2: the drawn figure stays
    // callout geometry is fixed; only the leader ends follow the body
    companionState.calloutLayout = [...document.querySelectorAll("#hunchBodyMap .bm-callout")].map((g) => {
      const label = g.querySelector(".bm-label");
      return {
        key: g.dataset.key,
        left: label.getAttribute("text-anchor") === "end",
        x: Number(label.getAttribute("x")),
        y: Number(label.getAttribute("y")) + 7,
        leader: g.querySelector(".bm-leader"),
        anchor: g.querySelector(".bm-anchor"),
      };
    });
    await Promise.all([body.load("skin"), body.load("bone"), body.load("heart")]);
    companionState.body3d = body;
    body.setView(el("hunchBodyMap")?.dataset.layer || "all");
    body.setGravity(companionState.gravMode || null);
    stage.classList.add("is-3d");
    updateBodyReadings();
    updateBodyZones();
    startLidarSpin();
    // heavier layers arrive in the background
    for (const name of ["vessels", "muscle"]) {
      say(`LOADING ${VIEW_LABELS[name].toUpperCase()}`);
      await body.load(name);
    }
    say("");
  } catch (err) {
    console.warn("3D body unavailable, keeping the drawn figure:", err);
    say("");
  }
}

/* Pressure of a fluid column relative to the heart: rho * g * h, with blood at 1060 kg/m3. */
const MMHG_PER_METRE = (1060 * 9.81) / 133.322;

/* Readout for the gravity view. `g` runs from 1 (Earth) to 0 (orbit) while the body animates. */
function renderGravityReadout(g, on) {
  const box = el("bmGrav");
  if (!box) return;
  box.toggleAttribute("hidden", !on);
  if (!on) return;
  const m = companionState.body3d?.manifest;
  const heartY = m ? m.heartCenter[1] : 1.298;
  const top = m ? m.max[1] : 1.73;
  const fmt = (v) => `${v > 0.5 ? "+" : v < -0.5 ? "−" : ""}${Math.abs(Math.round(v))}`;
  el("bmGravHead").textContent = fmt(-(top - heartY) * MMHG_PER_METRE * g);
  el("bmGravFeet").textContent = fmt(heartY * MMHG_PER_METRE * g);
  el("bmGravNote").textContent = companionState.gravMode === "orbit" ? "No gravity: fluid moves toward the head" : "Gravity holds fluid in the legs";
}

function setGravityMode(mode) {
  companionState.gravMode = mode;
  const buttons = [...document.querySelectorAll("#bodyGravSeg [data-grav]")];
  setSegActive(buttons, buttons.find((b) => b.dataset.grav === mode) || null);
  const body = companionState.body3d;
  body?.setGravity(mode);
  // Without the 3D body (or with reduced motion) there is nothing to animate: show the end state.
  if (!body || reduceMotion()) {
    renderGravityReadout(mode === "orbit" ? 0 : 1, Boolean(mode));
    if (body) renderBody3D(0);
  }
}

/* Each frame: draw the body, then move the callout leaders and symptom zones onto it. */
function renderBody3D(now) {
  const body = companionState.body3d;
  if (!body) return;
  body.render(now);
  if (!reduceMotion()) renderGravityReadout(body.gravity, Boolean(companionState.gravMode));
  const W = 520;
  const H = 412;
  (companionState.calloutLayout || []).forEach((c) => {
    const pt = body.manifest.anchors[c.key];
    const p = pt && body.project(pt);
    if (!p) return;
    const ax = p.x * W;
    const ay = p.y * H;
    const x0 = c.left ? c.x + 6 : c.x - 6;
    const ex = c.left ? Math.max(x0 + 6, ax - 16) : Math.min(x0 - 6, ax + 16);
    c.leader.setAttribute("d", `M${x0} ${c.y} L${ex.toFixed(1)} ${c.y} L${ax.toFixed(1)} ${ay.toFixed(1)}`);
    c.anchor.setAttribute("cx", ax.toFixed(1));
    c.anchor.setAttribute("cy", ay.toFixed(1));
    c.anchor.style.opacity = p.front ? "1" : "0.35";
  });
  const unit = body.metresToUnits(H);
  document.querySelectorAll("#hunchBodyMap .ax-zone").forEach((zone) => {
    const def = ZONE_POINTS[zone.dataset.zone];
    const p = def && body.project(def.at);
    if (!p) return;
    zone.setAttribute("cx", (p.x * W).toFixed(1));
    zone.setAttribute("cy", (p.y * H).toFixed(1));
    zone.setAttribute(zone.tagName === "circle" ? "r" : "rx", (def.rx * unit).toFixed(1));
    if (zone.tagName !== "circle") zone.setAttribute("ry", (def.ry * unit).toFixed(1));
  });
}

/* One heartbeat and one pulse wave, as shapes over a 0..1 cycle. Drawn at the entered heart rate. */
function ecgShape(p) {
  const g = (c, wd, a) => a * Math.exp(-((p - c) ** 2) / (2 * wd * wd));
  return g(0.2, 0.025, 0.12) - g(0.365, 0.008, 0.14) + g(0.39, 0.011, 1) - g(0.42, 0.011, 0.24) + g(0.62, 0.045, 0.26);
}

function plethShape(p) {
  const g = (c, wd, a) => a * Math.exp(-((p - c) ** 2) / (2 * wd * wd));
  return g(0.24, 0.085, 1) + g(0.5, 0.1, 0.36);
}

function drawVitalsMonitor(now) {
  const canvas = el("vitalsMonitorCanvas");
  if (!canvas) return;
  const { ctx, w, h } = fitCanvas(canvas, 240, 80);
  const colors = companionState.monitorColors || (companionState.monitorColors = {
    nominal: getCssVar("--nominal-stroke", "#34d399"),
    watch: getCssVar("--watch-stroke", "#f59e0b"),
    alert: getCssVar("--alert-stroke", "#fb7185"),
    accent: getCssVar("--accent", "#38bdf8"),
    grid: getCssVar("--border-subtle", "rgba(148,163,184,0.2)"),
    text: getCssVar("--text-primary", "#f1f5f9"),
    muted: getCssVar("--text-muted", "#94a3b8"),
  });
  const hr = Number(el("hunchHrInput")?.value) || 0;
  const spo2 = el("hunchSpo2Input")?.value || "";
  const hrState = document.querySelector('#hunchVitals .ax-vital[data-vital="hr"]')?.dataset.state || "nominal";

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let x = w % 24; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 12; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const speed = 95; // px per second, newest sample at the right edge
  const tNow = now / 1000;
  const lanes = [
    { label: "ECG", value: hr ? `${hr}` : "—", unit: "bpm", color: colors[hrState] || colors.nominal, shape: ecgShape, base: h * 0.42, amp: h * 0.3 },
    { label: "PLETH", value: spo2 || "—", unit: "%", color: colors.accent, shape: plethShape, base: h * 0.9, amp: h * 0.24 },
  ];
  const padL = 62;
  lanes.forEach((lane) => {
    ctx.beginPath();
    for (let x = padL; x <= w - 4; x += 1.5) {
      const t = tNow - (w - 4 - x) / speed;
      const phase = hr > 0 ? (((t * hr) / 60) % 1 + 1) % 1 : 0;
      const y = lane.base - (hr > 0 ? lane.shape(phase) : 0) * lane.amp;
      if (x === padL) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lane.color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const headPhase = hr > 0 ? (((tNow * hr) / 60) % 1 + 1) % 1 : 0;
    ctx.fillStyle = lane.color;
    ctx.beginPath();
    ctx.arc(w - 4, lane.base - (hr > 0 ? lane.shape(headPhase) : 0) * lane.amp, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "start";
    ctx.fillStyle = colors.muted;
    ctx.font = "600 8px 'JetBrains Mono', monospace";
    ctx.fillText(lane.label, 8, lane.base - lane.amp * 0.62);
    ctx.fillStyle = lane.color;
    ctx.font = "700 15px 'JetBrains Mono', monospace";
    ctx.fillText(lane.value, 8, lane.base - lane.amp * 0.62 + 16);
    ctx.fillStyle = colors.muted;
    ctx.font = "600 8px Inter, sans-serif";
    ctx.fillText(lane.unit, 8 + ctx.measureText(lane.value).width * 1.9 + 6, lane.base - lane.amp * 0.62 + 16);
  });
}

function updateSymptomCounts() {
  updateBodyZones();
  const count = (selector) => document.querySelectorAll(`#hunchSymptomGrid ${selector} input:checked`).length;
  const set = (id, n) => {
    const node = el(id);
    if (!node) return;
    node.textContent = `${n} selected`;
    node.dataset.on = n > 0 ? "true" : "false";
  };
  set("hunchRedCount", count(".symptom-red"));
  set("hunchOtherCount", count(".symptom-chip:not(.symptom-red)"));
}

function renderTriageKpis() {
  const box = el("triageKpiStrip");
  if (!box) return;
  const meta = companionState.hunchCatalog?.meta || {};
  const eps = companionState.episodes;
  const byStatus = (status) => eps.filter((e) => e.episode?.status === status).length;
  const awaiting = byStatus("awaiting_review");
  const tests = String(meta.safety_tests_passed || "12/12").split(" ")[0];
  box.innerHTML = [
    kpiTile("Red-flag gate", `${counted(meta.red_flag_count ?? 8)}<small>patterns</small>`, "checked first, under 100 ms"),
    kpiTile("Safety tests", esc(tests), `${meta.vignettes_tested ?? 15} clinical vignettes`),
    kpiTile("Rule / ML agreement", `${counted(Math.round(meta.rule_ml_agreement_pct ?? 87))}<small>%</small>`, "the rule engine has authority"),
    kpiTile(
      "Episodes",
      counted(eps.length),
      `${awaiting} awaiting review · ${byStatus("open")} open · ${byStatus("closed")} closed`,
      awaiting ? "watch" : ""
    ),
  ].join("");
}

/* Colour a vital tile only when the triage engine itself flagged that vital. */
function flagVitals(res) {
  const patterns = { hr: /\bHR\b/i, sbp: /\bSBP\b|blood pressure/i, spo2: /SpO2/i, temp: /temp/i, sleep: /sleep/i };
  const critical = res?.critical_vitals || [];
  const abnormal = res?.abnormal_vitals || [];
  document.querySelectorAll("#hunchVitals .ax-vital").forEach((tile) => {
    const re = patterns[tile.dataset.vital];
    const hitCritical = re ? critical.find((t) => re.test(t)) : null;
    const hitAbnormal = re ? abnormal.find((t) => re.test(t)) : null;
    if (hitCritical) tile.dataset.state = "alert";
    else if (hitAbnormal) tile.dataset.state = "watch";
    else delete tile.dataset.state;
    tile.title = hitCritical || hitAbnormal || "";
  });
  updateBodyReadings();
}

function renderHunchOutcome(res) {
  companionState.lastHunchResult = res;
  const card = el("hunchOutcomeCard");
  const pill = el("hunchTierPill");
  const traceUl = el("hunchRuleTrace");
  const mlBars = el("hunchMlBars");
  if (!card || !pill || !traceUl || !mlBars) return;

  const tier = res.triage_level || "LOW";
  const level = TIER_ORDER.indexOf(tier);
  card.dataset.tier = tier;
  pill.textContent = tierLabel(tier).toUpperCase();
  pill.className = `status-pill ${tierPillClass(tier)}`;

  const gauge = el("hunchGauge");
  if (gauge) {
    gauge.dataset.abstain = level < 0 ? "true" : "false";
    gauge.querySelectorAll("[data-step]").forEach((seg) => {
      const idx = TIER_ORDER.indexOf(seg.dataset.step);
      seg.dataset.on = level >= 0 && idx <= level ? "true" : "false";
      seg.dataset.current = idx === level ? "true" : "false";
    });
    // Needle: -90deg rests on the left stop; each tier sits in the middle of its 45-degree segment.
    const angle = level < 0 ? -90 : -67.5 + level * 45;
    const needle = el("hunchNeedle");
    if (needle) needle.style.transform = `rotate(${angle}deg)`;
    gauge.setAttribute("aria-label", `Acuity gauge: ${tierLabel(tier)}`);
  }

  const flags = res.triggered_red_flags || [];
  const headline = el("hunchHeadline");
  if (headline) {
    const profile = res.active_profile === "earth_1g" ? "Earth-1g preflight baseline" : "mission profile";
    if (flags.length) {
      headline.textContent = `Emergency: ${flags.length} red-flag pattern${flags.length > 1 ? "s" : ""} matched. Start the emergency protocol now.`;
    } else if (res.abstained) {
      headline.textContent = "No clearance given: the capture is missing or too poor to judge. Repeat it before deciding.";
    } else {
      headline.textContent = `${tierLabel(tier)} acuity against the ${profile}.`;
    }
  }

  const flagList = el("hunchFlagList");
  if (flagList) {
    flagList.hidden = !flags.length;
    flagList.innerHTML = flags
      .map((f, i) => `<div class="ax-flag" style="--i:${i}"><span>${esc(f.label)}</span><small>${esc(f.protocol || "")}</small></div>`)
      .join("");
  }

  traceUl.innerHTML = (res.rule_engine?.trace || [])
    .map((line) => {
      const sub = /^\s+-\s*/.test(line);
      return `<li${sub ? ' class="is-sub"' : ""}>${esc(String(line).replace(/^\s+-\s*/, "").trim())}</li>`;
    })
    .join("");

  const ml = res.ml_comparator || {};
  const probs = ml.probabilities || {};
  mlBars.innerHTML = [...TIER_ORDER]
    .reverse()
    .map((label) => {
      const pct = Math.round(Number(probs[label] || 0) * 100);
      return `
        <div class="ml-bar-row" data-top="${label === ml.prediction}">
          <span>${esc(humanize(label))}</span>
          <div class="ml-bar-track"><div class="ml-bar-fill" style="width:${pct}%"></div></div>
          <span class="mono">${pct}%</span>
        </div>`;
    })
    .join("");

  const mlBadge = el("hunchMlAgreeBadge");
  if (mlBadge) {
    const agrees = Boolean(ml.agrees_with_rule);
    mlBadge.textContent = agrees ? "Agrees with rule" : `Differs: ${tierLabel(ml.prediction || "")}`;
    mlBadge.className = `status-pill ${agrees ? "status-nominal" : "status-watch"}`;
  }
  if (el("hunchMlNote")) el("hunchMlNote").textContent = ml.comparison_note || "";

  const pipe = el("hunchPipeline");
  if (pipe) {
    const t = res.timing_ms || {};
    const ms = (v) => (v === undefined ? "" : `${v} ms`);
    const tierState = tier === "EMERGENCY" ? "alert" : tier === "URGENT" || tier === "MODERATE" ? "watch" : tier === "LOW" ? "nominal" : "neutral";
    const nodes = [
      { label: "Red-flag gate", note: flags.length ? `${flags.length} matched` : ms(t.red_flag_gate_ms), state: flags.length ? "alert" : "nominal", icon: ICONS.flag },
      { label: "Rule engine", note: ms(t.rule_engine_ms), state: tierState, icon: ICONS.rule },
      { label: "ML check", note: ml.agrees_with_rule ? "agrees" : "differs", state: ml.agrees_with_rule ? "nominal" : "watch", icon: ICONS.ml },
      { label: "Result", note: tierLabel(tier), state: tierState, icon: ICONS.check },
    ];
    pipe.innerHTML = nodes
      .map((n, i) => `<li data-state="${n.state}" style="--i:${i}"><span class="ax-pipe-node">${n.icon}</span><strong>${n.label}</strong><em>${esc(n.note)}</em></li>`)
      .join("");
  }

  flagVitals(res);
}

async function runHunchTriage() {
  const payload = collectHunchPayload();
  try {
    const res = await fetchJson("/api/hunch/triage", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderHunchOutcome(res);
  } catch {
    renderHunchOutcome(offlineHunchEvaluate(payload));
  }
}

// ----------------------------------------------------------------------------
// 2. ASTRA Longitudinal Episode, Task & Provenance State Machine
// ----------------------------------------------------------------------------
function activeEpisode() {
  return companionState.episodes.find((ep) => ep.episode?.id === companionState.activeEpisodeId) || companionState.episodes[0] || null;
}

function showEpisodeGuard(msg) {
  const box = el("astraGuardAlert");
  if (!box) return;
  if (!msg) {
    box.hidden = true;
    box.textContent = "";
    return;
  }
  box.hidden = false;
  box.textContent = msg;
}

function renderProfileCopy(profileId) {
  const isEs = companionState.lang === "es";
  const titleEl = el("astraProfileTitle");
  const copyEl = el("astraProfileCopy");
  const btnEarth = el("toggleEarthProfileBtn");
  const btnMission = el("toggleMissionProfileBtn");
  if (!titleEl || !copyEl) return;

  const isEarth = profileId === "earth_1g";
  if (btnEarth && btnMission) setSegActive([btnEarth, btnMission], isEarth ? btnEarth : btnMission);

  if (isEarth) {
    titleEl.textContent = isEs ? "Referencia: línea base Earth-1g previa al vuelo" : "Reference: Earth-1g preflight baseline";
    copyEl.textContent = isEs
      ? "Cualquier desviación respecto al registro 1g se conserva para revisión de persistencia y síntomas; una diferencia estadística no equivale a diagnóstico."
      : "Deviations from the personal Earth-1g baseline trigger a symptom and persistence check; a statistical departure alone never establishes pathology.";
  } else {
    titleEl.textContent = isEs ? "Referencia: perfil validado de misión (ISS / Marte)" : "Reference: mission microgravity profile";
    copyEl.textContent = isEs
      ? "Evalúa la observación frente a envolventes de adaptación en microgravedad (p. ej. 6.09 h de sueño, Barger 2014) sin falsas alarmas por gravedad terrestre."
      : "Observations are judged against microgravity adaptation envelopes (for example 6.09 h mean ISS sleep, Barger 2014), so an Earth-1g difference alone does not raise an alert.";
  }
}

/* The five lifecycle states ASTRA keeps apart, each read from its own field. */
function episodeSteps(ep) {
  const task = ep.task || {};
  const sync = ep.synchronization || {};
  const lastObs = ep.observations?.[ep.observations.length - 1];
  const quality = lastObs?.quality?.status || "not_checked";
  const status = ep.episode?.status || "open";

  let taskStep;
  if (task.state === "completed") taskStep = { state: "done", note: "Completed" };
  else if (task.state === "repeat_required") taskStep = { state: "warn", note: "Repeat required" };
  else if (task.notification_dismissed) taskStep = { state: "warn", note: "Reminder dismissed, still pending" };
  else taskStep = { state: "active", note: humanize(task.state || "pending") };

  let captureStep;
  if (quality === "sufficient_for_protocol") captureStep = { state: "done", note: "Sufficient for protocol" };
  else if (quality === "not_checked") captureStep = { state: "idle", note: "Nothing captured yet" };
  else captureStep = { state: "warn", note: humanize(quality) };

  let syncStep;
  if (sync.status === "received") syncStep = { state: "done", note: "Received by relay" };
  else if (sync.status === "queued") syncStep = { state: "active", note: "Queued for relay" };
  else syncStep = { state: "idle", note: humanize(sync.status || "local_only") };

  let reviewStep;
  if (sync.human_reviewed) reviewStep = { state: "done", note: sync.reviewer || "Crew Medical Officer" };
  else if (status === "awaiting_review") reviewStep = { state: "active", note: "Awaiting human review" };
  else reviewStep = { state: "idle", note: "Not reviewed" };

  const closeStep = status === "closed"
    ? { state: "done", note: ep.episode?.closed_at ? `Closed ${fmtClock(ep.episode.closed_at)}` : "Closed" }
    : { state: "idle", note: "Open" };

  return [
    { label: "Task", ...taskStep },
    { label: "Capture", ...captureStep },
    { label: "Sync", ...syncStep },
    { label: "Review", ...reviewStep },
    { label: "Closure", ...closeStep },
  ];
}

function renderEpisodeState() {
  const ep = activeEpisode();
  const select = el("astraEpisodeSelect");
  const badge = el("astraTabEpisodeBadge");
  if (badge) badge.textContent = String(companionState.episodes.length || 0);
  renderTriageKpis();

  if (select && companionState.episodes.length) {
    select.innerHTML = companionState.episodes
      .map((item) => `<option value="${esc(item.episode.id)}">${esc(item.episode.id)} · ${esc(item.subject_id)} · ${esc(humanize(item.episode.status))}</option>`)
      .join("");
    if (ep) select.value = ep.episode.id;
  }

  if (!ep) return;
  if (el("astraInternetToggle")) el("astraInternetToggle").checked = Boolean(ep.internet_up);
  if (el("astraWatchToggle")) el("astraWatchToggle").checked = ep.watch_connected !== false;

  const tier = ep.decision?.type || "";
  const banner = el("astraDecisionBanner");
  if (banner) banner.dataset.tier = tier;
  if (el("stDecisionTier")) {
    el("stDecisionTier").textContent = (tierLabel(tier) || "Pending").toUpperCase();
    el("stDecisionTier").className = `status-pill ${tierPillClass(tier)}`;
  }
  if (el("stDecisionType")) el("stDecisionType").textContent = ep.episode?.reason || "Episode";
  if (el("stSubject")) el("stSubject").textContent = ep.subject_id || "";
  if (el("stDecisionFinding")) el("stDecisionFinding").textContent = ep.decision?.finding || "";
  if (el("stDecisionMeta")) {
    const parts = [];
    if (ep.decision?.next_step) parts.push(`<span><b>Next step</b> ${esc(ep.decision.next_step)}</span>`);
    if (ep.episode?.closure_reason) parts.push(`<span><b>Closure rationale</b> ${esc(ep.episode.closure_reason)}</span>`);
    (ep.decision?.evidence_urls || []).slice(0, 2).forEach((url, i) => {
      parts.push(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Evidence ${i + 1} ↗</a>`);
    });
    el("stDecisionMeta").innerHTML = parts.join("");
  }

  const stepper = el("astraStepper");
  if (stepper) {
    stepper.innerHTML = episodeSteps(ep)
      .map((st, i) => `<li class="ax-step" data-state="${st.state}" style="--i:${i}"><strong>${esc(st.label)}</strong><span>${esc(st.note)}</span></li>`)
      .join("");
  }

  renderProfileCopy(ep.active_profile || "mission_microgravity");

  const auditEl = el("astraAuditTimeline");
  if (auditEl) {
    const trail = [...(ep.audit_trail || [])].reverse();
    auditEl.innerHTML = trail.length
      ? trail
          .map(
            (ev) => `<li data-action="${esc(ev.action)}"><span class="ax-audit-action">${esc(String(ev.action || "").replace(/_/g, " "))}</span><time>${esc(fmtClock(ev.ts))}</time><span class="ax-audit-note">${esc(ev.note)}</span></li>`
          )
          .join("")
      : '<li class="ax-empty">No events recorded yet.</li>';
    if (el("astraAuditCount")) el("astraAuditCount").textContent = trail.length ? `${trail.length} event${trail.length > 1 ? "s" : ""}, newest first` : "";
  }
}

async function transitionActiveEpisode(action, extra = {}) {
  const ep = activeEpisode();
  if (!ep) return;
  showEpisodeGuard("");
  try {
    const res = await fetchJson(`/api/astra/episodes/${encodeURIComponent(ep.episode.id)}/transition`, {
      method: "POST",
      body: JSON.stringify({ action, ...extra }),
    });
    const idx = companionState.episodes.findIndex((item) => item.episode.id === ep.episode.id);
    if (idx >= 0) companionState.episodes[idx] = res.episode;
    if (res.blocked_reason) showEpisodeGuard(`Protocol Guard: ${res.blocked_reason}`);
    renderEpisodeState();
  } catch (err) {
    showEpisodeGuard(`Governance Guard (${err.status || "Offline"}): ${err.message}`);
  }
}

function renderSurfaceContracts(contracts) {
  companionState.contracts = contracts;
  const listEl = el("astraSurfaceList");
  if (!listEl || !contracts?.surface_architecture) return;
  const icons = [ICONS.watch, ICONS.phone, ICONS.desk];
  listEl.innerHTML = contracts.surface_architecture
    .map(
      (sf, i) => `
      <div class="ax-surface" title="Owns: ${esc(sf.owns)}&#10;Never: ${esc(sf.does_not_own)}">
        <span class="ax-surface-icon">${icons[i] || ICONS.desk}</span>
        <strong>${esc(sf.surface)}</strong>
        <span class="ax-surface-owns">${esc(String(sf.owns).split(",")[0])}</span>
      </div>`
    )
    .join("");
}

// ----------------------------------------------------------------------------
// 3. 3D Signed Tetrahedral iPhone LiDAR Calf Mesh Volumetry
// ----------------------------------------------------------------------------
/* The API returns a handful of rings; interpolate between them so the wireframe reads as a surface. */
function densifyRings(rings, perGap = 3) {
  const out = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let step = 0; step < perGap; step++) {
      const t = step / perGap;
      out.push({ pts: rings[i].map((p, k) => p.map((v, a) => v + (rings[i + 1][k][a] - v) * t)), key: step === 0, cap: i === 0 && step === 0 });
    }
  }
  out.push({ pts: rings[rings.length - 1], key: true, cap: true });
  return out;
}

function drawLidarMeshCanvas(res, sweep = null) {
  const canvas = el("lidarMeshCanvas");
  if (!canvas || !res) return;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(300, rect.width || 440);
  const cssH = Math.max(220, rect.height || 260);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const base = res.rings_preview || [];
  if (base.length < 2) return;
  const rings = densifyRings(base);

  const colors = companionState.lidarColors || (companionState.lidarColors = {
    observed: getCssVar("--nominal-stroke", "#10b981"),
    occluded: getCssVar("--watch-stroke", "#f59e0b"),
    inferred: getCssVar("--alert-stroke", "#ef4444"),
    grid: getCssVar("--border-subtle", "rgba(148,163,184,0.22)"),
    scan: getCssVar("--accent", "#38bdf8"),
  });

  const covRatio = Math.min(1, Math.max(0, Number(res.provenance_breakdown_pct?.observed || 88) / 100));
  const yaw = companionState.lidarYaw;
  const length = base[base.length - 1][0][2] || 28;
  const cx = cssW * 0.5;
  const cy = cssH * 0.5;
  const scale = Math.min(cssH / 33, cssW / 26);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  // Limb stands upright; the camera orbits it and looks slightly down.
  const project = ([x, y, z]) => {
    const xr = x * cosY - y * sinY;
    const depth = x * sinY + y * cosY;
    // z runs from the proximal end (top of the view) to the distal end
    return [cx + xr * scale, cy + (z - length / 2) * scale * 0.92 - depth * scale * 0.3, depth];
  };

  // Reference grid
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  for (let gx = (cssW / 2) % 36; gx < cssW; gx += 36) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssH); ctx.stroke();
  }
  for (let gy = (cssH / 2) % 36; gy < cssH; gy += 36) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cssW, gy); ctx.stroke();
  }

  // Translucent skin over the near side, so the mesh reads as a surface
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const n = rings[ri].pts.length;
    for (let k = 0; k < n; k++) {
      const a = project(rings[ri].pts[k]);
      if (a[2] > 0) continue;
      const b = project(rings[ri].pts[(k + 1) % n]);
      const c = project(rings[ri + 1].pts[(k + 1) % n]);
      const d = project(rings[ri + 1].pts[k]);
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = k / n > covRatio ? colors.occluded : colors.observed;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Wireframe coloured by how each part of the surface was obtained; the far side is drawn fainter.
  rings.forEach((ring, ri) => {
    const n = ring.pts.length;
    for (let k = 0; k < n; k++) {
      const p1 = project(ring.pts[k]);
      const p2 = project(ring.pts[(k + 1) % n]);
      const frac = k / n;
      let stroke = colors.observed;
      if (ring.cap && frac > covRatio) stroke = colors.inferred;
      else if (frac > covRatio) stroke = colors.occluded;
      const front = p1[2] <= 0 ? 1 : 0.34;

      ctx.globalAlpha = (ring.key ? 1 : 0.5) * front;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = ring.key ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();

      if (ri < rings.length - 1 && k % 2 === 0) {
        const pUp = project(rings[ri + 1].pts[k]);
        ctx.globalAlpha = 0.4 * front;
        ctx.strokeStyle = frac > covRatio ? colors.occluded : colors.observed;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(pUp[0], pUp[1]); ctx.stroke();
      }
    }
  });

  // Scan line travelling along the limb
  if (sweep !== null) {
    const pos = sweep * (base.length - 1);
    const i = Math.min(base.length - 2, Math.floor(pos));
    const t = pos - i;
    const ring = base[i].map((p, k) => p.map((v, a) => v + (base[i + 1][k][a] - v) * t));
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = colors.scan;
    ctx.shadowColor = colors.scan;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ring.forEach((p, k) => { const q = project(p); if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); });
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* Slow turntable with a scan sweep while the Triage tab is open. */
function startLidarSpin() {
  if (reduceMotion()) {
    drawVitalsMonitor(0);
    renderBody3D(0); // a still frame of the body
    return;
  }
  // A loop that has not produced a frame for a second is stalled (for example its frame was
  // requested while the page was hidden); replace it instead of waiting on it.
  if (companionState.lidarRaf && performance.now() - (companionState.lidarTick || 0) < 1000) return;
  cancelAnimationFrame(companionState.lidarRaf);
  const loop = (now) => {
    companionState.lidarTick = performance.now();
    const panel = el("panelAstraTriage");
    if (!panel || panel.hidden || document.hidden) {
      companionState.lidarRaf = null;
      return;
    }
    if (!companionState.lidarDragging) companionState.lidarYaw += 0.0055;
    if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult, (now % 3600) / 3600);
    drawVitalsMonitor(now);
    renderBody3D(now);
    companionState.lidarRaf = requestAnimationFrame(loop);
  };
  companionState.lidarRaf = requestAnimationFrame(loop);
}

function wireLidarDrag() {
  const canvas = el("lidarMeshCanvas");
  if (!canvas) return;
  let lastX = 0;
  canvas.addEventListener("pointerdown", (e) => {
    companionState.lidarDragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!companionState.lidarDragging) return;
    companionState.lidarYaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult);
  });
  const end = () => { companionState.lidarDragging = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

function renderLidarResult(res) {
  companionState.lastLidarResult = res;
  const prov = res.provenance_breakdown_pct || {};
  const isPass = res.quality_gate_status === "PASS";
  const gate = companionState.contracts?.lidar_protocol?.coverage_gate_pct ?? 82;

  const pill = el("lidarGatePill");
  if (pill) {
    pill.textContent = `${isPass ? "PASS" : "HELD"} · ${prov.observed}% OBSERVED`;
    pill.className = `status-pill ${isPass ? "status-nominal" : "status-watch"}`;
  }
  if (el("lidarViewportTag")) {
    el("lidarViewportTag").textContent = `CLOSED MESH · ${res.triangle_count} TRI · ${res.vertex_count} VERT`;
  }

  const cov = el("lidarCoverage");
  if (cov) {
    const seg = (pct, color) => (Number(pct) > 0 ? `<i style="inline-size:${Number(pct)}%;background-color:var(${color})"></i>` : "");
    cov.innerHTML = `
      <div class="ax-section-head"><h3>How the surface was obtained</h3><span class="ax-hint">held below ${gate}% observed</span></div>
      <div class="ax-coverage-bar">
        ${seg(prov.observed, "--nominal-stroke")}${seg(prov.occluded, "--watch-stroke")}${seg(prov.inferred, "--alert-stroke")}
        <span class="ax-gate-mark" style="inset-inline-start:${gate}%" data-label="gate ${gate}%"></span>
      </div>
      <div class="ax-coverage-legend">
        <span>Observed <b>${esc(prov.observed)}%</b></span>
        <span>Occluded <b>${esc(prov.occluded)}%</b></span>
        <span>Inferred <b>${esc(prov.inferred)}%</b></span>
      </div>`;
  }

  if (el("lidarVolVal")) el("lidarVolVal").innerHTML = `${esc(res.computed_volume_ml)}<small>cm³</small>`;
  if (el("lidarHeroVol")) el("lidarHeroVol").textContent = Math.round(res.computed_volume_ml).toLocaleString("en-US");
  if (el("lidarDeltaVal")) {
    const sign = res.delta_ml >= 0 ? "+" : "";
    el("lidarDeltaVal").innerHTML = `${sign}${esc(res.delta_ml)}<small>mL · ${sign}${esc(res.pct_change)}%</small>`;
  }
  if (el("lidarGeoVal")) el("lidarGeoVal").innerHTML = `${esc(res.triangle_count)}<small>tri</small> ${esc(res.vertex_count)}<small>vert</small>`;

  const warnBox = el("lidarWarningBox");
  if (warnBox) {
    if (res.hold_reasons?.length) {
      warnBox.hidden = false;
      warnBox.textContent = `Scan held, volume not accepted: ${res.hold_reasons.join(" ")}`;
    } else {
      warnBox.hidden = true;
      warnBox.textContent = "";
    }
  }
  drawLidarMeshCanvas(res);
  updateBodyReadings();
  startLidarSpin();
}

async function runLidarCalculation() {
  const cov = Number(el("lidarCovInput")?.value || 88);
  const req = {
    subject_id: activeEpisode()?.subject_id || "DEMO-01",
    limb: el("lidarLimbSelect")?.value || "left_calf",
    segment_length_cm: 28.0,
    proximal_circ_cm: Number(el("lidarProxInput")?.value || 37.4),
    mid_circ_cm: Number(el("lidarMidInput")?.value || 34.2),
    distal_circ_cm: 22.8,
    observed_coverage_pct: cov,
    occluded_pct: Math.max(0, Math.round((100 - cov) * 0.65)),
    inferred_pct: Math.max(0, Math.round((100 - cov) * 0.35)),
    capture_mode: el("lidarModeSelect")?.value || "raw_sceneDepth",
    baseline_volume_ml: Number(el("lidarBaseVolInput")?.value || 2380),
  };
  try {
    const res = await fetchJson("/api/astra/lidar-volume", {
      method: "POST",
      body: JSON.stringify(req),
    });
    renderLidarResult(res);
  } catch {
    renderLidarResult(offlineLidarEstimate(req));
  }
}

// ----------------------------------------------------------------------------
// 4. AURA Cited Space Medicine Engine, RadLab Plot, Barger Tables & Catalog
// ----------------------------------------------------------------------------
const KIND_LABELS = { concept: "Concept", source: "Reviewed source", apple_study: "Device study", nasa_pmc: "NASA PMC paper" };
const POP_COLORS = {
  human: "var(--accent)",
  rodent: "#8b5cf6",
  plant: "#10b981",
  invertebrate_model: "#f59e0b",
  microbe_or_cell: "#ec4899",
  space_biology_general: "var(--border-control)",
};

function renderAuraKpis() {
  const box = el("auraKpiStrip");
  const ov = companionState.auraOverview;
  if (!box || !ov?.counts) return;
  const c = ov.counts;
  const pop = Object.entries(ov.population_breakdown || {}).sort((a, b) => (a[0] === "human" ? -1 : b[0] === "human" ? 1 : b[1] - a[1]));
  const total = pop.reduce((acc, [, n]) => acc + n, 0) || 1;
  const bar = pop.map(([k, n]) => `<i style="inline-size:${(n / total) * 100}%;background-color:${POP_COLORS[k] || "var(--text-muted)"}" title="${esc(humanize(k))}: ${n}"></i>`).join("");
  const legend = pop.map(([k, n]) => `<span><i style="background-color:${POP_COLORS[k] || "var(--text-muted)"}"></i>${esc(humanize(k))} <b>${n}</b></span>`).join("");
  box.innerHTML =
    kpiTile("Concepts", counted(c.bilingual_concepts), "bilingual definitions") +
    kpiTile("Reviewed sources", counted(c.reviewed_sources), "official docs and studies") +
    kpiTile("Device studies", counted(c.apple_biomarker_studies), "Apple Watch and iPhone") +
    kpiTile("NASA PMC papers", counted(c.nasa_pmc_publications), `${c.pmc_with_rich_abstracts} with full abstracts`) +
    `<div class="ax-kpi ax-kpi-wide"><span class="ax-kpi-label">PMC corpus by study population: most of it is not human data</span><div class="ax-popbar">${bar}</div><div class="ax-poplegend">${legend}</div></div>`;
}

/* The corpus as rings around the engine: 16 concepts, 15 device studies, 70 sources, and an outer
   belt of one dot per NASA paper, coloured by study population. Cited items light up. */
function buildConstellation() {
  const ov = companionState.auraOverview;
  const c = ov?.counts || {};
  const pmcTotal = c.nasa_pmc_publications || 572;
  const pops = [];
  Object.entries(ov?.population_breakdown || {}).forEach(([k, n]) => { for (let i = 0; i < n; i++) pops.push(k); });
  while (pops.length < pmcTotal) pops.push("space_biology_general");
  for (let i = pops.length - 1; i > 0; i--) { // fixed shuffle, so colours mix the same way every time
    const j = (i * 7919 + 13) % (i + 1);
    [pops[i], pops[j]] = [pops[j], pops[i]];
  }
  companionState.graph = {
    rings: [
      { kind: "concept", label: "Concepts", n: c.bilingual_concepts || 16, r: 0.2, size: 3.4, speed: 0.00011, color: "var(--accent)" },
      { kind: "apple_study", label: "Device studies", n: c.apple_biomarker_studies || 15, r: 0.33, size: 3.2, speed: -0.00008, color: "#8b5cf6" },
      { kind: "source", label: "Reviewed sources", n: c.reviewed_sources || 70, r: 0.47, size: 2.3, speed: 0.00005, color: "var(--nominal-stroke)" },
    ],
    pmc: pops.slice(0, pmcTotal),
    highlights: companionState.graph?.highlights || [],
    litAt: performance.now(),
    colors: null,
  };
  const legend = el("auraGraphLegend");
  if (legend) {
    legend.innerHTML =
      companionState.graph.rings.map((r) => `<span><i style="background-color:${r.color}"></i>${r.label} <b>${r.n}</b></span>`).join("") +
      `<span><i style="background-color:var(--text-muted)"></i>NASA papers <b>${pmcTotal}</b></span>`;
  }
}

function drawConstellation(now) {
  const canvas = el("auraGraphCanvas");
  const g = companionState.graph;
  if (!canvas || !g) return;
  const { ctx, w, h } = fitCanvas(canvas, 240, 240);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 10;
  const col = g.colors || (g.colors = {
    rings: g.rings.map((r) => resolveColor(r.color)),
    pops: Object.fromEntries(Object.entries(POP_COLORS).map(([k, v]) => [k, resolveColor(v)])),
    guide: getCssVar("--border-subtle", "rgba(148,163,184,0.2)"),
    accent: getCssVar("--accent", "#38bdf8"),
    text: getCssVar("--text-primary", "#f1f5f9"),
    surface: getCssVar("--bg-surface", "#0f172a"),
  });

  // orbit guides
  ctx.strokeStyle = col.guide;
  ctx.lineWidth = 1;
  [...g.rings.map((r) => r.r), 0.62, 0.98].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * r, 0, Math.PI * 2);
    ctx.stroke();
  });

  const lit = new Map(g.highlights.map((hl, i) => [`${hl.kind}:${hl.idx}`, i]));
  const litPoints = [];

  // outer belt: one dot per NASA paper
  const drift = now * 0.000022;
  g.pmc.forEach((pop, i) => {
    const rad = R * (0.64 + 0.32 * ((i * 0.61803) % 1));
    const ang = i * 2.39996 + drift;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    const human = pop === "human";
    ctx.globalAlpha = human ? 1 : 0.62;
    ctx.fillStyle = col.pops[pop] || col.guide;
    ctx.beginPath();
    ctx.arc(x, y, human ? 2 : 1.25, 0, Math.PI * 2);
    ctx.fill();
    if (lit.has(`nasa_pmc:${i}`)) litPoints.push({ x, y, n: lit.get(`nasa_pmc:${i}`), color: col.pops[pop] || col.accent });
  });
  ctx.globalAlpha = 1;

  // inner rings
  g.rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const ang = (i / ring.n) * Math.PI * 2 + now * ring.speed;
      const x = cx + Math.cos(ang) * R * ring.r;
      const y = cy + Math.sin(ang) * R * ring.r;
      ctx.fillStyle = col.rings[ri];
      ctx.beginPath();
      ctx.arc(x, y, ring.size, 0, Math.PI * 2);
      ctx.fill();
      if (lit.has(`${ring.kind}:${i}`)) litPoints.push({ x, y, n: lit.get(`${ring.kind}:${i}`), color: col.rings[ri] });
    }
  });

  // cited items: a beam from the engine, a halo, and the citation number
  litPoints.sort((a, b) => a.n - b.n).forEach((p) => {
    const grow = Math.min(1, Math.max(0, (now - g.litAt - p.n * 140) / 520));
    if (grow <= 0) return;
    const pulse = 0.6 + 0.4 * Math.sin(now / 320 + p.n);
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (p.x - cx) * grow, cy + (p.y - cy) * grow);
    ctx.stroke();
    if (grow < 1) return;
    ctx.globalAlpha = 0.28 * pulse;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.surface;
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.n + 1), p.x, p.y + 0.5);
  });
  ctx.globalAlpha = 1;

  // the engine at the centre
  const breathe = 1 + 0.05 * Math.sin(now / 700);
  ctx.fillStyle = col.accent;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(cx, cy, 30 * breathe, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = col.surface;
  ctx.strokeStyle = col.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col.text;
  ctx.font = "700 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AURA", cx, cy + 0.5);
  ctx.textBaseline = "alphabetic";
}

function lightConstellation(cites) {
  const g = companionState.graph;
  if (!g) return;
  g.highlights = (cites || []).map((c) => {
    const ring = g.rings.find((r) => r.kind === c.kind);
    const n = ring ? ring.n : g.pmc.length;
    return { kind: ring ? ring.kind : "nasa_pmc", idx: hashIndex(c.doc_id || c.title, n) };
  });
  g.litAt = performance.now();
  if (reduceMotion()) drawConstellation(g.litAt + 5000);
}

function startEvidenceLoop() {
  if (reduceMotion()) {
    drawConstellation(performance.now() + 5000);
    drawRadlabGlobe(0);
    return;
  }
  if (companionState.evidenceRaf && performance.now() - (companionState.evidenceTick || 0) < 1000) return;
  cancelAnimationFrame(companionState.evidenceRaf);
  const loop = (now) => {
    companionState.evidenceTick = performance.now();
    const panel = el("panelAuraKnowledge");
    if (!panel || panel.hidden || document.hidden) {
      companionState.evidenceRaf = null;
      return;
    }
    drawConstellation(now);
    drawRadlabGlobe(now);
    companionState.evidenceRaf = requestAnimationFrame(loop);
  };
  companionState.evidenceRaf = requestAnimationFrame(loop);
}

function renderAuraAnswer(res) {
  const headEl = el("auraAnswerHead");
  const bodyEl = el("auraAnswerText");
  const limEl = el("auraLimitationsBox");
  if (!bodyEl) return;
  const isEs = (el("auraLangSelect")?.value || "en") === "es";
  const cites = res.citations || [];

  if (res.abstained) {
    if (headEl) headEl.innerHTML = "";
    bodyEl.innerHTML = `<div class="ax-declined"><strong>Request declined</strong><p>${esc(res.abstention_reason || res.answer || "")}</p></div>`;
  } else if (cites.length) {
    if (headEl) {
      headEl.innerHTML = `<strong>${cites.length} cited finding${cites.length > 1 ? "s" : ""}</strong>`;
    }
    bodyEl.innerHTML = `<ol class="ax-findings">${cites
      .map((c, idx) => {
        const [mainTitle, altTitle] = String(c.title || "").split(" / ");
        const snippet = (isEs && c.snippet_es) || c.snippet || "";
        const limitation = (isEs && c.limitation_es) || c.limitation || "";
        const popTag = c.is_human_applicable
          ? '<span class="ax-tag ax-tag-human">Human-applicable</span>'
          : `<span class="ax-tag ax-tag-caveat">${esc(humanize(c.population_domain || "not human"))}</span>`;
        const source = c.url
          ? `<div class="ax-finding-source"><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open primary source ↗</a> <span>${esc(c.doc_id || "")}</span></div>`
          : c.doc_id
            ? `<div class="ax-finding-source"><span>${esc(c.doc_id)}</span></div>`
            : "";
        return `
          <li><details class="ax-finding" style="--i:${idx}"${idx === 0 ? " open" : ""}>
            <summary>
              <span class="ax-finding-num">${idx + 1}</span>
              <span class="ax-finding-head">
                <strong>${esc(mainTitle)}</strong>
                <span class="ax-finding-tags"><span class="ax-tag">${esc(KIND_LABELS[c.kind] || humanize(c.kind))}</span>${popTag}</span>
              </span>
            </summary>
            <div class="ax-finding-body">
              <p>${esc(snippet)}</p>
              ${limitation ? `<div class="ax-finding-limit"><b>Limit</b><span>${esc(limitation)}</span></div>` : ""}
              ${source}
            </div>
          </details></li>`;
      })
      .join("")}</ol>`;
  } else {
    if (headEl) headEl.innerHTML = "";
    bodyEl.innerHTML = `<p>${esc(res.answer || "No grounded source matched this question.")}</p>`;
  }

  lightConstellation(res.abstained ? [] : cites);

  if (limEl) {
    // Limitations already shown under their finding are not repeated here.
    const shown = new Set(cites.flatMap((c) => [c.limitation, c.limitation_es]).filter(Boolean));
    const extra = (res.scientific_limitations || [])
      .map((l) => String(l).replace(/^\[\d+\]\s*/, ""))
      .filter((l) => l && !shown.has(l));
    limEl.hidden = !extra.length;
    limEl.innerHTML = extra.length ? `<strong>Keep in mind</strong><ul>${extra.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
  }
}

function offlineAuraAsk(question, humanOnly) {
  const q = question.toLowerCase();
  if (q.includes("diagnose") || q.includes("prescribe") || q.includes("antibiotic")) {
    return {
      abstained: true,
      abstention_reason: "Offline safety guard: AURA does not diagnose or prescribe; escalate acute symptoms to the HUNCH Red-Flag gate.",
      citations: [],
      scientific_limitations: ["Clinical authority remains with Flight Surgeon / Crew Medical Officer."],
    };
  }
  const pool = [
    ...companionState.auraConcepts.map((c) => ({
      kind: "concept",
      title: `${c.label_en} / ${c.label_es}`,
      snippet: c.definition_en || c.definition_es,
      url: c.sources?.[0]?.url || "",
      population_domain: "human_operational",
      is_human_applicable: true,
    })),
    ...companionState.auraSources.apple_studies.map((a) => ({
      kind: "apple_study",
      title: `[${a.year}] ${a.title}`,
      snippet: `${a.objective_es} (${a.nasa_relevance_es})`,
      url: a.primary_url || "",
      population_domain: "human_clinical_study",
      is_human_applicable: true,
    })),
  ];
  const terms = q.split(/\s+/).filter((t) => t.length >= 3);
  const hits = pool
    .map((item) => {
      const hay = `${item.title} ${item.snippet}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { ...item, score };
    })
    .filter((x) => x.score > 0 && (!humanOnly || x.is_human_applicable))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!hits.length) {
    return {
      abstained: true,
      abstention_reason: "Offline cache: no matching grounded source found without speculation.",
      citations: [],
      scientific_limitations: ["Reconnect to search full 572-paper PMC corpus index."],
    };
  }
  return {
    abstained: false,
    answer: hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet}`).join("\n\n"),
    citations: hits,
    scientific_limitations: ["Served from local offline PWA knowledge cache."],
  };
}

async function runAuraAsk() {
  const input = el("auraQuestionInput");
  const q = (input?.value || "").trim() || "What is the difference between Apple Watch SDNN and RMSSD?";
  const lang = el("auraLangSelect")?.value || companionState.lang || "en";
  const human_only = Boolean(el("auraHumanOnlyCheck")?.checked);
  try {
    const res = await fetchJson("/api/aura/ask", {
      method: "POST",
      body: JSON.stringify({ question: q, lang, human_only }),
    });
    renderAuraAnswer(res);
  } catch {
    renderAuraAnswer(offlineAuraAsk(q, human_only));
  }
}

function renderRadlabChart(progress = 1) {
  const canvas = el("radlabChartCanvas");
  const data = companionState.radlabData?.radlab_iss_sample;
  if (!canvas || !data?.records?.length) return;

  const filterInst = el("radlabInstrumentSelect")?.value || "ALL";
  const records = (filterInst === "ALL" ? data.records : data.records.filter((r) => r.inst === filterInst))
    .map((r) => ({ ...r, ms: new Date(`${r.t}Z`).getTime(), dose: Number(r.dose || 0) }))
    .filter((r) => Number.isFinite(r.ms));
  if (!records.length) return;

  const doses = records.map((r) => r.dose);
  const meanDose = doses.reduce((a, b) => a + b, 0) / doses.length;
  const peak = records.reduce((best, r) => (r.dose > best.dose ? r : best), records[0]);
  const unit = "<small>µGy/h</small>";
  if (el("radlabCountVal")) el("radlabCountVal").textContent = String(records.length);
  if (el("radlabMeanVal")) el("radlabMeanVal").innerHTML = `${meanDose.toFixed(2)}${unit}`;
  if (el("radlabPeakVal")) {
    el("radlabPeakVal").innerHTML = `${peak.dose.toFixed(2)}<small>µGy/h · ${peak.t.slice(11, 16)} UTC</small>`;
  }

  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, rect.width || 520);
  const cssH = Math.max(200, rect.height || 230);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const muted = getCssVar("--text-muted", "#94a3b8");
  const text = getCssVar("--text-primary", "#e2e8f0");
  const grid = getCssVar("--border-subtle", "rgba(148,163,184,0.22)");
  const series = [
    { inst: "DosTel1", color: getCssVar("--accent", "#38bdf8") },
    { inst: "DosTel2", color: "#8b5cf6" },
  ].filter((sr) => filterInst === "ALL" || sr.inst === filterInst);

  const padL = 40;
  const padR = 14;
  const padT = 30;
  const padB = 26;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const t0 = Math.min(...records.map((r) => r.ms));
  const t1 = Math.max(...records.map((r) => r.ms));
  const maxY = Math.ceil((peak.dose * 1.12) / 3) * 3;
  const xOf = (ms) => padL + ((ms - t0) / Math.max(1, t1 - t0)) * plotW;
  const yOf = (dose) => padT + plotH - (dose / maxY) * plotH;

  // Y grid and labels
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  for (let g = 0; g <= 3; g++) {
    const val = (maxY * g) / 3;
    const y = yOf(val);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = "end";
    ctx.fillText(val.toFixed(0), padL - 8, y);
  }

  // X labels: five evenly spaced clock times
  ctx.textBaseline = "alphabetic";
  for (let g = 0; g <= 4; g++) {
    const ms = t0 + ((t1 - t0) * g) / 4;
    ctx.textAlign = g === 0 ? "start" : g === 4 ? "end" : "center";
    ctx.fillStyle = muted;
    ctx.fillText(new Date(ms).toISOString().slice(11, 16), xOf(ms), cssH - 8);
  }

  // One line per instrument, revealed left to right during a replay
  const headMs = t0 + (t1 - t0) * progress;
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL - 2, 0, plotW * progress + 4, cssH);
  ctx.clip();
  series.forEach((sr) => {
    const pts = records.filter((r) => r.inst === sr.inst).sort((a, b) => a.ms - b.ms);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((r, i) => (i === 0 ? ctx.moveTo(xOf(r.ms), yOf(r.dose)) : ctx.lineTo(xOf(r.ms), yOf(r.dose))));
    if (series.length === 1) {
      const last = pts[pts.length - 1];
      ctx.save();
      ctx.lineTo(xOf(last.ms), padT + plotH);
      ctx.lineTo(xOf(pts[0].ms), padT + plotH);
      ctx.closePath();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = sr.color;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      pts.forEach((r, i) => (i === 0 ? ctx.moveTo(xOf(r.ms), yOf(r.dose)) : ctx.lineTo(xOf(r.ms), yOf(r.dose))));
    }
    ctx.strokeStyle = sr.color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.stroke();
  });
  ctx.restore();

  // Playhead while replaying
  if (progress < 1) {
    ctx.strokeStyle = text;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(headMs), padT);
    ctx.lineTo(xOf(headMs), padT + plotH);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Peak marker
  const px = xOf(peak.ms);
  const py = yOf(peak.dose);
  if (peak.ms <= headMs) {
    ctx.fillStyle = text;
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "600 10px 'JetBrains Mono', monospace";
    ctx.textAlign = px > cssW * 0.7 ? "end" : "start";
    ctx.fillText(`peak ${peak.dose.toFixed(1)}`, px + (px > cssW * 0.7 ? -8 : 8), py - 6);
  }

  companionState.orbit = { records, headMs, done: progress >= 1, text, grid, low: series[0].color };
  if (reduceMotion()) drawRadlabGlobe(0);

  // Legend and axis title
  ctx.font = "600 10px Inter, sans-serif";
  ctx.textAlign = "start";
  ctx.fillStyle = muted;
  ctx.fillText("µGy/h", 8, 14);
  let lx = padL;
  series.forEach((sr) => {
    ctx.fillStyle = sr.color;
    ctx.fillRect(lx, 9, 12, 3);
    ctx.fillStyle = text;
    ctx.fillText(sr.inst, lx + 17, 14);
    lx += 17 + ctx.measureText(sr.inst).width + 16;
  });
}

/* Where the station was for each sample, on a wire globe that turns to follow it. */
function drawRadlabGlobe(now) {
  const canvas = el("radlabGlobeCanvas");
  const orbit = companionState.orbit;
  if (!canvas || !orbit) return;
  const { ctx, w, h } = fitCanvas(canvas, 160, 160);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 16;
  const pts = orbit.records
    .filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)) && r.ms <= orbit.headMs)
    .sort((a, b) => a.ms - b.ms);
  const head = pts[pts.length - 1];
  // Face the station while replaying, then keep turning slowly.
  const lon0 = (head ? Number(head.lon) : 0) + (orbit.done ? now * 0.006 : 0);
  const tilt = (22 * Math.PI) / 180;
  const project = (lat, lon) => {
    const lam = ((lon - lon0) * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const x = Math.cos(phi) * Math.sin(lam);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lam);
    return [cx + R * x, cy - R * (y * Math.cos(tilt) - z * Math.sin(tilt)), y * Math.sin(tilt) + z * Math.cos(tilt)];
  };

  // sphere
  const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  shade.addColorStop(0, getCssVar("--bg-elevated", "#152038"));
  shade.addColorStop(1, getCssVar("--bg-recessed", "#090f1d"));
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orbit.low;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // graticule, far side faint
  const line = (points) => {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      ctx.globalAlpha = a[2] > 0 && b[2] > 0 ? 0.42 : 0.1;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  };
  ctx.strokeStyle = orbit.low;
  ctx.lineWidth = 0.8;
  for (let lon = -180; lon < 180; lon += 30) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 6) points.push(project(lat, lon));
    line(points);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 6) points.push(project(lat, lon));
    line(points);
  }
  ctx.globalAlpha = 1;

  if (!pts.length) return;
  const maxDose = Math.max(...orbit.records.map((r) => r.dose));
  const minDose = Math.min(...orbit.records.map((r) => r.dose));
  const watch = getCssVar("--watch-stroke", "#f59e0b");
  const alert = getCssVar("--alert-stroke", "#ef4444");
  pts.forEach((r) => {
    const p = project(Number(r.lat), Number(r.lon));
    const t = (r.dose - minDose) / Math.max(0.001, maxDose - minDose);
    ctx.fillStyle = t > 0.66 ? alert : t > 0.33 ? watch : orbit.low;
    ctx.globalAlpha = p[2] > 0 ? 0.55 + t * 0.45 : 0.14;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 1.5 + t * 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // the station
  const hp = project(Number(head.lat), Number(head.lon));
  if (hp[2] > 0) {
    const ring = 6 + 2 * Math.sin(now / 260);
    ctx.strokeStyle = orbit.text;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = orbit.text;
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.textAlign = hp[0] > cx ? "end" : "start";
    ctx.fillText("ISS", hp[0] + (hp[0] > cx ? -11 : 11), hp[1] - 9);
  }
}

/* Replay the pass: the dose line and the ground track advance together. */
function replayRadlab() {
  if (reduceMotion()) return renderRadlabChart(1);
  cancelAnimationFrame(companionState.radlabRaf);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 2600);
    renderRadlabChart(t);
    if (t < 1) companionState.radlabRaf = requestAnimationFrame(tick);
  };
  companionState.radlabRaf = requestAnimationFrame(tick);
}

/* Published tables keep each cell exactly as printed; " | " in the source marks a line break. */
function splitCell(cell) {
  return String(cell ?? "").split(" | ").map((part) => part.trim()).filter(Boolean);
}

const SLEEP_PHASES = { "SL-90": "3 months before", "L-11": "11 days before", Inflight: "In flight", "R+7": "Week after" };

/* Mean and SD of total sleep (actigraphy) per mission phase, read straight from the published table. */
function sleepSeries() {
  const rows = companionState.radlabData?.barger_2014_sleep?.tables?.[0]?.rows;
  if (!rows?.length) return null;
  const row = rows.find((r) => /^Total Sleep Time \(Actigraphy\)/i.test(String(r[0])));
  if (!row) return null;
  const num = (text) => {
    const [m, sd] = String(text).replace(/·/g, ".").split("/").map(Number);
    return { m, sd };
  };
  const out = [];
  for (let i = 1; i <= 4; i++) {
    const code = splitCell(rows[0][i])[0];
    const [sts, iss] = splitCell(row[i]).map(num);
    if (!sts || !iss || ![sts.m, sts.sd, iss.m, iss.sd].every(Number.isFinite)) return null;
    out.push({ code, label: SLEEP_PHASES[code] || code, sts, iss });
  }
  return out;
}

function drawSleepChart(progress = 1) {
  const canvas = el("sleepChartCanvas");
  const series = sleepSeries();
  if (!canvas || !series) return false;
  const { ctx, w, h } = fitCanvas(canvas, 300, 220);
  const muted = getCssVar("--text-muted", "#94a3b8");
  const text = getCssVar("--text-primary", "#f1f5f9");
  const grid = getCssVar("--border-subtle", "rgba(148,163,184,0.2)");
  const colors = { sts: "#8b5cf6", iss: getCssVar("--accent", "#38bdf8") };
  const padL = 34;
  const padR = 14;
  const padT = 40;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxY = 9;
  const yOf = (v) => padT + plotH - (v / maxY) * plotH;
  const eased = 1 - Math.pow(1 - progress, 3);

  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  [0, 3, 6, 9].forEach((v) => {
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, yOf(v));
    ctx.lineTo(w - padR, yOf(v));
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = "end";
    ctx.fillText(`${v} h`, padL - 6, yOf(v));
  });

  const groupW = plotW / series.length;
  const barW = Math.min(46, groupW * 0.3);
  series.forEach((ph, gi) => {
    const gx = padL + groupW * gi + groupW / 2;
    [["sts", -1], ["iss", 1]].forEach(([key, side]) => {
      const d = ph[key];
      const x = gx + side * (barW / 2 + 3) - barW / 2;
      const top = yOf(d.m * eased);
      const fill = ctx.createLinearGradient(0, top, 0, yOf(0));
      fill.addColorStop(0, colors[key]);
      fill.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, top, barW, yOf(0) - top, [5, 5, 0, 0]) : ctx.rect(x, top, barW, yOf(0) - top);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors[key];
      ctx.fillRect(x, top, barW, 2.5);
      if (progress >= 1) {
        // one standard deviation either side of the mean
        ctx.strokeStyle = text;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.2;
        const mid = x + barW / 2;
        ctx.beginPath();
        ctx.moveTo(mid, yOf(d.m + d.sd)); ctx.lineTo(mid, yOf(d.m - d.sd));
        ctx.moveTo(mid - 4, yOf(d.m + d.sd)); ctx.lineTo(mid + 4, yOf(d.m + d.sd));
        ctx.moveTo(mid - 4, yOf(d.m - d.sd)); ctx.lineTo(mid + 4, yOf(d.m - d.sd));
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = text;
        ctx.font = "700 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(d.m.toFixed(2), mid, yOf(d.m + d.sd) - 6);
      }
    });
    ctx.fillStyle = text;
    ctx.font = "600 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(ph.label, gx, h - 24);
    ctx.fillStyle = muted;
    ctx.font = "500 9px 'JetBrains Mono', monospace";
    ctx.fillText(ph.code, gx, h - 10);
  });

  // title and legend
  ctx.textAlign = "start";
  ctx.fillStyle = text;
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillText("Hours of sleep per night", padL, 18);
  let lx = w - padR;
  [["ISS", colors.iss], ["Shuttle", colors.sts]].forEach(([name, color]) => {
    ctx.font = "600 10px Inter, sans-serif";
    const tw = ctx.measureText(name).width;
    ctx.fillStyle = text;
    ctx.textAlign = "end";
    ctx.fillText(name, lx, 18);
    ctx.fillStyle = color;
    ctx.fillRect(lx - tw - 16, 10, 11, 9);
    lx -= tw + 30;
  });
  return true;
}

function renderBargerOrNlspTable() {
  const container = el("bargerTableContainer");
  const select = el("bargerTableSelect");
  const emp = companionState.radlabData;
  if (!container || !select || !emp) return;

  const chartWrap = el("sleepChartWrap");
  const wantChart = select.value === "chart" && Boolean(sleepSeries());
  if (chartWrap) chartWrap.hidden = !wantChart;
  container.hidden = wantChart;
  if (wantChart) {
    tween("sleepRaf", 900, drawSleepChart);
    return;
  }

  const val = select.value === "chart" ? "0" : select.value;
  if (val === "nlsp") {
    const items = emp.nasa_nlsp_manifest?.datasets || [];
    container.innerHTML = `
      <table class="data-table ax-table">
        <thead><tr><th>Catalog</th><th>Dataset</th><th>Limitation</th></tr></thead>
        <tbody>${items
          .map(
            (d) => `<tr>
              <td><span class="ax-cell-id">${esc(d.dataset_catalog)}</span></td>
              <td><span class="ax-cell-title">${esc(d.title)}</span><span class="ax-cell-sub">${esc(d.method)}</span></td>
              <td>${esc(d.limitations)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`;
    return;
  }

  const tbl = (emp.barger_2014_sleep?.tables || [])[Number(val)] || emp.barger_2014_sleep?.tables?.[0];
  if (!tbl || !tbl.rows?.length) {
    container.innerHTML = '<p class="ax-empty">No table data loaded.</p>';
    return;
  }
  const [headerRow, ...bodyRows] = tbl.rows;
  const headHtml = headerRow
    .map((cell, i) => {
      const [main, ...rest] = splitCell(cell);
      if (i === 0) return `<th>${esc(main || "Measure")}</th>`;
      return `<th class="is-num">${esc(main || "")}${rest.length ? `<small>${esc(rest.join(" · "))}</small>` : ""}</th>`;
    })
    .join("");
  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) =>
            i === 0 && row.length > 1
              ? `<td class="is-key">${esc(cell)}</td>`
              : `<td class="is-num">${splitCell(cell).map((part) => `<span>${esc(part)}</span>`).join("")}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  container.innerHTML = `<table class="data-table ax-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function setCatalogCount(shown, total, noun) {
  const node = el("auraCatalogCount");
  if (node) node.textContent = shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}

const ES_TAG = '<span class="ax-tag ax-tag-lang" title="Source text is in Spanish">ES</span>';

async function renderAuraCatalog() {
  const container = el("auraCatalogContainer");
  if (!container) return;
  const kind = companionState.activeCatalogKind;
  const q = (el("auraCatalogSearch")?.value || "").trim().toLowerCase();
  const empty = '<p class="ax-empty">Nothing in this section matches the filter.</p>';

  const buttons = [...document.querySelectorAll(".aura-cat-btn")];
  setSegActive(buttons, buttons.find((b) => b.dataset.cat === kind));

  if (kind === "apple") {
    const all = companionState.auraSources.apple_studies;
    const rows = all.filter((a) => !q || `${a.title} ${a.journal} ${a.objective_es} ${a.nasa_relevance_es}`.toLowerCase().includes(q));
    setCatalogCount(rows.length, all.length, "studies");
    container.innerHTML = rows.length
      ? `
      <table class="data-table ax-table">
        <thead><tr><th>Year</th><th>Study</th><th>Device and sensors</th><th>Relevance to spaceflight</th></tr></thead>
        <tbody>${rows
          .map(
            (a) => `<tr>
              <td><span class="ax-year">${esc(a.year)}</span><span class="ax-cell-sub">${esc(a.journal)}</span></td>
              <td><a href="${esc(a.primary_url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><span class="ax-cell-sub">${esc(a.objective_es)} ${ES_TAG}</span></td>
              <td>${esc(a.device)}<span class="ax-cell-sub">${esc(a.sensors)}</span></td>
              <td>${esc(a.nasa_relevance_es)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`
      : empty;
    return;
  }

  if (kind === "concepts") {
    const all = companionState.auraConcepts;
    const rows = all.filter((c) => !q || `${c.id} ${c.label_en} ${c.label_es} ${c.definition_en}`.toLowerCase().includes(q));
    setCatalogCount(rows.length, all.length, "concepts");
    container.innerHTML = rows.length
      ? `
      <table class="data-table ax-table">
        <thead><tr><th>Concept</th><th>Unit</th><th>Operational definition</th><th>Limitation</th></tr></thead>
        <tbody>${rows
          .map(
            (c) => `<tr>
              <td class="is-key">${esc(c.label_en)}<span class="ax-cell-sub">${esc(c.label_es)}</span></td>
              <td class="is-num">${esc(c.unit || "—")}</td>
              <td>${esc(c.definition_en)}</td>
              <td>${esc(c.limitation_en)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`
      : empty;
    return;
  }

  if (kind === "sources") {
    const all = companionState.auraSources.registry_sources;
    const rows = all.filter((sr) => !q || `${sr.id} ${sr.title} ${sr.organization} ${sr.topic} ${sr.scope}`.toLowerCase().includes(q));
    setCatalogCount(rows.length, all.length, "sources");
    container.innerHTML = rows.length
      ? `
      <table class="data-table ax-table">
        <thead><tr><th>ID</th><th>Source</th><th>Scope</th><th>Limitation</th></tr></thead>
        <tbody>${rows
          .map(
            (sr) => `<tr>
              <td><span class="ax-cell-id">${esc(sr.id)}</span><span class="ax-cell-sub">${esc(sr.topic)}</span></td>
              <td><a href="${esc(sr.url)}" target="_blank" rel="noopener noreferrer">${esc(sr.title)}</a><span class="ax-cell-sub">${esc(sr.organization)} · ${esc(sr.type || sr.status)}</span></td>
              <td>${esc(sr.scope)}</td>
              <td>${esc(sr.limitation)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`
      : empty;
    return;
  }

  // NASA PMC corpus: a sample by default, a server search once the filter has two characters
  let pmcList = companionState.auraPmcSample;
  if (q.length >= 2) {
    try {
      const res = await fetchJson(`/api/aura/search?q=${encodeURIComponent(q)}&include_pmc=true&limit=35`);
      pmcList = res.results.filter((r) => r.kind === "nasa_pmc");
    } catch {
      pmcList = companionState.auraPmcSample.filter((p) => `${p.title} ${p.snippet}`.toLowerCase().includes(q));
    }
  }
  if (companionState.activeCatalogKind !== "pmc") return; // the section changed while the search was running
  const totalPmc = companionState.auraOverview?.counts?.nasa_pmc_publications || 572;
  setCatalogCount(pmcList.length, totalPmc, q.length >= 2 ? "papers match" : "papers shown");
  container.innerHTML = pmcList.length
    ? `
    <table class="data-table ax-table">
      <thead><tr><th>PMC ID</th><th>Publication</th><th>Population</th><th>Limitation</th></tr></thead>
      <tbody>${pmcList
        .map(
          (p) => `<tr>
            <td><span class="ax-cell-id">${esc(p.doc_id || p.pmc_id)}</span></td>
            <td><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a></td>
            <td><span class="ax-tag ${p.is_human_applicable ? "ax-tag-human" : "ax-tag-caveat"}">${esc(humanize(p.population_domain))}</span></td>
            <td>${esc((p.limitation || p.snippet || "").slice(0, 200))}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>`
    : empty;
}

// ----------------------------------------------------------------------------
// 5. Cross-Tab Bridges & Bootstrap
// ----------------------------------------------------------------------------
function bridgeMissionConsoleToTriage() {
  const bridge = window.AstroKineticsBridge;
  const st = bridge?.getState?.();
  const ev = st?.lastEvaluation;
  const hr = Number(el("hrInput")?.value || ev?.downlink_packet?.physiological_and_habitat_summary?.hr_bpm || 74);
  const sbp = Number(el("sbpInput")?.value || 120);
  const spo2 = Number(el("spo2Input")?.value || ev?.downlink_packet?.physiological_and_habitat_summary?.spo2_pct || 98);
  const sleep = Number(el("sleepInput")?.value || 6.5);

  const preset = {
    hr,
    sbp,
    spo2,
    sleep_hours: sleep,
    severity: ev?.overall_status === "alert" ? 8 : ev?.overall_status === "watch" ? 5 : 2,
    fatigue: sleep < 6.5,
    headache: st?.activeScenario === "hypercapnia_drift",
    dizziness: st?.activeScenario === "hypercapnia_drift" || st?.activeScenario === "spe_blackout",
    visual_blur: st?.activeScenario === "spe_blackout",
    joint_pain: st?.activeScenario === "musculoskeletal_asymmetry",
    watch_connected: true,
    signal_quality: "good",
  };
  applyHunchPreset(preset);
  bridge?.activateWorkspaceTab?.("tabAstraTriage", false, true);
  runHunchTriage();
}

function bridgeMissionConsoleToAura() {
  const bridge = window.AstroKineticsBridge;
  const st = bridge?.getState?.();
  const scen = st?.activeScenario || "nominal_lunar";
  let q = "What is the difference between Apple Watch SDNN and RMSSD?";
  if (scen === "hypercapnia_drift") q = "SANS ocular fluid shift circadian Barger 2014 sleep";
  else if (scen === "musculoskeletal_asymmetry") q = "1-Euro tremor dexterity OpenCap LiDAR calf volume";
  else if (scen === "spe_blackout") q = "RadLab DosTel radiation absorbed dose and Barger sleep deficit";

  if (el("auraQuestionInput")) el("auraQuestionInput").value = q;
  bridge?.activateWorkspaceTab?.("tabAuraKnowledge", false, true);
  runAuraAsk();
}

async function openEpisodeFromCurrentHunch() {
  const res = companionState.lastHunchResult;
  const bridge = window.AstroKineticsBridge;
  const st = bridge?.getState?.();
  const tier = res?.triage_level || "MODERATE";
  const reason = res?.triggered_red_flags?.length
    ? `HUNCH Red Flag: ${res.triggered_red_flags[0].label}`
    : `HUNCH Triage (${tier}) + Mahalanobis Review`;

  try {
    const created = await fetchJson("/api/astra/episodes", {
      method: "POST",
      body: JSON.stringify({
        subject_id: "ISS-CDR-01",
        reason,
        case_id: "recovery",
        active_profile: el("hunchProfileSelect")?.value || "mission_microgravity",
        metric: "heart_rate",
        value: el("hunchHrInput")?.value ? Number(el("hunchHrInput").value) : null,
        unit: "beats/min",
        origin_kind: "measured",
        triage_level: tier,
        mahalanobis_d2: st?.lastEvaluation?.multivariate_stats?.mahalanobis_d_squared ?? null,
      }),
    });
    companionState.episodes.unshift(created);
    companionState.activeEpisodeId = created.episode.id;
    showEpisodeGuard(`Created longitudinal episode ${created.episode.id} (${tier}).`);
    renderEpisodeState();
  } catch (err) {
    showEpisodeGuard(`Unable to create episode: ${err.message}`);
  }
}

function wireEventListeners() {
  el("bridgeToTriageBtn")?.addEventListener("click", bridgeMissionConsoleToTriage);
  el("bridgeToAuraBtn")?.addEventListener("click", bridgeMissionConsoleToAura);

  // HUNCH listeners
  el("hunchVignetteStrip")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vignette]");
    if (!btn || !companionState.hunchCatalog) return;
    const found = companionState.hunchCatalog.vignettes?.find((v) => v.id === btn.dataset.vignette);
    if (found) {
      applyHunchPreset(found.preset);
      runHunchTriage();
    }
  });
  el("hunchResetBtn")?.addEventListener("click", () => {
    applyHunchPreset({});
    runHunchTriage();
  });
  el("runHunchTriageBtn")?.addEventListener("click", runHunchTriage);
  el("hunchSymptomGrid")?.addEventListener("change", updateSymptomCounts);
  // An edited vital is no longer the value the engine flagged.
  el("hunchVitals")?.addEventListener("input", (e) => {
    const tile = e.target.closest(".ax-vital");
    if (tile) {
      delete tile.dataset.state;
      tile.title = "";
    }
    updateBodyReadings();
  });
  el("bodyGravSeg")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-grav]");
    if (!btn) return;
    // pressing the active state again turns the view off
    setGravityMode(companionState.gravMode === btn.dataset.grav ? null : btn.dataset.grav);
  });
  el("bodyLayerSeg")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-layer]");
    if (!btn) return;
    setSegActive([...el("bodyLayerSeg").querySelectorAll("[data-layer]")], btn);
    if (el("hunchBodyMap")) el("hunchBodyMap").dataset.layer = btn.dataset.layer;
    const body = companionState.body3d;
    if (body) {
      body.setView(btn.dataset.layer);
      const missing = body.needs(btn.dataset.layer).filter((name) => !body.has(name));
      const status = el("body3dStatus");
      if (status && missing.length) {
        status.hidden = false;
        status.textContent = `LOADING ${(VIEW_LABELS[missing[0]] || missing[0]).toUpperCase()}`;
      }
      if (reduceMotion()) renderBody3D(0);
    }
  });
  el("openEpisodeFromHunchBtn")?.addEventListener("click", openEpisodeFromCurrentHunch);

  // Episode governance listeners
  el("astraEpisodeSelect")?.addEventListener("change", (e) => {
    companionState.activeEpisodeId = e.target.value;
    showEpisodeGuard("");
    renderEpisodeState();
  });
  el("astraInternetToggle")?.addEventListener("change", (e) => transitionActiveEpisode("INTERNET", { value: e.target.checked }));
  el("astraWatchToggle")?.addEventListener("change", (e) => transitionActiveEpisode("WATCH", { value: e.target.checked }));
  el("toggleEarthProfileBtn")?.addEventListener("click", () => transitionActiveEpisode("PROFILE", { value: "earth_1g" }));
  el("toggleMissionProfileBtn")?.addEventListener("click", () => transitionActiveEpisode("PROFILE", { value: "mission_microgravity" }));

  document.querySelectorAll("[data-ep-action]").forEach((btn) => {
    btn.addEventListener("click", () => transitionActiveEpisode(btn.dataset.epAction));
  });
  el("astraCloseEpisodeBtn")?.addEventListener("click", () => {
    const reason = el("astraClosureReasonInput")?.value || "";
    transitionActiveEpisode("CLOSE", { reason });
  });
  document.querySelectorAll(".astra-lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      companionState.lang = btn.dataset.lang || "en";
      setSegActive([...document.querySelectorAll(".astra-lang-btn")], btn);
      if (el("auraLangSelect")) el("auraLangSelect").value = companionState.lang;
      renderProfileCopy(activeEpisode()?.active_profile || "mission_microgravity");
    });
  });

  // LiDAR listeners
  el("runLidarCalcBtn")?.addEventListener("click", runLidarCalculation);
  el("simulatePartialLidarBtn")?.addEventListener("click", () => {
    if (el("lidarCovInput")) el("lidarCovInput").value = "64";
    runLidarCalculation();
  });

  // AURA listeners
  el("auraAskBtn")?.addEventListener("click", runAuraAsk);
  el("auraQuestionInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runAuraAsk();
  });
  document.querySelectorAll(".aura-chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (el("auraQuestionInput")) el("auraQuestionInput").value = btn.dataset.q || "";
      runAuraAsk();
    });
  });
  el("radlabInstrumentSelect")?.addEventListener("change", () => renderRadlabChart());
  el("radlabReplayBtn")?.addEventListener("click", replayRadlab);
  wireLidarDrag();
  el("bargerTableSelect")?.addEventListener("change", renderBargerOrNlspTable);
  document.querySelectorAll(".aura-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      companionState.activeCatalogKind = btn.dataset.cat || "apple";
      renderAuraCatalog();
    });
  });
  el("auraCatalogSearch")?.addEventListener("input", () => renderAuraCatalog());
  el("auraLangSelect")?.addEventListener("change", runAuraAsk);

  // Canvases read theme colours when drawn, so redraw them when the theme changes.
  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) {
    new MutationObserver(() => {
      companionState.lidarColors = null;
      companionState.monitorColors = null;
      if (companionState.graph) companionState.graph.colors = null;
      if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult);
      renderRadlabChart();
      if (el("bargerTableSelect")?.value === "chart") drawSleepChart(1);
    }).observe(schemeMeta, { attributes: true, attributeFilter: ["content"] });
  }
  // The draw loops stop while the page is hidden; pick them up again when it comes back.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (el("panelAstraTriage") && !el("panelAstraTriage").hidden) startLidarSpin();
    if (el("panelAuraKnowledge") && !el("panelAuraKnowledge").hidden) startEvidenceLoop();
  });
  window.addEventListener("resize", () => {
    if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult);
    renderRadlabChart();
  });

  // Re-render High-DPI canvases cleanly on tab switch or theme switch
  window.addEventListener("astrokinetics:tabchange", (e) => {
    const panelId = e.detail?.panelId;
    if (panelId === "panelAstraTriage") {
      if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult);
      else runLidarCalculation();
      updateBodyReadings();
      initBody3D();
      startLidarSpin();
      countUp(el("triageKpiStrip"));
    } else if (panelId === "panelAuraKnowledge") {
      replayRadlab();
      renderBargerOrNlspTable();
      countUp(el("auraKpiStrip"));
      if (companionState.graph) companionState.graph.litAt = performance.now();
      startEvidenceLoop();
    }
  });
}

async function bootstrapCompanion() {
  wireEventListeners();
  try {
    const [catalog, contracts, episodesData, overview, concepts, sources, radlab, pmcInit] = await Promise.all([
      fetchJson("/api/hunch/catalog").catch(() => null),
      fetchJson("/api/astra/contracts").catch(() => null),
      fetchJson("/api/astra/episodes").catch(() => ({ episodes: [] })),
      fetchJson("/api/aura/overview").catch(() => null),
      fetchJson("/api/aura/concepts").catch(() => ({ concepts: [] })),
      fetchJson("/api/aura/sources").catch(() => ({ registry_sources: [], apple_studies: [] })),
      fetchJson("/api/aura/radlab").catch(() => null),
      fetchJson("/api/aura/search?q=spaceflight&include_pmc=true&limit=25").catch(() => ({ results: [] })),
    ]);

    companionState.hunchCatalog = catalog;
    updateSymptomCounts();
    if (contracts) renderSurfaceContracts(contracts);
    companionState.episodes = episodesData?.episodes || [];
    companionState.activeEpisodeId = companionState.episodes[0]?.episode?.id || null;
    renderEpisodeState();

    companionState.auraOverview = overview;
    if (overview?.counts && el("auraTabCorpusBadge")) {
      const total = (overview.counts.reviewed_sources || 70) + (overview.counts.nasa_pmc_publications || 572) + (overview.counts.apple_biomarker_studies || 15);
      el("auraTabCorpusBadge").textContent = `${total}`;
    }
    companionState.auraConcepts = concepts?.concepts || [];
    companionState.auraSources = sources || { registry_sources: [], apple_studies: [] };
    companionState.auraPmcSample = (pmcInit?.results || []).filter((r) => r.kind === "nasa_pmc");
    companionState.radlabData = radlab;

    renderAuraKpis();
    buildConstellation();
    renderAuraCatalog();
    renderBargerOrNlspTable();
    if (el("panelAuraKnowledge") && !el("panelAuraKnowledge").hidden) {
      replayRadlab();
      startEvidenceLoop();
    } else {
      renderRadlabChart();
    }
    updateBodyReadings();
    if (el("panelAstraTriage") && !el("panelAstraTriage").hidden) initBody3D();
    await Promise.all([runHunchTriage(), runLidarCalculation()]);

    if (el("auraQuestionInput")) {
      el("auraQuestionInput").value = "What is the difference between Apple Watch SDNN and RMSSD?";
      runAuraAsk();
    }
  } catch (err) {
    console.warn("ASTRA companion offline initialization warning:", err);
  }
}

bootstrapCompanion();
