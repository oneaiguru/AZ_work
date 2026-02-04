import importlib
import importlib.util
import os
import shutil
import unittest
import uuid
from pathlib import Path

if importlib.util.find_spec("fastapi") is not None:
    from fastapi.testclient import TestClient
else:
    TestClient = None


class AiFlowWebTests(unittest.TestCase):
    def setUp(self) -> None:
        if TestClient is None:
            self.skipTest("fastapi is required for ai_flow_web tests")
        repo_root = Path(__file__).resolve().parent.parent
        tmp_root = repo_root / ".tmp"
        tmp_root.mkdir(exist_ok=True)
        self.base_tmp = tmp_root / f"web_{uuid.uuid4().hex}"
        self.base_tmp.mkdir(parents=True, exist_ok=False)
        self.addCleanup(shutil.rmtree, self.base_tmp, ignore_errors=True)
        self.other_tmp = tmp_root / f"web_{uuid.uuid4().hex}"
        self.other_tmp.mkdir(parents=True, exist_ok=False)
        self.addCleanup(shutil.rmtree, self.other_tmp, ignore_errors=True)

        os.environ["AI_FLOW_WEB_ROOT"] = str(self.base_tmp)
        import ai_flow_web.app as app_module

        self.app_module = importlib.reload(app_module)
        self.client = TestClient(self.app_module.app)

    def test_index_page_loads(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("ai_flow_web", response.text)

    def test_init_prepare_rejects_outside_root(self) -> None:
        outside_project = self.other_tmp / "project"
        response = self.client.post(
            "/init/prepare",
            data={"project_path": str(outside_project), "title": "", "date": ""},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("must be inside base root", response.text)

    def test_init_requires_confirmation(self) -> None:
        project_path = self.base_tmp / "demo_confirm"
        response = self.client.post(
            "/init/run",
            data={"project_path": str(project_path), "title": "", "date": "", "confirm": ""},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("Confirmation is required", response.text)

    def test_init_flow_creates_project(self) -> None:
        project_rel = "demo_project"
        response = self.client.post(
            "/init/prepare",
            data={"project_path": project_rel, "title": "Demo", "date": ""},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("Confirm init-project", response.text)

        project_path = self.base_tmp / project_rel
        response = self.client.post(
            "/init/run",
            data={"project_path": str(project_path), "title": "Demo", "date": "", "confirm": "yes"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue((project_path / "project.md").is_file())
        self.assertTrue((project_path / "branches" / "A" / "runs" / "A_001").is_dir())


if __name__ == "__main__":
    unittest.main()
