"""
Seed remaining April 2026 posts into campaign_plan.json and ContentItem table.
Run: python scripts/seed_april_remaining.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.config import DATABASE_URL
from api.models.content import ContentItem
from api.models.campaign import CampaignPlan
from api.database import Base
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

_sync_url = (
    DATABASE_URL
    .replace("sqlite+aiosqlite", "sqlite")
    .replace("postgresql+asyncpg", "postgresql")
)
_engine = create_engine(
    _sync_url,
    connect_args={"check_same_thread": False} if "sqlite" in _sync_url else {},
)

NEW_POSTS = [
    {
        "id": "mbc_apr23_hartford_tiktok",
        "brand_key": "mbc",
        "product_name": "Hartford Wedge Sole Mens Roper",
        "campaign": "Hartford Roper",
        "channel": "tiktok",
        "post_type": "reel",
        "scheduled_date": "2026-04-23",
        "visual_direction": "Golden hour outdoor - open road or ranch setting. Boot pressed into ground. Wide shot alternating close-up detail. Warm amber tones.",
        "scene": "weekend_market",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr24_oxblood_tiktok",
        "brand_key": "mbc",
        "product_name": "Highland Men's Boot",
        "campaign": "Heritage Series",
        "channel": "tiktok",
        "post_type": "reel",
        "scheduled_date": "2026-04-24",
        "visual_direction": "Deep oxblood leather close-up detail. Studio or dark background. Heritage craft focus.",
        "scene": "industrial_exterior",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr24_mothersday_email",
        "brand_key": "mbc",
        "product_name": "Mother's Day Campaign",
        "campaign": "Mother's Day",
        "channel": "email",
        "post_type": "email",
        "scheduled_date": "2026-04-24",
        "visual_direction": None,
        "scene": None,
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr25_highland_tiktok",
        "brand_key": "mbc",
        "product_name": "Highland Men's Boot",
        "campaign": "Brand Education",
        "channel": "tiktok",
        "post_type": "reel",
        "scheduled_date": "2026-04-25",
        "visual_direction": "Man on wooden boardwalk, natural morning light. Boot detail from low angle.",
        "scene": "city_street",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr26_hubbard_ig",
        "brand_key": "mbc",
        "product_name": "Hubbard Rolltop Backpack",
        "campaign": "Carry Everything",
        "channel": "instagram_post",
        "post_type": "static",
        "scheduled_date": "2026-04-26",
        "visual_direction": "Man in modern office or coffee shop setting, backpack naturally placed. Clean editorial feel.",
        "scene": "office_modern",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr27_northpoint_ig",
        "brand_key": "mbc",
        "product_name": "North Point Backpack",
        "campaign": "Carry Everything",
        "channel": "instagram_post",
        "post_type": "static",
        "scheduled_date": "2026-04-27",
        "visual_direction": "Weekend outdoor setting. Natural light. Backpack worn or placed on bench.",
        "scene": "weekend_market",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr28_mothersday_email2",
        "brand_key": "mbc",
        "product_name": "Mother's Day Final Reminder",
        "campaign": "Mother's Day",
        "channel": "email",
        "post_type": "email",
        "scheduled_date": "2026-04-28",
        "visual_direction": None,
        "scene": None,
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr29_leathercare_tiktok",
        "brand_key": "mbc",
        "product_name": "Leather Care + Suede Protector Kit",
        "campaign": "Brand Education",
        "channel": "tiktok",
        "post_type": "reel",
        "scheduled_date": "2026-04-29",
        "visual_direction": "Hands applying leather conditioner to boot. Close-up texture detail. Warm amber tones.",
        "scene": "urban_loft",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr30_wilson_ig",
        "brand_key": "mbc",
        "product_name": "Wilson Weekender Bag",
        "campaign": "Milwaukee Standard",
        "channel": "instagram_post",
        "post_type": "static",
        "scheduled_date": "2026-04-30",
        "visual_direction": "Man with weekender bag at train station or hotel. Confident travel energy. Warm tones.",
        "scene": "city_street",
        "status": "pending",
        "month_label": "April 2026",
    },
    {
        "id": "mbc_apr30_milwaukeestandard_email",
        "brand_key": "mbc",
        "product_name": "Milwaukee Standard Email",
        "campaign": "Milwaukee Standard",
        "channel": "email",
        "post_type": "email",
        "scheduled_date": "2026-04-30",
        "visual_direction": None,
        "scene": None,
        "status": "pending",
        "month_label": "April 2026",
    },
]

PLAN_PATH = Path(__file__).parent.parent / "config" / "campaign_plan.json"


def seed_json() -> tuple[int, int]:
    plan = json.loads(PLAN_PATH.read_text()) if PLAN_PATH.exists() else []
    existing_ids = {p["id"] for p in plan}
    added = 0
    skipped = 0
    for post in NEW_POSTS:
        if post["id"] in existing_ids:
            skipped += 1
        else:
            plan.append(post)
            added += 1
    PLAN_PATH.write_text(json.dumps(plan, indent=2))
    return added, skipped


def seed_db() -> tuple[int, int]:
    Base.metadata.create_all(_engine)
    inserted = 0
    skipped = 0

    with Session(_engine) as session:
        # Ensure campaign plan row exists
        plan_row = session.execute(
            select(CampaignPlan).where(
                CampaignPlan.brand_key == "mbc",
                CampaignPlan.month_label == "April 2026",
            )
        ).scalar_one_or_none()
        if not plan_row:
            plan_row = CampaignPlan(
                brand_key="mbc",
                month_label="April 2026",
                status="active",
                plan_json=NEW_POSTS,
            )
            session.add(plan_row)
            session.flush()
            print("  Created campaign plan: mbc / April 2026")

        for raw in NEW_POSTS:
            exists = session.execute(
                select(ContentItem).where(
                    ContentItem.brand_key == raw["brand_key"],
                    ContentItem.channel == raw["channel"],
                    ContentItem.product_name == raw["product_name"],
                    ContentItem.scheduled_date == raw.get("scheduled_date"),
                )
            ).scalar_one_or_none()
            if exists:
                skipped += 1
                continue

            session.add(ContentItem(
                plan_id=plan_row.id,
                brand_key=raw["brand_key"],
                product_name=raw["product_name"],
                campaign=raw["campaign"],
                channel=raw["channel"],
                post_type=raw.get("post_type", "static"),
                scheduled_date=raw.get("scheduled_date"),
                status=raw.get("status", "pending"),
                visual_direction=raw.get("visual_direction"),
                scene=raw.get("scene"),
            ))
            print(f"  + {raw['product_name']} / {raw['channel']} ({raw['scheduled_date']})")
            inserted += 1

        session.commit()

    return inserted, skipped


def main():
    json_added, json_skipped = seed_json()
    print(f"campaign_plan.json: added {json_added}, skipped {json_skipped}")

    db_inserted, db_skipped = seed_db()
    print(f"\nDatabase: Inserted {db_inserted} new posts, skipped {db_skipped} duplicates")


if __name__ == "__main__":
    main()
