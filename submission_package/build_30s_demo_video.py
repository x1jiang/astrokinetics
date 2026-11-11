"""
Build the Official <=30.0-Second (27.80s exact) 1080p 30-FPS NASA Space Apps 2026 Demo Video
(v3 — Broadcast Studio Grid, 100% Uncropped macOS Browser + 2x Retina Magnifier Rail + Smoothstep Dissolves):
  submission_package/AstroKinetics_30s_SpaceApps_Demo.mp4
  submission_package/AstroKinetics_30s_SpaceApps_Demo.srt
"""
import glob
import json
import math
import os
import shutil
import subprocess
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"
PKG = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(PKG, "assets", "audio")
VEO_DIR = os.path.join(PKG, "assets", "veo_clips")
SHOT_DIR = os.path.join(PKG, "assets", "screenshots")
IMG_DIR = os.path.join(PKG, "assets", "images")
TMP_FRAMES = "/tmp/astro_veo_decoded"
os.makedirs(TMP_FRAMES, exist_ok=True)

W, H, FPS, SR = 1920, 1080, 30, 48000
TOTAL_SEC = 27.80  # Strictly <= 30.0s NASA Space Apps hard cap!
TOTAL_FRAMES = int(round(TOTAL_SEC * FPS))


def load_font(candidates, size):
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


SANS_BOLD = [
    "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
]
SANS_REG = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
]
MONO_BOLD = [
    "/System/Library/Fonts/Supplemental/Menlo.ttc",
    "/System/Library/Fonts/Monaco.ttf",
    "/System/Library/Fonts/Courier.dfont",
]

F_HERO = load_font(SANS_BOLD, 74)
F_HERO_SUB = load_font(SANS_BOLD, 28)
F_SCORE = load_font(SANS_BOLD, 62)
F_RAIL_TITLE = load_font(SANS_BOLD, 24)
F_RAIL_LABEL = load_font(MONO_BOLD, 14)
F_RAIL_BODY = load_font(SANS_REG, 18)
F_RAIL_BOLD = load_font(SANS_BOLD, 18)
F_HUD = load_font(MONO_BOLD, 18)
F_URL_CHROME = load_font(MONO_BOLD, 14)
F_PILL = load_font(MONO_BOLD, 15)
F_SUBTITLE = load_font(SANS_BOLD, 27)
F_END_PILL = load_font(MONO_BOLD, 16)
F_END_URL = load_font(MONO_BOLD, 21)


# Exact optical text alignment helpers using textbbox
def draw_text_centered(dr, box, text, font, fill):
    x0, y0, x1, y1 = box
    bb = dr.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = x0 + (x1 - x0 - tw) / 2.0 - bb[0]
    ty = y0 + (y1 - y0 - th) / 2.0 - bb[1]
    dr.text((tx, ty), text, font=font, fill=fill)


def draw_text_vcentered(dr, x, y0, y1, text, font, fill, align_right=False):
    bb = dr.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = (x - tw - bb[0]) if align_right else (x - bb[0])
    ty = y0 + (y1 - y0 - th) / 2.0 - bb[1]
    dr.text((tx, ty), text, font=font, fill=fill)


def wrap_lines(dr, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        cand = f"{cur} {w}".strip()
        if dr.textlength(cand, font=font) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# 1. Decode the 3 Veo 3.1 clips to 1920x1080 30-FPS JPEG sequences
def decode_veo_clip(clip_name):
    cdir = os.path.join(TMP_FRAMES, clip_name)
    os.makedirs(cdir, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(cdir, "f_*.jpg")))
    if len(existing) < 60:
        src = os.path.join(VEO_DIR, f"{clip_name}.mp4")
        subprocess.run(
            [
                FF,
                "-loglevel",
                "error",
                "-y",
                "-i",
                src,
                "-vf",
                f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
                "-q:v",
                "2",
                os.path.join(cdir, "f_%04d.jpg"),
            ],
            check=True,
        )
        existing = sorted(glob.glob(os.path.join(cdir, "f_*.jpg")))
    print(f"Decoded {clip_name}: {len(existing)} frames @ {W}x{H}", flush=True)
    return existing


veo1_frames = decode_veo_clip("veo_01_mars_blackout")
veo2_frames = decode_veo_clip("veo_02_astronaut_kinematics")
veo3_frames = decode_veo_clip("veo_03_space_to_earth")


def get_veo_img(frames_list, local_t, subtle_zoom=0.0):
    idx = min(len(frames_list) - 1, max(0, int(round(local_t * FPS))))
    im = Image.open(frames_list[idx]).convert("RGB")
    if subtle_zoom > 0.001:
        z = 1.0 + subtle_zoom
        cw, ch = int(W / z), int(H / z)
        x0, y0 = (W - cw) // 2, (H - ch) // 2
        im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.Resampling.LANCZOS)
    return im


# Pre-build architectural studio background + cinema vignette overlay once for fast compositing
def build_studio_backdrop():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (xx - W * 0.45) / (W * 0.75)
    ny = (yy - H * 0.45) / (H * 0.75)
    r2 = np.clip(nx * nx + ny * ny, 0.0, 1.4) / 1.4
    c_center = np.array([13.0, 24.0, 46.0])
    c_edge = np.array([5.0, 9.0, 19.0])
    arr = (c_center[None, None, :] * (1.0 - r2[:, :, None]) + c_edge[None, None, :] * r2[:, :, None]).astype(np.uint8)
    bg = Image.fromarray(arr, mode="RGB")
    dr = ImageDraw.Draw(bg, "RGBA")
    for gx in range(48, W, 64):
        dr.line([(gx, 0), (gx, H)], fill=(56, 189, 248, 12), width=1)
    for gy in range(20, H, 64):
        dr.line([(0, gy), (W, gy)], fill=(56, 189, 248, 12), width=1)
    return bg


