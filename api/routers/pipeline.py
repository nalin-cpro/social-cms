"""
Pipeline router — individual step endpoints + campaign batch runs.

Step endpoints (synchronous, return immediately):
  POST /pipeline/step/fetch-product     — Shopify lookup for one post
  POST /pipeline/step/generate-copy     — copy generation for one post
  POST /pipeline/step/generate-image    — image generation for one post
  POST /pipeline/step/run-all           — all steps in sequence for one post
  POST /pipeline/campaign/run           — batch run for a campaign (background)

Status endpoints:
  GET  /pipeline/status                 — last 10 runs
  GET  /pipeline/status/{run_id}        — specific run with error_log
"""

import asyncio
import logging
import threading
import traceback
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_roles
from api.database import get_db
from api.models.content import ContentItem
from api.models.pipeline_run import PipelineRun
from api.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

_CHANNELS_NEEDING_IMAGES = {"instagram_post", "instagram_stories", "tiktok"}
# Decision 3: channels that skip internal review and go directly to client
_CHANNELS_SKIP_INTERNAL = {"instagram_post", "instagram_stories", "tiktok", "facebook_post"}


# ── Request schemas ───────────────────────────────────────────────────────────

class StepRequest(BaseModel):
    content_item_id: int


class StepImageRequest(BaseModel):
    content_item_id: int
    test_mode: bool = False
    instruction: str | None = None


class RunAllRequest(BaseModel):
    content_item_id: int
    test_mode: bool = False


class CampaignRunRequest(BaseModel):
    brand_key: str
    campaign_id: int | None = None  # if None, filter by date range / month
    month_label: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    test_mode: bool = False
    limit: int = 3
    mode: str = "all"   # all | copy_only | image_only


class PipelineRunRead(BaseModel):
    id: int
    brand_key: str
    month_label: str | None
    dry_run: bool
    test_mode: bool
    mode: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    posts_processed: int
    posts_ready: int
    posts_errored: int
    current_post: str | None
    error_log: str | None
    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _post_status_after_generation(item: ContentItem) -> str:
    """Determine the correct post-generation status per Decision 3.

    Images/carousels → ready_for_approval (goes directly to client)
    Email/video → ready_for_internal_review (goes to manager first)
    """
    if item.channel in _CHANNELS_SKIP_INTERNAL or item.content_type not in ("email", "video"):
        return "ready_for_approval"
    return "ready_for_internal_review"


async def _get_item(db: AsyncSession, item_id: int) -> ContentItem:
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"ContentItem {item_id} not found")
    return item


