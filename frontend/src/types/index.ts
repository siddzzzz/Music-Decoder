export interface NoteEvent {
  pitch: number;
  name: string;
  start: number;
  end: number;
  duration: number;
  velocity: number;
  amplitude?: number;
  track?: string;
  instrument?: string;
  string?: number;
  fret?: number;
}

export interface KeySignatureInfo {
  tonic: string;
  mode: string;
  confidence: number;
  display: string;
}

export interface ChordInfo {
  figure: string;
  root: string;
  quality: string;
  bass: string;
  confidence: number;
  measure: number;
  start_time: number;
  end_time: number;
}

export interface TranscriptionExports {
  midi: string;
  musicxml: string;
  pdf: string;
  audio: string;
  stems?: Record<string, string>;
}

export interface StemTrackInfo {
  name: string;
  instrument: string;
  notes_count: number;
  notes: NoteEvent[];
  waveform: number[];
  audio_path: string;
}

export interface TranscriptionResult {
  task_id: string;
  is_multitrack?: boolean;
  device?: string;
  filename?: string;
  duration: number;
  tempo: number;
  detected_tempo?: number;
  key: KeySignatureInfo;
  time_signature: string;
  clef_mode?: string;
  quantization_grid: string;
  notes_count: number;
  notes: NoteEvent[];
  tab_notes?: NoteEvent[];
  ascii_tab?: string;
  chords?: ChordInfo[];
  waveform?: number[];
  beat_times?: number[];
  tracks?: Record<string, StemTrackInfo>;
  musicxml: string;
  exports: TranscriptionExports;
}

export interface SampleTrack {
  id: string;
  name: string;
  instrument: string;
  filename: string;
  path: string;
  duration: number;
  bpm: number;
  key: string;
  description: string;
}

export interface TranscriptionOptions {
  mode: 'single' | 'multitrack';
  onset_threshold: number;
  frame_threshold: number;
  minimum_note_length: number;
  quantization_grid: string;
  clef_mode: string;
  time_signature: string;
  bpm_override?: number;
  key_tonic_override?: string;
  key_mode_override?: string;
}
