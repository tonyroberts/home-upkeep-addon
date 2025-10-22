"""Pydantic schemas for the Home Upkeep API."""

from __future__ import annotations

from datetime import date, datetime  # noqa: TC003
from typing import Literal

from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    """Base model for task-related schemas."""

    list_id: int
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    completed: bool = False
    due_date: date | None = None
    reschedule_period: str | None = Field(default=None, pattern=r"^[0-9]+[dwm]$")
    reschedule_base: Literal["completed", "due"] | None = "completed"
    prohibited_months: list[int] = Field(
        default_factory=list,
        description="List of months (1-12) when task cannot be completed",
    )
    constraints: list[str] = Field(
        default_factory=list,
        description="List of constraint strings for the task",
    )


class TaskCreate(TaskBase):
    """Schema for creating a new task."""



class TaskUpdate(BaseModel):
    """Schema for updating an existing task."""

    list_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    completed: bool | None = None
    due_date: date | None = None
    reschedule_period: str | None = Field(default=None, pattern=r"^[0-9]+[dwm]$")
    reschedule_base: Literal["completed", "due"] | None = None
    completed_at: datetime | None = None
    updated_at: datetime | None = None
    prohibited_months: list[int] | None = None
    constraints: list[str] | None = None


class Task(TaskBase):
    """Complete task schema with all fields."""

    id: int
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class TaskUpdateResponse(BaseModel):
    """Response schema for task update operations."""

    task: Task
    created_task: Task | None = None


class TaskSnooze(BaseModel):
    """Schema for snoozing a task."""

    period: str = Field(..., pattern=r"^[0-9]+[dwm]$")
    updated_at: datetime | None = None


class TaskListBase(BaseModel):
    """Base model for task list schemas."""

    name: str = Field(..., min_length=1, max_length=200)


class TaskListCreate(TaskListBase):
    """Schema for creating a new task list."""



class TaskList(TaskListBase):
    """Complete task list schema with all fields."""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


