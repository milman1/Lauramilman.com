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

    def test_source_watch_condition_repair_requires_manual_apply(self) -> None:
        workflow = (ROOT / ".github/workflows/lmny-source-watch-condition-repair.yml").read_text()

        self.assertIn(
            "DRY_RUN_INPUT: ${{ github.event_name != 'workflow_dispatch' || inputs.dry_run }}",
            workflow,
        )
        self.assertIn('if [ "$DRY_RUN_INPUT" = "false" ]; then', workflow)
        self.assertIn('gh run download "$REVIEWED_RUN_ID"', workflow)
        self.assertIn("--reviewed-plan=reviewed-plan/source-watch-condition-plan.json", workflow)
        self.assertIn('--plan-sha256="$PLAN_SHA256"', workflow)


if __name__ == "__main__":
    unittest.main()
