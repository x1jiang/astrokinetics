# 02. Official Rules, Submission Deliverables & Judging Guide

> **Note:** Official 2026 *Project Submission* and *Judging & Awards Participant Guides* unlock on **Friday, November 13, 2026 at 09:00** on `spaceappschallenge.org`. Always verify final character limits and form fields against that PDF upon release. The rules below synthesize official 2026 NASA Space Apps Terms, FAQs, and standard Global Organizing (GO) Team requirements.

---

## 1. Team & Registration Rules (Houston Local Event)

| Rule Area | Official Requirement | Compliance Action |
| :--- | :--- | :--- |
| **Individual Registration** | Every team member must have an individual registered account on `spaceappschallenge.org` and register for the **Houston** Local Event. | All members register before **Nov 15, 2026**. |
| **Team Size** | **1 to 6 members** for Local Event teams *(Universal Virtual Event requires 2–6 members; Houston Local Event allows 1–6)*. Maximum 6 strictly enforced. | Keep official roster at <= 6 people. (External mentors/advisors may advise if permitted, but up to 6 registered team members can be on the submission). |
| **One Team / One Challenge** | Each participant may belong to **only one team**, and each team may submit **only one project** to **one official challenge**. | Select *Create Health Monitoring Software for Astronauts on Space Missions* when creating the team project page. |
| **Local Event Lock Deadline** | Last day to switch Local Events or modify team membership is **Sunday, November 15, 2026** before submission closes. | Finalize team invites and Houston affiliation by Saturday morning, Nov 14. |

---

## 2. Hard Eligibility Gates & Compliance Rules (Avoid Disqualification)

### Gate 1: Mandatory NASA Data / Resource Integration (Required for Global Awards)
- **Rule:** To be eligible for **any Global Award**, your project **MUST incorporate and explicitly cite at least one official NASA dataset or NASA resource** (e.g., NASA OSDR/GeneLab datasets, NASA HRP Human System Risk Board Evidence Books/parameters, NASA NLSP/HRDR data, or NASA ExMC technical standards).
- Space Agency Partner resources (e.g., CSA, ESA, JAXA) and external public datasets are strongly encouraged as *supplements*, **not replacements**, for NASA resources.

### Gate 2: Hackathon Build Window & Pre-Existing Code Rule
- **Rule:** Active building/coding of your hackathon solution must take place **during the official 48-hour hackathon window** (starting **Saturday, Nov 14, 2026 at 09:00 AM local time** and ending **Sunday, Nov 15, 2026 at 11:59 PM local time**).
- **What IS allowed before Nov 14:**
  - Studying the challenge statement, reading NASA HRP literature, and inspecting NASA OSDR APIs/schemas.
  - Brainstorming system concepts, sketching high-level ideas, and assigning team roles.
  - Setting up standard developer environments (Python, Node.js, IDE, cloud accounts).
- **Pre-Existing / Third-Party Code & Open-Source Rule:**
  - Per NASA Space Apps Participant Terms & Conditions, any third-party or pre-existing libraries, datasets, or frameworks used in your solution **must already be freely and publicly available without restriction** under an **Open Source Initiative (OSI)-approved license** (e.g., MIT, Apache 2.0, BSD) prior to the hackathon, and must contain **zero ITAR/EAR export-controlled or proprietary/PHI data**.
  - Judges evaluate the **original work created during the 48-hour hackathon**, so clearly separate and document what your team built fresh during Nov 14–15 versus standard open-source dependencies.

### Gate 3: Open-Source Licensing of Your Submission
- **Rule:** All original code and content created for your Space Apps submission must be made freely and publicly available under an **OSI-compliant open-source license**.
- If no license is specified in your repository, NASA Space Apps Terms automatically apply the **Apache 2.0 License**.
- **Best Practice:** Initialize a fresh public GitHub repository at **09:00 AM on Nov 14** with an `Apache-2.0` or `MIT` `LICENSE` file so commit timestamps cleanly prove 48-hour compliance.

### Gate 4: Artificial Intelligence (AI) / Super Intelligence (SI) Policy
- **Rule:** Generative AI, LLMs, foundation models, AI coding assistants, and media generation tools **are permitted** during the hackathon.
- **Mandatory Disclosure:** On the official Project Submission form, teams **must answer the AI/SI disclosure questions accurately**, listing which AI tools/models were used and how they were applied (e.g., code assistance, synthetic scenario generation, onboard clinical decision-support LLM, UI assets). Transparent disclosure does **not** penalize judging scores, whereas undisclosed AI-generated assets or plagiarized content risks disqualification.

---

## 3. Project Submission Deliverables Checklist

**Submission Window:** Opens **Sat, Nov 14 @ 09:00 AM** — Closes **Sun, Nov 15 @ 11:59 PM (23:59) CST** *(strict cutoff; aim to submit initial draft by Sunday 6:00 PM and final updates by 10:30 PM)*.

