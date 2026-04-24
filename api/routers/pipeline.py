import threading
from typing import Annotated

from fastapi import APIRouter, Depends, BackgroundTasks
from api.auth import require_roles
from api.models.user import User
from api.schemas.content import PipelineRunRequest

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

_pipeline_status: dict = {"running": False, "last_run": None, "result": None}


def _run_pipeline_thread(brand_key: str, month_label: str, dry_run: bool) -> None:
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    _pipeline_status["running"] = True
    try:
        from src.pipeline import run_pipeline
        run_pipeline(brand_key=brand_key, month_label=month_label, dry_run=dry_run)
        _pipeline_status["result"] = "complete"
    except Exception as exc:
        _pipeline_status["result"] = f"error: {exc}"
    finally:
        import datetime
        _pipeline_status["running"] = False
        _pipeline_status["last_run"] = datetime.datetime.utcnow().isoformat()


@router.post("/run")
async def run_pipeline(
    body: PipelineRunRequest,
    _: Annotated[User, Depends(require_roles("admin"))],
):
    if _pipeline_status["running"]:
        return {"status": "already_running"}
    t = threading.Thread(
        target=_run_pipeline_thread,
        args=(body.brand_key, body.month_label, body.dry_run),
        daemon=True,
    )
    t.start()
    return {"status": "started", "brand_key": body.brand_key, "month_label": body.month_label}


@router.get("/status")
async def pipeline_status(_: Annotated[User, Depends(require_roles("admin"))]):
    return _pipeline_status
