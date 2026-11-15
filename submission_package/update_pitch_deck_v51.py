"""
Bring the 7-slide pitch deck up to the v5.1 portal without changing its design or slide count.

Edits AstroKinetics_7Slide_Pitch_Deck.pptx in place (the v3.4 original is kept alongside as
AstroKinetics_7Slide_Pitch_Deck_v34.pptx): swaps three screenshots for live v5.1 captures and
updates the text and speaker notes that changed.

  uv run --no-project --python 3.12 --with python-pptx --with pillow python update_pitch_deck_v51.py <dir with screenshots>
"""
import io
import shutil
import sys
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.util import Pt

PKG = Path(__file__).resolve().parent
SHOTS = Path(sys.argv[1])
DECK = PKG / "AstroKinetics_7Slide_Pitch_Deck.pptx"
BACKUP = PKG / "AstroKinetics_7Slide_Pitch_Deck_v34.pptx"
if not BACKUP.exists():
    shutil.copy2(DECK, BACKUP)
prs = Presentation(str(BACKUP))
assert len(prs.slides) == 7


def shape(slide_no, shape_id):
    return next(sh for sh in prs.slides[slide_no - 1].shapes if sh.shape_id == shape_id)


def set_text(slide_no, shape_id, *paragraphs, size=None):
    """Replace paragraph text, keeping each paragraph's first-run formatting."""
    pars = shape(slide_no, shape_id).text_frame.paragraphs
    assert len(pars) >= len(paragraphs), (slide_no, shape_id)
    for par, text in zip(pars, paragraphs):
        if text is None:
            continue
        first, *rest = par.runs
        first.text = text
        for run in rest:
            run._r.getparent().remove(run._r)
        if size:
            first.font.size = Pt(size)


