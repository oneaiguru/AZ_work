'use client';

import Link from 'next/link';
import { useState } from 'react';

import MobileMenu from './MobileMenu';

const navLinks = [
  { href: '/projects', label: 'Проекты' },
  { href: '/procurements', label: 'Закупки' },
  { href: '/documents', label: 'Документы' },
  { href: '/news', label: 'Новости' },
  { href: '/contacts', label: 'Контакты' }
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-white/40"
      role="banner"
    >
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="font-semibold text-lg text-primary">
          УКС Иркутск 2
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-slate-600 lg:flex" aria-label="Главное меню">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
          <a className="button" href="/projects">
            Подать проект
          </a>
        </nav>
        <button
          type="button"
          className="lg:hidden button secondary"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
        >
          Меню
        </button>
        <MobileMenu open={open} onClose={() => setOpen(false)} links={navLinks} />
      </div>
    </header>
  );
}
