import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'ru' | 'en';

const translations = {
  ru: {
    common: {
      languageLabel: 'Язык',
      languages: {
        ru: 'Русский',
        en: 'English'
      }
    },
    app: {
      title: 'The Last of Guss',
      profileLabel: 'Выживший',
      logout: 'Выйти'
    },
    login: {
      title: 'Вход в зону G-42',
      usernameLabel: 'Логин',
      usernamePlaceholder: 'Например, GooseSlayer',
      passwordLabel: 'Пароль',
      passwordPlaceholder: 'Секретная фраза',
      helper: 'Подключайтесь к центру управления Гусем, чтобы следить за раундами и зарабатывать очки.',
      submit: {
        idle: 'Влететь в бой',
        loading: 'Проверяем...'
      },
      errors: {
        generic: 'Не удалось войти. Проверьте имя и пароль.'
      }
    },
    rounds: {
      heading: 'Боевые раунды',
      subtitle: 'Выбирай активный или ожидающий и кликай гуся быстрее всех.',
      create: 'Запустить новый',
      cardTitle: (id: string) => `Раунд #${id}`,
      startLabel: 'Старт',
      endLabel: 'Финиш',
      view: 'В бой →',
      empty: 'Раунды пока не созданы. Админ, пришло время выпустить гуся!',
      loading: 'Грузим арены...',
      errors: {
        list: 'Не удалось загрузить раунды. Попробуйте обновить страницу.',
        create: 'Не получилось запустить раунд. Проверьте права или обновите страницу.'
      },
      status: {
        active: 'Активен',
        cooldown: 'Сбор отряда',
        finished: 'Завершен'
      }
    },
    roundDetail: {
      goBack: '← Назад к раундам',
      loading: 'Загружаем боевого гуся...',
      fetchError: 'Не удалось получить данные раунда.',
      statusBadge: {
        cooldown: 'До старта',
        active: 'Финальный отсчет',
        finished: 'Раунд завершен'
      },
      tapButton: {
        waiting: 'Ждем сигнал',
        connecting: 'Подключаемся...',
        ready: 'Нажми гуся',
        sending: 'Отправляем клик...'
      },
      errors: {
        connectionLost: 'Соединение с гусем потеряно. Попробуйте обновить страницу.'
      },
      timeLabel: 'Оставшееся время',
      myScoreLabel: 'Мои очки',
      taps: (count: number) => `Тапов: ${count}`,
      nikitaWarning:
        'Никита, система фиксирует клики, но мутация G-42 блокирует начисление очков.',
      stats: {
        heading: 'Итоги раунда',
        totalScore: (score: number) => `Всего очков: ${score}`,
        winnerPrefix: 'Победитель —',
        winnerSuffix: (score: number) => `с ${score} очками`,
        noWinner: 'Гусь устал, победителей нет.',
        yourResult: (score: number) => `Ваш итог: ${score}`
      }
    }
  },
  en: {
    common: {
      languageLabel: 'Language',
      languages: {
        ru: 'Russian',
        en: 'English'
      }
    },
    app: {
      title: 'The Last of Guss',
      profileLabel: 'Survivor',
      logout: 'Sign out'
    },
    login: {
      title: 'Enter the G-42 zone',
      usernameLabel: 'Username',
      usernamePlaceholder: 'For example, GooseSlayer',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Secret phrase',
      helper: 'Connect to the Goose control hub to monitor rounds and earn points.',
      submit: {
        idle: 'Join the fight',
        loading: 'Checking...'
      },
      errors: {
        generic: 'Login failed. Verify your username and password.'
      }
    },
    rounds: {
      heading: 'Battle rounds',
      subtitle: 'Pick an active or upcoming arena and tap the goose faster than anyone.',
      create: 'Launch new round',
      cardTitle: (id: string) => `Round #${id}`,
      startLabel: 'Start',
      endLabel: 'Finish',
      view: 'Enter →',
      empty: 'No rounds yet. Admin, it is time to release the goose!',
      loading: 'Loading arenas...',
      errors: {
        list: 'Failed to load rounds. Try refreshing the page.',
        create: 'Could not start a new round. Check your permissions or refresh.'
      },
      status: {
        active: 'Active',
        cooldown: 'Gathering squad',
        finished: 'Finished'
      }
    },
    roundDetail: {
      goBack: '← Back to rounds',
      loading: 'Summoning the battle goose...',
      fetchError: 'Failed to fetch round data.',
      statusBadge: {
        cooldown: 'Countdown',
        active: 'Final countdown',
        finished: 'Round finished'
      },
      tapButton: {
        waiting: 'Waiting for signal',
        connecting: 'Connecting...',
        ready: 'Tap the goose',
        sending: 'Sending tap...'
      },
      errors: {
        connectionLost: 'Connection to the goose lost. Please refresh the page.'
      },
      timeLabel: 'Time remaining',
      myScoreLabel: 'My score',
      taps: (count: number) => `Taps: ${count}`,
      nikitaWarning:
        'Nikita, your taps are logged, but the G-42 mutation blocks score gains.',
      stats: {
        heading: 'Round results',
        totalScore: (score: number) => `Total score: ${score}`,
        winnerPrefix: 'Winner —',
        winnerSuffix: (score: number) => `with ${score} points`,
        noWinner: 'The goose is tired, no winners this time.',
        yourResult: (score: number) => `Your final score: ${score}`
      }
    }
  }
} as const;

type TranslationMap = (typeof translations)[Language];

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: TranslationMap;
}

const STORAGE_KEY = 'gus.language';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') {
      return 'ru';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'ru' ? stored : 'ru';
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      translations: translations[language]
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return { language: context.language, setLanguage: context.setLanguage };
}

export function useTranslations() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslations must be used within a LanguageProvider');
  }

  return context.translations;
}
