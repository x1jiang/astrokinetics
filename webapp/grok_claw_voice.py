"""
ASTRA × Grok Voice AI & ClawAgents Backend Router
==================================================
Smart multi-turn conversational voice assistant backed by `clawagents` (clawagents_py)
running xAI Grok LLM (`grok-4.20-0309-non-reasoning` over `https://api.x.ai/v1`)
with neural speech synthesis via xAI Grok Voice (`POST https://api.x.ai/v1/tts`).

Supports 6 languages (EN, ES, FR, JA, ZH, DE), 5 Grok Voice personas, live UI
navigation tools (`control_portal_ui`), and grounded NASA HUNCH / AURA queries.
"""

from __future__ import annotations

import base64
import importlib.metadata
import os
import re
from collections import OrderedDict
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from astra_companion import (
    AURA_INDEX,
    KNOWLEDGE_BUNDLE,
    HunchTriageRequest,
    evaluate_hunch_triage,
)

try:
    from clawagents import InMemorySession, create_claw_agent, function_tool

    CLAWAGENTS_AVAILABLE = True
    try:
        CLAWAGENTS_VERSION = importlib.metadata.version("clawagents")
    except Exception:
        CLAWAGENTS_VERSION = "installed"
except Exception:  # pragma: no cover
    CLAWAGENTS_AVAILABLE = False
    CLAWAGENTS_VERSION = "unavailable"
    InMemorySession = None  # type: ignore[assignment]
    create_claw_agent = None  # type: ignore[assignment]

    def function_tool(fn: Any = None, **kwargs: Any) -> Any:  # type: ignore[misc]
        return fn if fn is not None else (lambda f: f)


voice_router = APIRouter(tags=["Grok Voice & ClawAgents"])

XAI_BASE_URL = "https://api.x.ai/v1"
XAI_TTS_URL = "https://api.x.ai/v1/tts"
XAI_STT_URL = "https://api.x.ai/v1/stt"
XAI_STT_MODEL = os.environ.get("XAI_STT_MODEL", "grok-voice-transcribe-2.0")
MAX_STT_BYTES = 6 * 1024 * 1024  # ~3 minutes of browser Opus; one spoken turn is far smaller
# Project vocabulary the recogniser would otherwise mishear (xAI STT `keyterm`, max 50 chars each).
STT_KEYTERMS = [
    "ASTRA", "AstroKinetics", "HRV", "SANS", "HUNCH", "Orbit mode", "baseline",
    "flight surgeon", "fluid shift", "SpO2", "Mahalanobis", "Inspiration4", "ARED",
]
DEFAULT_CHAT_MODEL = os.environ.get("XAI_CHAT_MODEL", "grok-4.20-0309-non-reasoning")

SUPPORTED_LANGS: dict[str, dict[str, str]] = {
    "en": {"code": "en", "name": "English", "native": "English", "speech_bcp47": "en-US"},
    "es": {"code": "es", "name": "Spanish", "native": "Español", "speech_bcp47": "es-ES"},
    "fr": {"code": "fr", "name": "French", "native": "Français", "speech_bcp47": "fr-FR"},
    "ja": {"code": "ja", "name": "Japanese", "native": "日本語", "speech_bcp47": "ja-JP"},
    "zh": {"code": "zh", "name": "Chinese (Simplified)", "native": "中文", "speech_bcp47": "zh-CN"},
    "de": {"code": "de", "name": "German", "native": "Deutsch", "speech_bcp47": "de-DE"},
}

GROK_VOICES: dict[str, dict[str, str]] = {
    "eve": {"id": "eve", "label": "Eve · Flight Surgeon", "tone": "Warm, crisp medical guidance"},
    "ara": {"id": "ara", "label": "Ara · Crew Companion", "tone": "Natural, reassuring voice"},
    "rex": {"id": "rex", "label": "Rex · Mission Control", "tone": "Steady Houston telemetry lead"},
    "leo": {"id": "leo", "label": "Leo · Commander", "tone": "Authoritative mission briefing"},
    "lumen": {"id": "lumen", "label": "Lumen · Science Officer", "tone": "Articulate research specialist"},
}

# Bounded in-memory stores to keep Cloud Run memory flat
MAX_SESSIONS = 200
MAX_TTS_CACHE = 96
_SESSION_STORE: OrderedDict[str, Any] = OrderedDict()
_TTS_CACHE: OrderedDict[tuple[str, str, float, str], bytes] = OrderedDict()
_HTTP_CLIENT: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.AsyncClient(timeout=httpx.Timeout(18.0, connect=6.0))
    return _HTTP_CLIENT


