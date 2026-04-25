"""
Pipeline router.

POST /pipeline/run          — run pipeline for a set of items (brand/month/limit/test_mode)
POST /pipeline/run-post/{id}— run pipeline for a single ContentItem
POST /pipeline/run-campaign/{id} — run pipeline for all pending posts in a campaign
GET  /pipeline/status       — last 5 pipeline runs
GET  /pipeline/status/{run_id} — specific run with error_log
"""

import logging
import threading
import traceback
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_roles
from api.database import get_db
from api.models.content import ContentItem
from api.models.pipeline_run import PipelineRun
from api.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


# ── Schemas (inline to avoid extra file) ──────────────────────────────────────

from pydantic import BaseModel


class RunRequest(BaseModel):
    brand_key: str
    month_label: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    dry_run: bool = False
    test_mode: bool = False
    limit: int = 3
    item_ids: list[int] | None = None
    mode: str = "all"       # all | copy_only | image_only
    campaign_id: int | None = None


class SinglePostRequest(BaseModel):
    mode: str = "all"
    test_mode: bool = False


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


# ── Background thread wrapper ─────────────────────────────────────────────────

def _bg_run(run_id: int, **kwargs) -> None:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    try:
        from src.pipeline_db import run_pipeline_db
        run_pipeline_db(run_id=run_id, **kwargs)
    except Exception:
        logger.error("Pipeline thread crashed for run_id=%d:\n%s", run_id, traceback.format_exc())


async def _create_run(db: AsyncSession, brand_key: str, mode: str, month_label: str | None,
                       dry_run: bool, test_mode: bool) -> PipelineRun:
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


# ── POST /pipeline/run ────────────────────────────────────────────────────────

@router.post("/run", response_model=PipelineRunRead)
async def run_pipeline(
    body: RunRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    run = await _create_run(db, body.brand_key, body.mode, body.month_label, body.dry_run, body.test_mode)
    t = threading.Thread(
        target=_bg_run,
        kwargs=dict(
            run_id=run.id,
            brand_key=body.brand_key,
            month_label=body.month_label,
            start_date=body.start_date,
            end_date=body.end_date,
            dry_run=body.dry_run,
            test_mode=body.test_mode,
            limit=min(body.limit, 25),
            item_ids=body.item_ids,
            mode=body.mode,
            campaign_id=body.campaign_id,
        ),
        daemon=True,
    )
    t.start()
    return run


# ── POST /pipeline/run-post/{item_id} ────────────────────────────────────────

@router.post("/run-post/{item_id}", response_model=PipelineRunRead)
async def run_single_post(
    item_id: int,
    body: SinglePostRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    run = await _create_run(db, item.brand_key, body.mode, None, False, body.test_mode)
    t = threading.Thread(
        target=_bg_run,
        kwargs=dict(
            run_id=run.id,
            brand_key=item.brand_key,
            month_label=None,
            start_date=None,
            end_date=None,
            dry_run=False,
            test_mode=body.test_mode,
            limit=1,
            item_ids=[item_id],
            mode=body.mode,
            campaign_id=None,
        ),
        daemon=True,
    )
    t.start()
    return run


# ── POST /pipeline/run-campaign/{campaign_id} ────────────────────────────────

@router.post("/run-campaign/{campaign_id}", response_model=PipelineRunRead)
async def run_campaign(
    campaign_id: int,
    body: RunRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    run = await _create_run(db, body.brand_key, body.mode, body.month_label, body.dry_run, body.test_mode)
    t = threading.Thread(
        target=_bg_run,
        kwargs=dict(
            run_id=run.id,
            brand_key=body.brand_key,
            month_label=body.month_label,
            start_date=body.start_date,
            end_date=body.end_date,
            dry_run=body.dry_run,
            test_mode=body.test_mode,
            limit=min(body.limit, 25),
            item_ids=body.item_ids,
            mode=body.mode,
            campaign_id=campaign_id,
        ),
        daemon=True,
    )
    t.start()
    return run


# ── POST /pipeline/test-single ───────────────────────────────────────────────
# Runs the pipeline synchronously inside this request — no thread, no event loop
# juggling. Use this to confirm the pipeline works before relying on background runs.

@router.post("/test-single")
async def test_single_post_sync(
    item_id: int,
    mode: str = "copy_only",
    test_mode: bool = True,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import select
    from src.pipeline_db import process_item_db

    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"ContentItem {item_id} not found")

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
        "story_1_url": item.story_1_url,
        "run_id": run.id,
    }


# ── GET /pipeline/status ──────────────────────────────────────────────────────

@router.get("/status", response_model=list[PipelineRunRead])
async def pipeline_status(
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(5)
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
