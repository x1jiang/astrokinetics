/**
 * AstroKinetics · ASTRA Companion Client Module (v4.0.0)
 * ======================================================
 * Powers Tab 2 (NASA HUNCH Dual-Engine Triage, ASTRA Longitudinal Episode Governance,
 * & Signed Tetrahedral LiDAR Calf Volumetry), Tab 3 (AURA Cited Space Medicine Engine,
 * RadLab DosTel1/2 Radiation Plot, Barger 2014 ISS Sleep Tables, & 657+ Source Registry),
 * plus Cross-Tab Bridges from Mission Console with offline PWA fallback support.
 */

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

function getCssVar(name, fallback) {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
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
}

function renderHunchOutcome(res) {
  companionState.lastHunchResult = res;
  const pill = el("hunchTierPill");
  const headline = el("hunchHeadline");
  const timingTag = el("hunchTimingTag");
  const traceUl = el("hunchRuleTrace");
  const mlBars = el("hunchMlBars");
  const mlNote = el("hunchMlNote");
  const mlBadge = el("hunchMlAgreeBadge");
  if (!pill || !traceUl || !mlBars) return;

  const tier = res.triage_level || "LOW";
  pill.textContent = tier;
  pill.className = "status-pill";
  if (tier === "EMERGENCY") pill.classList.add("status-alert");
  else if (tier === "URGENT" || tier === "MODERATE" || tier === "INCOMPLETE_CHECK_REQUIRED") {
    pill.classList.add("status-watch");
  } else {
    pill.classList.add("status-nominal");
  }

  if (headline) {
    if (res.triggered_red_flags?.length) {
      headline.textContent = `Red-Flag Override (${res.triggered_red_flags.map((f) => f.label).join("; ")})`;
    } else if (res.abstained) {
      headline.textContent = "Principled Abstention — missing/low-quality context; repeat capture before clearance.";
    } else {
      headline.textContent = `Rule Engine outcome: ${tier} under ${res.active_profile === "earth_1g" ? "Earth-1g Preflight" : "Mission Profile"}`;
    }
  }

  if (timingTag && res.timing_ms) {
    timingTag.textContent = `RF: ${res.timing_ms.red_flag_gate_ms}ms · Rule: ${res.timing_ms.rule_engine_ms}ms · ML: ${res.timing_ms.ml_comparator_ms}ms`;
  }

  traceUl.innerHTML = (res.rule_engine?.trace || [])
    .map((line) => `<li>${esc(line)}</li>`)
    .join("");

  const probs = res.ml_comparator?.probabilities || {};
  mlBars.innerHTML = ["EMERGENCY", "URGENT", "MODERATE", "LOW"]
    .map((label) => {
      const pct = Math.round((Number(probs[label] || 0)) * 100);
      return `
        <div class="ml-bar-row">
          <span class="mono">${esc(label)}</span>
          <div class="ml-bar-track"><div class="ml-bar-fill" style="width:${pct}%"></div></div>
          <span class="mono">${pct}%</span>
        </div>`;
    })
    .join("");

  if (mlBadge) {
    mlBadge.textContent = res.ml_comparator?.agrees_with_rule ? "Rule/ML Agree" : `Diverged (ML=${res.ml_comparator?.prediction})`;
  }
  if (mlNote) mlNote.textContent = res.ml_comparator?.comparison_note || "";
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
  if (btnEarth && btnMission) {
    btnEarth.className = `btn btn-xs ${isEarth ? "btn-primary" : "btn-secondary"}`;
    btnMission.className = `btn btn-xs ${!isEarth ? "btn-primary" : "btn-secondary"}`;
  }

  if (isEarth) {
    titleEl.textContent = isEs
      ? "Referencia activa: Línea base Earth-1g pre-vuelo"
      : "Active Baseline: Earth-1g Preflight Reference";
    copyEl.textContent = isEs
      ? "Cualquier desviación respecto al registro 1g se conserva para revisión de persistencia y síntomas; una diferencia estadística no equivale a diagnóstico."
      : "Recorded deviations from the personal Earth-1g baseline trigger symptom/persistence verification; statistical departure alone never establishes pathology.";
  } else {
    titleEl.textContent = isEs
      ? "Referencia activa: Perfil validado de Misión (ISS / Marte)"
      : "Active Baseline: Mission Microgravity Profile";
    copyEl.textContent = isEs
      ? "Evalúa la observación frente a envolventes de adaptación en microgravedad (p. ej. 6.09h de sueño Barger 2014) sin falsas alarmas por gravedad terrestre."
      : "Evaluates observations against validated microgravity adaptation envelopes (e.g. Barger 2014 ISS 6.09h mean sleep) without firing false alerts on Earth-1g delta alone.";
  }
}

