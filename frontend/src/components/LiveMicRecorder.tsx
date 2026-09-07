import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  X,
  Activity,
  Radio
} from 'lucide-react';

interface LiveMicRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscribe: (file: File, preset: string, bpm?: number) => void;
  isLoading: boolean;
}

export type MicPresetType = 'singing' | 'whistle' | 'guitar' | 'wind';

interface DetectedNote {
  name: string;
  octave: number;
  freq: number;
  cents: number;
  timestamp: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const LiveMicRecorder: React.FC<LiveMicRecorderProps> = ({
  isOpen,
  onClose,
  onTranscribe,
  isLoading,
}) => {
  if (!isOpen) return null;

  // Recording & stream states
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countDownVal, setCountDownVal] = useState(3);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  // Studio Settings & Presets
  const [preset, setPreset] = useState<MicPresetType>('singing');
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [bpm, setBpm] = useState(120);

  // Real-time Pitch & Audio Analysis
  const [activeNote, setActiveNote] = useState<DetectedNote | null>(null);
  const [noteHistory, setNoteHistory] = useState<DetectedNote[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Metronome refs
  const metronomeTimerRef = useRef<number | null>(null);
  const beatCountRef = useRef<number>(0);
  const [activeBeat, setActiveBeat] = useState<number>(0);

  // Preview audio player ref
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Initialize Microphone Stream and Web Audio Graph
  const initMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start Analysis Loop
      startAnalysisLoop();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access is required for Live Pitch Recording. Please check your browser permissions.');
    }
  };

  // 2. Autocorrelation Pitch Detection
  const autoCorrelate = (buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } => {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rms = Math.sqrt(sumOfSquares / SIZE);
    if (rms < 0.015) {
      return { freq: -1, confidence: 0 }; // Quiet/silence threshold
    }

    // Autocorrelation algorithm with parabolic interpolation
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
      }
    }

    const trimmedBuffer = buffer.slice(r1, r2);
    const c = new Array(trimmedBuffer.length).fill(0);
    for (let i = 0; i < trimmedBuffer.length; i++) {
      for (let j = 0; j < trimmedBuffer.length - i; j++) {
        c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmedBuffer.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (T0 > 0 && T0 < trimmedBuffer.length - 1) {
      const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a) T0 = T0 - b / (2 * a);
    }

    const freq = sampleRate / T0;
    const confidence = maxval / c[0];
    return { freq, confidence };
  };

  const freqToNote = (freq: number): DetectedNote | null => {
    if (freq < 55 || freq > 2200) return null; // Musical pitch range (A1 to C7)
    const midiNum = 69 + 12 * Math.log2(freq / 440);
    const roundedMidi = Math.round(midiNum);
    const noteName = NOTE_NAMES[roundedMidi % 12];
    const octave = Math.floor(roundedMidi / 12) - 1;
    const cents = Math.round((midiNum - roundedMidi) * 100);

    return {
      name: `${noteName}${octave}`,
      octave,
      freq: Math.round(freq),
      cents,
      timestamp: Date.now()
    };
  };

  // 3. Real-time Analysis & Canvas Animation Loop (60 FPS)
  const startAnalysisLoop = () => {
    const buffer = new Float32Array(2048);
    const freqData = new Uint8Array(64);

    const update = () => {
      if (!analyserRef.current || !audioContextRef.current) return;

      analyserRef.current.getFloatTimeDomainData(buffer);
      analyserRef.current.getByteFrequencyData(freqData);

      // Audio Level (RMS)
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);
      const levelPercent = Math.min(100, Math.round(rms * 400));
      setAudioLevel(levelPercent);

      // Pitch Estimation
      const { freq, confidence } = autoCorrelate(buffer, audioContextRef.current.sampleRate);
      if (freq > 0 && confidence > 0.6) {
        const note = freqToNote(freq);
        if (note) {
          setActiveNote(note);
          setNoteHistory(prev => {
            if (prev.length === 0 || prev[prev.length - 1].name !== note.name) {
              return [...prev.slice(-8), note];
            }
            return prev;
          });
        }
      } else {
        setActiveNote(null);
      }

      // Draw Spectrum on Canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / freqData.length) * 1.5;
          let x = 0;

          for (let i = 0; i < freqData.length; i++) {
            const barHeight = (freqData[i] / 255) * canvas.height;
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#06b6d4');
            gradient.addColorStop(0.5, '#8b5cf6');
            gradient.addColorStop(1, '#ec4899');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            x += barWidth;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  // 4. Metronome Sound Generator
  const playMetronomeTick = (isAccent: boolean) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  };

  // 5. Metronome Scheduler
  useEffect(() => {
    if (!isRecording && !isCountingDown) {
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
      return;
    }

    if (metronomeEnabled) {
      const intervalMs = (60 / bpm) * 1000;
      beatCountRef.current = 0;

      metronomeTimerRef.current = window.setInterval(() => {
        const isAccent = beatCountRef.current % 4 === 0;
        playMetronomeTick(isAccent);
        setActiveBeat(beatCountRef.current % 4);
        beatCountRef.current += 1;
      }, intervalMs);

      return () => {
        if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
      };
    }
  }, [isRecording, isCountingDown, metronomeEnabled, bpm]);

  // Lifecycle initialization
  useEffect(() => {
    initMicrophone();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
    };
  }, []);

  // 6. Start Recording with Count-In
  const startRecordingFlow = () => {
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setNoteHistory([]);
    setIsCountingDown(true);
    setCountDownVal(3);

    let count = 3;
    const countTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountDownVal(count);
        if (metronomeEnabled) playMetronomeTick(false);
      } else {
        clearInterval(countTimer);
        setIsCountingDown(false);
        if (metronomeEnabled) playMetronomeTick(true);
        executeMediaRecording();
      }
    }, (60 / bpm) * 1000);
  };

  const executeMediaRecording = () => {
    if (!mediaStreamRef.current) return;
    audioChunksRef.current = [];

    // Prioritize high-quality audio recording format
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : 'audio/webm');

    const mediaRecorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedAudioUrl(url);
    };

    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordSeconds(0);
  };

  // Timer counter during active recording
  useEffect(() => {
    let timer: number | null = null;
    if (isRecording) {
      timer = window.setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // 7. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // 8. Handle Preview Playback
  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current && recordedAudioUrl) {
      const audio = new Audio(recordedAudioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPreviewProgress((audio.currentTime / audio.duration) * 100);
        }
      };
    }

    if (previewAudioRef.current) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudioRef.current.play().catch(() => {});
        setIsPlayingPreview(true);
      }
    }
  };

  // 9. Transcribe Recorded Take
  const handleTranscribeTake = () => {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes('ogg') ? '.ogg' : (recordedBlob.type.includes('wav') ? '.wav' : '.webm');
    const recordedFile = new File([recordedBlob], `live_mic_${preset}_take${ext}`, { type: recordedBlob.type });
    onTranscribe(recordedFile, preset, bpm);
    onClose();
  };

  const presetLabels: Record<MicPresetType, { title: string; desc: string; icon: string }> = {
    singing: {
      title: 'Singing Vocal Melody',
      desc: 'Optimized for human voice range & vibrato tracking',
      icon: '🎤'
    },
    whistle: {
      title: 'Whistling & Humming',
      desc: 'High-precision fundamental sine pitch tracker',
      icon: '😙'
    },
    guitar: {
      title: 'Acoustic Guitar / Pluck',
      desc: 'Fast transient response for solo plucks & frets',
      icon: '🎸'
    },
    wind: {
      title: 'Flute / Sax / Wind Solo',
      desc: 'Smooth sustained wind and brass note detection',
      icon: '🎷'
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel glow-cyan"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 28,
          borderRadius: 22,
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
              }}
            >
              <Mic size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Live Microphone Studio &amp; Tuner
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Sing, hum, whistle, or play into your mic &bull; Real-time pitch tracking &amp; instant transcription
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: 6, borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Real-time Tuner & Visualizer Stage */}
        <div
          style={{
            background: 'rgba(10, 15, 29, 0.85)',
            borderRadius: 16,
            border: '1px solid var(--border-active)',
            padding: '20px 24px',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Top Live Tuner Display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            {/* Note Name Big Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  minWidth: 90,
                  height: 90,
                  borderRadius: 20,
                  background: activeNote
                    ? (Math.abs(activeNote.cents) <= 8
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #8b5cf6, #6366f1)')
                    : 'rgba(30, 41, 59, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: activeNote ? '0 0 25px rgba(139, 92, 246, 0.5)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                  {activeNote ? activeNote.name : '—'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                  {activeNote ? `${activeNote.freq} Hz` : 'Listening...'}
                </span>
              </div>

              {/* Tuning Needle Meter */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>PITCH TUNER:</span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: activeNote
                        ? (Math.abs(activeNote.cents) <= 8 ? '#10b981' : '#f59e0b')
                        : '#64748b'
                    }}
                  >
                    {activeNote
                      ? (Math.abs(activeNote.cents) <= 8
                          ? 'In Tune (Perfect)'
                          : `${activeNote.cents > 0 ? `+${activeNote.cents}` : activeNote.cents} cents ${activeNote.cents > 0 ? 'Sharp ♯' : 'Flat ♭'}`)
                      : 'Sing or whistle into mic'}
                  </span>
                </div>

                {/* Meter Bar */}
                <div
                  style={{
                    width: 220,
                    height: 12,
                    background: 'rgba(30, 41, 59, 0.8)',
                    borderRadius: 6,
                    position: 'relative',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Center zero line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: '#10b981',
                      zIndex: 2
                    }}
                  />
                  {/* Moving Cents Indicator */}
                  {activeNote && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${Math.max(5, Math.min(95, 50 + (activeNote.cents / 50) * 45))}%`,
                        width: 8,
                        marginLeft: -4,
                        background: Math.abs(activeNote.cents) <= 8 ? '#10b981' : '#38bdf8',
                        borderRadius: 3,
                        boxShadow: '0 0 8px #38bdf8',
                        transition: 'left 0.08s ease'
                      }}
                    />
                  )}
                </div>

                {/* Audio Level Meter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>MIC VU:</span>
                  <div
                    style={{
                      width: 140,
                      height: 6,
                      background: 'rgba(30, 41, 59, 0.6)',
                      borderRadius: 3,
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${audioLevel}%`,
                        height: '100%',
                        background: audioLevel > 80 ? '#ef4444' : (audioLevel > 50 ? '#f59e0b' : '#06b6d4'),
                        transition: 'width 0.05s ease'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metronome Beat Pulse Box */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color="#06b6d4" />
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#e2e8f0' }}>METRONOME</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map(beatIdx => (
                  <div
                    key={beatIdx}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: (isRecording || isCountingDown) && activeBeat === beatIdx
                        ? (beatIdx === 0 ? '#ef4444' : '#06b6d4')
                        : 'rgba(71, 85, 105, 0.5)',
                      boxShadow: (isRecording || isCountingDown) && activeBeat === beatIdx
                        ? '0 0 10px #06b6d4'
                        : 'none',
                      transition: 'all 0.1s ease'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {bpm} BPM
              </span>
            </div>
          </div>

          {/* Real-Time Canvas Spectrum Visualizer */}
          <canvas
            ref={canvasRef}
            width={640}
            height={50}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'block'
            }}
          />

          {/* Rolling Note History Stream */}
          {noteHistory.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, overflowX: 'auto' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap' }}>MELODY TAPE:</span>
              {noteHistory.map((n, i) => (
                <div
                  key={`${n.name}-${i}`}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(139, 92, 246, 0.25)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: '#c4b5fd',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {n.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preset Selector Grid */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 8 }}>
            Select Performance Mode &bull; Neural Tracking Preset
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {(Object.keys(presetLabels) as MicPresetType[]).map(pKey => {
              const item = presetLabels[pKey];
              const isSelected = preset === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setPreset(pKey)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    border: isSelected ? '1px solid #06b6d4' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#38bdf8' : '#ffffff' }}>
                      {item.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Metronome & Tempo Control Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            background: 'rgba(30, 41, 59, 0.4)',
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            marginBottom: 20
          }}
        >
          {/* Metronome Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`btn ${metronomeEnabled ? 'btn-cyan' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setMetronomeEnabled(v => !v)}
            >
              {metronomeEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{metronomeEnabled ? 'Metronome ON' : 'Metronome OFF'}</span>
            </button>
          </div>

          {/* Tempo Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Tempo:</span>
            <input
              type="range"
              min={60}
              max={220}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
              style={{ width: 120, accentColor: '#06b6d4', cursor: 'pointer' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: 700, color: '#38bdf8', minWidth: 50 }}>
              {bpm} BPM
            </span>
          </div>
        </div>

        {/* Active Recording Controls & Countdown */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            marginBottom: 20
          }}
        >
          {/* Count-in Overlay */}
          {isCountingDown && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 24px',
                borderRadius: 20,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444'
              }}
            >
              <Radio size={18} color="#ef4444" />
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                GET READY: {countDownVal}...
              </span>
            </div>
          )}

          {/* Record Button / Stop Button */}
          {!isRecording && !isCountingDown && !recordedBlob && (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '14px 36px',
                fontSize: '1.05rem',
                fontWeight: 800,
                borderRadius: 30,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
              }}
              onClick={startRecordingFlow}
            >
              <Mic size={20} />
              <span>Start Recording Take</span>
            </button>
          )}

          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  borderRadius: 20,
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid #ef4444'
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 10px #ef4444'
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  RECORDING: {recordSeconds}s
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '12px 24px',
                  borderRadius: 24,
                  background: 'rgba(30, 41, 59, 0.9)',
                  borderColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700
                }}
                onClick={stopRecording}
              >
                <Square size={16} color="#ef4444" />
                <span>Stop Take</span>
              </button>
            </div>
          )}

          {/* Review Recorded Audio Take */}
          {recordedBlob && !isRecording && (
            <div
              style={{
                width: '100%',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color="#10b981" />
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                    Take Recorded Successfully ({recordSeconds}s)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    onClick={startRecordingFlow}
                  >
                    <RotateCcw size={13} />
                    <span>Re-Record Take</span>
                  </button>
                </div>
              </div>

              {/* Playback Preview Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-cyan"
                  style={{ padding: '8px 14px', borderRadius: '50%' }}
                  onClick={togglePreviewPlayback}
                >
                  {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${previewProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
                      transition: 'width 0.1s linear'
                    }}
                  />
                </div>
              </div>

              {/* Transcribe Take Action Button */}
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)'
                }}
                onClick={handleTranscribeTake}
                disabled={isLoading}
              >
                <Sparkles size={18} />
                <span>Transcribe Take to Sheet Music &amp; MIDI</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