def _get_xai_key() -> str:
    return (os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY") or "").strip()


def _get_session(session_id: str) -> Any:
    sid = re.sub(r"[^a-zA-Z0-9_.:-]", "", session_id or "default")[:64] or "default"
    if not CLAWAGENTS_AVAILABLE or InMemorySession is None:
        return None
    sess = _SESSION_STORE.get(sid)
    if sess is None:
        sess = InMemorySession()
        _SESSION_STORE[sid] = sess
        while len(_SESSION_STORE) > MAX_SESSIONS:
            _SESSION_STORE.popitem(last=False)
    else:
        _SESSION_STORE.move_to_end(sid)
    return sess


_LANG_HINT_WORDS: dict[str, frozenset[str]] = {
    "en": frozenset("the and is are what why how does do you my can this that with for hello show me please it your when about".split()),
    "es": frozenset("el los las qué que por cómo como es está estoy mi cuando hola porque puedes una para con muéstrame gracias y qué cuál dónde".split()),
    "fr": frozenset("le les est quoi pourquoi comment mon ma bonjour je vous tu une pour avec merci et dans peux montre quand où quel".split()),
    "de": frozenset("der die das ist was warum wie mein meine hallo ich sie du ein eine für mit danke und zeig kannst nicht wann wo".split()),
}


def _detect_supported_lang(text: str) -> str:
    """Which of the six portal languages a message is written in, or "" when it is not clear.

    xAI transcription reports "en" for other languages often enough that it cannot be relied on, so this
    looks at the words themselves: script for Japanese and Chinese, common function words for the rest.
    It only answers when the evidence is clear, because a wrong guess means replying in the wrong language.
    """
    t = (text or "").strip().lower()
    if not t:
        return ""
    if re.search(r"[\u3040-\u30ff]", t):
        return "ja"
    if len(re.findall(r"[\u4e00-\u9fff]", t)) >= 2:
        return "zh"
    words = re.findall(r"[a-zà-öø-ÿ']+", t)
    if len(words) < 3:
        return ""
    scores = sorted(((sum(w in vocab for w in words), code) for code, vocab in _LANG_HINT_WORDS.items()), reverse=True)
    (top, top_code), (second, _) = scores[0], scores[1]
    return top_code if top >= 2 and top > second else ""


def _clean_text_for_speech(text: str) -> str:
    """Strip markdown, URLs, and citation brackets so neural TTS sounds crisp."""
    cleaned = re.sub(r"https?://\S+", "", text or "")
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"[*_#>|]", " ", cleaned)
    cleaned = re.sub(r"\[\d+\]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) > 900:
        cleaned = cleaned[:897].rsplit(" ", 1)[0] + "..."
    return cleaned


# ------------------------------------------------------------------------------
# ClawAgents Safe Domain Tools (per-request closures, explicitly allowlisted)
# ------------------------------------------------------------------------------


def _make_request_tools(
    ui_actions: list[dict[str, str]],
    citations: list[str],
    telemetry: dict[str, Any],
) -> list[Any]:
    """Create request-scoped ClawAgents tools closing directly over result collectors."""

    def _add_cite(cite: str) -> None:
        if cite and cite not in citations:
            citations.append(cite)

    @function_tool(
        description=(
            "Get the astronaut's baseline vs. spaceflight normal telemetry shift and live scenario state. "
            "Use when asked about Earth vs Orbit ranges, resting heart rate, HRV, Day 12 drift, or current studio vitals."
        )
    )
    def get_astronaut_state(phase: str = "orbit") -> str:
        """Read Commander Maya Ortiz baseline + active telemetry context."""
        phase_norm = (phase or "orbit").strip().lower()
        _add_cite("Jones et al., Nature 2024 · Inspiration4 Apple Watch Baseline (OSDR OSD-571)")

        lines = [
            "Astronaut: Commander Maya Ortiz (Personal 14-day Earth baseline = 224 readings across 16 Apple Watch + iPhone + self-report measures).",
            "Earth 1g normal: Resting HR 50–60 bpm (mean 55), HRV SDNN 49–62 ms, Sleep 6.6–7.8 h, Gravity-dependent calf fluid metrics active.",
            "Orbit mode normal shift: Resting HR expected band rises to 58–70 bpm (so 64 bpm on Day 1 is INSIDE Orbit normal rather than a false alarm); HRV band widens 42–60 ms; gravity-dependent signals set aside.",
            "Mission Day 12 episode: Snapshot fell outside Orbit normal on 2/16 measures — HRV 41 ms and Sleep 5.7 h — accompanied by morning facial puffiness and blurrier near vision (remains OPEN awaiting flight surgeon review).",
        ]
        if telemetry:
            lines.append(f"Live workstation telemetry snapshot attached: {telemetry}")
        if "earth" in phase_norm:
            lines.append("Focus phase requested: Pre-flight Earth 1g reference.")
        elif "day12" in phase_norm or "evidence" in phase_norm:
            lines.append("Focus phase requested: Mission Day 12 drift & SANS / fluid shift follow-up.")
        return "\n".join(lines)

    @function_tool(
        description=(
            "Screen astronaut symptoms through the NASA HUNCH 8-Red-Flag Safety Gate and rank non-diagnostic flight-surgeon causes. "
            "Pass comma-separated symptom words like 'puffy face, blurry vision, headache, fatigue, chest pain' plus spo2_pct and hr_bpm."
        )
    )
    def run_hunch_triage_check(
        symptom_text: str,
        spo2_pct: float = 97.0,
        hr_bpm: float = 64.0,
    ) -> str:
        """Execute deterministic red-flag triage without diagnosing."""
        s = (symptom_text or "").lower()
        req = HunchTriageRequest(
            chest_pain=any(k in s for k in ("chest", "pecho", "poitrine", "brust", "胸")),
            sob=any(k in s for k in ("breath", "shortness", "dyspnea", "falta de aire", "essouff", "呼吸", "atem")),
            headache=any(k in s for k in ("headache", "head", "cefalea", "dolor de cabeza", "mal de tête", "kopfschmerz", "頭痛", "头痛")),
            visual_blur=any(k in s for k in ("vision", "blur", "eye", "sans", "vista", "borros", "flou", "視力", "视力", "sehkraft")),
            fatigue=any(k in s for k in ("tired", "fatigue", "exhaust", "fatiga", "cans", "épuis", "müde", "疲労", "疲劳")),
            dizziness=any(k in s for k in ("dizz", "vertigo", "mareo", "vertige", "schwindel", "めまい", "头晕")),
            nausea=any(k in s for k in ("nausea", "náusea", "nausée", "übel", "吐き気", "恶心")),
            spo2=max(70.0, min(100.0, float(spo2_pct))),
            hr=max(35.0, min(200.0, float(hr_bpm))),
            hrv_sdnn=41.0 if "day 12" in s or "vision" in s or "puffy" in s else 48.0,
            sleep_hours=5.7 if "day 12" in s or "sleep" in s or "tired" in s else 6.8,
            notes=symptom_text[:300],
        )
        res = evaluate_hunch_triage(req)
        _add_cite("NASA HUNCH 8-Red-Flag Deterministic Safety Gate & Non-Diagnostic Triage")

        causes: list[str] = []
        if any(k in s for k in ("puffy", "face", "fluid", "swoll", "vision", "blur", "sans", "cara", "hinch", "visage", "顔", "脸", "gesicht")):
            causes = [
                "1. Headward microgravity fluid shift (expected early in orbit when gravity stops pulling fluid to the legs)",
                "2. Spaceflight-Associated Neuro-ocular Syndrome (SANS) screening trigger (when paired with near-vision blur — flag for flight surgeon & 24h repeat check)",
                "3. Local irritation / mild circadian disruption (lower likelihood if resting vitals are within Orbit band)",
            ]
            _add_cite("NASA HRP · Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)")
        elif req.headache:
            causes = [
                "1. Cephalad fluid congestion / sinus pressure",
                "2. Raised cabin ppCO2 (>2.0 mmHg) — must verify environmental telemetry before ruling out",
                "3. Short or fragmented orbital sleep (<6h)",
            ]
            _add_cite("NASA-STD-3001 · Cabin ppCO2 & HRP Fluid Shift Risks")

        flags = [f.get("label", "") for f in res.get("triggered_red_flags", [])]
        trace = (res.get("rule_engine") or {}).get("trace") or []
        return (
            f"Triage Level: {res.get('triage_level')} | Red-Flag Safety Gate: {flags or ['None triggered']} | "
            f"Rule Trace: {trace} | Non-diagnostic reminder: Never label as a confirmed medical diagnosis. "
            f"Ranked spaceflight considerations: {causes or ['Monitor against personal Orbit normal; escalate if worsening']}"
        )

    @function_tool(
        description=(
            "Search the curated NASA Open Science Data Repository (OSD-571), Human Research Program (HRP), "
            "and AURA aerospace medicine knowledge bundle for scientific backing."
        )
    )
    def lookup_nasa_evidence(query: str) -> str:
        """Search AURA curated corpus and record citations."""
        q = (query or "spaceflight fluid shift baseline").strip()
        hits = AURA_INDEX.search(q, human_only=False, kinds={"concept", "source", "apple_study", "nasa_pmc"}, limit=3)
        if not hits:
            concepts = KNOWLEDGE_BUNDLE.get("concepts", [])[:2]
            for c in concepts:
                _add_cite(c.get("title", "ASTRA NASA Curated Concept"))
            return "ASTRA curated corpus: Inspiration4 longitudinal wearables (Jones et al., Nature 2024) + NASA HRP SANS & fluid shift protocols."

        snippets: list[str] = []
        for h in hits[:3]:
            title = h.get("title") or h.get("id") or "NASA Source"
            src = h.get("citation") or h.get("source") or h.get("url") or title
            _add_cite(str(title))
            text = (h.get("summary") or h.get("snippet") or h.get("abstract") or "").strip()
            snippets.append(f"- {title} ({src}): {text[:240]}")
        return "\n".join(snippets)

    @function_tool(
        description=(
            "Navigate or control the ASTRA web portal UI when the user asks to view a story chapter, "
            "flip Orbit mode, launch the Apple Watch & iPhone guided demo, play the 29-second film, "
            "or open the 3D Live Biomechanics & Triage Lab with a specific mission scenario. "
            "Valid target values: 'story_distance', 'story_baseline', 'story_orbit', 'story_evidence', "
            "'story_mission', 'open_demo', 'open_film', 'open_studio', 'studio_nominal', "
            "'studio_hypercapnia', 'studio_asymmetry', 'studio_spe_blackout'."
        )
    )
    def control_portal_ui(target: str, detail: str = "") -> str:
        """Queue a UI action for the frontend to execute alongside the voice response."""
        allowed = {
            "story_distance",
            "story_baseline",
            "story_orbit",
            "story_evidence",
            "story_mission",
            "open_demo",
            "open_film",
            "open_studio",
            "studio_nominal",
            "studio_hypercapnia",
            "studio_asymmetry",
            "studio_spe_blackout",
        }
        synonyms = {
            "demo": "open_demo",
            "launch_demo": "open_demo",
            "guided_demo": "open_demo",
            "watch_demo": "open_demo",
            "film": "open_film",
            "video": "open_film",
            "play_film": "open_film",
            "studio": "open_studio",
            "lab": "open_studio",
            "3d_lab": "open_studio",
            "twin": "open_studio",
            "distance": "story_distance",
            "baseline": "story_baseline",
            "orbit": "story_orbit",
            "orbit_mode": "story_orbit",
            "evidence": "story_evidence",
            "day12": "story_evidence",
            "mission": "story_mission",
            "spe": "studio_spe_blackout",
            "blackout": "studio_spe_blackout",
            "solar_storm": "studio_spe_blackout",
            "hypercapnia": "studio_hypercapnia",
            "co2": "studio_hypercapnia",
            "asymmetry": "studio_asymmetry",
            "nominal": "studio_nominal",
        }
        t = (target or "").strip().lower()
        t = synonyms.get(t, t)
        if t not in allowed:
            return f"Ignored unsupported target '{target}'. Valid targets: {sorted(allowed)}"
        ui_actions.append({"target": t, "detail": (detail or "").strip()})
        return f"Queued frontend portal action: {t}"

    return [
        get_astronaut_state,
        run_hunch_triage_check,
        lookup_nasa_evidence,
        control_portal_ui,
    ]


# ------------------------------------------------------------------------------
# Prompt Construction & Neural Grok Voice TTS
# ------------------------------------------------------------------------------


def _build_system_prompt(
    lang: str,
    voice_id: str,
    current_view: str,
    telemetry_context: dict[str, Any] | None,
    input_mode: str = "text",
    stt_confidence: float | None = None,
    hands_free: bool = False,
) -> str:
    lang_info = SUPPORTED_LANGS.get(lang, SUPPORTED_LANGS["en"])
    voice_info = GROK_VOICES.get(voice_id, GROK_VOICES["eve"])
    ctx_line = f"Live telemetry context from page: {telemetry_context}" if telemetry_context else "Page mode: Showcase / Guided Demo."

    if input_mode == "voice":
        channel = (
            "This turn was SPOKEN and reached you through speech recognition, so it can contain mishearings "
            "(for example 'Astra' heard as 'Astro' or 'extra', 'HRV' as 'HIV' or 'H R V', 'SANS' as 'sands', 'baseline' as 'base line'). "
            "Read it for what the person most plausibly meant in this context. "
        )
        if stt_confidence is not None and stt_confidence < 0.45:
            channel += (
                "Recognition confidence for this turn was LOW: if the meaning is not clear from context, "
                "say what you think you heard and ask them to confirm in one short sentence instead of answering a guess. "
            )
    else:
        channel = "This turn was typed. "
    if hands_free:
        channel += "The person is in hands-free conversation: keep it to one to three short sentences so they can reply quickly."

    return (
        f"You are ASTRA ({voice_info['label']}), the astronaut health voice companion built by Team AI-MED 01 (Houston) "
        "for the 2026 NASA International Space Apps Challenge. You are in a live conversation with a person standing at the demo: "
        "it may be a judge, an engineer, a clinician, a student or a child.\n"
        f"LANGUAGE: Reply entirely in natural, fluent {lang_info['name']} ({lang_info['native']}).\n"
        "HOW TO TALK WITH PEOPLE:\n"
        "- Answer what was actually asked, in your first sentence. A greeting, a thank-you, 'can you hear me?' or small talk gets one short, "
        "warm sentence back, not a product pitch; then you may offer one thing you can show.\n"
        "- Match the person: plain everyday words for a visitor or a child, exact numbers and mechanisms for a clinician or engineer. "
        "If you cannot tell who you are talking to, start plain and go deeper when they ask.\n"
        "- Use the conversation so far. Remember their name and what they already asked, never re-introduce yourself, and resolve "
        "'it', 'that' or 'the second one' from context. If they change subject or cut you off, drop the old thread and follow them.\n"
        "- When a request is ambiguous, ask ONE short clarifying question. Never stack several questions in one turn.\n"
        "- Do not end every reply with a question or an offer; do it only when it helps the person decide what to see next.\n"
        "- If you do not know, or a tool returns nothing useful, say so plainly rather than filling the gap.\n"
        "- Your words are spoken aloud: normally two to four sentences (about 35 to 75 words), no markdown, lists, URLs or symbols. "
        "Say units in words ('41 milliseconds', '64 beats per minute').\n"
        f"THIS TURN: {channel}\n"
        "TRUTH AND SAFETY:\n"
        "- ASTRA never gives a definitive diagnosis. Frame findings as a deviation from a personal baseline, ranked possible spaceflight causes "
        "(headward fluid shift, SANS vision screening, cabin CO2, circadian sleep shift) and an open follow-up for the Flight Surgeon.\n"
        "- If the person describes real symptoms of their own, be kind, say that you are a research demonstration and not a medical device, "
        "and tell them to contact a clinician, or emergency services if it is urgent. You may then explain how ASTRA would approach it for an astronaut.\n"
        "- All crew values in this demo are illustrative; say so if someone asks whether the data is real.\n"
        "TOOLS: use `get_astronaut_state`, `run_hunch_triage_check`, `lookup_nasa_evidence` and `control_portal_ui` when they help. "
        "When the person asks to see the Watch and iPhone demo, Orbit mode, the mission story, the 29-second film, the 3D Lab, or a scenario such as a "
        "solar particle event or a CO2 spike, call `control_portal_ui` right away and say in a few words what you opened.\n"
        f"Current portal view: {current_view}. {ctx_line}"
    )


async def synthesize_grok_tts(
    text: str,
    voice_id: str = "eve",
    lang: str = "en",
    speed: float = 1.03,
) -> tuple[bytes | None, bool, str | None]:
    """Call xAI Grok Voice TTS (`POST https://api.x.ai/v1/tts`) with bounded LRU caching."""
    xai_key = _get_xai_key()
    if not xai_key:
        return None, False, "XAI_API_KEY is not configured in environment"

    v = voice_id if voice_id in GROK_VOICES else "eve"
    l = lang if lang in SUPPORTED_LANGS else "en"
    sp = round(max(0.75, min(1.35, float(speed))), 2)
    spoken = _clean_text_for_speech(text)
    if not spoken:
        return None, False, "Empty text"

    cache_key = (v, l, sp, spoken)
    cached_audio = _TTS_CACHE.get(cache_key)
    if cached_audio is not None:
        _TTS_CACHE.move_to_end(cache_key)
        return cached_audio, True, None

    try:
        client = _get_http_client()
        resp = await client.post(
            XAI_TTS_URL,
            headers={
                "Authorization": f"Bearer {xai_key}",
                "Content-Type": "application/json",
            },
            json={
                "text": spoken,
                "voice_id": v,
                "language": l,
                "speed": sp,
                "text_normalization": True,
            },
        )
        if resp.status_code != 200:
            return None, False, f"Grok TTS HTTP {resp.status_code}: {resp.text[:160]}"
        audio_bytes = resp.content
        if len(audio_bytes) < 64:
            return None, False, "Grok TTS returned empty audio payload"
        _TTS_CACHE[cache_key] = audio_bytes
        while len(_TTS_CACHE) > MAX_TTS_CACHE:
            _TTS_CACHE.popitem(last=False)
        return audio_bytes, False, None
    except Exception as exc:
        return None, False, f"Grok TTS request failed: {exc}"


_SOCIAL_PATTERNS: dict[str, tuple[str, ...]] = {
    "hear": ("can you hear", "do you hear", "hear me", "mic check", "testing", "me oyes", "me escuchas", "tu m'entends",
             "vous m'entendez", "聞こえ", "听得到", "听到我", "听得见", "hörst du", "hören sie"),
    "thanks": ("thank", "thanks", "gracias", "merci", "ありがとう", "谢谢", "danke"),
    "bye": ("goodbye", "bye", "see you", "adiós", "adios", "au revoir", "さようなら", "再见", "tschüss", "auf wiedersehen"),
    "hello": ("hello", "hi ", "hi,", "hi!", "hey", "good morning", "good afternoon", "good evening", "hola", "buenos", "buenas",
              "bonjour", "salut", "こんにちは", "你好", "您好", "hallo", "guten"),
}
_SOCIAL_REPLIES: dict[str, dict[str, str]] = {
    "hear": {
        "en": "Yes, I can hear you clearly. What would you like to know about ASTRA?",
        "es": "Sí, te escucho bien. ¿Qué te gustaría saber sobre ASTRA?",
        "fr": "Oui, je vous entends très bien. Que souhaitez-vous savoir sur ASTRA ?",
        "ja": "はい、はっきり聞こえています。ASTRAについて何を知りたいですか。",
        "zh": "可以，我听得很清楚。您想了解ASTRA的哪方面？",
        "de": "Ja, ich höre Sie gut. Was möchten Sie über ASTRA wissen?",
    },
    "thanks": {
        "en": "You're welcome. Ask me anything else, or say 'show the demo'.",
        "es": "De nada. Pregúntame lo que quieras, o di «muestra la demo».",
        "fr": "Avec plaisir. Posez-moi une autre question, ou dites « montre la démo ».",
        "ja": "どういたしまして。ほかにも質問があればどうぞ。「デモを見せて」とも言えます。",
        "zh": "不客气。还可以继续问我，或者说“打开演示”。",
        "de": "Gern geschehen. Fragen Sie mich gern weiter, oder sagen Sie „Demo zeigen“.",
    },
    "bye": {
        "en": "Goodbye, and thanks for stopping by.",
        "es": "Hasta luego, y gracias por la visita.",
        "fr": "Au revoir, et merci de votre visite.",
        "ja": "さようなら。お立ち寄りありがとうございました。",
        "zh": "再见，感谢您的来访。",
        "de": "Auf Wiedersehen, und danke für Ihren Besuch.",
    },
    "hello": {
        "en": "Hello, I'm ASTRA. I can explain how an astronaut's normal changes in orbit, walk you through Day 12, or open the Watch and iPhone demo. Where shall we start?",
        "es": "Hola, soy ASTRA. Puedo explicar cómo cambia lo normal de un astronauta en órbita, repasar el día 12 o abrir la demo de Watch y iPhone. ¿Por dónde empezamos?",
        "fr": "Bonjour, je suis ASTRA. Je peux expliquer comment la normale d'un astronaute change en orbite, détailler le jour 12 ou ouvrir la démo Watch et iPhone. Par où commencer ?",
        "ja": "こんにちは、ASTRAです。軌道上で宇宙飛行士の「普段」がどう変わるかの説明、12日目の流れ、WatchとiPhoneのデモのどれから始めましょうか。",
        "zh": "你好，我是ASTRA。我可以讲解航天员的正常基线在轨道上如何变化、带你看第12天的流程，或者打开Watch和iPhone演示。从哪里开始？",
        "de": "Hallo, ich bin ASTRA. Ich kann erklären, wie sich das Normal einer Astronautin im Orbit verschiebt, Tag 12 durchgehen oder die Watch-und-iPhone-Demo öffnen. Womit fangen wir an?",
    },
}


def _offline_social_reply(message_lower: str, lang: str) -> str | None:
    """Short human replies for greetings, mic checks and thanks when the Grok LLM is unavailable."""
    text = f" {message_lower.strip()} "
    if len(text.split()) > 9:
        return None  # a real question that happens to start with "hi"
    for kind, patterns in _SOCIAL_PATTERNS.items():
        # Latin-script patterns must start a word, so "they" is not read as "hey".
        if any(((" " + pat) if pat.isascii() else pat) in text for pat in patterns):
            replies = _SOCIAL_REPLIES[kind]
            return replies.get(lang, replies["en"])
    return None


def _offline_fallback_reply(message: str, lang: str) -> tuple[str, list[dict[str, str]], list[str]]:
    """Deterministic multilingual fallback if XAI_API_KEY is absent during offline tests."""
    m = (message or "").lower()
    actions: list[dict[str, str]] = []
    cites: list[str] = ["Jones et al., Nature 2024 · Inspiration4 Apple Watch Baseline"]

    social = _offline_social_reply(m, lang)
    if social:
        return social, [], []

    if any(k in m for k in ("demo", "watch", "iphone", "demostración", "démonstration", "デモ", "演示")):
        actions.append({"target": "open_demo", "detail": "Guided Apple Watch + iPhone walkthrough"})
    elif any(k in m for k in ("studio", "3d", "lab", "twin", "blackout", "spe", "solar", "gemelo", "laboratorio")):
        target = "studio_spe_blackout" if any(k in m for k in ("blackout", "spe", "solar", "tormenta")) else "open_studio"
        actions.append({"target": target, "detail": "Opening 3D Digital Twin Workstation"})
    elif any(k in m for k in ("orbit", "mode", "órbita", "orbite", "軌道", "轨道")):
        actions.append({"target": "story_orbit", "detail": "Orbit baseline shift"})
    elif any(k in m for k in ("film", "video", "película", "vidéo", "動画", "视频")):
        actions.append({"target": "open_film", "detail": "0:29 Mission Film"})

    templates = {
        "en": (
            "On Earth, Commander Ortiz rests around 55 bpm, but in microgravity her expected normal shifts up to 64 bpm. "
            "On Mission Day 12, her HRV dipped to 41 ms with puffy facial fluid shift and blurrier near vision, so ASTRA opens an episode for Flight Surgeon SANS review rather than guessing a diagnosis."
        ),
        "es": (
            "En la Tierra su frecuencia en reposo es de unos 55 lpm, pero en órbita su rango normal sube a 64 lpm. "
            "En el día 12 la variabilidad cardíaca bajó a 41 ms con hinchazón facial y visión cercana borrosa, por lo que ASTRA abre un seguimiento por desplazamiento de fluidos y revisión SANS."
        ),
        "fr": (
            "Sur Terre, la fréquence au repos est d'environ 55 bpm, mais en orbite sa plage normale s'ajuste à 64 bpm. "
            "Au jour 12, la VFC chute à 41 ms avec gonflement facial et vision de près floue : ASTRA ouvre un suivi de dérive des fluides pour le médecin de vol."
        ),
        "ja": (
            "地上での安静時心拍は約55 bpmですが、軌道上では正常範囲が64 bpm前後へ適応します。"
            "ミッション12日目にはHRVが41 msへ低下し顔のむくみと近見視力のにじみが見られたため、ASTRAは体液シフトとSANS確認のためエピソードを開いたまま記録します。"
        ),
        "zh": (
            "在地面时静息心率约55次/分，进入微重力轨道后个人正常基线会上移到64次/分。"
            "第12天心率变异性降至41毫秒并伴随面部浮肿和近视力模糊，ASTRA会自动标记头向体液转移与SANS复核随访，而不是武断下诊断。"
        ),
        "de": (
            "Auf der Erde liegt der Ruhepuls bei etwa 55 bpm, im Orbit verschiebt sich der persönliche Normalbereich auf rund 64 bpm. "
            "An Missionstag 12 sinkt die HRV auf 41 ms bei Gesichtsschwellung und unscharfer Nahsicht – ASTRA öffnet daraufhin eine Episode zur SANS- und Flüssigkeitsverschiebungs-Prüfung."
        ),
    }
    return templates.get(lang, templates["en"]), actions, cites


# ------------------------------------------------------------------------------
# API Request / Response Models & Endpoints
# ------------------------------------------------------------------------------


class VoiceChatRequest(BaseModel):
    session_id: str = Field(default="judge-session", max_length=64)
    message: str = Field(..., min_length=1, max_length=1200)
    lang: Literal["en", "es", "fr", "ja", "zh", "de"] = "en"
    voice_id: Literal["eve", "ara", "rex", "leo", "lumen"] = "eve"
    current_view: str = Field(default="showcase", max_length=64)
    telemetry_context: dict[str, Any] = Field(default_factory=dict)
    synthesize_audio: bool = True
    speed: float = Field(default=1.03, ge=0.75, le=1.35)
    input_mode: Literal["voice", "text"] = "text"
    stt_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    hands_free: bool = False


class VoiceTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    voice_id: Literal["eve", "ara", "rex", "leo", "lumen"] = "eve"
    lang: Literal["en", "es", "fr", "ja", "zh", "de"] = "en"
    speed: float = Field(default=1.03, ge=0.75, le=1.35)


@voice_router.get("/api/voice/status")
async def get_voice_status() -> dict[str, Any]:
    """Report ClawAgents + Grok Voice AI readiness and available voices/languages."""
    xai_ready = bool(_get_xai_key())
    return {
        "ok": True,
        "engine": "clawagents_py",
        "clawagents_available": CLAWAGENTS_AVAILABLE,
        "clawagents_version": CLAWAGENTS_VERSION,
        "llm_provider": "xai",
        "llm_model": DEFAULT_CHAT_MODEL,
        "tts_provider": "xai-grok-voice",
        "tts_endpoint": XAI_TTS_URL,
        "grok_live_ready": xai_ready and CLAWAGENTS_AVAILABLE,
        "stt_provider": "xai-grok-voice-transcribe",
        "stt_model": XAI_STT_MODEL,
        "stt_ready": xai_ready,
        "voices": list(GROK_VOICES.values()),
        "languages": list(SUPPORTED_LANGS.values()),
        "default_voice": "eve",
        "default_lang": "en",
    }


@voice_router.post("/api/voice/chat")
async def post_voice_chat(req: VoiceChatRequest) -> dict[str, Any]:
    """Smart multi-turn conversation via clawagents_py + Grok LLM + Grok Voice TTS."""
    xai_key = _get_xai_key()
    ui_actions: list[dict[str, str]] = []
    citations: list[str] = []

    # A visitor who writes or speaks another supported language is answered in it, whatever the portal is set to.
    reply_lang = _detect_supported_lang(req.message) or req.lang

    reply_text = ""
    engine_used = "clawagents_py+grok"
    iterations = 0
    fallback_used = False

    try:
        if xai_key and CLAWAGENTS_AVAILABLE and create_claw_agent is not None:
            session = _get_session(req.session_id)
            req_tools = _make_request_tools(ui_actions, citations, req.telemetry_context or {})
            agent = create_claw_agent(
                model=DEFAULT_CHAT_MODEL,
                api_key=xai_key,
                base_url=XAI_BASE_URL,
                wire_api="chat_completions",
                instruction=_build_system_prompt(
                    lang=reply_lang,
                    voice_id=req.voice_id,
                    current_view=req.current_view,
                    telemetry_context=req.telemetry_context,
                    input_mode=req.input_mode,
                    stt_confidence=req.stt_confidence,
                    hands_free=req.hands_free,
                ),
                base_prompt="",
                tools=req_tools,
                tool_discovery=False,
                streaming=False,
                trajectory=False,
                learn=False,
                rethink=False,
                workspace="/tmp",
                max_iterations=4,
            )
            agent.allow_only_tools(
                "get_astronaut_state",
                "run_hunch_triage_check",
                "lookup_nasa_evidence",
                "control_portal_ui",
            )
            res = await agent.invoke(req.message, session=session)
            reply_text = (getattr(res, "result", "") or "").strip()
            iterations = int(getattr(res, "iterations", 1) or 1)
            if not reply_text:
                raise RuntimeError("Empty reply from clawagents")
        else:
            fallback_used = True
            engine_used = "astra-offline-fallback"
            reply_text, fb_actions, fb_cites = _offline_fallback_reply(req.message, reply_lang)
            ui_actions.extend(fb_actions)
            citations.extend(fb_cites)
    except Exception:
        fallback_used = True
        engine_used = "astra-resilient-fallback"
        reply_text, fb_actions, fb_cites = _offline_fallback_reply(req.message, reply_lang)
        ui_actions.extend(fb_actions)
        citations.extend(fb_cites)

    spoken_text = _clean_text_for_speech(reply_text)
    audio_b64: str | None = None
    tts_cached = False
    tts_error: str | None = None

    if req.synthesize_audio and xai_key:
        audio_bytes, tts_cached, tts_error = await synthesize_grok_tts(
            text=spoken_text,
            voice_id=req.voice_id,
            lang=reply_lang,
            speed=req.speed,
        )
        if audio_bytes:
            audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return {
        "ok": True,
        "session_id": req.session_id,
        "lang": reply_lang,
        "voice_id": req.voice_id,
        "engine": engine_used,
        "llm_model": DEFAULT_CHAT_MODEL if not fallback_used else "offline-rule-engine",
        "fallback_used": fallback_used,
        "iterations": iterations,
        "reply": reply_text,
        "spoken_text": spoken_text,
        "ui_actions": ui_actions,
        "citations": citations,
        "audio_base64": audio_b64,
        "audio_mime": "audio/mpeg" if audio_b64 else None,
        "tts_cached": tts_cached,
        "tts_fallback": None if audio_b64 else "web_speech",
        "tts_note": tts_error,
    }


@voice_router.post("/api/voice/stt")
async def post_voice_stt(request: Request, lang: str = "") -> dict[str, Any]:
    """Transcribe one spoken turn recorded in the browser from the microphone the visitor picked.

    The body is the raw recording (WebM/Opus from Chrome and Firefox, MP4/AAC from Safari); xAI detects the
    container itself. `lang` is only a hint: the model still follows a visitor who speaks another language,
    and the detected language is returned so the reply can be given in it.
    """
    xai_key = _get_xai_key()
    if not xai_key:
        return {"ok": False, "reason": "no_key", "text": ""}

    audio = await request.body()
    if len(audio) < 800:
        return {"ok": False, "reason": "empty_audio", "text": ""}
    if len(audio) > MAX_STT_BYTES:
        return {"ok": False, "reason": "too_long", "text": ""}

    content_type = (request.headers.get("content-type") or "audio/webm").split(";")[0].strip().lower()
    ext = {"audio/mp4": "mp4", "audio/aac": "aac", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav",
           "audio/mpeg": "mp3"}.get(content_type, "webm")
    form: dict[str, Any] = {"model": XAI_STT_MODEL, "keyterm": STT_KEYTERMS}
    if lang in SUPPORTED_LANGS:
        form["language"] = lang

    try:
        client = _get_http_client()
        # httpx writes the `data` fields before `files`, which xAI requires (file must be the last part).
        resp = await client.post(
            XAI_STT_URL,
            headers={"Authorization": f"Bearer {xai_key}"},
            data=form,
            files={"file": (f"turn.{ext}", audio, content_type)},
        )
        if resp.status_code != 200:
            return {"ok": False, "reason": f"stt_http_{resp.status_code}", "text": "", "note": resp.text[:160]}
        payload = resp.json()
    except Exception as exc:
        return {"ok": False, "reason": "stt_request_failed", "text": "", "note": str(exc)[:160]}

    text = str(payload.get("text") or "").strip()
    words = payload.get("words") or []
    confs = [float(w["confidence"]) for w in words if isinstance(w, dict) and isinstance(w.get("confidence"), (int, float))]
    reported = str(payload.get("language") or "").split("-")[0].lower()
    detected = _detect_supported_lang(text) or (reported if reported in SUPPORTED_LANGS else "")
    return {
        "ok": True,
        "text": text,
        "language": detected,
        "language_raw": payload.get("language") or "",
        "confidence": round(sum(confs) / len(confs), 3) if confs else None,
        "duration": payload.get("duration"),
    }


@voice_router.post("/api/voice/tts")
async def post_voice_tts(req: VoiceTtsRequest) -> dict[str, Any]:
    """Fast standalone xAI Grok Voice synthesis endpoint (for guided demo narration)."""
    audio_bytes, cached, err = await synthesize_grok_tts(
        text=req.text,
        voice_id=req.voice_id,
        lang=req.lang,
        speed=req.speed,
    )
    if audio_bytes:
        return {
            "ok": True,
            "voice_id": req.voice_id,
            "lang": req.lang,
            "cached": cached,
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "audio_mime": "audio/mpeg",
        }
    return {
        "ok": False,
        "voice_id": req.voice_id,
        "lang": req.lang,
        "cached": False,
        "audio_base64": None,
        "audio_mime": None,
        "fallback": "web_speech",
        "note": err or "Grok TTS unavailable offline; use Web Speech API fallback.",
    }
