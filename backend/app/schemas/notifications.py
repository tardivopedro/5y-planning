from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class NotificationPayload(BaseModel):
  id: str
  category: str
  title: str
  message: str
  status: str = Field(pattern="^(running|completed|failed)$")
  progress: Optional[float] = None
  processed_rows: Optional[int] = None
  total_rows: Optional[int] = None
  created_at: datetime
  updated_at: datetime
  metadata: Dict[str, Any]
