"""FastAPI application for the Home Upkeep task management system."""

from __future__ import annotations

import json
import logging
import os
from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    Task,
    TaskCreate,
    TaskList,
    TaskListCreate,
    TaskSnooze,
    TaskUpdate,
    TaskUpdateResponse,
)
from .storage import FileStore, MemoryStore

storage_path = os.getenv("UPKEEP_STORAGE_PATH")
log_level = os.getenv("UPKEEP_LOG_LEVEL", "info")

# Configure logging
logging.basicConfig(level=getattr(logging, log_level.upper()))
logger = logging.getLogger(__name__)

if storage_path:
    logger.info("Using FileStore with storage path: %s", storage_path)
    storage = FileStore(storage_path)
else:
    logger.info("Using MemoryStore (no storage path set)")
    storage = MemoryStore()

class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self) -> None:
        """Initialize the connection manager."""
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: The WebSocket connection to accept.

        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            "WebSocket connected. Total connections: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """
        Remove a WebSocket connection.

        Args:
            websocket: The WebSocket connection to remove.

        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            "WebSocket disconnected. Total connections: %d",
            len(self.active_connections),
        )

    async def broadcast(self, message: dict[str, Any]) -> None:
        """
        Broadcast a message to all connected WebSocket clients.

        Args:
            message: The message to broadcast.

        """
        if not self.active_connections:
            return
        # Use Pydantic's JSON serialization to handle datetime objects properly
        message_str = json.dumps(message, default=str, ensure_ascii=False)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except (ConnectionError, RuntimeError) as e:
                logger.warning("Failed to send message to WebSocket: %s", e)
                disconnected.append(connection)

        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

manager = ConnectionManager()

def _find_first_non_prohibited_month(
    start_date: date, prohibited_months: list[int]
) -> date:
    """
    Find the first day of the next month that is not prohibited.

    If the start_date month is not prohibited, return the first day of that month.
    Otherwise, roll forward to the first day of the next non-prohibited month.
    """
    if not prohibited_months:
        return start_date

    current_year = start_date.year
    current_month = start_date.month

    # If current month is not prohibited, return first day of current month
    if current_month not in prohibited_months:
        return start_date.replace(day=1)

    # Find next non-prohibited month
    max_months = 12
    for _ in range(max_months):
        current_month += 1
        if current_month > max_months:
            current_month = 1
            current_year += 1

        if current_month not in prohibited_months:
            return date(current_year, current_month, 1)

    # Fallback: if all months are prohibited, return the original date
    return start_date

def _calculate_next_due_date(
    base_date: date,
    reschedule_period: str,
    prohibited_months: list[int] | None = None,
) -> date:
    """
    Calculate the next due date for a rescheduled task.

    Args:
        base_date: The base date to calculate from.
        reschedule_period: The reschedule period (e.g., "5d", "1w", "1m").
        prohibited_months: List of prohibited months.

    Returns:
        The calculated next due date.

    """
    # Parse reschedule_period like "5d", "1w", "1m"
    amount = int(reschedule_period[:-1])
    unit = reschedule_period[-1]

    next_due = base_date

    if unit == "d":
        next_due = base_date + timedelta(days=amount)
    elif unit == "w":
        next_due = base_date + timedelta(weeks=amount)
    elif unit == "m":
        # Month addition: add months keeping day if possible,
        # fallback to last day of next month
        year = base_date.year
        month = base_date.month + amount
        day = base_date.day
        year += (month - 1) // 12
        month = ((month - 1) % 12) + 1
        # clamp day to month length
        last_day = monthrange(year, month)[1]
        day = min(day, last_day)
        next_due = base_date.replace(year=year, month=month, day=day)

    # Check if the rescheduled date falls in a prohibited month and adjust if needed
    if prohibited_months and next_due.month in prohibited_months:
        next_due = _find_first_non_prohibited_month(next_due, prohibited_months)

    return next_due

app = FastAPI(title="Upkeep", version="0.1.0")

# Allow frontend dev server by default; adjust as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Handle WebSocket connections for real-time updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive by waiting for messages
            data = await websocket.receive_text()
            # Echo back for ping/pong
            await websocket.send_text(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/tasks", response_model=list[Task])
def list_tasks(list_id: int) -> list[Task]:
    """
    Get all tasks for a specific list.

    Args:
        list_id: The ID of the list to get tasks for.

    Returns:
        List of tasks in the specified list.

    """
    tasks = storage.list_tasks(list_id=list_id)
    return [Task.model_validate(task.model_dump()) for task in tasks]

@app.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate) -> Task:
    """
    Create a new task.

    Args:
        payload: The task creation data.

    Returns:
        The created task.

    """
    task = storage.create_task(
        list_id=payload.list_id,
        title=payload.title,
        description=payload.description,
        completed=payload.completed,
        due_date=payload.due_date,
        reschedule_period=payload.reschedule_period,
        reschedule_base=payload.reschedule_base,
        prohibited_months=payload.prohibited_months,
        constraints=payload.constraints,
    )
    task_data = Task.model_validate(task.model_dump())

    # Broadcast task creation
    await manager.broadcast({
        "type": "task_created",
        "list_id": payload.list_id,
        "task": task_data.model_dump()
    })

    return task_data

@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: int) -> Task:
    """
    Get a specific task by ID.

    Args:
        task_id: The ID of the task to retrieve.

    Returns:
        The requested task.

    Raises:
        HTTPException: If the task is not found.

    """
    task = storage.get_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return Task.model_validate(task.model_dump())

