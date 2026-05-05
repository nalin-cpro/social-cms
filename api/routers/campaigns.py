import threading
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.campaign import CampaignPlan, Campaign
from api.models.content import ContentItem
from api.models.user import User
from api.schemas.campaign import (
    CampaignRead, CampaignCreate,
    CampaignEntityRead, CampaignEntityWithPosts,
    CampaignEntityCreate, CampaignEntityUpdate,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ── Legacy campaign plans ──────────────────────────────────────────────────────

@router.get("/plans", response_model=list[CampaignRead])
async def list_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    month: str | None = Query(None),
):
    q = select(CampaignPlan)
    if current_user.role == "client":
        q = q.where(CampaignPlan.brand_key == current_user.brand_key)
    elif brand:
        q = q.where(CampaignPlan.brand_key == brand)
    if month:
        q = q.where(CampaignPlan.month_label == month)
    result = await db.execute(q.order_by(CampaignPlan.created_at.desc()))
    return result.scalars().all()


# ── New Campaign entity ────────────────────────────────────────────────────────

@router.get("", response_model=list[CampaignEntityRead])
async def list_campaigns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    year: int | None = Query(None),
    month: str | None = Query(None),
):
    q = select(Campaign)
    if current_user.role == "client":
        q = q.where(Campaign.brand_key == current_user.brand_key)
    else:
        if brand:
            q = q.where(Campaign.brand_key == brand)
    if year:
        q = q.where(Campaign.year == year)
    if month:
        q = q.where(Campaign.month_label == month)
    result = await db.execute(q.order_by(Campaign.start_date.asc(), Campaign.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=CampaignEntityRead, status_code=201)
async def create_campaign(
    body: CampaignEntityCreate,
    current_user: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    campaign = Campaign(
        brand_key=body.brand_key,
        name=body.name,
        theme=body.theme,
        visual_direction=body.visual_direction,
        month_label=body.month_label,
        year=body.year,
        start_date=body.start_date,
        end_date=body.end_date,
        created_by=current_user.id,
        status=body.status,
        notes=body.notes,
    )
    db.add(campaign)
    await db.commit()
    # No refresh: expire_on_commit=False keeps in-memory attrs valid, and
    # refresh-after-commit can race with session teardown on prod.
    return campaign


@router.get("/{campaign_id}", response_model=CampaignEntityWithPosts)
async def get_campaign(
    campaign_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user.role == "client" and current_user.brand_key != campaign.brand_key:
        raise HTTPException(status_code=403, detail="Access denied")

    # Load posts
    posts_result = await db.execute(
        select(ContentItem).where(ContentItem.campaign_id == campaign_id)
        .order_by(ContentItem.scheduled_date.asc())
    )
    posts = posts_result.scalars().all()

    data = CampaignEntityWithPosts.model_validate(campaign)
    data.posts = posts
    return data


@router.patch("/{campaign_id}", response_model=CampaignEntityRead)
async def update_campaign(
    campaign_id: int,
    body: CampaignEntityUpdate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)
    campaign.updated_at = datetime.utcnow()
    await db.commit()
    return campaign


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import delete as sql_delete
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Block delete if any posts are approved or published
    approved_result = await db.execute(
        select(ContentItem).where(
            ContentItem.campaign_id == campaign_id,
            ContentItem.status.in_(["approved", "published"]),
        )
    )
    if approved_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cannot delete campaign with approved content",
        )

    # Cascade delete content items then campaign
    await db.execute(sql_delete(ContentItem).where(ContentItem.campaign_id == campaign_id))
    await db.delete(campaign)
    await db.commit()
    return {"message": "Campaign deleted"}


def _run_campaign_pipeline(campaign_id: int) -> None:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    import asyncio

    async def _do():
        from api.database import AsyncSessionLocal
        from api.models.campaign import Campaign as C
        from api.models.content import ContentItem as CI
        from sqlalchemy import select as sel

        async with AsyncSessionLocal() as session:
            res = await session.execute(sel(C).where(C.id == campaign_id))
            camp = res.scalar_one_or_none()
            if not camp:
                return
            posts_res = await session.execute(
                sel(CI).where(CI.campaign_id == campaign_id, CI.status == "pending")
            )
            posts = posts_res.scalars().all()
            if not posts:
                return
            try:
                from src.pipeline import run_pipeline
                run_pipeline(brand_key=camp.brand_key, month_label=camp.month_label or "", dry_run=False)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Campaign pipeline failed: %s", exc)

    asyncio.run(_do())


@router.post("/{campaign_id}/send-to-client")
async def send_campaign_to_client(
    campaign_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = "sent_to_client"
    campaign.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "sent", "campaign_id": campaign_id}


@router.post("/{campaign_id}/generate")
async def generate_campaign_posts(
    campaign_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    t = threading.Thread(target=_run_campaign_pipeline, args=(campaign_id,), daemon=True)
    t.start()
    return {"status": "started", "campaign_id": campaign_id}
