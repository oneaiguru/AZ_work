import argparse
import contextlib
import io
import os
import re
import subprocess
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import ai_flow

BASE_DIR = os.path.abspath(os.environ.get("AI_FLOW_WEB_ROOT", REPO_ROOT))
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

app = FastAPI(title="ai_flow_web")
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")),
    name="static",
)


def is_within_base(path: str) -> bool:
    base = os.path.normcase(BASE_DIR)
    target = os.path.normcase(path)
    return target == base or target.startswith(base + os.sep)


def resolve_project_path(raw_path: str, must_exist: bool) -> Tuple[Optional[str], Optional[str]]:
    if not raw_path or not raw_path.strip():
        return None, "Project path is required."

    candidate = raw_path.strip()
    if os.path.isabs(candidate):
        abs_path = os.path.abspath(candidate)
    else:
        abs_path = os.path.abspath(os.path.join(BASE_DIR, candidate))

    if not is_within_base(abs_path):
        return None, f"Project path must be inside base root: {BASE_DIR}"
    if os.path.exists(abs_path) and not os.path.isdir(abs_path):
        return None, "Project path exists and is not a directory."
    if must_exist and not os.path.isdir(abs_path):
        return None, "Project path does not exist."

    return abs_path, None


def resolve_output_path(raw_output: str, project_path: str) -> Tuple[Optional[str], Optional[str]]:
    if not raw_output or not raw_output.strip():
        return None, None

    candidate = raw_output.strip()
    if os.path.isabs(candidate):
        abs_path = os.path.abspath(candidate)
    else:
        abs_path = os.path.abspath(os.path.join(project_path, candidate))

    if not is_within_base(abs_path):
        return None, f"Output path must be inside base root: {BASE_DIR}"

    return abs_path, None


def validate_id(value: str, label: str, required: bool = False) -> Optional[str]:
    if not value or not value.strip():
        if required:
            return f"{label} is required."
        return None
    if not ID_RE.match(value.strip()):
        return f"{label} must use letters, numbers, underscore, or dash."
    return None


def validate_date(value: str) -> Optional[str]:
    if not value or not value.strip():
        return None
    if not DATE_RE.match(value.strip()):
        return "Date must be in YYYY-MM-DD format."
    try:
        datetime.strptime(value.strip(), "%Y-%m-%d")
    except ValueError:
        return "Date must be a valid calendar date."
    return None


def run_command(func, args: argparse.Namespace) -> Dict[str, str]:
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    exit_code = 0

    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            func(args)
    except SystemExit as exc:
        exit_code = int(exc.code) if isinstance(exc.code, int) else 1
    except Exception as exc:
        exit_code = 1
        stderr_buf.write(str(exc))

    return {
        "exit_code": exit_code,
        "stdout": stdout_buf.getvalue(),
        "stderr": stderr_buf.getvalue(),
    }


def render_form(
    request: Request, template: str, title: str, values: Dict[str, str], errors: List[str]
) -> HTMLResponse:
    return templates.TemplateResponse(
        template,
        {
            "request": request,
            "title": title,
            "base_dir": BASE_DIR,
            "values": values,
            "errors": errors,
            "branch_statuses": ai_flow.BRANCH_STATUSES,
        },
    )


def render_confirm(
    request: Request,
    title: str,
    form_action: str,
    back_url: str,
    fields: List[Dict[str, str]],
    hidden_fields: Dict[str, str],
    note: str,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "confirm.html",
        {
            "request": request,
            "title": title,
            "base_dir": BASE_DIR,
            "form_action": form_action,
            "back_url": back_url,
            "fields": fields,
            "hidden_fields": [
                {"name": key, "value": value or ""} for key, value in hidden_fields.items()
            ],
            "note": note,
        },
    )


def render_result(
    request: Request,
    title: str,
    ok: bool,
    stdout: str,
    stderr: str,
    detail_fields: List[Dict[str, str]],
    diagram: Optional[str] = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "result.html",
        {
            "request": request,
            "title": title,
            "base_dir": BASE_DIR,
            "ok": ok,
            "stdout": stdout.strip(),
            "stderr": stderr.strip(),
            "detail_fields": detail_fields,
            "diagram": diagram.strip() if diagram else "",
        },
    )


