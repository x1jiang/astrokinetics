/**
 * Build the Official 7-Slide NASA Space Apps 2026 Executive Pitch Deck (v2 — Visual-QA Verified)
 * Output: submission_package/AstroKinetics_7Slide_Pitch_Deck.pptx
 * Strictly follows pptx/SKILL.md & pptxgenjs.md best practices (<= 7 slides hard cap, >=0.45" margins, >=0.25" block gaps).
 */
const path = require("path");
const fs = require("fs");

// Resolve pptxgenjs and sharp from /tmp/pptx_builder/node_modules
module.paths.unshift("/tmp/pptx_builder/node_modules");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const PKG = __dirname;
const IMG_DIR = path.join(PKG, "assets", "images");
const SHOT_DIR = path.join(PKG, "assets", "screenshots");
const PREP_DIR = path.join("/tmp/pptx_builder", "prepared_v2");
fs.mkdirSync(PREP_DIR, { recursive: true });

// Bespoke Deep-Space Clinical Palette (NO '#' prefixes per PptxGenJS rules!)
const C = {
  bgDeep: "070D1A",
  bgSlide: "0A1222",
  card: "111D34",
  cardAlt: "162440",
  border: "23385E",
  cyan: "38BDF8",
  cyanDark: "0C4A6E",
  emerald: "34D399",
  emeraldDark: "064E3B",
  amber: "FBBF24",
  amberDark: "78350F",
  coral: "FB7185",
  coralDark: "881337",
  violet: "A78BFA",
  white: "F8FAFC",
  text: "E2E8F0",
  muted: "94A3B8",
};

// Cross-platform native fonts present on both macOS LibreOffice & Windows/macOS PowerPoint
const FONT_HEAD = "Trebuchet MS";
const FONT_BODY = "Arial";
const FONT_MONO = "Courier New";

// Fresh shadow factory (NEVER reuse shadow objects across PptxGenJS calls!)
const makeShadow = (opacity = 0.26) => ({
  type: "outer",
  color: "000000",
  blur: 8,
  offset: 3,
  angle: 135,
  opacity,
});

/**
 * Use sharp to crop/resize any image cleanly to the exact target aspect ratio in inches (at 280 DPI)
 * so PptxGenJS never stretches, distorts, or mid-line clips screenshots.
 */
async function fitImage(srcPath, outName, wIn, hIn, fitMode = "cover", position = "centre", extractRegion = null, bgHex = "#FFFFFF") {
  const outPath = path.join(PREP_DIR, outName);
  const pxW = Math.round(wIn * 280);
  const pxH = Math.round(hIn * 280);
  let pipeline = sharp(srcPath);
  if (extractRegion) {
    pipeline = pipeline.extract(extractRegion);
  }
  await pipeline
    .resize(pxW, pxH, { fit: fitMode, position, background: bgHex })
    .png({ quality: 95 })
    .toFile(outPath);
  return outPath;
}

/**
 * Render crisp vector SVG badge icons to base64 PNG via sharp (256x256).
 */
