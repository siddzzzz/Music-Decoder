"""
Automated Test Suite for Individual Instrument Part Extractor & Master Multi-Page PDF Booklet
"""
import os
import shutil
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient

from main import app, _generate_parts_and_booklet
from engine.exporter import ScoreExporter
from engine.quantizer import ScoreQuantizer


def test_part_extractor_and_booklet():
    print("\n--- [TEST 1] Testing ScoreExporter Part PDF & Orchestral Booklet ---")
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Mock multi-track data
        sample_tracks = {
            "lead": {
                "name": "Lead / Winds / Solo",
                "instrument": "Flute / Solo",
                "notes": [
                    {"pitch": 72, "name": "C5", "start": 0.0, "end": 0.5, "duration": 0.5, "velocity": 90},
                    {"pitch": 74, "name": "D5", "start": 0.5, "end": 1.0, "duration": 0.5, "velocity": 95},
                    {"pitch": 76, "name": "E5", "start": 1.0, "end": 2.0, "duration": 1.0, "velocity": 85},
                ]
            },
            "harmony": {
                "name": "Harmony / Keys / Strings",
                "instrument": "Piano",
                "notes": [
                    {"pitch": 60, "name": "C4", "start": 0.0, "end": 2.0, "duration": 2.0, "velocity": 75},
                    {"pitch": 64, "name": "E4", "start": 0.0, "end": 2.0, "duration": 2.0, "velocity": 75},
                    {"pitch": 67, "name": "G4", "start": 0.0, "end": 2.0, "duration": 2.0, "velocity": 75},
                ]
            },
            "bass": {
                "name": "Bassline / Cello",
                "instrument": "Electric Bass",
                "notes": [
                    {"pitch": 36, "name": "C2", "start": 0.0, "end": 1.0, "duration": 1.0, "velocity": 100},
                    {"pitch": 43, "name": "G2", "start": 1.0, "end": 2.0, "duration": 1.0, "velocity": 95},
                ]
            },
            "drums": {
                "name": "Drums / Percussion",
                "instrument": "Drum Kit",
                "notes": [
                    {"pitch": 36, "name": "Kick", "piece": "Kick Drum", "start": 0.0, "end": 0.2, "duration": 0.2, "velocity": 100},
                    {"pitch": 38, "name": "Snare", "piece": "Snare Drum", "start": 1.0, "end": 1.2, "duration": 0.2, "velocity": 95},
                    {"pitch": 42, "name": "Closed HH", "piece": "Closed Hi-Hat", "start": 0.0, "end": 0.1, "duration": 0.1, "velocity": 80},
                ]
            }
        }

        # 1. Test Single Part PDF generation
        lead_pdf = str(temp_path / "lead_part.pdf")
        ScoreExporter.generate_part_pdf_report(
            output_path=lead_pdf,
            part_name="Lead / Winds / Solo",
            instrument_name="Flute",
            title="Symphonic Suite",
            composer="AI Composer",
            bpm=120.0,
            key_signature="C Major",
            time_signature="4/4",
            note_events=sample_tracks["lead"]["notes"],
            clef_mode="treble"
        )
        assert os.path.exists(lead_pdf), "Lead Part PDF was not created"
        assert os.path.getsize(lead_pdf) > 1000, "Lead Part PDF is unexpectedly small"
        print(" -> Lead Part PDF generated successfully:", os.path.getsize(lead_pdf), "bytes")

        # 2. Test Master Orchestral Multi-Page Booklet PDF generation
        booklet_pdf = str(temp_path / "orchestral_booklet.pdf")
        ScoreExporter.generate_orchestral_booklet(
            output_path=booklet_pdf,
            title="Symphonic Suite",
            composer="AI Composer",
            bpm=120.0,
            key_signature="C Major",
            time_signature="4/4",
            tracks=sample_tracks
        )
        assert os.path.exists(booklet_pdf), "Master Orchestral Booklet PDF was not created"
        assert os.path.getsize(booklet_pdf) > 2000, "Master Booklet PDF is unexpectedly small"
        print(" -> Master Multi-Page Orchestral Booklet PDF generated successfully:", os.path.getsize(booklet_pdf), "bytes")

        # 3. Test _generate_parts_and_booklet helper
        task_id = "test-task-123"
        export_info = _generate_parts_and_booklet(
            task_dir=temp_path,
            tracks=sample_tracks,
            effective_bpm=120.0,
            time_signature="4/4",
            effective_tonic="C",
            effective_mode="major",
            quantization_grid="1/16",
            title="Symphonic Suite",
            composer="AI Composer",
            task_id=task_id
        )

        assert "booklet" in export_info
        assert "parts" in export_info
        assert len(export_info["parts"]) == 4

        for part_key in ["lead", "harmony", "bass", "drums"]:
            assert part_key in export_info["parts"]
            p_pdf = temp_path / "parts" / f"{part_key}.pdf"
            p_xml = temp_path / "parts" / f"{part_key}.musicxml"
            p_mid = temp_path / "parts" / f"{part_key}.mid"
            assert p_pdf.exists(), f"Part PDF missing for {part_key}"
            assert p_xml.exists(), f"Part MusicXML missing for {part_key}"
            assert p_mid.exists(), f"Part MIDI missing for {part_key}"

        print(" -> All 4 performer parts (PDF, MusicXML, MIDI) verified in parts folder.")


