import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Play, Pause, Square, Sparkles, Video, Download, Sliders, Maximize2, ZoomIn, Music2 } from 'lucide-react';
import type { TranscriptionResult, NoteEvent } from '../types';
import { soundfontService } from '../services/soundfont';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

interface WaterfallVisualizerProps {
  result: TranscriptionResult;
}

// 88-Key Piano Mapping (MIDI 21 A0 to 108 C8)
const MIDI_MIN_88 = 21;
const MIDI_MAX_88 = 108;
const BLACK_KEY_OFFSETS = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A# in octave

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_OFFSETS.includes(midi % 12);
}

export const WaterfallVisualizer: React.FC<WaterfallVisualizerProps> = ({ result }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [lookaheadSec, setLookaheadSec] = useState(2.5); // Fall duration
  const [zoomMode, setZoomMode] = useState<'88_keys' | 'active_zoom'>('88_keys');
  const [particlesEnabled, setParticlesEnabled] = useState(true);

  // Video Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const notes = useMemo(() => result.notes || [], [result.notes]);
  const chords = useMemo(() => result.chords || [], [result.chords]);
  const duration = Math.max(1, result.duration || 10);

  // Active Key Range Calculation for Zoom Mode
  const { minMidi, maxMidi } = useMemo(() => {
    if (zoomMode === '88_keys' || notes.length === 0) {
      return { minMidi: MIDI_MIN_88, maxMidi: MIDI_MAX_88 };
    }
    const pitches = notes.map(n => n.pitch);
    const minP = Math.max(MIDI_MIN_88, Math.min(...pitches) - 3);
    const maxP = Math.min(MIDI_MAX_88, Math.max(...pitches) + 3);
    return { minMidi: minP, maxMidi: maxP };
  }, [zoomMode, notes]);

  // Pre-calculate White Keys in Range
  const whiteKeysInRange = useMemo(() => {
    const list: number[] = [];
    for (let m = minMidi; m <= maxMidi; m++) {
      if (!isBlackKey(m)) list.push(m);
    }
    return list;
  }, [minMidi, maxMidi]);

  // Animation Refs
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const particlesRef = useRef<Particle[]>([]);
  const playedIndicesRef = useRef<Set<number>>(new Set());

  // Note Color Resolver
  const getNoteColor = useCallback((note: NoteEvent) => {
    if (note.track === 'lead') return { start: '#f43f5e', end: '#ec4899', glow: 'rgba(244, 63, 94, 0.6)' };
    if (note.track === 'harmony') return { start: '#f59e0b', end: '#d97706', glow: 'rgba(245, 158, 11, 0.6)' };
    if (note.track === 'bass') return { start: '#10b981', end: '#059669', glow: 'rgba(16, 185, 129, 0.6)' };
    if (note.track === 'drums') return { start: '#06b6d4', end: '#0284c7', glow: 'rgba(6, 182, 212, 0.6)' };

    // Standard Grand Staff: Bass (Left) = Cyan/Blue, Treble (Right) = Purple/Pink
    if (note.pitch < 60) {
      return { start: '#06b6d4', end: '#3b82f6', glow: 'rgba(6, 182, 212, 0.7)' };
    }
    return { start: '#a855f7', end: '#ec4899', glow: 'rgba(168, 85, 247, 0.7)' };
  }, []);

  // Calculate Key Geometry
  const getKeyGeometry = useCallback((canvasWidth: number, canvasHeight: number) => {
    const keyboardHeight = Math.min(140, Math.max(90, canvasHeight * 0.22));
    const hitLineY = canvasHeight - keyboardHeight;
    const numWhite = Math.max(1, whiteKeysInRange.length);
    const whiteKeyWidth = canvasWidth / numWhite;
    const blackKeyWidth = whiteKeyWidth * 0.62;
    const blackKeyHeight = keyboardHeight * 0.62;

    const keyXMap: Record<number, { x: number; width: number; isBlack: boolean }> = {};

    let whiteIdx = 0;
    for (let m = minMidi; m <= maxMidi; m++) {
      if (!isBlackKey(m)) {
        keyXMap[m] = {
          x: whiteIdx * whiteKeyWidth,
          width: whiteKeyWidth,
          isBlack: false
        };
        whiteIdx++;
      }
    }

    // Position black keys between adjacent white keys
    for (let m = minMidi; m <= maxMidi; m++) {
      if (isBlackKey(m)) {
        const prevWhite = keyXMap[m - 1];
        if (prevWhite) {
          keyXMap[m] = {
            x: prevWhite.x + prevWhite.width - (blackKeyWidth / 2),
            width: blackKeyWidth,
            isBlack: true
          };
        } else {
          keyXMap[m] = { x: 0, width: blackKeyWidth, isBlack: true };
        }
      }
    }

    return { keyboardHeight, hitLineY, whiteKeyWidth, blackKeyWidth, blackKeyHeight, keyXMap };
  }, [minMidi, maxMidi, whiteKeysInRange]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localCurrentTime = currentTime;

    const render = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying) {
        localCurrentTime += deltaSec * speedMultiplier;
        setCurrentTime(localCurrentTime);

        if (localCurrentTime >= duration) {
          setIsPlaying(false);
          setCurrentTime(0);
          if (isRecording) stopRecording();
          return;
        }

        // Audition Notes on Hitline Strike
        notes.forEach((n, idx) => {
          if (!playedIndicesRef.current.has(idx)) {
            if (localCurrentTime >= n.start && localCurrentTime <= n.start + 0.08) {
              playedIndicesRef.current.add(idx);
              soundfontService.playNote(n.pitch, Math.max(0.15, n.duration), n.velocity);
            }
          }
        });
      }

      // Resize canvas to client dimensions
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      const { keyboardHeight, hitLineY, blackKeyHeight, keyXMap } = getKeyGeometry(width, height);

      // 1. Dark Neon Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.7, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Background Vertical Key Grid Guides
      ctx.lineWidth = 0.5;
      for (let m = minMidi; m <= maxMidi; m++) {
        const k = keyXMap[m];
        if (k && !k.isBlack) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.beginPath();
          ctx.moveTo(k.x, 0);
          ctx.lineTo(k.x, hitLineY);
          ctx.stroke();
        }
      }

      // 3. Falling Note Bars
      const activeNotesAtHitline: NoteEvent[] = [];

      notes.forEach((note) => {
        const timeUntilHit = note.start - localCurrentTime;
        const noteDuration = note.duration;

        // Is visible in lookahead window?
        if (timeUntilHit < lookaheadSec && (timeUntilHit + noteDuration) > -0.5) {
          const k = keyXMap[note.pitch];
          if (!k) return;

          const fallDistance = hitLineY;
          const yBottom = hitLineY - (timeUntilHit / lookaheadSec) * fallDistance;
          const noteHeight = Math.max(8, (noteDuration / lookaheadSec) * fallDistance);
          const yTop = yBottom - noteHeight;

          const isActive = (localCurrentTime >= note.start && localCurrentTime <= note.end);
          if (isActive) activeNotesAtHitline.push(note);

          // Draw note bar
          const noteColors = getNoteColor(note);
          const nGrad = ctx.createLinearGradient(0, yTop, 0, yBottom);
          nGrad.addColorStop(0, noteColors.start);
          nGrad.addColorStop(1, noteColors.end);

          ctx.fillStyle = nGrad;
          ctx.shadowColor = noteColors.glow;
          ctx.shadowBlur = isActive ? 20 : 8;

          const notePadding = k.isBlack ? 1.5 : 2;
          const noteWidth = Math.max(4, k.width - (notePadding * 2));
          const noteX = k.x + notePadding;

          ctx.beginPath();
          ctx.roundRect(noteX, yTop, noteWidth, noteHeight, 6);
          ctx.fill();

          // Shiny top highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.roundRect(noteX + 2, yTop + 2, noteWidth - 4, Math.min(6, noteHeight / 3), 3);
          ctx.fill();

          ctx.shadowBlur = 0; // Reset shadow

          // Spawn Particles on active hit
          if (isActive && particlesEnabled && Math.random() < 0.35) {
            particlesRef.current.push({
              x: noteX + (noteWidth / 2) + (Math.random() * 8 - 4),
              y: hitLineY - 2,
              vx: (Math.random() * 2 - 1) * 1.5,
              vy: -(Math.random() * 3 + 2),
              size: Math.random() * 3 + 2,
              color: noteColors.start,
              alpha: 1.0,
              life: 1.0
            });
          }
        }
      });

      // 4. Hitline Radiant Glow Bar
      const hitlineGrad = ctx.createLinearGradient(0, hitLineY - 4, 0, hitLineY + 4);
      hitlineGrad.addColorStop(0, 'rgba(139, 92, 246, 0.0)');
      hitlineGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.85)');
      hitlineGrad.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
      ctx.fillStyle = hitlineGrad;
      ctx.fillRect(0, hitLineY - 3, width, 6);

      // 5. Particle Physics & Rendering
      if (particlesEnabled && particlesRef.current.length > 0) {
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
          p.size = Math.max(0.5, p.size * 0.96);

          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 6. Floating Harmonic Chord Badges
      chords.forEach((chord) => {
        const timeUntilChord = chord.start_time - localCurrentTime;
        if (timeUntilChord < lookaheadSec && timeUntilChord > -0.5) {
          const chordY = hitLineY - (timeUntilChord / lookaheadSec) * hitLineY;

          ctx.save();
          ctx.fillStyle = 'rgba(30, 27, 75, 0.88)';
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(18, chordY - 14, 60, 26, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(chord.figure, 48, chordY);
          ctx.restore();
        }
      });

      // 7. Piano Keyboard Rendering (White Keys First, Black Keys Second)
      const activePitches = new Set(activeNotesAtHitline.map(n => n.pitch));

      // Draw White Keys
      for (let m = minMidi; m <= maxMidi; m++) {
        const k = keyXMap[m];
        if (k && !k.isBlack) {
          const isPressed = activePitches.has(m);

          const wGrad = ctx.createLinearGradient(k.x, hitLineY, k.x, height);
          if (isPressed) {
            const activeNote = activeNotesAtHitline.find(n => n.pitch === m);
            const col = activeNote ? getNoteColor(activeNote) : { start: '#a855f7', end: '#ec4899', glow: '#a855f7' };
            wGrad.addColorStop(0, col.start);
            wGrad.addColorStop(1, col.end);
          } else {
            wGrad.addColorStop(0, '#ffffff');
            wGrad.addColorStop(0.85, '#e2e8f0');
            wGrad.addColorStop(1, '#94a3b8');
          }

          ctx.fillStyle = wGrad;
          ctx.beginPath();
          ctx.roundRect(k.x, hitLineY, k.width - 0.5, keyboardHeight, [0, 0, 4, 4]);
          ctx.fill();

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Note Name label on C keys
          if (m % 12 === 0) {
            ctx.fillStyle = isPressed ? '#ffffff' : '#64748b';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`C${m / 12 - 1}`, k.x + k.width / 2, height - 8);
          }
        }
      }

      // Draw Black Keys (Elevated on top)
      for (let m = minMidi; m <= maxMidi; m++) {
        const k = keyXMap[m];
        if (k && k.isBlack) {
          const isPressed = activePitches.has(m);

          const bGrad = ctx.createLinearGradient(k.x, hitLineY, k.x, hitLineY + blackKeyHeight);
          if (isPressed) {
            const activeNote = activeNotesAtHitline.find(n => n.pitch === m);
            const col = activeNote ? getNoteColor(activeNote) : { start: '#ec4899', end: '#f43f5e', glow: '#ec4899' };
            bGrad.addColorStop(0, col.start);
            bGrad.addColorStop(1, col.end);
          } else {
            bGrad.addColorStop(0, '#334155');
            bGrad.addColorStop(0.6, '#0f172a');
            bGrad.addColorStop(1, '#020617');
          }

          ctx.fillStyle = bGrad;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(k.x, hitLineY, k.width, blackKeyHeight, [0, 0, 3, 3]);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.strokeStyle = isPressed ? '#ffffff' : '#475569';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isPlaying,
    currentTime,
    duration,
    speedMultiplier,
    lookaheadSec,
    notes,
    chords,
    minMidi,
    maxMidi,
    whiteKeysInRange,
    isRecording,
    particlesEnabled,
    getKeyGeometry,
    getNoteColor
  ]);

  // Video Recording Logic via Canvas Stream
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      recordedChunksRef.current = [];
      const stream = canvas.captureStream(60); // 60 FPS
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6000000 // 6 Mbps HD
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      // Restart from 0s
      setCurrentTime(0);
      playedIndicesRef.current.clear();
      setIsPlaying(true);
    } catch (e) {
      alert('MediaRecorder is not supported in this browser environment: ' + e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Master Visualizer Header */}
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
            background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.45)'
          }}>
            <Music2 size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Synthesia-Style Waterfall Piano Visualizer & Video Exporter
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              60 FPS Falling Notes Engine • Hand Separation • 88-Key Grand Piano • 1080p Video Exporter
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => {
              if (!isPlaying) playedIndicesRef.current.clear();
              setIsPlaying(p => !p);
            }}
            style={{ padding: '7px 18px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Play Waterfall'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              playedIndicesRef.current.clear();
            }}
            style={{ padding: '7px 12px' }}
            title="Stop & Rewind"
          >
            <Square size={14} />
          </button>

          {!isRecording ? (
            <button
              className="btn btn-cyan"
              onClick={startRecording}
              style={{ padding: '7px 14px', fontSize: '0.85rem' }}
              title="Record full 60 FPS HD Video"
            >
              <Video size={15} />
              <span>Record HD Video</span>
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={stopRecording}
              style={{ padding: '7px 14px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', marginRight: 6, animation: 'pulse 1s infinite' }} />
              <span>Stop Recording</span>
            </button>
          )}

          {recordedBlobUrl && (
            <a
              href={recordedBlobUrl}
              download={`${result.filename || 'waterfall_piano'}_60fps.webm`}
              className="btn btn-emerald"
              style={{ padding: '7px 14px', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Download size={15} />
              <span>Download Video</span>
            </a>
          )}
        </div>
      </div>

      {/* Waterfall Visualizer Canvas Stage */}
      <div className="glass-panel glow-purple" style={{
        padding: 0,
        borderRadius: 20,
        overflow: 'hidden',
        background: '#090d16',
        position: 'relative',
        height: 520,
        display: 'flex',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(168, 85, 247, 0.3)'
      }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Floating Time Badge */}
        <div style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '6px 14px',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.88rem',
          color: '#38bdf8'
        }}>
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </div>
      </div>

      {/* Visualizer Controls & Settings Strip */}
      <div className="glass-panel" style={{
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        borderRadius: 14
      }}>
        {/* Timeline Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 280px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scrub:</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              playedIndicesRef.current.clear();
            }}
            style={{ width: '100%', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
          />
        </div>

        {/* Lookahead Speed Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sliders size={15} color="#c4b5fd" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Lookahead:</span>
          <input
            type="range"
            min={1.2}
            max={4.5}
            step={0.1}
            value={lookaheadSec}
            onChange={(e) => setLookaheadSec(parseFloat(e.target.value))}
            style={{ width: 90, accentColor: 'var(--accent-cyan)' }}
          />
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {lookaheadSec.toFixed(1)}s
          </span>
        </div>

        {/* Speed Multiplier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Speed:</span>
          {[0.5, 0.75, 1.0, 1.25].map(s => (
            <button
              key={s}
              className={`btn ${speedMultiplier === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
              onClick={() => setSpeedMultiplier(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Zoom Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`btn ${zoomMode === '88_keys' ? 'btn-purple' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => setZoomMode('88_keys')}
          >
            <Maximize2 size={13} />
            <span>88-Keys Full</span>
          </button>

          <button
            className={`btn ${zoomMode === 'active_zoom' ? 'btn-purple' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => setZoomMode('active_zoom')}
          >
            <ZoomIn size={13} />
            <span>Smart Zoom</span>
          </button>
        </div>

        {/* Particles Toggle */}
        <button
          className={`btn ${particlesEnabled ? 'btn-cyan' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          onClick={() => setParticlesEnabled(p => !p)}
        >
          <Sparkles size={13} />
          <span>Particles {particlesEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
