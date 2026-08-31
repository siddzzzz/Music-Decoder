import React, { useState } from 'react';
import { X, Volume2, Trash2, Check, Music } from 'lucide-react';
import type { NoteEvent } from '../types';
import { soundfontService } from '../services/soundfont';

interface NoteEditorModalProps {
  note: NoteEvent | null;
  onSave: (updatedNote: NoteEvent) => void;
  onDelete: (deletedNote: NoteEvent) => void;
  onClose: () => void;
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(pitch: number): string {
  const noteName = PITCH_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${noteName}${octave}`;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  note,
  onSave,
  onDelete,
  onClose,
}) => {
  if (!note) return null;

  const [pitch, setPitch] = useState(note.pitch);
  const [start, setStart] = useState(note.start);
  const [duration, setDuration] = useState(note.duration);
  const [velocity, setVelocity] = useState(note.velocity || 80);

  const handleAudition = () => {
    soundfontService.playNote(pitch, duration, velocity);
  };

  const handlePitchChange = (delta: number) => {
    const next = Math.max(21, Math.min(108, pitch + delta));
    setPitch(next);
    soundfontService.playNote(next, 0.4, velocity);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: NoteEvent = {
      ...note,
      pitch,
      name: midiToName(pitch),
      start: parseFloat(start.toFixed(3)),
      duration: parseFloat(duration.toFixed(3)),
      end: parseFloat((start + duration).toFixed(3)),
      velocity,
    };
    onSave(updated);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(139, 92, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Music size={18} color="#c4b5fd" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Edit Musical Note
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Adjust pitch, duration, or delete false transients
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: 6, borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pitch Editor Card */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Note Pitch</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                  {midiToName(pitch)}
                </span>
                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  (MIDI {pitch})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => handlePitchChange(-1)}
              >
                -1
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => handlePitchChange(1)}
              >
                +1
              </button>
              <button
                type="button"
                className="btn btn-cyan"
                style={{ padding: '6px 10px' }}
                onClick={handleAudition}
                title="Audition Note"
              >
                <Volume2 size={16} />
              </button>
            </div>
          </div>

          {/* Timing & Duration Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Start Time (s)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={start}
                onChange={(e) => setStart(Math.max(0, parseFloat(e.target.value) || 0))}
                className="input-field"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Duration (s)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.05, parseFloat(e.target.value) || 0.1))}
                className="input-field"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          {/* Velocity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Note Velocity (Dynamics)</label>
              <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {velocity} / 127
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="127"
              value={velocity}
              onChange={(e) => setVelocity(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              onClick={() => onDelete(note)}
            >
              <Trash2 size={14} />
              <span>Delete Note</span>
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                <Check size={14} />
                <span>Save Edit</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
