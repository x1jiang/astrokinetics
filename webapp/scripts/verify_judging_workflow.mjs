import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { computeClientMahalanobis } from "../static/dsp.js";

// Run against a disposable local instance. Ingestion and episode checks write synthetic test data.
const origin = new URL(process.argv[2] || "http://127.0.0.1:8080");
assert(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname), "Use a local test server");

async function request(path, payload, expectedStatus = 200) {
  const options =
    payload === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        };
  const response = await fetch(new URL(path, origin), options);
  assert.equal(response.status, expectedStatus, `${path} (expected ${expectedStatus}, got ${response.status})`);
  const ct = response.headers.get("content-type") || "";
  return ct.includes("application/json") ? response.json() : response.text();
}

let suiteCount = 0;

// ---------------------------------------------------------------------------
// Suite 1: Four mission scenarios + 16 domain-boundary parity vectors (20/20)
// ---------------------------------------------------------------------------
const expectedScenarios = {
  nominal_lunar: ["nominal", 99.2],
  hypercapnia_drift: ["watch", 78.3],
  musculoskeletal_asymmetry: ["alert", 44.7],
  spe_blackout: ["alert", 12],
};
const { scenarios } = await request("/api/scenarios");
assert.deepEqual(
  scenarios.map(({ id }) => id).sort(),
  Object.keys(expectedScenarios).sort()
);

const scoreFields = ["readiness_score", "mahalanobis_d", "mahalanobis_d2", "p_value", "top_attributions"];
for (const { id, telemetry } of scenarios) {
  const server = await request("/api/evaluate", telemetry);
  const browser = computeClientMahalanobis(telemetry);
  assert.deepEqual([server.overall_status, server.readiness_score], expectedScenarios[id], id);
  for (const field of scoreFields) {
    assert.deepEqual(browser[field], server.multivariate_stats[field], `${id}: ${field}`);
  }
}

const nominalBase = scenarios.find(({ id }) => id === "nominal_lunar").telemetry;
const boundaryCases = [
  ["sym_watch_89", { bilateral_symmetry_pct: 89.0 }],
  ["sym_alert_82", { bilateral_symmetry_pct: 82.0 }],
  ["lean_watch_9", { trunk_lean_deg: 9.0 }],
  ["lean_alert_15", { trunk_lean_deg: 15.0 }],
  ["rom_watch_104", { joint_rom_deg: 104.0, target_rom_deg: 118.0 }],
  ["rom_alert_90", { joint_rom_deg: 90.0, target_rom_deg: 118.0 }],
  ["sway_watch_14", { postural_sway_mms: 14.0 }],
  ["sway_alert_22", { postural_sway_mms: 22.0 }],
  ["tremor_watch_1_3", { tremor_rms_mm: 1.3 }],
  ["tremor_alert_2_2", { tremor_rms_mm: 2.2 }],
  ["co2_watch_2_5", { cabin_co2_mmhg: 2.5 }],
  ["co2_alert_3_6", { cabin_co2_mmhg: 3.6 }],
  ["rad_watch_0_9", { radiation_msv_day: 0.9 }],
  ["rad_alert_2_0", { radiation_msv_day: 2.0 }],
  ["hr_watch_76_hrv_42", { heart_rate_bpm: 76.0, hrv_rmssd_ms: 42.0 }],
  ["pvt_alert_365_sleep_4_8", { pvt_reaction_ms: 365.0, sleep_hours: 4.8 }],
];
for (const [label, patch] of boundaryCases) {
  const sample = { ...nominalBase, ...patch };
  const server = await request("/api/evaluate", sample);
  const browser = computeClientMahalanobis(sample);
  for (const field of scoreFields) {
    assert.deepEqual(browser[field], server.multivariate_stats[field], `boundary ${label}: ${field}`);
  }
}
suiteCount++;
console.log(`[1/7] Statistical parity PASS: 4 mission scenarios + ${boundaryCases.length} boundary vectors = ${4 + boundaryCases.length}/${4 + boundaryCases.length} exact server/browser matches`);

