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
      <section className="page-section">
        <header className="rounds-header" data-flow="auto">
          <div className="rounds-heading-group text-block">
            <h2 className="rounds-heading">{t.rounds.heading}</h2>
            <p className="rounds-subtitle">{t.rounds.subtitle}</p>
          </div>
          {user?.role === 'admin' && (
            <button className="button button-inline" onClick={handleCreateRound}>
              {t.rounds.create}
            </button>
          )}
        </header>

        {roundsQuery.isError ? (
          <p className="error-text" role="alert">
            {t.rounds.errors.list}
          </p>
        ) : roundsQuery.isLoading ? (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              {t.rounds.loading}
            </p>
            <div className="card-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={index} className="card card--skeleton skeleton" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="card-grid">
              {roundsQuery.data?.map((round) => (
                <article key={round.id} className="card">
                  <p className="card-status">{t.rounds.status[round.status]}</p>
                  <h3 className="card-title">{t.rounds.cardTitle(round.id.slice(0, 8))}</h3>
                  <p className="card-time">
                    {t.rounds.startLabel}:{' '}
                    {new Date(round.startTime).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
                  </p>
                  <p className="card-time">
                    {t.rounds.endLabel}:{' '}
                    {new Date(round.endTime).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
                  </p>
                  <Link to={`/rounds/${round.id}`} className="link-button">
                    {t.rounds.view}
                  </Link>
                </article>
              ))}
            </div>
            {roundsQuery.data?.length === 0 && <p className="empty-state text-block">{t.rounds.empty}</p>}
          </>
        )}
        {creationError && (
          <p className="error-text creation-error" role="alert">
            {t.rounds.errors.create}
          </p>
        )}
      </section>
    </AppLayout>
  );
}
