"""
DB-aware pipeline: processes ContentItem records directly in Postgres/SQLite.
This replaces the old JSON-file pipeline for API-triggered runs.

Flow per item:
  1. Set status = 'generating', commit
  2. Fetch product metadata from Shopify
  3. Generate copy (if mode != image_only)
  4. Generate images (if mode != copy_only and channel needs images)
  5. Run QC scoring
  6. Set status = 'ready_for_internal_review', commit

The caller (pipeline router) creates the PipelineRun record and passes run_id.
This module updates it as it goes.
"""

import asyncio
import calendar
import logging
import traceback
from datetime import datetime

logger = logging.getLogger(__name__)

CHANNELS_NEEDING_IMAGES = {"instagram_post", "instagram_stories", "tiktok"}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _patch_run(session, run_id: int, **kwargs) -> None:
    from sqlalchemy import select
    from api.models.pipeline_run import PipelineRun
    result = await session.execute(select(PipelineRun).where(PipelineRun.id == run_id))
    run = result.scalar_one_or_none()
    if run:
        for k, v in kwargs.items():
            setattr(run, k, v)
        await session.commit()


def _month_label_to_prefix(month_label: str) -> str | None:
    """'April 2026' → '2026-04'"""
    try:
        parts = month_label.strip().split()
        if len(parts) == 2:
            month_num = list(calendar.month_name).index(parts[0])
            year = int(parts[1])
            return f"{year}-{month_num:02d}"
    except Exception:
        pass
    return None


# ── Single item processor ─────────────────────────────────────────────────────

async def process_item_db(
    session,
    item,
    run_id: int,
    mode: str = "all",
    test_mode: bool = False,
) -> str:
    """Process one ContentItem in-place. Returns 'ready' | 'error'."""
    item.status = "generating"
    item.updated_at = datetime.utcnow()
    await session.commit()
    await _patch_run(session, run_id, current_post=item.product_name)

    try:
        copy = {}
        metadata = {}

        # Step 1: Product metadata (needed for both copy and image paths)
        logger.info("[%s] Fetching Shopify metadata", item.product_name)
        try:
            from src.shopify import get_product_metadata
            metadata = get_product_metadata(item.brand_key, item.product_name) or {}
            logger.info("[%s] Metadata: price=%s has_image=%s",
                        item.product_name, metadata.get("price"), bool(metadata.get("image_url")))
        except Exception as e:
            logger.warning("[%s] Shopify fetch failed: %s — continuing", item.product_name, e)

        # Step 2: Copy generation
        if mode in ("all", "copy_only"):
            logger.info("[%s] Generating %s copy", item.product_name, item.channel)
            from src.copy_gen import generate_post_copy
            copy = generate_post_copy(
                item.brand_key,
                item.product_name,
                item.campaign,
                item.channel,
                metadata,
                item.visual_direction or "",
                item.post_type,
            )
            item.copy_json = copy
            logger.info("[%s] Copy valid=%s violations=%s",
                        item.product_name, copy.get("copy_valid"), copy.get("violations", []))

        # Step 3: Image generation
        if mode in ("all", "image_only") and item.channel in CHANNELS_NEEDING_IMAGES:
            logger.info("[%s] Generating images (test_mode=%s)", item.product_name, test_mode)
            from src.image_gen import generate_images
            urls = generate_images(
                brand_key=item.brand_key,
                product_name=item.product_name,
                visual_direction=item.visual_direction or "",
                channel=item.channel,
                scene=item.scene or "",
                scheduled_date=item.scheduled_date or "",
                test_mode=test_mode,
                metadata=metadata,
            )
            item.feed_post_url = urls.get("feed")
            item.story_1_url = urls.get("story_1")
            item.story_2_url = urls.get("story_2")
            item.lifestyle_url = urls.get("lifestyle")
            logger.info("[%s] Images: feed=%s story1=%s",
                        item.product_name, item.feed_post_url, item.story_1_url)
        elif mode in ("all", "image_only") and item.channel not in CHANNELS_NEEDING_IMAGES:
            logger.info("[%s] Channel '%s' does not need images — skipping image gen",
                        item.product_name, item.channel)

        # Step 4: QC score
        qc = 10 if copy.get("copy_valid") else 7
        needs_img = item.channel in CHANNELS_NEEDING_IMAGES
        if mode in ("all", "image_only") and needs_img and not item.feed_post_url:
            qc = 4
        item.qc_score = float(qc)

        item.status = "ready_for_internal_review"
        item.processed_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        await session.commit()
        logger.info("[%s] Done — status=ready_for_internal_review qc=%s", item.product_name, qc)
        return "ready"

    except Exception as exc:
        logger.error("[%s] Pipeline error: %s\n%s",
                     item.product_name, exc, traceback.format_exc())
        item.status = "error"
        item.updated_at = datetime.utcnow()
        await session.commit()
        return "error"


