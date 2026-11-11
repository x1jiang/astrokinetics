# 06. Full Competition Understanding & Master Deliverables Checklist

**Competition:** 2026 NASA International Space Apps Challenge (*Theme: "The Next Frontier"*)  
**Local Event:** Houston, TX (`/2026/local-events/houston/`) — **Saturday, Nov 14 – Sunday, Nov 15, 2026**  
**Selected Challenge:** **Create Health Monitoring Software for Astronauts on Space Missions**  
**Difficulty:** Intermediate | **Subjects:** `Human Exploration` · `Software` · `Space Exploration`  
**Live Reference Prototype (`AstroKinetics v3.2`):** https://astrokinetics-space-health-765428358644.us-central1.run.app

---

## 1. Full Understanding of What the Competition Requires

### A. The Core Operational Problem
Long-duration missions beyond Low Earth Orbit (**Artemis lunar surface stays** and **Mars transit/surface missions** with up to **22 minutes one-way / 44 minutes round-trip radio delay** and **multi-week solar-conjunction blackouts**) expose astronauts simultaneously to **NASA's 5 Hazards of Human Spaceflight**:

1. **Space Radiation** (GCR & Solar Particle Events -> oxidative stress, hemolysis, hematopoietic/immune shifts, acute prodrome).
2. **Isolation & Confinement** (circadian desynchrony, sleep loss, cognitive slowing, mood/behavioral strain, confined-crew privacy tension).
3. **Distance from Earth** (no real-time flight surgeon tele-consult, no medical evacuation, asynchronous Store-and-Forward telemetry only).
4. **Altered Gravity Fields** (1–1.5%/month bone mineral loss, muscle atrophy, microgravity ARED exercise compensation/asymmetry, cephalad fluid shift / SANS, orthostatic intolerance).
5. **Hostile / Closed Environment** (elevated cabin `ppCO2` causing headaches & psychomotor slowing, cabin fan acoustic noise, air/water recycling).

Because Earth cannot monitor or intervene in real time, **astronauts carry primary responsibility for spotting subtle health drift in themselves, diagnosing covariant root causes, and executing countermeasures autonomously**.

### B. The 3 Mandatory Functional Pillars of the Software
To directly satisfy the official challenge prompt (*"build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health"*), a winning system must deliver:

| Functional Pillar | What Judges Look For | How **AstroKinetics v3.2** Delivers It |
| :--- | :--- | :--- |
| **1. Gather Multi-Modal Health & Habitat Indicators** | Low-friction aggregation of wearable vitals, neuromotor/exercise biomechanics, cognitive vigilance, behavioral status, and spacecraft environment. | **3D Volumetric Musculoskeletal & Dual Force-Plate Studio** (`1-Euro` 3D MediaPipe pose + 21-joint hand tremor + `%MVC` muscle load + GRF vectors), **Wang POS contactless camera rPPG**, **Boersma vocal stress DSP** ($F_0$, jitter, HNR), **3-trial PVT reflex assay**, and **Live REST API** (`POST /api/ingest/edge-telemetry`) fusing **Apple Watch HealthKit/IMU**, **Mobile Kinematics App**, and **Habitat ECLSS** (`ppCO2`, radiation `mSv/day`). |
| **2. Evaluate Against Individualized Baselines (100% Offline)** | Statistical multi-signal anomaly detection relative to each crew member's pre-flight baseline—capable of distinguishing habitat `CO2` toxicity from fatigue or musculoskeletal injury with **zero Earth internet**. | **8-DOF Multivariate Mahalanobis Distance ($D_M$)** against pre-flight covariance $\Sigma$ with exact symmetric whitened ($\Sigma^{-1/2}$) variance attribution (`%` of $D_M^2$), $\chi^2_8$ survival $p$-values (`SciPy` server + offline `Wilson–Hilferty` PWA Service Worker), and empirical **NASA OSDR `OSD-571` (`GLDS-563` Inspiration4)** longitudinal proteomics (`CAT 5.24x`, `PRDX2 5.09x`, `HBA1 4.36x`). |
| **3. Enable Astronauts to Act Immediately** | Clear, zero-alert-fatigue counterfactual guidance, closed-loop therapeutic intervention, crew privacy protection, and asynchronous Earth flight-surgeon sync. | **NASA-STD-3001 & HRP Countermeasure Cards**, **Closed-Loop Neuro-Acoustic Music Therapy & 3D Sonification** (`16 Hz Motor RAS`, `10 Hz Alpha 0.1 Hz HRV`, `40 Hz Gamma`, `2.5 Hz Delta + 1/f Pink-Noise Shelter`), **AI Voice Flight Surgeon briefings**, **Apple Watch `WKHapticType` wrist cues**, **3-Tier Crew Privacy Governance**, and **Store-and-Forward Flight Surgeon JSON packets**. |

