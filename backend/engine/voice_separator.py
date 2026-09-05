"""
Polyphonic Voice Separation Engine.
Decomposes complex polyphonic textures into independent contrapuntal voices
with standard dual stem directions: Voice 1 (Stems Up) and Voice 2 (Stems Down).
"""
from typing import List, Dict, Any, Tuple


class VoiceSeparator:
    """Separates overlapping contrapuntal lines into distinct musical voices."""

    @staticmethod
    def _get_start_and_end(n: Dict[str, Any]) -> Tuple[float, float]:
        if "m_offset" in n:
            start = float(n["m_offset"])
            dur = float(n.get("dur_frac", 0.5))
        else:
            start = float(n.get("start", 0))
            dur = float(n.get("duration", 0.5))
        end = start + dur
        return start, end

    @classmethod
    def has_polyphonic_overlap(cls, notes: List[Dict[str, Any]]) -> bool:
        """
        Checks if there are overlapping note spans with different start/end times
        (i.e. true contrapuntal polyphony, not just homophonic block chords).
        """
        if len(notes) <= 1:
            return False

        sorted_n = sorted(notes, key=lambda x: (cls._get_start_and_end(x)[0], float(x.get("pitch", 0))))
        for i in range(len(sorted_n)):
            for j in range(i + 1, len(sorted_n)):
                n1, n2 = sorted_n[i], sorted_n[j]
                n1_start, n1_end = cls._get_start_and_end(n1)
                n2_start, n2_end = cls._get_start_and_end(n2)

                # If overlapping in time
                if n2_start < n1_end - 0.04:
                    # If start times or end times differ by more than 0.08 -> contrapuntal overlap
                    if abs(n1_start - n2_start) > 0.08 or abs(n1_end - n2_end) > 0.08:
                        return True
        return False

    @classmethod
    def separate_measure_voices(
        cls,
        measure_notes: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Splits notes in a measure into Voice 1 (Upper line / Stems Up)
        and Voice 2 (Lower line / Stems Down).
        If monophonic or pure block chords, returns (measure_notes, []).
        """
        if not cls.has_polyphonic_overlap(measure_notes):
            # Monophonic or block chords -> Voice 1
            v1 = []
            for n in measure_notes:
                n_copy = dict(n)
                n_copy["voice"] = 1
                n_copy["stem_dir"] = "up"
                v1.append(n_copy)
            return v1, []

        # Polyphonic overlap detected: Partition by pitch register & continuity
        sorted_by_time = sorted(measure_notes, key=lambda x: cls._get_start_and_end(x)[0])

        voice1: List[Dict[str, Any]] = []
        voice2: List[Dict[str, Any]] = []

        # Group notes by time collision
        for n in sorted_by_time:
            n_start, n_end = cls._get_start_and_end(n)
            p = int(n["pitch"])

            # Check overlaps with current voice 1 notes
            v1_overlaps = []
            for v in voice1:
                v_start, v_end = cls._get_start_and_end(v)
                if v_start < n_end - 0.04 and v_end > n_start + 0.04:
                    v1_overlaps.append(v)

            if not v1_overlaps:
                # No collision in voice 1 -> Assign to Voice 1
                n_copy = dict(n)
                n_copy["voice"] = 1
                n_copy["stem_dir"] = "up"
                voice1.append(n_copy)
            else:
                # Collision: higher pitch stays/goes in Voice 1, lower in Voice 2
                existing = v1_overlaps[0]
                if p > int(existing["pitch"]):
                    # Swap: promote new note to Voice 1, demote existing to Voice 2
                    voice1.remove(existing)
                    existing["voice"] = 2
                    existing["stem_dir"] = "down"
                    voice2.append(existing)

                    n_copy = dict(n)
                    n_copy["voice"] = 1
                    n_copy["stem_dir"] = "up"
                    voice1.append(n_copy)
                else:
                    n_copy = dict(n)
                    n_copy["voice"] = 2
                    n_copy["stem_dir"] = "down"
                    voice2.append(n_copy)

        voice1.sort(key=lambda x: cls._get_start_and_end(x)[0])
        voice2.sort(key=lambda x: cls._get_start_and_end(x)[0])
        return voice1, voice2

    @classmethod
    def tag_voices_for_score(cls, note_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Tags all note events with voice (1 or 2) and stem_dir ('up' or 'down')
        for the entire score.
        """
        if not note_events:
            return []

        tagged_notes = []
        for n in note_events:
            n_copy = dict(n)
            if "voice" not in n_copy:
                n_copy["voice"] = 1
                n_copy["stem_dir"] = "up" if int(n.get("pitch", 60)) >= 60 else "down"
            tagged_notes.append(n_copy)
        return tagged_notes
