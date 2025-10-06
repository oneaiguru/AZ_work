import Link from "next/link";

const quickLinks = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Публичная оферта" },
  { href: "/documents", label: "Документы" },
];

const contacts = [
  { label: "Телефон", value: "+7 (3952) 46-41-20", href: "tel:+73952464120" },
  { label: "Email", value: "info@uks.irkutsk.ru", href: "mailto:info@uks.irkutsk.ru" },
  { label: "Адрес", value: "664007, г. Иркутск, ул. Российская, 23" },
];

const socials = [
  { href: "https://t.me/uks_irkutsk", label: "Telegram" },
  { href: "https://vk.com/uks_irkutsk", label: "VK" },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-columns">
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>УКС Иркутск</h3>
          <p style={{ marginTop: "0.75rem", maxWidth: "280px", color: "rgba(255,255,255,0.7)", fontSize: "0.95rem" }}>
            Управление капитального строительства г. Иркутска — надёжный заказчик
            и застройщик муниципальных и региональных проектов.
          </p>
        </div>
        <div>
          <h4 style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
            Быстрые ссылки
          </h4>
          <ul style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem", color: "rgba(255,255,255,0.75)" }}>
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
            Контакты
          </h4>
          <ul style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem", color: "rgba(255,255,255,0.75)" }}>
            {contacts.map((contact) => (
              <li key={contact.label}>
                <span style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  {contact.label}
                </span>
                {contact.href ? (
                  <a href={contact.href}>{contact.value}</a>
                ) : (
                  <span>{contact.value}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
            Социальные сети
          </h4>
          <ul style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem", color: "rgba(255,255,255,0.75)" }}>
            {socials.map((social) => (
              <li key={social.href}>
                <a href={social.href} target="_blank" rel="noreferrer">
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} МКУ «УКС г. Иркутска». Все права защищены.</span>
        <span>ИНН 3808134466 · ОГРН 1073808001269</span>
      </div>
    </footer>
  );
}
