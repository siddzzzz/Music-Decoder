"""
Rhythmic Quantization and MusicXML Sheet Music Builder using music21
"""
import os
import tempfile
from fractions import Fraction
from typing import List, Dict, Any, Optional, Tuple
import music21
from music21 import stream, note, chord, meter, key, tempo, clef, layout, tie, metadata, duration, instrument, harmony, articulations
from engine.chord_detector import ChordDetector
from engine.tab_engine import GuitarTabEngine


class ScoreQuantizer:
    """
    Translates raw transcribed MIDI note events into readable,
    rhythmically quantized, standard MusicXML scores.
    """

    # Supported quantization grid fractions (in quarterLength beats)
    # 1 quarterLength = 1 Quarter note in 4/4
    GRID_FRACTIONS = {
        "1/4": Fraction(1, 1),
        "1/8": Fraction(1, 2),
        "1/16": Fraction(1, 4),
        "1/32": Fraction(1, 8),
        "triplet_8th": Fraction(1, 3),
        "triplet_16th": Fraction(1, 6),
    }

    # Standard expressible durations in descending order
    STANDARD_REST_DURATIONS = [
        Fraction(4, 1),  # Whole
        Fraction(3, 1),  # Dotted Half
        Fraction(2, 1),  # Half
        Fraction(3, 2),  # Dotted Quarter
        Fraction(1, 1),  # Quarter
        Fraction(3, 4),  # Dotted 8th
        Fraction(1, 2),  # 8th
        Fraction(3, 8),  # Dotted 16th
        Fraction(1, 4),  # 16th
        Fraction(1, 8),  # 32nd
    ]

    @classmethod
    def decompose_into_standard_durations(cls, total_frac: Fraction) -> List[Fraction]:
        """Decomposes an arbitrary fraction of beats into valid musical durations."""
        components = []
        remaining = total_frac
        while remaining > Fraction(0, 1):
            matched = False
            for std in cls.STANDARD_REST_DURATIONS:
                if std <= remaining:
                    components.append(std)
                    remaining -= std
                    matched = True
                    break
            if not matched:
                # Smallest fallback
                components.append(remaining)
                break
        return components

    @classmethod
    def quantize_fraction(cls, val_frac: Fraction, step_frac: Fraction) -> Fraction:
        """Snaps a fraction to the closest integer multiple of step_frac."""
        if step_frac <= 0:
            return val_frac
        mult = round(float(val_frac / step_frac))
        return mult * step_frac

    @classmethod
    def seconds_to_quarter_fraction(cls, seconds: float, bpm: float) -> Fraction:
        """Converts seconds into an exact Fraction representing quarterLength beats."""
        beat_seconds = 60.0 / max(30.0, bpm)
        ql_float = seconds / beat_seconds
        # Snap to 1/32nd beat resolution (Fraction denominator 8)
        rounded_32nds = round(ql_float * 8)
        return Fraction(rounded_32nds, 8)

    @classmethod
    def build_score(
        cls,
        note_events: List[Dict[str, Any]],
        bpm: float = 120.0,
        time_signature_str: str = "4/4",
        key_tonic: str = "C",
        key_mode: str = "major",
        clef_mode: str = "grand_staff",  # 'grand_staff', 'treble', 'bass', 'alto'
        quantization_grid: str = "1/16",
        title: str = "Transcribed Instrumental",
        composer: str = "Music-Decoder AI"
    ) -> stream.Score:
        """
        Builds a complete, quantized, verified music21 Score.
        """
        score = stream.Score()
        score.metadata = metadata.Metadata()
        score.metadata.title = title
        score.metadata.composer = composer

        # Parse meter & key
        try:
            ts = meter.TimeSignature(time_signature_str)
        except Exception:
            ts = meter.TimeSignature("4/4")
        measure_len_frac = Fraction(int(ts.barDuration.quarterLength * 8), 8)

        try:
            score_key = key.Key(key_tonic, key_mode)
        except Exception:
            score_key = key.Key("C", "major")

        grid_step = cls.GRID_FRACTIONS.get(quantization_grid, Fraction(1, 4))
        tempo_mark = tempo.MetronomeMark(number=round(bpm))

        # Detect harmonic chord progression per measure
        chord_progression = ChordDetector.analyze_chords_by_measure(note_events, bpm, time_signature_str)
        chords_map = {c["measure"]: c["figure"] for c in chord_progression}

        # Optimize tablature string & fret assignments
        tab_annotated = GuitarTabEngine.optimize_tablature(note_events, is_bass=(clef_mode == "bass"))

        # Quantize all note events into exact fractions
        quantized_notes = []
        for idx, ev in enumerate(note_events):
            raw_start = cls.seconds_to_quarter_fraction(ev["start"], bpm)
            raw_dur = cls.seconds_to_quarter_fraction(ev["duration"], bpm)

            q_start = cls.quantize_fraction(raw_start, grid_step)
            q_dur = cls.quantize_fraction(raw_dur, grid_step)
            if q_dur < grid_step:
                q_dur = grid_step

            tab_info = tab_annotated[idx] if idx < len(tab_annotated) else {}

            quantized_notes.append({
                "pitch": int(ev["pitch"]),
                "start_frac": q_start,
                "dur_frac": q_dur,
                "end_frac": q_start + q_dur,
                "velocity": int(ev.get("velocity", 80)),
                "string": tab_info.get("string"),
                "fret": tab_info.get("fret")
            })

        # Separate into staves
        if clef_mode == "dual_tab":
            # Dual: Standard Treble Staff + 6-Line Tablature Staff
            notation_part = cls._assemble_part(
                quantized_notes,
                clef_obj=clef.TrebleClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Guitar (Notation)",
                grid_step=grid_step,
                chords_by_measure=chords_map
            )
            tab_part = cls._assemble_part(
                quantized_notes,
                clef_obj=clef.TabClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=None,
                measure_len_frac=measure_len_frac,
                part_name="Guitar (TAB)",
                grid_step=grid_step,
                chords_by_measure=None
            )
            num_m = max(len(notation_part.getElementsByClass('Measure')), len(tab_part.getElementsByClass('Measure')), 1)
            cls._pad_part_measures(notation_part, num_m, measure_len_frac)
            cls._pad_part_measures(tab_part, num_m, measure_len_frac)

            staff_group = layout.StaffGroup([notation_part, tab_part], name="Guitar", abbreviation="Gtr.", symbol="bracket")
            staff_group.barTogether = 'mensurstrich'
            score.append(staff_group)
            score.append(notation_part)
            score.append(tab_part)
        elif clef_mode == "guitar_tab":
            tab_part = cls._assemble_part(
                quantized_notes,
                clef_obj=clef.TabClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Guitar (TAB)",
                grid_step=grid_step,
                chords_by_measure=chords_map
            )
            score.append(tab_part)
        elif clef_mode == "grand_staff":
            treble_notes = [n for n in quantized_notes if n["pitch"] >= 60]
            bass_notes = [n for n in quantized_notes if n["pitch"] < 60]

            treble_part = cls._assemble_part(
                treble_notes,
                clef_obj=clef.TrebleClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Right Hand",
                grid_step=grid_step,
                chords_by_measure=chords_map
            )
            bass_part = cls._assemble_part(
                bass_notes,
                clef_obj=clef.BassClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=None,
                measure_len_frac=measure_len_frac,
                part_name="Left Hand",
                grid_step=grid_step,
                chords_by_measure=None
            )

            # Equalize measure counts
            num_m = max(len(treble_part.getElementsByClass('Measure')), len(bass_part.getElementsByClass('Measure')), 1)
            cls._pad_part_measures(treble_part, num_m, measure_len_frac)
            cls._pad_part_measures(bass_part, num_m, measure_len_frac)

            staff_group = layout.StaffGroup([treble_part, bass_part], name="Piano", abbreviation="Pno.", symbol="brace")
            staff_group.barTogether = 'mensurstrich'
            score.append(staff_group)
            score.append(treble_part)
            score.append(bass_part)
        else:
            clef_map = {
                "treble": clef.TrebleClef(),
                "bass": clef.BassClef(),
                "alto": clef.AltoClef(),
                "tenor": clef.TenorClef()
            }
            chosen_clef = clef_map.get(clef_mode, clef.TrebleClef())
            solo_part = cls._assemble_part(
                quantized_notes,
                clef_obj=chosen_clef,
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Instrument",
                grid_step=grid_step,
                chords_by_measure=chords_map
            )
            score.append(solo_part)

        return score

    @classmethod
    def _assemble_part(
        cls,
        notes_list: List[Dict[str, Any]],
        clef_obj: clef.Clef,
        ts: meter.TimeSignature,
        score_key: key.Key,
        tempo_mark: Optional[tempo.MetronomeMark],
        measure_len_frac: Fraction,
        part_name: str,
        grid_step: Fraction,
        chords_by_measure: Optional[Dict[int, str]] = None
    ) -> stream.Part:
        """
        Assembles a stream.Part measure-by-measure with standard expressible durations.
        """
        part = stream.Part()
        part.partName = part_name

        if not notes_list:
            m = stream.Measure(number=1)
            m.append(clef_obj)
            m.append(score_key)
            m.append(ts)
            if tempo_mark:
                m.append(tempo_mark)
            if chords_by_measure and 1 in chords_by_measure:
                try:
                    cs = harmony.ChordSymbol(chords_by_measure[1])
                    m.append(cs)
                except Exception:
                    pass
            r = note.Rest()
            r.duration = duration.Duration(measure_len_frac)
            m.append(r)
            part.append(m)
            return part

        # Split any notes crossing measure boundaries
        split_notes = []
        for n_item in notes_list:
            start = n_item["start_frac"]
            end = n_item["end_frac"]
            pitch_val = n_item["pitch"]
            vel = n_item["velocity"]

            cur_start = start
            while cur_start < end:
                m_index = int(cur_start // measure_len_frac)
                m_end = Fraction(m_index + 1, 1) * measure_len_frac
                cur_end = min(end, m_end)
                cur_dur = cur_end - cur_start

                is_tied_start = (cur_end < end)
                is_tied_stop = (cur_start > start)

                split_notes.append({
                    "pitch": pitch_val,
                    "measure_idx": m_index,
                    "m_offset": cur_start - (Fraction(m_index, 1) * measure_len_frac),
                    "dur_frac": cur_dur,
                    "velocity": vel,
                    "string": n_item.get("string"),
                    "fret": n_item.get("fret"),
                    "tie_type": "continue" if (is_tied_start and is_tied_stop) else ("start" if is_tied_start else ("stop" if is_tied_stop else None))
                })
                cur_start = cur_end

        max_m_idx = max(item["measure_idx"] for item in split_notes)
        measures_dict = {i: [] for i in range(max_m_idx + 1)}
        for item in split_notes:
            measures_dict[item["measure_idx"]].append(item)

        for m_idx in range(max_m_idx + 1):
            m = stream.Measure(number=m_idx + 1)
            if m_idx == 0:
                m.append(clef_obj)
                m.append(score_key)
                m.append(ts)
                if tempo_mark:
                    m.append(tempo_mark)

            # Insert harmonic chord symbol if detected for this measure
            if chords_by_measure and (m_idx + 1) in chords_by_measure:
                try:
                    cs = harmony.ChordSymbol(chords_by_measure[m_idx + 1])
                    m.append(cs)
                except Exception:
                    pass

            m_notes = measures_dict.get(m_idx, [])
            m_notes.sort(key=lambda x: x["m_offset"])

            curr_pos = Fraction(0, 1)
            idx = 0
            while idx < len(m_notes):
                n_info = m_notes[idx]
                target_offset = max(curr_pos, n_info["m_offset"])

                # Insert rests if gap exists
                gap = target_offset - curr_pos
                if gap >= Fraction(1, 8):
                    for rest_dur in cls.decompose_into_standard_durations(gap):
                        r = note.Rest()
                        r.duration = duration.Duration(rest_dur)
                        m.append(r)
                    curr_pos = target_offset

                # Group chords
                simultaneous = [n_info]
                next_idx = idx + 1
                while next_idx < len(m_notes) and m_notes[next_idx]["m_offset"] == n_info["m_offset"]:
                    simultaneous.append(m_notes[next_idx])
                    next_idx += 1

                idx = next_idx
                max_dur = max(sn["dur_frac"] for sn in simultaneous)

                # Decompose note duration into standard components if complex
                dur_components = cls.decompose_into_standard_durations(max_dur)
                for c_idx, comp_dur in enumerate(dur_components):
                    is_sub_tied = (len(dur_components) > 1)
                    if len(simultaneous) > 1:
                        pitches = [sn["pitch"] for sn in simultaneous]
                        ch = chord.Chord(pitches)
                        ch.duration = duration.Duration(comp_dur)
                        ch.volume.velocity = simultaneous[0]["velocity"]
                        for sn in simultaneous:
                            if sn.get("string") is not None and sn.get("fret") is not None:
                                try:
                                    ch.articulations.append(articulations.StringIndication(int(sn["string"])))
                                    ch.articulations.append(articulations.FretIndication(int(sn["fret"])))
                                except Exception:
                                    pass
                        m.append(ch)
                    else:
                        n = note.Note(n_info["pitch"])
                        n.duration = duration.Duration(comp_dur)
                        n.volume.velocity = n_info["velocity"]
                        if n_info.get("string") is not None and n_info.get("fret") is not None:
                            try:
                                n.articulations.append(articulations.StringIndication(int(n_info["string"])))
                                n.articulations.append(articulations.FretIndication(int(n_info["fret"])))
                            except Exception:
                                pass
                        
                        # Tie handling
                        if n_info.get("tie_type"):
                            n.tie = tie.Tie(n_info["tie_type"])
                        elif is_sub_tied:
                            if c_idx < len(dur_components) - 1:
                                n.tie = tie.Tie('start')
                            elif c_idx > 0:
                                n.tie = tie.Tie('stop')
                        m.append(n)

                curr_pos = target_offset + max_dur

            # Fill remaining measure with rests
            remaining = measure_len_frac - curr_pos
            if remaining >= Fraction(1, 8):
                for rest_dur in cls.decompose_into_standard_durations(remaining):
                    r = note.Rest()
                    r.duration = duration.Duration(rest_dur)
                    m.append(r)

            part.append(m)

        return part

    @classmethod
    def _pad_part_measures(cls, part: stream.Part, target_count: int, measure_len_frac: Fraction) -> None:
        existing_count = len(part.getElementsByClass('Measure'))
        for m_idx in range(existing_count, target_count):
            m = stream.Measure(number=m_idx + 1)
            for rest_dur in cls.decompose_into_standard_durations(measure_len_frac):
                r = note.Rest()
                r.duration = duration.Duration(rest_dur)
                m.append(r)
            part.append(m)

    @classmethod
    def build_multitrack_score(
        cls,
        tracks: Dict[str, Dict[str, Any]],
        bpm: float = 120.0,
        time_signature_str: str = "4/4",
        key_tonic: str = "C",
        key_mode: str = "major",
        quantization_grid: str = "1/16",
        title: str = "Multi-Track Orchestral Transcription",
        composer: str = "Music-Decoder Conductor AI"
    ) -> stream.Score:
        """
        Builds a full multi-part Conductor's Score combining all separated stems.
        """
        score = stream.Score()
        score.metadata = metadata.Metadata()
        score.metadata.title = title
        score.metadata.composer = composer

        try:
            ts = meter.TimeSignature(time_signature_str)
        except Exception:
            ts = meter.TimeSignature("4/4")
        measure_len_frac = Fraction(int(ts.barDuration.quarterLength * 8), 8)

        try:
            score_key = key.Key(key_tonic, key_mode)
        except Exception:
            score_key = key.Key("C", "major")

        grid_step = cls.GRID_FRACTIONS.get(quantization_grid, Fraction(1, 4))
        tempo_mark = tempo.MetronomeMark(number=round(bpm))

        # Collect all harmonic notes to analyze chords
        all_orch_notes = []
        for t_info in tracks.values():
            all_orch_notes.extend(t_info.get("notes", []))
        all_orch_notes.sort(key=lambda x: x.get("start", 0))

        chord_progression = ChordDetector.analyze_chords_by_measure(all_orch_notes, bpm, time_signature_str)
        chords_map = {c["measure"]: c["figure"] for c in chord_progression}

        assembled_parts = []

        # Part 1: Lead Melody (Flute / Violin / Vocal)
        if "lead" in tracks and len(tracks["lead"].get("notes", [])) > 0:
            lead_notes_raw = tracks["lead"]["notes"]
            q_lead = cls._quantize_note_list(lead_notes_raw, bpm, grid_step)
            lead_part = cls._assemble_part(
                q_lead,
                clef_obj=clef.TrebleClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Lead / Winds / Solo",
                grid_step=grid_step,
                chords_by_measure=chords_map
            )
            lead_part.insert(0, instrument.Flute())
            assembled_parts.append(lead_part)

        # Part 2: Harmony / Keys / Strings
        if "harmony" in tracks and len(tracks["harmony"].get("notes", [])) > 0:
            harmony_notes_raw = tracks["harmony"]["notes"]
            q_harm = cls._quantize_note_list(harmony_notes_raw, bpm, grid_step)
            harm_part = cls._assemble_part(
                q_harm,
                clef_obj=clef.TrebleClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark if len(assembled_parts) == 0 else None,
                measure_len_frac=measure_len_frac,
                part_name="Harmony / Keys / Strings",
                grid_step=grid_step,
                chords_by_measure=chords_map if len(assembled_parts) == 0 else None
            )
            harm_part.insert(0, instrument.Piano())
            assembled_parts.append(harm_part)

        # Part 3: Bassline / Cello / Low Brass
        if "bass" in tracks and len(tracks["bass"].get("notes", [])) > 0:
            bass_notes_raw = tracks["bass"]["notes"]
            q_bass = cls._quantize_note_list(bass_notes_raw, bpm, grid_step)
            bass_part = cls._assemble_part(
                q_bass,
                clef_obj=clef.BassClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark if len(assembled_parts) == 0 else None,
                measure_len_frac=measure_len_frac,
                part_name="Bass / Cello",
                grid_step=grid_step
            )
            bass_part.insert(0, instrument.ElectricBass())
            assembled_parts.append(bass_part)

        # Part 4: Percussion / Drums
        if "drums" in tracks and len(tracks["drums"].get("notes", [])) > 0:
            drum_notes_raw = tracks["drums"]["notes"]
            q_drums = cls._quantize_note_list(drum_notes_raw, bpm, grid_step)
            drum_part = cls._assemble_part(
                q_drums,
                clef_obj=clef.PercussionClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark if len(assembled_parts) == 0 else None,
                measure_len_frac=measure_len_frac,
                part_name="Drums / Percussion",
                grid_step=grid_step
            )
            drum_part.insert(0, instrument.BassDrum())
            assembled_parts.append(drum_part)

        if not assembled_parts:
            # Fallback empty score
            empty_part = cls._assemble_part(
                [],
                clef_obj=clef.TrebleClef(),
                ts=ts,
                score_key=score_key,
                tempo_mark=tempo_mark,
                measure_len_frac=measure_len_frac,
                part_name="Ensemble",
                grid_step=grid_step
            )
            assembled_parts.append(empty_part)

        # Equalize measure lengths across all parts
        max_m = max(len(p.getElementsByClass('Measure')) for p in assembled_parts)
        for p in assembled_parts:
            cls._pad_part_measures(p, max_m, measure_len_frac)

        # Add Orchestral Bracket Group
        group = layout.StaffGroup(assembled_parts, name="Orchestra", abbreviation="Orch.", symbol="bracket")
        group.barTogether = 'mensurstrich'
        score.append(group)

        for p in assembled_parts:
            score.append(p)

        return score

    @classmethod
    def _quantize_note_list(cls, notes_raw: List[Dict[str, Any]], bpm: float, grid_step: Fraction) -> List[Dict[str, Any]]:
        """Helper to quantize a raw note list into exact fractions."""
        q_list = []
        for ev in notes_raw:
            raw_start = cls.seconds_to_quarter_fraction(ev["start"], bpm)
            raw_dur = cls.seconds_to_quarter_fraction(ev["duration"], bpm)
            q_start = cls.quantize_fraction(raw_start, grid_step)
            q_dur = cls.quantize_fraction(raw_dur, grid_step)
            if q_dur < grid_step:
                q_dur = grid_step

            q_list.append({
                "pitch": int(ev["pitch"]),
                "start_frac": q_start,
                "dur_frac": q_dur,
                "end_frac": q_start + q_dur,
                "velocity": int(ev.get("velocity", 80))
            })
        return q_list

    @classmethod
    def to_musicxml_string(cls, score: stream.Score) -> str:
        """Exports music21 Score to MusicXML string via temporary file."""
        with tempfile.NamedTemporaryFile(suffix='.musicxml', delete=False) as tf:
            temp_path = tf.name

        try:
            score.write('musicxml', fp=temp_path)
            with open(temp_path, 'r', encoding='utf-8') as f:
                xml_str = f.read()
            return xml_str
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

