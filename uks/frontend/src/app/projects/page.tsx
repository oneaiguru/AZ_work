import Link from "next/link";
import { getProjects } from "@/lib/api";

type ProjectsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const filterYear = typeof searchParams?.year === "string" ? Number(searchParams.year) : undefined;
  const filterCategory = typeof searchParams?.category === "string" ? searchParams.category : "";
  const projects = await getProjects();
  const years = Array.from(new Set(projects.map((project) => project.year))).sort((a, b) => b - a);
  const categories = Array.from(new Set(projects.map((project) => project.category)));

  const filtered = projects.filter((project) => {
    const byYear = filterYear ? project.year === filterYear : true;
    const byCategory = filterCategory ? project.category === filterCategory : true;
    return byYear && byCategory;
  });

  return (
    <section>
      <div className="section-inner" style={{ gap: "2.5rem" }}>
        <div className="section-heading">
          <span>Портфолио</span>
          <h1>Реализованные и текущие проекты</h1>
          <p>Витрина проектов УКС, загружаемая из Strapi с поддержкой пагинации и фильтрации по типу и году реализации.</p>
        </div>

        <form className="card" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Год</span>
              <select
                name="year"
                defaultValue={filterYear ?? ""}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(16,43,63,0.15)",
                  padding: "0.75rem 1rem",
                  minWidth: "180px",
                }}
              >
                <option value="">Все годы</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Категория</span>
              <select
                name="category"
                defaultValue={filterCategory}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(16,43,63,0.15)",
                  padding: "0.75rem 1rem",
                  minWidth: "220px",
                }}
              >
                <option value="">Все категории</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button className="button" type="submit">
              Применить фильтр
            </button>
            <a className="button" href="/projects" style={{ background: "rgba(15,76,129,0.08)", color: "var(--color-primary)" }}>
              Сбросить
            </a>
          </div>
        </form>

        <div className="grid grid--three">
          {filtered.map((project) => (
            <article key={project.id} className="card" style={{ gap: "0.75rem" }}>
              <span className="badge">{project.category}</span>
              <h2 style={{ fontSize: "1.4rem" }}>{project.title}</h2>
              <p>{project.description}</p>
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>Год сдачи: {project.year}</span>
              <Link href={`/projects/${project.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                Подробнее
              </Link>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            Проекты не найдены. Измените критерии фильтра.
          </p>
        )}
      </div>
    </section>
  );
}
