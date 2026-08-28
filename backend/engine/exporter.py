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
        story.append(Spacer(1, 14))

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
            d.add(String(nx - 4, staff_top_y - 42, n["name"], fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#64748b")))

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

        story.append(d)
        story.append(Spacer(1, 14))

        # Transcribed Note Events Table
        story.append(Paragraph("Transcribed Notes Summary", section_heading))
        table_rows = [
            ["#", "Note Name", "MIDI Pitch", "Start (s)", "Duration (s)", "Velocity"]
        ]
        for i, n in enumerate(note_events[:30]):  # Show up to first 30 notes in summary table
            table_rows.append([
                str(i + 1),
                n["name"],
                str(n["pitch"]),
                f"{n['start']:.2f}",
                f"{n['duration']:.2f}",
                str(n["velocity"])
            ])

        if len(note_events) > 30:
            table_rows.append(["...", f"Total {len(note_events)} notes transcribed", "...", "...", "...", "..."])

        note_table = Table(table_rows, colWidths=[35, 100, 100, 100, 100, 105])
        note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#ffffff")),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(note_table)

        doc.build(story)
        return output_path