def build_cinema_vignette():
    alpha = np.zeros((H, W), dtype=np.float32)
    # Top 130px soft darkening for HUD readability
    top_h = 135
    alpha[:top_h, :] = np.linspace(155, 0, top_h)[:, None]
    # Bottom 175px soft darkening for subtitle dock readability
    bot_h = 175
    alpha[H - bot_h :, :] = np.maximum(alpha[H - bot_h :, :], np.linspace(0, 185, bot_h)[:, None])
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, 0] = 4
    rgba[:, :, 1] = 8
    rgba[:, :, 2] = 18
    rgba[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")


STUDIO_BG = build_studio_backdrop()
CINEMA_VIGNETTE = build_cinema_vignette()

# Preload Retina screenshots & hero artwork
shots = {
    "sc1": Image.open(os.path.join(SHOT_DIR, "v33_scen1_nominal.png")).convert("RGB"),
    "sc2": Image.open(os.path.join(SHOT_DIR, "v33_scen2_co2.png")).convert("RGB"),
    "sc3": Image.open(os.path.join(SHOT_DIR, "v33_scen3_squat.png")).convert("RGB"),
    "sc4": Image.open(os.path.join(SHOT_DIR, "v33_scen4_spe.png")).convert("RGB"),
    "tab2": Image.open(os.path.join(SHOT_DIR, "v33_tab2_neuro_voice.png")).convert("RGB"),
    "tab3": Image.open(os.path.join(SHOT_DIR, "v33_tab3_watch_mobile_api.png")).convert("RGB"),
    "hero_bg": Image.open(os.path.join(IMG_DIR, "hero_mars_blackout_astronaut.jpg"))
    .convert("RGB")
    .resize((W, H), Image.Resampling.LANCZOS),
}


def fit_contain(img, tw, th, bg_rgb=(248, 250, 252)):
    iw, ih = img.size
    scale = min(tw / iw, th / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg_rgb)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return canvas, (tw - nw) // 2, (th - nh) // 2, scale


# Pre-compute the Studio Stage templates for each of the 6 screenshot scenes so frame rendering is ultra-fast & crisp!
# Studio Stage Grid (1920 x 1080):
#   Outer Margin: 48 px (x = 48 .. 1872)
#   Top HUD:      x = 48 .. 1872, y = 20 .. 64
#   Left Browser: x = 48 .. 1384 (w = 1336), y = 80 .. 968 (h = 888)
#     - Chrome bar: y = 80 .. 114 (h = 34)
#     - Viewport:   x = 50 .. 1382 (w = 1332), y = 114 .. 966 (h = 852) -> 100.0% UNCROPPED 2880x1840!
#   Right Rail:   x = 1406 .. 1872 (w = 466), y = 80 .. 968 (h = 888) -> Flush top & bottom with Left Browser!
#   Subtitle Bar: x = 190 .. 1730 (w = 1540), y = 984 .. 1046 (h = 62)
#   Timeline Bar: x = 48 .. 1872, y = 1060 .. 1065 (h = 5)
STAGE_SCENES = {
    "tab3": {
        "shot": "tab3",
        "accent": (52, 211, 153),
        "kicker": "WEARABLE + MOBILE EDGE API",
        "step": (0, 0),
        "metric": "200 OK",
        "pill": "LIVE TELEMETRY FUSED",
        "title": "Apple Watch + Mobile Mesh",
        "crop_box": (72, 425, 1445, 985),
        "inset_bg": (244, 247, 252),
        "inset_label": "2X RETINA // WATCH + MOBILE PACKET",
        "rows": [
            ("ENDPOINT", "POST /api/ingest/edge-telemetry"),
            ("STREAMS", "Watch HR/HRV + 100 Hz IMU + 3D ROM"),
            ("FEEDBACK", "Triggers WKHapticType wrist cue offline"),
        ],
    },
    "sc1": {
        "shot": "sc1",
        "accent": (52, 211, 153),
        "kicker": "SCENARIO 01 / 04  |  SOL 014",
        "step": (1, 4),
        "metric": "99.2",
        "pill": "NOMINAL READINESS",
        "title": "Artemis Lunar Orbit",
        "crop_box": (1550, 665, 2845, 1195),
        "inset_bg": (248, 250, 252),
        "inset_label": "2X RETINA // 8-DOF COVARIANCE ENVELOPE",
        "rows": [
            ("STATISTICS", "D_M = 0.24  |  p = 1.000 (Inside 95%)"),
            ("TOP DRIVER", "All 8 vitals, kinematics & cabin nominal"),
            ("DIRECTIVE", "Continue scheduled ARED + 10 Hz Alpha"),
        ],
    },
    "sc2": {
        "shot": "sc2",
        "accent": (251, 191, 36),
        "kicker": "SCENARIO 02 / 04  |  SOL 088",
        "step": (2, 4),
        "metric": "78.3",
        "pill": "COVARIANCE WATCH",
        "title": "Cabin CO2 Scrubber Drift",
        "crop_box": (1550, 665, 2845, 1195),
        "inset_bg": (248, 250, 252),
        "inset_label": "2X RETINA // CO2 + PVT VARIANCE DRIVERS",
        "rows": [
            ("STATISTICS", "D_M = 3.85  |  chi2 = 14.8 (p = 0.063)"),
            ("TOP DRIVER", "PVT Latency 46.5% + ppCO2 26.3%"),
            ("DIRECTIVE", "Switch CDRA CO2 bed + 40 Hz Gamma"),
        ],
    },
    "sc3": {
        "shot": "sc3",
        "accent": (251, 113, 133),
        "kicker": "SCENARIO 03 / 04  |  SOL 142",
        "step": (3, 4),
        "metric": "44.7",
        "pill": "KINEMATIC ALERT",
        "title": "0g Squat Asymmetry + Ghost",
        "crop_box": (76, 955, 1502, 1735),
        "inset_bg": (8, 15, 30),
        "inset_label": "2X RETINA // 3D POSE vs. 1G CYAN GHOST",
        "rows": [
            ("STATISTICS", "D_M = 6.99  |  p < 0.0001 (Alert)"),
            ("TOP DRIVER", "L/R Symmetry 35.5% + Trunk Lean 24.9%"),
            ("DIRECTIVE", "Cut ARED load 15% + 16 Hz Motor RAS"),
        ],
    },
    "sc4": {
        "shot": "sc4",
        "accent": (251, 113, 133),
        "kicker": "SCENARIO 04 / 04  |  SOL 210",
        "step": (4, 4),
        "metric": "12.0",
        "pill": "SPE STORM CRITICAL",
        "title": "Solar Particle Blackout",
        "crop_box": (1550, 665, 2845, 1195),
        "inset_bg": (248, 250, 252),
        "inset_label": "2X RETINA // RADIATION + TREMOR SURGE",
        "rows": [
            ("STATISTICS", "D_M = 12.03  |  3.45 mSv/day surge"),
            ("TOP DRIVER", "Radiation 47.4% + 2.45 mm Hand Tremor"),
            ("DIRECTIVE", "Water-wall shelter + 2.5 Hz Delta Rx"),
        ],
    },
    "tab2": {
        "shot": "tab2",
        "accent": (56, 189, 248),
        "kicker": "CLOSED-LOOP THERAPY + PRIVACY",
        "step": (0, 0),
        "metric": "16 Hz",
        "pill": "BINAURAL + VOCAL DSP",
        "title": "Neuro-Acoustic Synthesizer",
        "crop_box": (76, 482, 1585, 1068),
        "inset_bg": (6, 11, 22),
        "inset_label": "2X RETINA // 64-BAND FFT + LISSAJOUS",
        "rows": [
            ("SONIFICATION", "3D joint ROM modulates filter f_c & pan"),
            ("VOCAL DSP", "85 Hz cabin filter + F0 / jitter / HNR"),
            ("PRIVACY", "3-tier role masking + <2 KB burst JSON"),
        ],
    },
}

STAGE_CACHE = {}


def build_stage_template(key):
    cfg = STAGE_SCENES[key]
    acc = cfg["accent"]
    src_img = shots[cfg["shot"]]

    canvas = STUDIO_BG.copy().convert("RGBA")

    # Soft drop shadow layer for Left Browser & Right Rail
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh_dr = ImageDraw.Draw(sh, "RGBA")
    sh_dr.rounded_rectangle([52, 86, 1388, 974], radius=16, fill=(0, 0, 0, 150))
    sh_dr.rounded_rectangle([1410, 86, 1876, 974], radius=16, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(canvas, sh)

    dr = ImageDraw.Draw(canvas, "RGBA")

    # --- LEFT COLUMN: macOS Dark-Titanium Browser Window (x=48..1384, y=80..968) ---
    bx0, by0, bx1, by1 = 48, 80, 1384, 968
    dr.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(17, 26, 46, 255), outline=(*acc, 195), width=2)

    # Browser Chrome Titlebar (y=80..114)
    dr.rounded_rectangle([bx0 + 1, by0 + 1, bx1 - 1, by0 + 34], radius=13, fill=(19, 29, 51, 255))
    dr.rectangle([bx0 + 1, by0 + 22, bx1 - 1, by0 + 34], fill=(19, 29, 51, 255))
    # Traffic light dots
    for di, dcol in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = bx0 + 22 + di * 20
        cy = by0 + 17
        dr.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(*dcol, 255))

    # Centered URL pill inside browser chrome
    ux0, uy0, ux1, uy1 = bx0 + 330, by0 + 6, bx1 - 330, by0 + 28
    dr.rounded_rectangle([ux0, uy0, ux1, uy1], radius=7, fill=(10, 17, 32, 255), outline=(56, 189, 248, 85), width=1)
    draw_text_centered(
        dr,
        (ux0, uy0, ux1, uy1),
        "astrokinetics-space-health-765428358644.us-central1.run.app",
        F_URL_CHROME,
        (203, 213, 225, 255),
    )

    # Paste 100.0% UNCROPPED Retina Screenshot into Browser Viewport (x=50..1382, y=114..964 -> 1332 x 850)
    vp_x, vp_y, vp_w, vp_h = bx0 + 2, by0 + 34, 1332, 852
    fitted_shot, ox, oy, sc = fit_contain(src_img, vp_w, vp_h, bg_rgb=(248, 250, 252))
    canvas.paste(fitted_shot.convert("RGBA"), (vp_x, vp_y))

    # Draw subtle Spotlight Reticle on the full screenshot showing where the 2x Retina Magnifier zooms in!
    dr = ImageDraw.Draw(canvas, "RGBA")
    cx0, cy0, cx1, cy1 = cfg["crop_box"]
    sx0 = int(round(vp_x + ox + cx0 * sc))
    sy0 = int(round(vp_y + oy + cy0 * sc))
    sx1 = int(round(vp_x + ox + cx1 * sc))
    sy1 = int(round(vp_y + oy + cy1 * sc))
    dr.rounded_rectangle([sx0 - 2, sy0 - 2, sx1 + 2, sy1 + 2], radius=8, outline=(*acc, 235), width=3)

    # Outer crisp border re-stroke on browser window
    dr.rounded_rectangle([bx0, by0, bx1, by1], radius=14, outline=(*acc, 200), width=2)

    # Subtle glowing bridge tick between Browser (1384) and Right Rail (1406) at Magnifier center Y (y=508)
    dr.line([(1385, 508), (1405, 508)], fill=(*acc, 200), width=3)
    dr.ellipse([1381, 504, 1389, 512], fill=(*acc, 255))
    dr.ellipse([1402, 504, 1410, 512], fill=(*acc, 255))

    # --- RIGHT COLUMN: Aerospace Telemetry & 2x Retina Magnifier Rail (x=1406..1872, y=80..968) ---
    rx0, ry0, rx1, ry1 = 1406, 80, 1872, 968
    dr.rounded_rectangle([rx0, ry0, rx1, ry1], radius=14, fill=(13, 22, 41, 248), outline=(*acc, 200), width=2)
    # Top accent bar inside rail
    dr.rounded_rectangle([rx0 + 18, ry0 + 16, rx1 - 18, ry0 + 21], radius=3, fill=(*acc, 240))

    # 1. Kicker + 4-Scenario Stepper (y=110..136)
    draw_text_vcentered(dr, rx0 + 22, ry0 + 30, ry0 + 54, cfg["kicker"], F_RAIL_LABEL, (*acc, 255))
    step_idx, step_tot = cfg["step"]
    if step_tot == 4:
        for si in range(1, 5):
            seg_x0 = rx1 - 22 - (4 - si + 1) * 26 + 4
            seg_col = (*acc, 255) if si == step_idx else ((56, 189, 248, 110) if si < step_idx else (35, 56, 94, 180))
            dr.rounded_rectangle([seg_x0, ry0 + 37, seg_x0 + 20, ry0 + 47], radius=3, fill=seg_col)

    # 2. Hero Metric + Pill + Scene Title Card (y=144..340)
    hx0, hy0, hx1, hy1 = rx0 + 18, ry0 + 64, rx1 - 18, ry0 + 258
    dr.rounded_rectangle([hx0, hy0, hx1, hy1], radius=12, fill=(18, 31, 56, 255), outline=(35, 56, 94, 220), width=1)
    draw_text_vcentered(dr, hx0 + 18, hy0 + 14, hy0 + 96, cfg["metric"], F_SCORE, (*acc, 255))

    # Status pill right of metric (or below if wide metric)
    px0, py0, px1, py1 = hx0 + 18, hy0 + 102, hx1 - 18, hy0 + 134
    dr.rounded_rectangle([px0, py0, px1, py1], radius=8, fill=(10, 18, 34, 255), outline=(*acc, 180), width=1)
    draw_text_centered(dr, (px0, py0, px1, py1), cfg["pill"], F_PILL, (*acc, 255))

    draw_text_vcentered(dr, hx0 + 18, hy0 + 142, hy0 + 182, cfg["title"], F_RAIL_TITLE, (248, 250, 252, 255))

    # 3. 2x Retina Magnifier Inset Card (y=354..658 -> height=304)
    ix0, iy0, ix1, iy1 = rx0 + 18, ry0 + 274, rx1 - 18, ry0 + 576
    dr.rounded_rectangle([ix0, iy0, ix1, iy1], radius=12, fill=(18, 31, 56, 255), outline=(*acc, 175), width=2)
    draw_text_vcentered(dr, ix0 + 14, iy0 + 8, iy0 + 34, cfg["inset_label"], F_RAIL_LABEL, (148, 163, 184, 255))

    raw_crop = src_img.crop(cfg["crop_box"])
    inset_w, inset_h = (ix1 - ix0 - 16), (iy1 - iy0 - 46)
    fitted_inset, _, _, _ = fit_contain(raw_crop, inset_w, inset_h, bg_rgb=cfg["inset_bg"])
    canvas.paste(fitted_inset.convert("RGBA"), (ix0 + 8, iy0 + 38))
    dr = ImageDraw.Draw(canvas, "RGBA")
    dr.rounded_rectangle([ix0 + 7, iy0 + 37, ix0 + 8 + inset_w + 1, iy0 + 38 + inset_h + 1], radius=7, outline=(35, 56, 94, 220), width=1)

    # 4. Structured Clinical Math & NASA-STD-3001 Directive Card (y=672..950 -> height=278)
    dx0, dy0, dx1, dy1 = rx0 + 18, ry0 + 592, rx1 - 18, ry1 - 18
    dr.rounded_rectangle([dx0, dy0, dx1, dy1], radius=12, fill=(18, 31, 56, 255), outline=(35, 56, 94, 220), width=1)

    cur_y = dy0 + 14
    for r_idx, (r_lbl, r_val) in enumerate(cfg["rows"]):
        lbl_col = acc if r_idx == 2 else (56, 189, 248)
        draw_text_vcentered(dr, dx0 + 16, cur_y, cur_y + 20, r_lbl, F_RAIL_LABEL, (*lbl_col, 255))
        cur_y += 22
        val_font = F_RAIL_BOLD if r_idx == 2 else F_RAIL_BODY
        val_col = (248, 250, 252, 255) if r_idx == 2 else (226, 232, 240, 255)
        for ln in wrap_lines(dr, r_val, val_font, dx1 - dx0 - 32):
            draw_text_vcentered(dr, dx0 + 16, cur_y, cur_y + 23, ln, val_font, val_col)
            cur_y += 23
        cur_y += 12
        if r_idx < 2:
            dr.line([(dx0 + 16, cur_y - 6), (dx1 - 16, cur_y - 6)], fill=(35, 56, 94, 180), width=1)

    return canvas.convert("RGB")