---

## 2. Official 2026 Schedule & Hard Eligibility Gates (Disqualification Prevention)

### A. Critical Dates (Houston Local Event — CST)
- **Sun, Nov 1, 2026:** Full Challenge Statements & official NASA dataset resources live.
- **Mon, Nov 2, 2026 @ 09:00 CST:** **Space Apps Connect (GitHub Discussions)** opens + *Connect Participant Guide* released (direct Q&A with NASA Challenge SMEs).
- **Fri, Nov 13, 2026 @ 09:00 CST:** *Pre-Event Program*, *Global Offers*, official **Project Submission Participant Guide**, and **Judging & Awards Participant Guide** released.
- **Sat, Nov 14, 2026 @ 09:00 CST:** **Hackathon Day 1: Build & Iterate** — official 48-hour build window & Project Submission portal open.
- **Sun, Nov 15, 2026 @ 09:00 CST:** **Hackathon Day 2: Polish, Pitch & Submit**.
- **Sun, Nov 15, 2026 @ 23:59 CST (11:59 PM):** **HARD SUBMISSION DEADLINE** (team roster, Houston Local Event affiliation, and all submission form links lock permanently).
- **Tue, Dec 1, 2026 @ 00:00:** NASA Global Nominees, Global Finalists & Honorable Mentions announced *(Tentative)*; Global Winners announced **January 2027**.

### B. 5 Hard Eligibility Gates (Must Pass All 5)
1. **Mandatory Official NASA Data / Resource Integration:** Required for any Global Award. Must explicitly integrate and cite official NASA data/standards (e.g., `NASA OSDR OSD-571 / GLDS-563`, `NASA-STD-3001`, `NASA HRP Evidence Books`).
2. **Team Roster Rules:** **1 to 6 registered participants** on `spaceappschallenge.org` affiliated with **Houston**; maximum 1 team and 1 project submission per person.
3. **48-Hour Build Window & Open-Source Licensing:** Final submission repository must be published under an **OSI-approved open-source license** (`Apache-2.0` or `MIT`, defaulting to `Apache-2.0` per Space Apps Terms). Any external libraries (`FastAPI`, `NumPy/SciPy`, `@mediapipe/tasks-vision`) must be publicly available open-source; **zero proprietary, export-controlled (ITAR/EAR), or identifiable patient/PHI data**.
4. **100% Public Link Accessibility:** Every URL submitted (Demo Video or 7-Slide Deck, GitHub Repo, Live Deployed App) **must open in an incognito browser window without login, password, or permission request**. Judges immediately skip inaccessible links.
5. **Mandatory AI / Super Intelligence (SI) Disclosure:** All AI coding assistants, on-device vision models (`MediaPipe PoseLandmarker` / `HandLandmarker`), speech synthesis/recognition APIs, and generative tools used must be transparently listed in the submission form's AI disclosure section and `README.md`.

---

## 3. Master Deliverables Checklist

Use this itemized checklist from **Nov 1 through Sun, Nov 15 @ 23:59 CST**. Items marked `[x]` are already engineered and verified in our reference prototype; items marked `[ ]` require team execution on `spaceappschallenge.org`, GitHub, or video/slide recording.

