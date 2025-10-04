import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasError(false);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <div className="container auth-header-inner" data-flow="auto">
          <h1 className="app-logo">{t.app.title}</h1>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="auth-main">
        <div className="container auth-content" data-flow="auto">
          <section className="surface-card auth-form" data-flow="column">
            <h2>{t.login.title}</h2>
            <form onSubmit={handleSubmit} className="stack">
              <label>
                {t.login.usernameLabel}
                <input
                  className="text-field"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t.login.usernamePlaceholder}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                {t.login.passwordLabel}
                <input
                  className="text-field"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t.login.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="button" type="submit" disabled={loading}>
                {loading ? t.login.submit.loading : t.login.submit.idle}
              </button>
              {hasError && (
                <p className="error-text" role="alert">
                  {t.login.errors.generic}
                </p>
              )}
            </form>
          </section>
          <aside className="auth-visual">
            <div className="auth-illustration" aria-hidden="true" role="presentation">
              🦆
            </div>
            <div className="text-block">
              <p>{t.login.helper}</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
