#!/usr/bin/env python3
"""
scripts/fetchPressComments.py

Arsenal / Liverpool の公式サイトから試合後プレスカンファレンス記事を取得し、
Supabase の press_comments テーブルに保存する。

事前に Supabase で以下の SQL を実行してテーブルを作成してください:

    CREATE TABLE press_comments (
      id            TEXT PRIMARY KEY,
      fixture_id    INTEGER REFERENCES fixtures(id),
      team_id       INTEGER NOT NULL,
      article_url   TEXT UNIQUE NOT NULL,
      article_title TEXT,
      published_at  TIMESTAMPTZ,
      speaker       TEXT,
      comment_text  TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

使用ライブラリ:
    pip install requests beautifulsoup4 supabase

環境変数（.env または GitHub Secrets から取得）:
    SUPABASE_URL / VITE_SUPABASE_URL
    SUPABASE_SERVICE_KEY / VITE_SUPABASE_SERVICE_KEY

⚠️ 注意: 公式サイトが JavaScript レンダリングの場合、記事本文が取得できないことがあります。
         その場合は Playwright 等のヘッドレスブラウザが必要です。
"""

import hashlib
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from supabase import create_client

# ── .env 読み込み ──────────────────────────────────────────────
def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

load_env()

# VITE_ プレフィックスありとなしの両方に対応
SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("VITE_SUPABASE_URL")
)
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("VITE_SUPABASE_SERVICE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL / SUPABASE_SERVICE_KEY が設定されていません")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print(f"Supabase: connected ✓")

# ── 設定 ──────────────────────────────────────────────────────
TEAMS = [
    {
        "id":       42,
        "name":     "Arsenal",
        "news_url": "https://www.arsenal.com/news",
        "keywords": ["press conference", "arteta"],
        "speaker":  "Arteta",
    },
    {
        "id":       40,
        "name":     "Liverpool",
        "news_url": "https://www.liverpoolfc.com/news",
        "keywords": ["press conference", "slot"],
        "speaker":  "Slot",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
}

# ── ユーティリティ ─────────────────────────────────────────────

def make_id(url: str) -> str:
    """URL の SHA-256 先頭20文字を一意IDとして使用"""
    return hashlib.sha256(url.encode()).hexdigest()[:20]

def fetch_html(url: str, timeout: int = 15) -> str | None:
    try:
        res = requests.get(url, headers=HEADERS, timeout=timeout)
        res.raise_for_status()
        # JS レンダリングが必要なサイトでは空に近い HTML が返る場合がある
        if len(res.text) < 2000:
            print(f"  [warn] レスポンスが短すぎます ({len(res.text)} chars) — JSレンダリングが必要な可能性")
        return res.text
    except requests.exceptions.HTTPError as e:
        print(f"  [warn] HTTP error: {url} — {e}")
    except requests.exceptions.ConnectionError as e:
        print(f"  [warn] Connection error: {url} — {e}")
    except requests.exceptions.Timeout:
        print(f"  [warn] Timeout: {url}")
    except Exception as e:
        print(f"  [warn] Unexpected error: {url} — {e}")
    return None

def to_absolute(href: str, base_url: str) -> str:
    if href.startswith("http"):
        return href
    origin = "/".join(base_url.split("/")[:3])  # https://example.com
    return origin + (href if href.startswith("/") else "/" + href)

# ── ニュース一覧からプレスカンファレンス記事URLを収集 ────────────

def find_press_conf_links(team: dict) -> list[dict]:
    """
    ニュースページを取得し、press conference 関連記事のリンクを返す。
    Returns: [{"url": str, "title": str}, ...]
    """
    print(f"  Fetching news index: {team['news_url']}")
    html = fetch_html(team["news_url"])
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    seen_urls = set()
    links = []

    for a in soup.find_all("a", href=True):
        title = a.get_text(" ", strip=True)
        href  = a["href"]
        combined = (title + " " + href).lower()

        # press conference キーワード + speaker キーワードで絞り込む
        has_pc      = "press conference" in combined or "pre-match" in combined or "post-match" in combined
        has_speaker = any(kw in combined for kw in team["keywords"][1:])  # "arteta" or "slot"

        if not (has_pc or has_speaker):
            continue

        url = to_absolute(href, team["news_url"])

        # ニュース記事らしいURLのみ（"/news/" を含む等）
        if "/news/" not in url and "/article/" not in url:
            continue

        if url not in seen_urls:
            seen_urls.add(url)
            links.append({"url": url, "title": title})

    print(f"  Found {len(links)} candidate articles")
    return links[:10]  # 最大10件

# ── 記事本文を取得してコメントを抽出 ──────────────────────────

def extract_article(url: str, speaker: str) -> tuple[str | None, str | None]:
    """
    記事URLから本文を取得し (comment_text, published_at_iso) を返す。
    取得できない場合は (None, None)。
    """
    html = fetch_html(url)
    if not html:
        return None, None

    soup = BeautifulSoup(html, "html.parser")

    # ── 公開日時（meta タグ優先）──
    published_at = None
    meta_candidates = [
        {"property": "article:published_time"},
        {"name":     "publishdate"},
        {"itemprop": "datePublished"},
        {"name":     "date"},
    ]
    for attrs in meta_candidates:
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            try:
                published_at = datetime.fromisoformat(
                    tag["content"].replace("Z", "+00:00")
                ).isoformat()
                break
            except ValueError:
                pass

    # time タグからも試みる
    if not published_at:
        time_tag = soup.find("time")
        if time_tag:
            dt_str = time_tag.get("datetime") or time_tag.get_text(strip=True)
            try:
                published_at = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).isoformat()
            except (ValueError, AttributeError):
                pass

    # ── 本文エリアを特定 ──
    body = (
        soup.find("article")
        or soup.find(class_=re.compile(r"article|content|body|text|story", re.I))
        or soup.find("main")
        or soup.body
    )
    if not body:
        return None, published_at

    paragraphs = [
        p.get_text(" ", strip=True)
        for p in body.find_all("p")
        if p.get_text(strip=True)
    ]
    if not paragraphs:
        return None, published_at

    full_text = "\n".join(paragraphs)

    if len(full_text) < 100:
        print(f"    [warn] 本文が短すぎます ({len(full_text)} chars) — JSレンダリング未対応の可能性")
        return None, published_at

    # speaker の発言を含む段落を優先抽出
    speaker_lower = speaker.lower()
    relevant = [
        p for p in paragraphs
        if speaker_lower in p.lower()
        or ": " in p  # 発言形式 "Arteta: ..." のような行
        or "said" in p.lower()
        or "explained" in p.lower()
    ]

    if relevant:
        comment_text = "\n".join(relevant[:25])
    else:
        # 該当なければ全文の先頭2000文字
        comment_text = full_text[:2000]

    return comment_text.strip() or None, published_at

