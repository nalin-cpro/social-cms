"""
Seed the database with initial users, brands, and content items.
Uses synchronous SQLAlchemy so it works without greenlet DLL (Windows dev).
Defaults to SQLite (dev.db) if DATABASE_URL is not set.
Run: python scripts/seed_db.py
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.config import DATABASE_URL
from api.models.user import User
from api.models.brand import Brand
from api.models.campaign import CampaignPlan
from api.models.content import ContentItem
from api.database import Base
from api.auth import hash_password

from sqlalchemy import create_engine, select, or_
from sqlalchemy.orm import Session

# Convert async URL to sync URL
_sync_url = (
    DATABASE_URL
    .replace("sqlite+aiosqlite", "sqlite")
    .replace("postgresql+asyncpg", "postgresql")
)
_engine = create_engine(_sync_url, connect_args={"check_same_thread": False} if "sqlite" in _sync_url else {})

_BRANDS_PATH = Path(__file__).parent.parent / "config" / "brands.json"
_PLAN_PATH = Path(__file__).parent.parent / "config" / "campaign_plan.json"
_ANALYSIS_DIR = Path(__file__).parent.parent / "config"

USERS = [
    {"email": "nalin@progilityconsulting.in",   "password": "admin123",   "role": "admin",    "brand_key": None},
    {"email": "gautam@progilityconsulting.in",   "password": "design123",  "role": "designer", "brand_key": None},
    {"email": "anuraj@progilityconsulting.in",   "password": "design123",  "role": "designer", "brand_key": None},
    {"email": "justine@milwaukeebootcompany.com", "password": "client123",  "role": "client",   "brand_key": "mbc"},
]

STATUS_MAP = {
    "pending": "pending",
    "ready_for_approval": "ready_for_approval",
    "approved": "approved",
    "error": "error",
}


def seed() -> None:
    Base.metadata.create_all(_engine)
    print("✓ Tables created")

    with Session(_engine) as session:
        # ── Users ─────────────────────────────────────────────────────────────
        for u in USERS:
            if session.execute(select(User).where(User.email == u["email"])).scalar_one_or_none():
                print(f"  user exists: {u['email']}")
                continue
            session.add(User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                brand_key=u["brand_key"],
            ))
            print(f"  + user: {u['email']} ({u['role']})")
        session.commit()

        # ── Brands ────────────────────────────────────────────────────────────
        brands_data = json.loads(_BRANDS_PATH.read_text())
        for key, config in brands_data.items():
            brand = session.execute(select(Brand).where(Brand.key == key)).scalar_one_or_none()
            analysis_path = _ANALYSIS_DIR / f"brand_analysis_{key}.json"
            analysis = json.loads(analysis_path.read_text()) if analysis_path.exists() else None

            if brand:
                brand.config_json = config
                brand.analysis_json = analysis
                print(f"  updated brand: {key}")
            else:
                session.add(Brand(key=key, name=config.get("name", key),
                                  config_json=config, analysis_json=analysis, active=True))
                print(f"  + brand: {key} ({config.get('name', key)})")
        session.commit()

        # ── Campaign plan + content items ─────────────────────────────────────
        if _PLAN_PATH.exists():
            plan_data = json.loads(_PLAN_PATH.read_text())

            groups: dict[tuple, list] = {}
            for item in plan_data:
                k = (item["brand_key"], item.get("month_label", ""))
                groups.setdefault(k, []).append(item)

            for (bk, ml), items in groups.items():
                plan = session.execute(
                    select(CampaignPlan).where(
                        CampaignPlan.brand_key == bk, CampaignPlan.month_label == ml
                    )
                ).scalar_one_or_none()
                if not plan:
                    plan = CampaignPlan(brand_key=bk, month_label=ml, status="active", plan_json=items)
                    session.add(plan)
                    session.flush()
                    print(f"  + campaign plan: {bk} / {ml}")

                for raw in items:
                    exists = session.execute(
                        select(ContentItem).where(
                            ContentItem.brand_key == raw["brand_key"],
                            ContentItem.channel == raw["channel"],
                            ContentItem.product_name == raw["product_name"],
                            ContentItem.scheduled_date == raw.get("scheduled_date"),
                        )
                    ).scalar_one_or_none()
                    if exists:
                        continue

                    copy = raw.get("copy") or raw.get("copy_json")
                    db_status = STATUS_MAP.get(raw.get("status", "pending"), "pending")
                    session.add(ContentItem(
                        plan_id=plan.id,
                        brand_key=raw["brand_key"],
                        product_name=raw["product_name"],
                        campaign=raw["campaign"],
                        channel=raw["channel"],
                        post_type=raw.get("post_type", "static"),
                        scheduled_date=raw.get("scheduled_date"),
                        status=db_status,
                        feed_post_url=raw.get("feed_post_url"),
                        story_1_url=raw.get("story_1_url"),
                        story_2_url=raw.get("story_2_url"),
                        lifestyle_url=raw.get("lifestyle_url"),
                        copy_json=copy,
                        visual_direction=raw.get("visual_direction"),
                        scene=raw.get("scene"),
                        processed_at=datetime.fromisoformat(raw["processed_at"]) if raw.get("processed_at") else None,
                    ))
                    print(f"    + content item: {raw['product_name']} / {raw['channel']}")
            session.commit()

        # ── Backfill image URLs from local outputs/ ───────────────────────────
        _backfill_image_urls(session)

    print("\n✓ Seed complete")
    print("\nTest credentials:")
    for u in USERS:
        print(f"  {u['email']}  /  {u['password']}  ({u['role']})")


def _backfill_image_urls(session: Session) -> None:
    """Find content items with null image URLs and fill from local outputs/."""
    # Try project root relative to this script, then cwd fallback (Docker: /app)
    outputs_root = Path(__file__).parent.parent / "outputs"
    if not outputs_root.exists():
        outputs_root = Path("outputs")
    if not outputs_root.exists():
        return

    items = session.execute(
        select(ContentItem).where(
            or_(ContentItem.feed_post_url.is_(None), ContentItem.feed_post_url == "")
        )
    ).scalars().all()

    if not items:
        return

    # Build index: handle → {suffix → web_url}
    # Walk every outputs/<brand>/<date>/<file> and map by stem pattern
    file_index: dict[str, dict[str, str]] = {}
    for f in outputs_root.rglob("*.jpg"):
        rel = f.relative_to(outputs_root)  # e.g. mbc/2026-04-20/handle_feed.jpg
        web_url = f"/outputs/{rel.as_posix()}"
        stem = f.stem  # e.g. bernie-mens-slip-on-sneaker_feed
        for suffix in ("_feed", "_story_1", "_story_2"):
            if stem.endswith(suffix):
                handle = stem[: -len(suffix)]
                file_index.setdefault(handle, {})[suffix] = web_url
                break
        else:
            # lifestyle files: handle_lifestyle_<scene>.jpg — use the most recent
            for part in ("_lifestyle",):
                if part in stem:
                    handle = stem[: stem.index(part)]
                    existing = file_index.get(handle, {}).get("_lifestyle")
                    if not existing or f.stat().st_mtime > outputs_root.joinpath(
                        existing.lstrip("/").replace("outputs/", "")
                    ).stat().st_mtime:
                        file_index.setdefault(handle, {})["_lifestyle"] = web_url
                    break

    updated = 0
    for item in items:
        # Derive handle from product name  e.g. "Bernie Men's Slip On Sneaker" → "bernie-mens-slip-on-sneaker"
        handle = item.product_name.lower().replace("'", "").replace("'", "")
        handle = "".join(c if c.isalnum() else "-" for c in handle).strip("-")
        handle = "-".join(filter(None, handle.split("-")))

        urls = file_index.get(handle)
        if not urls:
            continue

        item.feed_post_url = urls.get("_feed")
        item.story_1_url   = urls.get("_story_1")
        item.story_2_url   = urls.get("_story_2")
        item.lifestyle_url = urls.get("_lifestyle")
        if item.feed_post_url:
            item.status = "ready_for_approval"
        updated += 1
        print(f"  backfilled: {item.product_name} / {item.channel} → {item.feed_post_url}")

    if updated:
        session.commit()
        print(f"  ✓ {updated} content item(s) backfilled with local image URLs")


if __name__ == "__main__":
    seed()
