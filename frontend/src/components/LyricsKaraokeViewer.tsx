import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square, Mic2, Sparkles, Check, Edit3, Volume2 } from 'lucide-react';
import type { TranscriptionResult, LyricWord } from '../types';
import { soundfontService } from '../services/soundfont';

interface LyricsKaraokeViewerProps {
  result: TranscriptionResult;
  onUpdateNoteLyric?: (noteIndex: number, newLyric: string) => void;
  onApplyEdits?: () => void;
}

export const LyricsKaraokeViewer: React.FC<LyricsKaraokeViewerProps> = ({
  result,
  onUpdateNoteLyric,
  onApplyEdits
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const notes = result.notes || [];
  const lyricsList: LyricWord[] = result.lyrics && result.lyrics.length > 0
    ? result.lyrics
    : notes.filter(n => n.lyric).map(n => ({
        word: n.lyric!,
        start: n.start,
        end: n.end,
        confidence: 0.95,
        note_pitch: n.pitch
      }));

  const duration = Math.max(1, result.duration || 10);
  const playTimerRef = useRef<number | null>(null);
  const playedIndicesRef = useRef<Set<number>>(new Set());

  // Playback timer
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      soundfontService.stop();
      return;
    }

    playedIndicesRef.current.clear();
    const startTime = performance.now() - (currentTime * 1000);

    playTimerRef.current = window.setInterval(() => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      setCurrentTime(elapsedSec);

      if (elapsedSec >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        soundfontService.stop();
        return;
      }

      notes.forEach((n, idx) => {
        if (!playedIndicesRef.current.has(idx)) {
          if (elapsedSec >= n.start && elapsedSec <= n.start + 0.08) {
            playedIndicesRef.current.add(idx);
            soundfontService.playNote(n.pitch, n.duration, n.velocity);
          }
        }
      });
    }, 25);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      soundfontService.stop();
    };
  }, [isPlaying, currentTime, duration, notes]);

  // Find active lyric word at currentTime
  const activeWordIndex = lyricsList.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end + 0.15
  );

  const handleStartEdit = (idx: number, currentWord: string) => {
    setEditingIndex(idx);
    setEditingText(currentWord);
  };

  const handleSaveEdit = (idx: number) => {
    if (onUpdateNoteLyric) {
      onUpdateNoteLyric(idx, editingText);
    }
    setEditingIndex(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Karaoke Master Header */}
      <div className="glass-panel" style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(236, 72, 153, 0.45)'
          }}>
            <Mic2 size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              AI Vocal Lyrics Alignment & Karaoke Sing-Along
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Neural Speech Recognition (faster-whisper on CUDA) • Note-Syllable Synchronization
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setIsPlaying(p => !p)}
            style={{ padding: '7px 18px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Play Karaoke'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => { setIsPlaying(false); setCurrentTime(0); }}
            style={{ padding: '7px 12px' }}
            title="Stop & Rewind"
          >
            <Square size={14} />
          </button>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            padding: '6px 12px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            color: '#f472b6'
          }}>
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Live Karaoke Glowing Teleprompter Box */}
      <div className="glass-panel glow-purple" style={{
        padding: '36px 32px',
        borderRadius: 20,
        background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        textAlign: 'center',
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        border: '1px solid rgba(236, 72, 153, 0.3)'
      }}>
        {lyricsList.length > 0 ? (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px 14px',
            maxWidth: 880,
            lineHeight: 1.6
          }}>
            {lyricsList.map((w, idx) => {
              const isActive = activeWordIndex === idx;
              const isPast = currentTime > w.end;

              return (
                <span
                  key={idx}
                  onClick={() => {
                    setCurrentTime(w.start);
                    if (!isPlaying) setIsPlaying(true);
                  }}
                  style={{
                    fontSize: isActive ? '1.85rem' : '1.4rem',
                    fontWeight: isActive ? 900 : (isPast ? 600 : 500),
                    color: isActive ? '#f472b6' : (isPast ? '#e2e8f0' : 'rgba(148, 163, 184, 0.6)'),
                    textShadow: isActive ? '0 0 20px rgba(244, 114, 182, 0.8), 0 0 40px rgba(168, 85, 247, 0.6)' : 'none',
                    transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '2px 6px',
                    borderRadius: 8,
                    background: isActive ? 'rgba(236, 72, 153, 0.18)' : 'transparent'
                  }}
                  title={`Start: ${w.start}s - Click to jump`}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            No vocal lyrics detected in this track. Audio may be purely instrumental or melody without singing.
          </div>
        )}
      </div>

      {/* Note-Syllable Alignment Stream Table */}
      <div className="glass-panel" style={{ padding: 22, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Note-to-Word Melodic Alignment Stream
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Each vocal note mapped to its sung lyric word. Click pencil to correct lyrics.
            </p>
          </div>

          {onApplyEdits && (
            <button
              className="btn btn-primary"
              onClick={onApplyEdits}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Sparkles size={14} />
              <span>Update Score MusicXML</span>
            </button>
          )}
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
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Sung Lyric Word</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' }}>Audition</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(236, 72, 153, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')}
                >
                  <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: '#c4b5fd' }}>{n.name}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{n.pitch}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)' }}>{n.start.toFixed(2)}s</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)' }}>{n.duration.toFixed(2)}s</td>
                  <td style={{ padding: '8px 14px' }}>
                    {editingIndex === idx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(idx)}
                          autoFocus
                          style={{
                            padding: '3px 8px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid #ec4899',
                            borderRadius: 6,
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            width: 110
                          }}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '3px 6px' }}
                          onClick={() => handleSaveEdit(idx)}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {n.lyric ? (
                          <span style={{
                            padding: '3px 10px',
                            background: 'rgba(236, 72, 153, 0.16)',
                            border: '1px solid rgba(236, 72, 153, 0.35)',
                            borderRadius: 6,
                            color: '#f472b6',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}>
                            {n.lyric}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          onClick={() => handleStartEdit(idx, n.lyric || '')}
                          title="Edit lyric word"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => soundfontService.playNote(n.pitch, Math.max(0.2, n.duration), n.velocity)}
                      title="Audition vocal pitch"
                    >
                      <Volume2 size={12} color="#06b6d4" />
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
