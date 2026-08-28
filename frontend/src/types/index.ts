export interface NoteEvent {
  pitch: number;
  name: string;
  start: number;
  end: number;
  duration: number;
  velocity: number;
  amplitude: number;
}

export interface KeySignatureInfo {
  tonic: string;
  mode: string;
  confidence: number;
  display: string;
}

export interface TranscriptionExports {
  midi: string;
  musicxml: string;
  pdf: string;
  audio: string;
}

export interface TranscriptionResult {
  task_id: string;
  filename: string;
  duration: number;
  tempo: number;
  detected_tempo: number;
  key: KeySignatureInfo;
  time_signature: string;
  clef_mode: string;
  quantization_grid: string;
  notes_count: number;
  notes: NoteEvent[];
  waveform: number[];
  beat_times: number[];
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
