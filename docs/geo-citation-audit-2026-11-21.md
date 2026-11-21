# AstroKinetics · ASTRA — Auto-RSI SEO & GEO Citation Audit (`2026-11-21`)

> Adapted from the **Admit Coach Auto-RSI SEO/GEO playbook** and **Harness² (`google-research/harness2`)** recursive harnessing architecture (*Task-level Propose → Probe → Compose* + *Harnessing-level Experience Reflector*).

## 1. Baseline Google AI Overview & Search Citation Gap Audit (`2026-11-21`)

| # | Target Query | AI Answer Present | Sites Cited (Baseline) | Our Portal Cited? | Competitors / Collisions | Priority |
|---|---|---|---|---|---|---|
| 1 | `site:astrokinetics-space-health-765428358644.us-central1.run.app` | No | None (`0` indexed) | **No** | N/A | **P0 (Critical)** |
| 2 | `"AstroKinetics" OR "AI-MED 01" "NASA Space Apps" 2026 Houston` | Yes | `spaceappschallenge.org`, unrelated `github.com` project | **No** | Unrelated C/Raylib "AstroKinetics" repo | **P0 (Critical)** |
| 3 | `"Create Health Monitoring Software for Astronauts on Space Missions" Houston 2026 Space Apps` | Yes | `spaceappschallenge.org`, `nasa.gov`, `youtube.com` | **No** | `ASTROCARE`, `AstroNav Wrist`, `H.E.L.I.O.S.`, other `ASTRA` | **P0 (Critical)** |
| 4 | `"Pulsaris" OR "AstroGuard" OR "CrewPulse" "NASA Space Apps" 2026 Houston` | Yes | `spaceappschallenge.org`, `github.com`, `youtube.com` | **No** | `CrewPulse`, `AstroGuard` | **P0 (Critical)** |
| 5 | `"NASA OSDR OSD-571" Inspiration4 proteomics astronaut health` | Yes | `osdr.nasa.gov`, `nature.com`, `pmc.ncbi.nlm.nih.gov` | **No** | Primary literature only (opportunity for `/data/osd-571-inspiration4-proteomics`) | **P1 (High)** |
| 6 | `offline astronaut health monitoring Mars 44 minute blackout` | Yes | `nasa.gov`, `ntrs.nasa.gov`, `spaceappschallenge.org` | **No** | Opportunity for `/guides/offline-astronaut-health-monitoring-mars-blackout` | **P1 (High)** |
| 7 | `NASA HUNCH red flag triage astronaut safety abstention` | Yes | `nasa.gov`, `nasahunch.com` | **No** | Opportunity for `/guides/nasa-hunch-red-flag-safety-gate-abstention` | **P1 (High)** |
| 8 | `LiDAR signed tetrahedral volumetry microgravity fluid shift` | Yes | `pmc.ncbi.nlm.nih.gov`, `nasa.gov` | **No** | Opportunity for `/guides/lidar-tetrahedral-volumetry-fluid-shift` | **P1 (High)** |

**Baseline citation rate:** `0 / 8` (`0%`).

---

## 2. Harness² Cycle 1 — Propose → Probe → Compose (`v5.3.0`)

### Proposed & Shipped Changes (`webapp/seo_surfaces.py` + `webapp/app.py`)
1. **16 Programmatic Non-JS SSR Direct-Answer Surfaces** (automatic Light/Dark WCAG AAA contrast, above-the-fold `.direct-answer` box, 3-level `BreadcrumbList` + `TechArticle`/`Dataset`/`FAQPage` JSON-LD, live computed tables from bundled NASA JSON, offline 2D QR codes, honest scope disclosures):
   - `/for-judges` + downloadable `/for-judges/evaluation-kit.txt` (`Content-Disposition: attachment`)
   - `/scenarios` + 4 scenario deep-dives (`/scenarios/nominal_lunar`, `/scenarios/hypercapnia_drift`, `/scenarios/musculoskeletal_asymmetry`, `/scenarios/spe_blackout`)
   - `/data` + 4 empirical NASA data notes (`/data/osd-571-inspiration4-proteomics`, `/data/radlab-iss-dostel-radiation`, `/data/barger-2014-iss-sleep-adaptation`, `/data/nasa-pmc-space-biology-corpus`)
   - `/guides` + 4 high-intent technical guides (`/guides/offline-astronaut-health-monitoring-mars-blackout`, `/guides/mahalanobis-multivariate-triage-spaceflight`, `/guides/nasa-hunch-red-flag-safety-gate-abstention`, `/guides/lidar-tetrahedral-volumetry-fluid-shift`)
2. **Crawl Hygiene & Discovery Infrastructure:**
   - Trailing-slash `308 Permanent Redirect` middleware preserving query strings across all canonical non-slash pages.
   - Dynamic `/sitemap.xml` (24 indexable URLs with `2026-11-21` `<lastmod>`), RSS 2.0 `/feed.xml` (11 items, auto-discovered in `<head>`), `/robots.txt`, `/llms.txt`, `/llms-full.txt`, and IndexNow verification (`/indexnow.txt` + `webapp/scripts/submit_indexnow.py`).
   - `WebSite` + `SearchAction` JSON-LD sitewide + Houston, TX `Organization` / `Place` entity grounding.
3. **Public Read-Only MCP Endpoint (`POST /api/mcp/`, `MCP-Protocol-Version: 2025-06-18`):**
   - Exposes 5 verifiable tools (`get_verification_report`, `list_mission_scenarios`, `evaluate_telemetry`, `search_nasa_evidence`, `get_nasa_datasets_summary`) so external AI agents and judging harnesses can query AstroKinetics directly as a tool.

### Deterministic Release Gate (`webapp/scripts/geo_citation_monitor.py`)
Run after every edit and every live deploy:
```bash
python3 webapp/scripts/geo_citation_monitor.py --local
python3 webapp/scripts/geo_citation_monitor.py --base-url https://astrokinetics-space-health-765428358644.us-central1.run.app --record-memory
python3 webapp/scripts/submit_indexnow.py --send
```

---

## 3. Ongoing Auto-RSI Refresh Cadence (Every 2–4 Weeks)

1. **Source Freshness Gate (< 90 days):** Re-verify all 6 primary NASA references in `SOURCE_CHECKS` (`webapp/seo_surfaces.py`) before **2027-02-19**; update `MODIFIED_DATE` only after substantive content or verification changes.
2. **Re-run the 8-keyword AI Overview table** after IndexNow submission, Search Console sitemap registration, and authorized external distribution (`docs/geo-distribution-snippets.md`).
3. **Custom Domain Recommendation (Highest Single SEO Multiplier):** Cloud Run's `*.us-central1.run.app` subdomain inherits low domain authority and faces slow organic indexing compared to a custom apex domain (e.g., `astrokinetics.org` or `astra-spacehealth.org`) mapped to the same Cloud Run service with Google Search Console domain verification.