for k in STAGE_SCENES:
    STAGE_CACHE[k] = build_stage_template(k)
print("Pre-rendered 6 aligned Studio Browser + 2x Retina Magnifier templates.", flush=True)


# Pre-build Symmetric Finale Hero End Card (Left & Right columns BOTH span y = 240 .. 840 exact!)
def build_end_card():
    base = shots["hero_bg"].copy()
    blurred = base.filter(ImageFilter.GaussianBlur(4))
    rgba = blurred.convert("RGBA")
    ov = Image.new("RGBA", (W, H), (6, 11, 23, 214))
    rgba = Image.alpha_composite(rgba, ov)

    # Symmetric 2-column geometry:
    #   Top margin = 240 px, Bottom margin = 240 px (y = 240 .. 840, height = 600 px)
    #   Left margin = 84 px, Right margin = 84 px
    #   Left Hero Column:  x = 84 .. 924  (w = 840), y = 240 .. 840 (h = 600)
    #   Right Browser Win: x = 964 .. 1836 (w = 872), y = 240 .. 840 (h = 600)
    #     -> Chrome bar 34 px + Viewport 868 x 564 (868/564 = 1.539 vs 1.565 -> 100% uncropped!)

    # Drop shadow behind Right Browser & Left URL box
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh_dr = ImageDraw.Draw(sh, "RGBA")
    sh_dr.rounded_rectangle([968, 246, 1842, 848], radius=16, fill=(0, 0, 0, 175))
    sh_dr.rounded_rectangle([88, 730, 928, 846], radius=14, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    rgba = Image.alpha_composite(rgba, sh)

    dr = ImageDraw.Draw(rgba, "RGBA")

    # --- LEFT HERO COLUMN (x = 84 .. 924, y = 240 .. 840) ---
    # 1. Event Badge (y = 240 .. 288)
    dr.rounded_rectangle([84, 240, 624, 288], radius=10, fill=(17, 29, 52, 242), outline=(56, 189, 248, 210), width=2)
    draw_text_centered(dr, (84, 240, 624, 288), "2026 NASA SPACE APPS CHALLENGE  |  HOUSTON", F_END_PILL, (56, 189, 248, 255))

    # 2. Hero Title (y = 312 .. 400)
    draw_text_vcentered(dr, 84, 312, 398, "AstroKinetics", F_HERO, (248, 250, 252, 255))

    # 3. 2-Line Subtitle (y = 414 .. 496)
    draw_text_vcentered(dr, 84, 414, 452, "Autonomous 3D Neuromotor, Multi-Sensor &", F_HERO_SUB, (56, 189, 248, 255))
    draw_text_vcentered(dr, 84, 456, 494, "Neuro-Acoustic Crew Health Suite", F_HERO_SUB, (56, 189, 248, 255))

    # 4. 3 Provenance Pills Row (y = 532 .. 576, exact total width = 840 px!)
    pills = [
        ("NASA OSDR OSD-571", (52, 211, 153), (6, 78, 59), 268),
        ("8-DOF MAHALANOBIS", (56, 189, 248), (12, 74, 110), 268),
        ("100% OFFLINE PWA", (251, 191, 36), (120, 53, 15), 268),
    ]
    px = 84
    for pl_txt, pl_col, pl_bg, pl_w in pills:
        dr.rounded_rectangle([px, 532, px + pl_w, 576], radius=9, fill=(*pl_bg, 235), outline=(*pl_col, 215), width=2)
        draw_text_centered(dr, (px, 532, px + pl_w, 576), pl_txt, F_END_PILL, (*pl_col, 255))
        px += pl_w + 18  # 268*3 + 18*2 = 840 exact!

    # 5. Supporting Capability Line (y = 608 .. 684)
    draw_text_vcentered(
        dr,
        84,
        610,
        642,
        "478-pt FaceMesh rPPG  |  3D Pose + 1g Ghost  |  Watch & Mobile API",
        F_HUD,
        (226, 232, 240, 255),
    )
    draw_text_vcentered(
        dr,
        84,
        648,
        680,
        "Closed-Loop Binaural Therapy  |  Artemis, Mars & Rural Clinics",
        F_HUD,
        (148, 163, 184, 255),
    )

    # 6. Emerald Live Cloud Run URL Box (y = 724 .. 840 -> exact bottom y = 840!)
    dr.rounded_rectangle([84, 724, 924, 840], radius=12, fill=(14, 25, 46, 248), outline=(52, 211, 153, 235), width=3)
    dr.rounded_rectangle([84, 724, 96, 840], radius=6, fill=(52, 211, 153, 255))
    draw_text_vcentered(
        dr,
        116,
        738,
        770,
        "LIVE ZERO-INSTALL CLOUD RUN DEPLOYMENT (APACHE-2.0):",
        F_END_PILL,
        (52, 211, 153, 255),
    )
    draw_text_vcentered(
        dr,
        116,
        780,
        822,
        "astrokinetics-space-health-765428358644.us-central1.run.app",
        F_END_URL,
        (248, 250, 252, 255),
    )

    # --- RIGHT MACOS BROWSER PREVIEW WINDOW (x = 964 .. 1836, y = 240 .. 840 -> exact top & bottom match!) ---
    rbx0, rby0, rbx1, rby1 = 964, 240, 1836, 840
    dr.rounded_rectangle([rbx0, rby0, rbx1, rby1], radius=14, fill=(19, 29, 51, 255), outline=(52, 211, 153, 225), width=2)
    for di, dcol in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = rbx0 + 22 + di * 18
        cy = rby0 + 17
        dr.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(*dcol, 255))
    dr.rounded_rectangle([rbx0 + 160, rby0 + 6, rbx1 - 160, rby0 + 28], radius=6, fill=(10, 17, 32, 255))
    draw_text_centered(
        dr,
        (rbx0 + 160, rby0 + 6, rbx1 - 160, rby0 + 28),
        "astrokinetics-space-health-765428358644.us-central1.run.app",
        F_URL_CHROME,
        (203, 213, 225, 255),
    )

    mini_vp, _, _, _ = fit_contain(shots["sc3"], 868, 564, bg_rgb=(248, 250, 252))
    rgba.paste(mini_vp.convert("RGBA"), (rbx0 + 2, rby0 + 34))
    dr = ImageDraw.Draw(rgba, "RGBA")
    dr.rounded_rectangle([rbx0, rby0, rbx1, rby1], radius=14, outline=(52, 211, 153, 230), width=2)

    return rgba.convert("RGB")


