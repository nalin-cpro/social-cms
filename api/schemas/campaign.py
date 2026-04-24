from datetime import datetime
from pydantic import BaseModel


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