async def _create_run(
    db: AsyncSession,
    brand_key: str,
    mode: str,
    month_label: str | None,
    dry_run: bool,
    test_mode: bool,
) -> PipelineRun:
    run = PipelineRun(
        brand_key=brand_key,
        month_label=month_label,
        dry_run=dry_run,
        test_mode=test_mode,
        mode=mode,
        status="running",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


# ── POST /pipeline/step/fetch-product ────────────────────────────────────────

@router.post("/step/fetch-product")
async def step_fetch_product(
    body: StepRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch product from Shopify and update ContentItem.image_source_type."""
    item = await _get_item(db, body.content_item_id)

    def _fetch():
        from src.shopify import get_product_metadata
        return get_product_metadata(item.brand_key, item.product_name) or {}

    meta = await asyncio.to_thread(_fetch)

    if meta and meta.get("image_url"):
        item.image_source_type = "shopify"
        item.updated_at = datetime.utcnow()
        await db.commit()
        return {
            "found": True,
            "image_url": meta["image_url"],
            "product_name": meta.get("title", item.product_name),
            "price": meta.get("price"),
        }
    else:
        item.status = "needs_image_source"
        item.updated_at = datetime.utcnow()
        await db.commit()
        return {
            "found": False,
            "image_url": None,
            "product_name": item.product_name,
            "price": None,
        }


# ── POST /pipeline/step/generate-copy ────────────────────────────────────────

@router.post("/step/generate-copy")
async def step_generate_copy(
    body: StepRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate copy for one ContentItem and persist to DB."""
    item = await _get_item(db, body.content_item_id)

    def _gen():
        from src.copy_gen import generate_post_copy
        from src.shopify import get_product_metadata
        meta = get_product_metadata(item.brand_key, item.product_name) or {}
        return generate_post_copy(
            item.brand_key,
            item.product_name,
            item.campaign,
            item.channel,
            meta,
            item.visual_direction or "",
            item.post_type,
        )

    copy = await asyncio.to_thread(_gen)
    item.copy_json = copy
    item.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "copy_valid": copy.get("copy_valid", False),
        "violations": copy.get("violations", []),
    }


# ── POST /pipeline/step/generate-image ───────────────────────────────────────

@router.post("/step/generate-image")
async def step_generate_image(
    body: StepImageRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate a lifestyle image for one ContentItem using its current
    feed_post_url (typically an uploaded product photo) as the source image.
    Returns a clear error if no source image is set."""
    item = await _get_item(db, body.content_item_id)

    if item.channel not in _CHANNELS_NEEDING_IMAGES:
        return {"success": True, "skipped": True, "reason": f"Channel '{item.channel}' does not need images"}

    if not item.feed_post_url:
        return {
            "success": False,
            "message": "No source image found. Please upload a product image first.",
        }

    # fal.ai needs an absolute URL it can fetch — resolve /outputs/... to the
    # public host. The fallback MUST be reachable from fal.ai (not localhost).
    import os as _os
    source_url = item.feed_post_url
    if source_url.startswith("/outputs/"):
        base = _os.environ.get("PUBLIC_BASE_URL", "https://social.progilityconsulting.in")
        source_url = base + source_url

    def _gen():
        from src.image_gen import generate_images
        return generate_images(
            brand_key=item.brand_key,
            product_name=item.product_name,
            visual_direction=item.visual_direction or "",
            channel=item.channel,
            scene=item.scene or "",
            scheduled_date=item.scheduled_date or "",
            test_mode=body.test_mode,
            metadata={"image_url": source_url},
            instruction=body.instruction or "",
        )

    urls = await asyncio.to_thread(_gen)
    if not urls or not urls.get("feed"):
        return {"success": False, "message": "Image generation failed — please try again"}

    item.feed_post_url    = urls.get("feed")
    item.story_1_url      = urls.get("story_1")
    item.story_2_url      = urls.get("story_2")
    item.lifestyle_url    = urls.get("lifestyle")
    item.image_source_type = "generated"
    item.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "feed_post_url": item.feed_post_url,
        "story_1_url":   item.story_1_url,
        "story_2_url":   item.story_2_url,
        "qc_score":      item.qc_score,
    }


# ── POST /pipeline/step/run-all ───────────────────────────────────────────────

@router.post("/step/run-all")
async def step_run_all(
    body: RunAllRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Run all pipeline steps for one ContentItem in sequence.

    Enforces Decision 3 status routing on completion:
      image/carousel → ready_for_approval
      email/video    → ready_for_internal_review
    """
    from src.pipeline_db import process_item_db

    item = await _get_item(db, body.content_item_id)
    # Create a lightweight run record for tracking
    run = await _create_run(db, item.brand_key, "all", None, False, body.test_mode)

    outcome = await asyncio.to_thread(
        _run_process_item_sync,
        body.content_item_id,
        run.id,
        "all",
        body.test_mode,
    )

    await db.refresh(item)
    return {
        "outcome": outcome,
        "item_id": body.content_item_id,
        "product_name": item.product_name,
        "status": item.status,
        "qc_score": item.qc_score,
        "feed_post_url": item.feed_post_url,
        "copy_json": item.copy_json,
        "run_id": run.id,
    }


def _run_process_item_sync(item_id: int, run_id: int, mode: str, test_mode: bool) -> str:
    """Run the async process_item_db inside a fresh event loop (safe from a thread)."""
    import os
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./dev.db")
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://").replace(
        "postgres://", "postgresql+asyncpg://"
    )
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

    async def _inner():
        engine = create_async_engine(db_url, connect_args=connect_args, echo=False)
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            from sqlalchemy import select
            from api.models.content import ContentItem
            from src.pipeline_db import process_item_db

            async with factory() as session:
                result = await session.execute(select(ContentItem).where(ContentItem.id == item_id))
                item = result.scalar_one_or_none()
                if not item:
                    return "error"
                outcome = await process_item_db(session, item, run_id, mode=mode, test_mode=test_mode)
                return outcome
        finally:
            await engine.dispose()

    return asyncio.run(_inner())


# ── POST /pipeline/campaign/run ───────────────────────────────────────────────

@router.post("/campaign/run", response_model=PipelineRunRead)
async def campaign_run(
    body: CampaignRunRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Run pipeline for all pending posts in a campaign (background thread)."""
    run = await _create_run(db, body.brand_key, body.mode, None, False, body.test_mode)
    t = threading.Thread(
        target=_bg_campaign_run,
        kwargs=dict(
            run_id=run.id,
            brand_key=body.brand_key,
            campaign_id=body.campaign_id,
            test_mode=body.test_mode,
            limit=min(body.limit, 25),
            mode=body.mode,
        ),
        daemon=True,
    )
    t.start()
    return run


def _bg_campaign_run(run_id: int, **kwargs) -> None:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    try:
        from src.pipeline_db import run_pipeline_db
        run_pipeline_db(run_id=run_id, **kwargs)
    except Exception:
        logger.error("Campaign pipeline thread crashed for run_id=%d:\n%s", run_id, traceback.format_exc())


# ── GET /pipeline/status ──────────────────────────────────────────────────────

@router.get("/status", response_model=list[PipelineRunRead])
async def pipeline_status(
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(10)
    )
    return result.scalars().all()


@router.get("/status/{run_id}", response_model=PipelineRunRead)
async def pipeline_run_detail(
    run_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ── POST /pipeline/test-single (debug endpoint) ───────────────────────────────

@router.post("/test-single")
async def test_single_post_sync(
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    item_id: int = 0,
    mode: str = "copy_only",
    test_mode: bool = True,
):
    """Synchronous debug endpoint: run pipeline for one post, return result immediately."""
    from src.pipeline_db import process_item_db

    item = await _get_item(db, item_id)
    run = await _create_run(db, item.brand_key, mode, None, False, test_mode)
    logger.info("test-single: item_id=%d product=%s mode=%s test_mode=%s run_id=%d",
                item_id, item.product_name, mode, test_mode, run.id)

    outcome = await process_item_db(db, item, run.id, mode=mode, test_mode=test_mode)
    await db.refresh(item)

    return {
        "outcome": outcome,
        "item_id": item_id,
        "product_name": item.product_name,
        "status": item.status,
        "qc_score": item.qc_score,
        "copy_json": item.copy_json,
        "feed_post_url": item.feed_post_url,
        "run_id": run.id,
    }