END_CARD_IMG = build_end_card()


# 2. Build Master Audio Mix (Grok Voice 'lumen' + Space Ambient Chord Underscore)
script = json.load(open(os.path.join(PKG, "video_script.json")))

SPEECH_STARTS = {
    "s1_problem": 0.35,   # ends ~4.70s (Scene 1: 0.00 - 5.15s)
    "s2_gather": 5.35,    # ends ~11.39s (Scene 2: 5.15 - 11.75s)
    "s3_evaluate": 11.95, # ends ~19.14s (Scene 3: 11.75 - 19.50s)
    "s4_act": 19.70,      # ends ~24.78s (Scene 4: 19.50 - 25.30s; End Card: 25.30 - 27.80s)
}

n_samples = int(round(TOTAL_SEC * SR))
voice_track = np.zeros(n_samples, dtype=np.float64)
srt_entries = []

for idx, seg in enumerate(script, start=1):
    sid = seg["id"]
    wav_p = os.path.join(AUDIO_DIR, f"{sid}.wav")
    with wave.open(wav_p) as wf:
        pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    t0 = SPEECH_STARTS[sid]
    i0 = int(round(t0 * SR))
    clip_len = min(len(pcm), n_samples - i0)
    voice_track[i0 : i0 + clip_len] += pcm[:clip_len]
    t1 = t0 + clip_len / SR
    srt_entries.append((idx, t0, t1 + 0.25, seg["subtitle"]))


