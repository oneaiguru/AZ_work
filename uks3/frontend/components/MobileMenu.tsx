'use client';

import Link from 'next/link';
import { Fragment } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
};

export default function MobileMenu({ open, onClose, links }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm lg:hidden" role="dialog" aria-modal>
      <div className="absolute inset-x-4 top-16 rounded-3xl bg-white p-6 shadow-elevation-strong">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-primary">Навигация</span>
          <button type="button" className="button secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <nav className="flex flex-col gap-4" aria-label="Мобильное меню">
          {links.map((link) => (
            <Fragment key={link.href}>
              <Link href={link.href} onClick={onClose} className="text-lg font-medium text-slate-700">
                {link.label}
              </Link>
            </Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
}
