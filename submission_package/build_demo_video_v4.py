"""
AstroKinetics v3.4 demo video (<= 30.0 s, 1920x1080, 30 fps, stereo AAC, burned-in English captions).

What changed vs build_30s_demo_video.py (v3.3):
  - UI shots are crops of the panel that matters (3D twin, triage, directive), shown large with a slow
    push-in, instead of full-page screenshots shrunk into a frame.
  - The four scenarios play as one "same model, four answers" cascade with a plain-language side rail.
  - New 5-beat Grok Voice narration in plain English; new Veo 3.1 clip for the action beat.
  - Stereo mix: synthesized pad that ducks under the voice, soft ticks on score changes, loudness-normalized.

Inputs:  assets/audio_v4/*.wav + durations.json (generate_assets_v4.py --tts)
         assets/veo_clips/*.mp4, assets/crops/*.png, assets/images/*.jpg
Outputs: AstroKinetics_30s_SpaceApps_Demo.mp4 / .srt
Run:     python3 build_demo_video_v4.py
"""
import glob
import json
import os
import shutil
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"
PKG = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(PKG, "assets", "audio_v4")
VEO = os.path.join(PKG, "assets", "veo_clips")
CROP = os.path.join(PKG, "assets", "crops")
IMG = os.path.join(PKG, "assets", "images")
TMP = os.environ.get("AK_TMP", "/tmp/ak_video_v4")
os.makedirs(TMP, exist_ok=True)
OUT_MP4 = os.path.join(PKG, "AstroKinetics_30s_SpaceApps_Demo.mp4")
OUT_SRT = os.path.join(PKG, "AstroKinetics_30s_SpaceApps_Demo.srt")
LIVE_URL = "astrokinetics-space-health-765428358644.us-central1.run.app"

W, H, FPS, SR = 1920, 1080, 30, 48000
MAX_SEC = 29.6  # hard cap is 30.0 s; keep margin for players that round up

# ---------- palette & fonts ----------
NAVY = (7, 13, 26)
WHITE = (248, 250, 252)
MUTED = (159, 176, 200)
CYAN = (56, 189, 248)
EMERALD = (52, 211, 153)
AMBER = (251, 191, 36)
CORAL = (251, 113, 133)
VIOLET = (167, 139, 250)


def font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


SUP = "/System/Library/Fonts/Supplemental"
F_HEAD = lambda s: font(f"{SUP}/Trebuchet MS Bold.ttf", s)
F_BODY = lambda s: font(f"{SUP}/Arial.ttf", s)
F_BOLD = lambda s: font(f"{SUP}/Arial Bold.ttf", s)
F_MONO = lambda s: font("/System/Library/Fonts/Menlo.ttc", s, index=1)  # Menlo Bold

# ---------- narration timeline ----------
meta = json.load(open(os.path.join(AUD, "durations.json")))
DUR = meta["durations"]
SCRIPT = meta["script"]
LEAD, GAP = 0.35, 0.28
beats = []  # (id, speech_start, speech_end)
t = LEAD
for seg in SCRIPT:
    d = DUR[seg["id"]]
    beats.append((seg["id"], t, t + d))
    t += d + GAP
speech_end = beats[-1][2]
END_HOLD = 1.75
TOTAL = min(MAX_SEC, speech_end + END_HOLD)
NF = int(round(TOTAL * FPS))
B = {b[0]: (b[1], b[2]) for b in beats}
print(f"speech ends {speech_end:.2f}s, total {TOTAL:.2f}s ({NF} frames)", flush=True)


def beat_edges(i):
    """Visual span of beat i: from just before its speech to just before the next beat's speech."""
    s = 0.0 if i == 0 else beats[i][1] - 0.12
    e = TOTAL if i == len(beats) - 1 else beats[i + 1][1] - 0.12
    return s, e


# ---------- helpers ----------
def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fit_cover(im, w, h):
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((int(sw * s + 0.5), int(sh * s + 0.5)), Image.Resampling.LANCZOS)
    x0, y0 = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x0, y0, x0 + w, y0 + h))


