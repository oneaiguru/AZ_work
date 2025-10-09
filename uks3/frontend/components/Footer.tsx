export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white mt-20">
      <div className="container grid gap-12 py-16">
        <div>
          <h3 className="text-2xl font-semibold mb-2">УКС Иркутск 2</h3>
          <p className="max-w-xl text-white/70">
            Городская служба, отвечающая за стратегические проекты развития, инфраструктуру и комфортную городскую среду.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h4 className="text-sm uppercase tracking-[0.12em] text-white/70 mb-3">Контакты</h4>
            <p className="text-white/90">г. Иркутск, ул. Ленина, 1</p>
            <p className="text-white/90">+7 (3952) 00-00-00</p>
            <p className="text-white/90">info@uks.irk</p>
          </div>
          <div>
            <h4 className="text-sm uppercase tracking-[0.12em] text-white/70 mb-3">Навигация</h4>
            <ul className="space-y-2 text-white/90">
              <li>
                <a href="/projects" className="hover:text-white">
                  Проекты
                </a>
              </li>
              <li>
                <a href="/procurements" className="hover:text-white">
                  Закупки
                </a>
              </li>
              <li>
                <a href="/documents" className="hover:text-white">
                  Документы
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm uppercase tracking-[0.12em] text-white/70 mb-3">Правовая информация</h4>
            <ul className="space-y-2 text-white/90">
              <li>
                <a href="/policy" className="hover:text-white">
                  Политика конфиденциальности
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white">
                  Пользовательское соглашение
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="text-white/60 text-sm">© {new Date().getFullYear()} Администрация города Иркутска. Все права защищены.</p>
      </div>
    </footer>
  );
}
