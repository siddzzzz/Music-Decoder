"""
6-String Guitar & Bass Tablature (TAB) Engine
Computes physically playable, ergonomic string & fret assignments
using Dynamic Programming (Viterbi hand-position optimizer).
"""
import numpy as np
from typing import List, Dict, Any, Tuple, Optional


class GuitarTabEngine:
    """Calculates optimal guitar & bass tablature fretboard positions."""

    # Standard 6-string guitar tuning (String 1 = high E, String 6 = low E)
    GUITAR_TUNING = {
        1: 64,  # E4
        2: 59,  # B3
        3: 55,  # G3
        4: 50,  # D3
        5: 45,  # A2
        6: 40   # E2
    }

    # Standard 4-string bass tuning (String 1 = high G, String 4 = low E)
    BASS_TUNING = {
        1: 43,  # G2
        2: 38,  # D2
        3: 33,  # A1
        4: 28   # E1
    }

    MAX_FRETS = 22

    @classmethod
    def get_candidate_positions(cls, pitch: int, is_bass: bool = False) -> List[Tuple[int, int]]:
        """
        Returns all valid (string_idx, fret_num) combinations for a given MIDI pitch.
        string_idx is 1-indexed (1 = highest string).
        """
        tuning = cls.BASS_TUNING if is_bass else cls.GUITAR_TUNING
        candidates = []

        for string_idx, open_pitch in tuning.items():
            fret = pitch - open_pitch
            if 0 <= fret <= cls.MAX_FRETS:
                candidates.append((string_idx, fret))

        if not candidates:
            # If pitch is out of standard range, transpose or clamp to nearest string
            if not is_bass:
                if pitch < 40:  # Below low E
                    candidates.append((6, 0))
                else:  # Above fret 22 on high E
                    candidates.append((1, cls.MAX_FRETS))
            else:
                if pitch < 28:
                    candidates.append((4, 0))
                else:
                    candidates.append((1, cls.MAX_FRETS))

        return candidates

    @classmethod
    def optimize_tablature(
        cls,
        note_events: List[Dict[str, Any]],
        is_bass: bool = False,
        preferred_hand_position: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Runs Viterbi Dynamic Programming to assign (string, fret) to every note event,
        minimizing physical hand jumps and ensuring chord notes do not collide on strings.
        """
        if not note_events:
            return []

        # Make copy of notes sorted by start time
        notes = sorted([dict(n) for n in note_events], key=lambda x: (float(x.get("start", 0)), int(x["pitch"])))

        # Group notes into temporal chord time-slices (within 0.05s)
        time_slices: List[List[Dict[str, Any]]] = []
        cur_slice: List[Dict[str, Any]] = []
        cur_time = -1.0

        for n in notes:
            start_t = float(n.get("start", 0.0))
            if cur_time < 0 or abs(start_t - cur_time) <= 0.05:
                cur_slice.append(n)
                cur_time = start_t
            else:
                time_slices.append(cur_slice)
                cur_slice = [n]
                cur_time = start_t

        if cur_slice:
            time_slices.append(cur_slice)

        # For each time slice, generate valid chord fingerings
        # A fingering is a tuple of (string, fret) for each note in the slice
        slice_candidate_fingerings: List[List[List[Tuple[int, int]]]] = []

        for t_slice in time_slices:
            note_candidates = [cls.get_candidate_positions(int(n["pitch"]), is_bass) for n in t_slice]

            # Generate cartesian product of candidate positions
            possible_fingerings = []
            
            def generate_fingerings(note_idx: int, current_fingering: List[Tuple[int, int]], used_strings: set):
                if note_idx == len(t_slice):
                    # Check physical hand stretch: fretted notes (fret > 0) should span <= 4 frets
                    fretted = [f for (_, f) in current_fingering if f > 0]
                    if not fretted or (max(fretted) - min(fretted) <= 4):
                        possible_fingerings.append(list(current_fingering))
                    return

                for (s, f) in note_candidates[note_idx]:
                    if s not in used_strings:
                        used_strings.add(s)
                        current_fingering.append((s, f))
                        generate_fingerings(note_idx + 1, current_fingering, used_strings)
                        current_fingering.pop()
                        used_strings.remove(s)

            generate_fingerings(0, [], set())

            # Fallback if strict fingering failed
            if not possible_fingerings:
                # Pick first candidate for each note even if non-optimal
                fallback = [cands[0] for cands in note_candidates]
                possible_fingerings = [fallback]

            slice_candidate_fingerings.append(possible_fingerings)

        # Viterbi Dynamic Programming across time slices
        # State at step t is index of fingering in slice_candidate_fingerings[t]
        num_slices = len(time_slices)
        dp_cost = []
        dp_parent = []

        for t in range(num_slices):
            dp_cost.append([float('inf')] * len(slice_candidate_fingerings[t]))
            dp_parent.append([-1] * len(slice_candidate_fingerings[t]))

        # Helper: compute fingering center of mass
        def get_fingering_center(fingering: List[Tuple[int, int]]) -> float:
            fretted = [f for (_, f) in fingering if f > 0]
            return float(np.mean(fretted)) if fretted else float(preferred_hand_position)

        # Helper: compute cost between two fingerings
        def transition_cost(f1: List[Tuple[int, int]], f2: List[Tuple[int, int]]) -> float:
            c1 = get_fingering_center(f1)
            c2 = get_fingering_center(f2)
            hand_jump = abs(c2 - c1)
            # Penalize jumping higher than fret 12 unnecessarily
            high_neck_penalty = max(0.0, c2 - 9) * 0.4
            return hand_jump + high_neck_penalty

        # Initialize t = 0
        for i, fingering in enumerate(slice_candidate_fingerings[0]):
            c = get_fingering_center(fingering)
            dp_cost[0][i] = abs(c - preferred_hand_position) + max(0.0, c - 7) * 0.3

        # Forward pass
        for t in range(1, num_slices):
            for j, f_curr in enumerate(slice_candidate_fingerings[t]):
                best_prev_cost = float('inf')
                best_prev_idx = -1
                for i, f_prev in enumerate(slice_candidate_fingerings[t - 1]):
                    t_cost = dp_cost[t - 1][i] + transition_cost(f_prev, f_curr)
                    if t_cost < best_prev_cost:
                        best_prev_cost = t_cost
                        best_prev_idx = i
                dp_cost[t][j] = best_prev_cost
                dp_parent[t][j] = best_prev_idx

        # Backtrack optimal sequence
        best_end_idx = int(np.argmin(dp_cost[-1]))
        chosen_fingerings = [None] * num_slices
        curr_idx = best_end_idx

        for t in range(num_slices - 1, -1, -1):
            chosen_fingerings[t] = slice_candidate_fingerings[t][curr_idx]
            curr_idx = dp_parent[t][curr_idx]

        # Assign (string, fret) back to note dictionaries
        annotated_notes = []
        for t in range(num_slices):
            fingering = chosen_fingerings[t]
            t_slice = time_slices[t]
            for n_idx, n in enumerate(t_slice):
                s, f = fingering[n_idx]
                n["string"] = int(s)
                n["fret"] = int(f)
                annotated_notes.append(n)

        return annotated_notes

    @classmethod
    def generate_ascii_tab(
        cls,
        annotated_notes: List[Dict[str, Any]],
        bpm: float = 120.0,
        time_signature_str: str = "4/4"
    ) -> str:
        """
        Generates a clean, readable standard 6-line ASCII guitar tablature string.
        """
        if not annotated_notes:
            return "No notes to tabulate."

        string_labels = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']
        # Group into bars (approx 16 steps per bar)
        beat_sec = 60.0 / max(30.0, bpm)
        bar_sec = 4.0 * beat_sec

        max_time = max(float(n.get("end", 1.0)) for n in annotated_notes)
        num_bars = int(np.ceil(max_time / bar_sec))

        lines_output = []

        for b_idx in range(num_bars):
            b_start = b_idx * bar_sec
            b_end = (b_idx + 1) * bar_sec

            bar_notes = [n for n in annotated_notes if b_start <= float(n["start"]) < b_end]
            
            # 16-step grid for this bar
            grid = {s: ['-'] * 16 for s in range(1, 7)}

            for n in bar_notes:
                s = n.get("string", 1)
                f = n.get("fret", 0)
                rel_t = (float(n["start"]) - b_start) / bar_sec
                step_idx = min(15, max(0, int(round(rel_t * 15))))
                grid[s][step_idx] = str(f)

            bar_lines = []
            for s_num in range(1, 7):
                row_str = string_labels[s_num - 1] + "".join(f"{grid[s_num][i]:<2}" for i in range(16)) + "|"
                bar_lines.append(row_str)

            header = f"Measure {b_idx + 1} (t = {b_start:.1f}s - {b_end:.1f}s):"
            lines_output.append(header)
            lines_output.extend(bar_lines)
            lines_output.append("")

        return "\n".join(lines_output)
