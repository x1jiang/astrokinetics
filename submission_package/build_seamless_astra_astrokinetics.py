"""
Seamless Unified Film Builder: ASTRA x AstroKinetics
====================================================
Combines ASTRA (ASTRA-film-29s.mp4) and the raw AstroKinetics v3.4 assets
(Veo 3.1 aerospace footage, 3D twin, 8-DOF Mahalanobis triage, countermeasures,
64-band Log-FFT, and Grok Voice narration) into one cohesive OLED-black cinema film:

  Act I   (0.00s - 20.38s): ASTRA watch & iPhone daily baseline -> Orbit mode -> Day 12 shift
  Act II  (20.38s - 47.64s): AstroKinetics deep-space 3D/triage/neuro-acoustic flight-surgeon console
  Act III (47.64s - 51.34s): Full-circle ASTRA x AstroKinetics unified end card + live URL

Outputs (in submission_package/):
  - ASTRA_x_AstroKinetics_Seamless_Demo.mp4  (1920x1080, 30 fps, H.264, 48 kHz stereo AAC)
  - ASTRA_x_AstroKinetics_Seamless_Demo.srt
"""

import glob
import json
import math
import os
import shutil
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------- binaries & paths ----------
DEFAULT_FF = (
    "/Users/privacy/.cache/uv/wheels-v7/pypi/imageio-ffmpeg/"
    "0.8.1-py3-none-macosx_12_0_arm64/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0"
)
FF = os.environ.get("FFMPEG_BIN") or (DEFAULT_FF if os.path.exists(DEFAULT_FF) else shutil.which("ffmpeg") or "ffmpeg")

PKG = os.path.dirname(os.path.abspath(__file__))
ASTRA_MP4 = os.path.join(PKG, "assets", "astra", "ASTRA-film-29s.mp4")
AUD = os.path.join(PKG, "assets", "audio_v4")
VEO = os.path.join(PKG, "assets", "veo_clips")
CROP = os.path.join(PKG, "assets", "crops")

TMP = os.environ.get("AK_SEAMLESS_TMP", "/tmp/ak_seamless")
TMP_V4 = os.environ.get("AK_TMP", "/tmp/ak_video_v4")
os.makedirs(TMP, exist_ok=True)

OUT_MP4 = os.path.join(PKG, "ASTRA_x_AstroKinetics_Seamless_Demo.mp4")
OUT_SRT = os.path.join(PKG, "ASTRA_x_AstroKinetics_Seamless_Demo.srt")
LIVE_URL = "astrokinetics-space-health-765428358644.us-central1.run.app"

W, H, FPS, SR = 1920, 1080, 30, 48000

# ---------- validate inputs ----------
required_files = [
    ASTRA_MP4,
    os.path.join(AUD, "durations.json"),
    os.path.join(VEO, "veo_01_mars_blackout.mp4"),
    os.path.join(VEO, "veo_02_astronaut_kinematics.mp4"),
    os.path.join(VEO, "veo_03_space_to_earth.mp4"),
    os.path.join(VEO, "veo_04_wrist_cue_shelter.mp4"),
    os.path.join(CROP, "twin_scen3.png"),
    os.path.join(CROP, "directive_scen4_spe.png"),
    os.path.join(CROP, "fft_tab2.png"),
] + [os.path.join(CROP, f"triage_{k}.png") for k in ("scen1_nominal", "scen2_co2", "scen3_squat", "scen4_spe")]

for req in required_files:
    if not os.path.exists(req):
        raise FileNotFoundError(f"Required source asset missing: {req}")

# ---------- Apple typography ----------
HN_TTC = "/System/Library/Fonts/HelveticaNeue.ttc"
MONO_TTF = "/System/Library/Fonts/SFNSMono.ttf"

F_REG = lambda s: ImageFont.truetype(HN_TTC, s, index=0)
F_BOLD = lambda s: ImageFont.truetype(HN_TTC, s, index=1)
F_LIGHT = lambda s: ImageFont.truetype(HN_TTC, s, index=7)
F_MED = lambda s: ImageFont.truetype(HN_TTC, s, index=10)
F_MONO = lambda s: ImageFont.truetype(MONO_TTF, s, index=0)

# Color tokens (ASTRA OLED-black cinema + AstroKinetics clinical accents)
BLACK = (0, 0, 0)
WHITE = (246, 248, 252)
MUTED = (170, 178, 192)
SUBTLE = (132, 140, 156)
FOOTER_C = (86, 92, 104)
CYAN = (56, 189, 248)
EMERALD = (52, 211, 153)
AMBER = (245, 166, 66)
CORAL = (251, 113, 133)
CRIMSON = (244, 63, 94)
VIOLET = (167, 139, 250)


def ease(x):
    x = max(0.0, min(1.0, float(x)))
    return x * x * (3.0 - 2.0 * x)


def text_w(dr, s, f):
    return dr.textlength(s, font=f)


def tracked_width(dr, text, f, tracking):
    if not text:
        return 0.0
    return sum(dr.textlength(ch, font=f) for ch in text) + tracking * max(0, len(text) - 1)


def draw_tracked(dr, xy, text, f, fill, tracking=3.5, center_x=None):
    w_tot = tracked_width(dr, text, f, tracking)
    x = (center_x - w_tot / 2.0) if center_x is not None else float(xy[0])
    y = float(xy[1])
    for i, ch in enumerate(text):
        dr.text((x, y), ch, font=f, fill=fill)
        x += dr.textlength(ch, font=f) + (tracking if i < len(text) - 1 else 0.0)


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


def draw_centered_text(dr, y, text, f, fill, tracking=0.0):
    if tracking > 0.0:
        draw_tracked(dr, (0, y), text, f, fill, tracking=tracking, center_x=W / 2.0)
    else:
        w_tot = text_w(dr, text, f)
        dr.text(((W - w_tot) / 2.0, y), text, font=f, fill=fill)


