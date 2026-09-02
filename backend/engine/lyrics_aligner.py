"""
AI Vocal Lyrics Alignment Engine using faster-whisper and Melodic Temporal Matching.
Extracts word-level timestamps from singing audio and aligns syllables with musical notes.
"""
import os
import torch
from typing import List, Dict, Any, Optional


class LyricsAligner:
    """Extracts timestamped lyrics from vocal stems and aligns with musical notes."""

    _model = None
    _model_name = "tiny"
    _device = None

    @classmethod
    def get_whisper_model(cls, model_size: str = "tiny"):
        """Lazy-loads the faster-whisper model on GPU (CUDA) or CPU."""
        if cls._model is not None and cls._model_name == model_size:
            return cls._model

        try:
            from faster_whisper import WhisperModel
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            print(f"[LyricsAligner] Loading Whisper ({model_size}) on {device.upper()} ({compute_type})...")
            cls._model = WhisperModel(model_size, device=device, compute_type=compute_type)
            cls._model_name = model_size
            cls._device = device
            return cls._model
        except Exception as e:
            print(f"[LyricsAligner] Warning: Failed to load faster-whisper: {e}")
            return None

    @classmethod
    def transcribe_vocals(cls, audio_path: str, model_size: str = "tiny") -> List[Dict[str, Any]]:
        """
        Runs neural speech recognition on vocal audio to extract word-level timestamps.
        Returns: list of dicts with keys: 'word', 'start', 'end', 'confidence'
        """
        if not os.path.exists(audio_path):
            return []

        model = cls.get_whisper_model(model_size)
        if model is None:
            return []

        try:
            segments, info = model.transcribe(
                audio_path,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400)
            )

            word_events = []
            for segment in segments:
                if segment.words:
                    for w in segment.words:
                        clean_word = w.word.strip()
                        if clean_word:
                            word_events.append({
                                "word": clean_word,
                                "start": round(float(w.start), 3),
                                "end": round(float(w.end), 3),
                                "confidence": round(float(w.probability), 3)
                            })
            return word_events
        except Exception as e:
            print(f"[LyricsAligner] Transcription error: {e}")
            return []

    @classmethod
    def align_words_to_notes(
        cls,
        note_events: List[Dict[str, Any]],
        word_events: List[Dict[str, Any]],
        max_time_distance: float = 0.45
    ) -> List[Dict[str, Any]]:
        """
        Aligns word events with musical note events by finding the temporally
        closest note for each sung word. Attaches 'lyric' to matching note events.
        """
        if not note_events:
            return []

        annotated_notes = [dict(n) for n in note_events]
        if not word_events:
            return annotated_notes

        # Sort notes by start time
        annotated_notes.sort(key=lambda x: float(x.get("start", 0)))
        used_note_indices = set()

        for w in word_events:
            w_start = float(w["start"])
            w_end = float(w["end"])
            w_mid = (w_start + w_end) / 2.0

            best_note_idx = None
            min_dist = float('inf')

            for idx, n in enumerate(annotated_notes):
                if idx in used_note_indices:
                    continue

                n_start = float(n.get("start", 0))
                n_end = float(n.get("end", n_start + float(n.get("duration", 0.5))))

                # Check if word overlaps with note duration or is nearby
                dist = abs(n_start - w_start)
                if n_start <= w_mid <= n_end:
                    dist = 0.0  # Exact temporal overlap

                if dist < min_dist and dist <= max_time_distance:
                    min_dist = dist
                    best_note_idx = idx

            if best_note_idx is not None:
                annotated_notes[best_note_idx]["lyric"] = w["word"]
                used_note_indices.add(best_note_idx)
                w["note_pitch"] = int(annotated_notes[best_note_idx]["pitch"])

        return annotated_notes