def push_in(im, k, cx=0.5, cy=0.5):
    """Zoom an image by factor (1+k) about (cx, cy) and return it at its original size."""
    if k <= 0.0005:
        return im
    w, h = im.size
    cw, ch = w / (1 + k), h / (1 + k)
    x0 = min(max(0, cx * w - cw / 2), w - cw)
    y0 = min(max(0, cy * h - ch / 2), h - ch)
    return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((w, h), Image.Resampling.BICUBIC)


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


def text_w(dr, s, f):
    return dr.textlength(s, font=f)


def pill(dr, xy, text, f, fg, bg=(17, 29, 52, 230), outline=None, pad=(18, 10)):
    x, y = xy
    tw = text_w(dr, text, f)
    bb = dr.textbbox((0, 0), text, font=f)
    th = bb[3] - bb[1]
    box = (x, y, x + tw + pad[0] * 2, y + th + pad[1] * 2)
    dr.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=bg, outline=outline, width=2 if outline else 0)
    dr.text((x + pad[0], y + pad[1] - bb[1]), text, font=f, fill=fg)
    return box


# ---------- static backdrops ----------
def starfield():
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.zeros((H, W, 3), np.float32)
    base = np.array(NAVY, np.float32)
    glow = np.array([18, 40, 78], np.float32)
    r = np.sqrt(((xx - W * 0.72) / W) ** 2 + ((yy - H * 0.2) / H) ** 2)
    g[:] = base + glow * np.clip(1.0 - r * 1.6, 0, 1)[..., None]
    for _ in range(420):
        x, y = rng.integers(0, W), rng.integers(0, H)
        b = rng.uniform(60, 200)
        g[y, x] = np.minimum(255, g[y, x] + b)
    return Image.fromarray(g.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))


BACKDROP = starfield()

# ---------- Veo clips ----------
def decode(name):
    d = os.path.join(TMP, name)
    os.makedirs(d, exist_ok=True)
    frames = sorted(glob.glob(os.path.join(d, "f_*.jpg")))
    if len(frames) < 60:
        subprocess.run([FF, "-loglevel", "error", "-y", "-i", os.path.join(VEO, f"{name}.mp4"),
                        "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}",
                        "-q:v", "2", os.path.join(d, "f_%04d.jpg")], check=True)
        frames = sorted(glob.glob(os.path.join(d, "f_*.jpg")))
    return frames


VEO1 = decode("veo_01_mars_blackout")
VEO2 = decode("veo_02_astronaut_kinematics")
VEO3 = decode("veo_03_space_to_earth")
HAS_VEO4 = os.path.exists(os.path.join(VEO, "veo_04_wrist_cue_shelter.mp4"))
VEO4 = decode("veo_04_wrist_cue_shelter") if HAS_VEO4 else None
print("veo4:", HAS_VEO4, flush=True)


def veo_frame(frames, lt, offset=0.0, zoom=0.0):
    i = min(len(frames) - 1, max(0, int((lt + offset) * FPS)))
    im = Image.open(frames[i]).convert("RGB")
    return push_in(im, zoom) if zoom else im


# ---------- UI panels ----------
def load(p):
    return Image.open(os.path.join(CROP, p)).convert("RGB")


TWIN = load("twin_scen3.png")
TRIAGE = {k: load(f"triage_{k}.png") for k in ("scen1_nominal", "scen2_co2", "scen3_squat", "scen4_spe")}
DIRECTIVE = load("directive_scen4_spe.png")
FFT = load("fft_tab2.png")


def panel_on_backdrop(panel, box, k=0.0, cx=0.5, cy=0.5, radius=22, bg=None):
    """Composite a UI crop (with push-in k) into box=(x, y, w) on the starfield, with shadow + rounded corners."""
    x, y, w = box
    h = int(w * panel.height / panel.width)
    im = (bg or BACKDROP).copy()
    p = push_in(panel.resize((w, h), Image.Resampling.LANCZOS), k, cx, cy)
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((x + 6, y + 14, x + w + 6, y + h + 14), radius, fill=160)
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    im.paste((0, 0, 0), (0, 0), sh)
    ImageDraw.Draw(im).rounded_rectangle((x - 3, y - 3, x + w + 3, y + h + 3), radius + 3, fill=(38, 64, 106))
    im.paste(p, (x, y), rounded_mask((w, h), radius))
    return im, (x, y, w, h)


