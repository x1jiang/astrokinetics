"""
Builds Space_Apps_Portal_Form_Answers.docx: every question on the NASA Space Apps project
submission form with the answer to paste, for AstroKinetics · ASTRA v5.1.

  uv run --no-project --python 3.12 --with python-docx python build_portal_answers_docx.py
"""
import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

PKG = Path(__file__).resolve().parent
OUT = PKG / "Space_Apps_Portal_Form_Answers.docx"
APP = "https://astrokinetics-space-health-765428358644.us-central1.run.app"
REPO = "https://github.com/x1jiang/astrokinetics"

NAVY = RGBColor(0x0B, 0x1F, 0x3A)
ACCENT = RGBColor(0x0B, 0x57, 0xD0)
MUTED = RGBColor(0x52, 0x62, 0x7A)

PROJECT_NAME = "AstroKinetics · ASTRA: Autonomous 3D Crew Health Workstation with a Watch + iPhone Companion"

SUMMARY = (
    "On Artemis lunar stays and Mars transits, a question to Earth can take 44 minutes to answer, so the crew must be its own "
    "clinic. AstroKinetics · ASTRA is an offline-first web workstation that helps astronauts gather, evaluate and act on health "
    "drift without a flight surgeon on the line. A cabin camera tracks movement, tremor and pulse in 3D; a watch and a phone learn "
    "each astronaut's personal baseline on Earth and move it into orbit. Every signal lands on one 3D body map. An emergency "
    "red-flag gate runs first, then an 8-signal multivariate model anchored to NASA OSDR OSD-571 separates environmental from "
    "physiological causes and proposes NASA-STD-3001 countermeasures, with every answer showing its source and its limits."
)

LINKS = [
    ("Live application (no install)", APP),
    ("Project demo: 30-second video", f"{APP}/video"),
    ("Code repository (MIT)", REPO),
    ("3D Crew Body Map and triage", f"{APP}/?tab=triage"),
    ("Watch + iPhone companion", f"{APP}/?tab=demo"),
    ("Cited evidence engine", f"{APP}/?tab=evidence"),
    ("Orbital story", f"{APP}/story"),
    ("REST API documentation", f"{APP}/docs"),
]

# Field 4: (kind, text). kind: h = sub-heading, p = paragraph, b = bullet. **bold** is honoured.
DESCRIPTION = [
    ("h", "1. The problem: 44-minute delays and NASA's five hazards at once"),
    ("p", "Deep-space exploration breaks Earth-tethered telemedicine. On the lunar far side, in Mars transit (up to 22 minutes one way, 44 minutes round trip) and during two-week solar-conjunction blackouts, astronauts face NASA's five hazards of human spaceflight together: radiation, altered gravity, a closed environment, isolation, and distance from Earth. Symptoms overlap. Slower reactions and a mild tremor could come from a failing CO2 scrubber, microgravity deconditioning, lost sleep, or a solar particle event. The crew needs an onboard co-pilot that separates those causes and guides the next action with no link to Earth."),
    ("h", "2. How it works"),
    ("b", "**Gather.** Three on-device vision models (478-point face mesh, 33-joint 3D pose, 21-joint hands) read a contactless pulse, 3D movement against the astronaut's own pre-flight baseline, and hand tremor from an ordinary camera. No video leaves the device. A watch and a phone add sixteen daily measures; a REST endpoint accepts wearable, phone and habitat data such as cabin CO2 and radiation dose."),
    ("b", "**One body map.** Every reading is shown on a 3D anatomical Crew Body Map (skeleton, heart, arteries, muscles) with sensor callouts. A gravity switch shows why fluid shifts toward the head in orbit. The pulse wave and the gravity view are illustrations on real anatomy, not simulations."),
    ("b", "**A personal normal that travels.** The ASTRA companion learns one astronaut's baseline over fourteen days on Earth, then moves the expected ranges into orbit, so a normal adaptation is not raised as an alarm."),
    ("b", "**Evaluate offline.** Eight emergency red-flag patterns are checked first. An eight-signal state is then compared with the astronaut's own pre-flight covariance (Mahalanobis distance, chi-square p-value), and each signal's share of the drift names the likely cause. A rule engine decides; a machine-learning model is shown only for comparison. Validated on four mission scenarios: nominal lunar orbit (99.2/100), cabin CO2 drift (78.3), squat compensation (44.7) and a solar particle event (12.0)."),
    ("b", "**Act.** Each finding becomes one ranked directive tied to NASA-STD-3001 or Human Research Program guidance, with closed-loop audio cueing and wrist haptics. Follow-up is tracked as an episode whose states are never merged: a dismissed reminder is not a completed task, a bad capture is not a normal one, and a sync is not a human review."),
    ("b", "**Evidence with limits.** A cited evidence engine answers only from a bundled corpus (16 concepts, 70 reviewed sources, 15 device studies, 572 NASA space-biology papers), shows the source and the stated limitation of every finding, and declines clinical requests such as diagnosis or prescribing."),
    ("b", "**Privacy and downlink.** Three privacy tiers protect personal notes, and a packet under 2 KB is queued for Earth when contact resumes. The app is a Progressive Web App that keeps working offline."),
    ("h", "3. Space-to-Earth impact"),
    ("p", "The same camera, watch and offline triage design built for a Mars blackout works in rural clinics, disaster zones and home rehabilitation on Earth: movement, tremor and cardiopulmonary screening on commodity hardware, without broadband and without sending patient video to the cloud."),
    ("h", "4. What a judge can try in two minutes"),
    ("b", "Open the live application and click the four scenario cards to watch the 3D twin and the readiness score change."),
    ("b", "Open Triage: turn the 3D body, switch Earth 1g to Orbit 0g, then load the emergency vignette to see the red-flag gate fire."),
    ("b", "Open Evidence: ask a question and watch its sources light up, then replay two ISS orbits of radiation dose on the globe."),
]

