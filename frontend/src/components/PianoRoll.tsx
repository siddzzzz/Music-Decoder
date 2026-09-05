import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import type { TranscriptionResult, NoteEvent } from '../types';
import { soundfontService } from '../services/soundfont';

interface PianoRollProps {
  result: TranscriptionResult;
  onEditNote?: (note: NoteEvent) => void;
  onAddNote?: (newNote: NoteEvent) => void;
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(pitch: number): string {
  const noteName = PITCH_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${noteName}${octave}`;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  result,
  onEditNote,
  onAddNote
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNote, setHoveredNote] = useState<NoteEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);

  const notes = result.notes || [];
  const chords = result.chords || [];
  const duration = Math.max(1, result.duration || 10);
  const playTimerRef = useRef<number | null>(null);
  const playedNoteIndicesRef = useRef<Set<number>>(new Set());

  // Compute pitch range
  const minPitch = notes.length > 0 ? Math.max(21, Math.min(...notes.map(n => n.pitch)) - 3) : 48;
  const maxPitch = notes.length > 0 ? Math.min(108, Math.max(...notes.map(n => n.pitch)) + 3) : 84;
  const pitchCount = Math.max(12, maxPitch - minPitch + 1);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      soundfontService.stop();
      return;
    }

    playedNoteIndicesRef.current.clear();
    const startTime = performance.now() - (playheadTime * 1000);

    playTimerRef.current = window.setInterval(() => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      setPlayheadTime(elapsedSec);

      if (elapsedSec >= duration) {
        setIsPlaying(false);
        setPlayheadTime(0);
        soundfontService.stop();
        return;
      }

      notes.forEach((note, idx) => {
        if (!playedNoteIndicesRef.current.has(idx)) {
          if (elapsedSec >= note.start && elapsedSec <= note.start + 0.08) {
            playedNoteIndicesRef.current.add(idx);
            soundfontService.playNote(note.pitch, note.duration, note.velocity);
          }
        }
      });
    }, 25);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      soundfontService.stop();
    };
  }, [isPlaying, playheadTime, duration, notes]);

  const handleTogglePlay = () => {
    setIsPlaying(p => !p);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadTime(0);
    soundfontService.stop();
  };

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const keyboardWidth = 55;
    const chordHeaderHeight = 24;
    const rollHeight = height - chordHeaderHeight;
    const rollWidth = width - keyboardWidth;
    const noteHeight = rollHeight / pitchCount;

    // Clear canvas
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Draw Chord Header Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, chordHeaderHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, chordHeaderHeight);
    ctx.lineTo(width, chordHeaderHeight);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CHORDS', 8, 16);

    // Draw Piano Keys and Horizontal Grid
    for (let i = 0; i < pitchCount; i++) {
      const pitch = maxPitch - i;
      const y = chordHeaderHeight + i * noteHeight;
      const pc = pitch % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(pc);
      const name = midiToName(pitch);

      // Horizontal note row background
      ctx.fillStyle = isBlackKey ? 'rgba(15, 23, 42, 0.7)' : 'rgba(30, 41, 59, 0.3)';
      ctx.fillRect(keyboardWidth, y, rollWidth, noteHeight);

      // Horizontal grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(keyboardWidth, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Keyboard key on the left
      ctx.fillStyle = isBlackKey ? '#1e293b' : '#f8fafc';
      ctx.fillRect(0, y + 1, keyboardWidth - 2, noteHeight - 2);

      // Key Label
      ctx.fillStyle = isBlackKey ? '#94a3b8' : '#0f172a';
      ctx.font = '10px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(name, keyboardWidth - 6, y + (noteHeight / 2) + 3);
    }

    // Draw Vertical Beat Lines & Measure Chords
    const beatInterval = 60.0 / result.tempo;
    const totalBeats = Math.ceil(duration / beatInterval);
    for (let b = 0; b <= totalBeats; b++) {
      const beatTime = b * beatInterval;
      const x = keyboardWidth + (beatTime / duration) * rollWidth;
      const isMeasure = b % 4 === 0;
      const measureNum = Math.floor(b / 4) + 1;

      ctx.strokeStyle = isMeasure ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = isMeasure ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMeasure) {
        // Measure label
        ctx.fillStyle = '#64748b';
        ctx.font = '9px var(--font-mono)';
        ctx.textAlign = 'left';
        ctx.fillText(`M${measureNum}`, x + 4, 16);

        // Find chord for this measure
        const matchChord = chords.find(c => c.measure === measureNum);
        if (matchChord) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 11px Outfit, sans-serif';
          ctx.fillText(matchChord.figure, x + 24, 16);
        }
      }
    }

    // Draw Transcribed Notes
    notes.forEach((note) => {
      if (note.pitch < minPitch || note.pitch > maxPitch) return;

      const pitchIdx = maxPitch - note.pitch;
      const y = chordHeaderHeight + pitchIdx * noteHeight + 1;
      const x = keyboardWidth + (note.start / duration) * rollWidth;
      const w = Math.max(4, (note.duration / duration) * rollWidth);
      const h = noteHeight - 2;

      const isHovered = hoveredNote === note;
      const isCurrentlyPlaying = isPlaying && playheadTime >= note.start && playheadTime <= note.end;

      // Note Color based on voice, track or velocity
      const trackColors: Record<string, string> = {
        lead: '#06b6d4',
        harmony: '#a855f7',
        bass: '#10b981',
        drums: '#f59e0b'
      };

      if (isCurrentlyPlaying) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 14;
      } else if (isHovered) {
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
      } else if (note.voice === 2) {
        ctx.fillStyle = '#06b6d4'; // Voice 2 (Stems Down)
        ctx.shadowBlur = 0;
      } else if (note.voice === 1 && notes.some(n => n.voice === 2)) {
        ctx.fillStyle = '#f59e0b'; // Voice 1 (Stems Up)
        ctx.shadowBlur = 0;
      } else if (note.track && trackColors[note.track]) {
        ctx.fillStyle = trackColors[note.track];
        ctx.shadowBlur = 0;
      } else {
        const hue = 260 + (note.velocity / 127) * 40;
        ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.85)`;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Note Name & Voice Stem Icon inside note rectangle
      if (w > 22 && h > 9) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Outfit, sans-serif';
        ctx.textAlign = 'left';
        const voiceSymbol = note.voice === 2 ? ' ↓' : (note.voice === 1 && notes.some(n => n.voice === 2) ? ' ↑' : '');
        ctx.fillText(`${note.name}${voiceSymbol}`, x + 3, y + (h / 2) + 3);
      }
    });

    // Draw Playhead scrubber line
    if (isPlaying || playheadTime > 0) {
      const playheadX = keyboardWidth + (playheadTime / duration) * rollWidth;
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(playheadX, chordHeaderHeight, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [result, notes, chords, minPitch, maxPitch, pitchCount, hoveredNote, isPlaying, playheadTime, duration]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const keyboardWidth = 55;
    const chordHeaderHeight = 24;
    const rollHeight = canvas.height - chordHeaderHeight;
    const rollWidth = canvas.width - keyboardWidth;
    const noteHeight = rollHeight / pitchCount;

    if (x < keyboardWidth || y < chordHeaderHeight) {
      setHoveredNote(null);
      return;
    }

    const mouseTime = ((x - keyboardWidth) / rollWidth) * duration;
    const mousePitchIdx = Math.floor((y - chordHeaderHeight) / noteHeight);
    const mousePitch = maxPitch - mousePitchIdx;

    const matched = notes.find(n => n.pitch === mousePitch && mouseTime >= n.start && mouseTime <= n.end);
    setHoveredNote(matched || null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const keyboardWidth = 55;
    const chordHeaderHeight = 24;
    const rollHeight = canvas.height - chordHeaderHeight;
    const rollWidth = canvas.width - keyboardWidth;
    const noteHeight = rollHeight / pitchCount;

    if (x <= keyboardWidth) {
      if (y >= chordHeaderHeight) {
        const pitchIdx = Math.floor((y - chordHeaderHeight) / noteHeight);
        const clickedPitch = maxPitch - pitchIdx;
        soundfontService.playNote(clickedPitch, 0.4, 90);
      }
      return;
    }

    if (hoveredNote && onEditNote) {
      onEditNote(hoveredNote);
      return;
    }

    const seekTime = ((x - keyboardWidth) / rollWidth) * duration;
    setPlayheadTime(seekTime);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onAddNote) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const keyboardWidth = 55;
    const chordHeaderHeight = 24;
    const rollHeight = canvas.height - chordHeaderHeight;
    const rollWidth = canvas.width - keyboardWidth;
    const noteHeight = rollHeight / pitchCount;

    if (x > keyboardWidth && y > chordHeaderHeight) {
      const clickTime = ((x - keyboardWidth) / rollWidth) * duration;
      const pitchIdx = Math.floor((y - chordHeaderHeight) / noteHeight);
      const pitchVal = maxPitch - pitchIdx;

      const newNote: NoteEvent = {
        pitch: pitchVal,
        name: midiToName(pitchVal),
        start: parseFloat(clickTime.toFixed(3)),
        duration: 0.5,
        end: parseFloat((clickTime + 0.5).toFixed(3)),
        velocity: 85
      };
      onAddNote(newNote);
      soundfontService.playNote(pitchVal, 0.4, 85);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Interactive Neural Piano Roll & Chord Track
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Click any note to edit/delete • Double-click empty canvas to insert notes • Click keys on the left to audition
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
            <button
              className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleTogglePlay}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause' : 'Play Roll'}</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleStop}
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              title="Stop"
            >
              <Square size={13} />
            </button>
          </div>
        </div>

        {hoveredNote ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-active)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)'
          }}>
            <span style={{ color: '#a855f7', fontWeight: 700 }}>{hoveredNote.name} (MIDI {hoveredNote.pitch})</span>
            <span style={{ color: 'var(--text-secondary)' }}>Start: {hoveredNote.start.toFixed(2)}s</span>
            <span style={{ color: 'var(--text-secondary)' }}>Dur: {hoveredNote.duration.toFixed(2)}s</span>
            <span style={{ color: '#06b6d4' }}>Vel: {hoveredNote.velocity}</span>
            <span style={{ color: '#f43f5e', fontSize: '0.72rem' }}>Click to Edit</span>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Double-click canvas to add note
          </div>
        )}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <canvas
          ref={canvasRef}
          width={1100}
          height={430}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredNote(null)}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          style={{
            display: 'block',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            cursor: 'crosshair',
            width: '100%',
            maxWidth: 1200
          }}
        />
      </div>
    </div>
  );
};
