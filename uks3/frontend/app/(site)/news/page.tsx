import Card from '@/components/Card';
import SectionHeading from '@/components/SectionHeading';
import { getNews } from '@/lib/api';

export const revalidate = 300;

export default async function NewsPage() {
  const news = await getNews();

  return (
    <div className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Новости"
          title="Информационная повестка"
          description="Пресс-релизы, репортажи со стройплощадок и аналитика о развитии городской инфраструктуры."
        />
        <div className="grid">
          {news.length
            ? news.map((article) => (
                <Card
                  key={article.id}
                  title={article.title}
                  description={article.excerpt ?? undefined}
                  href={`/news/${article.id}`}
                  meta={
                    <span className="text-sm text-slate-500">
                      {article.published_at
                        ? new Date(article.published_at).toLocaleDateString('ru-RU')
                        : 'Дата уточняется'}
                    </span>
                  }
                  ctaLabel="Читать"
                />
              ))
            : [
                <Card
                  key="placeholder"
                  title="Пример новости"
                  description="Когда Directus наполнится контентом, здесь появятся свежие материалы."
                />
              ]}
        </div>
      </div>
    </div>
  );
}