# ---------- asset decoding ----------
def decode_astra():
    d = os.path.join(TMP, "astra_frames")
    os.makedirs(d, exist_ok=True)
    frames = sorted(glob.glob(os.path.join(d, "f_*.jpg")))
    if len(frames) < 860:
        subprocess.run(
            [FF, "-loglevel", "error", "-y", "-i", ASTRA_MP4,
             "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos",
             "-q:v", "2", os.path.join(d, "f_%04d.jpg")],
            check=True,
        )
        frames = sorted(glob.glob(os.path.join(d, "f_*.jpg")))
    wav = os.path.join(TMP, "astra_48k.wav")
    if not os.path.exists(wav):
        subprocess.run(
            [FF, "-loglevel", "error", "-y", "-i", ASTRA_MP4, "-vn", "-ar", str(SR), "-ac", "2", wav],
            check=True,
        )
    return frames, wav


def decode_veo(name):
    for root in (TMP_V4, TMP):
        d = os.path.join(root, name)
        frames = sorted(glob.glob(os.path.join(d, "f_*.jpg")))
        if len(frames) >= 60:
            return frames
    d = os.path.join(TMP, name)
    os.makedirs(d, exist_ok=True)
    subprocess.run(
        [FF, "-loglevel", "error", "-y", "-i", os.path.join(VEO, f"{name}.mp4"),
         "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}",
         "-q:v", "2", os.path.join(d, "f_%04d.jpg")],
        check=True,
    )
    return sorted(glob.glob(os.path.join(d, "f_*.jpg")))


print("Decoding ASTRA & Veo assets...", flush=True)
ASTRA_FRAMES, ASTRA_WAV = decode_astra()
VEO1 = decode_veo("veo_01_mars_blackout")
VEO2 = decode_veo("veo_02_astronaut_kinematics")
VEO3 = decode_veo("veo_03_space_to_earth")
VEO4 = decode_veo("veo_04_wrist_cue_shelter")


def astra_frame_at(t_src):
    i = min(len(ASTRA_FRAMES) - 1, max(0, int(round(t_src * FPS))))
    return Image.open(ASTRA_FRAMES[i]).convert("RGB")


# ---------- reusable ASTRA watermark & horizon layers ----------
WM_BOX = (45, 36, 380, 72)
WM_PATCH = np.asarray(astra_frame_at(27.50).crop(WM_BOX), dtype=np.uint8)


def apply_watermark(im):
    arr = np.asarray(im, dtype=np.uint8).copy()
    x0, y0, x1, y1 = WM_BOX
    arr[y0:y1, x0:x1] = np.maximum(arr[y0:y1, x0:x1], WM_PATCH)
    return Image.fromarray(arr)


def build_horizons():
    # Take pure unobstructed orbital horizon from t_src = 18.90s (zero caption text anywhere)
    base = np.asarray(astra_frame_at(18.90), dtype=np.float32)
    h_blue = np.zeros((H, W, 3), dtype=np.float32)
    yy = np.arange(850, H, dtype=np.float32)[:, None, None]
    ramp = np.clip((yy - 850.0) / 45.0, 0.0, 1.0)
    ramp = ramp * ramp * (3.0 - 2.0 * ramp)
    h_blue[850:H, :, :] = base[850:H, :, :] * ramp

    # Mars amber-rust atmospheric limb derived cleanly from the exact same orbital geometry
    r_ch = np.clip(1.35 * h_blue[:, :, 2] + 0.35 * h_blue[:, :, 1], 0.0, 255.0)
    g_ch = np.clip(0.52 * h_blue[:, :, 2] + 0.25 * h_blue[:, :, 1], 0.0, 255.0)
    b_ch = np.clip(0.28 * h_blue[:, :, 2], 0.0, 255.0)
    h_mars = np.stack([r_ch, g_ch, b_ch], axis=2)
    return h_blue, h_mars


HORIZON_BLUE, HORIZON_MARS = build_horizons()


def make_oled_canvas(blue_gain=0.0, mars_gain=0.0):
    arr = np.zeros((H, W, 3), dtype=np.float32)
    if blue_gain > 0:
        arr = np.maximum(arr, HORIZON_BLUE * blue_gain)
    if mars_gain > 0:
        arr = np.maximum(arr, HORIZON_MARS * mars_gain)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def composite_horizons(im, blue_gain=0.0, mars_gain=0.0):
    arr = np.asarray(im, dtype=np.float32)
    if blue_gain > 0:
        arr = np.maximum(arr, HORIZON_BLUE * blue_gain)
    if mars_gain > 0:
        arr = np.maximum(arr, HORIZON_MARS * mars_gain)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ---------- smooth Dark-Glass UI transform & glass card helpers ----------
def to_dark_glass(im, trim=4):
    """Monotonic, strictly continuous chroma-preserving Dark-Glass transform."""
    if trim > 0:
        im = im.crop((trim, trim, im.width - trim, im.height - trim))
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    ch = mx - mn
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]

    # Neutral ramp: pure white -> #090d16, #f4f6fb subcards -> #11192c, dark ink -> crisp #f5f7fc
    inv = np.clip(1.0 - lum, 0.0, 1.0)
    inv_g = np.power(inv, 1.28)
    bg = np.array([9.0, 13.0, 22.0], dtype=np.float32) / 255.0
    fg = np.array([245.0, 247.0, 252.0], dtype=np.float32) / 255.0
    neutral = bg[None, None, :] + inv_g[:, :, None] * (fg - bg)[None, None, :]
    subcard = np.exp(-((lum - 0.955) / 0.022) ** 2) * np.clip(1.0 - ch / 0.08, 0.0, 1.0)
    neutral += subcard[:, :, None] * (np.array([8.0, 12.0, 22.0], dtype=np.float32) / 255.0)[None, None, :]

    # Strictly continuous chromatic target_lum curve (no discontinuous jump at midtones)
    unit = (rgb - mn[:, :, None]) / np.maximum(ch[:, :, None], 1e-5)
    t_high = np.clip((lum - 0.78) / 0.22, 0.0, 1.0)
    t_high = t_high * t_high * (3.0 - 2.0 * t_high)
    low_mid_lum = 0.48 + 0.24 * np.clip(lum / 0.78, 0.0, 1.0)
    pale_lum = 0.14 + 0.24 * (1.0 - np.clip((lum - 0.78) / 0.22, 0.0, 1.0))
    target_lum = low_mid_lum * (1.0 - t_high) + pale_lum * t_high
    chroma_boost = np.clip(ch * (1.15 * (1.0 - t_high) + 1.32 * t_high), 0.0, 0.85)
    colored = np.clip(target_lum[:, :, None] + (unit - 0.5) * chroma_boost[:, :, None], 0.0, 1.0)

    tc = np.clip((ch - 0.04) / 0.08, 0.0, 1.0)
    w_col = tc * tc * (3.0 - 2.0 * tc)
    out = neutral * (1.0 - w_col[:, :, None]) + colored * w_col[:, :, None]
    return Image.fromarray((np.clip(out, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8))


def trim_dark_crop(im, trim=2):
    return im.crop((trim, trim, im.width - trim, im.height - trim))


TWIN = trim_dark_crop(Image.open(os.path.join(CROP, "twin_scen3.png")).convert("RGB"), trim=2)
FFT = trim_dark_crop(Image.open(os.path.join(CROP, "fft_tab2.png")).convert("RGB"), trim=2)
DIRECTIVE_SPE = to_dark_glass(Image.open(os.path.join(CROP, "directive_scen4_spe.png")).convert("RGB"), trim=2)
TRIAGE_DARK = {
    k: to_dark_glass(Image.open(os.path.join(CROP, f"triage_{k}.png")).convert("RGB"), trim=2)
    for k in ("scen1_nominal", "scen2_co2", "scen3_squat", "scen4_spe")
}


def push_in(im, k, cx=0.5, cy=0.5):
    if k <= 0.0005:
        return im
    w, h = im.size
    cw, ch = w / (1.0 + k), h / (1.0 + k)
    x0 = min(max(0.0, cx * w - cw / 2.0), w - cw)
    y0 = min(max(0.0, cy * h - ch / 2.0), h - ch)
    return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((w, h), Image.Resampling.BICUBIC)


def rounded_mask_aa(size, r):
    """2x supersampled anti-aliased rounded mask."""
    sw, sh = size[0] * 2, size[1] * 2
    m = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw - 1, sh - 1), r * 2, fill=255)
    return m.resize(size, Image.Resampling.LANCZOS)


