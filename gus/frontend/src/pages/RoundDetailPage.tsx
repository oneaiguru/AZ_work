import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { API_BASE_URL } from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../context/LanguageContext';

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
  const [errorKey, setErrorKey] = useState<'connectionLost' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isTapping, setIsTapping] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [reconnectSignal, setReconnectSignal] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const t = useTranslations();

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

    const base = new URL(API_BASE_URL);
    const wsUrl = new URL(API_BASE_URL);
    const basePath = base.pathname.endsWith('/') ? base.pathname.slice(0, -1) : base.pathname;
    const wsPath = `${basePath}/ws`.replace(/\/{2,}/g, '/');
    wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.pathname = wsPath.length > 0 ? wsPath : '/ws';
    wsUrl.search = '';
    wsUrl.hash = '';
    wsUrl.searchParams.set('token', token);

    const socket = new WebSocket(wsUrl.toString());
    socketRef.current = socket;
    setSocketReady(false);

    let active = true;

    const handleOpen = () => {
      setSocketReady(true);
      setErrorKey(null);
      setServerError(null);
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
          case 'subscribed':
            setSocketReady(true);
            setErrorKey(null);
            setServerError(null);
            break;
          case 'tap:result':
            setIsTapping(false);
            setErrorKey(null);
            setServerError(null);
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
            setErrorKey(null);
            setServerError(data.message);
            break;
          default:
            break;
        }
      } catch (parseError) {
        console.error('Failed to parse websocket message', parseError);
      }
    };

    const handleClose = () => {
      if (socketRef.current === socket) {
        setSocketReady(false);
        setIsTapping(false);
        setErrorKey('connectionLost');
        setServerError(null);
        if (active) {
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setReconnectSignal((value) => value + 1);
          }, 1000);
        }
      }
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleClose);

    return () => {
      active = false;
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleClose);
      setSocketReady(false);
      setIsTapping(false);
      socketRef.current = null;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      socket.close();
    };
  }, [API_BASE_URL, id, queryClient, token, reconnectSignal]);

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

  const statusBadge = roundQuery.data ? t.roundDetail.statusBadge[roundQuery.data.status] : '';

  const buttonLabel = (() => {
    if (!roundQuery.data) {
      return t.roundDetail.tapButton.waiting;
    }
    if (roundQuery.data.status !== 'active') {
      return t.roundDetail.tapButton.waiting;
    }
    if (isTapping) {
      return t.roundDetail.tapButton.sending;
    }
    if (!socketReady) {
      return t.roundDetail.tapButton.connecting;
    }
    return t.roundDetail.tapButton.ready;
  })();

  const handleTap = () => {
    if (!id || roundQuery.data?.status !== 'active') {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorKey('connectionLost');
      setServerError(null);
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
      {roundQuery.isError && <p className="error-text">{t.roundDetail.fetchError}</p>}
      {roundQuery.isLoading && <p>{t.roundDetail.loading}</p>}
      {roundQuery.data && (
        <div className="round-layout">
          <Link to="/rounds" className="link-button round-detail-back">
            {t.roundDetail.goBack}
          </Link>
          <section className="gus-panel">
            <span className="timer-badge">{statusBadge}</span>
            <div className="gus-art" role="button" aria-pressed={false}>
              🦆
            </div>
            <button
              className="button"
              onClick={handleTap}
              disabled={roundQuery.data.status !== 'active' || isTapping}
            >
              {buttonLabel}
            </button>
            <div>
              <p className="score-label">{t.roundDetail.timeLabel}</p>
              <p className="score-value">{remaining}</p>
            </div>
            <div>
              <p className="score-label">{t.roundDetail.myScoreLabel}</p>
              <p className="score-value">{roundQuery.data.myScore}</p>
              <p className="score-meta">
                {t.roundDetail.taps(roundQuery.data.myTaps)}
              </p>
              {user?.role === 'nikita' && (
                <p className="nikita-warning">
                  {t.roundDetail.nikitaWarning}
                </p>
              )}
            </div>
          </section>

          {roundQuery.data.status === 'finished' && (
            <section className="stats-card">
              <h3 className="stats-heading">{t.roundDetail.stats.heading}</h3>
              <p className="stats-text">{t.roundDetail.stats.totalScore(roundQuery.data.totalScore)}</p>
              {roundQuery.data.winner ? (
                <p className="stats-text">
                  {t.roundDetail.stats.winnerPrefix}{' '}
                  <strong>{roundQuery.data.winner.username}</strong>{' '}
                  {t.roundDetail.stats.winnerSuffix(roundQuery.data.winner.score)}
                </p>
              ) : (
                <p className="stats-text">{t.roundDetail.stats.noWinner}</p>
              )}
              <p className="stats-text">{t.roundDetail.stats.yourResult(roundQuery.data.myScore)}</p>
            </section>
          )}
          {(errorKey || serverError) && (
            <p className="error-text">
              {serverError ?? (errorKey ? t.roundDetail.errors[errorKey] : null)}
            </p>
          )}
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
