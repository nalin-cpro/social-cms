"""
AI assistant endpoints — plan chat + campaign generation.
"""
import json
import logging
import os
from datetime import datetime
from typing import Annotated

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_roles
from api.database import get_db
from api.models.campaign import Campaign
from api.models.content import ContentItem
from api.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


class PlanChatRequest(BaseModel):
    brand_key: str
    message: str
    context: dict = {}
    history: list = []


class GenerateCampaignRequest(BaseModel):
    description: str
    channels: list[str] = []
    brand_key: str
    start_date: str | None = None
    end_date: str | None = None


@router.post("/plan-chat")
async def plan_chat(
    body: PlanChatRequest,
    _: Annotated[User, Depends(require_roles("admin", "designer"))],
):
    campaigns_summary = ""
    for c in body.context.get("campaigns", []):
        name = c.get("name", "")
        status = c.get("status", "")
        posts = c.get("posts_count", 0)
        campaigns_summary += f"- {name} (status: {status}, posts: {posts})\n"

    month = body.context.get("month", "this month")
    brand = body.brand_key

    system = (
        f"You are a helpful marketing assistant for Progility, a social media agency. "
        f"You help campaign managers plan content for brand: {brand}. "
        f"Current month: {month}.\n\n"
        f"Current campaigns:\n{campaigns_summary or 'No campaigns yet.'}\n\n"
        f"Be concise and friendly. Suggest specific actions based on actual data. "
        f"Keep responses under 3 short paragraphs. Plain text only, no markdown."
    )

    messages = [{"role": h["role"], "content": h["content"]} for h in body.history]
    messages.append({"role": "user", "content": body.message})

    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=system,
            messages=messages,
        )
        reply = response.content[0].text
    except Exception as exc:
        logger.error("plan-chat error: %s", exc)
        reply = "I'm having trouble connecting right now. Please try again in a moment."

    return {"reply": reply}


@router.post("/generate-campaign")
async def generate_campaign(
    body: GenerateCampaignRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    channels_str = ", ".join(body.channels) if body.channels else "instagram_post, instagram_stories"
    date_ctx = f"Target date range: {body.start_date} to {body.end_date}." if body.start_date else ""
    today = datetime.utcnow().strftime("%Y-%m-%d")

    prompt = (
        f"You are a marketing campaign planner for a social media agency.\n\n"
        f"Brand: {body.brand_key}\n"
        f"Campaign description: {body.description}\n"
        f"Channels to use: {channels_str}\n"
        f"Today's date: {today}\n"
        f"{date_ctx}\n\n"
        f"Return ONLY a valid JSON object (no markdown fences, no explanation) with this exact structure:\n"
        "{\n"
        '  "name": "Campaign name (short, 3-6 words)",\n'
        '  "theme": "Creative direction and core message (2-3 sentences)",\n'
        '  "visual_direction": "Visual style, mood, scenes, colors (2-3 sentences)",\n'
        '  "notes": "Strategy notes and key messaging points",\n'
        '  "month_label": "Month Year e.g. May 2026",\n'
        '  "start_date": "YYYY-MM-DD or null",\n'
        '  "end_date": "YYYY-MM-DD or null",\n'
        '  "posts": [\n'
        "    {\n"
        '      "product_name": "Product or content piece name",\n'
        '      "channel": "one of: instagram_post | instagram_stories | facebook_post | email | tiktok",\n'
        '      "post_type": "one of: static | reel | stories | email | carousel",\n'
        '      "scheduled_date": "YYYY-MM-DD",\n'
        '      "visual_direction": "Specific visual direction for this post"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Generate 3 to 6 posts spread across the requested channels and date range. "
        f"Use real product or content ideas based on the description. "
        f"All scheduled_date values must be real calendar dates in YYYY-MM-DD format."
    )

    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        # Strip markdown code fences if Claude wrapped the JSON
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                cleaned = part.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.startswith("{"):
                    text = cleaned
                    break
        data = json.loads(text.strip())
    except json.JSONDecodeError as exc:
        logger.error("generate-campaign JSON parse error: %s | raw text: %s", exc, text[:500] if 'text' in dir() else 'N/A')
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")
    except Exception as exc:
        logger.error("generate-campaign error: %s", exc)
        raise HTTPException(status_code=500, detail="AI generation failed. Please try again.")

    # Persist campaign
    campaign = Campaign(
        brand_key=body.brand_key,
        name=data.get("name") or "AI Campaign",
        theme=data.get("theme"),
        visual_direction=data.get("visual_direction"),
        notes=data.get("notes"),
        month_label=data.get("month_label"),
        start_date=data.get("start_date") or body.start_date,
        end_date=data.get("end_date") or body.end_date,
        status="draft",
    )
    db.add(campaign)
    await db.flush()  # get campaign.id before creating posts

    # Persist posts
    posts_data = data.get("posts") or []
    created_items: list[ContentItem] = []
    for p in posts_data:
        channel = p.get("channel", "instagram_post")
        post_type = p.get("post_type", "static")
        content_type = "image" if channel in ("instagram_post", "instagram_stories", "tiktok", "facebook_post") else "email"
        item = ContentItem(
            brand_key=body.brand_key,
            campaign_id=campaign.id,
            campaign=campaign.name,
            product_name=p.get("product_name") or campaign.name,
            channel=channel,
            content_type=content_type,
            post_type=post_type,
            scheduled_date=p.get("scheduled_date"),
            visual_direction=p.get("visual_direction") or campaign.visual_direction,
            status="pending",
            image_source_type="not_set",
        )
        db.add(item)
        created_items.append(item)

    await db.commit()

    # Build response from in-memory objects — refreshing after commit can fail
    # if the session is closed by the get_db dependency teardown.
    return {
        "id": campaign.id,
        "name": campaign.name,
        "brand_key": campaign.brand_key,
        "status": campaign.status,
        "theme": campaign.theme,
        "visual_direction": campaign.visual_direction,
        "notes": campaign.notes,
        "month_label": campaign.month_label,
        "start_date": str(campaign.start_date) if campaign.start_date else None,
        "end_date": str(campaign.end_date) if campaign.end_date else None,
        "posts": [
            {
                "id": item.id,
                "product_name": item.product_name,
                "channel": item.channel,
                "scheduled_date": str(item.scheduled_date) if item.scheduled_date else None,
                "status": item.status,
            }
            for item in created_items
        ],
    }