### Deliverable Package 1: Registration, Houston Team Page & SME Intelligence
- [ ] **1.1 Individual Space Apps Accounts:** Every team member (1–6 max) creates an account at https://www.spaceappschallenge.org/ and registers for the **Houston** Local Event.
- [ ] **1.2 Official Team Creation:** Create the team page under the challenge *"Create Health Monitoring Software for Astronauts on Space Missions"* and verify all members accepted their team invite before **Sun, Nov 15**.
- [ ] **1.3 Challenge `Resources` Tab Audit:** Log in and record every exact NASA link listed on the official challenge `Resources` tab so every single recommended NASA portal is cited in our submission.
- [ ] **1.4 Space Apps Connect Check (Opens Mon, Nov 2 @ 09:00 CST):** Join the challenge channel on Space Apps Connect (GitHub Discussions) to capture any specific NASA SME guidance or Houston Local Lead (**Zain Khan**) pitch logistics (e.g., whether Houston conducts a live 2–3 min local judge Q&A on Nov 15 in addition to the portal submission).
- [ ] **1.5 Nov 13 Guide Verification (Fri, Nov 13 @ 09:00 CST):** Download the 2026 *Project Submission Guide* PDF to confirm exact character limits on each form box and confirm the 30-second video / 7-slide cap.

---

### Deliverable Package 2: Working Software Prototype & Live Cloud URL
- [x] **2.1 Clean, Executive 3-Tab Aerospace & Clinical UI (`v3.2`):**
  - Single-row sticky mission header + centered WAI-ARIA tab switcher (`Mission Console`, `Neuro-Acoustic & Voice`, `Watch & Mobile API`) + slim connected sensor & quick-audio ribbon + Light Clinical / Dark Mission Control theme toggle.
- [x] **2.2 Interactive 3D Volumetric Musculoskeletal, Force-Plate & 21-Joint Hand Digital Twin:**
  - Pointer-drag 360-degree 3D camera orbit + presets (`3D Iso`, `Frontal`, `Sagittal`, `360° Orbit`), dual ARED force plates with 3D Ground Reaction Force (`GRF`) vectors, specular-lit 3D anatomical segments & `%MVC` muscle-activation heatmap, 3D spatial joint goniometers, always-live 3D 21-joint hand & tremor rig, live webcam + on-device `.mp4`/`.webm` WebGPU/WASM inference, and Wang POS contactless forehead rPPG.
- [x] **2.3 8-DOF Multivariate Mahalanobis ($\Sigma^{-1/2}$) Triage & 4 Mission Scenarios:**
  - `Artemis Lunar Orbit (Nominal)`, `Cabin CO2 Drift (Hypercapnia vs. Fatigue)`, `0g Squat Compensation (Kinematic Asymmetry)`, and `Solar Particle Event (Blackout Autonomy)` with 270-degree Readiness Gauge, 8-axis Covariance Radar, whitened variance driver bars, and interactive 3-trial PVT reflex pad.
- [x] **2.4 Closed-Loop Neuro-Acoustic Music Therapy & Vocal Biomarker DSP:**
  - 4 therapeutic WebAudio protocols (`16 Hz Motor Cadence RAS`, `10 Hz Alpha 0.1 Hz HRV`, `40 Hz Gamma Vigilance`, `2.5 Hz Delta + 1/f Pink-Noise Shelter`), 3D ROM filter & spatial tilt sonification, 64-band Log-FFT + Lissajous vectorscope, Boersma vocal stress assay ($F_0$, jitter, HNR), and spoken AI Flight Surgeon briefings with `-10 dB` sidechain ducking.
- [x] **2.5 Connected Apple Watch + Mobile Kinematics REST API (`POST /api/ingest/edge-telemetry`):**
  - Live stateful HTTP telemetry fusion returning closed-loop `WKHapticType` wrist haptic directives, 1 Hz live simulated wearable stream, interactive JSON sandbox, and drop-in **Swift (HealthKit/WatchKit)**, **cURL**, and **Python** integration snippets.
- [x] **2.6 Real Empirical NASA OSDR `OSD-571` (`GLDS-563`) Explorer, Privacy Tiers & Offline PWA:**
  - Longitudinal SpaceX Inspiration4 astronaut plasma proteomics explorer + live NASA OSDR REST API verifier + 3-tier Crew Privacy Governance (`Astronaut Private`, `Crew Medical Officer`, `Flight Surgeon Downlink Packet`) + Service Worker offline cache (`sw.js`).
