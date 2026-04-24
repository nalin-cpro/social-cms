import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.brand import Brand
from api.models.user import User
from api.schemas.brand import BrandRead, BrandUpdate

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandRead])
async def list_brands(
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Brand).where(Brand.active == True))
    return result.scalars().all()


@router.get("/{key}", response_model=BrandRead)
async def get_brand(
    key: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if current_user.role == "client" and current_user.brand_key != key:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(Brand).where(Brand.key == key))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.put("/{key}", response_model=BrandRead)
async def update_brand(
    key: str,
    update: BrandUpdate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Brand).where(Brand.key == key))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(brand, field, value)
    await db.commit()
    await db.refresh(brand)
    return brand


def _run_onboarding(brand_key: str) -> None:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from src.onboarding import analyse_brand_instagram
    analyse_brand_instagram(brand_key)


@router.post("/{key}/onboard")
async def onboard_brand(
    key: str,
    background_tasks: BackgroundTasks,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Brand).where(Brand.key == key))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    background_tasks.add_task(_run_onboarding, key)
    return {"status": "onboarding_started", "brand_key": key}
