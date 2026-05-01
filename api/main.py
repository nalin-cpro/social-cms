from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.database import create_all_tables
from api.routers import auth, brands, campaigns, content, pipeline, notifications
from api.routers import suggestions, holidays, assets, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_all_tables()
    yield


app = FastAPI(title="Progility Content Platform", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://frontend:3000",
        "https://social.progilityconsulting.in",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(brands.router)
app.include_router(campaigns.router)
app.include_router(content.router)
app.include_router(pipeline.router)
app.include_router(notifications.router)
app.include_router(suggestions.router)
app.include_router(holidays.router)
app.include_router(assets.router)
app.include_router(ai.router)

_outputs_dir = Path("outputs")
_outputs_dir.mkdir(exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(_outputs_dir)), name="outputs")


@app.get("/health")
async def health():
    return {"status": "ok"}
