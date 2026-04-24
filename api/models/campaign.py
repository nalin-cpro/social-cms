from datetime import datetime
from sqlalchemy import String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base


class CampaignPlan(Base):
    __tablename__ = "campaign_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_key: Mapped[str] = mapped_column(String(50), ForeignKey("brands.key"), nullable=False, index=True)
    month_label: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|active|complete
    plan_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    content_items: Mapped[list["ContentItem"]] = relationship(  # noqa: F821
        "ContentItem", back_populates="plan", lazy="selectin"
    )
