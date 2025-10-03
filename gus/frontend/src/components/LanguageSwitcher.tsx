import { ChangeEvent } from 'react';
import { Language, useLanguage, useTranslations } from '../context/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslations();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value as Language);
  };

  return (
    <label className="language-switcher">
      <span>{t.common.languageLabel}:</span>
      <select value={language} onChange={handleChange} className="language-select">
        <option value="ru">{t.common.languages.ru}</option>
        <option value="en">{t.common.languages.en}</option>
      </select>
    </label>
  );
}
