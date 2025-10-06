import Link from "next/link";
import { getProcurements } from "@/lib/api";

type ZakupkiPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  moderated: "На модерации",
  published: "Опубликовано",
  archived: "Архив",
};

const TYPE_LABELS: Record<string, string> = {
  commercial: "Коммерческое",
  contract: "Контракт",
  service: "Услуга",
};

export default async function ZakupkiPage({ searchParams }: ZakupkiPageProps) {
  const status = typeof searchParams?.status === "string" ? searchParams?.status : "";
  const query = typeof searchParams?.q === "string" ? searchParams.q : "";
  const type = typeof searchParams?.type === "string" ? searchParams.type : "";

  const procurements = await getProcurements({ status, type, q: query });
  const filtered = procurements.filter((item) => {
    const byStatus = status ? item.status === status : true;
    const byType = type ? item.procurementType === type : true;
    const byQuery = query
      ? item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.shortDescription.toLowerCase().includes(query.toLowerCase())
      : true;
    return byStatus && byType && byQuery;
  });

  return (
    <section>
      <div className="section-inner" style={{ gap: "2.5rem" }}>
        <div className="section-heading">
          <span>Закупки</span>
          <h1>Процедуры и коммерческие предложения</h1>
          <p>
            На странице представлены закупки, размещённые в Strapi. Менеджеры по торгам могут добавлять лоты, прикреплять документы и устанавливать сроки публикации.
          </p>
        </div>

        <form
          className="card"
          style={{ gap: "1rem" }}
          role="search"
          aria-label="Фильтрация закупок"
        >
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Поиск</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Наименование или описание"
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(16,43,63,0.15)",
                  padding: "0.75rem 1rem",
                  fontSize: "1rem",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Статус</span>
              <select
                name="status"
                defaultValue={status}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(16,43,63,0.15)",
                  padding: "0.75rem 1rem",
                  fontSize: "1rem",
                }}
              >
                <option value="">Все</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Тип</span>
              <select
                name="type"
                defaultValue={type}
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(16,43,63,0.15)",
                  padding: "0.75rem 1rem",
                  fontSize: "1rem",
                }}
              >
                <option value="">Все</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button className="button" type="submit">
              Применить фильтр
            </button>
            <a className="button" href="/zakupki" style={{ background: "rgba(15,76,129,0.08)", color: "var(--color-primary)" }}>
              Сбросить
            </a>
          </div>
        </form>

        <div className="grid grid--two">
          {filtered.map((item) => (
            <article key={item.id} className="card" style={{ gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge">{TYPE_LABELS[item.procurementType] ?? item.procurementType}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-accent)" }}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
              <h2 style={{ fontSize: "1.4rem" }}>{item.title}</h2>
              <p>{item.shortDescription}</p>
              <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                Подача заявок: {formatDate(item.startDate)} – {formatDate(item.endDate)}
              </p>
              <Link href={`/zakupki/${item.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                Перейти к закупке
              </Link>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            По заданным параметрам закупки не найдены. Попробуйте изменить фильтры.
          </p>
        )}
      </div>
    </section>
  );
}
