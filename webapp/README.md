# AstroKinetics v3.2 — Autonomous Crew Health, 3D Musculoskeletal Digital Twin, Neuro-Acoustic Therapy & Wearable Edge API

**2026 NASA International Space Apps Challenge (Houston Local Event)**  
**Challenge:** *Create Health Monitoring Software for Astronauts on Space Missions*  
**Live Google Cloud Run Deployment:** https://astrokinetics-space-health-765428358644.us-central1.run.app  
**License:** MIT (OSI-Approved Open Source)

## Key Capabilities in v3.2

1. **Interactive 3D Volumetric Musculoskeletal, Force-Plate & 21-Joint Hand Digital Twin (`static/biomech3d.js`):**
   - Pinhole 3D perspective camera with interactive pointer-drag 360-degree orbit and one-click presets (`3D Iso`, `Frontal`, `Sagittal`, `360° Orbit`), inspired by **Stanford OpenCap**, **OpenSim**, and **DARI Motion**.
   - Dual piezoelectric ARED force plates (`R-PLATE` / `L-PLATE`) with 3D Ground Reaction Force (`GRF`) vectors (`N` and `%` load share), Center-of-Mass plumb laser, and postural sway Center-of-Pressure trace.
   - Z-sorted specular-lit 3D anatomical segments (thighs, shanks, feet, pelvis, articulated 8-vertebra spine, 3D thoracic ribcage, arms, and visor helmet) with real-time inverse-kinematic muscle activation (`%MVC`) thermal heatmaps (`Quad R/L`, `Glute R/L`, `Lumbar`, `Deltoid`, `Biceps`), 3D spatial joint goniometer rings, 3D motion-trail ribbons, and an always-live articulated 3D 21-joint hand & tremor micro-scanner.
2. **Metric 3D World-Landmark Kinematics, 1-Euro Filtering & Contactless POS-rPPG (`static/dsp.js`):**
   - Browser WebGPU/WASM `@mediapipe/tasks-vision` `PoseLandmarker` (`worldLandmarks` in 3D meters filtered through 33 adaptive **1-Euro Low-Pass Filters**, Casiez et al., CHI 2012) + 21-joint `HandLandmarker` (finger-tap Hz and 4–12 Hz postural hand tremor RMS in mm) + hysteresis repetition segmenter and CSV export.
   - **Wang et al. (IEEE TBME 2017) Plane-Orthogonal-to-Skin (POS)** contactless camera rPPG extracting forehead skin ROI RGB chrominance signals, bandpass filtering (0.7–3.2 Hz), Hann-windowed DFT power spectrum (46–176 BPM), spectral SNR (dB), and refractory inter-beat interval RMSSD HRV.
   - Supports de-identified 62-frame (`30 fps`) reference 3D motion playback (`data/reference_3d_keypoints.json`), live webcam inference, 100% on-device local `.mp4`/`.webm` video analysis, and slider-coupled 3D digital-twin perturbation.
3. **8-DOF Multivariate Mahalanobis Distance ($D_M$) & $\chi^2$ Anomaly Triage (`app.py` + `static/dsp.js`):**
   - Evaluates an 8-channel physiological and kinematic vector against a fixed demo reference. Python and `static/dsp.js` use the same symmetric covariance whitening transform and chi-square tail calculation. See the [prototype verification](../README.md#prototype-verification) for the test cases and limits.
4. **Closed-Loop Neuro-Acoustic Music Therapy, 3D Sonification & Vocal Stress DSP (`static/audio_engine.js`):**
   - Polyphonic generative WebAudio synthesizer grounded in Thaut Rhythmic Auditory Stimulation (RAS) and Lehrer 0.10 Hz HRV baroreflex resonance (`16 Hz Beta Motor Cadence RAS`, `10 Hz Alpha HRV`, `40 Hz Gamma Vigilance`, `2.5 Hz Delta + Paul Kellet 7-pole 1/f Pink-Noise Shelter`), with 3D joint-ROM-to-filter cutoff ($f_c \in [360, 3100]\text{ Hz}$) and trunk-tilt spatial panning.
   - Broadcast voice enhancement chain (`85 Hz` cabin rumble HPF + `+4.5 dB @ 3.2 kHz` presence EQ + `4:1` compressor + `-10 dB` automatic sidechain music ducking), Boersma (1993) autocorrelation vocal biomarker extraction ($F_0$ Hz, Glottal Jitter `%`, HNR dB), spoken AI Flight Surgeon briefings, and hands-free `SpeechRecognition` commands.
5. **Crew Telemetry API Sandbox (`POST /api/ingest/edge-telemetry`):**
   - Runs synthetic watch, phone, and habitat presets against the FastAPI endpoint. The endpoint merges readings by `crew_member` and `mission_sol`, reports `received_channels` and `demo_default_channels`, and returns a `WKHapticType` value for the demo. Use `GET /api/ingest/recent` with both fields to filter the in-memory packet history. Integration snippets are available in Swift, cURL, and Python.
6. **Empirical NASA OSDR `OSD-571` (`GLDS-563`) Inspiration4 Cohort Explorer & Offline PWA (`static/sw.js`):**
   - Bundles selected longitudinal Inspiration4 protein entries from NASA OSDR `OSD-571` for the evidence viewer. A separate service worker cache supports reloading and scoring scripted mission scenarios in the browser after the first online visit.

## Run Locally
```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

## Deploy to Google Cloud Run
```bash
gcloud run deploy astrokinetics-space-health \
  --source . \
  --project="${GCP_PROJECT_ID:-your-gcp-project-id}" \
  --region=us-central1 \
  --allow-unauthenticated
```

## Anatomy model credit

The 3D body in the Triage tab's Crew Body Map uses **BodyParts3D 4.0** geometry
(© The Database Center for Life Science, CC BY 4.0), taken from the
[Human Atlas](https://github.com/ashemag/human-atlas) project (MIT) and repacked by
`scripts/build_body_atlas.py`. Full attribution: `static/atlas/ATTRIBUTION.md`.
