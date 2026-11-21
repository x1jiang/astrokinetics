#!/usr/bin/env python3
"""
Submit public AstroKinetics · ASTRA URLs from /sitemap.xml to IndexNow.
Adapted from Admit Coach's scripts/submit_indexnow.py.

Usage:
    python3 webapp/scripts/submit_indexnow.py --dry-run
    python3 webapp/scripts/submit_indexnow.py --send
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

DEFAULT_HOST = "astrokinetics-space-health-765428358644.us-central1.run.app"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"


def curl_get(url: str) -> str:
    proc = subprocess.run(["curl", "-sS", "--fail", "--max-time", "20", url], capture_output=True, text=True, check=True)
    return proc.stdout


def collect_sitemap_urls(sitemap_url: str) -> list[str]:
    root = ET.fromstring(curl_get(sitemap_url))
    return [el.text.strip() for el in root.findall(".//{*}url/{*}loc") if el.text]


def submit_indexnow(host: str, key: str, key_location: str, urls: list[str]) -> tuple[int, str]:
    payload = json.dumps({"host": host, "key": key, "keyLocation": key_location, "urlList": urls})
    proc = subprocess.run(
        [
            "curl",
            "-sS",
            "-w",
            "\n%{http_code}",
            "--max-time",
            "20",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json; charset=utf-8",
            "-d",
            payload,
            INDEXNOW_ENDPOINT,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    lines = proc.stdout.strip().splitlines()
    code = int(lines[-1]) if lines and lines[-1].isdigit() else 0
    body = "\n".join(lines[:-1])
    return code, body


def main() -> None:
    parser = argparse.ArgumentParser(description="Submit AstroKinetics · ASTRA sitemap URLs to IndexNow.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--send", action="store_true", help="Actually POST to api.indexnow.org")
    parser.add_argument("--dry-run", action="store_true", help="Print payload without sending")
    args = parser.parse_args()

    base = f"https://{args.host}"
    key = curl_get(f"{base}/indexnow.txt").strip()
    key_location = f"{base}/{key}.txt"
    urls = collect_sitemap_urls(f"{base}/sitemap.xml")

    print(f"Host: {args.host}")
    print(f"Key location: {key_location}")
    print(f"Discovered URLs ({len(urls)}):")
    for u in urls:
        print(f"  - {u}")

    if not args.send or args.dry_run:
        print("\nDry run complete. Pass --send to submit to IndexNow.")
        return

    code, body = submit_indexnow(args.host, key, key_location, urls)
    print(f"\nIndexNow response: HTTP {code} {body}")
    if code not in (200, 202):
        sys.exit(1)


if __name__ == "__main__":
    main()