def faded(im, a, draw_fn):
    """Draw draw_fn(ImageDraw) on a transparent layer and composite it at opacity a (0..1).
    Pillow ignores text alpha when drawing straight onto an RGB frame, so fades go through a layer."""
    if a <= 0:
        return im
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(ov))
    if a < 1:
        ov.putalpha(ov.getchannel("A").point(lambda v: int(v * a)))
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")


# ---------- beat renderers (each returns an RGB frame for local time lt in [0, dur)) ----------
def r_problem(lt, dur):
    im = veo_frame(VEO1, lt, zoom=0.02 + 0.04 * lt / dur)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    # left vignette so the headline reads over the shot
    grad = np.linspace(170, 0, 900).astype(np.uint8)
    vg = Image.fromarray(np.tile(grad, (H, 1)), "L")
    ov.paste((5, 9, 18, 255), (0, 0), vg)
    a = int(255 * ease((lt - 0.45) / 0.5))
    if a > 0:
        fh = F_HEAD(168)
        dr.text((96, 560), "44 min", font=fh, fill=CORAL + (a,))
        dr.text((104, 760), "from help, on the way to Mars", font=F_HEAD(46), fill=WHITE + (a,))
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")


def r_gather(lt, dur):
    split = 2.5
    if lt < split:
        return veo_frame(VEO2, lt, offset=0.6, zoom=0.03 + 0.03 * lt / split)
    u = lt - split
    im, (x, y, w, h) = panel_on_backdrop(TWIN, (80, 118, 1250), k=0.02 + 0.05 * u / (dur - split), cx=0.42, cy=0.5)
    dr = ImageDraw.Draw(im, "RGBA")
    rx = 1460
    dr.text((rx, 150), "GATHER", font=F_MONO(26), fill=EMERALD)
    dr.text((rx, 192), "One camera +", font=F_HEAD(50), fill=WHITE)
    dr.text((rx, 252), "one watch", font=F_HEAD(50), fill=WHITE)
    chips = [("Pulse · contactless rPPG", CYAN), ("3D posture vs 1g ghost", EMERALD), ("Hand tremor 4–12 Hz", AMBER), ("Watch + habitat API", CORAL)]
    for i, (txt, col) in enumerate(chips):
        a = ease((u - 0.35 - i * 0.55) / 0.35)
        yy = 360 + i * 92 + int((1 - a) * 18)
        im = faded(im, a, lambda d, yy=yy, txt=txt, col=col: pill(d, (rx, yy), txt, F_BOLD(28), WHITE, bg=(17, 29, 52, 235), outline=col))

    def on_device(d):
        d.text((rx, 760), "100% on-device", font=F_HEAD(40), fill=EMERALD)
        d.text((rx, 812), "raw video never leaves", font=F_BODY(28), fill=MUTED)
        d.text((rx, 848), "the cabin", font=F_BODY(28), fill=MUTED)

    return faded(im, ease((u - 2.6) / 0.4), on_device)


CASCADE = [
    ("scen1_nominal", "99.2", EMERALD, "SOL 014 · LUNAR ORBIT", "Inside own baseline", "Keep scheduled exercise"),
    ("scen2_co2", "78.3", AMBER, "SOL 088 · CABIN CO2", "Reaction time + CO2 move together", "Purge the CO2 scrubber"),
    ("scen3_squat", "44.7", CORAL, "SOL 142 · SQUAT DRIFT", "Left/right asymmetry + lean", "Cut one-sided load 15%"),
    ("scen4_spe", "12.0", CORAL, "SOL 210 · SOLAR STORM", "Radiation dose drives drift", "Go to storm shelter"),
]
CASCADE_W = [0.28, 0.24, 0.24, 0.24]


def r_evaluate(lt, dur):
    # which scenario, and how far into it
    acc, idx, u, span = 0.0, 0, 0.0, dur
    for i, wt in enumerate(CASCADE_W):
        span = wt * dur
        if lt < acc + span or i == len(CASCADE_W) - 1:
            idx, u = i, lt - acc
            break
        acc += span
    im = scenario_frame(idx, k=0.015 + 0.03 * u / span)
    # cross-dissolve the whole frame (panel + rail) from the previous scenario
    XF = 0.3
    if idx > 0 and u < XF:
        im = Image.blend(scenario_frame(idx - 1, k=0.045), im, ease(u / XF))
    return im


