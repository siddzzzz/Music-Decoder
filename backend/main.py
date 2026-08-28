"""
FastAPI Backend Application for Music-Decoder AI
"""
import os
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from engine.audio_processor import AudioProcessor
from engine.transcriber import Transcriber
from engine.quantizer import ScoreQuantizer
from engine.exporter import ScoreExporter
from engine.sample_generator import SampleGenerator

# Initialize directories
BASE_DIR = Path(__file__).resolve().parent
TEMP_DIR = BASE_DIR / "temp"
EXPORTS_DIR = BASE_DIR / "exports"
SAMPLES_DIR = BASE_DIR / "samples"

for d in [TEMP_DIR, EXPORTS_DIR, SAMPLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Generate sample files if not already generated
samples_data = SampleGenerator.generate_all_samples(str(SAMPLES_DIR))

# Initialize Transcriber
transcriber = Transcriber()

app = FastAPI(
    title="Music-Decoder AI API",
    description="AI Engine to transcribe instrumental audio recordings into readable Sheet Music & MusicXML",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Music-Decoder AI",
        "version": "1.0.0"
    }


@app.get("/api/samples")
def list_samples():
    """Returns the list of built-in instrumental demo tracks."""
    return {"samples": samples_data}


@app.get("/api/samples/{sample_id}/audio")
def get_sample_audio(sample_id: str):
    """Streams the audio file for a given sample track."""
    target_sample = next((s for s in samples_data if s["id"] == sample_id), None)
    if not target_sample or not os.path.exists(target_sample["path"]):
        raise HTTPException(status_code=404, detail="Sample audio track not found")
    return FileResponse(target_sample["path"], media_type="audio/wav", filename=target_sample["filename"])


@app.post("/api/transcribe")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    onset_threshold: float = Form(0.5),
    frame_threshold: float = Form(0.3),
    minimum_note_length: float = Form(58.0),
    quantization_grid: str = Form("1/16"),
    clef_mode: str = Form("grand_staff"),
    time_signature: str = Form("4/4"),
    bpm_override: Optional[float] = Form(None),
    key_tonic_override: Optional[str] = Form(None),
    key_mode_override: Optional[str] = Form(None),
    title: str = Form("Transcribed Instrumental"),
    composer: str = Form("Instrumental Performer")
):
    """
    Transcribes an uploaded audio file into quantized Sheet Music (MusicXML, MIDI, PDF).
    """
    task_id = str(uuid.uuid4())
    task_dir = TEMP_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file
    file_ext = Path(audio_file.filename or "audio.wav").suffix or ".wav"
    input_path = task_dir / f"input{file_ext}"

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    return _process_transcription(
        task_id=task_id,
        audio_path=str(input_path),
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=minimum_note_length,
        quantization_grid=quantization_grid,
        clef_mode=clef_mode,
        time_signature=time_signature,
        bpm_override=bpm_override,
        key_tonic_override=key_tonic_override,
        key_mode_override=key_mode_override,
        title=title,
        composer=composer,
        filename=audio_file.filename or "uploaded_audio.wav"
    )


@app.post("/api/transcribe-sample")
async def transcribe_sample(
    sample_id: str = Form(...),
    onset_threshold: float = Form(0.5),
    frame_threshold: float = Form(0.3),
    minimum_note_length: float = Form(58.0),
    quantization_grid: str = Form("1/16"),
    clef_mode: str = Form("grand_staff"),
    time_signature: str = Form("4/4"),
    bpm_override: Optional[float] = Form(None),
    key_tonic_override: Optional[str] = Form(None),
    key_mode_override: Optional[str] = Form(None)
):
    """
    Transcribes one of the built-in demo instrumental tracks.
    """
    target_sample = next((s for s in samples_data if s["id"] == sample_id), None)
    if not target_sample or not os.path.exists(target_sample["path"]):
        raise HTTPException(status_code=404, detail="Sample track not found")

    task_id = str(uuid.uuid4())
    task_dir = TEMP_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)

    # Copy sample to task directory
    input_path = task_dir / target_sample["filename"]
    shutil.copyfile(target_sample["path"], input_path)

    return _process_transcription(
        task_id=task_id,
        audio_path=str(input_path),
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=minimum_note_length,
        quantization_grid=quantization_grid,
        clef_mode=clef_mode,
        time_signature=time_signature,
        bpm_override=bpm_override or target_sample.get("bpm"),
        key_tonic_override=key_tonic_override,
        key_mode_override=key_mode_override,
        title=target_sample["name"],
        composer="Music-Decoder Preset",
        filename=target_sample["filename"]
    )


