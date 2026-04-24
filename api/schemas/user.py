from datetime import datetime
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str
    role: str
    brand_key: str | None = None


class UserRead(BaseModel):
    id: int
    email: str
    role: str
    brand_key: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