def scenario_frame(idx, k):
    key, score, col, head, why, act = CASCADE[idx]
    im, _ = panel_on_backdrop(TRIAGE[key], (80, 140, 1300), k=k, cx=0.5, cy=0.4)
    dr = ImageDraw.Draw(im, "RGBA")
    rx = 1440
    dr.text((rx, 150), "EVALUATE OFFLINE", font=F_MONO(26), fill=CYAN)
    dr.text((rx, 190), "Same model,", font=F_HEAD(46), fill=WHITE)
    dr.text((rx, 246), "four answers", font=F_HEAD(46), fill=WHITE)
    dr.text((rx, 330), "Readiness", font=F_BODY(28), fill=MUTED)
    dr.text((rx - 4, 362), score, font=F_HEAD(150), fill=col)
    dr.text((rx, 545), head, font=F_MONO(26), fill=WHITE)
    dr.text((rx, 594), "Why", font=F_BOLD(24), fill=MUTED)
    for j, line in enumerate(wrap(dr, why, F_BODY(30), 440)):
        dr.text((rx, 626 + j * 38), line, font=F_BODY(30), fill=WHITE)
    dr.text((rx, 716), "Do", font=F_BOLD(24), fill=MUTED)
    for j, line in enumerate(wrap(dr, act, F_BOLD(30), 440)):
        dr.text((rx, 748 + j * 38), line, font=F_BOLD(30), fill=col)
    for i in range(4):  # scenario progress dots
        cxp = rx + i * 34
        dr.ellipse((cxp, 826, cxp + 18, 844), fill=(CASCADE[i][2] if i <= idx else (52, 66, 94)))
    pill(dr, (rx, 862), "Real NASA data: OSD-571", F_BOLD(24), WHITE, bg=(17, 29, 52, 235), outline=VIOLET)
    return im


def wrap(dr, text, f, max_w):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        cand = f"{cur} {wd}".strip()
        if dr.textlength(cand, font=f) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = wd
    return lines + ([cur] if cur else [])


def r_act(lt, dur):
    split = 2.1 if HAS_VEO4 else dur
    if lt >= split:
        u = lt - split
        return veo_frame(VEO4, u, offset=0.3, zoom=0.02 + 0.03 * u / max(0.1, dur - split))
    im, (x, y, w, h) = panel_on_backdrop(DIRECTIVE, (130, 360, 1660), k=0.01 + 0.02 * lt / split, radius=18)
    dr = ImageDraw.Draw(im, "RGBA")
    dr.text((130, 170), "ACT NOW", font=F_MONO(26), fill=AMBER)
    dr.text((130, 210), "One clear action — not another alarm", font=F_HEAD(58), fill=WHITE)
    chips = [("Neuro-acoustic Rx: 2.5 Hz + pink noise", CYAN), ("Wrist haptic cue", CORAL), ("<2 KB packet to Earth", EMERALD)]
    xx = 130
    for i, (txt, col) in enumerate(chips):
        a = ease((lt - 0.4 - i * 0.35) / 0.3)
        im = faded(im, a, lambda d, xx=xx, txt=txt, col=col: pill(d, (xx, 690), txt, F_BOLD(28), WHITE, bg=(17, 29, 52, 235), outline=col))
        xx += int(text_w(dr, txt, F_BOLD(28))) + 36 + 22
    return im


END_HERO = fit_cover(Image.open(os.path.join(IMG, "hero_mars_blackout_astronaut.jpg")).convert("RGB"), W, H).filter(ImageFilter.GaussianBlur(14))
END_HERO = Image.blend(END_HERO, Image.new("RGB", (W, H), NAVY), 0.72)


