import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Music2,
  RefreshCw,
  Square,
  Volume2,
  ArrowRight,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TranscriptionResult } from '../types';
import { harmonizeScore, transposeScore } from '../services/api';
import { soundfontService } from '../services/soundfont';

interface HarmonizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TranscriptionResult;
  onApplyResult: (updatedResult: TranscriptionResult) => void;
}

export type HarmonizationStyle = 'choir_3part' | 'string_quartet' | 'brass_horns' | 'jazz_tensions';

interface StyleOption {
  id: HarmonizationStyle;
  name: string;
  badge: string;
  icon: string;
  description: string;
  parts: string[];
  color: string;
}

const STYLES: StyleOption[] = [
  {
    id: 'choir_3part',
    name: '3-Part Vocal Choir',
    badge: 'SATB Choral',
    icon: '🎙️',
    description: 'Lead melody carried by Soprano, accompanied by close diatonic Alto harmony and anchored by Tenor & Bass roots.',
    parts: ['Soprano (Melody)', 'Alto (Harmony 3rd/4th)', 'Tenor & Bass (Root/5th Anchor)'],
    color: '#a855f7'
  },
  {
    id: 'string_quartet',
    name: 'Classical String Quartet',
    badge: '4-Part Chamber',
    icon: '🎻',
    description: 'Violin I takes the lead cantabile melody, Violin II plays counterpoint lines, Viola fills inner harmonies, and Cello articulates the bass foundation.',
    parts: ['Violin I (Concertmaster)', 'Violin II (Counter-melody)', 'Viola (Inner Voice)', 'Violoncello (Bass)'],
    color: '#38bdf8'
  },
  {
    id: 'brass_horns',
    name: 'Brass & Horn Section',
    badge: 'Big Band & Horns',
    icon: '🎺',
    description: 'Bright Trumpet lead supported by Tenor Saxophone diatonic 3rds and powerful Trombone low harmonic anchors.',
    parts: ['Bb Trumpet (Lead)', 'Tenor Saxophone (Harmony)', 'Tenor Trombone (Bass Anchor)'],
    color: '#f59e0b'
  },
  {
    id: 'jazz_tensions',
    name: 'Jazz 7th & 9th Color Voicings',
    badge: 'Modern Jazz Harmony',
    icon: '🎷',
    description: 'Reharmonizes melodies with lush upper-structure chord extensions (Major 7th, Minor 7th, 9th tensions) and walking guide tones.',
    parts: ['Lead Voice (Tension Melodies)', 'Guide Tones (3rds & 7ths)', 'Walking Bassline'],
    color: '#10b981'
  }
];

const CIRCLE_OF_FIFTHS_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CIRCLE_OF_FIFTHS_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11
};

