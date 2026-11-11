/**
 * AstroKinetics 7-slide pitch deck, v3.4 (legibility pass).
 *
 * Changes vs the v3.3 builder (build_pitch_deck.js):
 *  - Body text 10.5-13pt instead of 7.8-9.2pt; one message per slide, fewer words.
 *  - Full-page app screenshots replaced by crops of the panel that matters (twin, triage, directive),
 *    so every UI element on a slide is readable when projected.
 *  - Structured deck: theme colors + a title-only layout with a title placeholder, footer and slide number.
 *
 * Run:  NODE_PATH=/tmp/pptx_builder/node_modules node build_pitch_deck_v4.js
 */
const path = require("path");
const fs = require("fs");

module.paths.unshift("/tmp/pptx_builder/node_modules");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const SKILL = process.env.PPTX_SKILL_DIR || path.join(__dirname, "pptx_skill");
const { applyTheme } = require(path.join(SKILL, "scripts", "apply_theme.js"));

const PKG = __dirname;
const IMG = path.join(PKG, "assets", "images");
const CROP = path.join(PKG, "assets", "crops");
const PREP = path.join("/tmp/pptx_builder", "prepared_v4");
fs.mkdirSync(PREP, { recursive: true });
const OUT = path.join(PKG, "AstroKinetics_7Slide_Pitch_Deck.pptx");
const LIVE_URL = "https://astrokinetics-space-health-765428358644.us-central1.run.app";

// Deep-space dark theme. lt1 is the (dark) background and dk1 the (light) text, so every
// default text run and scheme reference reads correctly on the dark slides.
const THEME = {
  name: "AstroKinetics Deep Space",
  headFontFace: "Trebuchet MS",
  bodyFontFace: "Arial",
  colors: {
    dk1: "F8FAFC", // text1: primary text
    lt1: "0A1222", // background1: slide
    dk2: "9FB0C8", // text2: muted text
    lt2: "111D34", // background2: cards
    accent1: "38BDF8", // cyan
    accent2: "34D399", // emerald
    accent3: "FBBF24", // amber
    accent4: "FB7185", // coral
    accent5: "A78BFA", // violet
    accent6: "26406A", // hairlines / borders
    hlink: "38BDF8",
    folHlink: "A78BFA",
  },
};
const HEX = THEME.colors;
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "AstroKinetics — NASA Space Apps 2026 (Houston)";
pres.author = "AstroKinetics team";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "AK Hero",
  background: { color: HEX.lt1 },
  objects: [],
});
pres.defineSlideMaster({
  title: "AK Content",
  background: { color: HEX.lt1 },
  margin: [0.4, 0.45, 0.4, 0.45],
  objects: [
    {
      placeholder: {
        options: {
          name: "title",
          type: "title",
          x: 0.45,
          y: 0.5,
          w: 9.1,
          h: 0.55,
          fontSize: 24,
          bold: true,
          color: C.text1,
          align: "left",
          valign: "middle",
          margin: 0,
        },
        text: "",
      },
    },
    {
      text: {
        text: "AstroKinetics  ·  NASA Space Apps 2026  ·  Houston",
        options: { x: 0.45, y: 5.22, w: 5.5, h: 0.24, fontSize: 9, color: C.text2, margin: 0, valign: "middle" },
      },
    },
  ],
  slideNumber: { x: 8.85, y: 5.22, w: 0.7, h: 0.24, fontSize: 9, color: C.text2, align: "right" },
});

// ---------- helpers ----------
async function prep(src, name, wIn, hIn, position = "centre") {
  // Photos (.jpg sources) stay JPEG so the deck stays small enough to email; UI crops stay PNG for crisp text.
  const photo = /\.jpe?g$/i.test(src);
  const out = path.join(PREP, photo ? name.replace(/\.png$/, ".jpg") : name);
  const img = sharp(src).resize(Math.round(wIn * 250), Math.round(hIn * 250), { fit: "cover", position });
  await (photo ? img.jpeg({ quality: 86, mozjpeg: true }) : img.png()).toFile(out);
  return out;
}

async function icon(svgBody, hex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="#${hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgBody}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const shadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 90, opacity: 0.35 });

function kicker(slide, text, color = C.accent1) {
  slide.addText(text, {
    x: 0.45, y: 0.22, w: 9.1, h: 0.24, fontFace: MONO, fontSize: 10, bold: true, color,
    charSpacing: 1, margin: 0, valign: "middle", isTextBox: true, objectName: "Kicker",
  });
}

function card(slide, x, y, w, h, name) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: C.background2 }, line: { color: C.accent6, width: 0.75 }, objectName: name,
  });
}

