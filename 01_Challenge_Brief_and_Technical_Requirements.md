# 01. Challenge Brief & Technical Requirements

## Challenge Snapshot

- **Title:** Create Health Monitoring Software for Astronauts on Space Missions
- **Event:** 2026 NASA Space Apps Challenge (*Theme: "The Next Frontier"*)
- **Difficulty:** Intermediate
- **Subjects:** `Human Exploration` · `Software` · `Space Exploration`
- **Official Summary Prompt:**
  > *"Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health."*

---

## 1. Background & Problem Context

As crewed exploration transitions from Low Earth Orbit (ISS, ~400 km altitude, sub-second latency, rapid emergency return) to **Artemis lunar surface stays** and **Mars transit/surface missions** (up to 20–24 minutes one-way communication latency and multi-week solar-conjunction blackouts), traditional ground-led flight medicine breaks down.

NASA's **Human Research Program (HRP)** organizes deep-space health threats around the **Five Hazards of Human Spaceflight**:

| HRP Spaceflight Hazard | Primary Physiological & Behavioral Risks | Measurable Onboard Indicators |
| :--- | :--- | :--- |
| **1. Space Radiation** | Galactic cosmic rays (GCR) & solar particle events (SPEs); immune dysregulation, hematopoietic shifts, oxidative stress, acute radiation prodrome | Personal dosimeter flux/cumulative mSv, WBC/lymphocyte trend panels (point-of-care), fatigue/nausea symptom logs |
| **2. Isolation & Confinement** | Circadian desynchrony, sleep degradation, depression/anxiety, cognitive slowing, team cohesion friction | Actigraphy sleep stages, psychomotor vigilance task (PVT) reaction times, mood check-ins, voice/journal stress markers |
| **3. Distance from Earth** | Up to 44-minute round-trip Mars communication delay; no real-time flight surgeon tele-consult or medical evacuation; limited onboard pharmacy shelf-life | Local autonomous triage confidence scores, onboard medical consumable inventory, delayed Store-and-Forward sync packets |
| **4. Gravity Fields** | Cephalad fluid shifts (Spaceflight-Associated Neuro-ocular Syndrome — SANS), orthostatic intolerance, cardiovascular deconditioning, 1–1.5%/month bone mineral loss, muscle atrophy | HR, HRV, continuous BP, SpO2, resistive exercise (ARED) load/compliance, hydration/electrolyte balance, ocular/IOP checks |
| **5. Hostile / Closed Environment** | Elevated cabin CO2 (hypercapnic headaches/cognitive impairment), cabin noise, microbial/allergen shifts, recycled water/air contaminants | Habitat telemetry (ppCO2, O2%, cabin pressure, acoustic dB, temperature/humidity) correlated directly with crew symptoms |

---

## 2. Core Challenge Objectives

Your software solution must empower **astronaut self-monitoring, autonomous risk evaluation, and immediate countermeasure execution**:

1. **Aggregate Multi-Modal Health & Habitat Indicators:**
   - Unify continuous wearable telemetry (e.g., smart garments like CSA's *Bio-Monitor / Astroskin* or biometric rings/watches), point-of-care biomarker inputs, habitat environmental telemetry (CO2, radiation dosimetry), and brief low-friction crew logs (mood, symptoms, nutrition/hydration, exercise).
2. **Evaluate Status Against Individualized Baselines:**
   - Detect subtle multi-signal physiological or behavioral drift relative to each astronaut's **pre-flight and rolling in-flight baseline**, rather than relying solely on static terrestrial hospital cutoffs.
3. **Guide Actionable Countermeasures & Triage:**
   - Translate detected deviations into **clear, step-by-step, evidence-backed actions** the astronaut can take independently (e.g., adjusting ARED resistive load, initiating hydration/electrolyte protocol, shifting circadian lighting/sleep schedule, ventilating high-CO2 module, running a targeted diagnostic check, or escalating to the Crew Medical Officer / asynchronous Flight Surgeon queue).

---

## 3. Key Questions NASA SMEs Expect Teams to Address

From the official challenge guidance and resources, strong entries explicitly answer:
1. **Feasibility in Space:** Which physiological, cognitive, biochemical, and environmental measurements can realistically be collected non-invasively (or minimally invasively) inside a spacecraft or lunar/Martian habitat?
2. **Hazard-to-Biomarker Mapping:** How do specific spaceflight stressors (e.g., elevated cabin CO2 + sleep loss vs. early infection vs. radiation SPE exposure) manifest across combined health indicators?
3. **Thresholds & Escalation Logic:** What deviation thresholds trigger (a) silent baseline logging, (b) gentle self-care/countermeasure coaching, (c) urgent onboard Crew Medical Officer alert, or (d) high-priority Store-and-Forward telemetry burst to Earth Flight Surgeons?

---

## 4. Technical & Architectural Requirements for a Competitive Solution

### A. Offline-First, Edge-Autonomous Execution
- **Requirement:** Must operate with **zero dependency on live Earth cloud APIs** during nominal and blackout mission modes.
- **Implementation:** Local storage (e.g., SQLite / IndexedDB / local DuckDB) + local edge inference (lightweight statistical state-space / Kalman baseline models, scikit-learn / ONNX / local small language model or deterministic clinical protocol engine) + explicit **"Comm-Delay / Blackout Simulator"** toggle (e.g., `ISS Live (0.5s)` vs. `Lunar Far-Side Blackout` vs. `Mars Transit (18 min one-way)`).

### B. Personalized Baseline & Multi-Signal Correlation Engine
- **Requirement:** Distinguish normal operational exertion (e.g., EVA suit exertion or scheduled ARED workout) from pathological drift.
- **Implementation:** Context-aware anomaly detection that fuses **activity/schedule state + habitat telemetry + vitals** (for example: flagging that rising resting HR + morning headache + slower PVT reaction time coincides with a 4 mmHg cabin ppCO2 rise rather than systemic infection).

### C. Explainable, Zero-Alert-Fatigue Crew UX
- **Requirement:** Spacecraft already suffer from alarm overload; fatigued astronauts need glanceable clarity.
- **Implementation:**
  - **System-Level Readiness & Traffic-Light Triage** (`Nominal / Green`, `Watch & Countermeasure / Amber`, `Clinical Action Required / Red`) across key physiological domains (Cardiovascular, Musculoskeletal, Neuro/Cognitive & Behavioral, Immune/Radiation, Habitat Exposure).
  - **"Why Was This Flagged?" Explainability Card** showing the exact contributing signals, baseline z-score/trend window, and citation to NASA HRP / clinical protocol rationale.

### D. Privacy-Preserving Crew Governance
- **Requirement:** In a 4-to-6-person confined habitat, behavioral health, mood, and personal medical metrics are acutely sensitive.
- **Implementation:** Role-based privacy tiers:
  - **Private Astronaut View:** Full raw mood, journal, sleep, and biometric history owned by the individual crew member.
  - **Crew Medical Officer / Commander View:** Privacy-filtered operational readiness status; raw details unlocked only via astronaut consent or hard life-safety threshold breach.
  - **Earth Flight Surgeon Sync Packet:** Compressed, encrypted delta summary queued for the next Deep Space Network (DSN) downlink window.

### E. Earth Dual-Use Impact ("Space-to-Earth")
- **Requirement:** Directly boosts the **Impact** judging criterion and eligibility for the *Galactic Impact* / *Local Impact* Global Awards.
- **Implementation:** Highlight how the exact same offline, autonomous self-triage + wearable/environmental monitoring architecture serves **rural, austere, polar, maritime, disaster-zone, and underserved communities on Earth** lacking broadband or immediate physician access.
