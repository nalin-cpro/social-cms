from datetime import datetime
from pydantic import BaseModel


class BrandMemoryRuleRead(BaseModel):
    id: int
    brand_key: str
    rule_text: str
    rule_type: str
    source: str
    source_comment: str | None
    source_content_item_id: int | None
    status: str
    confirmed_by: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


class BrandMemoryRuleCreate(BaseModel):
    rule_text: str
    rule_type: str       # copy | visual | formatting
    source: str = "manual"


class BrandMemoryRulePatch(BaseModel):
    status: str          # confirmed | rejected | pending_review
