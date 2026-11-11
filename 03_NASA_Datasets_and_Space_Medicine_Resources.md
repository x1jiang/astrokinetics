# 03. Official NASA Datasets & Space Medicine Resources

> **Global Award Eligibility Reminder:** You **must** integrate and explicitly cite at least one **official NASA data repository or NASA technical resource** in your project submission. Below are the strongest, directly relevant open NASA and Space Agency Partner sources for *"Create Health Monitoring Software for Astronauts on Space Missions"*.

---

## 1. Official NASA Data Repositories & Portals (Primary Sources)

### A. NASA Open Science Data Repository (OSDR — GeneLab + ALSDA)
- **Portal URL:** https://osdr.nasa.gov/bio/repo
- **Developer / Public REST API:** https://osdr.nasa.gov/osdr/data/osd/meta/
- **What It Provides:**
  - Unified FAIR-compliant repository combining **NASA GeneLab** (multi-omics: transcriptomics, proteomics, metabolomics, epigenomics) and the **Ames Life Sciences Data Archive (ALSDA)** (physiological telemetry, behavioral/cognitive assays, radiation dosimetry, cabin environmental logs, bioimaging).
  - Includes **human commercial spaceflight datasets** (notably **SpaceX Inspiration4 / SOMA** studies in OSDR, e.g., `OSD-570` through `OSD-575` series covering human blood/immune profiles, skin/microbiome, cognitive/vitals, and spaceflight radiation signatures) alongside ISS and rodent/analog spaceflight studies.
- **How to Use It in Your Hackathon Software:**
  - Pull real pre-flight vs. in-flight vs. post-flight biomarker shift distributions (e.g., cytokine/immune shifts, bone resorption markers, oxidative stress signatures) from OSDR studies to calibrate your **Baseline Drift & Risk Scoring Engine**.
  - Embed clickable OSDR Study Accession IDs (`OSD-xxx`) directly inside your UI's *"Scientific Evidence"* panel!

### B. NASA Human Research Program (HRP) & Human Research Roadmap (HRR)
- **HRP Overview:** https://www.nasa.gov/hrp/
- **Human Research Roadmap & Evidence Books:** https://humanresearchroadmap.nasa.gov/
- **5 Hazards of Human Spaceflight:** https://www.nasa.gov/hrp/5-hazards-of-human-spaceflight/
- **What It Provides:**
  - Official **Human System Risk Board (HSRB) Evidence Reports** detailing clinical pathophysiology, monitoring metrics, and NASA-validated countermeasures across 30+ documented spaceflight risks, including:
    - *Risk of Spaceflight-Associated Neuro-ocular Syndrome (SANS)*
    - *Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes*
    - *Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders*
    - *Risk of Bone Fracture due to Spaceflight-induced Changes to Bone*
    - *Risk of Adverse Health Outcomes & Decrements in Performance due to Medical Conditions (Exploration Medical Capability — ExMC)*
- **How to Use It in Your Hackathon Software:**
  - Map every alert rule and countermeasure card in your software directly to an **official NASA HRR Risk ID & Countermeasure Protocol** (giving your entry exceptional scores on **Validity** and **Best Use of Science**).

### C. NASA Life Sciences Portal (NLSP) & Human Research Data Repository (HRDR)
- **URL:** https://nlsp.nasa.gov/
- **What It Provides:**
  - De-identified metadata, experiment descriptions, biospecimen catalogs, and standardized physiological/behavioral measurement protocols from ISS expeditions and Earth spaceflight analogs (**HERA** — Human Exploration Research Analog at JSC Houston; **CHAPEA** — 1-year Mars Dune Alpha habitat simulation at JSC Houston; head-down-tilt bed-rest studies).
- **How to Use It in Your Hackathon Software:**
  - Use HERA / CHAPEA analog measurement schedules (daily sleep/actigraphy, Psychomotor Vigilance Task [PVT], mood scales, exercise logs, vitals) to design a realistic **"Daily Astronaut Check-In & Passive Sensor Stream"** workflow.

### D. NASA Technical Reports Server (NTRS) — Exploration Medical Capability (ExMC)
- **URL:** https://ntrs.nasa.gov/
- **Key Search Terms:** `"Exploration Medical Capability"`, `"IMPACT"` (Integrated Medical Model / Informing Mission Planning via Analysis of Complex Tradespaces), `"autonomous medical care"`, `"NASA STD-3001"` (NASA Spaceflight Human-System Standard, Volumes 1 & 2).
- **What It Provides:**
  - **NASA-STD-3001** defines exact crew health, habitability, CO2 partial-pressure limits, radiation exposure limits, sleep/circadian lighting standards, and exercise requirements!
- **How to Use It in Your Hackathon Software:**
  - Encode **NASA-STD-3001** physiological and habitat thresholds (e.g., cabin ppCO2 operational limits, acoustic dB limits, radiation career/short-term dose limits, daily sleep/exercise targets) directly into your Habitat-Health Correlation Engine!

---

## 2. Space Agency Partner Resources (High-Value Multi-Agency Bonus)

### A. Canadian Space Agency (CSA) — Bio-Monitor (*Astroskin*) & Connected Care Medical Module (C2M2)
- **Bio-Monitor Overview:** https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
- **Health Beyond / Remote Care Initiative:** https://www.asc-csa.gc.ca/eng/sciences/health-beyond-initiative.asp
- **What It Provides:**
  - Specifications for **Bio-Monitor (Astroskin)**, the wearable smart shirt worn aboard the ISS that continuously records **ECG/heart rate, respiration rate/volume, blood pressure (systolic/diastolic estimation), SpO2, skin temperature, and 3-axis accelerometer activity**.
  - Documentation on **C2M2** and CSA's dual-use deployment of autonomous space medical technology to remote northern and Indigenous communities on Earth.
- **How to Use It in Your Hackathon Software:**
  - Model your wearable telemetry ingestion schema directly on **CSA Bio-Monitor's exact 7-channel sensor specification** so judges immediately recognize hardware realism!

### B. TRISH (Translational Research Institute for Space Health — Houston / Baylor College of Medicine Consortium)
- **URL:** https://www.bcm.edu/academic-centers/space-medicine/translational-research-institute
- **What It Provides:**
  - **EXPAND** commercial spaceflight standardized health data collection framework (pre-flight, in-flight, post-flight core metrics: Apple Watch/Garmin/BioButton vitals, cognition Battery, portable ultrasound, point-of-care diagnostics).
- **Houston Local Event Angle:**
  - Because you are competing in the **Houston Local Event** (home to NASA Johnson Space Center, Texas Medical Center, and TRISH), grounding your software's clinical workflow in **JSC CHAPEA / HERA + NASA-STD-3001 + TRISH core measures** resonates strongly with Houston space-medicine judges!

---

## 3. Complementary Open-Source Time-Series Benchmarks (For Live Demo Streaming)

Because individual-level continuous astronaut clinical telemetry is HIPAA/Privacy-Act restricted (e.g., LSAH), teams commonly combine **real NASA OSDR / NASA-STD-3001 / HRP parameters** with **open OSI/public-domain wearable waveforms** to drive an interactive live real-time streaming demo:

- **PhysioNet (Open / ODC-By / Public Domain):** https://physionet.org/
  - Use open multi-parameter wearable ECG/PPG/HRV/respiration/actigraphy streams perturbed by **NASA HRP-calibrated microgravity fluid shift, hypercapnia (CO2 spike), circadian drift, or SPE radiation event simulators** so judges can interactively trigger mission scenarios in real time and watch the software detect, explain, and prescribe countermeasures!
