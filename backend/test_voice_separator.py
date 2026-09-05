"""
Verification Test Suite for Polyphonic Voice Separation & Dual Stem Direction Engine
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.voice_separator import VoiceSeparator
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_polyphonic_voice_separation():
    print("========================================")
    print("1. Testing Contrapuntal Overlap Detection & Voice Splitting...")

    # Classical 2-Voice Counterpoint (e.g. Bach Invention in C Major):
    # Soprano holds high G5 for full 4 beats while Inner voice plays running quarter notes E4, F4, G4, E4
    measure_notes = [
        {"pitch": 79, "name": "G5", "start": 0.0, "end": 2.0, "duration": 2.0, "velocity": 90},
        {"pitch": 64, "name": "E4", "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 80},
        {"pitch": 65, "name": "F4", "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 80},
        {"pitch": 67, "name": "G4", "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 80},
        {"pitch": 64, "name": "E4", "start": 1.5, "end": 2.0, "duration": 0.5, "velocity": 80},
    ]

    has_poly = VoiceSeparator.has_polyphonic_overlap(measure_notes)
    print(f"  Contrapuntal overlap detected: {has_poly}")
    assert has_poly is True, "Expected contrapuntal polyphony detected"

    v1, v2 = VoiceSeparator.separate_measure_voices(measure_notes)
    print(f"  Voice 1 (Upper line / Stems UP): {len(v1)} notes")
    for n in v1:
        print(f"    V1: {n['name']} (MIDI {n['pitch']}) | {n['start']:.2f}s - {n['end']:.2f}s | Stem: {n['stem_dir']}")
        assert n["voice"] == 1
        assert n["stem_dir"] == "up"

    print(f"  Voice 2 (Inner counterpoint / Stems DOWN): {len(v2)} notes")
    for n in v2:
        print(f"    V2: {n['name']} (MIDI {n['pitch']}) | {n['start']:.2f}s - {n['end']:.2f}s | Stem: {n['stem_dir']}")
        assert n["voice"] == 2
        assert n["stem_dir"] == "down"

    assert len(v1) == 1 and v1[0]["pitch"] == 79, "G5 should be assigned to Voice 1"
    assert len(v2) == 4, "Lower running quarter notes should be assigned to Voice 2"

    print("\n========================================")
    print("2. Testing MusicXML 4.0 Multi-Voice Engraving (<voice> and <stem> tags)...")

    score = ScoreQuantizer.build_score(
        note_events=measure_notes,
        bpm=120.0,
        time_signature_str="4/4",
        key_tonic="C",
        key_mode="major",
        clef_mode="treble",
        quantization_grid="1/16",
        title="Polyphonic Counterpoint with Dual Stems",
        composer="Music-Decoder AI"
    )

    xml_str = ScoreQuantizer.to_musicxml_string(score)
    print(f"  MusicXML generated ({len(xml_str)} characters)")
    assert "<voice>1</voice>" in xml_str, "Expected <voice>1</voice> in MusicXML"
    assert "<voice>2</voice>" in xml_str, "Expected <voice>2</voice> in MusicXML"
    assert "<stem>up</stem>" in xml_str, "Expected <stem>up</stem> in MusicXML"
    assert "<stem>down</stem>" in xml_str, "Expected <stem>down</stem> in MusicXML"
    print("  Verified: <voice>1</voice><stem>up</stem> and <voice>2</voice><stem>down</stem> successfully engraved in MusicXML 4.0!")

    print("\n========================================")
    print("3. Testing PDF Report Generation with Multi-Voice Engraving...")
    test_pdf = backend_dir / "temp" / "polyphonic_voices_test.pdf"
    ScoreExporter.generate_pdf_report(
        output_path=str(test_pdf),
        title="Polyphonic Counterpoint Score",
        composer="Music-Decoder AI",
        bpm=120.0,
        key_signature="C Major",
        time_signature="4/4",
        note_events=measure_notes,
        clef_mode="treble"
    )
    assert os.path.exists(test_pdf) and os.path.getsize(test_pdf) > 500
    print(f"  PDF with Multi-Voice Engraving generated: {os.path.exists(test_pdf)} ({os.path.getsize(test_pdf)} bytes)")

    print("\n========================================")
    print("ALL POLYPHONIC VOICE SEPARATION TESTS PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_polyphonic_voice_separation()
