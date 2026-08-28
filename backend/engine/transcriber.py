"""
Neural Polyphonic Audio Transcription using Spotify Basic-Pitch
"""
import os
import pathlib
import pretty_midi
from typing import List, Dict, Any, Tuple, Optional
from basic_pitch.inference import predict, ICASSP_2022_MODEL_PATH


class Transcriber:
    """
    Wrapper around Spotify's Basic Pitch deep neural network for
    instrumental polyphonic pitch and note event transcription.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or ICASSP_2022_MODEL_PATH

    def transcribe(
        self,
        audio_path: str,
        onset_threshold: float = 0.5,
        frame_threshold: float = 0.3,
        minimum_note_length: float = 58.0,
        minimum_frequency: Optional[float] = None,
        maximum_frequency: Optional[float] = None,
        multiple_pitch_bends: bool = False,
        melodia_trick: bool = True,
        midi_tempo: float = 120.0,
    ) -> Tuple[pretty_midi.PrettyMIDI, List[Dict[str, Any]]]:
        """
        Transcribes audio file to note events and a PrettyMIDI object.

        Returns:
            Tuple of (pretty_midi_obj, parsed_note_events)
            where each note_event is:
            {
                "pitch": int (MIDI number 0-127),
                "name": str (e.g. 'C4', 'F#5'),
                "start": float (seconds),
                "end": float (seconds),
                "duration": float (seconds),
                "velocity": int (0-127),
                "amplitude": float (0.0-1.0)
            }
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Run inference
        _, midi_data, note_events_raw = predict(
            audio_path=pathlib.Path(audio_path),
            model_or_model_path=self.model_path,
            onset_threshold=float(onset_threshold),
            frame_threshold=float(frame_threshold),
            minimum_note_length=float(minimum_note_length),
            minimum_frequency=minimum_frequency,
            maximum_frequency=maximum_frequency,
            multiple_pitch_bends=multiple_pitch_bends,
            melodia_trick=melodia_trick,
            midi_tempo=float(midi_tempo),
        )

        parsed_events: List[Dict[str, Any]] = []
        for raw_note in note_events_raw:
            start_time, end_time, pitch_midi, amplitude = raw_note[0], raw_note[1], raw_note[2], raw_note[3]
            duration = end_time - start_time
            if duration <= 0:
                continue

            velocity = int(min(127, max(1, amplitude * 127)))
            note_name = pretty_midi.note_number_to_name(int(pitch_midi))

            parsed_events.append({
                "pitch": int(pitch_midi),
                "name": note_name,
                "start": round(float(start_time), 3),
                "end": round(float(end_time), 3),
                "duration": round(float(duration), 3),
                "velocity": velocity,
                "amplitude": round(float(amplitude), 3)
            })

        # Sort by start time, then pitch
        parsed_events.sort(key=lambda x: (x["start"], x["pitch"]))
        return midi_data, parsed_events
