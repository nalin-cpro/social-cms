"""
Main pipeline orchestrator.
Reads config/campaign_plan.json, processes each pending post through the full
content stack, and produces a completed package ready for client approval.
"""

import argparse
import json
import logging
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_PLAN_PATH = Path(__file__).parent.parent / "config" / "campaign_plan.json"

_CHANNELS_NEEDING_IMAGES = {"instagram_post", "instagram_stories", "tiktok"}


# ── Plan I/O ──────────────────────────────────────────────────────────────────

def load_campaign_plan() -> list:
    with open(_PLAN_PATH) as f:
        return json.load(f)


def save_campaign_plan(plan: list) -> None:
    with open(_PLAN_PATH, "w") as f:
        json.dump(plan, f, indent=2)


def get_pending_posts(plan: list) -> list:
    return [p for p in plan if p.get("status") == "pending"]


# ── QC ────────────────────────────────────────────────────────────────────────

def _qc_score(lifestyle_path: str | None, metadata: dict, copy: dict) -> tuple[int, str]:
    """Return (score 0-10, verdict). Checks image presence/size and copy validity."""
    score = 0

    if lifestyle_path and Path(lifestyle_path).exists():
        score += 4
        size_kb = Path(lifestyle_path).stat().st_size // 1024
        if size_kb >= 50:
            score += 2
    elif lifestyle_path is None:
        score += 6

    if metadata.get("title"):
        score += 2

    if copy.get("copy_valid", False):
        score += 2

    verdict = "pass" if score >= 7 else "retry"
    return score, verdict


# ── Core processor ───────────────────────────────────────────────────────────

def process_post(post: dict) -> dict:
    """Run the full pipeline for a single post. Never raises — sets status='error' on failure."""
    post_id = post.get("id", "unknown")
    brand_key = post["brand_key"]
    product_name = post["product_name"]
    campaign = post["campaign"]
    channel = post["channel"]
    scene = post.get("scene") or None
    visual_direction = post.get("visual_direction", "")
    post_type = post.get("post_type", "static")
    month_label = post.get("month_label", "")

    logger.info("━━━ [%s] Starting pipeline ━━━", post_id)

    lifestyle_path = None
    feed_post_path = None
    story_1_path = None
    story_2_path = None
    metadata = {}
    copy = {}
    drive_urls = {}

    try:
        # ── Step 1: Product metadata ──────────────────────────────────────────
        logger.info("[%s] Step 1 — Fetching product metadata", post_id)
        from src.shopify import get_product_metadata
        metadata = get_product_metadata(brand_key, product_name) or {}
        if metadata.get("title"):
            logger.info("[%s] Product found: %s (price: %s)",
                        post_id, metadata["title"], metadata.get("price", "n/a"))
        else:
            logger.warning("[%s] Product metadata not found — continuing with empty metadata", post_id)

        # ── Step 2: Lifestyle image ───────────────────────────────────────────
        if channel in _CHANNELS_NEEDING_IMAGES:
            logger.info("[%s] Step 2 — Generating lifestyle image | scene: %s", post_id, scene or "random")
            from src.image_gen import generate_lifestyle_image, get_output_path

            product_image_url = metadata.get("image_url", "")
            if not product_image_url:
                raise ValueError("No product image URL available for image generation")

            lifestyle_path = get_output_path(brand_key, product_name, scene=scene or "")
            success, scene_used = generate_lifestyle_image(
                brand_key, product_name, campaign,
                product_image_url, lifestyle_path, scene_name=scene,
            )
            if not success:
                raise RuntimeError(f"Lifestyle image generation failed (scene={scene})")

            logger.info("[%s] Lifestyle image saved: %s", post_id, lifestyle_path)

            # ── QC ────────────────────────────────────────────────────────────
            score, verdict = _qc_score(lifestyle_path, metadata, {})
            logger.info("[%s] QC score — overall %d/10 — %s", post_id, score, verdict)

        else:
            logger.info("[%s] Step 2 — Skipped (channel=%s needs no image)", post_id, channel)

        # ── Step 3: Composite ─────────────────────────────────────────────────
        if channel in _CHANNELS_NEEDING_IMAGES and lifestyle_path:
            logger.info("[%s] Step 3 — Compositing feed post and stories", post_id)
            from src.compositor import compose_all
            from src.onboarding import load_brand

            brand = load_brand(brand_key)
            brand_name = brand.get("name", brand_key.upper())
            website_url = brand.get("storefront_url", "").replace("https://", "")
            price = metadata.get("price", "")

            from datetime import date
            out_dir = Path("outputs") / brand_key / date.today().isoformat()
            composite_result = compose_all(
                lifestyle_path, brand_key, brand_name, campaign,
                product_name, website_url, str(out_dir), price=price,
            )
            feed_post_path = composite_result["feed_post_path"]
            story_1_path = composite_result["story_1_path"]
            story_2_path = composite_result["story_2_path"]
            logger.info("[%s] Composited: feed=%s", post_id, Path(feed_post_path).name)

        else:
            logger.info("[%s] Step 3 — Skipped (channel=%s)", post_id, channel)

        # ── Step 4: Copy generation ───────────────────────────────────────────
        logger.info("[%s] Step 4 — Generating copy for channel: %s", post_id, channel)
        from src.copy_gen import generate_post_copy

        copy = generate_post_copy(
            brand_key, product_name, campaign, channel,
            metadata, visual_direction, post_type,
        )
        if copy.get("copy_valid"):
            logger.info("[%s] Copy valid — no violations", post_id)
        else:
            logger.warning("[%s] Copy violations: %s", post_id, copy.get("violations", []))

        # ── Step 5: Build local web URLs ──────────────────────────────────────
        def _local_url(path: str | None) -> str | None:
            if not path:
                return None
            p = Path(path)
            # Convert outputs/brand/date/file.jpg → /outputs/brand/date/file.jpg
            try:
                rel = p.relative_to("outputs")
                return f"/outputs/{rel.as_posix()}"
            except ValueError:
                return f"/outputs/{p.name}"

        local_urls = {
            "feed_post_url": _local_url(feed_post_path),
            "story_1_url":   _local_url(story_1_path),
            "story_2_url":   _local_url(story_2_path),
            "lifestyle_url": _local_url(lifestyle_path),
        }
        logger.info("[%s] Step 5 — Image URLs: feed=%s", post_id, local_urls["feed_post_url"])

        # ── Step 6: Update post status ────────────────────────────────────────
        post.update({
            "status": "ready_for_approval",
            "lifestyle_path": lifestyle_path,
            "feed_post_path": feed_post_path,
            "story_1_path": story_1_path,
            "story_2_path": story_2_path,
            "lifestyle_url": local_urls["lifestyle_url"],
            "feed_post_url": local_urls["feed_post_url"],
            "story_1_url":   local_urls["story_1_url"],
            "story_2_url":   local_urls["story_2_url"],
            "copy": copy,
            "processed_at": datetime.now().isoformat(),
        })
        logger.info("[%s] Status updated: ready_for_approval", post_id)

    except Exception as exc:
        logger.error("[%s] Pipeline failed: %s", post_id, exc, exc_info=True)
        post["status"] = "error"
        post["error"] = str(exc)
        post["processed_at"] = datetime.now().isoformat()

    return post


