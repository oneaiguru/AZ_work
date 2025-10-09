export default function NotFound() {
  return (
    <div className="section">
      <div className="container text-center">
        <p className="badge bg-primary/10 text-primary">404</p>
        <h1 className="mt-6 text-4xl font-semibold text-slate-900">Страница не найдена</h1>
        <p className="mt-4 text-lg text-slate-600">
          Возможно, материал еще не опубликован или был перемещен. Вернитесь на главную страницу и попробуйте снова.
        </p>
        <a className="button mt-8" href="/">
          На главную
        </a>
      </div>
    </div>
  );
}
