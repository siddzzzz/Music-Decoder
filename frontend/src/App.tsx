import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  FileMusic,
  Activity,
  Layers,
  ListFilter,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Cpu,
  RefreshCw,
  Sparkles,
  Music2,
  Mic2,
  Disc,
  PlaySquare
} from 'lucide-react';

import type { TranscriptionResult, SampleTrack, TranscriptionOptions, NoteEvent } from './types';
import { checkBackendHealth, fetchSamples, transcribeAudioFile, transcribeSampleTrack, reQuantizeScore } from './services/api';
import { Navbar } from './components/Navbar';
import { AudioUploader } from './components/AudioUploader';
import { ScoreViewer } from './components/ScoreViewer';
import { PianoRoll } from './components/PianoRoll';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { NotesTable } from './components/NotesTable';
import { ExportModal } from './components/ExportModal';
import { StemMixer } from './components/StemMixer';
import { NoteEditorModal } from './components/NoteEditorModal';
import { GuitarFretboard } from './components/GuitarFretboard';
import { LyricsKaraokeViewer } from './components/LyricsKaraokeViewer';
import { DrumKitVisualizer } from './components/DrumKitVisualizer';
import { WaterfallVisualizer } from './components/WaterfallVisualizer';

export const App: React.FC = () => {
  const [backendOnline, setBackendOnline] = useState(false);
  const [samples, setSamples] = useState<SampleTrack[]>([]);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [lastSampleId, setLastSampleId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'score' | 'mixer' | 'waterfall' | 'pianoroll' | 'guitar_tab' | 'drums' | 'karaoke' | 'waveform' | 'notes'>('score');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteEvent | null>(null);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);

  const [options, setOptions] = useState<TranscriptionOptions>({
    mode: 'single',
    onset_threshold: 0.5,
    frame_threshold: 0.3,
    minimum_note_length: 58.0,
    quantization_grid: '1/16',
    clef_mode: 'grand_staff',
    time_signature: '4/4',
  });

  // Initial load
  useEffect(() => {
    const init = async () => {
      const isHealthy = await checkBackendHealth();
      setBackendOnline(isHealthy);
      if (isHealthy) {
        try {
          const sampleList = await fetchSamples();
          setSamples(sampleList);
        } catch (e) {
          console.error('Failed to load samples', e);
        }
      }
    };
    init();

    const interval = setInterval(async () => {
      const isHealthy = await checkBackendHealth();
      setBackendOnline(isHealthy);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']
      });
    } catch (e) {
      // ignore
    }
  };

  const handleUploadFile = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage(
      options.mode === 'multitrack'
        ? `Running Demucs stem separation, Whisper lyrics & waterfall decomposition on "${file.name}" (CUDA GPU)...`
        : `Analyzing audio & transcribing "${file.name}"...`
    );
    setLastUploadedFile(file);
    setLastSampleId(null);
    setHasPendingEdits(false);

    try {
      const res = await transcribeAudioFile(file, options, file.name.replace(/\.[^/.]+$/, ''));
      setResult(res);
      if (res.is_multitrack) setActiveTab('score');
      triggerConfetti();
    } catch (err: any) {
      alert(`Error transcribing audio: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSelectSample = async (sampleId: string) => {
    setIsLoading(true);
    const target = samples.find(s => s.id === sampleId);
    setLoadingMessage(
      options.mode === 'multitrack' || sampleId === 'orchestra_ensemble'
        ? `Running Neural Stem Separation (CUDA) on ${target?.name || 'sample'}...`
        : `Running AI neural transcription on ${target?.name || 'sample'}...`
    );
    setLastSampleId(sampleId);
    setLastUploadedFile(null);
    setHasPendingEdits(false);

    try {
      const effectiveOptions = sampleId === 'orchestra_ensemble' ? { ...options, mode: 'multitrack' as const } : options;
      const res = await transcribeSampleTrack(sampleId, effectiveOptions);
      setResult(res);
      if (sampleId === 'acoustic_guitar') {
        setActiveTab('guitar_tab');
      } else if (sampleId === 'classical_piano') {
        setActiveTab('waterfall');
      } else if (res.lyrics && res.lyrics.length > 0) {
        setActiveTab('karaoke');
      } else if (res.is_multitrack) {
        setActiveTab('score');
      }
      triggerConfetti();
    } catch (err: any) {
      alert(`Error transcribing sample: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleReTranscribe = async () => {
    if (lastUploadedFile) {
      handleUploadFile(lastUploadedFile);
    } else if (lastSampleId) {
      handleSelectSample(lastSampleId);
    }
  };

  // Note Editing Handlers
  const handleSaveNote = (updatedNote: NoteEvent) => {
    if (!result) return;
    const updatedNotes = result.notes.map(n =>
      (n.pitch === editingNote?.pitch && Math.abs(n.start - (editingNote?.start || 0)) < 0.001) ? updatedNote : n
    );
    setResult({ ...result, notes: updatedNotes });
    setEditingNote(null);
    setHasPendingEdits(true);
  };

  const handleDeleteNote = (deletedNote: NoteEvent) => {
    if (!result) return;
    const updatedNotes = result.notes.filter(n =>
      !(n.pitch === deletedNote.pitch && Math.abs(n.start - deletedNote.start) < 0.001)
    );
    setResult({ ...result, notes: updatedNotes, notes_count: updatedNotes.length });
    setEditingNote(null);
    setHasPendingEdits(true);
  };

  const handleAddNote = (newNote: NoteEvent) => {
    if (!result) return;
    const updatedNotes = [...result.notes, newNote].sort((a, b) => a.start - b.start);
    setResult({ ...result, notes: updatedNotes, notes_count: updatedNotes.length });
    setHasPendingEdits(true);
  };

  const handleUpdateNoteLyric = (noteIndex: number, newLyric: string) => {
    if (!result || !result.notes[noteIndex]) return;
    const updatedNotes = [...result.notes];
    updatedNotes[noteIndex] = { ...updatedNotes[noteIndex], lyric: newLyric };
    setResult({ ...result, notes: updatedNotes });
    setHasPendingEdits(true);
  };

  const handleApplyEdits = async () => {
    if (!result) return;
    setIsLoading(true);
    setLoadingMessage('Re-quantizing notes, updating MusicXML, and re-engraving score...');

    try {
      const res = await reQuantizeScore({
        task_id: result.task_id,
        notes: result.notes,
        bpm: result.tempo,
        time_signature: result.time_signature,
        key_tonic: result.key.tonic,
        key_mode: result.key.mode,
        clef_mode: result.clef_mode || 'grand_staff',
        quantization_grid: result.quantization_grid,
        title: result.filename,
        is_multitrack: result.is_multitrack,
        tracks: result.tracks
      });
      setResult(res);
      setHasPendingEdits(false);
      triggerConfetti();
    } catch (err: any) {
      alert(`Failed to apply note edits: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResult(null);
    setLastUploadedFile(null);
    setLastSampleId(null);
    setHasPendingEdits(false);
    setEditingNote(null);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        backendOnline={backendOnline}
        hasResult={!!result}
        onOpenExport={() => setIsExportOpen(true)}
        onPrint={handlePrint}
        onReset={handleReset}
      />

      <main className="main-content">
        {!result ? (
          /* Audio Upload & Sample Selector View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <AudioUploader
              samples={samples}
              onUploadFile={handleUploadFile}
              onSelectSample={handleSelectSample}
              options={options}
              onOptionsChange={setOptions}
              isLoading={isLoading}
              loadingMessage={loadingMessage}
            />

            <ControlPanel
              options={options}
              onChange={setOptions}
              isProcessing={isLoading}
            />
          </div>
        ) : (
          /* Active Sheet Music Studio Workspace */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Banner for Transcribed Score */}
            <div className="glass-panel" style={{
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              borderLeft: result.is_multitrack ? '4px solid var(--accent-cyan)' : '4px solid var(--accent-purple)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <ArrowLeft size={13} />
                    <span>Upload New</span>
                  </button>

                  <span className={result.is_multitrack ? "badge badge-cyan" : "badge badge-purple"} style={{ fontSize: '0.7rem' }}>
                    <CheckCircle2 size={12} />
                    {result.is_multitrack ? 'Orchestral Conductor Score' : 'Solo Transcribed Score'}
                  </span>

                  {result.device && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
                      <Cpu size={11} />
                      <span>{result.device.toUpperCase()} ACCELERATED</span>
                    </span>
                  )}

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {result.notes_count} Notes Detected
                  </span>

                  {result.lyrics && result.lyrics.length > 0 && (
                    <span className="badge badge-pink" style={{ fontSize: '0.68rem', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.4)' }}>
                      <Mic2 size={11} />
                      <span>{result.lyrics.length} VOCAL WORDS ALIGNED</span>
                    </span>
                  )}
                </div>

                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {result.filename || 'Transcribed Musical Score'}
                </h2>
              </div>

              {/* Key, BPM & Duration Indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="badge badge-cyan" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  <span>Key: {result.key.display}</span>
                </div>
                <div className="badge badge-purple" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  <span>Tempo: {result.tempo} BPM</span>
                </div>
                <div className="badge badge-emerald" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  <span>Meter: {result.time_signature}</span>
                </div>
                <div className="badge badge-amber" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  <span>Duration: {result.duration}s</span>
                </div>
              </div>
            </div>

            {/* Inferred Harmonic Chord Progression Ribbon */}
            {result.chords && result.chords.length > 0 && (
              <div className="glass-panel" style={{
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 12,
                border: '1px solid var(--border-active)',
                background: 'rgba(15, 23, 42, 0.75)',
                overflowX: 'auto'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c4b5fd', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <Sparkles size={14} />
                  <span>Lead Sheet Chords:</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                  {result.chords.map((c, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        padding: '3px 10px',
                        background: 'rgba(139, 92, 246, 0.18)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>M{c.measure}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>{c.figure}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unsaved Note Edits Alert Banner */}
            {hasPendingEdits && (
              <div className="glass-panel" style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 12,
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fde68a' }}>
                    You have modified note events or lyrics in the visual editor.
                  </span>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleApplyEdits}
                  disabled={isLoading}
                  style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                  <span>Apply Edits & Re-Engrave Score</span>
                </button>
              </div>
            )}

            {/* View Switcher Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.75)',
              padding: 4,
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              width: 'fit-content',
              flexWrap: 'wrap'
            }}>
              <button
                className={`btn ${activeTab === 'score' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('score')}
              >
                <FileMusic size={16} />
                <span>{result.is_multitrack ? "Conductor's Score" : "Sheet Music Score"}</span>
              </button>

              {result.is_multitrack && (
                <button
                  className={`btn ${activeTab === 'mixer' ? 'btn-cyan' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                  onClick={() => setActiveTab('mixer')}
                >
                  <Sliders size={16} />
                  <span>AI Stem Mixer (4 Staves)</span>
                </button>
              )}

              <button
                className={`btn ${activeTab === 'waterfall' ? 'btn-cyan' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('waterfall')}
              >
                <PlaySquare size={16} color={activeTab === 'waterfall' ? '#ffffff' : '#06b6d4'} />
                <span>Waterfall Visualizer</span>
              </button>

              <button
                className={`btn ${activeTab === 'drums' ? 'btn-amber' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('drums')}
              >
                <Disc size={16} color={activeTab === 'drums' ? '#ffffff' : '#f59e0b'} />
                <span>Drum Kit & Percussion</span>
              </button>

              <button
                className={`btn ${activeTab === 'karaoke' ? 'btn-pink' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('karaoke')}
              >
                <Mic2 size={16} color={activeTab === 'karaoke' ? '#ffffff' : '#f472b6'} />
                <span>Vocal Lyrics & Karaoke</span>
              </button>

              <button
                className={`btn ${activeTab === 'guitar_tab' ? 'btn-amber' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('guitar_tab')}
              >
                <Music2 size={16} color={activeTab === 'guitar_tab' ? '#ffffff' : '#f59e0b'} />
                <span>Guitar TAB & Fretboard</span>
              </button>

              <button
                className={`btn ${activeTab === 'pianoroll' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('pianoroll')}
              >
                <Layers size={16} />
                <span>Interactive Piano Roll & Chords</span>
              </button>

              <button
                className={`btn ${activeTab === 'waveform' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('waveform')}
              >
                <Activity size={16} />
                <span>Waveform & Beat Grid</span>
              </button>

              <button
                className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('notes')}
              >
                <ListFilter size={16} />
                <span>Notes Stream & Stats</span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'score' && (
              <ScoreViewer result={result} />
            )}

            {activeTab === 'mixer' && result.is_multitrack && (
              <StemMixer result={result} />
            )}

            {activeTab === 'waterfall' && (
              <WaterfallVisualizer result={result} />
            )}

            {activeTab === 'drums' && (
              <DrumKitVisualizer result={result} />
            )}

            {activeTab === 'karaoke' && (
              <LyricsKaraokeViewer
                result={result}
                onUpdateNoteLyric={handleUpdateNoteLyric}
                onApplyEdits={handleApplyEdits}
              />
            )}

            {activeTab === 'guitar_tab' && (
              <GuitarFretboard result={result} />
            )}

            {activeTab === 'pianoroll' && (
              <PianoRoll
                result={result}
                onEditNote={setEditingNote}
                onAddNote={handleAddNote}
              />
            )}

            {activeTab === 'waveform' && (
              <WaveformVisualizer result={result} />
            )}

            {activeTab === 'notes' && (
              <NotesTable
                result={result}
                onEditNote={setEditingNote}
                onDeleteNote={handleDeleteNote}
              />
            )}

            {/* Embedded AI Settings Drawer */}
            <ControlPanel
              options={options}
              onChange={setOptions}
              onReTranscribe={handleReTranscribe}
              isProcessing={isLoading}
            />
          </div>
        )}
      </main>

      {/* Note Editor Modal */}
      <NoteEditorModal
        note={editingNote}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        onClose={() => setEditingNote(null)}
      />

      {/* Export Formats Modal */}
      {result && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          result={result}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
};
export default App;
