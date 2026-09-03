import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square, Sparkles, Volume2 } from 'lucide-react';
import type { TranscriptionResult, NoteEvent } from '../types';

interface DrumKitVisualizerProps {
  result: TranscriptionResult;
}

export const DrumKitVisualizer: React.FC<DrumKitVisualizerProps> = ({ result }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePad, setActivePad] = useState<string | null>(null);

  // Extract drum notes
  const drumNotes: NoteEvent[] = (result.tracks && result.tracks.drums)
    ? result.tracks.drums.notes
    : result.notes.filter(n => n.track === 'drums' || n.pitch === 36 || n.pitch === 38 || n.pitch === 42 || n.pitch === 46 || n.pitch === 49);

  const duration = Math.max(1, result.duration || 10);
  const playTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Audio Context for realistic synthetic drum hits
  const playSynthDrum = (piece: string) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      if (piece === 'kick') {
        // Kick: Sine sweep 150Hz -> 30Hz with fast decay
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (piece === 'snare') {
        // Snare: Tone 180Hz + White Noise burst
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(180, now);
        oscGain.gain.setValueAtTime(0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        // Noise buffer
        const bufferSize = ctx.sampleRate * 0.18;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1000, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
      } else if (piece === 'hihat_closed' || piece === 'hihat_open') {
        // Hi-Hat: Highpassed noise burst
        const dur = piece === 'hihat_open' ? 0.35 : 0.06;
        const bufferSize = ctx.sampleRate * dur;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (piece === 'crash') {
        // Crash: Long metallic noise with resonance
        const bufferSize = ctx.sampleRate * 0.8;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(5500, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (piece === 'tom') {
        // Tom: Warm pitched drop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Web Audio drum synth error:', e);
    }
  };

  // Playback timer & active hit detection
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    const playedIndices = new Set<number>();
    const startTime = performance.now() - (currentTime * 1000);

    playTimerRef.current = window.setInterval(() => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      setCurrentTime(elapsedSec);

      if (elapsedSec >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      drumNotes.forEach((n, idx) => {
        if (!playedIndices.has(idx)) {
          if (elapsedSec >= n.start && elapsedSec <= n.start + 0.08) {
            playedIndices.add(idx);
            
            // Map pitch to piece
            let pName = 'kick';
            if (n.pitch === 38 || n.name?.toLowerCase().includes('snare')) pName = 'snare';
            else if (n.pitch === 42 || n.pitch === 46 || n.name?.toLowerCase().includes('hihat')) pName = 'hihat_closed';
            else if (n.pitch === 49 || n.pitch === 51 || n.name?.toLowerCase().includes('crash')) pName = 'crash';
            else if (n.pitch === 45 || n.pitch === 50 || n.name?.toLowerCase().includes('tom')) pName = 'tom';

            setActivePad(pName);
            playSynthDrum(pName);
            setTimeout(() => setActivePad(null), 120);
          }
        }
      });
    }, 25);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, currentTime, duration, drumNotes]);

  // Statistics
  const kickCount = drumNotes.filter(n => n.pitch === 36 || n.name?.toLowerCase().includes('kick')).length;
  const snareCount = drumNotes.filter(n => n.pitch === 38 || n.name?.toLowerCase().includes('snare')).length;
  const hihatCount = drumNotes.filter(n => n.pitch === 42 || n.pitch === 46 || n.name?.toLowerCase().includes('hihat')).length;
  const crashCount = drumNotes.filter(n => n.pitch === 49 || n.name?.toLowerCase().includes('crash')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Drum Master Header */}
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(245, 158, 11, 0.45)'
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Multi-Piece Drum Kit & 5-Line Percussion Score
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Multi-Band Transient Decomposition • GM Percussion Clef with Cross Noteheads
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-amber'}`}
            onClick={() => setIsPlaying(p => !p)}
            style={{ padding: '7px 18px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause Drums' : 'Play Drum Kit'}</span>
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
            color: '#fbbf24'
          }}>
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14
      }}>
        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: 12 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>💥 Bass Drum (Kick)</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{kickCount} hits</div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>GM MIDI 36 • Staff F4</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: 12 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>🥁 Snare Drum</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{snareCount} hits</div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>GM MIDI 38 • Staff C5</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: 12 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>🥢 Hi-Hat Cymbals</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{hihatCount} hits</div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>GM MIDI 42 • Staff G5 (×)</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: 12 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>🔔 Crash / Ride Cymbals</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ec4899' }}>{crashCount} hits</div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>GM MIDI 49 • Staff A5 (×)</span>
        </div>
      </div>

      {/* Interactive 5-Piece Visual Drum Kit Stage */}
      <div className="glass-panel glow-purple" style={{
        padding: '30px 20px',
        borderRadius: 20,
        background: 'radial-gradient(circle at 50% 60%, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.98) 100%)',
        minHeight: 380,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 16, left: 24, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Click any pad to play sound
        </div>

        {/* Drum Kit Layout Canvas/Pads */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'auto auto',
          gap: 24,
          alignItems: 'center',
          justifyItems: 'center',
          maxWidth: 680,
          width: '100%'
        }}>
          {/* Top-Left: Crash Cymbal */}
          <div
            onClick={() => { playSynthDrum('crash'); setActivePad('crash'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fde047 0%, #ca8a04 70%, #854d0e 100%)',
              border: activePad === 'crash' ? '4px solid #ffffff' : '2px solid #eab308',
              boxShadow: activePad === 'crash' ? '0 0 35px #facc15, 0 0 60px #eab308' : '0 8px 24px rgba(0,0,0,0.6)',
              transform: activePad === 'crash' ? 'scale(1.15) rotate(4deg)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#422006' }}>CRASH</span>
            <span style={{ fontSize: '0.68rem', color: '#713f12' }}>Cymbal</span>
          </div>

          {/* Top-Center: Tom-Tom */}
          <div
            onClick={() => { playSynthDrum('tom'); setActivePad('tom'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 105,
              height: 105,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #e2e8f0 0%, #475569 85%, #0f172a 100%)',
              border: activePad === 'tom' ? '4px solid #38bdf8' : '3px solid #94a3b8',
              boxShadow: activePad === 'tom' ? '0 0 35px #38bdf8' : '0 8px 24px rgba(0,0,0,0.6)',
              transform: activePad === 'tom' ? 'scale(1.12)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>TOM</span>
            <span style={{ fontSize: '0.68rem', color: '#475569' }}>Rack Tom</span>
          </div>

          {/* Top-Right: Hi-Hat */}
          <div
            onClick={() => { playSynthDrum('hihat_closed'); setActivePad('hihat_closed'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fef08a 0%, #eab308 75%, #a16207 100%)',
              border: (activePad === 'hihat_closed' || activePad === 'hihat_open') ? '4px solid #ffffff' : '2px solid #ca8a04',
              boxShadow: (activePad === 'hihat_closed' || activePad === 'hihat_open') ? '0 0 35px #facc15' : '0 8px 24px rgba(0,0,0,0.6)',
              transform: (activePad === 'hihat_closed' || activePad === 'hihat_open') ? 'scale(1.12)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#422006' }}>HI-HAT</span>
            <span style={{ fontSize: '0.68rem', color: '#713f12' }}>Pedal / Hat</span>
          </div>

          {/* Bottom-Left: Snare Drum */}
          <div
            onClick={() => { playSynthDrum('snare'); setActivePad('snare'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffffff 0%, #cbd5e1 70%, #334155 100%)',
              border: activePad === 'snare' ? '4px solid #ec4899' : '4px solid #94a3b8',
              boxShadow: activePad === 'snare' ? '0 0 40px #ec4899, 0 0 70px #f43f5e' : '0 10px 30px rgba(0,0,0,0.7)',
              transform: activePad === 'snare' ? 'scale(1.15)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>SNARE</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>14" Coated</span>
          </div>

          {/* Bottom-Center: Bass / Kick Drum */}
          <div
            onClick={() => { playSynthDrum('kick'); setActivePad('kick'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #1e293b 0%, #0f172a 75%, #020617 100%)',
              border: activePad === 'kick' ? '5px solid #f59e0b' : '4px solid #475569',
              boxShadow: activePad === 'kick' ? '0 0 50px #f59e0b, 0 0 90px #d97706' : '0 12px 36px rgba(0,0,0,0.8)',
              transform: activePad === 'kick' ? 'scale(1.15)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24' }}>KICK</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>22" Bass Drum</span>
          </div>

          {/* Bottom-Right: Floor Tom */}
          <div
            onClick={() => { playSynthDrum('tom'); setActivePad('tom'); setTimeout(() => setActivePad(null), 120); }}
            style={{
              width: 125,
              height: 125,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #f8fafc 0%, #64748b 85%, #1e293b 100%)',
              border: activePad === 'tom' ? '4px solid #10b981' : '3px solid #94a3b8',
              boxShadow: activePad === 'tom' ? '0 0 35px #10b981' : '0 8px 24px rgba(0,0,0,0.6)',
              transform: activePad === 'tom' ? 'scale(1.12)' : 'scale(1.0)',
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>FLOOR TOM</span>
            <span style={{ fontSize: '0.68rem', color: '#475569' }}>16" Low</span>
          </div>
        </div>
      </div>

      {/* Rhythmic Step-Sequencer Pattern Stream */}
      <div className="glass-panel" style={{ padding: 22, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Rhythmic Step-Sequencer Drum Hits Stream
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Classified drum onsets mapped to standard General MIDI percussion clef.
            </p>
          </div>
        </div>

        <div style={{ maxHeight: 340, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>#</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Drum Piece</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>GM Pitch</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Staff Position</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Notehead</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Start Time</th>
                <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' }}>Audition</th>
              </tr>
            </thead>
            <tbody>
              {drumNotes.map((n, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')}
                >
                  <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: n.pitch === 36 ? '#fbbf24' : (n.pitch === 38 ? '#38bdf8' : '#34d399') }}>
                    {n.name || 'Percussion Hit'}
                  </td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{n.pitch}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)', color: '#c4b5fd' }}>
                    {(n as any).staff_pitch || (n.pitch === 36 ? 'F4' : (n.pitch === 38 ? 'C5' : 'G5'))}
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                      {(n as any).notehead === 'cross' ? '× Cross' : '● Solid'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)' }}>{n.start.toFixed(2)}s</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => {
                        let p = 'kick';
                        if (n.pitch === 38) p = 'snare';
                        else if (n.pitch === 42 || n.pitch === 46) p = 'hihat_closed';
                        else if (n.pitch === 49) p = 'crash';
                        playSynthDrum(p);
                      }}
                      title="Audition drum piece"
                    >
                      <Volume2 size={12} color="#fbbf24" />
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