def glass_card_on_canvas(canvas, panel, box_xyw, zoom=0.0, cx=0.5, cy=0.5, radius=30):
    x, y, w = box_xyw
    h = int(round(w * panel.height / panel.width))
    im = canvas.copy()
    p = push_in(panel.resize((w, h), Image.Resampling.LANCZOS), zoom, cx, cy)
    # Soft dark drop shadow
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle((x + 4, y + 12, x + w + 4, y + h + 12), radius, fill=190)
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    im.paste((0, 0, 0), (0, 0), sh)
    # Titanium glass frame + inner subtle rim highlight
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((x - 2, y - 2, x + w + 2, y + h + 2), radius + 2, fill=(58, 72, 98))
    dr.rounded_rectangle((x - 1, y - 1, x + w + 1, y + h + 1), radius + 1, fill=(96, 118, 155))
    im.paste(p, (x, y), rounded_mask_aa((w, h), radius))
    return im


def faded_layer(im, a, draw_fn):
    if a <= 0.005:
        return im
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(ov))
    if a < 0.999:
        ov.putalpha(ov.getchannel("A").point(lambda v: int(v * a)))
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")


# Precompute OLED vignette alpha / masks for Veo footage
def _build_veo_masks():
    yy = np.arange(H, dtype=np.float32)[:, None]
    top_r = np.clip(yy / 150.0, 0.0, 1.0)
    bot_r = np.clip((H - 22.0 - yy) / 185.0, 0.0, 1.0)
    tb = (top_r * top_r * (3.0 - 2.0 * top_r)) * (bot_r * bot_r * (3.0 - 2.0 * bot_r))

    xx = np.arange(W, dtype=np.float32)[None, :]
    lr_t = np.clip(xx / 1060.0, 0.0, 1.0)
    left_keep = 1.0 - 0.92 * np.power(1.0 - lr_t, 1.45)
    return tb[:, :, None], left_keep[:, :, None]


VEO_TB_MASK, VEO_LEFT_VIG = _build_veo_masks()


def oled_veo_frame(frames, lt, offset=0.0, zoom=0.03, left_vignette=True):
    i = min(len(frames) - 1, max(0, int((lt + offset) * FPS)))
    im = Image.open(frames[i]).convert("RGB")
    if zoom > 0.0005:
        im = push_in(im, zoom)
    arr = np.asarray(im, dtype=np.float32)
    # Subtle OLED black-crush & contrast richness
    arr = np.clip((arr - 7.0) * 1.045, 0.0, 255.0) * VEO_TB_MASK
    if left_vignette:
        arr *= VEO_LEFT_VIG
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ---------- Act I definition & exact time mapping ----------
# Verified pure-valley boundaries (0 clipped words, clean ring/watch transitions)
ACT1_SEGS = [
    # (src_start, src_end, xfade_in_from_prev)
    (0.30, 2.30, 0.00),   # Watch 3D logo: "Every body has its own normal."
    (3.02, 9.60, 0.28),   # Daily Check 0/16 -> 16/16 -> 14 Baseline Ready: "On Earth, ASTRA learns yours. 16 measures a day, for 14 days."
    (9.82, 16.12, 0.24),  # Orbital horizon rises -> Day 1 -> Orbit Mode fades cleanly to empty ring
    (18.84, 25.35, 0.24), # Day 12 amber shift -> iPhone Guided check -> Possible causes -> fade out
]


def compute_act1_layout(segs):
    layout = []
    cur = 0.0
    for idx, (s, e, xf) in enumerate(segs):
        dur = e - s
        out_start = cur - (xf if idx > 0 else 0.0)
        out_end = out_start + dur
        layout.append({"idx": idx, "src_s": s, "src_e": e, "xf_in": xf if idx > 0 else 0.0,
                       "out_s": out_start, "out_e": out_end, "dur": dur})
        cur = out_end
    return layout, cur


ACT1_LAYOUT, T_ACT1 = compute_act1_layout(ACT1_SEGS)
print(f"Act I duration: {T_ACT1:.3f}s", flush=True)


def src_to_act1_time(t_src):
    for item in ACT1_LAYOUT:
        if item["src_s"] <= t_src <= item["src_e"]:
            return item["out_s"] + (t_src - item["src_s"])
    raise ValueError(f"t_src={t_src} outside ACT1_LAYOUT")


