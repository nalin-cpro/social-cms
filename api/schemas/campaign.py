from datetime import datetime
from pydantic import BaseModel
from api.schemas.content import ContentItemRead


class CampaignRead(BaseModel):
    id: int
    brand_key: str
    month_label: str
    status: str
    plan_json: list
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CampaignCreate(BaseModel):
    brand_key: str
    month_label: str


# ── New Campaign entity ────────────────────────────────────────────────────────

class CampaignEntityRead(BaseModel):
    id: int
    brand_key: str
    name: str
    theme: str | None
    visual_direction: str | None
    month_label: str | None
    year: int | None
    start_date: str | None
    end_date: str | None
    created_by: int | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CampaignEntityWithPosts(CampaignEntityRead):
    posts: list[ContentItemRead] = []


class CampaignEntityCreate(BaseModel):
    brand_key: str
    name: str
    theme: str | None = None
    visual_direction: str | None = None
    month_label: str | None = None
    year: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    notes: str | None = None
    status: str = "draft"


class CampaignEntityUpdate(BaseModel):
    name: str | None = None
    theme: str | None = None
    visual_direction: str | None = None
    month_label: str | None = None
    year: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    notes: str | None = None
    status: str | None = None
