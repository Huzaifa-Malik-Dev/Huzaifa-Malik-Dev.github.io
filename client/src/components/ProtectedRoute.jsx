import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '../context/AuthContext';

// Gates a route by login, and optionally by module view-access (server-resolved list on user.modules).
// Server enforces the real check on every request — this only avoids showing a screen the API will 403 on.
export default function ProtectedRoute({ module }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (module && !user.modules.includes(module)) return <Navigate to="/" replace />;

  return <Outlet />;
}
