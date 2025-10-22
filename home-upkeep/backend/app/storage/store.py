"""Abstract base class for storage implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import datetime

    from .models import StoredList, StoredTask


class Store(ABC):
    """Abstract base class defining the storage interface."""

    @abstractmethod
    def list_tasks(self, list_id: int) -> list[StoredTask]:
        """
        Get all tasks for a specific list.

        Args:
            list_id: The ID of the list to get tasks for.

        Returns:
            List of tasks belonging to the specified list.

        """
        ...

    @abstractmethod
    def get_task(self, task_id: int) -> StoredTask | None:
        """
        Get a task by its ID.

        Args:
            task_id: The ID of the task to retrieve.

        Returns:
            The task if found, None otherwise.

        """
        ...

    @abstractmethod
    def create_task(  # noqa: PLR0913
        self,
        list_id: int,
        title: str,
        description: str | None,
        *,
        completed: bool = False,
        due_date: datetime | None = None,
        reschedule_period: str | None = None,
        reschedule_base: str | None = "completed",
        prohibited_months: list[int] | None = None,
        constraints: list[str] | None = None,
    ) -> StoredTask:
        """
        Create a new task.

        Args:
            list_id: The ID of the list this task belongs to.
            title: The title of the task.
            description: Optional description of the task.
            completed: Whether the task is completed.
            due_date: Optional due date for the task.
            reschedule_period: Optional reschedule period.
            reschedule_base: Base for rescheduling (completed or due).
            prohibited_months: List of months when task cannot be completed.
            constraints: List of constraint strings.

        Returns:
            The created task.

        """
        ...

    @abstractmethod
    def update_task(  # noqa: PLR0913
        self,
        task_id: int,
        *,
        list_id: int | None = None,
        title: str | None = None,
        description: str | None = None,
        completed: bool | None = None,
        due_date: datetime | None = None,
        reschedule_period: str | None = None,
        reschedule_base: str | None = None,
        completed_at: datetime | None = None,
        prohibited_months: list[int] | None = None,
        constraints: list[str] | None = None,
    ) -> StoredTask | None:
        """
        Update an existing task.

        Args:
            task_id: The ID of the task to update.
            list_id: New list ID for the task.
            title: New title for the task.
            description: New description for the task.
            completed: New completion status.
            due_date: New due date for the task.
            reschedule_period: New reschedule period.
            reschedule_base: New reschedule base.
            completed_at: New completion timestamp.
            prohibited_months: New prohibited months list.
            constraints: New constraints list.

        Returns:
            The updated task if found, None otherwise.

        """
        ...

    @abstractmethod
    def delete_task(self, task_id: int) -> bool:
        """
        Delete a task by its ID.

        Args:
            task_id: The ID of the task to delete.

        Returns:
            True if the task was deleted, False if not found.

        """
        ...

    @abstractmethod
    def list_lists(self) -> list[StoredList]:
        """
        Get all task lists.

        Returns:
            List of all task lists.

        """
        ...

    @abstractmethod
    def create_list(self, name: str) -> StoredList:
        """
        Create a new task list.

        Args:
            name: The name of the list.

        Returns:
            The created list.

        """
        ...

    @abstractmethod
    def get_list(self, list_id: int) -> StoredList | None:
        """
        Get a list by its ID.

        Args:
            list_id: The ID of the list to retrieve.

        Returns:
            The list if found, None otherwise.

        """
        ...

    @abstractmethod
    def rename_list(self, list_id: int, name: str) -> StoredList | None:
        """
        Rename a task list.

        Args:
            list_id: The ID of the list to rename.
            name: The new name for the list.

        Returns:
            The updated list if found, None otherwise.

        """
        ...

    @abstractmethod
    def delete_list(self, list_id: int) -> bool:
        """
        Delete a task list and all its tasks.

        Args:
            list_id: The ID of the list to delete.

        Returns:
            True if the list was deleted, False if not found.

        """
        ...


__all__ = ["Store"]


