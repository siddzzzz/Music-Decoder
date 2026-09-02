"""
Verification Test Suite for AI Vocal Lyrics Alignment & Text-to-Score Engine
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.lyrics_aligner import LyricsAligner
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_lyrics_alignment():
    print("========================================")
    print("1. Testing Melodic Temporal Lyrics Alignment...")

    # Sample singing melody notes (Twinkle Twinkle Little Star: C4 C4 G4 G4 A4 A4 G4)
    vocal_notes = [
        {"pitch": 60, "name": "C4", "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 85},
        {"pitch": 60, "name": "C4", "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 85},
        {"pitch": 67, "name": "G4", "start": 1.0, "end": 1.5, "duration": 0.5, "velocity": 85},
        {"pitch": 67, "name": "G4", "start": 1.5, "end": 2.0, "duration": 0.5, "velocity": 85},
        {"pitch": 69, "name": "A4", "start": 2.0, "end": 2.5, "duration": 0.5, "velocity": 85},
        {"pitch": 69, "name": "A4", "start": 2.5, "end": 3.0, "duration": 0.5, "velocity": 85},
        {"pitch": 67, "name": "G4", "start": 3.0, "end": 4.0, "duration": 1.0, "velocity": 85},
    ]

    # Timestamped words from speech-to-text
    words_stream = [
        {"word": "Twin-", "start": 0.02, "end": 0.45, "confidence": 0.98},
        {"word": "kle", "start": 0.52, "end": 0.95, "confidence": 0.99},
        {"word": "twin-", "start": 1.04, "end": 1.48, "confidence": 0.97},
        {"word": "kle", "start": 1.52, "end": 1.95, "confidence": 0.99},
        {"word": "lit-", "start": 2.02, "end": 2.45, "confidence": 0.96},
        {"word": "tle", "start": 2.55, "end": 2.95, "confidence": 0.98},
        {"word": "star", "start": 3.05, "end": 3.90, "confidence": 0.99},
    ]

    aligned_notes = LyricsAligner.align_words_to_notes(vocal_notes, words_stream)
    print("  Aligned Notes & Syllables:")
    for n in aligned_notes:
        print(f"    Note {n['name']} ({n['start']:.2f}s - {n['end']:.2f}s) -> Lyric: \"{n.get('lyric')}\"")
        assert "lyric" in n, f"Note {n['name']} at {n['start']}s should have an aligned lyric"

    assert aligned_notes[0]["lyric"] == "Twin-"
    assert aligned_notes[1]["lyric"] == "kle"
    assert aligned_notes[6]["lyric"] == "star"

    print("\n========================================")
    print("2. Testing MusicXML 4.0 <lyric> Engraving...")
    score = ScoreQuantizer.build_score(
        note_events=aligned_notes,
        bpm=120.0,
        time_signature_str="4/4",
        key_tonic="C",
        key_mode="major",
        clef_mode="treble",
        quantization_grid="1/16",
        title="Vocal Sheet Music with Lyrics",
        composer="Music-Decoder AI"
    )

    xml_str = ScoreQuantizer.to_musicxml_string(score)
    print(f"  MusicXML generated ({len(xml_str)} characters)")
    assert "<lyric" in xml_str, "Expected <lyric> elements in MusicXML output"
    assert "<text>Twin-</text>" in xml_str or "<text>star</text>" in xml_str, "Expected lyric text in MusicXML"
    print("  Verified: <lyric> and <text> tags successfully engraved in MusicXML 4.0!")

    print("\n========================================")
    print("3. Testing PDF Report Generation with Singing Lyrics...")
    test_pdf = backend_dir / "temp" / "vocal_lyrics_test.pdf"
    ScoreExporter.generate_pdf_report(
        output_path=str(test_pdf),
        title="Vocal Sheet Music with Lyrics",
        composer="Music-Decoder AI",
        bpm=120.0,
        key_signature="C Major",
        time_signature="4/4",
        note_events=aligned_notes,
        clef_mode="treble"
    )
    assert os.path.exists(test_pdf) and os.path.getsize(test_pdf) > 500
    print(f"  PDF with Vocal Lyrics generated: {os.path.exists(test_pdf)} ({os.path.getsize(test_pdf)} bytes)")

    print("\n========================================")
    print("ALL VOCAL LYRICS ALIGNMENT TESTS PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_lyrics_alignment()
