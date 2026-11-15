"""
Final 30-second demo video for the AstroKinetics · ASTRA portal (v5.1).

Records the LIVE portal in real motion (no mock-ups), narrates it with xAI Grok Voice through the
portal's own /api/voice/tts endpoint, and assembles a 1920x1080, 30 fps H.264 film that stays
under the NASA Space Apps 30-second cap.

Story: camera-based 3D monitoring -> watch and phone baseline -> one body map with real anatomy and
the gravity fluid shift -> red-flag triage -> cited evidence -> end card.

Run (from submission_package/):
  uv run --no-project --python 3.12 --with playwright --with imageio-ffmpeg python build_final_demo_video.py

Stages can be run separately: `... build_final_demo_video.py tts|capture|assemble` (default: all).
Needs Google Chrome installed (used headless with the GPU for the WebGL scenes). No API key is
read here: narration is synthesised by the deployed service.
"""
import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import imageio_ffmpeg

PKG = Path(__file__).resolve().parent
PORTAL = os.environ.get("AK_PORTAL", "https://astrokinetics-space-health-765428358644.us-central1.run.app")
WORK = Path(os.environ.get("AK_FINAL_TMP", "/tmp/ak_final_video"))
OUT_MP4 = PKG / "AstroKinetics_ASTRA_30s_Final_Demo.mp4"
OUT_SRT = PKG / "AstroKinetics_ASTRA_30s_Final_Demo.srt"
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
ZOOM = 1.25          # the portal is drawn 25% larger so it reads at video size
VOICE = "lumen"
XFADE = 0.3          # crossfade between scenes, seconds
LEAD = 0.25          # narration starts this long after a scene begins
MAX_TOTAL = 29.6     # hard ceiling; the rule is <= 30.0 s

SCENES = [
    {"id": "twin", "text": "Far from Earth, the crew is the clinic. AstroKinetics reads every movement from a camera, in 3D."},
    {"id": "watch", "text": "A watch and a phone learn one astronaut's normal, then move it into orbit."},
    {"id": "body", "text": "Every signal lands on one living body map. Take gravity away, and fluid shifts toward the head."},
    {"id": "triage", "text": "Red flags are checked first."},
    {"id": "evidence", "text": "And every answer shows its evidence."},
    {"id": "end", "text": "AstroKinetics and ASTRA. Crew health that works without Earth."},
]


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def media_duration(path: Path) -> float:
    proc = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", proc.stderr)
    if not m:
        raise RuntimeError(f"no duration for {path}")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