def _process_transcription(
    task_id: str,
    audio_path: str,
    onset_threshold: float,
    frame_threshold: float,
    minimum_note_length: float,
    quantization_grid: str,
    clef_mode: str,
    time_signature: str,
    bpm_override: Optional[float],
    key_tonic_override: Optional[str],
    key_mode_override: Optional[str],
    title: str,
    composer: str,
    filename: str
) -> Dict[str, Any]:
    """Core transcription worker executing audio analysis, neural transcription, and notation quantization."""
    task_dir = TEMP_DIR / task_id

    # 1. Audio Processing & Feature Extraction
    audio_features = AudioProcessor.analyze_audio(audio_path)
    detected_bpm = audio_features["tempo"]
    effective_bpm = float(bpm_override) if bpm_override and bpm_override > 0 else detected_bpm

    detected_key = audio_features["key"]
    effective_tonic = key_tonic_override if key_tonic_override else detected_key["tonic"]
    effective_mode = key_mode_override if key_mode_override else detected_key["mode"]

    # 2. Deep Learning Polyphonic Note Transcription
    midi_data, note_events = transcriber.transcribe(
        audio_path=audio_path,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=minimum_note_length,
        midi_tempo=effective_bpm
    )

    # 3. Musical Quantization & MusicXML Construction
    score = ScoreQuantizer.build_score(
        note_events=note_events,
        bpm=effective_bpm,
        time_signature_str=time_signature,
        key_tonic=effective_tonic,
        key_mode=effective_mode,
        clef_mode=clef_mode,
        quantization_grid=quantization_grid,
        title=title,
        composer=composer
    )

    # 4. Generate Exports (MusicXML, MIDI, PDF)
    musicxml_path = str(task_dir / "score.musicxml")
    midi_path = str(task_dir / "transcription.mid")
    pdf_path = str(task_dir / "sheet_music.pdf")

    ScoreExporter.save_musicxml(score, musicxml_path)
    ScoreExporter.save_midi(midi_data, midi_path)
    ScoreExporter.generate_pdf_report(
        output_path=pdf_path,
        title=title,
        composer=composer,
        bpm=effective_bpm,
        key_signature=f"{effective_tonic} {effective_mode.capitalize()}",
        time_signature=time_signature,
        note_events=note_events,
        clef_mode=clef_mode
    )

    musicxml_content = ScoreQuantizer.to_musicxml_string(score)

    return {
        "task_id": task_id,
        "filename": filename,
        "duration": audio_features["duration"],
        "tempo": round(effective_bpm, 1),
        "detected_tempo": audio_features["tempo"],
        "key": {
            "tonic": effective_tonic,
            "mode": effective_mode,
            "confidence": detected_key["confidence"],
            "display": f"{effective_tonic} {effective_mode.capitalize()}"
        },
        "time_signature": time_signature,
        "clef_mode": clef_mode,
        "quantization_grid": quantization_grid,
        "notes_count": len(note_events),
        "notes": note_events,
        "waveform": audio_features["waveform"],
        "beat_times": audio_features["beat_times"],
        "musicxml": musicxml_content,
        "exports": {
            "midi": f"/api/export/{task_id}/midi",
            "musicxml": f"/api/export/{task_id}/musicxml",
            "pdf": f"/api/export/{task_id}/pdf",
            "audio": f"/api/export/{task_id}/audio"
        }
    }


@app.get("/api/export/{task_id}/{export_type}")
def download_export(task_id: str, export_type: str):
    """Download the generated export files (midi, musicxml, pdf, or original audio)."""
    task_dir = TEMP_DIR / task_id
    if not task_dir.exists():
        raise HTTPException(status_code=404, detail="Transcription task expired or not found")

    file_mapping = {
        "midi": (task_dir / "transcription.mid", "audio/midi", "transcription.mid"),
        "musicxml": (task_dir / "score.musicxml", "application/vnd.recordare.musicxml+xml", "score.musicxml"),
        "pdf": (task_dir / "sheet_music.pdf", "application/pdf", "sheet_music.pdf")
    }

    if export_type == "audio":
        # Find audio file in task dir
        audio_files = [f for f in task_dir.glob("input*") if f.is_file()] + [f for f in task_dir.glob("sample*") if f.is_file()]
        if audio_files:
            return FileResponse(str(audio_files[0]), media_type="audio/wav", filename=audio_files[0].name)
        raise HTTPException(status_code=404, detail="Audio file not found")

    if export_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Invalid export type")

    file_path, media_type, download_name = file_mapping[export_type]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"{export_type.upper()} export not found")

    return FileResponse(str(file_path), media_type=media_type, filename=download_name)
