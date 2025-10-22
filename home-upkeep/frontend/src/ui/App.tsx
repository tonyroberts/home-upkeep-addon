import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, wsManager, Task, TaskCreate, TaskUpdate, TaskList, TaskListCreate, WebSocketMessage } from '../api/client';
import { TaskLists } from './TaskLists';
import { TaskItem } from './TaskItem';
import { TaskForm } from './TaskForm';
import { EditListDialog } from './EditListDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { CreateListDialog } from './CreateListDialog';
import { SnoozeDialog } from './SnoozeDialog';

function useTasks(selectedListId: number | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (selectedListId === undefined) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.listTasks(selectedListId);
      setTasks(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedListId]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [selectedListId, refresh]);

  // WebSocket message handling
  useEffect(() => {
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      if (message.list_id !== selectedListId) {
        return; // Only handle messages for the currently selected list
      }

      switch (message.type) {
        case 'task_created':
          if (message.task) {
            setTasks(prev => [message.task!, ...prev]);
          }
          break;
        case 'task_updated':
          if (message.task) {
            setTasks(prev => {
              return prev.map(t => t.id === message.task!.id ? message.task! : t);
            });
          }
          break;
        case 'task_deleted':
          if (message.task_id) {
            setTasks(prev => prev.filter(t => t.id !== message.task_id));
          }
          break;
      }
    };

    wsManager.addListener(handleWebSocketMessage);

    return () => {
      wsManager.removeListener(handleWebSocketMessage);
    };
  }, [selectedListId]);

  const actions = useMemo(
    () => ({
      refresh,
      async create(input: TaskCreate) {
        await api.createTask(input);
        // WebSocket will handle updating the UI
      },
      async update(id: number, input: TaskUpdate) {
        await api.updateTask(id, input);
        // WebSocket will handle updating the UI
      },
      async remove(id: number) {
        await api.deleteTask(id);
        // WebSocket will handle updating the UI
      },
    }), [refresh],
  );

  return { tasks, loading, error, ...actions } as const;
}

function useLists() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listLists();
      setLists(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  // WebSocket message handling for lists
  useEffect(() => {
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      switch (message.type) {
        case 'list_created':
          if (message.list) {
            setLists(prev => [...prev, message.list!]);
          }
          break;
        case 'list_updated':
          if (message.list) {
            setLists(prev => prev.map(l => l.id === message.list!.id ? message.list! : l));
          }
          break;
        case 'list_deleted':
          if (message.list_id) {
            setLists(prev => prev.filter(l => l.id !== message.list_id));
          }
          break;
      }
    };

    wsManager.addListener(handleWebSocketMessage);

    return () => {
      wsManager.removeListener(handleWebSocketMessage);
    };
  }, []);

  const actions = useMemo(
    () => ({
      refresh,
      async create(input: TaskListCreate): Promise<TaskList> {
        const created = await api.createList(input);
        return created;
      },
      async update(id: number, input: TaskListCreate) {
        await api.renameList(id, input);
        // WebSocket will handle updating the UI
      },
      async remove(id: number) {
        await api.deleteList(id);
        // WebSocket will handle updating the UI
      },
    }), [],
  );

  return { lists, loading, error, ...actions } as const;
}

