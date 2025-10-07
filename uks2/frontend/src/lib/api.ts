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

export type ProcurementStatus = "draft" | "moderated" | "published" | "archived";

export type Procurement = {
  id: number;
  title: string;
  slug: string;
  status: ProcurementStatus;
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

const CMS_PUBLIC_URL = process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:8055";
const CMS_INTERNAL_URL = process.env.CMS_INTERNAL_URL ?? CMS_PUBLIC_URL;
const CMS_URL = typeof window === "undefined" ? CMS_INTERNAL_URL : CMS_PUBLIC_URL;

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

type DirectusListResponse<T> = {
  data: T[] | null;
};

type DirectusSingletonResponse<T> = {
  data: T | null;
};

async function directusFetch<T>(path: string, fallback: T): Promise<T> {
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

function ensureArray<T>(value: unknown): T[] | null {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch (error) {
      console.warn("Failed to parse JSON array", error);
    }
  }
  return null;
}

function coerceNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function coerceProject(value: Partial<Project>): Project | null {
  const slug = coerceString(value.slug);
  if (!slug) {
    return null;
  }
  return {
    id: coerceNumber(value.id),
    title: coerceString(value.title) || slug,
    slug,
    category: coerceString(value.category),
    year: coerceNumber(value.year),
    description: coerceString(value.description),
  };
}

function coerceProcurement(value: Partial<Procurement>): Procurement | null {
  const slug = coerceString(value.slug);
  if (!slug) {
    return null;
  }
  return {
    id: coerceNumber(value.id),
    title: coerceString(value.title) || slug,
    slug,
    status: (coerceString(value.status) as ProcurementStatus) || "draft",
    shortDescription: coerceString(value.shortDescription),
    startDate: coerceString(value.startDate),
    endDate: coerceString(value.endDate),
    procurementType: coerceString(value.procurementType),
  };
}

function coerceDocument(value: Partial<DocumentItem>): DocumentItem | null {
  const title = coerceString(value.title);
  if (!title) {
    return null;
  }
  return {
    id: coerceNumber(value.id),
    title,
    category: coerceString(value.category),
    url: coerceString(value.url),
    documentDate: coerceString(value.documentDate),
  };
}

function coerceNews(value: Partial<NewsItem>): NewsItem | null {
  const title = coerceString(value.title);
  if (!title) {
    return null;
  }
  return {
    id: coerceNumber(value.id),
    title,
    excerpt: coerceString(value.excerpt),
    publishedAt: coerceString((value as { published_at?: string }).published_at ?? value.publishedAt),
  };
}

function coerceContacts(value: Partial<ContactContent> | null | undefined): ContactContent {
  if (!value) {
    return FALLBACK_HOMEPAGE.contacts;
  }
  return {
    address: coerceString(value.address) || FALLBACK_HOMEPAGE.contacts.address,
    phone: coerceString(value.phone) || FALLBACK_HOMEPAGE.contacts.phone,
    email: coerceString(value.email) || FALLBACK_HOMEPAGE.contacts.email,
    schedule: coerceString(value.schedule) || FALLBACK_HOMEPAGE.contacts.schedule,
    lat: coerceNumber(value.lat) || FALLBACK_HOMEPAGE.contacts.lat,
    lng: coerceNumber(value.lng) || FALLBACK_HOMEPAGE.contacts.lng,
  };
}

async function fetchProjectsDirectus(): Promise<Project[]> {
  const params = new URLSearchParams({
    fields: "id,title,slug,category,year,description",
    sort: "-year",
  });
  const response = await directusFetch<DirectusListResponse<Partial<Project>>>(
    `/items/projects?${params.toString()}`,
    { data: null }
  );
  const projects = (response.data ?? [])
    .map(coerceProject)
    .filter((item): item is Project => item !== null);
  return projects.length ? projects : FALLBACK_HOMEPAGE.projects;
}

async function fetchProcurementsDirectus(params?: Record<string, string>): Promise<Procurement[]> {
  const search = new URLSearchParams({
    fields: "id,title,slug,status,shortDescription,startDate,endDate,procurementType",
    sort: "-startDate",
  });
  if (params) {
    if (params.status) {
      search.append("filter[status][_eq]", params.status);
    }
    if (params.procurementType) {
      search.append("filter[procurementType][_eq]", params.procurementType);
    }
  }
  const response = await directusFetch<DirectusListResponse<Partial<Procurement>>>(
    `/items/procurements?${search.toString()}`,
    { data: null }
  );
  const procurements = (response.data ?? [])
    .map(coerceProcurement)
    .filter((item): item is Procurement => item !== null);
  return procurements.length ? procurements : FALLBACK_HOMEPAGE.procurements;
}

async function fetchDocumentsDirectus(): Promise<DocumentItem[]> {
  const params = new URLSearchParams({
    fields: "id,title,category,url,documentDate",
    sort: "-documentDate",
  });
  const response = await directusFetch<DirectusListResponse<Partial<DocumentItem>>>(
    `/items/documents?${params.toString()}`,
    { data: null }
  );
  const documents = (response.data ?? [])
    .map(coerceDocument)
    .filter((item): item is DocumentItem => item !== null);
  return documents.length ? documents : FALLBACK_HOMEPAGE.documents;
}

async function fetchNewsDirectus(): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    fields: "id,title,excerpt,published_at",
    sort: "-published_at",
    limit: "6",
  });
  const response = await directusFetch<DirectusListResponse<Record<string, unknown>>>(
    `/items/news_articles?${params.toString()}`,
    { data: null }
  );
  const news = (response.data ?? [])
    .map((item) => coerceNews(item as Partial<NewsItem>))
    .filter((item): item is NewsItem => item !== null);
  return news.length ? news : FALLBACK_HOMEPAGE.news;
}

