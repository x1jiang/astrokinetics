# 04. Pre-Hackathon Action Plan & 48-Hour Execution Checklist

**Current Date:** Sunday, November 1, 2026  
**Days Until Hackathon Kickoff:** 13 days (**Sat, Nov 14, 2026 @ 09:00 AM CST**)

---

## Phase 1: Registration, Team Setup & Connect (Nov 1 – Nov 3, 2026)

- [ ] **1. Create Accounts & Select Houston Local Event:**
  - Every team member (1 to 6 people max) registers at https://www.spaceappschallenge.org/ and selects **Houston** (`/2026/local-events/houston/`) as their Local Event.
- [ ] **2. Log Into Challenge Page & Inspect the `Resources` Tab:**
  - While logged in, open https://www.spaceappschallenge.org/2026/challenges/create-health-monitoring-software-for-astronauts-on-space-missions/ and click the **Resources** tab to record every exact NASA hyperlink listed by the Challenge Author.
- [ ] **3. Join Space Apps Connect Tomorrow (Mon, Nov 2 @ 09:00 AM CST):**
  - Open **Space Apps Connect (GitHub Discussions)** as soon as it launches tomorrow morning.
  - Read the *Space Apps Connect Participant Guide* and subscribe to the discussion thread specifically dedicated to **"Create Health Monitoring Software for Astronauts on Space Missions"**.
  - Watch for direct clarifications from **NASA Subject Matter Experts (SMEs)** — they often reveal exactly what pitfalls to avoid and what features excite them most!
- [ ] **4. Check Houston Local Event Venue & Hybrid Logistics:**
  - Monitor the Houston Local Event page (Local Lead: **Zain Khan**) for updates on in-person venue location, local Slack/Discord channels, mentor office hours, and whether Houston requires an in-person pitch in addition to the online portal submission.

---

## Phase 2: Allowed Domain & Data Preparation (Nov 3 – Nov 12, 2026)

*(Reminder: Do **not** write project-specific application code before Nov 14 @ 09:00 AM. Everything below is 100% permitted pre-hackathon research and planning.)*

- [ ] **1. Define Team Roles (Up to 6 Members):**
  - **Space Medicine / Clinical Lead:** Extracts NASA-STD-3001 thresholds, HRP Evidence Book countermeasures, and 3–4 realistic deep-space clinical scenarios.
  - **Data & Anomaly Engine Lead:** Studies NASA OSDR REST API (`OSD-570+` Inspiration4 / spaceflight biomarker schemas) and designs the individualized baseline drift + root-cause attribution math on paper.
  - **Frontend / Crew UX Lead:** Plans a low-cognitive-load, offline-first spacecraft tablet dashboard (Traffic-Light Triage, Explainability Card, Privacy Mode toggle, Comm-Delay/Blackout toggle).
  - **Storytelling / Demo Video Lead:** Plans the **30-second video script** (or **7-slide deck** structure) and project page narrative aligned to the 5 judging criteria (*Impact, Creativity, Validity, Relevance, Presentation*).
- [ ] **2. Curate 3 Signature Mission Scenarios to Demo Live:**
  - *Scenario A — Habitat Hypercapnia vs. Fatigue:* Subtle cabin ppCO2 creep (above NASA-STD-3001 nominal target) + rising resting HR + slower 30-second cognitive PVT reaction time -> Software distinguishes environmental CO2 toxicity from behavioral burnout and prescribes habitat scrubber check + ventilation countermeasure.
  - *Scenario B — Musculoskeletal & Cardiovascular Deconditioning Drift:* Multi-week HRV dip + orthostatic pulse shift + missed ARED resistive load target -> Software recalibrates personalized ARED exercise + hydration/electrolyte countermeasure protocol.
  - *Scenario C — Solar Particle Event (SPE) + Blackout Autonomy:* Personal dosimeter radiation spike + immune/symptom prodrome during a **22-minute Mars comm delay / solar conjunction blackout** -> Software runs 100% offline, walks crew through acute countermeasure checklist, enforces crew privacy tiers, and queues a compressed Store-and-Forward Flight Surgeon packet.
- [ ] **3. Compliance Note on Existing Lab Space-Health Research (e.g., *AstroTriage* / *AURA* / Rural AI):**
  - Your group's deep domain expertise in space triage, NASA HUNCH biomedical research, and rural/austere healthcare is a **major competitive advantage** for scientific **Validity** and **Galactic Impact**.
  - To stay **100% compliant** with Space Apps rules: build a **brand-new, standalone open-source codebase from scratch starting Saturday, Nov 14 @ 09:00 AM** tailored specifically to longitudinal astronaut self-monitoring, rather than submitting pre-existing unreleased code. Any third-party libraries used must be publicly available under an OSI open-source license.

---

## Phase 3: Final Pre-Event Check (Fri, Nov 13, 2026 @ 09:00 AM CST)

- [ ] Download and read the official 2026 **Project Submission Participant Guide** and **Judging & Awards Participant Guide** as soon as they drop at 09:00 AM.
- [ ] Verify exact character/word limits on every submission text field and verify whether the video cap remains **30 seconds** (or if Houston Local Judging also asks for a separate live 2–3 minute local pitch).
- [ ] Claim any helpful **Global Offers** (hosting/compute/design credits) unlocked at 09:00 AM.
- [ ] Finalize your team page on `spaceappschallenge.org` and confirm all members show up on the roster under **Houston**.

---

## Phase 4: 48-Hour Hackathon Sprint Schedule (Nov 14 – Nov 15, 2026)

### Saturday, November 14 — Day 1: Build & Iterate
- **09:00 AM:** Create fresh public GitHub repo (`Apache-2.0` or `MIT` license); make initial commit.
- **09:30 AM – 01:00 PM:** Build core offline data model (SQLite / IndexedDB / JSON bundle calibrated to NASA OSDR + NASA-STD-3001) and personalized rolling-baseline anomaly engine.
- **01:00 PM – 06:00 PM:** Build interactive Crew Self-Monitoring UI (Vitals + CSA Bio-Monitor stream, Habitat CO2/Radiation telemetry, 15-sec Mood/PVT quick check, Traffic-Light System Triage, Explainability & Countermeasure Protocol drawer).
- **06:00 PM – 10:00 PM:** Add **Earth-Independence / Comm-Delay Mode Toggle**, **Privacy-Tier Switcher** (*Astronaut Private* vs. *Crew Medical Officer* vs. *Flight Surgeon Downlink Packet*), and **Interactive Scenario Simulator** so judges can trigger live anomalies in 1 click.

### Sunday, November 15 — Day 2: Polish, Pitch & Submit
- **09:00 AM – 01:00 PM:** Deploy public zero-install live web demo ( works offline as a PWA / static + local inference app so judges can test reliably!).
- **01:00 PM – 04:30 PM:** Record, edit, caption (English subtitles!), and time-check the **30-second demo video** (or finalize the **7-slide deck**). Verify public sharing permissions in an incognito browser!
- **04:30 PM – 06:30 PM:** Draft and save **complete initial submission** on `spaceappschallenge.org` (including explicit NASA OSDR / HRP / NASA-STD-3001 citations and full AI/SI tool disclosure).
- **06:30 PM – 10:30 PM:** Polish GitHub `README.md` (architecture diagram, NASA dataset table, Earth dual-use section, live demo link), run end-to-end incognito link checks, and save final submission well ahead of the **11:59 PM CST** hard cutoff!
