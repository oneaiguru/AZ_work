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
    <div className="app-shell">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '24px 32px' }}>
        <LanguageSwitcher />
      </div>
      <main className="app-main">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>{t.login.title}</h2>
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
          {hasError && <p className="error-text">{t.login.errors.generic}</p>}
        </form>
      </main>
    </div>
  );
}
