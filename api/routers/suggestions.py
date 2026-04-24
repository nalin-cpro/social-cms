from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.suggestion import DesignerSuggestion
from api.models.content import ContentItem
from api.models.notification import Notification
from api.models.user import User
from api.schemas.comment import DesignerSuggestionRead, DesignerSuggestionCreate, DesignerSuggestionResolve

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.post("", response_model=DesignerSuggestionRead)
async def create_suggestion(
    body: DesignerSuggestionCreate,
    current_user: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == body.content_item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    suggestion = DesignerSuggestion(
        content_item_id=body.content_item_id,
        designer_id=current_user.id,
        suggestion_type=body.suggestion_type,
        message=body.message,
        status="pending",
    )
    db.add(suggestion)
    db.add(Notification(
        recipient_role="admin",
        brand_key=item.brand_key,
        content_item_id=item.id,
        type="designer_suggestion",
        message=f"Designer suggestion on {item.product_name}: {body.suggestion_type} — {body.message[:80]}",
    ))
    await db.commit()
    await db.refresh(suggestion)
    return suggestion


@router.get("", response_model=list[DesignerSuggestionRead])
async def list_suggestions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    status: str | None = Query(None),
):
    q = select(DesignerSuggestion)
    if current_user.role == "designer":
        q = q.where(DesignerSuggestion.designer_id == current_user.id)
    if status:
        q = q.where(DesignerSuggestion.status == status)
    q = q.order_by(DesignerSuggestion.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{suggestion_id}", response_model=DesignerSuggestionRead)
async def resolve_suggestion(
    suggestion_id: int,
    body: DesignerSuggestionResolve,
    current_user: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(DesignerSuggestion).where(DesignerSuggestion.id == suggestion_id))
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = body.status
    suggestion.admin_response = body.admin_response
    suggestion.resolved_at = datetime.utcnow()

    if body.status == "accepted":
        item_result = await db.execute(select(ContentItem).where(ContentItem.id == suggestion.content_item_id))
        item = item_result.scalar_one_or_none()
        if item:
            if suggestion.suggestion_type == "cancel":
                item.status = "cancelled"
                item.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(suggestion)
    return suggestion
