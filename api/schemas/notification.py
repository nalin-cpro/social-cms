from datetime import datetime
from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    recipient_role: str
    brand_key: str | None
    content_item_id: int | None
    type: str
    message: str
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
