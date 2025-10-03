import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage, useTranslations } from '../context/LanguageContext';

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
  const [creationError, setCreationError] = useState(false);
  const t = useTranslations();
  const { language } = useLanguage();
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
      setCreationError(false);
      const response = await api.post<RoundSummary>('/rounds');
      navigate(`/rounds/${response.data.id}`);
    } catch (err) {
      setCreationError(true);
    }
  };

  return (
    <AppLayout>
      <div className="rounds-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 32 }}>{t.rounds.heading}</h2>
          <p style={{ marginTop: 8, opacity: 0.8 }}>{t.rounds.subtitle}</p>
        </div>
        {user?.role === 'admin' && (
          <button className="button" onClick={handleCreateRound}>
            {t.rounds.create}
          </button>
        )}
      </div>

      {roundsQuery.isError ? (
        <p className="error-text">{t.rounds.errors.list}</p>
      ) : roundsQuery.isLoading ? (
        <p>{t.rounds.loading}</p>
      ) : (
        <div className="card-grid">
          {roundsQuery.data?.map((round) => (
            <article key={round.id} className="card">
              <p className="card-status">{t.rounds.status[round.status]}</p>
              <h3 className="card-title">{t.rounds.cardTitle(round.id.slice(0, 8))}</h3>
              <p className="card-time">
                {t.rounds.startLabel}: {new Date(round.startTime).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
              </p>
              <p className="card-time">
                {t.rounds.endLabel}: {new Date(round.endTime).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
              </p>
              <Link to={`/rounds/${round.id}`} className="link-button" style={{ marginTop: 16 }}>
                {t.rounds.view}
              </Link>
            </article>
          ))}
          {roundsQuery.data?.length === 0 && <p>{t.rounds.empty}</p>}
        </div>
      )}
      {creationError && <p className="error-text" style={{ marginTop: 24 }}>{t.rounds.errors.create}</p>}
    </AppLayout>
  );
}
