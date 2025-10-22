"""Pydantic models for storage layer."""

from __future__ import annotations

from datetime import date, datetime  # noqa: TC003
from typing import Literal

from pydantic import BaseModel


class StoredTask(BaseModel):
    """Model representing a stored task."""

    id: int
    list_id: int
    title: str
    description: str | None
    completed: bool
    due_date: date | None
    reschedule_period: str | None
    reschedule_base: Literal["completed", "due"] | None = "completed"
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    prohibited_months: list[int]
    constraints: list[str] = []


class StoredList(BaseModel):
    """Model representing a stored task list."""

    id: int
    name: str
    created_at: datetime
    updated_at: datetime


