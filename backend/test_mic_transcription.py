"""
Automated Test Suite for Live Microphone Pitch-to-Score & Whistle-to-MIDI Transcription Engine
"""
import os
import io
import wave
import struct
import math
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient

from main import app


def generate_synthetic_whistle_audio(filename: str, duration: float = 3.0, sample_rate: int = 22050):
    """Generates a clean synthetic whistling melody (C4 -> E4 -> G4 -> C5)."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    audio = np.zeros_like(t)
    
    # 4 distinct notes
    melody_notes = [
        (261.63, 0.0, 0.75),   # C4
        (329.63, 0.75, 1.5),   # E4
        (392.00, 1.5, 2.25),   # G4
        (523.25, 2.25, 3.0),   # C5
    ]
    
    for freq, start_t, end_t in melody_notes:
        mask = (t >= start_t) & (t < end_t)
        seg_t = t[mask] - start_t
        # Whistling is almost pure sine with smooth attack and decay envelope
        env = np.sin(np.pi * (seg_t / (end_t - start_t)))
        audio[mask] = 0.8 * np.sin(2 * np.pi * freq * t[mask]) * env

    # Write 16-bit PCM WAV
    audio_int16 = (audio * 32767).astype(np.int16)
    with wave.open(filename, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_int16.tobytes())
    return filename


def test_live_mic_transcription():
    print("\n--- [TEST 1] Testing Live Mic Whistle & Singing Presets ---")
    client = TestClient(app)
    
    temp_wav = "test_whistle_take.wav"
    try:
        generate_synthetic_whistle_audio(temp_wav, duration=3.0)
        assert os.path.exists(temp_wav)
        
        # 1. Test Whistling Preset
        with open(temp_wav, "rb") as f:
            res_whistle = client.post(
                "/api/transcribe",
                files={"audio_file": ("whistle_recording.wav", f, "audio/wav")},
                data={
                    "preset": "whistle",
                    "quantization_grid": "1/8",
                    "time_signature": "4/4",
                    "title": "Live Whistle Take"
                }
            )
        assert res_whistle.status_code == 200, f"Whistle transcription failed: {res_whistle.text}"
        data_whistle = res_whistle.json()
        assert data_whistle["notes_count"] > 0, "No notes detected in whistle audio"
        assert "musicxml" in data_whistle, "MusicXML missing in response"
        assert "pdf" in data_whistle["exports"], "PDF export missing"
        print(f" -> Whistle Preset: Transcribed {data_whistle['notes_count']} notes successfully (Tempo: {data_whistle['tempo']} BPM)")

        # 2. Test Singing Preset
        with open(temp_wav, "rb") as f:
            res_singing = client.post(
                "/api/transcribe",
                files={"audio_file": ("vocal_recording.wav", f, "audio/wav")},
                data={
                    "preset": "singing",
                    "quantization_grid": "1/16",
                    "time_signature": "4/4",
                    "title": "Live Vocal Take"
                }
            )
        assert res_singing.status_code == 200
        data_singing = res_singing.json()
        assert data_singing["notes_count"] > 0
        print(f" -> Singing Preset: Transcribed {data_singing['notes_count']} notes successfully (Key: {data_singing['key']['display']})")

        # 3. Test Guitar Pluck Preset
        with open(temp_wav, "rb") as f:
            res_guitar = client.post(
                "/api/transcribe",
                files={"audio_file": ("guitar_pluck.wav", f, "audio/wav")},
                data={
                    "preset": "guitar",
                    "quantization_grid": "1/16",
                    "time_signature": "4/4"
                }
            )
        assert res_guitar.status_code == 200
        data_guitar = res_guitar.json()
        assert "tab_notes" in data_guitar, "Tab notes missing for guitar preset"
        print(f" -> Guitar Preset: Transcribed {data_guitar['notes_count']} notes & optimized tablature")

        # 4. Verify Export Download
        task_id = data_whistle["task_id"]
        pdf_res = client.get(f"/api/export/{task_id}/pdf")
        assert pdf_res.status_code == 200
        assert len(pdf_res.content) > 1000
        print(" -> Verified PDF Download for Mic Take:", len(pdf_res.content), "bytes")

        print("\n[SUCCESS] Live Microphone & Whistle-to-MIDI Transcription Engine verified successfully!")

    finally:
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass


if __name__ == "__main__":
    test_live_mic_transcription()
