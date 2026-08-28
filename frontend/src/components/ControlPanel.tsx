import React from 'react';
import { Sliders, Music2, Grid, RefreshCw, Clock } from 'lucide-react';
import type { TranscriptionOptions } from '../types';

interface ControlPanelProps {
  options: TranscriptionOptions;
  onChange: (options: TranscriptionOptions) => void;
  onReTranscribe?: () => void;
  isProcessing?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  options,
  onChange,
  onReTranscribe,
  isProcessing = false,
}) => {
  const updateOption = <K extends keyof TranscriptionOptions>(key: K, value: TranscriptionOptions[K]) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  return (
    <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color="#8b5cf6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI & Notation Settings
          </h3>
        </div>
        {onReTranscribe && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={onReTranscribe}
            disabled={isProcessing}
          >
            <RefreshCw size={13} className={isProcessing ? 'animate-spin' : ''} />
            <span>Re-Transcribe</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Clef / Instrument Mode */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <Music2 size={14} color="#06b6d4" />
            <span>Score Layout / Clef</span>
          </label>
          <select
            className="select-control"
            value={options.clef_mode}
            onChange={(e) => updateOption('clef_mode', e.target.value)}
          >
            <option value="grand_staff">Piano Grand Staff (Treble + Bass)</option>
            <option value="treble">Treble Clef (Guitar, Violin, Flute, Melody)</option>
            <option value="bass">Bass Clef (Cello, Electric Bass)</option>
            <option value="alto">Alto Clef (Viola)</option>
          </select>
        </div>

        {/* Quantization Grid */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <Grid size={14} color="#10b981" />
            <span>Rhythm Quantization</span>
          </label>
          <select
            className="select-control"
            value={options.quantization_grid}
            onChange={(e) => updateOption('quantization_grid', e.target.value)}
          >
            <option value="1/16">1/16th Note (Standard / Default)</option>
            <option value="1/8">1/8th Note (Simpler / Slower)</option>
            <option value="1/32">1/32nd Note (High Precision)</option>
            <option value="1/4">1/4 Note (Quarter Notes only)</option>
            <option value="triplet_8th">8th Note Triplets (Swing / Jazz)</option>
            <option value="triplet_16th">16th Note Triplets</option>
          </select>
        </div>

        {/* Time Signature */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <Clock size={14} color="#f59e0b" />
            <span>Time Signature</span>
          </label>
          <select
            className="select-control"
            value={options.time_signature}
            onChange={(e) => updateOption('time_signature', e.target.value)}
          >
            <option value="4/4">4/4 Common Time</option>
            <option value="3/4">3/4 Waltz Time</option>
            <option value="2/4">2/4 March Time</option>
            <option value="6/8">6/8 Compound Time</option>
          </select>
        </div>

        {/* Note Onset Sensitivity Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Onset Sensitivity</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#c4b5fd' }}>{options.onset_threshold}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.85"
            step="0.05"
            value={options.onset_threshold}
            onChange={(e) => updateOption('onset_threshold', parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span>More Notes (0.1)</span>
            <span>Cleaner (0.8)</span>
          </div>
        </div>

        {/* Frame Sustain Threshold */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Sustain Sensitivity</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#67e8f9' }}>{options.frame_threshold}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            value={options.frame_threshold}
            onChange={(e) => updateOption('frame_threshold', parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span>Longer Sustains (0.1)</span>
            <span>Staccato (0.8)</span>
          </div>
        </div>

        {/* Minimum Note Length */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>Min Note Duration</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#6ee7b7' }}>{options.minimum_note_length}ms</span>
          </div>
          <input
            type="range"
            min="30"
            max="250"
            step="10"
            value={options.minimum_note_length}
            onChange={(e) => updateOption('minimum_note_length', parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span>Fast Runs (30ms)</span>
            <span>Filter Clicks (250ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