def render_act1_frame(t):
    active = [it for it in ACT1_LAYOUT if it["out_s"] - 1e-6 <= t <= it["out_e"] + 1e-6]
    if not active:
        return Image.new("RGB", (W, H), BLACK)
    if len(active) == 1:
        it = active[0]
        im = astra_frame_at(it["src_s"] + (t - it["out_s"]))
    else:
        prev_it, next_it = active[0], active[1]
        im_prev = astra_frame_at(prev_it["src_s"] + (t - prev_it["out_s"]))
        im_next = astra_frame_at(next_it["src_s"] + (t - next_it["out_s"]))
        u = ease((t - next_it["out_s"]) / max(1e-6, next_it["xf_in"]))
        im = Image.blend(im_prev, im_next, u)

    # Gentle opening fade-in from pure black (0.20s) and smooth tail to pure black (0.18s)
    if t < 0.20:
        a = ease(t / 0.20)
        im = Image.fromarray((np.asarray(im, dtype=np.float32) * a).astype(np.uint8))
    elif t > T_ACT1 - 0.18:
        a = ease((T_ACT1 - t) / 0.18)
        im = Image.fromarray((np.asarray(im, dtype=np.float32) * a).astype(np.uint8))
    return im


# ---------- Act II timeline & visual beat renderers ----------
meta = json.load(open(os.path.join(AUD, "durations.json")))
DUR = meta["durations"]
SCRIPT = meta["script"]

LEAD_2 = 0.40
GAP_2 = 0.26
TAIL_2 = 0.45

beats2 = []  # (id, speech_start_rel, speech_end_rel)
cur2 = LEAD_2
for seg in SCRIPT:
    d = DUR[seg["id"]]
    beats2.append((seg["id"], cur2, cur2 + d))
    cur2 += d + GAP_2
ACT2_SPEECH_END = beats2[-1][2]
ACT2_DUR = ACT2_SPEECH_END + TAIL_2
T_ACT2_END = T_ACT1 + ACT2_DUR
B2 = {b[0]: (b[1], b[2]) for b in beats2}
print(f"Act II duration: {ACT2_DUR:.3f}s (t={T_ACT1:.2f}s .. {T_ACT2_END:.2f}s)", flush=True)


def beat2_edges(i):
    s = 0.0 if i == 0 else beats2[i][1] - 0.12
    e = ACT2_DUR if i == len(beats2) - 1 else beats2[i + 1][1] - 0.12
    return s, e


# Build Act II captions mapped to global timeline
act2_cues = []
for seg in SCRIPT:
    s_rel, e_rel = B2[seg["id"]]
    s_glob, e_glob = T_ACT1 + s_rel, T_ACT1 + e_rel
    parts = seg["cues"]
    tot_c = sum(len(p) for p in parts)
    cs = s_glob
    for j, p in enumerate(parts):
        ce = cs + (e_glob - s_glob) * len(p) / tot_c
        act2_cues.append((cs, ce + (0.18 if j == len(parts) - 1 else 0.0), p))
        cs = ce


def act2_caption_at(t_glob):
    for s, e, txt in act2_cues:
        if s - 0.05 <= t_glob < e:
            return txt
    return None


def draw_act2_caption(im, t_glob):
    cap = act2_caption_at(t_glob)
    if not cap:
        return im
    # Verify crisp rendering without missing glyphs; HelveticaNeue has subscript 2 cleanly
    # Put faint glow/drop-shadow and crisp off-white Apple subtitle at y=948
    dr_tmp = ImageDraw.Draw(im)
    f_cap = F_MED(28)
    lines = wrap(dr_tmp, cap, f_cap, 1520)

    def _draw(d):
        lh = 38
        y0 = 948 if len(lines) == 1 else 926
        for j, l in enumerate(lines):
            lw = text_w(d, l, f_cap)
            lx = (W - lw) / 2.0
            ly = y0 + j * lh
            d.text((lx + 1, ly + 2), l, font=f_cap, fill=(0, 0, 0, 210))
            d.text((lx, ly), l, font=f_cap, fill=(240, 244, 250, 248))

    return faded_layer(im, 1.0, _draw)


# Beat II.1 — Deep Space Problem (Mars 44-minute delay)
def r2_problem(lt, dur):
    im = oled_veo_frame(VEO1, lt, zoom=0.02 + 0.04 * (lt / max(0.1, dur)), left_vignette=True)
    im = composite_horizons(im, blue_gain=0.0, mars_gain=0.55)
    a = ease((lt - 0.15) / 0.45)

    def _copy(d):
        draw_tracked(d, (124, 300), "BEYOND ORBIT  ·  ASTROKINETICS", F_MED(17), AMBER + (255,), tracking=3.5)
        d.text((120, 344), "44 minutes", font=F_MED(64), fill=WHITE + (255,))
        d.text((120, 418), "from Earth.", font=F_MED(64), fill=WHITE + (255,))
        d.text((124, 520), "En route to Mars, ASTRA's personal baseline powers", font=F_REG(24), fill=MUTED + (255,))
        d.text((124, 554), "an autonomous cabin flight-surgeon console.", font=F_REG(24), fill=MUTED + (255,))

    return faded_layer(im, a, _copy)


# Beat II.2 — Gather (Camera + Watch -> 3D Digital Twin)
def r2_gather_veo(lt, split):
    im = oled_veo_frame(VEO2, lt, offset=0.6, zoom=0.03 + 0.03 * (lt / max(0.1, split)), left_vignette=True)
    im = composite_horizons(im, blue_gain=0.35, mars_gain=0.20)
    a = ease((lt - 0.10) / 0.35)

    def _copy(d):
        draw_tracked(d, (124, 326), "CABIN VISION + APPLE WATCH", F_MED(17), EMERALD + (255,), tracking=3.5)
        d.text((120, 370), "One cabin camera.", font=F_MED(56), fill=WHITE + (255,))
        d.text((120, 438), "One smartwatch.", font=F_MED(56), fill=WHITE + (255,))

    return faded_layer(im, a, _copy)