def git_status_short(project_path: str) -> Optional[str]:
    try:
        proc = subprocess.run(
            ["git", "status", "--short"],
            cwd=project_path,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def discover_projects() -> List[Dict[str, str]]:
    projects: List[Dict[str, str]] = []
    try:
        for entry in sorted(os.listdir(BASE_DIR)):
            path = os.path.join(BASE_DIR, entry)
            if not os.path.isdir(path):
                continue
            if not os.path.isfile(os.path.join(path, "project.md")):
                continue
            projects.append({"name": entry, "path": path})
    except OSError:
        pass
    return projects


@app.get("/projects")
def project_list() -> Dict[str, List[Dict[str, str]]]:
    return {"projects": discover_projects()}


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "title": "ai_flow_web",
            "base_dir": BASE_DIR,
        },
    )


@app.get("/init", response_class=HTMLResponse)
def init_form(request: Request) -> HTMLResponse:
    return render_form(
        request,
        "form_init.html",
        "Init project",
        {"project_path": "", "title": "", "date": ""},
        [],
    )


@app.post("/init/prepare", response_class=HTMLResponse)
def init_prepare(
    request: Request,
    project_path: str = Form(...),
    title: str = Form(""),
    date: str = Form(""),
) -> HTMLResponse:
    values = {"project_path": project_path, "title": title, "date": date}
    errors: List[str] = []

    abs_project, error = resolve_project_path(project_path, must_exist=False)
    if error:
        errors.append(error)
    if abs_project and os.path.exists(abs_project) and not os.path.isdir(abs_project):
        errors.append("Project path exists but is not a directory.")

    date_error = validate_date(date)
    if date_error:
        errors.append(date_error)

    if errors:
        return render_form(request, "form_init.html", "Init project", values, errors)

    fields = [
        {"label": "Project path", "value": abs_project or ""},
        {"label": "Title", "value": title.strip() or "(auto)"},
        {"label": "Date", "value": date.strip() or "(today)"},
    ]
    return render_confirm(
        request,
        "Confirm init-project",
        "/init/run",
        "/init",
        fields,
        {"project_path": abs_project or "", "title": title.strip(), "date": date.strip()},
        "This will create folders and files under the project path.",
    )


@app.post("/init/run", response_class=HTMLResponse)
def init_run(
    request: Request,
    project_path: str = Form(...),
    title: str = Form(""),
    date: str = Form(""),
    confirm: str = Form(""),
) -> HTMLResponse:
    if confirm.lower() != "yes":
        return render_form(
            request,
            "form_init.html",
            "Init project",
            {"project_path": project_path, "title": title, "date": date},
            ["Confirmation is required to run this operation."],
        )

    errors: List[str] = []
    abs_project, error = resolve_project_path(project_path, must_exist=False)
    if error:
        errors.append(error)
    date_error = validate_date(date)
    if date_error:
        errors.append(date_error)
    if errors:
        return render_form(
            request,
            "form_init.html",
            "Init project",
            {"project_path": project_path, "title": title, "date": date},
            errors,
        )

    args = argparse.Namespace(
        path=abs_project or project_path,
        title=title.strip() or None,
        date=date.strip() or None,
    )
    result = run_command(ai_flow.cmd_init_project, args)
    detail_fields = [
        {"label": "Project path", "value": abs_project or project_path},
        {"label": "Title", "value": title.strip() or "(auto)"},
        {"label": "Date", "value": date.strip() or "(today)"},
    ]
    return render_result(
        request,
        "Init project result",
        result["exit_code"] == 0,
        result["stdout"],
        result["stderr"],
        detail_fields,
    )


@app.get("/branch", response_class=HTMLResponse)
def branch_form(request: Request) -> HTMLResponse:
    return render_form(
        request,
        "form_branch.html",
        "Create branch",
        {
            "project_path": "",
            "branch_id": "",
            "title": "",
            "parent": "",
            "from_step": "",
            "status": "experiment",
            "closed_reason": "",
        },
        [],
    )


