"""
Automated Test Suite for HarmonizerEngine and ScoreTransposer
Verifies 3-part vocal choir, string quartet, brass section, jazz tensions,
and Circle of Fifths chromatic transposition across all 12 keys.
"""
import os
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from engine.harmonizer import HarmonizerEngine
from engine.transposer import ScoreTransposer
from engine.quantizer import ScoreQuantizer


class TestHarmonizerEngine(unittest.TestCase):
    """Test suite for Auto-Chord Harmonizer."""

    def setUp(self):
        # Sample C major melody: C4, D4, E4, F4, G4, A4, B4, C5
        self.sample_melody = [
            {"pitch": 60, "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 85},
            {"pitch": 62, "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 85},
            {"pitch": 64, "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 85},
            {"pitch": 65, "start": 1.5, "end": 2.0, "duration": 0.5, "velocity": 85},
            {"pitch": 67, "start": 2.0, "end": 2.5, "duration": 0.5, "velocity": 85},
            {"pitch": 69, "start": 2.5, "end": 3.0, "duration": 0.5, "velocity": 85},
            {"pitch": 71, "start": 3.0, "end": 3.5, "duration": 0.5, "velocity": 85},
            {"pitch": 72, "start": 3.5, "end": 4.0, "duration": 0.5, "velocity": 90},
        ]

    def test_chord_tone_extraction(self):
        """Test extraction of chord tones for various harmonic qualities."""
        # C major triad: C, E, G (0, 4, 7)
        c_pcs = HarmonizerEngine.get_chord_tones("C")
        self.assertEqual(c_pcs, [0, 4, 7])

        # A minor triad: A, C, E (9, 0, 4)
        am_pcs = HarmonizerEngine.get_chord_tones("Am")
        self.assertEqual(am_pcs, [9, 0, 4])

        # G dominant 7: G, B, D, F (7, 11, 2, 5)
        g7_pcs = HarmonizerEngine.get_chord_tones("G7")
        self.assertEqual(g7_pcs, [7, 11, 2, 5])

        # F major 7: F, A, C, E (5, 9, 0, 4)
        fmaj7_pcs = HarmonizerEngine.get_chord_tones("Fmaj7")
        self.assertEqual(fmaj7_pcs, [5, 9, 0, 4])

    def test_choir_3part_harmonization(self):
        """Verify 3-part vocal choir generates Soprano, Alto, and Tenor/Bass tracks."""
        result = HarmonizerEngine.harmonize_melody(
            melody_notes=self.sample_melody,
            bpm=120.0,
            time_signature="4/4",
            key_tonic="C",
            key_mode="major",
            style="choir_3part"
        )

        self.assertIn("tracks", result)
        tracks = result["tracks"]
        self.assertIn("lead", tracks)     # Soprano
        self.assertIn("harmony", tracks)  # Alto
        self.assertIn("bass", tracks)     # Tenor / Bass

        soprano_notes = tracks["lead"]["notes"]
        alto_notes = tracks["harmony"]["notes"]
        bass_notes = tracks["bass"]["notes"]

        self.assertEqual(len(soprano_notes), len(self.sample_melody))
        self.assertEqual(len(alto_notes), len(self.sample_melody))
        self.assertEqual(len(bass_notes), len(self.sample_melody))

        # Check Alto pitches stay below Soprano
        for s, a in zip(soprano_notes, alto_notes):
            self.assertLess(a["pitch"], s["pitch"], "Alto note should be lower than Soprano melody")

        # Check Bass pitch range
        for b in bass_notes:
            self.assertGreaterEqual(b["pitch"], 36)
            self.assertLessEqual(b["pitch"], 55)

    def test_string_quartet_harmonization(self):
        """Verify string quartet creates Violin I, Violin II, Viola, and Cello."""
        result = HarmonizerEngine.harmonize_melody(
            melody_notes=self.sample_melody,
            bpm=120.0,
            time_signature="4/4",
            key_tonic="C",
            key_mode="major",
            style="string_quartet"
        )

        tracks = result["tracks"]
        self.assertIn("lead", tracks)      # Violin I
        self.assertIn("harmony", tracks)   # Violin II & Viola
        self.assertIn("bass", tracks)      # Cello

        self.assertGreater(len(result["all_notes"]), len(self.sample_melody))

    def test_brass_horns_harmonization(self):
        """Verify brass & horn section voicing generation."""
        result = HarmonizerEngine.harmonize_melody(
            melody_notes=self.sample_melody,
            bpm=120.0,
            time_signature="4/4",
            key_tonic="C",
            key_mode="major",
            style="brass_horns"
        )
        self.assertEqual(result["style"], "brass_horns")
        self.assertIn("lead", result["tracks"])
        self.assertIn("harmony", result["tracks"])
        self.assertIn("bass", result["tracks"])

    def test_jazz_tensions_harmonization(self):
        """Verify jazz tensions voicing generation."""
        result = HarmonizerEngine.harmonize_melody(
            melody_notes=self.sample_melody,
            bpm=120.0,
            time_signature="4/4",
            key_tonic="C",
            key_mode="major",
            style="jazz_tensions"
        )
        self.assertEqual(result["style"], "jazz_tensions")
        self.assertIn("tracks", result)
        self.assertGreater(len(result["all_notes"]), 0)


class TestScoreTransposer(unittest.TestCase):
    """Test suite for Circle of Fifths ScoreTransposer."""

    def setUp(self):
        self.sample_notes = [
            {"pitch": 60, "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 80},  # C4
            {"pitch": 64, "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 80},  # E4
            {"pitch": 67, "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 80},  # G4
        ]
        self.sample_chords = [
            {"measure": 1, "figure": "C", "start": 0.0},
            {"measure": 2, "figure": "Am", "start": 2.0},
            {"measure": 3, "figure": "F", "start": 4.0},
            {"measure": 4, "figure": "G7", "start": 6.0},
        ]

    def test_pitch_transposition(self):
        """Test semitone shifting of note pitches."""
        # Transpose C4 (+2 semitones) -> D4 (pitch 62)
        new_p, name = ScoreTransposer.transpose_pitch(60, 2)
        self.assertEqual(new_p, 62)
        self.assertEqual(name, "D4")

        # Transpose C4 (-1 semitone) -> B3 (pitch 59)
        new_p, name = ScoreTransposer.transpose_pitch(60, -1)
        self.assertEqual(new_p, 59)
        self.assertEqual(name, "B3")

    def test_key_transposition(self):
        """Test key tonic shifting across Circle of Fifths."""
        # C + 2 semitones -> D Major
        tonic, mode, display = ScoreTransposer.transpose_key("C", "major", 2)
        self.assertEqual(tonic, "D")
        self.assertEqual(display, "D Major")

        # C + 7 semitones (fifth up) -> G Major
        tonic, mode, display = ScoreTransposer.transpose_key("C", "major", 7)
        self.assertEqual(tonic, "G")
        self.assertEqual(display, "G Major")

        # C - 1 semitones -> B Major
        tonic, mode, display = ScoreTransposer.transpose_key("C", "major", -1)
        self.assertEqual(tonic, "B")

        # F + 1 semitone -> F# or Gb Major
        tonic, mode, display = ScoreTransposer.transpose_key("F", "major", 1)
        self.assertIn(tonic, ["F#", "Gb"])

    def test_chord_figure_transposition(self):
        """Test transposing chord names including minor, 7th, and slash chords."""
        # C + 2 -> D
        self.assertEqual(ScoreTransposer.transpose_chord_figure("C", 2), "D")

        # Am + 2 -> Bm
        self.assertEqual(ScoreTransposer.transpose_chord_figure("Am", 2), "Bm")

        # G7 + 5 -> C7
        self.assertEqual(ScoreTransposer.transpose_chord_figure("G7", 5), "C7")

        # C/E + 2 -> D/F#
        self.assertEqual(ScoreTransposer.transpose_chord_figure("C/E", 2), "D/F#")

    def test_full_score_transposition(self):
        """Test complete transposition of notes, chords, and guitar TAB."""
        res = ScoreTransposer.transpose_score_data(
            notes=self.sample_notes,
            semitones=2,
            key_tonic="C",
            key_mode="major",
            chords=self.sample_chords,
            bpm=120.0,
            time_signature="4/4"
        )

        self.assertEqual(res["key"]["tonic"], "D")
        self.assertEqual(res["key"]["display"], "D Major")

        # Pitches should be shifted by +2
        transposed_pitches = [n["pitch"] for n in res["notes"]]
        self.assertEqual(transposed_pitches, [62, 66, 69])

        # Chords should be D, Bm, G, A7
        transposed_chords = [c["figure"] for c in res["chords"]]
        self.assertEqual(transposed_chords, ["D", "Bm", "G", "A7"])

        # Tab notes should be present
        self.assertEqual(len(res["tab_notes"]), 3)
        self.assertTrue(len(res["ascii_tab"]) > 0)


if __name__ == "__main__":
    unittest.main()
