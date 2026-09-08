import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Clock,
  Repeat,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TranscriptionResult } from '../types';
import { soundfontService, type SoundfontInstrumentName } from '../services/soundfont';
import { fetchPracticeBounds, type MeasureDescriptor, type SpeedScheduleStep } from '../services/api';

interface PracticeLooperProps {
  result: TranscriptionResult;
  onApplyLoopToScore?: (startMeasure: number, endMeasure: number) => void;
}

export const PracticeLooper: React.FC<PracticeLooperProps> = ({
  result,
  onApplyLoopToScore
}) => {
  // Measure Bounds & Selection
  const [measures, setMeasures] = useState<MeasureDescriptor[]>([]);
  const [startMeasure, setStartMeasure] = useState<number>(1);
  const [endMeasure, setEndMeasure] = useState<number>(2);
  const [secondsPerMeasure, setSecondsPerMeasure] = useState<number>(2.0);

  // Speed Trainer Parameters
  const [enableSpeedTrainer, setEnableSpeedTrainer] = useState<boolean>(true);
  const [startPercent, setStartPercent] = useState<number>(60);
  const [targetPercent, setTargetPercent] = useState<number>(100);
  const [stepPercent, setStepPercent] = useState<number>(10);
  const [repsPerStep, setRepsPerStep] = useState<number>(2);

  // Speed Trainer Active State
  const [currentSpeedPercent, setCurrentSpeedPercent] = useState<number>(60);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [currentStepRep, setCurrentStepRep] = useState<number>(1);
  const [totalLoopsCompleted, setTotalLoopsCompleted] = useState<number>(0);

  // Metronome & Audio Configuration
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(true);
  const [countInEnabled, setCountInEnabled] = useState<boolean>(true);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [instrument, setInstrument] = useState<SoundfontInstrumentName>('acoustic_grand_piano');

  // Playback & Session Tracking
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [practiceSeconds, setPracticeSeconds] = useState<number>(0);

  // Audio Context & Timers
  const audioCtxRef = useRef<AudioContext | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());

  // Derive beats per measure from meter (e.g. 4/4 -> 4 beats)
  const beatsPerMeasure = useMemo(() => {
    try {
      return parseInt(result.time_signature.split('/')[0], 10) || 4;
    } catch {
      return 4;
    }
  }, [result.time_signature]);

  // Load measure boundaries on result change
  useEffect(() => {
    let isMounted = true;
    const loadBounds = async () => {
      try {
        const data = await fetchPracticeBounds({
          notes: result.notes,
          bpm: result.tempo,
          time_signature: result.time_signature
        });
        if (isMounted) {
          setMeasures(data.measures);
          setSecondsPerMeasure(data.seconds_per_measure);
          setStartMeasure(1);
          setEndMeasure(Math.min(data.total_measures, Math.max(1, Math.min(4, data.total_measures))));
        }
      } catch (err) {
        // Fallback local calculation
        const spm = (60.0 / Math.max(30, result.tempo)) * beatsPerMeasure;
        const maxTime = Math.max(...result.notes.map(n => n.end || n.start + 0.5), 4.0);
        const totalM = Math.max(1, Math.ceil(maxTime / spm));
        const localBounds: MeasureDescriptor[] = [];
        for (let m = 1; m <= totalM; m++) {
          localBounds.push({
            measure: m,
            start: (m - 1) * spm,
            end: m * spm,
            duration: spm,
            notes_count: result.notes.filter(n => n.start < m * spm && (n.end || n.start + 0.5) > (m - 1) * spm).length
          });
        }
        if (isMounted) {
          setMeasures(localBounds);
          setSecondsPerMeasure(spm);
          setStartMeasure(1);
          setEndMeasure(Math.min(totalM, 2));
        }
      }
    };
    loadBounds();
    return () => { isMounted = false; };
  }, [result.notes, result.tempo, result.time_signature, beatsPerMeasure]);

  // Sliced Notes for the current [startMeasure, endMeasure] selection
  const selectedRangeNotes = useMemo(() => {
    const rangeStartSec = (startMeasure - 1) * secondsPerMeasure;
    const rangeEndSec = endMeasure * secondsPerMeasure;

    return result.notes.filter(n => {
      const nEnd = n.end || (n.start + (n.duration || 0.5));
      return n.start < rangeEndSec && nEnd > rangeStartSec;
    });
  }, [result.notes, startMeasure, endMeasure, secondsPerMeasure]);

  // Compute Speed Trainer Ramp Schedule
  const speedSchedule: SpeedScheduleStep[] = useMemo(() => {
    const schedule: SpeedScheduleStep[] = [];
    const baseBpm = result.tempo || 120.0;
    const startP = Math.max(30, Math.min(150, startPercent));
    const targetP = Math.max(startP, Math.min(200, targetPercent));
    const stepP = Math.max(1, Math.min(50, stepPercent));

    let currP = startP;
    let stepNum = 1;
    while (currP <= targetP + 0.001) {
      schedule.push({
        step: stepNum,
        percent: currP,
        bpm: Math.round(baseBpm * (currP / 100.0) * 10) / 10,
        repetitions: repsPerStep
      });
      if (currP >= targetP) break;
      currP = Math.min(targetP, currP + stepP);
      stepNum++;
    }
    return schedule;
  }, [result.tempo, startPercent, targetPercent, stepPercent, repsPerStep]);

  // Current effective BPM based on Speed Trainer or 100%
  const effectiveBpm = useMemo(() => {
    const baseBpm = result.tempo || 120.0;
    if (!enableSpeedTrainer) return baseBpm;
    return Math.round(baseBpm * (currentSpeedPercent / 100.0) * 10) / 10;
  }, [result.tempo, enableSpeedTrainer, currentSpeedPercent]);

  // Effective seconds per measure at current practicing BPM
  const effectiveSpm = useMemo(() => {
    return (60.0 / Math.max(30, effectiveBpm)) * beatsPerMeasure;
  }, [effectiveBpm, beatsPerMeasure]);

  // Loop passage duration at effective BPM
  const loopDurationSec = useMemo(() => {
    const numMeasures = Math.max(1, endMeasure - startMeasure + 1);
    return numMeasures * effectiveSpm;
  }, [startMeasure, endMeasure, effectiveSpm]);

  // Practice session stopwatch
  useEffect(() => {
    if (isPlaying) {
      sessionTimerRef.current = window.setInterval(() => {
        setPracticeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [isPlaying]);

  // Audio Context initialization helper
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // High-accuracy synthesis of metronome clicks
  const playMetronomeTick = (isAccent: boolean) => {
    if (!metronomeEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);

      gain.gain.setValueAtTime(isAccent ? 0.35 : 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // ignore
    }
  };

  // Metronome beat ticker during playback
  useEffect(() => {
    if (!isPlaying) {
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
      setCurrentBeat(0);
      return;
    }

    const beatIntervalMs = (60.0 / Math.max(30, effectiveBpm)) * 1000;
    let b = 0;

    metronomeTimerRef.current = window.setInterval(() => {
      const isAccent = (b % beatsPerMeasure) === 0;
      playMetronomeTick(isAccent);
      setCurrentBeat(b % beatsPerMeasure);
      b++;
    }, beatIntervalMs);

    return () => {
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
    };
  }, [isPlaying, effectiveBpm, beatsPerMeasure, metronomeEnabled]);

  // Stop Playback
  const handleStop = () => {
    if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
    soundfontService.stop();
    setIsPlaying(false);
    setCountInBeat(null);
    activeNotesRef.current.clear();
  };

  // Play a single loop iteration of the selected passage
  const playPassageCycle = () => {
    soundfontService.stop();
    activeNotesRef.current.clear();

    const rangeStartSec = (startMeasure - 1) * secondsPerMeasure;
    const timeScaleRatio = (result.tempo || 120.0) / effectiveBpm;

    // Schedule SoundFont notes scaled by current BPM
    selectedRangeNotes.forEach((n, idx) => {
      const noteRelStart = Math.max(0, n.start - rangeStartSec);
      const scaledStartSec = noteRelStart * timeScaleRatio;
      const scaledDur = Math.max(0.1, (n.duration || 0.5) * timeScaleRatio);

      setTimeout(() => {
        if (!activeNotesRef.current.has(idx)) {
          soundfontService.playNote(n.pitch, scaledDur, n.velocity || 80);
          activeNotesRef.current.add(idx);
        }
      }, scaledStartSec * 1000);
    });
  };

  // Handle loop completion & speed ramp advancement
  const handleLoopIterationDone = () => {
    setTotalLoopsCompleted(prev => prev + 1);

    if (enableSpeedTrainer && speedSchedule.length > 0) {
      if (currentStepRep < repsPerStep) {
        setCurrentStepRep(prev => prev + 1);
      } else {
        // Advance to next speed step
        if (currentStepIdx < speedSchedule.length - 1) {
          const nextIdx = currentStepIdx + 1;
          setCurrentStepIdx(nextIdx);
          setCurrentSpeedPercent(speedSchedule[nextIdx].percent);
          setCurrentStepRep(1);
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 }
            });
          } catch {}
        } else {
          // Reached target goal tempo!
          try {
            confetti({
              particleCount: 100,
              spread: 80,
              origin: { y: 0.6 }
            });
          } catch {}
        }
      }
    }
  };

  // Start Playback (with optional 3-2-1 count-in)
  const handlePlay = () => {
    if (isPlaying) {
      handleStop();
      return;
    }

    soundfontService.setInstrument(instrument);
    setIsPlaying(true);

    const startActualLoop = () => {
      setCountInBeat(null);
      playPassageCycle();

      const cycleMs = loopDurationSec * 1000;
      loopTimerRef.current = window.setInterval(() => {
        handleLoopIterationDone();
        playPassageCycle();
      }, cycleMs);
    };

    if (countInEnabled) {
      // 3-2-1 Count-In
      let cBeat = beatsPerMeasure;
      setCountInBeat(cBeat);
      playMetronomeTick(true);

      const beatMs = (60.0 / Math.max(30, effectiveBpm)) * 1000;
      const countInInterval = window.setInterval(() => {
        cBeat--;
        if (cBeat > 0) {
          setCountInBeat(cBeat);
          playMetronomeTick(false);
        } else {
          clearInterval(countInInterval);
          startActualLoop();
        }
      }, beatMs);
    } else {
      startActualLoop();
    }
  };

  // Apply current loop range to master score viewer
  const handleApplyToScore = () => {
    if (onApplyLoopToScore) {
      onApplyLoopToScore(startMeasure, endMeasure);
    }
  };

  // Format seconds into MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Practice Header & Status Banner */}
      <div
        className="glass-panel glow-purple"
        style={{
          padding: '20px 24px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(56, 189, 248, 0.08))',
          border: '1px solid var(--border-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
            }}
          >
            <Repeat size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Practice Looper &amp; Speed Trainer Studio
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
              Loop tricky measures with automatic tempo ramping, metronome clicks, and practice telemetry
            </p>
          </div>
        </div>

        {/* Practice Session Telemetry Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            className="badge"
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Clock size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Session:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#f8fafc' }}>
              {formatTime(practiceSeconds)}
            </span>
          </div>

          <div
            className="badge"
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RotateCcw size={14} color="#a855f7" />
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Loops Done:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#c4b5fd' }}>
              {totalLoopsCompleted}
            </span>
          </div>

          <div
            className="badge"
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Gauge size={14} color="#10b981" />
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Practicing Tempo:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#34d399' }}>
              {effectiveBpm} BPM ({currentSpeedPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Measure Timeline & Speed Trainer Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Left Column: Measure Timeline Selector */}
        <div
          className="glass-panel"
          style={{
            padding: 20,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'rgba(15, 23, 42, 0.75)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 700 }}>
              <Layers size={16} color="#38bdf8" />
              <span>A–B Measure Loop Bounds</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 700 }}>
              Measures {startMeasure} to {endMeasure} ({selectedRangeNotes.length} notes)
            </div>
          </div>

          {/* Interactive Measure Chips Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Click to select passage start (A) and end (B):
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                gap: 8,
                maxHeight: 180,
                overflowY: 'auto',
                padding: 4
              }}
            >
              {measures.map((m) => {
                const isSelected = m.measure >= startMeasure && m.measure <= endMeasure;
                const isStart = m.measure === startMeasure;
                const isEnd = m.measure === endMeasure;

                return (
                  <button
                    key={m.measure}
                    onClick={() => {
                      if (m.measure < startMeasure) {
                        setStartMeasure(m.measure);
                      } else if (m.measure > endMeasure) {
                        setEndMeasure(m.measure);
                      } else {
                        // Toggle logic
                        if (startMeasure === endMeasure) {
                          setEndMeasure(m.measure);
                        } else {
                          setStartMeasure(m.measure);
                          setEndMeasure(m.measure);
                        }
                      }
                    }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 10,
                      border: isStart || isEnd
                        ? '2px solid #8b5cf6'
                        : isSelected
                        ? '1px solid rgba(139, 92, 246, 0.5)'
                        : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(139, 92, 246, 0.22)' : 'rgba(30, 41, 59, 0.5)',
                      color: isSelected ? '#f8fafc' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>M{m.measure}</span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{m.notes_count} notes</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper inputs for start & end measure */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Point A (Start):</span>
              <select
                value={startMeasure}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setStartMeasure(val);
                  if (val > endMeasure) setEndMeasure(val);
                }}
                className="input-control"
                style={{ fontSize: '0.82rem', padding: '4px 10px', width: 75 }}
              >
                {measures.map(m => (
                  <option key={m.measure} value={m.measure}>M{m.measure}</option>
                ))}
              </select>
            </div>

            <ArrowRight size={16} color="#64748b" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Point B (End):</span>
              <select
                value={endMeasure}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setEndMeasure(val);
                  if (val < startMeasure) setStartMeasure(val);
                }}
                className="input-control"
                style={{ fontSize: '0.82rem', padding: '4px 10px', width: 75 }}
              >
                {measures.map(m => (
                  <option key={m.measure} value={m.measure}>M{m.measure}</option>
                ))}
              </select>
            </div>

            {onApplyLoopToScore && (
              <button
                className="btn btn-secondary"
                onClick={handleApplyToScore}
                style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: '0.78rem' }}
                title="Sync bounds with sheet music viewer"
              >
                <span>Sync with Score</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Speed Trainer Acceleration Controls */}
        <div
          className="glass-panel"
          style={{
            padding: 20,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'rgba(15, 23, 42, 0.75)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f8fafc', fontWeight: 700 }}>
              <Zap size={16} color="#f59e0b" />
              <span>Speed Trainer (Progressive Acceleration)</span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableSpeedTrainer}
                onChange={(e) => {
                  setEnableSpeedTrainer(e.target.checked);
                  if (!e.target.checked) setCurrentSpeedPercent(100);
                }}
                style={{ accentColor: '#8b5cf6' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Active</span>
            </label>
          </div>

          {enableSpeedTrainer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Sliders for Start & Target Speeds */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span>Start Tempo:</span>
                    <strong style={{ color: '#38bdf8' }}>{startPercent}% ({Math.round((result.tempo || 120) * (startPercent / 100))} BPM)</strong>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    step="5"
                    value={startPercent}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setStartPercent(val);
                      if (!isPlaying) setCurrentSpeedPercent(val);
                    }}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span>Target Goal:</span>
                    <strong style={{ color: '#10b981' }}>{targetPercent}% ({Math.round((result.tempo || 120) * (targetPercent / 100))} BPM)</strong>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="140"
                    step="5"
                    value={targetPercent}
                    onChange={(e) => setTargetPercent(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Step Acceleration & Repetitions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Step Jump:</span>
                  <select
                    value={stepPercent}
                    onChange={(e) => setStepPercent(parseInt(e.target.value))}
                    className="input-control"
                    style={{ fontSize: '0.78rem', padding: '3px 8px', width: 90 }}
                  >
                    <option value={5}>+5% BPM</option>
                    <option value={10}>+10% BPM</option>
                    <option value={15}>+15% BPM</option>
                    <option value={20}>+20% BPM</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Reps / Step:</span>
                  <select
                    value={repsPerStep}
                    onChange={(e) => setRepsPerStep(parseInt(e.target.value))}
                    className="input-control"
                    style={{ fontSize: '0.78rem', padding: '3px 8px', width: 90 }}
                  >
                    <option value={1}>1 time</option>
                    <option value={2}>2 times</option>
                    <option value={3}>3 times</option>
                    <option value={4}>4 times</option>
                  </select>
                </div>
              </div>

              {/* Visual Step Progression Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Speed Progression:</span>
                  <span>Step {currentStepIdx + 1} of {speedSchedule.length} (Rep {currentStepRep}/{repsPerStep})</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {speedSchedule.map((s, idx) => {
                    const isPassed = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          background: isPassed ? '#10b981' : isCurrent ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.2s'
                        }}
                        title={`${s.percent}% (${s.bpm} BPM)`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              Speed Trainer is disabled. Passages will loop at standard 100% tempo.
            </div>
          )}
        </div>
      </div>

      {/* Interactive Control Deck: Metronome, Instrument & Play Controls */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 24px',
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid var(--border-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        {/* Left: Metronome & Count-In Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Metronome Beat Pulsing Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`btn ${metronomeEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              {metronomeEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>Metronome Click</span>
            </button>

            {/* 4 Beat Visual Pulses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {Array.from({ length: beatsPerMeasure }).map((_, bIdx) => (
                <div
                  key={bIdx}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isPlaying && currentBeat === bIdx
                      ? (bIdx === 0 ? '#38bdf8' : '#8b5cf6')
                      : 'rgba(255, 255, 255, 0.15)',
                    transform: isPlaying && currentBeat === bIdx ? 'scale(1.4)' : 'scale(1)',
                    boxShadow: isPlaying && currentBeat === bIdx ? '0 0 10px #38bdf8' : 'none',
                    transition: 'all 0.1s ease-out'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Count-In Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={countInEnabled}
              onChange={(e) => setCountInEnabled(e.target.checked)}
              style={{ accentColor: '#8b5cf6' }}
            />
            <span>3-2-1 Count-In Lead</span>
          </label>

          {/* SoundFont Instrument Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Sound:</span>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as SoundfontInstrumentName)}
              className="input-control"
              style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 8 }}
            >
              <option value="acoustic_grand_piano">🎹 Grand Piano</option>
              <option value="acoustic_guitar_nylon">🎸 Acoustic Guitar</option>
              <option value="violin">🎻 Violin / Strings</option>
              <option value="flute">🪈 Flute / Winds</option>
              <option value="electric_bass_finger">🎸 Electric Bass</option>
            </select>
          </div>
        </div>

        {/* Center: Count-In Banner if active */}
        {countInBeat !== null && (
          <div
            style={{
              padding: '6px 18px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.6)',
              animation: 'pulse 0.5s infinite'
            }}
          >
            <span>Get Ready:</span>
            <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{countInBeat}</span>
          </div>
        )}

        {/* Right: Big Play / Stop Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`btn ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
            onClick={handlePlay}
            style={{
              padding: '8px 22px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: isPlaying ? '0 0 18px rgba(239, 68, 68, 0.4)' : '0 4px 14px rgba(139, 92, 246, 0.4)'
            }}
          >
            {isPlaying ? (
              <>
                <Pause size={16} />
                <span>Pause Practice</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Start Practice Loop</span>
              </>
            )}
          </button>

          {isPlaying && (
            <button
              className="btn btn-secondary"
              onClick={handleStop}
              style={{ padding: '8px 14px' }}
              title="Stop and reset practice loop"
            >
              <Square size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
