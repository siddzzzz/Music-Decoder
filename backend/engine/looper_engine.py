"""
Practice Looper & Speed Trainer Engine
Provides measure boundary calculation, musical excerpt slicing,
and speed ramp progression calculations for deliberate music practice.
"""
import copy
from typing import Dict, Any, List, Optional, Tuple
from engine.chord_detector import ChordDetector


class LooperEngine:
    """Manages musical passage looping, measure slicing, and speed trainer progression."""

    @classmethod
    def get_seconds_per_measure(cls, bpm: float, time_signature: str = "4/4") -> float:
        """Calculates measure duration in seconds."""
        try:
            num_beats = int(time_signature.split('/')[0])
        except Exception:
            num_beats = 4
        clamped_bpm = max(30.0, min(300.0, bpm or 120.0))
        return (60.0 / clamped_bpm) * num_beats

    @classmethod
    def calculate_measure_bounds(
        cls,
        notes: List[Dict[str, Any]],
        bpm: float = 120.0,
        time_signature: str = "4/4"
    ) -> List[Dict[str, Any]]:
        """
        Computes the start and end timestamp for each measure in the score.
        Returns a list of measure descriptors:
        [{"measure": 1, "start": 0.0, "end": 2.0, "notes_count": 4}, ...]
        """
        seconds_per_measure = cls.get_seconds_per_measure(bpm, time_signature)

        if not notes:
            return [{"measure": 1, "start": 0.0, "end": seconds_per_measure, "notes_count": 0}]

        # Find total score duration from note endpoints
        max_time = max(float(n.get("end", n.get("start", 0) + 0.5)) for n in notes)
        total_measures = max(1, int(max_time / seconds_per_measure) + (1 if max_time % seconds_per_measure > 0.05 else 0))

        measure_map: List[Dict[str, Any]] = []
        for m in range(1, total_measures + 1):
            m_start = (m - 1) * seconds_per_measure
            m_end = m * seconds_per_measure
            # Count notes active within this measure window
            notes_in_m = [
                n for n in notes
                if float(n.get("start", 0)) < m_end and float(n.get("end", float(n.get("start", 0)) + 0.5)) > m_start
            ]
            measure_map.append({
                "measure": m,
                "start": round(m_start, 3),
                "end": round(m_end, 3),
                "duration": round(seconds_per_measure, 3),
                "notes_count": len(notes_in_m)
            })

        return measure_map

    @classmethod
    def slice_excerpt(
        cls,
        notes: List[Dict[str, Any]],
        start_measure: int,
        end_measure: int,
        bpm: float = 120.0,
        time_signature: str = "4/4",
        rebase_to_zero: bool = False
    ) -> Dict[str, Any]:
        """
        Extracts notes and measures falling inside [start_measure, end_measure].
        If rebase_to_zero is True, shifts the timestamps so the loop starts at 0.0s.
        """
        seconds_per_measure = cls.get_seconds_per_measure(bpm, time_signature)
        start_m = max(1, min(start_measure, end_measure))
        end_m = max(start_m, end_measure)

        range_start_sec = (start_m - 1) * seconds_per_measure
        range_end_sec = end_m * seconds_per_measure

        sliced_notes: List[Dict[str, Any]] = []
        offset = range_start_sec if rebase_to_zero else 0.0

        for n in notes:
            n_start = float(n.get("start", 0))
            n_end = float(n.get("end", n_start + float(n.get("duration", 0.5))))

            # Include if the note overlaps or begins inside the measure range
            if n_start < range_end_sec and n_end > range_start_sec:
                note_copy = copy.deepcopy(n)
                # Crop note bounds to selection if desired
                clipped_start = max(range_start_sec, n_start)
                clipped_end = min(range_end_sec, n_end)
                dur = max(0.05, clipped_end - clipped_start)

                note_copy["start"] = round(clipped_start - offset, 3)
                note_copy["end"] = round(clipped_end - offset, 3)
                note_copy["duration"] = round(dur, 3)
                sliced_notes.append(note_copy)

        sliced_notes.sort(key=lambda x: x["start"])

        # Detect chords for the sliced passage
        chords = ChordDetector.analyze_chords_by_measure(sliced_notes, bpm, time_signature)

        return {
            "start_measure": start_m,
            "end_measure": end_m,
            "start_time": round(range_start_sec, 3),
            "end_time": round(range_end_sec, 3),
            "duration": round(range_end_sec - range_start_sec, 3),
            "notes_count": len(sliced_notes),
            "notes": sliced_notes,
            "chords": chords
        }

    @classmethod
    def generate_speed_ramp_schedule(
        cls,
        base_bpm: float,
        start_percent: float = 60.0,
        target_percent: float = 100.0,
        step_percent: float = 10.0,
        reps_per_step: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Generates a step-by-step Speed Trainer ramp schedule.
        Example: 60% -> 70% -> 80% -> 90% -> 100% with N repetitions at each tempo.
        """
        start_p = max(30.0, min(150.0, start_percent))
        target_p = max(start_p, min(200.0, target_percent))
        step_p = max(1.0, min(50.0, step_percent))
        reps = max(1, min(10, reps_per_step))

        schedule: List[Dict[str, Any]] = []
        curr_p = start_p
        step_index = 1

        while curr_p <= target_p + 0.001:
            step_bpm = round(base_bpm * (curr_p / 100.0), 1)
            schedule.append({
                "step": step_index,
                "percent": round(curr_p, 1),
                "bpm": step_bpm,
                "repetitions": reps
            })
            if curr_p >= target_p:
                break
            curr_p = min(target_p, curr_p + step_p)
            step_index += 1

        return schedule