// ---------------------------------------------------------------------------
// Suite 2: Three-tier crew privacy redaction gate (4/4)
// ---------------------------------------------------------------------------
const speBase = scenarios.find(({ id }) => id === "spe_blackout").telemetry;
const privSelf = await request("/api/evaluate", { ...nominalBase, privacy_tier: "astronaut_private" });
const privCmo = await request("/api/evaluate", { ...nominalBase, privacy_tier: "cmo_operational" });
const privFs = await request("/api/evaluate", { ...nominalBase, privacy_tier: "flight_surgeon_packet" });
const alertCmo = await request("/api/evaluate", { ...speBase, privacy_tier: "cmo_operational" });
assert.equal(privSelf.downlink_packet.behavioral_privacy_payload.raw_mood_score, nominalBase.mood_score_10);
assert.equal(privCmo.downlink_packet.behavioral_privacy_payload.raw_mood_score, "REDACTED_BY_CREW_PRIVACY_LOCK");
assert(privCmo.downlink_packet.behavioral_privacy_payload.journal_note.includes("REDACTED"));
assert.equal(privFs.downlink_packet.behavioral_privacy_payload.raw_mood_score, "REDACTED_BY_CREW_PRIVACY_LOCK");
assert(alertCmo.downlink_packet.behavioral_privacy_payload.journal_note.includes("SAFETY THRESHOLD ESCALATION"));
suiteCount++;
console.log("[2/7] Crew privacy governance PASS: 4/4 tier checks verified (Private exposed, CMO/FS redacted, alert escalates encrypted flag)");

// ---------------------------------------------------------------------------
// Suite 3: NASA HUNCH 8-red-flag safety gate, abstention & Barger profile (10/10)
// ---------------------------------------------------------------------------
const { vignettes } = await request("/api/hunch/catalog");
const degraded = vignettes.find(({ id }) => id === "poor_capture").preset;
const redFlagCases = [
  ["mi_triad", { chest_pain: true, sob: true, diaphoresis: true }],
  ["thunderclap_headache", { thunderclap_headache: true }],
  ["meningitis_pattern", { confusion: true, fever: true }],
  ["meningococcemia", { non_blanching_rash: true, fever: true }],
  ["acute_vision_loss", { acute_vision_loss: true }],
  ["new_seizure", { new_seizure: true }],
  ["syncope", { syncope: true }],
  ["hemoptysis", { hemoptysis: true }],
];
for (const [expectedId, flags] of redFlagCases) {
  const res = await request("/api/hunch/triage", { ...degraded, ...flags });
  assert.equal(res.triage_level, "EMERGENCY", `red flag ${expectedId}`);
  assert.equal(res.abstained, false, `red flag ${expectedId} must not abstain`);
  assert(res.triggered_red_flags.some(({ id }) => id === expectedId), `expected ${expectedId}`);
}
const degradedResult = await request("/api/hunch/triage", degraded);
assert.equal(degradedResult.triage_level, "INCOMPLETE_CHECK_REQUIRED");
assert.equal(degradedResult.abstained, true);
assert.equal(degradedResult.ml_comparator.agrees_with_rule, false);

const barger = vignettes.find(({ id }) => id === "barger_sleep").preset;
const earthSleep = await request("/api/hunch/triage", { ...barger, active_profile: "earth_1g" });
const orbitSleep = await request("/api/hunch/triage", { ...barger, active_profile: "mission_microgravity" });
assert.equal(earthSleep.triage_level, "MODERATE");
assert.equal(orbitSleep.triage_level, "LOW");
suiteCount++;
console.log("[3/7] NASA HUNCH safety gate PASS: 8/8 red flags override poor capture, missing-data abstains, Barger 2014 Earth-1g (MODERATE) vs Orbit (LOW) verified");

// ---------------------------------------------------------------------------
// Suite 4: ASTRA longitudinal episode state-machine governance invariants (6/6)
// ---------------------------------------------------------------------------
const ep = await request("/api/astra/episodes", {
  subject_id: `VERIFY-${randomUUID().slice(0, 6)}`,
  case_id: "recovery",
  reason: "Automated governance invariant test",
  active_profile: "mission_microgravity",
});
const epId = ep.episode.id;
assert.equal(ep.task.state, "pending");

const afterDismiss = await request(`/api/astra/episodes/${epId}/transition`, { action: "DISMISS" });
assert.equal(afterDismiss.episode.task.notification_dismissed, true);
assert.equal(afterDismiss.episode.task.state, "pending");

const afterBad = await request(`/api/astra/episodes/${epId}/transition`, { action: "BAD_CAPTURE", reason: "Motion artifact" });
assert.equal(afterBad.episode.task.state, "repeat_required");
assert.equal(afterBad.episode.decision.type, "INCOMPLETE_CHECK_REQUIRED");

await request(`/api/astra/episodes/${epId}/transition`, { action: "CLOSE", reason: "Premature close" }, 409);

const afterRecord = await request(`/api/astra/episodes/${epId}/transition`, { action: "RECORD", metric_value: 52.0 });
assert.equal(afterRecord.episode.task.state, "completed");

const afterOfflineSync = await request(`/api/astra/episodes/${epId}/transition`, { action: "SYNC" });
assert.equal(afterOfflineSync.episode.synchronization.status, "queued");
assert.equal(afterOfflineSync.episode.synchronization.remote_received, false);

