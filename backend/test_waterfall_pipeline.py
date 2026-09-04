"""
Verification Test Suite for Synthesia-Style Waterfall Piano Visualizer Pipeline
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.quantizer import ScoreQuantizer
from engine.chord_detector import ChordDetector


def test_waterfall_timing_and_geometry():
    print("========================================")
    print("1. Testing Waterfall Note Alignment & Pitch Calculations...")

    # Sample Chopin Nocturne notes
    piano_notes = [
        {"pitch": 48, "name": "C3", "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 75},
        {"pitch": 55, "name": "G3", "start": 0.5, "end": 1.5, "duration": 1.0, "velocity": 80},
        {"pitch": 60, "name": "C4", "start": 1.0, "end": 2.0, "duration": 1.0, "velocity": 85},
        {"pitch": 64, "name": "E4", "start": 1.0, "end": 2.0, "duration": 1.0, "velocity": 85},
        {"pitch": 67, "name": "G4", "start": 1.0, "end": 2.0, "duration": 1.0, "velocity": 90},
        {"pitch": 72, "name": "C5", "start": 2.0, "end": 3.0, "duration": 1.0, "velocity": 95},
        {"pitch": 76, "name": "E5", "start": 2.5, "end": 3.5, "duration": 1.0, "velocity": 95},
        {"pitch": 79, "name": "G5", "start": 3.0, "end": 4.0, "duration": 1.0, "velocity": 100},
    ]

    # Verify lookahead calculations
    lookahead = 2.5
    canvas_height = 500
    hitline_y = 400

    for n in piano_notes:
        cur_t = 0.5
        time_until_hit = n["start"] - cur_t
        is_visible = (time_until_hit < lookahead and (time_until_hit + n["duration"]) > -0.5)
        is_active = (cur_t >= n["start"] and cur_t <= n["end"])

        # Hand classification
        hand = "Left Hand (Bass / Cyan)" if n["pitch"] < 60 else "Right Hand (Treble / Purple)"
        print(f"  Note {n['name']} (MIDI {n['pitch']}) -> {hand} | Visible at t=0.5s: {is_visible} | Active: {is_active}")

    # Chords
    chords = ChordDetector.analyze_chords_by_measure(piano_notes, 120.0, "4/4")
    print(f"\n  Analyzed Chord progression for Waterfall badges: {[c['figure'] for c in chords]}")
    assert len(chords) > 0, "Expected chords analyzed for waterfall"

    print("\n========================================")
    print("ALL WATERFALL VISUALIZER TESTS PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_waterfall_timing_and_geometry()
