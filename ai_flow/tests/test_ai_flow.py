import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
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

    def run_cli(self, *args: str, expect_fail: bool = False) -> subprocess.CompletedProcess:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            capture_output=True,
            text=True,
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
            (self.project_dir / "branches" / "A" / "runs" / "001").is_dir()
        )

        if shutil.which("git"):
            self.assertTrue((self.project_dir / ".git").is_dir())

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

        self.assertEqual("004", ai_flow.generate_step_id(str(branch_dir)))

    def test_create_branch_and_step_flow(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.git("add", ".")
        self.git("commit", "-m", "init")
        self.run_cli(
            "create-branch",
            str(self.project_dir),
            "A_test",
            "--from-step",
            "A_000",
            "--status",
            "closed",
        )
        self.git("add", ".")
        self.git("commit", "-m", "add branch and auto step")

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
        step_dir = branch_dir / "runs" / "002"
        prompt_text = (step_dir / "prompt.md").read_text(encoding="utf-8")
        self.assertIn("A_test/A_001", prompt_text)
        self.assertIn("branches/A_test/runs/A_001/result_raw.md", prompt_text)

        evaluation_path = step_dir / "evaluation.md"
        evaluation_path.write_text("- Статус: success\n", encoding="utf-8")
        structure = ai_flow.collect_project_structure(str(self.project_dir))
        branch_data = next(b for b in structure if b["id"] == "A_test")
        self.assertEqual(branch_data["steps"][1]["status"], "success")

    def test_new_step_rejected_when_git_dirty(self) -> None:
        self.run_cli("init-project", str(self.project_dir))
        self.configure_git_identity()
        self.git("add", ".")
        self.git("commit", "-m", "init")
        self.run_cli("create-branch", str(self.project_dir), "A_test")
        self.git("add", ".")
        self.git("commit", "-m", "branch meta")

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
