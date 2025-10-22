"""File-based storage implementation for Home Upkeep application."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

from .models import StoredList, StoredTask
from .store import Store

logger = logging.getLogger(__name__)


class FileStore(Store):
    """File-based storage implementation using JSON files."""

    SCHEMA_VERSION = 1

    def __init__(self, root_folder: str) -> None:
        """
        Initialize file store with the given root folder.

        Args:
            root_folder: Path to the directory where JSON files will be stored.

        """
        self._root = Path(root_folder)
        self._root.mkdir(parents=True, exist_ok=True)
        self._tasks: dict[int, StoredTask] = {}
        self._lists: dict[int, StoredList] = {}
        self._next_task_id: int = 1
        self._next_list_id: int = 1
        self._lock = Lock()
        self._load_all()

    def _file_for_list(self, list_id: int) -> Path:
        return self._root / f"list_{list_id}.json"

    def _write_list_file(self, list_id: int) -> None:
        lst = self._lists.get(list_id)
        if lst is None:
            # If the list is gone, remove file if present
            path = self._file_for_list(list_id)
            if path.exists():
                path.unlink()
            return
        tasks = self.list_tasks(list_id)
        doc = {
            "version": self.SCHEMA_VERSION,
            "list": lst.model_dump(mode="json"),
            "tasks": [t.model_dump(mode="json") for t in tasks],
        }
        tmp_path = self._file_for_list(list_id).with_suffix(".json.tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        tmp_path.replace(self._file_for_list(list_id))

    def _load_all(self) -> None:
        with self._lock:
            for path in sorted(self._root.glob("list_*.json")):
                try:
                    with path.open("r", encoding="utf-8") as f:
                        doc = json.load(f)
                    _version = int(doc.get("version", 1))
                    list_doc = doc.get("list") or {}
                    lst = StoredList.model_validate(list_doc)
                    self._lists[lst.id] = lst
                    tasks_doc = doc.get("tasks") or []
                    for td in tasks_doc:
                        task = StoredTask.model_validate(td)
                        self._tasks[task.id] = task
                except (json.JSONDecodeError, ValueError, KeyError) as e:
                    # Skip malformed files to avoid breaking startup
                    logger.warning("Skipping malformed file %s: %s", path, e)
                    continue
            if self._lists:
                self._next_list_id = max(self._lists.keys()) + 1
            if self._tasks:
                self._next_task_id = max(self._tasks.keys()) + 1

    # -------- Store Interface --------
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
            # ensure list exists
            if list_id not in self._lists:
                self._lists[list_id] = StoredList(
                    id=list_id,
                    name=f"List {list_id}",
                    created_at=now,
                    updated_at=now,
                )
            self._write_list_file(list_id)
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
        now = datetime.now(UTC)
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            old_list_id = task.list_id
            if list_id is not None:
                task.list_id = list_id
            if title is not None:
                task.title = title
            if description is not None:
                task.description = description
            if completed is not None:
                task.completed = completed
                task.completed_at = now if completed else None
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
            task.updated_at = now
            self._write_list_file(task.list_id)
            if old_list_id != task.list_id:
                self._write_list_file(old_list_id)
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
            task = self._tasks.pop(task_id, None)
            if task is None:
                return False
            self._write_list_file(task.list_id)
            return True

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
            self._write_list_file(list_id)
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
            self._write_list_file(list_id)
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
            if list_id not in self._lists:
                return False
            # remove tasks for the list
            self._tasks = {
                tid: t for tid, t in self._tasks.items() if t.list_id != list_id
            }
            del self._lists[list_id]
            # delete file on disk
            path = self._file_for_list(list_id)
            if path.exists():
                path.unlink()
            return True


