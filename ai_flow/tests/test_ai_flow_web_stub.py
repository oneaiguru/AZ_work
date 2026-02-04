import importlib
import os
import shutil
import sys
import types
import unittest
import uuid
from pathlib import Path
from unittest import mock


class DummyResponse:
    def __init__(self, template: str, context: dict) -> None:
        self.template = template
        self.context = context


class DummyTemplates:
    def __init__(self, directory: str) -> None:
        self.directory = directory

    def TemplateResponse(self, template: str, context: dict) -> DummyResponse:
        return DummyResponse(template, context)


class DummyFastAPI:
    def __init__(self, title: str = "") -> None:
        self.title = title

    def get(self, _path: str, response_class=None):
        def decorator(func):
            return func

        return decorator

    def post(self, _path: str, response_class=None):
        def decorator(func):
            return func

        return decorator

    def mount(self, *_args, **_kwargs) -> None:
        return None


def Form(default=None, **_kwargs):
    return default


class Request:
    pass


class HTMLResponse:
    pass


class StaticFiles:
    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs


class AiFlowWebStubTests(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parent.parent
        tmp_root = repo_root / ".tmp"
        tmp_root.mkdir(exist_ok=True)
        self.base_dir = tmp_root / f"web_stub_{uuid.uuid4().hex}"
        self.base_dir.mkdir(parents=True, exist_ok=False)
        self.addCleanup(self._cleanup_base_dir)

        self._saved_modules = {}
        self._stub_names = [
            "fastapi",
            "fastapi.responses",
            "fastapi.staticfiles",
            "fastapi.templating",
        ]
        self._install_fastapi_stubs()

        self._old_base_dir = os.environ.get("AI_FLOW_WEB_ROOT")
        os.environ["AI_FLOW_WEB_ROOT"] = str(self.base_dir)

        self._repo_root = str(repo_root)
        self._removed_repo_root = False
        if self._repo_root in sys.path:
            sys.path.remove(self._repo_root)
            self._removed_repo_root = True

        if "ai_flow_web.app" in sys.modules:
            del sys.modules["ai_flow_web.app"]
        import ai_flow_web.app as app_module

        self.app_module = importlib.reload(app_module)
        self.request = Request()

    def tearDown(self) -> None:
        if self._old_base_dir is None:
            os.environ.pop("AI_FLOW_WEB_ROOT", None)
        else:
            os.environ["AI_FLOW_WEB_ROOT"] = self._old_base_dir
        self._restore_fastapi_stubs()
        if self._removed_repo_root and self._repo_root not in sys.path:
            sys.path.insert(0, self._repo_root)
        if "ai_flow_web.app" in sys.modules:
            del sys.modules["ai_flow_web.app"]

    def _cleanup_base_dir(self) -> None:
        shutil.rmtree(self.base_dir, ignore_errors=True)

    def _install_fastapi_stubs(self) -> None:
        for name in self._stub_names:
            if name in sys.modules:
                self._saved_modules[name] = sys.modules[name]

        fastapi_module = types.ModuleType("fastapi")
        fastapi_module.FastAPI = DummyFastAPI
        fastapi_module.Form = Form
        fastapi_module.Request = Request

        responses_module = types.ModuleType("fastapi.responses")
        responses_module.HTMLResponse = HTMLResponse

        staticfiles_module = types.ModuleType("fastapi.staticfiles")
        staticfiles_module.StaticFiles = StaticFiles

        templating_module = types.ModuleType("fastapi.templating")
        templating_module.Jinja2Templates = DummyTemplates

        sys.modules["fastapi"] = fastapi_module
        sys.modules["fastapi.responses"] = responses_module
        sys.modules["fastapi.staticfiles"] = staticfiles_module
        sys.modules["fastapi.templating"] = templating_module

    def _restore_fastapi_stubs(self) -> None:
        for name in self._stub_names:
            if name in self._saved_modules:
                sys.modules[name] = self._saved_modules[name]
            elif name in sys.modules:
                del sys.modules[name]

    def test_path_helpers(self) -> None:
        app = self.app_module
        self.assertTrue(app.is_within_base(str(self.base_dir)))
        self.assertFalse(app.is_within_base(str(self.base_dir.parent / "other")))

        path, error = app.resolve_project_path("", must_exist=False)
        self.assertIsNone(path)
        self.assertIn("required", error.lower())

        project, error = app.resolve_project_path("demo", must_exist=False)
        self.assertIsNone(error)
        self.assertTrue(str(project).startswith(str(self.base_dir)))

        outside_project = self.base_dir.parent / "outside" / "demo"
        project, error = app.resolve_project_path(str(outside_project), must_exist=False)
        self.assertIsNone(project)
        self.assertIn("inside base root", error.lower())

        file_path = self.base_dir / "file.txt"
        file_path.write_text("data", encoding="utf-8")
        project, error = app.resolve_project_path(str(file_path), must_exist=False)
        self.assertIsNone(project)
        self.assertIn("not a directory", error.lower())

        project, error = app.resolve_project_path("missing", must_exist=True)
        self.assertIsNone(project)
        self.assertIn("does not exist", error.lower())

        output, error = app.resolve_output_path("", str(self.base_dir))
        self.assertIsNone(output)
        self.assertIsNone(error)

        output, error = app.resolve_output_path("diagram.mmd", str(self.base_dir))
        self.assertIsNone(error)
        self.assertTrue(str(output).startswith(str(self.base_dir)))

        output, error = app.resolve_output_path(str(self.base_dir.parent / "bad.mmd"), str(self.base_dir))
        self.assertIsNone(output)
        self.assertIn("inside base root", error.lower())

    def test_validate_id_and_date(self) -> None:
        app = self.app_module
        self.assertIsNotNone(app.validate_id("", "Branch id", required=True))
        self.assertIsNotNone(app.validate_id("bad id", "Branch id", required=True))
        self.assertIsNone(app.validate_id("A_main-01", "Branch id", required=True))

        self.assertIsNotNone(app.validate_date("2024/01/01"))
        self.assertIsNotNone(app.validate_date("2024-02-30"))
        self.assertIsNone(app.validate_date("2024-02-29"))

    def test_run_command_variants(self) -> None:
        app = self.app_module

        def ok(_args):
            print("ok")

        result = app.run_command(ok, types.SimpleNamespace())
        self.assertEqual(result["exit_code"], 0)
        self.assertIn("ok", result["stdout"])

        def fail(_args):
            raise SystemExit(2)

        result = app.run_command(fail, types.SimpleNamespace())
        self.assertEqual(result["exit_code"], 2)

        def crash(_args):
            raise ValueError("boom")

        result = app.run_command(crash, types.SimpleNamespace())
        self.assertEqual(result["exit_code"], 1)
        self.assertIn("boom", result["stderr"])

    def test_index_and_forms(self) -> None:
        app = self.app_module
        response = app.index(self.request)
        self.assertEqual(response.template, "index.html")
        self.assertEqual(response.context["title"], "ai_flow_web")

        response = app.init_form(self.request)
        self.assertEqual(response.template, "form_init.html")

        response = app.branch_form(self.request)
        self.assertEqual(response.template, "form_branch.html")

        response = app.step_form(self.request)
        self.assertEqual(response.template, "form_step.html")

        response = app.diagram_form(self.request)
        self.assertEqual(response.template, "form_diagram.html")

    def test_init_prepare_and_run(self) -> None:
        app = self.app_module
        outside_project = self.base_dir.parent / "outside" / "demo"
        response = app.init_prepare(self.request, project_path=str(outside_project), title="", date="")
        self.assertEqual(response.template, "form_init.html")
        self.assertTrue(response.context["errors"])

        file_path = self.base_dir / "init_file.txt"
        file_path.write_text("data", encoding="utf-8")
        response = app.init_prepare(self.request, project_path=str(file_path), title="", date="")
        self.assertEqual(response.template, "form_init.html")
        self.assertTrue(response.context["errors"])

        response = app.init_prepare(self.request, project_path="demo", title="", date="2024-02-30")
        self.assertEqual(response.template, "form_init.html")
        self.assertTrue(response.context["errors"])

        response = app.init_prepare(self.request, project_path="demo", title="", date="")
        self.assertEqual(response.template, "confirm.html")
        self.assertEqual(response.context["fields"][0]["label"], "Project path")

        response = app.init_run(self.request, project_path="demo", title="", date="", confirm="")
        self.assertEqual(response.template, "form_init.html")
        self.assertIn("confirmation", response.context["errors"][0].lower())

        response = app.init_run(self.request, project_path="demo", title="", date="2024-02-30", confirm="yes")
        self.assertEqual(response.template, "form_init.html")

        response = app.init_run(
            self.request,
            project_path=str(outside_project),
            title="",
            date="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_init.html")

        with mock.patch.object(app, "run_command", return_value={"exit_code": 0, "stdout": "ok", "stderr": ""}):
            response = app.init_run(self.request, project_path="demo", title="Demo", date="", confirm="yes")
        self.assertEqual(response.template, "result.html")
        self.assertTrue(response.context["ok"])

    def test_branch_prepare_and_run(self) -> None:
        app = self.app_module
        project_dir = self.base_dir / "project"
        (project_dir / "branches").mkdir(parents=True)

        response = app.branch_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="bad id",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")
        self.assertTrue(response.context["errors"])

        response = app.branch_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="closed",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")
        self.assertTrue(response.context["errors"])

        (project_dir / "branches" / "A_test").mkdir()
        response = app.branch_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")

        response = app.branch_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="B_test",
            title="Title",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
        )
        self.assertEqual(response.template, "confirm.html")

        response = app.branch_run(
            self.request,
            project_path=str(project_dir),
            branch_id="B_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
            confirm="",
        )
        self.assertEqual(response.template, "form_branch.html")

        (project_dir / "branches" / "B_test").mkdir()
        response = app.branch_run(
            self.request,
            project_path=str(project_dir),
            branch_id="B_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_branch.html")
        shutil.rmtree(project_dir / "branches" / "B_test", ignore_errors=True)

        with mock.patch.object(app, "run_command", return_value={"exit_code": 0, "stdout": "ok", "stderr": ""}):
            response = app.branch_run(
                self.request,
                project_path=str(project_dir),
                branch_id="C_test",
                title="",
                parent="",
                from_step="",
                status="experiment",
                closed_reason="",
                confirm="yes",
            )
        self.assertEqual(response.template, "result.html")
        self.assertTrue(response.context["ok"])

    def test_branch_prepare_validation_errors(self) -> None:
        app = self.app_module
        outside_project = self.base_dir.parent / "outside" / "project"
        response = app.branch_prepare(
            self.request,
            project_path=str(outside_project),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")

        project_no_branches = self.base_dir / "project_no_branches"
        project_no_branches.mkdir(parents=True)
        response = app.branch_prepare(
            self.request,
            project_path=str(project_no_branches),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")

        project_dir = self.base_dir / "project_validate"
        (project_dir / "branches").mkdir(parents=True)
        response = app.branch_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            title="",
            parent="bad id",
            from_step="bad id",
            status="invalid",
            closed_reason="",
        )
        self.assertEqual(response.template, "form_branch.html")

    def test_branch_run_validation_errors(self) -> None:
        app = self.app_module
        project_dir = self.base_dir / "project_run"
        (project_dir / "branches").mkdir(parents=True)

        response = app.branch_run(
            self.request,
            project_path=str(project_dir),
            branch_id="bad id",
            title="",
            parent="bad id",
            from_step="bad id",
            status="experiment",
            closed_reason="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_branch.html")

        response = app.branch_run(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="invalid",
            closed_reason="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_branch.html")

        response = app.branch_run(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="closed",
            closed_reason="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_branch.html")

        outside_project = self.base_dir.parent / "outside" / "project"
        response = app.branch_run(
            self.request,
            project_path=str(outside_project),
            branch_id="A_test",
            title="",
            parent="",
            from_step="",
            status="experiment",
            closed_reason="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_branch.html")

    def test_step_prepare_and_run(self) -> None:
        app = self.app_module
        project_dir = self.base_dir / "project_steps"
        branch_dir = project_dir / "branches" / "A_test"
        (branch_dir / "runs").mkdir(parents=True)

        response = app.step_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            step_id="bad id",
            from_step="",
        )
        self.assertEqual(response.template, "form_step.html")

        (branch_dir / "runs" / "001").mkdir()
        response = app.step_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            step_id="001",
            from_step="",
        )
        self.assertEqual(response.template, "form_step.html")

        response = app.step_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            step_id="",
            from_step="",
        )
        self.assertEqual(response.template, "confirm.html")

        response = app.step_run(
            self.request,
            project_path=str(project_dir),
            branch_id="A_test",
            step_id="",
            from_step="",
            confirm="",
        )
        self.assertEqual(response.template, "form_step.html")

        with mock.patch.object(app, "run_command", return_value={"exit_code": 0, "stdout": "ok", "stderr": ""}):
            response = app.step_run(
                self.request,
                project_path=str(project_dir),
                branch_id="A_test",
                step_id="",
                from_step="",
                confirm="yes",
            )
        self.assertEqual(response.template, "result.html")

    def test_step_prepare_validation_errors(self) -> None:
        app = self.app_module
        outside_project = self.base_dir.parent / "outside" / "steps"
        response = app.step_prepare(
            self.request,
            project_path=str(outside_project),
            branch_id="A_test",
            step_id="",
            from_step="",
        )
        self.assertEqual(response.template, "form_step.html")

        project_no_branches = self.base_dir / "project_no_branches"
        project_no_branches.mkdir(parents=True)
        response = app.step_prepare(
            self.request,
            project_path=str(project_no_branches),
            branch_id="A_test",
            step_id="",
            from_step="",
        )
        self.assertEqual(response.template, "form_step.html")

        project_dir = self.base_dir / "project_step_validate"
        (project_dir / "branches").mkdir(parents=True)
        response = app.step_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="bad id",
            step_id="",
            from_step="bad id",
        )
        self.assertEqual(response.template, "form_step.html")

        response = app.step_prepare(
            self.request,
            project_path=str(project_dir),
            branch_id="A_missing",
            step_id="",
            from_step="",
        )
        self.assertEqual(response.template, "form_step.html")

    def test_step_run_validation_errors(self) -> None:
        app = self.app_module
        project_dir = self.base_dir / "project_step_run"
        (project_dir / "branches").mkdir(parents=True)

        outside_project = self.base_dir.parent / "outside" / "steps"
        response = app.step_run(
            self.request,
            project_path=str(outside_project),
            branch_id="A_test",
            step_id="",
            from_step="",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_step.html")

        response = app.step_run(
            self.request,
            project_path=str(project_dir),
            branch_id="bad id",
            step_id="bad id",
            from_step="bad id",
            confirm="yes",
        )
        self.assertEqual(response.template, "form_step.html")

    def test_diagram_prepare_and_run(self) -> None:
        app = self.app_module
        project_dir = self.base_dir / "project_diagram"
        (project_dir / "branches").mkdir(parents=True)

        outside_project = self.base_dir.parent / "outside" / "diagram"
        response = app.diagram_prepare(
            self.request,
            project_path=str(outside_project),
            output="",
        )
        self.assertEqual(response.template, "form_diagram.html")

        project_no_branches = self.base_dir / "project_no_branches"
        project_no_branches.mkdir(parents=True)
        response = app.diagram_prepare(
            self.request,
            project_path=str(project_no_branches),
            output="",
        )
        self.assertEqual(response.template, "form_diagram.html")

        response = app.diagram_prepare(
            self.request,
            project_path=str(project_dir),
            output=str(self.base_dir.parent / "bad.mmd"),
        )
        self.assertEqual(response.template, "form_diagram.html")

        response = app.diagram_prepare(
            self.request,
            project_path=str(project_dir),
            output="",
        )
        self.assertEqual(response.template, "confirm.html")

        response = app.diagram_run(
            self.request,
            project_path=str(project_dir),
            output="",
            confirm="",
        )
        self.assertEqual(response.template, "form_diagram.html")

        response = app.diagram_run(
            self.request,
            project_path=str(project_dir),
            output=str(self.base_dir.parent / "bad.mmd"),
            confirm="yes",
        )
        self.assertEqual(response.template, "form_diagram.html")

        with mock.patch.object(app, "run_command", return_value={"exit_code": 0, "stdout": "graph TD", "stderr": ""}):
            response = app.diagram_run(
                self.request,
                project_path=str(project_dir),
                output="",
                confirm="yes",
            )
        self.assertEqual(response.template, "result.html")
        self.assertIn("graph TD", response.context["diagram"])

        with mock.patch.object(app, "run_command", return_value={"exit_code": 0, "stdout": "graph TD", "stderr": ""}):
            response = app.diagram_run(
                self.request,
                project_path=str(project_dir),
                output="diagram.mmd",
                confirm="yes",
            )
        self.assertEqual(response.template, "result.html")
        self.assertEqual(response.context["diagram"], "")

    def test_health(self) -> None:
        app = self.app_module
        response = app.health()
        self.assertEqual(response["status"], "ok")


if __name__ == "__main__":
    unittest.main()
