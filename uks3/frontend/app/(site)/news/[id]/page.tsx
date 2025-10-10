import Link from 'next/link';
import { notFound } from 'next/navigation';

import SectionHeading from '@/components/SectionHeading';
import { getNewsById } from '@/lib/api';

type PageProps = {
  params: { id: string };
};

export default async function NewsDetailsPage({ params }: PageProps) {
  const { id } = params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return notFound();
  }

  const article = await getNewsById(numericId);
  if (!article) {
    return notFound();
  }

  return (
    <div className="section">
      <div className="container">
        <SectionHeading
          eyebrow={article.published_at ? new Date(article.published_at).toLocaleDateString('ru-RU') : 'Новости'}
          title={article.title}
          description={article.excerpt ?? 'Материал готовится к публикации. Следите за обновлениями.'}
          actions={
            <Link href="/news" className="button secondary">
              Ко всем новостям
            </Link>
          }
        />
        <article className="glass-card space-y-6 text-lg leading-relaxed text-slate-700">
          <p>
            В этой секции появится полный текст новости, выгружаемый из Directus. Макет поддерживает адаптивные изображения,
            цитаты и списки. Пока система не заполнена, отображается шаблонный текст.
          </p>
          <p>
            УКС Иркутска продолжает цифровизацию процессов и расширяет открытые данные. Для каждого материала доступен набор
            метаданных: автор, дата публикации, связанные проекты и документы.
          </p>
          <p>
            При необходимости можно подключить rich-text редактор Directus и отображать контент через dangerouslySetInnerHTML
            после безопасной очистки.
          </p>
        </article>
      </div>
    </div>
  );
}
