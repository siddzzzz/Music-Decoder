"""
Multi-Drumkit Separation and 5-Line Percussion Notation Engine.
Decomposes isolated drums audio into Kick, Snare, Hi-Hat, Toms, and Cymbals
using multi-band spectral energy and transient analysis.
"""
import numpy as np
import librosa
from typing import List, Dict, Any


class DrumTranscriber:
    """Classifies drum audio into discrete kit pieces and standard GM percussion notation."""

    # Standard General MIDI (GM) Drum Kit Mappings
    GM_DRUM_MAP = {
        "kick": {
            "name": "Bass Drum (Kick)",
            "midi_pitch": 36,
            "staff_pitch": "F4",
            "notehead": "normal",
            "stem_dir": "down"
        },
        "snare": {
            "name": "Snare Drum",
            "midi_pitch": 38,
            "staff_pitch": "C5",
            "notehead": "normal",
            "stem_dir": "up"
        },
        "hihat_closed": {
            "name": "Closed Hi-Hat",
            "midi_pitch": 42,
            "staff_pitch": "G5",
            "notehead": "cross",
            "stem_dir": "up"
        },
        "hihat_open": {
            "name": "Open Hi-Hat",
            "midi_pitch": 46,
            "staff_pitch": "G5",
            "notehead": "cross",
            "stem_dir": "up"
        },
        "tom_low": {
            "name": "Low Tom",
            "midi_pitch": 45,
            "staff_pitch": "A4",
            "notehead": "normal",
            "stem_dir": "up"
        },
        "tom_high": {
            "name": "High Tom",
            "midi_pitch": 50,
            "staff_pitch": "D5",
            "notehead": "normal",
            "stem_dir": "up"
        },
        "crash": {
            "name": "Crash / Ride Cymbal",
            "midi_pitch": 49,
            "staff_pitch": "A5",
            "notehead": "cross",
            "stem_dir": "up"
        }
    }

    @classmethod
    def transcribe_drum_audio(
        cls,
        audio_path: str,
        onset_threshold: float = 0.20,
        target_sr: int = 22050
    ) -> List[Dict[str, Any]]:
        """
        Deconstructs drum audio into classified drum hits with GM MIDI pitches and notation staves.
        """
        try:
            y, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        except Exception as e:
            print(f"[DrumTranscriber] Error loading audio: {e}")
            return []

        if len(y) == 0 or np.max(np.abs(y)) < 1e-4:
            return []

        hop_length = 512
        n_fft = 1024

        # 1. Compute Short-Time Fourier Transform power spectrogram
        stft_res = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
        power_spec = np.abs(stft_res)**2
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

        # Spectral energy masks
        low_mask = freqs <= 160               # Sub-bass: Kick
        mid_mask = (freqs > 180) & (freqs <= 2400) # Mid: Snare & Toms
        high_mask = freqs > 4200              # High: Hi-Hats & Cymbals

        low_energy = np.sum(power_spec[low_mask, :], axis=0)
        mid_energy = np.sum(power_spec[mid_mask, :], axis=0)
        high_energy = np.sum(power_spec[high_mask, :], axis=0)

        # 2. Master Onset Detection
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
        peaks = librosa.util.peak_pick(
            onset_env,
            pre_max=3, post_max=3,
            pre_avg=3, post_avg=3,
            delta=onset_threshold,
            wait=4
        )

        drum_hits: List[Dict[str, Any]] = []

        for p in peaks:
            hit_time = float(librosa.frames_to_time(p, sr=sr, hop_length=hop_length))

            # Energy window around peak frame (±2 frames)
            f_start = max(0, p - 1)
            f_end = min(power_spec.shape[1], p + 3)

            e_low = float(np.sum(low_energy[f_start:f_end]))
            e_mid = float(np.sum(mid_energy[f_start:f_end]))
            e_high = float(np.sum(high_energy[f_start:f_end]))
            total_e = e_low + e_mid + e_high + 1e-9

            r_low = e_low / total_e
            r_mid = e_mid / total_e
            r_high = e_high / total_e

            # High-frequency sustain / decay for Open vs Closed Hi-Hat
            decay_frames = high_energy[p: min(power_spec.shape[1], p + 8)]
            decay_sustain = float(np.mean(decay_frames)) if len(decay_frames) > 0 else 0.0

            # Dynamic velocity calculation
            peak_val = float(onset_env[p])
            vel = int(np.clip(round((peak_val / (np.max(onset_env) + 1e-5)) * 95 + 32), 35, 127))

            detected_pieces = []

            # 1. Kick Detection
            if r_low >= 0.40 or (e_low > 10.0 and r_low > 0.28):
                detected_pieces.append("kick")

            # 2. Snare Detection
            if (r_mid >= 0.32 and r_low < 0.60) or (r_mid > 0.22 and r_high > 0.25 and r_low < 0.40):
                detected_pieces.append("snare")

            # 3. Hi-Hat & Cymbal Detection
            if r_high >= 0.35 or (e_high > 5.0 and r_high > 0.25):
                if decay_sustain > 12.0 and r_high > 0.50:
                    detected_pieces.append("crash")
                elif decay_sustain > 3.0:
                    detected_pieces.append("hihat_open")
                else:
                    detected_pieces.append("hihat_closed")

            # Fallback if no specific piece met multi-band conditions
            if not detected_pieces:
                if r_low >= r_mid and r_low >= r_high:
                    detected_pieces.append("kick")
                elif r_mid >= r_high:
                    detected_pieces.append("snare")
                else:
                    detected_pieces.append("hihat_closed")

            for piece_key in detected_pieces:
                info = cls.GM_DRUM_MAP.get(piece_key, cls.GM_DRUM_MAP["kick"])
                drum_hits.append({
                    "piece": piece_key,
                    "name": info["name"],
                    "pitch": info["midi_pitch"],
                    "staff_pitch": info["staff_pitch"],
                    "notehead": info["notehead"],
                    "stem_dir": info["stem_dir"],
                    "start": round(hit_time, 3),
                    "end": round(hit_time + 0.15, 3),
                    "duration": 0.15,
                    "velocity": vel,
                    "track": "drums",
                    "instrument": "Drums"
                })

        drum_hits.sort(key=lambda x: (x["start"], x["pitch"]))
        return drum_hits

    @classmethod
    def convert_notes_to_drum_notation(cls, raw_notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Converts generic transcribed notes from a drum track into proper GM drum pieces.
        """
        converted = []
        for n in raw_notes:
            pitch = int(n["pitch"])
            # Map pitch frequency range to drum piece
            if pitch < 40:
                piece_key = "kick"
            elif 40 <= pitch <= 52:
                piece_key = "snare" if pitch % 2 == 0 else "tom_low"
            elif 53 <= pitch <= 65:
                piece_key = "hihat_closed"
            else:
                piece_key = "crash"

            info = cls.GM_DRUM_MAP[piece_key]
            n_copy = dict(n)
            n_copy["piece"] = piece_key
            n_copy["name"] = info["name"]
            n_copy["pitch"] = info["midi_pitch"]
            n_copy["staff_pitch"] = info["staff_pitch"]
            n_copy["notehead"] = info["notehead"]
            n_copy["stem_dir"] = info["stem_dir"]
            n_copy["track"] = "drums"
            n_copy["instrument"] = "Drums"
            converted.append(n_copy)

        return converted