NASA_DATA = [
    "**NASA Open Science Data Repository (OSDR), study OSD-571 / GLDS-563 (SpaceX Inspiration4 crew).** Longitudinal astronaut plasma proteomics across six pre-flight, in-flight and post-flight timepoints; used to anchor the radiation profile (CAT 5.24x, PRDX2 5.09x, HBA1 4.36x, TLN1 2.36x).",
    "**NASA-STD-3001, Space Flight Human-System Standard, Volumes 1 and 2.** Operational thresholds for cabin CO2, sleep protection and countermeasures.",
    "**NASA Human Research Program and Human Research Roadmap.** Risk and evidence framing for sensorimotor change, musculoskeletal unloading, radiation, sleep and behavioural health, and spaceflight-associated neuro-ocular syndrome.",
    "**NASA RadLab (OSDR), ISS DosTel dosimetry.** An official example query of absorbed dose rate over two orbits on 1 to 2 April 2022, shown in the Evidence tab.",
    "**NASA Space Biology publications (PubMed Central).** 572 papers indexed for the evidence engine, each tagged by study population so non-human results are not presented as human evidence.",
    "**Canadian Space Agency Bio-Monitor.** Reference for the wearable channel schema used by the telemetry API.",
]

CITATIONS = [
    "Google MediaPipe Tasks Vision 0.10.18 (FaceLandmarker, PoseLandmarker, HandLandmarker), Apache-2.0.",
    "BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0 (Mitsuhashi et al., 2009, Nucleic Acids Research, doi:10.1093/nar/gkn613); browser-ready geometry from the Human Atlas project (github.com/ashemag/human-atlas, MIT).",
    "FastAPI, Pydantic, SciPy, NumPy and SQLite (MIT / BSD / Apache-2.0).",
    "Barger, L. K. et al. (2014). Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight. The Lancet Neurology.",
    "Casiez, G., Roussel, N. and Vogel, D. (2012). 1-Euro Filter. CHI 2012.",
    "Wang, W. et al. (2017). Algorithmic Principles of Remote PPG. IEEE Transactions on Biomedical Engineering, 64(7).",
    "Soukupova, T. and Cech, J. (2016). Real-Time Eye Blink Detection Using Facial Landmarks.",
    "Uhlrich, S. D. et al. (2023). OpenCap: Human Movement Dynamics from Smartphone Videos. PLOS Computational Biology.",
    "Thaut, M. H. et al. (2015). Neurologic Music Therapy and Rhythmic Auditory Stimulation. Frontiers in Human Neuroscience.",
    "Lehrer, P. M. and Gevirtz, R. (2014). Heart Rate Variability Biofeedback. Frontiers in Psychology.",
    "Boersma, P. (1993). Accurate Short-Term Analysis of the Fundamental Frequency and the Harmonics-to-Noise Ratio.",
]

