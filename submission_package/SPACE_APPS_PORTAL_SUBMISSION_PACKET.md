# 2026 NASA International Space Apps Challenge — Turnkey Portal Submission Packet

> **Use `Space_Apps_Portal_Form_Answers.docx` for the form.** It holds the current v5.1 answers for every field; Fields 4 to 6 below are the longer v3.4 text kept for reference.

- **Local Event:** Houston, TX (`https://www.spaceappschallenge.org/2026/local-events/houston/`)
- **Official Challenge:** *Create Health Monitoring Software for Astronauts on Space Missions* (`Intermediate` · `Human Exploration`, `Software`, `Space Exploration`)
- **Hard Portal Cutoff:** **Sunday, November 15, 2026 at 11:59 PM (23:59) CST**
- **Live Cloud Run App URL (`v5.1` workstation: 3D twin, Watch + iPhone, Crew Body Map triage, evidence):** https://astrokinetics-space-health-765428358644.us-central1.run.app
- **14-Step Watch + iPhone Guided Demo (workstation tab):** https://astrokinetics-space-health-765428358644.us-central1.run.app/?tab=demo
- **3D Crew Body Map & Triage:** https://astrokinetics-space-health-765428358644.us-central1.run.app/?tab=triage
- **Cited Evidence Engine:** https://astrokinetics-space-health-765428358644.us-central1.run.app/?tab=evidence
- **Orbital Story (scroll journey):** https://astrokinetics-space-health-765428358644.us-central1.run.app/story
- **Live 3D Twin (home):** https://astrokinetics-space-health-765428358644.us-central1.run.app/
- **Interactive OpenAPI / Swagger Docs:** https://astrokinetics-space-health-765428358644.us-central1.run.app/docs

---

## Field 1 — Project Name
```text
AstroKinetics · ASTRA: Autonomous 3D Crew Health Workstation with a Watch + iPhone Companion
```

---

## Field 2 — High-Level Project Summary *(119 words — fits standard 50–150 word limit)*
```text
On Artemis lunar stays and Mars transits, a question to Earth can take 44 minutes to answer, so the crew must be its own clinic. AstroKinetics · ASTRA is an offline-first web workstation that helps astronauts gather, evaluate and act on health drift without a flight surgeon on the line. A cabin camera tracks movement, tremor and pulse in 3D; a watch and a phone learn each astronaut's personal baseline on Earth and move it into orbit. Every signal lands on one 3D body map. An emergency red-flag gate runs first, then an 8-signal multivariate model anchored to NASA OSDR OSD-571 separates environmental from physiological causes and proposes NASA-STD-3001 countermeasures, with every answer showing its source and its limits.
```

---

## Field 3 — Project Links *(Paste on Submission Page)*
- **Live Zero-Install Application (HTTPS):** `https://astrokinetics-space-health-765428358644.us-central1.run.app`
- **Project Demo (`<= 30s` Video OR `<= 7-Slide` Deck):**
  - *30-Second Video File (upload to YouTube Public/Unlisted or Google Drive Public):* `AstroKinetics_ASTRA_30s_Final_Demo.mp4` (`29.23s`, 1080p, burned-in English captions, AI voice-over, original score, recorded entirely from the live v5.1 portal)
  - *Already-public link to the same video (works without YouTube):* `https://astrokinetics-space-health-765428358644.us-central1.run.app/video`
  - *7-Slide Executive Pitch Deck (Backup / Local Pitch):* `AstroKinetics_7Slide_Pitch_Deck.pptx` / `AstroKinetics_7Slide_Pitch_Deck.pdf`
- **Public Open-Source GitHub Repository:** `https://github.com/x1jiang/astrokinetics` (MIT License)

---

## Field 4 — Detailed Project Description *(Copy-Paste Ready — Structured Around All 5 Judging Criteria)*