def r2_gather_twin(u, span):
    canvas = make_oled_canvas(blue_gain=0.45, mars_gain=0.15)
    im = glass_card_on_canvas(canvas, TWIN, (680, 122, 1140), zoom=0.0, cx=0.5, cy=0.5, radius=30)
    dr = ImageDraw.Draw(im)
    draw_tracked(dr, (124, 168), "ASTROKINETICS  ·  100% OFFLINE", F_MED(17), EMERALD, tracking=3.5)
    dr.text((120, 212), "Pulse, posture,", font=F_MED(52), fill=WHITE)
    dr.text((120, 274), "and tremor.", font=F_MED(52), fill=WHITE)

    rows = [
        (CYAN, "Contactless facial pulse", "3-zone POS-rPPG via cabin camera"),
        (EMERALD, "3D posture vs. your normal", "Cyan 1g baseline ghost & force vectors"),
        (AMBER, "21-joint hand tremor", "4–12 Hz · raw video never leaves cabin"),
    ]
    for i, (col, title, sub) in enumerate(rows):
        a = ease((u - 0.15 - i * 0.55) / 0.35)
        ry = 415 + i * 102 + int((1.0 - a) * 14)

        def _row(d, ry=ry, col=col, title=title, sub=sub):
            d.ellipse((124, ry + 8, 138, ry + 22), fill=col + (255,))
            d.text((156, ry), title, font=F_MED(25), fill=WHITE + (255,))
            d.text((156, ry + 34), sub, font=F_REG(19), fill=MUTED + (255,))

        im = faded_layer(im, a, _row)
    return im


def r2_gather(lt, dur):
    split = 2.35
    xf = 0.35
    if lt < split - xf:
        return r2_gather_veo(lt, split)
    if lt < split:
        a = r2_gather_veo(lt, split)
        b = r2_gather_twin(0.0, dur - split)
        return Image.blend(a, b, ease((lt - (split - xf)) / xf))
    return r2_gather_twin(lt - split, dur - split)


# Beat II.3 — Evaluate Offline (Same Model, Four Answers)
CASCADE = [
    ("scen1_nominal", "99.2", EMERALD, "SOL 014  ·  INSIDE YOUR NORMAL", "All 8 signals inside baseline", "Continue scheduled ARED"),
    ("scen2_co2", "78.3", AMBER, "SOL 088  ·  CABIN CO2 DRIFT", "PVT slowing tracks cabin CO2", "Purge CDRA CO2 scrubber"),
    ("scen3_squat", "44.7", CORAL, "SOL 142  ·  0G SQUAT ASYMMETRY", "Bilateral load & trunk lean drift", "Reduce unilateral load 15%"),
    ("scen4_spe", "12.0", CRIMSON, "SOL 210  ·  SOLAR RADIATION", "Dosimetry surge + OSD-571 risk", "Enter water-wall shelter"),
]
CASCADE_W = [0.27, 0.24, 0.25, 0.24]
CASCADE_BG = make_oled_canvas(blue_gain=0.40, mars_gain=0.20)


def scenario2_frame(idx, zoom):
    key, score, col, head, why, act = CASCADE[idx]
    im = glass_card_on_canvas(CASCADE_BG, TRIAGE_DARK[key], (680, 142, 1140), zoom=zoom, cx=0.5, cy=0.42, radius=24)
    dr = ImageDraw.Draw(im)
    lx = 124
    draw_tracked(dr, (lx, 152), "8-DOF MAHALANOBIS  ·  NASA OSD-571", F_MED(16), CYAN, tracking=3.2)
    dr.text((lx - 4, 194), "One baseline.", font=F_MED(44), fill=WHITE)
    dr.text((lx - 4, 248), "Four root causes.", font=F_MED(44), fill=WHITE)

    dr.text((lx - 6, 344), score, font=F_MED(116), fill=col)
    sw = text_w(dr, score, F_MED(116))
    dr.text((lx + sw + 14, 412), "/ 100 readiness", font=F_REG(22), fill=MUTED)

    draw_tracked(dr, (lx, 496), head, F_MED(17), WHITE, tracking=2.6)
    dr.text((lx, 548), "CAUSE", font=F_MED(14), fill=SUBTLE)
    dr.text((lx, 570), why, font=F_REG(24), fill=WHITE)
    dr.text((lx, 624), "ACTION", font=F_MED(14), fill=SUBTLE)
    dr.text((lx, 646), act, font=F_MED(24), fill=col)

    # Progress dots matching ASTRA circular visual language
    for i in range(4):
        cxp = lx + i * 32
        dot_c = CASCADE[i][2] if i <= idx else (44, 52, 68)
        dr.ellipse((cxp, 718, cxp + 16, 734), fill=dot_c)
    return im


def r2_evaluate(lt, dur):
    acc, idx, u, span = 0.0, 0, 0.0, dur
    for i, wt in enumerate(CASCADE_W):
        span = wt * dur
        if lt < acc + span or i == len(CASCADE_W) - 1:
            idx, u = i, lt - acc
            break
        acc += span
    im = scenario2_frame(idx, zoom=0.012 + 0.025 * (u / max(0.1, span)))
    xf = 0.32
    if idx > 0 and u < xf:
        im = Image.blend(scenario2_frame(idx - 1, zoom=0.037), im, ease(u / xf))
    return im


# Beat II.4 — Closed-Loop Act Now -> Wrist Cue & Storm Shelter
ACT_BG = make_oled_canvas(blue_gain=0.25, mars_gain=0.35)


def r2_act_ui(lt, split):
    im = glass_card_on_canvas(ACT_BG, DIRECTIVE_SPE, (680, 165, 1140), zoom=0.0, radius=26)
    im = glass_card_on_canvas(im, FFT, (680, 375, 1140), zoom=0.0, radius=30)
    dr = ImageDraw.Draw(im)
    lx = 124
    draw_tracked(dr, (lx, 178), "CLOSED-LOOP INTERVENTION", F_MED(16), AMBER, tracking=3.2)
    dr.text((lx - 4, 222), "One clear action.", font=F_MED(48), fill=WHITE)
    dr.text((lx - 4, 280), "Not another alarm.", font=F_MED(48), fill=WHITE)

    items = [
        (CRIMSON, "NASA-STD-3001 countermeasure", "Water-wall shelter & OSD-571 support"),
        (CYAN, "2.5 Hz neuro-acoustic audio", "Real-time closed-loop brainwave entrainment"),
        (EMERALD, "Apple Watch haptic cue", "WKHapticType pulse · <2 KB Earth packet"),
    ]
    for i, (col, t1, t2) in enumerate(items):
        a = ease((lt - 0.12 - i * 0.35) / 0.32)
        iy = 415 + i * 96 + int((1.0 - a) * 12)

        def _row(d, iy=iy, col=col, t1=t1, t2=t2):
            d.ellipse((lx, iy + 8, lx + 14, iy + 22), fill=col + (255,))
            d.text((lx + 30, iy), t1, font=F_MED(24), fill=WHITE + (255,))
            d.text((lx + 30, iy + 32), t2, font=F_REG(18), fill=MUTED + (255,))

        im = faded_layer(im, a, _row)
    return im


