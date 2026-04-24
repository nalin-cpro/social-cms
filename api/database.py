from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from api.config import DATABASE_URL

_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
_url = _url.replace("postgres://", "postgresql+asyncpg://")

_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_async_engine(_url, connect_args=_connect_args, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_all_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
