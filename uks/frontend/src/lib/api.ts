export type HeroContent = {
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  stats: Array<{ label: string; value: string }>;
};

export type Project = {
  id: number;
  title: string;
  slug: string;
  category: string;
  year: number;
  description: string;
};

export type Procurement = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "moderated" | "published" | "archived";
  shortDescription: string;
  startDate: string;
  endDate: string;
  procurementType: string;
};

export type DocumentItem = {
  id: number;
  title: string;
  category: string;
  url: string;
  documentDate: string;
};

export type NewsItem = {
  id: number;
  title: string;
  excerpt: string;
  publishedAt: string;
};

export type ContactContent = {
  address: string;
  phone: string;
  email: string;
  schedule: string;
  lat: number;
  lng: number;
};

export type HomepageContent = {
  hero: HeroContent;
  about: {
    intro: string;
    values: Array<{ title: string; description: string }>;
  };
  flagship: {
    title: string;
    description: string;
    highlights: string[];
  };
  projects: Project[];
  procurements: Procurement[];
  documents: DocumentItem[];
  news: NewsItem[];
  contacts: ContactContent;
};

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:1337";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${CMS_URL}${path}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn("Falling back to static content for", path, error);
    return fallback;
  }
}

const FALLBACK_HOMEPAGE: HomepageContent = {
  hero: {
    title: "Развиваем Иркутск через устойчивое строительство",
    subtitle:
      "Управление капитального строительства реализует стратегические объекты городской инфраструктуры и обеспечивает прозрачность закупок.",
    primaryCta: { label: "Смотреть закупки", href: "/zakupki" },
    secondaryCta: { label: "Связаться", href: "/contacts" },
    stats: [
      { label: "лет работы", value: "17" },
      { label: "построенных объектов", value: "120+" },
      { label: "кв. м в строительстве", value: "450 000" },
    ],
  },
  about: {
    intro:
      "УКС — оператор городских инвестиционных программ. Мы сопровождаем проекты полного цикла: от предпроектной подготовки до ввода в эксплуатацию и передачи управляющим организациям.",
    values: [
      {
        title: "Компетентная команда",
        description:
          "Инженеры, экономисты и юристы с опытом реализации федеральных и региональных программ развития городской среды.",
      },
      {
        title: "Цифровые процессы",
        description:
          "Единая система управления проектами и документооборотом обеспечивает контроль сроков и прозрачность закупок.",
      },
      {
        title: "Ответственность",
        description:
          "Соблюдение требований 152-ФЗ, контроль качества и доступная обратная связь для жителей и подрядчиков.",
      },
    ],
  },
  flagship: {
    title: "Флагманский проект — квартал \"Возрождение\"",
    description:
      "Комплексное развитие территории с общественными пространствами, современными жилыми кварталами и социальной инфраструктурой.",
    highlights: [
      "Энергоэффективные фасады и благоустроенные дворы",
      "Шаговая доступность детских садов и школ",
      "Коммерческие помещения на первых этажах",
    ],
  },
  projects: [
    {
      id: 1,
      title: "Ледовый дворец для юношеского спорта",
      slug: "ice-arena",
      category: "Спортивная инфраструктура",
      year: 2024,
      description: "Современный комплекс для подготовки юных спортсменов и проведения соревнований городского уровня.",
    },
    {
      id: 2,
      title: "Школа на 1225 мест в Академгородке",
      slug: "school-akadem",
      category: "Образование",
      year: 2025,
      description: "Учебное пространство нового поколения с лабораториями, технопарком и медиацентром.",
    },
    {
      id: 3,
      title: "Реконструкция набережной Ангары",
      slug: "angara-riverfront",
      category: "Городская среда",
      year: 2023,
      description: "Пешеходные маршруты, велодорожки и амфитеатр для мероприятий с выходом к воде.",
    },
  ],
  procurements: [
    {
      id: 15,
      title: "Поставка строительных материалов для объектов возведения жилья",
      slug: "materials-supply-2025",
      status: "published",
      shortDescription: "Обеспечение строительными материалами для объектов в квартале \"Возрождение\".",
      startDate: "2025-01-15",
      endDate: "2025-02-28",
      procurementType: "commercial",
    },
    {
      id: 16,
      title: "Аукцион на благоустройство придомовых территорий",
      slug: "landscape-improvement-2025",
      status: "moderated",
      shortDescription: "Комплексное озеленение и монтаж малых архитектурных форм.",
      startDate: "2025-02-01",
      endDate: "2025-03-10",
      procurementType: "contract",
    },
    {
      id: 17,
      title: "Услуги технического заказчика",
      slug: "technical-supervision-2025",
      status: "published",
      shortDescription: "Организация авторского и технического надзора на строительных площадках.",
      startDate: "2025-01-20",
      endDate: "2025-03-05",
      procurementType: "service",
    },
  ],
  documents: [
    {
      id: 1,
      title: "Положение о закупочной деятельности",
      category: "Регламенты",
      url: "#",
      documentDate: "2024-12-20",
    },
    {
      id: 2,
      title: "Политика обработки персональных данных",
      category: "152-ФЗ",
      url: "#",
      documentDate: "2024-11-10",
    },
    {
      id: 3,
      title: "Годовой отчёт о реализации проектов",
      category: "Отчётность",
      url: "#",
      documentDate: "2024-12-30",
    },
  ],
  news: [
    {
      id: 1,
      title: "УКС завершил монтаж каркаса нового детского сада",
      excerpt: "Работы выполнены в срок, начинается отделка и благоустройство территории.",
      publishedAt: "2025-01-18",
    },
    {
      id: 2,
      title: "Подписано соглашение о развитии квартала \"Возрождение\"",
      excerpt: "Проект включает новые общественные пространства и деловой центр.",
      publishedAt: "2025-01-12",
    },
  ],
  contacts: {
    address: "664007, г. Иркутск, ул. Российская, 23",
    phone: "+7 (3952) 46-41-20",
    email: "info@uks.irkutsk.ru",
    schedule: "Пн–Пт 09:00–18:00",
    lat: 52.28333,
    lng: 104.28333,
  },
};

export async function getHomepageContent(): Promise<HomepageContent> {
  return safeFetch<HomepageContent>("/api/homepage", FALLBACK_HOMEPAGE);
}

export async function getProjects(): Promise<Project[]> {
  const response = await safeFetch<Project[]>("/api/projects", FALLBACK_HOMEPAGE.projects);
  return response;
}

export async function getProject(slug: string): Promise<Project | null> {
  const response = await safeFetch<Project | null>(`/api/projects/${slug}`, null);
  if (response) {
    return response;
  }
  return FALLBACK_HOMEPAGE.projects.find((project) => project.slug === slug) ?? null;
}

export async function getProcurements(params?: Record<string, string>): Promise<Procurement[]> {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, value]) => value))}`
    : "";
  const response = await safeFetch<Procurement[]>(`/api/procurements${query}`, FALLBACK_HOMEPAGE.procurements);
  return response;
}

export async function getDocuments(): Promise<DocumentItem[]> {
  return safeFetch<DocumentItem[]>("/api/documents", FALLBACK_HOMEPAGE.documents);
}

export async function getNews(): Promise<NewsItem[]> {
  return safeFetch<NewsItem[]>("/api/news-items", FALLBACK_HOMEPAGE.news);
}

export async function getContacts(): Promise<ContactContent> {
  return safeFetch<ContactContent>("/api/contacts", FALLBACK_HOMEPAGE.contacts);
}