def fmt_srt_time(sec):
    ms = int(round((sec - math.floor(sec)) * 1000))
    if ms >= 1000:
        sec += 1.0
        ms = 0
    s = int(sec) % 60
    m = (int(sec) // 60) % 60
    return f"00:{m:02d}:{s:02d},{ms:03d}"


srt_lines = []
for idx, t0, t1, sub in srt_entries:
    srt_lines.append(f"{idx}\n{fmt_srt_time(t0)} --> {fmt_srt_time(min(TOTAL_SEC - 0.1, t1))}\n{sub}\n")
open(os.path.join(PKG, "AstroKinetics_30s_SpaceApps_Demo.srt"), "w").write("\n".join(srt_lines))

tt = np.arange(n_samples) / SR
chords = [
    [130.81, 196.00, 246.94, 293.66],
    [110.00, 164.81, 246.94, 261.63],
    [87.31, 174.61, 220.00, 261.63],
    [98.00, 146.83, 196.00, 329.63],
]
pad = np.zeros(n_samples, dtype=np.float64)
seg_len = TOTAL_SEC / 4.0
for k, ch in enumerate(chords):
    a = int(k * seg_len * SR)
    b = min(n_samples, int((k + 1) * seg_len * SR + 0.8 * SR))
    loc = tt[a:b] - tt[a]
    dur_loc = tt[b - 1] - tt[a] + 1e-6
    env = np.minimum(1.0, loc / 0.9) * np.minimum(1.0, (dur_loc - loc) / 0.9)
    for f in ch:
        pad[a:b] += env * (np.sin(2 * np.pi * f * tt[a:b]) + 0.25 * np.sin(2 * np.pi * 2 * f * tt[a:b] + 0.4))

pad /= np.max(np.abs(pad)) + 1e-9
gain_curve = np.where(tt > 24.9, 0.11, 0.055) * np.minimum(1.0, tt / 0.6) * np.minimum(1.0, (TOTAL_SEC - tt) / 1.1)
mix = (voice_track / (np.max(np.abs(voice_track)) + 1e-9)) * 0.90 + pad * gain_curve

mix_wav = os.path.join(AUDIO_DIR, "demo_30s_mix.wav")
with wave.open(mix_wav, "w") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes((np.clip(mix, -1.0, 1.0) * 32767).astype(np.int16).tobytes())


# 3. Clean Cinema & Studio Scene Renderers + Smoothstep Transitions
def smoothstep(edge0, edge1, x):
    u = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0 + 1e-9)))
    return u * u * (3.0 - 2.0 * u)