function framedImage(slide, imgPath, x, y, w, h, name) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: C.accent6 }, line: { type: "none" }, shadow: shadow(), objectName: `${name} frame`,
  });
  slide.addImage({ path: imgPath, x, y, w, h, objectName: name, altText: name });
}

function iconRow(slide, { x, y, w, ic, title, body, hex, name }) {
  slide.addShape(pres.shapes.OVAL, { x, y: y + 0.02, w: 0.44, h: 0.44, fill: { color: C.background2 }, line: { color: hex, width: 1 }, objectName: `${name} icon ring` });
  slide.addImage({ data: ic, x: x + 0.09, y: y + 0.11, w: 0.26, h: 0.26, objectName: `${name} icon` });
  slide.addText(
    [
      { text: title, options: { bold: true, fontSize: 13, color: C.text1, breakLine: true } },
      { text: body, options: { fontSize: 10.5, color: C.text2 } },
    ],
    { x: x + 0.58, y, w: w - 0.58, h: 0.74, valign: "top", margin: 0, paraSpaceAfter: 2, isTextBox: true, objectName: `${name} text` }
  );
}

(async () => {
  // ---------- images ----------
  const imHero = await prep(path.join(IMG, "hero_mars_blackout_astronaut.jpg"), "hero.png", 4.6, 5.625);
  const imSensors = await prep(path.join(IMG, "multimodal_sensor_fusion_concept.jpg"), "sensors.png", 4.55, 3.7);
  const imDual = await prep(path.join(IMG, "space_to_earth_dual_use.jpg"), "dual.png", 4.3, 2.62);
  const imTwin = await prep(path.join(CROP, "twin_scen3.png"), "twin.png", 5.0, 3.15);
  const imTriage3 = await prep(path.join(CROP, "triage_scen3_squat.png"), "triage3.png", 4.55, 2.74);
  const imTriageHero = await prep(path.join(CROP, "triage_scen3_squat.png"), "triage_hero.png", 3.3, 1.99);
  const imDirective = await prep(path.join(CROP, "directive_scen3_squat.png"), "directive3.png", 9.1, 1.365, "top");
  const imFft = await prep(path.join(CROP, "fft_tab2.png"), "fft.png", 4.4, 1.59);
  const scen = ["scen1_nominal", "scen2_co2", "scen3_squat", "scen4_spe"];
  const imScen = [];
  for (const s of scen) imScen.push(await prep(path.join(CROP, `triage_${s}.png`), `t_${s}.png`, 2.4, 1.45));

  const icCamera = await icon('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>', HEX.accent1);
  const icBody = await icon('<circle cx="12" cy="4.5" r="2"/><path d="M6 9h12"/><path d="M12 6.5v6.5"/><path d="M12 13l-3.5 7"/><path d="M12 13l3.5 7"/>', HEX.accent2);
  const icHand = await icon('<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>', HEX.accent3);
  const icWatch = await icon('<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2h6v4H9z"/><path d="M9 18h6v4H9z"/><path d="M9 12h2l1-2.5l1.5 5l1-2.5H16"/>', HEX.accent4);
  const icWave = await icon('<path d="M2 12h3l2.5-6l3 12l3-9l2 5l2.5-2H22"/>', HEX.accent1);
  const icMic = await icon('<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/>', HEX.accent3);
  const icShield = await icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>', HEX.accent2);

  // ========== 1. Title ==========
  pres.addSection({ title: "Pitch" });
  {
    const s = pres.addSlide({ masterName: "AK Hero", sectionTitle: "Pitch" });
    s.addImage({ path: imHero, x: 5.4, y: 0, w: 4.6, h: 5.625, objectName: "Hero art: astronaut squat with holographic skeleton, Mars window" });
    s.addText("2026 NASA SPACE APPS CHALLENGE  ·  HOUSTON", {
      x: 0.45, y: 0.5, w: 4.8, h: 0.26, fontFace: MONO, fontSize: 10, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "Event",
    });
    s.addText("AstroKinetics", {
      x: 0.45, y: 0.86, w: 4.8, h: 0.78, fontFace: THEME.headFontFace, fontSize: 44, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Product name",
    });
    s.addText("An offline health co-pilot for astronauts who can’t call Earth", {
      x: 0.45, y: 1.68, w: 4.8, h: 0.78, fontFace: THEME.headFontFace, fontSize: 19, color: C.accent1, margin: 0, valign: "top", isTextBox: true, objectName: "Value proposition",
    });
    s.addText("A cabin camera, a smartwatch and habitat sensors feed one personal-baseline model. It tells the crew what is drifting, why, and what to do now — with no cloud and no flight surgeon on the line.", {
      x: 0.45, y: 2.5, w: 4.75, h: 0.98, fontSize: 12.5, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Summary",
    });
    const stats = [
      ["44 min", "Mars round-trip delay", C.accent4],
      ["8", "signals fused per crew member", C.accent3],
      ["100%", "on-device & offline", C.accent2],
    ];
    stats.forEach(([big, small, col], i) => {
      const x = 0.45 + i * 1.6;
      card(s, x, 3.62, 1.48, 0.86, `Stat ${i + 1} card`);
      s.addText(
        [
          { text: big, options: { fontSize: 20, bold: true, color: col, breakLine: true } },
          { text: small, options: { fontSize: 10, color: C.text2 } },
        ],
        { x: x + 0.12, y: 3.68, w: 1.28, h: 0.74, margin: 0, valign: "middle", isTextBox: true, objectName: `Stat ${i + 1}` }
      );
    });
    s.addText(
      [
        { text: "LIVE APP — NO INSTALL", options: { fontFace: MONO, bold: true, color: C.accent2, fontSize: 10, breakLine: true } },
        { text: LIVE_URL.replace("https://", ""), options: { color: C.text1, fontSize: 10, hyperlink: { url: LIVE_URL, tooltip: "Open the live app" } } },
      ],
      { x: 0.45, y: 4.62, w: 4.8, h: 0.5, margin: 0, valign: "top", paraSpaceAfter: 2, isTextBox: true, objectName: "Live link" }
    );
    framedImage(s, imTriageHero, 5.7, 3.3, 3.3, 1.99, "Live app: Sol 142 readiness 44.7 and 8-signal radar");
    s.addNotes(
      "AstroKinetics is an offline health co-pilot for deep-space crews. On the way to Mars a question to Earth takes up to 44 minutes round trip, so the crew has to notice and handle health drift on their own. We fuse a cabin camera, a smartwatch and habitat sensors into one model of each astronaut's own pre-flight baseline, and turn drift into a concrete action. Everything runs on-device. The app is live at the URL on the slide."
    );
  }

  // ========== 2. Problem ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "01  THE PROBLEM", C.accent4);
    s.addText("Beyond the Moon, astronauts must diagnose themselves", { placeholder: "title" });
    const rows = [
      ["44 min", "Mars round-trip radio delay", "Plus ~2-week solar-conjunction blackouts. No live flight surgeon.", C.accent4],
      ["5", "NASA hazards hit at once", "Radiation, isolation, distance, altered gravity, closed habitat.", C.accent3],
      ["3", "causes look the same", "Slow reflexes can mean cabin CO₂, fatigue or radiation. Single-threshold alarms can’t tell them apart.", C.accent1],
    ];
    rows.forEach(([big, head, sub, col], i) => {
      const y = 1.28 + i * 1.24;
      s.addText(big, { x: 0.45, y, w: 1.6, h: 0.62, fontFace: THEME.headFontFace, fontSize: 30, bold: true, color: col, margin: 0, valign: "top", isTextBox: true, objectName: `Problem ${i + 1} number` });
      s.addText(
        [
          { text: head, options: { fontSize: 14, bold: true, color: C.text1, breakLine: true } },
          { text: sub, options: { fontSize: 11, color: C.text2 } },
        ],
        { x: 2.1, y: y + 0.04, w: 2.6, h: 1.05, margin: 0, valign: "top", paraSpaceAfter: 3, isTextBox: true, objectName: `Problem ${i + 1} text` }
      );
    });
    framedImage(s, imSensors, 5.0, 1.28, 4.55, 3.7, "Concept art: astronaut with multimodal sensing");
    s.addNotes(
      "Three facts drive the design. First, distance: up to 44 minutes round trip to Mars, and weeks of blackout at solar conjunction. Second, NASA's five hazards act together. Third, the same symptom can have different causes: slow reaction time might be CO2 build-up, fatigue or radiation, and a single-threshold alarm can't separate them. The crew needs a tool that separates causes, not another alarm."
    );
  }

  // ========== 3. Gather ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "02  GATHER", C.accent2);
    s.addText("Gather: one camera, one watch, the habitat bus", { placeholder: "title" });
    framedImage(s, imTwin, 0.45, 1.28, 5.0, 3.15, "Live app: What-If 3D twin, Sol 142 squat vs pre-flight 1g ghost");
    s.addText("Live 3D twin: Sol 142 squat compared with the cyan pre-flight 1g ghost — knee angles, plate load, drift.", {
      x: 0.45, y: 4.52, w: 5.0, h: 0.5, fontSize: 10.5, italic: true, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Twin caption",
    });
    const rows = [
      [icCamera, "Face: contactless pulse", "478-pt face mesh, 3-zone POS rPPG, drowsiness", HEX.accent1],
      [icBody, "Body: 3D pose vs 1g baseline", "33-pt world pose, joint angles, force-plate load split", HEX.accent2],
      [icHand, "Hand: tremor & dexterity", "21-joint rig, 4–12 Hz tremor, finger-tap rate", HEX.accent3],
      [icWatch, "Watch + habitat API", "HR, HRV, SpO₂, cabin ppCO₂ and dose via one REST endpoint", HEX.accent4],
    ];
    rows.forEach(([ic, title, body, hex], i) =>
      iconRow(s, { x: 5.75, y: 1.28 + i * 0.86, w: 3.8, ic, title, body, hex, name: `Sensor ${i + 1}` })
    );
    s.addText("Vision runs on-device (WebGPU/WASM). Raw frames never leave the cabin.", {
      x: 5.75, y: 4.72, w: 3.8, h: 0.3, fontSize: 10.5, bold: true, color: C.accent2, margin: 0, valign: "middle", isTextBox: true, objectName: "Privacy note",
    });
    s.addNotes(
      "We gather with hardware a crew already has. The camera gives a contactless pulse from the face, 3D body pose compared against the astronaut's own pre-flight 1g ghost, and hand tremor. A watch and the habitat bus post vitals, cabin CO2 and radiation dose to one REST endpoint. All vision runs on the device, so raw video never leaves the cabin."
    );
  }

  // ========== 4. Evaluate ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "03  EVALUATE OFFLINE", C.accent1);
    s.addText("Evaluate offline: drift from each astronaut’s own baseline", { placeholder: "title" });
    card(s, 0.45, 1.28, 4.3, 3.74, "NASA data card");
    s.addText(
      [
        { text: "NASA OSDR OSD-571 · Inspiration4", options: { fontSize: 13, bold: true, color: C.accent1, breakLine: true } },
        { text: "Plasma protein fold change, R+1 vs pre-flight", options: { fontSize: 10.5, color: C.text2 } },
      ],
      { x: 0.65, y: 1.4, w: 3.95, h: 0.62, margin: 0, valign: "top", isTextBox: true, objectName: "NASA data heading" }
    );
    s.addChart(
      pres.charts.BAR,
      [{ name: "Fold change R+1 vs pre-flight", labels: ["Pre-flight", "TLN1", "HBA1", "PRDX2", "CAT"], values: [1.0, 2.36, 4.36, 5.09, 5.24] }],
      {
        x: 0.6, y: 2.05, w: 4.0, h: 2.45, barDir: "bar", barGapWidthPct: 55,
        chartColors: [HEX.dk2, HEX.accent1, HEX.accent1, HEX.accent1, HEX.accent1],
        catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 11,
        valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 6.2,
        valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLineShow: false,
        showValue: true, dataLabelFormatCode: '0.00"×"', dataLabelPosition: "outEnd",
        dataLabelColor: HEX.accent3, dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11, dataLabelFontBold: true,
        showLegend: false, objectName: "OSD-571 fold change chart",
        altText: "Bar chart: CAT 5.24x, PRDX2 5.09x, HBA1 4.36x, TLN1 2.36x vs pre-flight 1.00",
      }
    );
    s.addText("Antioxidant, radiation and hemolysis markers anchor the app’s radiation profile.", {
      x: 0.65, y: 4.52, w: 3.95, h: 0.42, fontSize: 10.5, italic: true, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Chart caption",
    });
    framedImage(s, imTriage3, 5.0, 1.28, 4.55, 2.74, "Live app: Sol 142 triage, readiness 44.7, radar and variance drivers");
    s.addText(
      [
        { text: "8 signals → distance from the pre-flight cloud (Mahalanobis D", options: {} },
        { text: "M", options: { subscript: true } },
        { text: ") → χ² p-value → each signal’s share of the drift names the cause.", options: {} },
      ],
      { x: 5.0, y: 4.18, w: 4.55, h: 0.8, fontSize: 11.5, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Method line" }
    );
    s.addNotes(
      "Evaluation runs fully offline. Eight signals are compared with the astronaut's own pre-flight covariance using the Mahalanobis distance; that gives a chi-square p-value and, after whitening, each signal's share of the drift, which is what names the cause. On the right, Sol 142: readiness 44.7, p below 0.0001, driven by left-right asymmetry and trunk lean. On the left, real NASA OSDR data from the Inspiration4 crew, OSD-571: catalase, peroxiredoxin-2 and hemoglobin rise four- to five-fold on return. Those markers anchor the radiation profile in the app."
    );
  }

  // ========== 5. Act ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "04  ACT NOW", C.accent3);
    s.addText("Act now: a ranked directive, therapy audio and privacy", { placeholder: "title" });
    framedImage(s, imDirective, 0.45, 1.28, 9.1, 1.365, "Live app: HIGH directive for Sol 142");
    framedImage(s, imFft, 0.45, 2.85, 4.4, 1.59, "Live app: neuro-acoustic spectrum and joint-angle filter");
    s.addText("Audio therapy shaped live by the astronaut’s joint angles.", {
      x: 0.45, y: 4.54, w: 4.4, h: 0.4, fontSize: 10.5, italic: true, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Audio caption",
    });
    const rows = [
      [icWave, "Neuro-acoustic prescription", "16 Hz cadence, 0.1 Hz breathing, 40 Hz focus or 2.5 Hz storm-shelter audio", HEX.accent1],
      [icMic, "Voice check + spoken briefing", "Pitch, jitter and HNR flag vocal stress; a voice reads the plan", HEX.accent3],
      [icShield, "Crew privacy tiers", "Private → crew medical officer → <2 KB packet for Earth", HEX.accent2],
    ];
    rows.forEach(([ic, title, body, hex], i) =>
      iconRow(s, { x: 5.15, y: 2.85 + i * 0.74, w: 4.4, ic, title, body, hex, name: `Action ${i + 1}` })
    );
    s.addNotes(
      "Every finding becomes one ranked directive with a NASA-STD-3001 or HRP reference; here, cut unilateral ARED load by 15 percent and add rhythmic auditory cueing. The audio engine plays one of four protocols, and the filter follows the astronaut's live joint angles. Voice analysis checks for stress, and a spoken briefing reads the plan. Privacy has three tiers, and only a packet under 2 KB goes to Earth."
    );
  }

  // ========== 6. Validation ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "05  VALIDATION", C.accent5);
    s.addText("Four scenarios, four different answers", { placeholder: "title" });
    const cards = [
      ["99.2", C.accent2, "Sol 014 · Lunar orbit", "All 8 signals inside the 95% baseline", "Keep the scheduled ARED blocks"],
      ["78.3", C.accent3, "Sol 088 · CO₂ drift", "PVT 46% + ppCO₂ 26% of drift", "Purge CDRA scrubber; retest in 30 min"],
      ["44.7", C.accent4, "Sol 142 · Squat drift", "Symmetry 36% + trunk lean 25%", "Cut one-sided load 15%; 14 RPM cueing"],
      ["12.0", C.accent4, "Sol 210 · Solar storm", "Radiation dose 47% of drift", "Water-wall shelter; 24 h blood panel"],
    ];
    cards.forEach(([score, col, head, why, act], i) => {
      const x = 0.45 + (i % 2) * 4.65;
      const y = 1.28 + Math.floor(i / 2) * 1.9;
      card(s, x, y, 4.45, 1.76, `Scenario ${i + 1} card`);
      s.addImage({ path: imScen[i], x: x + 0.12, y: y + 0.155, w: 2.4, h: 1.45, objectName: `Scenario ${i + 1} triage screenshot` });
      s.addText(
        [
          { text: score, options: { fontFace: THEME.headFontFace, fontSize: 24, bold: true, color: col, breakLine: true } },
          { text: head, options: { fontSize: 11, bold: true, color: C.text1, breakLine: true } },
          { text: why, options: { fontSize: 10, color: C.text2, breakLine: true } },
          { text: act, options: { fontSize: 10, color: col } },
        ],
        { x: x + 2.66, y: y + 0.1, w: 1.7, h: 1.56, margin: 0, valign: "top", paraSpaceAfter: 2, isTextBox: true, objectName: `Scenario ${i + 1} text` }
      );
    });
    s.addNotes(
      "Same model, four mission days, four different answers. Sol 14 is nominal at 99.2. Sol 88 is a CO2 drift: reaction time and cabin CO2 move together, so the action is to purge the scrubber, not to sleep. Sol 142 is a musculoskeletal compensation at 44.7. Sol 210 is a solar particle event at 12.0: radiation dose dominates, so the crew goes to the storm shelter. The point is differential diagnosis, not a louder alarm."
    );
  }

  // ========== 7. Impact ==========
  {
    const s = pres.addSlide({ masterName: "AK Content", sectionTitle: "Pitch" });
    kicker(s, "06  SPACE TO EARTH", C.accent2);
    s.addText("From Mars transit to rural clinics on Earth", { placeholder: "title" });
    framedImage(s, imDual, 0.45, 1.28, 4.3, 2.62, "Concept art: rural clinic using a tablet 3D skeleton");
    s.addText("Same software on a commodity phone and watch — no broadband, no cloud upload of patient video.", {
      x: 0.45, y: 4.02, w: 4.3, h: 0.5, fontSize: 10.5, italic: true, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Dual-use caption",
    });
    const hdr = (t, c) => ({ text: t, options: { bold: true, color: c, fill: { color: HEX.lt2 }, fontSize: 11 } });
    const cell = (t) => ({ text: t, options: { color: HEX.dk1, fontSize: 10.5 } });
    const lab = (t) => ({ text: t, options: { bold: true, color: HEX.dk2, fontSize: 10.5 } });
    s.addTable(
      [
        [hdr("", HEX.dk1), hdr("Mars transit", HEX.accent1), hdr("Rural & austere clinics", HEX.accent3)],
        [lab("Link"), cell("44-min delay, blackouts"), cell("No broadband; disaster zones")],
        [lab("Hardware"), cell("Cabin camera, crew watch, habitat bus"), cell("Phone camera + watch")],
        [lab("Finds"), cell("CO₂ vs fatigue vs radiation; 0g asymmetry"), cell("Rehab range of motion, tremor, cardio")],
        [lab("Privacy"), cell("<2 KB packet to Earth"), cell("No raw video leaves the room")],
      ],
      {
        x: 5.0, y: 1.28, w: 4.55, colW: [0.95, 1.8, 1.8], rowH: 0.48,
        border: { type: "solid", pt: 0.75, color: HEX.accent6 }, fill: { color: HEX.lt1 },
        margin: [0.04, 0.07, 0.04, 0.07], valign: "middle", objectName: "Dual-use comparison table",
      }
    );
    card(s, 5.0, 3.88, 4.55, 1.12, "Try it card");
    s.addText(
      [
        { text: "TRY IT NOW", options: { fontFace: MONO, bold: true, fontSize: 10, color: C.accent2, breakLine: true } },
        { text: LIVE_URL.replace("https://", ""), options: { fontSize: 10, bold: true, color: C.text1, hyperlink: { url: LIVE_URL, tooltip: "Open the live app" }, breakLine: true } },
        { text: "REST API docs: /docs   ·   NASA data: OSDR OSD-571", options: { fontSize: 10.5, color: C.text2, hyperlink: { url: LIVE_URL + "/docs", tooltip: "OpenAPI docs" } } },
      ],
      { x: 5.15, y: 3.96, w: 4.3, h: 0.96, margin: 0, valign: "middle", paraSpaceAfter: 3, isTextBox: true, objectName: "Try it links" }
    );
    s.addNotes(
      "What protects a crew 44 light-minutes from help also works in a rural clinic with no broadband: the same phone camera and watch, the same baseline model, and no patient video leaving the room. The app is live; the API docs are at /docs; the NASA data is OSDR OSD-571. Thank you."
    );
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
