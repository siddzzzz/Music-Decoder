import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Sliders } from 'lucide-react';
import type { TranscriptionResult, StemTrackInfo } from '../types';

interface StemMixerProps {
  result: TranscriptionResult;
}

interface TrackControlState {
  volume: number;
  muted: boolean;
  solo: boolean;
}

export const StemMixer: React.FC<StemMixerProps> = ({ result }) => {
  const tracks = result.tracks || {};
  const trackKeys = Object.keys(tracks);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [controls, setControls] = useState<Record<string, TrackControlState>>(() => {
    const initial: Record<string, TrackControlState> = {};
    trackKeys.forEach(k => {
      initial[k] = { volume: 0.85, muted: false, solo: false };
    });
    return initial;
  });

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timerRef = useRef<number | null>(null);

  // Initialize audio elements for each stem
  useEffect(() => {
    trackKeys.forEach(k => {
      const audioUrl = `/api/export/${result.task_id}/stem/${k}`;
      const audio = new Audio(audioUrl);
      audioElementsRef.current.set(k, audio);
    });

    return () => {
      audioElementsRef.current.forEach(a => a.pause());
      audioElementsRef.current.clear();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [result.task_id]);

  // Update volume and mute state
  useEffect(() => {
    const isAnySolo = Object.values(controls).some(c => c.solo);

    trackKeys.forEach(k => {
      const audio = audioElementsRef.current.get(k);
      const ctrl = controls[k] || { volume: 0.85, muted: false, solo: false };
      if (audio) {
        if (ctrl.muted || (isAnySolo && !ctrl.solo)) {
          audio.volume = 0;
        } else {
          audio.volume = ctrl.volume;
        }
      }
    });
  }, [controls, trackKeys]);

  // Handle Playback loop
  useEffect(() => {
    if (!isPlaying) {
      audioElementsRef.current.forEach(a => a.pause());
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const firstAudio = Array.from(audioElementsRef.current.values())[0];
    if (firstAudio) {
      firstAudio.currentTime = currentTime;
      audioElementsRef.current.forEach(a => {
        a.currentTime = currentTime;
        a.play().catch(() => {});
      });
    }

    timerRef.current = window.setInterval(() => {
      if (firstAudio) {
        setCurrentTime(firstAudio.currentTime);
        if (firstAudio.ended || firstAudio.currentTime >= result.duration) {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioElementsRef.current.forEach(a => a.pause());
    };
  }, [isPlaying, result.duration]);

  const togglePlay = () => {
    setIsPlaying(p => !p);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    audioElementsRef.current.forEach(a => {
      a.currentTime = time;
    });
  };

  const setTrackVolume = (trackKey: string, vol: number) => {
    setControls(prev => ({
      ...prev,
      [trackKey]: { ...prev[trackKey], volume: vol }
    }));
  };

  const toggleMute = (trackKey: string) => {
    setControls(prev => ({
      ...prev,
      [trackKey]: { ...prev[trackKey], muted: !prev[trackKey]?.muted }
    }));
  };

  const toggleSolo = (trackKey: string) => {
    setControls(prev => ({
      ...prev,
      [trackKey]: { ...prev[trackKey], solo: !prev[trackKey]?.solo }
    }));
  };

  const trackBadgeColors: Record<string, string> = {
    lead: 'badge-cyan',
    harmony: 'badge-purple',
    bass: 'badge-emerald',
    drums: 'badge-amber'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Master Mixer Header */}
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
            background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)'
          }}>
            <Sliders size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              AI Stem Mixer & Conductor Board
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Separated via Meta HT-Demucs Neural Network ({result.device?.toUpperCase() || 'CUDA'} GPU Accelerated)
            </p>
          </div>
        </div>

        {/* Master Play / Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 500, justifyContent: 'flex-end' }}>
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-cyan'}`}
            onClick={togglePlay}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause Mix' : 'Play Mix'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', minWidth: 40, color: 'var(--text-secondary)' }}>
              {currentTime.toFixed(1)}s
            </span>
            <input
              type="range"
              min="0"
              max={result.duration || 10}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', minWidth: 40, color: 'var(--text-secondary)' }}>
              {result.duration.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* 4-Stem Mixer Channels Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}>
        {trackKeys.map((k) => {
          const trackInfo = tracks[k] as StemTrackInfo;
          const ctrl = controls[k] || { volume: 0.85, muted: false, solo: false };
          const badgeClass = trackBadgeColors[k] || 'badge-purple';

          return (
            <div
              key={k}
              className="glass-panel"
              style={{
                padding: 18,
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                border: ctrl.solo ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                background: ctrl.muted ? 'rgba(15, 23, 42, 0.4)' : undefined
              }}
            >
              {/* Channel Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                  {trackInfo.name || k.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {trackInfo.notes_count} Notes
                </span>
              </div>

              {/* Channel Details */}
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {trackInfo.instrument}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Dedicated AI Extracted Staff
                </p>
              </div>

              {/* Mini Waveform Display */}
              <div style={{
                height: 36,
                background: 'rgba(10, 15, 29, 0.8)',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                gap: 2,
                border: '1px solid var(--border-subtle)'
              }}>
                {(trackInfo.waveform || []).slice(0, 50).map((amp, wIdx) => (
                  <div
                    key={wIdx}
                    style={{
                      flex: 1,
                      height: `${Math.max(10, amp * 100)}%`,
                      background: ctrl.muted ? '#475569' : (ctrl.solo ? '#38bdf8' : '#8b5cf6'),
                      borderRadius: 1,
                      transition: 'height 0.1s ease'
                    }}
                  />
                ))}
              </div>

              {/* Volume Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {ctrl.muted || ctrl.volume === 0 ? <VolumeX size={15} color="#94a3b8" /> : <Volume2 size={15} color="#c4b5fd" />}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ctrl.muted ? 0 : ctrl.volume}
                  onChange={(e) => setTrackVolume(k, parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: 32, textAlign: 'right' }}>
                  {Math.round((ctrl.muted ? 0 : ctrl.volume) * 100)}%
                </span>
              </div>

              {/* Solo / Mute & Download Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Solo Button */}
                  <button
                    className={`btn ${ctrl.solo ? 'btn-cyan' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800 }}
                    onClick={() => toggleSolo(k)}
                    title="Solo this instrument track"
                  >
                    S
                  </button>

                  {/* Mute Button */}
                  <button
                    className={`btn ${ctrl.muted ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: ctrl.muted ? '#f43f5e' : undefined
                    }}
                    onClick={() => toggleMute(k)}
                    title="Mute this instrument track"
                  >
                    M
                  </button>
                </div>

                {/* Download Isolated Stem WAV */}
                <a
                  href={`/api/export/${result.task_id}/stem/${k}`}
                  download={`${k}_stem.wav`}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                  title="Download isolated audio stem WAV"
                >
                  <Download size={13} />
                  <span>Stem WAV</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
