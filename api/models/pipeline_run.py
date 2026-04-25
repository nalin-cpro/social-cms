from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_key: Mapped[str] = mapped_column(String(50), nullable=False)
    month_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False)
    test_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    mode: Mapped[str] = mapped_column(String(20), default="all")
    status: Mapped[str] = mapped_column(String(20), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    posts_processed: Mapped[int] = mapped_column(Integer, default=0)
    posts_ready: Mapped[int] = mapped_column(Integer, default=0)
    posts_errored: Mapped[int] = mapped_column(Integer, default=0)
    current_post: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
