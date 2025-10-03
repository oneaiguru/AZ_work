import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';

type RoundStatus = 'cooldown' | 'active' | 'finished';

interface RoundDetails {
  id: string;
  startTime: string;
  endTime: string;
  status: RoundStatus;
  totalScore: number;
  myScore: number;
  myTaps: number;
  winner: { username: string; score: number } | null;
}

export function RoundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, initializing } = useAuth();
  const [remaining, setRemaining] = useState('--:--');
  const [error, setError] = useState<string | null>(null);

  const roundQuery = useQuery({
    queryKey: ['round', id],
    queryFn: async () => {
      const response = await api.get<RoundDetails>(`/rounds/${id}`);
      return response.data;
    },
    refetchInterval: 15_000,
    enabled: Boolean(id)
  });

  const tapMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('round id missing');
      }
      const response = await api.post(`/rounds/${id}/tap`);
      return response.data as { myScore: number; totalScore: number; taps: number };
    },
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData<RoundDetails>(['round', id], (prev) =>
        prev
          ? {
              ...prev,
              myScore: data.myScore,
              myTaps: data.taps,
              totalScore: data.totalScore
            }
          : prev
      );
    },
    onError: () => {
      setError('Гусь сейчас не принимает клики. Возможно, раунд уже закончился.');
    }
  });

  useEffect(() => {
    if (!roundQuery.data) return;
    const interval = setInterval(() => {
      const now = dayjs();
      const start = dayjs(roundQuery.data.startTime);
      const end = dayjs(roundQuery.data.endTime);

      if (roundQuery.data.status === 'cooldown') {
        const diff = start.diff(now, 'second');
        setRemaining(formatDuration(diff > 0 ? diff : 0));
      } else if (roundQuery.data.status === 'active') {
        const diff = end.diff(now, 'second');
        setRemaining(formatDuration(diff > 0 ? diff : 0));
      } else {
        setRemaining('00:00');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roundQuery.data]);

  useEffect(() => {
    if (!roundQuery.data) return;
    if (roundQuery.data.status === 'finished') return;

    const target =
      roundQuery.data.status === 'cooldown'
        ? dayjs(roundQuery.data.startTime)
        : dayjs(roundQuery.data.endTime);
    const milliseconds = target.diff(dayjs(), 'millisecond');

    if (milliseconds <= 0) {
      queryClient.invalidateQueries({ queryKey: ['round', id] });
      return;
    }

    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['round', id] });
    }, milliseconds + 100);

    return () => clearTimeout(timeout);
  }, [roundQuery.data, id, queryClient]);

  const statusBadge = useMemo(() => {
    switch (roundQuery.data?.status) {
      case 'cooldown':
        return 'До старта';
      case 'active':
        return 'Финальный отсчет';
      case 'finished':
        return 'Раунд завершен';
      default:
        return '';
    }
  }, [roundQuery.data?.status]);

  const handleTap = () => {
    if (!tapMutation.isPending && roundQuery.data?.status === 'active') {
      tapMutation.mutate();
    }
  };

  if (initializing) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!id) {
    return <Navigate to="/rounds" replace />;
  }

  return (
    <AppLayout>
      {roundQuery.isError && <p className="error-text">Не удалось получить данные раунда.</p>}
      {roundQuery.isLoading && <p>Загружаем боевого гуся...</p>}
      {roundQuery.data && (
        <div className="round-layout">
          <Link to="/rounds" className="link-button">
            ← Назад к раундам
          </Link>
          <section className="gus-panel">
            <span className="timer-badge">{statusBadge}</span>
            <div className="gus-art" role="button" aria-pressed={false}>
              🦆
            </div>
            <button
              className="button"
              onClick={handleTap}
              disabled={roundQuery.data.status !== 'active' || tapMutation.isPending}
            >
              {roundQuery.data.status === 'active' ? 'Кликнуть гуся' : 'Ждем сигнал'}
            </button>
            <div>
              <p className="score-label">Оставшееся время</p>
              <p className="score-value">{remaining}</p>
            </div>
            <div>
              <p className="score-label">Мои очки</p>
              <p className="score-value">{roundQuery.data.myScore}</p>
              <p style={{ opacity: 0.6, margin: '8px 0 0 0' }}>Тапов: {roundQuery.data.myTaps}</p>
              {user?.role === 'nikita' && (
                <p style={{ opacity: 0.7, fontSize: 14 }}>
                  Никита, система фиксирует клики, но мутация G-42 блокирует начисление очков.
                </p>
              )}
            </div>
          </section>

          {roundQuery.data.status === 'finished' && (
            <section className="stats-card">
              <h3 style={{ margin: 0, fontSize: 24 }}>Итоги раунда</h3>
              <p style={{ margin: 0 }}>Всего очков: {roundQuery.data.totalScore}</p>
              {roundQuery.data.winner ? (
                <p style={{ margin: 0 }}>
                  Победитель — <strong>{roundQuery.data.winner.username}</strong> с {roundQuery.data.winner.score} очками
                </p>
              ) : (
                <p style={{ margin: 0 }}>Гусь устал, победителей нет.</p>
              )}
              <p style={{ margin: 0 }}>Ваш итог: {roundQuery.data.myScore}</p>
            </section>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>
      )}
    </AppLayout>
  );
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const mm = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const ss = String(safeSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
