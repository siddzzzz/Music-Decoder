# 🎼 Music-Decoder • AI Instrumental Music to Sheet Music Studio

> **State-of-the-Art Automatic Music Transcription (AMT) & Interactive Sheet Music Engraving System**

Music-Decoder is an end-to-end AI system and modern web studio that transcribes instrumental audio recordings (piano, acoustic guitar, woodwinds, violin, saxophone, synths, etc.) into readable, beautifully engraved musical sheet notation with real-time synchronized playback and multi-format exports (**PDF**, **MusicXML**, **MIDI**, **WAV**).

---

## ✨ Key Features

- 🧠 **Neural Polyphonic Pitch Detection**: Powered by **Spotify Basic Pitch (ONNX)** neural network for onset/frame/offset detection and pitch estimation.
- 🎼 **Musicological Rhythm Quantization**: Translates raw microsecond note timestamps into exact musical rhythm subdivisions (**1/4, 1/8, 1/16, 1/32, Triplets**) using **music21**.
- 🎹 **Intelligent Clef & Voice Splitting**:
  - **Grand Staff (Piano)**: Middle-C split across Treble & Bass staves with tied notes and voice balancing.
  - **Solo Staves**: Treble, Bass, Alto, and Tenor clefs.
- 🎯 **Key & Tempo Detection**:
  - Automatic dynamic BPM and beat-tracking via **Librosa**.
  - Chromagram harmonic key signature detection (Krumhansl-Schmuckler algorithm) with accidental enharmonic spelling (e.g. F# vs Gb).
- 👁️ **Interactive Sheet Music Notation**: Rendered using **OpenSheetMusicDisplay (OSMD)** with dynamic zoom, live cursor following note-by-note, and transposition (+/- semitones).
- 🎹 **Interactive Neural Piano Roll**: Visual canvas displaying notes color-coded by velocity, live playhead scrubbing, and instant auditioning.
- 📦 **Universal Multi-Format Export**:
  - **Sheet Music PDF**: High-resolution printable score document.
  - **MusicXML (.musicxml)**: Compatible with MuseScore, Finale, Sibelius, Dorico, Noteflight.
  - **MIDI (.mid)**: Multi-track sequence for Ableton, FL Studio, Logic Pro.
  - **Audio (.wav)** & Direct **Print**.
- ⚡ **1-Click Built-in Demos**: Comes with synthetic Classical Piano, Acoustic Guitar, and Woodwind sample tracks for instant out-of-the-box testing!

---

## 🏗️ Architecture

```
Music-Decoder/
├── backend/
│   ├── engine/
│   │   ├── audio_processor.py    # Librosa BPM, beat grid & key detection
│   │   ├── transcriber.py        # Spotify Basic-Pitch ONNX neural model
│   │   ├── quantizer.py          # music21 Fraction rhythm quantizer & MusicXML builder
│   │   ├── exporter.py           # PDF, MusicXML, and MIDI exporters
│   │   └── sample_generator.py   # Instrumental synthetic audio generator
│   ├── samples/                  # Built-in demo tracks
│   ├── main.py                   # FastAPI REST server
│   ├── requirements.txt          # Python dependencies
│   └── test_transcription.py     # Automated test suite
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Header with status & export actions
│   │   │   ├── AudioUploader.tsx     # Dropzone, mic recorder & sample cards
│   │   │   ├── ScoreViewer.tsx       # OSMD vector sheet music with live cursor
│   │   │   ├── PianoRoll.tsx         # Interactive canvas piano roll
│   │   │   ├── WaveformVisualizer.tsx# Audio waveform & beat marker scrubber
│   │   │   ├── ControlPanel.tsx      # AI threshold & quantization grid controls
│   │   │   ├── NotesTable.tsx        # Searchable notes stream & statistics
│   │   │   └── ExportModal.tsx       # PDF / MusicXML / MIDI download modal
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
- **Python 3.11** or compatible Python runtime
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
Or start the backend and frontend separately:

- **Backend API**:
  ```powershell
  cd backend
  ..\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Frontend Studio**:
  ```powershell
  cd frontend
  npm run dev
  ```

Open your browser at **http://localhost:5173**!

---

## 🧪 Running Automated Tests

To verify the complete audio processing, neural transcription, quantization, and export pipeline:

```powershell
.\venv\Scripts\python backend/test_transcription.py
```

---

## 📄 License
MIT License