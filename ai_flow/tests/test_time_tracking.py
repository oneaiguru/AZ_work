import tempfile
from datetime import datetime, timedelta
from pathlib import Path
import unittest

import ai_flow  # noqa: E402


class TimeTrackingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project_dir = Path(self.tmp.name) / "project"
        self.project_dir.mkdir(parents=True, exist_ok=True)
        (self.project_dir / "journal.md").write_text("", encoding="utf-8")
        (self.project_dir / "branches").mkdir(exist_ok=True)

    def write_time_log(self, lines: str) -> None:
        (self.project_dir / "time_log.md").write_text(lines, encoding="utf-8")

    def test_generate_time_report_rounding_and_summary(self) -> None:
        self.write_time_log(
            "\n".join(
                [
                    "2026-02-04 10:07 | event: start | activity: coding | branch: A_main | step: A_001",
                    "2026-02-04 10:52 | event: pause",
                    "2026-02-04 10:58 | event: resume",
                    "2026-02-04 11:40 | event: stop",
                ]
            )
        )
        start = datetime(2026, 2, 4)
        end = start + timedelta(days=1)
        report = ai_flow.generate_time_report(
            str(self.project_dir), ai_flow.align_down_to_quarter(start), ai_flow.align_up_to_quarter(end)
        )
        self.assertIn("Итого: 1ч 30м", report)
        self.assertIn("coding", report)
        self.assertIn("A_main", report)

    def test_generate_time_report_merges_adjacent(self) -> None:
        self.write_time_log(
            "\n".join(
                [
                    "2026-02-05 09:50 | event: start | activity: reading | branch: B | step: B_001",
                    "2026-02-05 10:05 | event: switch | activity: reading | branch: B | step: B_001",
                    "2026-02-05 10:30 | event: stop",
                ]
            )
        )
        start = datetime(2026, 2, 5)
        end = start + timedelta(days=1)
        report = ai_flow.generate_time_report(
            str(self.project_dir), ai_flow.align_down_to_quarter(start), ai_flow.align_up_to_quarter(end)
        )
        self.assertIn("reading", report)
        self.assertEqual(report.count("reading B / B_001"), 1)


if __name__ == "__main__":
    unittest.main()
