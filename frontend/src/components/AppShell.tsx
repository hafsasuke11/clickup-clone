import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './AppSidebar';
import Topbar from './AppTopbar';
import SearchModal from './SearchModal';
import TaskDetailPanel from './TaskDetailPanel';
import CreateModal from './CreateTaskModal';
import InviteMemberModal from './InviteMemberModal';
import ToastContainer from './ToastNotifications';
import { useSession } from '@/utils/authGuards';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useTaskStore } from '@/store/taskStore';
import { useUiStore } from '@/store/uiStore';

export default function AppShell() {
  const { user } = useSession();
  const cancelAddAccount = useAuthStore((s) => s.cancelAddAccount);
  const { workspace, initialized: wsInitialized, fetchWorkspaces, reset: resetWorkspace } = useWorkspaceStore();
  const { initialized: tasksInitialized, fetchTasks, fetchProjects, reset: resetTasks } = useTaskStore();
  const { searchOpen, setSearchOpen, selectedTaskId, createModalOpen, inviteModalOpen } = useUiStore();

  // Reaching the app clears any pending "add another account" intent.
  useEffect(() => { cancelAddAccount(); }, [cancelAddAccount]);

  // Load (or reload) workspace data whenever the signed-in user changes — a
  // different account on the same browser must never see the previous one's data.
  const loadedForUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { loadedForUserId.current = null; return; }
    if (loadedForUserId.current === user.id) return;
    loadedForUserId.current = user.id;
    resetWorkspace();
    resetTasks();
    void fetchWorkspaces(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-fetch tasks/projects whenever the active workspace changes (including switching workspaces).
  useEffect(() => {
    if (!workspace) return;
    void fetchTasks(workspace.id);
    void fetchProjects(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  if (!wsInitialized || (workspace && !tasksInitialized)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {searchOpen && <SearchModal />}
      {selectedTaskId && <TaskDetailPanel />}
      {createModalOpen && <CreateModal />}
      {inviteModalOpen && <InviteMemberModal />}
      <ToastContainer />
    </div>
  );
}
