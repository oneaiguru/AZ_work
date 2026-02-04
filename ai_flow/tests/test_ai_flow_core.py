import argparse
import contextlib
import io
import os
import shutil
import subprocess
import sys
import unittest
import uuid
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import ai_flow  # noqa: E402


class AiFlowCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp_root = ROOT / ".tmp"
        tmp_root.mkdir(exist_ok=True)
        self.tmp_dir = tmp_root / f"core_{uuid.uuid4().hex}"
        self.tmp_dir.mkdir(parents=True, exist_ok=False)
        self.addCleanup(shutil.rmtree, self.tmp_dir, ignore_errors=True)

    def test_write_file_if_not_exists_creates_and_skips(self) -> None:
        target = self.tmp_dir / "nested" / "note.txt"
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            ai_flow.write_file_if_not_exists(str(target), "hello")
        self.assertTrue(target.is_file())
        self.assertIn("Создан файл", buf.getvalue())

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            ai_flow.write_file_if_not_exists(str(target), "hello")
        self.assertIn("Файл уже существует", buf.getvalue())

    def test_ensure_dir_creates_and_rejects_file(self) -> None:
        dir_path = self.tmp_dir / "logs"
        ai_flow.ensure_dir(str(dir_path))
        self.assertTrue(dir_path.is_dir())

        file_path = self.tmp_dir / "not_a_dir"
        file_path.write_text("data", encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            with self.assertRaises(SystemExit):
                ai_flow.ensure_dir(str(file_path))
        self.assertIn("не каталог", err.getvalue().lower())

    def test_run_git_handles_missing_git(self) -> None:
        with mock.patch("ai_flow.subprocess.run", side_effect=FileNotFoundError()):
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                result = ai_flow.run_git(str(self.tmp_dir), "status")
        self.assertIsNone(result)
        self.assertIn("git не найден", err.getvalue().lower())

    def test_run_git_emits_output(self) -> None:
        proc = subprocess.CompletedProcess(
            args=["git", "status"], returncode=1, stdout="ok\n", stderr="bad\n"
        )
        with mock.patch("ai_flow.subprocess.run", return_value=proc):
            out = io.StringIO()
            err = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                result = ai_flow.run_git(str(self.tmp_dir), "status")
        self.assertEqual(result, proc)
        self.assertIn("ok", out.getvalue())
        self.assertIn("bad", err.getvalue())

    def test_run_git_no_output(self) -> None:
        proc = subprocess.CompletedProcess(
            args=["git", "status"], returncode=0, stdout="", stderr=""
        )
        with mock.patch("ai_flow.subprocess.run", return_value=proc):
            out = io.StringIO()
            err = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                result = ai_flow.run_git(str(self.tmp_dir), "status")
        self.assertEqual(result, proc)
        self.assertEqual(out.getvalue(), "")
        self.assertEqual(err.getvalue(), "")

    def test_ensure_git_repo_paths(self) -> None:
        repo_with_git = self.tmp_dir / "repo_with_git"
        repo_with_git.mkdir()
        (repo_with_git / ".git").mkdir()
        self.assertTrue(ai_flow.ensure_git_repo(str(repo_with_git)))

        repo_run = self.tmp_dir / "repo_run"
        repo_run.mkdir()
        proc_ok = subprocess.CompletedProcess(args=["git", "init"], returncode=0)
        with mock.patch("ai_flow.run_git", return_value=proc_ok):
            self.assertTrue(ai_flow.ensure_git_repo(str(repo_run)))

        repo_fail = self.tmp_dir / "repo_fail"
        repo_fail.mkdir()
        proc_fail = subprocess.CompletedProcess(args=["git", "init"], returncode=1)
        with mock.patch("ai_flow.run_git", return_value=proc_fail):
            self.assertFalse(ai_flow.ensure_git_repo(str(repo_fail)))

    def test_git_branch_queries(self) -> None:
        proc_ok = subprocess.CompletedProcess(args=["git"], returncode=0, stdout="main\n")
        proc_fail = subprocess.CompletedProcess(args=["git"], returncode=1, stdout="")

        with mock.patch("ai_flow.run_git", return_value=proc_ok):
            self.assertTrue(ai_flow.git_branch_exists(str(self.tmp_dir), "main"))
            self.assertEqual(ai_flow.git_current_branch(str(self.tmp_dir)), "main")

        with mock.patch("ai_flow.run_git", return_value=proc_fail):
            self.assertFalse(ai_flow.git_branch_exists(str(self.tmp_dir), "main"))
            self.assertIsNone(ai_flow.git_current_branch(str(self.tmp_dir)))

    def test_git_create_branch_uses_base(self) -> None:
        with mock.patch("ai_flow.ensure_git_repo", return_value=True), \
            mock.patch("ai_flow.git_branch_exists") as branch_exists, \
            mock.patch("ai_flow.run_git") as run_git:
            branch_exists.side_effect = [False, True]
            ai_flow.git_create_branch("repo", "feature", "main")
            run_git.assert_called_once_with("repo", "branch", "feature", "main")

            run_git.reset_mock()
            branch_exists.side_effect = [False, False]
            ai_flow.git_create_branch("repo", "feature", "main")
            run_git.assert_called_once_with("repo", "branch", "feature")

            run_git.reset_mock()
            branch_exists.side_effect = [True]
            ai_flow.git_create_branch("repo", "feature", "main")
            run_git.assert_not_called()

        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.run_git") as run_git:
            ai_flow.git_create_branch("repo", "feature", "main")
            run_git.assert_not_called()

    def test_git_is_clean_variants(self) -> None:
        project = self.tmp_dir / "repo"
        project.mkdir()
        self.assertIsNone(ai_flow.git_is_clean(str(project)))

        (project / ".git").mkdir()
        with mock.patch("ai_flow.run_git", return_value=None):
            self.assertIsNone(ai_flow.git_is_clean(str(project)))

        proc_clean = subprocess.CompletedProcess(args=["git"], returncode=0, stdout="")
        with mock.patch("ai_flow.run_git", return_value=proc_clean):
            self.assertTrue(ai_flow.git_is_clean(str(project)))

        proc_dirty = subprocess.CompletedProcess(args=["git"], returncode=0, stdout=" M file")
        with mock.patch("ai_flow.run_git", return_value=proc_dirty):
            self.assertFalse(ai_flow.git_is_clean(str(project)))

    def test_git_checkout_branch(self) -> None:
        with mock.patch("ai_flow.ensure_git_repo", return_value=True), \
            mock.patch("ai_flow.git_branch_exists", return_value=True), \
            mock.patch("ai_flow.run_git") as run_git:
            ai_flow.git_checkout_branch("repo", "feature")
            run_git.assert_called_once_with("repo", "checkout", "feature")

        with mock.patch("ai_flow.ensure_git_repo", return_value=True), \
            mock.patch("ai_flow.git_branch_exists", side_effect=[False, True]), \
            mock.patch("ai_flow.run_git") as run_git:
            ai_flow.git_checkout_branch("repo", "feature", "main")
            run_git.assert_called_once_with("repo", "checkout", "-b", "feature", "main")

        with mock.patch("ai_flow.ensure_git_repo", return_value=True), \
            mock.patch("ai_flow.git_branch_exists", side_effect=[False, False]), \
            mock.patch("ai_flow.run_git") as run_git:
            ai_flow.git_checkout_branch("repo", "feature", "main")
            run_git.assert_called_once_with("repo", "checkout", "-b", "feature")

        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.run_git") as run_git:
            ai_flow.git_checkout_branch("repo", "feature")
            run_git.assert_not_called()

    def test_number_to_letters(self) -> None:
        self.assertEqual(ai_flow.number_to_letters(0), "A")
        self.assertEqual(ai_flow.number_to_letters(25), "Z")
        self.assertEqual(ai_flow.number_to_letters(26), "AA")
        self.assertEqual(ai_flow.number_to_letters(27), "AB")

    def test_generate_branch_id_and_step_id(self) -> None:
        project = self.tmp_dir / "project"
        self.assertEqual(ai_flow.generate_branch_id(str(project)), "A")

        branches_root = project / "branches"
        branches_root.mkdir(parents=True)
        (branches_root / "A").mkdir()
        (branches_root / "C").mkdir()
        self.assertEqual(ai_flow.generate_branch_id(str(project)), "B")

        branch_dir = project / "branches" / "A"
        self.assertEqual(ai_flow.generate_step_id(str(branch_dir)), "A_001")

    def test_generate_step_id_skips_files_and_lower_ids(self) -> None:
        branch_dir = self.tmp_dir / "project" / "branches" / "A_demo"
        runs_dir = branch_dir / "runs"
        runs_dir.mkdir(parents=True)
        (runs_dir / "005").mkdir()
        (runs_dir / "003").mkdir()
        (runs_dir / "notes.txt").write_text("note", encoding="utf-8")

        with mock.patch("ai_flow.os.listdir", return_value=["005", "notes.txt", "003"]):
            self.assertEqual(ai_flow.generate_step_id(str(branch_dir)), "A_demo_006")

    def test_sanitize_id_and_clean_label(self) -> None:
        self.assertEqual(ai_flow.sanitize_id("A-main.1"), "A_main_1")
        self.assertEqual(ai_flow.clean_label('Hello "world"'), "Hello 'world'")

    def test_read_branch_metadata_and_status(self) -> None:
        branch_dir = self.tmp_dir / "branches" / "A_demo"
        branch_dir.mkdir(parents=True)
        meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual(meta["id"], "A_demo")
        self.assertEqual(meta["status"], "experiment")

        info = (
            "# Ветка: A_demo\n"
            "\n"
            "## Общая информация\n"
            "\n"
            "- Название: Demo\n"
            "- Дата создания: 2025-01-01\n"
            "- Статус: success # note\n"
            "- Причина закрытия: done\n"
            "\n"
            "## Родительская ветка\n"
            "\n"
            "- Родитель: A_main\n"
            "- Точка ответвления (шаг): A_001\n"
        )
        (branch_dir / "branch-info.md").write_text(info, encoding="utf-8")
        meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual(meta["title"], "Demo")
        self.assertEqual(meta["parent"], "A_main")
        self.assertEqual(meta["from_step"], "A_001")
        self.assertEqual(meta["status"], "success")
        self.assertEqual(meta["closed_reason"], "done")

    def test_read_branch_metadata_handles_oserror(self) -> None:
        branch_dir = self.tmp_dir / "branches" / "A_err"
        branch_dir.mkdir(parents=True)
        info_path = branch_dir / "branch-info.md"
        info_path.write_text("stub", encoding="utf-8")
        with mock.patch("ai_flow.open", side_effect=OSError("boom")):
            meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual(meta["id"], "A_err")

    def test_read_step_status(self) -> None:
        step_dir = self.tmp_dir / "branches" / "A_demo" / "runs" / "001"
        step_dir.mkdir(parents=True)
        self.assertEqual(ai_flow.read_step_status(str(step_dir)), "unknown")

        eval_path = step_dir / "evaluation.md"
        eval_path.write_text("- Статус: success\n", encoding="utf-8")
        self.assertEqual(ai_flow.read_step_status(str(step_dir)), "success")

        eval_path.write_text("- Статус: success | partial\n", encoding="utf-8")
        self.assertEqual(ai_flow.read_step_status(str(step_dir)), "unknown")

        eval_path.write_text("- Статус: partial # trailing note\n", encoding="utf-8")
        self.assertEqual(ai_flow.read_step_status(str(step_dir)), "partial")

    def test_read_step_status_handles_oserror(self) -> None:
        step_dir = self.tmp_dir / "branches" / "A_err" / "runs" / "001"
        step_dir.mkdir(parents=True)
        eval_path = step_dir / "evaluation.md"
        eval_path.write_text("stub", encoding="utf-8")
        with mock.patch("ai_flow.open", side_effect=OSError("boom")):
            status = ai_flow.read_step_status(str(step_dir))
        self.assertEqual(status, "unknown")

    def test_collect_project_structure(self) -> None:
        project = self.tmp_dir / "project"
        self.assertEqual(ai_flow.collect_project_structure(str(project)), [])

        branches_root = project / "branches"
        branches_root.mkdir(parents=True)
        (branches_root / "notes.txt").write_text("note", encoding="utf-8")

        branch_dir = project / "branches" / "A_demo"
        (branch_dir / "runs" / "001").mkdir(parents=True)
        (branch_dir / "runs" / "002").mkdir(parents=True)
        (branch_dir / "branch-info.md").write_text(
            "- Название: Demo\n- Статус: success\n",
            encoding="utf-8",
        )
        (branch_dir / "runs" / "001" / "evaluation.md").write_text(
            "- Статус: success\n", encoding="utf-8"
        )
        (branch_dir / "runs" / "002" / "evaluation.md").write_text(
            "- Статус: fail\n", encoding="utf-8"
        )

        branch_no_runs = project / "branches" / "B_empty"
        branch_no_runs.mkdir(parents=True)
        (branch_no_runs / "branch-info.md").write_text(
            "- Название: Empty\n- Статус: experiment\n",
            encoding="utf-8",
        )

        structure = ai_flow.collect_project_structure(str(project))
        self.assertEqual(structure[0]["id"], "A_demo")
        self.assertEqual(structure[0]["steps"][0]["status"], "success")
        self.assertEqual(structure[0]["steps"][1]["status"], "fail")

    def test_build_mermaid_diagram_includes_placeholder(self) -> None:
        branches = [
            {
                "id": "A_main",
                "parent": "unknown_parent",
                "from_step": "A_001",
                "status": "mystery",
                "closed_reason": "n/a",
                "steps": [{"id": "001", "status": "partial"}, {"id": "002", "status": "fail"}],
            },
            {
                "id": "B_alt",
                "parent": "A_main",
                "from_step": "",
                "status": "success",
                "closed_reason": "n/a",
                "steps": [],
            }
        ]
        diagram = ai_flow.build_mermaid_diagram(branches)
        self.assertIn("branch_unknown_parent", diagram)
        self.assertIn("branch_A_main", diagram)
        self.assertIn("step_A_main_001", diagram)

    def test_cmd_init_project_and_create_branch(self) -> None:
        project = self.tmp_dir / "project"
        args = argparse.Namespace(path=str(project), title="Demo", date="2025-01-01")
        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.git_create_branch"), \
            mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_init_project(args)
        self.assertTrue((project / "project.md").is_file())
        self.assertTrue((project / "branches" / "A" / "runs" / "001").is_dir())

        create_args = argparse.Namespace(
            project_path=str(project),
            branch_id="B_test",
            title=None,
            parent=None,
            from_step=None,
            status="closed",
            closed_reason=None,
        )
        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.git_create_branch"), \
            mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_create_branch(create_args)
        info_text = (project / "branches" / "B_test" / "branch-info.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("<причина не указана>", info_text)

    def test_cmd_init_project_skips_auto_branch(self) -> None:
        project = self.tmp_dir / "project_existing"
        branches_dir = project / "branches"
        branches_dir.mkdir(parents=True)
        (branches_dir / "keep").mkdir()
        args = argparse.Namespace(path=str(project), title="Demo", date="2025-01-01")
        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.git_create_branch"), \
            mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_init_project(args)
        self.assertFalse((project / "branches" / "A").exists())

    def test_cmd_create_branch_missing_branches_dir(self) -> None:
        project = self.tmp_dir / "project"
        project.mkdir()
        args = argparse.Namespace(
            project_path=str(project),
            branch_id="A_test",
            title=None,
            parent=None,
            from_step=None,
            status="experiment",
            closed_reason=None,
        )
        with self.assertRaises(SystemExit):
            ai_flow.cmd_create_branch(args)

    def test_cmd_create_branch_auto_id_and_existing_branch(self) -> None:
        project = self.tmp_dir / "project_auto"
        branches_dir = project / "branches"
        branches_dir.mkdir(parents=True)
        (branches_dir / "A").mkdir()

        args = argparse.Namespace(
            project_path=str(project),
            branch_id=None,
            title=None,
            parent=None,
            from_step=None,
            status="experiment",
            closed_reason=None,
        )
        out = io.StringIO()
        with contextlib.redirect_stdout(out), \
            mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.git_create_branch"), \
            mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_create_branch(args)
        self.assertIn("Сгенерирован branch_id", out.getvalue())
        self.assertTrue((branches_dir / "B").is_dir())

        args = argparse.Namespace(
            project_path=str(project),
            branch_id="B",
            title=None,
            parent=None,
            from_step=None,
            status="experiment",
            closed_reason=None,
        )
        with self.assertRaises(SystemExit):
            ai_flow.cmd_create_branch(args)

    def test_cmd_create_branch_uses_parent_base(self) -> None:
        project = self.tmp_dir / "project_parent"
        branches_dir = project / "branches"
        branches_dir.mkdir(parents=True)

        args = argparse.Namespace(
            project_path=str(project),
            branch_id="B_parent",
            title=None,
            parent="A_parent",
            from_step=None,
            status="experiment",
            closed_reason=None,
        )
        with mock.patch("ai_flow.ensure_git_repo", return_value=False), \
            mock.patch("ai_flow.git_create_branch") as git_create_branch, \
            mock.patch("ai_flow.cmd_new_step"):
            ai_flow.cmd_create_branch(args)
        git_create_branch.assert_called_once_with(str(project), "B_parent", "A_parent")

    def test_cmd_new_step_from_step_and_git_checks(self) -> None:
        project = self.tmp_dir / "project"
        branch_dir = project / "branches" / "A_test" / "runs"
        branch_dir.mkdir(parents=True)
        args = argparse.Namespace(
            project_path=str(project),
            branch_id="A_test",
            step_id="001",
            from_step="A_000",
            skip_git_check=True,
        )
        with mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_new_step(args)
        prompt_text = (
            project / "branches" / "A_test" / "runs" / "001" / "prompt.md"
        ).read_text(encoding="utf-8")
        self.assertIn("A_test/A_000", prompt_text)
        self.assertIn("branches/A_test/runs/A_000/result_raw.md", prompt_text)

        dirty_args = argparse.Namespace(
            project_path=str(project),
            branch_id="A_test",
            step_id="002",
            from_step=None,
            skip_git_check=False,
        )
        with mock.patch("ai_flow.git_is_clean", return_value=False):
            with self.assertRaises(SystemExit):
                ai_flow.cmd_new_step(dirty_args)

        with mock.patch("ai_flow.git_is_clean", return_value=None):
            with self.assertRaises(SystemExit):
                ai_flow.cmd_new_step(dirty_args)

    def test_cmd_new_step_auto_id_and_existing_step(self) -> None:
        project = self.tmp_dir / "project_auto_step"
        branch_dir = project / "branches" / "A_auto" / "runs"
        branch_dir.mkdir(parents=True)
        args = argparse.Namespace(
            project_path=str(project),
            branch_id="A_auto",
            step_id=None,
            from_step=None,
            skip_git_check=False,
        )
        with mock.patch("ai_flow.git_is_clean", return_value=True), \
            mock.patch("ai_flow.git_checkout_branch"):
            ai_flow.cmd_new_step(args)
        self.assertTrue((project / "branches" / "A_auto" / "runs" / "001").is_dir())

        args = argparse.Namespace(
            project_path=str(project),
            branch_id="A_auto",
            step_id="001",
            from_step=None,
            skip_git_check=True,
        )
        with mock.patch("ai_flow.git_checkout_branch"):
            with self.assertRaises(SystemExit):
                ai_flow.cmd_new_step(args)

    def test_cmd_new_step_missing_branch(self) -> None:
        args = argparse.Namespace(
            project_path=str(self.tmp_dir),
            branch_id="missing",
            step_id="001",
            from_step=None,
            skip_git_check=True,
        )
        with self.assertRaises(SystemExit):
            ai_flow.cmd_new_step(args)

    def test_cmd_generate_mermaid_output(self) -> None:
        project = self.tmp_dir / "project"
        branch_dir = project / "branches" / "A_demo"
        (branch_dir / "runs" / "001").mkdir(parents=True)
        (branch_dir / "branch-info.md").write_text(
            "- Название: Demo\n- Статус: success\n",
            encoding="utf-8",
        )
        args = argparse.Namespace(project_path=str(project), output=None)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            ai_flow.cmd_generate_mermaid(args)
        self.assertIn("graph TD", out.getvalue())

        output_path = project / "branches" / "diagram.mmd"
        args = argparse.Namespace(project_path=str(project), output=str(output_path))
        ai_flow.cmd_generate_mermaid(args)
        self.assertTrue(output_path.is_file())

    def test_cmd_generate_mermaid_missing_branches_and_no_dir_output(self) -> None:
        project = self.tmp_dir / "project_missing"
        project.mkdir(parents=True)
        args = argparse.Namespace(project_path=str(project), output=None)
        with self.assertRaises(SystemExit):
            ai_flow.cmd_generate_mermaid(args)

        branches_dir = project / "branches"
        branch_dir = branches_dir / "A_demo"
        branch_dir.mkdir(parents=True)
        (branch_dir / "branch-info.md").write_text("- Название: Demo\n", encoding="utf-8")
        args = argparse.Namespace(project_path=str(project), output="diagram.mmd")
        cwd = os.getcwd()
        try:
            os.chdir(project)
            ai_flow.cmd_generate_mermaid(args)
        finally:
            os.chdir(cwd)
        self.assertTrue((project / "diagram.mmd").is_file())

    def test_main_requires_command(self) -> None:
        with mock.patch.object(sys, "argv", ["ai_flow.py"]):
            with self.assertRaises(SystemExit):
                ai_flow.main()

    def test_main_executes_command(self) -> None:
        project = self.tmp_dir / "main_project"
        called = {}

        def fake_cmd(_args):
            called["ok"] = True

        with mock.patch("ai_flow.cmd_init_project", side_effect=fake_cmd):
            with mock.patch.object(
                sys, "argv", ["ai_flow.py", "init-project", str(project)]
            ):
                ai_flow.main()
        self.assertTrue(called.get("ok"))


if __name__ == "__main__":
    unittest.main()
