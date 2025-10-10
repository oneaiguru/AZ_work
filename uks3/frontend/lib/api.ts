import 'server-only';

import { createDirectus, rest, readItems, readSingleton } from '@directus/sdk';

const DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.DIRECTUS_URL;
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

if (!DIRECTUS_URL) {
  console.warn('Directus URL is not defined. API calls will fail until configured.');
}

type Homepage = {
  hero_title: string;
  hero_subtitle: string;
  hero_primary_label: string;
  hero_primary_href: string;
  hero_secondary_label: string | null;
  hero_secondary_href: string | null;
  hero_stats: { value: string; label: string }[];
  about_intro: string;
  about_values: { title: string; description: string }[];
  flagship_title: string;
  flagship_description: string;
  flagship_highlights: { label: string; description: string }[];
};

type Project = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  year: number | null;
  description: string;
  sort: number | null;
};

type Procurement = {
  id: number;
  title: string;
  slug: string;
  status: string;
  shortDescription: string | null;
  procurementType: string | null;
  startDate: string | null;
  endDate: string | null;
  sort: number | null;
};

type Document = {
  id: number;
  title: string;
  category: string | null;
  url: string;
  documentDate: string | null;
  sort: number | null;
};

type NewsArticle = {
  id: number;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  sort: number | null;
};

type Contacts = {
  address: string;
  phone: string;
  email: string;
  schedule: string;
  lat: number | null;
  lng: number | null;
};

const directus = createDirectus(DIRECTUS_URL ?? 'http://directus:8055')
  .with(rest({ staticToken: DIRECTUS_STATIC_TOKEN ?? undefined }));

const FIVE_MINUTES = 60 * 5;

async function safeFetch<T>(cb: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    console.error('[Directus] Request failed, returning fallback', error);
    return fallback;
  }
}

export async function getHomepage(): Promise<Homepage | null> {
  return safeFetch(
    () =>
      directus.request(
        readSingleton('homepage', {
          fields: ['*']
        })
      ),
    null
  );
}

export async function getProjects(): Promise<Project[]> {
  return safeFetch(
    () =>
      directus.request(
        readItems('projects', {
          fields: ['*'],
          sort: ['sort', '-year'],
          limit: -1
        })
      ),
    []
  );
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const projects = await getProjects();
  return projects.find((project) => project.slug === slug) ?? null;
}

export async function getProcurements(): Promise<Procurement[]> {
  return safeFetch(
    () =>
      directus.request(
        readItems('procurements', {
          fields: ['*'],
          sort: ['sort', '-startDate'],
          limit: -1
        })
      ),
    []
  );
}

export async function getProcurementBySlug(slug: string): Promise<Procurement | null> {
  const procurements = await getProcurements();
  return procurements.find((item) => item.slug === slug) ?? null;
}

export async function getDocuments(): Promise<Document[]> {
  return safeFetch(
    () =>
      directus.request(
        readItems('documents', {
          fields: ['*'],
          sort: ['sort', '-documentDate'],
          limit: -1
        })
      ),
    []
  );
}

export async function getNews(): Promise<NewsArticle[]> {
  return safeFetch(
    () =>
      directus.request(
        readItems('news_articles', {
          fields: ['*'],
          sort: ['sort', '-published_at'],
          limit: -1
        })
      ),
    []
  );
}

export async function getNewsById(id: number): Promise<NewsArticle | null> {
  const articles = await getNews();
  return articles.find((article) => article.id === id) ?? null;
}

export async function getContacts(): Promise<Contacts | null> {
  return safeFetch(
    () =>
      directus.request(
        readSingleton('contacts', {
          fields: ['*']
        })
      ),
    null
  );
}

export const revalidate = FIVE_MINUTES;
