import threading
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.content import ContentItem
from api.models.comment import ContentComment
from api.models.notification import Notification
from api.models.user import User
from api.schemas.content import (
    ContentItemRead, CommentRequest,
    InternalCommentRequest, RegenerateImageRequest, ContentItemUpdate, ContentItemCreate,
)

from api.schemas.comment import ContentCommentRead, ContentCommentCreate

router = APIRouter(prefix="/content", tags=["content"])


def _assert_brand_access(user: User, brand_key: str) -> None:
    if user.role == "client" and user.brand_key != brand_key:
        raise HTTPException(status_code=403, detail="Access denied")


# ── Create ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=ContentItemRead, status_code=201)
async def create_content_item(
    body: ContentItemCreate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = ContentItem(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


# ── List / detail ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[ContentItemRead])
async def list_content(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    brand: str | None = Query(None),
    month: str | None = Query(None),
    status: str | None = Query(None),
    channel: str | None = Query(None),
    campaign_id: int | None = Query(None),
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
    if campaign_id is not None:
        q = q.where(ContentItem.campaign_id == campaign_id)
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


@router.patch("/{item_id}", response_model=ContentItemRead)
async def update_content_item(
    item_id: int,
    body: ContentItemUpdate,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


# ── Status transitions ─────────────────────────────────────────────────────────

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
    db.add(Notification(
        recipient_role="admin", brand_key=item.brand_key, content_item_id=item.id,
        type="approved", message=f"{item.product_name} ({item.channel}) approved by client.",
    ))
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{item_id}/internal-approve", response_model=ContentItemRead)
async def internal_approve(
    item_id: int,
    current_user: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    item.status = "internal_approved"
    item.updated_at = datetime.utcnow()
    db.add(Notification(
        recipient_role="designer", brand_key=item.brand_key, content_item_id=item.id,
        type="internal_approved",
        message=f"{item.product_name} approved internally — ready to send to client.",
    ))
    await db.commit()
    await db.refresh(item)
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
    db.add(Notification(
        recipient_role="client", brand_key=item.brand_key, content_item_id=item.id,
        type="ready_for_approval", message=f"New content ready for your review: {item.product_name}.",
    ))
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{item_id}/cancel", response_model=ContentItemRead)
async def cancel_content(
    item_id: int,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    item.status = "cancelled"
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


# ── Legacy comment (client feedback) ──────────────────────────────────────────

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

    # Also create a ContentComment record
    db.add(ContentComment(
        content_item_id=item.id,
        sender_role=current_user.role,
        sender_name=current_user.email,
        message=body.comment,
        is_internal=False,
    ))
    await db.commit()
    await db.refresh(item)
    background_tasks.add_task(_run_revision, item.id, body.comment)
    return item


# ── New threaded comments ──────────────────────────────────────────────────────

@router.get("/{item_id}/comments", response_model=list[ContentCommentRead])
async def list_comments(
    item_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    _assert_brand_access(current_user, item.brand_key)

    q = select(ContentComment).where(ContentComment.content_item_id == item_id)
    if current_user.role == "client":
        q = q.where(ContentComment.is_internal == False)  # noqa: E712
        q = q.where(ContentComment.is_ai_revision == False)  # noqa: E712
    q = q.order_by(ContentComment.created_at.asc())
    result2 = await db.execute(q)
    return result2.scalars().all()


@router.post("/{item_id}/comments", response_model=ContentCommentRead)
async def add_comment(
    item_id: int,
    body: ContentCommentCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    _assert_brand_access(current_user, item.brand_key)

    # Clients can only leave non-internal comments
    is_internal = body.is_internal and current_user.role != "client"

    comment = ContentComment(
        content_item_id=item_id,
        sender_role=current_user.role,
        sender_name=current_user.email,
        message=body.message,
        is_internal=is_internal,
        is_ai_revision=False,
    )
    db.add(comment)

    # If client leaves feedback, mark item and trigger AI revision + brand rule extraction
    if current_user.role == "client":
        item.status = "changes_requested"
        item.client_comment = body.message
        item.updated_at = datetime.utcnow()
        background_tasks.add_task(_run_revision, item.id, body.message)
        background_tasks.add_task(_extract_and_save_brand_rule, item.id, item.brand_key, body.message)

    await db.commit()
    await db.refresh(comment)
    return comment


# ── Image regeneration ─────────────────────────────────────────────────────────

@router.post("/{item_id}/regenerate-image", response_model=ContentItemRead)
async def regenerate_image(
    item_id: int,
    body: RegenerateImageRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ContentItem).where(ContentItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    item.status = "generating"
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    t = threading.Thread(target=_run_image_regen, args=(item_id, body.instruction), daemon=True)
    t.start()
    return item


# ── Background tasks ───────────────────────────────────────────────────────────

def _run_revision(item_id: int, comment: str) -> None:
    import asyncio, sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    async def _do():
        from api.database import AsyncSessionLocal
        from api.models.content import ContentItem as CI
        from api.models.comment import ContentComment as CC
        from api.models.notification import Notification as N
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(CI).where(CI.id == item_id))
            item = result.scalar_one_or_none()
            if not item:
                return
            try:
                from src.copy_gen import regenerate_from_comment
                new_copy = regenerate_from_comment(
                    brand_key=item.brand_key,
                    product_name=item.product_name,
                    campaign=item.campaign,
                    channel=item.channel,
                    original_copy=item.copy_json or {},
                    client_comment=comment,
                    product_metadata={"title": item.product_name, "price": "", "description": "", "product_type": "footwear"},
                )
                item.original_copy_json = item.copy_json
                item.copy_json = new_copy
                item.revision_count = (item.revision_count or 0) + 1
                item.updated_at = datetime.utcnow()
                session.add(CC(
                    content_item_id=item.id,
                    sender_role="system",
                    sender_name="Progility AI",
                    message="Copy revised based on client feedback.",
                    is_ai_revision=True,
                    is_internal=True,
                ))
                session.add(N(
                    recipient_role="designer", brand_key=item.brand_key, content_item_id=item.id,
                    type="revision_needed",
                    message=f"Client feedback on {item.product_name} — revision ready.",
                ))
                await session.commit()
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Revision task failed: %s", exc)

    asyncio.run(_do())


def _run_image_regen(item_id: int, instruction: str) -> None:
    import asyncio, sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    async def _do():
        from api.database import AsyncSessionLocal
        from api.models.content import ContentItem as CI
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(CI).where(CI.id == item_id))
            item = result.scalar_one_or_none()
            if not item:
                return
            try:
                from src.image_gen import generate_images
                combined_prompt = f"{item.visual_direction or ''} {instruction}".strip()
                urls = generate_images(
                    brand_key=item.brand_key,
                    product_name=item.product_name,
                    visual_direction=combined_prompt,
                    channel=item.channel,
                    scene=item.scene or "lifestyle",
                    scheduled_date=item.scheduled_date or "",
                )
                if urls.get("feed"):
                    item.feed_post_url = urls["feed"]
                if urls.get("story_1"):
                    item.story_1_url = urls["story_1"]
                if urls.get("story_2"):
                    item.story_2_url = urls["story_2"]
                item.status = "ready_for_internal_review"
                item.updated_at = datetime.utcnow()
                await session.commit()
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Image regen failed: %s", exc)
                item.status = "error"
                item.updated_at = datetime.utcnow()
                await session.commit()

    asyncio.run(_do())


def _extract_and_save_brand_rule(item_id: int, brand_key: str, comment: str) -> None:
    """Background task: check if client comment contains a learnable brand rule."""
    import asyncio, sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    async def _do():
        try:
            from anthropic import Anthropic
            import json as _json

            client = Anthropic()
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": (
                        f"A client left this feedback on a content post for brand {brand_key}:\n"
                        f"'{comment}'\n\n"
                        "Does this feedback contain a learnable brand rule that should be applied to "
                        "all future content? Examples of learnable rules:\n"
                        "- 'don't use work boots' -> rule: never use term 'work boots'\n"
                        "- 'use sentence case not title case' -> rule: always sentence case\n"
                        "Not all feedback is a rule. 'I like this' is not a rule.\n"
                        "If this IS a learnable rule, return JSON:\n"
                        "{\"is_rule\": true, \"rule_text\": \"...\", \"rule_type\": \"copy|visual|formatting\"}\n"
                        "If not, return: {\"is_rule\": false}"
                    ),
                }],
            )
            data = _json.loads(resp.content[0].text.strip())
            if not data.get("is_rule"):
                return

            from api.database import AsyncSessionLocal
            from api.models.brand_memory import BrandMemoryRule
            from api.models.notification import Notification as N

            async with AsyncSessionLocal() as session:
                rule = BrandMemoryRule(
                    brand_key=brand_key,
                    rule_text=data["rule_text"],
                    rule_type=data.get("rule_type", "copy"),
                    source="client_feedback",
                    source_comment=comment,
                    source_content_item_id=item_id,
                    status="pending_review",
                )
                session.add(rule)
                session.add(N(
                    recipient_role="admin",
                    brand_key=brand_key,
                    content_item_id=item_id,
                    type="brand_rule_extracted",
                    message=f"New brand rule from client feedback: \"{data['rule_text']}\" — review in Brand Memory.",
                ))
                await session.commit()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("extract_brand_rule failed: %s", exc)

    asyncio.run(_do())