```markdown
### 1. The Operational Problem: 44-Minute Mars Blackouts & NASA's 5 Spaceflight Hazards
Deep-space exploration fundamentally breaks Earth-tethered telemedicine. During lunar far-side operations, Mars transit (up to 22-minute one-way / 44-minute round-trip light delay), and two-week solar-conjunction blackouts, astronauts face NASA's Five Hazards of Human Spaceflight simultaneously: Space Radiation, Altered Gravity, Hostile/Closed Environments, Isolation & Confinement, and Distance from Earth. Worse, symptoms overlap—slower reaction times and mild tremor could stem from a failing cabin CO2 scrubber (hypercapnia), microgravity musculoskeletal deconditioning, sleep/circadian drift, or an acute Solar Particle Event (SPE). Crew members need an autonomous onboard flight-surgeon co-pilot that separates covariant causes and guides immediate action with zero cloud dependency.

### 2. How AstroKinetics Works (Three Closed-Loop Pillars)

#### Pillar A — GATHER: Adaptive Multi-Zone 3D Vision, Contactless rPPG & Wearable Mesh
1. **Adaptive Multi-Zone On-Device 3D Computer Vision (Zero PHI Leaves Device):**
   - Runs three Google MediaPipe WebAssembly/WebGPU models (`FaceLandmarker` 478-point 3D FaceMesh, `PoseLandmarker Full` 33-joint 3D WorldPose with 1-Euro jitter stabilization, and `HandLandmarker` 21-joint 3D Hands) directly in the browser.
   - Automatically classifies framing into **Close-Up Cranio-Facial & Ocular rPPG** (3-zone forehead + malar cheek Wang POS chrominance rPPG avoiding eyeglasses, Soukupova-Cech 6-point Eye Aspect Ratio `EAR`, `PERCLOS` drowsiness, and facial symmetry), **21-Joint Hand Neuromotor Tremor** (4–12 Hz RMS tremor & finger-tap Hz), **Upper-Body 3D**, or **Full-Body 3D ARED Kinematics**.
2. **Interactive 3D Musculoskeletal & Pre-Flight 1g Baseline Ghost Digital Twin:**
   - Orbitable 60-FPS 3D biomechanical viewport with dual ARED force-plate ground-reaction vectors (`GRF`), `%MVC` muscle-load heatmap, and a translucent **Cyan Pre-Flight 1g Baseline Ghost** quantifying exact `ΔROM` and `ΔTILT` drift.
3. **Connected Apple Watch Ultra + Mobile Kinematics + Habitat ECLSS REST API (`POST /api/ingest/edge-telemetry`):**
   - Live HTTP ingestion bus fusing smartwatch HR/HRV/SpO2, smartphone kinematics, 3-trial Psychomotor Vigilance Task (PVT) reflex latency, Boersma vocal stress DSP (`F0`, glottal jitter, HNR), cabin `ppCO2` (`mmHg`), and radiation dosimetry (`mSv/day`).

#### Pillar B — EVALUATE OFFLINE: 8-DOF Multivariate Mahalanobis Whitening & NASA OSD-571
- Instead of brittle single-sensor alarms, AstroKinetics evaluates an 8-dimensional state vector against each astronaut's individualized pre-flight covariance matrix (`Sigma^-1/2` Cholesky whitening), computing exact **Mahalanobis Distance (`D_M`)**, **8-DOF Chi-Square survival `p`-values**, and **whitened variance attributions (`%` of `D_M^2`)**.
- Validated across four mission scenarios—`Sol 014 Nominal Lunar Orbit (99.2/100)`, `Sol 088 Cabin CO2 Drift (78.3/100 Watch)`, `Sol 142 0g Squat Compensation (44.7/100 Alert)`, and `Sol 210 Solar Particle Event Blackout (12.0/100 Critical)`—and anchored to downloaded **NASA OSDR OSD-571 (SpaceX Inspiration4)** longitudinal astronaut plasma proteomics (`CAT 5.24x`, `PRDX2 5.09x`, `HBA1 4.36x`, `TLN1 2.36x`).
- Full Service Worker PWA + client-side statistical fallback runs 100% offline during communication blackouts.

#### Pillar C — ACT: NASA-STD-3001 Directives, Closed-Loop Neuro-Acoustic Therapy & Crew Privacy
- **Priority-Ranked Operational Directives:** Surfaces immediate NASA-STD-3001 / HRP protocols (e.g., CDRA desiccant bed CO2 purge, 15% unilateral ARED load reduction, or water-wall storm-shelter shielding).
- **Closed-Loop Neuro-Acoustic & Wrist Haptic Guidance:** Real-time WebAudio synthesizer coupling 3D joint ROM and trunk tilt to 4 evidence-based protocols (`16 Hz Beta Motor RAS`, `10 Hz Alpha / 0.10 Hz Mayer-Wave HRV`, `40 Hz Gamma Vigilance`, `2.5 Hz Delta + 1/f Pink-Noise Shelter`), spoken Flight Surgeon briefings (`-10 dB` sidechain ducking), and `WKHapticType` Apple Watch wrist cues.
- **3-Tier Crew Privacy & Store-and-Forward Downlink:** Protects sensitive psychological mood/stress journals (`Astronaut Private` vs. `Crew Commander Masked` vs. `Flight Surgeon Emergency Override`) while queuing compact JSON telemetry packets (`< 2 KB`) for burst downlink when Earth contact resumes.

### 3. Space-to-Earth Dual-Use Impact
The exact offline camera + smartwatch + edge triage architecture built for Mars blackouts deploys directly to **rural clinics, austere disaster zones, and home musculoskeletal/neurological tele-rehabilitation** on Earth—delivering specialist-grade motion, tremor, vocal, and cardiopulmonary screening using commodity hardware without broadband or cloud PHI exposure.
```

