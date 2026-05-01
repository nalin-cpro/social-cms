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
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import require_roles
from api.database import get_db
from api.models.campaign import Campaign
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
    channels_str = ", ".join(body.channels) if body.channels else "Instagram post, Instagram stories"
    date_ctx = f"Target date range: {body.start_date} to {body.end_date}" if body.start_date else ""

    prompt = (
        f"Create a marketing campaign brief for brand: {body.brand_key}.\n\n"
        f"Campaign description: {body.description}\n"
        f"Channels to use: {channels_str}\n"
        f"{date_ctx}\n\n"
        f"Return ONLY a valid JSON object with these exact fields:\n"
        '{{\n'
        '  "name": "Campaign name (short, punchy, 3-6 words)",\n'
        '  "theme": "Creative direction and core message (2-3 sentences)",\n'
        '  "visual_direction": "Visual style, mood, scenes, colors, styling (2-3 sentences)",\n'
        '  "notes": "Strategy notes and key messaging points",\n'
        '  "month_label": "Month Year e.g. May 2026",\n'
        '  "start_date": "YYYY-MM-DD or null",\n'
        '  "end_date": "YYYY-MM-DD or null"\n'
        '}}'
    )

    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=700,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        if "```" in text:
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
    except json.JSONDecodeError as exc:
        logger.error("generate-campaign JSON parse error: %s", exc)
        raise HTTPException(status_code=500, detail="AI returned invalid response. Please try again.")
    except Exception as exc:
        logger.error("generate-campaign error: %s", exc)
        raise HTTPException(status_code=500, detail="AI generation failed. Please try again.")

    campaign = Campaign(
        brand_key=body.brand_key,
        name=data.get("name", "AI Campaign"),
        theme=data.get("theme"),
        visual_direction=data.get("visual_direction"),
        notes=data.get("notes"),
        month_label=data.get("month_label"),
        start_date=data.get("start_date") or body.start_date,
        end_date=data.get("end_date") or body.end_date,
        status="draft",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    from api.schemas.campaign import CampaignEntityRead
    return {"campaign": CampaignEntityRead.model_validate(campaign)}