# ── 日付から fixture_id を特定 ────────────────────────────────

def find_fixture_id(team_id: int, published_at_iso: str | None) -> int | None:
    """
    記事公開日の 0〜4日前に行われた team_id の試合を Supabase から検索。
    プレスカンファレンスは試合後1〜3日以内に行われることが多い。
    """
    if not published_at_iso:
        return None

    try:
        pub_dt = datetime.fromisoformat(published_at_iso)
    except ValueError:
        return None

    date_from = (pub_dt - timedelta(days=4)).strftime("%Y-%m-%dT00:00:00")
    date_to   = pub_dt.strftime("%Y-%m-%dT23:59:59")

    res = (
        supabase.table("fixtures")
        .select("id,match_date")
        .eq("team_id", team_id)
        .gte("match_date", date_from)
        .lte("match_date", date_to)
        .order("match_date", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]
    return None

# ── Supabase への INSERT（重複スキップ）─────────────────────────

def save_comment(record: dict) -> bool:
    # article_url で重複チェック
    existing = (
        supabase.table("press_comments")
        .select("id")
        .eq("article_url", record["article_url"])
        .execute()
    )
    if existing.data:
        print(f"    [skip] 既存レコードのためスキップ")
        return False

    supabase.table("press_comments").insert(record).execute()
    return True

# ── メイン ────────────────────────────────────────────────────

def main():
    total_saved = 0

    for team in TEAMS:
        print(f"\n{'='*60}")
        print(f"[{team['name']}] プレスカンファレンス記事を検索中...")

        links = find_press_conf_links(team)
        if not links:
            print(f"  記事が見つかりませんでした（サイト構造変更 or JS レンダリング）")
            continue

        for link in links:
            print(f"\n  → {link['title'][:70]}")
            print(f"    {link['url']}")
            time.sleep(2)  # レート制限対策

            comment_text, published_at = extract_article(link["url"], team["speaker"])

            if not comment_text:
                print(f"    [skip] コメント抽出できず")
                continue

            fixture_id = find_fixture_id(team["id"], published_at)
            print(f"    published_at : {published_at}")
            print(f"    fixture_id   : {fixture_id}")
            print(f"    comment_text : {comment_text[:80].replace(chr(10), ' ')}...")

            record = {
                "id":            make_id(link["url"]),
                "fixture_id":    fixture_id,
                "team_id":       team["id"],
                "article_url":   link["url"],
                "article_title": link["title"],
                "published_at":  published_at,
                "speaker":       team["speaker"],
                "comment_text":  comment_text,
            }

            if save_comment(record):
                total_saved += 1
                print(f"    ✓ Saved")

        time.sleep(3)

    print(f"\n{'='*60}")
    print(f"✓ 完了: {total_saved} 件保存しました")


if __name__ == "__main__":
    main()
