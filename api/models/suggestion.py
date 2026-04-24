from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base


class DesignerSuggestion(Base):
    __tablename__ = "designer_suggestions"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("content_items.id"), nullable=False, index=True)
    designer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    suggestion_type: Mapped[str] = mapped_column(String(30), nullable=False)  # cancel|edit|regenerate_image
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|accepted|rejected
    admin_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
