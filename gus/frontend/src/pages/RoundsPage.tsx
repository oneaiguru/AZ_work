import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';

type RoundStatus = 'cooldown' | 'active' | 'finished';

interface RoundSummary {
  id: string;
  startTime: string;
  endTime: string;
  status: RoundStatus;
  totalScore: number;
}

export function RoundsPage() {
  const { user, initializing } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const roundsQuery = useQuery({
    queryKey: ['rounds'],
    queryFn: async () => {
      const response = await api.get<RoundSummary[]>('/rounds');
      return response.data;
    },
    refetchInterval: 15_000,
    enabled: Boolean(user)
  });

  if (initializing) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleCreateRound = async () => {
    try {
      setError(null);
      const response = await api.post<RoundSummary>('/rounds');
      navigate(`/rounds/${response.data.id}`);
    } catch (err) {
      setError('Не получилось запустить раунд. Проверьте права или обновите страницу.');
    }
  };

  return (
    <AppLayout>
      <div className="rounds-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 32 }}>Боевые раунды</h2>
          <p style={{ marginTop: 8, opacity: 0.8 }}>Выбирай активный или ожидающий и кликай гуся быстрее всех.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="button" onClick={handleCreateRound}>
            Запустить новый
          </button>
        )}
      </div>

      {roundsQuery.isError ? (
        <p className="error-text">Не удалось загрузить раунды. Попробуйте обновить страницу.</p>
      ) : roundsQuery.isLoading ? (
        <p>Грузим арены...</p>
      ) : (
        <div className="card-grid">
          {roundsQuery.data?.map((round) => (
            <article key={round.id} className="card">
              <p className="card-status">{statusLabel(round.status)}</p>
              <h3 className="card-title">Раунд #{round.id.slice(0, 8)}</h3>
              <p className="card-time">Старт: {new Date(round.startTime).toLocaleString('ru-RU')}</p>
              <p className="card-time">Финиш: {new Date(round.endTime).toLocaleString('ru-RU')}</p>
              <Link to={`/rounds/${round.id}`} className="link-button" style={{ marginTop: 16 }}>
                В бой →
              </Link>
            </article>
          ))}
          {roundsQuery.data?.length === 0 && <p>Раунды пока не созданы. Админ, пришло время выпустить гуся!</p>}
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 24 }}>{error}</p>}
    </AppLayout>
  );
}

function statusLabel(status: RoundStatus) {
  switch (status) {
    case 'active':
      return 'Активен';
    case 'cooldown':
      return 'Сбор отряда';
    case 'finished':
      return 'Завершен';
    default:
      return status;
  }
}
