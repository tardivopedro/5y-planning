from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class NotificationEntry:
  id: str
  category: str
  title: str
  message: str
  status: str
  progress: Optional[float] = None
  processed_rows: Optional[int] = None
  total_rows: Optional[int] = None
  created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
  updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
  metadata: Dict[str, Any] = field(default_factory=dict)

  def to_dict(self) -> Dict[str, Any]:
    payload = asdict(self)
    # dataclasses.asdict already converts datetime objects, but we ensure timezone aware
    payload["created_at"] = self.created_at
    payload["updated_at"] = self.updated_at
    return payload


class NotificationCenter:
  """Thread-safe in-memory notification registry."""

  MAX_ITEMS = 50

  def __init__(self) -> None:
    self._lock = Lock()
    self._items: Dict[str, NotificationEntry] = {}

  def start(
    self,
    *,
    category: str,
    title: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None
  ) -> str:
    entry = NotificationEntry(
      id=str(uuid4()),
      category=category,
      title=title,
      message=message,
      status="running",
      metadata=metadata or {}
    )
    with self._lock:
      self._items[entry.id] = entry
      self._trim()
    return entry.id

  def update(
    self,
    entry_id: str,
    *,
    message: Optional[str] = None,
    progress: Optional[float] = None,
    processed_rows: Optional[int] = None,
    total_rows: Optional[int] = None,
    status: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
  ) -> None:
    with self._lock:
      entry = self._items.get(entry_id)
      if not entry:
        return
      if message is not None:
        entry.message = message
      if progress is not None:
        entry.progress = max(0.0, min(progress, 1.0))
      if processed_rows is not None:
        entry.processed_rows = processed_rows
      if total_rows is not None:
        entry.total_rows = total_rows
      if status is not None:
        entry.status = status
      if metadata:
        entry.metadata.update(metadata)
      entry.updated_at = datetime.now(timezone.utc)

  def complete(self, entry_id: str, message: Optional[str] = None) -> None:
    self.update(entry_id, status="completed", progress=1.0, message=message)

  def fail(self, entry_id: str, message: Optional[str] = None) -> None:
    self.update(entry_id, status="failed", message=message)

  def list_notifications(self, limit: int = 20) -> List[NotificationEntry]:
    with self._lock:
      items = sorted(self._items.values(), key=lambda item: item.updated_at, reverse=True)
      return items[:limit]

  def _trim(self) -> None:
    if len(self._items) <= self.MAX_ITEMS:
      return
    # Remove older entries beyond MAX_ITEMS
    sorted_items = sorted(self._items.values(), key=lambda item: item.updated_at, reverse=True)
    for entry in sorted_items[self.MAX_ITEMS:]:
      self._items.pop(entry.id, None)


notification_center = NotificationCenter()