def draw_floating_sensor_pill(rgba_img, box, dot_rgb, text):
    dr = ImageDraw.Draw(rgba_img, "RGBA")
    x0, y0, x1, y1 = box
    dr.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=(7, 13, 26, 218), outline=(*dot_rgb, 210), width=2)
    cy = (y0 + y1) // 2
    dr.ellipse([x0 + 14, cy - 6, x0 + 26, cy + 6], fill=(*dot_rgb, 255))
    draw_text_vcentered(dr, x0 + 38, y0, y1, text, F_PILL, (248, 250, 252, 255))


def render_veo_scene(frames_list, local_t, dur, sensor_pills=None):
    im = get_veo_img(frames_list, local_t, subtle_zoom=0.025 * min(1.0, local_t / max(0.1, dur))).convert("RGBA")
    im = Image.alpha_composite(im, CINEMA_VIGNETTE)
    if sensor_pills:
        for box, col, txt in sensor_pills:
            draw_floating_sensor_pill(im, box, col, txt)
    return im.convert("RGB")


def apply_outer_chrome(img_rgb, top_left, top_right, badge_rgb, subtitle_text, progress01):
    rgba = img_rgb.convert("RGBA")
    dr = ImageDraw.Draw(rgba, "RGBA")

    # Top Aerospace HUD Bar (strictly aligned x = 48 .. 1872, y = 20 .. 64)
    dr.rounded_rectangle([48, 20, 1872, 64], radius=10, fill=(8, 15, 29, 232), outline=(56, 189, 248, 135), width=2)
    dr.ellipse([66, 35, 80, 49], fill=(*badge_rgb, 255))
    draw_text_vcentered(dr, 94, 20, 64, top_left, F_HUD, (248, 250, 252, 255))
    draw_text_vcentered(dr, 1852, 20, 64, top_right, F_HUD, (*badge_rgb, 255), align_right=True)

    # Consistent Centered Subtitle Dock (x = 190 .. 1730, y = 984 .. 1046)
    if subtitle_text:
        dr.rounded_rectangle([190, 984, 1730, 1046], radius=12, fill=(6, 11, 22, 240), outline=(56, 189, 248, 160), width=2)
        draw_text_centered(dr, (190, 984, 1730, 1046), subtitle_text, F_SUBTITLE, (248, 250, 252, 255))

    # Full-Grid Rounded Timeline Track (x = 48 .. 1872, y = 1060 .. 1065)
    dr.rounded_rectangle([48, 1060, 1872, 1065], radius=2, fill=(24, 38, 66, 210))
    fill_w = max(8, int(round(1824 * max(0.0, min(1.0, progress01)))))
    dr.rounded_rectangle([48, 1060, 48 + fill_w, 1065], radius=2, fill=(*badge_rgb, 245))

    return rgba.convert("RGB")


