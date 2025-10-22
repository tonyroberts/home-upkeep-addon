import React, { useState } from 'react';
import { TaskCreate } from '../api/client';

interface TaskFormProps {
  onSubmit: (data: TaskCreate) => Promise<void>;
  listId: number;
  onCancel?: () => void;
}

export function TaskForm({ onSubmit, listId, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [reschedPeriod, setReschedPeriod] = useState<string>('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data: TaskCreate = {
          list_id: listId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          reschedule_period: reschedPeriod || undefined,
        };
        if (!data.title) return;
        onSubmit(data).then(() => {
          setTitle('');
          setDescription('');
          setDueDate('');
          setReschedPeriod('');
        }).catch(console.error);
      }}
      className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5 dark:border-gray-700 dark:bg-gray-800"
    >
      <input
        className="input-field"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input-field"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className="input-field"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label="Due date"
      />
      <input
        className="input-field"
        placeholder="Reschedule (e.g. 5d, 1w, 1m)"
        value={reschedPeriod}
        onChange={(e) => setReschedPeriod(e.target.value)}
        aria-label="Reschedule period"
      />
      <div className="flex items-center justify-end gap-2 lg:block">
        {onCancel && (
          <button
            type="button"
            className="btn-secondary md:hidden"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary w-full">Add Task</button>
      </div>
    </form>
  );
}
