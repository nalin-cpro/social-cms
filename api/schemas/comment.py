from datetime import datetime
from pydantic import BaseModel


class ContentCommentRead(BaseModel):
    id: int
    content_item_id: int
    sender_role: str
    sender_name: str
    message: str
    is_ai_revision: bool
    is_internal: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ContentCommentCreate(BaseModel):
    message: str
    is_internal: bool = False


class DesignerSuggestionRead(BaseModel):
    id: int
    content_item_id: int
    designer_id: int
    suggestion_type: str
    message: str
    status: str
    admin_response: str | None
    created_at: datetime
    resolved_at: datetime | None
    model_config = {"from_attributes": True}


class DesignerSuggestionCreate(BaseModel):
    content_item_id: int
    suggestion_type: str  # cancel|edit|regenerate_image
    message: str


class DesignerSuggestionResolve(BaseModel):
    status: str  # accepted|rejected
    admin_response: str | None = None


class HolidayEventRead(BaseModel):
    id: int
    brand_key: str | None
    name: str
    date: str
    type: str
    notes: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class HolidayEventCreate(BaseModel):
    brand_key: str | None = None
    name: str
    date: str
    type: str = "holiday"
    notes: str | None = None
