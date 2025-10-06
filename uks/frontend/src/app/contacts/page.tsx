import Link from "next/link";
import { getContacts } from "@/lib/api";

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <section>
      <div className="section-inner" style={{ gap: "2rem" }}>
        <div className="section-heading">
          <span>Контакты</span>
          <h1>Как с нами связаться</h1>
          <p>
            УКС обеспечивает открытость коммуникаций. Вы можете связаться по телефону, электронной почте или через официальный портал Госуслуг.
          </p>
        </div>
        <div className="grid grid--two">
          <div className="card" style={{ gap: "0.75rem" }}>
            <h2>Офис</h2>
            <p>{contacts.address}</p>
            <p>
              <strong>Телефон:</strong> <a href={`tel:${contacts.phone}`}>{contacts.phone}</a>
              <br />
              <strong>Email:</strong> <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </p>
            <p>
              <strong>График работы:</strong> {contacts.schedule}
            </p>
            <Link className="button" href="mailto:info@uks.irkutsk.ru" style={{ alignSelf: "flex-start" }}>
              Написать письмо
            </Link>
          </div>
          <div className="card" style={{ gap: "0.75rem" }}>
            <h2>На карте</h2>
            <iframe
              title="Офис УКС"
              src={`https://yandex.ru/map-widget/v1/?um=constructor%3Aexample&source=constructor&ll=${contacts.lng}%2C${contacts.lat}&z=15`}
              style={{ width: "100%", height: "320px", border: "0", borderRadius: "16px" }}
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
