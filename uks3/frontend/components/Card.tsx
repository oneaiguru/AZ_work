import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
  href?: string;
  meta?: ReactNode;
  ctaLabel?: string;
};

export default function Card({ title, subtitle, description, href, meta, ctaLabel }: Props) {
  const content = (
    <article className="glass-card h-full transition-transform duration-200 hover:-translate-y-1">
      <div className="flex h-full flex-col gap-4">
        <div>
          {meta}
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-2 text-sm uppercase tracking-[0.12em] text-primary">{subtitle}</p> : null}
        </div>
        {description ? <p className="text-slate-600">{description}</p> : null}
        {ctaLabel ? <span className="mt-auto text-sm font-semibold text-accent">{ctaLabel} →</span> : null}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
