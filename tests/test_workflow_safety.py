from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class WorkflowSafetyTests(unittest.TestCase):
    def test_ebay_repair_pull_requests_cannot_apply_live(self) -> None:
        workflow = (ROOT / ".github/workflows/lmny-ebay-preowned-features.yml").read_text()

        self.assertIn(
            "DRY_RUN_INPUT: ${{ github.event_name != 'workflow_dispatch' || inputs.dry_run }}",
            workflow,
        )
        self.assertNotIn("github.event_name == 'pull_request' && 'false'", workflow)
        self.assertIn('if [ "$DRY_RUN_INPUT" = "false" ]; then', workflow)
        self.assertIn("npx tsx scripts/fix-ebay-preowned-features.ts --apply", workflow)


if __name__ == "__main__":
    unittest.main()