# ── Main entry ────────────────────────────────────────────────────────────────

def run_pipeline(
    brand_key: str = None,
    month_label: str = None,
    dry_run: bool = False,
) -> None:
    plan = load_campaign_plan()

    pending = get_pending_posts(plan)

    if brand_key:
        pending = [p for p in pending if p["brand_key"] == brand_key]
    if month_label:
        pending = [p for p in pending if p.get("month_label") == month_label]

    logger.info("Campaign plan loaded — %d pending posts to process", len(pending))

    if not pending:
        logger.info("Nothing to process.")
        return

    id_to_plan = {p["id"]: p for p in plan}

    for post in pending:
        result = process_post(post)
        id_to_plan[result["id"]] = result
        save_campaign_plan(list(id_to_plan.values()))

    # ── Summary ───────────────────────────────────────────────────────────────
    all_processed = [id_to_plan[p["id"]] for p in pending]
    ready = [p for p in all_processed if p["status"] == "ready_for_approval"]
    errors = [p for p in all_processed if p["status"] == "error"]

    logger.info(
        "Summary: %d processed, %d ready, %d errors",
        len(all_processed), len(ready), len(errors),
    )

    # ── Approval emails ───────────────────────────────────────────────────────
    if not dry_run and ready:
        from src.notify import send_approval_email

        by_brand = defaultdict(list)
        for p in ready:
            by_brand[p["brand_key"]].append({
                "product_name": p["product_name"],
                "campaign": p["campaign"],
                "channel": p["channel"],
                "scheduled_date": p.get("scheduled_date", ""),
                "feed_post_url": p.get("feed_post_url", ""),
                "caption": p.get("copy", {}).get("caption", ""),
                "hook": p.get("copy", {}).get("hook", ""),
                "status": "Pending Approval",
            })

        for bk, posts in by_brand.items():
            ml = posts[0].get("month_label", month_label or "")
            sent = send_approval_email(bk, ml, posts)
            if sent:
                logger.info("Approval email sent for %s", bk)
            else:
                logger.warning("Approval email not sent for %s", bk)
    else:
        if dry_run:
            logger.info("Dry run — approval email not sent")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    parser = argparse.ArgumentParser(description="MBC content pipeline")
    parser.add_argument("--brand", default=None, help="Filter by brand key (e.g. mbc)")
    parser.add_argument("--month", default=None, help="Filter by month label (e.g. 'April 2026')")
    parser.add_argument("--dry-run", action="store_true", help="Skip sending approval emails")
    args = parser.parse_args()

    run_pipeline(
        brand_key=args.brand,
        month_label=args.month,
        dry_run=args.dry_run,
    )
