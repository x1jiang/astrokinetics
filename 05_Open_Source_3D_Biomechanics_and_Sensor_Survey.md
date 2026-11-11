# 05. Open-Source 3D Biomechanics, Contactless rPPG & Neuro-Acoustic Technology Survey (2025–2026)

**Created:** November 1, 2026  
**Purpose:** Synthesize markerless 3D motion capture, contactless camera photoplethysmography (rPPG), closed-loop rhythmic auditory stimulation (RAS), and active 2025–2026 open-source GitHub repositories powering **AstroKinetics v3.2** for the **2026 NASA Space Apps Challenge**.

---

## Part 1: Core Clinical & Aerospace Biomechanics Methodologies

1. **Single-Camera Markerless 3D Pose, Force-Load & Hand Dexterity Assessment:**
   - Monocular camera tracking of full-body 3D joint Range-of-Motion (ROM), bilateral left/right symmetry (`%`), 3D trunk lean compensation (`deg`), Center-of-Mass postural sway velocity (`mm/s`), and 21-joint fine-motor finger-tapping (`Hz`) + 4–12 Hz postural hand tremor (`mm` RMS).
   - Translates terrestrial neuro-motor assessment directly to **microgravity ARED resistive exercise form monitoring**, **EVA spacesuit shoulder/hand fatigue tracking**, and **post-gravity-transition vestibular Romberg balance checks**.
2. **Closed-Loop Rhythmic Auditory Stimulation (RAS) & Autonomic Resonance:**
   - Dynamically couples real-time 3D movement kinematics to generative auditory tempo, resonant filter cutoff ($f_c$), and spatial stereo balance—improving neuromuscular cadence symmetry while supporting **0.10 Hz Mayer-wave HRV vagal baroreflex recovery**, **40 Hz Gamma cognitive vigilance**, and **2.5 Hz Delta + 1/f pink-noise radiation-shelter rest** (Thaut et al., *Front Neurosci* 2015; Lehrer & Gevirtz, *Front Psychol* 2014).
3. **Contactless Video Photoplethysmography (POS-rPPG) & Vocal Stress Biomarkers:**
   - **Plane-Orthogonal-to-Skin (POS)** chrominance projection (Wang et al., *IEEE TBME* 2017) extracts heart rate (BPM), spectral SNR (dB), and RMSSD heart-rate variability directly from forehead skin pixels during routine camera check-ins.
   - **Time-Domain Autocorrelation Vocal DSP** (Boersma, 1993) extracts fundamental pitch ($F_0$), glottal jitter (`%`), and harmonics-to-noise ratio (`HNR dB`) alongside broadcast presence EQ and `-10 dB` sidechain music ducking.
4. **Asynchronous Store-and-Forward Telemetry & Space-to-Earth Dual Use:**
   - Compresses high-frequency multi-sensor streams (camera 3D kinematics, Apple Watch HealthKit/IMU, habitat ECLSS `ppCO2` & radiation dosimetry) into privacy-governed Store-and-Forward JSON downlink packets for Mars/Lunar blackouts—and serves rural, austere, polar, and disaster-zone clinics on Earth lacking continuous broadband.

---

## Part 2: Open-Source GitHub Motion & Contactless Health Repositories (2025–2026)

To ensure **100% OSI open-source compliance** for the 2026 NASA Space Apps Challenge while running **100% offline inside a spacecraft browser/tablet**, we evaluated active 2025–2026 GitHub repositories across markerless biomechanics, 3D musculoskeletal visualization, and camera rPPG:

