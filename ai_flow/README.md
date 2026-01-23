# AI Flow - управление проектами с ИИ

Утилита `ai_flow.py` помогает вести проекты по схеме "проект -> ветки -> шаги", создавая файлы-шаблоны и сохраняя связь между ветками и шагами.

## Быстрый старт
- Создать проект:  
  ```bash
  python ai_flow.py init-project <путь/к/проекту> [--title "Название"] [--date YYYY-MM-DD]
  ```
  При инициализации автоматически создаётся ветка `A` со стартовым шагом `001`.
- Создать ветку:  
  ```bash
  python ai_flow.py create-branch <project_path> <branch_id> ^
    [--title "Название"] [--parent <ветка>] [--from-step <A_002>] ^
    [--status {experiment,success,closed}] [--closed-reason "причина"]
  ```
  Можно не указывать `branch_id` — он сгенерируется автоматически (A..Z, потом ZA, ZB, ...).  
  При создании любой ветки автоматически создаётся первый шаг `001` (включая шаблон файлов).
- Создать шаг:  
  ```bash
  python ai_flow.py new-step <project_path> <branch_id> <step_id> [--from-step <A_002>]
  ```
  Если не указать `step_id`, выберется следующий номер в ветке: 001, 002, ...
- Сгенерировать диаграмму по веткам и шагам:  
  ```bash
  python ai_flow.py diagram <project_path> [--output branches/diagram.mmd]
  ```

## Структура файлов
- `project.md` - цель, контекст, ограничения, критерии успеха.
- `plan.md` - этапы, задачи, активная ветка, статус плана.
- `journal.md` - один прогон ИИ = одна запись (дата, ветка, шаг, статус, краткий результат).
- `branches/<branch_id>/branch-info.md` - паспорт ветки.
- `branches/<branch_id>/runs/<step_id>/` - папка шага:
  - `prompt.md` - цель шага, контекст, текст промпта (как отправлен).
  - `context.md` - выдержки и заметки, используемые в промпте.
  - `result_raw.md` - сырой ответ модели без правок.
  - `evaluation.md` - оценка шага (статусы: success | partial | fail).

## Статусы веток
- Поддерживаемые: `experiment` (по умолчанию), `success`, `closed`.
- Указываются при создании ветки опцией `--status`. Для `closed` можно (и желательно) задать `--closed-reason "причина"`.
- Значения пишутся в `branch-info.md` в полях `Статус` и `Причина закрытия`; при необходимости можно обновить вручную.

## Git
- `init-project` выполняет `git init`, если репозиторий отсутствует.
- `create-branch` создаёт git-ветку с именем branch_id. Если указан `--parent`, ветка базируется на родительской; иначе — на текущей HEAD.
- `create-branch` автоматически создаёт шаг `001` (с шаблонами) в новой ветке.
- `new-step` перед созданием файлов переключается на git-ветку branch_id (создаст её от родительской, если её ещё нет) и откажется работать, если в репозитории есть незакоммиченные изменения.

## Пример сценария с ветвлением
1. Стартуем основную ветку:  
   `python ai_flow.py init-project ai/2025-12-01_rag-search --title "RAG search POC"`  
   `python ai_flow.py create-branch ai/2025-12-01_rag-search A_main --title "Базовый подход"`
2. Делаем первые два шага и фиксируем их:  
   `python ai_flow.py new-step ai/2025-12-01_rag-search A_main A_001` → добавляем prompt/context/result_raw/evaluation, коммитим.  
   `python ai_flow.py new-step ai/2025-12-01_rag-search A_main A_002 --from-step A_001` → коммитим.
3. Ветка с альтернативой после A_002:  
   `python ai_flow.py create-branch ai/2025-12-01_rag-search B_alt-from-A_002 --parent A_main --from-step A_002 --title "Генерация без постфильтра"`  
   `python ai_flow.py new-step ai/2025-12-01_rag-search B_alt-from-A_002 B_001 --from-step A_002`
4. Обновляем статусы: в `branches/B_alt-from-A_002/branch-info.md` ставим `status: success` или `closed` с причиной; в `evaluation.md` шагов отмечаем `success/partial/fail`.
5. Визуализируем: `python ai_flow.py diagram ai/2025-12-01_rag-search --output ai/2025-12-01_rag-search/branches/diagram.mmd`.

## Как писать тест по результатам шага
- Положите проверку рядом с шагом: создайте `branches/<branch_id>/runs/<step_id>/check_result.py` или unittest в `tests/`.
- В тесте читайте `result_raw.md` и проверяйте ожидаемые свойства (ключевые строки, JSON-схему, количество пунктов). Пример на unittest:
  ```python
  from pathlib import Path
  import unittest

  class CheckA002(unittest.TestCase):
      def test_contains_citations(self):
          text = Path("branches/A_main/runs/A_002/result_raw.md").read_text(encoding="utf-8")
          self.assertIn("[1]", text)
          self.assertGreaterEqual(text.count("- "), 3)

  if __name__ == "__main__":
      unittest.main()
  ```
- Подключите тест к CI или запускайте вручную: `python -m unittest path/to/check_result.py`. Считайте тест пройденным только после обновления `evaluation.md` и фиксации в git.

## Диаграмма веток и шагов (Mermaid)
- Команда `diagram` собирает все ветки и шаги проекта и выводит Mermaid-граф с подписью статусов веток и шагов.
- Если указать `--output`, диаграмма сохранится в файл (например, `branches/diagram.mmd`); иначе выводится в stdout.
- Визуальные классы:
  - Ветки: `experiment` (желтый), `success` (зеленый), `closed` (серый), `unknown` (красный).
  - Шаги: `success`, `partial`, `fail`, `unknown`.
- Связи между ветками подписываются `from_step` (если указан при создании ветки); шаги внутри ветки соединены в порядке сортировки по имени.

## Нотации и именование
- branch_id: например, A_main, B_alt-from-A_002, 002.
- step_id: например, A_001, step1 - любая строка, которая корректно выглядит в пути.
- --from-step для шага и для ветки добавляет ссылку на родительский шаг в шаблонах и на диаграмме.

## Автоматические идентификаторы
- Ветки: генерация по алфавиту A..Z, затем ZA, ZB, ..., ZAA и далее, если `branch_id` не указан.
- Шаги: в каждой ветке нумерация 001, 002, 003... по папкам в `runs/`, если `step_id` не указан.

## Планирование шагов
- Планируем шаги по одному и сразу выполняем: меньше дрейфа контекста и проще корректировать курс.
- Можно держать короткий список из 2-3 заготовок вперёд, но фиксировать и выполнять — по одному (result_raw, evaluation, отметки в plan.md/journal.md после каждого).
- Если шаг зависит от предыдущего результата, описывайте его черново и уточняйте после текущего шага.
- Для линейных задач можно расписать цепочку заранее, но прогонять последовательно с обновлением контекста.
- При смене стратегии заводите новую ветку (status=closed у старой с причиной) и продолжайте с одного шага в новой ветке.

### Пример записи в `journal.md`
Формат свободный, но фиксируем дату, ветку, шаг, статус и итог:
```
2025-01-21 | A_main/A_002 | status: success | Итог: улучшили промпт, метрика recall +6%.
2025-01-21 | B_alt-from-A_002/B_001 | status: partial | Итог: без постфильтра precision просел, нужна доп. фильтрация источников.
```
