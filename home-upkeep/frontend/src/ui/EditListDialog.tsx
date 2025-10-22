import React from 'react';
import { TaskList } from '../api/client';

interface EditListDialogProps {
  list: TaskList | null;
  listName: string;
  onListNameChange: (name: string) => void;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function EditListDialog({
  list,
  listName,
  onListNameChange,
  onClose,
  onSave
}: EditListDialogProps) {
  if (!list) return null;

  const handleSave = async () => {
    const name = listName.trim();
    if (!name) return;
    await onSave(name);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-list-title"
      className="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dialog-body">
        <div className="dialog-content">
          <h2 id="edit-list-title" className="dialog-title">Rename List</h2>
          <div className="form-section">
            <label className="block">
              <span className="dialog-label">Name</span>
              <input
                className="input-field"
                value={listName}
                onChange={(e) => onListNameChange(e.target.value)}
                autoFocus
              />
            </label>
          </div>
          <div className="dialog-actions">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
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