---

## Field 5 — Space Agency Data & Official NASA Resources Used
```markdown
1. **NASA Open Science Data Repository (OSDR) — Study OSD-571 / GLDS-563 (SpaceX Inspiration4 Astronaut Cohort):**
   - Downloaded longitudinal human astronaut plasma proteomics across 6 flight/pre-flight/post-flight timepoints (`L-92`, `L-44`, `L-3`, `R+1`, `R+45`, `R+82`) for crew `C001–C004` (`CAT 5.24x`, `PRDX2 5.09x`, `HBA1 4.36x`, `TLN1 2.36x`, `C3 0.67x`, `FN1 0.17x`), plus live REST verification against `https://osdr.nasa.gov/osdr/data/osd/meta/571`.
2. **NASA-STD-3001 (Space Flight Human-System Standard, Vol. 1: Crew Health & Vol. 2: Human Factors, Habitability, and Environmental Health):**
   - Operational thresholds for habitat partial pressure of CO2 (`ppCO2 < 2.0 mmHg` nominal; `>= 2.8 mmHg` cognitive-hypercapnia watch), circadian sleep protection (`>= 7.5 h`), and countermeasure execution.
3. **NASA Human Research Program (HRP) & Human Research Roadmap (HRR) Evidence Books:**
   - Sensorimotor Alterations, Musculoskeletal ARED Unloading/Asymmetry, Acute Radiation Syndrome (Solar Particle Event water-wall storm shelter), and Behavioral Medicine / Cognitive PVT readiness frameworks.
4. **Canadian Space Agency (CSA) Bio-Monitor Wearable Architecture Reference:**
   - Continuous astronaut wearable HR, HRV (RMSSD), SpO2, respiratory rate, and accelerometry channel schema aligned with our Connected Watch & Mobile REST API.
```

---

## Field 6 — External Open-Source Software & Scientific Literature Citations
```markdown
- **On-Device Neural Vision:** Google `@mediapipe/tasks-vision` v0.10.18 (`FaceLandmarker`, `PoseLandmarker Full`, `HandLandmarker`, Apache-2.0).
- **3D Anatomy Model (Crew Body Map):** BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0 (Mitsuhashi et al., 2009, *Nucleic Acids Res.*, doi:10.1093/nar/gkn613); browser-ready geometry from the open-source Human Atlas project (github.com/ashemag/human-atlas, MIT). The pulse wave and gravity fluid-shift views are illustrative animations on this geometry, not simulations.
- **Backend & Statistical Runtime:** Python `FastAPI`, `Pydantic`, `SciPy` (`scipy.stats.chi2` 8-DOF survival math), `NumPy`, and `SQLite` persistent Sol ledger (Apache-2.0 / BSD).
- **Signal Processing & Clinical Algorithms:**
  - Casiez, G., Roussel, N., & Vogel, D. (2012). *1-Euro Filter: A Simple Speed-Based Low-Pass Filter for Noisy Input in Interactive Systems* (CHI 2012).
  - Wang, W. et al. (2017). *Algorithmic Principles of Remote PPG (Plane-Orthogonal-to-Skin POS)* (IEEE Trans. Biomed. Eng., 64(7), 1479–1491).
  - Soukupova, T. & Cech, J. (2016). *Real-Time Eye Blink Detection Using Facial Landmarks (EAR / PERCLOS)*.
  - Uhlrich, S. D. et al. (2023). *OpenCap: Human Movement Dynamics from Smartphone Videos* (PLOS Comput. Biol., 19(10), e1011462).
  - Thaut, M. H. et al. (2015). *Neurologic Music Therapy & Rhythmic Auditory Stimulation (RAS) in Motor Entrainment* (Front. Hum. Neurosci.).
  - Lehrer, P. M. & Gevirtz, R. (2014). *Heart Rate Variability Biofeedback: 0.1 Hz Resonance Loop* (Front. Psychol.).
  - Boersma, P. (1993). *Accurate Short-Term Autocorrelation Pitch, Jitter & Harmonics-to-Noise Ratio (HNR) Extraction*.
