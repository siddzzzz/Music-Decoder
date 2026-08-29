"""
Multi-Track Orchestral & Song Transcription Coordinator
Executes neural stem separation, runs dedicated transcribers per stem,
and assembles multi-track note events.
"""
import os
from typing import Dict, Any, List, Optional
import pretty_midi
import numpy as np
import librosa

from engine.audio_processor import AudioProcessor
from engine.stem_separator import StemSeparator
from engine.transcriber import Transcriber


class MultiTrackEngine:
    """Coordinates multi-stem audio separation and per-instrument transcription."""

    def __init__(self):
        self.separator = StemSeparator(model_name="htdemucs")
        self.transcriber = Transcriber()

    def process_multitrack(
        self,
        audio_path: str,
        output_dir: str,
        bpm_override: Optional[float] = None,
        key_tonic_override: Optional[str] = None,
        key_mode_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end multi-track pipeline:
        1. Master audio analysis (BPM, Key, Waveform, Beats).
        2. Neural stem separation via Demucs (CUDA).
        3. Multi-track pitch and onset transcription per stem.
        """
        os.makedirs(output_dir, exist_ok=True)
        stems_dir = os.path.join(output_dir, "stems")
        os.makedirs(stems_dir, exist_ok=True)

        # 1. Master Audio Analysis
        master_analysis = AudioProcessor.analyze_audio(audio_path)
        tempo = bpm_override if (bpm_override and bpm_override > 0) else master_analysis["tempo"]
        tonic = key_tonic_override if key_tonic_override else master_analysis["key"]["tonic"]
        mode = key_mode_override if key_mode_override else master_analysis["key"]["mode"]

        # 2. Neural Stem Separation
        sep_result = self.separator.separate(audio_path, stems_dir)
        stems = sep_result["stems"]

        tracks: Dict[str, Any] = {}
        all_notes: List[Dict[str, Any]] = []

        # 3. Dedicated Transcription per Stem
        
        # Track 1: Lead Melody / Vocals / Woodwinds
        if "vocals" in stems and os.path.exists(stems["vocals"]):
            v_audio, _ = librosa.load(stems["vocals"], sr=22050, mono=True)
            v_wave = [round(float(v), 4) for v in np.abs(v_audio[::max(1, len(v_audio) // 400)])[:400]]
            _, lead_notes = self.transcriber.transcribe(
                audio_path=stems["vocals"],
                onset_threshold=0.45,
                frame_threshold=0.25,
                minimum_note_length=50.0,
                melodia_trick=True,
                midi_tempo=tempo
            )
            for n in lead_notes:
                n["track"] = "lead"
                n["instrument"] = "Lead / Melody"
            tracks["lead"] = {
                "name": "Lead / Winds / Solo",
                "instrument": "Flute / Solo",
                "notes_count": len(lead_notes),
                "notes": lead_notes,
                "waveform": v_wave,
                "audio_path": stems["vocals"]
            }
            all_notes.extend(lead_notes)

        # Track 2: Harmony / Piano / Guitar / Strings ("other")
        if "other" in stems and os.path.exists(stems["other"]):
            o_audio, _ = librosa.load(stems["other"], sr=22050, mono=True)
            o_wave = [round(float(v), 4) for v in np.abs(o_audio[::max(1, len(o_audio) // 400)])[:400]]
            _, harmony_notes = self.transcriber.transcribe(
                audio_path=stems["other"],
                onset_threshold=0.48,
                frame_threshold=0.28,
                minimum_note_length=55.0,
                melodia_trick=False,
                midi_tempo=tempo
            )
            for n in harmony_notes:
                n["track"] = "harmony"
                n["instrument"] = "Harmony / Keys"
            tracks["harmony"] = {
                "name": "Harmony / Keys / Strings",
                "instrument": "Piano / Strings",
                "notes_count": len(harmony_notes),
                "notes": harmony_notes,
                "waveform": o_wave,
                "audio_path": stems["other"]
            }
            all_notes.extend(harmony_notes)

        # Track 3: Bassline / Cello / Low Brass ("bass")
        if "bass" in stems and os.path.exists(stems["bass"]):
            b_audio, _ = librosa.load(stems["bass"], sr=22050, mono=True)
            b_wave = [round(float(v), 4) for v in np.abs(b_audio[::max(1, len(b_audio) // 400)])[:400]]
            _, bass_notes = self.transcriber.transcribe(
                audio_path=stems["bass"],
                onset_threshold=0.38,
                frame_threshold=0.20,
                minimum_note_length=60.0,
                minimum_frequency=30.0,
                maximum_frequency=350.0,
                midi_tempo=tempo
            )
            for n in bass_notes:
                n["track"] = "bass"
                n["instrument"] = "Bass / Cello"
            tracks["bass"] = {
                "name": "Bassline / Cello",
                "instrument": "Acoustic Bass / Cello",
                "notes_count": len(bass_notes),
                "notes": bass_notes,
                "waveform": b_wave,
                "audio_path": stems["bass"]
            }
            all_notes.extend(bass_notes)

        # Track 4: Rhythm / Drums ("drums")
        if "drums" in stems and os.path.exists(stems["drums"]):
            d_audio, _ = librosa.load(stems["drums"], sr=22050, mono=True)
            d_wave = [round(float(v), 4) for v in np.abs(d_audio[::max(1, len(d_audio) // 400)])[:400]]
            # Extract percussive onsets
            onset_frames = librosa.onset.onset_detect(y=d_audio, sr=22050, units='time')
            drum_notes = []
            for t_val in onset_frames:
                # Map drum onsets to standard GM MIDI Kick (36) or Snare (38)
                drum_notes.append({
                    "pitch": 36,
                    "name": "C2 (Percussion)",
                    "start": round(float(t_val), 3),
                    "end": round(float(t_val + 0.15), 3),
                    "duration": 0.15,
                    "velocity": 95,
                    "amplitude": 0.8,
                    "track": "drums",
                    "instrument": "Percussion"
                })
            tracks["drums"] = {
                "name": "Drums / Percussion",
                "instrument": "Drum Kit",
                "notes_count": len(drum_notes),
                "notes": drum_notes,
                "waveform": d_wave,
                "audio_path": stems["drums"]
            }
            all_notes.extend(drum_notes)

        all_notes.sort(key=lambda x: x["start"])

        return {
            "duration": master_analysis["duration"],
            "tempo": tempo,
            "key": {
                "tonic": tonic,
                "mode": mode,
                "display": f"{tonic} {mode.capitalize()}",
                "confidence": master_analysis["key"]["confidence"]
            },
            "waveform": master_analysis["waveform"],
            "beat_times": master_analysis["beat_times"],
            "tracks": tracks,
            "all_notes": all_notes,
            "total_notes": len(all_notes),
            "device": sep_result["device"]
        }