def r2_act(lt, dur):
    split = 2.25
    xf = 0.35
    if lt < split - xf:
        return r2_act_ui(lt, split)
    if lt < split:
        a = r2_act_ui(lt, split)
        b = oled_veo_frame(VEO4, 0.0, offset=0.25, zoom=0.02, left_vignette=False)
        return Image.blend(a, b, ease((lt - (split - xf)) / xf))
    u = lt - split
    return oled_veo_frame(VEO4, u, offset=0.25, zoom=0.02 + 0.03 * (u / max(0.1, dur - split)), left_vignette=False)


# Beat II.5 — Space to Earth Dual Use + Fade to Pure Black
def r2_earth(lt, dur):
    im = oled_veo_frame(VEO3, lt, offset=0.35, zoom=0.02 + 0.03 * (lt / max(0.1, dur)), left_vignette=True)
    im = composite_horizons(im, blue_gain=0.60, mars_gain=0.0)
    a = ease((lt - 0.10) / 0.35)

    def _copy(d):
        draw_tracked(d, (124, 340), "SPACE TO EARTH", F_MED(17), EMERALD + (255,), tracking=3.5)
        d.text((120, 384), "From Mars to", font=F_MED(60), fill=WHITE + (255,))
        d.text((120, 454), "rural clinics.", font=F_MED(60), fill=WHITE + (255,))

    im = faded_layer(im, a, _copy)
    return im


RENDER_2 = [r2_problem, r2_gather, r2_evaluate, r2_act, r2_earth]
XFADE_2 = 0.35


def beat2_frame(i, lt_rel):
    s, e = beat2_edges(i)
    return RENDER_2[i](lt_rel - s, e - s)


def render_act2_frame(t_glob):
    t_rel = t_glob - T_ACT1
    bi = max(i for i in range(len(beats2)) if beat2_edges(i)[0] <= t_rel)
    frame = beat2_frame(bi, t_rel)
    s = beat2_edges(bi)[0]
    if bi > 0 and t_rel - s < XFADE_2:
        prev = beat2_frame(bi - 1, t_rel)
        frame = Image.blend(prev, frame, ease((t_rel - s) / XFADE_2))
    frame = draw_act2_caption(frame, t_glob)
    frame = apply_watermark(frame)
    # Dissolve smoothly into pure black over the final 0.40s before Act III
    rem = ACT2_DUR - t_rel
    if rem < 0.40:
        a = ease(rem / 0.40)
        frame = Image.fromarray((np.asarray(frame, dtype=np.float32) * a).astype(np.uint8))
    return frame


# ---------- Act III — Full-Circle Unified End Card (ASTRA x AstroKinetics) ----------
ACT3_SRC_S = 25.30
ACT3_SRC_E = 29.00
ACT3_DUR = ACT3_SRC_E - ACT3_SRC_S  # 3.70s
T_TOTAL = T_ACT2_END + ACT3_DUR
NF = int(round(T_TOTAL * FPS))
print(f"Act III duration: {ACT3_DUR:.2f}s | TOTAL VIDEO: {T_TOTAL:.2f}s ({NF} frames)", flush=True)


def build_endcard_base():
    """Static typography layer of the unified ASTRA x AstroKinetics end card on #000000."""
    im = Image.new("RGB", (W, H), BLACK)
    dr = ImageDraw.Draw(im)

    draw_centered_text(dr, 382, "ASTRA   ×   ASTROKINETICS", F_BOLD(42), WHITE, tracking=4.5)
    draw_centered_text(dr, 452, "Know your normal. Act autonomously — from Orbit to Mars.", F_MED(26), (232, 236, 244))

    draw_centered_text(dr, 534, "Team AI-MED 01 · Houston, TX", F_BOLD(22), WHITE)
    draw_centered_text(
        dr, 568,
        "Myreen Ahsan · Carlos Jaimes · Xiaoqian Jiang · Ashley Jiang · Carlos Jaramillo",
        F_REG(19), (156, 164, 178),
    )

    draw_centered_text(
        dr, 622,
        "2026 NASA Space Apps Challenge · Health Monitoring Software for Astronauts on Space Missions",
        F_MED(19), (238, 168, 56),
    )
    draw_centered_text(
        dr, 654,
        "Built on NASA science: Inspiration4 crew data (NASA OSDR OSD-571) · NASA-STD-3001 · NASA HRP",
        F_REG(17), (132, 140, 156),
    )

    # Dark-glass live URL pill centered beneath NASA science line
    f_url = F_MONO(19)
    uw = text_w(dr, LIVE_URL, f_url)
    px0 = (W - uw) / 2.0 - 26.0
    px1 = (W + uw) / 2.0 + 26.0
    py0, py1 = 708, 756
    dr.rounded_rectangle((px0, py0, px1, py1), radius=22, fill=(12, 18, 30), outline=(64, 92, 138), width=2)
    draw_centered_text(dr, 720, LIVE_URL, f_url, (170, 212, 255))

    draw_centered_text(
        dr, 1016,
        "iPhone and Apple Watch are trademarks of Apple Inc. Fictional astronaut.",
        F_REG(14), FOOTER_C,
    )
    return im


ENDCARD_BASE = build_endcard_base()


def render_act3_frame(t_glob):
    lt = t_glob - T_ACT2_END
    src_im = astra_frame_at(ACT3_SRC_S + lt)
    # Grab full animated 16-tick circular emblem + bottom comet glow cleanly (y=275..462)
    ring = src_im.crop((860, 275, 1060, 462))
    im = ENDCARD_BASE.copy()
    arr = np.asarray(im, dtype=np.uint8).copy()
    arr[175:362, 860:1060] = np.maximum(arr[175:362, 860:1060], np.asarray(ring, dtype=np.uint8))
    im = apply_watermark(Image.fromarray(arr))

    # Smooth fade-in (0.40s) and end-of-film fade-out (0.30s)
    fade = 1.0
    if lt < 0.40:
        fade *= ease(lt / 0.40)
    if ACT3_DUR - lt < 0.30:
        fade *= ease((ACT3_DUR - lt) / 0.30)
    if fade < 0.999:
        im = Image.fromarray((np.asarray(im, dtype=np.float32) * fade).astype(np.uint8))
    return im