AI_DISCLOSURE = [
    "**Runtime scoring is deterministic.** The triage red-flag gate, the rule engine, the Mahalanobis and chi-square statistics, the signal filters and the audio synthesis are inspectable algorithms in open-source Python and JavaScript. Computer vision uses Google's open-source MediaPipe models running locally in the browser; crew video is not sent to any server.",
    "**Optional voice assistant.** The \"Ask ASTRA\" assistant uses xAI Grok for conversation, speech-to-text and text-to-speech through the open-source ClawAgents framework. It explains findings and navigates the portal; it never makes the triage decision. Without a network link it falls back to offline replies.",
    "**Development and presentation.** AI coding and writing assistants (Google Antigravity / Gemini and Anthropic Claude Code) were used under human direction for interface work, testing and documentation. Concept illustrations in the pitch deck were made with AI image generation. The 30-second video is a screen recording of the running software with an AI-synthesised voice-over (xAI Grok Voice) and an original synthesised score; it contains no generated footage.",
    "**Illustrative content.** The 3D body uses the BodyParts3D reference anatomy. Its pulse-wave and gravity fluid-shift views, the animated heart and pulse traces, and all crew values in the guided demo are illustrations, not simulations or patient data. NASA values and thresholds were checked against the primary NASA sources listed above.",
]

CHECKLIST = [
    "Paste Fields 1 to 7 into the project page on spaceappschallenge.org and save.",
    "Paste the three required links: live application, project demo video, code repository.",
    "Open each link in a private browser window to confirm it loads without signing in.",
    "Confirm every team member is listed on the team page.",
    "Submit before Sunday, November 15, 2026 at 11:59 PM CST.",
]


# ----------------------------------------------------------------------------- helpers
def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def cell_margins(cell, top=110, bottom=110, left=160, right=160):
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tc_pr.append(mar)


def borders(table, color="C9D3E2"):
    tbl_pr = table._tbl.tblPr
    node = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        node.append(el)
    tbl_pr.append(node)


def rich(paragraph, text, size=10.5, color=None):
    """Write text into a paragraph, turning **bold** spans into bold runs."""
    for i, part in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if not part:
            continue
        run = paragraph.add_run(part)
        run.bold = i % 2 == 1
        run.font.size = Pt(size)
        if color:
            run.font.color.rgb = color
    return paragraph


def hyperlink(paragraph, url, size=10):
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    for tag, attrs in (("w:color", {"w:val": "0B57D0"}), ("w:u", {"w:val": "single"}), ("w:sz", {"w:val": str(int(size * 2))})):
        el = OxmlElement(tag)
        for k, v in attrs.items():
            el.set(qn(k), v)
        r_pr.append(el)
    run.append(r_pr)
    text = OxmlElement("w:t")
    text.text = url
    run.append(text)
    link.append(run)
    paragraph._p.append(link)