1. **Project Name & High-Level Summary:** Crisp, memorable title + concise elevator pitch (typically ~50–150 words).
2. **Project Demo (MANDATORY — Choose One Format):**
   - **Option A — 30-Second Video:** Publicly accessible link (YouTube unlisted/public, Vimeo, or public Google Drive with "Anyone with link can view") **strictly <= 30 seconds** *(confirm exact second cap in the Nov 13 guide)*, in English or with **English subtitles**.
   - **Option B — 7-Slide Presentation Deck:** Publicly accessible slide deck or PDF **strictly <= 7 slides**, written in English.
   - *(Tip: Many Global Finalist teams embed a crisp 30-second video showcasing live UI + real NASA data flow, and also link a full architecture README + live hosted web demo in the project links!)*
3. **Link to Final Project / Code Repository:** Public GitHub URL (with working live web demo link via GitHub Pages / Vercel / Netlify / Streamlit / Hugging Face Spaces so judges can click and test immediately without installing anything).
4. **Detailed Project Description:**
   - **What does it do & how does it work?** (System architecture, offline autonomy, personalized baseline engine, actionable countermeasures).
   - **Benefits & Impact:** How it protects deep-space crews (Artemis/Mars) + dual-use impact on Earth.
   - **Tools, Coding Languages, Hardware & Software Used.**
5. **NASA Data & Space Agency Partner Citations:**
   - Exact URLs and dataset accession IDs (e.g., `NASA OSDR OSD-570 / Inspiration4`, `NASA HRP Human System Risk Board Evidence Reports`, `CSA Bio-Monitor specifications`) and a clear explanation of *how* those datasets/parameters drive your software.
6. **AI / SI Usage Declaration:** Complete list of AI coding/model/design tools used.

---

## 4. Official 5 Judging Criteria Framework

Both Houston Local Judges (who select Local Winners & **Global Nominees** advancing to NASA review) and NASA Global Judges evaluate projects across **five equal pillars**:

| Criterion | What Judges Ask | How to Score Top Marks on This Challenge |
| :--- | :--- | :--- |
| **1. Impact** | How much impact (quality & quantity) can this project have? Does it solve a major problem in space and/or on Earth? | Quantify deep-space communication blackouts (up to 44-min round-trip Mars latency) where crew self-triage saves missions, **plus** demonstrate immediate dual-use for rural/austere healthcare on Earth. |
| **2. Creativity** | How novel and original is the approach compared to standard fitness/wellness dashboards? | Go beyond a generic smartwatch dashboard: fuse **habitat telemetry (CO2, radiation) + physiological drift + cognitive PVT + privacy-tiered crew governance + counterfactual "what-if countermeasure" simulation**. |
| **3. Validity** | Is the solution scientifically, medically, and technically sound? Does it actually work as claimed? | Ground biomarker thresholds, drift trajectories, and countermeasures directly in **NASA HRP Evidence Books** and **NASA OSDR real spaceflight datasets**; ship a **live, working offline-capable web app** (not static mockups). |
| **4. Relevance** | Does it directly answer the challenge prompt, emphasize usability for astronauts, and effectively use NASA open data? | Center the UX on **astronaut self-evaluation & immediate action** (low cognitive load, explainable alerts, step-by-step protocols) with traceable NASA data ingestion. |
| **5. Presentation** | How clearly and compellingly does the team communicate why it matters and how it works within the 30s video / 7 slides and project page? | Tell a tight, concrete mission story: *"Sol 114 en route to Mars -> 18-min comm delay -> subtle HRV + PVT + cabin CO2 drift -> our software isolates root cause & prescribes countermeasure in 10 seconds."* |

---

## 5. The 10 NASA Global Award Categories

If nominated by the **Houston Local Event** as a **Global Nominee**, your project enters multi-round NASA SME evaluation for **Honorable Mentions**, **Global Finalists (Top ~40)**, and the **10 Global Winners**:

1. **Best Use of Science** *(Prime target for this challenge)* — Best and most valid use of space physiology/medicine and the scientific method.
2. **Best Use of Data** *(Prime target)* — Best makes space biomedical/telemetry data accessible or leverages it for a unique clinical application.
3. **Best Use of Technology** *(Prime target)* — Most innovative integration of edge/offline software, multi-modal sensing, and AI decision support.
4. **Galactic Impact** *(Prime target)* — Greatest potential to improve life on Earth (remote/rural healthcare) and in the universe (deep-space crew survival).
5. **Best Mission Concept** *(Prime target)* — Most plausible, operationally realistic mission concept and crew workflow design.
6. **Most Inspirational** — Captures our hearts and inspires future human exploration.
7. **Best Storytelling Award** — Most effectively communicates the potential of open data through the art of storytelling.
8. **Global Connection Award** — Best connects people around the world through technology.
9. **Art & Technology Award** — Most effective combination of technical excellence and human-centered visual/creative design.
10. **Local Impact Award** — Demonstrates greatest potential for measurable local/regional impact.
