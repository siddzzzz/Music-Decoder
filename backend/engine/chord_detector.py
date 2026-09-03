"""
Harmonic Chord Recognition and Lead Sheet Chord Symbol Detector
Infers root, quality, and bass inversions per measure.
"""
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from fractions import Fraction
import music21
from music21 import harmony, chord, pitch


class ChordDetector:
    """Detects harmonic chords from polyphonic note events."""

    PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # 12-dimensional chroma templates for standard chord qualities
    CHORD_TEMPLATES = {
        "": np.array([1.0, 0, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0, 0]),           # Major (Root, 3rd, 5th)
        "m": np.array([1.0, 0, 0, 0.8, 0, 0, 0, 0.9, 0, 0, 0, 0]),          # Minor (Root, b3, 5th)
        "7": np.array([1.0, 0, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0.7, 0]),         # Dominant 7th (Root, 3, 5, b7)
        "maj7": np.array([1.0, 0, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0, 0.7]),      # Major 7th (Root, 3, 5, 7)
        "m7": np.array([1.0, 0, 0, 0.8, 0, 0, 0, 0.9, 0, 0, 0.7, 0]),        # Minor 7th (Root, b3, 5, b7)
        "dim": np.array([1.0, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0, 0, 0]),        # Diminished (Root, b3, b5)
        "m7b5": np.array([1.0, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0, 0.7, 0]),      # Half-diminished (Root, b3, b5, b7)
        "aug": np.array([1.0, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0]),         # Augmented (Root, 3, #5)
        "sus4": np.array([1.0, 0, 0, 0, 0, 0.8, 0, 0.9, 0, 0, 0, 0]),        # Sus4 (Root, 4, 5)
        "sus2": np.array([1.0, 0, 0.8, 0, 0, 0, 0, 0.9, 0, 0, 0, 0]),        # Sus2 (Root, 2, 5)
    }

    @classmethod
    def detect_chord_from_notes(cls, notes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Detects chord symbol from a cluster of notes.
        Returns: {"figure": "Cmaj7", "root": "C", "quality": "maj7", "bass": "C", "confidence": 0.85}
        """
        if not notes or len(notes) == 0:
            return None

        # Build 12-dimensional pitch class chroma vector
        chroma = np.zeros(12, dtype=np.float32)
        lowest_pitch = 128
        lowest_pitch_class = 0

        for n in notes:
            p_val = int(n["pitch"])
            pc = p_val % 12
            dur = float(n.get("duration", 0.5))
            vel = float(n.get("velocity", 80)) / 127.0
            weight = dur * vel
            chroma[pc] += weight

            if p_val < lowest_pitch:
                lowest_pitch = p_val
                lowest_pitch_class = pc

        total_weight = np.sum(chroma)
        if total_weight < 1e-4:
            return None

        chroma_norm = chroma / np.linalg.norm(chroma)

        best_score = -1.0
        best_root_idx = 0
        best_quality = ""

        # Test all 12 root shifts across all chord quality templates
        for root_idx in range(12):
            for quality, template in cls.CHORD_TEMPLATES.items():
                # Roll template to root_idx
                rolled_tpl = np.roll(template, root_idx)
                tpl_norm = rolled_tpl / np.linalg.norm(rolled_tpl)
                score = float(np.dot(chroma_norm, tpl_norm))

                # Slight bonus for matching lowest pitch class as root
                if root_idx == lowest_pitch_class:
                    score *= 1.08

                if score > best_score:
                    best_score = score
                    best_root_idx = root_idx
                    best_quality = quality

        if best_score < 0.40:
            return None

        root_name = cls.PITCH_NAMES[best_root_idx]
        bass_name = cls.PITCH_NAMES[lowest_pitch_class]

        # Chord figure
        if best_quality == "":
            figure = root_name
        else:
            figure = f"{root_name}{best_quality}"

        # If bass is distinct and musically significant (slash chord)
        if lowest_pitch_class != best_root_idx and chroma[lowest_pitch_class] > 0.15 * total_weight:
            figure = f"{figure}/{bass_name}"

        return {
            "figure": figure,
            "root": root_name,
            "quality": best_quality,
            "bass": bass_name,
            "confidence": round(min(1.0, float(best_score)), 2)
        }

    @classmethod
    def analyze_chords_by_measure(
        cls,
        note_events: List[Dict[str, Any]],
        bpm: float = 120.0,
        time_signature_str: str = "4/4"
    ) -> List[Dict[str, Any]]:
        """
        Segments all note events by measure and returns a timeline of detected chords.
        """
        beat_seconds = 60.0 / max(30.0, bpm)
        try:
            ts = music21.meter.TimeSignature(time_signature_str)
            measure_duration_s = float(ts.barDuration.quarterLength) * beat_seconds
        except Exception:
            measure_duration_s = 4.0 * beat_seconds

        if not note_events:
            return []

        def get_n_end(n):
            return float(n.get("end") if n.get("end") is not None else (float(n.get("start", 0)) + float(n.get("duration", 0.5))))

        max_time = max(get_n_end(n) for n in note_events)
        total_measures = int(np.ceil(max_time / measure_duration_s))

        progression = []

        for m_idx in range(total_measures):
            m_start = m_idx * measure_duration_s
            m_end = (m_idx + 1) * measure_duration_s

            # Notes overlapping with this measure
            m_notes = [
                n for n in note_events
                if float(n.get("start", 0)) < m_end and get_n_end(n) > m_start
            ]

            chord_info = cls.detect_chord_from_notes(m_notes)
            if chord_info:
                chord_info["measure"] = m_idx + 1
                chord_info["start_time"] = round(m_start, 2)
                chord_info["end_time"] = round(m_end, 2)
                progression.append(chord_info)

        return progression
