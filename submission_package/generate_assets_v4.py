"""
v3.4 demo-video assets:
  1. Grok Voice narration (xAI TTS, S2AI grok_voice_key) for a plainer 5-beat script.
  2. New Veo 3.1 clip(s) on Vertex AI for the "act" beat (wrist cue + storm shelter).

Cached outputs are reused; delete a file to regenerate it.
Run: python3 generate_assets_v4.py [--tts] [--veo]
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
AUDIO_DIR = os.path.join(PKG, "assets", "audio_v4")
VEO_DIR = os.path.join(PKG, "assets", "veo_clips")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Narration: short plain-English beats a judge can follow on one listen.
# "text" is what Grok speaks; "cues" are the burned-in subtitles (split long beats into two cues).
SCRIPT = [
    {
        "id": "n1_problem",
        "text": "On the way to Mars, help from Earth is forty-four minutes away.",
        "cues": ["On the way to Mars, help from Earth is 44 minutes away."],
    },
    {
        "id": "n2_gather",
        "text": "AstroKinetics watches through one cabin camera and a smartwatch: pulse, posture, and tremor, fully offline.",
        "cues": ["AstroKinetics watches through one cabin camera and a smartwatch:", "pulse, posture and tremor — fully offline."],
    },
    {
        "id": "n3_evaluate",
        "text": "It compares each astronaut with their own pre-flight baseline, and tells cabin C O 2, muscle strain, and radiation apart, using real NASA crew data.",
        "cues": ["It compares each astronaut with their own pre-flight baseline,", "and tells cabin CO₂, muscle strain and radiation apart — using real NASA crew data."],
    },
    {
        "id": "n4_act",
        "text": "Then it gives one clear action: a countermeasure, therapy audio, and a cue on the wrist.",
        "cues": ["Then it gives one clear action: a countermeasure, therapy audio and a wrist cue."],
    },
    {
        "id": "n5_earth",
        "text": "From Mars, to rural clinics on Earth.",
        "cues": ["From Mars to rural clinics on Earth."],
    },
]

VOICE_ID = "lumen"


def xai_key():
    if os.environ.get("XAI_API_KEY"):
        return os.environ["XAI_API_KEY"]
    raise SystemExit("XAI_API_KEY environment variable not set")


def run_tts():
    key = xai_key()
    durations = {}
    for seg in SCRIPT:
        mp3 = os.path.join(AUDIO_DIR, f"{seg['id']}.mp3")
        wav = os.path.join(AUDIO_DIR, f"{seg['id']}.wav")
        if not os.path.exists(mp3):
            r = requests.post(
                "https://api.x.ai/v1/tts",
                timeout=90,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "text": seg["text"],
                    "voice_id": VOICE_ID,
                    "language": "en",
                    "speed": 1.06,
                    "text_normalization": True,
                    "replace": {"AstroKinetics": "Astro Kinetics"},
                },
            )
            r.raise_for_status()
            open(mp3, "wb").write(r.content)
        # Trim leading/trailing silence, 48 kHz mono.
        subprocess.run(
            [FF, "-loglevel", "error", "-y", "-i", mp3, "-af",
             "silenceremove=start_periods=1:start_threshold=-52dB,areverse,"
             "silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.08,areverse",
             "-ar", "48000", "-ac", "1", wav],
            check=True,
        )
        with wave.open(wav) as w:
            durations[seg["id"]] = round(w.getnframes() / w.getframerate(), 3)
        print(f"  [grok {VOICE_ID}] {seg['id']}: {durations[seg['id']]:.2f}s", flush=True)
    total = round(sum(durations.values()), 3)
    print(f"Total speech: {total:.2f}s", flush=True)
    json.dump({"voice": VOICE_ID, "durations": durations, "total_speech_sec": total, "script": SCRIPT},
              open(os.path.join(AUDIO_DIR, "durations.json"), "w"), indent=2, ensure_ascii=False)


VEO_CLIPS = [
    {
        "id": "veo_04_wrist_cue_shelter",
        "prompt": (
            "Cinematic photorealistic close-up inside a softly lit spacecraft crew cabin. "
            "An astronaut in a navy flight suit looks down at a smartwatch on their wrist; the watch face shows a glowing green ring that gently pulses. "
            "The astronaut puts on over-ear headphones and leans back into a padded sleeping alcove lined with white storage containers, calm and relaxed. "
            "Slow push-in, shallow depth of field, warm amber and teal light, no text, no logos."
        ),
    },
]


def run_veo():
    from google import genai
    from google.genai import types
    from google.oauth2.credentials import Credentials

    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    project_id = os.environ.get("GCP_PROJECT_ID", "your-gcp-project-id")
    client = genai.Client(vertexai=True, project=project_id, location="us-central1", credentials=Credentials(token=token))
    ops = []
    for clip in VEO_CLIPS:
        out = os.path.join(VEO_DIR, f"{clip['id']}.mp4")
        if os.path.exists(out) and os.path.getsize(out) > 50_000:
            print(f"  [cached] {out}", flush=True)
            continue
        print(f"  launching Veo 3.1 for {clip['id']}", flush=True)
        op = client.models.generate_videos(
            model="veo-3.1-generate-001",
            prompt=clip["prompt"],
            config=types.GenerateVideosConfig(
                aspect_ratio="16:9",
                duration_seconds=6,
                number_of_videos=1,
                person_generation="allow_adult",
                generate_audio=False,
            ),
        )
        ops.append((clip["id"], out, op))
    for cid, out, op in ops:
        t0 = time.time()
        while not op.done:
            time.sleep(8)
            op = client.operations.get(op)
            print(f"  waiting on {cid} ({int(time.time() - t0)}s)", flush=True)
        if getattr(op, "error", None):
            print(f"  ERROR {cid}: {op.error}", flush=True)
            continue
        res = op.result or op.response
        vids = getattr(res, "generated_videos", None) or []
        if not vids:
            print(f"  no video for {cid}: {res}", flush=True)
            continue
        v = vids[0].video
        data = getattr(v, "video_bytes", None)
        if data:
            if isinstance(data, str):
                data = base64.b64decode(data)
            open(out, "wb").write(data)
            print(f"  saved {out} ({len(data) // 1024} KB)", flush=True)
        elif getattr(v, "uri", None):
            subprocess.run(["gsutil", "cp", v.uri, out], check=True)
            print(f"  saved {out} from {v.uri}", flush=True)


if __name__ == "__main__":
    args = set(sys.argv[1:]) or {"--tts", "--veo"}
    if "--tts" in args:
        run_tts()
    if "--veo" in args:
        run_veo()