@app.post("/branch/prepare", response_class=HTMLResponse)
def branch_prepare(
    request: Request,
    project_path: str = Form(...),
    branch_id: str = Form(""),
    title: str = Form(""),
    parent: str = Form(""),
    from_step: str = Form(""),
    status: str = Form("experiment"),
    closed_reason: str = Form(""),
) -> HTMLResponse:
    values = {
        "project_path": project_path,
        "branch_id": branch_id,
        "title": title,
        "parent": parent,
        "from_step": from_step,
        "status": status,
        "closed_reason": closed_reason,
    }
    errors: List[str] = []

    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)
    if abs_project:
        branches_dir = os.path.join(abs_project, "branches")
        if not os.path.isdir(branches_dir):
            errors.append("Project path does not contain a branches directory.")
    if abs_project:
        branches_dir = os.path.join(abs_project, "branches")
        if not os.path.isdir(branches_dir):
            errors.append("Project path does not contain a branches directory.")

    id_error = validate_id(branch_id, "Branch id", required=False)
    if id_error:
        errors.append(id_error)

    parent_error = validate_id(parent, "Parent branch id", required=False)
    if parent_error:
        errors.append(parent_error)

    from_step_error = validate_id(from_step, "From-step id", required=False)
    if from_step_error:
        errors.append(from_step_error)

    if status not in ai_flow.BRANCH_STATUSES:
        errors.append("Status must be a valid branch status.")

    if status == "closed" and not closed_reason.strip():
        errors.append("Closed reason is required when status is closed.")

    if abs_project and branch_id.strip():
        branch_dir = os.path.join(abs_project, "branches", branch_id.strip())
        if os.path.exists(branch_dir):
            errors.append("Branch already exists at this project path.")

    if abs_project and branch_id.strip():
        branch_dir = os.path.join(abs_project, "branches", branch_id.strip())
        if os.path.exists(branch_dir):
            errors.append("Branch already exists at this project path.")

    if errors:
        return render_form(request, "form_branch.html", "Create branch", values, errors)

    fields = [
        {"label": "Project path", "value": abs_project or ""},
        {"label": "Branch id", "value": branch_id.strip() or "(auto)"},
        {"label": "Title", "value": title.strip() or "(auto)"},
        {"label": "Parent", "value": parent.strip() or "(none)"},
        {"label": "From-step", "value": from_step.strip() or "(n/a)"},
        {"label": "Status", "value": status},
        {"label": "Closed reason", "value": closed_reason.strip() or "(n/a)"},
    ]

    return render_confirm(
        request,
        "Confirm create-branch",
        "/branch/run",
        "/branch",
        fields,
        {
            "project_path": abs_project or "",
            "branch_id": branch_id.strip(),
            "title": title.strip(),
            "parent": parent.strip(),
            "from_step": from_step.strip(),
            "status": status,
            "closed_reason": closed_reason.strip(),
        },
        "This will create a branch folder, metadata files, and a first step.",
    )


