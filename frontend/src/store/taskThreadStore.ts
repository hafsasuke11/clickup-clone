import { create } from 'zustand';
import { apiClient, ApiError } from '@/utils/api';
import { useUiStore } from './uiStore';
import { useTaskStore, apiErrorMessage } from './taskStore';
import type { TaskAttachment, TaskComment } from '@/utils/types';

/** 5 MB — must match MAX_ATTACHMENT_BYTES on the server. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface ThreadState {
  comments: TaskComment[];
  attachments: TaskAttachment[];
  loaded: boolean;
  loading: boolean;
}

const emptyThread: ThreadState = { comments: [], attachments: [], loaded: false, loading: false };

interface TaskThreadStore {
  /** Keyed by task id. Only the tasks that have been opened are populated. */
  byTask: Record<string, ThreadState>;

  fetchThread: (workspaceId: string, taskId: string) => Promise<void>;
  addComment: (workspaceId: string, taskId: string, body: string) => Promise<void>;
  deleteComment: (workspaceId: string, taskId: string, commentId: string) => Promise<void>;
  uploadAttachment: (workspaceId: string, taskId: string, file: File) => Promise<void>;
  downloadAttachment: (workspaceId: string, taskId: string, attachmentId: string) => Promise<void>;
  deleteAttachment: (workspaceId: string, taskId: string, attachmentId: string) => Promise<void>;
  reset: () => void;
}

const patchThread = (
  set: (fn: (s: TaskThreadStore) => Partial<TaskThreadStore>) => void,
  taskId: string,
  patch: Partial<ThreadState>,
) =>
  set((s) => ({
    byTask: { ...s.byTask, [taskId]: { ...emptyThread, ...s.byTask[taskId], ...patch } },
  }));

/** Read a File as a base64 string (no `data:` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/** Trigger a browser download for a base64 payload without leaving the page. */
function saveBase64(name: string, mimeType: string, base64: string) {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf], { type: mimeType || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const useTaskThreadStore = create<TaskThreadStore>((set, get) => ({
  byTask: {},

  fetchThread: async (workspaceId, taskId) => {
    patchThread(set, taskId, { loading: true });
    try {
      const [{ comments }, { attachments }] = await Promise.all([
        apiClient.get<{ comments: TaskComment[] }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments`),
        apiClient.get<{ attachments: TaskAttachment[] }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/attachments`),
      ]);
      patchThread(set, taskId, { comments, attachments, loaded: true, loading: false });
    } catch (err) {
      patchThread(set, taskId, { loading: false, loaded: true });
      console.error('fetchThread error:', err);
    }
  },

  addComment: async (workspaceId, taskId, body) => {
    const text = body.trim();
    if (!text) return;
    try {
      const { comment } = await apiClient.post<{ comment: TaskComment }>(
        `/api/workspaces/${workspaceId}/tasks/${taskId}/comments`,
        { body: text },
      );
      patchThread(set, taskId, { comments: [...(get().byTask[taskId]?.comments ?? []), comment] });
      const ts = useTaskStore.getState();
      if (ts.taskActivityLoaded) void ts.fetchTaskActivity(workspaceId);
    } catch (err) {
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to post comment'), 'error');
      console.error('addComment error:', err);
    }
  },

  deleteComment: async (workspaceId, taskId, commentId) => {
    const prev = get().byTask[taskId]?.comments ?? [];
    patchThread(set, taskId, { comments: prev.filter((c) => c.id !== commentId) });
    try {
      await apiClient.del(`/api/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`);
    } catch (err) {
      patchThread(set, taskId, { comments: prev });
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to delete comment'), 'error');
      console.error('deleteComment error:', err);
    }
  },

  uploadAttachment: async (workspaceId, taskId, file) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      useUiStore.getState().addToast('That file is larger than the 5 MB limit.', 'error');
      return;
    }
    try {
      const data = await fileToBase64(file);
      const { attachment } = await apiClient.post<{ attachment: TaskAttachment }>(
        `/api/workspaces/${workspaceId}/tasks/${taskId}/attachments`,
        { name: file.name, mimeType: file.type, size: file.size, data },
      );
      patchThread(set, taskId, {
        attachments: [...(get().byTask[taskId]?.attachments ?? []), attachment],
      });
      const ts = useTaskStore.getState();
      if (ts.taskActivityLoaded) void ts.fetchTaskActivity(workspaceId);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to upload file';
      useUiStore.getState().addToast(msg, 'error');
      console.error('uploadAttachment error:', err);
    }
  },

  downloadAttachment: async (workspaceId, taskId, attachmentId) => {
    try {
      const { attachment } = await apiClient.get<{
        attachment: { name: string; mimeType: string; data: string };
      }>(`/api/workspaces/${workspaceId}/tasks/${taskId}/attachments/${attachmentId}/download`);
      saveBase64(attachment.name, attachment.mimeType, attachment.data);
    } catch (err) {
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to download file'), 'error');
      console.error('downloadAttachment error:', err);
    }
  },

  deleteAttachment: async (workspaceId, taskId, attachmentId) => {
    const prev = get().byTask[taskId]?.attachments ?? [];
    patchThread(set, taskId, { attachments: prev.filter((a) => a.id !== attachmentId) });
    try {
      await apiClient.del(`/api/workspaces/${workspaceId}/tasks/${taskId}/attachments/${attachmentId}`);
      const ts = useTaskStore.getState();
      if (ts.taskActivityLoaded) void ts.fetchTaskActivity(workspaceId);
    } catch (err) {
      patchThread(set, taskId, { attachments: prev });
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to delete file'), 'error');
      console.error('deleteAttachment error:', err);
    }
  },

  reset: () => set({ byTask: {} }),
}));
