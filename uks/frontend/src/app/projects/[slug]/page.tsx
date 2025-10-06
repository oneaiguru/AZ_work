import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/api";

type ProjectPageProps = {
  params: { slug: string };
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await getProject(params.slug);

  if (!project) {
    return notFound();
  }

  return (
    <section>
      <div className="section-inner" style={{ gap: "2.5rem" }}>
        <div className="section-heading">
          <span>Проект</span>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
        </div>
        <div className="grid grid--two">
          <div className="card" style={{ gap: "1rem" }}>
            <h2>Паспорт проекта</h2>
            <ul className="prose">
              <li>
                <strong>Категория:</strong> {project.category}
              </li>
              <li>
                <strong>Год сдачи:</strong> {project.year}
              </li>
              <li>
                <strong>CMS:</strong> данные управляются из Strapi и доступны через API /api/projects/{"{slug}"}
              </li>
            </ul>
            <Link className="button" href="/projects">
              Ко всем проектам
            </Link>
          </div>
          <div className="card" style={{ gap: "1rem" }}>
            <h2>Этапы</h2>
            <ol className="timeline">
              <li className="timeline-item">Предпроектные исследования и расчёт экономической эффективности</li>
              <li className="timeline-item">Проектирование и согласование в надзорных органах</li>
              <li className="timeline-item">Строительно-монтажные работы и авторский надзор</li>
              <li className="timeline-item">Ввод в эксплуатацию и передача управляющей компании</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