async function fetchContactsDirectus(): Promise<ContactContent> {
  const response = await directusFetch<DirectusSingletonResponse<Partial<ContactContent>>>(
    "/items/contacts",
    { data: null }
  );
  return coerceContacts(response.data ?? undefined);
}

export async function getHomepageContent(): Promise<HomepageContent> {
  const [homepage, projects, procurements, documents, news, contacts] = await Promise.all([
    directusFetch<DirectusSingletonResponse<Record<string, unknown>>>("/items/homepage", { data: null }),
    fetchProjectsDirectus(),
    fetchProcurementsDirectus(),
    fetchDocumentsDirectus(),
    fetchNewsDirectus(),
    fetchContactsDirectus(),
  ]);

  const data = homepage.data ?? {};
  const heroStats = ensureArray<{ label: string; value: string }>(data.hero_stats) ?? FALLBACK_HOMEPAGE.hero.stats;
  const aboutValues = ensureArray<{ title: string; description: string }>(data.about_values) ?? FALLBACK_HOMEPAGE.about.values;
  const flagshipHighlights = ensureArray<string>(data.flagship_highlights) ?? FALLBACK_HOMEPAGE.flagship.highlights;

  return {
    hero: {
      title: coerceString(data.hero_title) || FALLBACK_HOMEPAGE.hero.title,
      subtitle: coerceString(data.hero_subtitle) || FALLBACK_HOMEPAGE.hero.subtitle,
      primaryCta: {
        label: coerceString(data.hero_primary_label) || FALLBACK_HOMEPAGE.hero.primaryCta.label,
        href: coerceString(data.hero_primary_href) || FALLBACK_HOMEPAGE.hero.primaryCta.href,
      },
      secondaryCta: {
        label: coerceString(data.hero_secondary_label) || FALLBACK_HOMEPAGE.hero.secondaryCta.label,
        href: coerceString(data.hero_secondary_href) || FALLBACK_HOMEPAGE.hero.secondaryCta.href,
      },
      stats: heroStats.length ? heroStats : FALLBACK_HOMEPAGE.hero.stats,
    },
    about: {
      intro: coerceString(data.about_intro) || FALLBACK_HOMEPAGE.about.intro,
      values: aboutValues.length ? aboutValues : FALLBACK_HOMEPAGE.about.values,
    },
    flagship: {
      title: coerceString(data.flagship_title) || FALLBACK_HOMEPAGE.flagship.title,
      description: coerceString(data.flagship_description) || FALLBACK_HOMEPAGE.flagship.description,
      highlights: flagshipHighlights.length ? flagshipHighlights : FALLBACK_HOMEPAGE.flagship.highlights,
    },
    projects,
    procurements,
    documents,
    news,
    contacts,
  };
}

export async function getProjects(): Promise<Project[]> {
  return fetchProjectsDirectus();
}

export async function getProject(slug: string): Promise<Project | null> {
  const params = new URLSearchParams({
    "filter[slug][_eq]": slug,
    limit: "1",
    fields: "id,title,slug,category,year,description",
  });
  const response = await directusFetch<DirectusListResponse<Partial<Project>>>(
    `/items/projects?${params.toString()}`,
    { data: null }
  );
  const project = (response.data ?? [])
    .map(coerceProject)
    .find((item): item is Project => item !== null);
  if (project) {
    return project;
  }
  return FALLBACK_HOMEPAGE.projects.find((item) => item.slug === slug) ?? null;
}

export async function getProcurements(params?: Record<string, string>): Promise<Procurement[]> {
  return fetchProcurementsDirectus(params);
}

export async function getDocuments(): Promise<DocumentItem[]> {
  return fetchDocumentsDirectus();
}

export async function getNews(): Promise<NewsItem[]> {
  return fetchNewsDirectus();
}

export async function getContacts(): Promise<ContactContent> {
  return fetchContactsDirectus();
}
