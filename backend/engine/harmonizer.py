"""
Auto-Chord Harmonizer and Multi-Part Voicing Engine
Generates 3-part vocal choir, string quartet, brass section, and jazz tension voicings
based on melody contour and detected measure chord progressions.
"""
import copy
from typing import Dict, Any, List, Optional
import pretty_midi
from engine.chord_detector import ChordDetector


class HarmonizerEngine:
    """Generates multi-part musical voicings (choir, strings, brass, jazz tensions)."""

    # Scale degree semitones relative to root
    SCALE_STEPS_MAJOR = [0, 2, 4, 5, 7, 9, 11]
    SCALE_STEPS_MINOR = [0, 2, 3, 5, 7, 8, 10]

    NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    @classmethod
    def get_chord_tones(cls, chord_figure: str) -> List[int]:
        """
        Parses a chord figure (e.g. 'C', 'Am', 'G7', 'F#m7', 'Dm9')
        and returns the chord pitch classes (0-11) relative to C.
        """
        if not chord_figure or chord_figure == "N.C.":
            return [0, 4, 7]  # Default C major triad

        # Extract root
        root_name = chord_figure[0]
        remainder = chord_figure[1:]
        if len(chord_figure) > 1 and chord_figure[1] in ['#', 'b']:
            root_name = chord_figure[:2]
            remainder = chord_figure[2:]

        root_pc = 0
        name_map = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        }
        root_pc = name_map.get(root_name, 0)

        # Determine chord quality intervals
        rem_lower = remainder.lower()
        if 'm7b5' in rem_lower or 'ø' in rem_lower:
            intervals = [0, 3, 6, 10]
        elif 'dim' in rem_lower or 'o' in rem_lower:
            intervals = [0, 3, 6, 9]
        elif 'maj7' in rem_lower or 'm7+' in rem_lower:
            intervals = [0, 4, 7, 11]
        elif 'm7' in rem_lower or 'min7' in rem_lower:
            intervals = [0, 3, 7, 10]
        elif '7' in rem_lower:
            intervals = [0, 4, 7, 10]
        elif 'm' in rem_lower or 'min' in rem_lower:
            intervals = [0, 3, 7]
        elif 'sus4' in rem_lower:
            intervals = [0, 5, 7]
        elif 'sus2' in rem_lower:
            intervals = [0, 2, 7]
        elif 'aug' in rem_lower or '+' in rem_lower:
            intervals = [0, 4, 8]
        else:
            intervals = [0, 4, 7]  # Major triad

        return [(root_pc + i) % 12 for i in intervals]

    @classmethod
    def _find_nearest_chord_pitch(cls, target_pitch: int, chord_pcs: List[int]) -> int:
        """Finds the pitch closest to target_pitch that belongs to the given chord pitch classes."""
        best_pitch = target_pitch
        best_dist = 999
        # Search within 1 octave range
        for p in range(target_pitch - 6, target_pitch + 7):
            if (p % 12) in chord_pcs:
                dist = abs(p - target_pitch)
                if dist < best_dist:
                    best_dist = dist
                    best_pitch = p
        return best_pitch

    @classmethod
    def harmonize_melody(
        cls,
        melody_notes: List[Dict[str, Any]],
        bpm: float = 120.0,
        time_signature: str = "4/4",
        key_tonic: str = "C",
        key_mode: str = "major",
        style: str = "choir_3part"
    ) -> Dict[str, Any]:
        """
        Takes lead melody notes and generates multi-part harmonized tracks:
        - choir_3part: Soprano (Lead), Alto (3rd/4th harmony), Tenor/Bass (Root/5th anchor)
        - string_quartet: Violin I, Violin II, Viola, Cello
        - brass_horns: Trumpet, Tenor Sax, Trombone
        - jazz_tensions: Adds lush 7th/9th color guide tones
        """
        if not melody_notes:
            return {"tracks": {}, "all_notes": []}

        # Analyze chord progression by measure
        chords = ChordDetector.analyze_chords_by_measure(melody_notes, bpm, time_signature)
        measure_chord_map: Dict[int, str] = {}
        for c in chords:
            measure_chord_map[c["measure"]] = c["figure"]

        # Beats per measure
        try:
            num_beats = int(time_signature.split('/')[0])
        except Exception:
            num_beats = 4
        seconds_per_measure = (60.0 / max(30.0, bpm)) * num_beats

        sorted_melody = sorted(copy.deepcopy(melody_notes), key=lambda x: float(x.get("start", 0)))

        if style == "string_quartet":
            return cls._build_string_quartet(sorted_melody, measure_chord_map, seconds_per_measure, key_tonic)
        elif style == "brass_horns":
            return cls._build_brass_horns(sorted_melody, measure_chord_map, seconds_per_measure, key_tonic)
        elif style == "jazz_tensions":
            return cls._build_jazz_tensions(sorted_melody, measure_chord_map, seconds_per_measure, key_tonic)
        else:
            # Default: 3-Part Vocal Choir
            return cls._build_choir_3part(sorted_melody, measure_chord_map, seconds_per_measure, key_tonic)

    @classmethod
    def _build_choir_3part(
        cls,
        melody_notes: List[Dict[str, Any]],
        measure_chord_map: Dict[int, str],
        seconds_per_measure: float,
        key_tonic: str
    ) -> Dict[str, Any]:
        """Builds 3-Part Vocal Choir (Soprano, Alto, Tenor/Bass)."""
        soprano_notes = []
        alto_notes = []
        tenor_bass_notes = []

        for n in melody_notes:
            start = float(n.get("start", 0))
            dur = float(n.get("duration", 0.5))
            end = float(n.get("end", start + dur))
            pitch = int(n["pitch"])
            vel = int(n.get("velocity", 85))

            measure_num = max(1, int(start / seconds_per_measure) + 1)
            chord_fig = measure_chord_map.get(measure_num, key_tonic)
            chord_pcs = cls.get_chord_tones(chord_fig)

            # Soprano (Lead Melody)
            soprano_notes.append({
                "pitch": pitch,
                "name": pretty_midi.note_number_to_name(pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": vel,
                "track": "soprano",
                "instrument": "Soprano Lead",
                "lyric": n.get("lyric")
            })

            # Alto: Harmonize 3-4 semitones below lead, snapped to chord tones
            target_alto = pitch - 3
            alto_pitch = cls._find_nearest_chord_pitch(target_alto, chord_pcs)
            # Ensure Alto stays below Soprano
            if alto_pitch >= pitch:
                alto_pitch -= 12 if (alto_pitch - 12) >= 48 else 7
            alto_pitch = max(53, min(76, alto_pitch))  # Alto range F3 - E5

            alto_notes.append({
                "pitch": alto_pitch,
                "name": pretty_midi.note_number_to_name(alto_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(40, vel - 8),
                "track": "alto",
                "instrument": "Alto Choir"
            })

            # Tenor/Bass: Chord Root or 5th an octave lower
            root_pc = chord_pcs[0] if chord_pcs else 0
            fifth_pc = chord_pcs[2] if len(chord_pcs) > 2 else (root_pc + 7) % 12

            # Alternating root and fifth anchor
            chosen_pc = root_pc if (len(tenor_bass_notes) % 2 == 0) else fifth_pc
            # Place in bass octave (C2 - G3 -> MIDI 36 - 55)
            bass_pitch = 48 + chosen_pc
            if bass_pitch > 55:
                bass_pitch -= 12
            if bass_pitch < 36:
                bass_pitch += 12

            tenor_bass_notes.append({
                "pitch": bass_pitch,
                "name": pretty_midi.note_number_to_name(bass_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(50, vel - 5),
                "track": "tenor_bass",
                "instrument": "Tenor / Bass Choir"
            })

        tracks = {
            "lead": {
                "name": "Soprano (Melody)",
                "instrument": "Soprano Vocal Choir",
                "notes_count": len(soprano_notes),
                "notes": soprano_notes,
                "clef": "treble"
            },
            "harmony": {
                "name": "Alto (Harmony)",
                "instrument": "Alto Vocal Choir",
                "notes_count": len(alto_notes),
                "notes": alto_notes,
                "clef": "treble"
            },
            "bass": {
                "name": "Tenor & Bass (Anchor)",
                "instrument": "Tenor / Bass Choir",
                "notes_count": len(tenor_bass_notes),
                "notes": tenor_bass_notes,
                "clef": "bass"
            }
        }

        all_notes = soprano_notes + alto_notes + tenor_bass_notes
        all_notes.sort(key=lambda x: x["start"])

        return {"tracks": tracks, "all_notes": all_notes, "style": "choir_3part"}

    @classmethod
    def _build_string_quartet(
        cls,
        melody_notes: List[Dict[str, Any]],
        measure_chord_map: Dict[int, str],
        seconds_per_measure: float,
        key_tonic: str
    ) -> Dict[str, Any]:
        """Builds String Quartet (Violin I, Violin II, Viola, Cello)."""
        v1_notes = []
        v2_notes = []
        viola_notes = []
        cello_notes = []

        for n in melody_notes:
            start = float(n.get("start", 0))
            dur = float(n.get("duration", 0.5))
            end = float(n.get("end", start + dur))
            pitch = int(n["pitch"])
            vel = int(n.get("velocity", 85))

            measure_num = max(1, int(start / seconds_per_measure) + 1)
            chord_fig = measure_chord_map.get(measure_num, key_tonic)
            chord_pcs = cls.get_chord_tones(chord_fig)

            # Violin I (Lead)
            v1_notes.append({
                "pitch": pitch,
                "name": pretty_midi.note_number_to_name(pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": vel,
                "track": "lead",
                "instrument": "Violin I"
            })

            # Violin II: Counter-melody harmony 3rd / 6th below
            v2_pitch = cls._find_nearest_chord_pitch(pitch - 4, chord_pcs)
            if v2_pitch >= pitch:
                v2_pitch -= 12
            v2_pitch = max(55, min(80, v2_pitch))  # Violin range G3 - G5
            v2_notes.append({
                "pitch": v2_pitch,
                "name": pretty_midi.note_number_to_name(v2_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(45, vel - 10),
                "track": "harmony",
                "instrument": "Violin II"
            })

            # Viola: Alto / Tenor inner harmonies
            viola_pitch = cls._find_nearest_chord_pitch(pitch - 9, chord_pcs)
            viola_pitch = max(48, min(69, viola_pitch))  # Viola range C3 - A4
            viola_notes.append({
                "pitch": viola_pitch,
                "name": pretty_midi.note_number_to_name(viola_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(45, vel - 12),
                "track": "viola",
                "instrument": "Viola"
            })

            # Cello: Resonant bass foundation
            root_pc = chord_pcs[0] if chord_pcs else 0
            cello_pitch = 36 + root_pc  # C2 - B2
            if cello_pitch > 48:
                cello_pitch -= 12
            cello_notes.append({
                "pitch": cello_pitch,
                "name": pretty_midi.note_number_to_name(cello_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(55, vel),
                "track": "bass",
                "instrument": "Cello"
            })

        tracks = {
            "lead": {
                "name": "Violin I (Solo)",
                "instrument": "Violin",
                "notes_count": len(v1_notes),
                "notes": v1_notes,
                "clef": "treble"
            },
            "harmony": {
                "name": "Violin II & Viola",
                "instrument": "String Ensemble",
                "notes_count": len(v2_notes) + len(viola_notes),
                "notes": v2_notes + viola_notes,
                "clef": "grand_staff"
            },
            "bass": {
                "name": "Cello (Bass)",
                "instrument": "Cello",
                "notes_count": len(cello_notes),
                "notes": cello_notes,
                "clef": "bass"
            }
        }

        all_notes = v1_notes + v2_notes + viola_notes + cello_notes
        all_notes.sort(key=lambda x: x["start"])

        return {"tracks": tracks, "all_notes": all_notes, "style": "string_quartet"}

    @classmethod
    def _build_brass_horns(
        cls,
        melody_notes: List[Dict[str, Any]],
        measure_chord_map: Dict[int, str],
        seconds_per_measure: float,
        key_tonic: str
    ) -> Dict[str, Any]:
        """Builds Brass / Horn Section (Trumpet, Tenor Sax, Trombone)."""
        trumpet_notes = []
        sax_notes = []
        trombone_notes = []

        for n in melody_notes:
            start = float(n.get("start", 0))
            dur = float(n.get("duration", 0.5))
            end = float(n.get("end", start + dur))
            pitch = int(n["pitch"])
            vel = int(n.get("velocity", 90))

            measure_num = max(1, int(start / seconds_per_measure) + 1)
            chord_fig = measure_chord_map.get(measure_num, key_tonic)
            chord_pcs = cls.get_chord_tones(chord_fig)

            # Trumpet (Lead)
            trumpet_notes.append({
                "pitch": pitch,
                "name": pretty_midi.note_number_to_name(pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": vel,
                "track": "lead",
                "instrument": "Trumpet Lead"
            })

            # Tenor Sax: Diatonic 3rd/6th below trumpet
            sax_pitch = cls._find_nearest_chord_pitch(pitch - 4, chord_pcs)
            if sax_pitch >= pitch:
                sax_pitch -= 12
            sax_pitch = max(44, min(75, sax_pitch))
            sax_notes.append({
                "pitch": sax_pitch,
                "name": pretty_midi.note_number_to_name(sax_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(50, vel - 5),
                "track": "harmony",
                "instrument": "Tenor Sax"
            })

            # Trombone: Punchy root & 5th bass
            root_pc = chord_pcs[0] if chord_pcs else 0
            tbone_pitch = 40 + root_pc  # E2 to Eb3
            if tbone_pitch > 52:
                tbone_pitch -= 12
            trombone_notes.append({
                "pitch": tbone_pitch,
                "name": pretty_midi.note_number_to_name(tbone_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(60, vel + 5),
                "track": "bass",
                "instrument": "Trombone"
            })

        tracks = {
            "lead": {
                "name": "Trumpet (Lead)",
                "instrument": "Trumpet",
                "notes_count": len(trumpet_notes),
                "notes": trumpet_notes,
                "clef": "treble"
            },
            "harmony": {
                "name": "Tenor Saxophone",
                "instrument": "Tenor Sax",
                "notes_count": len(sax_notes),
                "notes": sax_notes,
                "clef": "treble"
            },
            "bass": {
                "name": "Trombone / Low Brass",
                "instrument": "Trombone",
                "notes_count": len(trombone_notes),
                "notes": trombone_notes,
                "clef": "bass"
            }
        }

        all_notes = trumpet_notes + sax_notes + trombone_notes
        all_notes.sort(key=lambda x: x["start"])

        return {"tracks": tracks, "all_notes": all_notes, "style": "brass_horns"}

    @classmethod
    def _build_jazz_tensions(
        cls,
        melody_notes: List[Dict[str, Any]],
        measure_chord_map: Dict[int, str],
        seconds_per_measure: float,
        key_tonic: str
    ) -> Dict[str, Any]:
        """Builds Jazz Color Voicings with 7th and 9th tensions."""
        melody_out = []
        guide_tones = []
        jazz_bass = []

        for n in melody_notes:
            start = float(n.get("start", 0))
            dur = float(n.get("duration", 0.5))
            end = float(n.get("end", start + dur))
            pitch = int(n["pitch"])
            vel = int(n.get("velocity", 80))

            measure_num = max(1, int(start / seconds_per_measure) + 1)
            chord_fig = measure_chord_map.get(measure_num, key_tonic)
            chord_pcs = cls.get_chord_tones(chord_fig)

            melody_out.append({
                "pitch": pitch,
                "name": pretty_midi.note_number_to_name(pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": vel,
                "track": "lead",
                "instrument": "Jazz Lead"
            })

            # Guide tones: 3rd and 7th / 9th of the chord
            root_pc = chord_pcs[0] if chord_pcs else 0
            third_pc = chord_pcs[1] if len(chord_pcs) > 1 else (root_pc + 4) % 12
            seventh_pc = chord_pcs[3] if len(chord_pcs) > 3 else (root_pc + 10) % 12
            ninth_pc = (root_pc + 2) % 12

            # Guide tone voice
            gt_pitch = cls._find_nearest_chord_pitch(pitch - 5, [third_pc, seventh_pc, ninth_pc])
            guide_tones.append({
                "pitch": gt_pitch,
                "name": pretty_midi.note_number_to_name(gt_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(45, vel - 10),
                "track": "harmony",
                "instrument": "Jazz Guide Tones"
            })

            # Walking Jazz Bass
            bass_pitch = 36 + root_pc
            if bass_pitch > 46:
                bass_pitch -= 12
            jazz_bass.append({
                "pitch": bass_pitch,
                "name": pretty_midi.note_number_to_name(bass_pitch),
                "start": start,
                "end": end,
                "duration": dur,
                "velocity": max(55, vel),
                "track": "bass",
                "instrument": "Upright Bass"
            })

        tracks = {
            "lead": {
                "name": "Lead Melody",
                "instrument": "Flute / Solo",
                "notes_count": len(melody_out),
                "notes": melody_out,
                "clef": "treble"
            },
            "harmony": {
                "name": "Jazz Guide Tones (3rd/7th/9th)",
                "instrument": "Jazz Piano / Guitar",
                "notes_count": len(guide_tones),
                "notes": guide_tones,
                "clef": "grand_staff"
            },
            "bass": {
                "name": "Walking Upright Bass",
                "instrument": "Acoustic Upright Bass",
                "notes_count": len(jazz_bass),
                "notes": jazz_bass,
                "clef": "bass"
            }
        }

        all_notes = melody_out + guide_tones + jazz_bass
        all_notes.sort(key=lambda x: x["start"])

        return {"tracks": tracks, "all_notes": all_notes, "style": "jazz_tensions"}