def frame_at(t):
    if t < T_ACT1:
        return render_act1_frame(t)
    if t < T_ACT2_END:
        return render_act2_frame(t)
    return render_act3_frame(t)


# ---------- preview shortcut for rapid QA ----------
if os.environ.get("AK_PREVIEW"):
    out_dir = os.environ.get("AK_PREVIEW_DIR", TMP)
    for ts in os.environ["AK_PREVIEW"].split(","):
        frame_at(float(ts)).save(os.path.join(out_dir, f"pv_{float(ts):05.2f}.png"))
    raise SystemExit(0)


# ---------- encode video stream ----------
print(f"Rendering {NF} frames @ {FPS}fps -> video_only.mp4 ...", flush=True)
vid_only = os.path.join(TMP, "video_only.mp4")
enc = subprocess.Popen(
    [FF, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
     "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
     "-movflags", "+faststart", vid_only],
    stdin=subprocess.PIPE,
)
for fi in range(NF):
    enc.stdin.write(frame_at(fi / FPS).tobytes())
    if fi % 150 == 0:
        print(f"  frame {fi}/{NF}", flush=True)
enc.stdin.close()
if enc.wait() != 0:
    raise RuntimeError("FFmpeg H.264 video encode failed")


# ---------- stereo audio mastering (48 kHz) ----------
print("Mastering seamless stereo audio...", flush=True)
with wave.open(ASTRA_WAV, "r") as w:
    assert w.getframerate() == SR and w.getnchannels() == 2
    ASTRA_STEREO = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768.0


def slice_astra_audio(s, e):
    i0 = max(0, int(round(s * SR)))
    i1 = min(len(ASTRA_STEREO), int(round(e * SR)))
    return ASTRA_STEREO[i0:i1].copy()


N_TOT = int(round(T_TOTAL * SR))
N_ACT1 = int(round(T_ACT1 * SR))
N_ACT2_END = int(round(T_ACT2_END * SR))
mix = np.zeros((N_TOT, 2), dtype=np.float32)

# 1. Act I stereo assembly with equal-power cosine/sine crossfades
act1_buf = np.zeros((N_ACT1 + int(0.5 * SR), 2), dtype=np.float32)
for it in ACT1_LAYOUT:
    seg_a = slice_astra_audio(it["src_s"], it["src_e"])
    st = int(round(it["out_s"] * SR))
    xf_n = int(round(it["xf_in"] * SR))
    if it["idx"] == 0:
        # 0.20s smooth entrance from silence
        n_in = min(len(seg_a), int(0.20 * SR))
        u = np.linspace(0.0, 1.0, n_in, dtype=np.float32)[:, None]
        seg_a[:n_in] *= np.sin(0.5 * math.pi * u)
    if xf_n > 0:
        xf_n = min(xf_n, len(seg_a), N_ACT1 - st)
        u = np.linspace(0.0, 1.0, xf_n, dtype=np.float32)[:, None]
        w_old = np.cos(0.5 * math.pi * u)
        w_new = np.sin(0.5 * math.pi * u)
        act1_buf[st:st + xf_n] = act1_buf[st:st + xf_n] * w_old + seg_a[:xf_n] * w_new
        act1_buf[st + xf_n:st + len(seg_a)] = seg_a[xf_n:]
    else:
        act1_buf[st:st + len(seg_a)] = seg_a

# Smoothly fade out Act I tail across final 0.30s into Act II bridge pad
fade_out_a1 = int(0.30 * SR)
u_fo = np.linspace(0.0, 1.0, fade_out_a1, dtype=np.float32)[:, None]
act1_buf[N_ACT1 - fade_out_a1:N_ACT1] *= np.cos(0.5 * math.pi * u_fo)
mix[:N_ACT1] += act1_buf[:N_ACT1]

# Calibrate Grok Voice RMS against ASTRA active speech RMS for invisible level transition
speech_windows = [(0.7, 2.0), (3.3, 8.3), (10.1, 14.5), (19.1, 24.0)]
astra_sp_samples = np.concatenate([slice_astra_audio(a, b).mean(axis=1) for a, b in speech_windows])
astra_sp_rms = float(np.sqrt(np.mean(astra_sp_samples ** 2)))

grok_stems = []
grok_active = []
for seg in SCRIPT:
    with wave.open(os.path.join(AUD, f"{seg['id']}.wav")) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    # Gentle 1-pole warmth match + match RMS
    warm = np.empty_like(a)
    warm[0] = a[0]
    warm[1:] = 0.80 * a[1:] + 0.20 * a[:-1]
    grok_stems.append((seg["id"], warm))
    grok_active.append(warm[np.abs(warm) > 0.02])

grok_rms = float(np.sqrt(np.mean(np.concatenate(grok_active) ** 2)))
voice_gain = (astra_sp_rms / max(grok_rms, 1e-6)) * 1.04

voice_track = np.zeros(N_TOT, dtype=np.float32)
for sid, stem in grok_stems:
    st = int(round((T_ACT1 + B2[sid][0]) * SR))
    m_len = min(len(stem), N_TOT - st)
    if m_len > 0:
        voice_track[st:st + m_len] += stem[:m_len] * voice_gain

mix[:, 0] += voice_track
mix[:, 1] += voice_track

# 2. Continuous A-Major warm electric-piano / ambient bell pad bridging Act I -> Act II -> Act III
pad_start = max(0, int(round((T_ACT1 - 0.60) * SR)))
pad_end = min(N_TOT, int(round((T_ACT2_END + 0.65) * SR)))
n_pad = pad_end - pad_start
tt = np.arange(n_pad, dtype=np.float32) / SR
frac = tt / max(1e-6, (n_pad / SR))

