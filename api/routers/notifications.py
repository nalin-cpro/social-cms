from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from api.database import get_db
from api.models.notification import Notification
from api.models.user import User
from api.schemas.notification import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    q = (
        select(Notification)
        .where(Notification.recipient_role == current_user.role)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{notif_id}/read", response_model=NotificationRead)
async def mark_read(
    notif_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.recipient_role == current_user.role,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.read = True
        await db.commit()
        await db.refresh(notif)
    return notif
