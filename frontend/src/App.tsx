import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import InviteAcceptPage from '@/pages/InviteAcceptPage';
import AppShell from '@/components/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import ListPage from '@/pages/ListPage';
import TasksPage from '@/pages/TasksPage';
import KanbanPage from '@/pages/KanbanPage';
import ProjectsPage from '@/pages/ProjectsPage';
import CalendarPage from '@/pages/CalendarPage';
import UsersPage from '@/pages/UsersPage';
import ActivityPage from '@/pages/ActivityPage';
import ProfilePage from '@/pages/ProfilePage';
import { ProtectedRoute, GuestRoute } from '@/utils/authGuards';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<GuestRoute><AuthPage /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><AuthPage /></GuestRoute>} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<Navigate to="board" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="list" element={<ListPage />} />
          <Route path="board" element={<KanbanPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
