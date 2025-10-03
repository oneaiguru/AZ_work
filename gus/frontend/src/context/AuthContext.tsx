import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../api/client';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'player' | 'nikita';
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'guss_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(`${TOKEN_KEY}_user`);
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    setInitializing(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await axios.post('/api/login', { username, password }, { withCredentials: true });
    const { token, user: authUser } = response.data;

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(`${TOKEN_KEY}_user`, JSON.stringify(authUser));
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    setUser(authUser);
    navigate('/rounds');
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(`${TOKEN_KEY}_user`);
    delete axios.defaults.headers.common.Authorization;
    delete api.defaults.headers.common.Authorization;
    setUser(null);
    if (location.pathname !== '/login') {
      navigate('/login');
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initializing,
      login,
      logout
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
