import React, { useState } from 'react';
import { Play, Search, Music, Activity, Hash, BarChart3 } from 'lucide-react';
import type { TranscriptionResult } from '../types';
import { synth } from '../services/synth';

interface NotesTableProps {
  result: TranscriptionResult;
}

export const NotesTable: React.FC<NotesTableProps> = ({ result }) => {
  const [search, setSearch] = useState('');
  const notes = result.notes || [];

  const minPitchNote = notes.length > 0 ? notes.reduce((prev, curr) => (curr.pitch < prev.pitch ? curr : prev)) : null;
  const maxPitchNote = notes.length > 0 ? notes.reduce((prev, curr) => (curr.pitch > prev.pitch ? curr : prev)) : null;

  const filteredNotes = notes.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.pitch.toString().includes(search)
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

      {/* Note List Table */}
      <div className="glass-panel" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Transcribed Note Events Stream
          </h3>

          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search note name (e.g. C4, F#5)..."
              className="input-control"
              style={{ paddingLeft: 30, fontSize: '0.8rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>#</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Note Name</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>MIDI Pitch</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Start Time</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Duration</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Velocity</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' }}>Audition</th>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 50,
                        height: 6,
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(n.velocity / 127) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(to right, #8b5cf6, #06b6d4)'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{n.velocity}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => synth.playNote(n.pitch, n.velocity, Math.max(0.2, n.duration))}
                      title="Play note sound"
                    >
                      <Play size={12} fill="#06b6d4" color="#06b6d4" />
                    </button>
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