export const HarmonizerModal: React.FC<HarmonizerModalProps> = ({
  isOpen,
  onClose,
  result,
  onApplyResult,
}) => {
  const [activeTab, setActiveTab] = useState<'harmonize' | 'transpose'>('harmonize');
  const [selectedStyle, setSelectedStyle] = useState<HarmonizationStyle>('choir_3part');
  const [semitones, setSemitones] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string>('');
  const [isAuditioning, setIsAuditioning] = useState(false);
  const auditionTimerRef = useRef<number | null>(null);

  // Clean up auditioning on unmount or close
  useEffect(() => {
    return () => {
      if (auditionTimerRef.current) clearInterval(auditionTimerRef.current);
      soundfontService.stop();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate destination key based on semitones
  const currentKeyTonic = result.key?.tonic || 'C';
  const currentKeyMode = result.key?.mode || 'major';
  const basePc = NOTE_TO_PC[currentKeyTonic.toUpperCase()] ?? 0;
  const newPc = ((basePc + semitones) % 12 + 12) % 12;
  const preferFlats = FLAT_KEYS.has(currentKeyTonic) || (semitones < 0 && [1, 3, 6, 8, 10].includes(newPc));
  const newTonic = preferFlats ? CIRCLE_OF_FIFTHS_FLATS[newPc] : CIRCLE_OF_FIFTHS_SHARPS[newPc];
  const targetKeyDisplay = `${newTonic} ${currentKeyMode.charAt(0).toUpperCase() + currentKeyMode.slice(1)}`;

  // Quick jump intervals
  const INTERVAL_PRESETS = [
    { label: '-12 st (Octave Down)', value: -12 },
    { label: '-7 st (Fifth Down)', value: -7 },
    { label: '-2 st (Whole Step Down)', value: -2 },
    { label: '-1 st (Half Step Down)', value: -1 },
    { label: '0 st (Original Key)', value: 0 },
    { label: '+1 st (Half Step Up)', value: 1 },
    { label: '+2 st (Whole Step Up)', value: 2 },
    { label: '+5 st (Fourth Up)', value: 5 },
    { label: '+7 st (Fifth Up)', value: 7 },
    { label: '+12 st (Octave Up)', value: 12 },
  ];

  // Stop sound audition
  const handleStopAudition = () => {
    if (auditionTimerRef.current) clearInterval(auditionTimerRef.current);
    auditionTimerRef.current = null;
    soundfontService.stop();
    setIsAuditioning(false);
  };

  // Audition selected harmonization style using SoundFont
  const handleAuditionVoicing = () => {
    if (isAuditioning) {
      handleStopAudition();
      return;
    }

    setIsAuditioning(true);
    // Take first 8 melody notes
    const previewNotes = result.notes.slice(0, 10);
    if (previewNotes.length === 0) {
      setIsAuditioning(false);
      return;
    }

    let noteIdx = 0;
    const bpm = result.tempo || 120.0;
    const stepIntervalMs = (60.0 / Math.max(40, bpm)) * 500; // half-beat preview

    // Set preview instrument based on style
    if (selectedStyle === 'string_quartet') {
      soundfontService.setInstrument('violin');
    } else if (selectedStyle === 'brass_horns') {
      soundfontService.setInstrument('flute');
    } else {
      soundfontService.setInstrument('acoustic_grand_piano');
    }

    auditionTimerRef.current = window.setInterval(() => {
      if (noteIdx >= previewNotes.length) {
        handleStopAudition();
        return;
      }

      const note = previewNotes[noteIdx];
      const leadPitch = note.pitch;

      // Play lead melody
      soundfontService.playNote(leadPitch, 0.45, 90);

      // Play simulated harmony voices based on style
      if (selectedStyle === 'choir_3part') {
        soundfontService.playNote(Math.max(48, leadPitch - 4), 0.45, 75); // Alto
        soundfontService.playNote(Math.max(36, (leadPitch % 12) + 36), 0.45, 80); // Bass
      } else if (selectedStyle === 'string_quartet') {
        soundfontService.playNote(Math.max(48, leadPitch - 3), 0.45, 70); // Violin II
        soundfontService.playNote(Math.max(45, leadPitch - 7), 0.45, 75); // Viola
        soundfontService.playNote(Math.max(36, (leadPitch % 12) + 36), 0.45, 85); // Cello
      } else if (selectedStyle === 'brass_horns') {
        soundfontService.playNote(Math.max(50, leadPitch - 3), 0.45, 80); // Sax
        soundfontService.playNote(Math.max(40, leadPitch - 12), 0.45, 85); // Trombone
      } else if (selectedStyle === 'jazz_tensions') {
        soundfontService.playNote(leadPitch - 2, 0.45, 75); // 9th / tension
        soundfontService.playNote(leadPitch - 6, 0.45, 75); // guide tone
        soundfontService.playNote(Math.max(36, (leadPitch % 12) + 36), 0.45, 80); // Bass
      }

      noteIdx++;
    }, stepIntervalMs);
  };

  // Apply Auto-Harmonization
  const handleApplyHarmonization = async () => {
    handleStopAudition();
    setIsLoading(true);
    setLoadingAction('Generating multi-part musical voicings & engraving multi-staff score...');

    try {
      const updated = await harmonizeScore({
        task_id: result.task_id,
        notes: result.notes,
        style: selectedStyle,
        bpm: result.tempo,
        time_signature: result.time_signature,
        key_tonic: result.key.tonic,
        key_mode: result.key.mode,
        quantization_grid: result.quantization_grid || '1/16',
        title: result.filename ? `${result.filename} (${selectedStyle})` : 'Harmonized Score',
        composer: 'Music-Decoder AI Studio'
      });

      onApplyResult(updated);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
      onClose();
    } catch (err: any) {
      alert(`Harmonization failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  // Apply Key Transposition
  const handleApplyTransposition = async () => {
    handleStopAudition();
    if (semitones === 0) {
      onClose();
      return;
    }

    setIsLoading(true);
    setLoadingAction(`Transposing notes, chords, keys, and guitar TAB to ${targetKeyDisplay}...`);

    try {
      const updated = await transposeScore({
        task_id: result.task_id,
        notes: result.notes,
        semitones: semitones,
        key_tonic: result.key.tonic,
        key_mode: result.key.mode,
        bpm: result.tempo,
        time_signature: result.time_signature,
        clef_mode: result.clef_mode || 'grand_staff',
        quantization_grid: result.quantization_grid || '1/16',
        title: result.filename,
        composer: 'Music-Decoder AI Studio',
        chords: result.chords,
        is_multitrack: result.is_multitrack,
        tracks: result.tracks
      });

      onApplyResult(updated);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
      onClose();
    } catch (err: any) {
      alert(`Transposition failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          handleStopAudition();
          onClose();
        }
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          border: '1px solid var(--border-active)',
          background: 'rgba(15, 23, 42, 0.94)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(139, 92, 246, 0.18)',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(139, 92, 246, 0.12), rgba(56, 189, 248, 0.06))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                Auto-Harmonizer &amp; Key Transposer Studio
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
                Generate multi-part acoustic voicings or transpose across all 12 musical keys with smart accidentals
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleStopAudition();
              onClose();
            }}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              transition: 'all 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Studio Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.6)'
          }}
        >
          <button
            onClick={() => {
              handleStopAudition();
              setActiveTab('harmonize');
            }}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              background: activeTab === 'harmonize' ? 'rgba(139, 92, 246, 0.16)' : 'transparent',
              borderBottom: activeTab === 'harmonize' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeTab === 'harmonize' ? '#c4b5fd' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Music2 size={16} />
            <span>🎼 Multi-Part Auto-Voicing</span>
          </button>

          <button
            onClick={() => {
              handleStopAudition();
              setActiveTab('transpose');
            }}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              background: activeTab === 'transpose' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
              borderBottom: activeTab === 'transpose' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'transpose' ? '#7dd3fc' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RotateCcw size={16} />
            <span>🔄 Key &amp; Semitone Transposer</span>
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          {activeTab === 'harmonize' ? (
            <>
              {/* Context Summary */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
                  <span style={{ fontSize: '0.86rem', color: '#cbd5e1' }}>
                    Melody: <strong style={{ color: '#f8fafc' }}>{result.notes.length} notes</strong> | Key: <strong style={{ color: '#38bdf8' }}>{result.key.display}</strong> | Tempo: <strong style={{ color: '#a855f7' }}>{result.tempo} BPM</strong>
                  </span>
                </div>

                {/* Audition Button */}
                <button
                  className={`btn ${isAuditioning ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={handleAuditionVoicing}
                  disabled={isLoading}
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  {isAuditioning ? (
                    <>
                      <Square size={14} />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} />
                      <span>Audition Voicing (SoundFont)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Voicing Style Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
                {STYLES.map((style) => {
                  const isSelected = selectedStyle === style.id;
                  return (
                    <div
                      key={style.id}
                      onClick={() => {
                        handleStopAudition();
                        setSelectedStyle(style.id);
                      }}
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        border: isSelected ? `2px solid ${style.color}` : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                        boxShadow: isSelected ? `0 0 20px ${style.color}25` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.4rem' }}>{style.icon}</span>
                          <div>
                            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>
                              {style.name}
                            </div>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: style.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}
                            >
                              {style.badge}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: style.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff'
                            }}
                          >
                            <CheckCircle2 size={15} />
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
                        {style.description}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 'auto',
                          paddingTop: 8,
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                        }}
                      >
                        {style.parts.map((p, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: isSelected ? `${style.color}20` : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#f8fafc' : '#94a3b8',
                              fontWeight: 600
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Transposition Visual Center */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  padding: '24px 20px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: 16,
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap'
                }}
              >
                {/* Current Key Card */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Original Key
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
                    {result.key.display}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Tonic: {currentKeyTonic}</div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: semitones === 0 ? '#64748b' : '#38bdf8'
                  }}
                >
                  <ArrowRight size={28} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: semitones === 0 ? 'transparent' : 'rgba(56, 189, 248, 0.15)',
                      border: semitones === 0 ? 'none' : '1px solid rgba(56, 189, 248, 0.3)'
                    }}
                  >
                    {semitones > 0 ? `+${semitones}` : semitones} st
                  </span>
                </div>

                {/* Target Key Card */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Transposed Key
                  </div>
                  <div
                    style={{
                      fontSize: '1.8rem',
                      fontWeight: 900,
                      color: semitones === 0 ? '#94a3b8' : '#38bdf8',
                      marginTop: 4
                    }}
                  >
                    {targetKeyDisplay}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: semitones === 0 ? '#64748b' : '#7dd3fc' }}>
                    {preferFlats ? 'Flat Enharmonics' : 'Sharp Enharmonics'}
                  </div>
                </div>
              </div>

              {/* Semitone Stepper Slider */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '16px 20px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
                    Chromatic Semitone Shift (-12 to +12):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 10px', fontSize: '0.82rem' }}
                      onClick={() => setSemitones((prev) => Math.max(-12, prev - 1))}
                    >
                      -1 st
                    </button>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        minWidth: 40,
                        textAlign: 'center',
                        color: semitones === 0 ? '#f8fafc' : '#38bdf8'
                      }}
                    >
                      {semitones > 0 ? `+${semitones}` : semitones}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 10px', fontSize: '0.82rem' }}
                      onClick={() => setSemitones((prev) => Math.min(12, prev + 1))}
                    >
                      +1 st
                    </button>
                    {semitones !== 0 && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#94a3b8' }}
                        onClick={() => setSemitones(0)}
                        title="Reset to 0"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={semitones}
                  onChange={(e) => setSemitones(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />

                {/* Quick Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {INTERVAL_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSemitones(p.value)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 6,
                        border: semitones === p.value ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: semitones === p.value ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: semitones === p.value ? '#38bdf8' : '#94a3b8',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* What gets updated summary */}
              <div
                style={{
                  padding: '12px 18px',
                  background: 'rgba(56, 189, 248, 0.06)',
                  borderRadius: 12,
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '0.82rem',
                  color: '#94a3b8',
                  lineHeight: 1.5
                }}
              >
                <strong style={{ color: '#38bdf8' }}>Synchronized Transposition:</strong> Shifting keys automatically re-pitches all notes, chord progression figures (e.g. C $\rightarrow$ {newTonic}), key signatures, sheet music staves, and recalculates guitar/bass fret tablature.
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {isLoading ? loadingAction : 'Ready to engrave & update studio score'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                handleStopAudition();
                onClose();
              }}
              disabled={isLoading}
              style={{ padding: '8px 18px' }}
            >
              Cancel
            </button>

            {activeTab === 'harmonize' ? (
              <button
                className="btn btn-primary"
                onClick={handleApplyHarmonization}
                disabled={isLoading}
                style={{
                  padding: '8px 22px',
                  background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
                }}
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                <span>Apply Harmonization to Score</span>
              </button>
            ) : (
              <button
                className="btn btn-cyan"
                onClick={handleApplyTransposition}
                disabled={isLoading || semitones === 0}
                style={{
                  padding: '8px 22px',
                  boxShadow: semitones !== 0 ? '0 4px 14px rgba(56, 189, 248, 0.4)' : 'none'
                }}
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                <span>Transpose Entire Score</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
