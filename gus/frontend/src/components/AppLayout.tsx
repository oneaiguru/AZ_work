import { PropsWithChildren } from 'react';
import { useAuth } from '../context/AuthContext';

export function AppLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-logo">The Last of Guss</h1>
        {user && (
          <div className="app-profile">
            <div>
              <p className="app-profile-label">Выживший</p>
              <p className="app-profile-name">{user.username}</p>
            </div>
            <button onClick={logout} className="button button-outline">
              Выйти
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
