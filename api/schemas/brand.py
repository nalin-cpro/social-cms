from datetime import datetime
from pydantic import BaseModel


class BrandRead(BaseModel):
    key: str
    name: str
    config_json: dict
    analysis_json: dict | None
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BrandUpdate(BaseModel):
    name: str | None = None
    config_json: dict | None = None
    active: bool | None = None