- [x] **2.7 Public Zero-Install Cloud Deployment:**
  - Live HTTPS deployment on Google Cloud Run (`https://astrokinetics-space-health-765428358644.us-central1.run.app`) with `/docs` OpenAPI specification and `/api/health` readiness endpoint.

---

### Deliverable Package 3: Public Open-Source GitHub Repository
*(Initialize fresh public GitHub repo on **Saturday, Nov 14, 2026 @ 09:00 AM CST** for clean 48-hour hackathon provenance)*
- [ ] **3.1 Public GitHub Repository Created:** Set visibility to **Public** (no private repo!).
- [x] **3.2 OSI-Approved `LICENSE` File Prepared:** `MIT` license included in `LICENSE` and `webapp/LICENSE`.
- [x] **3.3 Clean Data & Branding Hygiene:** Zero PHI, zero proprietary dependencies, zero legacy institutional/project identifiers.
- [ ] **3.4 Judge-Ready Top-Level `README.md` in GitHub Repo:** Must include:
  - One-click **Live Demo URL** at the very top (`Mission Console`, `/?tab=neuro`, `/?tab=api`, `/docs`).
  - System architecture diagram (Wearables + 3D Camera + Habitat ECLSS -> Offline 8-DOF Mahalanobis Engine -> Countermeasures + Neuro-Acoustic Rx + Store-and-Forward Downlink).
  - Explicit **NASA Data & Standards Table** (`NASA OSDR OSD-571 / GLDS-563`, `NASA-STD-3001`, `NASA HRP 5 Hazards & Evidence Books`, `CSA Bio-Monitor`).
  - **Space-to-Earth Dual-Use Impact** section (austere, rural, polar, maritime, and disaster-zone autonomous tele-triage).
  - Local reproduction (`pip install -r requirements.txt && uvicorn app:app`) & Cloud Run deploy commands.
  - Transparent **AI / Open-Source Attribution** section.

---

### Deliverable Package 4: Official Project Demo (**MANDATORY — Choose ONE Format**)
> **CRITICAL RULE:** NASA Space Apps requires **ONE** primary Project Demo link on the submission form — **EITHER** a **<=30-Second Video** **OR** a **<=7-Slide Presentation**. Judges stop watching at second `0:31` or slide `8`.

#### Option A (Recommended for Dynamic 3D + Audio UI): **30-Second Video Pitch**
- [ ] **4A.1 Strict Duration Check:** Total runtime **<= 30.0 seconds** (`0:28–0:30` ideal; verify player timestamp does not read `0:31`!).
- [ ] **4A.2 Second-by-Second Storyboard:**
  - `0:00–0:06` (**The Deep-Space Problem**): *"En route to Mars, a 44-minute radio delay means astronauts must detect and treat health drift without Earth flight surgeons."*
  - `0:06–0:15` (**3D Musculoskeletal + Wearable + Habitat Fusion**): Screen capture of orbiting the **3D Volumetric Musculoskeletal & Force-Plate Digital Twin** (`%MVC` muscle heatmap + 3D 21-joint hand rig) + **Apple Watch / Mobile API** live stream.
  - `0:15–0:23` (**NASA OSDR + 8-DOF Mahalanobis Root-Cause Triage**): Switch from `0g Squat Compensation` to `Cabin CO2 Drift` & `SPE Blackout`—showing the `44.7` Readiness Gauge, 8-DOF Covariance Radar, and real **NASA OSDR `OSD-571`** Inspiration4 proteomics (`CAT 5.24x`, `HBA1 4.36x`) working 100% offline.
  - `0:23–0:30` (**Closed-Loop Action & Earth Impact**): Trigger **Closed-Loop Neuro-Acoustic Therapy + AI Flight Surgeon Voice + Apple Watch Haptic Directive**, closing on **Artemis, Mars, and rural healthcare on Earth** + live URL overlay.
