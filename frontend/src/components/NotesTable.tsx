import React, { useState } from 'react';
import { Play, Search, Music, Activity, Hash, BarChart3, Edit3, Trash2 } from 'lucide-react';
import type { TranscriptionResult, NoteEvent } from '../types';
import { soundfontService } from '../services/soundfont';

interface NotesTableProps {
  result: TranscriptionResult;
  onEditNote?: (note: NoteEvent) => void;
  onDeleteNote?: (note: NoteEvent) => void;
}

export const NotesTable: React.FC<NotesTableProps> = ({
  result,
  onEditNote,
  onDeleteNote
}) => {
  const [search, setSearch] = useState('');
  const notes = result.notes || [];

  const minPitchNote = notes.length > 0 ? notes.reduce((prev, curr) => (curr.pitch < prev.pitch ? curr : prev)) : null;
  const maxPitchNote = notes.length > 0 ? notes.reduce((prev, curr) => (curr.pitch > prev.pitch ? curr : prev)) : null;

  const filteredNotes = notes.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.pitch.toString().includes(search) ||
    (n.track && n.track.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Metric Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14
      }}>
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 6 }}>
            <Hash size={14} color="#8b5cf6" />
            <span>Total Transcribed Notes</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {result.notes_count}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 6 }}>
            <Music size={14} color="#06b6d4" />
            <span>Pitch Range</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {minPitchNote ? `${minPitchNote.name} → ${maxPitchNote?.name}` : 'N/A'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 6 }}>
            <Activity size={14} color="#10b981" />
            <span>Key & Tonality</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {result.key.display}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>
            {Math.round(result.key.confidence * 100)}% confidence
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 6 }}>
            <BarChart3 size={14} color="#f59e0b" />
            <span>Tempo / Meter</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {result.tempo} BPM
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Meter: {result.time_signature}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Transcribed Note Events Stream
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Click any note row to edit or delete false positive transients
            </p>
          </div>

          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search note (e.g. C4, lead)..."
              className="input-control"
              style={{
                paddingLeft: 30,
                fontSize: '0.8rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                color: '#ffffff',
                width: '100%',
                paddingTop: 6,
                paddingBottom: 6
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>#</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Note Name</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>MIDI Pitch</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Start Time</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Duration</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Track / Staff</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((n, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')}
                >
                  <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: '#c4b5fd' }}>{n.name}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{n.pitch}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)' }}>{n.start.toFixed(2)}s</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)' }}>{n.duration.toFixed(2)}s</td>
                  <td style={{ padding: '8px 14px' }}>
                    {n.track ? (
                      <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>
                        {n.track.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Master</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {/* Play Sound */}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => soundfontService.playNote(n.pitch, Math.max(0.2, n.duration), n.velocity)}
                        title="Audition note"
                      >
                        <Play size={12} fill="#06b6d4" color="#06b6d4" />
                      </button>

                      {/* Edit Note */}
                      {onEditNote && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => onEditNote(n)}
                          title="Edit note"
                        >
                          <Edit3 size={12} color="#a855f7" />
                        </button>
                      )}

                      {/* Delete Note */}
                      {onDeleteNote && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)' }}
                          onClick={() => onDeleteNote(n)}
                          title="Delete note"
                        >
                          <Trash2 size={12} color="#f87171" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
