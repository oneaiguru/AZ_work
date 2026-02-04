import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional
import unittest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "ai_flow.py"

sys.path.insert(0, str(ROOT))
import ai_flow  # noqa: E402


class AiFlowCLITests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project_dir = Path(self.tmp.name) / "project"
        self.git_available = shutil.which("git") is not None

    def run_cli(
        self,
        *args: str,
        expect_fail: bool = False,
        cwd: Optional[Path] = None,
    ) -> subprocess.CompletedProcess:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            capture_output=True,
            text=True,
            cwd=str(cwd) if cwd else None,
        )
        if expect_fail:
            if proc.returncode == 0:
                self.fail(f"Command {' '.join(args)} unexpectedly succeeded")
            return proc

        if proc.returncode != 0:
            self.fail(
                f"Command {' '.join(args)} failed with code {proc.returncode}\n"
                f"stdout:\n{proc.stdout}\n"
                f"stderr:\n{proc.stderr}\n"
            )
        return proc

    def git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        if not self.git_available:
            self.skipTest("git required for this test")
        proc = subprocess.run(
            ["git", *args],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        if check and proc.returncode != 0:
            self.fail(
                f"git {' '.join(args)} failed with code {proc.returncode}\n"
                f"stdout:\n{proc.stdout}\n"
                f"stderr:\n{proc.stderr}\n"
            )
        return proc

    def configure_git_identity(self) -> None:
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "Tester")

    def test_init_project_creates_files_and_git_repo(self) -> None:
        self.run_cli("init-project", str(self.project_dir), "--title", "Demo")

        for name in ("project.md", "plan.md", "journal.md"):
            self.assertTrue((self.project_dir / name).is_file())
        self.assertTrue((self.project_dir / "branches").is_dir())
        self.assertTrue((self.project_dir / "branches" / "A").is_dir())
        self.assertTrue(
            (self.project_dir / "branches" / "A" / "runs" / "A_001").is_dir()
        )

        if shutil.which("git"):
            self.assertTrue((self.project_dir / ".git").is_dir())
            current_branch = self.git("branch", "--show-current").stdout.strip()
            self.assertEqual("A_001", current_branch)
            log = self.git("log", "-1", "--pretty=%B").stdout.strip()
            self.assertEqual("Add step A_001", log)
            status_short = self.git("status", "--short").stdout.strip()
            self.assertEqual("", status_short)

    def test_generate_branch_id_wraps_after_z(self) -> None:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        branches_root = self.project_dir / "branches"
        branches_root.mkdir(parents=True, exist_ok=True)

        for ch in ai_flow.BRANCH_ALPHABET:
            (branches_root / ch).mkdir()

        self.assertEqual("ZA", ai_flow.generate_branch_id(str(self.project_dir)))

    def test_generate_branch_id_after_double_z(self) -> None:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        branches_root = self.project_dir / "branches"
        branches_root.mkdir(parents=True, exist_ok=True)

        for name in list(ai_flow.BRANCH_ALPHABET) + [
            f"Z{letter}" for letter in ai_flow.BRANCH_ALPHABET
        ]:
            (branches_root / name).mkdir()

        self.assertEqual("ZZA", ai_flow.generate_branch_id(str(self.project_dir)))

    def test_generate_step_id_ignores_non_numeric_dirs(self) -> None:
        branch_dir = self.project_dir / "branches" / "A_demo"
        runs_dir = branch_dir / "runs"
        runs_dir.mkdir(parents=True, exist_ok=True)
        for name in ("001", "003", "draft"):
            (runs_dir / name).mkdir()

        self.assertEqual("A_demo_004", ai_flow.generate_step_id(str(branch_dir)))

    def test_create_branch_and_step_flow(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli(
            "create-branch",
            str(self.project_dir),
            "A_test",
            "--from-step",
            "A_000",
            "--status",
            "closed",
        )

        branch_dir = self.project_dir / "branches" / "A_test"
        meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual(meta["from_step"], "A_000")
        self.assertEqual(meta["status"], "closed")
        self.assertEqual(meta["closed_reason"], "<причина не указана>")

        self.run_cli(
            "new-step",
            str(self.project_dir),
            "A_test",
            "002",
            "--from-step",
            "A_001",
        )
        step_dir = branch_dir / "runs" / "A_test_002"
        prompt_text = (step_dir / "prompt.md").read_text(encoding="utf-8")
        self.assertIn("A_test/A_001", prompt_text)
        self.assertIn("branches/A_test/runs/A_001/result_raw.md", prompt_text)

        evaluation_path = step_dir / "evaluation.md"
        evaluation_path.write_text("- Статус: success\n", encoding="utf-8")
        structure = ai_flow.collect_project_structure(str(self.project_dir))
        branch_data = next(b for b in structure if b["id"] == "A_test")
        success_step = next(step for step in branch_data["steps"] if step["id"] == "A_test_002")
        self.assertEqual(success_step["status"], "success")

    def test_new_step_rejected_when_git_dirty(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("create-branch", str(self.project_dir), "A_test")

        dirty_file = self.project_dir / "untracked.txt"
        dirty_file.write_text("draft", encoding="utf-8")

        proc = self.run_cli(
            "new-step",
            str(self.project_dir),
            "A_test",
            "002",
            expect_fail=True,
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("незакоммиченные", proc.stderr.lower())

    def test_create_branch_rejects_dirty_tree(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        dirty_file = self.project_dir / "untracked_branch.txt"
        dirty_file.write_text("draft", encoding="utf-8")

        proc = self.run_cli(
            "create-branch",
            str(self.project_dir),
            "B_dirty",
            expect_fail=True,
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("незакоммиченные", proc.stderr.lower())

    def test_new_step_defaults_to_cwd_and_current_branch(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.run_cli("new-step", cwd=self.project_dir)
        self.assertTrue(
            (self.project_dir / "branches" / "A" / "runs" / "A_002").is_dir()
        )
        current_branch = self.git("branch", "--show-current").stdout.strip()
        self.assertEqual("A_002", current_branch)

    def test_new_step_creates_step_branch_and_commits(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("new-step", str(self.project_dir))
        current_branch = self.git("branch", "--show-current").stdout.strip()
        self.assertEqual("A_002", current_branch)
        log = self.git("log", "-1", "--pretty=%B").stdout.strip()
        self.assertEqual("Add step A_002", log)
        author = self.git("log", "-1", "--pretty=%an <%ae>").stdout.strip()
        self.assertEqual("Tester <test@example.com>", author)
        self.assertEqual("", self.git("status", "--short").stdout.strip())

    def test_commit_with_manual_message(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        (self.project_dir / "notes.txt").write_text("draft", encoding="utf-8")
        self.run_cli("commit", str(self.project_dir), "--message", "Manual commit")
        log = self.git("log", "-1", "--pretty=%B").stdout.strip()
        self.assertEqual("Manual commit", log)

    def test_commit_generates_message_via_codex(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        (self.project_dir / "notes.txt").write_text("draft", encoding="utf-8")
        fake_codex = Path(self.tmp.name) / "fake_codex.py"
        fake_codex.write_text(
            "import sys\nsys.stdin.read()\nprint('fix: codex generated commit')\n",
            encoding="utf-8",
        )
        os.environ["AI_FLOW_CODEX_CMD"] = f"\"{sys.executable}\" \"{fake_codex}\""
        self.addCleanup(lambda: os.environ.pop("AI_FLOW_CODEX_CMD", None))
        self.run_cli("commit", str(self.project_dir))
        log = self.git("log", "-1", "--pretty=%B").stdout.strip()
        self.assertEqual("fix: codex generated commit", log)

    def test_new_step_accepts_numeric_step_id(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("new-step", str(self.project_dir), "A", "002")
        self.assertTrue(
            (self.project_dir / "branches" / "A" / "runs" / "A_002").is_dir()
        )
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())

    def test_new_step_alias_ns(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("ns", str(self.project_dir))
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())

    def test_branch_flow_with_titles_and_clean_checks(self) -> None:
        project_title = "Branch Flow Test Project"
        self.run_cli("init-project", str(self.project_dir), "--title", project_title)
        self.configure_git_identity()
        self.run_cli("new-step", str(self.project_dir))
        self.run_cli("new-step", str(self.project_dir))

        self.run_cli("switch", str(self.project_dir), "A", "--step", "002")
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())

        branch_title = "Experiment from A_002"
        self.run_cli(
            "create-branch",
            str(self.project_dir),
            "B_experiment",
            "--parent",
            "A",
            "--from-step",
            "A_002",
            "--title",
            branch_title,
        )

        branch_dir = self.project_dir / "branches" / "B_experiment"
        self.assertTrue(branch_dir.is_dir())
        branch_meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual(branch_title, branch_meta["title"])

        merge_base = self.git("merge-base", "B_experiment_001", "A_002").stdout.strip()
        target_commit = self.git("rev-parse", "A_002").stdout.strip()
        self.assertEqual(merge_base, target_commit)

        self.run_cli("switch", str(self.project_dir), "A", "--step", "002")
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())
        self.run_cli("switch", str(self.project_dir), "B_experiment", "--step", "001")
        self.assertEqual("B_experiment_001", self.git("branch", "--show-current").stdout.strip())

        dirty = self.project_dir / "dirty.txt"
        dirty.write_text("pending", encoding="utf-8")

        proc = self.run_cli(
            "new-step",
            str(self.project_dir),
            expect_fail=True,
        )
        self.assertIn("незакоммиченные", proc.stderr.lower())
        self.assertEqual("B_experiment_001", self.git("branch", "--show-current").stdout.strip())

        proc = self.run_cli(
            "create-branch",
            str(self.project_dir),
            "C_blocked",
            expect_fail=True,
        )
        self.assertIn("незакоммиченные", proc.stderr.lower())
        self.assertEqual("B_experiment_001", self.git("branch", "--show-current").stdout.strip())

        dirty.unlink()

    def test_branch_flow_with_defaults(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("ns", str(self.project_dir))
        self.run_cli("ns", str(self.project_dir))

        self.run_cli("switch", str(self.project_dir), "A", "--step", "002")
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())

        self.run_cli("create-branch", str(self.project_dir))

        branch_dir = self.project_dir / "branches" / "B"
        self.assertTrue(branch_dir.is_dir())
        branch_meta = ai_flow.read_branch_metadata(str(branch_dir))
        self.assertEqual("B", branch_meta["title"])

        merge_base = self.git("merge-base", "B_001", "A_002").stdout.strip()
        target_commit = self.git("rev-parse", "A_002").stdout.strip()
        self.assertEqual(merge_base, target_commit)

        self.run_cli("switch", str(self.project_dir), "A", "--step", "002")
        self.assertEqual("A_002", self.git("branch", "--show-current").stdout.strip())
        self.run_cli("switch", str(self.project_dir), "B", "--step", "001")
        self.assertEqual("B_001", self.git("branch", "--show-current").stdout.strip())

    def test_switch_command_changes_branch_and_step(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("new-step", str(self.project_dir))
        self.run_cli("switch", str(self.project_dir), "--step", "001")
        self.assertEqual("A_001", self.git("branch", "--show-current").stdout.strip())
        self.run_cli("switch", str(self.project_dir), "A")
        self.assertEqual("A", self.git("branch", "--show-current").stdout.strip())
        self.run_cli("switch", str(self.project_dir), "A", "--step", "A_001")
        self.assertEqual("A_001", self.git("branch", "--show-current").stdout.strip())

    def test_switch_requires_clean_tree(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        dirty_file = self.project_dir / "tmp.txt"
        dirty_file.write_text("dirty", encoding="utf-8")
        proc = self.run_cli(
            "switch",
            str(self.project_dir),
            "A",
            expect_fail=True,
        )
        self.assertIn("незакоммиченные", proc.stderr.lower())

    def test_create_branch_from_step_bases_on_step_branch(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.run_cli("new-step", str(self.project_dir))
        self.run_cli("switch", str(self.project_dir), "A", "--step", "A_001")
        self.run_cli(
            "create-branch",
            str(self.project_dir),
            "B_child",
            "--parent",
            "A",
            "--from-step",
            "A_001",
        )
        self.git("checkout", "B_child")
        merge_base = self.git("merge-base", "B_child", "A_001").stdout.strip()
        parent_commit = self.git("rev-parse", "A_001").stdout.strip()
        self.assertEqual(merge_base, parent_commit)

    def test_mermaid_diagram_contains_status_labels(self) -> None:
        branches = [
            {
                "id": "A_main",
                "parent": "none",
                "from_step": "n/a",
                "status": "success",
                "closed_reason": "n/a",
                "steps": [{"id": "001", "status": "success"}],
            },
            {
                "id": "B_alt",
                "parent": "A_main",
                "from_step": "A_001",
                "status": "closed",
                "closed_reason": "done",
                "steps": [],
            },
        ]

        diagram = ai_flow.build_mermaid_diagram(branches)
        self.assertIn('branch_A_main["A_main (success)"]', diagram)
        self.assertIn('branch_B_alt["B_alt (closed) — done"]', diagram)
        self.assertIn("branch_A_main -->|A_001| branch_B_alt", diagram)
        self.assertIn('step_A_main_001["A_main/001 (success)"]', diagram)


if __name__ == "__main__":
    unittest.main()