# --------------------------------------------------------------------------- narration
def stage_tts(speed: float = 1.0) -> dict:
    """Synthesise each line with Grok Voice via the portal, trim silence, and time the scenes."""
    WORK.mkdir(parents=True, exist_ok=True)
    plan = {"speed": speed, "scenes": []}
    for sc in SCENES:
        req = urllib.request.Request(
            f"{PORTAL}/api/voice/tts",
            data=json.dumps({"text": sc["text"], "voice_id": VOICE, "lang": "en", "speed": speed}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read())
        if not payload.get("audio_base64"):
            raise RuntimeError(f"Grok Voice returned no audio for '{sc['id']}': {payload.get('tts_note') or payload}")
        raw = WORK / f"n_{sc['id']}.mp3"
        raw.write_bytes(base64.b64decode(payload["audio_base64"]))
        wav = WORK / f"n_{sc['id']}.wav"
        run([FF, "-y", "-i", str(raw), "-af",
             "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,"
             "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse",
             "-ar", "48000", "-ac", "2", str(wav)])
        plan["scenes"].append({"id": sc["id"], "text": sc["text"], "narration": round(media_duration(wav), 3)})

    # A scene lasts as long as its line plus a breath; the end card holds a little longer.
    # The short lines get extra screen time so their pictures can land.
    hold = {"body": 1.0, "triage": 1.3, "evidence": 1.1, "end": 0.5}
    for sc in plan["scenes"]:
        tail = 0.9 if sc["id"] == "end" else 0.35
        sc["duration"] = round(LEAD + sc["narration"] + tail + hold.get(sc["id"], 0.0), 3)
    total = sum(s["duration"] for s in plan["scenes"]) - XFADE * (len(plan["scenes"]) - 1)
    plan["total"] = round(total, 3)
    (WORK / "plan.json").write_text(json.dumps(plan, indent=1))
    print(f"narration at speed {speed}: total {total:.2f}s ->", [(s["id"], s["duration"]) for s in plan["scenes"]])
    return plan


def fit_tts() -> dict:
    """Speed the voice up a little, if needed, until the film fits under the cap."""
    speed = 1.0
    plan = stage_tts(speed)
    while plan["total"] > MAX_TOTAL and speed < 1.3:
        speed = round(min(1.3, speed * plan["total"] / (MAX_TOTAL - 0.15) + 0.01), 2)
        plan = stage_tts(speed)
    if plan["total"] > MAX_TOTAL:
        raise RuntimeError(f"script too long for 30 s even at speed {speed}: {plan['total']:.2f}s")
    return plan


# --------------------------------------------------------------------------- capture
OVERLAY_JS = r"""
() => {
  if (document.getElementById('akFilmLayer')) return;
  const css = document.createElement('style');
  css.textContent = `
    #akFilmLayer { position: fixed; inset: 0; z-index: 99999; pointer-events: none; font-family: Inter, system-ui, sans-serif; }
    #akCaption { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); max-width: 1180px; padding: 12px 26px;
      border-radius: 14px; background: rgba(5, 9, 18, 0.86); border: 1px solid rgba(56, 189, 248, 0.45);
      box-shadow: 0 14px 40px rgba(0,0,0,.55), 0 0 30px rgba(56,189,248,.18); color: #f1f5f9; font-weight: 600;
      font-size: 27px; line-height: 1.3; letter-spacing: -0.01em; text-align: center; text-wrap: balance; opacity: 0; transition: opacity .3s ease; }
    #akCaption.on { opacity: 1; }
    #akCursor { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%;
      border: 2.5px solid #fff; background: rgba(56,189,248,.35); box-shadow: 0 0 18px rgba(56,189,248,.9);
      transition: transform .55s cubic-bezier(.3,.8,.3,1), opacity .25s ease; opacity: 0; }
    #akCursor.tap { animation: akTap .45s ease-out; }
    @keyframes akTap { 0% { box-shadow: 0 0 0 0 rgba(56,189,248,.9); } 100% { box-shadow: 0 0 0 34px rgba(56,189,248,0); } }
    #akEnd { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 45%, rgba(5,9,18,.72), rgba(5,9,18,.96) 70%); opacity: 0; transition: opacity .6s ease; }
    #akEnd.on { opacity: 1; }
    #akEnd .box { text-align: center; color: #f1f5f9; }
    #akEnd h1 { margin: 0; font-size: 92px; font-weight: 800; letter-spacing: -0.035em; }
    #akEnd h1 span { color: #38bdf8; }
    #akEnd p { margin: 14px 0 0; font-size: 31px; font-weight: 500; color: #cbd5e1; }
    #akEnd .url { margin-top: 38px; display: inline-block; padding: 14px 30px; border-radius: 999px; border: 1.5px solid rgba(56,189,248,.6);
      background: rgba(56,189,248,.12); font: 600 25px 'JetBrains Mono', ui-monospace, monospace; color: #e0f2fe; }
    #akEnd .team { margin-top: 26px; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: #94a3b8; }
    .astra-grok-launcher { display: none !important; }
  `;
  document.head.appendChild(css);
  const layer = document.createElement('div');
  layer.id = 'akFilmLayer';
  layer.innerHTML = `<div id="akEnd"><div class="box"><h1>AstroKinetics <span>&middot;</span> ASTRA</h1>
      <p>Autonomous crew health for missions beyond Earth</p>
      <div class="url">astrokinetics-space-health-765428358644.us-central1.run.app</div>
      <div class="team">Team AI-MED 01 &middot; Houston &middot; NASA Space Apps 2026</div></div></div>
    <div id="akCursor"></div><div id="akCaption"></div>`;
  document.body.appendChild(layer);
  window.akCaption = (text) => { const c = document.getElementById('akCaption'); c.textContent = text || ''; c.classList.toggle('on', Boolean(text)); };
  window.akPoint = (sel, frameSel) => {
    const doc = frameSel ? document.querySelector(frameSel).contentDocument : document;
    const el = doc.querySelector(sel); if (!el) return false;
    const r = el.getBoundingClientRect(); let x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (frameSel) { const f = document.querySelector(frameSel).getBoundingClientRect(); x += f.left; y += f.top; }
    const z = Number(document.documentElement.style.zoom) || 1;
    const c = document.getElementById('akCursor'); c.style.opacity = '1'; c.style.transform = `translate(${x * z}px, ${y * z}px)`; return true;
  };
  window.akTap = (sel, frameSel) => {
    const doc = frameSel ? document.querySelector(frameSel).contentDocument : document;
    const el = doc.querySelector(sel); if (!el) return false;
    const c = document.getElementById('akCursor'); c.classList.remove('tap'); void c.offsetWidth; c.classList.add('tap'); el.click(); return true;
  };
  window.akHideCursor = () => { document.getElementById('akCursor').style.opacity = '0'; };
  window.akEnd = (on) => document.getElementById('akEnd').classList.toggle('on', on);
  window.akScrollTo = (sel, offset = 96) => { const el = document.querySelector(sel); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' }); };
}
"""


async def stage_capture(plan: dict) -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-color-profile=srgb"],
        )
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, color_scheme="dark")
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        sink = {"dir": None, "frames": []}

        async def on_frame(ev):
            if sink["dir"] is not None:
                idx = len(sink["frames"])
                (sink["dir"] / f"f{idx:05d}.jpg").write_bytes(base64.b64decode(ev["data"]))
                sink["frames"].append(ev["metadata"]["timestamp"])
            await cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})

        cdp.on("Page.screencastFrame", lambda ev: asyncio.ensure_future(on_frame(ev)))

        async def prep(url: str):
            await page.goto(url, wait_until="networkidle")
            await page.evaluate(f"document.documentElement.style.zoom = '{ZOOM}'")
            await page.evaluate(OVERLAY_JS)
            await page.wait_for_timeout(1200)

        async def record(scene: dict, actions):
            """Record one scene for its planned duration while `actions` plays out."""
            d = WORK / f"s_{scene['id']}"
            if d.exists():
                for f in d.glob("*"):
                    f.unlink()
            d.mkdir(parents=True, exist_ok=True)
            sink["dir"], sink["frames"] = d, []
            await page.evaluate("t => window.akCaption(t)", scene["text"])
            await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 93, "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
            loop = asyncio.get_event_loop()
            t0 = loop.time()
            await actions(lambda at: asyncio.sleep(max(0, at - (loop.time() - t0))))
            await asyncio.sleep(max(0, scene["duration"] + XFADE + 0.25 - (loop.time() - t0)))
            await cdp.send("Page.stopScreencast")
            await asyncio.sleep(0.2)
            stamps = sink["frames"]
            sink["dir"] = None
            (d / "stamps.json").write_text(json.dumps(stamps))
            span = stamps[-1] - stamps[0] if len(stamps) > 1 else 0
            print(f"  {scene['id']:9s} {len(stamps):4d} frames over {span:5.2f}s ({len(stamps) / max(span, 0.01):4.1f} fps)")

        by_id = {s["id"]: s for s in plan["scenes"]}

        # 1. Live 3D Twin: camera-based biomechanics
        await prep(f"{PORTAL}/")
        await page.wait_for_timeout(2500)

        async def twin(at):
            await at(0.9)
            await page.evaluate("window.akPoint('#camOrbitBtn')")
            await at(1.6)
            await page.evaluate("window.akTap('#camOrbitBtn')")
            await at(2.6)
            await page.evaluate("window.akHideCursor()")
        await record(by_id["twin"], twin)

        # 2. Watch + iPhone: baseline, then orbit mode (played forward off camera to the orbit step)
        await prep(f"{PORTAL}/?tab=demo")
        frame = page.frame_locator("#companionFrame")
        await frame.locator("#cAuto").evaluate("el => el.click()")  # a real click misses under page zoom
        for _ in range(60):
            title = await frame.locator("#cT").text_content()
            if title and "orbit" in title.lower():
                break
            await page.wait_for_timeout(500)
        await page.evaluate("window.akScrollTo('.companion-card', 150)")

        async def watch(at):
            await at(0.3)
        await record(by_id["watch"], watch)

        # 3. Crew Body Map: real anatomy, then gravity off
        await prep(f"{PORTAL}/?tab=triage")
        await page.wait_for_function("document.querySelector('.bm-stage')?.classList.contains('is-3d')", timeout=60000)
        await page.wait_for_function("document.getElementById('body3dStatus').hidden", timeout=90000)
        await page.evaluate("window.akScrollTo('.bm-card', 150)")
        await page.wait_for_timeout(800)

        async def body(at):
            d = by_id["body"]["duration"]
            await at(0.8)
            await page.evaluate("window.akPoint('#bodyGravSeg [data-grav=\"earth\"]')")
            await at(1.5)
            await page.evaluate("window.akTap('#bodyGravSeg [data-grav=\"earth\"]')")
            await at(d * 0.48)
            await page.evaluate("window.akPoint('#bodyGravSeg [data-grav=\"orbit\"]')")
            await at(d * 0.48 + 0.6)
            await page.evaluate("window.akTap('#bodyGravSeg [data-grav=\"orbit\"]')")
            await at(d * 0.48 + 1.5)
            await page.evaluate("window.akHideCursor()")
        await record(by_id["body"], body)

        # 4. Triage: an emergency pattern trips the red-flag gate
        await page.evaluate("document.querySelector('#bodyGravSeg .is-active')?.click()")
        await page.evaluate("window.akScrollTo('#hunchSymptomGrid', 190)")
        await page.wait_for_timeout(600)

        async def triage(at):
            await at(0.15)
            await page.evaluate("window.akPoint('[data-vignette=\"mi_emergency\"]')")
            await at(0.7)
            await page.evaluate("window.akTap('[data-vignette=\"mi_emergency\"]')")
            await at(1.1)
            await page.evaluate("window.akHideCursor(); window.akScrollTo('#hunchOutcomeCard', 330)")
        await record(by_id["triage"], triage)

        # 5. Evidence: a question lights up its sources
        await prep(f"{PORTAL}/?tab=evidence")
        await page.evaluate("window.akScrollTo('.ax-evidence-stage', 330)")
        await page.wait_for_timeout(2500)

        async def evidence(at):
            await at(0.15)
            await page.evaluate("window.akPoint('.aura-chip-btn[data-q*=\"Barger\"]')")
            await at(0.65)
            await page.evaluate("window.akTap('.aura-chip-btn[data-q*=\"Barger\"]')")
            await at(1.3)
            await page.evaluate("window.akHideCursor()")
        await record(by_id["evidence"], evidence)

        # 6. End card over the living body map
        await prep(f"{PORTAL}/?tab=triage")
        await page.wait_for_function("document.querySelector('.bm-stage')?.classList.contains('is-3d')", timeout=60000)
        await page.evaluate("window.akScrollTo('.bm-card', 150)")
        await page.wait_for_timeout(1500)

        async def end(at):
            await at(0.1)
            await page.evaluate("window.akEnd(true)")
        await record(by_id["end"], end)

        await browser.close()


