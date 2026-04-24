from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.campaign import CampaignPlan
from api.models.user import User
from api.schemas.campaign import CampaignRead, CampaignCreate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[CampaignRead])
async def list_campaigns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = None,
    month: str | None = None,
):
    q = select(CampaignPlan)
    if current_user.role == "client":
        q = q.where(CampaignPlan.brand_key == current_user.brand_key)
    elif brand:
        q = q.where(CampaignPlan.brand_key == brand)
    if month:
        q = q.where(CampaignPlan.month_label == month)
    q = q.order_by(CampaignPlan.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{plan_id}", response_model=CampaignRead)
async def get_campaign(
    plan_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(CampaignPlan).where(CampaignPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current_user.role == "client" and current_user.brand_key != plan.brand_key:
        raise HTTPException(status_code=403, detail="Access denied")
    return plan


@router.post("/generate", response_model=CampaignRead)
async def generate_campaign(
    body: CampaignCreate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = CampaignPlan(
        brand_key=body.brand_key,
        month_label=body.month_label,
        status="active",
        plan_json=[],
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan
