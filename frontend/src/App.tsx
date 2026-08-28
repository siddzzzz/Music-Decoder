import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  FileMusic,
  Activity,
  Layers,
  ListFilter,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';

import type { TranscriptionResult, SampleTrack, TranscriptionOptions } from './types';
import { checkBackendHealth, fetchSamples, transcribeAudioFile, transcribeSampleTrack } from './services/api';
import { Navbar } from './components/Navbar';
import { AudioUploader } from './components/AudioUploader';
import { ScoreViewer } from './components/ScoreViewer';
import { PianoRoll } from './components/PianoRoll';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { NotesTable } from './components/NotesTable';
import { ExportModal } from './components/ExportModal';

export const App: React.FC = () => {
  const [backendOnline, setBackendOnline] = useState(false);
  const [samples, setSamples] = useState<SampleTrack[]>([]);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [lastSampleId, setLastSampleId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'score' | 'pianoroll' | 'waveform' | 'notes'>('score');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [options, setOptions] = useState<TranscriptionOptions>({
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
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']
      });
    } catch (e) {
      // ignore
    }
  };

  const handleUploadFile = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage(`Analyzing audio & transcribing "${file.name}"...`);
    setLastUploadedFile(file);
    setLastSampleId(null);

    try {
      const res = await transcribeAudioFile(file, options, file.name.replace(/\.[^/.]+$/, ''));
      setResult(res);
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
    setLoadingMessage(`Running AI neural transcription on ${target?.name || 'sample'}...`);
    setLastSampleId(sampleId);
    setLastUploadedFile(null);

    try {
      const res = await transcribeSampleTrack(sampleId, options);
      setResult(res);
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

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResult(null);
    setLastUploadedFile(null);
    setLastSampleId(null);
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
              borderLeft: '4px solid var(--accent-purple)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <ArrowLeft size={13} />
                    <span>Upload New</span>
                  </button>
                  <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                    <CheckCircle2 size={12} />
                    Transcribed Successfully
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {result.notes_count} Notes Detected
                  </span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {result.filename}
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

            {/* View Switcher Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.75)',
              padding: 4,
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              width: 'fit-content'
            }}>
              <button
                className={`btn ${activeTab === 'score' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('score')}
              >
                <FileMusic size={16} />
                <span>Sheet Music Score</span>
              </button>

              <button
                className={`btn ${activeTab === 'pianoroll' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('pianoroll')}
              >
                <Layers size={16} />
                <span>Interactive Piano Roll</span>
              </button>

              <button
                className={`btn ${activeTab === 'waveform' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                onClick={() => setActiveTab('waveform')}
              >
                <Activity size={16} />
                <span>Audio Waveform & Beats</span>
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

            {activeTab === 'pianoroll' && (
              <PianoRoll result={result} />
            )}

            {activeTab === 'waveform' && (
              <WaveformVisualizer result={result} />
            )}

            {activeTab === 'notes' && (
              <NotesTable result={result} />
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
