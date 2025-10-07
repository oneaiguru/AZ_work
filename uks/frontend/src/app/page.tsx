import Link from "next/link";
import { getHomepageContent } from "@/lib/api";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function HomePage() {
  const content = await getHomepageContent();

  return (
    <>
      <section className="hero" id="hero">
        <div className="section-inner">
          <div>
            <span className="badge">Муниципальный заказчик</span>
            <h1>{content.hero.title}</h1>
            <p>{content.hero.subtitle}</p>
            <div className="hero-actions">
              <Link className="button" href={content.hero.primaryCta.href}>
                {content.hero.primaryCta.label}
              </Link>
              <Link className="button" href={content.hero.secondaryCta.href} style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
                {content.hero.secondaryCta.label}
              </Link>
            </div>
          </div>
          <div className="hero-stats" aria-label="Ключевые показатели УКС">
            {content.hero.stats.map((stat) => (
              <div key={stat.label} className="hero-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about">
        <div className="section-inner">
          <div className="section-heading">
            <span>О компании</span>
            <h2>Команда, которая отвечает за развитие Иркутска</h2>
            <p>{content.about.intro}</p>
          </div>
          <div className="grid grid--three">
            {content.about.values.map((value) => (
              <article key={value.title} className="card">
                <h3>{value.title}</h3>
                <p>{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="flagship" className="surface-muted">
        <div className="section-inner">
          <div className="section-heading">
            <span>Флагманский проект</span>
            <h2>{content.flagship.title}</h2>
            <p>{content.flagship.description}</p>
          </div>
          <ul className="timeline" aria-label="Ключевые преимущества проекта">
            {content.flagship.highlights.map((highlight) => (
              <li key={highlight} className="timeline-item">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="projects">
        <div className="section-inner">
          <div className="section-heading">
            <span>Реализованные объекты</span>
            <h2>Проекты УКС</h2>
            <p>Социальная, образовательная и транспортная инфраструктура с акцентом на энергоэффективность и устойчивость.</p>
          </div>
          <div className="grid grid--three">
            {content.projects.map((project) => (
              <article key={project.id} className="card">
                <span className="badge">{project.category}</span>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <Link href={`/projects/${project.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                  Подробнее
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="procurements" className="surface-muted">
        <div className="section-inner">
          <div className="section-heading">
            <span>Закупки</span>
            <h2>Актуальные процедуры</h2>
            <p>Прозрачные торги и коммерческие предложения для подрядчиков и инвесторов. Данные синхронизируются со Strapi.</p>
          </div>
          <div className="grid grid--three">
            {content.procurements.map((item) => (
              <article key={item.id} className="card" aria-label={`Закупка ${item.title}`}>
                <span className="badge">{item.procurementType}</span>
                <h3>{item.title}</h3>
                <p>{item.shortDescription}</p>
                <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                  Статус: <strong>{item.status}</strong>
                  <br />
                  Подача заявок: {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </p>
                  <Link href={`/zakupki/${item.slug}`} className="button" style={{ alignSelf: "flex-start" }}>
                    Подробнее
                  </Link>
                </article>
              ))}
            </div>
        </div>
      </section>

      <section id="documents">
        <div className="section-inner">
          <div className="section-heading">
            <span>Документы</span>
            <h2>Регламенты и открытые данные</h2>
            <p>Все документы соответствуют требованиям 152-ФЗ и доступу к публичной информации.</p>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Дата публикации</th>
              </tr>
            </thead>
            <tbody>
              {content.documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <a href={document.url} target="_blank" rel="noreferrer">
                      {document.title}
                    </a>
                  </td>
                  <td>{document.category}</td>
                    <td>{formatDate(document.documentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="news" className="surface-muted">
        <div className="section-inner">
          <div className="section-heading">
            <span>Новости</span>
            <h2>Анонсы и события</h2>
          </div>
          <div className="grid grid--two">
            {content.news.map((item) => (
              <article key={item.id} className="card news-card">
                <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contacts">
        <div className="section-inner">
          <div className="section-heading">
            <span>Контакты</span>
            <h2>Связаться с УКС</h2>
            <p>Мы открыты к диалогу с подрядчиками, инвесторами и жителями Иркутска.</p>
          </div>
          <div className="grid grid--two">
            <div className="card">
              <h3>Офис и график</h3>
              <div className="prose">
                <p>{content.contacts.address}</p>
                <p>{content.contacts.schedule}</p>
                <p>
                  <a href={`tel:${content.contacts.phone}`}>{content.contacts.phone}</a>
                  <br />
                  <a href={`mailto:${content.contacts.email}`}>{content.contacts.email}</a>
                </p>
              </div>
              <Link className="button" href="mailto:info@uks.irkutsk.ru" style={{ alignSelf: "flex-start" }}>
                Написать письмо
              </Link>
            </div>
            <div className="card">
              <h3>Как добраться</h3>
              <iframe
                title="Карта расположения УКС"
                src={`https://yandex.ru/map-widget/v1/?um=constructor%3Aexample&source=constructor&ll=${content.contacts.lng}%2C${content.contacts.lat}&z=15`}
                style={{ width: "100%", height: "280px", border: "0", borderRadius: "16px" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