```

---

## Field 7 — Mandatory AI / Super Intelligence (SI) Transparency Disclosure
```markdown
In full compliance with NASA International Space Apps Challenge AI/SI transparency rules:
1. **Runtime Software Architecture:** All physiological scoring (`8-DOF Multivariate Mahalanobis Distance` and `Chi-Square` survival statistics), 1-Euro kinematic filtering, Wang POS chrominance rPPG, Boersma vocal autocorrelation DSP, and WebAudio neuro-acoustic synthesis are deterministic, inspectable mathematical algorithms implemented directly in open-source Python and JavaScript (`MIT`). Client-side computer vision uses Google's open-source `@mediapipe/tasks-vision` (`FaceLandmarker`, `PoseLandmarker`, `HandLandmarker`) running 100% locally in the browser with zero cloud transmission of crew video.
2. **Development & Presentation Assets:** AI coding and writing assistance (Google Antigravity / Gemini and Anthropic Claude Code) was used under human engineering direction to accelerate UI scaffolding, test verification, and documentation formatting. Concept illustrations in the pitch deck were generated with AI image generation, and the 30-second video is narrated with xAI Grok Voice TTS over authentic screen recordings of the running AstroKinetics software (no generated footage). All scientific equations, NASA OSDR `OSD-571` empirical values, and `NASA-STD-3001` thresholds were verified directly against primary NASA sources.
3. **Runtime Voice Assistant (optional):** The "Ask ASTRA" assistant uses xAI Grok for conversation, speech-to-text and text-to-speech through the open-source ClawAgents framework. It explains findings and navigates the portal; it never makes the triage decision, which stays with the deterministic red-flag gate and rule engine. Without a network link it falls back to offline replies.
4. **Illustrative Visuals:** The 3D body uses the BodyParts3D 4.0 reference anatomy (CC BY 4.0). Its pulse-wave and gravity fluid-shift views, the animated heart and pulse traces, and all crew values in the guided demo are illustrations, not simulations or patient data.
```

---

## Bonus — 2-Minute Houston Local Judge Live Click-Through Script
1. **`0:00–0:20` (Hook & Live URL):** Open https://astrokinetics-space-health-765428358644.us-central1.run.app. Point out the clean single-row Mission Console: *"On a Mars mission with a 44-minute radio blackout, astronauts are their own flight surgeon. AstroKinetics runs 100% onboard."*
2. **`0:20–0:55` (Click the 4 Scenario Cards & Orbit 3D Twin):**
   - Click **Artemis Lunar Orbit (`99.2` Green)** -> **Cabin CO₂ Drift (`78.3` Amber Watch)** -> **0g Squat Compensation (`44.7` Coral Alert)** -> **Solar Particle Event (`12.0` Crimson Critical)**.
   - Drag the 3D astronaut to show the **Cyan Pre-Flight 1g Baseline Ghost** (`ΔDRIFT` arrow), dual force-plate `GRF`, and 21-joint hand tremor rig; drag the inline `ROM` slider or click **`Match 1g`** to watch the 8-DOF Mahalanobis Radar and Readiness Gauge update in real time.
   - Optional 5-second wow: click **`Live Camera`** at the laptop desk to show automatic **478-pt FaceMesh + 3-Zone Forehead/Malar POS-rPPG + Ocular `PERCLOS`** with zero off-screen leg hallucinations.
3. **`0:55–1:30` (Tab 2 — Closed-Loop Neuro-Acoustic & Voice DSP):**
   - Click **`Neuro-Acoustic & Voice`**, press **`Engage Neuro-Acoustic Engine`** and **`Formant Vocal Test`** (or **`Voice Briefing`**) to demonstrate `-10 dB` sidechain ducking, 64-band Log-FFT spectrum, and vocal jitter/HNR extraction.
4. **`1:30–2:00` (Tab 3 — Connected Apple Watch + Mobile API & NASA `OSD-571`):**
   - Click **`Watch & Mobile API`**, press **`Execute Live POST /api/ingest/edge-telemetry`** (or **`Start 1 Hz Live Stream`**) to show live smartwatch + mobile kinematics HTTP fusion returning closed-loop `WKHapticType` wrist directives, and close on **Space-to-Earth rural clinic tele-triage**.
