import Link from 'next/link';
import { notFound } from 'next/navigation';

import SectionHeading from '@/components/SectionHeading';
import { getProcurementBySlug } from '@/lib/api';

type PageProps = {
  params: { slug: string };
};

export default async function ProcurementDetailsPage({ params }: PageProps) {
  const { slug } = params;
  const procurement = await getProcurementBySlug(slug);

  if (!procurement) {
    return notFound();
  }

  return (
    <div className="section">
      <div className="container grid gap-12 lg:grid-cols-[1fr_0.4fr]">
        <div>
          <SectionHeading
            eyebrow={procurement.procurementType ?? 'Закупка'}
            title={procurement.title}
            description={procurement.shortDescription ?? 'Детали процедуры доступны ниже.'}
            actions={
              <Link href="/procurements" className="button secondary">
                Ко всем процедурам
              </Link>
            }
          />
          <div className="glass-card space-y-6 text-slate-600">
            <h3 className="text-lg font-semibold text-slate-900">Условия участия</h3>
            <p>
              Статус: <strong>{procurement.status}</strong>
            </p>
            <p>
              Срок подачи заявок: {procurement.startDate ? new Date(procurement.startDate).toLocaleDateString('ru-RU') : '—'} —{' '}
              {procurement.endDate ? new Date(procurement.endDate).toLocaleDateString('ru-RU') : '—'}
            </p>
            <p>
              Пакет документации доступен в Directus или по запросу на электронную почту закупочного комитета. Поддерживаются интеграции с ЕИС и региональным порталом.
            </p>
          </div>
        </div>
        <aside className="glass-card space-y-4 text-sm text-slate-600">
          <h4 className="text-sm uppercase tracking-[0.12em] text-primary">Контакты</h4>
          <p>
            Ответственный менеджер:
            <br />
            <strong>Анна Смирнова</strong>
          </p>
          <p>
            Электронная почта: <a href="mailto:tenders@uks.irk" className="text-primary">tenders@uks.irk</a>
          </p>
          <p>Телефон: +7 (3952) 00-11-22</p>
        </aside>
      </div>
    </div>
  );
}