@app.post("/branch/run", response_class=HTMLResponse)
def branch_run(
    request: Request,
    project_path: str = Form(...),
    branch_id: str = Form(""),
    title: str = Form(""),
    parent: str = Form(""),
    from_step: str = Form(""),
    status: str = Form("experiment"),
    closed_reason: str = Form(""),
    confirm: str = Form(""),
) -> HTMLResponse:
    if confirm.lower() != "yes":
        return render_form(
            request,
            "form_branch.html",
            "Create branch",
            {
                "project_path": project_path,
                "branch_id": branch_id,
                "title": title,
                "parent": parent,
                "from_step": from_step,
                "status": status,
                "closed_reason": closed_reason,
            },
            ["Confirmation is required to run this operation."],
        )

    errors: List[str] = []
    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)

    id_error = validate_id(branch_id, "Branch id", required=False)
    if id_error:
        errors.append(id_error)

    parent_error = validate_id(parent, "Parent branch id", required=False)
    if parent_error:
        errors.append(parent_error)

    from_step_error = validate_id(from_step, "From-step id", required=False)
    if from_step_error:
        errors.append(from_step_error)

    branch_dir = None
    if abs_project and branch_id.strip():
        branch_dir = os.path.join(abs_project, "branches", branch_id.strip())
        if os.path.exists(branch_dir):
            errors.append("Branch already exists at this project path.")

    if status not in ai_flow.BRANCH_STATUSES:
        errors.append("Status must be a valid branch status.")

    if status == "closed" and not closed_reason.strip():
        errors.append("Closed reason is required when status is closed.")

    if errors:
        return render_form(
            request,
            "form_branch.html",
            "Create branch",
            {
                "project_path": project_path,
                "branch_id": branch_id,
                "title": title,
                "parent": parent,
                "from_step": from_step,
                "status": status,
                "closed_reason": closed_reason,
            },
            errors,
        )

    args = argparse.Namespace(
        project_path=abs_project or project_path,
        branch_id=branch_id.strip() or None,
        title=title.strip() or None,
        parent=parent.strip() or None,
        from_step=from_step.strip() or None,
        status=status,
        closed_reason=closed_reason.strip() or None,
    )
    result = run_command(ai_flow.cmd_create_branch, args)
    detail_fields = [
        {"label": "Project path", "value": project_path},
        {"label": "Branch id", "value": branch_id.strip() or "(auto)"},
        {"label": "Title", "value": title.strip() or "(auto)"},
        {"label": "Parent", "value": parent.strip() or "(none)"},
        {"label": "From-step", "value": from_step.strip() or "(n/a)"},
        {"label": "Status", "value": status},
        {"label": "Closed reason", "value": closed_reason.strip() or "(n/a)"},
    ]
    return render_result(
        request,
        "Create branch result",
        result["exit_code"] == 0,
        result["stdout"],
        result["stderr"],
        detail_fields,
    )


@app.get("/step", response_class=HTMLResponse)
def step_form(request: Request) -> HTMLResponse:
    return render_form(
        request,
        "form_step.html",
        "New step",
        {"project_path": "", "branch_id": "", "step_id": "", "from_step": ""},
        [],
    )


@app.post("/step/prepare", response_class=HTMLResponse)
def step_prepare(
    request: Request,
    project_path: str = Form(...),
    branch_id: str = Form(...),
    step_id: str = Form(""),
    from_step: str = Form(""),
) -> HTMLResponse:
    values = {
        "project_path": project_path,
        "branch_id": branch_id,
        "step_id": step_id,
        "from_step": from_step,
    }
    errors: List[str] = []

    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)
    if abs_project:
        branches_dir = os.path.join(abs_project, "branches")
        if not os.path.isdir(branches_dir):
            errors.append("Project path does not contain a branches directory.")

    branch_error = validate_id(branch_id, "Branch id", required=True)
    if branch_error:
        errors.append(branch_error)

    step_error = validate_id(step_id, "Step id", required=False)
    if step_error:
        errors.append(step_error)

    from_step_error = validate_id(from_step, "From-step id", required=False)
    if from_step_error:
        errors.append(from_step_error)

    branch_dir = None
    if abs_project and branch_id.strip():
        branch_dir = os.path.join(abs_project, "branches", branch_id.strip())
        if not os.path.isdir(branch_dir):
            errors.append("Branch id does not exist in this project.")

    if branch_dir and step_id.strip():
        step_dir = os.path.join(branch_dir, "runs", step_id.strip())
        if os.path.exists(step_dir):
            errors.append("Step id already exists in this branch.")

    if errors:
        return render_form(request, "form_step.html", "New step", values, errors)

    fields = [
        {"label": "Project path", "value": abs_project or ""},
        {"label": "Branch id", "value": branch_id.strip()},
        {"label": "Step id", "value": step_id.strip() or "(auto)"},
        {"label": "From-step", "value": from_step.strip() or "(none)"},
    ]
    return render_confirm(
        request,
        "Confirm new-step",
        "/step/run",
        "/step",
        fields,
        {
            "project_path": abs_project or "",
            "branch_id": branch_id.strip(),
            "step_id": step_id.strip(),
            "from_step": from_step.strip(),
        },
        "This will create new run files and may run git checks.",
    )


