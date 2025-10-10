import Card from '@/components/Card';
import SectionHeading from '@/components/SectionHeading';
import { getProcurements } from '@/lib/api';

export const revalidate = 300;

export default async function ProcurementsPage() {
  const procurements = await getProcurements();

  return (
    <div className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Закупки"
          title="Прозрачные процедуры"
          description="Реестр закупок УКС Иркутска с ключевыми параметрами, статусами и сроками подачи заявок."
        />
        <div className="grid">
          {procurements.length
            ? procurements.map((item) => (
                <Card
                  key={item.slug}
                  title={item.title}
                  subtitle={item.status}
                  description={item.shortDescription ?? undefined}
                  href={`/procurements/${item.slug}`}
                  ctaLabel="Пакет документов"
                />
              ))
            : [
                <Card
                  key="placeholder"
                  title="Пример закупки"
                  subtitle="Открытый конкурс"
                  description="Когда Directus будет настроен, карточки подтянутся автоматически."
                />
              ]}
        </div>
      </div>
    </div>
  );
}
