"""
Automated Pipeline Verification Test for Music-Decoder Backend
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.sample_generator import SampleGenerator
from engine.audio_processor import AudioProcessor
from engine.transcriber import Transcriber
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_full_pipeline():
    print("========================================")
    print("1. Generating instrumental sample audio...")
    test_samples_dir = backend_dir / "samples"
    samples = SampleGenerator.generate_all_samples(str(test_samples_dir))
    print(f"Generated {len(samples)} sample tracks.")
    assert len(samples) >= 3, "Expected at least 3 sample tracks"

    piano_sample = samples[0]
    audio_path = piano_sample["path"]
    print(f"Testing with: {piano_sample['name']} ({audio_path})")

    print("\n========================================")
    print("2. Audio Processing & Feature Extraction...")
    audio_features = AudioProcessor.analyze_audio(audio_path)
    print(f"Duration: {audio_features['duration']}s")
    print(f"Estimated BPM: {audio_features['tempo']}")
    print(f"Estimated Key: {audio_features['key']['display']} (confidence: {audio_features['key']['confidence']})")
    print(f"Waveform points: {len(audio_features['waveform'])}")
    assert audio_features["duration"] > 0, "Duration must be positive"

    print("\n========================================")
    print("3. Deep Learning Note Transcription...")
    transcriber = Transcriber()
    midi_data, note_events = transcriber.transcribe(
        audio_path=audio_path,
        onset_threshold=0.45,
        frame_threshold=0.25,
        minimum_note_length=50.0,
        midi_tempo=audio_features["tempo"]
    )
    print(f"Transcribed {len(note_events)} note events.")
    assert len(note_events) > 0, "Must detect at least 1 note"
    print("Sample transcribed notes:")
    for n in note_events[:6]:
        print(f"  Note {n['name']} (MIDI {n['pitch']}): {n['start']}s -> {n['end']}s (dur: {n['duration']}s, vel: {n['velocity']})")

    print("\n========================================")
    print("4. Musical Quantization & MusicXML Generation...")
    score = ScoreQuantizer.build_score(
        note_events=note_events,
        bpm=audio_features["tempo"],
        time_signature_str="4/4",
        key_tonic=audio_features["key"]["tonic"],
        key_mode=audio_features["key"]["mode"],
        clef_mode="grand_staff",
        quantization_grid="1/16",
        title="Test Piano Arpeggio",
        composer="Music-Decoder AI"
    )
    musicxml_str = ScoreQuantizer.to_musicxml_string(score)
    print(f"MusicXML String Generated: {len(musicxml_str)} characters.")
    assert "<score-partwise" in musicxml_str, "Valid MusicXML must contain <score-partwise>"
    assert "</score-partwise>" in musicxml_str, "Valid MusicXML must close with </score-partwise>"

    print("\n========================================")
    print("5. Exporting to MIDI, MusicXML, and PDF...")
    test_export_dir = backend_dir / "temp" / "test_run"
    test_export_dir.mkdir(parents=True, exist_ok=True)

    xml_file = str(test_export_dir / "test_score.musicxml")
    mid_file = str(test_export_dir / "test_score.mid")
    pdf_file = str(test_export_dir / "test_score.pdf")

    ScoreExporter.save_musicxml(score, xml_file)
    ScoreExporter.save_midi(midi_data, mid_file)
    ScoreExporter.generate_pdf_report(
        output_path=pdf_file,
        title="Test Piano Arpeggio",
        composer="Music-Decoder AI",
        bpm=audio_features["tempo"],
        key_signature=audio_features["key"]["display"],
        time_signature="4/4",
        note_events=note_events,
        clef_mode="grand_staff"
    )

    print(f"MusicXML saved: {os.path.exists(xml_file)} ({os.path.getsize(xml_file)} bytes)")
    print(f"MIDI saved: {os.path.exists(mid_file)} ({os.path.getsize(mid_file)} bytes)")
    print(f"PDF Sheet Music saved: {os.path.exists(pdf_file)} ({os.path.getsize(pdf_file)} bytes)")

    assert os.path.exists(xml_file) and os.path.getsize(xml_file) > 100
    assert os.path.exists(mid_file) and os.path.getsize(mid_file) > 50
    assert os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 500

    print("\n========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! 100% READY.")
    print("========================================")


if __name__ == "__main__":
    test_full_pipeline()