- [ ] **4A.3 English Audio + Burned-In / Closed English Subtitles:** Mandatory English narration/captions so judges watching muted or internationally grasp every detail.
- [ ] **4A.4 Public Hosting:** Upload to **YouTube** (*Public* or *Unlisted* with embedding allowed) or **Google Drive / Vimeo** set to *"Anyone with the link can view"*.

#### Option B (Alternative): **7-Slide Presentation Deck**
- [ ] **4B.1 Strict Slide Cap:** **Maximum 7 slides total** (including title slide!), in English, exported as public Google Slides or PDF:
  1. *Title, Team, Live App Link & Value Proposition*
  2. *The Deep-Space Autonomy Problem (5 NASA Hazards + 44-Min Mars Blackout)*
  3. *Multi-Modal Sensing: 3D Volumetric Biomechanics, POS-rPPG & Apple Watch/Mobile API*
  4. *Offline 8-DOF Mahalanobis ($\Sigma^{-1/2}$) Triage & NASA OSDR `OSD-571` Grounding*
  5. *Closed-Loop Action: NASA-STD-3001 Protocols, Neuro-Acoustic Therapy & Crew Privacy Tiers*
  6. *Validation Scenarios (`CO2` Hypercapnia vs. `0g` Asymmetry vs. `SPE` Storm Shelter)*
  7. *Galactic & Rural Earth Dual-Use Impact + Open-Source Roadmap*

#### Bonus Local Deliverable (Verify with Houston Local Lead):
- [ ] **4C.1 Houston Local Live Pitch Prep (2–3 Min Live Demo Script):** Many local events invite teams to give a 2–3 minute live demo to local judges on Sunday afternoon (Nov 15) to select Houston Local Winners and **Global Nominees**. Prepare a crisp 2-minute live walkthrough clicking through Tab 1 -> Tab 2 -> Tab 3 live!

---