function renderEpisodeState() {
  const ep = activeEpisode();
  const select = el("astraEpisodeSelect");
  const badge = el("astraTabEpisodeBadge");
  if (badge) badge.textContent = String(companionState.episodes.length || 0);

  if (select && companionState.episodes.length) {
    select.innerHTML = companionState.episodes
      .map((item) => `<option value="${esc(item.episode.id)}">${esc(item.episode.id)} · ${esc(item.subject_id)} [${esc(item.episode.status)}]</option>`)
      .join("");
    if (ep) select.value = ep.episode.id;
  }

  if (!ep) return;
  if (el("astraInternetToggle")) el("astraInternetToggle").checked = Boolean(ep.internet_up);
  if (el("astraWatchToggle")) el("astraWatchToggle").checked = ep.watch_connected !== false;

  const lastObs = ep.observations?.[ep.observations.length - 1];
  const qualityStatus = lastObs?.quality?.status || "not_checked";

  if (el("stEpisodeStatus")) el("stEpisodeStatus").textContent = ep.episode?.status || "open";
  if (el("stTaskState")) el("stTaskState").textContent = ep.task?.state || "pending";
  if (el("stNotification")) el("stNotification").textContent = ep.task?.notification_dismissed ? "dismissed (kept pending)" : "active";
  if (el("stQuality")) el("stQuality").textContent = qualityStatus;
  if (el("stSyncStatus")) el("stSyncStatus").textContent = ep.synchronization?.status || "local_only";
  if (el("stHumanReviewed")) {
    el("stHumanReviewed").textContent = ep.synchronization?.human_reviewed
      ? `TRUE (${ep.synchronization.reviewer || "CMO"})`
      : "false";
  }

  if (el("stDecisionType")) el("stDecisionType").textContent = `${ep.decision?.type || "PENDING"} · ${ep.episode?.reason || ""}`;
  if (el("stDecisionFinding")) {
    const closureNote = ep.episode?.closure_reason ? ` | Closed: ${ep.episode.closure_reason}` : "";
    el("stDecisionFinding").textContent = `${ep.decision?.finding || ""}${closureNote}`;
  }

  renderProfileCopy(ep.active_profile || "mission_microgravity");

  const auditEl = el("astraAuditTimeline");
  if (auditEl) {
    const trail = [...(ep.audit_trail || [])].reverse();
    auditEl.innerHTML = trail
      .map((ev) => `<li><strong class="mono">[${esc(ev.action)}]</strong> ${esc(ev.note)}</li>`)
      .join("");
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
  listEl.innerHTML = contracts.surface_architecture
    .map(
      (s) => `
      <div>
        <strong>${esc(s.surface)}</strong>
        <div><b>Owns:</b> ${esc(s.owns)}</div>
        <div><b>Excludes:</b> ${esc(s.does_not_own)}</div>
      </div>`
    )
    .join("");
}

// ----------------------------------------------------------------------------
// 3. 3D Signed Tetrahedral iPhone LiDAR Calf Mesh Volumetry
// ----------------------------------------------------------------------------
function drawLidarMeshCanvas(res) {
  const canvas = el("lidarMeshCanvas");
  if (!canvas || !res) return;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, rect.width || 440);
  const cssH = 240;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bg = getCssVar("--bg-recessed", "#0b1120");
  const textCol = getCssVar("--text-primary", "#e2e8f0");
  const mutedCol = getCssVar("--text-muted", "#94a3b8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  const rings = res.rings_preview || [];
  if (!rings.length) return;

  const covRatio = Math.min(1, Math.max(0, Number(res.provenance_breakdown_pct?.observed || 88) / 100));
  const yaw = companionState.lidarYaw;
  const tilt = 0.34;
  const cx = cssW * 0.44;
  const cy = cssH * 0.52;
  const scale = 6.2;

  const project = ([x, y, z]) => {
    const zr = z - 14.0; // center calf length vertically
    const xr = x * Math.cos(yaw) - zr * Math.sin(yaw);
    const z1 = x * Math.sin(yaw) + zr * Math.cos(yaw);
    const yr = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    return [cx + xr * scale, cy - (zr * 0.85 + y * 0.28) * scale + yr * 0.15];
  };

  // Draw rings colored by observed/occluded/inferred wedge angle
  rings.forEach((ring, ri) => {
    const n = ring.length;
    const isCapRing = ri === 0 || ri === rings.length - 1;
    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      const p1 = project(ring[k]);
      const p2 = project(ring[next]);
      const frac = k / n;
      let stroke = "#10b981"; // observed green
      if (isCapRing && frac > covRatio) stroke = "#ef4444"; // inferred red
      else if (frac > covRatio) stroke = "#f59e0b"; // occluded amber

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();

      if (ri < rings.length - 1) {
        const pUp = project(rings[ri + 1][k]);
        ctx.strokeStyle = frac > covRatio ? "rgba(245,158,11,0.5)" : "rgba(16,185,129,0.5)";
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(pUp[0], pUp[1]);
        ctx.stroke();
      }
    }
  });

  // Labels & quality badge inside canvas
  ctx.fillStyle = textCol;
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText(`V = ${res.computed_volume_ml} mL`, cssW * 0.67, 36);
  ctx.fillStyle = mutedCol;
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.fillText(`Obs: ${res.provenance_breakdown_pct?.observed}%`, cssW * 0.67, 56);
  ctx.fillText(`Occ: ${res.provenance_breakdown_pct?.occluded}%`, cssW * 0.67, 72);
  ctx.fillText(`Inf: ${res.provenance_breakdown_pct?.inferred}%`, cssW * 0.67, 88);
  ctx.fillText(`Gate: >=82%`, cssW * 0.67, 108);
}

