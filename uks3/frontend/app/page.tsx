import Card from '@/components/Card';
import Hero from '@/components/Hero';
import SectionHeading from '@/components/SectionHeading';
import Timeline from '@/components/Timeline';
import { getDocuments, getHomepage, getNews, getProcurements, getProjects } from '@/lib/api';

export const revalidate = 300;

export default async function HomePage() {
  const [homepage, projects, procurements, news, documents] = await Promise.all([
    getHomepage(),
    getProjects(),
    getProcurements(),
    getNews(),
    getDocuments()
  ]);

  const documentRows = documents.slice(0, 5).length
    ? documents.slice(0, 5)
    : [
        {
          id: 1,
          title: 'Годовой отчет о реализации муниципальных программ',
          category: 'Финансовая отчетность',
          url: '#',
          documentDate: '2023-12-31'
        },
        {
          id: 2,
          title: 'Реестр строящихся объектов',
          category: 'Проектный офис',
          url: '#',
          documentDate: '2024-05-15'
        },
        {
          id: 3,
          title: 'План-график закупок на 2025 год',
          category: 'Закупки',
          url: '#',
          documentDate: '2024-03-01'
        }
      ];

  return (
    <>
      <Hero
        title={
          homepage?.hero_title ?? 'Инфраструктура Иркутска — под контролем Управления капитального строительства'
        }
        subtitle={
          homepage?.hero_subtitle ??
          'Актуальные проекты, прозрачные закупки, публичная отчетность и единое окно для взаимодействия с горожанами.'
        }
        primaryCta={{
          label: homepage?.hero_primary_label ?? 'Посмотреть проекты',
          href: homepage?.hero_primary_href ?? '/projects'
        }}
        secondaryCta={{
          label: homepage?.hero_secondary_label ?? 'Документы и отчеты',
          href: homepage?.hero_secondary_href ?? '/documents'
        }}
        stats={homepage?.hero_stats ?? [
          { value: '54', label: 'проекта в работе' },
          { value: '12,8 млрд ₽', label: 'портфель инвестиций' },
          { value: '18', label: 'муниципальных программ' },
          { value: '24/7', label: 'контроль хода строительства' }
        ]}
      />

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="О компании"
            title="Мы создаем устойчивый Иркутск"
            description={
              homepage?.about_intro ??
              'УКС Иркутска управляет строительством социальных объектов, модернизацией инженерной инфраструктуры и развитием городской среды.'
            }
          />
          <div className="grid">
            {(homepage?.about_values ?? [
              { title: 'Ответственность', description: 'Публичность, контроль сроков и открытые данные.' },
              { title: 'Команда', description: 'Опытные инженеры, проектировщики и аналитики.' },
              { title: 'Партнерства', description: 'Синергия с подрядчиками и инвесторами.' }
            ]).map((value) => (
              <Card key={value.title} title={value.title} description={value.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container">
          <SectionHeading
            eyebrow="Флагман"
            title={homepage?.flagship_title ?? 'Программа «Северный мост»'}
            description={
              homepage?.flagship_description ??
              'Масштабная реконструкция транспортного каркаса города с применением BIM-технологий, цифрового мониторинга и зеленых стандартов строительства.'
            }
          />
          <Timeline items={homepage?.flagship_highlights ?? [
            {
              label: '2024 · Старт модернизации',
              description: 'Подготовка проектной документации и цифровая модель существующих коммуникаций.'
            },
            {
              label: '2025 · Строительство',
              description: 'Переустройство сетей, возведение опор и пролетов, непрерывный контроль качества.'
            },
            {
              label: '2026 · Ввод в эксплуатацию',
              description: 'Запуск мостового перехода, благоустройство прилегающих территорий и озеленение.'
            }
          ]} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Проекты"
            title="Приоритетные стройки"
            actions={<a className="button secondary" href="/projects">Все проекты</a>}
          />
          <div className="grid">
            {(projects.slice(0, 6).length ? projects.slice(0, 6) : [
              {
                id: 1,
                title: 'Школа в микрорайоне Солнечный',
                slug: 'solnechny-school',
                category: 'Социальная инфраструктура',
                year: 2025,
                description: 'Современное образовательное пространство на 1100 мест с инженерными классами и коворкингом.'
              }
            ]).map((project) => (
              <Card
                key={project.slug}
                title={project.title}
                subtitle={project.category ?? undefined}
                description={project.description}
                href={`/projects/${project.slug}`}
                ctaLabel="Подробнее"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container">
          <SectionHeading
            eyebrow="Документы"
            title="Публичная отчетность"
            actions={<a className="button secondary" href="/documents">Открыть реестр</a>}
          />
          <div className="overflow-hidden rounded-3xl bg-white shadow-elevation">
            <table className="table">
              <thead>
                <tr className="text-left text-sm uppercase tracking-[0.12em] text-primary/70">
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <a href={doc.url} className="text-primary hover:underline">
                        {doc.title}
                      </a>
                    </td>
                    <td>{doc.category}</td>
                    <td>{doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('ru-RU') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Закупки" title="Открытые процедуры" actions={<a className="button" href="/procurements">Каталог</a>} />
          <div className="grid">
            {(procurements.slice(0, 4).length ? procurements.slice(0, 4) : [
              {
                id: 1,
                title: 'Поставка лифтового оборудования для школ',
                slug: 'lift-equipment-2024',
                status: 'Идет прием заявок',
                shortDescription: 'Комплексная поставка и монтаж лифтов для 4 образовательных учреждений.',
                procurementType: 'Открытый конкурс'
              }
            ]).map((item) => (
              <Card
                key={item.slug}
                title={item.title}
                subtitle={item.status}
                description={item.shortDescription ?? undefined}
                href={`/procurements/${item.slug}`}
                ctaLabel="Условия процедуры"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container">
          <SectionHeading eyebrow="Новости" title="Актуальная повестка" actions={<a className="button secondary" href="/news">Все новости</a>} />
          <div className="grid">
            {(news.slice(0, 3).length ? news.slice(0, 3) : [
              {
                id: 1,
                title: 'УКС представил цифровую панель мониторинга строек',
                excerpt:
                  'Система объединяет данные подрядчиков, надзорных органов и муниципалитета в едином интерфейсе для оперативного контроля.'
              }
            ]).map((article) => (
              <Card
                key={article.id}
                title={article.title}
                description={article.excerpt ?? undefined}
                href={`/news/${article.id}`}
                ctaLabel="Читать"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionHeading
              eyebrow="Контакты"
              title="Свяжитесь с нами"
              description="Поддерживаем открытый диалог с жителями, подрядчиками и СМИ. Готовы помочь с любой ситуацией."
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <Card title="Адрес" description="664025, Иркутск, ул. Ленина, 1" />
              <Card title="Телефон" description="+7 (3952) 00-00-00" />
              <Card title="Почта" description="info@uks.irk" />
              <Card title="График" description="Пн–Пт 09:00–18:00" />
            </div>
          </div>
          <div className="glass-card h-full">
            <iframe
              title="Карта офиса УКС"
              className="h-80 w-full rounded-3xl border-0"
              src="https://yandex.ru/map-widget/v1/?um=constructor%3Aec0838412b5ecbcde6644597d3b40863a1411ef0767e2f97ea3d8f9a152c43db&amp;source=constructor"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </>
  );
}
