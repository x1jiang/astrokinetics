"""
Generate Grok Voice TTS narration (via S2AI grok_voice_key) and 3 cinematic 16:9 Veo 3.1 video clips
(via Vertex AI veo-3.1-fast-generate-001) for the <=30.0s NASA Space Apps 2026 Official Demo Video.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import time
import wave
import requests

FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"
PKG = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(PKG, "assets", "audio")
VEO_DIR = os.path.join(PKG, "assets", "veo_clips")
IMG_DIR = os.path.join(PKG, "assets", "images")
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(VEO_DIR, exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)

# 1. Tightly-timed 4-beat narration script targeting ~23.5s speech -> ~28.6s total video (<30.0s NASA cap!)
SCRIPT = [
    {
        "id": "s1_problem",
        "text": "Forty-four minutes from Earth on Mars transit, astronauts have zero live flight surgeon.",
        "subtitle": "44-min Mars blackout: astronauts must self-triage without live Earth flight surgeons.",
    },
    {
        "id": "s2_gather",
        "text": "AstroKinetics fuses 3D camera biomechanics, facial pulse, and Apple Watch telemetry completely offline.",
        "subtitle": "AstroKinetics fuses 3D camera biomechanics, 3-zone facial rPPG & Apple Watch APIs offline.",
    },
    {
        "id": "s3_evaluate",
        "text": "Eight-axis Mahalanobis math and NASA Inspiration-Four proteomics isolate cabin C O 2, squat drift, or solar radiation.",
        "subtitle": "8-DOF Mahalanobis math + NASA OSD-571 proteomics isolate CO2 drift, 0g asymmetry & SPE storms.",
    },
    {
        "id": "s4_act",
        "text": "Prescribing instant countermeasures, neuro-acoustic therapy, and rural Earth tele-triage anywhere.",
        "subtitle": "Instant NASA-STD-3001 directives, closed-loop neuro-acoustic therapy & rural Earth dual use.",
    },
]

json.dump(SCRIPT, open(os.path.join(PKG, "video_script.json"), "w"), indent=2)

print("=== STEP 1: Synthesizing Grok Voice TTS Narration (xAI API via S2AI key) ===", flush=True)
VOICE_ID = "lumen"
REPL = {"AstroKinetics": "Astro Kinetics", "rPPG": "R P P G"}
durations = {}

for seg in SCRIPT:
    mp3_path = os.path.join(AUDIO_DIR, f"{seg['id']}.mp3")
    wav_path = os.path.join(AUDIO_DIR, f"{seg['id']}.wav")
    if not os.path.exists(mp3_path):
        resp = requests.post(
            "https://api.x.ai/v1/tts",
            timeout=90,
            headers={
                "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "text": seg["text"],
                "voice_id": VOICE_ID,
                "language": "en",
                "speed": 1.06,
                "text_normalization": True,
                "replace": REPL,
            },
        )
        resp.raise_for_status()
        with open(mp3_path, "wb") as f:
            f.write(resp.content)

    subprocess.run(
        [
            FF,
            "-loglevel",
            "error",
            "-y",
            "-i",
            mp3_path,
            "-af",
            "silenceremove=start_periods=1:start_threshold=-52dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.08,areverse,atempo=1.04",
            "-ar",
            "48000",
            "-ac",
            "1",
            wav_path,
        ],
        check=True,
    )
    with wave.open(wav_path) as w:
        dur_s = w.getnframes() / w.getframerate()
    durations[seg["id"]] = round(dur_s, 3)
    print(f"  [Grok Voice '{VOICE_ID}'] {seg['id']}: {dur_s:.2f}s", flush=True)

total_speech = sum(durations.values())
print(f"Total trimmed Grok speech: {total_speech:.2f}s", flush=True)
json.dump({"voice": VOICE_ID, "durations": durations, "total_speech_sec": round(total_speech, 3)}, open(os.path.join(AUDIO_DIR, "durations.json"), "w"), indent=2)

print("\n=== STEP 2: Generating 3 Cinematic 16:9 Clips via Google Veo 3.1 (Vertex AI) ===", flush=True)
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials

token = subprocess.check_output(
    ["gcloud", "auth", "print-access-token"], text=True
).strip()
creds = Credentials(token=token)
client = genai.Client(
    vertexai=True,
    project=os.environ.get("GCP_PROJECT_ID", "your-gcp-project-id"),
    location="us-central1",
    credentials=creds,
)

VEO_CLIPS = [
    {
        "id": "veo_01_mars_blackout",
        "prompt": (
            "Cinematic 4K aerospace tracking shot inside a sleek modern NASA Mars transit spacecraft module. "
            "Through a curved cupola viewport window, rusty-red planet Mars glows in deep space starlight. "
            "An astronaut in dark navy flight workout gear performs a controlled resistance squat on a glowing force-plate platform "
            "while a subtle translucent cyan 3D holographic biomechanical skeleton mirrors the motion beside her. "
            "Dramatic moody rim lighting, photorealistic, smooth dolly camera motion, no text."
        ),
    },
    {
        "id": "veo_02_astronaut_kinematics",
        "prompt": (
            "Close-up cinematic aerospace shot inside a spacecraft medical bay: an astronaut glances toward an onboard cabin camera "
            "and raises one hand for a fine-motor dexterity check while wearing a sleek titanium smartwatch emitting a subtle emerald pulse glow. "
            "Delicate translucent cyan biometric facial mesh light lines and golden finger joint nodes shimmer softly across face and hand. "
            "Crisp shallow depth of field, photorealistic NASA mission footage aesthetic, no text."
        ),
    },
    {
        "id": "veo_03_space_to_earth",
        "prompt": (
            "Warm cinematic photorealistic shot inside a remote rural Alaskan mountain health clinic with snow-covered peaks outside the window. "
            "A friendly clinician guides an older patient doing a seated knee-extension movement check in front of a rugged tablet displaying a glowing cyan 3D skeleton wireframe, "
            "while the patient wears a smartwatch. Uplifting natural window light mixed with clean cyan telemetry glow, smooth gimbal motion, no text."
        ),
    },
]

operations = []
for clip in VEO_CLIPS:
    out_mp4 = os.path.join(VEO_DIR, f"{clip['id']}.mp4")
    if os.path.exists(out_mp4) and os.path.getsize(out_mp4) > 50_000:
        print(f"  [Cached] {out_mp4}", flush=True)
        continue
    print(f"  Launching Veo 3.1 job for {clip['id']}...", flush=True)
    op = client.models.generate_videos(
        model="veo-3.1-fast-generate-001",
        prompt=clip["prompt"],
        config=types.GenerateVideosConfig(
            aspect_ratio="16:9",
            duration_seconds=6,
            number_of_videos=1,
            person_generation="allow_adult",
        ),
    )
    operations.append((clip["id"], out_mp4, op))

for clip_id, out_mp4, op in operations:
    t0 = time.time()
    while not op.done:
        time.sleep(6)
        op = client.operations.get(op)
        print(f"  Waiting on {clip_id} ({int(time.time() - t0)}s)...", flush=True)
    if getattr(op, "error", None):
        print(f"  ERROR on {clip_id}: {op.error}", flush=True)
        continue
    res = op.result or op.response
    vids = getattr(res, "generated_videos", None) or []
    if not vids:
        print(f"  WARNING: No generated_videos returned for {clip_id}: {res}", flush=True)
        continue
    vid_obj = vids[0].video
    vid_bytes = getattr(vid_obj, "video_bytes", None)
    if vid_bytes:
        if isinstance(vid_bytes, str):
            vid_bytes = base64.b64decode(vid_bytes)
        with open(out_mp4, "wb") as f:
            f.write(vid_bytes)
        print(f"  SAVED Veo 3.1 clip {out_mp4} ({len(vid_bytes) // 1024} KB)", flush=True)
    elif getattr(vid_obj, "uri", None):
        print(f"  Downloading {clip_id} from GCS URI {vid_obj.uri}...", flush=True)
        subprocess.run(["gsutil", "cp", vid_obj.uri, out_mp4], check=True)
        print(f"  SAVED Veo 3.1 clip {out_mp4}", flush=True)

print("ALL GROK VOICE + VEO 3.1 ASSETS READY.", flush=True)