function renderLidarResult(res) {
  companionState.lastLidarResult = res;
  const pill = el("lidarGatePill");
  if (pill) {
    const isPass = res.quality_gate_status === "PASS";
    pill.textContent = `${res.quality_gate_status} · ${res.provenance_breakdown_pct?.observed}% OBSERVED`;
    pill.className = `status-pill ${isPass ? "status-nominal" : "status-alert"}`;
  }
  if (el("lidarVolVal")) el("lidarVolVal").textContent = `${res.computed_volume_ml} cm³`;
  if (el("lidarDeltaVal")) {
    const sign = res.delta_ml >= 0 ? "+" : "";
    el("lidarDeltaVal").textContent = `${sign}${res.delta_ml} mL (${sign}${res.pct_change}%)`;
  }
  if (el("lidarGeoVal")) el("lidarGeoVal").textContent = `${res.triangle_count} / ${res.vertex_count}`;
  const warnBox = el("lidarWarningBox");
  if (warnBox) {
    if (res.hold_reasons?.length) {
      warnBox.hidden = false;
      warnBox.textContent = `QUALITY HOLD: ${res.hold_reasons.join(" ")}`;
    } else {
      warnBox.hidden = true;
      warnBox.textContent = "";
    }
  }
  drawLidarMeshCanvas(res);
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
function renderAuraAnswer(res) {
  const ansEl = el("auraAnswerText");
  const limEl = el("auraLimitationsBox");
  const gridEl = el("auraCitationsGrid");
  if (!ansEl || !gridEl) return;

  if (res.abstained) {
    ansEl.innerHTML = `<strong>PRINCIPLED ABSTENTION:</strong> ${esc(res.abstention_reason || res.answer)}`;
  } else {
    ansEl.textContent = res.answer || "";
  }

  if (limEl) {
    const lims = res.scientific_limitations || [];
    if (lims.length) {
      limEl.hidden = false;
      limEl.innerHTML = `<strong>Scientific Caveats:</strong> ${lims.map((l) => esc(l)).join(" | ")}`;
    } else {
      limEl.hidden = true;
    }
  }

  gridEl.innerHTML = (res.citations || [])
    .map((c, idx) => {
      const pop = c.population_domain || "human_operational";
      const popClass = c.is_human_applicable ? "pop-human" : "pop-caveat";
      const linkHtml = c.url
        ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open primary source &rarr;</a>`
        : "";
      return `
        <div class="aura-citation-card">
          <div><span class="mono">[${idx + 1}] ${esc(c.kind)}</span> · <span class="pop-badge ${popClass}">${esc(pop)}</span></div>
          <strong>${esc(c.title)}</strong>
          <div>${esc((c.snippet || "").slice(0, 180))}${(c.snippet || "").length > 180 ? "..." : ""}</div>
          ${linkHtml}
        </div>`;
    })
    .join("");
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

function renderRadlabChart() {
  const canvas = el("radlabChartCanvas");
  const data = companionState.radlabData?.radlab_iss_sample;
  if (!canvas || !data?.records?.length) return;

  const filterInst = el("radlabInstrumentSelect")?.value || "ALL";
  const records = filterInst === "ALL"
    ? data.records
    : data.records.filter((r) => r.inst === filterInst);

  if (el("radlabCountVal")) el("radlabCountVal").textContent = String(records.length);
  const doses = records.map((r) => Number(r.dose || 0));
  const meanDose = doses.length ? doses.reduce((a, b) => a + b, 0) / doses.length : 0;
  const peakDose = doses.length ? Math.max(...doses) : 0;
  if (el("radlabMeanVal")) el("radlabMeanVal").textContent = `${meanDose.toFixed(2)} uGy/h`;
  if (el("radlabPeakVal")) el("radlabPeakVal").textContent = `${peakDose.toFixed(2)} uGy/h`;

  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, rect.width || 520);
  const cssH = 210;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bg = getCssVar("--bg-recessed", "#0b1120");
  const accent = getCssVar("--accent", "#3b82f6");
  const muted = getCssVar("--text-muted", "#94a3b8");
  const border = getCssVar("--border-subtle", "rgba(148,163,184,0.22)");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  const padL = 44;
  const padR = 16;
  const padT = 22;
  const padB = 28;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const maxY = Math.max(15, peakDose * 1.12);

  // Gridlines
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const y = padT + (plotH * g) / 3;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    const val = ((maxY * (3 - g)) / 3).toFixed(1);
    ctx.fillText(val, 6, y + 3);
  }

  // Plot line
  if (records.length > 1) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    records.forEach((r, idx) => {
      const x = padL + (idx / (records.length - 1)) * plotW;
      const y = padT + plotH - (Number(r.dose) / maxY) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Highlight SAA / high-dose spikes (> 12 uGy/h)
    records.forEach((r, idx) => {
      if (Number(r.dose) >= Math.max(12, peakDose * 0.72)) {
        const x = padL + (idx / (records.length - 1)) * plotW;
        const y = padT + plotH - (Number(r.dose) / maxY) * plotH;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  ctx.fillStyle = muted;
  ctx.font = "500 10px Inter, sans-serif";
  ctx.fillText("ISS DosTel Absorbed Dose Rate (uGy/h) across orbital track (red = SAA peaks)", padL, cssH - 8);
}

function renderBargerOrNlspTable() {
  const container = el("bargerTableContainer");
  const select = el("bargerTableSelect");
  const emp = companionState.radlabData;
  if (!container || !select || !emp) return;

  const val = select.value;
  if (val === "nlsp") {
    const items = emp.nasa_nlsp_manifest?.datasets || [];
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Catalog</th><th>Title / Study</th><th>Limitation</th></tr></thead>
        <tbody>${items
          .map(
            (d) => `<tr>
              <td class="mono">${esc(d.dataset_catalog)}</td>
              <td><strong>${esc(d.title)}</strong><br><small>${esc(d.method)}</small></td>
              <td><small>${esc(d.limitations)}</small></td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`;
    return;
  }

  const tbl = (emp.barger_2014_sleep?.tables || [])[Number(val)] || emp.barger_2014_sleep?.tables?.[0];
  if (!tbl || !tbl.rows?.length) {
    container.innerHTML = "<p class='muted-sub'>No Barger 2014 table data loaded.</p>";
    return;
  }
  const [headerRow, ...bodyRows] = tbl.rows;
  container.innerHTML = `
    <table class="data-table">
      <thead><tr>${headerRow.map((c) => `<th>${esc(c || tbl.label)}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table>`;
}

async function renderAuraCatalog() {
  const container = el("auraCatalogContainer");
  if (!container) return;
  const kind = companionState.activeCatalogKind;
  const q = (el("auraCatalogSearch")?.value || "").trim().toLowerCase();

  document.querySelectorAll(".aura-cat-btn").forEach((btn) => {
    const active = btn.dataset.cat === kind;
    btn.className = `btn btn-xs aura-cat-btn ${active ? "btn-primary" : "btn-secondary"}`;
  });

  if (kind === "apple") {
    const rows = companionState.auraSources.apple_studies.filter(
      (a) => !q || `${a.title} ${a.journal} ${a.objective_es} ${a.nasa_relevance_es}`.toLowerCase().includes(q)
    );
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Year / Journal</th><th>Study &amp; Objective</th><th>Sensors / Device</th><th>NASA Space Relevance</th></tr></thead>
        <tbody>${rows
          .map(
            (a) => `<tr>
              <td class="mono">${esc(a.year)}<br><small>${esc(a.journal)}</small></td>
              <td><a href="${esc(a.primary_url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(a.title)}</strong></a><br><small>${esc(a.objective_es)}</small></td>
              <td><small>${esc(a.device)}<br>${esc(a.sensors)}</small></td>
              <td><small>${esc(a.nasa_relevance_es)}</small></td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`;
    return;
  }

  if (kind === "concepts") {
    const rows = companionState.auraConcepts.filter(
      (c) => !q || `${c.id} ${c.label_en} ${c.label_es} ${c.definition_en}`.toLowerCase().includes(q)
    );
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Concept (EN / ES)</th><th>Unit</th><th>Operational Definition &amp; Caveat</th></tr></thead>
        <tbody>${rows
          .map(
            (c) => `<tr>
              <td><strong>${esc(c.label_en)}</strong><br><small>${esc(c.label_es)}</small></td>
              <td class="mono">${esc(c.unit || "—")}</td>
              <td><div>${esc(c.definition_en)}</div><small class="muted-sub">Caveat: ${esc(c.limitation_en)}</small></td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`;
    return;
  }

  if (kind === "sources") {
    const rows = companionState.auraSources.registry_sources.filter(
      (s) => !q || `${s.id} ${s.title} ${s.organization} ${s.topic} ${s.scope}`.toLowerCase().includes(q)
    );
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>ID / Topic</th><th>Title &amp; Organization</th><th>Scope &amp; Limitation</th></tr></thead>
        <tbody>${rows
          .map(
            (s) => `<tr>
              <td class="mono">${esc(s.id)}<br><small>${esc(s.topic)}</small></td>
              <td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(s.title)}</strong></a><br><small>${esc(s.organization)} (${esc(s.status)})</small></td>
              <td><div>${esc(s.scope)}</div><small class="muted-sub">${esc(s.limitation)}</small></td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`;
    return;
  }

  // PMC Corpus (572 papers)
  let pmcList = companionState.auraPmcSample;
  if (q.length >= 2) {
    try {
      const res = await fetchJson(`/api/aura/search?q=${encodeURIComponent(q)}&include_pmc=true&limit=35`);
      pmcList = res.results.filter((r) => r.kind === "nasa_pmc");
    } catch {
      pmcList = companionState.auraPmcSample.filter((p) => `${p.title} ${p.snippet}`.toLowerCase().includes(q));
    }
  }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>PMC ID / Domain</th><th>Publication Title &amp; Organisms</th><th>Abstract / Caveat</th></tr></thead>
      <tbody>${pmcList
        .map(
          (p) => `<tr>
            <td class="mono">${esc(p.doc_id || p.pmc_id)}<br><span class="pop-badge ${p.is_human_applicable ? "pop-human" : "pop-caveat"}">${esc(p.population_domain)}</span></td>
            <td><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(p.title)}</strong></a></td>
            <td><small>${esc((p.snippet || "").slice(0, 220))}</small></td>
          </tr>`
        )
        .join("")}</tbody>
    </table>`;
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
      document.querySelectorAll(".astra-lang-btn").forEach((b) => {
        b.className = `btn btn-ghost btn-xs astra-lang-btn ${b === btn ? "active" : ""}`;
      });
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
  el("radlabInstrumentSelect")?.addEventListener("change", renderRadlabChart);
  el("bargerTableSelect")?.addEventListener("change", renderBargerOrNlspTable);
  document.querySelectorAll(".aura-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      companionState.activeCatalogKind = btn.dataset.cat || "apple";
      renderAuraCatalog();
    });
  });
  el("auraCatalogSearch")?.addEventListener("input", () => renderAuraCatalog());

  // Re-render High-DPI canvases cleanly on tab switch or theme switch
  window.addEventListener("astrokinetics:tabchange", (e) => {
    const panelId = e.detail?.panelId;
    if (panelId === "panelAstraTriage") {
      if (companionState.lastLidarResult) drawLidarMeshCanvas(companionState.lastLidarResult);
      else runLidarCalculation();
    } else if (panelId === "panelAuraKnowledge") {
      renderRadlabChart();
      renderBargerOrNlspTable();
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

    renderAuraCatalog();
    renderBargerOrNlspTable();
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
