"""
Brand onboarding module.
Fetches Instagram reference images and runs Claude Vision analysis to produce
a cached brand_style_analysis used by image_gen.py prompt building.
"""

import base64
import json
import logging
import os
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_BRANDS_PATH = Path(__file__).parent.parent / "config" / "brands.json"
_CACHE_DIR = Path(__file__).parent.parent / "config"


# ── Brand config helpers ──────────────────────────────────────────────────────

def _load_brands() -> dict:
    with open(_BRANDS_PATH) as f:
        return json.load(f)


def load_brand(brand_key: str) -> dict:
    return _load_brands().get(brand_key.lower(), {})


# ── Copy rules helpers ───────────────────────────────────────────────────────

def get_dos_and_donts(brand_key: str) -> dict:
    """Return copy rules for a brand.

    Returns:
        {"dos": list[str], "donts": list[str], "forbidden_terms": list[str]}
    """
    brand = load_brand(brand_key)
    rules = brand.get("copy_rules", {})
    return {
        "dos": rules.get("dos", []),
        "donts": rules.get("donts", []),
        "forbidden_terms": rules.get("forbidden_terms", []),
    }


def validate_copy(brand_key: str, text: str) -> dict:
    """Check copy text against brand forbidden terms and dont-rules.

    Returns:
        {"valid": bool, "violations": list[str]}

    Only checks mechanically-detectable rules (forbidden terms).
    Qualitative dos/donts require Claude to enforce during generation.
    """
    rules = get_dos_and_donts(brand_key)
    forbidden = rules.get("forbidden_terms", [])

    text_lower = text.lower()
    violations = [
        f"Forbidden term used: '{term}'"
        for term in forbidden
        if term.lower() in text_lower
    ]

    return {"valid": len(violations) == 0, "violations": violations}


# ── Instagram fetching ────────────────────────────────────────────────────────

def get_instagram_reference_images(
    brand_key: str,
    count: int = 25,
) -> list[dict]:
    """Return reference images for brand analysis.

    Returns list of dicts: {"url": str, "caption": str, "type": str}

    Strategy — tries in order:
    1. Manually curated URLs in brands.json["reference_images"] (avoids Instagram IP blocks)
    2. Instagram public API endpoint
    3. Instagram HTML scrape
    4. Empty list (never crash)
    """
    brand = load_brand(brand_key)

    manual_urls = brand.get("reference_images", [])
    if manual_urls:
        logger.info(
            "Using %d manual reference images for %s (skipping Instagram scrape)",
            len(manual_urls[:count]), brand_key,
        )
        return [{"url": u, "caption": "", "type": "image"} for u in manual_urls[:count]]

    handle = brand.get("instagram_handle", "")
    if not handle:
        logger.warning("No Instagram handle configured for %s", brand_key)
        return []

    posts = _fetch_via_json_endpoint(handle, count)
    if posts:
        logger.info("Fetched %d posts via JSON endpoint for @%s", len(posts), handle)
        return posts

    posts = _fetch_via_html_scrape(handle, count)
    if posts:
        logger.info("Fetched %d posts via HTML scrape for @%s", len(posts), handle)
        return posts

    logger.warning(
        "Could not fetch Instagram posts for @%s — proceeding without reference", handle
    )
    return []


def _fetch_via_json_endpoint(handle: str, count: int) -> list[dict]:
    """Instagram public API — works for public accounts without login."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://www.instagram.com/",
    }

    try:
        session = requests.Session()
        profile_url = f"https://www.instagram.com/{handle}/"
        resp = session.get(profile_url, headers=headers, timeout=15)

        if resp.status_code != 200:
            logger.warning("Profile page returned %s for @%s", resp.status_code, handle)
            return []

        # Extract user ID from page source
        user_id_match = re.search(r'"user_id":"(\d+)"', resp.text)
        if not user_id_match:
            user_id_match = re.search(
                r'"id":"(\d+)".*?"username":"' + re.escape(handle), resp.text
            )
        if not user_id_match:
            logger.warning("Could not extract user_id from profile page for @%s", handle)
            return []

        user_id = user_id_match.group(1)
        logger.info("Found user_id %s for @%s", user_id, handle)
        time.sleep(1)

        api_url = (
            f"https://www.instagram.com/api/v1/feed/user/{user_id}/username/"
            f"?count={min(count, 50)}"
        )
        api_resp = session.get(api_url, headers=headers, timeout=15)

        if api_resp.status_code != 200:
            logger.warning("Feed API returned %s for @%s", api_resp.status_code, handle)
            return []

        data = api_resp.json()
        items = data.get("items", [])
        posts = []

        for item in items[:count]:
            post_type = item.get("media_type", 1)
            type_label = {1: "image", 8: "carousel", 2: "video"}.get(post_type, "image")

            image_url = None
            if post_type == 8:
                carousel_media = item.get("carousel_media", [])
                if carousel_media:
                    candidates = carousel_media[0].get("image_versions2", {}).get("candidates", [])
                    if candidates:
                        image_url = candidates[0].get("url")
            else:
                candidates = item.get("image_versions2", {}).get("candidates", [])
                if candidates:
                    image_url = candidates[0].get("url")

            if not image_url:
                continue

            caption = ""
            caption_data = item.get("caption")
            if caption_data and isinstance(caption_data, dict):
                caption = caption_data.get("text", "")[:200]

            posts.append({"url": image_url, "caption": caption, "type": type_label})

        return posts

    except Exception as exc:
        logger.error("JSON endpoint fetch failed for @%s: %s", handle, exc)
        return []


def _fetch_via_html_scrape(handle: str, count: int) -> list[dict]:
    """Fallback: scrape CDN image URLs from Instagram HTML page source."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }
    try:
        resp = requests.get(
            f"https://www.instagram.com/{handle}/",
            headers=headers,
            timeout=15,
        )
        if resp.status_code != 200:
            logger.warning("HTML scrape returned %s for @%s", resp.status_code, handle)
            return []

        urls = re.findall(
            r'https://[^"\\]+\.(?:jpg|jpeg|png)(?:\?[^"\\]*)?', resp.text
        )
        post_urls = list(dict.fromkeys([
            u for u in urls if "scontent" in u and len(u) > 100
        ]))[:count]

        return [{"url": u, "caption": "", "type": "image"} for u in post_urls]

    except Exception as exc:
        logger.error("HTML scrape fallback failed for @%s: %s", handle, exc)
        return []


