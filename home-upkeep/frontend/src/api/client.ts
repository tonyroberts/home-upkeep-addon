import { DateTime } from 'luxon';

export type Task = {
  id: number;
  list_id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  due_date?: string | null;
  reschedule_period?: string | null;
  reschedule_base?: 'completed' | 'due' | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  prohibited_months: number[];
  constraints: string[];
};

export type TaskCreate = {
  list_id: number;
  title: string;
  description?: string | null;
  completed?: boolean;
  due_date?: string | null;
  reschedule_period?: string | null;
  reschedule_base?: 'completed' | 'due' | null;
  prohibited_months?: number[];
  constraints?: string[];
};

export type TaskUpdate = Partial<Pick<Task, 'title' | 'description' | 'completed' | 'due_date' | 'reschedule_period' | 'reschedule_base' | 'updated_at' | 'completed_at' | 'prohibited_months' | 'constraints'>>;

export type TaskSnooze = {
  period: string;
  updated_at?: string | null;
};

export type TaskUpdateResponse = {
  task: Task;
  created_task?: Task | null;
};

export type TaskList = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type TaskListCreate = {
  name: string;
};

export type WebSocketMessage = {
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'list_created' | 'list_updated' | 'list_deleted';
  list_id?: number;
  task?: Task;
  created_task?: Task | null;
  task_id?: number;
  list?: TaskList;
};

const BASE_URL = './api';
const WS_URL = (() => {
  // Use API-prefixed WS path so ingress/reverse proxy routes it with the backend
  const url = new URL('./api/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
})();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private listeners: Set<(message: WebSocketMessage) => void> = new Set();
  private isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const parsedData = JSON.parse(event.data) as unknown;
          if (this.isWebSocketMessage(parsedData)) {
            this.listeners.forEach(listener => listener(parsedData));
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnecting = false;
      this.ws = null;

      // Reconnect after 3 seconds
      if (!this.reconnectTimeout) {
        this.reconnectTimeout = window.setTimeout(() => {
          this.connect();
        }, 3000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  addListener(listener: (message: WebSocketMessage) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (message: WebSocketMessage) => void) {
    this.listeners.delete(listener);
  }

  private isWebSocketMessage(data: unknown): data is WebSocketMessage {
    return (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      typeof (data as { type: unknown }).type === 'string' &&
      ['task_created', 'task_updated', 'task_deleted', 'list_created', 'list_updated', 'list_deleted'].includes(
        (data as { type: string }).type
      )
    );
  }

  // Send ping to keep connection alive
  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('ping');
    }
  }
}

export const wsManager = new WebSocketManager();

export const api = {
  listTasks(listId?: number): Promise<Task[]> {
    const qs = listId != null ? `?list_id=${encodeURIComponent(String(listId))}` : '';
    return request<Task[]>(`/tasks${qs}`);
  },
  createTask(data: TaskCreate): Promise<Task> {
    return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) });
  },
  getTask(id: number): Promise<Task> {
    return request<Task>(`/tasks/${id}`);
  },
  updateTask(id: number, data: TaskUpdate): Promise<TaskUpdateResponse> {
    const updateData = {
      ...data,
      // Use local timezone for updated_at timestamp in ISO format
      updated_at: data.updated_at ?? DateTime.now().toISO()
    };
    return request<TaskUpdateResponse>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updateData) });
  },
  deleteTask(id: number): Promise<void> {
    return request<void>(`/tasks/${id}`, { method: 'DELETE' });
  },
  snoozeTask(id: number, payload: TaskSnooze): Promise<Task> {
    const snoozeData = {
      ...payload,
      // Use local timezone for updated_at timestamp in ISO format
      updated_at: payload.updated_at ?? DateTime.now().toISO()
    };
    return request<Task>(`/tasks/${id}/snooze`, { method: 'PATCH', body: JSON.stringify(snoozeData) });
  },
  // Lists
  listLists(): Promise<TaskList[]> {
    return request<TaskList[]>('/lists');
  },
  createList(data: TaskListCreate): Promise<TaskList> {
    return request<TaskList>('/lists', { method: 'POST', body: JSON.stringify(data) });
  },
  renameList(id: number, data: TaskListCreate): Promise<TaskList> {
    return request<TaskList>(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteList(id: number): Promise<void> {
    return request<void>(`/lists/${id}`, { method: 'DELETE' });
  },
};


