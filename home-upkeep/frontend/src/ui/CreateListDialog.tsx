import React from 'react';

interface CreateListDialogProps {
  isOpen: boolean;
  listName: string;
  onListNameChange: (name: string) => void;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function CreateListDialog({
  isOpen,
  listName,
  onListNameChange,
  onClose,
  onSave
}: CreateListDialogProps) {
  if (!isOpen) return null;

  const handleSave = async () => {
    const name = listName.trim();
    if (!name) return;
    await onSave(name);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-list-title"
      className="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-content">
          <h2 id="new-list-title" className="dialog-title">Create New List</h2>
          <div className="form-section">
            <label className="block">
              <span className="dialog-label">Name</span>
              <input
                className="input-field"
                value={listName}
                onChange={(e) => onListNameChange(e.target.value)}
                placeholder="List name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave().catch(console.error);
                  }
                }}
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
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
