# 2026 NASA International Space Apps Challenge — Turnkey Submission Index

**Project:** **AstroKinetics** — *Autonomous 3D Neuromotor, Multi-Sensor & Neuro-Acoustic Crew Health Suite*  
**Challenge:** *Create Health Monitoring Software for Astronauts on Space Missions*  
**Local Event:** Houston, TX (Hard Submission Cutoff: **Sunday, Nov 15, 2026 @ 11:59 PM CST**)  
**Live Cloud Run Deployment (`v5.1`):** https://astrokinetics-space-health-765428358644.us-central1.run.app  
**Interactive OpenAPI / Swagger Docs:** https://astrokinetics-space-health-765428358644.us-central1.run.app/docs  

---

## 1. Ready-to-Upload Deliverables in `submission_package/`

| Deliverable | File | Verified Competition Spec | Where to Upload / Paste |
| :--- | :--- | :--- | :--- |
| **Executive Pitch Deck (`.pptx` & `.pdf`)** | `AstroKinetics_7Slide_Pitch_Deck.pptx` (`3.5 MB`)<br>`AstroKinetics_7Slide_Pitch_Deck.pdf` (`2.1 MB`, exported by PowerPoint) | **7 slides exact** (`<= 7` slides NASA Space Apps hard cap). Updated to v5.1 by `update_pitch_deck_v51.py`: AstroKinetics · ASTRA title with the AI-MED team mark, live 3D Crew Body Map and triage screenshots, new links. The v3.4 deck is kept as `AstroKinetics_7Slide_Pitch_Deck_v34.pptx`. | Backup demo format; upload the PDF if you prefer slides to the video |
| **Official 30-Second Demo Video (`.mp4` + `.srt`)** | `AstroKinetics_ASTRA_30s_Final_Demo.mp4` (`10.8 MB`)<br>`AstroKinetics_ASTRA_30s_Final_Demo.srt` | **`29.23s`** (`<= 30.0s` NASA Space Apps hard cap), `1920x1080` 30 FPS H.264 (BT.709) + 48 kHz stereo AAC. Recorded from the **live v5.1 portal in real motion**: camera-based 3D twin, Watch + iPhone baseline to orbit, the 3D Crew Body Map with the gravity fluid shift, red-flag triage, cited evidence, end card. an **AI voice-over**, an **original synthesised score** (`build_score.py`, no third-party music) and **burned-in English captions**. Rebuild with `build_final_demo_video.py`. Also hosted at `https://astrokinetics-space-health-765428358644.us-central1.run.app/video`. | Upload `.mp4` to YouTube (`Public` or `Unlisted`) or public Google Drive (`Anyone with link can view`) & paste link into **Project Demo Link** |
| *Earlier cuts (kept for reference, not the submission)* | `AstroKinetics_30s_SpaceApps_Demo.mp4` (v3.4, 28.6 s), `ASTRA_x_AstroKinetics_Seamless_Demo.mp4` (51 s, over the cap) | Superseded by the final cut above | Do not upload |
| **Portal form answers (Word)** | `Space_Apps_Portal_Form_Answers.docx` | Every field of the submission form with the v5.1 answer to paste, the three required links and a pre-submit checklist. Built by `build_portal_answers_docx.py`. | Open and paste field by field into `spaceappschallenge.org` |
| **Portal Form Copy-Paste Answers + 2-Min Live Pitch Script** | `SPACE_APPS_PORTAL_SUBMISSION_PACKET.md` | Exact word/character-budgeted answers for all 7 `spaceappschallenge.org` fields, mandatory NASA `OSD-571` & `NASA-STD-3001` citations, mandatory AI/SI disclosure, and 2-minute Houston Local Judge live demo script | Copy-paste directly into the `spaceappschallenge.org` Project Submission tab |
| **Public GitHub Repository `README.md`** | `GITHUB_REPO_README.md` (also synced to project root `../README.md`) | Architecture Mermaid diagram, NASA dataset table, Apple Watch & Mobile REST API quick-start, local run instructions, MIT open-source license & AI transparency disclosure | `https://github.com/x1jiang/astrokinetics` — paste repo URL into **Link to Project Repository** |

---

## 2. Reproducible Asset Bundle (`submission_package/assets/`)

- **`assets/screenshots/`** — 7 live `2880x1840` (2x Retina) screenshots captured from the `v3.4.0` app (`v34_*.png`; `v33_*.png` kept for reference); panel crops used by the deck and video are in `assets/crops/` across all 4 mission hazard scenarios (`Sol 014 Nominal`, `Sol 088 Cabin CO2 Drift`, `Sol 142 0g Squat Compensation + Cyan 1g Baseline Ghost`, `Sol 210 SPE Radiation Storm`), `62f Mocap Clip`, `Tab 2: Closed-Loop Neuro-Acoustic Synthesizer & Vocal Stress DSP`, and `Tab 3: Connected Apple Watch Ultra + Mobile Kinematics REST API`.
- **`assets/images/`** — 4 bespoke 16:9 (`1792x1024`) aerospace & Space-to-Earth dual-use illustrations (`hero_mars_blackout_astronaut.jpg`, `multimodal_sensor_fusion_concept.jpg`, `spe_storm_shelter_neuroacoustic.jpg`, `space_to_earth_dual_use.jpg`).
- **`assets/veo_clips/`** — 4 16:9 cinematic clips generated with **Google Veo 3.1** on Vertex AI (`veo_01_mars_blackout.mp4`, `veo_02_astronaut_kinematics.mp4`, `veo_03_space_to_earth.mp4`, `veo_04_wrist_cue_shelter.mp4`).
- **`assets/audio_v4/`** — 5 **xAI Grok Voice** (`lumen`) narration stems (`n1_problem.wav` .. `n5_earth.wav`) + `durations.json` with the script and caption cues. (`assets/audio/` holds the v3.3 stems.)
- **Build Scripts (v3.4):** `build_pitch_deck_v4.js` (PptxGenJS 7-slide generator), `generate_assets_v4.py` (Grok Voice + Veo 3.1 generator; keys read from local env files, never stored in the repo), and `build_demo_video_v4.py` (1080p 30 FPS compositor + stereo mix). The v3.3 scripts and outputs are kept in `_archive_v33/` and alongside.
