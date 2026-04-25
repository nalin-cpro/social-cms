"""
Reset sandbox to a clean state.

Deletes: ContentItems, Campaigns, ContentComments, Notifications,
         PipelineRuns, DesignerSuggestions
Keeps:   Users, Brands, HolidayEvents, CampaignPlans (legacy JSON plans)
Then:    Re-seeds April 2026 posts from config/campaign_plan.json
         Clears the outputs/ folder

Usage:
  python scripts/reset_sandbox.py
  python scripts/reset_sandbox.py --keep-outputs   # skip clearing outputs/
"""

import asyncio
import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


async def reset(keep_outputs: bool = False) -> None:
    from api.database import create_all_tables, AsyncSessionLocal
    from sqlalchemy import delete, text

    await create_all_tables()

    async with AsyncSessionLocal() as session:
        # Import models
        from api.models.content import ContentItem
        from api.models.campaign import Campaign
        from api.models.comment import ContentComment
        from api.models.notification import Notification
        from api.models.pipeline_run import PipelineRun
        from api.models.suggestion import DesignerSuggestion

        # Order matters for FK constraints
        await session.execute(delete(ContentComment))
        await session.execute(delete(DesignerSuggestion))
        await session.execute(delete(Notification))
        await session.execute(delete(PipelineRun))
        await session.execute(delete(ContentItem))
        await session.execute(delete(Campaign))
        await session.commit()
        print("Cleared: ContentItems, Campaigns, Comments, Notifications, PipelineRuns, Suggestions")

        # Re-seed from JSON plan
        import json
        plan_path = Path(__file__).parent.parent / "config" / "campaign_plan.json"
        if not plan_path.exists():
            print(f"No campaign plan found at {plan_path} — skipping seed")
            seeded = 0
        else:
            with open(plan_path) as f:
                plan = json.load(f)

            april_posts = [p for p in plan if p.get("month_label") == "April 2026"]
            seeded = 0
            for p in april_posts:
                # Reset status to pending
                item = ContentItem(
                    brand_key=p.get("brand_key", "mbc"),
                    product_name=p.get("product_name", ""),
                    campaign=p.get("campaign", ""),
                    channel=p.get("channel", "instagram_post"),
                    content_type=p.get("content_type", "image"),
                    post_type=p.get("post_type", "static"),
                    scheduled_date=p.get("scheduled_date"),
                    visual_direction=p.get("visual_direction"),
                    scene=p.get("scene"),
                    status="pending",
                )
                session.add(item)
                seeded += 1

            await session.commit()
            print(f"Seeded {seeded} April 2026 posts (status=pending)")

    # Clear outputs/
    if not keep_outputs:
        outputs = Path(__file__).parent.parent / "outputs"
        if outputs.exists():
            removed = 0
            skipped = 0
            for d in outputs.iterdir():
                if d.is_dir():
                    try:
                        shutil.rmtree(d)
                        removed += 1
                    except PermissionError:
                        skipped += 1
            outputs.mkdir(exist_ok=True)
            msg = f"Cleared outputs/ ({removed} folder(s) removed)"
            if skipped:
                msg += f", {skipped} skipped (permission denied — run as root or clean manually)"
            print(msg)
        else:
            outputs.mkdir(exist_ok=True)
            print("outputs/ created (was missing)")
    else:
        print("outputs/ kept (--keep-outputs)")

    print(f"\nSandbox reset complete — {seeded} posts seeded")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset sandbox to clean state")
    parser.add_argument("--keep-outputs", action="store_true", help="Skip clearing outputs/")
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    asyncio.run(reset(keep_outputs=args.keep_outputs))
