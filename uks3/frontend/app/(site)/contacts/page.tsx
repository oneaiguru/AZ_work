import SectionHeading from '@/components/SectionHeading';
import { getContacts } from '@/lib/api';

export const revalidate = 600;

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <div className="section">
      <div className="container grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Контакты"
            title="Связь с УКС Иркутска"
            description="Используйте доступные каналы для обращений жителей, партнеров и средств массовой информации."
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-slate-900">Адрес</h3>
              <p className="mt-2 text-slate-600">{contacts?.address ?? '664025, Иркутск, ул. Ленина, 1'}</p>
            </div>
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-slate-900">Телефон</h3>
              <p className="mt-2 text-slate-600">{contacts?.phone ?? '+7 (3952) 00-00-00'}</p>
            </div>
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-slate-900">Электронная почта</h3>
              <p className="mt-2 text-slate-600">{contacts?.email ?? 'info@uks.irk'}</p>
            </div>
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-slate-900">График работы</h3>
              <p className="mt-2 text-slate-600">{contacts?.schedule ?? 'Пн–Пт 09:00–18:00'}</p>
            </div>
          </div>
          <div className="glass-card">
            <h3 className="text-lg font-semibold text-slate-900">Обратная связь</h3>
            <p className="mt-2 text-slate-600">
              Для оперативных вопросов используйте электронную почту, для заявок подрядчиков — личный кабинет Directus.
            </p>
          </div>
        </div>
        <div className="glass-card">
          <iframe
            title="Карта расположения УКС"
            className="h-[480px] w-full rounded-3xl border-0"
            src="https://yandex.ru/map-widget/v1/?um=constructor%3Aec0838412b5ecbcde6644597d3b40863a1411ef0767e2f97ea3d8f9a152c43db&amp;source=constructor"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
