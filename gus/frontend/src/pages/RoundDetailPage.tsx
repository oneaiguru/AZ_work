import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { API_BASE_URL } from '../api/client';
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
  const { user, token, initializing } = useAuth();
  const [remaining, setRemaining] = useState('--:--');
  const [error, setError] = useState<string | null>(null);
  const [isTapping, setIsTapping] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const roundQuery = useQuery({
    queryKey: ['round', id],
    queryFn: async () => {
      const response = await api.get<RoundDetails>(`/rounds/${id}`);
      return response.data;
    },
    refetchInterval: 15_000,
    enabled: Boolean(id)
  });

  useEffect(() => {
    if (!id || !token) {
      return;
    }

    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.searchParams.set('token', token);

    const socket = new WebSocket(url.toString());
    socketRef.current = socket;
    setSocketReady(false);

    const handleOpen = () => {
      setSocketReady(true);
      socket.send(JSON.stringify({ type: 'subscribe', roundId: id }));
    };

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as
          | { type: 'subscribed'; roundId: string }
          | { type: 'tap:result'; roundId: string; myScore: number; totalScore: number; taps: number }
          | { type: 'round:update'; roundId: string; totalScore: number }
          | { type: 'error'; message: string };

        if ('roundId' in data && data.roundId && data.roundId !== id) {
          return;
        }

        switch (data.type) {
          case 'tap:result':
            setIsTapping(false);
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
            break;
          case 'round:update':
            queryClient.setQueryData<RoundDetails>(['round', id], (prev) =>
              prev
                ? {
                    ...prev,
                    totalScore: data.totalScore
                  }
                : prev
            );
            break;
          case 'error':
            setIsTapping(false);
            setError(data.message);
            break;
          default:
            break;
        }
      } catch (parseError) {
        console.error('Failed to parse websocket message', parseError);
      }
    };

    const handleClose = () => {
      setSocketReady(false);
      setIsTapping(false);
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleClose);

    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleClose);
      setSocketReady(false);
      setIsTapping(false);
      socketRef.current = null;
      socket.close();
    };
  }, [API_BASE_URL, id, queryClient, token]);

  useEffect(() => {
    if (!roundQuery.data) return;

    const start = dayjs(roundQuery.data.startTime);
    const end = dayjs(roundQuery.data.endTime);

    const updateRemaining = () => {
      const now = dayjs();

      if (roundQuery.data.status === 'cooldown') {
        const diff = start.diff(now, 'second');
        setRemaining(formatDuration(diff > 0 ? diff : 0));
      } else if (roundQuery.data.status === 'active') {
        const diff = end.diff(now, 'second');
        setRemaining(formatDuration(diff > 0 ? diff : 0));
      } else {
        setRemaining('00:00');
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [roundQuery.data?.startTime, roundQuery.data?.endTime, roundQuery.data?.status]);

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
  }, [roundQuery.data?.status, roundQuery.data?.startTime, roundQuery.data?.endTime, id, queryClient]);

  useEffect(() => {
    if (!roundQuery.data) {
      return;
    }

    if (roundQuery.data.status === 'finished') {
      return;
    }

    const promoteStatus = () => {
      let shouldInvalidate = false;
      const now = dayjs();

      queryClient.setQueryData<RoundDetails>(['round', id], (prev) => {
        if (!prev) {
          return prev;
        }

        if (prev.status === 'cooldown') {
          const timeUntilStart = dayjs(prev.startTime).diff(now, 'millisecond');
          if (timeUntilStart <= 0) {
            shouldInvalidate = true;
            return { ...prev, status: 'active' };
          }
        } else if (prev.status === 'active') {
          const timeUntilEnd = dayjs(prev.endTime).diff(now, 'millisecond');
          if (timeUntilEnd <= 0) {
            shouldInvalidate = true;
            return { ...prev, status: 'finished' };
          }
        }

        return prev;
      });

      if (shouldInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['round', id] });
      }
    };

    promoteStatus();
    const interval = setInterval(promoteStatus, 500);

    return () => clearInterval(interval);
  }, [roundQuery.data?.status, roundQuery.data?.startTime, roundQuery.data?.endTime, id, queryClient]);

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
    if (!id || roundQuery.data?.status !== 'active') {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Соединение с гусем потеряно. Попробуйте обновить страницу.');
      return;
    }

    if (isTapping || !socketReady) {
      return;
    }

    setIsTapping(true);
    socket.send(JSON.stringify({ type: 'tap', roundId: id }));
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
              disabled={
                roundQuery.data.status !== 'active' || isTapping || !socketReady
              }
            >
              {roundQuery.data.status === 'active'
                ? isTapping
                  ? 'Отправляем клик...'
                  : 'Кликнуть гуся'
                : 'Ждем сигнал'}
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
