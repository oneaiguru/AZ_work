import { getDocuments } from "@/lib/api";
import Link from "next/link";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function DocumentsPage() {
  const documents = await getDocuments();
  const grouped = documents.reduce<Record<string, typeof documents>>((acc, doc) => {
    acc[doc.category] = acc[doc.category] ? [...acc[doc.category], doc] : [doc];
    return acc;
  }, {});

  return (
    <section>
      <div className="section-inner" style={{ gap: "2.5rem" }}>
        <div className="section-heading">
          <span>Документы</span>
          <h1>Юридически значимая информация</h1>
          <p>
            Все документы проходят проверку на актуальность, соответствуют требованиям 152-ФЗ и доступны для скачивания с
            разграничением прав доступа через MinIO.
          </p>
        </div>
        <div className="grid grid--two">
          {Object.entries(grouped).map(([category, docs]) => (
            <section key={category} className="card" style={{ gap: "1rem" }}>
              <h2>{category}</h2>
              <ul className="prose">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <Link href={doc.url} target="_blank">
                      {doc.title}
                    </Link>{" "}
                    <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                      от {formatDate(doc.documentDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