# --------------------------------------------------------------------------- assembly
def stage_assemble(plan: dict) -> None:
    scenes = plan["scenes"]
    clips = []
    for sc in scenes:
        d = WORK / f"s_{sc['id']}"
        stamps = json.loads((d / "stamps.json").read_text())
        if len(stamps) < 5:
            raise RuntimeError(f"scene {sc['id']} captured only {len(stamps)} frames")
        # frames arrive at uneven intervals: hand ffmpeg each frame's real duration, then resample to 30 fps
        lines = ["ffconcat version 1.0"]
        for i, ts in enumerate(stamps):
            nxt = stamps[i + 1] if i + 1 < len(stamps) else ts + 1 / FPS
            lines += [f"file 'f{i:05d}.jpg'", f"duration {max(0.001, nxt - ts):.4f}"]
        lines.append(f"file 'f{len(stamps) - 1:05d}.jpg'")
        (d / "list.txt").write_text("\n".join(lines))
        clip = WORK / f"c_{sc['id']}.mp4"
        length = sc["duration"]  # includes the crossfade it shares with the next scene
        run([FF, "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-t", f"{length:.3f}",
             # screencast JPEGs are full-range BT.601; convert to broadcast-range BT.709 for players and YouTube
             "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos:in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=limited,"
                    "format=yuv420p,tpad=stop_mode=clone:stop_duration=1",
             "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-c:v", "libx264", "-preset", "medium", "-crf", "14", str(clip)], cwd=d)
        clips.append((clip, length))

    # crossfade chain
    inputs, filters = [], []
    offset = 0.0
    last = "0:v"
    for i, (clip, _) in enumerate(clips):
        inputs += ["-i", str(clip)]
    for i in range(1, len(clips)):
        offset += scenes[i - 1]["duration"] - XFADE
        out = f"v{i}"
        filters.append(f"[{last}][{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}[{out}]")
        last = out
    total = round(sum(s["duration"] for s in scenes) - XFADE * (len(scenes) - 1), 3)

    # narration: each line starts LEAD seconds into its scene
    starts, t = [], 0.0
    for sc in scenes:
        starts.append(t)
        t += sc["duration"] - XFADE
    n_in = len(clips)
    amix = []
    for i, sc in enumerate(scenes):
        inputs += ["-i", str(WORK / f"n_{sc['id']}.wav")]
        ms = int(round((starts[i] + LEAD) * 1000))
        filters.append(f"[{n_in + i}:a]adelay={ms}|{ms},volume=1.7[a{i}]")
        amix.append(f"[a{i}]")
    # a quiet warm pad underneath
    pad = ("aevalsrc='0.030*sin(2*PI*110*t)+0.024*sin(2*PI*164.81*t)+0.018*sin(2*PI*220*t)+0.012*sin(2*PI*329.63*t)':"
           f"s=48000:d={total:.3f},aformat=channel_layouts=stereo,tremolo=f=0.18:d=0.35,lowpass=f=900,"
           f"afade=t=in:d=1.2,afade=t=out:st={total - 1.6:.3f}:d=1.6[pad]")
    filters.append(pad)
    filters.append(f"{''.join(amix)}[pad]amix=inputs={len(scenes) + 1}:normalize=0,alimiter=limit=0.95,"
                   f"afade=t=out:st={total - 0.5:.3f}:d=0.5[aout]")
    filters.append(f"[{last}]fade=t=in:d=0.35,fade=t=out:st={total - 0.45:.3f}:d=0.45[vout]")

    tmp_out = WORK / "final.mp4"
    run([FF, "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.3f}",
         "-r", str(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
         "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(tmp_out)])
    dur = media_duration(tmp_out)
    if dur > 30.0:
        raise RuntimeError(f"film is {dur:.2f}s, over the 30 s cap")
    OUT_MP4.write_bytes(tmp_out.read_bytes())

    def ts(sec: float) -> str:
        ms = int(round(sec * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    srt = []
    for i, sc in enumerate(scenes):
        a = starts[i] + LEAD
        srt.append(f"{i + 1}\n{ts(a)} --> {ts(min(total, a + sc['narration'] + 0.15))}\n{sc['text']}\n")
    OUT_SRT.write_text("\n".join(srt))
    print(f"wrote {OUT_MP4.name}: {dur:.2f}s, {OUT_MP4.stat().st_size / 1e6:.1f} MB; {OUT_SRT.name}")


if __name__ == "__main__":
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    WORK.mkdir(parents=True, exist_ok=True)
    plan_path = WORK / "plan.json"
    plan = fit_tts() if stage in ("all", "tts") else json.loads(plan_path.read_text())
    if stage in ("all", "capture"):
        asyncio.run(stage_capture(plan))
    if stage in ("all", "assemble"):
        stage_assemble(plan)
