import Link from 'next/link';

type Stat = {
  value: string;
  label: string;
};

type Props = {
  title: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  stats?: Stat[];
};

export default function Hero({ title, subtitle, primaryCta, secondaryCta, stats }: Props) {
  return (
    <section className="section" style={{ paddingBottom: '0' }}>
      <div className="container">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[rgba(15,76,129,0.92)] to-[rgba(28,140,214,0.85)] px-6 py-16 text-white shadow-[0_48px_80px_rgba(15,76,129,0.35)]">
          <div className="max-w-3xl">
            <span className="badge bg-white/15 text-white">УКС Иркутска</span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl lg:text-[3.75rem]">{title}</h1>
            <p className="mt-4 text-lg text-white/80 md:text-xl">{subtitle}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {primaryCta ? (
                <Link href={primaryCta.href} className="button">
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link href={secondaryCta.href} className="button secondary text-white border-white/40">
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>
          {stats && stats.length > 0 ? (
            <div className="mt-12 grid gap-6 rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl sm:grid-cols-2 lg:absolute lg:right-10 lg:top-1/2 lg:mt-0 lg:w-80 lg:-translate-y-1/2">
              {stats.map((stat) => (
                <div key={stat.label} className="glass-card bg-white/20 text-left shadow-none">
                  <span className="text-3xl font-semibold">{stat.value}</span>
                  <p className="mt-1 text-sm uppercase tracking-[0.12em] text-white/80">{stat.label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
