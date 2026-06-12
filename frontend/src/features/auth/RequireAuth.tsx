import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';

/**
 * Route guard for the whole authenticated app. If there's no token in the
 * auth slice we redirect to /login, remembering where the user was headed so
 * the login page can send them back after a successful sign-in.
 */
export function RequireAuth() {
  const token = useAppSelector((s) => s.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
