import { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function SectionHeading({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div>
        {eyebrow ? (
          <p className="badge bg-primary/10 text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 md:text-[2.75rem]">{title}</h2>
        {description ? <p className="mt-3 max-w-2xl text-lg text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
