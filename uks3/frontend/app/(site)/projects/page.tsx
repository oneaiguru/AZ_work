import Card from '@/components/Card';
import SectionHeading from '@/components/SectionHeading';
import { getProjects } from '@/lib/api';

export const revalidate = 300;

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Проекты"
          title="Каталог реализуемых инициатив"
          description="Систематизированный перечень объектов капитального строительства, которыми управляет УКС Иркутска."
        />
        <div className="grid">
          {projects.length
            ? projects.map((project) => (
                <Card
                  key={project.slug}
                  title={project.title}
                  subtitle={project.category ?? undefined}
                  description={project.description}
                  href={`/projects/${project.slug}`}
                  ctaLabel="Паспорт проекта"
                />
              ))
            : [
                <Card
                  key="placeholder"
                  title="Новый лицей в Академгородке"
                  subtitle="Социальная инфраструктура"
                  description="Пример карточки проекта — заполнится автоматически после синхронизации с Directus."
                />
              ]}
        </div>
      </div>
    </div>
  );
}
