"""
Verification Test for Multi-Track Orchestral Transcription on CUDA
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from engine.sample_generator import SampleGenerator
from engine.multitrack_engine import MultiTrackEngine
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter


def test_multitrack_pipeline():
    print("========================================")
    print("1. Generating Symphonic Ensemble sample...")
    samples_dir = backend_dir / "samples"
    samples = SampleGenerator.generate_all_samples(str(samples_dir))
    orch_sample = next((s for s in samples if s["id"] == "orchestra_ensemble"), samples[-1])
    audio_path = orch_sample["path"]
    print(f"Testing with: {orch_sample['name']} ({audio_path})")

    print("\n========================================")
    print("2. Running Multi-Track Neural Engine (Demucs CUDA + Transcribers)...")
    test_task_dir = backend_dir / "temp" / "multitrack_test"
    test_task_dir.mkdir(parents=True, exist_ok=True)

    mt_engine = MultiTrackEngine()
    result = mt_engine.process_multitrack(
        audio_path=audio_path,
        output_dir=str(test_task_dir)
    )

    print(f"Hardware Device Used: {result['device'].upper()}")
    print(f"Duration: {result['duration']}s")
    print(f"Estimated BPM: {result['tempo']}")
    print(f"Key: {result['key']['display']}")
    print(f"Total Notes Detected across all Stems: {result['total_notes']}")

    print("\nStem breakdown:")
    for track_id, track_info in result["tracks"].items():
        print(f"  [{track_id.upper()}] {track_info['name']}: {track_info['notes_count']} notes transcribed (audio: {os.path.exists(track_info['audio_path'])})")
        assert os.path.exists(track_info["audio_path"]), f"Stem audio file missing for {track_id}"

    assert result["total_notes"] > 0, "Expected at least some notes across stems"

    print("\n========================================")
    print("3. Building Multi-Staff Orchestral MusicXML Score...")
    score = ScoreQuantizer.build_multitrack_score(
        tracks=result["tracks"],
        bpm=result["tempo"],
        time_signature_str="4/4",
        key_tonic=result["key"]["tonic"],
        key_mode=result["key"]["mode"],
        quantization_grid="1/16",
        title="Symphonic Ensemble Test Score",
        composer="Music-Decoder AI"
    )

    musicxml_str = ScoreQuantizer.to_musicxml_string(score)
    print(f"Multi-Staff MusicXML Generated ({len(musicxml_str)} chars)")
    assert "<score-partwise" in musicxml_str

    print("\n========================================")
    print("4. Exporting Multi-Track MIDI and Conductor PDF...")
    xml_path = str(test_task_dir / "orchestral_score.musicxml")
    midi_path = str(test_task_dir / "orchestral_multitrack.mid")
    pdf_path = str(test_task_dir / "conductor_score.pdf")

    ScoreExporter.save_musicxml(score, xml_path)
    ScoreExporter.save_multitrack_midi(result["tracks"], result["tempo"], midi_path)
    ScoreExporter.generate_multitrack_pdf_report(
        output_path=pdf_path,
        title="Symphonic Ensemble Test Score",
        composer="Music-Decoder AI",
        bpm=result["tempo"],
        key_signature=result["key"]["display"],
        time_signature="4/4",
        tracks=result["tracks"]
    )

    print(f"MusicXML saved: {os.path.exists(xml_path)} ({os.path.getsize(xml_path)} bytes)")
    print(f"Multi-Track MIDI saved: {os.path.exists(midi_path)} ({os.path.getsize(midi_path)} bytes)")
    print(f"Conductor PDF saved: {os.path.exists(pdf_path)} ({os.path.getsize(pdf_path)} bytes)")

    assert os.path.exists(xml_path) and os.path.getsize(xml_path) > 100
    assert os.path.exists(midi_path) and os.path.getsize(midi_path) > 100
    assert os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 500

    print("\n========================================")
    print("MULTI-TRACK CUDA VERIFICATION PASSED 100%!")
    print("========================================")


if __name__ == "__main__":
    test_multitrack_pipeline()