@app.post("/step/run", response_class=HTMLResponse)
def step_run(
    request: Request,
    project_path: str = Form(...),
    branch_id: str = Form(...),
    step_id: str = Form(""),
    from_step: str = Form(""),
    confirm: str = Form(""),
) -> HTMLResponse:
    if confirm.lower() != "yes":
        return render_form(
            request,
            "form_step.html",
            "New step",
            {
                "project_path": project_path,
                "branch_id": branch_id,
                "step_id": step_id,
                "from_step": from_step,
            },
            ["Confirmation is required to run this operation."],
        )

    errors: List[str] = []
    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)

    branch_error = validate_id(branch_id, "Branch id", required=True)
    if branch_error:
        errors.append(branch_error)

    step_error = validate_id(step_id, "Step id", required=False)
    if step_error:
        errors.append(step_error)

    from_step_error = validate_id(from_step, "From-step id", required=False)
    if from_step_error:
        errors.append(from_step_error)

    if errors:
        return render_form(
            request,
            "form_step.html",
            "New step",
            {
                "project_path": project_path,
                "branch_id": branch_id,
                "step_id": step_id,
                "from_step": from_step,
            },
            errors,
        )

    args = argparse.Namespace(
        project_path=abs_project or project_path,
        branch_id=branch_id.strip(),
        step_id=step_id.strip() or None,
        from_step=from_step.strip() or None,
    )
    result = run_command(ai_flow.cmd_new_step, args)
    detail_fields = [
        {"label": "Project path", "value": project_path},
        {"label": "Branch id", "value": branch_id.strip()},
        {"label": "Step id", "value": step_id.strip() or "(auto)"},
        {"label": "From-step", "value": from_step.strip() or "(none)"},
    ]
    return render_result(
        request,
        "New step result",
        result["exit_code"] == 0,
        result["stdout"],
        result["stderr"],
        detail_fields,
    )


@app.get("/diagram", response_class=HTMLResponse)
def diagram_form(request: Request) -> HTMLResponse:
    return render_form(
        request,
        "form_diagram.html",
        "Generate diagram",
        {"project_path": "", "output": ""},
        [],
    )


@app.post("/diagram/prepare", response_class=HTMLResponse)
def diagram_prepare(
    request: Request,
    project_path: str = Form(...),
    output: str = Form(""),
) -> HTMLResponse:
    values = {"project_path": project_path, "output": output}
    errors: List[str] = []

    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)

    if abs_project:
        branches_dir = os.path.join(abs_project, "branches")
        if not os.path.isdir(branches_dir):
            errors.append("Project path does not contain a branches directory.")

    abs_output, output_error = resolve_output_path(output, abs_project or BASE_DIR)
    if output_error:
        errors.append(output_error)

    if errors:
        return render_form(request, "form_diagram.html", "Generate diagram", values, errors)

    output_display = abs_output if abs_output else "(print to page)"
    fields = [
        {"label": "Project path", "value": abs_project or ""},
        {"label": "Output", "value": output_display},
    ]
    return render_confirm(
        request,
        "Confirm diagram",
        "/diagram/run",
        "/diagram",
        fields,
        {
            "project_path": abs_project or "",
            "output": abs_output or "",
        },
        "This will read branch data and render Mermaid output.",
    )


