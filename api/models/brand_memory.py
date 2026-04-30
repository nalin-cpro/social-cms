from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base


class BrandMemoryRule(Base):
    __tablename__ = "brand_memory_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_key: Mapped[str] = mapped_column(String(50), ForeignKey("brands.key"), nullable=False, index=True)
    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    rule_type: Mapped[str] = mapped_column(String(20), nullable=False)  # copy | visual | formatting
    source: Mapped[str] = mapped_column(String(30), nullable=False)     # manual | client_feedback | onboarding
    source_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_content_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("content_items.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending_review", nullable=False)
    confirmed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
