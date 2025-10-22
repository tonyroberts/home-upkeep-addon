import React from 'react';
import { Task } from '../api/client';
import { Icon } from '@mdi/react';
import { mdiSleep, mdiPencil, mdiTrashCanOutline } from '@mdi/js';

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSnooze: () => void;
}

export function TaskItem({ task, onToggle, onDelete, onEdit, onSnooze }: TaskItemProps) {
  // Determine if snooze button should be shown (only for due/overdue tasks)
  const shouldShowSnooze = !task.completed && (!task.due_date || new Date(task.due_date) <= new Date());

  return (
    <div className="task-item">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={onToggle}
          className="checkbox mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
              )}
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {task.due_date && (
                  <span className="badge-orange">
                    Due {new Date(task.due_date).toLocaleDateString()}
                  </span>
                )}
                {task.completed_at && (
                  <span className="badge-green">
                    Completed {new Date(task.completed_at).toLocaleDateString()}
                  </span>
                )}
                {!task.completed && task.prohibited_months && task.prohibited_months.length > 0 && (() => {
                  const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ];

                  // Check if current month is prohibited
                  const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, we need 1-12
                  const isCurrentMonthProhibited = task.prohibited_months.includes(currentMonth);

                  // Check if next month is prohibited
                  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                  const isNextMonthProhibited = task.prohibited_months.includes(nextMonth);

                  // Check if task is due (no due date or due date is today or in the past)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
                  const isTaskDue = !task.due_date || new Date(task.due_date) <= today;

                  // Check if task due date is in the same month and year as today
                  const isDueDateInCurrentMonth = task.due_date && (() => {
                    const dueDate = new Date(task.due_date);
                    const currentDate = new Date();
                    return dueDate.getMonth() === currentDate.getMonth() &&
                           dueDate.getFullYear() === currentDate.getFullYear();
                  })();

                  // Check if due date month is prohibited (for upcoming tasks)
                  let isDueDateMonthProhibited = false;
                  let dueDateMonthName = '';
                  if (task.due_date) {
                    const dueDate = new Date(task.due_date);
                    const dueDateMonth = dueDate.getMonth() + 1;
                    isDueDateMonthProhibited = task.prohibited_months.includes(dueDateMonth);
                    dueDateMonthName = monthNames[dueDateMonth - 1] || '';
                  }

                  if (isCurrentMonthProhibited && (isTaskDue || isDueDateInCurrentMonth)) {
                    const currentMonthName = monthNames[currentMonth - 1];
                    return (
                      <span className="badge-warning">
                        <span>⚠️</span>
                        Not allowed in {currentMonthName}
                      </span>
                    );
                  } else if (isNextMonthProhibited && (isTaskDue || isDueDateInCurrentMonth)) {
                    const nextMonthName = monthNames[nextMonth - 1];
                    return (
                      <span className="badge-warning">
                        <span>⚠️</span>
                        Do before {nextMonthName}
                      </span>
                    );
                  } else if (isDueDateMonthProhibited) {
                    return (
                      <span className="badge-warning">
                        <span>⚠️</span>
                        Not allowed in {dueDateMonthName}
                      </span>
                    );
                  }
                  return null;
                })()}
                {task.constraints && task.constraints.length > 0 &&
                  [...task.constraints].sort().map((constraint, index) => (
                    <span key={index} className="badge-warning">
                      <span>⚠️</span>
                      {constraint}
                    </span>
                  ))
                }
                {task.reschedule_period && (
                  <span className="badge-info">
                    <span>⟳</span>
                    {task.reschedule_period}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {shouldShowSnooze && (
            <button
              onClick={onSnooze}
              aria-label={`Snooze ${task.title}`}
              className="icon-button"
              title="Snooze task"
            >
              <Icon path={mdiSleep} size={1} />
            </button>
          )}
          <button
            onClick={onEdit}
            aria-label={`Edit ${task.title}`}
            className="icon-button"
          >
            <Icon path={mdiPencil} size={1} />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${task.title}`}
            className="icon-button-danger"
          >
            <Icon path={mdiTrashCanOutline} size={1} />
          </button>
        </div>
      </div>
    </div>
  );
}
