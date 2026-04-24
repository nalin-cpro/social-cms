"""
Backfill feed_post_url / story_*_url / lifestyle_url for ContentItems
that have null or empty image URLs by scanning the local outputs/ folder.

Run: python scripts/backfill_image_urls.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.config import DATABASE_URL
from api.models.content import ContentItem
from api.database import Base
from sqlalchemy import create_engine, select, or_
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

OUTPUTS_ROOT = Path(__file__).parent.parent / "outputs"
if not OUTPUTS_ROOT.exists():
    OUTPUTS_ROOT = Path("outputs")


def _build_handle(product_name: str) -> str:
    h = product_name.lower().replace("'", "").replace("’", "")
    h = "".join(c if c.isalnum() else "-" for c in h).strip("-")
    return "-".join(filter(None, h.split("-")))


def _build_index() -> dict[str, dict[str, str]]:
    """Walk outputs/ and return {handle: {suffix: web_url}}."""
    index: dict[str, dict[str, str]] = {}
    if not OUTPUTS_ROOT.exists():
        return index
    for f in OUTPUTS_ROOT.rglob("*.jpg"):
        rel = f.relative_to(OUTPUTS_ROOT)
        web_url = f"/outputs/{rel.as_posix()}"
        stem = f.stem
        for suffix in ("_feed", "_story_1", "_story_2"):
            if stem.endswith(suffix):
                handle = stem[: -len(suffix)]
                index.setdefault(handle, {})[suffix] = web_url
                break
        else:
            if "_lifestyle" in stem:
                handle = stem[: stem.index("_lifestyle")]
                existing = index.get(handle, {}).get("_lifestyle")
                if not existing or f.stat().st_mtime > OUTPUTS_ROOT.joinpath(
                    existing.lstrip("/").replace("outputs/", "")
                ).stat().st_mtime:
                    index.setdefault(handle, {})["_lifestyle"] = web_url
    return index


def main() -> None:
    Base.metadata.create_all(_engine)
    index = _build_index()
    print(f"Built file index: {sum(len(v) for v in index.values())} files across {len(index)} handles")

    with Session(_engine) as session:
        items = session.execute(
            select(ContentItem).where(
                or_(ContentItem.feed_post_url.is_(None), ContentItem.feed_post_url == "")
            )
        ).scalars().all()

        updated = 0
        not_found = 0

        for item in items:
            handle = _build_handle(item.product_name)
            urls = index.get(handle)
            if not urls:
                print(f"  NOT FOUND: {item.product_name!r} → handle={handle!r}")
                not_found += 1
                continue

            item.feed_post_url = urls.get("_feed")
            item.story_1_url   = urls.get("_story_1")
            item.story_2_url   = urls.get("_story_2")
            item.lifestyle_url = urls.get("_lifestyle")
            if item.feed_post_url:
                item.status = "ready_for_approval"
            updated += 1
            print(f"  Updated: {item.product_name} / {item.channel} -> {item.feed_post_url}")

        if updated:
            session.commit()

    print(f"\nUpdated {updated} records, {not_found} not found")


if __name__ == "__main__":
    main()