### Deliverable Package 5: Official `spaceappschallenge.org` Project Submission Form Fields
*(All fields below must be completed and saved on the team's Project Page before **Sun, Nov 15 @ 23:59 CST**)*
- [ ] **5.1 Project Name:** e.g., `AstroKinetics: Autonomous 3D Biomechanics, Wearable Mesh & Offline Space-Health Triage`
- [ ] **5.2 High-Level Project Summary:** Concise elevator pitch (~50–150 words; verify exact character limit in Nov 13 guide) stating *what we built*, *how it uses NASA data to solve astronaut self-monitoring*, and *why it matters for Mars & Earth*.
- [ ] **5.3 Link to Project Demo:** Public URL to the `<=30s` YouTube video (or `<=7-slide` deck).
- [ ] **5.4 Link to Final Project / Source Code:** Public GitHub repository URL (and prominent Live Cloud Run Web App URL).
- [ ] **5.5 Detailed Project Description:** Structured clearly with headings matching the 5 judging pillars:
  - *Problem & Mission Context*
  - *How It Works (3D Musculoskeletal Twin, POS-rPPG, Watch/Mobile API, 8-DOF Mahalanobis $\chi^2$, Closed-Loop Neuro-Acoustic & Voice DSP, Offline PWA & 3-Tier Crew Privacy)*
  - *How We Used Official NASA Data (`OSD-571`, `NASA-STD-3001`, `NASA HRP`)*
  - *Space-to-Earth Dual-Use Impact*
  - *Tech Stack & Hardware/Software Architecture*
- [ ] **5.6 Space Agency Data & Resources Used:** Explicit links + accession IDs:
  - NASA Open Science Data Repository (`OSD-571` / `GLDS-563` SpaceX Inspiration4 Plasma Proteomics): `https://osdr.nasa.gov/bio/repo/data/studies/OSD-571` and REST API `https://osdr.nasa.gov/osdr/data/osd/meta/571`
  - NASA Spaceflight Human-System Standard (`NASA-STD-3001`, Vols. 1 & 2)
  - NASA Human Research Program (`HRP`) & Human Research Roadmap (`HRR`) Evidence Reports
  - Canadian Space Agency (`CSA`) Bio-Monitor (*Astroskin*) wearable channel specifications
- [ ] **5.7 External References & Open-Source Citations:** Cite Casiez et al. (2012, 1-Euro Filter), Wang et al. (2017, IEEE TBME POS-rPPG), Thaut et al. (2015, RAS), Lehrer & Gevirtz (2014, 0.1 Hz HRV), Boersma (1993, Vocal Autocorrelation), Google MediaPipe (`Apache-2.0`), Stanford OpenCap (`Apache-2.0`), FastAPI (`MIT`), and SciPy (`BSD-3-Clause`).
- [ ] **5.8 Mandatory AI / Super Intelligence (SI) Disclosure Questions:** Accurately declare AI coding/documentation assistance and client-side neural vision models (`@mediapipe/tasks-vision` `PoseLandmarker` & `HandLandmarker`), emphasizing human-led biomedical math, clinical scenario architecture, and NASA dataset integration.
- [ ] **5.9 Participant Terms & Originality Checkboxes:** Confirm OSI open-source licensing and team originality checkboxes.

---

### Deliverable Package 6: Final Pre-Cutoff QA Gate (Sun, Nov 15 by 22:00 CST)
- [ ] **6.1 Initial Safe Save by 18:00 CST:** Save a complete, valid submission on `spaceappschallenge.org` at least **6 hours before** the 23:59 cutoff to avoid last-minute server congestion.
- [ ] **6.2 Incognito / Logged-Out Browser Test (3-Person Check):** Open an Incognito window on a phone and laptop not logged into Google/GitHub and verify:
  - Project Demo Video / Slide URL loads immediately with audio & English subtitles (`<=30s` / `<=7 slides`).
  - Public GitHub Repository URL loads with `LICENSE` and `README.md`.
  - Live Cloud Run Web App URL loads at 60 FPS, switches all 3 tabs, runs offline evaluation, and returns `HTTP 200` on `POST /api/ingest/edge-telemetry`.

---

## 4. How Our Deliverables Map to the 5 Official Judging Criteria & Global Awards

| Official Judging Pillar (20% Each) | Judge Evaluation Question | Concrete Proof in Our Submission |
| :--- | :--- | :--- |
| **1. Impact** | Does it solve a high-stakes problem for deep space and humanity on Earth? | Enables crew survival during **44-min Mars latency & solar blackouts**, and directly empowers **rural, austere, polar, and disaster-zone tele-triage** on Earth (*Galactic Impact* & *Local Impact* awards). |
| **2. Creativity** | Is the approach genuinely novel beyond a generic vitals dashboard? | Combines **orbitable 3D musculoskeletal `%MVC` + dual force-plate digital twin**, **contactless forehead POS-rPPG**, **connected Apple Watch/mobile haptic loop**, **closed-loop 3D-ROM neuro-acoustic music therapy & vocal stress DSP**, and **3-tier confined-crew privacy governance** (*Best Use of Technology* & *Art & Technology* awards). |
| **3. Validity** | Is the science/math rigorous and does the software genuinely work? | Real **8-DOF Mahalanobis $\Sigma^{-1/2}$ whitening & $\chi^2_8$ $p$-values**, real **1-Euro 3D filtering**, real **Wang POS-rPPG**, real **Boersma vocal autocorrelation**, real downloaded **NASA OSDR `OSD-571`** astronaut proteomics, and a **live, zero-install offline PWA** (*Best Use of Science* & *Best Use of Data* awards). |
| **4. Relevance** | Is it tailored specifically to astronaut self-monitoring and NASA open data? | Built around **NASA's 5 Hazards**, **NASA-STD-3001** `ppCO2`/radiation thresholds, **ARED / EVA / Romberg** spaceflight protocols, and **Store-and-Forward Flight Surgeon packets** (*Best Mission Concept* award). |
| **5. Presentation** | Does the 30s demo / 7-slide deck tell an unforgettable, crystal-clear story? | High-contrast executive UI with immediate above-the-fold visual clarity (3D volumetric twin on left + `44.7` Readiness Gauge & 8-DOF Radar on right) telling a concrete Mars `Sol 142` -> `Sol 210` self-triage story (*Best Storytelling* award). |