def set_image(slide_no, shape_id, source, anchor="left", top=0.0):
    """Swap a picture's pixels for a crop of `source` with the same aspect ratio as its frame."""
    pic = shape(slide_no, shape_id)
    want = pic.width / pic.height
    im = Image.open(SHOTS / source).convert("RGB")
    w, h = im.size
    if w / h > want:                       # too wide: trim the sides
        nw = int(round(h * want))
        x0 = 0 if anchor == "left" else (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, h))
    else:                                  # too tall: keep the part starting at `top`
        nh = int(round(w / want))
        y0 = int(round((h - nh) * top))
        im = im.crop((0, y0, w, y0 + nh))
    im.thumbnail((2200, 2200), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    part = pic.part.related_part(pic._element.blip_rId)
    assert part.partname.endswith(".png"), part.partname
    part._blob = buf.getvalue()
    pic.crop_left = pic.crop_right = pic.crop_top = pic.crop_bottom = 0


def set_image_box(slide_no, shape_id, source, box, keep="height", align="left"):
    """Show an exact crop (fractions of the source) and resize the frame to its aspect, so nothing is cut mid-panel.

    keep="height" keeps the frame height and centres or left-aligns the new width inside the old frame;
    keep="width" keeps the width and anchors the frame to its old bottom edge ("bottom") or top edge ("top").
    """
    pic = shape(slide_no, shape_id)
    im = Image.open(SHOTS / source).convert("RGB")
    w, h = im.size
    im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    aspect = im.size[0] / im.size[1]
    left, top, width, height = pic.left, pic.top, pic.width, pic.height
    if keep == "height":
        new_w = int(height * aspect)
        pic.left = left + (width - new_w) // 2 if align == "center" else left
        pic.width = new_w
    else:
        new_h = int(width / aspect)
        if align == "bottom":
            pic.top = top + (height - new_h)
        pic.height = new_h
    # each screenshot sits on a frame rectangle: move and resize it with the picture
    tol = int(0.12 * 914400)
    for other in prs.slides[slide_no - 1].shapes:
        if other.shape_id == shape_id:
            continue
        if (abs(other.left - left) < tol and abs(other.top - top) < tol
                and abs(other.width - width) < 2 * tol and abs(other.height - height) < 2 * tol):
            pad_l, pad_t = left - other.left, top - other.top
            pad_w, pad_h = other.width - width, other.height - height
            other.left, other.top = pic.left - pad_l, pic.top - pad_t
            other.width, other.height = pic.width + pad_w, pic.height + pad_h
    im.thumbnail((2400, 2400), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    part = pic.part.related_part(pic._element.blip_rId)
    assert part.partname.endswith(".png"), part.partname
    part._blob = buf.getvalue()
    pic.crop_left = pic.crop_right = pic.crop_top = pic.crop_bottom = 0


def move(slide_no, shape_id, dy_in=0.0):
    sh = shape(slide_no, shape_id)
    sh.top = sh.top + int(dy_in * 914400)


def set_notes(slide_no, text):
    prs.slides[slide_no - 1].notes_slide.notes_text_frame.text = text


# ---- 1. title
set_text(1, 4, "AstroKinetics · ASTRA", size=34)
set_text(1, 6, "A cabin camera, a watch and a phone feed one personal-baseline model, shown on a 3D body map. "
               "It tells the crew what is drifting, why, and what to do now — with no cloud and no flight surgeon on the line.")
set_text(1, 13, "LIVE APP — NO INSTALL  ·  30-SECOND VIDEO AT /video", None)
set_image_box(1, 15, "bodymap_orbit.png", (0, 0, 1, 1), keep="width", align="bottom")
# team mark, top right of the title panel
from pptx.util import Inches
prs.slides[0].shapes.add_picture(str(PKG / "assets" / "brand" / "ai-med-mark.png"), Inches(4.52), Inches(0.27), width=Inches(0.66))
set_notes(1, "AstroKinetics and ASTRA together are an offline health co-pilot for deep-space crews. On the way to Mars a question to "
             "Earth takes up to 44 minutes round trip, so the crew has to notice and handle health drift on their own. A cabin camera, "
             "a watch and a phone feed one model of each astronaut's own baseline, shown on a 3D body map, and drift becomes a concrete "
             "action. The app is live at the URL on the slide, and a 30-second video is at slash video.")

# ---- 3. gather
set_text(3, 3, "Gather: one camera, one watch, one phone")
set_image_box(3, 5, "bodymap.png", (0, 0, 0.5695, 1), keep="height", align="center")
set_text(3, 6, "Crew Body Map: nine live readings from the watch, phone and camera on a 3D anatomical body, with a gravity fluid-shift view.")
set_text(3, 18, "Watch + iPhone companion", "16 measures a day build a personal baseline, then move it into orbit")
set_notes(3, "We gather with hardware a crew already has. The camera gives a contactless pulse from the face, 3D body pose compared against "
             "the astronaut's own pre-flight baseline, and hand tremor. A watch and a phone add sixteen daily measures that build a personal "
             "baseline on Earth and move it into orbit. Every reading lands on one 3D body map; switching gravity off shows why fluid shifts "
             "toward the head. That view is an illustration on real anatomy, not a simulation. All vision runs on the device.")

# ---- 4. evaluate
set_text(4, 10, "Red flags first: 8 emergency patterns are checked before anything else. Then 8 signals → distance from the pre-flight "
                "cloud (Mahalanobis) → χ² p-value → each signal’s share of the drift names the cause.")

# ---- 5. act
set_text(5, 3, "Act now: red flags first, a ranked directive, a voice")
set_image_box(5, 7, "verdict.png", (0, 0, 1, 0.585), keep="width", align="top")
move(5, 8, -0.22)
set_text(5, 8, "Triage result: acuity gauge, decision path and the matched emergency protocol.")
set_text(5, 14, "Voice assistant", "Six languages, hands-free; it explains and navigates, it never decides triage")
set_notes(5, "Emergency patterns are checked first, in well under a tenth of a second; the rule engine decides and a machine-learning model "
             "is shown only for comparison. Every finding becomes one ranked directive with a NASA-STD-3001 or HRP reference; here, cut "
             "unilateral ARED load by 15 percent and add rhythmic auditory cueing. A voice assistant answers in six languages and can "
             "navigate the portal, but it never makes the triage decision. Privacy has three tiers, and only a packet under 2 KB goes to Earth.")

# ---- 7. space to Earth
set_text(7, 9, "TRY IT NOW", None, "30-second video: /video   ·   API docs: /docs   ·   Code: github.com/x1jiang/astrokinetics")
set_notes(7, "What protects a crew 44 light-minutes from help also works in a rural clinic with no broadband: the same phone camera and "
             "watch, the same baseline model, and no patient video leaving the room. Every answer in the evidence tab shows its source "
             "and its limit. The app is live; the 30-second video is at slash video; the code is on GitHub; the NASA data is OSDR OSD-571. Thank you.")

assert len(prs.slides) == 7
prs.save(str(DECK))
print("saved", DECK.name, f"{DECK.stat().st_size / 1e6:.1f} MB, slides: {len(prs.slides)}")
