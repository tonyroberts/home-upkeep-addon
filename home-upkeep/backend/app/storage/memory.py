"""In-memory storage implementation for Home Upkeep application."""

from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from .models import StoredList, StoredTask
from .store import Store


class MemoryStore(Store):
    """In-memory storage implementation using dictionaries."""

    def __init__(self) -> None:
        """Initialize memory store with empty dictionaries."""
        self._tasks: dict[int, StoredTask] = {}
        self._lists: dict[int, StoredList] = {}
        self._next_task_id: int = 1
        self._next_list_id: int = 1
        self._lock = Lock()

    # Task methods
    def list_tasks(self, list_id: int) -> list[StoredTask]:
        """
        Get all tasks for a specific list.

        Args:
            list_id: The ID of the list to get tasks for.

        Returns:
            List of tasks belonging to the specified list.

        """
        return [t for t in self._tasks.values() if t.list_id == list_id]

    def get_task(self, task_id: int) -> StoredTask | None:
        """
        Get a task by its ID.

        Args:
            task_id: The ID of the task to retrieve.

        Returns:
            The task if found, None otherwise.

        """
        return self._tasks.get(task_id)

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
        now = datetime.now(UTC)
        with self._lock:
            task_id = self._next_task_id
            self._next_task_id += 1
            task = StoredTask(
                id=task_id,
                list_id=list_id,
                title=title,
                description=description,
                completed=completed,
                due_date=due_date,
                reschedule_period=reschedule_period,
                reschedule_base=reschedule_base,
                completed_at=None,
                created_at=now,
                updated_at=now,
                prohibited_months=prohibited_months or [],
                constraints=constraints or [],
            )
            self._tasks[task_id] = task
            return task

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
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            if list_id is not None:
                task.list_id = list_id
            if title is not None:
                task.title = title
            if description is not None:
                task.description = description
            if completed is not None:
                task.completed = completed
                task.completed_at = datetime.now(UTC) if completed else None
            if due_date is not None:
                task.due_date = due_date
            if reschedule_period is not None:
                task.reschedule_period = reschedule_period
            if reschedule_base is not None:
                task.reschedule_base = reschedule_base
            if completed_at is not None:
                task.completed_at = completed_at
            if prohibited_months is not None:
                task.prohibited_months = prohibited_months
            if constraints is not None:
                task.constraints = constraints
            task.updated_at = datetime.now(UTC)
            return task

    def delete_task(self, task_id: int) -> bool:
        """
        Delete a task by its ID.

        Args:
            task_id: The ID of the task to delete.

        Returns:
            True if the task was deleted, False if not found.

        """
        with self._lock:
            return self._tasks.pop(task_id, None) is not None

    # Lists methods
    def list_lists(self) -> list[StoredList]:
        """
        Get all task lists.

        Returns:
            List of all task lists.

        """
        return list(self._lists.values())

    def create_list(self, name: str) -> StoredList:
        """
        Create a new task list.

        Args:
            name: The name of the list.

        Returns:
            The created list.

        """
        now = datetime.now(UTC)
        with self._lock:
            list_id = self._next_list_id
            self._next_list_id += 1
            lst = StoredList(id=list_id, name=name, created_at=now, updated_at=now)
            self._lists[list_id] = lst
            return lst

    def get_list(self, list_id: int) -> StoredList | None:
        """
        Get a list by its ID.

        Args:
            list_id: The ID of the list to retrieve.

        Returns:
            The list if found, None otherwise.

        """
        return self._lists.get(list_id)

    def rename_list(self, list_id: int, name: str) -> StoredList | None:
        """
        Rename a task list.

        Args:
            list_id: The ID of the list to rename.
            name: The new name for the list.

        Returns:
            The updated list if found, None otherwise.

        """
        with self._lock:
            lst = self._lists.get(list_id)
            if lst is None:
                return None
            lst.name = name
            lst.updated_at = datetime.now(UTC)
            return lst

    def delete_list(self, list_id: int) -> bool:
        """
        Delete a task list and all its tasks.

        Args:
            list_id: The ID of the list to delete.

        Returns:
            True if the list was deleted, False if not found.

        """
        with self._lock:
            if list_id in self._lists:
                # delete tasks belonging to the list as well
                self._tasks = {
                    tid: t for tid, t in self._tasks.items() if t.list_id != list_id
                }
                del self._lists[list_id]
                return True
            return False


