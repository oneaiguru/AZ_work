import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../api/client';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'player' | 'nikita';
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setInitializing(false);
      return;
    }

    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = sessionStorage.getItem(USER_STORAGE_KEY);

    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (error) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setInitializing(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post('/login', { username, password });
    const { token: tokenValue, user: authUser } = response.data;

    sessionStorage.setItem(TOKEN_STORAGE_KEY, tokenValue);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));

    setToken(tokenValue);
    setUser(authUser);
    navigate('/rounds');
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }
    setUser(null);
    setToken(null);
    if (location.pathname !== '/login') {
      navigate('/login');
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      initializing,
      login,
      logout
    }),
    [user, token, initializing]
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