# ── Brand analysis ────────────────────────────────────────────────────────────

def analyse_brand_instagram(
    brand_key: str,
    posts: list[dict] = None,
) -> dict:
    """Pass up to 20 Instagram posts to Claude Vision for brand style analysis.

    Returns a brand_style_analysis dict and caches it to config/.
    """
    import anthropic

    if posts is None:
        posts = get_instagram_reference_images(brand_key, count=25)

    if not posts:
        logger.warning("No posts available for brand analysis of %s", brand_key)
        return {}

    brand = load_brand(brand_key)
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Download and base64-encode images — Claude Vision accepts up to 20
    content = []
    image_count = 0

    for post in posts[:20]:
        try:
            resp = requests.get(post["url"], timeout=10)
            if resp.status_code != 200:
                logger.warning("Image returned %s: %s", resp.status_code, post["url"][:60])
                continue

            img_b64 = base64.standard_b64encode(resp.content).decode()
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": img_b64,
                },
            })
            image_count += 1
            logger.info("Loaded reference image %d for analysis", image_count)

        except Exception as exc:
            logger.warning("Could not load image %s: %s", post["url"][:60], exc)
            continue

    if image_count < 3:
        logger.warning(
            "Only %d images loaded — insufficient for analysis (need 3+)", image_count
        )
        return {}

    content.append({
        "type": "text",
        "text": (
            f"You are analysing {image_count} recent Instagram posts "
            f"from @{brand['instagram_handle']} ({brand['name']}).\n\n"
            "Study every image carefully and provide a detailed brand visual analysis.\n"
            "Return ONLY a JSON object with no markdown:\n\n"
            "{\n"
            '  "lighting": {\n'
            '    "primary_style": "description of dominant lighting",\n'
            '    "time_of_day": "morning/afternoon/golden hour/studio/mixed",\n'
            '    "quality": "hard/soft/diffused/dramatic",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "composition": {\n'
            '    "primary_angles": ["list of most common camera angles"],\n'
            '    "framing": "how subjects are typically framed",\n'
            '    "subject_placement": "rule of thirds/centred/etc",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "colour_palette": {\n'
            '    "dominant_colours": ["list of dominant colours"],\n'
            '    "accent_colours": ["list of accent colours"],\n'
            '    "overall_temperature": "warm/cool/neutral",\n'
            '    "saturation": "vibrant/muted/natural",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "settings_and_environments": {\n'
            '    "most_common": ["list of most common settings"],\n'
            '    "indoor_outdoor_split": "percentage estimate",\n'
            '    "background_style": "description of typical backgrounds",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "subject_and_styling": {\n'
            '    "model_presentation": "how models are typically posed/styled",\n'
            '    "outfit_styles": ["common outfit types seen"],\n'
            '    "product_placement": "how the product is shown relative to subject",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "post_production": {\n'
            '    "editing_style": "clean/moody/bright/filmic/etc",\n'
            '    "grain_or_texture": true,\n'
            '    "contrast_level": "high/medium/low",\n'
            '    "notes": "specific observations"\n'
            "  },\n"
            '  "recurring_motifs": ["list of visual elements that appear repeatedly"],\n'
            '  "what_to_always_do": ["list of 5 visual rules to always follow"],\n'
            '  "what_to_never_do": ["list of 5 visual rules to never break"],\n'
            '  "flux_style_prompt_addition": '
            '"a 50-word style descriptor to append to every FLUX prompt for this brand"\n'
            "}"
        ),
    })

    logger.info("Sending %d images to Claude Vision for analysis...", image_count)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text.strip()
    analysis = json.loads(raw.replace("```json", "").replace("```", "").strip())

    logger.info(
        "Brand analysis complete for %s: %d motifs identified",
        brand_key,
        len(analysis.get("recurring_motifs", [])),
    )

    cache_path = _CACHE_DIR / f"brand_analysis_{brand_key}.json"
    with open(cache_path, "w") as f:
        json.dump(analysis, f, indent=2)
    logger.info("Brand analysis cached to %s", cache_path)

    return analysis


def load_brand_analysis(brand_key: str) -> dict:
    """Load cached brand analysis, running onboarding first if not yet cached."""
    cache_path = _CACHE_DIR / f"brand_analysis_{brand_key}.json"
    if cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)
    logger.info("No cached analysis for %s — running now", brand_key)
    return analyse_brand_instagram(brand_key)
