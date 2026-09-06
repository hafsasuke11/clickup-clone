import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function useSession() {
  const { user, loading, hydrated, rehydrateFromServer } = useAuthStore();

  useEffect(() => {
    if (!hydrated) void rehydrateFromServer();
  }, [hydrated, rehydrateFromServer]);

  return { user, loading: loading && !hydrated, isAuthenticated: !!user };
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useSession();
  const addingAccount = useAuthStore((s) => s.addingAccount);
  if (loading) return null;
  // While deliberately adding a second account, let the signed-in user see the
  // login/signup form instead of bouncing them back to the app.
  if (isAuthenticated && !addingAccount) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
