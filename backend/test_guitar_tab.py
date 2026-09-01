"""
Verification Test Suite for 6-String Guitar & Bass Tablature (TAB) Engine
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.tab_engine import GuitarTabEngine
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_guitar_tab():
    print("========================================")
    print("1. Testing Fretboard Candidate Positions & Optimization...")

    # Test open strings
    # E2 (MIDI 40) -> String 6, Fret 0
    cands_e2 = GuitarTabEngine.get_candidate_positions(40)
    print(f"  E2 (MIDI 40) candidates: {cands_e2}")
    assert (6, 0) in cands_e2

    # A2 (MIDI 45) -> String 5, Fret 0 or String 6, Fret 5
    cands_a2 = GuitarTabEngine.get_candidate_positions(45)
    print(f"  A2 (MIDI 45) candidates: {cands_a2}")
    assert (5, 0) in cands_a2 and (6, 5) in cands_a2

    # E4 (MIDI 64) -> String 1, Fret 0 or String 2, Fret 5, etc.
    cands_e4 = GuitarTabEngine.get_candidate_positions(64)
    print(f"  E4 (MIDI 64) candidates: {cands_e4}")
    assert (1, 0) in cands_e4 and (2, 5) in cands_e4

    # Test C Major Chord (C3=48, E3=52, G3=55, C4=60, E4=64)
    c_major_chord = [
        {"pitch": 48, "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 85},  # C3 (Str 5 Fr 3)
        {"pitch": 52, "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 85},  # E3 (Str 4 Fr 2)
        {"pitch": 55, "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 85},  # G3 (Str 3 Fr 0)
        {"pitch": 60, "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 85},  # C4 (Str 2 Fr 1)
        {"pitch": 64, "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 85},  # E4 (Str 1 Fr 0)
    ]

    opt_chord = GuitarTabEngine.optimize_tablature(c_major_chord)
    strings_used = [n["string"] for n in opt_chord]
    frets_used = [n["fret"] for n in opt_chord]
    print(f"  C Major Chord Tablature -> Strings: {strings_used}, Frets: {frets_used}")
    # Verify no two notes share the same string
    assert len(strings_used) == len(set(strings_used)), "Chord notes must have distinct strings"
    assert all(0 <= f <= 22 for f in frets_used), "All frets must be physical (0-22)"

    # Test Sequential Melody (A Minor Pentatonic scale)
    am_pentatonic = [
        {"pitch": 57, "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 80},  # A3
        {"pitch": 60, "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 80},  # C4
        {"pitch": 62, "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 80},  # D4
        {"pitch": 64, "start": 1.5, "end": 2.0, "duration": 0.5, "velocity": 80},  # E4
        {"pitch": 67, "start": 2.0, "end": 2.5, "duration": 0.5, "velocity": 80},  # G4
        {"pitch": 69, "start": 2.5, "end": 3.0, "duration": 0.5, "velocity": 80},  # A4
    ]
    opt_melody = GuitarTabEngine.optimize_tablature(am_pentatonic)
    print("\n  A Minor Pentatonic Sequence:")
    for n in opt_melody:
        print(f"    MIDI {n['pitch']} -> String {n['string']}, Fret {n['fret']}")

    print("\n========================================")
    print("2. Testing 6-Line ASCII Tablature Generation...")
    ascii_tab = GuitarTabEngine.generate_ascii_tab(opt_melody, bpm=120.0, time_signature_str="4/4")
    print(ascii_tab)
    assert "e|" in ascii_tab and "B|" in ascii_tab and "G|" in ascii_tab
    assert "D|" in ascii_tab and "A|" in ascii_tab and "E|" in ascii_tab

    print("========================================")
    print("3. Testing Dual Staff MusicXML Engraving (Treble + TabClef)...")
    dual_score = ScoreQuantizer.build_score(
        note_events=c_major_chord + am_pentatonic,
        bpm=120.0,
        time_signature_str="4/4",
        key_tonic="C",
        key_mode="major",
        clef_mode="dual_tab",
        quantization_grid="1/16",
        title="Guitar Dual Tablature Score",
        composer="Music-Decoder AI"
    )

    xml_str = ScoreQuantizer.to_musicxml_string(dual_score)
    print(f"  Dual TAB MusicXML generated ({len(xml_str)} characters)")
    assert "<sign>TAB</sign>" in xml_str, "Expected <sign>TAB</sign> in MusicXML output"
    assert "<technical>" in xml_str or "<string>" in xml_str or "<fret>" in xml_str, "Expected technical string/fret tags"
    print("  Verified: <sign>TAB</sign> and <technical> tags successfully written to MusicXML 4.0!")

    print("\n========================================")
    print("4. Testing PDF Report Generation with Guitar Tablature...")
    test_pdf = backend_dir / "temp" / "guitar_tab_test.pdf"
    ScoreExporter.generate_pdf_report(
        output_path=str(test_pdf),
        title="Guitar Tablature Test",
        composer="Music-Decoder AI",
        bpm=120.0,
        key_signature="C Major",
        time_signature="4/4",
        note_events=c_major_chord + am_pentatonic,
        clef_mode="dual_tab"
    )
    assert os.path.exists(test_pdf) and os.path.getsize(test_pdf) > 500
    print(f"  PDF with Guitar Tablature generated: {os.path.exists(test_pdf)} ({os.path.getsize(test_pdf)} bytes)")

    print("\n========================================")
    print("ALL GUITAR TAB TESTS PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_guitar_tab()