# Interpolate chord voicings in A major (F#m9 -> Dmaj9 -> Aadd9 -> Esus4/E)
chords = np.array([
    [92.50, 185.00, 220.00, 277.18, 329.63, 493.88],   # F#m9
    [73.42, 146.83, 220.00, 277.18, 329.63, 440.00],   # Dmaj9
    [110.00, 164.81, 220.00, 277.18, 329.63, 493.88],  # Aadd9
    [82.41, 164.81, 207.65, 246.94, 329.63, 493.88],   # Esus4/E -> resolves into Act III A major!
], dtype=np.float32)

pos = np.clip(frac * 3.0, 0.0, 2.9999)
idx0 = pos.astype(np.int32)
alpha_c = pos - idx0
alpha_c = alpha_c * alpha_c * (3.0 - 2.0 * alpha_c)

padL = np.zeros(n_pad, dtype=np.float32)
padR = np.zeros(n_pad, dtype=np.float32)
for k in range(6):
    fk = chords[idx0, k] * (1.0 - alpha_c) + chords[idx0 + 1, k] * alpha_c
    phase_l = 2.0 * math.pi * np.cumsum(fk) / SR + k * 0.9
    phase_r = 2.0 * math.pi * np.cumsum(fk * 1.0025) / SR + k * 1.6
    amp = 0.50 / (1.0 + k * 0.62)
    padL += np.sin(phase_l) * amp
    padR += np.sin(phase_r) * amp

lfo = 0.78 + 0.22 * np.sin(2.0 * math.pi * 0.11 * tt)
pad_env = np.ones(n_pad, dtype=np.float32)
n_in_p = int(0.85 * SR)
n_out_p = int(0.65 * SR)
pad_env[:n_in_p] *= np.sin(0.5 * math.pi * np.linspace(0.0, 1.0, n_in_p, dtype=np.float32))
pad_env[-n_out_p:] *= np.cos(0.5 * math.pi * np.linspace(0.0, 1.0, n_out_p, dtype=np.float32))

# Smooth sidechain ducking under Grok Voice
spk_env = np.convolve(np.abs(voice_track[pad_start:pad_end]), np.ones(3600, dtype=np.float32) / 3600.0, mode="same")
duck = 1.0 - 0.55 * np.clip(spk_env / (max(float(spk_env.max()), 1e-6) * 0.28), 0.0, 1.0)

pad_level = 0.036 * lfo * pad_env * duck
mix[pad_start:pad_end, 0] += padL * pad_level
mix[pad_start:pad_end, 1] += padR * pad_level

# Soft A-major crystal bell harmonics on the 4 Evaluate scenario transitions
es2, ee2 = beat2_edges(2)
acc_b = es2
k_bell = np.arange(int(0.45 * SR), dtype=np.float32)
bell = (np.sin(2.0 * math.pi * 880.0 * k_bell / SR) * 0.65
        + np.sin(2.0 * math.pi * 1108.73 * k_bell / SR) * 0.35) * np.exp(-k_bell / (0.14 * SR)) * 0.030
for wt in CASCADE_W:
    st_b = int(round((T_ACT1 + acc_b) * SR))
    bl_n = min(len(bell), N_TOT - st_b)
    if bl_n > 0:
        mix[st_b:st_b + bl_n, 0] += bell[:bl_n]
        mix[st_b:st_b + bl_n, 1] += bell[:bl_n]
    acc_b += wt * (ee2 - es2)

# 3. Act III stereo closing tag ("ASTRA. Know your normal." + A-major tonic chime)
act3_a = slice_astra_audio(ACT3_SRC_S, ACT3_SRC_E)
declick_in = min(len(act3_a), int(0.08 * SR))
declick_out = min(len(act3_a), int(0.18 * SR))
act3_a[:declick_in] *= np.sin(0.5 * math.pi * np.linspace(0.0, 1.0, declick_in, dtype=np.float32))[:, None]
act3_a[-declick_out:] *= np.cos(0.5 * math.pi * np.linspace(0.0, 1.0, declick_out, dtype=np.float32))[:, None]
a3_n = min(len(act3_a), N_TOT - N_ACT2_END)
mix[N_ACT2_END:N_ACT2_END + a3_n] += act3_a[:a3_n]

# Prevent hard clipping prior to loudnorm
peak = float(np.abs(mix).max())
if peak > 0.94:
    mix *= 0.94 / peak

mix_wav = os.path.join(TMP, "seamless_mix.wav")
with wave.open(mix_wav, "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes())

# ---------- write complete .srt ----------
def fmt_srt(ts):
    ms = int(round(max(0.0, ts) * 1000.0))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


act1_srt_raw = [
    (0.65, 2.15, "Every body has its own normal."),
    (3.25, 5.45, "On Earth, ASTRA learns yours."),
    (5.70, 8.55, "16 measures a day, for 14 days."),
    (10.00, 12.35, "Then you leave Earth, and your body changes."),
    (12.90, 14.80, "Orbit mode moves your normal with you."),
    (19.00, 20.25, "Day 12. Something shifts."),
    (20.85, 24.30, "A guided check, and possible causes, with the evidence."),
]
all_cues = [(src_to_act1_time(a), src_to_act1_time(b), txt) for a, b, txt in act1_srt_raw]
all_cues.extend(act2_cues)
all_cues.append((T_ACT2_END + 0.08, T_ACT2_END + 2.35, "ASTRA. Know your normal."))

with open(OUT_SRT, "w", encoding="utf-8") as f:
    for idx, (cs, ce, txt) in enumerate(all_cues, 1):
        f.write(f"{idx}\n{fmt_srt(cs)} --> {fmt_srt(min(ce, T_TOTAL))}\n{txt}\n\n")

# ---------- final FFmpeg mux + broadcast loudness normalization ----------
print("Muxing final MP4 with -af loudnorm=I=-16:TP=-1.5:LRA=11 ...", flush=True)
subprocess.run(
    [FF, "-loglevel", "error", "-y",
     "-i", vid_only, "-i", mix_wav,
     "-map", "0:v", "-map", "1:a", "-c:v", "copy",
     "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR),
     "-c:a", "aac", "-b:a", "192k", "-t", f"{T_TOTAL:.3f}",
     "-movflags", "+faststart", OUT_MP4],
    check=True,
)
print(f"WROTE {OUT_MP4} ({T_TOTAL:.2f}s) and {OUT_SRT}", flush=True)
