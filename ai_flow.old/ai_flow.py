#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ai_flow.py — утилита для управления структурой проектов с ИИ:
- создание проекта;
- создание ветки рассуждений;
- создание шага (run) с шаблонными файлами.

Поддерживает привязку нового шага к родительскому (опция --from-step):
- автоматически прописывает родительский шаг в prompt.md;
- подставляет путь к result_raw.md родительского шага в секции контекста.

Примеры:
    python ai_flow.py --help

    # создать проект
    python ai_flow.py init-project ai/2025-12-01_my-project --title "Мой проект"

    # создать ветку
    python ai_flow.py create-branch ai/2025-12-01_my-project A_main --title "Основная ветка"

    # создать шаг с привязкой к A_002
    python ai_flow.py new-step ai/2025-12-01_my-project B_from-A_002 B_001 --from-step A_002
"""

import argparse
import os
import re
import subprocess
import sys
from datetime import date, datetime
from typing import Dict, List, Optional, Set, Tuple

BRANCH_STATUSES = ("experiment", "success", "closed")
BRANCH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

# ---------- Шаблоны ----------

PROJECT_TEMPLATE = """# Проект: {project_title}

## Базовая информация

- Дата начала: {date}
- Каталог: {project_dir}
- Статус: draft

## Цель проекта

<опишите цель проекта здесь>

## Контекст

- ...

## Ограничения и допущения

- ...

## Критерии успеха

- [ ] Определить критерий 1
- [ ] Определить критерий 2

## Структура

- План: plan.md
- Журнал шагов: journal.md
- Ветки рассуждений: branches/
"""

PLAN_TEMPLATE = """# План проекта

## Текущее состояние

- Активная ветка: A_main (по умолчанию, при наличии)
- Статус: draft

## Этапы

1. Этап 1 — <описание>
   - [ ] Задача 1.1
   - [ ] Задача 1.2

2. Этап 2 — <описание>
   - [ ] Задача 2.1
   - [ ] Задача 2.2

## Сделано (кратко)

- (заполняйте по мере выполнения шагов)
"""

JOURNAL_TEMPLATE = """# Журнал шагов

> Каждый прогон ИИ = одна запись.
> Записывайте: дату, ветку, шаг, статус и краткий результат.

---

"""

BRANCH_INFO_TEMPLATE = """# Ветка: {branch_id}

## Общая информация

- Идентификатор: {branch_id}
- Название: {branch_title}
- Дата создания: {date}
- Статус: {status}  # experiment | success | closed
- Причина закрытия: {closed_reason}

## Родительская ветка

- Родитель: {parent}
- Точка ответвления (шаг): {from_step}

## Цель ветки

<опишите цель ветки здесь>

## Стратегия

- <особенности промптов / подхода в этой ветке>

## История шагов (кратко)

- {branch_id}_001 — ...
"""

PROMPT_TEMPLATE = """# Промпт шага {step_id}

- Проект: {project_title}
- Ветка: {branch_id}
- Шаг: {step_id}
- Дата/время: {datetime}
- Родительский шаг: {parent_step}

## Цель шага

Кратко, что хотим получить от ИИ в этом прогоне.

## Использованный контекст

Перечислите файлы/источники контекста:
- project.md
- plan.md
- journal.md
{parent_result_path_line}
- ...

## Текст промпта (как отправлен ИИ)

```text
<сюда вставьте текст промпта один в один>
```
"""

CONTEXT_TEMPLATE = """# Контекст шага

Сюда можно складывать выдержки/заметки, которые вы копируете в промпт
или которые относятся именно к этому шагу.
"""

RESULT_RAW_TEMPLATE = """# Сырой результат ИИ

Вставьте сюда ответ модели БЕЗ изменений.
"""

EVALUATION_TEMPLATE = """# Оценка шага {step_id}

- Ветка: {branch_id}
- Шаг: {step_id}
- Дата/время оценки: {datetime}
- Ответ ИИ: result_raw.md
- Статус: success | partial | fail

## Что получилось хорошо

- ...

## Какие проблемы

- ...

## Вывод по шагу

- ...

## Дальнейшие действия

