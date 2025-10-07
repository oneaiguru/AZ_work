import Link from "next/link";
import { notFound } from "next/navigation";
import { getProcurements } from "@/lib/api";

type ProcurementPageProps = {
  params: { slug: string };
};

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProcurementPage({ params }: ProcurementPageProps) {
  const procurements = await getProcurements();
  const procurement = procurements.find((item) => item.slug === params.slug);

  if (!procurement) {
    return notFound();
  }

  return (
    <section>
      <div className="section-inner" style={{ gap: "2rem" }}>
        <div className="section-heading">
          <span>Закупка</span>
          <h1>{procurement.title}</h1>
          <p>{procurement.shortDescription}</p>
        </div>
        <div className="grid grid--two">
          <div className="card" style={{ gap: "1rem" }}>
            <div>
              <span style={{ fontWeight: 600 }}>Статус</span>
              <p style={{ fontSize: "1.2rem" }}>{procurement.status}</p>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Тип</span>
              <p>{procurement.procurementType}</p>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Публикация</span>
              <p>{formatDateTime(procurement.startDate)}</p>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Окончание приёма</span>
              <p>{formatDateTime(procurement.endDate)}</p>
            </div>
            <Link className="button" href="/zakupki">
              Вернуться к списку
            </Link>
          </div>
          <div className="card" style={{ gap: "1rem" }}>
            <h2>Документы и ссылки</h2>
            <p>
              Публикация документов выполняется в Strapi. Для интеграции с ЕИС укажите ссылки в поле <em>eis_links</em>.
            </p>
            <ul className="prose">
              <li>Максимальный размер файла — 50 МБ, проверка ClamAV выполняется при загрузке.</li>
              <li>Приватные документы размещаются в защищённом бакете MinIO и доступны по подписанным ссылкам.</li>
            </ul>
            <Link className="button" href="mailto:tenders@uks.irkutsk.ru" style={{ alignSelf: "flex-start" }}>
              Связаться с менеджером
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
