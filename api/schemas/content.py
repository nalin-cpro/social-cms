from datetime import datetime
from pydantic import BaseModel


class ContentItemRead(BaseModel):
    id: int
    plan_id: int | None
    campaign_id: int | None
    brand_key: str
    product_name: str
    campaign: str
    channel: str
    content_type: str
    post_type: str
    scheduled_date: str | None
    status: str
    feed_post_url: str | None
    story_1_url: str | None
    story_2_url: str | None
    lifestyle_url: str | None
    copy_json: dict | None
    original_copy_json: dict | None
    visual_direction: str | None
    scene: str | None
    qc_score: float | None
    client_comment: str | None
    revision_count: int
    processed_at: datetime | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CommentRequest(BaseModel):
    comment: str


class PipelineRunRequest(BaseModel):
    brand_key: str
    month_label: str
    dry_run: bool = False


class InternalCommentRequest(BaseModel):
    message: str
    is_internal: bool = False


class RegenerateImageRequest(BaseModel):
    instruction: str


class ContentItemUpdate(BaseModel):
    campaign_id: int | None = None
    status: str | None = None
    visual_direction: str | None = None
    scheduled_date: str | None = None


class ContentItemCreate(BaseModel):
    brand_key: str
    campaign_id: int | None = None
    plan_id: int | None = None
    product_name: str
    campaign: str
    channel: str
    content_type: str = "social"
    post_type: str = "feed"
    scheduled_date: str | None = None
    visual_direction: str | None = None
    scene: str | None = None
    status: str = "pending"
