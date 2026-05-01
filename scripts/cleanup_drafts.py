"""
Remove nameless / placeholder campaigns and their orphaned content items.
Run: docker compose -f docker-compose.prod.yml exec api python3 scripts/cleanup_drafts.py
"""
import asyncio
from sqlalchemy import select, delete
from api.database import AsyncSessionLocal
from api.models.campaign import Campaign
from api.models.content import ContentItem


async def cleanup():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Campaign).where(
                (Campaign.name == None) |
                (Campaign.name == '') |
                (Campaign.name == 'Untitled campaign') |
                (Campaign.name == 'AI Campaign')
            )
        )
        bad = result.scalars().all()
        print(f'Found {len(bad)} nameless/placeholder campaigns to delete')
        for c in bad:
            print(f'  Deleting campaign id={c.id} name={c.name!r} status={c.status}')
            await db.execute(delete(ContentItem).where(ContentItem.campaign_id == c.id))
            await db.delete(c)
        await db.commit()
        print('Cleanup complete')

        # Summary of remaining campaigns
        remaining = await db.execute(select(Campaign).order_by(Campaign.id))
        print('\nRemaining campaigns:')
        for c in remaining.scalars().all():
            count_result = await db.execute(
                select(ContentItem).where(ContentItem.campaign_id == c.id)
            )
            post_count = len(count_result.scalars().all())
            print(f'  id={c.id} name={c.name!r} status={c.status} posts={post_count}')


asyncio.run(cleanup())
