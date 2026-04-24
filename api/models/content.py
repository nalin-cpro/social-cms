from datetime import datetime
from sqlalchemy import String, Text, DateTime, JSON, Float, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base


class ContentItem(Base):
    __tablename__ = "content_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("campaign_plans.id"), nullable=True)
    brand_key: Mapped[str] = mapped_column(String(50), ForeignKey("brands.key"), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), default="image")
    post_type: Mapped[str] = mapped_column(String(50), default="static")
    scheduled_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)

    feed_post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    story_1_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    story_2_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    lifestyle_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    copy_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    original_copy_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    visual_direction: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene: Mapped[str | None] = mapped_column(String(50), nullable=True)
    qc_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    client_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision_count: Mapped[int] = mapped_column(Integer, default=0)
    ad_campaign_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped["CampaignPlan | None"] = relationship(  # noqa: F821
        "CampaignPlan", back_populates="content_items", lazy="raise"
    )
