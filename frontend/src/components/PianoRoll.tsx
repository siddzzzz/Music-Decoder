import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import type { TranscriptionResult, NoteEvent } from '../types';
import { synth } from '../services/synth';

interface PianoRollProps {
  result: TranscriptionResult;
}

export const PianoRoll: React.FC<PianoRollProps> = ({ result }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNote, setHoveredNote] = useState<NoteEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);

  const notes = result.notes || [];
  const duration = Math.max(1, result.duration || 10);
  const playTimerRef = useRef<number | null>(null);
  const playedNoteIndicesRef = useRef<Set<number>>(new Set());

  // Compute pitch range
  const minPitch = notes.length > 0 ? Math.max(21, Math.min(...notes.map(n => n.pitch)) - 3) : 48;
  const maxPitch = notes.length > 0 ? Math.min(108, Math.max(...notes.map(n => n.pitch)) + 3) : 84;
  const pitchCount = Math.max(12, maxPitch - minPitch + 1);

  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Playback timer
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      synth.stopAll();
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
        synth.stopAll();
        return;
      }

      notes.forEach((note, idx) => {
        if (!playedNoteIndicesRef.current.has(idx)) {
          if (elapsedSec >= note.start && elapsedSec <= note.start + 0.08) {
            playedNoteIndicesRef.current.add(idx);
            synth.playNote(note.pitch, note.velocity, note.duration);
          }
        }
      });
    }, 25);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      synth.stopAll();
    };
  }, [isPlaying, duration, notes]);

  const handleTogglePlay = () => {
    setIsPlaying(p => !p);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadTime(0);
    playedNoteIndicesRef.current.clear();
    synth.stopAll();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const keyboardWidth = 55;
    const rollWidth = width - keyboardWidth;
    const noteHeight = height / pitchCount;

    // Clear background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid & Piano Keys
    for (let p = minPitch; p <= maxPitch; p++) {
      const pitchIdx = maxPitch - p;
      const y = pitchIdx * noteHeight;
      const noteInOctave = p % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(noteInOctave);
      const octave = Math.floor(p / 12) - 1;
      const name = `${keyNames[noteInOctave]}${octave}`;

      // Row background
      ctx.fillStyle = isBlackKey ? 'rgba(15, 23, 42, 0.6)' : 'rgba(30, 41, 59, 0.25)';
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

    // Draw Vertical Beat Lines
    const beatInterval = 60.0 / result.tempo;
    const totalBeats = Math.ceil(duration / beatInterval);
    for (let b = 0; b <= totalBeats; b++) {
      const beatTime = b * beatInterval;
      const x = keyboardWidth + (beatTime / duration) * rollWidth;
      const isMeasure = b % 4 === 0;

      ctx.strokeStyle = isMeasure ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = isMeasure ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMeasure && x < width - 20) {
        ctx.fillStyle = '#c4b5fd';
        ctx.font = '10px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`M${(b / 4) + 1}`, x + 4, 14);
      }
    }

    // Draw Transcribed Notes
    notes.forEach((note) => {
      if (note.pitch < minPitch || note.pitch > maxPitch) return;

      const pitchIdx = maxPitch - note.pitch;
      const y = pitchIdx * noteHeight + 1;
      const x = keyboardWidth + (note.start / duration) * rollWidth;
      const w = Math.max(4, (note.duration / duration) * rollWidth);
      const h = noteHeight - 2;

      const isHovered = hoveredNote === note;
      const isCurrentlyPlaying = isPlaying && playheadTime >= note.start && playheadTime <= note.end;

      // Note Color based on velocity
      const hue = 260 + (note.velocity / 127) * 40;
      if (isCurrentlyPlaying) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
      } else if (isHovered) {
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.85)`;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isCurrentlyPlaying ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (w > 20) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(note.name, x + 4, y + (h / 2) + 3);
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
      ctx.arc(playheadX, 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [result, notes, minPitch, maxPitch, pitchCount, hoveredNote, isPlaying, playheadTime, duration]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const keyboardWidth = 55;
    const rollWidth = canvas.width - keyboardWidth;
    const noteHeight = canvas.height / pitchCount;

    if (x < keyboardWidth) {
      setHoveredNote(null);
      return;
    }

    const mouseTime = ((x - keyboardWidth) / rollWidth) * duration;
    const mousePitchIdx = Math.floor(y / noteHeight);
    const mousePitch = maxPitch - mousePitchIdx;

    const matched = notes.find(n => n.pitch === mousePitch && mouseTime >= n.start && mouseTime <= n.end);
    setHoveredNote(matched || null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const keyboardWidth = 55;
    const rollWidth = canvas.width - keyboardWidth;
    const noteHeight = canvas.height / pitchCount;

    if (x <= keyboardWidth) {
      const pitchIdx = Math.floor(y / noteHeight);
      const clickedPitch = maxPitch - pitchIdx;
      synth.playNote(clickedPitch, 90, 0.4);
    } else {
      const seekTime = ((x - keyboardWidth) / rollWidth) * duration;
      setPlayheadTime(seekTime);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Interactive Neural Piano Roll
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Showing {notes.length} polyphonic note events • Click keys on the left to audition
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

        {hoveredNote && (
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
          </div>
        )}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <canvas
          ref={canvasRef}
          width={1100}
          height={420}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredNote(null)}
          onClick={handleCanvasClick}
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
