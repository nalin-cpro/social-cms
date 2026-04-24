from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.holiday import HolidayEvent
from api.models.user import User
from api.schemas.comment import HolidayEventRead, HolidayEventCreate

router = APIRouter(prefix="/holidays", tags=["holidays"])


@router.get("", response_model=list[HolidayEventRead])
async def list_holidays(
    _: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    year: str | None = Query(None),
):
    q = select(HolidayEvent)
    if brand:
        from sqlalchemy import or_
        q = q.where(or_(HolidayEvent.brand_key == brand, HolidayEvent.brand_key.is_(None)))
    if year:
        q = q.where(HolidayEvent.date.startswith(year))
    result = await db.execute(q.order_by(HolidayEvent.date.asc()))
    return result.scalars().all()


@router.post("", response_model=HolidayEventRead)
async def create_holiday(
    body: HolidayEventCreate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    event = HolidayEvent(**body.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{holiday_id}", status_code=204)
async def delete_holiday(
    holiday_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(HolidayEvent).where(HolidayEvent.id == holiday_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Holiday not found")
    await db.delete(event)
    await db.commit()
