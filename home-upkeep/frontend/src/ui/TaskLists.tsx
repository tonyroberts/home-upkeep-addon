import React from 'react';
import { TaskList } from '../api/client';
import { Icon } from '@mdi/react';
import { mdiTrashCanOutline, mdiPencil } from '@mdi/js';

interface TaskListsProps {
  lists: TaskList[];
  selectedListId: number | undefined;
  onSelectList: (id: number) => void;
  onCreateList: () => void;
  onEditList: (list: TaskList) => void;
  onDeleteList: (id: number) => void;
  isMobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function TaskLists({
  lists,
  selectedListId,
  onSelectList,
  onCreateList,
  onEditList,
  onDeleteList,
  isMobileMenuOpen,
  onMobileMenuToggle
}: TaskListsProps) {

  const handleListSelect = (id: number) => {
    onSelectList(id);
    // Only close mobile menu if it's currently open
    if (isMobileMenuOpen) {
      onMobileMenuToggle();
    }
  };

  const handleCreateList = () => {
    onCreateList();
    // Only close mobile menu if it's currently open
    if (isMobileMenuOpen) {
      onMobileMenuToggle();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileMenuToggle}
        />
      )}

      {/* Sidebar */}
      <aside className={`lg:col-span-1 ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-80' : 'hidden lg:block'}`}>
        <div className={`card h-full overflow-y-auto p-6 ${isMobileMenuOpen ? 'rounded-l-none lg:rounded-l-lg' : ''}`}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="dialog-title">Lists</h2>
            <button
              onClick={handleCreateList}
              className="btn-primary text-sm"
            >
              New List
            </button>
          </div>
          <nav>
            <ul className="space-y-2">
              {lists.map((l) => (
                <li key={l.id}>
                  <div className={`list-item ${selectedListId === l.id ? 'list-item-selected' : ''}`}>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleListSelect(l.id)}
                        className="flex-1 text-left font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                      >
                        {l.name}
                      </button>
                      <div className="ml-2 flex gap-1">
                        <button
                          aria-label={`Rename list ${l.name}`}
                          title="Rename list"
                          onClick={() => onEditList(l)}
                          className="icon-button"
                        >
                          <Icon path={mdiPencil} size={1} />
                        </button>
                        <button
                          aria-label={`Delete list ${l.name}`}
                          title="Delete list"
                          onClick={() => onDeleteList(l.id)}
                          className="icon-button-danger"
                        >
                          <Icon path={mdiTrashCanOutline} size={1} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {lists.length === 0 && (
                <li className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No lists yet</li>
              )}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
