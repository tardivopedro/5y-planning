from fastapi import APIRouter, Query

from app.schemas.notifications import NotificationPayload
from app.services.notification_service import notification_center

router = APIRouter()


@router.get("", response_model=list[NotificationPayload])
def list_notifications(limit: int = Query(default=20, ge=1, le=100)):
  entries = notification_center.list_notifications(limit)
  return [NotificationPayload(**entry.to_dict()) for entry in entries]