def r_end():
    im, _ = panel_on_backdrop(TRIAGE["scen3_squat"], (1060, 300, 760), radius=16, bg=END_HERO)
    dr = ImageDraw.Draw(im, "RGBA")
    dr.text((120, 250), "2026 NASA SPACE APPS · HOUSTON", font=F_MONO(26), fill=CYAN)
    dr.text((112, 300), "AstroKinetics", font=F_HEAD(118), fill=WHITE)
    dr.text((120, 450), "Offline health co-pilot", font=F_HEAD(48), fill=CYAN)
    dr.text((120, 510), "for deep-space crews", font=F_HEAD(48), fill=CYAN)
    xx = 120
    for txt, col in (("NASA OSDR OSD-571", VIOLET), ("100% on-device", EMERALD), ("Open source", AMBER)):
        box = pill(dr, (xx, 610), txt, F_BOLD(26), WHITE, outline=col)
        xx = box[2] + 18
    dr.text((120, 728), "Try it live — no install:", font=F_BODY(30), fill=MUTED)
    dr.text((120, 770), LIVE_URL, font=F_MONO(30), fill=WHITE)
    return im


def r_earth(lt, dur, end_frame):
    end_at = dur - (TOTAL - speech_end) + 0.15  # end card fades in just after the last word
    v = veo_frame(VEO3, lt, offset=0.4, zoom=0.02 + 0.03 * lt / dur)
    if lt < end_at:
        return v
    return Image.blend(v, end_frame, ease((lt - end_at) / 0.35))


# ---------- captions ----------
cues = []  # (start, end, text)
for seg in SCRIPT:
    s, e = B[seg["id"]]
    parts = seg["cues"]
    total_chars = sum(len(p) for p in parts)
    cs = s
    for j, p in enumerate(parts):
        ce = cs + (e - s) * len(p) / total_chars
        cues.append((cs, ce + (0.18 if j == len(parts) - 1 else 0.0), p))
        cs = ce


def caption_at(t):
    for s, e, txt in cues:
        if s - 0.05 <= t < e:
            return txt
    return None