def test_api_endpoints():
    print("\n--- [TEST 2] Testing FastAPI Booklet & Part Download Endpoints ---")
    client = TestClient(app)

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200

    # 2. Get demo samples
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]
    orch_sample = next((s for s in samples if s["id"] == "orchestra_sample"), samples[0])

    # 3. Run multi-track transcription on sample
    print(f" -> Transcribing sample {orch_sample['id']} in multi-track mode...")
    trans_res = client.post(
        "/api/transcribe-sample-multitrack",
        data={
            "sample_id": orch_sample["id"],
            "quantization_grid": "1/16",
            "time_signature": "4/4"
        }
    )
    assert trans_res.status_code == 200
    data = trans_res.json()
    task_id = data["task_id"]
    exports = data["exports"]

    assert "booklet" in exports, "Exports does not contain booklet endpoint"
    assert "parts" in exports, "Exports does not contain parts dictionary"
    print(" -> Response exports contain booklet and parts!")

    # 4. Test download booklet endpoint
    booklet_res = client.get(f"/api/export/{task_id}/booklet")
    assert booklet_res.status_code == 200
    assert booklet_res.headers["content-type"] == "application/pdf"
    assert len(booklet_res.content) > 1000
    print(" -> Downloaded Master Orchestral Booklet PDF:", len(booklet_res.content), "bytes")

    # 5. Test download individual parts endpoints
    for part_name in ["lead", "harmony", "bass", "drums"]:
        # PDF
        pdf_res = client.get(f"/api/export/{task_id}/part/{part_name}/pdf")
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"

        # MusicXML
        xml_res = client.get(f"/api/export/{task_id}/part/{part_name}/musicxml")
        assert xml_res.status_code == 200
        assert "xml" in xml_res.headers["content-type"] or len(xml_res.content) > 100

        # MIDI
        midi_res = client.get(f"/api/export/{task_id}/part/{part_name}/midi")
        assert midi_res.status_code == 200
        assert midi_res.headers["content-type"] == "audio/midi"

        print(f" -> Successfully tested {part_name.upper()} downloads: PDF ({len(pdf_res.content)}B), XML ({len(xml_res.content)}B), MIDI ({len(midi_res.content)}B)")

    print("\n[SUCCESS] All Part Extractor & Master Booklet tests passed flawlessly!")


if __name__ == "__main__":
    test_part_extractor_and_booklet()
    test_api_endpoints()