def answer_box(doc):
    """A full-width shaded box that holds the text to paste."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    borders(table)
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    shade(cell, "F3F6FB")
    cell_margins(cell)
    cell.paragraphs[0].paragraph_format.space_after = Pt(0)
    return cell


def field(doc, number, title, note=""):
    h = doc.add_heading(level=2)
    run = h.add_run(f"Field {number}")
    run.font.color.rgb = ACCENT
    h.add_run(f"   {title}").font.color.rgb = NAVY
    if note:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        rich(p, note, size=9, color=MUTED)


# ----------------------------------------------------------------------------- document
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(1)
sec.top_margin = sec.bottom_margin = Inches(0.9)

normal = doc.styles["Normal"]
normal.font.name = "Arial"
normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
normal.font.size = Pt(10.5)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.12
for name, size in (("Heading 1", 20), ("Heading 2", 13.5)):
    st = doc.styles[name]
    st.font.name = "Arial"
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = NAVY
    st.paragraph_format.space_before = Pt(16 if name == "Heading 2" else 0)
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.keep_with_next = True

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
rich(footer, "AstroKinetics · ASTRA   |   Team AI-MED 01, Houston   |   NASA Space Apps Challenge 2026", size=8, color=MUTED)

kicker = doc.add_paragraph()
rich(kicker, "2026 NASA INTERNATIONAL SPACE APPS CHALLENGE  ·  HOUSTON", size=9, color=ACCENT).runs[0].bold = True
doc.add_heading("Project Submission Form: Answers to Paste", level=1)
intro = doc.add_paragraph()
rich(intro, "**AstroKinetics · ASTRA** (v5.1). Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*. "
            "Each shaded box holds the text for one field of the submission form. "
            "**Submit by Sunday, November 15, 2026 at 11:59 PM CST.**".replace("*Create", "Create").replace("Missions*", "Missions"))

field(doc, 1, "Project name")
rich(answer_box(doc).paragraphs[0], PROJECT_NAME, size=11).runs[0].bold = True

field(doc, 2, "High-level project summary", f"{len(SUMMARY.split())} words (typical limit 50 to 150 words).")
rich(answer_box(doc).paragraphs[0], SUMMARY)

field(doc, 3, "Project links", "All three required links are public and need no sign-in. The video is 29.2 seconds (limit 30) with English captions.")
table = doc.add_table(rows=0, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
borders(table)
for i, (label, url) in enumerate(LINKS):
    row = table.add_row().cells
    row[0].width, row[1].width = Inches(2.15), Inches(4.35)
    for c in row:
        cell_margins(c, top=70, bottom=70, left=120, right=120)
        c.paragraphs[0].paragraph_format.space_after = Pt(0)
    if i < 3:
        shade(row[0], "E8F0FE")
        shade(row[1], "F3F6FB")
    rich(row[0].paragraphs[0], f"**{label}**" if i < 3 else label, size=9.5)
    hyperlink(row[1].paragraphs[0], url, size=9)
note = doc.add_paragraph()
note.paragraph_format.space_before = Pt(4)
rich(note, "The first three rows are the required links. The 7-slide deck (AstroKinetics_7Slide_Pitch_Deck.pdf) is the backup demo format.", size=9, color=MUTED)

field(doc, 4, "Detailed project description", "Organised around the judging criteria: impact, creativity, validity, relevance and presentation.")
cell = answer_box(doc)
first = True
for kind, text in DESCRIPTION:
    par = cell.paragraphs[0] if first else cell.add_paragraph()
    first = False
    par.paragraph_format.space_after = Pt(5)
    if kind == "h":
        par.paragraph_format.space_before = Pt(6)
        rich(par, f"**{text}**", size=11, color=NAVY)
    elif kind == "b":
        par.style = doc.styles["List Bullet"]
        rich(par, text, size=10)
    else:
        rich(par, text, size=10)

field(doc, 5, "Space agency data and resources used")
cell = answer_box(doc)
for i, text in enumerate(NASA_DATA):
    par = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
    par.style = doc.styles["List Number"]
    par.paragraph_format.space_after = Pt(4)
    rich(par, text, size=10)

field(doc, 6, "Other open-source software and references")
cell = answer_box(doc)
for i, text in enumerate(CITATIONS):
    par = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
    par.style = doc.styles["List Bullet"]
    par.paragraph_format.space_after = Pt(3)
    rich(par, text, size=9.5)

field(doc, 7, "Use of artificial intelligence", "Required disclosure. It states where AI is and is not used, including the voice assistant and the video voice-over.")
cell = answer_box(doc)
for i, text in enumerate(AI_DISCLOSURE):
    par = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
    par.paragraph_format.space_after = Pt(5)
    rich(par, text, size=10)

h = doc.add_heading("Before you press submit", level=2)
for text in CHECKLIST:
    par = doc.add_paragraph(style="List Number 2")
    par.paragraph_format.space_after = Pt(2)
    rich(par, text, size=10)

doc.save(str(OUT))
print("wrote", OUT.name, f"{OUT.stat().st_size / 1024:.0f} KB", "| summary words:", len(SUMMARY.split()))