# ── Async run ─────────────────────────────────────────────────────────────────

async def _run_async(
    run_id: int,
    brand_key: str,
    month_label: str | None,
    start_date: str | None,
    end_date: str | None,
    dry_run: bool,
    test_mode: bool,
    limit: int,
    item_ids: list[int] | None,
    mode: str,
    campaign_id: int | None,
) -> None:
    from sqlalchemy import select, or_
    from api.database import AsyncSessionLocal
    from api.models.content import ContentItem
    from api.models.pipeline_run import PipelineRun

    async with AsyncSessionLocal() as session:
        # Build item query
        q = select(ContentItem).where(ContentItem.status == "pending")

        if item_ids:
            q = q.where(ContentItem.id.in_(item_ids))
        else:
            if brand_key:
                q = q.where(ContentItem.brand_key == brand_key)
            if campaign_id is not None:
                q = q.where(ContentItem.campaign_id == campaign_id)
            if month_label:
                prefix = _month_label_to_prefix(month_label)
                if prefix:
                    q = q.where(ContentItem.scheduled_date.startswith(prefix))
            if start_date:
                q = q.where(ContentItem.scheduled_date >= start_date)
            if end_date:
                q = q.where(ContentItem.scheduled_date <= end_date)

        q = q.order_by(ContentItem.scheduled_date.asc().nullslast(),
                       ContentItem.created_at.asc()).limit(limit)

        result = await session.execute(q)
        items = list(result.scalars().all())

        logger.info(
            "Pipeline run %d — %d items to process | mode=%s test=%s brand=%s",
            run_id, len(items), mode, test_mode, brand_key,
        )

        if not items:
            await _patch_run(
                session, run_id,
                status="complete",
                completed_at=datetime.utcnow(),
                error_log="No pending items matched the filters.",
            )
            return

        ready = 0
        errored = 0
        errors: list[str] = []

        for item in items:
            outcome = await process_item_db(session, item, run_id, mode=mode, test_mode=test_mode)
            if outcome == "ready":
                ready += 1
            else:
                errored += 1
                errors.append(f"Item {item.id} ({item.product_name}): pipeline error")

            await _patch_run(
                session, run_id,
                posts_processed=ready + errored,
                posts_ready=ready,
                posts_errored=errored,
            )

        final_status = "failed" if errored > 0 and ready == 0 else "complete"
        await _patch_run(
            session, run_id,
            status=final_status,
            completed_at=datetime.utcnow(),
            current_post=None,
            error_log="\n".join(errors) if errors else None,
        )
        logger.info(
            "Pipeline run %d complete — %d ready, %d errors, status=%s",
            run_id, ready, errored, final_status,
        )


# ── Public sync entry point ───────────────────────────────────────────────────

def run_pipeline_db(
    run_id: int,
    brand_key: str,
    month_label: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    dry_run: bool = False,
    test_mode: bool = False,
    limit: int = 3,
    item_ids: list[int] | None = None,
    mode: str = "all",
    campaign_id: int | None = None,
) -> None:
    """Sync entry — spawns a new asyncio event loop (safe inside a thread)."""
    asyncio.run(_run_async(
        run_id=run_id,
        brand_key=brand_key,
        month_label=month_label,
        start_date=start_date,
        end_date=end_date,
        dry_run=dry_run,
        test_mode=test_mode,
        limit=limit,
        item_ids=item_ids,
        mode=mode,
        campaign_id=campaign_id,
    ))
