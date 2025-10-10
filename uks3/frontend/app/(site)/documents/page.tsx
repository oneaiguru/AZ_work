import Link from 'next/link';

import SectionHeading from '@/components/SectionHeading';
import { getDocuments } from '@/lib/api';

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const revalidate = 300;

export default async function DocumentsPage({ searchParams }: PageProps) {
  const selectedCategory = typeof searchParams?.category === 'string' ? searchParams.category : '';
  const documents = await getDocuments();

  const categories = Array.from(new Set(documents.map((doc) => doc.category).filter(Boolean))) as string[];
  const filtered = selectedCategory ? documents.filter((doc) => doc.category === selectedCategory) : documents;

  return (
    <div className="section">
      <div className="container space-y-8">
        <SectionHeading
          eyebrow="Документы"
          title="Открытый архив"
          description="Единая таблица нормативных актов, отчетности и проектной документации. Выберите нужную категорию."
        />

        <form className="flex flex-wrap items-center gap-4" method="get">
          <label className="text-sm font-medium text-slate-700" htmlFor="category">
            Категория
          </label>
          <select
            id="category"
            name="category"
            defaultValue={selectedCategory}
            className="rounded-full border border-primary/20 bg-white px-4 py-2 text-sm shadow-elevation focus:outline-none"
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat} value={cat ?? ''}>
                {cat}
              </option>
            ))}
          </select>
          <button type="submit" className="button secondary">
            Применить
          </button>
          {selectedCategory ? (
            <Link href="/documents" className="text-sm font-medium text-primary">
              Сбросить фильтр
            </Link>
          ) : null}
        </form>

        <div className="overflow-hidden rounded-3xl bg-white shadow-elevation">
          <table className="table">
            <thead>
              <tr className="text-left text-sm uppercase tracking-[0.12em] text-primary/70">
                <th>Название</th>
                <th>Категория</th>
                <th>Дата</th>
                <th>Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>Документы не найдены.</td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.title}</td>
                    <td>{doc.category ?? '—'}</td>
                    <td>{doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('ru-RU') : '—'}</td>
                    <td>
                      <a href={doc.url} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        Открыть
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