@app.patch("/tasks/{task_id}", response_model=TaskUpdateResponse)
async def update_task(task_id: int, payload: TaskUpdate) -> TaskUpdateResponse:
    """
    Update an existing task.

    Args:
        task_id: The ID of the task to update.
        payload: The task update data.

    Returns:
        The updated task and any created follow-up task.

    Raises:
        HTTPException: If the task is not found.

    """
    task = storage.update_task(
        task_id,
        list_id=payload.list_id,
        title=payload.title,
        description=payload.description,
        completed=payload.completed,
        due_date=payload.due_date,
        reschedule_period=payload.reschedule_period,
        reschedule_base=payload.reschedule_base,
        completed_at=payload.completed_at,
        prohibited_months=payload.prohibited_months,
        constraints=payload.constraints,
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    created_task = None
    # If task is now completed and has reschedule interval, create a follow-up
    if task.completed and task.reschedule_period:
        # Calculate next due date using either the due date or completed date.
        # The updated_at date from the request is used by preference as that
        # should be in the timezone of the client.
        base_date = (
            task.due_date
            if task.reschedule_base == "due"
            else (
                payload.updated_at.date()
                if payload.updated_at
                else (
                    task.completed_at.date()
                    if task.completed_at
                    else None
                )
            )
        )
        base_date = base_date or datetime.now(UTC).astimezone().date()
        next_due = _calculate_next_due_date(
            base_date, task.reschedule_period, task.prohibited_months
        )

        # Create rescheduled task using the same logic as the REST endpoint
        reschedule_payload = TaskCreate(
            list_id=task.list_id,
            title=task.title,
            description=task.description,
            completed=False,
            due_date=next_due.isoformat(),
            reschedule_period=task.reschedule_period,
            reschedule_base=task.reschedule_base,
            prohibited_months=task.prohibited_months,
            constraints=task.constraints,
        )
        created_task = await create_task(reschedule_payload)

    response = TaskUpdateResponse(
        task=Task.model_validate(task.model_dump()),
        created_task=(
            Task.model_validate(created_task.model_dump())
            if created_task
            else None
        ),
    )

    # Broadcast task update
    await manager.broadcast({
        "type": "task_updated",
        "list_id": task.list_id,
        "task": response.task.model_dump(),
        "created_task": (
            response.created_task.model_dump()
            if response.created_task
            else None
        )
    })

    return response

# Lists endpoints
@app.get("/lists", response_model=list[TaskList])
def list_lists() -> list[TaskList]:
    """
    Get all task lists.

    Returns:
        List of all task lists.

    """
    return [
        TaskList.model_validate(list_item.model_dump())
        for list_item in storage.list_lists()
    ]

@app.post("/lists", response_model=TaskList, status_code=status.HTTP_201_CREATED)
async def create_list(payload: TaskListCreate) -> TaskList:
    """
    Create a new task list.

    Args:
        payload: The list creation data.

    Returns:
        The created task list.

    """
    lst = storage.create_list(name=payload.name)
    list_data = TaskList.model_validate(lst.model_dump())

    # Broadcast list creation
    await manager.broadcast({
        "type": "list_created",
        "list": list_data.model_dump()
    })

    return list_data

@app.get("/lists/{list_id}", response_model=TaskList)
def get_list(list_id: int) -> TaskList:
    """
    Get a specific task list by ID.

    Args:
        list_id: The ID of the list to retrieve.

    Returns:
        The requested task list.

    Raises:
        HTTPException: If the list is not found.

    """
    lst = storage.get_list(list_id)
    if lst is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="List not found"
        )
    return TaskList.model_validate(lst.model_dump())

@app.patch("/lists/{list_id}", response_model=TaskList)
async def rename_list(list_id: int, payload: TaskListCreate) -> TaskList:
    """
    Rename a task list.

    Args:
        list_id: The ID of the list to rename.
        payload: The new list name.

    Returns:
        The updated task list.

    Raises:
        HTTPException: If the list is not found.

    """
    lst = storage.rename_list(list_id, name=payload.name)
    if lst is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="List not found"
        )

    list_data = TaskList.model_validate(lst.model_dump())

    # Broadcast list update
    await manager.broadcast({
        "type": "list_updated",
        "list": list_data.model_dump()
    })

    return list_data

@app.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(list_id: int) -> None:
    """
    Delete a task list and all its tasks.

    Args:
        list_id: The ID of the list to delete.

    Raises:
        HTTPException: If the list is not found.

    """
    ok = storage.delete_list(list_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="List not found"
        )

    # Broadcast list deletion
    await manager.broadcast({
        "type": "list_deleted",
        "list_id": list_id
    })


@app.patch("/tasks/{task_id}/snooze", response_model=Task)
async def snooze_task(task_id: int, payload: TaskSnooze) -> Task:
    """
    Snooze a task by updating its due date.

    Args:
        task_id: The ID of the task to snooze.
        payload: The snooze configuration.

    Returns:
        The updated task.

    Raises:
        HTTPException: If the task is not found.

    """
    # Use updated_at as base date if provided, otherwise use current time
    base_date = (payload.updated_at if payload.updated_at else datetime.now(UTC).astimezone()).date()
    new_due_date = _calculate_next_due_date(base_date, payload.period)

    # Update the task with new due date
    task = storage.update_task(
        task_id,
        due_date=new_due_date,
    )
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    task_data = Task.model_validate(task.model_dump())

    # Broadcast task update
    await manager.broadcast({
        "type": "task_updated",
        "list_id": task.list_id,
        "task": task_data.model_dump()
    })

    return task_data

@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int) -> None:
    """
    Delete a task.

    Args:
        task_id: The ID of the task to delete.

    Raises:
        HTTPException: If the task is not found.

    """
    # Get task before deleting to know which list to broadcast to
    task = storage.get_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    ok = storage.delete_task(task_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    # Broadcast task deletion
    await manager.broadcast({
        "type": "task_deleted",
        "list_id": task.list_id,
        "task_id": task_id
    })

