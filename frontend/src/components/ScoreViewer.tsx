import React, { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Play, Pause, Square, ZoomIn, ZoomOut, Volume2, Music, Gauge } from 'lucide-react';
import type { TranscriptionResult } from '../types';
import { synth } from '../services/synth';

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
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [playMode, setPlayMode] = useState<'synth' | 'audio'>('synth');
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<number | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const playedNoteIndicesRef = useRef<Set<number>>(new Set());

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
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
      synth.stopAll();
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

      // Synthesize note events
      if (playMode === 'synth') {
        result.notes.forEach((note, idx) => {
          if (!playedNoteIndicesRef.current.has(idx)) {
            if (elapsedSec >= note.start && elapsedSec <= note.start + 0.08) {
              playedNoteIndicesRef.current.add(idx);
              const transposedPitch = note.pitch + transpose;
              synth.playNote(transposedPitch, note.velocity, note.duration / playbackSpeed);
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
            // Smoothly move cursor forward
            cursor.next();
          }
        }
      }
    }, intervalMs);

    // Metronome Click Timer
    if (isMetronomeActive) {
      const beatIntervalMs = (60.0 / (result.tempo * playbackSpeed)) * 1000;
      let beatCount = 0;
      metronomeTimerRef.current = window.setInterval(() => {
        synth.playMetronomeClick(beatCount % 4 === 0);
        beatCount++;
      }, beatIntervalMs);
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
      synth.stopAll();
    };
  }, [isPlaying, playbackSpeed, isMetronomeActive, playMode, transpose]);

  const handlePlayToggle = () => {
    setIsPlaying(p => !p);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    playedNoteIndicesRef.current.clear();
    synth.stopAll();
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

        {/* Audio Mode & Metronome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              className={`btn ${playMode === 'synth' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6 }}
              onClick={() => setPlayMode('synth')}
            >
              <Music size={12} />
              <span>AI Synth</span>
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

          <button
            className={`btn ${isMetronomeActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            onClick={() => setIsMetronomeActive(!isMetronomeActive)}
            title="Toggle Metronome Click"
          >
            <span>Metronome {isMetronomeActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Zoom, Transpose & Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
            <Gauge size={14} color="var(--text-secondary)" />
            <select
              className="select-control"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={0.75}>0.75x Speed</option>
              <option value={1.0}>1.0x (Normal)</option>
              <option value={1.25}>1.25x Speed</option>
              <option value={1.5}>1.5x Speed</option>
            </select>
          </div>

          {/* Transpose */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Pitch:</span>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleTranspose(-1)}>-1</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', minWidth: 28, textAlign: 'center' }}>
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleTranspose(1)}>+1</button>
          </div>

          {/* Zoom Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleZoom(-0.1)} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleZoom(0.1)} title="Zoom In">
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Music Score Rendering Container */}
      <div
        id="sheet-music-render-area"
        className="osmd-canvas-container"
        ref={containerRef}
        style={{
          boxShadow: '0 12px 36px -10px rgba(0, 0, 0, 0.7)',
          position: 'relative'
        }}
      />
    </div>
  );
};
