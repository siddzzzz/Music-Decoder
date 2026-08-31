import React, { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Play, Pause, Square, ZoomIn, ZoomOut, Volume2, Gauge, Sparkles } from 'lucide-react';
import type { TranscriptionResult } from '../types';
import { soundfontService, type SoundfontInstrumentName } from '../services/soundfont';

interface ScoreViewerProps {
  result: TranscriptionResult;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ result }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [transpose, setTranspose] = useState(0);
  const [playMode, setPlayMode] = useState<'soundfont' | 'audio'>('soundfont');
  const [instrument, setInstrument] = useState<SoundfontInstrumentName>('acoustic_grand_piano');
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<number | null>(null);
  const playedNoteIndicesRef = useRef<Set<number>>(new Set());

  // Load selected SoundFont instrument
  useEffect(() => {
    soundfontService.setInstrument(instrument);
  }, [instrument]);

  // Initialize or re-render OSMD whenever result or transpose/zoom changes
  useEffect(() => {
    if (!containerRef.current || !result.musicxml) return;

    // Reset container
    containerRef.current.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true,
      drawPartNames: true,
      drawMeasureNumbers: true,
      drawMetronomeMarks: true,
      drawTimeSignatures: true,
      followCursor: true,
      backend: 'svg',
      drawingParameters: 'compact',
    });

    osmd.setLogLevel('warn');
    osmd.zoom = zoom;

    osmd.load(result.musicxml).then(() => {
      if (transpose !== 0 && (osmd as any).Sheet) {
        try {
          (osmd as any).Sheet.Transpose = transpose;
          osmd.updateGraphic();
        } catch (e) { /* ignore */ }
      }
      osmd.render();
      osmd.cursor.show();
      osmdRef.current = osmd;
    }).catch(err => {
      console.error('OSMD load error:', err);
    });

    return () => {
      if (osmdRef.current) {
        try {
          osmdRef.current.cursor?.hide();
        } catch (e) { /* ignore */ }
      }
    };
  }, [result.musicxml, zoom, transpose]);

  // Handle Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
      soundfontService.stop();
      return;
    }

    playedNoteIndicesRef.current.clear();
    const startTime = performance.now() - (currentTime * 1000 / playbackSpeed);

    // Audio element playback if mode is audio
    if (playMode === 'audio') {
      if (!audioRef.current) {
        audioRef.current = new Audio(result.exports.audio);
      }
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(() => {});
    }

    const intervalMs = 25;
    playTimerRef.current = window.setInterval(() => {
      const elapsedSec = ((performance.now() - startTime) / 1000) * playbackSpeed;
      setCurrentTime(elapsedSec);

      if (elapsedSec >= result.duration) {
        handleStop();
        return;
      }

      // Synthesize note events with authentic SoundFont
      if (playMode === 'soundfont') {
        result.notes.forEach((note, idx) => {
          if (!playedNoteIndicesRef.current.has(idx)) {
            if (elapsedSec >= note.start && elapsedSec <= note.start + 0.08) {
              playedNoteIndicesRef.current.add(idx);
              const transposedPitch = note.pitch + transpose;
              soundfontService.playNote(transposedPitch, note.duration / playbackSpeed, note.velocity);
            }
          }
        });
      }

      // Step OSMD cursor based on progress
      if (osmdRef.current && osmdRef.current.cursor) {
        const cursor = osmdRef.current.cursor;
        const totalNotes = result.notes.length;
        if (totalNotes > 0) {
          const currentNoteIdx = result.notes.findIndex(n => n.start >= elapsedSec);
          if (currentNoteIdx > 0 && !cursor.iterator.EndReached) {
            cursor.next();
          }
        }
      }
    }, intervalMs);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
      soundfontService.stop();
    };
  }, [isPlaying, currentTime, playbackSpeed, playMode, transpose, result.notes, result.duration, result.exports.audio]);

  const handlePlayToggle = () => {
    setIsPlaying(p => !p);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    soundfontService.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (osmdRef.current && osmdRef.current.cursor) {
      osmdRef.current.cursor.reset();
    }
  };

  const handleZoom = (delta: number) => {
    setZoom(z => Math.max(0.6, Math.min(1.8, Number((z + delta).toFixed(1)))));
  };

  const handleTranspose = (delta: number) => {
    setTranspose(t => t + delta);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Playback & Control Bar */}
      <div className="glass-panel" style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            onClick={handlePlayToggle}
            style={{ minWidth: 100 }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause' : 'Play Score'}</span>
          </button>

          <button className="btn btn-secondary" onClick={handleStop} title="Stop & Rewind">
            <Square size={15} />
            <span>Stop</span>
          </button>

          {/* Time Counter */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.88rem',
            padding: '6px 12px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            color: '#67e8f9'
          }}>
            {currentTime.toFixed(1)}s / {result.duration.toFixed(1)}s
          </div>
        </div>

        {/* Audio Mode & Realistic SoundFont Instrument Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              className={`btn ${playMode === 'soundfont' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6 }}
              onClick={() => setPlayMode('soundfont')}
            >
              <Sparkles size={12} />
              <span>SoundFont Playback</span>
            </button>
            <button
              className={`btn ${playMode === 'audio' ? 'btn-cyan' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6 }}
              onClick={() => setPlayMode('audio')}
            >
              <Volume2 size={12} />
              <span>Original Audio</span>
            </button>
          </div>

          {/* SoundFont Instrument Dropdown */}
          {playMode === 'soundfont' && (
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as SoundfontInstrumentName)}
              className="input-control"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                borderRadius: 8
              }}
            >
              <option value="acoustic_grand_piano">🎹 Steinway Grand Piano</option>
              <option value="acoustic_guitar_nylon">🎸 Acoustic Guitar</option>
              <option value="violin">🎻 Violin / Strings</option>
              <option value="flute">🪈 Flute / Winds</option>
              <option value="electric_bass_finger">🎸 Electric Bass</option>
            </select>
          )}

          {/* Playback Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Gauge size={14} color="#94a3b8" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="input-control"
              style={{ fontSize: '0.78rem', padding: '4px 8px', width: 75 }}
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>

        {/* Transpose & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Transposition */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Pitch:</span>
            <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleTranspose(-1)}>-</button>
            <span style={{ fontFamily: 'var(--font-mono)', minWidth: 28, textAlign: 'center', color: transpose !== 0 ? '#38bdf8' : 'var(--text-primary)' }}>
              {transpose > 0 ? `+${transpose}` : transpose} st
            </span>
            <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleTranspose(1)}>+</button>
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => handleZoom(-0.1)} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => handleZoom(0.1)} title="Zoom In">
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Music Score Paper Container */}
      <div
        className="glass-panel glow-purple"
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '28px 24px',
          minHeight: 520,
          overflowX: 'auto',
          overflowY: 'visible',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.7)',
          position: 'relative'
        }}
      >
        <div ref={containerRef} style={{ width: '100%' }} />
      </div>
    </div>
  );
};
