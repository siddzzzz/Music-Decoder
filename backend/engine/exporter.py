"""
Export Manager for MusicXML, MIDI, and PDF Sheet Music
"""
import os
import io
import pretty_midi
import music21
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Group
from engine.chord_detector import ChordDetector
from engine.tab_engine import GuitarTabEngine


class ScoreExporter:
    """Handles exporting scores to MusicXML, MIDI, and PDF formats."""

    @classmethod
    def save_musicxml(cls, score: music21.stream.Score, output_path: str) -> str:
        """Saves score as MusicXML file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        score.write('musicxml', fp=output_path)
        return output_path

    @classmethod
    def save_midi(cls, midi_data: pretty_midi.PrettyMIDI, output_path: str) -> str:
        """Saves PrettyMIDI object to .mid file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        midi_data.write(output_path)
        return output_path

    @classmethod
    def generate_pdf_report(
        cls,
        output_path: str,
        title: str,
        composer: str,
        bpm: float,
        key_signature: str,
        time_signature: str,
        note_events: List[Dict[str, Any]],
        clef_mode: str = "grand_staff"
    ) -> str:
        """
        Generates a clean, professional Sheet Music & Transcription Summary PDF.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom typography styles
        title_style = ParagraphStyle(
            'ScoreTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            alignment=1  # Centered
        )

        subtitle_style = ParagraphStyle(
            'ScoreSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#64748b"),
            alignment=1
        )

        meta_style = ParagraphStyle(
            'ScoreMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#334155")
        )

        section_heading = ParagraphStyle(
            'SectionHead',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=6
        )

        story = []

        # Header Title & Subtitle
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"Composed / Performed by {composer} • Transcribed with Music-Decoder AI", subtitle_style))
        story.append(Spacer(1, 14))

        # Metadata Table Box
        meta_data = [
            [
                Paragraph(f"<b>Key:</b> {key_signature}", meta_style),
                Paragraph(f"<b>Tempo:</b> {round(bpm)} BPM", meta_style),
                Paragraph(f"<b>Time Signature:</b> {time_signature}", meta_style),
                Paragraph(f"<b>Clef:</b> {clef_mode.replace('_', ' ').title()}", meta_style),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[130, 130, 130, 150])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # Harmonic Chord Progression
        progression = ChordDetector.analyze_chords_by_measure(note_events, bpm, time_signature)
        if progression:
            chord_str = "   •   ".join(f"M{c['measure']}: <b>{c['figure']}</b>" for c in progression[:10])
            if len(progression) > 10:
                chord_str += "   •   ..."
            story.append(Paragraph("Detected Chord Progression (Lead Sheet Harmony)", section_heading))
            chord_box = Table([[Paragraph(chord_str, meta_style)]], colWidths=[540])
            chord_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#ede9fe")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#c4b5fd")),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(chord_box)
            story.append(Spacer(1, 12))

        # Visual Staff Score Notation Preview (Vector Drawing)
        story.append(Paragraph("Musical Notation Preview", section_heading))
        
        # Draw vector musical staff preview
        d = Drawing(540, 140)
        # Background canvas
        d.add(Rect(0, 0, 540, 140, fillColor=colors.HexColor("#ffffff"), strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=1, rx=4, ry=4))
        
        # Staff lines (5 lines for Treble)
        staff_top_y = 100
        for i in range(5):
            y_pos = staff_top_y - (i * 8)
            d.add(Line(20, y_pos, 520, y_pos, strokeColor=colors.HexColor("#475569"), strokeWidth=1))

        # Clef marker text & Time signature
        d.add(String(28, staff_top_y - 26, "𝄞", fontName="Helvetica-Bold", fontSize=26, fillColor=colors.HexColor("#0f172a")))
        d.add(String(55, staff_top_y - 12, time_signature.split('/')[0], fontName="Helvetica-Bold", fontSize=13, fillColor=colors.HexColor("#0f172a")))
        d.add(String(55, staff_top_y - 28, time_signature.split('/')[1], fontName="Helvetica-Bold", fontSize=13, fillColor=colors.HexColor("#0f172a")))

        # Bar lines
        for bar_x in [190, 310, 430, 520]:
            d.add(Line(bar_x, staff_top_y, bar_x, staff_top_y - 32, strokeColor=colors.HexColor("#64748b"), strokeWidth=1.5))
        # End bar line
        d.add(Line(516, staff_top_y, 516, staff_top_y - 32, strokeColor=colors.HexColor("#64748b"), strokeWidth=3))

        # Sample transcribed notes rendering
        sample_notes = note_events[:14]
        note_x_start = 85
        spacing = (490 - note_x_start) / max(1, len(sample_notes))
        for idx, n in enumerate(sample_notes):
            nx = note_x_start + (idx * spacing)
            # Map MIDI pitch (e.g. 60 C4 -> y_pos)
            pitch_offset = (n["pitch"] - 60) * 2.2
            ny = staff_top_y - 28 + pitch_offset
            ny = max(staff_top_y - 45, min(staff_top_y + 15, ny))

            # Note head (oval)
            d.add(Circle(nx, ny, 3.8, fillColor=colors.HexColor("#0f172a"), strokeColor=colors.HexColor("#0f172a")))
            # Note stem
            d.add(Line(nx + 3.5, ny, nx + 3.5, ny + 20, strokeColor=colors.HexColor("#0f172a"), strokeWidth=1.2))
            # Note name label
            note_name = n.get("name") or pretty_midi.note_number_to_name(n["pitch"])
            d.add(String(nx - 4, staff_top_y - 42, note_name, fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#64748b")))

            # Lyric label below notehead
            if n.get("lyric"):
                d.add(String(nx - 6, staff_top_y - 54, str(n["lyric"])[:8], fontName="Helvetica-Bold", fontSize=7.5, fillColor=colors.HexColor("#8b5cf6")))

        # Bass staff (if grand staff)
        if clef_mode == "grand_staff":
            bass_top_y = 50
            for i in range(5):
                y_pos = bass_top_y - (i * 8)
                d.add(Line(20, y_pos, 520, y_pos, strokeColor=colors.HexColor("#475569"), strokeWidth=1))
            d.add(String(28, bass_top_y - 25, "𝄢", fontName="Helvetica-Bold", fontSize=22, fillColor=colors.HexColor("#0f172a")))
            d.add(String(55, bass_top_y - 12, time_signature.split('/')[0], fontName="Helvetica-Bold", fontSize=13, fillColor=colors.HexColor("#0f172a")))
            d.add(String(55, bass_top_y - 28, time_signature.split('/')[1], fontName="Helvetica-Bold", fontSize=13, fillColor=colors.HexColor("#0f172a")))
            for bar_x in [190, 310, 430, 520]:
                d.add(Line(bar_x, bass_top_y, bar_x, bass_top_y - 32, strokeColor=colors.HexColor("#64748b"), strokeWidth=1.5))
            d.add(Line(516, bass_top_y, 516, bass_top_y - 32, strokeColor=colors.HexColor("#64748b"), strokeWidth=3))

        # 6-Line Guitar Tablature Section (If Guitar TAB or Dual TAB)
        if clef_mode in ["guitar_tab", "dual_tab"]:
            tab_notes = GuitarTabEngine.optimize_tablature(note_events)
            ascii_tab = GuitarTabEngine.generate_ascii_tab(tab_notes, bpm, time_signature)
            story.append(Paragraph("6-String Guitar Tablature (Standard Tuning E-A-D-G-B-E)", section_heading))
            
            tab_style = ParagraphStyle(
                'TabMonospace',
                parent=styles['Normal'],
                fontName='Courier',
                fontSize=8,
                leading=10,
                textColor=colors.HexColor("#0f172a")
            )
            tab_p = Paragraph(f"<pre>{ascii_tab.replace(chr(10), '<br/>')}</pre>", tab_style)
            tab_box = Table([[tab_p]], colWidths=[540])
            tab_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(tab_box)
            story.append(Spacer(1, 12))

        story.append(d)
        story.append(Spacer(1, 14))

        # Singing Lyrics Transcript (If any lyrics present)
        lyric_notes = [n for n in note_events if n.get("lyric")]
        if lyric_notes:
            story.append(Paragraph("Vocal Lyrics & Syllable Transcript", section_heading))
            full_lyrics_text = " ".join([str(n["lyric"]) for n in lyric_notes])
            story.append(Paragraph(f"<i>&ldquo;{full_lyrics_text}&rdquo;</i>", styles['Normal']))
            story.append(Spacer(1, 10))

        # Transcribed Note Events Table
        story.append(Paragraph("Transcribed Notes Summary", section_heading))
        table_rows = [
            ["#", "Note Name", "MIDI Pitch", "Start (s)", "Duration (s)", "Lyric Word", "Velocity"]
        ]
        
        for i, n in enumerate(note_events[:30]):  # Show up to first 30 notes in summary table
            note_name = n.get("name") or pretty_midi.note_number_to_name(n["pitch"])
            lyric_str = str(n.get("lyric", "-")) if n.get("lyric") else "-"
            table_rows.append([
                str(i + 1),
                note_name,
                str(n["pitch"]),
                f"{n['start']:.2f}",
                f"{n['duration']:.2f}",
                lyric_str,
                str(n["velocity"])
            ])

        if len(note_events) > 30:
            table_rows.append(["...", f"Total {len(note_events)} notes transcribed", "...", "...", "...", "...", "..."])

        note_table = Table(table_rows, colWidths=[30, 85, 85, 85, 85, 85, 85])
        note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#ffffff")),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8.5),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(note_table)

        doc.build(story)
        return output_path

    @classmethod
    def save_multitrack_midi(cls, tracks: Dict[str, Dict[str, Any]], bpm: float, output_path: str) -> str:
        """
        Creates a standard Type 1 Multi-Track MIDI file with separate tracks for Lead, Harmony, Bass, and Drums.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        pm = pretty_midi.PrettyMIDI(initial_tempo=bpm)

        # Instrument Program mapping
        inst_map = {
            "lead": (73, "Flute / Lead", False),        # General MIDI Flute
            "harmony": (0, "Piano / Harmony", False),    # Acoustic Grand Piano
            "bass": (33, "Electric Bass", False),        # Electric Bass
            "drums": (0, "Drums / Percussion", True)     # Drum channel (is_drum=True)
        }

        for track_id, track_data in tracks.items():
            notes_list = track_data.get("notes", [])
            if not notes_list:
                continue

            prog_num, track_name, is_drum = inst_map.get(track_id, (0, track_id.title(), False))
            instrument_obj = pretty_midi.Instrument(program=prog_num, is_drum=is_drum, name=track_name)

            for n_item in notes_list:
                start = float(n_item["start"])
                end = float(n_item["end"])
                pitch = int(n_item["pitch"])
                velocity = int(n_item.get("velocity", 80))

                if end > start:
                    midi_note = pretty_midi.Note(
                        velocity=velocity,
                        pitch=pitch,
                        start=start,
                        end=end
                    )
                    instrument_obj.notes.append(midi_note)

            pm.instruments.append(instrument_obj)

        pm.write(output_path)
        return output_path

    @classmethod
    def generate_multitrack_pdf_report(
        cls,
        output_path: str,
        title: str,
        composer: str,
        bpm: float,
        key_signature: str,
        time_signature: str,
        tracks: Dict[str, Dict[str, Any]]
    ) -> str:
        """
        Generates an Orchestral / Multi-Track Conductor Score PDF with breakdown of each separated instrument track.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'ScoreTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0f172a"),
            alignment=1
        )

        subtitle_style = ParagraphStyle(
            'ScoreSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#64748b"),
            alignment=1
        )

        meta_style = ParagraphStyle(
            'ScoreMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#334155")
        )

        section_heading = ParagraphStyle(
            'SectionHead',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=12,
            spaceAfter=6
        )

        story = []

        # Header Title
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"Conductor's Multi-Track Score • AI Separated & Transcribed by Music-Decoder", subtitle_style))
        story.append(Spacer(1, 14))

        # Metadata Box
        meta_data = [
            [
                Paragraph(f"<b>Key:</b> {key_signature}", meta_style),
                Paragraph(f"<b>Tempo:</b> {round(bpm)} BPM", meta_style),
                Paragraph(f"<b>Time Signature:</b> {time_signature}", meta_style),
                Paragraph(f"<b>Tracks:</b> {len(tracks)} Instrument Staves", meta_style),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[130, 130, 130, 150])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # Harmonic Chord Progression across Staves
        all_orch_notes = []
        for t_info in tracks.values():
            all_orch_notes.extend(t_info.get("notes", []))
        all_orch_notes.sort(key=lambda x: x.get("start", 0))

        mt_progression = ChordDetector.analyze_chords_by_measure(all_orch_notes, bpm, time_signature)
        if mt_progression:
            chord_str = "   •   ".join(f"M{c['measure']}: <b>{c['figure']}</b>" for c in mt_progression[:10])
            if len(mt_progression) > 10:
                chord_str += "   •   ..."
            story.append(Paragraph("Detected Master Harmonic Chord Progression", section_heading))
            chord_box = Table([[Paragraph(chord_str, meta_style)]], colWidths=[540])
            chord_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#ede9fe")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#c4b5fd")),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(chord_box)
            story.append(Spacer(1, 12))

        # Track Summary Table
        story.append(Paragraph("Orchestral Instrument Staves Summary", section_heading))
        track_rows = [
            ["Track", "Instrument Name", "Clef", "Total Notes", "Pitch Range"]
        ]

        clef_display = {
            "lead": "Treble Clef (𝄞)",
            "harmony": "Treble / Grand Staff (𝄞 / 𝄢)",
            "bass": "Bass Clef (𝄢)",
            "drums": "Percussion Clef (𝄥)"
        }

        for track_id, track_info in tracks.items():
            t_notes = track_info.get("notes", [])
            if t_notes:
                p_min = min(n["pitch"] for n in t_notes)
                p_max = max(n["pitch"] for n in t_notes)
                n_min = next(n["name"] for n in t_notes if n["pitch"] == p_min)
                n_max = next(n["name"] for n in t_notes if n["pitch"] == p_max)
                range_str = f"{n_min} ({p_min}) → {n_max} ({p_max})"
            else:
                range_str = "N/A"

            track_rows.append([
                track_id.upper(),
                track_info.get("name", track_id.title()),
                clef_display.get(track_id, "Treble Clef"),
                str(len(t_notes)),
                range_str
            ])

        t_table = Table(track_rows, colWidths=[65, 160, 145, 75, 95])
        t_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#ffffff")),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_table)
        story.append(Spacer(1, 14))

        # Sample Note Events Table
        story.append(Paragraph("Selected Note Events across Staves", section_heading))
        note_rows = [
            ["Track", "Note Name", "MIDI Pitch", "Start (s)", "Duration (s)", "Velocity"]
        ]

        all_sample_notes = []
        for track_id, track_info in tracks.items():
            for n in track_info.get("notes", [])[:10]:
                all_sample_notes.append((track_id, n))

        all_sample_notes.sort(key=lambda x: x[1]["start"])

        for tr_id, n in all_sample_notes[:35]:
            note_rows.append([
                tr_id.upper(),
                n["name"],
                str(n["pitch"]),
                f"{n['start']:.2f}",
                f"{n['duration']:.2f}",
                str(n.get("velocity", 80))
            ])

        if len(all_sample_notes) > 35:
            note_rows.append(["...", "...", "...", "...", "...", "..."])

        notes_table = Table(note_rows, colWidths=[65, 95, 95, 95, 95, 95])
        notes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#ffffff")),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8.5),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(notes_table)

        doc.build(story)
        return output_path