# Timeline definition of 9 visual shots across 27.80s:
#   0: 0.00 -  5.15s  Veo 1 (Mars Habitat Squat + Cyan Skeleton)
#   1: 5.15 -  8.25s  Veo 2 (Astronaut 478-pt FaceMesh + Smartwatch — NO ugly chin PiP!)
#   2: 8.25 - 11.75s  Studio Stage: Tab 3 (Apple Watch + Mobile REST API)
#   3: 11.75 - 13.68s Studio Stage: Scenario 1 (Sol 014 Nominal 99.2)
#   4: 13.68 - 15.62s Studio Stage: Scenario 2 (Sol 088 Cabin CO2 78.3)
#   5: 15.62 - 17.56s Studio Stage: Scenario 3 (Sol 142 0g Squat + 1g Ghost 44.7)
#   6: 17.56 - 19.50s Studio Stage: Scenario 4 (Sol 210 SPE Radiation Storm 12.0)
#   7: 19.50 - 22.25s Studio Stage: Tab 2 (Closed-Loop Neuro-Acoustic + Vocal DSP)
#   8: 22.25 - 25.30s Veo 3 (Space-to-Earth Rural Alaskan Clinic Dual-Use)
#   9: 25.30 - 27.80s Symmetric Finale Hero End Card
SHOT_SPANS = [
    (0.00, 5.15, "veo1"),
    (5.15, 8.25, "veo2"),
    (8.25, 11.75, "tab3"),
    (11.75, 13.6875, "sc1"),
    (13.6875, 15.625, "sc2"),
    (15.625, 17.5625, "sc3"),
    (17.5625, 19.50, "sc4"),
    (19.50, 22.25, "tab2"),
    (22.25, 25.30, "veo3"),
    (25.30, 27.81, "end"),
]


