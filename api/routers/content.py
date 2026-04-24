from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.content import ContentItem
from api.models.notification import Notification
from api.models.user import User
from api.schemas.content import ContentItemRead, CommentRequest

router = APIRouter(prefix="/content", tags=["content"])


def _assert_brand_access(user: User, brand_key: str) -> None:
    if user.role == "client" and user.brand_key != brand_key:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("", response_model=list[ContentItemRead])
async def list_content(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    month: str | None = Query(None),
    status: str | None = Query(None),
    channel: str | None = Query(None),
):
    q = select(ContentItem)
    if current_user.role == "client":
        q = q.where(ContentItem.brand_key == current_user.brand_key)
        q = q.where(ContentItem.status.in_(["ready_for_approval", "approved"]))
    else:
        if brand:
            q = q.where(ContentItem.brand_key == brand)
    if status:
        q = q.where(ContentItem.status == status)
    if channel:
        q = q.where(ContentItem.channel == channel)
    q = q.order_by(ContentItem.scheduled_date.asc(), ContentItem.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{item_id}", response_model=ContentItemRead)
async def get_content_item(
    item_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    _assert_brand_access(current_user, item.brand_key)
    return item


@router.post("/{item_id}/approve", response_model=ContentItemRead)
async def approve_content(
    item_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    _assert_brand_access(current_user, item.brand_key)

    item.status = "approved"
    item.approved_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()

    notif = Notification(
        recipient_role="admin",
        brand_key=item.brand_key,
        content_item_id=item.id,
        type="approved",
        message=f"{item.product_name} ({item.channel}) approved by client.",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(item)
    return item


def _run_revision(item_id: int, comment: str) -> None:
    """Background task: regenerate copy from client comment."""
    import asyncio, sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    async def _do():
        from api.database import AsyncSessionLocal
        from api.models.content import ContentItem as CI
        from api.models.notification import Notification as N
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(CI).where(CI.id == item_id))
            item = result.scalar_one_or_none()
            if not item:
                return

            try:
                from src.copy_gen import regenerate_from_comment
                metadata = {
                    "price": "",
                    "description": "",
                    "product_type": "footwear",
                    "title": item.product_name,
                }
                new_copy = regenerate_from_comment(
                    brand_key=item.brand_key,
                    product_name=item.product_name,
                    campaign=item.campaign,
                    channel=item.channel,
                    original_copy=item.copy_json or {},
                    client_comment=comment,
                    product_metadata=metadata,
                )
                item.original_copy_json = item.copy_json
                item.copy_json = new_copy
                item.revision_count = (item.revision_count or 0) + 1
                item.updated_at = datetime.utcnow()
                notif = N(
                    recipient_role="designer",
                    brand_key=item.brand_key,
                    content_item_id=item.id,
                    type="revision_needed",
                    message=f"Client left feedback on {item.product_name} — revision ready to review.",
                )
                session.add(notif)
                await session.commit()
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Revision task failed: %s", exc)

    asyncio.run(_do())


@router.post("/{item_id}/comment", response_model=ContentItemRead)
async def submit_comment(
    item_id: int,
    body: CommentRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    _assert_brand_access(current_user, item.brand_key)

    item.client_comment = body.comment
    item.status = "changes_requested"
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    background_tasks.add_task(_run_revision, item.id, body.comment)
    return item


@router.post("/{item_id}/send-to-client", response_model=ContentItemRead)
async def send_to_client(
    item_id: int,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    item.status = "ready_for_approval"
    item.client_comment = None
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item
