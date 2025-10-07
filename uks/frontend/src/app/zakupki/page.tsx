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
  const status = typeof searchParams?.status === "string" ? searchParams.status : "";
  const query = typeof searchParams?.q === "string" ? searchParams.q : "";
  const type = typeof searchParams?.type === "string" ? searchParams.type : "";
  const commercialStatus =
    typeof searchParams?.commercialStatus === "string" ? searchParams.commercialStatus : "";

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

  const now = new Date();

  const registry: typeof filtered = [];
  const archive: typeof filtered = [];
  const plan: typeof filtered = [];

  filtered.forEach((item) => {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);

    if (start > now) {
      plan.push(item);
      return;
    }

    if (item.status === "archived" || end < now) {
      archive.push(item);
      return;
    }

    registry.push(item);
  });

  const commercial = filtered.filter((item) => item.procurementType === "commercial");
  const commercialFiltered = commercial.filter((item) =>
    commercialStatus ? item.status === commercialStatus : true,
  );

  const commercialStatusOptions = Array.from(
    new Set(commercial.map((item) => item.status)),
  ).map((value) => ({ value, label: STATUS_LABELS[value] ?? value }));

  return (
    <section>
      <div className="section-inner" style={{ gap: "3rem" }}>
        <div className="section-heading">
          <span>Закупки</span>
          <h1>Торги и коммерческие предложения УКС</h1>
          <p>
            Страница структурирована согласно внутреннему регламенту: блок «Торги» с реестром актуальных процедур и архивом,
            отдельный план закупок и витрина коммерческих помещений с учётом их статуса.
          </p>
        </div>

        <div className="layout-split">
          <nav className="card" aria-label="Навигация по разделу" style={{ flex: "1 1 260px" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Структура страницы</h2>
            <ul style={{ display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}>
              <li>
                <a href="#torgi" className="link-underlined">
                  Торги
                </a>
                <ul style={{ listStyle: "none", padding: "0.35rem 0 0 1rem", margin: 0, display: "grid", gap: "0.35rem" }}>
                  <li>
                    <a href="#registry" className="link-underlined">
                      Реестр актуальных закупок
                    </a>
                  </li>
                  <li>
                    <a href="#archive" className="link-underlined">
                      Архив закупок
                    </a>
                  </li>
                </ul>
              </li>
              <li>
                <a href="#plan" className="link-underlined">
                  План закупок
                </a>
              </li>
              <li>
                <a href="#commercial" className="link-underlined">
                  Реализация коммерческих помещений
                </a>
              </li>
            </ul>
          </nav>

          <form
            className="card"
            style={{ gap: "1rem", flex: "3 1 480px" }}
            role="search"
            aria-label="Фильтрация закупок"
          >
            <div
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span style={{ fontWeight: 600 }}>Поиск по названию</span>
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
                <span style={{ fontWeight: 600 }}>Тип процедуры</span>
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
              <a
                className="button"
                href="/zakupki"
                style={{ background: "rgba(15,76,129,0.08)", color: "var(--color-primary)" }}
              >
                Сбросить
              </a>
            </div>
          </form>
        </div>

        <div id="torgi" className="stack" style={{ gap: "2.5rem" }}>
          <header>
            <h2>Торги</h2>
            <p style={{ maxWidth: "65ch" }}>
              Блок объединяет проводимые процедуры. Актуальные закупки остаются в реестре до завершения приёма заявок,
              завершённые автоматически попадают в архив.
            </p>
          </header>

          <section id="registry" className="stack" style={{ gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1.4rem" }}>Реестр актуальных закупок</h3>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
                {registry.length} процедур
              </span>
            </div>
            <div className="grid grid--two">
              {registry.map((item) => (
                <article key={item.id} className="card" style={{ gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge">{TYPE_LABELS[item.procurementType] ?? item.procurementType}</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-accent)" }}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem" }}>{item.title}</h4>
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
            {registry.length === 0 && (
              <p style={{ color: "var(--color-text-muted)" }}>
                По текущим фильтрам активных процедур не найдено.
              </p>
            )}
          </section>

          <section id="archive" className="stack" style={{ gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "1.4rem" }}>Архив закупок</h3>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
                {archive.length} процедур
              </span>
            </div>
            <div className="grid grid--two">
              {archive.map((item) => (
                <article key={item.id} className="card" style={{ gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge">{TYPE_LABELS[item.procurementType] ?? item.procurementType}</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "1.2rem" }}>{item.title}</h4>
                  <p>{item.shortDescription}</p>
                  <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                    Период проведения: {formatDate(item.startDate)} – {formatDate(item.endDate)}
                  </p>
                  <Link href={`/zakupki/${item.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                    Детали закупки
                  </Link>
                </article>
              ))}
            </div>
            {archive.length === 0 && (
              <p style={{ color: "var(--color-text-muted)" }}>
                Завершённые закупки отсутствуют или не соответствуют выбранным фильтрам.
              </p>
            )}
          </section>
        </div>

        <section id="plan" className="stack" style={{ gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
            <h2>План закупок</h2>
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.95rem" }}>
              {plan.length} мероприятий
            </span>
          </div>
          <p style={{ maxWidth: "65ch" }}>
            План отражает процедуры, публикация которых запланирована на будущее. Даты старта определяются по полю «Начало приёма заявок».
          </p>
          <div className="grid grid--two">
            {plan.map((item) => (
              <article key={item.id} className="card" style={{ gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge">{TYPE_LABELS[item.procurementType] ?? item.procurementType}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-accent)" }}>
                    Старт {formatDate(item.startDate)}
                  </span>
                </div>
                <h4 style={{ fontSize: "1.2rem" }}>{item.title}</h4>
                <p>{item.shortDescription}</p>
                <Link href={`/zakupki/${item.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                  Подробнее о планах
                </Link>
              </article>
            ))}
          </div>
          {plan.length === 0 && (
            <p style={{ color: "var(--color-text-muted)" }}>
              Запланированных закупок пока нет или они отфильтрованы.
            </p>
          )}
        </section>

        <section id="commercial" className="stack" style={{ gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
            <h2>Реализация коммерческих помещений</h2>
            <form method="get" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {query && <input type="hidden" name="q" value={query} />}
              {status && <input type="hidden" name="status" value={status} />}
              {type && <input type="hidden" name="type" value={type} />}
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
                Статус помещения
                <select
                  name="commercialStatus"
                  defaultValue={commercialStatus}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid rgba(16,43,63,0.15)",
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="">Все</option>
                  {commercialStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit" style={{ padding: "0.55rem 1.2rem" }}>
                Показать
              </button>
            </form>
          </div>
          <p style={{ maxWidth: "65ch" }}>
            Раздел предназначен для показа доступных коммерческих помещений в реализуемых проектах. Используйте фильтр по статусу,
            чтобы увидеть помещения, доступные для продажи или уже реализованные.
          </p>
          <div className="grid grid--three">
            {commercialFiltered.map((item) => (
              <article key={item.id} className="card" style={{ gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge">{TYPE_LABELS[item.procurementType] ?? item.procurementType}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-accent)" }}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
                <h4 style={{ fontSize: "1.2rem" }}>{item.title}</h4>
                <p>{item.shortDescription}</p>
                <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                  Актуально до {formatDate(item.endDate)}
                </p>
                <Link href={`/zakupki/${item.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                  Карточка помещения
                </Link>
              </article>
            ))}
          </div>
          {commercialFiltered.length === 0 && (
            <p style={{ color: "var(--color-text-muted)" }}>
              Помещения с выбранным статусом отсутствуют. Попробуйте изменить фильтр.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
