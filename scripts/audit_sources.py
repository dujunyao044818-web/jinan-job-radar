#!/usr/bin/env python3
"""Discover recruitment columns on candidate official sites without adding them to production."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from collect import build_session, clean_text, is_recruitment_notice, normalize_title

ROOT = Path(__file__).resolve().parents[1]
KEYWORDS = re.compile(r"招聘|人才招聘|人才引进|人事招聘|诚聘|加入我们")
PATH_HINTS = re.compile(r"recruit|job|talent|hr|rencai|zhaopin|rczp", re.I)
LOCAL = timezone(timedelta(hours=8))


def candidate_links(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    host = urlparse(base_url).hostname
    found = {}
    for anchor in soup.select("a[href]"):
        text = clean_text(anchor.get_text(" ", strip=True))
        url = urljoin(base_url, anchor.get("href", ""))
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or parsed.hostname != host:
            continue
        if KEYWORDS.search(text) or PATH_HINTS.search(parsed.path):
            found[url.split("#", 1)[0]] = {"text": text or "路径关键词匹配", "url": url.split("#", 1)[0]}
    return list(found.values())[:30]


def count_notices(html: str) -> tuple[int, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    titles = []
    for anchor in soup.select("a[href]"):
        title = normalize_title(anchor.get("title") or anchor.get_text(" ", strip=True))
        if is_recruitment_notice(title) and title not in titles:
            titles.append(title)
    return len(titles), titles[:5]


def audit_one(candidate, session):
    result = {
        **candidate,
        "checked_at": datetime.now(LOCAL).isoformat(timespec="seconds"),
        "identity_confirmed": False,
        "status": "failed",
        "recruitment_url": None,
        "notices_found": None,
        "sample_titles": [],
        "error": "",
        "links_checked": [],
    }
    try:
        home = session.get(candidate["website"], timeout=(8, 25))
        home.raise_for_status()
        home.encoding = home.apparent_encoding or "utf-8"
        home_soup = BeautifulSoup(home.text, "html.parser")
        identity_text = clean_text((home_soup.title.get_text(" ", strip=True) if home_soup.title else "") + " " + home_soup.get_text(" ", strip=True)[:4000])
        result["identity_confirmed"] = any(alias in identity_text for alias in candidate["aliases"])
        links = candidate_links(home.text, candidate["website"])
        for link in links[:15]:
            check = {"url": link["url"], "label": link["text"], "status": "error", "notices_found": None}
            try:
                response = session.get(link["url"], timeout=(8, 25))
                response.raise_for_status()
                response.encoding = response.apparent_encoding or "utf-8"
                count, titles = count_notices(response.text)
                check.update(status="ok", notices_found=count)
                if count and result["recruitment_url"] is None:
                    result.update(recruitment_url=link["url"], notices_found=count, sample_titles=titles)
            except Exception as exc:
                check["error"] = f"{type(exc).__name__}: {clean_text(str(exc))[:160]}"
            result["links_checked"].append(check)
        if result["identity_confirmed"] and result["recruitment_url"]:
            result["status"] = "verified_candidate"
        elif result["identity_confirmed"]:
            result["status"] = "official_site_only"
            result["error"] = "已确认官网身份，但未找到含可识别招聘公告的栏目"
        else:
            result["error"] = "页面内容不足以确认单位身份"
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {clean_text(str(exc))[:200]}"
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, default=ROOT / "scripts/source_candidates.json")
    parser.add_argument("--output", type=Path, default=ROOT / "source-audit.json")
    args = parser.parse_args()
    candidates = json.loads(args.candidates.read_text(encoding="utf-8"))
    session = build_session()
    results = [audit_one(candidate, session) for candidate in candidates]
    args.output.write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for item in results:
        print(item["name"], item["status"], item["recruitment_url"] or "-", item["notices_found"], item["error"])


if __name__ == "__main__":
    main()