def render_single_shot(shot_id, global_t, t0, t1):
    lt = max(0.0, global_t - t0)
    dur = t1 - t0
    p01 = global_t / TOTAL_SEC

    if shot_id == "veo1":
        bg = render_veo_scene(veo1_frames, lt, dur)
        return apply_outer_chrome(
            bg,
            "SOL 142 // MARS TRANSIT HABITAT  |  44-MIN EARTH BLACKOUT",
            "ZERO LIVE FLIGHT SURGEON",
            (251, 113, 133),
            script[0]["subtitle"],
            p01,
        )

    if shot_id == "veo2":
        # Non-occluding sensor callout pills positioned cleanly in open background negative space
        pills = [
            ((48, 86, 560, 132), (56, 189, 248), "478-PT FACEMESH  |  3-ZONE POS-rPPG"),
            ((48, 916, 560, 962), (52, 211, 153), "APPLE WATCH ULTRA  |  100 HZ WRIST IMU"),
        ]
        bg = render_veo_scene(veo2_frames, lt, dur, sensor_pills=pills)
        return apply_outer_chrome(
            bg,
            "GATHER // CONTACTLESS FACIAL rPPG + 3D POSE + WEARABLE MESH",
            "100% ON-DEVICE EDGE AI",
            (56, 189, 248),
            script[1]["subtitle"],
            p01,
        )

    if shot_id == "tab3":
        return apply_outer_chrome(
            STAGE_CACHE["tab3"],
            "GATHER // CONNECTED APPLE WATCH ULTRA + MOBILE KINEMATICS REST API",
            "OPENAPI /DOCS LIVE",
            (52, 211, 153),
            script[1]["subtitle"],
            p01,
        )

    if shot_id in ("sc1", "sc2", "sc3", "sc4"):
        hud_right_map = {
            "sc1": "SOL 014  |  NOMINAL 99.2",
            "sc2": "SOL 088  |  CO2 WATCH 78.3",
            "sc3": "SOL 142  |  0G SQUAT 44.7",
            "sc4": "SOL 210  |  SPE STORM 12.0",
        }
        return apply_outer_chrome(
            STAGE_CACHE[shot_id],
            "EVALUATE OFFLINE // 8-DOF MAHALANOBIS + NASA OSDR OSD-571",
            hud_right_map[shot_id],
            STAGE_SCENES[shot_id]["accent"],
            script[2]["subtitle"],
            p01,
        )

    if shot_id == "tab2":
        return apply_outer_chrome(
            STAGE_CACHE["tab2"],
            "ACT // NASA-STD-3001 DIRECTIVES + CLOSED-LOOP NEURO-ACOUSTIC DSP",
            "3-TIER CREW PRIVACY",
            (56, 189, 248),
            script[3]["subtitle"],
            p01,
        )

    if shot_id == "veo3":
        bg = render_veo_scene(veo3_frames, lt, dur)
        return apply_outer_chrome(
            bg,
            "SPACE-TO-EARTH DUAL USE // ARTEMIS, MARS & OFFLINE RURAL CLINICS",
            "ZERO CLOUD PHI",
            (52, 211, 153),
            script[3]["subtitle"],
            p01,
        )

    # Symmetric Finale Hero End Card (with subtle top HUD & timeline completion bar!)
    end_rgba = END_CARD_IMG.convert("RGBA")
    dr = ImageDraw.Draw(end_rgba, "RGBA")
    dr.rounded_rectangle([48, 1060, 1872, 1065], radius=2, fill=(52, 211, 153, 245))
    return end_rgba.convert("RGB")


TRANS_HALF = 0.16  # 0.32s butter-smooth cross-dissolve across every cut!


def render_frame_at(t):
    cur_idx = len(SHOT_SPANS) - 1
    for i, (t0, t1, _) in enumerate(SHOT_SPANS):
        if t < t1:
            cur_idx = i
            break

    t0, t1, sid = SHOT_SPANS[cur_idx]
    base_img = render_single_shot(sid, t, t0, t1)

    # Smooth cross-dissolve from previous shot during [t0, t0 + TRANS_HALF]
    if cur_idx > 0 and (t - t0) < TRANS_HALF:
        pt0, pt1, psid = SHOT_SPANS[cur_idx - 1]
        prev_img = render_single_shot(psid, t, pt0, pt1)
        alpha = smoothstep(-TRANS_HALF, TRANS_HALF, t - t0)
        return Image.blend(prev_img, base_img, alpha)

    # Smooth cross-dissolve into next shot during [t1 - TRANS_HALF, t1]
    if cur_idx < len(SHOT_SPANS) - 1 and (t1 - t) < TRANS_HALF:
        nt0, nt1, nsid = SHOT_SPANS[cur_idx + 1]
        next_img = render_single_shot(nsid, t, nt0, nt1)
        alpha = smoothstep(-TRANS_HALF, TRANS_HALF, t - t1)
        return Image.blend(base_img, next_img, alpha)

    return base_img


# 4. Encode H.264 1080p 30-FPS MP4 with AAC audio (+faststart)
out_mp4 = os.path.join(PKG, "AstroKinetics_30s_SpaceApps_Demo.mp4")
enc = subprocess.Popen(
    [
        FF,
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        mix_wav,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        out_mp4,
    ],
    stdin=subprocess.PIPE,
)

for f_idx in range(TOTAL_FRAMES):
    frame_img = render_frame_at(f_idx / FPS)
    enc.stdin.write(frame_img.tobytes())
    if f_idx % 150 == 0 or f_idx == TOTAL_FRAMES - 1:
        print(f"  Rendered frame {f_idx + 1}/{TOTAL_FRAMES} ({(f_idx + 1) / FPS:.2f}s)", flush=True)

enc.stdin.close()
rc = enc.wait()
assert rc == 0, f"ffmpeg exited with {rc}"
print(
    f"SUCCESSFULLY WROTE v3 {out_mp4} ({os.path.getsize(out_mp4) / (1024 * 1024):.2f} MB, {TOTAL_SEC:.2f}s <= 30.0s!)",
    flush=True,
)
