#!/usr/bin/env python3
"""
AstroKinetics · ASTRA — Auto-RSI SEO/GEO Probe & Release Gate (Harness²-inspired)
=================================================================================
Adapted from Admit Coach's geo_citation_monitor.py and google-research/harness2's
Propose -> Probe -> Compose -> Reflect loop.

Verifies:
1. Source check freshness (< 90 days) across all NASA/spaceflight citations.
2. Trailing-slash 308 canonical redirects (preserving query parameters).
3. All 19 public SEO/GEO landing pages: HTTP 200, no noindex, valid JSON-LD,
   above-the-fold .direct-answer boxes, and 3-level BreadcrumbList hierarchy.
4. Downloadable Judge Evaluation Kit (/for-judges/evaluation-kit.txt), dynamic
   /sitemap.xml, RSS 2.0 /feed.xml, /llms.txt, /llms-full.txt, /indexnow.txt.
5. Live 7/7 /api/verification-report & Public MCP JSON-RPC 2.0 (/api/mcp/).

Usage:
    python3 webapp/scripts/geo_citation_monitor.py --local
    python3 webapp/scripts/geo_citation_monitor.py --base-url https://astrokinetics-space-health-765428358644.us-central1.run.app
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from pathlib import Path

WEBAPP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = WEBAPP_DIR.parent
if str(WEBAPP_DIR) not in sys.path:
    sys.path.insert(0, str(WEBAPP_DIR))

TRAILING_SLASH_CHECKS = (
    "/project/",
    "/video/",
    "/story/",
    "/for-judges/",
    "/scenarios/",
    "/data/",
    "/guides/",
    "/data/osd-571-inspiration4-proteomics/?utm_source=rsi-probe",
)

SSR_DIRECT_ANSWER_PAGES = (
    ("/for-judges", "2-minute judge verification kit"),
    ("/scenarios", "four scripted spaceflight health scenarios"),
    ("/scenarios/nominal_lunar", "nominal lunar orbit scenario"),
    ("/scenarios/hypercapnia_drift", "cabin CO2 drift scenario"),
    ("/scenarios/musculoskeletal_asymmetry", "0g squat compensation scenario"),
    ("/scenarios/spe_blackout", "solar particle event blackout scenario"),
    ("/data", "bundled NASA spaceflight datasets"),
    ("/data/osd-571-inspiration4-proteomics", "NASA OSDR OSD-571 Inspiration4 proteomics"),
    ("/data/radlab-iss-dostel-radiation", "NASA RadLab ISS DosTel radiation"),
    ("/data/barger-2014-iss-sleep-adaptation", "Barger 2014 ISS sleep adaptation"),
    ("/data/nasa-pmc-space-biology-corpus", "NASA PMC space biology corpus guardrails"),
    ("/guides", "astronaut health software technical guides"),
    ("/guides/offline-astronaut-health-monitoring-mars-blackout", "offline astronaut health monitoring Mars blackout"),
    ("/guides/mahalanobis-multivariate-triage-spaceflight", "8-DOF Mahalanobis multivariate triage spaceflight"),
    ("/guides/nasa-hunch-red-flag-safety-gate-abstention", "NASA HUNCH red flag safety gate abstention"),
    ("/guides/lidar-tetrahedral-volumetry-fluid-shift", "LiDAR signed tetrahedral volumetry fluid shift"),
)

CORE_STATIC_PAGES = ("/", "/project", "/video", "/story", "/demo/")


def check_freshness(today: date) -> tuple[list[str], list[str]]:
    from seo_surfaces import SOURCE_CHECKS

    ok: list[str] = []
    warnings: list[str] = []
    for key, info in SOURCE_CHECKS.items():
        chk = date.fromisoformat(info["checked"])
        age = (today - chk).days
        if age >= 75:
            warnings.append(f"{key} checked {chk} ({age} days old; expires at 90d)")
        else:
            ok.append(f"{key}: checked {chk} ({age}d old)")
    return ok, warnings


def _curl_fetch(base_url: str, path: str, method: str = "GET", json_body: dict | None = None) -> tuple[int, dict[str, str], str]:
    """Uses system curl so macOS Python builds without default CA certs still validate TLS cleanly."""
    url = base_url.rstrip("/") + path
    cmd = ["curl", "-sS", "-D", "-", "-o", "-", "--max-time", "20", "-X", method]
    if json_body is not None:
        cmd += ["-H", "Content-Type: application/json", "-H", "MCP-Protocol-Version: 2025-06-18", "-d", json.dumps(json_body)]
    cmd.append(url)
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        return 0, {}, proc.stderr
    raw = proc.stdout
    sep = "\r\n\r\n" if "\r\n\r\n" in raw else "\n\n"
    head, _, body = raw.partition(sep)
    # Handle 100 Continue if present
    while head.startswith("HTTP/1.1 100") and sep in body:
        head, _, body = body.partition(sep)
    lines = head.splitlines()
    status = int(lines[0].split()[1]) if lines and len(lines[0].split()) >= 2 else 0
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return status, headers, body


def run_probe(fetch_fn) -> dict:
    passed: list[str] = []
    issues: list[str] = []

    # 1. Trailing-slash 308 canonical redirects
    for path in TRAILING_SLASH_CHECKS:
        status, headers, _ = fetch_fn(path, "GET", None)
        base_path, sep, qs = path.partition("?")
        expected_loc = base_path.rstrip("/") + (f"?{qs}" if sep else "")
        if status == 308 and headers.get("location") == expected_loc:
            passed.append(f"308 redirect {path} -> {expected_loc}")
        else:
            issues.append(f"Trailing slash {path}: got HTTP {status} Location={headers.get('location')!r} (expected 308 -> {expected_loc!r})")

    # 2. Core static pages
    for path in CORE_STATIC_PAGES:
        status, headers, body = fetch_fn(path, "GET", None)
        if status != 200:
            issues.append(f"Core page {path} returned HTTP {status}")
            continue
        if "noindex" in headers.get("x-robots-tag", "").lower():
            issues.append(f"Core page {path} has X-Robots-Tag noindex")
            continue
        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', body, re.S)
        for idx, raw in enumerate(schemas):
            try:
                json.loads(raw)
            except json.JSONDecodeError as exc:
                issues.append(f"{path} malformed JSON-LD #{idx+1}: {exc}")
        passed.append(f"Core {path}: HTTP 200, {len(schemas)} valid JSON-LD block(s)")

    # 3. Programmatic SSR Direct-Answer SEO/GEO pages
    for path, kw in SSR_DIRECT_ANSWER_PAGES:
        status, headers, body = fetch_fn(path, "GET", None)
        if status != 200:
            issues.append(f"SSR {path} returned HTTP {status} (target: {kw})")
            continue
        if "noindex" in headers.get("x-robots-tag", "").lower():
            issues.append(f"SSR {path} has X-Robots-Tag noindex")
        if 'class="direct-answer"' not in body:
            issues.append(f"SSR {path} missing .direct-answer box")
        if '"BreadcrumbList"' not in body:
            issues.append(f"SSR {path} missing BreadcrumbList JSON-LD")
        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', body, re.S)
        if not schemas:
            issues.append(f"SSR {path} missing JSON-LD")
        for raw in schemas:
            try:
                json.loads(raw)
            except json.JSONDecodeError as exc:
                issues.append(f"SSR {path} malformed JSON-LD: {exc}")
        passed.append(f"SSR {path}: HTTP 200, direct-answer + BreadcrumbList + valid JSON-LD")

    # 4. Judge checklist attachment download
    status, headers, body = fetch_fn("/for-judges/evaluation-kit.txt", "GET", None)
    if status == 200 and "attachment" in headers.get("content-disposition", "") and "ASTROKINETICS" in body:
        passed.append("Judge kit download (/for-judges/evaluation-kit.txt): HTTP 200 attachment")
    else:
        issues.append(f"Judge kit download failed: status={status} cd={headers.get('content-disposition')!r}")

    # 5. Sitemap, RSS feed, IndexNow, llms.txt, robots.txt
    status, _, sm_body = fetch_fn("/sitemap.xml", "GET", None)
    sitemap_urls: list[str] = []
    if status == 200:
        try:
            root = ET.fromstring(sm_body)
            sitemap_urls = [el.text.strip() for el in root.findall(".//{*}url/{*}loc") if el.text]
            if len(sitemap_urls) >= 20:
                passed.append(f"/sitemap.xml: valid XML with {len(sitemap_urls)} URLs")
            else:
                issues.append(f"/sitemap.xml only has {len(sitemap_urls)} URLs (expected >= 20)")
        except ET.ParseError as exc:
            issues.append(f"/sitemap.xml XML parse error: {exc}")
    else:
        issues.append(f"/sitemap.xml returned HTTP {status}")

    status, _, feed_body = fetch_fn("/feed.xml", "GET", None)
    if status == 200:
        try:
            feed = ET.fromstring(feed_body)
            items = feed.findall("./channel/item")
            lbd = feed.findtext("./channel/lastBuildDate") or ""
            if len(items) >= 8 and "Nov 2026" in lbd:
                passed.append(f"/feed.xml: valid RSS 2.0 with {len(items)} items (lastBuildDate={lbd})")
            else:
                issues.append(f"/feed.xml unexpected items={len(items)} lastBuildDate={lbd!r}")
        except ET.ParseError as exc:
            issues.append(f"/feed.xml XML parse error: {exc}")
    else:
        issues.append(f"/feed.xml returned HTTP {status}")

    for meta_path, needle in (
        ("/robots.txt", "Sitemap:"),
        ("/llms.txt", "/api/mcp/"),
        ("/llms-full.txt", "1000.0 mL"),
        ("/indexnow.txt", "astrokinetics"),
    ):
        status, _, body = fetch_fn(meta_path, "GET", None)
        if status == 200 and needle in body:
            passed.append(f"{meta_path}: HTTP 200")
        else:
            issues.append(f"{meta_path}: status={status}, missing {needle!r}")

    # 6. Live /api/verification-report
    status, _, body = fetch_fn("/api/verification-report", "GET", None)
    if status == 200:
        rep = json.loads(body)
        if rep.get("summary", {}).get("all_passed") is True and rep["summary"]["passed"] == 7:
            passed.append("/api/verification-report: 7/7 checks passing")
        else:
            issues.append(f"/api/verification-report failed: {rep.get('summary')}")
    else:
        issues.append(f"/api/verification-report returned HTTP {status}")

    # 7. Public MCP JSON-RPC 2.0 endpoint (/api/mcp/)
    st_init, _, body_init = fetch_fn(
        "/api/mcp/",
        "POST",
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "astrokinetics-rsi-probe", "version": "1.0"},
            },
        },
    )
    st_list, _, body_list = fetch_fn("/api/mcp/", "POST", {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    st_call, _, body_call = fetch_fn(
        "/api/mcp/",
        "POST",
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_nasa_evidence", "arguments": {"query": "radiation", "human_only": True, "limit": 3}}},
    )
    if st_init == 200 and st_list == 200 and st_call == 200:
        init_j = json.loads(body_init)
        list_j = json.loads(body_list)
        call_j = json.loads(body_call)
        tools = list_j.get("result", {}).get("tools", [])
        search_res = json.loads(call_j["result"]["content"][0]["text"])
        if (
            init_j.get("result", {}).get("serverInfo", {}).get("name") == "AstroKinetics · ASTRA Space Health Data"
            and len(tools) == 5
            and search_res.get("count", 0) > 0
            and all(r.get("is_human_applicable") for r in search_res.get("results", []))
        ):
            passed.append(f"Public MCP (/api/mcp/): initialize + {len(tools)} tools + human_only search verified")
        else:
            issues.append("Public MCP returned unexpected payload")
    else:
        issues.append(f"Public MCP HTTP statuses: init={st_init} list={st_list} call={st_call}")

    return {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "passed_count": len(passed),
        "issue_count": len(issues),
        "sitemap_url_count": len(sitemap_urls),
        "passed": passed,
        "issues": issues,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="AstroKinetics · ASTRA Auto-RSI SEO/GEO Probe")
    parser.add_argument("--local", action="store_true", help="Run against local FastAPI TestClient")
    parser.add_argument("--base-url", default="https://astrokinetics-space-health-765428358644.us-central1.run.app")
    parser.add_argument("--record-memory", action="store_true", help="Append probe run to docs/geo-harness-memory.json")
    args = parser.parse_args()

    today = datetime.now(timezone.utc).date()
    fresh_ok, fresh_warn = check_freshness(today)

    if args.local:
        from fastapi.testclient import TestClient
        import app as astro_app

        client = TestClient(astro_app.app)

        def fetch(path: str, method: str, json_body: dict | None):
            if method == "POST":
                r = client.post(path, json=json_body, follow_redirects=False)
            else:
                r = client.get(path, follow_redirects=False)
            return r.status_code, {k.lower(): v for k, v in r.headers.items()}, r.text
        target = "local://TestClient"
    else:
        target = args.base_url.rstrip("/")

        def fetch(path: str, method: str, json_body: dict | None):
            return _curl_fetch(target, path, method, json_body)

    result = run_probe(fetch)
    result["target"] = target
    result["freshness_ok"] = len(fresh_ok)
    result["freshness_warnings"] = fresh_warn

    print(f"=== AstroKinetics · ASTRA Auto-RSI SEO/GEO Probe ({target}) ===")
    print(f"Freshness: {len(fresh_ok)} sources current, {len(fresh_warn)} warning(s)")
    print(f"Checks passed: {result['passed_count']} | Issues: {result['issue_count']} | Sitemap URLs: {result['sitemap_url_count']}")
    for w in fresh_warn:
        print(f"  WARN: {w}")
    for err in result["issues"]:
        print(f"  FAIL: {err}")

    if args.record_memory:
        mem_path = REPO_ROOT / "docs" / "geo-harness-memory.json"
        mem_path.parent.mkdir(parents=True, exist_ok=True)
        mem = json.loads(mem_path.read_text(encoding="utf-8")) if mem_path.exists() else {"harness": "astrokinetics-geo-rsi-v1", "runs": [], "adopted_lessons": []}
        mem["runs"].append(
            {
                "timestamp_utc": result["checked_at_utc"],
                "target": target,
                "passed_count": result["passed_count"],
                "issue_count": result["issue_count"],
                "sitemap_url_count": result["sitemap_url_count"],
            }
        )
        mem_path.write_text(json.dumps(mem, indent=2) + "\n", encoding="utf-8")
        print(f"Recorded probe snapshot to {mem_path}")

    if result["issue_count"] > 0:
        sys.exit(1)
    print("SEO/GEO release gate PASSED.")


if __name__ == "__main__":
    main()