await request(`/api/astra/episodes/${epId}/transition`, { action: "INTERNET", value: true });
const afterOnlineSync = await request(`/api/astra/episodes/${epId}/transition`, { action: "SYNC" });
assert.equal(afterOnlineSync.episode.synchronization.status, "received");
assert.equal(afterOnlineSync.episode.synchronization.remote_received, true);
assert.equal(afterOnlineSync.episode.synchronization.human_reviewed, false);

const afterDupSync = await request(`/api/astra/episodes/${epId}/transition`, { action: "SYNC" });
assert.equal(afterDupSync.episode.audit_trail.at(-1).action, "SYNC_IDEMPOTENT_DEDUP");

const afterReview = await request(`/api/astra/episodes/${epId}/transition`, { action: "REVIEW", reviewer: "CMO Test Harness" });
assert.equal(afterReview.episode.synchronization.human_reviewed, true);

await request(`/api/astra/episodes/${epId}/transition`, { action: "CLOSE", reason: " " }, 422);
const afterClose = await request(`/api/astra/episodes/${epId}/transition`, { action: "CLOSE", reason: "Verified recovery trend with CMO review" });
assert.equal(afterClose.episode.episode.status, "closed");
suiteCount++;
console.log("[4/7] ASTRA episode governance PASS: 6/6 state-machine invariants enforced (dismiss, bad capture, premature close 409, idempotent sync, empty close 422, reviewed close)");

