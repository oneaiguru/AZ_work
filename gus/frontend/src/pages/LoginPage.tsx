import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError('Не удалось войти. Проверьте имя и пароль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Вход в зону G-42</h2>
          <label>
            Логин
            <input
              className="text-field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Например, GooseSlayer"
              required
            />
          </label>
          <label>
            Пароль
            <input
              className="text-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Секретная фраза"
              required
            />
          </label>
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Проверяем...' : 'Влететь в бой'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </main>
    </div>
  );
}
