from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.training import (
    TrainingDatasetRead,
    TrainingOverviewRead,
    TrainingPipelineRunRead,
    TrainingPipelineRunRequest,
    TrainingRunDetailRead,
    TrainingRunRead,
    TrainingRunReviewRead,
    TrainingRunReviewRequest,
)
from app.services.feedback_training_pipeline_service import (
    approve_training_run,
    get_training_overview,
    get_training_run_detail_or_404,
    list_training_datasets,
    list_training_runs,
    reject_training_run,
    run_feedback_training_pipeline,
)
from app.services.rbac import ROLE_STRATEGY_CONFIGURATOR, ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("/overview", response_model=TrainingOverviewRead)
def training_overview(
    provider: str | None = None,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return get_training_overview(db, provider=provider)


@router.post("/pipeline/run", response_model=TrainingPipelineRunRead)
def run_training_pipeline(
    payload: TrainingPipelineRunRequest | None = None,
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    strategy_id = payload.strategy_id if payload else None
    return run_feedback_training_pipeline(
        db,
        strategy_id=strategy_id,
        trigger_source="manual",
        triggered_by=current_user.username,
    )


@router.get("/datasets", response_model=list[TrainingDatasetRead])
def training_datasets(
    provider: str | None = None,
    strategy_id: str | None = None,
    limit: int = 100,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return list_training_datasets(
        db,
        provider=provider,
        strategy_id=strategy_id,
        limit=limit,
    )


@router.get("/runs", response_model=list[TrainingRunRead])
def training_runs(
    provider: str | None = None,
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return list_training_runs(
        db,
        provider=provider,
        strategy_id=strategy_id,
        status_filter=status,
        limit=limit,
    )


@router.get("/runs/{run_id}", response_model=TrainingRunDetailRead)
def training_run_detail(
    run_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return get_training_run_detail_or_404(db, run_id)


@router.post("/runs/{run_id}/approve", response_model=TrainingRunReviewRead)
def approve_run(
    run_id: str,
    payload: TrainingRunReviewRequest,
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return approve_training_run(
        db,
        run_id=run_id,
        reviewer=current_user.display_name or current_user.username,
        comment=payload.comment,
    )


@router.post("/runs/{run_id}/reject", response_model=TrainingRunReviewRead)
def reject_run(
    run_id: str,
    payload: TrainingRunReviewRequest,
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return reject_training_run(
        db,
        run_id=run_id,
        reviewer=current_user.display_name or current_user.username,
        comment=payload.comment,
    )
