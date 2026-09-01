import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square, Sparkles } from 'lucide-react';
import type { TranscriptionResult } from '../types';
import { soundfontService } from '../services/soundfont';

interface GuitarFretboardProps {
  result: TranscriptionResult;
}

// Standard 6-string Guitar Tuning: String 1 = High E (64) down to String 6 = Low E (40)
const GUITAR_STRINGS = [
  { num: 1, name: 'e', openPitch: 64, gauge: 1.2 },
  { num: 2, name: 'B', openPitch: 59, gauge: 1.6 },
  { num: 3, name: 'G', openPitch: 55, gauge: 2.2 },
  { num: 4, name: 'D', openPitch: 50, gauge: 2.8 },
  { num: 5, name: 'A', openPitch: 45, gauge: 3.4 },
  { num: 6, name: 'E', openPitch: 40, gauge: 4.0 },
];

const FRET_COUNT = 22;
const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOT_FRETS = [12];

export const GuitarFretboard: React.FC<GuitarFretboardProps> = ({ result }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [hoveredFret, setHoveredFret] = useState<{ stringNum: number; fret: number; pitch: number } | null>(null);

  const notes = result.notes || [];
  const tabNotes = result.tab_notes || notes;
  const duration = Math.max(1, result.duration || 10);
  const playTimerRef = useRef<number | null>(null);
  const playedIndicesRef = useRef<Set<number>>(new Set());

  // Set acoustic guitar soundfont on mount
  useEffect(() => {
    soundfontService.setInstrument('acoustic_guitar_nylon');
  }, []);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      soundfontService.stop();
      return;
    }

    playedIndicesRef.current.clear();
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

      tabNotes.forEach((n, idx) => {
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
  }, [isPlaying, playheadTime, duration, tabNotes]);

  // Find currently active notes at playhead
  const activeNotes = isPlaying || playheadTime > 0
    ? tabNotes.filter(n => playheadTime >= n.start && playheadTime <= n.end)
    : [];

  // Render Visual Fretboard Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const nutWidth = 24;
    const boardWidth = width - nutWidth - 20;
    const stringSpacing = (height - 36) / 5;

    // Fret scale spacing (logarithmic physical spacing)
    const fretPositions: number[] = [nutWidth];
    let remaining = boardWidth;
    for (let f = 1; f <= FRET_COUNT; f++) {
      const fretWidth = remaining * 0.056;
      fretPositions.push(fretPositions[f - 1] + fretWidth);
      remaining -= fretWidth;
    }

    // Draw Rosewood Fretboard Neck Background
    const neckGradient = ctx.createLinearGradient(0, 0, 0, height);
    neckGradient.addColorStop(0, '#2d1b14');
    neckGradient.addColorStop(0.5, '#3d261c');
    neckGradient.addColorStop(1, '#24140e');
    ctx.fillStyle = neckGradient;
    ctx.fillRect(0, 0, width, height);

    // Nut (Bone / Ivory)
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillRect(nutWidth - 4, 10, 6, height - 20);
    ctx.shadowBlur = 0;

    // Draw Inlay Dot Markers (Mother of Pearl)
    for (let f = 1; f <= FRET_COUNT; f++) {
      const xLeft = fretPositions[f - 1];
      const xRight = fretPositions[f];
      const xCenter = (xLeft + xRight) / 2;

      if (SINGLE_DOT_FRETS.includes(f)) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(xCenter, height / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (DOUBLE_DOT_FRETS.includes(f)) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(xCenter, height / 2 - 24, 4, 0, Math.PI * 2);
        ctx.arc(xCenter, height / 2 + 24, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nickel Fret Wire
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = f === 1 ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.moveTo(xRight, 10);
      ctx.lineTo(xRight, height - 10);
      ctx.stroke();

      // Fret Number Label at bottom
      ctx.fillStyle = '#64748b';
      ctx.font = '9px var(--font-mono)';
      ctx.textAlign = 'center';
      ctx.fillText(f.toString(), xCenter, height - 2);
    }

    // Draw 6 Guitar Strings
    GUITAR_STRINGS.forEach((strObj, sIdx) => {
      const y = 18 + sIdx * stringSpacing;

      // String tuning label at the nut
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(strObj.name, 6, y + 4);

      // Steel / Bronze wound string
      ctx.strokeStyle = sIdx >= 3 ? '#d97706' : '#cbd5e1';
      ctx.lineWidth = strObj.gauge;
      ctx.beginPath();
      ctx.moveTo(nutWidth, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    });

    // Draw Active Finger Markers (Live Playback)
    activeNotes.forEach((n) => {
      const s = n.string || 1;
      const f = n.fret !== undefined ? n.fret : 0;
      const sIdx = s - 1;
      const y = 18 + sIdx * stringSpacing;

      let xCenter = nutWidth / 2;
      if (f > 0 && f <= FRET_COUNT) {
        xCenter = (fretPositions[f - 1] + fretPositions[f]) / 2;
      }

      // Glowing finger dot
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(xCenter, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Fret number inside dot
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.toString(), xCenter, y + 3.5);
    });

    // Draw Hovered Fret Position Highlight
    if (hoveredFret) {
      const sIdx = hoveredFret.stringNum - 1;
      const f = hoveredFret.fret;
      const y = 18 + sIdx * stringSpacing;
      const xCenter = f === 0 ? nutWidth / 2 : (fretPositions[f - 1] + fretPositions[f]) / 2;

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xCenter, y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [activeNotes, hoveredFret]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const nutWidth = 24;
    const boardWidth = canvas.width - nutWidth - 20;
    const stringSpacing = (canvas.height - 36) / 5;

    const sIdx = Math.min(5, Math.max(0, Math.floor((y - 8) / stringSpacing)));
    const openPitch = GUITAR_STRINGS[sIdx].openPitch;

    let fret = 0;
    if (x > nutWidth) {
      const fretPositions: number[] = [nutWidth];
      let remaining = boardWidth;
      for (let f = 1; f <= FRET_COUNT; f++) {
        const fretWidth = remaining * 0.056;
        fretPositions.push(fretPositions[f - 1] + fretWidth);
        remaining -= fretWidth;
      }
      for (let f = 1; f <= FRET_COUNT; f++) {
        if (x >= fretPositions[f - 1] && x <= fretPositions[f]) {
          fret = f;
          break;
        }
      }
    }

    const clickedPitch = openPitch + fret;
    soundfontService.playNote(clickedPitch, 0.5, 95);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const nutWidth = 24;
    const boardWidth = canvas.width - nutWidth - 20;
    const stringSpacing = (canvas.height - 36) / 5;

    const sIdx = Math.min(5, Math.max(0, Math.floor((y - 8) / stringSpacing)));
    const stringNum = sIdx + 1;
    const openPitch = GUITAR_STRINGS[sIdx].openPitch;

    let fret = 0;
    if (x > nutWidth) {
      const fretPositions: number[] = [nutWidth];
      let remaining = boardWidth;
      for (let f = 1; f <= FRET_COUNT; f++) {
        const fretWidth = remaining * 0.056;
        fretPositions.push(fretPositions[f - 1] + fretWidth);
        remaining -= fretWidth;
      }
      for (let f = 1; f <= FRET_COUNT; f++) {
        if (x >= fretPositions[f - 1] && x <= fretPositions[f]) {
          fret = f;
          break;
        }
      }
    }

    setHoveredFret({ stringNum, fret, pitch: openPitch + fret });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Fretboard Master Header */}
      <div className="glass-panel" style={{
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(217, 119, 6, 0.4)'
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              6-String Guitar Tablature & Interactive Fretboard
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Standard Tuning (E-A-D-G-B-E) • Dynamic Programming Hand-Position Optimizer
            </p>
          </div>
        </div>

        {/* Playback Controls & Hover Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {hoveredFret && (
            <div className="badge badge-amber" style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
              <span>String {hoveredFret.stringNum} • Fret {hoveredFret.fret} (MIDI {hoveredFret.pitch})</span>
            </div>
          )}

          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-cyan'}`}
            onClick={() => setIsPlaying(p => !p)}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause TAB' : 'Play TAB'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => { setIsPlaying(false); setPlayheadTime(0); }}
            style={{ padding: '7px 12px' }}
            title="Stop & Rewind"
          >
            <Square size={14} />
          </button>
        </div>
      </div>

      {/* Visual 22-Fret Guitar Neck */}
      <div className="glass-panel" style={{ padding: 18, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Interactive 22-Fret Neck (Click any fret to audition note)
          </span>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#67e8f9' }}>
            {playheadTime.toFixed(1)}s / {duration.toFixed(1)}s
          </span>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <canvas
            ref={canvasRef}
            width={1100}
            height={180}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoveredFret(null)}
            style={{
              display: 'block',
              borderRadius: 12,
              border: '2px solid #5c3a21',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              width: '100%',
              maxWidth: 1200
            }}
          />
        </div>
      </div>

      {/* 6-Line ASCII Tablature Stream */}
      {result.ascii_tab && (
        <div className="glass-panel" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              6-Line Guitar Tablature Notation
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Universal ASCII / Plaintext TAB
            </span>
          </div>

          <div style={{
            background: 'rgba(10, 15, 29, 0.95)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '16px 20px',
            maxHeight: 340,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: 1.45,
            color: '#38bdf8',
            whiteSpace: 'pre'
          }}>
            {result.ascii_tab}
          </div>
        </div>
      )}
    </div>
  );
};
