"""
Instrumental Sample Generator for Instant 1-Click Demos
Generates high-quality synthetic instrumental WAV audio tracks:
1. Classical Piano Melody (Beethoven / Chopin style arpeggio)
2. Acoustic Guitar Fingerstyle (E minor folk progression)
3. Jazz Saxophone / Flute Melody
"""
import os
import numpy as np
import soundfile as sf
from typing import List, Dict, Tuple, Any


class SampleGenerator:
    """Generates synthetic instrumental audio tracks for out-of-the-box testing."""

    SR = 22050

    @classmethod
    def midi_to_freq(cls, midi_note: int) -> float:
        return 440.0 * (2.0 ** ((midi_note - 69.0) / 12.0))

    @classmethod
    def generate_note(
        cls,
        midi_note: int,
        duration_s: float,
        timbre: str = "piano",
        velocity: float = 0.8
    ) -> np.ndarray:
        """Synthesizes a musical note with instrument-specific harmonics and ADSR envelope."""
        freq = cls.midi_to_freq(midi_note)
        total_samples = int(cls.SR * duration_s)
        if total_samples <= 0:
            return np.array([], dtype=np.float32)

        t = np.linspace(0, duration_s, total_samples, endpoint=False)

        # Harmonics configuration by instrument
        if timbre == "piano":
            # Rich piano harmonics with fast hammer attack and exponential decay
            harmonics = [(1, 1.0), (2, 0.5), (3, 0.25), (4, 0.12), (5, 0.06), (6, 0.03)]
            signal = np.zeros(total_samples, dtype=np.float32)
            for h, amp in harmonics:
                signal += amp * np.sin(2 * np.pi * freq * h * t)

            # Piano ADSR: 5ms attack, exponential decay
            attack_len = int(0.008 * cls.SR)
            env = np.exp(-3.5 * t / max(0.5, duration_s))
            if attack_len > 0 and len(env) > attack_len:
                env[:attack_len] = np.linspace(0, 1, attack_len)

        elif timbre == "guitar":
            # Acoustic guitar: plucked string pluck transient + warm body resonance
            harmonics = [(1, 1.0), (2, 0.7), (3, 0.4), (4, 0.3), (5, 0.15)]
            signal = np.zeros(total_samples, dtype=np.float32)
            for h, amp in harmonics:
                phase = np.random.uniform(0, np.pi / 4)
                signal += amp * np.sin(2 * np.pi * freq * h * t + phase)

            # Pluck envelope
            attack_len = int(0.005 * cls.SR)
            env = np.exp(-4.5 * t / max(0.4, duration_s))
            if attack_len > 0 and len(env) > attack_len:
                env[:attack_len] = np.linspace(0, 1, attack_len)

        elif timbre == "flute":
            # Woodwind/Flute: pure fundamental + breath noise + gentle vibrato
            vibrato = 1.0 + 0.015 * np.sin(2 * np.pi * 5.5 * t)
            harmonics = [(1, 1.0), (2, 0.15), (3, 0.05)]
            signal = np.zeros(total_samples, dtype=np.float32)
            for h, amp in harmonics:
                signal += amp * np.sin(2 * np.pi * (freq * vibrato) * h * t)

            # Soft attack and gentle release
            attack_len = int(0.06 * cls.SR)
            release_len = int(0.06 * cls.SR)
            env = np.ones(total_samples, dtype=np.float32)
            if attack_len < len(env):
                env[:attack_len] = np.linspace(0, 1, attack_len)
            if release_len < len(env):
                env[-release_len:] = np.linspace(1, 0, release_len)
        else:
            signal = np.sin(2 * np.pi * freq * t)
            env = np.ones(total_samples, dtype=np.float32)

        return (signal * env * velocity).astype(np.float32)

    @classmethod
    def render_track(
        cls,
        notes: List[Tuple[float, float, int, float]],  # (start_s, dur_s, midi_note, vel)
        timbre: str = "piano"
    ) -> np.ndarray:
        """Renders a full polyphonic musical score to an audio array."""
        if not notes:
            return np.zeros(cls.SR * 2, dtype=np.float32)

        max_time = max(n[0] + n[1] for n in notes) + 0.5
        total_samples = int(max_time * cls.SR)
        audio = np.zeros(total_samples, dtype=np.float32)

        for start_s, dur_s, pitch_midi, vel in notes:
            note_wave = cls.generate_note(pitch_midi, dur_s, timbre=timbre, velocity=vel)
            start_idx = int(start_s * cls.SR)
            end_idx = min(total_samples, start_idx + len(note_wave))
            note_len = end_idx - start_idx
            if note_len > 0:
                audio[start_idx:end_idx] += note_wave[:note_len]

        # Normalize audio amplitude
        max_amp = np.max(np.abs(audio))
        if max_amp > 1e-6:
            audio = audio / max_amp * 0.90

        return audio

    @classmethod
    def generate_all_samples(cls, output_dir: str) -> List[Dict[str, Any]]:
        """Generates 3 rich instrumental audio tracks and saves to output_dir."""
        os.makedirs(output_dir, exist_ok=True)
        samples_info = []

        # 1. Classical Piano: Für Elise & Moonlight Sonata style Arpeggio in C Minor / C Major
        # (start_s, dur_s, midi_note, velocity)
        piano_notes = [
            # Measure 1: C Major Arpeggio (C4, E4, G4, C5)
            (0.0, 0.45, 60, 0.85),  # C4
            (0.5, 0.45, 64, 0.80),  # E4
            (1.0, 0.45, 67, 0.85),  # G4
            (1.5, 0.45, 72, 0.90),  # C5
            # Measure 2: G Major (B3, D4, G4, B4)
            (2.0, 0.45, 59, 0.80),  # B3
            (2.5, 0.45, 62, 0.80),  # D4
            (3.0, 0.45, 67, 0.85),  # G4
            (3.5, 0.45, 71, 0.85),  # B4
            # Measure 3: A Minor (A3, C4, E4, A4)
            (4.0, 0.45, 57, 0.85),  # A3
            (4.5, 0.45, 60, 0.80),  # C4
            (5.0, 0.45, 64, 0.85),  # E4
            (5.5, 0.45, 69, 0.90),  # A4
            # Measure 4: F Major (F3, A3, C4, F4)
            (6.0, 0.45, 53, 0.80),  # F3
            (6.5, 0.45, 57, 0.80),  # A3
            (7.0, 0.45, 60, 0.85),  # C4
            (7.5, 0.90, 65, 0.90),  # F4
            # Harmony bass notes sustained
            (0.0, 1.9, 48, 0.75),   # Bass C3
            (2.0, 1.9, 43, 0.70),   # Bass G2
            (4.0, 1.9, 45, 0.75),   # Bass A2
            (6.0, 2.4, 41, 0.80),   # Bass F2
        ]
        piano_audio = cls.render_track(piano_notes, timbre="piano")
        piano_path = os.path.join(output_dir, "sample_piano_arpeggio.wav")
        sf.write(piano_path, piano_audio, cls.SR)
        samples_info.append({
            "id": "piano_arpeggio",
            "name": "Classical Piano Melody (C Major)",
            "instrument": "Piano",
            "filename": "sample_piano_arpeggio.wav",
            "path": piano_path,
            "duration": round(len(piano_audio) / cls.SR, 2),
            "bpm": 120,
            "key": "C Major",
            "description": "Polyphonic Grand Piano progression with melodic right hand and bass harmony."
        })

        # 2. Acoustic Guitar Fingerstyle (E Minor Folk Riff)
        guitar_notes = [
            # Measure 1: Em chord fingerpick
            (0.0, 0.7, 40, 0.9),   # Low E2
            (0.3, 0.4, 52, 0.75),  # E3
            (0.6, 0.4, 55, 0.8),   # G3
            (0.9, 0.4, 59, 0.85),  # B3
            (1.2, 0.4, 64, 0.9),   # E4
            (1.5, 0.4, 59, 0.75),  # B3
            # Measure 2: G Major fingerpick
            (1.8, 0.7, 43, 0.9),   # G2
            (2.1, 0.4, 55, 0.75),  # G3
            (2.4, 0.4, 59, 0.8),   # B3
            (2.7, 0.4, 62, 0.85),  # D4
            (3.0, 0.4, 67, 0.9),   # G4
            (3.3, 0.4, 62, 0.75),  # D4
            # Measure 3: D Major fingerpick
            (3.6, 0.7, 50, 0.9),   # D3
            (3.9, 0.4, 57, 0.75),  # A3
            (4.2, 0.4, 62, 0.8),   # D4
            (4.5, 0.4, 66, 0.85),  # F#4
            # Measure 4: Em resolving chord
            (4.8, 1.5, 40, 0.95),  # Low E2
            (4.85, 1.5, 52, 0.85), # E3
            (4.9, 1.5, 55, 0.85),  # G3
            (4.95, 1.5, 59, 0.9),  # B3
            (5.0, 1.8, 64, 0.95),  # E4
        ]
        guitar_audio = cls.render_track(guitar_notes, timbre="guitar")
        guitar_path = os.path.join(output_dir, "sample_guitar_acoustic.wav")
        sf.write(guitar_path, guitar_audio, cls.SR)
        samples_info.append({
            "id": "guitar_acoustic",
            "name": "Acoustic Guitar Fingerstyle (E Minor)",
            "instrument": "Acoustic Guitar",
            "filename": "sample_guitar_acoustic.wav",
            "path": guitar_path,
            "duration": round(len(guitar_audio) / cls.SR, 2),
            "bpm": 100,
            "key": "E Minor",
            "description": "Clean acoustic fingerstyle folk progression in E Minor with rhythmic picking."
        })

        # 3. Flute / Wind Instrumental Lead (D Major Celtic Theme)
        flute_notes = [
            (0.0, 0.4, 62, 0.85),  # D4
            (0.4, 0.4, 64, 0.85),  # E4
            (0.8, 0.6, 66, 0.90),  # F#4
            (1.4, 0.4, 69, 0.90),  # A4
            (1.8, 0.4, 66, 0.85),  # F#4
            (2.2, 0.6, 64, 0.85),  # E4
            (2.8, 0.4, 62, 0.80),  # D4
            (3.2, 0.4, 66, 0.85),  # F#4
            (3.6, 0.8, 69, 0.95),  # A4
            (4.4, 0.4, 71, 0.90),  # B4
            (4.8, 0.4, 74, 0.95),  # D5
            (5.2, 1.2, 73, 0.90),  # C#5
            (6.4, 1.4, 74, 0.95),  # D5
        ]
        flute_audio = cls.render_track(flute_notes, timbre="flute")
        flute_path = os.path.join(output_dir, "sample_flute_melody.wav")
        sf.write(flute_path, flute_audio, cls.SR)
        samples_info.append({
            "id": "flute_melody",
            "name": "Solo Woodwind & Flute Melody (D Major)",
            "instrument": "Flute",
            "filename": "sample_flute_melody.wav",
            "path": flute_path,
            "duration": round(len(flute_audio) / cls.SR, 2),
            "bpm": 110,
            "key": "D Major",
            "description": "Monophonic lyrical melody with expressive phrasing in D Major."
        })

        return samples_info
