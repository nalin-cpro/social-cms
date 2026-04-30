"""
Asset library endpoints.

GET  /assets                                    — approved lifestyle photos for a brand
POST /assets/upload                             — manual image upload
POST /pipeline/step/generate-image-from-asset  — AI adaptation from asset (SWAP / STYLE_REF)
"""

import asyncio
import logging
import os
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_roles
from api.database import get_db
from api.models.content import ContentItem
from api.models.user import User
from api.schemas.content import ContentItemRead

logger = logging.getLogger(__name__)

router = APIRouter(tags=["assets"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_UPLOADS_DIR = Path("outputs") / "uploads"


# ── GET /assets ───────────────────────────────────────────────────────────────

@router.get("/assets", response_model=list[ContentItemRead])
async def list_assets(
    brand: str = Query(...),
    days: int = Query(90, ge=1, le=365),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Return approved lifestyle photos for a brand from the last N days."""
    if current_user.role == "client" and current_user.brand_key != brand:
        raise HTTPException(status_code=403, detail="Access denied")

    cutoff = datetime.utcnow() - timedelta(days=days)
    q = (
        select(ContentItem)
        .where(ContentItem.brand_key == brand)
        .where(ContentItem.status == "approved")
        .where(ContentItem.feed_post_url.is_not(None))
        .where(ContentItem.approved_at >= cutoff)
        .order_by(ContentItem.approved_at.desc())
    )
    result = await db.execute(q)
    return result.scalars().all()


# ── POST /assets/upload ───────────────────────────────────────────────────────

@router.post("/assets/upload")
async def upload_asset(
    brand_key: str,
    content_item_id: int,
    file: UploadFile = File(...),
    _: Annotated[User, Depends(require_roles("admin", "designer"))] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Accept a manual image upload and set it as the feed_post_url for the ContentItem."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or WebP images are accepted.")

    result = await db.execute(select(ContentItem).where(ContentItem.id == content_item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    if item.brand_key != brand_key:
        raise HTTPException(status_code=403, detail="Brand mismatch")

    ext = Path(file.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    out_dir = _UPLOADS_DIR / brand_key.lower()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename

    content = await file.read()
    out_path.write_bytes(content)
    logger.info("Uploaded: %s (%d KB)", out_path, len(content) // 1024)

    rel_url = f"/outputs/uploads/{brand_key.lower()}/{filename}"
    item.feed_post_url = rel_url
    item.image_source_type = "manual_upload"
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    return {"success": True, "feed_post_url": rel_url, "item_id": content_item_id}


# ── POST /pipeline/step/generate-image-from-asset ────────────────────────────

class AssetGenerateRequest:
    def __init__(self, content_item_id: int, asset_content_item_id: int, instruction: str):
        self.content_item_id = content_item_id
        self.asset_content_item_id = asset_content_item_id
        self.instruction = instruction


from pydantic import BaseModel

class AssetGenerateBody(BaseModel):
    content_item_id: int
    asset_content_item_id: int
    instruction: str


@router.post("/pipeline/step/generate-image-from-asset")
async def generate_image_from_asset(
    body: AssetGenerateBody,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate a new image using an asset library photo as reference.

    Claude decides whether to SWAP (keep scene, replace product) or
    STYLE_REF (generate new scene matching the reference mood).
    Designer never sees this routing decision.
    """
    result = await db.execute(select(ContentItem).where(ContentItem.id == body.content_item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    result2 = await db.execute(select(ContentItem).where(ContentItem.id == body.asset_content_item_id))
    asset = result2.scalar_one_or_none()
    if not asset or not asset.feed_post_url:
        raise HTTPException(status_code=404, detail="Asset not found or has no image")

    # Resolve absolute URL for the reference image if needed
    reference_url = asset.feed_post_url
    if reference_url.startswith("/outputs/"):
        base = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000")
        reference_url = base + reference_url

    # Claude decides SWAP or STYLE
    mode = await asyncio.to_thread(_route_instruction, body.instruction)
    logger.info("Asset generation | item=%d asset=%d mode=%s", body.content_item_id, body.asset_content_item_id, mode)

    def _gen():
        from src.image_gen import generate_images
        from src.shopify import get_product_metadata
        meta = get_product_metadata(item.brand_key, item.product_name) or {}
        return generate_images(
            brand_key=item.brand_key,
            product_name=item.product_name,
            visual_direction=item.visual_direction or "",
            channel=item.channel,
            scene=item.scene or "",
            scheduled_date=item.scheduled_date or "",
            test_mode=False,
            metadata=meta,
            mode=mode,
            reference_image_url=reference_url,
            instruction=body.instruction,
        )

    urls = await asyncio.to_thread(_gen)

    if urls:
        item.feed_post_url    = urls.get("feed") or item.feed_post_url
        item.story_1_url      = urls.get("story_1")
        item.story_2_url      = urls.get("story_2")
        item.lifestyle_url    = urls.get("lifestyle")
        item.image_source_type = "asset_library"
        item.asset_library_ref = str(body.asset_content_item_id)

    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    return {
        "success": bool(urls),
        "mode": mode,
        "feed_post_url": item.feed_post_url,
        "story_1_url": item.story_1_url,
        "item_id": item.id,
    }


def _route_instruction(instruction: str) -> str:
    """Ask Claude whether this instruction is a SWAP or STYLE_REF operation."""
    try:
        from anthropic import Anthropic
        client = Anthropic()
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{
                "role": "user",
                "content": (
                    "Read this instruction from a designer and decide:\n"
                    "(a) SWAP — they want to keep the scene and replace only the product. "
                    "Keywords: 'replace', 'swap', 'keep everything', 'just the shoe/boot/bag'\n"
                    "(b) STYLE — they want to use the mood/lighting/composition as inspiration "
                    "for a new scene. Keywords: 'mood', 'lighting', 'inspiration', 'similar feel', "
                    "'use this style'\n\n"
                    f"Instruction: {instruction}\n\n"
                    "Return only the word SWAP or STYLE."
                ),
            }],
        )
        decision = resp.content[0].text.strip().upper()
        if "SWAP" in decision:
            return "swap"
        return "style_ref"
    except Exception as exc:
        logger.warning("Claude routing failed (%s) — defaulting to style_ref", exc)
        return "style_ref"
