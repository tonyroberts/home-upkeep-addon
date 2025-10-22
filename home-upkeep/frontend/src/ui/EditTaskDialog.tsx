import React from 'react';
import { Task, TaskUpdate } from '../api/client';

interface EditTaskDialogProps {
  task: Task | null;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  completedAt: string;
  reschedPeriod: string;
  reschedBase: 'completed' | 'due';
  prohibitedMonths: number[];
  constraints: string[];

  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onDueDateChange: (dueDate: string) => void;
  onCompletedChange: (completed: boolean) => void;
  onCompletedAtChange: (completedAt: string) => void;
  onReschedPeriodChange: (reschedPeriod: string) => void;
  onReschedBaseChange: (base: 'completed' | 'due') => void;
  onProhibitedMonthsChange: (months: number[]) => void;
  onConstraintsChange: (constraints: string[]) => void;
  onClose: () => void;
  onSave: (payload: TaskUpdate) => Promise<void>;
}

export function EditTaskDialog({
  task,
  title,
  description,
  dueDate,
  completed,
  completedAt,
  reschedPeriod,
  reschedBase,
  prohibitedMonths,
  constraints,
  onTitleChange,
  onDescriptionChange,
  onDueDateChange,
  onCompletedChange,
  onCompletedAtChange,
  onReschedPeriodChange,
  onReschedBaseChange,
  onProhibitedMonthsChange,
  onConstraintsChange,
  onClose,
  onSave
}: EditTaskDialogProps) {
  if (!task) return null;

  const handleSave = async () => {
    const payload: TaskUpdate = {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      completed: completed,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      reschedule_period: reschedPeriod || null,
      reschedule_base: reschedBase,
      completed_at: completedAt ? new Date(completedAt).toISOString() : null,
      prohibited_months: prohibitedMonths,
      constraints: constraints,
    };
    await onSave(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      className="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body-large">
        <div className="dialog-content">
          <h2 id="edit-task-title" className="dialog-title-large">Edit Task</h2>
          <div className="form-grid">
            <label className="block">
              <span className="dialog-label">Title</span>
              <input
                className="input-field"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="dialog-label">Description</span>
              <input
                className="input-field"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="dialog-label">Due date</span>
              <input
                className="input-field"
                type="date"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4">
            <div className="form-grid">
              <label className="block">
                <span className="dialog-label">Reschedule period</span>
                <input
                  className="input-field"
                  placeholder="e.g. 5d, 1w, 1m"
                  value={reschedPeriod}
                  onChange={(e) => onReschedPeriodChange(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="dialog-label">Reschedule from</span>
                <select
                  className="input-field"
                  value={reschedBase}
                  onChange={(e) => onReschedBaseChange(e.target.value as 'completed' | 'due')}
                >
                  <option value="completed">Completed date</option>
                  <option value="due">Due date</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <span className="dialog-label-inline">Prohibited Months</span>
              <p className="dialog-help-text">Toggle months when this task cannot be completed</p>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {[
                { num: 1, name: 'Jan' },
                { num: 2, name: 'Feb' },
                { num: 3, name: 'Mar' },
                { num: 4, name: 'Apr' },
                { num: 5, name: 'May' },
                { num: 6, name: 'Jun' },
                { num: 7, name: 'Jul' },
                { num: 8, name: 'Aug' },
                { num: 9, name: 'Sep' },
                { num: 10, name: 'Oct' },
                { num: 11, name: 'Nov' },
                { num: 12, name: 'Dec' },
              ].map(({ num, name }) => {
                const isProhibited = prohibitedMonths.includes(num);
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (isProhibited) {
                        onProhibitedMonthsChange(prohibitedMonths.filter(m => m !== num));
                      } else {
                        onProhibitedMonthsChange([...prohibitedMonths, num]);
                      }
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200 ${
                      isProhibited
                        ? 'border border-red-200 bg-red-100 text-red-800 hover:bg-red-200 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
                        : 'border border-green-200 bg-green-100 text-green-800 hover:bg-green-200 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200 dark:hover:bg-green-900/50'
                    }`}
                    title={isProhibited ? `Prohibited in ${name}` : `Allowed in ${name}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <span className="dialog-label-inline">Constraints</span>
              <p className="dialog-help-text">Add constraints for this task (press Enter or comma to add)</p>
            </div>
            <div className="space-y-3">
              <input
                className="input-field"
                placeholder="e.g. not raining, dry weather, weekend only"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const value = e.currentTarget.value.trim();
                    if (value && !constraints.includes(value)) {
                      onConstraintsChange([...constraints, value]);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              {constraints.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {constraints.map((constraint, index) => (
                    <span
                      key={index}
                      className="badge-info"
                    >
                      {constraint}
                      <button
                        type="button"
                        onClick={() => onConstraintsChange(constraints.filter((_, i) => i !== index))}
                        aria-label={`Remove constraint: ${constraint}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => onCompletedChange(e.target.checked)}
                className="checkbox"
              />
              <span className="dialog-label-inline">Completed</span>
            </label>
          </div>
          {completed && (
            <div className="mt-4">
              <label className="block">
                <span className="dialog-label">Completed at</span>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={completedAt}
                  onChange={(e) => onCompletedAtChange(e.target.value)}
                />
              </label>
            </div>
          )}
          <div className="dialog-actions">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => handleSave().catch(console.error)}
              className="btn-primary"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
