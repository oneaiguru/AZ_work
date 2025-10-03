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
        <h1 className="app-logo">{t.app.title}</h1>
        <div className="app-profile">
          <LanguageSwitcher />
          {user && (
            <>
              <div>
                <p className="app-profile-label">{t.app.profileLabel}</p>
                <p className="app-profile-name">{user.username}</p>
              </div>
              <button onClick={logout} className="button button-outline">
                {t.app.logout}
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
