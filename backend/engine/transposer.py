"""
Key Signature Transposer and Chromatic Interval Pitch Shifter
Handles semitone transposition, Circle of Fifths key shifting,
chord figure transposition, and guitar/bass TAB fret re-calculation.
"""
import re
import copy
from typing import Dict, Any, List, Tuple, Optional
import pretty_midi
from engine.tab_engine import GuitarTabEngine


class ScoreTransposer:
    """Provides complete musical transposition for notes, chords, keys, and tablature."""

    PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

    # Keys that conventionally use flat spellings
    FLAT_KEYS = {'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'}

    NOTE_TO_PC = {
        'C': 0, 'B#': 0,
        'C#': 1, 'Db': 1,
        'D': 2,
        'D#': 3, 'Eb': 3,
        'E': 4, 'Fb': 4,
        'F': 5, 'E#': 5,
        'F#': 6, 'Gb': 6,
        'G': 7,
        'G#': 8, 'Ab': 8,
        'A': 9,
        'A#': 10, 'Bb': 10,
        'B': 11, 'Cb': 11
    }

    @classmethod
    def transpose_pitch(cls, pitch: int, semitones: int, prefer_flats: bool = False) -> Tuple[int, str]:
        """Transposes MIDI pitch by semitones and returns (new_pitch, note_name)."""
        new_pitch = max(0, min(127, pitch + semitones))
        pc = new_pitch % 12
        octave = (new_pitch // 12) - 1
        name_list = cls.PITCH_NAMES_FLAT if prefer_flats else cls.PITCH_NAMES_SHARP
        note_name = f"{name_list[pc]}{octave}"
        return new_pitch, note_name

    @classmethod
    def transpose_key(cls, tonic: str, mode: str, semitones: int) -> Tuple[str, str, str]:
        """
        Transposes a key tonic (e.g. 'C', 'Eb') by semitones.
        Returns: (new_tonic, mode, display_string)
        """
        clean_tonic = tonic.strip().capitalize()
        base_pc = cls.NOTE_TO_PC.get(clean_tonic, 0)
        new_pc = (base_pc + semitones) % 12

        prefer_flats = (clean_tonic in cls.FLAT_KEYS) or (semitones < 0 and new_pc in [1, 3, 6, 8, 10])
        name_list = cls.PITCH_NAMES_FLAT if prefer_flats else cls.PITCH_NAMES_SHARP
        new_tonic = name_list[new_pc]
        display = f"{new_tonic} {mode.capitalize()}"
        return new_tonic, mode, display

    @classmethod
    def transpose_chord_figure(cls, chord_str: str, semitones: int, prefer_flats: bool = False) -> str:
        """Transposes chord figure root (e.g. 'Am7' + 2 -> 'Bm7', 'C/E' + 2 -> 'D/F#')."""
        if not chord_str or chord_str == "N.C.":
            return chord_str

        def shift_root(name: str) -> str:
            pc = cls.NOTE_TO_PC.get(name, 0)
            new_pc = (pc + semitones) % 12
            names = cls.PITCH_NAMES_FLAT if prefer_flats else cls.PITCH_NAMES_SHARP
            return names[new_pc]

        # Handle slash chords e.g. C/G, F#m/A
        if '/' in chord_str:
            parts = chord_str.split('/')
            trans_main = cls.transpose_chord_figure(parts[0], semitones, prefer_flats)
            trans_bass = shift_root(parts[1]) if parts[1] in cls.NOTE_TO_PC else parts[1]
            return f"{trans_main}/{trans_bass}"

        match = re.match(r'^([A-G][#b]?)(.*)$', chord_str)
        if not match:
            return chord_str

        root, extension = match.groups()
        new_root = shift_root(root)
        return f"{new_root}{extension}"

    @classmethod
    def transpose_score_data(
        cls,
        notes: List[Dict[str, Any]],
        semitones: int,
        key_tonic: str = "C",
        key_mode: str = "major",
        chords: Optional[List[Dict[str, Any]]] = None,
        bpm: float = 120.0,
        time_signature: str = "4/4",
        is_bass: bool = False
    ) -> Dict[str, Any]:
        """
        Performs full score transposition:
        - Shifts note pitches & names
        - Shifts key signature
        - Shifts measure chord progression
        - Re-optimizes guitar or bass tablature
        """
        prefer_flats = (key_tonic in cls.FLAT_KEYS) or (semitones < 0)
        new_tonic, new_mode, key_display = cls.transpose_key(key_tonic, key_mode, semitones)

        transposed_notes = []
        for n in notes:
            note_copy = copy.deepcopy(n)
            orig_pitch = int(note_copy["pitch"])
            new_pitch, new_name = cls.transpose_pitch(orig_pitch, semitones, prefer_flats)
            note_copy["pitch"] = new_pitch
            note_copy["name"] = new_name
            # If guitar string/fret was stored, strip it so TabEngine recalculates optimal frets
            note_copy.pop("string", None)
            note_copy.pop("fret", None)
            transposed_notes.append(note_copy)

        # Transpose chords
        transposed_chords = []
        if chords:
            for c in chords:
                c_copy = copy.deepcopy(c)
                c_copy["figure"] = cls.transpose_chord_figure(c_copy["figure"], semitones, prefer_flats)
                if "root" in c_copy and c_copy["root"]:
                    c_copy["root"] = cls.transpose_chord_figure(c_copy["root"], semitones, prefer_flats)
                transposed_chords.append(c_copy)

        # Recalculate optimal guitar tablature
        tab_notes = GuitarTabEngine.optimize_tablature(transposed_notes, is_bass=is_bass)
        ascii_tab = GuitarTabEngine.generate_ascii_tab(tab_notes, bpm, time_signature)

        return {
            "notes": transposed_notes,
            "key": {
                "tonic": new_tonic,
                "mode": new_mode,
                "display": key_display,
                "confidence": 1.0
            },
            "chords": transposed_chords,
            "tab_notes": tab_notes,
            "ascii_tab": ascii_tab,
            "semitones": semitones
        }