export function App() {
  const { lists, create: createList, update: updateList, remove: removeList } = useLists();
  const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);
  const { tasks, loading, error, create, update, remove } = useTasks(selectedListId);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCreateFormMobile, setShowCreateFormMobile] = useState(false);
  const selectedList = lists.find((l) => l.id === selectedListId);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editCompleted, setEditCompleted] = useState<boolean>(false);
  const [editCompletedAt, setEditCompletedAt] = useState<string>('');
  const [editReschedPeriod, setEditReschedPeriod] = useState<string>('');
  const [editReschedBase, setEditReschedBase] = useState<'completed' | 'due'>('completed');
  const [editProhibitedMonths, setEditProhibitedMonths] = useState<number[]>([]);
  const [editConstraints, setEditConstraints] = useState<string[]>([]);
  const [snoozingTask, setSnoozingTask] = useState<Task | null>(null);

  function openEditor(task: Task) {
    setEditing(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : '');
    setEditCompleted(task.completed);
    setEditCompletedAt(task.completed_at ? new Date(task.completed_at).toISOString().slice(0, 16) : '');
    setEditReschedPeriod(task.reschedule_period ?? '');
    setEditReschedBase((task.reschedule_base as 'completed' | 'due') ?? 'completed');
    setEditProhibitedMonths(task.prohibited_months || []);
    setEditConstraints(task.constraints || []);
  }

  function closeEditor() {
    setEditing(null);
  }

  const handleSnooze = async (period: string) => {
    if (!snoozingTask) return;
    try {
      await api.snoozeTask(snoozingTask.id, { period });
      // WebSocket will handle updating the UI
    } catch (error) {
      console.error('Failed to snooze task:', error);
    }
  };

  // Set initial selected list when lists are loaded
  useEffect(() => {
    if (lists.length && selectedListId == null) {
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setSelectedListId(lists[0]?.id);
      }, 0);
    }
  }, [lists, selectedListId]);

  // WebSocket connection setup
  useEffect(() => {
    wsManager.connect();

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      wsManager.ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <TaskLists
            lists={lists}
            selectedListId={selectedListId}
            onSelectList={setSelectedListId}
            onCreateList={() => setCreatingList(true)}
            onEditList={(list) => {
              setEditingList(list);
              setEditListName(list.name);
            }}
            onDeleteList={(id) => {
              const list = lists.find(l => l.id === id);
              if (!list) return;
              const ok = confirm(`Delete list "${list.name}"? This removes its tasks too.`);
              if (!ok) return;
              removeList(id).then(() => {
                setSelectedListId((curr) => {
                  if (curr === id) {
                    const remaining = lists.filter((x) => x.id !== id);
                    return remaining.length ? remaining[0]?.id : undefined;
                  }
                  return curr;
                });
              }).catch(console.error);
            }}
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
          <main className="lg:col-span-3">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedList ? selectedList.name : 'Home Upkeep'}
                  </h1>
                  { selectedList ? null :
                      <p className="text-gray-600 dark:text-gray-400">
                        Select a list to get started
                      </p>
                  }
                </div>
                {/* Mobile header - burger button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="rounded p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  aria-label="Toggle menu"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {selectedListId != null && (
              <div className="mb-6">
                {/* Mobile: collapsed by default */}
                <div className="lg:hidden">
                  {!showCreateFormMobile ? (
                    <button
                      className="btn-primary w-full"
                      onClick={() => setShowCreateFormMobile(true)}
                    >
                      Add Task
                    </button>
                  ) : (
                    <div className="task-list">
                      <TaskForm
                        onSubmit={async (payload) => {
                          await create(payload);
                          setShowCreateFormMobile(false);
                        }}
                        listId={selectedListId}
                        onCancel={() => setShowCreateFormMobile(false)}
                      />
                    </div>
                  )}
                </div>
                {/* Desktop: always visible */}
                <div className="hidden lg:block">
                  <TaskForm onSubmit={create} listId={selectedListId} />
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading…</span>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 dark:text-red-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                    <div className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {selectedListId == null ? null : (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isDueOrOverdue = (t: Task) => {
                if (t.completed) return false;
                if (!t.due_date) return true; // include tasks with no due date
                const d = new Date(t.due_date);
                d.setHours(0, 0, 0, 0);
                return d.getTime() <= today.getTime();
              };
              const startOfDay = (d: Date) => {
                const c = new Date(d);
                c.setHours(0, 0, 0, 0);
                return c.getTime();
              };
              const due = tasks
                .filter(isDueOrOverdue)
                .sort((a, b) => {
                  const ad = a.due_date ? startOfDay(new Date(a.due_date)) : Infinity;
                  const bd = b.due_date ? startOfDay(new Date(b.due_date)) : Infinity;
                  if (ad !== bd) return ad - bd; // by due date (day) ascending; no-due last
                  const ac = new Date(a.created_at).getTime();
                  const bc = new Date(b.created_at).getTime();
                  return ac - bc; // tie-break by created time ascending
                });
              const upcoming = tasks
                .filter((t) => !t.completed && t.due_date && startOfDay(new Date(t.due_date)) > today.getTime())
                .sort((a, b) => {
                  const ad = startOfDay(new Date(a.due_date!));
                  const bd = startOfDay(new Date(b.due_date!));
                  if (ad !== bd) return ad - bd;
                  const ac = new Date(a.created_at).getTime();
                  const bc = new Date(b.created_at).getTime();
                  return ac - bc;
                });
              const completed = tasks
                .filter((t) => t.completed)
                .sort((a, b) => {
                  const at = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                  const bt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                  return bt - at; // descending
                });
              return (
                <div className="space-y-8">
                  <section className="mt-6">
                    <div className="section-header">
                      <h2 className="section-title">Due / Overdue</h2>
                      <span className="count-due">
                        {due.length}
                      </span>
                    </div>
                    <div className="task-list">
                      {due.map((t) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          onToggle={() => { update(t.id, { completed: !t.completed }).catch(console.error); }}
                          onDelete={() => { remove(t.id).catch(console.error); }}
                          onEdit={() => openEditor(t)}
                          onSnooze={() => setSnoozingTask(t)}
                        />
                      ))}
                      {due.length === 0 && (
                        <div className="empty-state">
                          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="empty-state-text">Nothing due right now</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="section-header">
                      <h2 className="section-title">Upcoming</h2>
                      <span className="count-upcoming">
                        {upcoming.length}
                      </span>
                    </div>
                    <div className="task-list">
                      {upcoming.map((t) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          onToggle={() => { update(t.id, { completed: !t.completed }).catch(console.error); }}
                          onDelete={() => { remove(t.id).catch(console.error); }}
                          onEdit={() => openEditor(t)}
                          onSnooze={() => setSnoozingTask(t)}
                        />
                      ))}
                      {upcoming.length === 0 && (
                        <div className="empty-state">
                          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="empty-state-text">No upcoming tasks</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="section-header">
                      <h2 className="section-title">Completed</h2>
                      <span className="count-completed">
                        {completed.length}
                      </span>
                    </div>
                    <div className="task-list">
                      {completed.map((t) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          onToggle={() => { update(t.id, { completed: !t.completed }).catch(console.error); }}
                          onDelete={() => { remove(t.id).catch(console.error); }}
                          onEdit={() => openEditor(t)}
                          onSnooze={() => setSnoozingTask(t)}
                        />
                      ))}
                      {completed.length === 0 && (
                        <div className="empty-state">
                          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="empty-state-text">No completed tasks yet</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              );
            })()}
          </main>
        </div>
      </div>

      <CreateListDialog
        isOpen={creatingList}
        listName={newListName}
        onListNameChange={setNewListName}
        onClose={() => setCreatingList(false)}
        onSave={async (name) => {
          const created = await createList({ name });
          setSelectedListId(created.id);
          setNewListName('');
          setCreatingList(false);
        }}
      />

      <EditTaskDialog
        task={editing}
        title={editTitle}
        description={editDescription}
        dueDate={editDueDate}
        completed={editCompleted}
        completedAt={editCompletedAt}
        reschedPeriod={editReschedPeriod}
        reschedBase={editReschedBase}
        prohibitedMonths={editProhibitedMonths}
        constraints={editConstraints}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onDueDateChange={setEditDueDate}
        onCompletedChange={setEditCompleted}
        onCompletedAtChange={setEditCompletedAt}
        onReschedPeriodChange={setEditReschedPeriod}
        onReschedBaseChange={setEditReschedBase}
        onProhibitedMonthsChange={setEditProhibitedMonths}
        onConstraintsChange={setEditConstraints}
        onClose={closeEditor}
        onSave={async (payload) => {
          if (!editing) return;
          await update(editing.id, payload);
          closeEditor();
        }}
      />

      <EditListDialog
        list={editingList}
        listName={editListName}
        onListNameChange={setEditListName}
        onClose={() => setEditingList(null)}
        onSave={async (name) => {
          if (!editingList) return;
          await updateList(editingList.id, { name });
          setEditingList(null);
        }}
      />

      <SnoozeDialog
        taskTitle={snoozingTask?.title || ''}
        isOpen={snoozingTask !== null}
        onClose={() => setSnoozingTask(null)}
        onSnooze={handleSnooze}
      />
    </div>
  );
}