async function svgIconBase64(svgBody, strokeHex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="#${strokeHex}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${svgBody}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

/**
 * Standard single-line top header for Slides 2–7.
 * Kicker: y=0.28..0.52; Title: y=0.58..0.94 (strictly 1 single line @ 18pt); Content begins at y=1.12.
 */
function addTopHeader(slide, pres, kickerText, titleText, slideNum) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5,
    y: 0.28,
    w: 2.55,
    h: 0.24,
    rectRadius: 0.06,
    fill: { color: C.cardAlt },
    line: { color: C.cyan, width: 0.8 },
  });
  slide.addText(kickerText, {
    x: 0.5,
    y: 0.28,
    w: 2.55,
    h: 0.24,
    fontFace: FONT_MONO,
    fontSize: 7.8,
    bold: true,
    color: C.cyan,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  slide.addText(`ASTROKINETICS  //  0${slideNum} / 07`, {
    x: 7.0,
    y: 0.28,
    w: 2.5,
    h: 0.24,
    fontFace: FONT_MONO,
    fontSize: 8.0,
    bold: true,
    color: C.muted,
    align: "right",
    valign: "middle",
    margin: 0,
  });

  slide.addText(titleText, {
    x: 0.5,
    y: 0.58,
    w: 9.0,
    h: 0.36,
    fontFace: FONT_HEAD,
    fontSize: 18.2,
    bold: true,
    color: C.white,
    align: "left",
    valign: "middle",
    margin: 0,
  });
}

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10.0" x 5.625"
  pres.author = "AstroKinetics Team — NASA Space Apps Houston 2026";
  pres.title = "AstroKinetics: Autonomous 3D Neuromotor, Multi-Sensor & Neuro-Acoustic Crew Health Suite";
  pres.subject = "2026 NASA International Space Apps Challenge";

  // Pre-render vector icons
  const icCamera = await svgIconBase64(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    C.cyan
  );
  const icBody = await svgIconBase64(
    '<circle cx="12" cy="4.5" r="2"/><path d="M6 9h12"/><path d="M12 6.5v6.5"/><path d="M12 13l-3.5 7"/><path d="M12 13l3.5 7"/>',
    C.emerald
  );
  const icHand = await svgIconBase64(
    '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    C.amber
  );
  const icWatch = await svgIconBase64(
    '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2h6v4H9z"/><path d="M9 18h6v4H9z"/><path d="M9 12h2l1-2.5l1.5 5l1-2.5H16"/>',
    C.coral
  );
  const icWave = await svgIconBase64(
    '<path d="M2 12h3l2.5-6l3 12l3-9l2 5l2.5-2H22"/>',
    C.cyan
  );
  const icMic = await svgIconBase64(
    '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>',
    C.amber
  );
  const icShield = await svgIconBase64(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    C.emerald
  );

  // Pre-crop & size all images cleanly with explicit safe regions so no screenshot text is sliced mid-glyph
  const imgHeroMars = await fitImage(path.join(IMG_DIR, "hero_mars_blackout_astronaut.jpg"), "s1_hero.png", 4.28, 2.17, "cover", "centre");
  const imgHeroApp = await fitImage(
    path.join(SHOT_DIR, "v33_scen3_squat.png"),
    "s1_app.png",
    4.28,
    2.175,
    "contain",
    "top",
    { left: 0, top: 0, width: 2880, height: 1510 },
    "#F8FAFC"
  );
  const imgSensorConcept = await fitImage(path.join(IMG_DIR, "multimodal_sensor_fusion_concept.jpg"), "s2_sensor.png", 4.10, 2.45, "cover", "centre");

  // Slide 3 right-column screenshots: clean full-card crops without slicing bottom code box
  const imgTab1Twin = await fitImage(
    path.join(SHOT_DIR, "v33_scen3_squat.png"),
    "s3_tab1.png",
    4.32,
    1.84,
    "contain",
    "top",
    { left: 0, top: 0, width: 2880, height: 1260 },
    "#F8FAFC"
  );
  const imgTab3Api = await fitImage(
    path.join(SHOT_DIR, "v33_tab3_watch_mobile_api.png"),
    "s3_tab3.png",
    4.32,
    1.84,
    "contain",
    "top",
    { left: 0, top: 0, width: 2880, height: 1210 },
    "#F8FAFC"
  );

  // Slide 4 right-top radar crop: include complete 5th variance row ("HRV RMSSD (ms) 2.6%") + bottom radar vertex, stopping cleanly in white gutter above lower cards
  const imgRadarCrop = await fitImage(
    path.join(SHOT_DIR, "v33_scen2_co2.png"),
    "s4_radar.png",
    4.32,
    2.12,
    "contain",
    "centre",
    { left: 1550, top: 405, width: 1300, height: 794 },
    "#FFFFFF"
  );

  // Slide 5 top visuals
  const imgTab2Neuro = await fitImage(
    path.join(SHOT_DIR, "v33_tab2_neuro_voice.png"),
    "s5_tab2.png",
    4.64,
    2.12,
    "contain",
    "top",
    { left: 0, top: 0, width: 2880, height: 1320 },
    "#F8FAFC"
  );
  const imgShelter = await fitImage(path.join(IMG_DIR, "spe_storm_shelter_neuroacoustic.jpg"), "s5_shelter.png", 3.98, 2.12, "cover", "centre");

  // Slide 6 2x2 scenario thumbnails (2.12" x 1.54")
  const scenExtract = { left: 0, top: 0, width: 2880, height: 1760 };
  const imgScen1 = await fitImage(path.join(SHOT_DIR, "v33_scen1_nominal.png"), "s6_sc1.png", 2.12, 1.54, "contain", "top", scenExtract, "#F8FAFC");
  const imgScen2 = await fitImage(path.join(SHOT_DIR, "v33_scen2_co2.png"), "s6_sc2.png", 2.12, 1.54, "contain", "top", scenExtract, "#F8FAFC");
  const imgScen3 = await fitImage(path.join(SHOT_DIR, "v33_scen3_squat.png"), "s6_sc3.png", 2.12, 1.54, "contain", "top", scenExtract, "#F8FAFC");
  const imgScen4 = await fitImage(path.join(SHOT_DIR, "v33_scen4_spe.png"), "s6_sc4.png", 2.12, 1.54, "contain", "top", scenExtract, "#F8FAFC");

  // Slide 7 diptych (4.22" x 2.48")
  const imgDualUse = await fitImage(path.join(IMG_DIR, "space_to_earth_dual_use.jpg"), "s7_dual.png", 4.22, 2.48, "cover", "centre");

  // ==========================================================================
  // SLIDE 1: HERO TITLE & LIVE CLOUD RUN PLATFORM (y = 0.45 .. 5.175 exact)
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgDeep };

    // Left subtle vertical accent strip
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.12,
      h: 5.625,
      fill: { color: C.cyan },
    });

    // Event badge (y = 0.45..0.75, w = 4.38)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.52,
      y: 0.45,
      w: 4.38,
      h: 0.30,
      rectRadius: 0.07,
      fill: { color: C.cardAlt },
      line: { color: C.cyan, width: 1 },
    });
    s.addText("2026 NASA SPACE APPS CHALLENGE  |  HOUSTON", {
      x: 0.52,
      y: 0.45,
      w: 4.38,
      h: 0.30,
      fontFace: FONT_MONO,
      fontSize: 8.3,
      bold: true,
      color: C.cyan,
      align: "center",
      valign: "middle",
      margin: 0,
    });

    // Hero Title
    s.addText("AstroKinetics", {
      x: 0.52,
      y: 0.88,
      w: 4.38,
      h: 0.64,
      fontFace: FONT_HEAD,
      fontSize: 38,
      bold: true,
      color: C.white,
      align: "left",
      valign: "middle",
      margin: 0,
    });

    // Subtitle
    s.addText("Autonomous 3D Neuromotor, Multi-Sensor & Neuro-Acoustic Crew Health Suite", {
      x: 0.52,
      y: 1.58,
      w: 4.38,
      h: 0.58,
      fontFace: FONT_HEAD,
      fontSize: 14.2,
      bold: true,
      color: C.cyan,
      align: "left",
      valign: "top",
      margin: 0,
    });

    // Mission Pitch
    s.addText(
      "Offline-first onboard flight-surgeon co-pilot fusing 3D camera biomechanics, 3-zone facial POS-rPPG, Apple Watch + mobile REST telemetry, and NASA OSDR OSD-571 proteomics to isolate covariant health drift during 44-minute Mars communication blackouts.",
      {
        x: 0.52,
        y: 2.26,
        w: 4.38,
        h: 1.18,
        fontFace: FONT_BODY,
        fontSize: 11.4,
        color: C.text,
        align: "left",
        valign: "top",
        margin: 0,
      }
    );

    // 3 Provenance Pills (exact total width 1.38 + 0.14 + 1.38 + 0.14 + 1.34 = 4.38", flush with card!)
    const pills = [
      { lbl: "NASA OSDR OSD-571", col: C.emerald, bg: C.emeraldDark, w: 1.38 },
      { lbl: "8-DOF MAHALANOBIS", col: C.cyan, bg: C.cyanDark, w: 1.38 },
      { lbl: "100% OFFLINE PWA", col: C.amber, bg: C.amberDark, w: 1.34 },
    ];
    let px = 0.52;
    pills.forEach((p) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: px,
        y: 3.62,
        w: p.w,
        h: 0.28,
        rectRadius: 0.06,
        fill: { color: p.bg },
        line: { color: p.col, width: 0.8 },
      });
      s.addText(p.lbl, {
        x: px,
        y: 3.62,
        w: p.w,
        h: 0.28,
        fontFace: FONT_MONO,
        fontSize: 7.2,
        bold: true,
        color: p.col,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      px += p.w + 0.14;
    });

    // Live Cloud Run Callout Card (y = 4.18 .. 5.175 -> exact 0.45" bottom margin!)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.52,
      y: 4.18,
      w: 4.38,
      h: 0.995,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.52,
      y: 4.18,
      w: 0.08,
      h: 0.995,
      fill: { color: C.emerald },
    });
    s.addText("LIVE ZERO-INSTALL CLOUD RUN DEPLOYMENT (APACHE-2.0)", {
      x: 0.72,
      y: 4.30,
      w: 4.06,
      h: 0.22,
      fontFace: FONT_MONO,
      fontSize: 7.5,
      bold: true,
      color: C.emerald,
      valign: "middle",
      margin: 0,
    });
    s.addText("https://astrokinetics-space-health-765428358644.us-central1.run.app", {
      x: 0.72,
      y: 4.64,
      w: 4.06,
      h: 0.30,
      fontFace: FONT_BODY,
      fontSize: 8.6,
      bold: true,
      color: C.white,
      valign: "middle",
      hyperlink: { url: "https://astrokinetics-space-health-765428358644.us-central1.run.app" },
      margin: 0,
    });

    // Right Visual Stack (x = 5.16, w = 4.34 -> 0.26" gap from left col, 0.50" right margin; y = 0.45 .. 5.175 exact!)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.16,
      y: 0.45,
      w: 4.34,
      h: 2.23,
      fill: { color: C.card },
      line: { color: C.cyan, width: 1.2 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgHeroMars, x: 5.19, y: 0.48, w: 4.28, h: 2.17 });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.16,
      y: 2.94,
      w: 4.34,
      h: 2.235,
      fill: { color: C.card },
      line: { color: C.emerald, width: 1.2 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgHeroApp, x: 5.19, y: 2.97, w: 4.28, h: 2.175 });
  }

  // ==========================================================================
  // SLIDE 2: PROBLEM — 44-MIN MARS BLACKOUTS & COVARIANT SYMPTOM OVERLAP
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgSlide };
    addTopHeader(s, pres, "01 // OPERATIONAL PROBLEM", "Why Earth-Tethered Telemedicine Fails Beyond Low Earth Orbit", 2);

    // Top Row: 3 Giant Stat Cards (y = 1.12..2.40, w = 2.83, gaps = 0.255", right edge = 9.50")
    const stats = [
      {
        num: "44 min",
        col: C.coral,
        lbl: "Mars Delay & 14-Day Blackouts",
        sub: "No live flight surgeon during acute SPE radiation or CO2 scrubber faults.",
      },
      {
        num: "5 Hazards",
        col: C.amber,
        lbl: "Overlapping Multi-System Drift",
        sub: "Tremor + slow PVT can stem from cabin ppCO2, 0g unloading, fatigue, or radiation.",
      },
      {
        num: "100%",
        col: C.emerald,
        lbl: "Onboard Edge Autonomy Required",
        sub: "Crew must sense, separate covariant causes, and act locally with zero cloud link.",
      },
    ];
    stats.forEach((st, idx) => {
      const cx = 0.5 + idx * 3.085;
      s.addShape(pres.shapes.RECTANGLE, {
        x: cx,
        y: 1.12,
        w: 2.83,
        h: 1.28,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.22),
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: cx,
        y: 1.12,
        w: 2.83,
        h: 0.06,
        fill: { color: st.col },
      });
      s.addText(st.num, {
        x: cx + 0.16,
        y: 1.22,
        w: 2.51,
        h: 0.44,
        fontFace: FONT_HEAD,
        fontSize: 25,
        bold: true,
        color: st.col,
        valign: "middle",
        margin: 0,
      });
      s.addText(st.lbl, {
        x: cx + 0.16,
        y: 1.69,
        w: 2.51,
        h: 0.22,
        fontFace: FONT_BODY,
        fontSize: 10.4,
        bold: true,
        color: C.white,
        valign: "middle",
        margin: 0,
      });
      s.addText(st.sub, {
        x: cx + 0.16,
        y: 1.94,
        w: 2.51,
        h: 0.40,
        fontFace: FONT_BODY,
        fontSize: 9.3,
        color: C.muted,
        valign: "top",
        margin: 0,
      });
    });

    // Bottom Left: Multimodal Sensor Fusion Illustration (y = 2.66..5.17 -> 0.26" gap, 0.455" bottom margin)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y: 2.66,
      w: 4.16,
      h: 2.51,
      fill: { color: C.card },
      line: { color: C.cyan, width: 1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgSensorConcept, x: 0.53, y: 2.69, w: 4.10, h: 2.45 });

    // Bottom Right: 3 Failure Modes (x = 4.92, w = 4.58 -> 0.26" gap from image, ends at y = 5.17 exact)
    const gaps = [
      {
        tag: "GAP 1",
        col: C.coral,
        title: "Single-Threshold Alarms Confuse Habitat & Body",
        desc: "Univariate HR or reaction alerts cannot distinguish a failing CDRA CO2 bed (ppCO2 2.85 mmHg) from microgravity ARED asymmetry or autonomic stress.",
      },
      {
        tag: "GAP 2",
        col: C.amber,
        title: "Lab Mocap & Cloud Vision Cannot Fly Deep Space",
        desc: "Multi-camera optical labs waste mass and bandwidth; crew need commodity cabin cameras + smartwatches running 100% in local WebGPU/WASM.",
      },
      {
        tag: "GAP 3",
        col: C.cyan,
        title: "Crew Under-Report Stress Without Role Privacy",
        desc: "Astronauts avoid logging fatigue if peers see raw entries—requiring role-tiered privacy masking with emergency flight-surgeon escalation.",
      },
    ];
    gaps.forEach((g, idx) => {
      const gy = 2.66 + idx * 0.88;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 4.92,
        y: gy,
        w: 4.58,
        h: 0.75,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 4.92,
        y: gy,
        w: 0.08,
        h: 0.75,
        fill: { color: g.col },
      });
      s.addText(`${g.tag}  |  ${g.title}`, {
        x: 5.12,
        y: gy + 0.07,
        w: 4.28,
        h: 0.21,
        fontFace: FONT_BODY,
        fontSize: 10.1,
        bold: true,
        color: C.white,
        valign: "middle",
        margin: 0,
      });
      s.addText(g.desc, {
        x: 5.12,
        y: gy + 0.31,
        w: 4.28,
        h: 0.39,
        fontFace: FONT_BODY,
        fontSize: 9.1,
        color: C.text,
        valign: "top",
        margin: 0,
      });
    });
  }

  // ==========================================================================
  // SLIDE 3: PILLAR 1 (GATHER) — MULTI-ZONE 3D VISION, rPPG & WEARABLE MESH
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgSlide };
    addTopHeader(s, pres, "02 // GATHER INDICATORS", "Multi-Zone 3D Vision, Contactless rPPG & Watch/Mobile API", 3);

    const sensors = [
      {
        icon: icCamera,
        ringBg: C.cyanDark,
        col: C.cyan,
        title: "478-pt FaceMesh & 3-Zone rPPG",
        desc: "Auto-detects close-up framing: samples forehead + malar cheeks (avoiding glasses), EAR/PERCLOS drowsiness & facial symmetry.",
      },
      {
        icon: icBody,
        ringBg: C.emeraldDark,
        col: C.emerald,
        title: "3D Musculoskeletal + 1g Ghost",
        desc: "1-Euro 3D WorldPose goniometry, dual ARED force-plate GRF vectors, %MVC heatmap & Cyan Pre-Flight 1g Baseline Ghost.",
      },
      {
        icon: icHand,
        ringBg: C.amberDark,
        col: C.amber,
        title: "21-Joint Hand Neuromotor Rig",
        desc: "Quantifies 4–12 Hz postural/radiation RMS tremor (mm), finger-tap cadence (Hz), and thumb-index pinch aperture in real time.",
      },
      {
        icon: icWatch,
        ringBg: C.coralDark,
        col: C.coral,
        title: "Watch + Mobile + ECLSS Bus",
        desc: "Live POST /api/ingest/edge-telemetry fuses Apple Watch HR/HRV/SpO2, mobile kinematics, 3-trial PVT, ppCO2 & mSv/day dosimetry.",
      },
    ];

    // Left 2x2 grid aligned flush with right stacked screenshots: Row 1 y=1.12..3.02 (h=1.90), 0.25" gap, Row 2 y=3.27..5.17 (h=1.90)
    sensors.forEach((sn, idx) => {
      const colIdx = idx % 2;
      const rowIdx = Math.floor(idx / 2);
      const sx = 0.5 + colIdx * 2.31; // 0.50 and 2.81, w = 2.06 -> gap = 0.25", ends 4.87"
      const sy = 1.12 + rowIdx * 2.15;
      s.addShape(pres.shapes.RECTANGLE, {
        x: sx,
        y: sy,
        w: 2.06,
        h: 1.90,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.2),
      });
      s.addShape(pres.shapes.OVAL, {
        x: sx + 0.14,
        y: sy + 0.13,
        w: 0.40,
        h: 0.40,
        fill: { color: sn.ringBg },
        line: { color: sn.col, width: 1 },
      });
      s.addImage({ data: sn.icon, x: sx + 0.22, y: sy + 0.21, w: 0.24, h: 0.24 });
      s.addText(sn.title, {
        x: sx + 0.14,
        y: sy + 0.60,
        w: 1.78,
        h: 0.36,
        fontFace: FONT_BODY,
        fontSize: 10.3,
        bold: true,
        color: C.white,
        valign: "top",
        margin: 0,
      });
      s.addText(sn.desc, {
        x: sx + 0.14,
        y: sy + 1.00,
        w: 1.78,
        h: 0.80,
        fontFace: FONT_BODY,
        fontSize: 8.9,
        color: C.text,
        valign: "top",
        margin: 0,
      });
    });

    // Right Column: Stacked Live Retina Screenshots (x = 5.12, w = 4.38 -> 0.25" gap from left grid, ends 9.50")
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.12,
      y: 1.12,
      w: 4.38,
      h: 1.90,
      fill: { color: C.card },
      line: { color: C.cyan, width: 1.1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgTab1Twin, x: 5.15, y: 1.15, w: 4.32, h: 1.84 });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.12,
      y: 3.27,
      w: 4.38,
      h: 1.90,
      fill: { color: C.card },
      line: { color: C.emerald, width: 1.1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgTab3Api, x: 5.15, y: 3.30, w: 4.32, h: 1.84 });
  }

  // ==========================================================================
  // SLIDE 4: PILLAR 2 (EVALUATE OFFLINE) — 8-DOF MAHALANOBIS & NASA OSD-571
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgSlide };
    addTopHeader(s, pres, "03 // EVALUATE OFFLINE", "8-DOF Mahalanobis Whitening & Empirical NASA OSDR OSD-571 Cohort", 4);

    // Left Card: Native PptxGenJS Bar Chart (x = 0.50, y = 1.12, w = 4.36, h = 4.05 -> ends 5.17")
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y: 1.12,
      w: 4.36,
      h: 4.05,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      shadow: makeShadow(),
    });
    s.addText("Empirical NASA OSDR OSD-571 (GLDS-563)", {
      x: 0.68,
      y: 1.23,
      w: 4.0,
      h: 0.24,
      fontFace: FONT_HEAD,
      fontSize: 12.8,
      bold: true,
      color: C.cyan,
      valign: "middle",
      margin: 0,
    });
    s.addText("SpaceX Inspiration4 Astronaut Plasma Shift at R+1 (Fold-Change vs. Pre-Flight L-92..L-3)", {
      x: 0.68,
      y: 1.50,
      w: 4.0,
      h: 0.30,
      fontFace: FONT_BODY,
      fontSize: 9.2,
      color: C.muted,
      valign: "top",
      margin: 0,
    });

    s.addChart(
      pres.charts.BAR,
      [
        {
          name: "R+1 Fold Change",
          labels: ["CAT (ROS)", "PRDX2 (Rad)", "HBA1 (Heme)", "TLN1 (Muscle)", "Baseline (1g)"],
          values: [5.24, 5.09, 4.36, 2.36, 1.0],
        },
      ],
      {
        x: 0.60,
        y: 1.86,
        w: 4.14,
        h: 2.72,
        barDir: "bar",
        chartColors: [C.cyan],
        chartArea: { fill: { color: C.cardAlt }, roundedCorners: false },
        catAxisLabelColor: C.text,
        catAxisLabelFontFace: FONT_BODY,
        catAxisLabelFontSize: 9.2,
        valAxisLabelColor: C.muted,
        valAxisLabelFontFace: FONT_MONO,
        valAxisLabelFontSize: 8.2,
        valAxisMinVal: 0,
        valAxisMaxVal: 6.4,
        valGridLine: { color: C.border, size: 0.5 },
        catGridLine: { style: "none" },
        showValue: true,
        dataLabelFormatCode: "0.00",
        dataLabelPosition: "outEnd",
        dataLabelColor: C.amber,
        dataLabelFontFace: FONT_MONO,
        dataLabelFontSize: 8.8,
        showLegend: false,
      }
    );

    s.addText("14 longitudinal astronaut biomarkers cached offline + verified via /api/nasa-osdr.", {
      x: 0.68,
      y: 4.68,
      w: 4.0,
      h: 0.38,
      fontFace: FONT_BODY,
      fontSize: 9.2,
      italic: true,
      color: C.emerald,
      valign: "middle",
      margin: 0,
    });

    // Right Top: Unclipped 8-DOF Covariance Envelope Radar & Variance Drivers (x = 5.12, y = 1.12, w = 4.38, h = 2.18)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.12,
      y: 1.12,
      w: 4.38,
      h: 2.18,
      fill: { color: C.card },
      line: { color: C.amber, width: 1.1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgRadarCrop, x: 5.15, y: 1.15, w: 4.32, h: 2.12 });

    // Right Bottom: 3-Step Statistical Engine Card (x = 5.12, y = 3.55, w = 4.38, h = 1.62 -> 0.25" gap, ends 5.17")
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.12,
      y: 3.55,
      w: 4.38,
      h: 1.62,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.12,
      y: 3.55,
      w: 0.08,
      h: 1.62,
      fill: { color: C.cyan },
    });
    s.addText("Individualized 8-DOF Covariance Triage (100% Offline)", {
      x: 5.30,
      y: 3.63,
      w: 4.06,
      h: 0.22,
      fontFace: FONT_HEAD,
      fontSize: 11.4,
      bold: true,
      color: C.white,
      valign: "middle",
      margin: 0,
    });
    s.addText(
      [
        { text: "▸ Cholesky Whitening (Dₘ): ", options: { bold: true, color: C.cyan } },
        {
          text: "Normalizes 8 correlated vitals, kinematics & cabin axes against pre-flight covariance.",
          options: { color: C.text, breakLine: true },
        },
        { text: "▸ Chi-Square Survival (df = 8): ", options: { bold: true, color: C.emerald } },
        {
          text: "Exact p-value separates Watch (p < 0.08) vs. Action Alert (p < 0.001) without false alarms.",
          options: { color: C.text, breakLine: true },
        },
        { text: "▸ Variance Attribution (% of Dₘ²): ", options: { bold: true, color: C.amber } },
        {
          text: "Pinpoints exact root cause (e.g., PVT 46.5% + ppCO2 26.3% in Sol 088 hypercapnia).",
          options: { color: C.text },
        },
      ],
      {
        x: 5.30,
        y: 3.90,
        w: 4.06,
        h: 1.18,
        fontFace: FONT_BODY,
        fontSize: 9.1,
        valign: "top",
        paraSpaceAfter: 3,
        margin: 0,
      }
    );
  }

  // ==========================================================================
  // SLIDE 5: PILLAR 3 (ACT) — NEURO-ACOUSTIC THERAPY, VOCAL DSP & PRIVACY
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgSlide };
    addTopHeader(s, pres, "04 // IMMEDIATE CREW ACTION", "Closed-Loop Neuro-Acoustic Therapy, Vocal DSP & Crew Privacy", 5);

    // Top-Left: Live Tab 2 Neuro-Acoustic & Lissajous Scope Screenshot (x = 0.50, y = 1.12, w = 4.70, h = 2.18)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y: 1.12,
      w: 4.70,
      h: 2.18,
      fill: { color: C.card },
      line: { color: C.cyan, width: 1.1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgTab2Neuro, x: 0.53, y: 1.15, w: 4.64, h: 2.12 });

    // Top-Right: Storm Shelter Neuro-Acoustic Illustration (x = 5.46, y = 1.12, w = 4.04, h = 2.18 -> 0.26" gap, ends 9.50")
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.46,
      y: 1.12,
      w: 4.04,
      h: 2.18,
      fill: { color: C.card },
      line: { color: C.violet, width: 1.1 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgShelter, x: 5.49, y: 1.15, w: 3.98, h: 2.12 });

    // Bottom Row: 3 Action Pillars (y = 3.55..5.17 -> 0.25" gap, 0.455" bottom margin; w = 2.83, gaps = 0.255")
    const actions = [
      {
        icon: icWave,
        bg: C.cyanDark,
        col: C.cyan,
        title: "4 Closed-Loop Music Protocols",
        desc: "Real-time WebAudio couples 3D joint ROM & trunk tilt to 16 Hz Motor RAS, 10 Hz Alpha (0.1 Hz HRV), 40 Hz Gamma, or 2.5 Hz Shelter Delta + Watch haptics.",
      },
      {
        icon: icMic,
        bg: C.amberDark,
        col: C.amber,
        title: "Vocal Biomarkers & Voice Surgeon",
        desc: "85 Hz cabin-rumble filter + Boersma autocorrelation extracts pitch F0, glottal jitter & HNR clarity; spoken briefings auto-duck music by -10 dB.",
      },
      {
        icon: icShield,
        bg: C.emeraldDark,
        col: C.emerald,
        title: "3-Tier Privacy & Burst Downlink",
        desc: "Masks crew mood journals in Commander view while unlocking emergency Surgeon overrides and queuing <2 KB Store-and-Forward JSON packets.",
      },
    ];
    actions.forEach((ac, idx) => {
      const ax = 0.5 + idx * 3.085;
      s.addShape(pres.shapes.RECTANGLE, {
        x: ax,
        y: 3.55,
        w: 2.83,
        h: 1.62,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.2),
      });
      s.addShape(pres.shapes.OVAL, {
        x: ax + 0.14,
        y: 3.68,
        w: 0.36,
        h: 0.36,
        fill: { color: ac.bg },
        line: { color: ac.col, width: 1 },
      });
      s.addImage({ data: ac.icon, x: ax + 0.21, y: 3.75, w: 0.22, h: 0.22 });
      s.addText(ac.title, {
        x: ax + 0.58,
        y: 3.69,
        w: 2.13,
        h: 0.34,
        fontFace: FONT_BODY,
        fontSize: 10.2,
        bold: true,
        color: C.white,
        valign: "middle",
        margin: 0,
      });
      s.addText(ac.desc, {
        x: ax + 0.14,
        y: 4.13,
        w: 2.55,
        h: 0.94,
        fontFace: FONT_BODY,
        fontSize: 9.2,
        color: C.text,
        valign: "top",
        margin: 0,
      });
    });
  }

  // ==========================================================================
  // SLIDE 6: 4-SCENARIO DEEP-SPACE VALIDATION MATRIX (2x2 LIVE SCREENSHOTS)
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgSlide };
    addTopHeader(s, pres, "05 // SCENARIO VALIDATION", "Verified Differential Triage Across Four Mission Hazard Profiles", 6);

    const scens = [
      {
        img: imgScen1,
        col: C.emerald,
        badgeBg: C.emeraldDark,
        tier: "99.2  |  NOMINAL",
        title: "Sol 014: Artemis Lunar Orbit",
        stats: "Dₘ = 0.24 (p = 1.000)\nRx: 10 Hz Alpha HRV",
        directive: "ROUTINE: All 8 axes inside 95% pre-flight ellipsoid; continue scheduled ARED.",
      },
      {
        img: imgScen2,
        col: C.amber,
        badgeBg: C.amberDark,
        tier: "78.3  |  CO2 WATCH",
        title: "Sol 088: Cabin CO2 Drift",
        stats: "Dₘ = 3.85 (p = 0.063)\nRx: 40 Hz Gamma Focus",
        directive: "MODERATE: Switch CDRA CO2 desiccant bed (<2.0 mmHg) & re-test 3-trial PVT.",
      },
      {
        img: imgScen3,
        col: C.coral,
        badgeBg: C.coralDark,
        tier: "44.7  |  KINEMATIC ALERT",
        title: "Sol 142: 0g Squat Drift",
        stats: "Dₘ = 6.99 (p < 0.0001)\nRx: 16 Hz Motor RAS",
        directive: "HIGH: Reduce unilateral ARED load 15% + 1g Ghost plumb & 14 RPM RAS pacing.",
      },
      {
        img: imgScen4,
        col: C.coral,
        badgeBg: C.coralDark,
        tier: "12.0  |  SPE CRITICAL",
        title: "Sol 210: Solar Particle Event",
        stats: "Dₘ = 12.03 (3.45 mSv/d)\nRx: 2.5 Hz Shelter Delta",
        directive: "CRITICAL: Water-wall storm shelter, 2h tremor check & +24h OSD-571 CBC panel.",
      },
    ];

    // 2x2 Matrix: x = 0.50 & 5.13 (w = 4.37, 0.26" gap, ends 9.50"); y = 1.12 & 3.27 (h = 1.90, 0.25" gap, ends 5.17")
    scens.forEach((sc, idx) => {
      const colIdx = idx % 2;
      const rowIdx = Math.floor(idx / 2);
      const bx = 0.5 + colIdx * 4.63;
      const by = 1.12 + rowIdx * 2.15;

      s.addShape(pres.shapes.RECTANGLE, {
        x: bx,
        y: by,
        w: 4.37,
        h: 1.90,
        fill: { color: C.card },
        line: { color: sc.col, width: 1 },
        shadow: makeShadow(0.22),
      });
      s.addImage({ path: sc.img, x: bx + 0.10, y: by + 0.18, w: 2.12, h: 1.54 });

      // Score pill (0.13" inner gap right of screenshot)
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: bx + 2.35,
        y: by + 0.14,
        w: 1.90,
        h: 0.25,
        rectRadius: 0.06,
        fill: { color: sc.badgeBg },
        line: { color: sc.col, width: 0.8 },
      });
      s.addText(sc.tier, {
        x: bx + 2.35,
        y: by + 0.14,
        w: 1.90,
        h: 0.25,
        fontFace: FONT_MONO,
        fontSize: 7.6,
        bold: true,
        color: sc.col,
        align: "center",
        valign: "middle",
        margin: 0,
      });

      s.addText(sc.title, {
        x: bx + 2.35,
        y: by + 0.45,
        w: 1.92,
        h: 0.22,
        fontFace: FONT_BODY,
        fontSize: 10.1,
        bold: true,
        color: C.white,
        valign: "middle",
        margin: 0,
      });
      s.addText(sc.stats, {
        x: bx + 2.35,
        y: by + 0.71,
        w: 1.92,
        h: 0.34,
        fontFace: FONT_MONO,
        fontSize: 7.5,
        bold: true,
        color: C.cyan,
        valign: "top",
        margin: 0,
      });
      s.addText(sc.directive, {
        x: bx + 2.35,
        y: by + 1.10,
        w: 1.92,
        h: 0.68,
        fontFace: FONT_BODY,
        fontSize: 8.9,
        color: C.text,
        valign: "top",
        margin: 0,
      });
    });
  }

  // ==========================================================================
  // SLIDE 7: GALACTIC-TO-LOCAL DUAL-USE IMPACT & JUDGING SCORECARD
  // ==========================================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bgDeep };
    addTopHeader(s, pres, "06 // SPACE-TO-EARTH IMPACT", "From Mars Blackouts to Offline Rural & Austere Tele-Rehabilitation", 7);

    // Top-Left: Space-to-Earth Diptych Artwork (x = 0.50, y = 1.12, w = 4.28, h = 2.54 -> ends 3.66")
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y: 1.12,
      w: 4.28,
      h: 2.54,
      fill: { color: C.card },
      line: { color: C.emerald, width: 1.2 },
      shadow: makeShadow(),
    });
    s.addImage({ path: imgDualUse, x: 0.53, y: 1.15, w: 4.22, h: 2.48 });

    // Top-Right: Dual-Use Comparison Table (x = 5.04, y = 1.12, w = 4.46, h = 2.54 -> 0.26" gap, ends 3.66" flush!)
    const cellPad = [2.5, 5, 2.5, 5];
    const tblRows = [
      [
        { text: "Capability", options: { fill: { color: C.cardAlt }, color: C.cyan, bold: true, fontSize: 9.2, margin: cellPad } },
        { text: "Artemis & Mars Transit", options: { fill: { color: C.cardAlt }, color: C.emerald, bold: true, fontSize: 9.2, margin: cellPad } },
        { text: "Rural & Austere Clinics", options: { fill: { color: C.cardAlt }, color: C.amber, bold: true, fontSize: 9.2, margin: cellPad } },
      ],
      [
        { text: "Connectivity", options: { fill: { color: C.card }, color: C.white, bold: true, fontSize: 8.8, margin: cellPad } },
        { text: "44-min delay & SPE blackouts (offline PWA)", options: { fill: { color: C.card }, color: C.text, fontSize: 8.6, margin: cellPad } },
        { text: "Zero-broadband rural, Alaskan & disaster care", options: { fill: { color: C.card }, color: C.text, fontSize: 8.6, margin: cellPad } },
      ],
      [
        { text: "Hardware", options: { fill: { color: C.cardAlt }, color: C.white, bold: true, fontSize: 8.8, margin: cellPad } },
        { text: "Cabin camera + crew watch + ECLSS bus", options: { fill: { color: C.cardAlt }, color: C.text, fontSize: 8.6, margin: cellPad } },
        { text: "Commodity laptop/phone camera + watch", options: { fill: { color: C.cardAlt }, color: C.text, fontSize: 8.6, margin: cellPad } },
      ],
      [
        { text: "Clinical Value", options: { fill: { color: C.card }, color: C.white, bold: true, fontSize: 8.8, margin: cellPad } },
        { text: "CO2 vs. 0g unloading vs. radiation tremor", options: { fill: { color: C.card }, color: C.text, fontSize: 8.6, margin: cellPad } },
        { text: "Ortho ROM, Parkinson tremor & cardio rPPG", options: { fill: { color: C.card }, color: C.text, fontSize: 8.6, margin: cellPad } },
      ],
      [
        { text: "Privacy", options: { fill: { color: C.cardAlt }, color: C.white, bold: true, fontSize: 8.8, margin: cellPad } },
        { text: "Zero raw video downlink; <2 KB burst", options: { fill: { color: C.cardAlt }, color: C.text, fontSize: 8.6, margin: cellPad } },
        { text: "Zero cloud PHI upload; HIPAA-ready edge AI", options: { fill: { color: C.cardAlt }, color: C.text, fontSize: 8.6, margin: cellPad } },
      ],
    ];
    s.addTable(tblRows, {
      x: 5.04,
      y: 1.12,
      w: 4.46,
      rowH: [0.38, 0.54, 0.54, 0.54, 0.54],
      colW: [0.96, 1.75, 1.75],
      border: { pt: 0.8, color: C.border },
      fontFace: FONT_BODY,
      valign: "middle",
    });

    // Middle Strip: 5 Space Apps Judging Criteria Badges (y = 3.91..4.55 -> 0.25" gap; w = 1.64, step = 1.84 -> ends 9.50" exact!)
    const rubric = [
      { k: "IMPACT", v: "Mars + Rural Clinics", col: C.emerald },
      { k: "CREATIVITY", v: "3D Ghost + Music Rx", col: C.cyan },
      { k: "VALIDITY", v: "Mahalanobis + OSD-571", col: C.amber },
      { k: "RELEVANCE", v: "5 Hazards & STD-3001", col: C.coral },
      { k: "PRESENTATION", v: "Live 3-Tab Cloud App", col: C.violet },
    ];
    rubric.forEach((r, idx) => {
      const rx = 0.5 + idx * 1.84;
      s.addShape(pres.shapes.RECTANGLE, {
        x: rx,
        y: 3.91,
        w: 1.64,
        h: 0.64,
        fill: { color: C.card },
        line: { color: r.col, width: 1 },
      });
      s.addText(r.k, {
        x: rx + 0.06,
        y: 3.98,
        w: 1.52,
        h: 0.20,
        fontFace: FONT_MONO,
        fontSize: 8.0,
        bold: true,
        color: r.col,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      s.addText(r.v, {
        x: rx + 0.06,
        y: 4.22,
        w: 1.52,
        h: 0.24,
        fontFace: FONT_BODY,
        fontSize: 9.0,
        bold: true,
        color: C.white,
        align: "center",
        valign: "middle",
        margin: 0,
      });
    });

    // Bottom Live Demo & OpenAPI Bar (y = 4.80..5.17 -> 0.25" gap, 0.455" bottom margin; multi-run hyperlink!)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y: 4.80,
      w: 9.0,
      h: 0.37,
      fill: { color: C.cardAlt },
      line: { color: C.cyan, width: 1 },
    });
    s.addText(
      [
        { text: "LIVE APP:  ", options: { bold: true, color: C.emerald } },
        {
          text: "https://astrokinetics-space-health-765428358644.us-central1.run.app",
          options: {
            bold: true,
            color: C.cyan,
            hyperlink: { url: "https://astrokinetics-space-health-765428358644.us-central1.run.app" },
          },
        },
        { text: "   |   OPENAPI: /docs   |   DATA: NASA OSDR OSD-571", options: { bold: true, color: C.text } },
      ],
      {
        x: 0.6,
        y: 4.80,
        w: 8.8,
        h: 0.37,
        fontFace: FONT_BODY,
        fontSize: 8.8,
        align: "center",
        valign: "middle",
        margin: 0,
      }
    );
  }

  const outPptx = path.join(PKG, "AstroKinetics_7Slide_Pitch_Deck.pptx");
  await pres.writeFile({ fileName: outPptx });
  console.log("WROTE 7-SLIDE PPTX (v2):", outPptx);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
