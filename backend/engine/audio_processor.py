"""
Audio Preprocessing and Musical Feature Extraction (BPM, Beat Grid, Key Signature)
"""
import os
import numpy as np
import librosa
import soundfile as sf
from typing import Dict, Any, Tuple, Optional


class AudioProcessor:
    """Processes audio inputs, estimates tempo, beat grid, and musical key signature."""

    # Major and minor key profile weights (Krumhansl-Schmuckler)
    MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    @classmethod
    def load_audio(cls, file_path: str, target_sr: int = 22050) -> Tuple[np.ndarray, int, float]:
        """
        Loads audio file, converts to mono float32, and returns (audio_array, sample_rate, duration_seconds).
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found at {file_path}")

        try:
            y, sr = librosa.load(file_path, sr=target_sr, mono=True)
        except Exception:
            # Fallback with soundfile
            data, sr_orig = sf.read(file_path)
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            if sr_orig != target_sr:
                y = librosa.resample(data.astype(np.float32), orig_sr=sr_orig, target_sr=target_sr)
                sr = target_sr
            else:
                y = data.astype(np.float32)
                sr = sr_orig

        # Normalize audio amplitude
        max_val = np.max(np.abs(y))
        if max_val > 1e-6:
            y = y / max_val * 0.95

        duration = float(len(y) / sr)
        return y, sr, duration

    @classmethod
    def estimate_tempo_and_beats(cls, y: np.ndarray, sr: int) -> Tuple[float, np.ndarray]:
        """
        Estimates BPM tempo and beat timestamps.
        """
        try:
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            # Handle float or array tempo return in newer librosa versions
            if isinstance(tempo, np.ndarray):
                tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
            else:
                tempo = float(tempo)
            
            # Constrain tempo to reasonable musical range (60 - 200)
            if tempo < 55.0 and tempo > 0:
                tempo *= 2.0
            elif tempo > 210.0:
                tempo /= 2.0

            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            if len(beat_times) == 0:
                # Synthesize fallback beat grid if audio is too ambient
                beat_interval = 60.0 / max(tempo, 60.0)
                duration = len(y) / sr
                beat_times = np.arange(0, duration, beat_interval)
        except Exception:
            tempo = 120.0
            beat_interval = 60.0 / 120.0
            duration = len(y) / sr
            beat_times = np.arange(0, duration, beat_interval)

        return round(tempo, 1), beat_times

    @classmethod
    def estimate_key_signature(cls, y: np.ndarray, sr: int) -> Tuple[str, str, float]:
        """
        Estimates Key tonic (e.g. 'C', 'G#') and mode ('major', 'minor') using chroma correlation.
        Returns: (tonic, mode, confidence)
        """
        try:
            # Compute harmonic chromagram
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            chroma_sum = np.sum(chroma, axis=1)
            
            # Normalize chroma vector
            chroma_norm = (chroma_sum - np.mean(chroma_sum)) / (np.std(chroma_sum) + 1e-9)

            major_corrs = []
            minor_corrs = []

            # Normalize reference profiles
            maj_prof_norm = (cls.MAJOR_PROFILE - np.mean(cls.MAJOR_PROFILE)) / np.std(cls.MAJOR_PROFILE)
            min_prof_norm = (cls.MINOR_PROFILE - np.mean(cls.MINOR_PROFILE)) / np.std(cls.MINOR_PROFILE)

            for shift in range(12):
                # Roll profiles to test each tonic root
                maj_rolled = np.roll(maj_prof_norm, shift)
                min_rolled = np.roll(min_prof_norm, shift)
                
                corr_maj = np.corrcoef(chroma_norm, maj_rolled)[0, 1]
                corr_min = np.corrcoef(chroma_norm, min_rolled)[0, 1]
                
                major_corrs.append(corr_maj)
                minor_corrs.append(corr_min)

            max_maj_idx = int(np.argmax(major_corrs))
            max_min_idx = int(np.argmax(minor_corrs))
            max_maj_val = major_corrs[max_maj_idx]
            max_min_val = minor_corrs[max_min_idx]

            if max_maj_val >= max_min_val:
                tonic = cls.PITCH_NAMES[max_maj_idx]
                mode = 'major'
                confidence = float(max_maj_val)
            else:
                tonic = cls.PITCH_NAMES[max_min_idx]
                mode = 'minor'
                confidence = float(max_min_val)

            return tonic, mode, round(max(0.0, min(1.0, (confidence + 1.0) / 2.0)), 3)
        except Exception:
            return 'C', 'major', 0.5

    @classmethod
    def analyze_audio(cls, file_path: str) -> Dict[str, Any]:
        """
        Complete audio analysis returning waveform summary, tempo, key signature, and duration.
        """
        y, sr, duration = cls.load_audio(file_path)
        tempo, beat_times = cls.estimate_tempo_and_beats(y, sr)
        tonic, mode, key_conf = cls.estimate_key_signature(y, sr)

        # Generate simplified waveform data for fast frontend visualization (1000 points)
        hop_length = max(1, len(y) // 1000)
        waveform_downsampled = [round(float(v), 4) for v in np.abs(y[::hop_length])[:1000]]

        return {
            "duration": round(duration, 2),
            "sample_rate": sr,
            "tempo": tempo,
            "beat_times": [round(float(b), 3) for b in beat_times.tolist()],
            "key": {
                "tonic": tonic,
                "mode": mode,
                "confidence": key_conf,
                "display": f"{tonic} {mode.capitalize()}"
            },
            "waveform": waveform_downsampled
        }