def fmt(ts):
    ms = int(round(ts * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


with open(OUT_SRT, "w") as f:
    for i, (s, e, txt) in enumerate(cues, 1):
        f.write(f"{i}\n{fmt(s)} --> {fmt(min(e, TOTAL))}\n{txt}\n\n")

F_CAP = F_BOLD(36)
BEAT_LABELS = ["01 · PROBLEM", "02 · GATHER", "03 · EVALUATE OFFLINE", "04 · ACT", "05 · SPACE → EARTH"]
BEAT_COLORS = [CORAL, EMERALD, CYAN, AMBER, EMERALD]


def chrome(im, t, beat_i):
    dr = ImageDraw.Draw(im, "RGBA")
    # top HUD
    dr.rectangle((0, 0, W, 64), fill=(5, 9, 18, 150))
    col = BEAT_COLORS[beat_i]
    dr.ellipse((40, 24, 56, 40), fill=col)
    dr.text((70, 18), BEAT_LABELS[beat_i], font=F_MONO(24), fill=WHITE)
    lbl = "ASTROKINETICS · NASA SPACE APPS 2026"
    dr.text((W - 40 - text_w(dr, lbl, F_MONO(22)), 20), lbl, font=F_MONO(22), fill=MUTED)
    # progress
    dr.rectangle((0, H - 6, W, H), fill=(20, 32, 56, 255))
    dr.rectangle((0, H - 6, int(W * t / TOTAL), H), fill=col + (255,))
    # caption
    cap = caption_at(t)
    if cap:
        cap = cap.replace("₂", "2")  # Arial Bold has no subscript-two glyph; the .srt keeps CO₂
        lines = wrap(dr, cap, F_CAP, 1500)
        lh = 46
        bh = len(lines) * lh + 30
        y0 = H - 70 - bh
        widest = max(text_w(dr, l, F_CAP) for l in lines)
        dr.rounded_rectangle(((W - widest) / 2 - 28, y0, (W + widest) / 2 + 28, y0 + bh), 16, fill=(5, 9, 18, 205))
        for j, l in enumerate(lines):
            dr.text(((W - text_w(dr, l, F_CAP)) / 2, y0 + 13 + j * lh), l, font=F_CAP, fill=WHITE)
    return im


# ---------- render ----------
END_FRAME = r_end()
RENDER = [r_problem, r_gather, r_evaluate, r_act, None]
XFADE = 0.3

def beat_frame(i, t):
    s, e = beat_edges(i)
    lt, dur = t - s, e - s
    if i == 4:
        return r_earth(lt, dur, END_FRAME)
    return RENDER[i](lt, dur)


def frame_at(t):
    bi = max(i for i in range(len(beats)) if beat_edges(i)[0] <= t)
    frame = beat_frame(bi, t)
    s = beat_edges(bi)[0]
    if bi > 0 and t - s < XFADE:  # cross-fade from the previous beat
        prev = beat_frame(bi - 1, t)
        frame = Image.blend(prev, frame, ease((t - s) / XFADE))
    return chrome(frame, t, bi)


# AK_PREVIEW="1.5,6,12" writes those frames as PNGs into AK_PREVIEW_DIR and stops (no encode).
if os.environ.get("AK_PREVIEW"):
    out_dir = os.environ.get("AK_PREVIEW_DIR", TMP)
    for ts in os.environ["AK_PREVIEW"].split(","):
        frame_at(float(ts)).save(os.path.join(out_dir, f"pv_{float(ts):05.2f}.png"))
    print("beats:", [(b[0], round(b[1], 2), round(b[2], 2)) for b in beats])
    raise SystemExit(0)

enc = subprocess.Popen(
    [FF, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
     os.path.join(TMP, "video_only.mp4")],
    stdin=subprocess.PIPE,
)


for fi in range(NF):
    enc.stdin.write(frame_at(fi / FPS).tobytes())
    if fi % 90 == 0:
        print(f"  frame {fi}/{NF}", flush=True)
enc.stdin.close()
enc.wait()

# ---------- audio ----------
n = int(TOTAL * SR)
voice = np.zeros(n, np.float32)
for seg in SCRIPT:
    with wave.open(os.path.join(AUD, f"{seg['id']}.wav")) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
    st = int(B[seg["id"]][0] * SR)
    voice[st:st + len(a)] += a[: max(0, n - st)]
peak = np.abs(voice).max() or 1.0
voice *= 0.89 / peak

tt = np.arange(n) / SR
# pad: slow A-minor(add9) drone, detuned L/R for width, gentle swell
chord = [110.0, 164.81, 220.0, 261.63, 329.63, 493.88]
padL = sum(np.sin(2 * np.pi * f * tt + i) * (0.5 / (1 + i * 0.6)) for i, f in enumerate(chord))
padR = sum(np.sin(2 * np.pi * f * 1.003 * tt + i * 1.7) * (0.5 / (1 + i * 0.6)) for i, f in enumerate(chord))
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.09 * tt)
env = np.clip(tt / 1.8, 0, 1) * np.clip((TOTAL - tt) / 1.6, 0, 1)
# duck the pad under speech (smoothed envelope)
spk = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode="same")
duck = 1.0 - 0.55 * np.clip(spk / (spk.max() * 0.25 + 1e-9), 0, 1)
padL *= 0.05 * lfo * env * duck
padR *= 0.05 * lfo * env * duck
# soft ticks when each scenario score appears
ticks = np.zeros(n, np.float32)
es, ee = beat_edges(2)
acc = es
for wt in CASCADE_W:
    st = int(acc * SR)
    k = np.arange(int(0.12 * SR))
    blip = np.sin(2 * np.pi * 1320 * k / SR) * np.exp(-k / (0.025 * SR)) * 0.09
    ticks[st:st + len(blip)] += blip[: max(0, n - st)]
    acc += wt * (ee - es)
L = voice + padL + ticks
R = voice + padR + ticks
stereo = np.stack([L, R], 1)
stereo /= max(1.0, np.abs(stereo).max() / 0.95)
raw_wav = os.path.join(TMP, "mix.wav")
with wave.open(raw_wav, "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())

subprocess.run(
    [FF, "-loglevel", "error", "-y", "-i", os.path.join(TMP, "video_only.mp4"), "-i", raw_wav,
     "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
     "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", OUT_MP4],
    check=True,
)
print("wrote", OUT_MP4, f"{TOTAL:.2f}s", flush=True)
