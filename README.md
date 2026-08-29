# 🎼 Music-Decoder • AI Instrumental & Orchestral Music to Sheet Music Studio

> **State-of-the-Art Automatic Music Transcription (AMT) & Conductor Score Engraving System**

Music-Decoder is an end-to-end AI system and modern web studio that transcribes instrumental audio recordings (solo instruments, acoustic ensembles, full bands, and orchestral compositions) into readable, beautifully engraved musical sheet notation with real-time synchronized playback, AI stem mixing, and universal multi-format exports (**PDF**, **MusicXML**, **Type-1 Multi-Track MIDI**, **WAV**).

---

## ✨ Key Features

- 🎻 **Multi-Track Orchestral & Full Song Transcription**:
  - Powered by **Meta AI's HT-Demucs (Hybrid Transformer)** neural source separation on **NVIDIA CUDA GPU**.
  - Automatically isolates audio into 4 stems: **Lead / Winds / Solo**, **Harmony / Keys / Strings**, **Bass / Cello**, **Drums / Percussion**.
  - Runs dedicated pitch and rhythm transcribers per stem to eliminate harmonic frequency collisions.
- 🎼 **Conductor's Multi-Staff Score Engraving**:
  - Assembles a full Orchestral Score in **music21** with dedicated staves, brackets, and linked barlines.
  - Clef routing: **Treble Clef** (Lead / Flute / Violin), **Grand Staff / Treble** (Piano / Strings), **Bass Clef** (Bass / Cello), **Percussion Clef** (Drums).
- 🧠 **Neural Polyphonic Pitch Detection**: Powered by **Spotify Basic Pitch (ONNX)** for high-precision note onsets, sustained frames, offsets, and velocities.
- 🎚️ **AI Stem Mixer & Conductor Board**:
  - Real-time volume sliders, Solo (`S`), and Mute (`M`) buttons for each separated instrument track.
  - Direct 1-click download of isolated stem audio files (`.wav`).
- 🎹 **Interactive Multi-Track Piano Roll**: Visual canvas color-coding notes by instrument stem (Cyan = Lead, Purple = Harmony, Emerald = Bass, Amber = Percussion).
- 👁️ **Interactive Sheet Music Notation**: Rendered using **OpenSheetMusicDisplay (OSMD)** with dynamic zoom, live cursor following note-by-note, and transposition (+/- semitones).
- 📦 **Universal Multi-Format Export**:
  - **Sheet Music PDF**: High-resolution printable score document (Conductor's score & individual staves).
  - **MusicXML (.musicxml)**: Compatible with MuseScore, Finale, Sibelius, Dorico, Noteflight.
  - **Multi-Track MIDI (.mid)**: Type-1 multi-track sequence for Ableton, FL Studio, Logic Pro.
  - **Audio (.wav)** & Direct **Print**.
- ⚡ **1-Click Built-in Demos**:
  - Classical Piano Arpeggio (C Major)
  - Acoustic Guitar Fingerstyle (E Minor)
  - Solo Woodwind & Flute Melody (D Major)
  - **Symphonic Orchestral Ensemble (G Major)** (Multi-Track 4-stem band)

---

## 🏗️ Architecture

```
Music-Decoder/
├── backend/
│   ├── engine/
│   │   ├── stem_separator.py     # Meta HT-Demucs neural source separation on CUDA GPU
│   │   ├── multitrack_engine.py  # Multi-track coordinator & dedicated stem transcription
│   │   ├── audio_processor.py    # Librosa BPM, beat grid & key detection
│   │   ├── transcriber.py        # Spotify Basic-Pitch ONNX neural model
│   │   ├── quantizer.py          # music21 Fraction rhythm quantizer & multi-staff builder
│   │   ├── exporter.py           # Multi-track PDF, MusicXML, and Type-1 MIDI exporters
│   │   └── sample_generator.py   # Instrumental and orchestral audio generator
│   ├── samples/                  # Built-in demo tracks
│   ├── main.py                   # FastAPI REST server
│   ├── requirements.txt          # Python dependencies
│   ├── test_transcription.py     # Solo instrument test suite
│   └── test_multitrack.py        # Multi-Track CUDA test suite
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Header with GPU status & export actions
│   │   │   ├── AudioUploader.tsx     # Dropzone, mic recorder, mode switch & presets
│   │   │   ├── StemMixer.tsx         # AI 4-stem mixer (volume, solo, mute, stem WAV)
│   │   │   ├── ScoreViewer.tsx       # OSMD vector sheet music with live cursor
│   │   │   ├── PianoRoll.tsx         # Multi-track canvas piano roll
│   │   │   ├── WaveformVisualizer.tsx# Audio waveform & beat marker scrubber
│   │   │   ├── ControlPanel.tsx      # AI threshold & quantization grid controls
│   │   │   ├── NotesTable.tsx        # Searchable notes stream & statistics
│   │   │   └── ExportModal.tsx       # PDF / MusicXML / MIDI / Stems download modal
│   │   ├── services/
│   │   │   ├── api.ts                # REST API client
│   │   │   └── synth.ts              # Web Audio polyphonic synthesizer
│   │   ├── App.tsx                   # Main studio application
│   │   └── index.css                 # Glassmorphic dark design system
│   ├── package.json
│   └── vite.config.ts
│
├── start_app.py                      # One-click launcher script
└── README.md
```

---

## 🚀 Getting Started

### 1. Requirements
- **Python 3.11**
- **NVIDIA GPU** with CUDA (tested on RTX 3050 Laptop GPU) or CPU fallback
- **Node.js** (v18+)

### 2. Setup Virtual Environment & Backend
```powershell
# Create venv and install dependencies
py -3.11 -m venv venv
.\venv\Scripts\pip install -r backend/requirements.txt
```

### 3. Setup Frontend
```powershell
cd frontend
npm install
npm run build
cd ..
```

### 4. Run Everything with 1 Click
```powershell
.\venv\Scripts\python start_app.py
```

Open your browser at **http://localhost:5173**!

---

## 🧪 Running Automated Tests

### Test 1: Solo / Polyphonic Instrument Pipeline
```powershell
.\venv\Scripts\python backend/test_transcription.py
```

### Test 2: Multi-Track Demucs CUDA Separation & Orchestral Score Pipeline
```powershell
.\venv\Scripts\python backend/test_multitrack.py
```

---

## 📄 License
MIT License