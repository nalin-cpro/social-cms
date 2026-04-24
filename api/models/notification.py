from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    brand_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("content_items.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