| Repository | GitHub URL | License (OSI) | Core Capability (2025–2026 Stack) | Role / Relevance for Astronaut Health Monitoring |
| :--- | :--- | :--- | :--- | :--- |
| **Google MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`) | https://github.com/google-ai-edge/mediapipe | Apache-2.0 | Browser WebAssembly + WebGPU real-time **33-keypoint 3D World Pose** and **21-keypoint Hand** landmarkers at 30–60 FPS completely offline. | **Primary client-side neural engine** in our webapp: zero-cloud-latency 3D kinematics, hand tremor/finger-tap dexterity, and forehead ROI extraction. |
| **OpenCap Core** (`stanfordnmbl/opencap-core`) | https://github.com/stanfordnmbl/opencap-core | Apache-2.0 | Stanford Neuromuscular Biomechanics Lab pipeline computing 3D musculoskeletal kinematics, muscle activations, and joint loading from cameras. | **Primary 3D visual & biomechanical inspiration** for our orbitable 3D volumetric musculoskeletal twin, `%MVC` muscle heatmap, and dual force-plate GRF vectors. |
| **Sports2D** (`perfanalytics/Sports2D`) | https://github.com/perfanalytics/Sports2D | BSD-3-Clause | Monocular webcam/video 2D/3D joint & segment angle computation (sagittal/frontal ROM, hip/knee/ankle/trunk angles) + OpenSim export. | Biomechanical joint-angle convention & 1-Euro kinematic smoothing formulas adapted in our real-time ARED & upper-limb scorer. |
| **Pose2Sim** (`perfanalytics/pose2sim`) | https://github.com/perfanalytics/pose2sim | BSD-3-Clause | Research-grade markerless kinematics bridging 2D pose detectors (`RTMPose`) to 3D musculoskeletal OpenSim models. | Reference architecture for multi-camera spacecraft exercise-bay calibration. |
| **rtmlib / RTMPose** (`Tau-J/rtmlib`, `open-mmlab/mmpose`) | https://github.com/Tau-J/rtmlib | Apache-2.0 | Lightweight ONNX/CPU/GPU inference for `RTMPose` and `RTMW` (133 whole-body keypoints: body + hands + face). | Onboard Python/ONNX microservice upgrade path for multi-crew spacecraft medical workstations. |
| **rPPG-Toolbox** (`ubicomplab/rPPG-Toolbox`) | https://github.com/ubicomplab/rPPG-Toolbox | MIT | Open-source contactless camera physiological toolbox implementing `POS`, `CHROM`, `ICA`, and deep blood-volume-pulse extraction. | **POS (Plane-Orthogonal-to-Skin)** chrominance algorithm adapted directly in our browser camera pipeline for contactless HR & HRV estimation. |
| **3D-HPE-MediaPipe-Pose** (`carolinaclemente00/3D-HPE-MediaPipe-Pose`) | https://github.com/carolinaclemente00/3D-HPE-MediaPipe-Pose | MIT | Monocular 3D joint angle tracking and real-time corrective form feedback. | Validates monocular BlazePose 3D world-landmark joint-angle tracking for self-administered countermeasure tasks. |

---

## Part 3: How **AstroKinetics v3.2** Integrates These Pillars

1. **Interactive 3D Volumetric Musculoskeletal & Force-Plate Studio (`static/biomech3d.js` + `static/dsp.js`):**
   - Renders an orbitable 3D anatomical digital twin with `%MVC` muscle-load thermal heatmaps, dual ARED force-plate GRF vectors, 3D spatial goniometer rings, and an always-live 3D 21-joint hand & tremor rig, backed by 1-Euro filtered 3D MediaPipe `worldLandmarks`, 62-frame de-identified reference 3D motion (`data/reference_3d_keypoints.json`), and on-device local video analysis.
2. **Wang POS Contactless Camera rPPG + Connected Apple Watch / Mobile Kinematics API (`app.py`):**
   - Combines contactless camera rPPG with live `POST /api/ingest/edge-telemetry` fusion from Apple Watch Ultra (`HealthKit` + 100 Hz IMU), mobile kinematics apps, and spacecraft ECLSS (`ppCO2`, radiation dosimetry), returning closed-loop `WKHapticType` wrist haptics.
3. **8-DOF Multivariate Mahalanobis Distance ($D_M$) & $\chi^2$ Triage + Empirical NASA OSDR `OSD-571`:**
   - Computes whitened $\Sigma^{-1/2}$ variance attribution (`%` of $D_M^2$) and $\chi^2$ tail probabilities alongside real downloaded SpaceX Inspiration4 astronaut longitudinal plasma proteomics (`OSD-571` / `GLDS-563`), precached via Service Worker (`static/sw.js`) for 100% offline deep-space autonomy.
