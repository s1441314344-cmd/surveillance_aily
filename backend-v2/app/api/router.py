from fastapi import APIRouter

from app.api.routes import (
    alert_notification_routes,
    alert_webhooks,
    alerts,
    audit_logs,
    auth,
    cameras,
    dashboard,
    dashboards,
    feedback,
    health,
    job_schedules,
    jobs,
    me,
    model_providers,
    strategies,
    training,
    task_records,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, tags=["auth"])
api_router.include_router(audit_logs.router, prefix="/audit-logs", tags=["audit-logs"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(alert_webhooks.router, prefix="/alert-webhooks", tags=["alert-webhooks"])
api_router.include_router(
    alert_notification_routes.router,
    prefix="/alert-notification-routes",
    tags=["alert-notification-routes"],
)
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(model_providers.router, prefix="/model-providers", tags=["model-providers"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(job_schedules.router, prefix="/job-schedules", tags=["job-schedules"])
api_router.include_router(task_records.router, prefix="/task-records", tags=["task-records"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
