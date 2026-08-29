import type { TranscriptionResult, SampleTrack, TranscriptionOptions } from '../types';

const API_BASE = '/api';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'healthy';
  } catch (err) {
    return false;
  }
}

export async function fetchSamples(): Promise<SampleTrack[]> {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) throw new Error('Failed to load sample tracks');
  const data = await res.json();
  return data.samples || [];
}

export async function transcribeAudioFile(
  file: File,
  options: TranscriptionOptions,
  title?: string,
  composer?: string
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('audio_file', file);
  formData.append('quantization_grid', options.quantization_grid);
  formData.append('time_signature', options.time_signature);
  
  if (options.bpm_override) {
    formData.append('bpm_override', options.bpm_override.toString());
  }
  if (options.key_tonic_override) {
    formData.append('key_tonic_override', options.key_tonic_override);
  }
  if (options.key_mode_override) {
    formData.append('key_mode_override', options.key_mode_override);
  }
  if (title) formData.append('title', title);
  if (composer) formData.append('composer', composer);

  const endpoint = options.mode === 'multitrack' ? `${API_BASE}/transcribe-multitrack` : `${API_BASE}/transcribe`;

  if (options.mode !== 'multitrack') {
    formData.append('onset_threshold', options.onset_threshold.toString());
    formData.append('frame_threshold', options.frame_threshold.toString());
    formData.append('minimum_note_length', options.minimum_note_length.toString());
    formData.append('clef_mode', options.clef_mode);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Transcription failed. Please check audio file.');
  }

  return res.json();
}

export async function transcribeSampleTrack(
  sampleId: string,
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('sample_id', sampleId);
  formData.append('quantization_grid', options.quantization_grid);
  formData.append('time_signature', options.time_signature);

  if (options.bpm_override) {
    formData.append('bpm_override', options.bpm_override.toString());
  }
  if (options.key_tonic_override) {
    formData.append('key_tonic_override', options.key_tonic_override);
  }
  if (options.key_mode_override) {
    formData.append('key_mode_override', options.key_mode_override);
  }

  const endpoint = options.mode === 'multitrack' ? `${API_BASE}/transcribe-sample-multitrack` : `${API_BASE}/transcribe-sample`;

  if (options.mode !== 'multitrack') {
    formData.append('onset_threshold', options.onset_threshold.toString());
    formData.append('frame_threshold', options.frame_threshold.toString());
    formData.append('minimum_note_length', options.minimum_note_length.toString());
    formData.append('clef_mode', options.clef_mode);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to transcribe sample track.');
  }

  return res.json();
}
