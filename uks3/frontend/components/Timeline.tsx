import clsx from 'clsx';

type Item = {
  label: string;
  description: string;
};

type Props = {
  items: Item[];
};

export default function Timeline({ items }: Props) {
  return (
    <ol className="relative border-l-2 border-primary/20 pl-8">
      {items.map((item, index) => (
        <li key={item.label} className={clsx('relative pb-10', index === items.length - 1 && 'pb-0')}>
          <span className="absolute -left-4 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-white text-sm font-semibold text-primary shadow-elevation">
            {index + 1}
          </span>
          <h3 className="text-xl font-semibold text-slate-900">{item.label}</h3>
          <p className="mt-2 text-slate-600">{item.description}</p>
        </li>
      ))}
    </ol>
  );
}
