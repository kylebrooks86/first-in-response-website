"""No hosted access: exercise proposed QA-only compare-and-swap in in-memory SQLite."""
import json
import sqlite3
import unittest

from qa_retired_availability_cleanup_plan import (
    QA_NAME, QA_UUID, PREFERENCES_KEY, GUARDED_UPDATE,
    prepare_qa_cleanup,
)

NOW = "2026-10-29T20:00:00.000Z"


class RetiredAvailabilityPlanTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute(
            "CREATE TABLE message_templates "
            "(key TEXT PRIMARY KEY,subject TEXT,body TEXT,updated_at TEXT)"
        )
        self.data = {
            "revision": "synthetic-revision",
            "blocks": [
                {"id": "synthetic", "date": "2026-11-02",
                 "start": "07:00", "end": "17:00", "label": "Unavailable"}
            ],
            "repeatMonths": {"roof-wash": 18, "windows": 6},
        }
        self.old = json.dumps(self.data)
        self.db.executemany(
            "INSERT INTO message_templates VALUES (?,'',?,?)",
            [(PREFERENCES_KEY, self.old, NOW),
             ("another-template", "Do not change this content", NOW)],
        )

    def tearDown(self):
        self.db.close()

    def plan(self, body=None, *, name=QA_NAME, uuid=QA_UUID):
        return prepare_qa_cleanup(
            qa_name=name, qa_uuid=uuid,
            old_body=self.old if body is None else body,
            new_timestamp=NOW,
        )

    def test_only_availability_blocks_removed(self):
        plan = self.plan()
        self.assertTrue(plan.needs_cleanup)
        self.assertEqual(plan.removed_block_count, 1)
        self.assertEqual(plan.repeat_interval_count, 2)
        self.assertEqual(plan.key, PREFERENCES_KEY)
        self.assertEqual(plan.sql, GUARDED_UPDATE)
        self.assertEqual(self.db.execute(plan.sql, plan.parameters).rowcount, 1)
        parsed = json.loads(self.db.execute(
            "SELECT body FROM message_templates WHERE key=?",
            (PREFERENCES_KEY,)).fetchone()[0])
        self.assertEqual(parsed["blocks"], [])
        self.assertEqual(parsed["repeatMonths"], self.data["repeatMonths"])
        self.assertEqual(parsed["revision"], self.data["revision"])
        self.assertEqual(self.db.execute(
            "SELECT body FROM message_templates WHERE key='another-template'"
        ).fetchone()[0], "Do not change this content")

    def test_stale_snapshot_cannot_overwrite_newer_data(self):
        plan = self.plan()
        newer = json.dumps({**self.data, "repeatMonths": {"roof-wash": 12}})
        self.db.execute("UPDATE message_templates SET body=? WHERE key=?",
                        (newer, PREFERENCES_KEY))
        self.assertEqual(self.db.execute(plan.sql, plan.parameters).rowcount, 0)
        self.assertEqual(self.db.execute(
            "SELECT body FROM message_templates WHERE key=?",
            (PREFERENCES_KEY,)).fetchone()[0], newer)

    def test_retries_are_noop(self):
        plan = self.plan()
        self.assertEqual(self.db.execute(plan.sql, plan.parameters).rowcount, 1)
        self.assertEqual(self.db.execute(plan.sql, plan.parameters).rowcount, 0)
        body = self.db.execute("SELECT body FROM message_templates WHERE key=?",
                               (PREFERENCES_KEY,)).fetchone()[0]
        self.assertFalse(self.plan(body).needs_cleanup)

    def test_missing_record_does_not_generate_a_write(self):
        plan = prepare_qa_cleanup(
            qa_name=QA_NAME, qa_uuid=QA_UUID, old_body=None, new_timestamp=NOW
        )
        self.assertFalse(plan.needs_cleanup)
        self.assertIsNone(plan.sql)
        self.assertEqual(plan.parameters, ())

    def test_identity_and_content_fail_closed(self):
        for name, uuid in [("live", QA_UUID), (QA_NAME, "wrong-uuid")]:
            with self.assertRaisesRegex(ValueError, "QA_ONLY_IDENTITY_MISMATCH"):
                self.plan(name=name, uuid=uuid)
        for body in [
            "bad json", "{}", "[]", json.dumps({"blocks": [], "repeatMonths": {}}),
            json.dumps({**self.data, "repeatMonths": []}),
            json.dumps({**self.data, "blocks": "not an array"}),
            json.dumps({**self.data, "repeatMonths": {"roof-wash": -1}}),
            json.dumps({**self.data, "repeatMonths": {"roof-wash": True}}),
        ]:
            with self.assertRaises(ValueError):
                self.plan(body)

    def test_never_exposes_delete_or_unscoped_update(self):
        self.assertNotIn("DELETE", GUARDED_UPDATE)
        self.assertNotIn("DROP", GUARDED_UPDATE)
        self.assertIn("WHERE key=? AND body=?", GUARDED_UPDATE)
        self.assertNotIn("wrangler", GUARDED_UPDATE)


if __name__ == "__main__":
    unittest.main()
