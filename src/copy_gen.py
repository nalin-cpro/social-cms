"""
Generates all campaign copy using Claude.
Brand-aware, campaign-aware, validated against dos/donts rules from brands.json.
Called by pipeline.py for every post in the campaign plan.
"""

import json
import logging
import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv

from src.onboarding import load_brand, get_dos_and_donts, validate_copy

load_dotenv()

logger = logging.getLogger(__name__)

_CHANNEL_RULES = {
    "instagram_post": (
        "Instagram caption: 3-4 sentences max. Use line breaks for rhythm. "
        "Hashtags on a new line after the caption. "
        "15 hashtags — mix brand, product, lifestyle, niche. "
        "First hashtag always #milwaukeebootcompany or #moralcode."
    ),
    "instagram_stories": (
        "Story frames: punchy, bold, minimal copy. "
        "Headline max 8 words. Body max 2 sentences. "
        "Label is 2-3 words max. No hashtags in stories."
    ),
    "tiktok": (
        "TikTok caption: conversational, energetic. "
        "Max 150 chars before hashtags. 5-8 hashtags only. "
        "First line must hook attention immediately."
    ),
    "email": (
        "Email: subject lines under 50 chars each. "
        "Preview text under 90 chars. "
        "Body points are bullet-ready content, not full paragraphs. "
        "CTA is 2-4 words, action-first."
    ),
    "sms": (
        "SMS: max 160 characters total including the link placeholder [link]. "
        "Direct and clear. One CTA. No hashtags."
    ),
}

_CHANNEL_SCHEMAS = {
    "instagram_post": '{"caption": "...", "hashtags": "...", "hook": "..."}',
    "instagram_stories": (
        '{"frame_1": {"label": "...", "headline": "...", "body": "..."}, '
        '"frame_2": {"label": "...", "headline": "...", "body": "..."}}'
    ),
    "tiktok": '{"caption": "...", "hashtags": "...", "hook": "..."}',
    "email": (
        '{"subject_lines": ["...", "...", "..."], "preview_text": "...", '
        '"body_points": ["...", "...", "..."], "cta": "..."}'
    ),
    "sms": '{"message": "..."}',
}


def build_system_prompt(brand_key: str, channel: str) -> str:
    brand = load_brand(brand_key)
    rules = get_dos_and_donts(brand_key)

    dos = "\n".join(f"- {d}" for d in rules["dos"])
    donts = "\n".join(f"- {d}" for d in rules["donts"])
    forbidden = ", ".join(rules["forbidden_terms"])

    return (
        f"You write marketing copy for {brand['name']}.\n\n"
        f"Brand voice: {brand.get('brand_voice', '')}\n\n"
        f"Rules — always follow:\n{dos}\n\n"
        f"Rules — never break:\n{donts}\n\n"
        f"Forbidden terms — never use these words: {forbidden}\n\n"
        f"Channel format: {_CHANNEL_RULES.get(channel, '')}\n\n"
        "Return ONLY a raw JSON object. No markdown, no explanation, no backticks."
    )


def build_user_prompt(
    brand_key: str,
    product_name: str,
    campaign: str,
    channel: str,
    product_metadata: dict,
    visual_direction: str,
    post_type: str,
) -> str:
    price = product_metadata.get("price", "")
    description = (product_metadata.get("description", "") or "")[:400]
    product_type = product_metadata.get("product_type", "footwear")

    style_notes = ""
    analysis_path = Path(f"config/brand_analysis_{brand_key}.json")
    if analysis_path.exists():
        with open(analysis_path) as f:
            analysis = json.load(f)
        motifs = analysis.get("recurring_motifs", [])
        if motifs:
            style_notes = (
                f"\nBrand visual motifs to reference in copy: {', '.join(motifs[:4])}"
            )

    return (
        f"Write {channel} copy for this product and campaign.\n\n"
        f"Product: {product_name}\n"
        f"Type: {product_type}\n"
        f"Price: {price}\n"
        f"Description: {description}\n\n"
        f"Campaign theme: {campaign}\n"
        f"Post format: {post_type}\n"
        f"Visual direction: {visual_direction}"
        f"{style_notes}\n\n"
        f"Return this exact JSON structure:\n{_CHANNEL_SCHEMAS.get(channel, '{}')}"
    )