@app.post("/diagram/run", response_class=HTMLResponse)
def diagram_run(
    request: Request,
    project_path: str = Form(...),
    output: str = Form(""),
    confirm: str = Form(""),
) -> HTMLResponse:
    if confirm.lower() != "yes":
        return render_form(
            request,
            "form_diagram.html",
            "Generate diagram",
            {"project_path": project_path, "output": output},
            ["Confirmation is required to run this operation."],
        )

    errors: List[str] = []
    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)

    abs_output, output_error = resolve_output_path(output, abs_project or BASE_DIR)
    if output_error:
        errors.append(output_error)

    if errors:
        return render_form(
            request,
            "form_diagram.html",
            "Generate diagram",
            {"project_path": project_path, "output": output},
            errors,
        )

    args = argparse.Namespace(
        project_path=abs_project or project_path,
        output=abs_output or None,
    )
    result = run_command(ai_flow.cmd_generate_mermaid, args)
    diagram_text = ""
    if not output.strip() and result["exit_code"] == 0:
        diagram_text = result["stdout"]

    detail_fields = [
        {"label": "Project path", "value": project_path},
        {"label": "Output", "value": output.strip() or "(print to page)"},
    ]
    return render_result(
        request,
        "Diagram result",
        result["exit_code"] == 0,
        result["stdout"],
        result["stderr"],
        detail_fields,
        diagram=diagram_text,
    )


@app.get("/commit", response_class=HTMLResponse)
def commit_form(request: Request) -> HTMLResponse:
    return render_form(
        request,
        "form_commit.html",
        "Commit changes",
        {"project_path": "", "prompt": ""},
        [],
    )


@app.post("/commit/prepare", response_class=HTMLResponse)
def commit_prepare(
    request: Request,
    project_path: str = Form(...),
    prompt: str = Form(""),
) -> HTMLResponse:
    values = {"project_path": project_path, "prompt": prompt}
    errors: List[str] = []

    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)
    if abs_project:
        git_dir = os.path.join(abs_project, ".git")
        if not os.path.isdir(git_dir):
            errors.append("В каталоге проекта не найден git-репозиторий.")
    status_output = ""
    if abs_project and not errors:
        status_status = git_status_short(abs_project)
        if status_status is None:
            errors.append("Не удалось выполнить git status (git может быть недоступен).")
        elif not status_status.strip():
            errors.append("Нет незакоммиченных изменений для коммита.")
        else:
            status_output = status_status

    if errors:
        return render_form(request, "form_commit.html", "Commit changes", values, errors)

    fields = [
        {"label": "Project path", "value": abs_project or ""},
        {"label": "Codex prompt", "value": prompt.strip() or "(none)"},
        {"label": "Uncommitted changes", "value": status_output.strip() or "(cannot read)"},
    ]
    return render_confirm(
        request,
        "Confirm commit",
        "/commit/run",
        "/commit",
        fields,
        {"project_path": abs_project or "", "prompt": prompt.strip()},
        "Это добавит все изменения в индекс и создаст коммит с помощью Codex.",
    )


@app.post("/commit/run", response_class=HTMLResponse)
def commit_run(
    request: Request,
    project_path: str = Form(...),
    prompt: str = Form(""),
    confirm: str = Form(""),
) -> HTMLResponse:
    if confirm.lower() != "yes":
        return render_form(
            request,
            "form_commit.html",
            "Commit changes",
            {"project_path": project_path, "prompt": prompt},
            ["Требуется подтверждение для выполнения операции."],
        )

    errors: List[str] = []
    abs_project, error = resolve_project_path(project_path, must_exist=True)
    if error:
        errors.append(error)
    if abs_project:
        git_dir = os.path.join(abs_project, ".git")
        if not os.path.isdir(git_dir):
            errors.append("В каталоге проекта не найден git-репозиторий.")
    if errors:
        return render_form(
            request,
            "form_commit.html",
            "Commit changes",
            {"project_path": project_path, "prompt": prompt},
            errors,
        )

    args = argparse.Namespace(
        project_path=abs_project or project_path,
        message="",
        prompt=prompt,
    )
    result = run_command(ai_flow.cmd_commit, args)
    detail_fields = [
        {"label": "Project path", "value": abs_project or project_path},
        {"label": "Codex prompt", "value": prompt.strip() or "(none)"},
    ]
    return render_result(
        request,
        "Commit result",
        result["exit_code"] == 0,
        result["stdout"],
        result["stderr"],
        detail_fields,
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "base_dir": BASE_DIR}
