from datetime import datetime
from sqlalchemy import String, Text, DateTime, JSON, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base


class CampaignPlan(Base):
    """Legacy plan container — keeps seeded data intact."""
    __tablename__ = "campaign_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_key: Mapped[str] = mapped_column(String(50), ForeignKey("brands.key"), nullable=False, index=True)
    month_label: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    plan_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    content_items: Mapped[list["ContentItem"]] = relationship(  # noqa: F821
        "ContentItem", back_populates="plan", lazy="selectin"
    )


class Campaign(Base):
    """Proper campaign entity — name, brief, date range, posts."""
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_key: Mapped[str] = mapped_column(String(50), ForeignKey("brands.key"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_direction: Mapped[str | None] = mapped_column(Text, nullable=True)
    month_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|draft|complete
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    posts: Mapped[list["ContentItem"]] = relationship(  # noqa: F821
        "ContentItem", back_populates="campaign_obj", lazy="selectin",
        foreign_keys="ContentItem.campaign_id",
    )
