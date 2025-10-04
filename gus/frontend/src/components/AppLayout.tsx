import { PropsWithChildren } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AppLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const t = useTranslations();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header-inner" data-flow="auto">
          <h1 className="app-logo">{t.app.title}</h1>
          <div className="app-actions">
            <LanguageSwitcher />
            {user && (
              <div className="app-profile">
                <div>
                  <p className="app-profile-label">{t.app.profileLabel}</p>
                  <p className="app-profile-name">{user.username}</p>
                </div>
                <button onClick={logout} className="button button-outline button-inline">
                  {t.app.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="container app-main-inner">{children}</div>
      </main>
    </div>
  );
}
