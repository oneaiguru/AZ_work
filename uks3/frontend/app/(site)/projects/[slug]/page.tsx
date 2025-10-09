import Link from 'next/link';
import { notFound } from 'next/navigation';

import SectionHeading from '@/components/SectionHeading';
import Timeline from '@/components/Timeline';
import { getProjectBySlug } from '@/lib/api';

type PageProps = {
  params: { slug: string };
};

export default async function ProjectDetailsPage({ params }: PageProps) {
  const { slug } = params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    return notFound();
  }

  return (
    <div className="section">
      <div className="container grid gap-12 lg:grid-cols-[1fr_0.4fr]">
        <div>
          <SectionHeading
            eyebrow={project.category ?? 'Проект'}
            title={project.title}
            description={project.description}
            actions={
              <Link href="/projects" className="button secondary">
                Ко всем проектам
              </Link>
            }
          />
          <div className="glass-card space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">Этапы проекта</h3>
            <Timeline
              items={[
                { label: 'Подготовка', description: 'Изыскания и разработка проектно-сметной документации.' },
                { label: 'Строительство', description: 'Работы на площадке, контроль подрядчиков и качества.' },
                { label: 'Сдача', description: 'Ввод в эксплуатацию, проверка инженерных систем, благоустройство.' }
              ]}
            />
          </div>
        </div>
        <aside className="glass-card space-y-4">
          <h4 className="text-sm uppercase tracking-[0.12em] text-primary">Справка</h4>
          <dl className="space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-semibold text-slate-900">Год реализации</dt>
              <dd>{project.year ?? 'Уточняется'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Категория</dt>
              <dd>{project.category ?? 'Не указано'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Куратор</dt>
              <dd>Дирекция строительства № 3</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Контакты</dt>
              <dd>
                <a href="tel:+73952000000" className="text-primary">
                  +7 (3952) 00-00-00
                </a>
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
