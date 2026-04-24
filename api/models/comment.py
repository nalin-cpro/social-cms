from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base


class ContentComment(Base):
    __tablename__ = "content_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("content_items.id"), nullable=False, index=True)
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)  # admin|designer|client|system
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai_revision: Mapped[bool] = mapped_column(Boolean, default=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    content_item: Mapped["ContentItem"] = relationship(  # noqa: F821
        "ContentItem", back_populates="comments", lazy="raise"
    )
