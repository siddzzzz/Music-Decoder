"""
Automated Test Suite for LooperEngine (Feature D: Practice Looper & Speed Trainer)
Verifies measure boundaries, passage slicing, and speed ramp schedule generation.
"""
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from engine.looper_engine import LooperEngine


class TestLooperEngine(unittest.TestCase):
    """Test suite for LooperEngine."""

    def setUp(self):
        # 4 measures of 4/4 at 120 BPM = 2.0s per measure (8.0s total)
        # 16 notes (quarter notes: 0.5s duration each, 4 notes per measure)
        self.notes = []
        for m in range(4):
            for b in range(4):
                start = m * 2.0 + b * 0.5
                self.notes.append({
                    "pitch": 60 + m * 2 + b,
                    "start": start,
                    "end": start + 0.45,
                    "duration": 0.45,
                    "velocity": 85
                })

    def test_seconds_per_measure(self):
        """Test calculation of seconds per measure across different tempos and meters."""
        # 120 BPM, 4/4 meter -> (60 / 120) * 4 = 2.0 seconds
        sec = LooperEngine.get_seconds_per_measure(120.0, "4/4")
        self.assertAlmostEqual(sec, 2.0, places=3)

        # 60 BPM, 3/4 meter -> (60 / 60) * 3 = 3.0 seconds
        sec_34 = LooperEngine.get_seconds_per_measure(60.0, "3/4")
        self.assertAlmostEqual(sec_34, 3.0, places=3)

        # 140 BPM, 6/8 meter (treated as 6 beats or standard)
        sec_68 = LooperEngine.get_seconds_per_measure(140.0, "6/8")
        self.assertGreater(sec_68, 0.0)

    def test_calculate_measure_bounds(self):
        """Verify calculation of measure start/end timestamps and note counts."""
        bounds = LooperEngine.calculate_measure_bounds(self.notes, bpm=120.0, time_signature="4/4")
        self.assertEqual(len(bounds), 4)

        # Check measure 1: 0.0 to 2.0s with 4 notes
        self.assertEqual(bounds[0]["measure"], 1)
        self.assertEqual(bounds[0]["start"], 0.0)
        self.assertEqual(bounds[0]["end"], 2.0)
        self.assertEqual(bounds[0]["notes_count"], 4)

        # Check measure 4: 6.0 to 8.0s with 4 notes
        self.assertEqual(bounds[3]["measure"], 4)
        self.assertEqual(bounds[3]["start"], 6.0)
        self.assertEqual(bounds[3]["end"], 8.0)
        self.assertEqual(bounds[3]["notes_count"], 4)

    def test_slice_excerpt(self):
        """Verify slicing of notes within measures 2 to 3."""
        # Measures 2 and 3 -> 2.0s to 6.0s (8 notes)
        excerpt = LooperEngine.slice_excerpt(
            notes=self.notes,
            start_measure=2,
            end_measure=3,
            bpm=120.0,
            time_signature="4/4",
            rebase_to_zero=False
        )

        self.assertEqual(excerpt["start_measure"], 2)
        self.assertEqual(excerpt["end_measure"], 3)
        self.assertEqual(excerpt["start_time"], 2.0)
        self.assertEqual(excerpt["end_time"], 6.0)
        self.assertEqual(excerpt["duration"], 4.0)
        self.assertEqual(excerpt["notes_count"], 8)

        # All notes should be within [2.0, 6.0]
        for n in excerpt["notes"]:
            self.assertGreaterEqual(n["start"], 2.0)
            self.assertLessEqual(n["end"], 6.0)

    def test_slice_excerpt_rebase_to_zero(self):
        """Verify rebase_to_zero shifts excerpt note timestamps to start at 0.0s."""
        excerpt = LooperEngine.slice_excerpt(
            notes=self.notes,
            start_measure=2,
            end_measure=2,
            bpm=120.0,
            time_signature="4/4",
            rebase_to_zero=True
        )

        self.assertEqual(excerpt["duration"], 2.0)
        self.assertEqual(excerpt["notes_count"], 4)
        self.assertEqual(excerpt["notes"][0]["start"], 0.0)
        self.assertLess(excerpt["notes"][-1]["end"], 2.0)

    def test_speed_ramp_schedule(self):
        """Verify speed trainer schedule progression from 60% to 100% in 10% steps."""
        schedule = LooperEngine.generate_speed_ramp_schedule(
            base_bpm=120.0,
            start_percent=60.0,
            target_percent=100.0,
            step_percent=10.0,
            reps_per_step=2
        )

        # Steps: 60%, 70%, 80%, 90%, 100% = 5 steps
        self.assertEqual(len(schedule), 5)
        self.assertEqual(schedule[0]["percent"], 60.0)
        self.assertEqual(schedule[0]["bpm"], 72.0)  # 120 * 0.6
        self.assertEqual(schedule[-1]["percent"], 100.0)
        self.assertEqual(schedule[-1]["bpm"], 120.0)

        for step in schedule:
            self.assertEqual(step["repetitions"], 2)

    def test_practice_endpoints(self):
        """Verify POST /api/practice/bounds and /api/practice/excerpt endpoints."""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)

        # 1. Bounds endpoint
        res_bounds = client.post("/api/practice/bounds", json={
            "notes": self.notes,
            "bpm": 120.0,
            "time_signature": "4/4"
        })
        self.assertEqual(res_bounds.status_code, 200)
        data_b = res_bounds.json()
        self.assertEqual(data_b["total_measures"], 4)
        self.assertEqual(len(data_b["measures"]), 4)

        # 2. Excerpt endpoint
        res_excerpt = client.post("/api/practice/excerpt", json={
            "task_id": "test_practice_123",
            "notes": self.notes,
            "start_measure": 1,
            "end_measure": 2,
            "bpm": 120.0,
            "time_signature": "4/4",
            "key_tonic": "C",
            "key_mode": "major",
            "start_percent": 60.0,
            "target_percent": 100.0,
            "step_percent": 20.0,
            "reps_per_step": 1
        })
        self.assertEqual(res_excerpt.status_code, 200)
        data_e = res_excerpt.json()
        self.assertEqual(data_e["start_measure"], 1)
        self.assertEqual(data_e["end_measure"], 2)
        self.assertEqual(data_e["notes_count"], 8)
        self.assertIn("score-partwise", data_e["musicxml"])
        self.assertEqual(len(data_e["speed_schedule"]), 3)  # 60%, 80%, 100%


if __name__ == "__main__":
    unittest.main()