- [ ] Следующий шаг в этой ветке
- [ ] Создать новую ветку с другой стратегией промптов
"""

# ---------- Вспомогательные функции ----------


def write_file_if_not_exists(path: str, content: str) -> None:
    """Создать файл с содержимым, если его ещё нет."""
    directory = os.path.dirname(path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)

    if os.path.exists(path):
        print(f"[SKIP] Файл уже существует: {path}")
        return

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK]   Создан файл: {path}")


def ensure_dir(path: str) -> None:
    """Создать каталог, если его нет."""
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        print(f"[OK]   Создан каталог: {path}")
    elif not os.path.isdir(path):
        print(f"[ERR] Путь существует, но это не каталог: {path}", file=sys.stderr)
        sys.exit(1)


def run_git(
    cwd: str,
    *args: str,
    env: Optional[Dict[str, str]] = None,
) -> Optional[subprocess.CompletedProcess]:
    """Выполнить git-команду, вернуть CompletedProcess или None, если git недоступен."""
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            env=env,
        )
    except FileNotFoundError:
        print("[WARN] git не найден в PATH, пропускаю git-операцию.", file=sys.stderr)
        return None

    if proc.stdout:
        print(proc.stdout.strip())
    if proc.stderr and proc.returncode != 0:
        print(proc.stderr.strip(), file=sys.stderr)
    return proc


def ensure_git_repo(project_path: str) -> bool:
    """Инициализировать git-репозиторий, если его ещё нет."""
    git_dir = os.path.join(project_path, ".git")
    if os.path.isdir(git_dir):
        return True

    proc = run_git(project_path, "init")
    if proc and proc.returncode == 0:
        print(f"[OK]   Инициализирован git-репозиторий: {project_path}")
        return True

    print("[WARN] Не удалось инициализировать git-репозиторий.", file=sys.stderr)
    return False


def git_has_head(project_path: str) -> bool:
    git_dir = os.path.join(project_path, ".git")
    if not os.path.isdir(git_dir):
        return False

    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--verify", "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return False

    return proc.returncode == 0


def git_branch_exists(project_path: str, branch: str) -> bool:
    if not git_has_head(project_path):
        return False

    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--verify", "--quiet", branch],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return False

    return proc.returncode == 0


def git_current_branch(project_path: str) -> Optional[str]:
    if not git_has_head(project_path):
        return None

    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None

    if proc.returncode != 0:
        return None

    return (proc.stdout or "").strip()


def git_create_branch(project_path: str, branch: str, base: Optional[str] = None) -> None:
    """Создать git-ветку (без переключения), опираясь на base если она существует."""
    if not ensure_git_repo(project_path):
        return
    if git_branch_exists(project_path, branch):
        return

    if not git_has_head(project_path):
        return

    if base and git_branch_exists(project_path, base):
        run_git(project_path, "branch", branch, base)
    else:
        run_git(project_path, "branch", branch)


def git_is_clean(project_path: str) -> Optional[bool]:
    """Проверить, что в git-репозитории нет незакоммиченных изменений."""
    git_dir = os.path.join(project_path, ".git")
    if not os.path.isdir(git_dir):
        return None

    proc = run_git(project_path, "status", "--porcelain")
    if proc is None:
        return None

    return proc.returncode == 0 and not (proc.stdout or "").strip()


def git_checkout_branch(project_path: str, branch: str, base: Optional[str] = None) -> None:
    """Переключиться на ветку; если её нет — создать от base или текущей HEAD."""
    if not ensure_git_repo(project_path):
        return

    if git_branch_exists(project_path, branch):
        run_git(project_path, "checkout", branch)
        return

    args = ["checkout", "-b", branch]
    if base and git_branch_exists(project_path, base):
        args.append(base)
    run_git(project_path, *args)


def git_stage_all(project_path: str) -> Optional[subprocess.CompletedProcess]:
    """Добавить все файлы в индекс."""
    return run_git(project_path, "add", "--all")


def git_commit(project_path: str, message: str) -> Optional[subprocess.CompletedProcess]:
    """Сделать коммит с указанием сообщения, используя fallback-identity."""
    name = git_config_get(project_path, "user.name")
    email = git_config_get(project_path, "user.email")

    env = None
    if not name or not email:
        env = os.environ.copy()
        env.setdefault("GIT_AUTHOR_NAME", "AI Flow CLI")
        env.setdefault("GIT_AUTHOR_EMAIL", "ai_flow@example.com")
        env.setdefault("GIT_COMMITTER_NAME", env["GIT_AUTHOR_NAME"])
        env.setdefault("GIT_COMMITTER_EMAIL", env["GIT_AUTHOR_EMAIL"])

    return run_git(project_path, "commit", "-m", message, env=env)


def git_config_get(project_path: str, key: str) -> Optional[str]:
    try:
        proc = subprocess.run(
            ["git", "config", "--get", key],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None

    if proc.returncode != 0:
        return None

    return (proc.stdout or "").strip()


def number_to_letters(index: int) -> str:
    """Преобразовать число в буквенный код A, B, ..., Z, AA, AB, ..."""
    alphabet = BRANCH_ALPHABET
    result = ""
    i = index
    while True:
        i, rem = divmod(i, len(alphabet))
        result = alphabet[rem] + result
        if i == 0:
            break
        i -= 1
    return result


def generate_branch_id(project_path: str) -> str:
    """Сгенерировать новый branch_id: A..Z, затем ZA, ZB, ..., ZAA, ..."""
    branches_root = os.path.join(project_path, "branches")
    if not os.path.isdir(branches_root):
        return "A"

    existing = {
        name.upper()
        for name in os.listdir(branches_root)
        if os.path.isdir(os.path.join(branches_root, name))
    }

    # A..Z
    for ch in BRANCH_ALPHABET:
        if ch.upper() not in existing:
            return ch

    # ZA, ZB, ..., ZZ, ZZA, ZZB, ...
    n = 0
    while True:
        if n < len(BRANCH_ALPHABET):
            candidate = f"Z{number_to_letters(n)}"
        else:
            candidate = f"ZZ{number_to_letters(n - len(BRANCH_ALPHABET))}"
        if candidate.upper() not in existing:
            return candidate
        n += 1


def parse_step_dir_name(name: str, branch_id: str) -> Optional[int]:
    """Найти номер шага в имени каталога."""
    prefix_pattern = re.compile(rf"^{re.escape(branch_id)}_(\d+)$")
    digits_pattern = re.compile(r"^(\d+)$")

    prefix_match = prefix_pattern.match(name)
    if prefix_match:
        return int(prefix_match.group(1))

    digits_match = digits_pattern.match(name)
    if digits_match:
        return int(digits_match.group(1))

    return None


def list_step_info(branch_dir: str, branch_id: str) -> List[Tuple[int, str]]:
    """Вернуть список (номер, имя каталога) существующих шагов, отсортированных по номеру."""
    runs_dir = os.path.join(branch_dir, "runs")
    if not os.path.isdir(runs_dir):
        return []

    info: List[Tuple[int, str]] = []
    for name in os.listdir(runs_dir):
        path = os.path.join(runs_dir, name)
        if not os.path.isdir(path):
            continue
        num = parse_step_dir_name(name, branch_id)
        if num is not None:
            info.append((num, name))

    info.sort(key=lambda item: item[0])
    return info


def get_last_step_id(branch_dir: str, branch_id: str) -> Optional[str]:
    info = list_step_info(branch_dir, branch_id)
    if not info:
        return None
    return info[-1][1]


def generate_step_id(branch_dir: str) -> str:
    """Сгенерировать ID шага внутри ветки: 001, 002, ..."""
    branch_id = os.path.basename(os.path.normpath(branch_dir))
    info = list_step_info(branch_dir, branch_id)
    max_num = info[-1][0] if info else 0
    return f"{branch_id}_{max_num + 1:03d}"


def sanitize_id(value: str) -> str:
    """Преобразовать строку в идентификатор, безопасный для Mermaid."""
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def clean_label(text: str) -> str:
    """Сделать подпись безопасной для Mermaid (без кавычек)."""
    return text.replace('"', "'")


def read_branch_metadata(branch_dir: str) -> dict:
    """Считать ключевые поля ветки из branch-info.md."""
    branch_id = os.path.basename(branch_dir)
    meta = {
        "id": branch_id,
        "title": branch_id,
        "parent": "none",
        "from_step": "n/a",
        "status": "experiment",
        "closed_reason": "n/a",
    }
    info_path = os.path.join(branch_dir, "branch-info.md")
    if not os.path.isfile(info_path):
        return meta

    try:
        with open(info_path, encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if line.startswith("- Название:"):
                    meta["title"] = line.split(":", 1)[1].strip() or meta["title"]
                elif line.startswith("- Родитель:"):
                    meta["parent"] = line.split(":", 1)[1].strip() or "none"
                elif line.startswith("- Точка ответвления"):
                    meta["from_step"] = line.split(":", 1)[1].strip() or "n/a"
                elif line.startswith("- Статус:"):
                    raw_status = (
                        line.split(":", 1)[1]
                        .split("#", 1)[0]
                        .strip()
                        .lower()
                    )
                    meta["status"] = (
                        raw_status if raw_status in BRANCH_STATUSES else "unknown"
                    )
                elif line.startswith("- Причина закрытия"):
                    meta["closed_reason"] = line.split(":", 1)[1].strip() or "n/a"
    except OSError as exc:
        print(f"[ERR] Не удалось прочитать {info_path}: {exc}", file=sys.stderr)
    return meta


def read_step_status(step_dir: str) -> str:
    """Считать статус шага из evaluation.md."""
    evaluation_path = os.path.join(step_dir, "evaluation.md")
    if not os.path.isfile(evaluation_path):
        return "unknown"

    try:
        with open(evaluation_path, encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip().lower()
                if line.startswith("- статус:"):
                    raw_status = line.split(":", 1)[1].strip()
                    if "|" in raw_status:
                        return "unknown"
                    # Берём первое слово, чтобы игнорировать комментарии.
                    return raw_status.split()[0]
    except OSError as exc:
        print(f"[ERR] Не удалось прочитать {evaluation_path}: {exc}", file=sys.stderr)

    return "unknown"


def collect_project_structure(project_path: str) -> List[dict]:
    """Собрать ветки и шаги проекта."""
    branches_root = os.path.join(project_path, "branches")
    branches: List[dict] = []
    if not os.path.isdir(branches_root):
        return branches

    for entry in sorted(os.listdir(branches_root)):
        branch_dir = os.path.join(branches_root, entry)
        if not os.path.isdir(branch_dir):
            continue

        meta = read_branch_metadata(branch_dir)
        runs_dir = os.path.join(branch_dir, "runs")
        steps = []
        if os.path.isdir(runs_dir):
            for step_entry in sorted(os.listdir(runs_dir)):
                step_dir = os.path.join(runs_dir, step_entry)
                if os.path.isdir(step_dir):
                    steps.append(
                        {
                            "id": step_entry,
                            "status": read_step_status(step_dir),
                        }
                    )
        meta["steps"] = steps
        branches.append(meta)

    return branches


def build_mermaid_diagram(branches: List[dict]) -> str:
    """Собрать Mermaid-диаграмму по веткам и шагам."""
    lines: List[str] = [
        "graph TD",
        "  %% Автогенерация: ветки и шаги с подписями статусов",
    ]

    branch_nodes: Dict[str, str] = {}
    placeholder_parents: Set[str] = set()

    # Узлы веток
    for branch in branches:
        branch_slug = sanitize_id(branch["id"])
        node_id = f"branch_{branch_slug}"
        branch_nodes[branch["id"]] = node_id

        status = (branch.get("status") or "unknown").lower()
        status_class = status if status in BRANCH_STATUSES else "unknown"

        label = f"{branch['id']} ({status})"
        closed_reason = branch.get("closed_reason") or ""
        if status == "closed" and closed_reason and closed_reason.lower() != "n/a":
            label += f" — {closed_reason}"

        lines.append(f'  {node_id}["{clean_label(label)}"]:::branch_{status_class}')

    # Связи между ветками
    lines.append("  %% Связи веток")
    for branch in branches:
        parent = str(branch.get("parent", "")).strip()
        if parent.lower() in {"none", "n/a", "нет", ""}:
            continue

        if parent not in branch_nodes and parent not in placeholder_parents:
            placeholder_id = f"branch_{sanitize_id(parent)}"
            lines.append(
                f'  {placeholder_id}["{clean_label(parent)}"]:::branch_unknown'
            )
            branch_nodes[parent] = placeholder_id
            placeholder_parents.add(parent)

        parent_node = branch_nodes.get(parent)
        child_node = branch_nodes[branch["id"]]
        edge_label = str(branch.get("from_step", "")).strip()

        if edge_label and edge_label.lower() not in {"n/a", "none"}:
            lines.append(
                f"  {parent_node} -->|{clean_label(edge_label)}| {child_node}"
            )
        else:
            lines.append(f"  {parent_node} --> {child_node}")

    # Шаги внутри веток
    lines.append("  %% Шаги внутри веток")
    for branch in branches:
        branch_node = branch_nodes[branch["id"]]
        prev_step_node = None
        branch_slug = sanitize_id(branch["id"])

        for step in branch.get("steps", []):
            step_slug = sanitize_id(step["id"])
            step_node = f"step_{branch_slug}_{step_slug}"

            status = (step.get("status") or "unknown").lower()
            status_class = status if status in {"success", "partial", "fail"} else "unknown"
            label = f"{branch['id']}/{step['id']} ({status})"
            lines.append(f'  {step_node}["{clean_label(label)}"]:::step_{status_class}')

            if prev_step_node:
                lines.append(f"  {prev_step_node} --> {step_node}")
            else:
                lines.append(f"  {branch_node} --> {step_node}")

            prev_step_node = step_node

    # Определения стилей
    lines.extend(
        [
            "  %% Оформление узлов",
            "  classDef branch_experiment fill:#fff3cd,stroke:#d39e00,color:#8a6d3b;",
            "  classDef branch_success fill:#d4edda,stroke:#2e7d32,color:#1b5e20;",
            "  classDef branch_closed fill:#e2e3e5,stroke:#6c757d,color:#343a40;",
            "  classDef branch_unknown fill:#f8d7da,stroke:#c82333,color:#721c24;",
            "  classDef step_success fill:#d4edda,stroke:#2e7d32,color:#1b5e20;",
            "  classDef step_partial fill:#fff3cd,stroke:#d39e00,color:#8a6d3b;",
            "  classDef step_fail fill:#f8d7da,stroke:#c82333,color:#721c24;",
            "  classDef step_unknown fill:#e2e3e5,stroke:#6c757d,color:#343a40;",
        ]
    )

    return "\n".join(lines)


# ---------- Команды ----------


def cmd_init_project(args: argparse.Namespace) -> None:
    project_path = args.path
    ensure_dir(project_path)

    project_title = args.title or os.path.basename(os.path.abspath(project_path))
    date_str = args.date or date.today().isoformat()
    project_dir_display = os.path.abspath(project_path)

    # Основные файлы проекта
    write_file_if_not_exists(
        os.path.join(project_path, "project.md"),
        PROJECT_TEMPLATE.format(
            project_title=project_title,
            date=date_str,
            project_dir=project_dir_display,
        ),
    )

    write_file_if_not_exists(
        os.path.join(project_path, "plan.md"),
        PLAN_TEMPLATE,
    )

    write_file_if_not_exists(
        os.path.join(project_path, "journal.md"),
        JOURNAL_TEMPLATE,
    )

    git_dir = os.path.join(project_path, ".git")
    repo_existed = os.path.isdir(git_dir)

    # Git
    ensure_git_repo(project_path)

    repo_created = not repo_existed and os.path.isdir(git_dir)

    # Каталог для веток
    ensure_dir(os.path.join(project_path, "branches"))

    # Базовая ветка A с первым шагом 001
    branches_root = os.path.join(project_path, "branches")
    if not os.listdir(branches_root):
        auto_branch_args = argparse.Namespace(
            project_path=project_path,
            branch_id="A",
            title="Основная ветка",
            parent=None,
            from_step=None,
            status="experiment",
            closed_reason=None,
            skip_git_check=True,
        )
        cmd_create_branch(auto_branch_args)


def cmd_create_branch(args: argparse.Namespace) -> None:
    project_path = args.project_path
    branch_id = args.branch_id or generate_branch_id(project_path)

    skip_git_check = bool(getattr(args, "skip_git_check", False))
    if not skip_git_check:
        clean_state = git_is_clean(project_path)
        if clean_state is False:
            print(
                "[ERR] В репозитории есть незакоммиченные изменения. "
                "Сначала зафиксируйте их (commit) или очистите рабочую директорию.",
                file=sys.stderr,
            )
            sys.exit(1)
        if clean_state is None:
            print(
                "[ERR] Не удалось проверить состояние git-репозитория "
                "(git не найден или репозиторий не инициализирован).",
                file=sys.stderr,
            )
            sys.exit(1)

    branches_root = os.path.join(project_path, "branches")
    if not os.path.isdir(branches_root):
        print(
            f"[ERR] В проекте {project_path} не найден каталог 'branches'. "
            f"Сначала выполните init-project.",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.branch_id is None:
        print(f"[OK]   Сгенерирован branch_id: {branch_id}")

    branch_dir = os.path.join(branches_root, branch_id)
    if os.path.exists(branch_dir):
        print(
            f"[ERR] Ветка {branch_id} уже существует в {project_path}.",
            file=sys.stderr,
        )
        sys.exit(1)

    ensure_dir(branch_dir)
    ensure_dir(os.path.join(branch_dir, "runs"))

    branch_title = args.title or branch_id
    parent = args.parent or "none"
    requested_from_step = getattr(args, "from_step", None)
    requested_from_step_clean = (
        str(requested_from_step).strip() if requested_from_step else ""
    )
    from_step = requested_from_step_clean or "n/a"
    status = getattr(args, "status", None) or "experiment"
    closed_reason = getattr(args, "closed_reason", None)
    if status == "closed":
        closed_reason = closed_reason or "<причина не указана>"
    else:
        closed_reason = closed_reason or "n/a"
    date_str = date.today().isoformat()

    branch_info = BRANCH_INFO_TEMPLATE.format(
        branch_id=branch_id,
        branch_title=branch_title,
        parent=parent,
        from_step=from_step,
        date=date_str,
        status=status,
        closed_reason=closed_reason,
    )

    write_file_if_not_exists(
        os.path.join(branch_dir, "branch-info.md"),
        branch_info,
    )

    # Git: создать ветку от родительской (если указана) или от текущей.
    base_branch = None
    parent_branch = str(parent).strip()
    if parent_branch.lower() not in {"none", "n/a", ""}:
        if requested_from_step_clean.lower() not in {"none", "n/a", ""}:
            candidate_branch = requested_from_step_clean
            if git_branch_exists(project_path, candidate_branch):
                base_branch = candidate_branch
            else:
                base_branch = parent_branch
        else:
            base_branch = parent_branch
    else:
        base_branch = git_current_branch(project_path)
    git_create_branch(project_path, branch_id, base_branch)

    # Автошаг 001 для новой ветки
    auto_step_args = argparse.Namespace(
        project_path=project_path,
        branch_id=branch_id,
        step_id=None,
        from_step=args.from_step,
        skip_git_check=True,
    )
    cmd_new_step(auto_step_args)


def infer_branch_id_from_git_branch(branch_name: str) -> str:
    """Выделить логический branch_id из git-ветки (включая шаги)."""
    if "/" in branch_name:
        branch_name = branch_name.split("/", 1)[0]
    if "_" in branch_name:
        base, suffix = branch_name.rsplit("_", 1)
        if suffix.isdigit():
            return base
    return branch_name


def normalize_step_id(branch_id: str, step_reference: str) -> str:
    """Преобразовать ссылку на шаг в имя каталога/ветки (например: 2 → A_002)."""
    raw = str(step_reference).strip()
    if raw.startswith(f"{branch_id}_"):
        return raw
    if raw.isdigit():
        return f"{branch_id}_{int(raw):03d}"
    return raw


def cmd_new_step(args: argparse.Namespace) -> None:
    project_path = args.project_path or "."
    project_path = os.path.abspath(project_path)

    branch_id = args.branch_id
    if branch_id is None:
        current_branch = git_current_branch(project_path)
        if current_branch is None:
            print(
                "[ERR] Не удалось определить ветку: укажите branch_id или выполните команду "
                "внутри git-репозитория с существующей веткой.",
                file=sys.stderr,
            )
            sys.exit(1)
        branch_id = infer_branch_id_from_git_branch(current_branch)
    step_id = args.step_id

    if step_id:
        step_id = normalize_step_id(branch_id, step_id)

    branch_dir = os.path.join(project_path, "branches", branch_id)
    if not os.path.isdir(branch_dir):
        print(
            f"[ERR] Ветка {branch_id} не найдена в проекте {project_path}. "
            f"Сначала создайте её командой create-branch.",
            file=sys.stderr,
        )
        sys.exit(1)

    skip_git_check = bool(getattr(args, "skip_git_check", False))
    if not skip_git_check:
        clean_state = git_is_clean(project_path)
        if clean_state is False:
            print(
                "[ERR] В репозитории есть незакоммиченные изменения. "
                "Сначала зафиксируйте их (commit) или очистите рабочую директорию.",
                file=sys.stderr,
            )
            sys.exit(1)
        if clean_state is None:
            print(
                "[ERR] Не удалось проверить состояние git-репозитория "
                "(git не найден или репозиторий не инициализирован).",
                file=sys.stderr,
            )
            sys.exit(1)

    previous_step = get_last_step_id(branch_dir, branch_id)
    base_for_step_branch = previous_step or branch_id

    if step_id is None:
        step_id = generate_step_id(branch_dir)
        print(f"[OK]   Сгенерирован step_id: {step_id}")

    step_branch = step_id
    git_checkout_branch(project_path, step_branch, base_for_step_branch)

    step_dir = os.path.join(branch_dir, "runs", step_id)
    if os.path.exists(step_dir):
        print(
            f"[ERR] Шаг {step_id} уже существует в ветке {branch_id}.",
            file=sys.stderr,
        )
        sys.exit(1)

    ensure_dir(step_dir)

    dt_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    project_title = os.path.basename(os.path.abspath(project_path))

    # Обработка родительского шага
    if getattr(args, "from_step", None):
        parent_step = f"{branch_id}/{args.from_step}"
        parent_result_rel = f"branches/{branch_id}/runs/{args.from_step}/result_raw.md"
        parent_result_path_line = f"- {parent_result_rel}"
    else:
        parent_step = "<нет, шаг начинается с нуля>"
        parent_result_path_line = "# - (при необходимости добавьте путь к result_raw.md родительского шага)"

    prompt_content = PROMPT_TEMPLATE.format(
        project_title=project_title,
        branch_id=branch_id,
        step_id=step_id,
        datetime=dt_str,
        parent_step=parent_step,
        parent_result_path_line=parent_result_path_line,
    )

    evaluation_content = EVALUATION_TEMPLATE.format(
        branch_id=branch_id,
        step_id=step_id,
        datetime=dt_str,
    )

    # Создаём файлы шага
    write_file_if_not_exists(
        os.path.join(step_dir, "prompt.md"), prompt_content
    )
    write_file_if_not_exists(
        os.path.join(step_dir, "context.md"), CONTEXT_TEMPLATE
    )
    write_file_if_not_exists(
        os.path.join(step_dir, "result_raw.md"), RESULT_RAW_TEMPLATE
    )
    write_file_if_not_exists(
        os.path.join(step_dir, "evaluation.md"), evaluation_content
    )

    git_stage_all(project_path)
    commit_proc = git_commit(project_path, f"Add step {step_branch}")
    if commit_proc is None or commit_proc.returncode != 0:
        print(
            "[WARN] Не удалось создать коммит после генерации шага.",
            file=sys.stderr,
        )

    branch_sync = run_git(project_path, "branch", "-f", branch_id, step_branch)
    if branch_sync is None or branch_sync.returncode != 0:
        print(
            f"[WARN] Не удалось обновить git-ветку {branch_id}.",
            file=sys.stderr,
        )


def cmd_switch(args: argparse.Namespace) -> None:
    project_path = args.project_path or "."
    project_path = os.path.abspath(project_path)

    skip_git_check = bool(getattr(args, "skip_git_check", False))
    if not skip_git_check:
        clean_state = git_is_clean(project_path)
        if clean_state is False:
            print(
                "[ERR] В репозитории есть незакоммиченные изменения. "
                "Сначала зафиксируйте их (commit) или очистите рабочую директорию.",
                file=sys.stderr,
            )
            sys.exit(1)
        if clean_state is None:
            print(
                "[ERR] Не удалось проверить состояние git-репозитория "
                "(git не найден или репозиторий не инициализирован).",
                file=sys.stderr,
            )
            sys.exit(1)

    raw_branch_ref = args.branch_id or git_current_branch(project_path)
    if raw_branch_ref is None:
        print(
            "[ERR] Не удалось определить ветку: укажите branch_id или выполните команду "
            "внутри git-репозитория.",
            file=sys.stderr,
        )
        sys.exit(1)

    branch_id = infer_branch_id_from_git_branch(raw_branch_ref)
    step_ref = getattr(args, "step_id", None)
    if step_ref:
        step_id = normalize_step_id(branch_id, step_ref)
        if not git_branch_exists(project_path, step_id):
            print(
                f"[ERR] Git-ветка {step_id} не найдена.",
                file=sys.stderr,
            )
            sys.exit(1)
        target_branch = step_id
    else:
        if raw_branch_ref != branch_id and git_branch_exists(project_path, raw_branch_ref):
            target_branch = raw_branch_ref
        else:
            target_branch = branch_id

    if not git_branch_exists(project_path, target_branch):
        print(
            f"[ERR] Git-ветка {target_branch} не найдена.",
            file=sys.stderr,
        )
        sys.exit(1)

    git_checkout_branch(project_path, target_branch)
    print(f"[OK]   Переключились на git-ветку: {target_branch}")


def cmd_generate_mermaid(args: argparse.Namespace) -> None:
    project_path = args.project_path
    branches_root = os.path.join(project_path, "branches")
    if not os.path.isdir(branches_root):
        print(
            f"[ERR] В проекте {project_path} не найден каталог 'branches'. "
            f"Сначала выполните init-project.",
            file=sys.stderr,
        )
        sys.exit(1)

    branches = collect_project_structure(project_path)
    diagram = build_mermaid_diagram(branches)

    if args.output:
        output_dir = os.path.dirname(args.output)
        if output_dir:
            ensure_dir(output_dir)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(diagram + "\n")
        print(f"[OK] Mermaid-диаграмма сохранена: {args.output}")
    else:
        print(diagram)


# ---------- Разбор аргументов ----------


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Утилита для управления структурой проектов с ИИ (проекты, ветки, шаги)."
    )

    subparsers = parser.add_subparsers(
        title="команды",
        dest="command",
        help="доступные действия",
    )

    # init-project
    p_init = subparsers.add_parser(
        "init-project",
        aliases=["init"],
        help="Создать новый проект (каталог + базовые файлы).",
    )
    p_init.add_argument(
        "path",
        help="Путь к каталогу проекта "
             "(например: ai/2025-12-01_my-project).",
    )
    p_init.add_argument(
        "--title",
        help="Человекочитаемое название проекта (по умолчанию — имя каталога).",
    )
    p_init.add_argument(
        "--date",
        help="Дата начала проекта в формате YYYY-MM-DD (по умолчанию — сегодня).",
    )
    p_init.set_defaults(func=cmd_init_project)

    # create-branch
    p_branch = subparsers.add_parser(
        "create-branch",
        aliases=["cb", "branch"],
        help="Создать новую ветку рассуждений в проекте.",
    )
    p_branch.add_argument(
        "project_path",
        help="Каталог проекта (например: ai/2025-12-01_my-project).",
    )
    p_branch.add_argument(
        "branch_id",
        nargs="?",
        help="Идентификатор ветки (например: A_main, B_alt-from-A_002). "
             "Если не указан, присвоится автоматически (A..Z, затем ZA..).",
    )
    p_branch.add_argument(
        "--title",
        help="Человекочитаемое название ветки (по умолчанию = branch_id).",
    )
    p_branch.add_argument(
        "--parent",
        help="Родительская ветка (если есть).",
    )
    p_branch.add_argument(
        "--from-step",
        dest="from_step",
        help="ID шага, от которого ответвляемся (например: A_002).",
    )
    p_branch.add_argument(
        "--status",
        choices=BRANCH_STATUSES,
        default="experiment",
        help="Статус ветки: experiment | success | closed.",
    )
    p_branch.add_argument(
        "--closed-reason",
        dest="closed_reason",
        help="Причина закрытия (используйте вместе с --status closed).",
    )
    p_branch.set_defaults(func=cmd_create_branch)

    # switch
    p_switch = subparsers.add_parser(
        "switch",
        aliases=["s"],
        help="Переключиться на git-ветку (ветка или конкретный шаг).",
    )
    p_switch.add_argument(
        "project_path",
        nargs="?",
        default=".",
        help="Каталог проекта (по умолчанию — текущий).",
    )
    p_switch.add_argument(
        "branch_id",
        nargs="?",
        help="Идентификатор ветки (например: A_main). Если не указан, берётся текущая ветка.",
    )
    p_switch.add_argument(
        "--step",
        dest="step_id",
        help="Идентификатор шага (например: A_001). Переключиться на ветку шагов branch/step.",
    )
    p_switch.add_argument(
        "--skip-git-check",
        action="store_true",
        help="Не проверять чистоту git-репозитория перед переключением.",
    )
    p_switch.set_defaults(func=cmd_switch)

    # new-step
    p_step = subparsers.add_parser(
        "new-step",
        aliases=["ns"],
        help="Создать шаблон файлов для нового шага (run) в ветке; "
        "каждый шаг коммитится в отдельную git-ветку branch/step.",
    )
    p_step.add_argument(
        "project_path",
        nargs="?",
        default=".",
        help="Каталог проекта (например: ai/2025-12-01_my-project). "
        "Если не указан, используется текущий каталог.",
    )
    p_step.add_argument(
        "branch_id",
        nargs="?",
        help="Идентификатор ветки (например: A_main). "
        "Если не указан, пробуем взять текущую ветку в git.",
    )
    p_step.add_argument(
        "step_id",
        nargs="?",
        help="Идентификатор шага (например: A_001) — используется как часть git-ветки branch/step. "
             "Если не указан, нумерация внутри ветки: 001, 002, ...",
    )
    p_step.add_argument(
        "--from-step",
        dest="from_step",
        help="ID родительского шага в этой же ветке (например: A_002). "
             "Используется для автозаполнения полей в prompt.md.",
    )
    p_step.set_defaults(func=cmd_new_step)

    # diagram
    p_diagram = subparsers.add_parser(
        "diagram",
        aliases=["diag"],
        help="Сгенерировать Mermaid-диаграмму по всем веткам и шагам.",
    )
    p_diagram.add_argument(
        "project_path",
        help="Каталог проекта (например: ai/2025-12-01_my-project).",
    )
    p_diagram.add_argument(
        "--output",
        help="Путь для сохранения диаграммы (опционально). "
             "Если не указан, диаграмма выводится в stdout.",
    )
    p_diagram.set_defaults(func=cmd_generate_mermaid)

    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