// ---------------------------------------------------------------------------
// Suite 5: iPhone LiDAR signed tetrahedral volumetry & quality gates (3/3)
// ---------------------------------------------------------------------------
const cubeVerts = [
  [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
  [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10],
];
const cubeFaces = [
  [0, 2, 1], [0, 3, 2],
  [4, 5, 6], [4, 6, 7],
  [0, 1, 5], [0, 5, 4],
  [2, 3, 7], [2, 7, 6],
  [0, 4, 7], [0, 7, 3],
  [1, 2, 6], [1, 6, 5],
];
const lidarCube = await request("/api/astra/lidar-volume", {
  vertices: cubeVerts,
  faces: cubeFaces,
  baseline_volume_ml: 1000.0,
  observed_coverage_pct: 92.0,
  occluded_pct: 4.0,
  inferred_pct: 4.0,
  capture_mode: "raw_sceneDepth",
});
assert.equal(lidarCube.computed_volume_ml, 1000.0);
assert.equal(lidarCube.quality_gate_status, "PASS");

const lidarLowCov = await request("/api/astra/lidar-volume", {
  observed_coverage_pct: 70.0,
  occluded_pct: 20.0,
  inferred_pct: 10.0,
  capture_mode: "raw_sceneDepth",
});
assert.equal(lidarLowCov.quality_gate_status, "QUALITY_HOLD");

const lidarHallucinated = await request("/api/astra/lidar-volume", {
  observed_coverage_pct: 90.0,
  occluded_pct: 5.0,
  inferred_pct: 5.0,
  capture_mode: "personSegmentationWithDepth",
});
assert.equal(lidarHallucinated.quality_gate_status, "QUALITY_HOLD");
suiteCount++;
console.log("[5/7] LiDAR tetrahedral volumetry PASS: 10cm cube = 1000.0 mL (0.00% error), <82% coverage hold, personSegmentationWithDepth hold");

// ---------------------------------------------------------------------------
// Suite 6: Crew/Sol telemetry API isolation & provenance (5/5)
// ---------------------------------------------------------------------------
const intake = "/api/ingest/edge-telemetry";
const crewA = `Synthetic Alpha ${randomUUID()}`;
const crewB = crewA.replace("Alpha", "Bravo");
const packet = {
  crew_member: crewA,
  mission_sol: 142,
  source_device: "apple_watch_ultra_healthkit",
  heart_rate_bpm: 90,
};
const ingested = await request(intake, packet);
assert.equal(ingested.ingested, true);
assert.deepEqual(ingested.packet_record.updated_channels, ["heart_rate_bpm"]);
assert.deepEqual(ingested.packet_record.received_channels, ["heart_rate_bpm"]);
assert(ingested.packet_record.demo_default_channels.includes("joint_rom_deg"));
assert.equal(ingested.fused_telemetry_state.heart_rate_bpm, 90);
assert.equal(ingested.packet_record.watch_and_mobile_directive.wkhaptic_type, "WKHapticType.failure");

const mobilePacket = { source_device: "mobile_kinematics_app", mission_sol: 142, joint_rom_deg: 105 };
const otherCrew = await request(intake, { ...mobilePacket, crew_member: crewB });
const otherSol = await request(intake, { ...mobilePacket, crew_member: crewA, mission_sol: 143 });
for (const result of [otherCrew, otherSol]) {
  assert.deepEqual(result.packet_record.received_channels, ["joint_rom_deg"]);
  assert(result.packet_record.demo_default_channels.includes("heart_rate_bpm"));
  assert.notEqual(result.fused_telemetry_state.heart_rate_bpm, 90);
}
const combined = await request(intake, { ...mobilePacket, crew_member: crewA, joint_rom_deg: 112 });
assert.deepEqual(combined.packet_record.received_channels, ["heart_rate_bpm", "joint_rom_deg"]);
assert.equal(combined.fused_telemetry_state.heart_rate_bpm, 90);
assert.equal(combined.fused_telemetry_state.joint_rom_deg, 112);
await request(intake, { ...packet, heart_rate_bpm: 500 }, 422);
const query = new URLSearchParams({ crew_member: crewA, mission_sol: 142 });
const recent = await request(`/api/ingest/recent?${query}`);
assert.equal(recent.count, 2);
assert.equal(recent.fused_telemetry_state.heart_rate_bpm, 90);
assert.deepEqual(
  recent.packets.map(({ packet_id }) => packet_id),
  [combined.packet_record.packet_id, ingested.packet_record.packet_id]
);
suiteCount++;
console.log("[6/7] Telemetry API isolation PASS: merged within crew/day, isolated other crew/day, reported defaults, rejected HR=500 (422)");

// ---------------------------------------------------------------------------
// Suite 7: Real bundled NASA datasets, AURA guardrails & SEO/GEO endpoints (5/5)
// ---------------------------------------------------------------------------
const study = await request("/api/osdr-empirical");
assert.equal(study.study_id, "OSD-571 (GLDS-563)");
assert.equal(study.biomarkers.length, 14);
assert.equal(study.timepoints.length, 6);
for (const b of study.biomarkers) {
  const preVals = ["C001", "C002", "C003", "C004"]
    .flatMap((c) => ["_1", "_2", "_3"].map((s) => b.log10_intensities[c + s]))
    .filter((v) => typeof v === "number" && v > 0);
  const postVals = ["C001", "C002", "C003", "C004"]
    .map((c) => b.log10_intensities[c + "_4"])
    .filter((v) => typeof v === "number" && v > 0);
  const preMean = preVals.reduce((a, v) => a + v, 0) / preVals.length;
  const postMean = postVals.reduce((a, v) => a + v, 0) / postVals.length;
  assert(Math.abs(preMean - b.preflight_log10_mean) < 0.01, `${b.gene} preflight mean mismatch`);
  assert(Math.abs(10 ** (postMean - preMean) - b.postflight_fold_change) < 0.15, `${b.gene} fold-change mismatch`);
}

const supplements = await request("/api/aura/radlab");
assert.equal(supplements.radlab_iss_sample.row_count, 164);
assert.equal(supplements.radlab_iss_sample.instrument_summary.DosTel1.samples, 77);
assert.equal(supplements.radlab_iss_sample.instrument_summary.DosTel2.samples, 87);
assert.equal(supplements.barger_2014_sleep.tables.length, 7);
assert.equal(supplements.nasa_nlsp_manifest.datasets.length, 2);

const auraOverview = await request("/api/aura/overview");
assert.equal(auraOverview.counts.nasa_pmc_publications, 572);
assert.equal(auraOverview.counts.reviewed_sources, 70);
assert.equal(auraOverview.counts.apple_biomarker_studies, 15);
assert.equal(auraOverview.counts.bilingual_concepts, 16);

const humanOnly = await request("/api/aura/search?q=radiation&human_only=true&limit=10");
assert(humanOnly.results.length > 0);
assert(humanOnly.results.every((h) => h.is_human_applicable === true));

const liveReport = await request("/api/verification-report");
assert.equal(liveReport.summary.all_passed, true);
assert.equal(liveReport.summary.passed, 7);

for (const [docPath, needle] of [
  ["/", "Team AI-MED 01"],
  ["/project", "NASA-STD-3001"],
  ["/video", "Red flags are checked first"],
  ["/llms.txt", "api/verification-report"],
  ["/llms-full.txt", "1000.0 mL"],
  ["/robots.txt", "Sitemap:"],
  ["/sitemap.xml", "/llms.txt"],
]) {
  const txt = await request(docPath);
  assert(typeof txt === "string" && txt.includes(needle), `${docPath} missing expected marker "${needle}"`);
}
suiteCount++;
console.log("[7/7] Bundled NASA data, AURA guardrails & SEO/GEO routes PASS: OSD-571 math, 164 RadLab rows, 673 AURA items, 7/7 live verification API, /llms.txt & /project verified");
console.log(`\nALL ${suiteCount}/7 VERIFICATION SUITES PASSED.`);
