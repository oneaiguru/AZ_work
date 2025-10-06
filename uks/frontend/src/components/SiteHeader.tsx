"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Главная" },
  { href: "/#about", label: "О компании" },
  { href: "/zakupki", label: "Закупки" },
  { href: "/projects", label: "Проекты" },
  { href: "/documents", label: "Документы" },
  { href: "/contacts", label: "Контакты" },
];

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 12);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const handleOutside = (event: MouseEvent) => {
      const menu = document.querySelector(".mobile-menu");
      const button = document.querySelector(".menu-button");
      if (!menu || !button) {
        return;
      }
      if (menu.contains(event.target as Node) || button.contains(event.target as Node)) {
        return;
      }
      setIsMenuOpen(false);
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [isMenuOpen]);

  return (
    <header className={`header${isScrolled ? " is-scrolled" : ""}`}>
      <div className="header-inner">
        <Link href="/" className="brand" onClick={() => setIsMenuOpen(false)}>
          <span className="brand-mark">УКС</span>
          <span>Управление капитального строительства</span>
        </Link>
        <nav className="header-nav" aria-label="Главная навигация">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-contact">
          <a href="tel:+73952464120">+7 (3952) 46-41-20</a>
          <span>Пн–Пт 09:00–18:00</span>
        </div>
        <button
          type="button"
          className="menu-button"
          aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isMenuOpen ? (
              <line x1="6" y1="6" x2="18" y2="18" />
            ) : (
              <line x1="4" y1="7" x2="20" y2="7" />
            )}
            {isMenuOpen ? (
              <line x1="18" y1="6" x2="6" y2="18" />
            ) : (
              <>
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>
      <div className={`mobile-menu${isMenuOpen ? " is-open" : ""}`}>
        <nav className="mobile-nav" aria-label="Мобильная навигация">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mobile-contacts">
          <a href="tel:+73952464120">+7 (3952) 46-41-20</a>
          <a href="mailto:info@uks.irkutsk.ru">info@uks.irkutsk.ru</a>
        </div>
      </div>
    </header>
  );
}
