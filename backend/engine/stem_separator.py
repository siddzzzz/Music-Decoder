"""
Neural Source Separation Engine using Meta's HT-Demucs (CUDA Accelerated)
Separates full songs and orchestral recordings into 4 isolated stems:
- Vocals / Lead Melody / Solo Winds
- Other / Harmony / Strings / Keyboards / Guitar
- Bass / Cello / Low Brass
- Drums / Percussion
"""
import os
import torch
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
import demucs.api


class StemSeparator:
    """Handles deep learning audio stem separation on GPU / CPU."""

    def __init__(self, model_name: str = "htdemucs", device: Optional[str] = None):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.model_name = model_name
        self.separator = demucs.api.Separator(
            model=self.model_name,
            device=self.device,
            segment=None,  # Full track processing
            shifts=1,      # Fast high-quality inference
            split=True,
            progress=False
        )

    def separate(self, audio_path: str, output_dir: str) -> Dict[str, Any]:
        """
        Separates audio_path into 4 stems and saves them to output_dir.

        Returns:
            Dict containing paths to:
            {
                "vocals": str (path to vocals/lead.wav),
                "other": str (path to other/harmony.wav),
                "bass": str (path to bass.wav),
                "drums": str (path to drums.wav),
                "device": str ("cuda" or "cpu"),
                "sample_rate": int (44100)
            }
        """
        os.makedirs(output_dir, exist_ok=True)
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Input audio not found: {audio_path}")

        # Run separation
        origin, separated = self.separator.separate_audio_file(audio_path)

        stem_paths: Dict[str, Any] = {
            "device": self.device,
            "sample_rate": self.separator.samplerate,
            "stems": {}
        }

        # Save separated stems
        for stem_name, stem_tensor in separated.items():
            stem_path = os.path.join(output_dir, f"{stem_name}.wav")
            # Convert torch tensor (channels, samples) to numpy (samples, channels)
            audio_np = stem_tensor.cpu().numpy().T
            sf.write(stem_path, audio_np, self.separator.samplerate)
            stem_paths["stems"][stem_name] = stem_path

        return stem_paths
