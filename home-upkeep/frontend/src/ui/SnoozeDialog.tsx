import React, { useState } from 'react';

interface SnoozeDialogProps {
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (period: string) => Promise<void>;
}

export function SnoozeDialog({ taskTitle, isOpen, onClose, onSnooze }: SnoozeDialogProps) {
  const [period, setPeriod] = useState('');

  if (!isOpen) return null;

  const handleSnooze = async () => {
    if (period.trim()) {
      await onSnooze(period.trim());
      setPeriod('');
      onClose();
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      await handleSnooze();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snooze-task-title"
      className="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-content">
          <h2 id="snooze-task-title" className="dialog-title">
            Snooze Task
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Snooze &quot;{taskTitle}&quot; for how long?
          </p>
          <div className="mb-6">
            <label className="block">
              <span className="dialog-label">Snooze period</span>
              <input
                className="input-field"
                placeholder="e.g. 1d, 2w, 1m"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e).catch(console.error)}
                autoFocus
              />
              <p className="dialog-help-text">
                Use d for days, w for weeks, m for months (e.g. 1d, 2w, 1m)
              </p>
            </label>
          </div>
          <div className="dialog-actions-no-margin">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => handleSnooze().catch(console.error)}
              disabled={!period.trim()}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Snooze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
