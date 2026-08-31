"""
Verification Test for Harmonic Chord Detection and Score Re-Quantization
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.chord_detector import ChordDetector
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_chord_detector():
    print("========================================")
    print("1. Testing Harmonic Chord Detection...")

    # Test C Major Triad (C4, E4, G4)
    c_notes = [
        {"pitch": 60, "duration": 0.5, "velocity": 90},
        {"pitch": 64, "duration": 0.5, "velocity": 85},
        {"pitch": 67, "duration": 0.5, "velocity": 85}
    ]
    c_res = ChordDetector.detect_chord_from_notes(c_notes)
    print(f"  C Major Triad -> Inferred: {c_res['figure']} (confidence: {c_res['confidence']})")
    assert c_res["root"] == "C" and c_res["quality"] == ""

    # Test A Minor Triad (A3, C4, E4)
    am_notes = [
        {"pitch": 57, "duration": 0.5, "velocity": 80},
        {"pitch": 60, "duration": 0.5, "velocity": 80},
        {"pitch": 64, "duration": 0.5, "velocity": 80}
    ]
    am_res = ChordDetector.detect_chord_from_notes(am_notes)
    print(f"  A Minor Triad -> Inferred: {am_res['figure']} (confidence: {am_res['confidence']})")
    assert am_res["root"] == "A" and am_res["quality"] == "m"

    # Test G7 Dominant (G3, B3, D4, F4)
    g7_notes = [
        {"pitch": 55, "duration": 0.5, "velocity": 90},
        {"pitch": 59, "duration": 0.5, "velocity": 85},
        {"pitch": 62, "duration": 0.5, "velocity": 85},
        {"pitch": 65, "duration": 0.5, "velocity": 90}
    ]
    g7_res = ChordDetector.detect_chord_from_notes(g7_notes)
    print(f"  G7 Dominant -> Inferred: {g7_res['figure']} (confidence: {g7_res['confidence']})")
    assert g7_res["root"] == "G" and g7_res["quality"] == "7"

    # Test Timeline Analysis across 4 measures (C -> G -> Am -> F)
    progression_notes = [
        # Measure 1: C Major (t = 0.0 to 2.0s)
        {"pitch": 48, "start": 0.0, "end": 1.9, "duration": 1.9, "velocity": 80},
        {"pitch": 60, "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 85},
        {"pitch": 64, "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 85},
        {"pitch": 67, "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 85},

        # Measure 2: G Major (t = 2.0 to 4.0s)
        {"pitch": 43, "start": 2.0, "end": 3.9, "duration": 1.9, "velocity": 80},
        {"pitch": 55, "start": 2.0, "end": 2.5, "duration": 0.5, "velocity": 85},
        {"pitch": 59, "start": 2.5, "end": 3.0, "duration": 0.5, "velocity": 85},
        {"pitch": 62, "start": 3.0, "end": 3.5, "duration": 0.5, "velocity": 85},

        # Measure 3: A Minor (t = 4.0 to 6.0s)
        {"pitch": 45, "start": 4.0, "end": 5.9, "duration": 1.9, "velocity": 80},
        {"pitch": 57, "start": 4.0, "end": 4.5, "duration": 0.5, "velocity": 85},
        {"pitch": 60, "start": 4.5, "end": 5.0, "duration": 0.5, "velocity": 85},
        {"pitch": 64, "start": 5.0, "end": 5.5, "duration": 0.5, "velocity": 85},

        # Measure 4: F Major (t = 6.0 to 8.0s)
        {"pitch": 41, "start": 6.0, "end": 7.9, "duration": 1.9, "velocity": 80},
        {"pitch": 53, "start": 6.0, "end": 6.5, "duration": 0.5, "velocity": 85},
        {"pitch": 57, "start": 6.5, "end": 7.0, "duration": 0.5, "velocity": 85},
        {"pitch": 60, "start": 7.0, "end": 7.5, "duration": 0.5, "velocity": 85},
    ]

    prog = ChordDetector.analyze_chords_by_measure(progression_notes, bpm=120.0, time_signature_str="4/4")
    print(f"\n  Analyzed 4-bar progression: {[c['figure'] for c in prog]}")
    assert len(prog) == 4
    assert prog[0]["root"] == "C"
    assert prog[1]["root"] == "G"
    assert prog[2]["root"] == "A"
    assert prog[3]["root"] == "F"

    print("\n========================================")
    print("2. Testing Score Engraving with <harmony> tags...")
    score = ScoreQuantizer.build_score(
        note_events=progression_notes,
        bpm=120.0,
        time_signature_str="4/4",
        key_tonic="C",
        key_mode="major",
        clef_mode="grand_staff",
        quantization_grid="1/16",
        title="Chord Test Score",
        composer="Music-Decoder AI"
    )

    xml_str = ScoreQuantizer.to_musicxml_string(score)
    print(f"  MusicXML generated ({len(xml_str)} bytes)")
    assert "<harmony" in xml_str, "Expected <harmony> chord symbol tags in MusicXML"
    print("  Verified: <harmony> tags successfully engraved in MusicXML 4.0!")

    print("\n========================================")
    print("3. Testing PDF Generation with Chord Progression...")
    test_pdf = backend_dir / "temp" / "chord_test.pdf"
    ScoreExporter.generate_pdf_report(
        output_path=str(test_pdf),
        title="Chord Progression Test",
        composer="Music-Decoder AI",
        bpm=120.0,
        key_signature="C Major",
        time_signature="4/4",
        note_events=progression_notes,
        clef_mode="grand_staff"
    )
    assert os.path.exists(test_pdf) and os.path.getsize(test_pdf) > 500
    print(f"  PDF with Chords generated: {os.path.exists(test_pdf)} ({os.path.getsize(test_pdf)} bytes)")

    print("\n========================================")
    print("ALL CHORD & ENGRAVING TESTS PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_chord_detector()
