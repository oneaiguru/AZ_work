import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RoundsPage } from './pages/RoundsPage';
import { RoundDetailPage } from './pages/RoundDetailPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/rounds" replace /> : <Navigate to="/login" replace />}
      />
      <Route path="/rounds" element={<RoundsPage />} />
      <Route path="/rounds/:id" element={<RoundDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