def _parse_response(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


def _add_validation(brand_key: str, channel: str, copy: dict) -> dict:
    """Append copy_valid and violations fields to a copy dict."""
    full_text = json.dumps(copy)
    result = validate_copy(brand_key, full_text)
    copy["copy_valid"] = result["valid"]
    copy["violations"] = result["violations"]
    return copy


def generate_post_copy(
    brand_key: str,
    product_name: str,
    campaign: str,
    channel: str,
    product_metadata: dict,
    visual_direction: str = "",
    post_type: str = "static",
) -> dict:
    """Generate copy for a single channel.

    Returns a channel-specific dict with copy_valid and violations appended.
    Never raises — returns {"copy_valid": False, "violations": [...]} on failure.
    """
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        system = build_system_prompt(brand_key, channel)
        user = build_user_prompt(
            brand_key, product_name, campaign, channel,
            product_metadata, visual_direction, post_type,
        )

        logger.info("Generating %s copy | brand=%s product='%s'", channel, brand_key, product_name)

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

        copy = _parse_response(response.content[0].text)
        copy = _add_validation(brand_key, channel, copy)

        logger.info(
            "%s copy generated | valid=%s violations=%d",
            channel, copy["copy_valid"], len(copy["violations"]),
        )
        return copy

    except Exception as exc:
        logger.error("generate_post_copy failed | channel=%s: %s", channel, exc)
        return {"copy_valid": False, "violations": [f"Generation error: {exc}"]}


def generate_all_copy(
    brand_key: str,
    product_name: str,
    campaign: str,
    channels: list,
    product_metadata: dict,
    visual_direction: str = "",
    post_type: str = "static",
) -> dict:
    """Generate copy for all requested channels.

    Returns dict keyed by channel name.
    """
    result = {}
    for channel in channels:
        result[channel] = generate_post_copy(
            brand_key, product_name, campaign, channel,
            product_metadata, visual_direction, post_type,
        )
    return result


def regenerate_from_comment(
    brand_key: str,
    product_name: str,
    campaign: str,
    channel: str,
    original_copy: dict,
    client_comment: str,
    product_metadata: dict,
) -> dict:
    """Regenerate copy incorporating a client's review comment.

    The comment is applied silently — the output reads as original polished
    copy, not a tracked revision.
    Never raises.
    """
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        system = (
            build_system_prompt(brand_key, channel)
            + f"\n\nA reviewer left this note about the previous version: '{client_comment}'\n"
            "Incorporate this feedback naturally into the new version.\n"
            "Do not reference the feedback in the output.\n"
            "The result should read as original, polished copy — not a revision."
        )

        original_json = json.dumps(
            {k: v for k, v in original_copy.items() if k not in ("copy_valid", "violations")},
            indent=2,
        )
        user = (
            f"Previous version:\n{original_json}\n\n"
            + build_user_prompt(
                brand_key, product_name, campaign, channel,
                product_metadata, "", "static",
            )
        )

        logger.info(
            "Regenerating %s copy from comment | brand=%s product='%s'",
            channel, brand_key, product_name,
        )

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

        copy = _parse_response(response.content[0].text)
        copy = _add_validation(brand_key, channel, copy)

        logger.info("Regenerated %s copy | valid=%s", channel, copy["copy_valid"])
        return copy

    except Exception as exc:
        logger.error("regenerate_from_comment failed | channel=%s: %s", channel, exc)
        return {"copy_valid": False, "violations": [f"Generation error: {exc}"]}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    from src.shopify import get_product_metadata

    metadata = get_product_metadata("mbc", "Bernie Men's Slip On Sneaker") or {}

    result = generate_all_copy(
        brand_key="mbc",
        product_name="Bernie Men's Slip On Sneaker",
        campaign="Why It Feels Different",
        channels=["instagram_post", "instagram_stories", "email", "sms"],
        product_metadata=metadata,
        visual_direction=(
            "Model in warm loft interior wearing the Bernie with slim dark jeans "
            "and cream knit. Knee-down framing. Soft ambient light."
        ),
        post_type="static",
    )

    print(json.dumps(result, indent=2))

    print("\n--- Violation test ---")
    test = validate_copy("mbc", "These affordable work boots are perfect for construction.")
    print(test)

    print("\n--- Regeneration test ---")
    if result.get("instagram_post"):
        revised = regenerate_from_comment(
            brand_key="mbc",
            product_name="Bernie Men's Slip On Sneaker",
            campaign="Why It Feels Different",
            channel="instagram_post",
            original_copy=result["instagram_post"],
            client_comment="Can we make this sound a bit more aspirational? Less product-focused.",
            product_metadata=metadata,
        )
        print("Revised caption:", revised.get("caption", ""))
